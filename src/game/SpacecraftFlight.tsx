"use client";

import React, { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { GameState } from "./types";
import { soundManager } from "./audio";

interface SpacecraftFlightProps {
  gameState: GameState;
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
    alignAngle: number
  ) => void;
  onDockComplete: () => void;
  onTogglePause?: () => void;
  onExitCockpit?: () => void;
}

export function SpacecraftFlight({
  gameState,
  onUpdateSpacecraft,
  onDockComplete,
  onTogglePause,
  onExitCockpit,
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
  const propRef = useRef<number>(gameState.spacecraft.propellantPercent || 100);
  const pwrRef = useRef<number>(gameState.spacecraft.powerPercent || 100);

  const keysRef = useRef<{ [code: string]: boolean }>({});
  const lastRoarTimeRef = useRef<number>(0);
  const lastRadarBeepRef = useRef<number>(0);

  // Keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      keysRef.current[e.code] = true;

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

      // Manual Docking Capture Key (Enter)
      if (e.code === "Enter" && gameState.controlMode === "SPACECRAFT_COCKPIT") {
        const dockingPortPos = gameState.spacecraft.dockingTargetPos;
        const dist = dockingPortPos.distanceTo(posRef.current);
        const speed = velRef.current.length();
        if (dist <= 3.2 && speed <= 2.8 && !gameState.spacecraft.isDocked) {
          soundManager.playDockingLatch();
          soundManager.playSuccessFanfare();
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

    // Arrow keys flight attitude controls (keyboard flight mode)
    if (keys["ArrowLeft"]) yawRef.current += 1.8 * dt;
    if (keys["ArrowRight"]) yawRef.current -= 1.8 * dt;
    if (keys["ArrowUp"]) pitchRef.current += 1.8 * dt;
    if (keys["ArrowDown"]) pitchRef.current -= 1.8 * dt;
    const maxFlightPitch = (75 * Math.PI) / 180;
    pitchRef.current = Math.max(-maxFlightPitch, Math.min(maxFlightPitch, pitchRef.current));

    // Roll input (Q / E)
    if (keys["KeyQ"]) rollRef.current += 1.8 * dt;
    if (keys["KeyE"]) rollRef.current -= 1.8 * dt;

    // Roll centering damping
    rollRef.current *= Math.pow(0.92, dt * 10);

    // RCS Translation input
    const thrustAcc = 4.2; // m/s^2
    const translation = new THREE.Vector3();
    let isThrusting = false;

    if (propRef.current > 0) {
      if (keys["KeyW"]) {
        translation.addScaledVector(forward, thrustAcc);
        isThrusting = true;
      }
      if (keys["KeyS"]) {
        translation.addScaledVector(forward, -thrustAcc * 0.7);
        isThrusting = true;
      }
      if (keys["KeyA"]) {
        translation.addScaledVector(right, -thrustAcc * 0.6);
        isThrusting = true;
      }
      if (keys["KeyD"]) {
        translation.addScaledVector(right, thrustAcc * 0.6);
        isThrusting = true;
      }
      if (keys["Space"]) {
        translation.addScaledVector(up, thrustAcc * 0.6);
        isThrusting = true;
      }
      if (keys["KeyC"] || keys["ControlLeft"]) {
        translation.addScaledVector(up, -thrustAcc * 0.6);
        isThrusting = true;
      }

      // Propellant drain on thrusting
      if (isThrusting) {
        propRef.current = Math.max(0, propRef.current - 0.45 * dt);
        const now = Date.now();
        if (now - lastRoarTimeRef.current > 300) {
          soundManager.playEngineRoar();
          lastRoarTimeRef.current = now;
        }
      }
    }

    // Flight Stabilization / Retrograde Brake (KeyX)
    if (keys["KeyX"]) {
      velRef.current.multiplyScalar(Math.pow(0.4, dt * 8));
    }

    // Apply linear acceleration
    velRef.current.addScaledVector(translation, dt);

    // Gentle orbital space drag (stabilizer damping)
    velRef.current.multiplyScalar(Math.pow(0.96, dt * 6));

    // Update position
    posRef.current.addScaledVector(velRef.current, dt);

    // Keep spacecraft within orbital mission area bounds
    posRef.current.x = THREE.MathUtils.clamp(posRef.current.x, -50, 50);
    posRef.current.y = THREE.MathUtils.clamp(posRef.current.y, -25, 35);
    posRef.current.z = THREE.MathUtils.clamp(posRef.current.z, -85, 5);

    // Synchronize camera to pilot seat in cockpit
    camera.position.copy(posRef.current);
    camera.quaternion.copy(rotQuat);

    // Calculate Docking telemetry to station port (0, 1.5, -11.2)
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
    if (distToDock < 18 && distToDock > 2.5) {
      const now = Date.now();
      const beepInterval = THREE.MathUtils.lerp(1800, 250, (18 - distToDock) / 16);
      if (now - lastRadarBeepRef.current > beepInterval) {
        soundManager.playRadarBeep();
        lastRadarBeepRef.current = now;
      }
    }

    // Check Auto Soft Capture Condition
    if (
      distToDock <= 2.2 &&
      speed <= 2.4 &&
      alignmentAngleDeg <= 25 &&
      !gameState.spacecraft.isDocked
    ) {
      soundManager.playDockingLatch();
      soundManager.playSuccessFanfare();
      onDockComplete();
    }

    // Notify state manager
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
      alignmentAngleDeg
    );
  });

  if (gameState.controlMode !== "SPACECRAFT_COCKPIT") return null;

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
