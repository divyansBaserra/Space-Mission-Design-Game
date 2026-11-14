import React from "react";
import { SpacecraftViewport } from "@/components/viewport";

export default function HomePage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        backgroundColor: "var(--color-canvas)",
      }}
    >
      {/* Flight Operations Header */}
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "var(--space-3) var(--space-6)",
          borderBottom: "1px solid var(--color-border-subtle)",
          backgroundColor: "var(--color-surface-1)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
          <span
            className="font-mono"
            style={{
              fontSize: "var(--text-xs)",
              color: "var(--color-status-telemetry)",
              fontWeight: 700,
              letterSpacing: "0.1em",
            }}
          >
            NASA // SPACE APPS 2026
          </span>
          <div
            style={{
              width: "1px",
              height: "14px",
              backgroundColor: "var(--color-border-default)",
            }}
          />
          <h1 style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>
            Space Mission Design Game
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <span className="badge-status badge-nominal">
            <span
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                backgroundColor: "var(--color-status-nominal)",
              }}
            />
            ENGINE FOUNDATION READY
          </span>
          <span
            className="font-mono"
            style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}
          >
            VER 0.1.0-PHASE1
          </span>
        </div>
      </header>

      {/* Main Workspace Split Layout */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "360px 1fr",
          flex: 1,
          overflow: "hidden",
        }}
      >
        {/* Left Engineering Telemetry & Budget Rail */}
        <aside
          style={{
            borderRight: "1px solid var(--color-border-subtle)",
            backgroundColor: "var(--color-surface-1)",
            padding: "var(--space-5)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-5)",
            overflowY: "auto",
          }}
        >
          {/* Mission Specifications Panel */}
          <div className="panel">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "var(--space-3)",
              }}
            >
              <h2 style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Target Mission Profile
              </h2>
              <span className="badge-status badge-telemetry">LEO-SSO</span>
            </div>
            <div style={{ fontSize: "var(--text-md)", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "var(--space-1)" }}>
              Solar Corona & Earth Albedo
            </div>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
              Sun-synchronous 550 km orbit payload configuration. Primary target: continuous solar observing with 35-min eclipse period.
            </p>
          </div>

          {/* Subsystem Margins Panel (JPL CML 4 Compliance) */}
          <div className="panel">
            <h2
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "var(--space-3)",
              }}
            >
              CML 4 Engineering Margins
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
              {/* Dry Mass Margin */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", marginBottom: "4px" }}>
                  <span style={{ color: "var(--color-text-secondary)" }}>Dry Mass Margin</span>
                  <span className="font-mono" style={{ color: "var(--color-status-nominal)" }}>+38.2% (≥35%)</span>
                </div>
                <div style={{ width: "100%", height: "4px", backgroundColor: "var(--color-surface-3)", borderRadius: "2px" }}>
                  <div style={{ width: "76%", height: "100%", backgroundColor: "var(--color-status-nominal)", borderRadius: "2px" }} />
                </div>
              </div>

              {/* Power Margin */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", marginBottom: "4px" }}>
                  <span style={{ color: "var(--color-text-secondary)" }}>Power Margin</span>
                  <span className="font-mono" style={{ color: "var(--color-status-nominal)" }}>+41.5% (≥35%)</span>
                </div>
                <div style={{ width: "100%", height: "4px", backgroundColor: "var(--color-surface-3)", borderRadius: "2px" }}>
                  <div style={{ width: "83%", height: "100%", backgroundColor: "var(--color-status-nominal)", borderRadius: "2px" }} />
                </div>
              </div>

              {/* RF Link Margin */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", marginBottom: "4px" }}>
                  <span style={{ color: "var(--color-text-secondary)" }}>S-Band Link Margin</span>
                  <span className="font-mono" style={{ color: "var(--color-status-nominal)" }}>+8.4 dB (≥6dB)</span>
                </div>
                <div style={{ width: "100%", height: "4px", backgroundColor: "var(--color-surface-3)", borderRadius: "2px" }}>
                  <div style={{ width: "70%", height: "100%", backgroundColor: "var(--color-status-nominal)", borderRadius: "2px" }} />
                </div>
              </div>

              {/* Inhibit Timer Rule */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "var(--text-xs)", marginBottom: "4px" }}>
                  <span style={{ color: "var(--color-text-secondary)" }}>RF Inhibit Delay</span>
                  <span className="font-mono" style={{ color: "var(--color-text-primary)" }}>45.0 min (VERIFIED)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Master Equipment List Summary */}
          <div className="panel" style={{ flex: 1 }}>
            <h2
              style={{
                fontSize: "var(--text-xs)",
                color: "var(--color-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.08em",
                marginBottom: "var(--space-3)",
              }}
            >
              Master Equipment List (MEL)
            </h2>
            <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--text-xs)" }}>
              <li style={{ display: "flex", justifyContent: "space-between", color: "var(--color-text-secondary)" }}>
                <span>Structure: 3U Al 6061-T6 Chassis</span>
                <span className="font-mono">0.85 kg</span>
              </li>
              <li style={{ display: "flex", justifyContent: "space-between", color: "var(--color-text-secondary)" }}>
                <span>EPS: Deployable Triple-Junction PV</span>
                <span className="font-mono">0.42 kg</span>
              </li>
              <li style={{ display: "flex", justifyContent: "space-between", color: "var(--color-text-secondary)" }}>
                <span>Battery: 40 Wh Li-Ion (UL 1642)</span>
                <span className="font-mono">0.38 kg</span>
              </li>
              <li style={{ display: "flex", justifyContent: "space-between", color: "var(--color-text-secondary)" }}>
                <span>ADCS: 3-Axis Reaction Wheels + ST</span>
                <span className="font-mono">0.55 kg</span>
              </li>
              <li style={{ display: "flex", justifyContent: "space-between", color: "var(--color-text-secondary)" }}>
                <span>Comm: S-Band Transceiver + Patch</span>
                <span className="font-mono">0.24 kg</span>
              </li>
              <li style={{ display: "flex", justifyContent: "space-between", color: "var(--color-text-secondary)" }}>
                <span>Payload: Multispectral UV/IR Imager</span>
                <span className="font-mono">0.60 kg</span>
              </li>
            </ul>
          </div>
        </aside>

        {/* Right 3D Engineering Viewport */}
        <section
          style={{
            position: "relative",
            width: "100%",
            height: "100%",
            backgroundColor: "var(--color-surface-sunken)",
          }}
        >
          {/* Viewport Overlay Controls */}
          <div
            style={{
              position: "absolute",
              top: "var(--space-4)",
              left: "var(--space-4)",
              zIndex: 10,
              display: "flex",
              alignItems: "center",
              gap: "var(--space-3)",
            }}
          >
            <div className="badge-status badge-telemetry">
              VIEWPORT // 3U CHASSIS REALTIME R3F
            </div>
            <span
              className="font-mono"
              style={{ fontSize: "var(--text-xs)", color: "var(--color-text-muted)" }}
            >
              [ORBIT: DRAG TO ROTATE // SCROLL TO ZOOM]
            </span>
          </div>

          {/* Three.js / R3F Canvas */}
          <SpacecraftViewport busSize="3U" />

          {/* Bottom Telemetry Ticker */}
          <div
            style={{
              position: "absolute",
              bottom: 0,
              left: 0,
              right: 0,
              padding: "var(--space-2) var(--space-4)",
              borderTop: "1px solid var(--color-border-subtle)",
              backgroundColor: "rgba(11, 14, 20, 0.85)",
              backdropFilter: "blur(8px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              fontSize: "var(--text-xs)",
              color: "var(--color-text-secondary)",
            }}
          >
            <div className="font-mono" style={{ display: "flex", gap: "var(--space-6)" }}>
              <span>MET: 00:00:00</span>
              <span>ALT: 550.0 KM</span>
              <span>VEL: 7.59 KM/S</span>
              <span>BATT: 100.0% (NOMINAL)</span>
            </div>
            <div className="font-mono" style={{ color: "var(--color-text-muted)" }}>
              RENDER: WEBGL 2.0 // PURE THREE.JS
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
