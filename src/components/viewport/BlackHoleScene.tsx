"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";

export interface BlackHoleSceneProps {
  dopplerEnabled?: boolean;
  jetsEnabled?: boolean;
  particlesEnabled?: boolean;
  spinSpeed?: number;
}

// ============================================================================
// ASHIMA ARTS GLSL 2D SIMPLEX NOISE & FBM SHADER CHUNKS
// ============================================================================
const GLSL_SIMPLEX_NOISE = `
vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187,  // (3.0 - sqrt(3.0)) / 6.0
    0.366025403784439,  // 0.5 * (sqrt(3.0) - 1.0)
    -0.577350269189626, // -1.0 + 2.0 * C.x
    0.024390243902439   // 1.0 / 41.0
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
  v += 0.5000 * snoise(p); p *= 2.03;
  v += 0.2500 * snoise(p); p *= 2.02;
  v += 0.1250 * snoise(p); p *= 2.01;
  v += 0.0625 * snoise(p);
  return v * 0.5 + 0.5;
}
`;

// ============================================================================
// 1. ACCRETION DISK SHADER (Relativistic Keplerian Plasma with Doppler Beaming)
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
uniform vec3 uColorHot;
uniform vec3 uColorMid;
uniform vec3 uColorOuter;
uniform vec3 uColorEdge;

${GLSL_SIMPLEX_NOISE}

void main() {
  float r = length(vPosition.xy);
  // Boundary check: Inner ISCO at 2.08, Outer edge at 9.8
  if (r < 2.08 || r > 9.9) {
    discard;
  }

  float normR = clamp((r - 2.12) / (9.6 - 2.12), 0.0, 1.0);
  float phi = atan(vPosition.y, vPosition.x);

  // Keplerian differential angular velocity: omega ~ 1 / r^1.4
  float omega = 3.2 / pow(r, 1.35);
  float rotPhi = phi + uTime * omega;

  // Turbulent plasma filaments
  vec2 coord = vec2(r * 3.2 - rotPhi * 2.2, phi * 3.8 + uTime * 0.5);
  float turbulence = fbm(coord);

  // Striated spiral density waves
  float striation = sin(r * 28.0 - rotPhi * 9.0) * 0.5 + 0.5;
  float density = mix(turbulence, striation * turbulence, 0.38);

  // Relativistic Temperature Gradient (Kelvin blackbody approximation)
  vec3 col = uColorHot;
  if (normR < 0.20) {
    col = mix(uColorHot, uColorMid, normR / 0.20);
  } else if (normR < 0.60) {
    col = mix(uColorMid, uColorOuter, (normR - 0.20) / 0.40);
  } else {
    col = mix(uColorOuter, uColorEdge, (normR - 0.60) / 0.40);
  }

  // Relativistic Doppler Beaming (approaching side amplified & blueshifted)
  float dopplerFactor = 1.0;
  if (uDoppler > 0.5) {
    // Left side approaching observer in default orientation
    float beaming = -sin(phi);
    dopplerFactor = pow(clamp(1.0 + beaming * 0.65, 0.22, 2.45), 3.2);

    if (beaming > 0.0) {
      // Blueshift approaching plasma towards white/cyan
      col = mix(col, vec3(0.96, 0.98, 1.15), beaming * 0.48);
    } else {
      // Redshift receding plasma towards deep crimson/amber
      col = mix(col, vec3(0.75, 0.15, 0.05), -beaming * 0.42);
    }
  }

  // Edge falloffs (ultra-sharp ISCO inner cliff, diffuse outer boundary)
  float innerFade = smoothstep(2.08, 2.22, r);
  float outerFade = smoothstep(9.9, 7.2, r);
  float alpha = innerFade * outerFade * (0.35 + 0.65 * density) * clamp(dopplerFactor, 0.2, 2.0);

  // High dynamic range emission
  col *= (1.4 + 2.0 * (1.0 - normR) + density * 0.9) * dopplerFactor;

  gl_FragColor = vec4(col, clamp(alpha, 0.0, 1.0));
}
`;

// ============================================================================
// 2. GRAVITATIONAL LENSING HALO SHADER (Einstein Ring Warped Arches)
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
uniform vec3 uColorHot;
uniform vec3 uColorMid;
uniform vec3 uColorOuter;

${GLSL_SIMPLEX_NOISE}

void main() {
  // Normalized UV coordinates along torus cross-section
  float u = vUv.x; // Angle along the arch
  float v = vUv.y; // Cross-sectional radius

  // Radial falloff across the thickness of the warped halo
  float ringDist = abs(v - 0.5) * 2.0;
  float intensity = pow(1.0 - ringDist, 1.8);

  // Keplerian swirling filaments along the curved lensing trajectory
  float flow = fbm(vec2(u * 12.0 + uTime * 1.8, v * 6.0));

  // Doppler effect along the arch
  float dopplerFactor = 1.0;
  vec3 col = mix(uColorHot, uColorMid, ringDist);

  if (uDoppler > 0.5) {
    // u goes from 0 to 1 along the arch; left side is approaching
    float beam = sin(u * 3.14159265);
    float side = cos(u * 3.14159265); // -1 on left, +1 on right
    dopplerFactor = pow(clamp(1.0 - side * 0.55, 0.3, 2.2), 2.5);

    if (side < 0.0) {
      col = mix(col, vec3(1.0, 1.0, 1.1), -side * 0.4);
    } else {
      col = mix(col, vec3(0.85, 0.2, 0.05), side * 0.35);
    }
  }

  col *= (1.2 + flow * 0.8) * dopplerFactor;
  float alpha = intensity * (0.4 + 0.6 * flow) * clamp(dopplerFactor, 0.25, 1.8);

  gl_FragColor = vec4(col, clamp(alpha * 0.88, 0.0, 1.0));
}
`;

// ============================================================================
// 3. BIPOLAR RELATIVISTIC JETS SHADER (Synchrotron Shock Ionization)
// ============================================================================
const jetVertexShader = `
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vPosition = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const jetFragmentShader = `
varying vec2 vUv;
varying vec3 vPosition;

uniform float uTime;

void main() {
  float y = abs(vPosition.y);
  float radius = length(vPosition.xz);

  // Shock diamonds along the relativistic jet column
  float shock = sin(y * 4.2 - uTime * 7.5) * 0.5 + 0.5;

  // Intense cyan/white core at base, fading to ultra-violet in deep space
  vec3 coreColor = vec3(0.92, 0.98, 1.0);
  vec3 midColor = vec3(0.22, 0.74, 0.98); // High-energy synchrotron cyan
  vec3 outerColor = vec3(0.48, 0.24, 0.95); // Ionized violet

  float yNorm = clamp(y / 11.0, 0.0, 1.0);
  vec3 col = mix(coreColor, midColor, yNorm * 0.8);
  col = mix(col, outerColor, pow(yNorm, 1.8));

  // High brightness at center of cylinder, fading outwards
  float radialFalloff = exp(-radius * 7.5);
  // Distance falloff along the length
  float lengthFalloff = smoothstep(11.0, 0.8, y) * smoothstep(0.1, 0.8, y);

  float alpha = radialFalloff * lengthFalloff * (0.65 + 0.35 * shock);
  col *= (2.0 + shock * 1.5);

  gl_FragColor = vec4(col, clamp(alpha * 0.92, 0.0, 1.0));
}
`;

// ============================================================================
// MAIN BLACK HOLE COMPONENT (Interstellar / Nestaeric Photorealistic Edition)
// ============================================================================
export function BlackHoleScene({
  dopplerEnabled = true,
  jetsEnabled = true,
  particlesEnabled = true,
  spinSpeed = 1.0,
}: BlackHoleSceneProps) {
  const diskRef = useRef<THREE.Mesh>(null);
  const lensUpperRef = useRef<THREE.Mesh>(null);
  const lensLowerRef = useRef<THREE.Mesh>(null);
  const particlesRef = useRef<THREE.Points>(null);
  const jetUpperRef = useRef<THREE.Mesh>(null);
  const jetLowerRef = useRef<THREE.Mesh>(null);

  // Custom Shader Materials with Uniforms
  const diskMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: diskVertexShader,
      fragmentShader: diskFragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uDoppler: { value: dopplerEnabled ? 1.0 : 0.0 },
        uColorHot: { value: new THREE.Color("#fffbeb") },
        uColorMid: { value: new THREE.Color("#f59e0b") },
        uColorOuter: { value: new THREE.Color("#b45309") },
        uColorEdge: { value: new THREE.Color("#78350f") },
      },
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [dopplerEnabled]);

  const lensUpperMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: lensVertexShader,
      fragmentShader: lensFragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uDoppler: { value: dopplerEnabled ? 1.0 : 0.0 },
        uColorHot: { value: new THREE.Color("#fffbeb") },
        uColorMid: { value: new THREE.Color("#f59e0b") },
        uColorOuter: { value: new THREE.Color("#b45309") },
      },
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [dopplerEnabled]);

  const lensLowerMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: lensVertexShader,
      fragmentShader: lensFragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
        uDoppler: { value: dopplerEnabled ? 1.0 : 0.0 },
        uColorHot: { value: new THREE.Color("#fffbeb") },
        uColorMid: { value: new THREE.Color("#f59e0b") },
        uColorOuter: { value: new THREE.Color("#b45309") },
      },
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, [dopplerEnabled]);

  const jetMaterial = useMemo(() => {
    return new THREE.ShaderMaterial({
      vertexShader: jetVertexShader,
      fragmentShader: jetFragmentShader,
      uniforms: {
        uTime: { value: 0.0 },
      },
      side: THREE.DoubleSide,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
  }, []);

  // Generate 2,800 Swirling Relativistic Keplerian Particles
  const [particlePositions, particleColors, particleSpeeds, particleRadii] = useMemo(() => {
    const count = 2800;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const speeds = new Float32Array(count);
    const radii = new Float32Array(count);

    const cWhite = new THREE.Color("#ffffff");
    const cAmber = new THREE.Color("#fbbf24");
    const cCrimson = new THREE.Color("#dc2626");

    for (let i = 0; i < count; i++) {
      const r = 2.15 + Math.pow(Math.random(), 1.6) * 7.5;
      const theta = Math.random() * Math.PI * 2;
      const height = (Math.random() - 0.5) * 0.24 * (r / 3.5);

      positions[i * 3] = r * Math.cos(theta);
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = r * Math.sin(theta);

      radii[i] = r;
      // Relativistic Keplerian angular speed ~ 1 / r^1.5
      speeds[i] = (2.2 / Math.pow(r, 1.4)) * (0.85 + Math.random() * 0.3);

      const t = (r - 2.15) / 7.5;
      const col = t < 0.28 ? cWhite.clone().lerp(cAmber, t / 0.28) : cAmber.clone().lerp(cCrimson, (t - 0.28) / 0.72);

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

  // Frame Update Loop (High-Precision Relativistic Clock)
  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05) * spinSpeed;
    const elapsedTime = state.clock.getElapsedTime() * spinSpeed;

    // Update Shader Uniforms
    diskMaterial.uniforms.uTime.value = elapsedTime;
    lensUpperMaterial.uniforms.uTime.value = elapsedTime;
    lensLowerMaterial.uniforms.uTime.value = elapsedTime;
    jetMaterial.uniforms.uTime.value = elapsedTime;

    // Rotate Relativistic Accretion Disk slightly for geometry motion
    if (diskRef.current) {
      diskRef.current.rotation.z += dt * 0.05;
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
    <group position={[0, 0, 0]} rotation={[0.24, -0.32, 0]}>
      {/* 1. Deep Cosmic Starfield & Background Nebula */}
      <Stars radius={150} depth={90} count={6000} factor={4.8} saturation={0.3} fade speed={0.35} />

      {/* Relativistic Illumination */}
      <ambientLight intensity={0.12} />
      <pointLight position={[0, 0, 0]} intensity={5.5} distance={30} color="#fbbf24" />
      <pointLight position={[0, 4.0, 0]} intensity={2.5} distance={18} color="#fed7aa" />
      <pointLight position={[0, -4.0, 0]} intensity={2.5} distance={18} color="#fed7aa" />

      {/* 2. CENTRAL EVENT HORIZON (Absolute Darkness: Kerr Singularity, Absorbs All Photons) */}
      <mesh renderOrder={10}>
        <sphereGeometry args={[2.0, 64, 64]} />
        <meshBasicMaterial color="#000000" depthWrite={true} />
      </mesh>

      {/* 3. PHOTON SPHERE RING (r = 1.5 Rs - Super Incandescent White-Cyan Ring on Silhouette Rim) */}
      <mesh position={[0, 0, 0.05]} renderOrder={11}>
        <ringGeometry args={[2.01, 2.14, 128]} />
        <meshBasicMaterial
          color="#ffffff"
          side={THREE.DoubleSide}
          transparent
          opacity={0.96}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Second Soft Photon Fringe */}
      <mesh position={[0, 0, 0.05]} renderOrder={11}>
        <ringGeometry args={[2.04, 2.22, 128]} />
        <meshBasicMaterial
          color="#fef08a"
          side={THREE.DoubleSide}
          transparent
          opacity={0.65}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 4. GRAVITATIONAL LENSING: UPPER WARPED HALO ARCH (Einstein Ring Over Event Horizon) */}
      {/* Semicircular arch curving over top rear of event horizon */}
      <group position={[0, 0, -0.25]} rotation={[-0.14, 0, 0]} renderOrder={5}>
        <mesh ref={lensUpperRef} material={lensUpperMaterial}>
          <torusGeometry args={[2.95, 0.58, 32, 128, Math.PI]} />
        </mesh>
        {/* Secondary Hot Core Halo */}
        <mesh>
          <torusGeometry args={[2.62, 0.18, 32, 128, Math.PI]} />
          <meshBasicMaterial
            color="#fef3c7"
            transparent
            opacity={0.88}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* 5. GRAVITATIONAL LENSING: LOWER WARPED HALO ARCH (Einstein Ring Under Event Horizon) */}
      {/* Semicircular arch curving under bottom rear of event horizon */}
      <group position={[0, 0, -0.25]} rotation={[-0.14, 0, Math.PI]} renderOrder={5}>
        <mesh ref={lensLowerRef} material={lensLowerMaterial}>
          <torusGeometry args={[2.95, 0.48, 32, 128, Math.PI]} />
        </mesh>
        {/* Secondary Hot Core Halo */}
        <mesh>
          <torusGeometry args={[2.62, 0.16, 32, 128, Math.PI]} />
          <meshBasicMaterial
            color="#fef3c7"
            transparent
            opacity={0.85}
            blending={THREE.AdditiveBlending}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* 6. PRIMARY EQUATORIAL ACCRETION DISK (High-Definition GLSL Keplerian Plasma) */}
      <mesh ref={diskRef} rotation={[Math.PI / 2, 0, 0]} material={diskMaterial}>
        <ringGeometry args={[2.08, 9.9, 128, 32]} />
      </mesh>

      {/* Inner Ultra-Hot ISCO Corona Fringe */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[2.12, 2.55, 128]} />
        <meshBasicMaterial
          color="#ffffff"
          side={THREE.DoubleSide}
          transparent
          opacity={0.88}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* 7. BIPOLAR RELATIVISTIC JETS (Synchrotron Polar Outflow along Spin Axis) */}
      {jetsEnabled && (
        <group>
          {/* North Polar Jet (+Y) */}
          <group position={[0, 0.8, 0]}>
            <mesh ref={jetUpperRef} material={jetMaterial}>
              <cylinderGeometry args={[0.08, 0.85, 12.0, 32, 1, true]} />
            </mesh>
            {/* Magnetic Helical Confinement Rings */}
            <mesh position={[0, 2.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.26, 0.03, 16, 32]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh position={[0, 5.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.42, 0.035, 16, 32]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.5} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh position={[0, 8.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.62, 0.04, 16, 32]} />
              <meshBasicMaterial color="#818cf8" transparent opacity={0.4} blending={THREE.AdditiveBlending} />
            </mesh>
          </group>

          {/* South Polar Jet (-Y) */}
          <group position={[0, -0.8, 0]} rotation={[Math.PI, 0, 0]}>
            <mesh ref={jetLowerRef} material={jetMaterial}>
              <cylinderGeometry args={[0.08, 0.85, 12.0, 32, 1, true]} />
            </mesh>
            {/* Magnetic Helical Confinement Rings */}
            <mesh position={[0, 2.5, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.26, 0.03, 16, 32]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh position={[0, 5.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.42, 0.035, 16, 32]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.5} blending={THREE.AdditiveBlending} />
            </mesh>
            <mesh position={[0, 8.0, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.62, 0.04, 16, 32]} />
              <meshBasicMaterial color="#818cf8" transparent opacity={0.4} blending={THREE.AdditiveBlending} />
            </mesh>
          </group>
        </group>
      )}

      {/* 8. RELATIVISTIC KEPLERIAN PARTICLE EMBER SWARM */}
      {particlesEnabled && (
        <points ref={particlesRef} geometry={particlesGeometry}>
          <pointsMaterial
            size={0.062}
            vertexColors
            transparent
            opacity={0.88}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </points>
      )}

      {/* 9. GRAVITATIONAL WARPING SHADOW (Volumetric Depth Cue Behind Horizon) */}
      <mesh position={[0, 0, -0.35]}>
        <sphereGeometry args={[2.28, 32, 32]} />
        <meshBasicMaterial color="#020408" transparent opacity={0.7} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}
