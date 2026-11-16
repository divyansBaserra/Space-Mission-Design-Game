"use client";

import React, { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GameState } from "./types";
import { StationPhysics } from "./physics";
import { soundManager } from "./audio";

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
  onLandComplete?: () => void;
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
    }
  }, [gameState.step, gameState.missionMetSeconds, gameState.spacecraft.position]);

  // Keyboard and mouse listeners
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
        yawRef.current -= e.movementX * sensitivity;
        pitchRef.current -= e.movementY * sensitivity * invertY;

        // Pitch clamp
        const maxPitch = (75 * Math.PI) / 180;
        pitchRef.current = Math.max(-maxPitch, Math.min(maxPitch, pitchRef.current));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      soundManager.stopThrusterRumble();
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
    if (gameState.controlMode !== "SPACECRAFT_COCKPIT" || gameState.paused) return;

    const dt = Math.min(delta, 0.08);
    const keys = keysRef.current;

    // Spacecraft local coordinate vectors from orientation
    const euler = new THREE.Euler(pitchRef.current, yawRef.current, rollRef.current, "YXZ");
    const rotQuat = new THREE.Quaternion().setFromEuler(euler);

    const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(rotQuat);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rotQuat);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(rotQuat);

    // Arrow keys flight attitude controls (accessible keyboard flight controls)
    if (keys["ArrowLeft"]) yawRef.current += 1.8 * dt;
    if (keys["ArrowRight"]) yawRef.current -= 1.8 * dt;
    if (keys["ArrowUp"]) pitchRef.current += 1.8 * dt;
    if (keys["ArrowDown"]) pitchRef.current -= 1.8 * dt;
    const maxFlightPitch = (75 * Math.PI) / 180;
    pitchRef.current = Math.max(-maxFlightPitch, Math.min(maxFlightPitch, pitchRef.current));

    // Roll input (Q / E)
    if (keys["KeyQ"]) {
      rollRef.current += 1.8 * dt;
      if (Math.random() < 0.15) soundManager.playRcsBurst();
    }
    if (keys["KeyE"]) {
      rollRef.current -= 1.8 * dt;
      if (Math.random() < 0.15) soundManager.playRcsBurst();
    }

    // Roll centering damping
    rollRef.current *= Math.pow(0.92, dt * 10);

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
        if (keys["KeyC"] || keys["ControlLeft"]) {
          translation.addScaledVector(up, -baseThrustAcc * 0.7);
          isThrusting = true;
        }

        // Continuous Low-Frequency Thruster Rumble
        if ((keys["KeyW"] || keys["KeyS"]) && propRef.current > 0) {
          soundManager.startThrusterRumble();
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

    // Proximity warning alarm when descending too fast near ground
    if (surfaceAlt < 14.0 && verticalSpeed < -3.6 && !isLandedRef.current) {
      const now = Date.now();
      if (now - lastAlarmTimeRef.current > 750) {
        soundManager.playWarningAlarm();
        lastAlarmTimeRef.current = now;
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
      velRef.current.set(0, 0, 0);
      soundManager.playTouchdown();
      soundManager.playSuccessFanfare();
      soundManager.playQuindarTone(false);
      onLandComplete?.();
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
    } else {
      // First-person cockpit view with acoustic engine hull micro-vibration
      camera.position.copy(posRef.current);
      if (isThrusting) {
        camera.position.x += (Math.random() - 0.5) * 0.005;
        camera.position.y += (Math.random() - 0.5) * 0.005;
      }
      camera.quaternion.copy(rotQuat);
    }

    // Docking Telemetry to station port (0, 1.5, -11.2)
    const dockingPortPos = gameState.spacecraft.dockingTargetPos;
    const toDock = dockingPortPos.clone().sub(posRef.current);
    const distToDock = toDock.length();
    const speed = velRef.current.length();

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

    // Check Auto Soft Capture Condition at Station Docking Port
    if (
      distToDock <= 3.2 &&
      speed <= 0.8 &&
      alignmentAngleDeg <= 25 &&
      !gameState.spacecraft.isDocked
    ) {
      soundManager.playDockingLatch();
      soundManager.playSuccessFanfare();
      soundManager.playQuindarTone(true);
      onDockComplete();
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
  });

  if (gameState.controlMode !== "SPACECRAFT_COCKPIT") return null;

  // Only render the cockpit interior geometry when in Cockpit view mode
  if (cameraViewModeRef.current !== "COCKPIT") return null;

  return (
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

        {/* Optical Glass Canopy Shield with PBR Refraction */}
        <mesh position={[0, 0.32, -0.52]} rotation={[0.45, 0, 0]}>
          <planeGeometry args={[1.28, 0.65]} />
          <meshPhysicalMaterial
            color="#e0f2fe"
            transparent
            opacity={0.18}
            roughness={0.06}
            metalness={0.1}
            transmission={0.94}
            ior={1.46}
            reflectivity={0.6}
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
          <meshBasicMaterial color="#0369a1" />
        </mesh>
        {/* Left MFD Bezel */}
        <mesh position={[-0.32, -0.28, -0.522]} rotation={[-0.45, 0, 0]}>
          <ringGeometry args={[0.13, 0.145, 4]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* Center Primary Flight Display (PFD) HUD Screen */}
        <mesh position={[0, -0.25, -0.54]} rotation={[-0.45, 0, 0]}>
          <planeGeometry args={[0.34, 0.22]} />
          <meshBasicMaterial color="#0284c7" />
        </mesh>

        {/* Right MFD: Docking Telemetry & Radar */}
        <mesh position={[0.32, -0.28, -0.52]} rotation={[-0.45, 0, 0]}>
          <planeGeometry args={[0.26, 0.18]} />
          <meshBasicMaterial color="#0f766e" />
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
  );
}
