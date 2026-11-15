"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export interface RealisticEarthProps {
  radius?: number;
  axialTiltDeg?: number;
  rotationSpeed?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
}

/**
 * Atmospheric Scattering Glow Shader
 * Produces realistic Rayleigh limb haze around Earth's horizon.
 */
const AtmosphereShader = {
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
      vNormal = normalize(normalMatrix * normal);
      vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform vec3 glowColor;
    uniform float intensity;
    void main() {
      vec3 viewDir = normalize(-vPosition);
      float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
      float alpha = pow(rim, 2.6) * intensity;
      gl_FragColor = vec4(glowColor, alpha);
    }
  `,
};

/**
 * Photorealistic NASA Blue Marble Earth
 * Implements:
 * - Real 2048x1024 NASA Earth daylight map (continents & oceans)
 * - Terrestrial normal/bump map for mountains, continental shelves
 * - Specular reflectivity map (glossy water reflection, matte terrain)
 * - Independent rotating dynamic cloud sphere
 * - Authentic 23.44° axial tilt
 * - Rayleigh atmospheric limb glow shader
 */
export function RealisticEarth({
  radius = 2.0,
  axialTiltDeg = 23.44,
  rotationSpeed = 0.015,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
}: RealisticEarthProps) {
  const earthGroupRef = useRef<THREE.Group>(null);
  const globeRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  // Load NASA photorealistic texture suite via TextureLoader
  const textures = useMemo(() => {
    if (typeof window === "undefined") return null;

    const loader = new THREE.TextureLoader();

    const day = loader.load("/assets/textures/earth/earth_day.jpg");
    day.colorSpace = THREE.SRGBColorSpace;

    const normal = loader.load("/assets/textures/earth/earth_normal.jpg");

    const specular = loader.load("/assets/textures/earth/earth_specular.jpg");

    const clouds = loader.load("/assets/textures/earth/earth_clouds.png");

    return { day, normal, specular, clouds };
  }, []);

  // Atmospheric glow shader material
  const atmosphereMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: AtmosphereShader.vertexShader,
      fragmentShader: AtmosphereShader.fragmentShader,
      uniforms: {
        glowColor: { value: new THREE.Color("#38bdf8") },
        intensity: { value: 0.75 },
      },
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
  }, []);

  // Inner limb atmosphere
  const innerAtmosphereMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: AtmosphereShader.vertexShader,
      fragmentShader: AtmosphereShader.fragmentShader,
      uniforms: {
        glowColor: { value: new THREE.Color("#0284c7") },
        intensity: { value: 0.4 },
      },
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false,
    });
  }, []);

  // Real Earth axial tilt in radians (23.44 degrees on Z)
  const axialTiltRad = (axialTiltDeg * Math.PI) / 180;

  // Frame animation: continuous diurnal rotation and subtle differential cloud drift
  useFrame((_, delta) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += delta * rotationSpeed;
    }
    if (cloudsRef.current) {
      // Clouds drift slightly faster due to atmospheric jet streams
      cloudsRef.current.rotation.y += delta * (rotationSpeed * 1.35);
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Earth tilted axis container */}
      <group ref={earthGroupRef} rotation={[0, 0, -axialTiltRad]}>
        {/* 1. Base Earth Globe (NASA Blue Marble + Normal + Specular) */}
        <mesh ref={globeRef} receiveShadow castShadow>
          <sphereGeometry args={[radius, 64, 64]} />
          {textures ? (
            <meshStandardMaterial
              map={textures.day}
              normalMap={textures.normal}
              normalScale={new THREE.Vector2(0.85, 0.85)}
              roughnessMap={textures.specular}
              roughness={0.65}
              metalness={0.1}
            />
          ) : (
            <meshStandardMaterial color="#0b264a" roughness={0.5} metalness={0.1} />
          )}
        </mesh>

        {/* 2. Concentric Dynamic Cloud Sphere (NASA Cloud Formations) */}
        <mesh ref={cloudsRef} scale={[1.008, 1.008, 1.008]}>
          <sphereGeometry args={[radius, 64, 64]} />
          {textures && (
            <meshStandardMaterial
              map={textures.clouds}
              transparent
              opacity={0.88}
              roughness={1.0}
              metalness={0.0}
              depthWrite={false}
            />
          )}
        </mesh>

        {/* 3. Inner Limb Soft Cyan Gradient */}
        <mesh scale={[1.012, 1.012, 1.012]}>
          <sphereGeometry args={[radius, 48, 48]} />
          <primitive object={innerAtmosphereMaterial} attach="material" />
        </mesh>

        {/* 4. Outer Atmospheric Rayleigh Halo (Additive Glow) */}
        <mesh scale={[1.035, 1.035, 1.035]}>
          <sphereGeometry args={[radius, 48, 48]} />
          <primitive object={atmosphereMaterial} attach="material" />
        </mesh>
      </group>
    </group>
  );
}
