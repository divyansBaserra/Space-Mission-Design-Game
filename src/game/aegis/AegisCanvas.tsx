"use client";

import React, { Suspense, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { AegisScene, AegisSceneProps, AegisAct } from "./AegisScene";

export interface AegisCanvasProps extends AegisSceneProps {
  cameraMode?: "ORBIT" | "DRACO_NOSE" | "LICIACUBE_CHASE";
}

function AegisCameraController({ currentAct }: { currentAct: AegisAct }) {
  const { camera } = useThree();
  const currentPos = useRef(new THREE.Vector3(0, 1.8, 5.5));
  const currentTarget = useRef(new THREE.Vector3(0, 0, 0));

  useFrame((_, delta) => {
    const targetPos = new THREE.Vector3(0, 1.8, 5.5);
    const lookTarget = new THREE.Vector3(0, 0, 0);

    if (currentAct === "ACT_I_MARS_OBERTH") {
      targetPos.set(0, 1.6, 5.2);
      lookTarget.set(0, 0, 0);
    } else if (currentAct === "ACT_II_SMART_NAV") {
      targetPos.set(0, 0.8, 4.4);
      lookTarget.set(0, 0, -2.0);
    } else if (currentAct === "ACT_III_TERMINAL_RUN") {
      // DRACO optical boresight camera looking down the centerline towards Dimorphos
      targetPos.set(0, 0, 3.2);
      lookTarget.set(0, 0, -30.0);
    } else if (currentAct === "ACT_IV_LICIACUBE") {
      // Trailing LICIACube observer vantage point viewing the ejecta cone
      targetPos.set(1.4, 0.6, 4.8);
      lookTarget.set(0, 0, 0);
    }

    const t = Math.min(1.0, delta * 4.5);
    currentPos.current.lerp(targetPos, t);
    currentTarget.current.lerp(lookTarget, t);

    camera.position.copy(currentPos.current);
    camera.lookAt(currentTarget.current);
  });

  return null;
}

export default function AegisCanvas(props: AegisCanvasProps) {
  const isTerminalRun = props.currentAct === "ACT_III_TERMINAL_RUN";

  return (
    <div style={{ width: "100%", height: "100%", position: "relative", backgroundColor: "#040608" }}>
      <Canvas
        camera={{
          position: [0, 1.8, 5.5],
          fov: isTerminalRun ? 40 : 50,
          near: 0.1,
          far: 2000,
        }}
        gl={{
          antialias: true,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.05,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.05;
        }}
        style={{ width: "100%", height: "100%", background: "#040608" }}
      >
        <AegisCameraController currentAct={props.currentAct} />
        <Suspense fallback={null}>
          <AegisScene {...props} />
        </Suspense>
      </Canvas>
    </div>
  );
}
