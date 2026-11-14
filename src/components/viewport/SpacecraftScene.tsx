"use client";

import React, { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

interface SpacecraftSceneProps {
  busSize?: "1U" | "3U" | "6U";
}

export function SpacecraftScene({ busSize = "3U" }: SpacecraftSceneProps) {
  const meshRef = useRef<THREE.Group>(null);

  // Subtle rotation to bring the engineering model to life
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.2;
    }
  });

  // CubeSat standard dimensions: 1U = 10x10x10 cm (scaled for visualization)
  const heightMultiplier = busSize === "1U" ? 1 : busSize === "3U" ? 3 : 3;
  const widthMultiplier = busSize === "6U" ? 2 : 1;

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 7]} intensity={1.2} />
      <directionalLight position={[-5, -5, -5]} intensity={0.2} color="#38bdf8" />

      <group ref={meshRef}>
        {/* CubeSat Primary Chassis (Anodized Aluminum 6061-T6) */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[widthMultiplier * 1.0, heightMultiplier * 1.0, 1.0]} />
          <meshStandardMaterial
            color="#1e2638"
            metalness={0.8}
            roughness={0.25}
          />
        </mesh>

        {/* Structural Rails (Corner Edges) */}
        <lineSegments>
          <edgesGeometry args={[new THREE.BoxGeometry(widthMultiplier * 1.01, heightMultiplier * 1.01, 1.01)]} />
          <lineBasicMaterial color="#94a3b8" />
        </lineSegments>

        {/* Solar Panel Face (Silicon Photovoltaic Cells) */}
        <mesh position={[0, 0, 0.51]}>
          <planeGeometry args={[widthMultiplier * 0.85, heightMultiplier * 0.85]} />
          <meshStandardMaterial
            color="#0f172a"
            metalness={0.9}
            roughness={0.1}
          />
        </mesh>

        {/* Deployable Patch Antenna Base */}
        <mesh position={[0, (heightMultiplier * 1.0) / 2 + 0.05, 0]}>
          <cylinderGeometry args={[0.15, 0.15, 0.1, 16]} />
          <meshStandardMaterial color="#cbd5e1" metalness={0.6} roughness={0.3} />
        </mesh>
      </group>

      <OrbitControls
        enablePan={false}
        minDistance={2.5}
        maxDistance={8}
        autoRotate={false}
      />
    </>
  );
}
