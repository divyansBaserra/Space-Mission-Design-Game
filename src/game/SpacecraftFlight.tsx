"use client";

import React, { useRef, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GameState } from "./types";
import { StationPhysics } from "./physics";
import { soundManager } from "./audio";
import { HypersonicPlasmaStreaks } from "./HypersonicPlasmaStreaks";

interface SpacecraftFlightProps {
  gameState: GameState;
  physics: StationPhysics;
  onUpdateSpacecraft: (
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    pitch: number,
    yaw: number,
    roll: number,
    propellant: number,
    power: number,
    speed: number,
    distToDock: number,
    relVel: number,
    alignAngle: number,
    cameraViewMode: "COCKPIT" | "CHASE",
    landingGearDeployed: boolean,
    isLanded: boolean,
    surfaceAltitudeMeters: number,
    verticalSpeedMps: number,
    distToPad: number
  ) => void;
  onDockComplete: () => void;
  onLandComplete?: (touchdownVy: number, touchdownDist: number, scoreAward: number) => void;
  onTogglePause?: () => void;
  onExitCockpit?: () => void;
  onToggleCameraView?: () => void;
  onToggleLandingGear?: () => void;
  onToggleControlsOverlay?: () => void;
  onToggleSector?: () => void;
}

export function SpacecraftFlight({
  gameState,
  physics,
  onUpdateSpacecraft,
  onDockComplete,
  onLandComplete,
  onTogglePause,
  onExitCockpit,
  onToggleCameraView,
  onToggleLandingGear,
  onToggleControlsOverlay,
  onToggleSector,
}: SpacecraftFlightProps) {
  const { camera } = useThree();

  // Internal flight physics state
  const posRef = useRef<THREE.Vector3>(
    gameState.spacecraft.position.clone() || new THREE.Vector3(0, 1.0, -28.0)
  );
  const velRef = useRef<THREE.Vector3>(
    gameState.spacecraft.velocity.clone() || new THREE.Vector3(0, 0, 0)
  );
  const pitchRef = useRef<number>(gameState.spacecraft.pitch || 0);
  const yawRef = useRef<number>(gameState.spacecraft.yaw || 0);
  const rollRef = useRef<number>(gameState.spacecraft.roll || 0);
  const propRef = useRef<number>(gameState.spacecraft.propellantPercent ?? 100);
  const pwrRef = useRef<number>(gameState.spacecraft.powerPercent ?? 100);

  // Camera & landing gear modes
  const cameraViewModeRef = useRef<"COCKPIT" | "CHASE">(
    gameState.spacecraft.cameraViewMode ?? "COCKPIT"
  );
  const landingGearRef = useRef<boolean>(
    gameState.spacecraft.landingGearDeployed ?? false
  );
  const isLandedRef = useRef<boolean>(
    gameState.spacecraft.isLanded ?? false
  );

  const keysRef = useRef<{ [code: string]: boolean }>({});
  const lastRoarTimeRef = useRef<number>(0);
  const lastRadarBeepRef = useRef<number>(0);
  const lastAlarmTimeRef = useRef<number>(0);
  const lastImpactTimeRef = useRef<number>(0);
  const lastRcsBurstTimeRef = useRef<number>(0);

  // GPWS descent altitude milestones and voice callouts
  const announcedAltitudesRef = useRef<Set<number>>(new Set());
  const lastGearWarningTimeRef = useRef<number>(0);
  const lastSinkRateWarningTimeRef = useRef<number>(0);
  const lastDockingAbortTimeRef = useRef<number>(0);
  const lastHullStrainTimeRef = useRef<number>(0);
  const hasSpokenIntroRef = useRef<boolean>(false);
  const hasSpokenDockingApproachRef = useRef<boolean>(false);

  // Cockpit camera spring-damper lag, recoil vectors & rotational mass sway
  const camQuatRef = useRef<THREE.Quaternion>(new THREE.Quaternion());
  const camRecoilRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const camSwayRef = useRef<THREE.Vector3>(new THREE.Vector3());
  const angularVelRef = useRef<THREE.Vector3>(new THREE.Vector3());

  // Cockpit Multi-Function Display (MFD) dynamic instruments
  const mfd = useMemo(() => {
    if (typeof window === "undefined") {
      return { pfdCanvas: null, pfdTexture: null, sysCanvas: null, sysTexture: null, radarCanvas: null, radarTexture: null };
    }
    const createMfd = (w: number, h: number) => {
      const c = document.createElement("canvas");
      c.width = w;
      c.height = h;
      const t = new THREE.CanvasTexture(c);
      t.minFilter = THREE.LinearFilter;
      t.magFilter = THREE.LinearFilter;
      return { canvas: c, texture: t };
    };
    const pfd = createMfd(512, 384);
    const sys = createMfd(384, 256);
    const rad = createMfd(384, 256);
    return {
      pfdCanvas: pfd.canvas,
      pfdTexture: pfd.texture,
      sysCanvas: sys.canvas,
      sysTexture: sys.texture,
      radarCanvas: rad.canvas,
      radarTexture: rad.texture,
    };
  }, []);

  // Procedural micro-scratch and dust roughness map for cockpit canopy glass
  const glassTexture = useMemo(() => {
    if (typeof window === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#161616";
    ctx.fillRect(0, 0, 512, 512);

    // Fine linear micro-scratches along canopy wiper arc
    ctx.strokeStyle = "rgba(200, 200, 200, 0.16)";
    ctx.lineWidth = 0.75;
    for (let i = 0; i < 85; i++) {
      ctx.beginPath();
      const x = Math.random() * 512;
      const y = Math.random() * 512;
      const len = 12 + Math.random() * 40;
      const angle = Math.PI / 4 + (Math.random() - 0.5) * 0.35;
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
      ctx.stroke();
    }

    // Micro-meteoroid dust pitting
    ctx.fillStyle = "rgba(230, 230, 230, 0.24)";
    for (let i = 0; i < 160; i++) {
      const px = Math.random() * 512;
      const py = Math.random() * 512;
      ctx.fillRect(px, py, 1.2, 1.2);
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    return tex;
  }, []);

  // Sync state changes from props
  useEffect(() => {
    if (gameState.spacecraft.cameraViewMode) {
      cameraViewModeRef.current = gameState.spacecraft.cameraViewMode;
    }
  }, [gameState.spacecraft.cameraViewMode]);

  useEffect(() => {
    landingGearRef.current = !!gameState.spacecraft.landingGearDeployed;
  }, [gameState.spacecraft.landingGearDeployed]);

  useEffect(() => {
    isLandedRef.current = !!gameState.spacecraft.isLanded;
    if (gameState.spacecraft.isLanded) {
      posRef.current.set(0, -16.2, -110.0);
      velRef.current.set(0, 0, 0);
    }
  }, [gameState.spacecraft.isLanded]);

  // Clean reset on mission restart
  useEffect(() => {
    if (gameState.step === "BRIEFING" && gameState.missionMetSeconds === 0) {
      posRef.current.copy(gameState.spacecraft.position);
      velRef.current.set(0, 0, 0);
      pitchRef.current = 0;
      yawRef.current = 0;
      rollRef.current = 0;
      propRef.current = 100;
      pwrRef.current = 100;
      isLandedRef.current = false;
      landingGearRef.current = false;
      announcedAltitudesRef.current.clear();
      hasSpokenIntroRef.current = false;
      hasSpokenDockingApproachRef.current = false;
      angularVelRef.current.set(0, 0, 0);
      camSwayRef.current.set(0, 0, 0);
    }
  }, [gameState.step, gameState.missionMetSeconds, gameState.spacecraft.position]);

  // Mission Control intro radio transmission when entering cockpit
  useEffect(() => {
    if (gameState.controlMode === "SPACECRAFT_COCKPIT" && !hasSpokenIntroRef.current) {
      hasSpokenIntroRef.current = true;
      const timer = setTimeout(() => {
        soundManager.speakRadioComm(
          "Artemis ORV-1, Houston Flight. Orbit insertion confirmed. Gateway docking beacon acquired. You are go for rendezvous.",
          "HOUSTON"
        );
      }, 750);
      return () => clearTimeout(timer);
    }
  }, [gameState.controlMode]);
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;

      // Controls overlay toggle (KeyC)
      if (e.code === "KeyC") {
        onToggleControlsOverlay?.();
        return;
      }

      // Sector transition (KeyT: Orbit <-> Lunar Surface)
      if (e.code === "KeyT") {
        onToggleSector?.();
        return;
      }

      // Pause toggle
      if (e.code === "Escape" || e.code === "KeyP") {
        onTogglePause?.();
        return;
      }

      // Exit Cockpit / Disembark back to Astronaut
      if (e.code === "KeyH" && gameState.controlMode === "SPACECRAFT_COCKPIT") {
        onExitCockpit?.();
        return;
      }

      // Camera view toggle (Cockpit vs Chase)
      if (e.code === "KeyV" && gameState.controlMode === "SPACECRAFT_COCKPIT") {
        const nextMode = cameraViewModeRef.current === "COCKPIT" ? "CHASE" : "COCKPIT";
        cameraViewModeRef.current = nextMode;
        soundManager.playEquip();
        onToggleCameraView?.();
        return;
      }

      // Landing Gear toggle (Down vs Up)
      if (e.code === "KeyG" && gameState.controlMode === "SPACECRAFT_COCKPIT") {
        landingGearRef.current = !landingGearRef.current;
        soundManager.playGearDeploy();
        onToggleLandingGear?.();
        return;
      }

      // Manual Docking Capture Key (Enter)
      if (e.code === "Enter" && gameState.controlMode === "SPACECRAFT_COCKPIT") {
        const dockingPortPos = gameState.spacecraft.dockingTargetPos;
        const dist = dockingPortPos.distanceTo(posRef.current);
        const speed = velRef.current.length();
        if (dist <= 3.2 && speed <= 1.2 && !gameState.spacecraft.isDocked) {
          soundManager.playDockingLatch();
          soundManager.playSuccessFanfare();
          soundManager.playQuindarTone(true);
          onDockComplete();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement && !gameState.paused) {
        const sensitivity = 0.0016 * (gameState.settings?.mouseSensitivity ?? 1.0);
        const invertY = gameState.settings?.invertY ? -1 : 1;
        // Inject rotational torque into angular velocity (Newtonian rotational inertia)
        angularVelRef.current.y -= e.movementX * sensitivity * 4.2;
        angularVelRef.current.x -= e.movementY * sensitivity * invertY * 4.2;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      soundManager.stopThrusterRumble();
      soundManager.updateHypersonicWind(0);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
    };
  }, [
    gameState.controlMode,
    gameState.paused,
    gameState.settings,
    gameState.spacecraft.dockingTargetPos,
    gameState.spacecraft.isDocked,
    onDockComplete,
    onExitCockpit,
    onTogglePause,
    onToggleCameraView,
    onToggleLandingGear,
    onToggleControlsOverlay,
    onToggleSector,
  ]);

  // Flight simulation loop
  useFrame((_, delta) => {
    if (gameState.controlMode !== "SPACECRAFT_COCKPIT" || gameState.paused) {
      soundManager.updateHypersonicWind(0);
      return;
    }

    const dt = Math.min(delta, 0.08);
    const keys = keysRef.current;

    // Spacecraft local coordinate vectors from orientation
    const euler = new THREE.Euler(pitchRef.current, yawRef.current, rollRef.current, "YXZ");
    const rotQuat = new THREE.Quaternion().setFromEuler(euler);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(rotQuat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotQuat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(rotQuat);

    // Arrow keys flight attitude controls (injecting angular momentum)
    if (keys["ArrowLeft"]) angularVelRef.current.y += 2.6 * dt;
    if (keys["ArrowRight"]) angularVelRef.current.y -= 2.6 * dt;
    if (keys["ArrowUp"]) angularVelRef.current.x += 2.6 * dt;
    if (keys["ArrowDown"]) angularVelRef.current.x -= 2.6 * dt;

    // Roll input (Q / E)
    if (keys["KeyQ"]) {
      angularVelRef.current.z += 2.4 * dt;
      if (Math.random() < 0.15) soundManager.playRcsBurst();
    }
    if (keys["KeyE"]) {
      angularVelRef.current.z -= 2.4 * dt;
      if (Math.random() < 0.15) soundManager.playRcsBurst();
    }

    // Active SAS Counter-Torque damping (bleeds off angular velocity for stability)
    angularVelRef.current.multiplyScalar(Math.pow(0.82, dt * 10));

    // Integrate angular velocity into flight attitude
    yawRef.current += angularVelRef.current.y * dt;
    pitchRef.current += angularVelRef.current.x * dt;
    rollRef.current += angularVelRef.current.z * dt;

    const maxFlightPitch = (75 * Math.PI) / 180;
    pitchRef.current = Math.max(-maxFlightPitch, Math.min(maxFlightPitch, pitchRef.current));

    // Roll centering return
    rollRef.current *= Math.pow(0.92, dt * 8);

    let isThrusting = false;

    // Check if craft is firmly landed on lunar surface pad
    if (isLandedRef.current) {
      // Craft is resting on surface
      posRef.current.y = -16.2;
      velRef.current.set(0, 0, 0);

      // Check for liftoff ascent thrust (Space or W)
      if ((keys["Space"] || keys["KeyW"]) && propRef.current > 0) {
        isLandedRef.current = false;
        velRef.current.y = 4.2;
        isThrusting = true;
        soundManager.playEngineRoar();
      }
    } else {
      // Free flight dynamics
      const isBoosting = !!keys["ShiftLeft"] || !!keys["ShiftRight"];
      const baseThrustAcc = isBoosting ? 9.8 : 4.4; // m/s^2
      const translation = new THREE.Vector3();

      if (propRef.current > 0) {
        if (keys["KeyW"]) {
          translation.addScaledVector(forward, baseThrustAcc);
          isThrusting = true;
        }
        if (keys["KeyS"]) {
          translation.addScaledVector(forward, -baseThrustAcc * 0.7);
          isThrusting = true;
        }
        if (keys["KeyA"]) {
          translation.addScaledVector(right, -baseThrustAcc * 0.6);
          isThrusting = true;
        }
        if (keys["KeyD"]) {
          translation.addScaledVector(right, baseThrustAcc * 0.6);
          isThrusting = true;
        }
        if (keys["Space"]) {
          translation.addScaledVector(up, baseThrustAcc * 0.7);
          isThrusting = true;
        }
        if (keys["ControlLeft"] || keys["KeyX"]) {
          translation.addScaledVector(up, -baseThrustAcc * 0.7);
          isThrusting = true;
        }

        // Continuous Low-Frequency Thruster Rumble with dynamic throttle pitch modulation
        if ((keys["KeyW"] || keys["KeyS"]) && propRef.current > 0) {
          soundManager.startThrusterRumble();
          soundManager.updateThrusterThrottle(isBoosting ? 1.0 : 0.45);
        } else {
          soundManager.stopThrusterRumble();
        }

        // Propellant drain on thrusting
        if (isThrusting) {
          const drainRate = isBoosting ? 1.2 : 0.45;
          propRef.current = Math.max(0, propRef.current - drainRate * dt);
          const now = Date.now();
          if (now - lastRoarTimeRef.current > 280) {
            soundManager.playEngineRoar();
            lastRoarTimeRef.current = now;
          }
        }
      } else {
        soundManager.stopThrusterRumble();
      }

      // Flight Stabilization / Retrograde Brake (KeyX)
      if (keys["KeyX"]) {
        velRef.current.multiplyScalar(Math.pow(0.35, dt * 8));
      }

      // Planetary gravity gradient near lunar surface
      if (posRef.current.z < -50 || posRef.current.y < 5) {
        // Lunar gravity acceleration: 1.62 m/s^2 towards surface
        velRef.current.y -= 1.62 * dt;
      }

      // Apply linear acceleration
      velRef.current.addScaledVector(translation, dt);

      // Orbital damping
      velRef.current.multiplyScalar(Math.pow(0.97, dt * 5));

      // Advance candidate position
      posRef.current.addScaledVector(velRef.current, dt);

      // Solve 3D collision against station modules, gantry, and lunar terrain
      const col = physics.resolveSpacecraftCollision(
        posRef.current,
        velRef.current,
        2.2,
        -18.0
      );

      posRef.current.copy(col.newPos);
      velRef.current.copy(col.newVel);

      if (col.collided && !col.surfaceContact) {
        const impactSpeed = velRef.current.length();
        const now = Date.now();
        if (impactSpeed > 1.8 && now - lastImpactTimeRef.current > 400) {
          soundManager.playHullImpact();
          lastImpactTimeRef.current = now;
        }
      }

      // Extended mission boundaries
      posRef.current.x = THREE.MathUtils.clamp(posRef.current.x, -65, 65);
      posRef.current.y = THREE.MathUtils.clamp(posRef.current.y, -16.2, 45);
      posRef.current.z = THREE.MathUtils.clamp(posRef.current.z, -140, 15);
    }

    // Calculate Surface Landing Telemetry (PAD-01 at [0, -18.0, -110.0])
    const padTopPos = new THREE.Vector3(0, -16.2, -110.0);
    const distToPad = new THREE.Vector2(
      posRef.current.x,
      posRef.current.z - -110.0
    ).length();
    const surfaceAlt = Math.max(0, posRef.current.y - -16.2);
    const verticalSpeed = velRef.current.y;

    // Lunar Powered Descent: Pulsing Radar Altimeter ping rate accelerates as altitude shrinks
    if (surfaceAlt < 28.0 && surfaceAlt > 0.4 && !isLandedRef.current && posRef.current.z < -45) {
      const now = Date.now();
      const pingInterval = Math.max(80, Math.min(1200, surfaceAlt * 38));
      if (now - lastRadarBeepRef.current > pingInterval) {
        soundManager.playRadarBeep();
        lastRadarBeepRef.current = now;
      }
    }

    // GPWS Voice Altitude Announcements during descent towards lunar surface
    if (posRef.current.z < -45 && verticalSpeed < -0.2 && !isLandedRef.current) {
      const altitudes = [
        { alt: 100, text: "ONE HUNDRED" },
        { alt: 50, text: "FIFTY" },
        { alt: 30, text: "THIRTY" },
        { alt: 20, text: "TWENTY" },
        { alt: 10, text: "TEN" },
      ];
      for (const m of altitudes) {
        if (surfaceAlt <= m.alt && surfaceAlt > m.alt - 6.0 && !announcedAltitudesRef.current.has(m.alt)) {
          announcedAltitudesRef.current.add(m.alt);
          soundManager.speakGPWS(m.text);
        } else if (surfaceAlt > m.alt + 12.0) {
          announcedAltitudesRef.current.delete(m.alt);
        }
      }
    }

    // GPWS Landing Gear warning: within 28m of surface descending without landing gear deployed
    if (surfaceAlt < 28.0 && surfaceAlt > 0.8 && !landingGearRef.current && verticalSpeed < -0.4 && !isLandedRef.current && posRef.current.z < -45) {
      const now = Date.now();
      if (now - lastGearWarningTimeRef.current > 4200) {
        soundManager.speakGPWS("WARNING. GEAR UP. GEAR UP.", true);
        lastGearWarningTimeRef.current = now;
      }
    }

    // GPWS Proximity Sink Rate warning alarm when descending excessively fast near ground
    if (surfaceAlt < 18.0 && verticalSpeed < -3.6 && !isLandedRef.current) {
      const now = Date.now();
      if (now - lastAlarmTimeRef.current > 750) {
        soundManager.playWarningAlarm();
        lastAlarmTimeRef.current = now;
      }
      if (now - lastSinkRateWarningTimeRef.current > 3800) {
        soundManager.speakGPWS("SINK RATE! PULL UP! PULL UP!", true);
        lastSinkRateWarningTimeRef.current = now;
      }
    }

    // Touchdown Detection on PAD-01 (Strict vertical descent velocity <= 2.0 m/s with landing gear deployed)
    if (
      surfaceAlt <= 0.35 &&
      distToPad <= 9.2 &&
      Math.abs(verticalSpeed) <= 2.0 &&
      landingGearRef.current &&
      !isLandedRef.current
    ) {
      isLandedRef.current = true;
      posRef.current.y = -16.2;
      const touchdownVy = Math.abs(verticalSpeed);
      const touchdownDist = distToPad;
      const vyBonus = touchdownVy <= 1.0 ? 500 : touchdownVy <= 1.5 ? 350 : 200;
      const distBonus = touchdownDist <= 3.0 ? 350 : touchdownDist <= 6.0 ? 200 : 100;
      const fuelBonus = Math.round(propRef.current * 2.5);
      const totalLandingScore = vyBonus + distBonus + fuelBonus;

      velRef.current.set(0, 0, 0);
      soundManager.playTouchdown();
      soundManager.playSuccessFanfare();
      soundManager.playQuindarTone(false);
      soundManager.speakGPWS("TOUCHDOWN CONFIRMED.");
      setTimeout(() => {
        soundManager.speakRadioComm(
          "Touchdown confirmed, ORV-1. Engine cut-off. Welcome to Lunar Base Alpha.",
          "LUNAR BASE"
        );
      }, 1400);
      onLandComplete?.(touchdownVy, touchdownDist, totalLandingScore);
    }

    // Camera view synchronization
    if (cameraViewModeRef.current === "CHASE") {
      const chaseOffset = forward
        .clone()
        .multiplyScalar(-7.2)
        .add(up.clone().multiplyScalar(2.2));
      const targetCamPos = posRef.current.clone().add(chaseOffset);
      camera.position.lerp(targetCamPos, 0.22);

      const lookTarget = posRef.current.clone().add(forward.clone().multiplyScalar(4.0));
      camera.lookAt(lookTarget);

      if ("fov" in camera) {
        const isBoosting = !!keys["ShiftLeft"] || !!keys["ShiftRight"];
        const targetFov = isThrusting && isBoosting ? 82 : 70;
        const pCam = camera as THREE.PerspectiveCamera;
        pCam.fov = THREE.MathUtils.lerp(pCam.fov, targetFov, dt * 5);
        pCam.updateProjectionMatrix();
      }
    } else {
      // First-person cockpit view with spring-damper inertia lag & thrust recoil
      const targetRecoilZ = isThrusting ? 0.042 : 0.0;
      camRecoilRef.current.z = THREE.MathUtils.lerp(camRecoilRef.current.z, targetRecoilZ, dt * 10);

      // Camera vibration on high thrust with mechanical engine shudder
      const isBoosting = !!keys["ShiftLeft"] || !!keys["ShiftRight"];
      const shakeAmp = isThrusting ? (isBoosting ? 0.012 : 0.007) : 0.0006;
      const shakeX = (Math.random() - 0.5) * shakeAmp;
      const shakeY = (Math.random() - 0.5) * shakeAmp;

      // High-G mechanical hull strain groaned into chassis
      const curSpeed = velRef.current.length();
      const gForce = 1.0 + curSpeed * 0.12 + (isThrusting && isBoosting ? 2.4 : isThrusting ? 1.0 : 0);
      if (gForce > 2.8) {
        const now = Date.now();
        if (now - lastHullStrainTimeRef.current > 2200) {
          soundManager.playHullStrain(gForce / 3.0);
          lastHullStrainTimeRef.current = now;
        }
      }

      // Dynamic pilot head sway from rotational inertia (reacting to angular velocity)
      const targetSwayX = -angularVelRef.current.y * 0.035;
      const targetSwayY = -angularVelRef.current.x * 0.035;
      camSwayRef.current.x = THREE.MathUtils.lerp(camSwayRef.current.x, targetSwayX, dt * 8);
      camSwayRef.current.y = THREE.MathUtils.lerp(camSwayRef.current.y, targetSwayY, dt * 8);

      const cockpitEye = posRef.current
        .clone()
        .add(forward.clone().multiplyScalar(-camRecoilRef.current.z))
        .add(right.clone().multiplyScalar(shakeX + camSwayRef.current.x))
        .add(up.clone().multiplyScalar(shakeY + camSwayRef.current.y));

      camera.position.copy(cockpitEye);

      // Spring-damper rotational slerp lag for authentic heavy vehicle feel
      camQuatRef.current.slerp(rotQuat, 1 - Math.exp(-dt * 20));
      camera.quaternion.copy(camQuatRef.current);

      if ("fov" in camera) {
        const targetFov = isThrusting && isBoosting ? 84 : isThrusting ? 76 : 72;
        const pCam = camera as THREE.PerspectiveCamera;
        pCam.fov = THREE.MathUtils.lerp(pCam.fov, targetFov, dt * 6);
        pCam.updateProjectionMatrix();
      }
    }

    // Audio RCS Solenoid valve burst on thruster activation
    if (isThrusting) {
      const now = Date.now();
      if (now - lastRcsBurstTimeRef.current > 380) {
        soundManager.playRcsBurst();
        lastRcsBurstTimeRef.current = now;
      }
    }

    // Docking Telemetry to station port (0, 1.5, -11.2)
    const dockingPortPos = gameState.spacecraft.dockingTargetPos;
    const toDock = dockingPortPos.clone().sub(posRef.current);
    const distToDock = toDock.length();
    const speed = velRef.current.length();

    // Hypersonic ionization atmospheric & plasma wind roar
    soundManager.updateHypersonicWind(speed);

    // Closing relative velocity towards docking port
    const relVel = -velRef.current.dot(toDock.clone().normalize());

    // Alignment angle between spacecraft forward vector and docking port normal vector (facing +Z)
    const portNormal = new THREE.Vector3(0, 0, 1);
    const heading = forward.clone().normalize();
    const alignmentCos = THREE.MathUtils.clamp(-heading.dot(portNormal), -1, 1);
    const alignmentAngleDeg = (Math.acos(alignmentCos) * 180) / Math.PI;

    // Periodic docking radar proximity beeps when approaching (< 18m)
    if (distToDock < 18 && distToDock > 2.5 && !isLandedRef.current) {
      const now = Date.now();
      const beepInterval = THREE.MathUtils.lerp(1800, 250, (18 - distToDock) / 16);
      if (now - lastRadarBeepRef.current > beepInterval) {
        soundManager.playRadarBeep();
        lastRadarBeepRef.current = now;
      }
    }

    // Mission control docking approach callout
    if (distToDock < 18 && distToDock > 4.0 && !hasSpokenDockingApproachRef.current && !isLandedRef.current && posRef.current.z > -45) {
      hasSpokenDockingApproachRef.current = true;
      soundManager.speakRadioComm(
        "ORV-1, Houston. Target docking collar in sight. Keep approach velocity under zero decimal eight.",
        "HOUSTON"
      );
    }

    // Check Docking Condition at Station Docking Port
    if (distToDock <= 3.2 && !gameState.spacecraft.isDocked) {
      if (speed <= 0.8 && alignmentAngleDeg <= 25) {
        // Successful soft capture
        soundManager.playDockingLatch();
        soundManager.playSuccessFanfare();
        soundManager.playQuindarTone(true);
        soundManager.speakRadioComm(
          "Contact confirmed. Soft capture ring locked. Welcome aboard Gateway One.",
          "GATEWAY"
        );
        onDockComplete();
      } else {
        // Docking Consequence: Crunch, recoil, master caution, and abort transmission
        soundManager.playDockingCrunch();
        soundManager.playMasterCaution();

        const recoilDir = toDock.clone().normalize().negate();
        if (recoilDir.lengthSq() < 0.01) recoilDir.set(0, 0, -1);
        velRef.current.copy(recoilDir.multiplyScalar(Math.max(1.8, speed * 0.9)));
        posRef.current.addScaledVector(recoilDir, 0.4);
        camRecoilRef.current.z = 0.15; // Cockpit eye recoil jerk

        const now = Date.now();
        if (now - lastDockingAbortTimeRef.current > 5000) {
          soundManager.speakRadioComm(
            "ABORT DOCKING. Alignment error or excessive approach speed detected. Structural ring stress.",
            "HOUSTON"
          );
          lastDockingAbortTimeRef.current = now;
        }
      }
    }

    // Notify state manager of complete flight telemetry
    onUpdateSpacecraft(
      posRef.current,
      velRef.current,
      pitchRef.current,
      yawRef.current,
      rollRef.current,
      propRef.current,
      pwrRef.current,
      speed,
      distToDock,
      relVel,
      alignmentAngleDeg,
      cameraViewModeRef.current,
      landingGearRef.current,
      isLandedRef.current,
      surfaceAlt,
      verticalSpeed,
      distToPad
    );
    // Render dynamic cockpit MFD screens when inside cockpit
    if (cameraViewModeRef.current === "COCKPIT") {
      // 1. Center Primary Flight Display (PFD)
      if (mfd.pfdCanvas && mfd.pfdTexture) {
        const ctx = mfd.pfdCanvas.getContext("2d");
        if (ctx) {
          const w = mfd.pfdCanvas.width;
          const h = mfd.pfdCanvas.height;
          ctx.fillStyle = "#02121e";
          ctx.fillRect(0, 0, w, h);

          // Artificial Horizon (Pitch & Roll)
          ctx.save();
          ctx.translate(w / 2, h / 2);
          ctx.rotate(-rollRef.current);
          const pitchShift = pitchRef.current * 160;

          // Sky (Cyan-Blue) & Ground (Dark Slate)
          ctx.fillStyle = "#0284c7";
          ctx.fillRect(-w, -h + pitchShift, w * 2, h);
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(-w, pitchShift, w * 2, h);

          // Horizon Line
          ctx.strokeStyle = "#38bdf8";
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(-w, pitchShift);
          ctx.lineTo(w, pitchShift);
          ctx.stroke();

          // Pitch Ladder rungs (+15, -15)
          ctx.strokeStyle = "rgba(255, 255, 255, 0.75)";
          ctx.lineWidth = 2;
          ctx.font = "bold 14px monospace";
          ctx.fillStyle = "#ffffff";
          [-30, -15, 15, 30].forEach((deg) => {
            const y = pitchShift - (deg / 180) * Math.PI * 160;
            ctx.beginPath();
            ctx.moveTo(-50, y);
            ctx.lineTo(50, y);
            ctx.stroke();
            ctx.fillText(`${deg}°`, 58, y + 5);
            ctx.fillText(`${deg}°`, -82, y + 5);
          });
          ctx.restore();

          // Centered Boresight Reticle
          ctx.strokeStyle = "#eab308";
          ctx.lineWidth = 2.5;
          ctx.strokeRect(w / 2 - 12, h / 2 - 12, 24, 24);
          ctx.beginPath();
          ctx.arc(w / 2, h / 2, 2, 0, Math.PI * 2);
          ctx.fillStyle = "#eab308";
          ctx.fill();

          // Left Speed Tape
          ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
          ctx.fillRect(10, 20, 80, h - 40);
          ctx.strokeStyle = "#0284c7";
          ctx.strokeRect(10, 20, 80, h - 40);
          ctx.fillStyle = "#38bdf8";
          ctx.font = "bold 12px monospace";
          ctx.fillText("AIRSPEED", 16, 40);
          ctx.fillStyle = "#f8fafc";
          ctx.font = "bold 18px monospace";
          ctx.fillText(`${speed.toFixed(1)}`, 20, 75);
          ctx.font = "10px monospace";
          ctx.fillText("M/S", 20, 92);

          // Right Altitude Tape
          ctx.fillStyle = "rgba(15, 23, 42, 0.85)";
          ctx.fillRect(w - 90, 20, 80, h - 40);
          ctx.strokeStyle = "#0284c7";
          ctx.strokeRect(w - 90, 20, 80, h - 40);
          ctx.fillStyle = "#38bdf8";
          ctx.font = "bold 12px monospace";
          ctx.fillText("ALTITUDE", w - 84, 40);
          ctx.fillStyle = "#f8fafc";
          ctx.font = "bold 18px monospace";
          ctx.fillText(`${surfaceAlt.toFixed(0)}`, w - 84, 75);
          ctx.font = "10px monospace";
          ctx.fillText("M AGL", w - 84, 92);

          // Top Heading Tape
          const headingDeg = Math.round(((yawRef.current * 180) / Math.PI + 360) % 360);
          ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
          ctx.fillRect(w / 2 - 60, 10, 120, 30);
          ctx.strokeStyle = "#38bdf8";
          ctx.strokeRect(w / 2 - 60, 10, 120, 30);
          ctx.fillStyle = "#38bdf8";
          ctx.font = "bold 14px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`HDG ${headingDeg.toString().padStart(3, "0")}°`, w / 2, 30);
          ctx.textAlign = "left";

          mfd.pfdTexture.needsUpdate = true;
        }
      }

      // 2. Left Subsystem & Propulsion MFD
      if (mfd.sysCanvas && mfd.sysTexture) {
        const ctx = mfd.sysCanvas.getContext("2d");
        if (ctx) {
          const w = mfd.sysCanvas.width;
          const h = mfd.sysCanvas.height;
          ctx.fillStyle = "#0b1320";
          ctx.fillRect(0, 0, w, h);

          ctx.fillStyle = "#38bdf8";
          ctx.font = "bold 13px monospace";
          ctx.fillText("SYS // PROPULSION & POWER", 16, 26);

          // Propellant Tank Fill
          ctx.fillStyle = "#94a3b8";
          ctx.font = "11px monospace";
          ctx.fillText("HYDRAZINE TANK (RCS + MAIN):", 16, 55);

          ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
          ctx.fillRect(16, 62, w - 32, 22);
          const propRatio = Math.max(0, propRef.current / 100);
          ctx.fillStyle = propRatio > 0.3 ? "#22c55e" : propRatio > 0.15 ? "#f59e0b" : "#ef4444";
          ctx.fillRect(18, 64, (w - 36) * propRatio, 18);
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 12px monospace";
          ctx.fillText(`${propRef.current.toFixed(1)}%`, 24, 78);

          // Delta-V Estimate
          const deltaV = Math.round(propRatio * 850);
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(`REMAINING ΔV: ${deltaV} M/S`, 16, 110);

          // Electrical Bus
          ctx.fillText(`MAIN BUS: 28.4 V // 100% NOMINAL`, 16, 134);
          ctx.fillText(`REACTION WHEELS: ACTIVE [3/3]`, 16, 158);

          // RCS Firing Matrix Visual
          ctx.fillText("RCS THRUSTER MANIFOLD:", 16, 190);
          const rcsAxes = [
            { label: "+X", active: keysRef.current["KeyD"] },
            { label: "-X", active: keysRef.current["KeyA"] },
            { label: "+Y", active: keysRef.current["Space"] },
            { label: "-Y", active: keysRef.current["ControlLeft"] || keysRef.current["KeyX"] },
            { label: "+Z", active: keysRef.current["KeyW"] },
            { label: "-Z", active: keysRef.current["KeyS"] },
          ];
          rcsAxes.forEach((ax, idx) => {
            const bx = 16 + idx * 46;
            ctx.fillStyle = ax.active ? "rgba(56, 189, 248, 0.3)" : "rgba(30, 41, 59, 0.6)";
            ctx.fillRect(bx, 202, 38, 24);
            ctx.strokeStyle = ax.active ? "#38bdf8" : "#475569";
            ctx.strokeRect(bx, 202, 38, 24);
            ctx.fillStyle = ax.active ? "#38bdf8" : "#94a3b8";
            ctx.font = "bold 11px monospace";
            ctx.fillText(ax.label, bx + 10, 218);
          });

          mfd.sysTexture.needsUpdate = true;
        }
      }

      // 3. Right Tactical Proximity Radar MFD
      if (mfd.radarCanvas && mfd.radarTexture) {
        const ctx = mfd.radarCanvas.getContext("2d");
        if (ctx) {
          const w = mfd.radarCanvas.width;
          const h = mfd.radarCanvas.height;
          ctx.fillStyle = "#041512";
          ctx.fillRect(0, 0, w, h);

          ctx.fillStyle = "#34d399";
          ctx.font = "bold 13px monospace";
          ctx.fillText("TACTICAL PROXIMITY RADAR", 16, 26);

          // Radar Scope Circle
          const cx = w / 2;
          const cy = h / 2 + 15;
          const maxR = 85;

          ctx.strokeStyle = "rgba(52, 211, 153, 0.25)";
          ctx.lineWidth = 1;
          [30, 60, maxR].forEach((r) => {
            ctx.beginPath();
            ctx.arc(cx, cy, r, 0, Math.PI * 2);
            ctx.stroke();
          });
          // Radar Crosshair
          ctx.beginPath();
          ctx.moveTo(cx - maxR, cy);
          ctx.lineTo(cx + maxR, cy);
          ctx.moveTo(cx, cy - maxR);
          ctx.lineTo(cx, cy + maxR);
          ctx.stroke();

          // Rotating Sweep Beam
          const sweepAngle = (Date.now() * 0.0025) % (Math.PI * 2);
          ctx.strokeStyle = "rgba(52, 211, 153, 0.75)";
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(sweepAngle) * maxR, cy + Math.sin(sweepAngle) * maxR);
          ctx.stroke();

          // Relative Gateway-1 Docking Target Blip
          const targetDistRatio = Math.min(1.0, distToDock / 50);
          const targetRad = targetDistRatio * maxR;
          const relAngle = Math.atan2(
            gameState.spacecraft.dockingTargetPos.x - posRef.current.x,
            gameState.spacecraft.dockingTargetPos.z - posRef.current.z
          );
          const bx = cx + Math.sin(relAngle) * targetRad;
          const by = cy - Math.cos(relAngle) * targetRad;

          // Target Diamond Marker
          ctx.fillStyle = distToDock <= 15 ? "#22c55e" : "#eab308";
          ctx.beginPath();
          ctx.moveTo(bx, by - 6);
          ctx.lineTo(bx + 6, by);
          ctx.moveTo(bx + 6, by);
          ctx.lineTo(bx, by + 6);
          ctx.moveTo(bx, by + 6);
          ctx.lineTo(bx - 6, by);
          ctx.moveTo(bx - 6, by);
          ctx.lineTo(bx, by - 6);
          ctx.fill();

          ctx.font = "bold 10px monospace";
          ctx.fillText(`PORT DOCK-01 (${distToDock.toFixed(1)}m)`, 16, h - 30);
          ctx.fillText(`CLOSING: ${relVel.toFixed(2)} M/S | ALIGN: ${alignmentAngleDeg.toFixed(1)}°`, 16, h - 14);

          mfd.radarTexture.needsUpdate = true;
        }
      }
    }
  });

  if (gameState.controlMode !== "SPACECRAFT_COCKPIT") return null;

  return (
    <>
      <HypersonicPlasmaStreaks
        gameState={gameState}
        craftPosition={posRef.current}
        craftVelocity={velRef.current}
      />
      {cameraViewModeRef.current === "COCKPIT" && (
        <group position={posRef.current}>
      {/* 3D First-Person Cockpit Interior Geometry attached to vehicle */}
      <group
        rotation={[
          pitchRef.current,
          yawRef.current,
          rollRef.current,
        ]}
      >
        {/* Cockpit Canopy Struts & Reinforced Glass Frame */}
        <mesh position={[0, 0.45, -0.6]} rotation={[0.4, 0, 0]}>
          <boxGeometry args={[1.35, 0.04, 0.05]} />
          <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.25} />
        </mesh>
        <mesh position={[-0.62, 0.2, -0.4]} rotation={[0, 0, 0.35]}>
          <boxGeometry args={[0.04, 0.72, 0.05]} />
          <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.25} />
        </mesh>
        <mesh position={[0.62, 0.2, -0.4]} rotation={[0, 0, -0.35]}>
          <boxGeometry args={[0.04, 0.72, 0.05]} />
          <meshStandardMaterial color="#1e293b" metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Cockpit Arch Overhead Strut */}
        <mesh position={[0, 0.58, -0.15]} rotation={[-0.1, 0, 0]}>
          <boxGeometry args={[1.2, 0.04, 0.04]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Optical Glass Canopy Shield with PBR Refraction & Micro-Scratch Texture */}
        <mesh position={[0, 0.32, -0.52]} rotation={[0.45, 0, 0]}>
          <planeGeometry args={[1.28, 0.65]} />
          <meshPhysicalMaterial
            color="#e0f2fe"
            transparent
            opacity={0.22}
            roughness={0.12}
            roughnessMap={glassTexture ?? undefined}
            metalness={0.06}
            transmission={0.92}
            ior={1.52}
            thickness={0.85}
            reflectivity={0.68}
            clearcoat={0.6}
            clearcoatRoughness={0.12}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Left Canopy Quarter-Glass Pane */}
        <mesh position={[-0.62, 0.28, -0.42]} rotation={[0.38, -0.52, 0.12]}>
          <planeGeometry args={[0.42, 0.58]} />
          <meshPhysicalMaterial
            color="#e0f2fe"
            transparent
            opacity={0.18}
            roughness={0.12}
            roughnessMap={glassTexture ?? undefined}
            transmission={0.92}
            ior={1.52}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Right Canopy Quarter-Glass Pane */}
        <mesh position={[0.62, 0.28, -0.42]} rotation={[0.38, 0.52, -0.12]}>
          <planeGeometry args={[0.42, 0.58]} />
          <meshPhysicalMaterial
            color="#e0f2fe"
            transparent
            opacity={0.18}
            roughness={0.12}
            roughnessMap={glassTexture ?? undefined}
            transmission={0.92}
            ior={1.52}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Collimated Pilot HUD Combiner Glass Pane */}
        <mesh position={[0, 0.06, -0.42]} rotation={[-0.15, 0, 0]}>
          <planeGeometry args={[0.34, 0.24]} />
          <meshPhysicalMaterial
            color="#38bdf8"
            transparent
            opacity={0.22}
            roughness={0.05}
            transmission={0.92}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* Collimated HUD Reticle Crosshair Line */}
        <mesh position={[0, 0.06, -0.418]} rotation={[-0.15, 0, 0]}>
          <ringGeometry args={[0.02, 0.022, 24]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} />
        </mesh>

        {/* Pilot Instrument Dashboard Console */}
        <mesh position={[0, -0.35, -0.55]} rotation={[-0.45, 0, 0]}>
          <boxGeometry args={[1.25, 0.36, 0.22]} />
          <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.35} />
        </mesh>

        {/* Left MFD: Attitude & Propulsion */}
        <mesh position={[-0.32, -0.28, -0.52]} rotation={[-0.45, 0, 0]}>
          <planeGeometry args={[0.26, 0.18]} />
          {mfd.sysTexture ? (
            <meshBasicMaterial map={mfd.sysTexture} />
          ) : (
            <meshBasicMaterial color="#0369a1" />
          )}
        </mesh>
        {/* Left MFD Bezel */}
        <mesh position={[-0.32, -0.28, -0.522]} rotation={[-0.45, 0, 0]}>
          <ringGeometry args={[0.13, 0.145, 4]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Center Primary Flight Display (PFD) HUD Screen */}
        <mesh position={[0, -0.25, -0.54]} rotation={[-0.45, 0, 0]}>
          <planeGeometry args={[0.34, 0.22]} />
          {mfd.pfdTexture ? (
            <meshBasicMaterial map={mfd.pfdTexture} />
          ) : (
            <meshBasicMaterial color="#0284c7" />
          )}
        </mesh>

        {/* Right MFD: Docking Telemetry & Radar */}
        <mesh position={[0.32, -0.28, -0.52]} rotation={[-0.45, 0, 0]}>
          <planeGeometry args={[0.26, 0.18]} />
          {mfd.radarTexture ? (
            <meshBasicMaterial map={mfd.radarTexture} />
          ) : (
            <meshBasicMaterial color="#0f766e" />
          )}
        </mesh>
        {/* Right MFD Bezel */}
        <mesh position={[0.32, -0.28, -0.522]} rotation={[-0.45, 0, 0]}>
          <ringGeometry args={[0.13, 0.145, 4]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Annunciator Status LEDs on Dashboard */}
        <mesh position={[-0.52, -0.22, -0.49]}>
          <boxGeometry args={[0.02, 0.012, 0.01]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
        <mesh position={[-0.48, -0.22, -0.49]}>
          <boxGeometry args={[0.02, 0.012, 0.01]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        <mesh position={[-0.44, -0.22, -0.49]}>
          <boxGeometry args={[0.02, 0.012, 0.01]} />
          <meshBasicMaterial color="#f59e0b" />
        </mesh>

        {/* Flight Control Stick (Right side) */}
        <group position={[0.35, -0.32, -0.45]}>
          <mesh position={[0, 0.08, 0]} rotation={[pitchRef.current * 0.4, 0, -rollRef.current * 0.4]}>
            <cylinderGeometry args={[0.015, 0.02, 0.16, 12]} />
            <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.16, 0]}>
            <boxGeometry args={[0.04, 0.06, 0.05]} />
            <meshStandardMaterial color="#ef4444" roughness={0.3} />
          </mesh>
        </group>

        {/* Throttle Quadrant (Left side) */}
        <group position={[-0.38, -0.32, -0.45]}>
          <mesh position={[0, 0.08, 0]}>
            <boxGeometry args={[0.06, 0.16, 0.12]} />
            <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 0.17, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.018, 0.018, 0.08, 12]} />
            <meshStandardMaterial color="#38bdf8" roughness={0.3} />
          </mesh>
        </group>

        {/* Cockpit Interior Ambient & Instrument Backlight */}
        <pointLight position={[0, 0, -0.4]} intensity={0.65} distance={2.5} color="#38bdf8" />
      </group>
    </group>
      )}
    </>
  );
}
