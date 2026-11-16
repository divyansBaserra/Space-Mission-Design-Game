"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GameState } from "./types";

interface LunarDustPlumeProps {
  gameState: GameState;
}

const PARTICLE_COUNT = 360;

export function LunarDustPlume({ gameState }: LunarDustPlumeProps) {
  const pointsRef = useRef<THREE.Points>(null);

  // Position, velocity, life buffers
  const [positions, velocities, lifeTimes] = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const vel = new Float32Array(PARTICLE_COUNT * 3);
    const life = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = -999; // hidden initially
      pos[i * 3 + 2] = 0;

      vel[i * 3] = 0;
      vel[i * 3 + 1] = 0;
      vel[i * 3 + 2] = 0;

      life[i] = Math.random();
    }
    return [pos, vel, life];
  }, []);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;

    const dt = Math.min(delta, 0.08);
    const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array;

    const isNearMoon =
      gameState.spacecraft.position.z < -45 ||
      gameState.controlMode === "SURFACE_EXPLORATION";
    const altitude = gameState.spacecraft.surfaceAltitudeMeters ?? 99;
    const isDescentActive = isNearMoon && altitude <= 28.0 && !gameState.spacecraft.isLanded;

    const craftPos = gameState.spacecraft.position;
    const groundY = -17.95; // Moon regolith surface height

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const idx = i * 3;
      lifeTimes[i] -= dt * 1.4;

      if (lifeTimes[i] <= 0 && isDescentActive) {
        // Respawn dust particle at engine ground impact point
        const angle = Math.random() * Math.PI * 2;
        const speed = 6.0 + Math.random() * 14.0;
        const initialRad = 0.4 + Math.random() * 1.2;

        posArray[idx] = craftPos.x + Math.cos(angle) * initialRad;
        posArray[idx + 1] = groundY + Math.random() * 0.15;
        posArray[idx + 2] = craftPos.z + Math.sin(angle) * initialRad;

        // Vacuum sheet outward blast
        velocities[idx] = Math.cos(angle) * speed;
        velocities[idx + 1] = 0.8 + Math.random() * 2.2; // upward ejecta angle
        velocities[idx + 2] = Math.sin(angle) * speed;

        lifeTimes[i] = 0.6 + Math.random() * 0.5;
      } else if (lifeTimes[i] > 0) {
        // Lunar gravity acceleration: 1.62 m/s^2 downwards
        velocities[idx + 1] -= 1.62 * dt;

        posArray[idx] += velocities[idx] * dt;
        posArray[idx + 1] += velocities[idx + 1] * dt;
        posArray[idx + 2] += velocities[idx + 2] * dt;

        // Ground collision clamp
        if (posArray[idx + 1] < groundY) {
          posArray[idx + 1] = groundY;
          velocities[idx + 1] = 0;
          velocities[idx] *= 0.85;
          velocities[idx + 2] *= 0.85;
        }
      } else {
        // Particle dead and hidden
        posArray[idx + 1] = -999;
      }
    }

    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.16}
        color="#cbd5e1"
        transparent
        opacity={0.7}
        blending={THREE.NormalBlending}
        depthWrite={false}
      />
    </points>
  );
}
