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
/**
 * Physically-Accurate Atmospheric Rayleigh Scattering Model
 * Combines:
 * 1. An outer BackSide atmospheric halo (scale 1.12) with smooth exponential
 *    decay into vacuum, guaranteeing ZERO hard silhouette rings or polygon seams.
 * 2. Sun-vector modulated daylit cyan/blue scattering with sunset amber terminator.
 * 3. Additive blending that naturally integrates with deep space starfields.
 */
const AtmosphericHaloShader = {
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 worldPos = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPos.xyz;
      gl_Position = projectionMatrix * viewMatrix * worldPos;
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vWorldPosition;

    uniform vec3 sunDirection;
    uniform vec3 dayGlowColor;
    uniform vec3 sunsetGlowColor;
    uniform float intensity;

    void main() {
      vec3 viewDir = normalize(cameraPosition - vWorldPosition);
      vec3 norm = normalize(vNormal);
      vec3 sunDir = normalize(sunDirection);

      // Grazing limb calculation: intensity peaks gently at glancing silhouette edge, zero at center
      float rim = 1.0 - abs(dot(viewDir, norm));
      float halo = pow(clamp(rim, 0.0, 1.0), 3.5);

      // Modulate by sunlit hemisphere
      float sunDot = dot(norm, sunDir);
      float dayFactor = smoothstep(-0.25, 0.35, sunDot);

      // Subtle Rayleigh sunset shift along the terminator
      float sunsetFactor = smoothstep(-0.2, 0.15, sunDot) * (1.0 - smoothstep(0.15, 0.5, sunDot));
      vec3 scatterColor = mix(dayGlowColor, sunsetGlowColor, sunsetFactor * 0.4);

      float alpha = clamp(halo * intensity * dayFactor * 0.25, 0.0, 0.35);
      if (alpha <= 0.001) discard;

      // Safe additive blending: scale RGB by alpha to prevent blinding specular whiteout
      gl_FragColor = vec4(scatterColor * alpha, alpha);
    }
  `,
};

/**
 * Inner Atmospheric Surface Limb Shader
 * Adds a soft, subtle cyan haze right at the glancing horizon of the Earth globe
 */
const SurfaceLimbShader = {
  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    void main() {
      vNormal = normalize(normalMatrix * normal);
      vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
      vViewPosition = -mvPos.xyz;
      gl_Position = projectionMatrix * mvPos;
    }
  `,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vViewPosition;

    uniform vec3 sunDirection;
    uniform vec3 limbColor;

    void main() {
      vec3 viewDir = normalize(vViewPosition);
      vec3 norm = normalize(vNormal);

      // Glance angle
      float rim = 1.0 - clamp(dot(viewDir, norm), 0.0, 1.0);
      float rimFactor = pow(rim, 4.2);

      vec3 sunDir = normalize(sunDirection);
      float sunDot = dot(norm, sunDir);
      float dayFactor = smoothstep(-0.1, 0.3, sunDot);

      float alpha = clamp(rimFactor * 0.22 * dayFactor, 0.0, 0.25);
      if (alpha <= 0.001) discard;

      // Safe additive blending: scale RGB by alpha to eliminate white clipping
      gl_FragColor = vec4(limbColor * alpha, alpha);
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
  const haloRef = useRef<THREE.ShaderMaterial>(null);
  const surfaceLimbRef = useRef<THREE.ShaderMaterial>(null);

  // Load NASA photorealistic texture suite via TextureLoader
  const textures = useMemo(() => {
    if (typeof window === "undefined") return null;

    const loader = new THREE.TextureLoader();

    const day = loader.load("/assets/textures/earth/earth_day.jpg");
    day.colorSpace = THREE.SRGBColorSpace;

    const lights = loader.load("/assets/textures/earth/earth_lights.png");
    lights.colorSpace = THREE.SRGBColorSpace;

    const normal = loader.load("/assets/textures/earth/earth_normal.jpg");

    const specular = loader.load("/assets/textures/earth/earth_specular.jpg");

    const clouds = loader.load("/assets/textures/earth/earth_clouds.png");

    return { day, lights, normal, specular, clouds };
  }, []);

  // Sun direction vector for atmosphere lighting
  const sunDirVector = useMemo(() => {
    return new THREE.Vector3(...sunPosition).normalize();
  }, [sunPosition]);

  // Outer BackSide atmospheric halo shader material (soft gossamer falloff)
  const haloMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: AtmosphericHaloShader.vertexShader,
      fragmentShader: AtmosphericHaloShader.fragmentShader,
      uniforms: {
        sunDirection: { value: sunDirVector },
        dayGlowColor: { value: new THREE.Color("#38bdf8") }, // Delicate Rayleigh cyan
        sunsetGlowColor: { value: new THREE.Color("#f59e0b") }, // Rayleigh sunset amber
        intensity: { value: 0.35 },
      },
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      transparent: true,
      depthWrite: false,
    });
  }, [sunDirVector]);

  // Inner glancing surface horizon limb shader material
  const surfaceLimbMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: SurfaceLimbShader.vertexShader,
      fragmentShader: SurfaceLimbShader.fragmentShader,
      uniforms: {
        sunDirection: { value: sunDirVector },
        limbColor: { value: new THREE.Color("#0284c7") },
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
              roughness={0.78}
              metalness={0.04}
              emissiveMap={textures.lights}
              emissive={new THREE.Color("#fbbf24")}
              emissiveIntensity={0.08}
            />
          ) : (
            <meshStandardMaterial color="#0b264a" roughness={0.5} metalness={0.1} />
          )}
        </mesh>

        {/* 2. Concentric Dynamic Cloud Sphere (Skimming smoothly at scale 1.0025) */}
        <mesh ref={cloudsRef} scale={[1.0025, 1.0025, 1.0025]}>
          <sphereGeometry args={[radius, 128, 128]} />
          {textures && (
            <meshStandardMaterial
              map={textures.clouds}
              transparent
              opacity={0.32}
              roughness={0.9}
              metalness={0.0}
              depthWrite={false}
            />
          )}
        </mesh>

        {/* 3. Inner Horizon Glancing Limb (FrontSide scale 1.0035) */}
        <mesh scale={[1.0035, 1.0035, 1.0035]}>
          <sphereGeometry args={[radius, 128, 128]} />
          <primitive ref={surfaceLimbRef} object={surfaceLimbMaterial} attach="material" />
        </mesh>

        {/* 4. Outer Gossamer Atmospheric Halo (BackSide scale 1.04, zero hard edges) */}
        <mesh scale={[1.04, 1.04, 1.04]}>
          <sphereGeometry args={[radius, 96, 96]} />
          <primitive ref={haloRef} object={haloMaterial} attach="material" />
        </mesh>
      </group>
    </group>
  );
}
