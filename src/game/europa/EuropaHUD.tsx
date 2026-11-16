"use client";

import React from "react";
import { type EuropaAct } from "./EuropaScene";

interface EuropaHUDProps {
  act: EuropaAct;
  radiationFluxRads: number;
  shieldAlignmentPercent: number;
  altitudeMeters: number;
  isLanded: boolean;
  reactorPowerPercent: number;
  meltDepthMeters: number;
  subDepthMeters: number;
  hydrostaticPressureMpa: number;
  waterTempCelsius: number;
  sonarDistanceMeters: number;
  isSampling: boolean;
  sampleCollected: boolean;
  shannonEntropyBits: number;
  carbonRatio: number;
  score: number;
  onIgniteLanding: () => void;
  onProceedToAct2: () => void;
  onThrottleReactor: (delta: number) => void;
  onEvadeMethane: (direction: number) => void;
  onProceedToAct3: () => void;
  onFireSonar: () => void;
  onMoveSub: (x: number, y: number, z: number) => void;
  onProceedToAct4: () => void;
  onExtractSample: () => void;
  onReturnToHub: () => void;
}

export default function EuropaHUD({
  act,
  radiationFluxRads,
  shieldAlignmentPercent,
  altitudeMeters,
  isLanded,
  reactorPowerPercent,
  meltDepthMeters,
  subDepthMeters,
  hydrostaticPressureMpa,
  waterTempCelsius,
  sonarDistanceMeters,
  isSampling,
  sampleCollected,
  shannonEntropyBits,
  carbonRatio,
  score,
  onIgniteLanding,
  onProceedToAct2,
  onThrottleReactor,
  onEvadeMethane,
  onProceedToAct3,
  onFireSonar,
  onMoveSub,
  onProceedToAct4,
  onExtractSample,
  onReturnToHub,
}: EuropaHUDProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "16px 24px",
        boxSizing: "border-box",
        fontFamily: "var(--font-mono, monospace)",
      }}
    >
      {/* TOP HEADER: Mission Stepper & Science Score */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "rgba(10, 15, 26, 0.92)",
          border: "1px solid rgba(56, 189, 248, 0.3)",
          borderRadius: "4px",
          padding: "10px 18px",
          backdropFilter: "blur(8px)",
          pointerEvents: "auto",
        }}
      >
        <div>
          <div style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 700, letterSpacing: "0.08em" }}>
            NASA ASTROBIOLOGY &amp; OCEAN WORLDS // PROJECT EUROPA
          </div>
          <div style={{ fontSize: "14px", color: "#f8fafc", fontWeight: 800, letterSpacing: "0.04em", marginTop: "2px" }}>
            SUBTERRANEAN OCEAN EXPLORATION // ABYSS OF JUPITER
          </div>
        </div>

        {/* 4-Act Campaign Stepper */}
        <div style={{ display: "flex", gap: "8px" }}>
          {[
            { id: "ACT_1_SURFACE_DESCENT", label: "[I] JOVIAN DESCENT" },
            { id: "ACT_2_CRYO_MELT", label: "[II] 900°C CRYO-MELT" },
            { id: "ACT_3_ABYSSAL_SUB", label: "[III] 130 MPa SUB" },
            { id: "ACT_4_SAMPLE_DISCOVERY", label: "[IV] ALIEN RNA" },
          ].map((step, idx) => {
            const isActive = act === step.id;
            return (
              <div
                key={`stepper-${idx}`}
                style={{
                  padding: "5px 10px",
                  fontSize: "10px",
                  fontWeight: 700,
                  borderRadius: "2px",
                  backgroundColor: isActive ? "rgba(14, 165, 233, 0.25)" : "rgba(30, 41, 59, 0.6)",
                  border: isActive ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.1)",
                  color: isActive ? "#38bdf8" : "#94a3b8",
                }}
              >
                {step.label}
              </div>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "10px", color: "#94a3b8" }}>EXPEDITION SCORE</div>
            <div style={{ fontSize: "13px", color: "#10b981", fontWeight: 700 }}>
              {score.toLocaleString()} PTS
            </div>
          </div>
          <button
            onClick={onReturnToHub}
            style={{
              padding: "6px 12px",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              border: "1px solid #ef4444",
              color: "#f87171",
              fontSize: "10px",
              fontWeight: 700,
              cursor: "pointer",
              borderRadius: "3px",
            }}
          >
            ABORT TO HUB
          </button>
        </div>
      </header>

      {/* CENTER HUD: Act-Specific Mission Cockpit Controls */}
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", pointerEvents: "auto" }}>
        {/* ACT I: JOVIAN RADIATION DESCENT */}
        {act === "ACT_1_SURFACE_DESCENT" && (
          <div
            style={{
              backgroundColor: "rgba(10, 15, 26, 0.94)",
              border: "1.5px solid #38bdf8",
              borderRadius: "6px",
              padding: "18px 24px",
              maxWidth: "520px",
              textAlign: "center",
              boxShadow: "0 0 25px rgba(56, 189, 248, 0.2)",
            }}
          >
            <div style={{ fontSize: "11px", color: "#ef4444", fontWeight: 800 }}>
              JOVIAN RADIATION BELT: {radiationFluxRads.toFixed(0)} RADS/HR (CRITICAL)
            </div>
            <div style={{ fontSize: "12px", color: "#f8fafc", marginTop: "4px" }}>
              Orient lead-Kevlar shielding along Jovian magnetic flux tubes ({shieldAlignmentPercent.toFixed(1)}% Aligned).
            </div>
            <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>
              Radar Altitude: {altitudeMeters.toFixed(1)} m · Hazard: 15m Cryogenic Penitentes Spikes
            </div>

            <div style={{ marginTop: "14px", display: "flex", gap: "10px", justifyContent: "center" }}>
              {!isLanded ? (
                <button
                  onClick={onIgniteLanding}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#0284c7",
                    border: "1px solid #38bdf8",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "11px",
                    cursor: "pointer",
                    borderRadius: "4px",
                  }}
                >
                  EXECUTE RETROGRADE TOUCHDOWN BURN [SPACE]
                </button>
              ) : (
                <button
                  onClick={onProceedToAct2}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#16a34a",
                    border: "1px solid #22c55e",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "11px",
                    cursor: "pointer",
                    borderRadius: "4px",
                  }}
                >
                  LANDING NOMINAL! DEPLOY 900°C CRYO-MELT PROBE →
                </button>
              )}
            </div>
          </div>
        )}

        {/* ACT II: 900°C NUCLEAR CRYO-MELT PROBE */}
        {act === "ACT_2_CRYO_MELT" && (
          <div
            style={{
              backgroundColor: "rgba(10, 15, 26, 0.94)",
              border: "1.5px solid #f97316",
              borderRadius: "6px",
              padding: "18px 24px",
              maxWidth: "540px",
              textAlign: "center",
              boxShadow: "0 0 25px rgba(249, 115, 22, 0.25)",
            }}
          >
            <div style={{ fontSize: "11px", color: "#f97316", fontWeight: 800 }}>
              NUCLEAR MELT PROBE // 900°C TUNGSTEN CORE ({reactorPowerPercent}% POWER)
            </div>
            <div style={{ fontSize: "13px", color: "#f8fafc", fontWeight: 700, marginTop: "4px" }}>
              Penetrating 20km Cryogenic Ice Crust · Rate: 80.4 m/hr
            </div>
            <div style={{ fontSize: "11px", color: "#38bdf8", marginTop: "4px" }}>
              Depth: {meltDepthMeters.toFixed(0)} m / 20,000 m ({( (meltDepthMeters / 20000) * 100 ).toFixed(1)}%)
            </div>

            <div style={{ marginTop: "12px", display: "flex", gap: "8px", justifyContent: "center" }}>
              <button
                onClick={() => onEvadeMethane(-1)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "rgba(30, 41, 59, 0.8)",
                  border: "1px solid #64748b",
                  color: "#f8fafc",
                  fontSize: "10px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                [A] EVADE PORT
              </button>
              <button
                onClick={() => onThrottleReactor(10)}
                style={{
                  padding: "8px 14px",
                  backgroundColor: "#ea580c",
                  border: "1px solid #f97316",
                  color: "#ffffff",
                  fontSize: "10px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                [W] MAX THERMAL PLUME
              </button>
              <button
                onClick={() => onEvadeMethane(1)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "rgba(30, 41, 59, 0.8)",
                  border: "1px solid #64748b",
                  color: "#f8fafc",
                  fontSize: "10px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                [D] EVADE STBD
              </button>
            </div>

            <div style={{ marginTop: "12px" }}>
              <button
                onClick={onProceedToAct3}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#0284c7",
                  border: "1px solid #38bdf8",
                  color: "#ffffff",
                  fontWeight: 700,
                  fontSize: "11px",
                  cursor: "pointer",
                  borderRadius: "4px",
                }}
              >
                BREACH OCEAN INTERFACE &amp; LAUNCH SUBMERSIBLE →
              </button>
            </div>
          </div>
        )}

        {/* ACT III: 6-DOF ABYSSAL SUBMERSIBLE */}
        {act === "ACT_3_ABYSSAL_SUB" && (
          <div
            style={{
              backgroundColor: "rgba(10, 15, 26, 0.94)",
              border: "1.5px solid #0284c7",
              borderRadius: "6px",
              padding: "16px 22px",
              maxWidth: "580px",
              textAlign: "center",
              boxShadow: "0 0 25px rgba(2, 132, 199, 0.25)",
            }}
          >
            <div style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 800 }}>
              ABYSSAL HYDRODYNAMICS // DEPTH: {subDepthMeters.toFixed(0)} M (130 MPa CRUSHING PRESSURE)
            </div>
            <div style={{ fontSize: "12px", color: "#f8fafc", marginTop: "4px" }}>
              Water Temp: {waterTempCelsius > 0 ? `+${waterTempCelsius.toFixed(1)}` : waterTempCelsius.toFixed(1)}°C · Sonar Target Distance: {sonarDistanceMeters.toFixed(1)} m
            </div>

            <div style={{ marginTop: "10px", display: "flex", gap: "8px", justifyContent: "center" }}>
              <button
                onClick={onFireSonar}
                style={{
                  padding: "8px 14px",
                  backgroundColor: "rgba(14, 165, 233, 0.25)",
                  border: "1px solid #38bdf8",
                  color: "#38bdf8",
                  fontSize: "10px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                PING ACTIVE 1200 HZ SONAR [SPACE]
              </button>
              <button
                onClick={() => onMoveSub(0, 0, -2.5)}
                style={{
                  padding: "8px 12px",
                  backgroundColor: "#0f172a",
                  border: "1px solid #475569",
                  color: "#f8fafc",
                  fontSize: "10px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                [W] THRUST AHEAD
              </button>
            </div>

            {sonarDistanceMeters <= 18.0 && (
              <div style={{ marginTop: "12px" }}>
                <button
                  onClick={onProceedToAct4}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#16a34a",
                    border: "1px solid #22c55e",
                    color: "#ffffff",
                    fontWeight: 700,
                    fontSize: "11px",
                    cursor: "pointer",
                    borderRadius: "4px",
                  }}
                >
                  HYDROTHERMAL CHIMNEY IN RANGE! DEPLOY SAMPLING CLAW →
                </button>
              </div>
            )}
          </div>
        )}

        {/* ACT IV: ASTROBIOLOGY SAMPLE & RNA DISCOVERY */}
        {act === "ACT_4_SAMPLE_DISCOVERY" && (
          <div
            style={{
              backgroundColor: "rgba(10, 15, 26, 0.95)",
              border: sampleCollected ? "1.5px solid #22c55e" : "1.5px solid #f59e0b",
              borderRadius: "6px",
              padding: "18px 26px",
              maxWidth: "580px",
              textAlign: "center",
              boxShadow: sampleCollected ? "0 0 30px rgba(34, 197, 94, 0.35)" : "0 0 25px rgba(245, 158, 11, 0.25)",
            }}
          >
            <div style={{ fontSize: "11px", color: sampleCollected ? "#22c55e" : "#f59e0b", fontWeight: 800 }}>
              {sampleCollected ? "EXTRATERRESTRIAL LIFE CONFIRMED // ALIEN RNA ANALOGS" : "ROBOTIC MANIPULATOR CLAW ONLINE"}
            </div>
            <div style={{ fontSize: "13px", color: "#f8fafc", fontWeight: 700, marginTop: "4px" }}>
              Hydrothermal Black Smoker Mineral Crust &amp; Bioluminescent Microbial Mat
            </div>

            {sampleCollected && (
              <div style={{ margin: "12px 0", backgroundColor: "rgba(22, 101, 52, 0.2)", border: "1px solid #22c55e", padding: "10px 14px", borderRadius: "4px" }}>
                <div style={{ fontSize: "11px", color: "#86efac", fontWeight: 700 }}>
                  MASS SPECTROMETER BIOGENIC CONFIRMATION:
                </div>
                <div style={{ fontSize: "10px", color: "#f8fafc", marginTop: "3px" }}>
                  δ¹³C Isotope Ratio: {carbonRatio.toFixed(1)}‰ (Organic Carbon Fractionation)
                </div>
                <div style={{ fontSize: "10px", color: "#38bdf8", marginTop: "2px" }}>
                  Ribosomal RNA Shannon Entropy: {shannonEntropyBits.toFixed(2)} bits/monomer (&gt;1.8 Threshold Met)
                </div>
              </div>
            )}

            <div style={{ marginTop: "14px" }}>
              {!sampleCollected ? (
                <button
                  onClick={onExtractSample}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#f59e0b",
                    border: "1px solid #fbbf24",
                    color: "#0f172a",
                    fontWeight: 800,
                    fontSize: "11px",
                    cursor: "pointer",
                    borderRadius: "4px",
                  }}
                >
                  EXTRACT MICROBIAL SAMPLE WITH ROBOTIC CLAW [SPACE]
                </button>
              ) : (
                <button
                  onClick={onReturnToHub}
                  style={{
                    padding: "12px 24px",
                    backgroundColor: "#16a34a",
                    border: "1px solid #22c55e",
                    color: "#ffffff",
                    fontWeight: 800,
                    fontSize: "12px",
                    cursor: "pointer",
                    borderRadius: "4px",
                    boxShadow: "0 0 20px rgba(34, 197, 94, 0.4)",
                  }}
                >
                  RECORD HISTORIC ASTROBIOLOGY DISCOVERY &amp; RETURN TO HUB →
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM FOOTER: Abyssal Telemetry Banner */}
      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "rgba(10, 15, 26, 0.88)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          borderRadius: "4px",
          padding: "8px 16px",
          fontSize: "10px",
          color: "#94a3b8",
        }}
      >
        <div>
          JPL OCEAN WORLDS LIFE SURVEYOR (OWLS) · HYDROSTATIC PRESSURE: {hydrostaticPressureMpa.toFixed(1)} MPa
        </div>
        <div>
          ACOUSTIC DRONE: 48 HZ · ACTIVE SONAR: 1200 HZ · XENON VOLUMETRICS: 60+ FPS
        </div>
      </footer>
    </div>
  );
}
