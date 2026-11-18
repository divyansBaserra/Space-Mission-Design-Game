"use client";

import React, { Suspense, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
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

function EuropaCameraController({ act, subPosition }: { act: EuropaAct; subPosition: THREE.Vector3 }) {
  const { camera } = useThree();
  const currentPos = useRef(new THREE.Vector3(0, 8.0, 16.0));
  const currentTarget = useRef(new THREE.Vector3(0, 0, 0));

  useFrame((_, delta) => {
    const targetPos = new THREE.Vector3(0, 8.0, 16.0);
    const lookTarget = new THREE.Vector3(0, 0, 0);

    if (act === "ACT_1_SURFACE_DESCENT") {
      targetPos.set(0, 5.0, 14.0);
      lookTarget.set(0, 0, 0);
    } else if (act === "ACT_2_CRYO_MELT") {
      targetPos.set(0, 2.0, 7.5);
      lookTarget.set(0, -1.0, 0);
    } else if (act === "ACT_3_ABYSSAL_SUB") {
      // Dynamic third-person chase camera tracking submarine with gentle spring
      targetPos.set(subPosition.x, subPosition.y + 2.2, subPosition.z + 6.2);
      lookTarget.set(subPosition.x, subPosition.y - 0.4, subPosition.z - 4.5);
    } else if (act === "ACT_4_SAMPLE_DISCOVERY") {
      // Close cinematic claw observation vantage point
      targetPos.set(subPosition.x + 1.2, subPosition.y - 0.1, subPosition.z - 2.2);
      lookTarget.set(subPosition.x + 0.2, subPosition.y - 0.4, subPosition.z - 3.2);
    }

    const t = Math.min(1.0, delta * 4.5);
    currentPos.current.lerp(targetPos, t);
    currentTarget.current.lerp(lookTarget, t);

    camera.position.copy(currentPos.current);
    camera.lookAt(currentTarget.current);
  });

  return null;
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
  return (
    <div style={{ width: "100%", height: "100%", position: "absolute", top: 0, left: 0, backgroundColor: "#020408" }}>
      <Canvas
        camera={{ position: [0, 8.0, 16.0], fov: 52 }}
        gl={{
          antialias: true,
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: act === "ACT_3_ABYSSAL_SUB" || act === "ACT_4_SAMPLE_DISCOVERY" ? 1.25 : 1.05,
        }}
      >
        <EuropaCameraController act={act} subPosition={subPosition} />
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
