"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import EuropaScene, { type EuropaAct } from "./EuropaScene";

interface EuropaCanvasProps {
  act: EuropaAct;
  reactorPowerPercent: number;
  meltDepthMeters: number;
  subPosition: THREE.Vector3;
  subRotation: THREE.Euler;
  sonarPingTrigger: number;
  isSampling: boolean;
  sampleCollected: boolean;
  clawExtension: number;
}

export default function EuropaCanvas({
  act,
  reactorPowerPercent,
  meltDepthMeters,
  subPosition,
  subRotation,
  sonarPingTrigger,
  isSampling,
  sampleCollected,
  clawExtension,
}: EuropaCanvasProps) {
  // Determine optimal camera position based on active act
  const cameraProps = React.useMemo(() => {
    switch (act) {
      case "ACT_1_SURFACE_DESCENT":
        return { position: [0, 8.0, 16.0] as [number, number, number], fov: 50 };
      case "ACT_2_CRYO_MELT":
        return { position: [0, 1.0, 8.5] as [number, number, number], fov: 45 };
      case "ACT_3_ABYSSAL_SUB":
        return {
          position: [subPosition.x, subPosition.y + 2.5, subPosition.z + 7.0] as [number, number, number],
          fov: 55,
        };
      case "ACT_4_SAMPLE_DISCOVERY":
        return {
          position: [subPosition.x + 1.2, subPosition.y - 0.2, subPosition.z - 2.8] as [number, number, number],
          fov: 48,
        };
    }
  }, [act, subPosition.x, subPosition.y, subPosition.z]);

  return (
    <div style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, backgroundColor: "#020408" }}>
      <Canvas
        camera={cameraProps}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: act === "ACT_3_ABYSSAL_SUB" || act === "ACT_4_SAMPLE_DISCOVERY" ? 1.6 : 1.2,
        }}
      >
        <Suspense fallback={null}>
          <EuropaScene
            act={act}
            reactorPowerPercent={reactorPowerPercent}
            meltDepthMeters={meltDepthMeters}
            subPosition={subPosition}
            subRotation={subRotation}
            sonarPingTrigger={sonarPingTrigger}
            isSampling={isSampling}
            sampleCollected={sampleCollected}
            clawExtension={clawExtension}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
