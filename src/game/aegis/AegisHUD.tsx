"use client";

import React from "react";
import { AegisAct } from "./AegisScene";
import { DIDYMOS_SYSTEM } from "./aegisMath";

export interface AegisHUDProps {
  currentAct: AegisAct;
  velocityKms: number;
  distanceKm: number;
  lateralOffsetX: number;
  lateralOffsetY: number;
  omegaLosMagnitude: number;
  isSmartNavLocked: boolean;
  impactTriggered: boolean;
  cepDistanceM: number;
  isWithinCep: boolean;
  periodShiftMinutes: number;
  planetaryDefenseConfirmed: boolean;
  burnThrottle: number;
  score: number;
  onIgniteOberthBurn: () => void;
  onEngageSmartNav: () => void;
  onFireRcs: (dirX: number, dirY: number) => void;
  onNextAct: () => void;
  onReturnToHub: () => void;
}

export function AegisHUD({
  currentAct,
  velocityKms,
  distanceKm,
  lateralOffsetX,
  lateralOffsetY,
  omegaLosMagnitude,
  isSmartNavLocked,
  impactTriggered,
  cepDistanceM,
  isWithinCep,
  periodShiftMinutes,
  planetaryDefenseConfirmed,
  burnThrottle,
  score,
  onIgniteOberthBurn,
  onEngageSmartNav,
  onFireRcs,
  onNextAct,
  onReturnToHub,
}: AegisHUDProps) {
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 10, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "16px 20px" }}>
      {/* ------------------------------------------------------------------ */}
      {/* TOP BAR: Mission Banner & Act Progress                             */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", pointerEvents: "auto" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#f59e0b", boxShadow: "0 0 10px #f59e0b" }} />
            <span className="font-mono" style={{ fontSize: "11px", fontWeight: 700, color: "#f59e0b", letterSpacing: "0.12em", textTransform: "uppercase" }}>
              NASA Planetary Defense Coordination // Project Aegis (DART-II)
            </span>
          </div>
          <h1 style={{ fontSize: "18px", fontWeight: 800, color: "#ffffff", letterSpacing: "-0.01em", marginTop: "2px" }}>
            HYPERVELOCITY ASTEROID DEFLECTION // TARGET: 2032-XK DIDYMOS
          </h1>
        </div>

        {/* Acts Stepper */}
        <div style={{ display: "flex", gap: "4px", backgroundColor: "rgba(10, 15, 26, 0.92)", border: "1px solid rgba(245, 158, 11, 0.3)", padding: "4px 8px", borderRadius: "4px", backdropFilter: "blur(8px)" }}>
          {[
            { id: "ACT_I_MARS_OBERTH", num: "I", label: "MARS OBERTH" },
            { id: "ACT_II_SMART_NAV", num: "II", label: "SMART NAV LOCK" },
            { id: "ACT_III_TERMINAL_RUN", num: "III", label: "6.2 KM/S IMPACT" },
            { id: "ACT_IV_LICIACUBE", num: "IV", label: "LICIACUBE DEFLECTION" },
          ].map((act) => {
            const isActive = currentAct === act.id;
            return (
              <div
                key={act.id}
                style={{
                  padding: "4px 10px",
                  borderRadius: "3px",
                  backgroundColor: isActive ? "rgba(245, 158, 11, 0.25)" : "transparent",
                  border: isActive ? "1px solid #f59e0b" : "1px solid transparent",
                  color: isActive ? "#fbbf24" : "#64748b",
                  fontSize: "10px",
                  fontWeight: 700,
                  fontFamily: "var(--font-mono)",
                }}
              >
                [{act.num}] {act.label}
              </div>
            );
          })}
        </div>

        {/* Score & Hub Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ backgroundColor: "rgba(10, 15, 26, 0.9)", border: "1px solid rgba(255,255,255,0.15)", padding: "5px 12px", borderRadius: "3px", fontSize: "11px" }}>
            <span style={{ color: "#94a3b8" }}>DEFENSE SCORE: </span>
            <span className="font-mono" style={{ color: "#22c55e", fontWeight: 700 }}>{score} PTS</span>
          </div>
          <button
            onClick={onReturnToHub}
            style={{
              padding: "6px 14px",
              backgroundColor: "rgba(30, 41, 59, 0.8)",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#cbd5e1",
              fontSize: "11px",
              fontWeight: 700,
              borderRadius: "3px",
              cursor: "pointer",
            }}
          >
            ← HUB
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* CENTER CLUSTERS: Context-Sensitive Action Canvas                   */}
      {/* ------------------------------------------------------------------ */}

      {/* ACT I: Mars Oberth Slingshot Controls */}
      {currentAct === "ACT_I_MARS_OBERTH" && (
        <div style={{ alignSelf: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "12px", pointerEvents: "auto", backgroundColor: "rgba(10, 15, 26, 0.92)", border: "1.5px solid #f59e0b", padding: "18px 24px", borderRadius: "6px", backdropFilter: "blur(12px)", boxShadow: "0 0 30px rgba(0,0,0,0.8)", maxWidth: "540px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "#f59e0b", fontWeight: 700, letterSpacing: "0.08em" }}>
              ACT I: MARS PERIAPSIS OBERTH MANEUVER (180 KM ALTITUDE)
            </div>
            <div style={{ fontSize: "13px", color: "#f8fafc", fontWeight: 600, marginTop: "4px" }}>
              Deep potential well gravity assist. Delta-V amplified via Oberth formula:
            </div>
            <div className="font-mono" style={{ fontSize: "11px", color: "#38bdf8", marginTop: "4px", backgroundColor: "rgba(15, 23, 42, 0.8)", padding: "4px 8px", borderRadius: "3px" }}>
              v_hyp² = v_burn² + 2·μ_mars / r_periapsis ➔ Target: 11.4 km/s
            </div>
          </div>

          <div style={{ display: "flex", gap: "16px", alignItems: "center", width: "100%", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontSize: "10px", color: "#94a3b8" }}>EGRESS VELOCITY:</div>
              <div className="font-mono" style={{ fontSize: "20px", fontWeight: 800, color: velocityKms >= 11.3 ? "#22c55e" : "#f59e0b" }}>
                {velocityKms.toFixed(1)} km/s
              </div>
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "#94a3b8" }}>BURN THROTTLE:</div>
              <div className="font-mono" style={{ fontSize: "20px", fontWeight: 800, color: "#38bdf8" }}>
                {(burnThrottle * 100).toFixed(0)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: "10px", color: "#94a3b8" }}>PERIAPSIS:</div>
              <div className="font-mono" style={{ fontSize: "20px", fontWeight: 800, color: "#f8fafc" }}>
                180.0 km
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", width: "100%" }}>
            <button
              onClick={onIgniteOberthBurn}
              style={{
                flex: 1,
                padding: "12px",
                backgroundColor: burnThrottle > 0 ? "rgba(220, 38, 38, 0.85)" : "#0284c7",
                border: `1.5px solid ${burnThrottle > 0 ? "#ef4444" : "#38bdf8"}`,
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 800,
                borderRadius: "4px",
                cursor: "pointer",
                boxShadow: "0 0 16px rgba(56, 189, 248, 0.35)",
                letterSpacing: "0.05em",
              }}
            >
              {burnThrottle > 0 ? "🔥 THRUSTER FIRING (OBERTH ENGAGED)" : "IGNITE RETROGRADE OBERTH BURN [SPACE]"}
            </button>
            {velocityKms >= 11.3 && (
              <button
                onClick={onNextAct}
                style={{
                  padding: "12px 18px",
                  backgroundColor: "#15803d",
                  border: "1.5px solid #22c55e",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 800,
                  borderRadius: "4px",
                  cursor: "pointer",
                  boxShadow: "0 0 16px rgba(34, 197, 94, 0.4)",
                  letterSpacing: "0.05em",
                }}
              >
                PROCEED TO ACT II →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ACT II: Autonomous SMART Nav Lock */}
      {currentAct === "ACT_II_SMART_NAV" && (
        <div style={{ alignSelf: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", pointerEvents: "auto", backgroundColor: "rgba(10, 15, 26, 0.94)", border: "1.5px solid #38bdf8", padding: "16px 22px", borderRadius: "6px", backdropFilter: "blur(12px)", boxShadow: "0 0 30px rgba(0,0,0,0.8)", maxWidth: "560px" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "11px", color: "#ef4444", fontWeight: 700, letterSpacing: "0.08em" }}>
              LIGHTSPEED COMMUNICATION LATENCY: 14.0 MINUTES (28-MIN ROUNDTRIP)
            </div>
            <div style={{ fontSize: "12px", color: "#f8fafc", fontWeight: 600, marginTop: "2px" }}>
              Earth joystick control impossible. Engage autonomous optical SMART Nav guidance:
            </div>
            <div className="font-mono" style={{ fontSize: "10px", color: "#38bdf8", marginTop: "4px" }}>
              ω_los = (r × v) / |r|² · a_cmd = N · v_closing · ω_los (N = 3.5)
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", width: "100%", padding: "8px 0" }}>
            <div style={{ backgroundColor: "rgba(15, 23, 42, 0.8)", padding: "8px", borderRadius: "3px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "#94a3b8" }}>TARGET DISTANCE:</div>
              <div className="font-mono" style={{ fontSize: "16px", fontWeight: 800, color: "#f8fafc" }}>
                {distanceKm.toFixed(1)} km
              </div>
            </div>
            <div style={{ backgroundColor: "rgba(15, 23, 42, 0.8)", padding: "8px", borderRadius: "3px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "#94a3b8" }}>LOS DRIFT RATE:</div>
              <div className="font-mono" style={{ fontSize: "16px", fontWeight: 800, color: omegaLosMagnitude < 0.05 ? "#22c55e" : "#f59e0b" }}>
                {omegaLosMagnitude.toFixed(4)} rad/s
              </div>
            </div>
            <div style={{ backgroundColor: "rgba(15, 23, 42, 0.8)", padding: "8px", borderRadius: "3px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "#94a3b8" }}>LOCK STATUS:</div>
              <div className="font-mono" style={{ fontSize: "14px", fontWeight: 800, color: isSmartNavLocked ? "#22c55e" : "#fbbf24" }}>
                {isSmartNavLocked ? "SMART NAV LOCKED" : "ACQUIRING..."}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", gap: "10px", width: "100%" }}>
            <button
              onClick={onEngageSmartNav}
              style={{
                flex: 1,
                padding: "10px",
                backgroundColor: isSmartNavLocked ? "rgba(34, 197, 94, 0.3)" : "#0284c7",
                border: `1.5px solid ${isSmartNavLocked ? "#22c55e" : "#38bdf8"}`,
                color: "#ffffff",
                fontSize: "12px",
                fontWeight: 800,
                borderRadius: "4px",
                cursor: "pointer",
                letterSpacing: "0.05em",
              }}
            >
              {isSmartNavLocked ? "AUTONOMOUS GUIDANCE ACTIVE [LOCKED]" : "ENGAGE SMART NAV GUIDANCE [E]"}
            </button>
            {isSmartNavLocked && (
              <button
                onClick={onNextAct}
                style={{
                  padding: "10px 18px",
                  backgroundColor: "#15803d",
                  border: "1.5px solid #22c55e",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 800,
                  borderRadius: "4px",
                  cursor: "pointer",
                  letterSpacing: "0.05em",
                }}
              >
                TERMINAL IMPACT RUN →
              </button>
            )}
          </div>
        </div>
      )}

      {/* ACT III: Terminal 6.2 km/s Kinetic Impact Run */}
      {currentAct === "ACT_III_TERMINAL_RUN" && !impactTriggered && (
        <div style={{ alignSelf: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "8px", pointerEvents: "auto" }}>
          {/* Target Reticle Crosshair HUD */}
          <div
            style={{
              width: "220px",
              height: "220px",
              border: `2px dashed ${isWithinCep ? "#22c55e" : "#f59e0b"}`,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              position: "relative",
              boxShadow: `0 0 25px ${isWithinCep ? "rgba(34, 197, 94, 0.4)" : "rgba(245, 158, 11, 0.3)"}`,
            }}
          >
            {/* Center target dot */}
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "50%",
                backgroundColor: isWithinCep ? "#22c55e" : "#ef4444",
                transform: `translate(${lateralOffsetX * 18}px, ${lateralOffsetY * 18}px)`,
                boxShadow: "0 0 10px currentColor",
                transition: "transform 0.05s linear",
              }}
            />
            {/* 3-meter CEP Circle */}
            <div style={{ position: "absolute", width: "60px", height: "60px", border: "1px solid #38bdf8", borderRadius: "50%" }} />
            <span style={{ position: "absolute", bottom: "14px", fontSize: "10px", color: "#38bdf8", fontFamily: "var(--font-mono)" }}>
              3M CEP
            </span>
          </div>

          {/* Lateral Offset Status */}
          <div style={{ display: "flex", gap: "14px", backgroundColor: "rgba(10, 15, 26, 0.9)", padding: "6px 14px", borderRadius: "4px", border: "1px solid rgba(255,255,255,0.15)" }}>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
              CEP DISTANCE: <strong className="font-mono" style={{ color: isWithinCep ? "#22c55e" : "#f59e0b" }}>{cepDistanceM.toFixed(2)} m</strong>
            </span>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
              CLOSING: <strong className="font-mono" style={{ color: "#ef4444" }}>6,200 m/s</strong>
            </span>
          </div>

          {/* Micro-thruster Steering Pad */}
          <div style={{ display: "flex", gap: "4px" }}>
            <button onClick={() => onFireRcs(-1, 0)} style={{ padding: "8px 14px", backgroundColor: "rgba(15, 23, 42, 0.85)", border: "1px solid #38bdf8", color: "#38bdf8", fontWeight: 700, fontSize: "11px", cursor: "pointer" }}>
              [A] LEFT
            </button>
            <button onClick={() => onFireRcs(0, -1)} style={{ padding: "8px 14px", backgroundColor: "rgba(15, 23, 42, 0.85)", border: "1px solid #38bdf8", color: "#38bdf8", fontWeight: 700, fontSize: "11px", cursor: "pointer" }}>
              [W] PITCH UP
            </button>
            <button onClick={() => onFireRcs(0, 1)} style={{ padding: "8px 14px", backgroundColor: "rgba(15, 23, 42, 0.85)", border: "1px solid #38bdf8", color: "#38bdf8", fontWeight: 700, fontSize: "11px", cursor: "pointer" }}>
              [S] PITCH DOWN
            </button>
            <button onClick={() => onFireRcs(1, 0)} style={{ padding: "8px 14px", backgroundColor: "rgba(15, 23, 42, 0.85)", border: "1px solid #38bdf8", color: "#38bdf8", fontWeight: 700, fontSize: "11px", cursor: "pointer" }}>
              [D] RIGHT
            </button>
          </div>
        </div>
      )}

      {/* ACT IV: LICIACube Perspective & Deflection Victory */}
      {currentAct === "ACT_IV_LICIACUBE" && (
        <div style={{ alignSelf: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", pointerEvents: "auto", backgroundColor: "rgba(10, 15, 26, 0.95)", border: "2px solid #22c55e", padding: "18px 24px", borderRadius: "6px", backdropFilter: "blur(14px)", boxShadow: "0 0 35px rgba(34, 197, 94, 0.35)", maxWidth: "580px" }}>
          <div style={{ textAlign: "center" }}>
            <span style={{ fontSize: "11px", color: "#22c55e", fontWeight: 800, letterSpacing: "0.1em" }}>
              LICIACUBE BEACON ACTIVE // DOPPLER RADAR CONFIRMED
            </span>
            <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#ffffff", marginTop: "2px" }}>
              PLANETARY DEFENSE SUCCESS: ASTEROID DEFLECTED!
            </h2>
            <div style={{ fontSize: "12px", color: "#cbd5e1", marginTop: "4px", lineHeight: 1.4 }}>
              Kinetic impactor Aegis-IV successfully intercepted Dimorphos inside 3m CEP. Expanding ejecta momentum multiplication confirmed (β = 3.6).
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", width: "100%", padding: "8px 0" }}>
            <div style={{ backgroundColor: "rgba(15, 23, 42, 0.85)", border: "1px solid rgba(34, 197, 94, 0.3)", padding: "10px", borderRadius: "4px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "#94a3b8" }}>ORBIT PERIOD SHIFT:</div>
              <div className="font-mono" style={{ fontSize: "22px", fontWeight: 800, color: "#22c55e" }}>
                -{periodShiftMinutes.toFixed(1)} MIN
              </div>
              <div style={{ fontSize: "10px", color: "#94a3b8" }}>NASA Threshold: &gt;73 seconds</div>
            </div>

            <div style={{ backgroundColor: "rgba(15, 23, 42, 0.85)", border: "1px solid rgba(56, 189, 248, 0.3)", padding: "10px", borderRadius: "4px", textAlign: "center" }}>
              <div style={{ fontSize: "10px", color: "#94a3b8" }}>EARTH COLLISION PROBABILITY:</div>
              <div className="font-mono" style={{ fontSize: "22px", fontWeight: 800, color: "#38bdf8" }}>
                0.000%
              </div>
              <div style={{ fontSize: "10px", color: "#22c55e" }}>PERIGEE MISS DISTANCE: +14,800 KM</div>
            </div>
          </div>

          <button
            onClick={onReturnToHub}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: "#15803d",
              border: "1.5px solid #22c55e",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 800,
              borderRadius: "4px",
              cursor: "pointer",
              letterSpacing: "0.06em",
              boxShadow: "0 0 16px rgba(34, 197, 94, 0.4)",
            }}
          >
            RECORD PLANETARY DEFENSE VICTORY &amp; RETURN TO HUB →
          </button>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* BOTTOM TELEMETRY STRIP                                             */}
      {/* ------------------------------------------------------------------ */}
      <div style={{ backgroundColor: "rgba(10, 15, 26, 0.94)", border: "1px solid rgba(255,255,255,0.15)", padding: "8px 16px", borderRadius: "4px", display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "#94a3b8", backdropFilter: "blur(8px)" }}>
        <div className="font-mono" style={{ display: "flex", gap: "18px" }}>
          <span>TARGET: <strong style={{ color: "#f8fafc" }}>65803 DIDYMOS // DIMORPHOS</strong></span>
          <span>RANGE: <strong style={{ color: "#38bdf8" }}>{distanceKm.toFixed(1)} KM</strong></span>
          <span>VELOCITY: <strong style={{ color: "#fbbf24" }}>{velocityKms.toFixed(2)} KM/S</strong></span>
          <span>CLOSING RATE: <strong style={{ color: "#ef4444" }}>{DIDYMOS_SYSTEM.targetClosingVelocityKms} KM/S</strong></span>
        </div>
        <div className="font-mono" style={{ color: "#64748b" }}>
          DRACO OPTICAL BORESIGHT · LICIACUBE 6U COMPANION ACTIVE
        </div>
      </div>
    </div>
  );
}
