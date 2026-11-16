"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface DustTriggerState {
  jumpCount: number;
  landCount: number;
}

interface AstronautBootDustProps {
  isSurface: boolean;
  playerPos: THREE.Vector3;
  isGrounded: boolean;
  isMoving: boolean;
  dustTriggerRef?: React.MutableRefObject<DustTriggerState>;
}

const PARTICLE_COUNT = 96;

/**
 * Procedural Regolith Boot Dust Kick Puffs
 * Simulates Apollo lunar surface EVA dust dispersion under 1/6th gravity (1.62 m/s^2).
 */
export function AstronautBootDust({
  isSurface,
  playerPos,
  isGrounded,
  isMoving,
  dustTriggerRef,
}: AstronautBootDustProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const stepTimerRef = useRef(0);
  const nextParticleIdxRef = useRef(0);
  const lastJumpCountRef = useRef(0);
  const lastLandCountRef = useRef(0);

  const [positions, velocities, lifeTimes] = useMemo(() => {
    const pos = new Float32Array(PARTICLE_COUNT * 3);
    const vel = new Float32Array(PARTICLE_COUNT * 3);
    const life = new Float32Array(PARTICLE_COUNT);

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      pos[i * 3] = 0;
      pos[i * 3 + 1] = -999; // hidden below ground
      pos[i * 3 + 2] = 0;

      vel[i * 3] = 0;
      vel[i * 3 + 1] = 0;
      vel[i * 3 + 2] = 0;

      life[i] = 0;
    }
    return [pos, vel, life];
  }, []);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  // Spawn function to emit particles at player's foot position
  const emitParticles = (count: number, speedMultiplier: number, spreadRadius: number) => {
    if (!pointsRef.current) return;
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;

    for (let k = 0; k < count; k++) {
      const i = nextParticleIdxRef.current;
      nextParticleIdxRef.current = (nextParticleIdxRef.current + 1) % PARTICLE_COUNT;

      const idx = i * 3;
      const angle = Math.random() * Math.PI * 2;
      const r = Math.random() * spreadRadius;

      // Position near player's feet on lunar surface (Y = -17.92)
      posArr[idx] = playerPos.x + Math.cos(angle) * r;
      posArr[idx + 1] = -17.92;
      posArr[idx + 2] = playerPos.z + Math.sin(angle) * r;

      // Velocity in 1/6th gravity: outward spray and upward kick
      const speed = (0.35 + Math.random() * 0.85) * speedMultiplier;
      velocities[idx] = Math.cos(angle) * speed;
      velocities[idx + 1] = (0.45 + Math.random() * 0.8) * speedMultiplier;
      velocities[idx + 2] = Math.sin(angle) * speed;

      lifeTimes[i] = 0.85 + Math.random() * 0.65;
    }
    posAttr.needsUpdate = true;
  };

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const dt = Math.min(delta, 0.08);

    if (!isSurface) {
      pointsRef.current.visible = false;
      return;
    }
    pointsRef.current.visible = true;

    // Check trigger counters
    if (dustTriggerRef?.current) {
      if (dustTriggerRef.current.jumpCount !== lastJumpCountRef.current) {
        lastJumpCountRef.current = dustTriggerRef.current.jumpCount;
        emitParticles(14, 1.4, 0.45);
      }
      if (dustTriggerRef.current.landCount !== lastLandCountRef.current) {
        lastLandCountRef.current = dustTriggerRef.current.landCount;
        emitParticles(22, 1.8, 0.65);
      }
    }

    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const posArr = posAttr.array as Float32Array;

    // Emit stride dust puffs when walking/running on ground
    if (isGrounded && isMoving) {
      stepTimerRef.current += dt;
      if (stepTimerRef.current > 0.22) {
        stepTimerRef.current = 0;
        emitParticles(4, 0.9, 0.25);
      }
    } else {
      stepTimerRef.current = 0;
    }

    // Update active particles under lunar gravity (1.62 m/s^2)
    const lunarGravity = 1.62;
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      if (lifeTimes[i] > 0) {
        lifeTimes[i] -= dt;
        const idx = i * 3;

        velocities[idx + 1] -= lunarGravity * dt;

        posArr[idx] += velocities[idx] * dt;
        posArr[idx + 1] += velocities[idx + 1] * dt;
        posArr[idx + 2] += velocities[idx + 2] * dt;

        // Ground settling
        if (posArr[idx + 1] < -17.98) {
          posArr[idx + 1] = -17.98;
          velocities[idx] *= 0.5;
          velocities[idx + 1] = 0;
          velocities[idx + 2] *= 0.5;
        }

        if (lifeTimes[i] <= 0) {
          posArr[idx + 1] = -999;
        }
      }
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geo}>
      <pointsMaterial
        size={0.12}
        color="#cbd5e1"
        transparent
        opacity={0.65}
        depthWrite={false}
      />
    </points>
  );
}
