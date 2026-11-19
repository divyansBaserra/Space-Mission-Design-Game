"use client";

import React, { useState } from "react";

export interface GargantuaTelemetryHUDProps {
  onToggleCinematic?: () => void;
}

export function GargantuaTelemetryHUD() {
  const [isMinimized, setIsMinimized] = useState<boolean>(false);

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          backgroundColor: "rgba(10, 14, 23, 0.75)",
          border: "1px solid rgba(245, 158, 11, 0.4)",
          borderRadius: "4px",
          padding: "6px 12px",
          color: "#fbbf24",
          fontSize: "11px",
          fontWeight: 700,
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.08em",
          cursor: "pointer",
          backdropFilter: "blur(8px)",
          pointerEvents: "auto",
        }}
        title="Open Gargantua Telemetry Intel"
      >
        <span
          style={{
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            backgroundColor: "#f59e0b",
            boxShadow: "0 0 6px #f59e0b",
          }}
        />
        <span>[+ GARGANTUA INTEL]</span>
      </button>
    );
  }

  return (
    <aside
      role="region"
      aria-label="Gargantua Astrodynamics Telemetry"
      style={{
        width: "220px",
        backgroundColor: "rgba(8, 12, 20, 0.82)",
        border: "1px solid rgba(245, 158, 11, 0.35)",
        borderRadius: "4px",
        padding: "12px 14px",
        backdropFilter: "blur(10px)",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.6)",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        color: "#f8fafc",
        pointerEvents: "auto",
        userSelect: "none",
      }}
    >
      {/* Sleek Minimal Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(245, 158, 11, 0.2)", paddingBottom: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: "#f59e0b",
              boxShadow: "0 0 6px #f59e0b",
            }}
          />
          <span
            className="font-mono"
            style={{
              fontSize: "10px",
              color: "#fbbf24",
              letterSpacing: "0.12em",
              fontWeight: 700,
              textTransform: "uppercase",
            }}
          >
            GARGANTUA
          </span>
        </div>
        <button
          onClick={() => setIsMinimized(true)}
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            fontSize: "11px",
            cursor: "pointer",
            padding: "0 2px",
            fontWeight: 700,
          }}
          title="Minimize HUD"
        >
          ✕
        </button>
      </div>

      {/* 4 Clean Telemetry Metric Rows */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#94a3b8", fontSize: "10px" }}>CLASS</span>
          <span className="font-mono" style={{ color: "#e2e8f0", fontWeight: 600 }}>Kerr Singularity</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#94a3b8", fontSize: "10px" }}>MASS</span>
          <span className="font-mono" style={{ color: "#fef08a", fontWeight: 700 }}>1.00 × 10⁸ M☉</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#94a3b8", fontSize: "10px" }}>SPIN (a*)</span>
          <span className="font-mono" style={{ color: "#38bdf8", fontWeight: 700 }}>0.9980</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#94a3b8", fontSize: "10px" }}>DILATION (γ)</span>
          <span className="font-mono" style={{ color: "#4ade80", fontWeight: 700 }}>61,320 ×</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: "#94a3b8", fontSize: "10px" }}>HORIZON</span>
          <span className="font-mono" style={{ color: "#f87171", fontWeight: 600 }}>1.97 AU</span>
        </div>
      </div>
    </aside>
  );
}
