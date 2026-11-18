"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { SpacecraftScene, SpacecraftSceneProps } from "./SpacecraftScene";

export default function SpacecraftCanvas(props: SpacecraftSceneProps) {
  const isOrbit = props.viewMode === "ORBIT";
  const isBlackHole = props.viewMode === "BLACK_HOLE";
  const isSolarSystem = props.viewMode === "SOLAR_SYSTEM";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        camera={{
          position: isSolarSystem ? [0, 26, 44] : isBlackHole ? [0, 2.2, 8.8] : isOrbit ? [0, 4.5, 7.5] : [3, 2.5, 4],
          fov: isSolarSystem ? 48 : 45,
          near: 0.1,
          far: 600,
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
        <OrbitControls
          enablePan={isSolarSystem}
          minDistance={isSolarSystem ? 2.0 : isBlackHole ? 4.0 : isOrbit ? 3.2 : 1.4}
          maxDistance={isSolarSystem ? 180.0 : isBlackHole ? 22.0 : isOrbit ? 16.0 : 8.0}
          enableDamping={true}
          dampingFactor={0.05}
          autoRotate={isBlackHole || (isSolarSystem && !props.selectedPlanetId)}
          autoRotateSpeed={isSolarSystem ? 0.08 : 0.4}
          makeDefault
        />
      </Canvas>
    </div>
  );
}
