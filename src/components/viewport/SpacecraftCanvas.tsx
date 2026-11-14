"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { SpacecraftScene } from "./SpacecraftScene";

interface SpacecraftCanvasProps {
  busSize?: "1U" | "3U" | "6U";
}

export default function SpacecraftCanvas({ busSize = "3U" }: SpacecraftCanvasProps) {
  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas
        camera={{ position: [3, 2.5, 4], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        style={{ width: "100%", height: "100%", background: "transparent" }}
      >
        <Suspense fallback={null}>
          <SpacecraftScene busSize={busSize} />
        </Suspense>
      </Canvas>
    </div>
  );
}
