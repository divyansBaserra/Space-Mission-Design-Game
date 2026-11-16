"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { SpacecraftScene, SpacecraftSceneProps } from "./SpacecraftScene";

export default function SpacecraftCanvas(props: SpacecraftSceneProps) {
  const isOrbit = props.viewMode === "ORBIT";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        camera={{
          position: isOrbit ? [0, 4.5, 7.5] : [3, 2.5, 4],
          fov: 45,
        }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.1,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.1;
        }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <Suspense fallback={null}>
          <SpacecraftScene {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}
