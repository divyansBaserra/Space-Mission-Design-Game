"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

export interface BlackHoleSceneProps {
  dopplerEnabled?: boolean;
  particlesEnabled?: boolean;
  spinSpeed?: number;
}

export function BlackHoleScene({
  particlesEnabled = true,
}: BlackHoleSceneProps = {}) {
  const diskRef = useRef<THREE.Group>(null);
  const lensUpperRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // Generate 1,400 swirling accretion disk particles
  const [particlePositions, particleColors, particleSpeeds, particleRadii] = useMemo(() => {
    const count = 1400;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const radii = new Float32Array(count);

    const cInner = new THREE.Color("#ffffff");
    const cMid = new THREE.Color("#fbbf24");
    const cOuter = new THREE.Color("#b45309");

    for (let i = 0; i < count; i++) {
      // Radius distribution from 2.2 to 8.5
      const r = 2.2 + Math.pow(Math.random(), 1.5) * 6.3;
      const theta = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * 0.18 * (r / 4.0);

      positions[i * 3] = r * Math.cos(theta);
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = r * Math.sin(theta);

      radii[i] = r;
      // Keplerian orbital speed ~ 1 / sqrt(r)
      speeds[i] = (1.8 / Math.sqrt(r)) * (0.8 + Math.random() * 0.4);

      // Color lerp based on distance (hotter inside, cooler outside)
      const t = (r - 2.2) / 6.3;
      const col = t < 0.35 ? cInner.clone().lerp(cMid, t / 0.35) : cMid.clone().lerp(cOuter, (t - 0.35) / 0.65);

      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
    }

    return [positions, colors, speeds, radii];
  }, []);

  const particlesGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));
    return geo;
  }, [particlePositions, particleColors]);

  // Swirl individual relativistic particles around event horizon
  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    // Rotate main equatorial accretion disk
    if (diskRef.current) {
      diskRef.current.rotation.y += dt * 0.18;
    }

    // Rotate upper/lower gravitational lensing ring
    if (lensUpperRef.current) {
      lensUpperRef.current.rotation.z += dt * 0.12;
    }

    // Swirl individual relativistic particles around event horizon
    if (particlesEnabled && particlesRef.current?.geometry?.attributes?.position) {
      const attr = particlesRef.current.geometry.attributes.position as THREE.BufferAttribute;
      const pos = attr.array as Float32Array;
      if (pos && pos.length > 0) {
        const count = particleRadii.length;
        for (let i = 0; i < count; i++) {
          const r = particleRadii[i];
          const spd = particleSpeeds[i];
          const x = pos[i * 3];
          const z = pos[i * 3 + 2];

          const angle = Math.atan2(z, x) + spd * dt;
          pos[i * 3] = r * Math.cos(angle);
          pos[i * 3 + 2] = r * Math.sin(angle);
        }
        attr.needsUpdate = true;
      }
    }
  });

  return (
    <group position={[0, 0, 0]} rotation={[0.22, -0.35, 0]}>
      {/* Deep cosmic starfield */}
      <Stars radius={120} depth={80} count={4500} factor={4.5} saturation={0.2} fade speed={0.4} />

      {/* Relativistic Lighting */}
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 0, 0]} intensity={4.5} distance={25} color="#fbbf24" />
      <pointLight position={[0, 3.5, 0]} intensity={2.0} distance={15} color="#fed7aa" />
      <pointLight position={[0, -3.5, 0]} intensity={2.0} distance={15} color="#fed7aa" />

      {/* 1. CENTRAL EVENT HORIZON (Absolute Darkness, Absorbs All Photons) */}
      <mesh>
        <sphereGeometry args={[2.0, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* 2. PHOTON SPHERE RING (At 1.5 Schwarzschild Radii - Intense Relativistic Glow) */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.02, 2.14, 128]} />
        <meshBasicMaterial
          color="#ffffff"
          side={THREE.DoubleSide}
          transparent
          opacity={0.92}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 3. ICONIC INTERSTELLAR GRAVITATIONAL LENSING HALO (Vertical Warped Ring Arc) */}
      {/* Light from the rear disk bent over the top and bottom of the event horizon */}
      <group ref={lensUpperRef} rotation={[Math.PI / 2.3, 0.1, 0]}>
        {/* Core Lensing Halo */}
        <mesh>
          <torusGeometry args={[2.85, 0.42, 32, 128]} />
          <meshBasicMaterial
            color="#f59e0b"
            transparent
            opacity={0.72}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        {/* Hot Inner Lensing Fringe */}
        <mesh>
          <torusGeometry args={[2.55, 0.18, 32, 128]} />
          <meshBasicMaterial
            color="#fef08a"
            transparent
            opacity={0.88}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        {/* Outer Lensing Diffuse Atmosphere */}
        <mesh>
          <torusGeometry args={[3.25, 0.75, 24, 128]} />
          <meshBasicMaterial
            color="#b45309"
            transparent
            opacity={0.35}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* 4. PRIMARY HORIZONTAL ACCRETION DISK (Equatorial Plane) */}
      <group ref={diskRef}>
        {/* Inner Ultra-Hot Accretion Band */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[2.14, 3.8, 128]} />
          <meshBasicMaterial
            color="#fffbeb"
            side={THREE.DoubleSide}
            transparent
            opacity={0.9}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* Mid Incandescent Plasma Disk */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[3.8, 5.8, 128]} />
          <meshBasicMaterial
            color="#f59e0b"
            side={THREE.DoubleSide}
            transparent
            opacity={0.78}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* Outer Turbulent Accretion Fringe */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[5.8, 8.2, 128]} />
          <meshBasicMaterial
            color="#b45309"
            side={THREE.DoubleSide}
            transparent
            opacity={0.52}
            blending={THREE.AdditiveBlending}
          />
        </mesh>

        {/* Diffuse Outer Glow Ring */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[8.2, 10.5, 96]} />
          <meshBasicMaterial
            color="#78350f"
            side={THREE.DoubleSide}
            transparent
            opacity={0.24}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* 5. RELATIVISTIC ACCRETION DUST PARTICLES (Swirling Keplerian Particle Field) */}
      {particlesEnabled && (
        <points ref={particlesRef} geometry={particlesGeometry}>
          <pointsMaterial
            size={0.065}
            vertexColors
            transparent
            opacity={0.88}
            blending={THREE.AdditiveBlending}
          />
        </points>
      )}

      {/* 6. GRAVITATIONAL WARPING SHADOW (Volumetric Depth Cue Behind Horizon) */}
      <mesh position={[0, 0, -0.4]}>
        <sphereGeometry args={[2.25, 32, 32]} />
        <meshBasicMaterial color="#05070a" transparent opacity={0.65} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}
