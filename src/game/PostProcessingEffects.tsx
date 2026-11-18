"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { GameState } from "./types";

interface PostProcessingProps {
  gameState: GameState;
}

// Custom GLSL Shader for Chromatic Aberration, High-G Tunnel Vignette & Film Grain
const SpaceDistortionShader = {
  name: "SpaceDistortionShader",
  uniforms: {
    tDiffuse: { value: null },
    uDistortion: { value: 0.0 }, // Chromatic separation offset
    uVignetteDarkness: { value: 0.35 },
    uGForce: { value: 1.0 },
    uTime: { value: 0.0 },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uDistortion;
    uniform float uVignetteDarkness;
    uniform float uGForce;
    uniform float uTime;
    varying vec2 vUv;

    void main() {
      vec2 center = vec2(0.5, 0.5);
      vec2 dir = vUv - center;
      float dist = length(dir);

      // Radial Chromatic Aberration with cubic edge dispersion
      float radialFactor = dist * dist * 2.4;
      vec2 offset = dir * (uDistortion * radialFactor);
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      vec3 color = vec3(r, g, b);

      // Dynamic High-G Radial Tunnel Vision (Constricts peripheral vision at G > 2.5)
      // Normal nominal radius ~ 0.85; under 4.5G tunnel vision shrinks to ~ 0.35
      float tunnelRadius = clamp(0.85 - (uGForce - 1.0) * 0.14, 0.32, 0.85);
      float tunnelSoftness = clamp(0.35 - (uGForce - 1.0) * 0.05, 0.15, 0.35);
      float vignetteMask = smoothstep(tunnelRadius, tunnelRadius - tunnelSoftness, dist);

      // Tunnel vision blackout border with dynamic contrast falloff
      float darkness = clamp(uVignetteDarkness + (uGForce - 1.0) * 0.22, 0.25, 0.95);
      color = mix(color * (1.0 - darkness), color, vignetteMask);

      // Aerospace Digital Sensor Dither & Film Grain
      float grain = (fract(sin(dot(vUv * (uTime * 0.05 + 1.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.012;
      color += grain;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export function PostProcessingEffects({ gameState }: PostProcessingProps) {
  const { gl, scene, camera, size } = useThree();
  const shaderPassRef = useRef<ShaderPass | null>(null);
  const prevVelRef = useRef<THREE.Vector3>(new THREE.Vector3());

  const isHighGfx = gameState.settings?.graphicsQuality !== "LOW";

  const composer = useMemo(() => {
    if (!isHighGfx) return null;

    const comp = new EffectComposer(gl);
    comp.setSize(size.width, size.height);

    // 1. Scene Color Pass
    const renderPass = new RenderPass(scene, camera);
    comp.addPass(renderPass);

    // 2. Photonic Unreal Bloom Pass (Isolated to extreme emissive thrusters and lasers; zero diffuse blowout)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      0.18, // subtle aerospace glare
      0.35, // radius
      2.2   // high threshold: strictly isolates high-energy emissive thrusters & lasers; prevents terrain/body whiteout
    );
    comp.addPass(bloomPass);

    // 3. High-G Distortion, Chromatic Aberration & Optical Vignette
    const distortionPass = new ShaderPass(SpaceDistortionShader);
    shaderPassRef.current = distortionPass;
    comp.addPass(distortionPass);

    // 4. Output Tone Mapping & sRGB Color Space Pass (Standard in Three.js r150+)
    // Applies ACESFilmicToneMapping and sRGB transfer function, eliminating linear HDR whiteout clipping
    const outputPass = new OutputPass();
    comp.addPass(outputPass);

    return comp;
  }, [gl, scene, camera, isHighGfx]);

  // Sync window resize
  useEffect(() => {
    if (composer) {
      composer.setSize(size.width, size.height);
    }
  }, [composer, size]);

  // Frame update
  useFrame(({ clock }, delta) => {
    if (!composer || !isHighGfx) return;

    if (shaderPassRef.current) {
      const isCockpit = gameState.controlMode === "SPACECRAFT_COCKPIT";
      const isThrusterFiring = gameState.hangarCraft?.isThrusterFiring;
      const speed = gameState.spacecraft?.speedMps ?? 0;

      // Calculate dynamic simulated G-force
      let targetG = 1.0;
      let targetDistortion = 0.001;

      if (isCockpit) {
        const vel = gameState.spacecraft?.velocity ?? new THREE.Vector3();
        const accel = vel.clone().sub(prevVelRef.current).length() / Math.max(delta, 0.01);
        prevVelRef.current.copy(vel);

        // Convert acceleration (m/s^2) to Gs (Earth standard g0 = 9.80665 m/s^2)
        const gFromAccel = accel / 9.80665;
        const gFromSpeed = Math.min(2.0, speed / 14.0);
        targetG = Math.max(1.0, 1.0 + gFromAccel * 1.8 + gFromSpeed);
        targetG = Math.min(4.8, targetG);

        // Chromatic aberration and tunnel vision scale sharply at G > 2.2
        targetDistortion = targetG > 2.2 ? 0.0025 + (targetG - 2.2) * 0.004 : 0.001;
      } else if (isThrusterFiring) {
        targetG = 2.4;
        targetDistortion = 0.006;
      } else {
        prevVelRef.current.set(0, 0, 0);
      }

      const shader = shaderPassRef.current.material as THREE.ShaderMaterial;
      if (shader && shader.uniforms) {
        shader.uniforms.uTime.value = clock.getElapsedTime();
        shader.uniforms.uDistortion.value = THREE.MathUtils.lerp(
          shader.uniforms.uDistortion.value,
          targetDistortion,
          delta * 8
        );
        shader.uniforms.uGForce.value = THREE.MathUtils.lerp(
          shader.uniforms.uGForce.value,
          targetG,
          delta * 6
        );
      }
    }

    composer.render(delta);
  }, 1);

  return null;
}
