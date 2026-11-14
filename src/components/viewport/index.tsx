"use client";

import dynamic from "next/dynamic";
import React from "react";

// Dynamic import with SSR disabled to guarantee zero SSR hydration or window errors
export const SpacecraftViewport = dynamic(
  () => import("./SpacecraftCanvas"),
  {
    ssr: false,
    loading: () => (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-muted)",
          fontFamily: "var(--font-mono)",
          fontSize: "var(--text-xs)",
          letterSpacing: "0.08em",
        }}
      >
        [INITIALIZING 3D VIEWPORT...]
      </div>
    ),
  }
);
