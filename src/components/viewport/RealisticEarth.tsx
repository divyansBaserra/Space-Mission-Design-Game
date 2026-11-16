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
  sunPosition?: [number, number, number];
}

/**
 * Physically-Inspired Atmospheric Rayleigh Limb Scattering Shader
 * Produces an authentic, gossamer cyan/blue atmospheric limb haze
 * that naturally illuminates on the sunlit terminator and fades
 * smoothly into the darkness of space on the night side.
 * Zero faceted polygon lines or thick cartoon ribbons.
 */
const AtmosphericScatteringShader = {
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vWorldNormal;
    varying vec3 vViewPosition;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
      vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPosition.xyz;
      gl_Position = projectionMatrix * mvPosition;
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vWorldNormal;
    varying vec3 vViewPosition;

    uniform vec3 sunDirection;
    uniform vec3 dayGlowColor;
    uniform vec3 sunsetGlowColor;
    uniform float intensity;

    void main() {
      vec3 viewDir = normalize(vViewPosition);
      vec3 norm = normalize(vNormal);
      vec3 worldNorm = normalize(vWorldNormal);
      vec3 sunDir = normalize(sunDirection);

      // Limb Fresnel: bright at tangent glancing edges
      float dotVN = clamp(dot(viewDir, norm), 0.0, 1.0);
      float rim = 1.0 - dotVN;
      // High-order exponential falloff creates a delicate, ultra-thin gossamer halo
      float rimHaze = pow(rim, 4.2);

      // Sun illumination angle on atmospheric layer
      float sunDot = dot(worldNorm, sunDir);
      // Soft terminator transition from daylight to deep night
      float dayFactor = smoothstep(-0.2, 0.35, sunDot);

      // Rayleigh sunset shift at glancing sun angles
      float sunsetFactor = smoothstep(-0.15, 0.15, sunDot) * (1.0 - smoothstep(0.15, 0.5, sunDot));
      vec3 scatterColor = mix(dayGlowColor, sunsetGlowColor, sunsetFactor * 0.45);

      // Final atmospheric alpha: zero on dark side, soft ethereal glow on sunlit limb
      float alpha = rimHaze * intensity * dayFactor;

      if (alpha <= 0.002) discard;

      gl_FragColor = vec4(scatterColor, alpha);
    }
  `,
};

/**
 * Photorealistic NASA Blue Marble Earth
 * Implements:
 * - 128x128 high-tessellation sphere (zero visible facets or kinks)
 * - Authentic NASA Earth daylight map (continents & oceans)
 * - Terrestrial normal/bump map for topographical relief
 * - Specular reflectivity map for glossy oceans & matte landmasses
 * - Independent rotating dynamic cloud sphere with soft transparency
 * - Authentic 23.44° axial tilt
 * - Physically-inspired Rayleigh limb scattering shader modulated by Sun vector
 */
export function RealisticEarth({
  radius = 2.0,
  axialTiltDeg = 23.44,
  rotationSpeed = 0.015,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  sunPosition = [12, 3, 6],
}: RealisticEarthProps) {
  const earthGroupRef = useRef<THREE.Group>(null);
  const globeRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const atmosphereRef = useRef<THREE.ShaderMaterial>(null);

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

  // Sun direction vector for atmosphere lighting
  const sunDirVector = useMemo(() => {
    return new THREE.Vector3(...sunPosition).normalize();
  }, [sunPosition]);

  // Atmospheric scattering shader material
  const atmosphereMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: AtmosphericScatteringShader.vertexShader,
      fragmentShader: AtmosphericScatteringShader.fragmentShader,
      uniforms: {
        sunDirection: { value: sunDirVector },
        dayGlowColor: { value: new THREE.Color("#38bdf8") }, // Delicate cyan/blue Rayleigh
        sunsetGlowColor: { value: new THREE.Color("#f59e0b") }, // Warm Rayleigh sunset amber
        intensity: { value: 0.95 },
      },
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      transparent: true,
      depthWrite: false,
    });
  }, [sunDirVector]);

  // Real Earth axial tilt in radians (23.44 degrees on Z)
  const axialTiltRad = (axialTiltDeg * Math.PI) / 180;

  // Frame animation: continuous diurnal rotation and subtle differential cloud drift
  useFrame((_, delta) => {
    if (globeRef.current) {
      globeRef.current.rotation.y += delta * rotationSpeed;
    }
    if (cloudsRef.current) {
      // Clouds drift slightly faster due to atmospheric jet streams
      cloudsRef.current.rotation.y += delta * (rotationSpeed * 1.25);
    }
  });

  return (
    <group position={position} rotation={rotation}>
      {/* Earth tilted axis container */}
      <group ref={earthGroupRef} rotation={[0, 0, -axialTiltRad]}>
        {/* 1. Base Earth Globe (High-resolution 128x128 sphere) */}
        <mesh ref={globeRef} receiveShadow castShadow>
          <sphereGeometry args={[radius, 128, 128]} />
          {textures ? (
            <meshStandardMaterial
              map={textures.day}
              normalMap={textures.normal}
              normalScale={new THREE.Vector2(0.85, 0.85)}
              roughnessMap={textures.specular}
              roughness={0.6}
              metalness={0.12}
            />
          ) : (
            <meshStandardMaterial color="#0b264a" roughness={0.5} metalness={0.1} />
          )}
        </mesh>

        {/* 2. Concentric Dynamic Cloud Sphere (NASA Cloud Formations) */}
        <mesh ref={cloudsRef} scale={[1.006, 1.006, 1.006]}>
          <sphereGeometry args={[radius, 128, 128]} />
          {textures && (
            <meshStandardMaterial
              map={textures.clouds}
              transparent
              opacity={0.82}
              roughness={0.9}
              metalness={0.0}
              depthWrite={false}
            />
          )}
        </mesh>

        {/* 3. Physically realistic delicate Rayleigh limb atmospheric haze (Scale 1.012) */}
        <mesh scale={[1.012, 1.012, 1.012]}>
          <sphereGeometry args={[radius, 128, 128]} />
          <primitive ref={atmosphereRef} object={atmosphereMaterial} attach="material" />
        </mesh>
      </group>
    </group>
  );
}
