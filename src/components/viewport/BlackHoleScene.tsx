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

// ============================================================================
// COMPACT HIGH-PERFORMANCE GLSL SIMPLEX NOISE & PROCEDURAL TURBULENCE
// ============================================================================
const GLSL_SIMPLEX_NOISE = `
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,
    0.366025403784439,
    -0.577350269189626,
    0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

float fbm(vec2 p) {
  float v = 0.0;
  v += 0.5000 * snoise(p); p *= 2.02;
  v += 0.2500 * snoise(p); p *= 2.03;
  v += 0.1250 * snoise(p); p *= 2.01;
  v += 0.0625 * snoise(p);
  return v * 0.5 + 0.5;
}
`;

// ============================================================================
// 1. EQUATORIAL ACCRETION DISK SHADER
// ============================================================================
const diskVertexShader = `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const diskFragmentShader = `
varying vec2 vUv;
varying vec3 vPosition;

uniform float uTime;
uniform float uDoppler;

${GLSL_SIMPLEX_NOISE}

void main() {
  float r = length(vPosition.xy);
  // Accretion disk bounds: Inner ISCO at 2.06, Outer edge at 9.2
  if (r < 2.06 || r > 9.2) {
    discard;
  }

  float normR = clamp((r - 2.06) / (8.8 - 2.06), 0.0, 1.0);
  float phi = atan(vPosition.y, vPosition.x);

  // Differential Keplerian angular velocity (omega ~ 1 / r^1.45)
  float omega = 2.4 / pow(r, 1.4);
  float rotPhi = phi + uTime * omega;

  // Multi-frequency turbulent spiral plasma
  vec2 coord1 = vec2(r * 2.8 - rotPhi * 2.0, phi * 3.2 + uTime * 0.35);
  float turb1 = fbm(coord1);

  vec2 coord2 = vec2(r * 5.5 - rotPhi * 4.2, phi * 6.0 - uTime * 0.2);
  float turb2 = fbm(coord2);

  // Fine striations
  float striation = sin(r * 24.0 - rotPhi * 8.0) * 0.5 + 0.5;
  float density = mix(turb1, turb2 * striation, 0.42);

  // Dark interstellar absorption dust lanes (creates realistic smoky depth)
  float dust = fbm(vec2(r * 3.5 - rotPhi * 1.5, phi * 2.5));
  float dustMask = smoothstep(0.35, 0.75, dust);

  // Rich Interstellar Cinematic Palette:
  // - Inner ISCO: Incandescent White-Gold
  // - Inner Mid: Glowing Warm Amber
  // - Outer Mid: Fiery Burnt Orange
  // - Outer Fringe: Deep Interstellar Crimson & Dark Smoky Dust
  vec3 cCore   = vec3(1.0, 0.98, 0.92);  // #fffaf0 Blazing White-Gold
  vec3 cInner  = vec3(0.98, 0.75, 0.18); // #fbbf24 Molten Amber
  vec3 cMid    = vec3(0.92, 0.36, 0.05); // #ea580c Fiery Orange
  vec3 cOuter  = vec3(0.60, 0.12, 0.04); // #9a3412 Deep Terracotta
  vec3 cEdge   = vec3(0.24, 0.05, 0.02); // #3d0e05 Dark Smoky Fringe

  vec3 col = cCore;
  if (normR < 0.12) {
    col = mix(cCore, cInner, normR / 0.12);
  } else if (normR < 0.45) {
    col = mix(cInner, cMid, (normR - 0.12) / 0.33);
  } else if (normR < 0.78) {
    col = mix(cMid, cOuter, (normR - 0.45) / 0.33);
  } else {
    col = mix(cOuter, cEdge, (normR - 0.78) / 0.22);
  }

  // Interleave dark dust absorption veins
  col *= mix(0.45, 1.15, dustMask);

  // Subtle Relativistic Doppler Effect:
  // Left side approaching (+sin), right side receding (-sin)
  // Balanced so it NEVER bleaches to solid white
  float doppler = 1.0;
  if (uDoppler > 0.5) {
    float beaming = -sin(phi);
    doppler = clamp(1.0 + beaming * 0.42, 0.65, 1.48);

    if (beaming > 0.0) {
      col = mix(col, vec3(1.0, 0.98, 0.94), beaming * 0.35);
    } else {
      col = mix(col, vec3(0.85, 0.22, 0.05), -beaming * 0.30);
    }
  }

  // Soft edge dissipation
  float innerFade = smoothstep(2.06, 2.18, r);
  float outerFade = smoothstep(9.2, 6.8, r);
  float alpha = innerFade * outerFade * (0.4 + 0.6 * density) * doppler;

  col *= (1.1 + (1.0 - normR) * 1.5 + density * 0.5) * doppler;

  gl_FragColor = vec4(col, clamp(alpha * 0.95, 0.0, 1.0));
}
`;

// ============================================================================
// 2. GRAVITATIONAL LENSING HALO SHADER (Vertical Einstein Ring)
// ============================================================================
const lensVertexShader = `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const lensFragmentShader = `
varying vec2 vUv;
varying vec3 vPosition;

uniform float uTime;
uniform float uDoppler;

${GLSL_SIMPLEX_NOISE}

void main() {
  float r = length(vPosition.xy);
  // Lens ring boundaries: tight against event horizon (2.02 to 4.2)
  if (r < 2.02 || r > 4.25) {
    discard;
  }

  float normR = clamp((r - 2.02) / (4.2 - 2.02), 0.0, 1.0);
  float phi = atan(vPosition.y, vPosition.x);

  // Slower swirl along the lensed warped trajectory
  float omega = 1.8 / pow(r, 1.3);
  float rotPhi = phi + uTime * omega;

  // Lensing filaments
  vec2 coord = vec2(r * 4.0 - rotPhi * 2.5, phi * 4.0);
  float turb = fbm(coord);

  // Einstein ring colors (intense hot rim at event horizon, fading outwards)
  vec3 cHot   = vec3(1.0, 0.96, 0.88);  // White-Gold
  vec3 cMid   = vec3(0.96, 0.68, 0.15); // Glowing Amber
  vec3 cOuter = vec3(0.78, 0.28, 0.05); // Fiery Orange

  vec3 col = mix(cHot, cMid, smoothstep(0.0, 0.35, normR));
  col = mix(col, cOuter, smoothstep(0.35, 1.0, normR));

  // Doppler modulation along Einstein ring
  float doppler = 1.0;
  if (uDoppler > 0.5) {
    float beaming = -sin(phi);
    doppler = clamp(1.0 + beaming * 0.38, 0.70, 1.40);
    if (beaming > 0.0) {
      col = mix(col, vec3(1.0, 0.98, 0.92), beaming * 0.3);
    } else {
      col = mix(col, vec3(0.85, 0.25, 0.06), -beaming * 0.25);
    }
  }

  // Sharp inner cutoff at event horizon, smooth outer falloff
  float innerFade = smoothstep(2.02, 2.12, r);
  float outerFade = smoothstep(4.25, 2.8, r);
  float alpha = innerFade * outerFade * (0.55 + 0.45 * turb) * doppler;

  col *= (1.4 + (1.0 - normR) * 1.8 + turb * 0.6) * doppler;

  gl_FragColor = vec4(col, clamp(alpha * 0.90, 0.0, 1.0));
}
`;

// ============================================================================
// MAIN COMPONENT: INTERSTELLAR GARGANTUA (Clean, Cinematic & Photorealistic)
// ============================================================================
export function BlackHoleScene({
  dopplerEnabled = true,
  particlesEnabled = true,
  spinSpeed = 1.0,
}: BlackHoleSceneProps) {
  const diskRef = useRef<THREE.Mesh>(null);
  const lensRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);

  // Accretion Disk Shader Material
  const diskMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: diskVertexShader,
      fragmentShader: diskFragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uDoppler: { value: dopplerEnabled ? 1.0 : 0.0 },
      },
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [dopplerEnabled]);

  // Gravitational Lensing Halo Shader Material
  const lensMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: lensVertexShader,
      fragmentShader: lensFragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uDoppler: { value: dopplerEnabled ? 1.0 : 0.0 },
      },
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [dopplerEnabled]);

  // 1,600 Fine Keplerian Glowing Embers
  const [particlePositions, particleColors, particleSpeeds, particleRadii] = useMemo(() => {
    const count = 1600;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const radii = new Float32Array(count);

    const cWhite = new THREE.Color("#fff7ed");
    const cAmber = new THREE.Color("#f59e0b");
    const cCrimson = new THREE.Color("#b91c1c");

    for (let i = 0; i < count; i++) {
      const r = 2.12 + Math.pow(Math.random(), 1.5) * 6.8;
      const theta = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * 0.16 * (r / 3.0);

      positions[i * 3] = r * Math.cos(theta);
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = r * Math.sin(theta);

      radii[i] = r;
      speeds[i] = (2.0 / Math.pow(r, 1.4)) * (0.85 + Math.random() * 0.3);

      const t = (r - 2.12) / 6.8;
      const col = t < 0.3 ? cWhite.clone().lerp(cAmber, t / 0.3) : cAmber.clone().lerp(cCrimson, (t - 0.3) / 0.7);

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

  // Animation Frame Loop
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05) * spinSpeed;
    const elapsedTime = state.clock.getElapsedTime() * spinSpeed;

    diskMaterial.uniforms.uTime.value = elapsedTime;
    lensMaterial.uniforms.uTime.value = elapsedTime;

    // Swirl particles
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
    // Clean balanced orientation: tilted slightly forward by 17 degrees for iconic perspective
    <group position={[0, 0, 0]} rotation={[0.28, 0, 0]}>
      {/* 1. Deep Cosmic Starfield */}
      <Stars radius={140} depth={70} count={5000} factor={4.2} saturation={0.25} fade speed={0.3} />

      {/* Warm Ambient Cosmic Glow */}
      <ambientLight intensity={0.15} />
      <pointLight position={[0, 0, 0]} intensity={4.0} distance={25} color="#f59e0b" />

      {/* 2. GRAVITATIONAL LENSING: VERTICAL EINSTEIN RING (Light from rear disk warped above/below) */}
      {/* Positioned vertically right behind the event horizon (z = -0.06), perfectly concentric */}
      <mesh ref={lensRef} position={[0, 0, -0.06]} renderOrder={3} material={lensMaterial}>
        <ringGeometry args={[2.03, 4.25, 128]} />
      </mesh>

      {/* 3. PRIMARY EQUATORIAL ACCRETION DISK (Horizontal XZ Plane) */}
      {/* The front half cleanly sweeps in front, the rear half passes behind the event horizon */}
      <mesh ref={diskRef} rotation={[Math.PI / 2, 0, 0]} renderOrder={6} material={diskMaterial}>
        <ringGeometry args={[2.06, 9.2, 128, 32]} />
      </mesh>

      {/* 4. CENTRAL EVENT HORIZON (Pure, Pitch-Black Void, Light Sink) */}
      {/* Rendered with depthWrite to solidly occlude the rear half of the disk */}
      <mesh position={[0, 0, 0]} renderOrder={10}>
        <sphereGeometry args={[2.0, 64, 64]} />
        <meshBasicMaterial color="#000000" depthWrite={true} />
      </mesh>

      {/* 5. RAZOR-SHARP PHOTON SPHERE RIM (Tight Glowing Filament at r = 1.5 Rs) */}
      <mesh position={[0, 0, 0.02]} renderOrder={12}>
        <ringGeometry args={[2.008, 2.052, 128]} />
        <meshBasicMaterial
          color="#ffffff"
          side={THREE.DoubleSide}
          transparent
          opacity={0.96}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Soft Gold Photon Fringe */}
      <mesh position={[0, 0, 0.02]} renderOrder={12}>
        <ringGeometry args={[2.035, 2.095, 128]} />
        <meshBasicMaterial
          color="#fef08a"
          side={THREE.DoubleSide}
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 6. FINE KEPLERIAN GLOWING DUST PARTICLES */}
      {particlesEnabled && (
        <points ref={particlesRef} geometry={particlesGeometry} renderOrder={15}>
          <pointsMaterial
            size={0.038}
            vertexColors
            transparent
            opacity={0.85}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      )}

      {/* 7. SOFT VOLUMETRIC CORONA HAZE */}
      <mesh position={[0, 0, -0.2]} renderOrder={2}>
        <ringGeometry args={[2.05, 5.5, 64]} />
        <meshBasicMaterial
          color="#d97706"
          side={THREE.DoubleSide}
          transparent
          opacity={0.16}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
