"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { AegisScene, AegisSceneProps } from "./AegisScene";

export interface AegisCanvasProps extends AegisSceneProps {
  cameraMode?: "ORBIT" | "DRACO_NOSE" | "LICIACUBE_CHASE";
}

export default function AegisCanvas(props: AegisCanvasProps) {
  const isTerminalRun = props.currentAct === "ACT_III_TERMINAL_RUN";
  const isLiciacube = props.currentAct === "ACT_IV_LICIACUBE";

  // Dynamic camera positioning depending on current mission act
  const cameraPos: [number, number, number] = isTerminalRun
    ? [0, 0, 3.2] // Direct DRACO optical boresight view
    : isLiciacube
    ? [0.8, -0.2, 3.8] // LICIACube trailing vantage point
    : [0, 1.8, 5.5]; // Cinematic third-person vantage

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", backgroundColor: "#040608" }}>
      <Canvas
        camera={{
          position: cameraPos,
          fov: isTerminalRun ? 40 : 50,
          near: 0.1,
          far: 2000,
        }}
        gl={{
          antialias: true,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.25,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.25;
        }}
        style={{ width: "100%", height: "100%", background: "#040608" }}
      >
        <Suspense fallback={null}>
          <AegisScene {...props} />
        </Suspense>

        {!isTerminalRun && (
          <OrbitControls
            enablePan={false}
            minDistance={2.5}
            maxDistance={25.0}
            enableDamping={true}
            dampingFactor={0.05}
            makeDefault
          />
        )}
      </Canvas>
    </div>
  );
}
