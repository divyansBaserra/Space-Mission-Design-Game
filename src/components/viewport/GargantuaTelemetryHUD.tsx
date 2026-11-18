"use client";

import React from "react";

export interface GargantuaTelemetryHUDProps {
  dopplerEnabled: boolean;
  onToggleDoppler: () => void;
  jetsEnabled: boolean;
  onToggleJets: () => void;
  particlesEnabled: boolean;
  onToggleParticles: () => void;
}

export function GargantuaTelemetryHUD({
  dopplerEnabled,
  onToggleDoppler,
  jetsEnabled,
  onToggleJets,
  particlesEnabled,
  onToggleParticles,
}: GargantuaTelemetryHUDProps) {
  return (
    <aside
      role="region"
      aria-label="Gargantua Relativistic Astrodynamics Telemetry"
      style={{
        width: "360px",
        backgroundColor: "rgba(10, 14, 23, 0.88)",
        border: "1px solid rgba(245, 158, 11, 0.4)",
        borderRadius: "6px",
        padding: "16px",
        backdropFilter: "blur(12px)",
        boxShadow: "0 8px 32px rgba(0, 0, 0, 0.6), 0 0 20px rgba(245, 158, 11, 0.15)",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        color: "#f8fafc",
        maxHeight: "82vh",
        overflowY: "auto",
        pointerEvents: "auto",
      }}
    >
      {/* HUD Header */}
      <div style={{ borderBottom: "1px solid rgba(245, 158, 11, 0.25)", paddingBottom: "10px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#f59e0b",
                boxShadow: "0 0 8px #f59e0b",
                display: "inline-block",
              }}
            />
            <span
              className="font-mono"
              style={{
                fontSize: "10px",
                color: "#fbbf24",
                letterSpacing: "0.14em",
                fontWeight: 700,
                textTransform: "uppercase",
              }}
            >
              KERR SPACETIME METRIC // ACTIVE
            </span>
          </div>
          <span
            className="font-mono"
            style={{
              fontSize: "10px",
              padding: "2px 6px",
              backgroundColor: "rgba(245, 158, 11, 0.2)",
              border: "1px solid rgba(245, 158, 11, 0.4)",
              color: "#fef08a",
              borderRadius: "2px",
            }}
          >
            a* = 0.998
          </span>
        </div>

        <h2 style={{ fontSize: "16px", fontWeight: 700, letterSpacing: "-0.01em", color: "#fffbeb", margin: 0 }}>
          GARGANTUA ASTRODYNAMICS
        </h2>
        <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "2px" }}>
          Supermassive Kerr Black Hole · Gravitational Lensing Inspector
        </div>
      </div>

      {/* Physics Telemetry Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
        {/* Metric 1: Mass */}
        <div
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            borderRadius: "4px",
            padding: "8px 10px",
          }}
        >
          <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>Singularity Mass</div>
          <div className="font-mono" style={{ fontSize: "14px", fontWeight: 700, color: "#fef08a" }}>
            1.00 × 10⁸ M☉
          </div>
          <div style={{ fontSize: "9px", color: "#64748b" }}>1.989 × 10³⁸ kg</div>
        </div>

        {/* Metric 2: Spin Parameter */}
        <div
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            borderRadius: "4px",
            padding: "8px 10px",
          }}
        >
          <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>Spin Parameter</div>
          <div className="font-mono" style={{ fontSize: "14px", fontWeight: 700, color: "#38bdf8" }}>
            a* = 0.9980
          </div>
          <div style={{ fontSize: "9px", color: "#64748b" }}>Near-Thorne Limit</div>
        </div>

        {/* Metric 3: Schwarzschild Radius */}
        <div
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            borderRadius: "4px",
            padding: "8px 10px",
          }}
        >
          <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>Horizon Radius (Rs)</div>
          <div className="font-mono" style={{ fontSize: "14px", fontWeight: 700, color: "#f87171" }}>
            2.95 × 10⁸ km
          </div>
          <div style={{ fontSize: "9px", color: "#64748b" }}>1.97 AU (Solar Dist)</div>
        </div>

        {/* Metric 4: Time Dilation */}
        <div
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            borderRadius: "4px",
            padding: "8px 10px",
          }}
        >
          <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>Time Dilation (γ)</div>
          <div className="font-mono" style={{ fontSize: "14px", fontWeight: 700, color: "#4ade80" }}>
            61,320 ×
          </div>
          <div style={{ fontSize: "9px", color: "#64748b" }}>1 hr = 7 Earth Yrs</div>
        </div>

        {/* Metric 5: Peak Accretion Temp */}
        <div
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            borderRadius: "4px",
            padding: "8px 10px",
          }}
        >
          <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>Disk Peak Temp</div>
          <div className="font-mono" style={{ fontSize: "14px", fontWeight: 700, color: "#fb923c" }}>
            8.50 × 10⁶ K
          </div>
          <div style={{ fontSize: "9px", color: "#64748b" }}>Soft X-Ray Emission</div>
        </div>

        {/* Metric 6: ISCO Boundary */}
        <div
          style={{
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            border: "1px solid rgba(245, 158, 11, 0.2)",
            borderRadius: "4px",
            padding: "8px 10px",
          }}
        >
          <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>ISCO Prograde</div>
          <div className="font-mono" style={{ fontSize: "14px", fontWeight: 700, color: "#a78bfa" }}>
            1.24 Rs
          </div>
          <div style={{ fontSize: "9px", color: "#64748b" }}>Innermost Orbit</div>
        </div>
      </div>

      {/* Relativistic Interactive Controls */}
      <div
        style={{
          borderTop: "1px solid rgba(245, 158, 11, 0.25)",
          paddingTop: "10px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <div style={{ fontSize: "11px", fontWeight: 700, color: "#fbbf24", letterSpacing: "0.05em" }}>
          RELATIVISTIC SIMULATION CONTROLS
        </div>

        {/* Toggle 1: Doppler Beaming */}
        <button
          onClick={onToggleDoppler}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 12px",
            backgroundColor: dopplerEnabled ? "rgba(245, 158, 11, 0.2)" : "rgba(30, 41, 59, 0.4)",
            border: dopplerEnabled ? "1px solid #f59e0b" : "1px solid rgba(148, 163, 184, 0.2)",
            borderRadius: "4px",
            cursor: "pointer",
            color: "#f8fafc",
            fontSize: "11px",
            fontWeight: 600,
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span>Doppler Relativistic Beaming</span>
            <span style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 400 }}>
              Approaching blueshift / Receding redshift
            </span>
          </div>
          <span
            className="font-mono"
            style={{
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "2px",
              backgroundColor: dopplerEnabled ? "#f59e0b" : "rgba(100, 116, 139, 0.3)",
              color: dopplerEnabled ? "#000000" : "#94a3b8",
              fontWeight: 700,
            }}
          >
            {dopplerEnabled ? "ENABLED" : "DISABLED"}
          </span>
        </button>

        {/* Toggle 2: Relativistic Jets */}
        <button
          onClick={onToggleJets}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 12px",
            backgroundColor: jetsEnabled ? "rgba(56, 189, 248, 0.2)" : "rgba(30, 41, 59, 0.4)",
            border: jetsEnabled ? "1px solid #38bdf8" : "1px solid rgba(148, 163, 184, 0.2)",
            borderRadius: "4px",
            cursor: "pointer",
            color: "#f8fafc",
            fontSize: "11px",
            fontWeight: 600,
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span>Bipolar Synchrotron Jets</span>
            <span style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 400 }}>
              Magnetic helical collimation along spin axis
            </span>
          </div>
          <span
            className="font-mono"
            style={{
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "2px",
              backgroundColor: jetsEnabled ? "#38bdf8" : "rgba(100, 116, 139, 0.3)",
              color: jetsEnabled ? "#000000" : "#94a3b8",
              fontWeight: 700,
            }}
          >
            {jetsEnabled ? "ACTIVE" : "STANDBY"}
          </span>
        </button>

        {/* Toggle 3: Particle Swarm */}
        <button
          onClick={onToggleParticles}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "8px 12px",
            backgroundColor: particlesEnabled ? "rgba(74, 222, 128, 0.2)" : "rgba(30, 41, 59, 0.4)",
            border: particlesEnabled ? "1px solid #4ade80" : "1px solid rgba(148, 163, 184, 0.2)",
            borderRadius: "4px",
            cursor: "pointer",
            color: "#f8fafc",
            fontSize: "11px",
            fontWeight: 600,
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <span>Keplerian Dust Particle Swarm</span>
            <span style={{ fontSize: "9px", color: "#94a3b8", fontWeight: 400 }}>
              2,800 relativistic particulate tracers
            </span>
          </div>
          <span
            className="font-mono"
            style={{
              fontSize: "10px",
              padding: "2px 6px",
              borderRadius: "2px",
              backgroundColor: particlesEnabled ? "#4ade80" : "rgba(100, 116, 139, 0.3)",
              color: particlesEnabled ? "#000000" : "#94a3b8",
              fontWeight: 700,
            }}
          >
            {particlesEnabled ? "ONLINE" : "OFFLINE"}
          </span>
        </button>
      </div>

      {/* Relativistic Physics Explanatory Card */}
      <div
        style={{
          borderTop: "1px solid rgba(245, 158, 11, 0.25)",
          paddingTop: "10px",
          fontSize: "10px",
          color: "#cbd5e1",
          lineHeight: "1.45",
          display: "flex",
          flexDirection: "column",
          gap: "6px",
        }}
      >
        <div style={{ fontWeight: 700, color: "#fef08a" }}>KIP THORNE RELATIVISTIC OPTICS:</div>
        <div>
          • <strong>Gravitational Lensing:</strong> Spacetime curvature bends light from the rear accretion disk into upper and lower Einstein warped arcs.
        </div>
        <div>
          • <strong>Doppler Asymmetry:</strong> Relativistic beaming dramatically intensifies plasma moving towards observer (0.55c) while dimming receding matter.
        </div>
      </div>
    </aside>
  );
}
