"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GameState } from "./types";

interface HypersonicPlasmaStreaksProps {
  gameState: GameState;
  craftPosition: THREE.Vector3;
  craftVelocity: THREE.Vector3;
}

/**
 * GPU Instanced Hypersonic Plasma Ionization Streaks
 * Simulates atmospheric compression heating, thruster backwash sparks,
 * and high-speed vacuum plasma flow when descending or boosting (> 6 m/s).
 */
export function HypersonicPlasmaStreaks({
  gameState,
  craftPosition,
  craftVelocity,
}: HypersonicPlasmaStreaksProps) {
  const pointsRef = useRef<THREE.Points>(null);
  const count = 160;

  const { positions, velocities, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const c1 = new THREE.Color("#38bdf8"); // Cyan ionization
    const c2 = new THREE.Color("#f97316"); // Plasma flame orange
    const c3 = new THREE.Color("#ffffff"); // White-hot core

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      // Cylinder radius around craft
      const radius = 0.8 + Math.random() * 3.2;
      const angle = Math.random() * Math.PI * 2;
      pos[idx] = Math.cos(angle) * radius;
      pos[idx + 1] = (Math.random() - 0.5) * 2.5;
      pos[idx + 2] = -5.0 + Math.random() * 12.0;

      // Random particle stream speed
      vel[idx] = (Math.random() - 0.5) * 0.4;
      vel[idx + 1] = (Math.random() - 0.5) * 0.4;
      vel[idx + 2] = 12.0 + Math.random() * 24.0;

      // Color variation
      const pick = Math.random();
      const chosenColor = pick > 0.6 ? c2 : pick > 0.25 ? c1 : c3;
      col[idx] = chosenColor.r;
      col[idx + 1] = chosenColor.g;
      col[idx + 2] = chosenColor.b;
    }

    return { positions: pos, velocities: vel, colors: col };
  }, [count]);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);

  useFrame((_, delta) => {
    if (!pointsRef.current) return;
    const speed = craftVelocity.length();
    const isCockpit = gameState.controlMode === "SPACECRAFT_COCKPIT";

    if (!isCockpit || speed < 4.0) {
      pointsRef.current.visible = false;
      return;
    }

    pointsRef.current.visible = true;
    pointsRef.current.position.copy(craftPosition);
    const speedRatio = Math.min(2.5, speed / 8.0);
    const posAttr = pointsRef.current.geometry.attributes.position as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      // Stream backward relative to flight velocity
      array[idx + 2] += velocities[idx + 2] * delta * speedRatio;

      // Wrap around forward ahead of the craft
      if (array[idx + 2] > 7.0) {
        array[idx + 2] = -8.0 - Math.random() * 4.0;
        const radius = 0.6 + Math.random() * 2.8;
        const angle = Math.random() * Math.PI * 2;
        array[idx] = Math.cos(angle) * radius;
        array[idx + 1] = (Math.random() - 0.5) * 2.2;
      }
    }

    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef} geometry={geo}>
      <pointsMaterial
        size={0.14}
        vertexColors
        transparent
        opacity={0.85}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}
