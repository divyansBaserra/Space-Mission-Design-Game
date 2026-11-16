"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
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

      // Chromatic Aberration: sample R, G, B channels with radial displacement
      vec2 offset = dir * (uDistortion * (dist * 1.8));
      float r = texture2D(tDiffuse, vUv + offset).r;
      float g = texture2D(tDiffuse, vUv).g;
      float b = texture2D(tDiffuse, vUv - offset).b;
      vec3 color = vec3(r, g, b);

      // Dynamic High-G Tunnel Vignette
      float vignette = smoothstep(0.9, 0.25 + 0.15 * min(uGForce * 0.15, 0.4), dist);
      color *= mix(1.0 - uVignetteDarkness, 1.0, vignette);

      // Subtle Aerospace Optical Noise / Film Grain (0.012 amplitude)
      float grain = (fract(sin(dot(vUv * (uTime * 0.1 + 1.0), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.015;
      color += grain;

      gl_FragColor = vec4(color, 1.0);
    }
  `,
};

export function PostProcessingEffects({ gameState }: PostProcessingProps) {
  const { gl, scene, camera, size } = useThree();
  const shaderPassRef = useRef<ShaderPass | null>(null);

  const isHighGfx = gameState.settings?.graphicsQuality !== "LOW";

  const composer = useMemo(() => {
    if (!isHighGfx) return null;

    const comp = new EffectComposer(gl);
    comp.setSize(size.width, size.height);

    // 1. Scene Color Pass
    const renderPass = new RenderPass(scene, camera);
    comp.addPass(renderPass);

    // 2. Photonic Unreal Bloom Pass (Glowing thrusters, accretion disks, stars, HUD)
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(size.width, size.height),
      0.65, // strength
      0.4,  // radius
      0.72  // threshold
    );
    comp.addPass(bloomPass);

    // 3. High-G Distortion, Chromatic Aberration & Optical Vignette
    const distortionPass = new ShaderPass(SpaceDistortionShader);
    shaderPassRef.current = distortionPass;
    comp.addPass(distortionPass);

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

      // Calculate simulated G-force
      let targetG = 1.0;
      let targetDistortion = 0.001;

      if (isCockpit) {
        if (speed > 10) {
          targetG = 1.0 + Math.min(3.5, speed * 0.02);
          targetDistortion = Math.min(0.008, 0.001 + speed * 0.0001);
        }
      } else if (isThrusterFiring) {
        targetG = 2.4;
        targetDistortion = 0.006;
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
