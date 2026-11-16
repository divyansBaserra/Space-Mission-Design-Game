"use client";

import React, { useState, useEffect } from "react";
import { GameState, InventoryItemId, GameSettings } from "./types";
import { soundManager } from "./audio";

interface HUDProps {
  gameState: GameState;
  isPointerLocked: boolean;
  showBriefingModal: boolean;
  onCloseBriefing: () => void;
  onRestartMission: () => void;
  onRequestPointerLock: () => void;
  onTogglePause?: () => void;
  onUpdateSettings?: (settings: Partial<GameSettings>) => void;
  onEquipItem?: (id: InventoryItemId) => void;
  onExitCockpit?: () => void;
  onManualDock?: () => void;
  onToggleCameraView?: () => void;
  onToggleLandingGear?: () => void;
  onReturnToHub?: () => void;
  onToggleFlashlight?: () => void;
  onToggleControlsOverlay?: () => void;
  onToggleSector?: () => void;
  onSelectFlightContract?: (contractId: string) => void;
  onInteractHangar?: (targetId: string) => void;
  onToggleMagBoots?: () => void;
  onRetetherToGantry?: () => void;
}

export function HUD({
  gameState,
  isPointerLocked,
  showBriefingModal,
  onCloseBriefing,
  onRestartMission,
  onRequestPointerLock,
  onTogglePause,
  onUpdateSettings,
  onEquipItem,
  onExitCockpit,
  onManualDock,
  onToggleCameraView,
  onToggleLandingGear,
  onReturnToHub,
  onToggleFlashlight,
  onToggleControlsOverlay,
  onToggleSector,
  onSelectFlightContract,
  onInteractHangar,
  onToggleMagBoots,
  onRetetherToGantry,
}: HUDProps) {
  const [hasEntered, setHasEntered] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedCampaignTab, setSelectedCampaignTab] = useState<"ARTEMIS" | "AEGIS" | "EUROPA">("ARTEMIS");

  useEffect(() => {
    if (isPointerLocked) {
      setHasEntered(true);
    }
  }, [isPointerLocked]);

  const handleEnter = (e: React.MouseEvent) => {
    e.stopPropagation();
    setHasEntered(true);
    onRequestPointerLock();
  };

  const formatMet = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const inventoryItems: { id: InventoryItemId; name: string; key: string }[] = [
    { id: "TOOLKIT", name: "Aerospace Toolkit", key: "1" },
    { id: "SOLAR_WING", name: "GaAs Solar Wing (28W)", key: "2" },
    { id: "SBAND_ANTENNA", name: "S-Band Transceiver", key: "3" },
    { id: "ALSEP_KIT", name: "Apollo ALSEP Science Station", key: "4" },
  ];

  const isCockpit = gameState.controlMode === "SPACECRAFT_COCKPIT";
  const isSurface = gameState.controlMode === "SURFACE_EXPLORATION";
  const canDock =
    isCockpit &&
    gameState.spacecraft.distanceToDockMeters <= 3.2 &&
    gameState.spacecraft.speedMps <= 2.8 &&
    !gameState.spacecraft.isDocked;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
        userSelect: "none",
      }}
    >
      {/* Astronaut Helmet Visor Overlay (Vignette & Curved Arc Glass Reflection) */}
      {!isCockpit && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background:
              "radial-gradient(ellipse at center, rgba(0, 0, 0, 0) 62%, rgba(4, 12, 24, 0.42) 100%)",
            boxShadow: "inset 0 0 100px rgba(0, 0, 0, 0.55)",
            zIndex: 1,
          }}
        >
          <div
            style={{
              position: "absolute",
              top: "16px",
              left: "24px",
              width: "180px",
              height: "40px",
              borderRadius: "50%",
              borderTop: "1.5px solid rgba(56, 189, 248, 0.12)",
              filter: "blur(1px)",
            }}
          />
          <div
            style={{
              position: "absolute",
              top: "16px",
              right: "24px",
              width: "180px",
              height: "40px",
              borderRadius: "50%",
              borderTop: "1.5px solid rgba(56, 189, 248, 0.12)",
              filter: "blur(1px)",
            }}
          />
        </div>
      )}

      {/* TOP BAR: OBJECTIVE, TELEMETRY & SYSTEM CONTROLS */}
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          padding: "16px 24px",
          background: "linear-gradient(180deg, rgba(8, 10, 14, 0.85) 0%, rgba(8, 10, 14, 0) 100%)",
        }}
      >
        {/* Objective Badge */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            backgroundColor: "rgba(18, 22, 28, 0.9)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            padding: "8px 14px",
            maxWidth: "500px",
            backdropFilter: "blur(6px)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor:
                  gameState.step === "MISSION_COMPLETE"
                    ? "#22c55e"
                    : gameState.step === "MISSION_FAILED"
                    ? "#ef4444"
                    : isSurface
                    ? "#a855f7"
                    : isCockpit
                    ? "#f59e0b"
                    : "#38bdf8",
                boxShadow: "0 0 8px currentColor",
              }}
            />
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "#94a3b8",
              }}
            >
              {gameState.step === "MISSION_COMPLETE"
                ? "MISSION COMPLETE // SUCCESS"
                : gameState.step === "MISSION_FAILED"
                ? "MISSION FAILED // CRITICAL"
                : isSurface
                ? "SURFACE EXPLORATION // LUNAR BASE ALPHA (0.166 G)"
                : isCockpit
                ? "ORBITAL FLIGHT // COCKPIT MODE"
                : "STATION OPERATIONS // ASTRONAUT MODE"}
            </span>
          </div>

          <div style={{ fontSize: "12px", color: "#f8fafc", fontWeight: 500, lineHeight: 1.4 }}>
            {gameState.substepText}
          </div>
        </div>

        {/* Top-Right Telemetry & Pause Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px", pointerEvents: "auto" }}>
          {/* Mission Elapsed Time */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              backgroundColor: "rgba(18, 22, 28, 0.9)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              padding: "8px 14px",
              backdropFilter: "blur(6px)",
              fontSize: "11px",
            }}
          >
            <div>
              <span style={{ color: "#94a3b8" }}>MET: </span>
              <span className="font-mono" style={{ color: "#38bdf8", fontWeight: 700 }}>
                {formatMet(gameState.missionMetSeconds)}
              </span>
            </div>
            <div style={{ width: "1px", height: "12px", backgroundColor: "rgba(255,255,255,0.15)" }} />
            <div>
              <span style={{ color: "#94a3b8" }}>ORBIT: </span>
              <span className="font-mono" style={{ color: "#f8fafc" }}>
                600 KM
              </span>
            </div>
            <div style={{ width: "1px", height: "12px", backgroundColor: "rgba(255,255,255,0.15)" }} />
            <div>
              <span style={{ color: "#94a3b8" }}>VEL: </span>
              <span className="font-mono" style={{ color: "#f8fafc" }}>
                7.66 KM/S
              </span>
            </div>
          </div>

          {/* Controls Sheet Toggle Button */}
          <button
            onClick={() => onToggleControlsOverlay?.()}
            style={{
              padding: "8px 14px",
              backgroundColor: gameState.showControlsOverlay ? "rgba(2, 132, 199, 0.4)" : "rgba(30, 41, 59, 0.85)",
              border: gameState.showControlsOverlay ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.15)",
              color: "#38bdf8",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              backdropFilter: "blur(6px)",
              transition: "all 0.15s ease",
            }}
            title="Press [C] in gameplay anytime to view the complete controls cheat sheet"
          >
            [C] CONTROLS
          </button>

          {/* EVA Gantry Mobility & Emergency Retether (Active when outside station on EVA) */}
          {gameState.controlMode === "ASTRONAUT" && gameState.isEva && (
            <>
              <button
                onClick={() => onRetetherToGantry?.()}
                style={{
                  padding: "8px 14px",
                  backgroundColor: "rgba(220, 38, 38, 0.85)",
                  border: "1px solid #ef4444",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  backdropFilter: "blur(6px)",
                  boxShadow: "0 0 12px rgba(239, 68, 68, 0.4)",
                  transition: "all 0.15s ease",
                }}
                title="Emergency autopilot recall: instantly return safely to the maintenance gantry deck [R]"
              >
                [R] RETETHER TO GANTRY
              </button>

              <button
                onClick={() => onToggleMagBoots?.()}
                style={{
                  padding: "8px 14px",
                  backgroundColor: gameState.isMagBootsLocked ? "rgba(22, 101, 52, 0.9)" : "rgba(30, 41, 59, 0.85)",
                  border: gameState.isMagBootsLocked ? "1px solid #22c55e" : "1px solid rgba(56, 189, 248, 0.4)",
                  color: gameState.isMagBootsLocked ? "#86efac" : "#38bdf8",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  backdropFilter: "blur(6px)",
                  transition: "all 0.15s ease",
                }}
                title="Toggle Magnetic Boots Lock [G]: clamp firmly to gantry deck for walking vs zero-g RCS"
              >
                [G] MAG-BOOTS: {gameState.isMagBootsLocked ? "LOCKED (WALKING)" : "OFF (ZERO-G)"}
              </button>
            </>
          )}

          {/* Sector Transition: Orbit Gateway-1 <-> Lunar Base Alpha */}
          <button
            onClick={() => onToggleSector?.()}
            style={{
              padding: "8px 14px",
              backgroundColor: isSurface ? "rgba(180, 83, 9, 0.3)" : "rgba(16, 185, 129, 0.25)",
              border: isSurface ? "1px solid #f59e0b" : "1px solid #34d399",
              color: isSurface ? "#fbbf24" : "#6ee7b7",
              fontSize: "11px",
              fontWeight: 700,
              cursor: "pointer",
              backdropFilter: "blur(6px)",
              transition: "all 0.15s ease",
            }}
            title="Instant de-orbit descent or orbital ascent transfer [T]"
          >
            {isSurface ? "[T] ASCENT TO GATEWAY-1" : "[T] DESCENT TO LUNAR BASE"}
          </button>

          {/* Pause Button */}
          <button
            onClick={() => onTogglePause?.()}
            style={{
              padding: "8px 14px",
              backgroundColor: "rgba(30, 41, 59, 0.85)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#f8fafc",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              backdropFilter: "blur(6px)",
              transition: "all 0.15s ease",
            }}
          >
            ❚❚ PAUSE (ESC)
          </button>

          {/* Flight Operations Hub */}
          <button
            onClick={() => onReturnToHub?.()}
            style={{
              padding: "8px 14px",
              backgroundColor: "rgba(15, 23, 42, 0.85)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#94a3b8",
              fontSize: "11px",
              fontWeight: 500,
              cursor: "pointer",
              backdropFilter: "blur(6px)",
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#f8fafc")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#94a3b8")}
          >
            Flight Operations Hub →
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* CENTER HUD: CROSSHAIR, INTERACTION PROMPTS & DOCKING TARGET           */}
      {/* ==================================================================== */}
      <div
        style={{
          position: "relative",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {!isCockpit && (
          /* Astronaut Crosshair */
          <div
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: gameState.interactionTarget ? "#38bdf8" : "rgba(255, 255, 255, 0.5)",
              boxShadow: gameState.interactionTarget
                ? "0 0 10px #38bdf8, 0 0 4px #ffffff"
                : "none",
              transition: "all 0.15s ease",
            }}
          />
        )}

        {/* Dynamic Interaction Pill */}
        {!isCockpit && gameState.interactionPrompt && (
          <div
            style={{
              marginTop: "16px",
              backgroundColor: "rgba(15, 23, 42, 0.95)",
              border: "1px solid #38bdf8",
              padding: "6px 16px",
              fontSize: "12px",
              fontWeight: 600,
              color: "#f8fafc",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.6)",
              backdropFilter: "blur(8px)",
              animation: "pulse 2s infinite ease-in-out",
            }}
          >
            {gameState.interactionPrompt}
          </div>
        )}

        {/* Cockpit Reticle & Docking Diamond */}
        {isCockpit && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {/* Flight Director Crosshair & Navball Vectors */}
            <div
              style={{
                position: "relative",
                width: "90px",
                height: "90px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Outer Calibration Ring */}
              <div
                style={{
                  position: "absolute",
                  width: "80px",
                  height: "80px",
                  borderRadius: "50%",
                  border: "1px dashed rgba(56, 189, 248, 0.4)",
                  boxShadow: "0 0 15px rgba(56, 189, 248, 0.15)",
                }}
              />

              {/* Pitch Ladder Level Lines */}
              <div
                style={{
                  position: "absolute",
                  width: "48px",
                  height: "1px",
                  backgroundColor: "rgba(56, 189, 248, 0.5)",
                }}
              />

              {/* Central Boresight Chevron */}
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  border: "1.5px solid #00f3ff",
                  transform: "rotate(45deg)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 10px rgba(0, 243, 255, 0.5)",
                }}
              >
                <div
                  style={{
                    width: "3px",
                    height: "3px",
                    backgroundColor: "#ffffff",
                    borderRadius: "50%",
                  }}
                />
              </div>

              {/* Prograde Vector Marker */}
              <div
                style={{
                  position: "absolute",
                  top: "12px",
                  right: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "9px",
                  fontWeight: 700,
                  color: "#00f3ff",
                  letterSpacing: "0.05em",
                }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    border: "1.5px solid #00f3ff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ width: "2px", height: "2px", backgroundColor: "#00f3ff" }} />
                </div>
                <span>PROGRADE</span>
              </div>
            </div>

            {/* Flight Attitude Euler & G-Force Strip */}
            <div
              style={{
                display: "flex",
                gap: "12px",
                fontSize: "10px",
                fontFamily: "var(--font-mono, monospace)",
                color: "#94a3b8",
                backgroundColor: "rgba(15, 23, 42, 0.8)",
                padding: "3px 10px",
                border: "1px solid rgba(56, 189, 248, 0.2)",
                backdropFilter: "blur(4px)",
              }}
            >
              <span>
                P: <strong style={{ color: "#f8fafc" }}>{((gameState.spacecraft.pitch * 180) / Math.PI).toFixed(0)}°</strong>
              </span>
              <span>
                Y: <strong style={{ color: "#f8fafc" }}>{((gameState.spacecraft.yaw * 180) / Math.PI).toFixed(0)}°</strong>
              </span>
              <span>
                R: <strong style={{ color: "#f8fafc" }}>{((gameState.spacecraft.roll * 180) / Math.PI).toFixed(0)}°</strong>
              </span>
              <span style={{ color: "#ffb700" }}>
                G: <strong>{(1.0 + Math.min(3.5, gameState.spacecraft.speedMps * 0.02)).toFixed(2)} G</strong>
              </span>
            </div>

            {/* Docking Proximity Warning / Latch Button */}
            {canDock && (
              <div
                style={{
                  marginTop: "12px",
                  pointerEvents: "auto",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <button
                  onClick={() => onManualDock?.()}
                  style={{
                    padding: "10px 20px",
                    backgroundColor: "#22c55e",
                    color: "#052e16",
                    border: "2px solid #86efac",
                    fontSize: "13px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 0 25px rgba(34, 197, 94, 0.6)",
                  }}
                >
                  [ENGAGE DOCKING LATCH - ENTER]
                </button>
                <span style={{ fontSize: "10px", color: "#86efac", fontWeight: 600 }}>
                  Soft capture envelope aligned (&lt;2.5 m/s, &lt;25°)
                </span>
              </div>
            )}

            {/* Surface Touchdown Evaluation & Scoring Breakdown Card */}
            {isCockpit && gameState.spacecraft.isLanded && (
              <div
                style={{
                  marginTop: "14px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: "10px",
                  backgroundColor: "rgba(3, 20, 14, 0.94)",
                  border: "2px solid #22c55e",
                  borderRadius: "6px",
                  padding: "16px 24px",
                  boxShadow: "0 0 35px rgba(34, 197, 94, 0.45), inset 0 0 15px rgba(34, 197, 94, 0.15)",
                  backdropFilter: "blur(12px)",
                  maxWidth: "520px",
                  pointerEvents: "auto",
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(34, 197, 94, 0.35)", paddingBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
                    <span style={{ fontSize: "12px", fontWeight: 800, color: "#86efac", letterSpacing: "0.1em" }}>
                      TOUCHDOWN EVALUATION // BASE ALPHA PAD-01
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#facc15", backgroundColor: "rgba(234, 179, 8, 0.15)", padding: "2px 8px", borderRadius: "4px", border: "1px solid rgba(234, 179, 8, 0.4)" }}>
                    +{gameState.spacecraft.touchdownScore ?? 1050} PTS
                  </span>
                </div>

                {/* Score Breakdown Table */}
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "11px" }}>
                  {/* Vertical Velocity */}
                  {(() => {
                    const vy = gameState.spacecraft.touchdownVerticalSpeed ?? 0.8;
                    const isGradeS = vy <= 1.0;
                    const isGradeA = vy <= 1.5;
                    const gradeLabel = isGradeS ? "GRADE S: SOFT THREE-POINT CONTACT" : isGradeA ? "GRADE A: NOMINAL CONTACT" : "GRADE B: HARD STRUT IMPACT";
                    const gradeColor = isGradeS ? "#86efac" : isGradeA ? "#38bdf8" : "#f59e0b";
                    const gradePts = isGradeS ? 500 : isGradeA ? 350 : 200;
                    return (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "4px" }}>
                        <span style={{ color: "#94a3b8" }}>DESCENT VERTICAL VELOCITY:</span>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, color: gradeColor }}>{vy.toFixed(2)} M/S ({gradeLabel})</span>
                          <span style={{ color: "#86efac", fontWeight: 700 }}>+{gradePts} PTS</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Pad Radial Error */}
                  {(() => {
                    const dist = gameState.spacecraft.touchdownDistanceToPad ?? 2.2;
                    const isBullseye = dist <= 3.0;
                    const distLabel = isBullseye ? "BULLSEYE CENTERLINE" : "PAD PERIMETER";
                    const distPts = isBullseye ? 350 : dist <= 6.0 ? 200 : 100;
                    return (
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "4px" }}>
                        <span style={{ color: "#94a3b8" }}>PAD-01 RADIAL ERROR:</span>
                        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                          <span style={{ fontWeight: 700, color: isBullseye ? "#86efac" : "#38bdf8" }}>{dist.toFixed(1)} M ({distLabel})</span>
                          <span style={{ color: "#86efac", fontWeight: 700 }}>+{distPts} PTS</span>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Fuel Conservation */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 8px", backgroundColor: "rgba(255,255,255,0.03)", borderRadius: "4px" }}>
                    <span style={{ color: "#94a3b8" }}>HYDRAZINE FUEL RESERVE:</span>
                    <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      <span style={{ fontWeight: 700, color: "#38bdf8" }}>{gameState.spacecraft.propellantPercent.toFixed(0)}% REMAINING</span>
                      <span style={{ color: "#86efac", fontWeight: 700 }}>+{Math.round(gameState.spacecraft.propellantPercent * 2.5)} PTS</span>
                    </div>
                  </div>
                </div>

                {/* Quick Action Navigation Footer */}
                <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                  <button
                    onClick={() => onExitCockpit?.()}
                    style={{
                      flex: 1,
                      backgroundColor: "#15803d",
                      border: "1px solid #22c55e",
                      color: "#ffffff",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: "pointer",
                      letterSpacing: "0.04em",
                      transition: "all 0.15s ease",
                    }}
                  >
                    [H] DISEMBARK (LUNAR EVA)
                  </button>
                  <button
                    onClick={() => onToggleSector?.()}
                    style={{
                      backgroundColor: "rgba(30, 41, 59, 0.8)",
                      border: "1px solid #475569",
                      color: "#94a3b8",
                      padding: "8px 12px",
                      borderRadius: "4px",
                      fontSize: "11px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    [T] ORBIT SECTOR
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================================================================== */}
      {/* BOTTOM BAR: GAUGES, QUICKBAR, COCKPIT MFD & LEGEND                   */}
      {/* ==================================================================== */}
      <footer
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          padding: "16px 24px",
          background: "linear-gradient(0deg, rgba(8, 10, 14, 0.9) 0%, rgba(8, 10, 14, 0) 100%)",
        }}
      >
        {isCockpit ? (
          /* COCKPIT INSTRUMENT READOUTS */
          <>
            {/* Left Cluster: Propulsion, Power & Camera/Gear Buttons */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                backgroundColor: "rgba(18, 22, 28, 0.92)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                padding: "10px 14px",
                minWidth: "220px",
                backdropFilter: "blur(6px)",
                pointerEvents: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                <span style={{ color: "#94a3b8" }}>RCS PROPELLANT</span>
                <span className="font-mono" style={{ fontWeight: 600, color: "#38bdf8" }}>
                  {gameState.spacecraft.propellantPercent.toFixed(1)}%
                </span>
              </div>
              <div style={{ width: "100%", height: "4px", backgroundColor: "#1e293b" }}>
                <div
                  style={{
                    width: `${gameState.spacecraft.propellantPercent}%`,
                    height: "100%",
                    backgroundColor: "#38bdf8",
                    transition: "width 0.2s ease",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                <span style={{ color: "#94a3b8" }}>SPEED</span>
                <span className="font-mono" style={{ fontWeight: 600, color: "#f8fafc" }}>
                  {gameState.spacecraft.speedMps.toFixed(2)} m/s
                </span>
              </div>

              {/* View & Gear Interactive Buttons */}
              <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
                <button
                  onClick={() => onToggleCameraView?.()}
                  style={{
                    flex: 1,
                    padding: "4px 8px",
                    backgroundColor:
                      gameState.spacecraft.cameraViewMode === "CHASE"
                        ? "rgba(14, 116, 144, 0.8)"
                        : "rgba(30, 41, 59, 0.8)",
                    border: "1px solid rgba(56, 189, 248, 0.4)",
                    color: "#f8fafc",
                    fontSize: "10px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  [V] {gameState.spacecraft.cameraViewMode === "CHASE" ? "CHASE CAM" : "COCKPIT"}
                </button>
                <button
                  onClick={() => onToggleLandingGear?.()}
                  style={{
                    flex: 1,
                    padding: "4px 8px",
                    backgroundColor: gameState.spacecraft.landingGearDeployed
                      ? "rgba(22, 101, 52, 0.8)"
                      : "rgba(30, 41, 59, 0.8)",
                    border: gameState.spacecraft.landingGearDeployed
                      ? "1px solid #22c55e"
                      : "1px solid rgba(255, 255, 255, 0.2)",
                    color: gameState.spacecraft.landingGearDeployed ? "#86efac" : "#94a3b8",
                    fontSize: "10px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  [G] {gameState.spacecraft.landingGearDeployed ? "GEAR DOWN" : "GEAR UP"}
                </button>
              </div>
            </div>

            {/* Center Cluster: Docking & Surface Landing Radar */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                backgroundColor: "rgba(18, 22, 28, 0.92)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                padding: "8px 16px",
                backdropFilter: "blur(6px)",
              }}
            >
              {/* Target Selector Header */}
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#64748b", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "4px" }}>
                <span>FLIGHT TELEMETRY</span>
                <span style={{ color: gameState.spacecraft.position.z < -45 ? "#a855f7" : "#38bdf8", fontWeight: 700 }}>
                  {gameState.spacecraft.position.z < -45 ? "LUNAR DESCENT MODE" : "STATION ORBIT MODE"}
                </span>
              </div>

              {gameState.spacecraft.position.z < -45 ? (
                /* Lunar Landing Telemetry (PAD-01) */
                <div style={{ display: "flex", gap: "16px", fontSize: "11px" }}>
                  <div>
                    <span style={{ color: "#94a3b8" }}>PAD: </span>
                    <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 700 }}>
                      PAD-01
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8" }}>DIST: </span>
                    <span
                      className="font-mono"
                      style={{
                        color: (gameState.spacecraft.distanceToLandingPad ?? 99) <= 10.0 ? "#22c55e" : "#38bdf8",
                        fontWeight: 700,
                      }}
                    >
                      {(gameState.spacecraft.distanceToLandingPad ?? 0).toFixed(1)} m
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8" }}>RADAR ALT: </span>
                    <span
                      className="font-mono"
                      style={{
                        color:
                          (gameState.spacecraft.surfaceAltitudeMeters ?? 99) <= 2.0
                            ? "#22c55e"
                            : (gameState.spacecraft.surfaceAltitudeMeters ?? 99) <= 12.0
                            ? "#f59e0b"
                            : "#38bdf8",
                        fontWeight: 700,
                      }}
                    >
                      {(gameState.spacecraft.surfaceAltitudeMeters ?? 0).toFixed(1)} m
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8" }}>V/S: </span>
                    <span
                      className="font-mono"
                      style={{
                        color:
                          Math.abs(gameState.spacecraft.verticalSpeedMps ?? 0) <= 3.8
                            ? "#22c55e"
                            : "#ef4444",
                        fontWeight: 700,
                      }}
                    >
                      {(gameState.spacecraft.verticalSpeedMps ?? 0).toFixed(2)} m/s
                    </span>
                  </div>
                </div>
              ) : (
                /* Orbital Station Docking Telemetry (DOCK-01) */
                <div style={{ display: "flex", gap: "16px", fontSize: "11px" }}>
                  <div>
                    <span style={{ color: "#94a3b8" }}>PORT: </span>
                    <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 700 }}>
                      DOCK-01
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8" }}>DIST: </span>
                    <span
                      className="font-mono"
                      style={{
                        color: gameState.spacecraft.distanceToDockMeters <= 3.2 ? "#22c55e" : "#38bdf8",
                        fontWeight: 700,
                      }}
                    >
                      {gameState.spacecraft.distanceToDockMeters.toFixed(1)} m
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8" }}>REL VEL: </span>
                    <span
                      className="font-mono"
                      style={{
                        color: Math.abs(gameState.spacecraft.relativeVelocityMps) <= 2.5 ? "#22c55e" : "#f59e0b",
                        fontWeight: 700,
                      }}
                    >
                      {gameState.spacecraft.relativeVelocityMps.toFixed(2)} m/s
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "#94a3b8" }}>ALIGN: </span>
                    <span
                      className="font-mono"
                      style={{
                        color: gameState.spacecraft.alignmentAngleDeg <= 25 ? "#22c55e" : "#f59e0b",
                        fontWeight: 700,
                      }}
                    >
                      {gameState.spacecraft.alignmentAngleDeg.toFixed(1)}°
                    </span>
                  </div>
                </div>
              )}

              {/* Tactical In-Cockpit Flight Contract Selector Dock */}
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  marginTop: "6px",
                  pointerEvents: "auto",
                  flexWrap: "wrap",
                }}
              >
                {[
                  { id: "ARC_600", label: "ARC-600", name: "LEO Sentinel" },
                  { id: "ISS_400", label: "ISS-400", name: "Gateway Docking" },
                  { id: "LUN_PAD1", label: "LUN-PAD1", name: "Lunar Touchdown" },
                  { id: "RET_100", label: "RET-100", name: "Atmosphere Entry" },
                  { id: "AEGIS_DART", label: "GAME 02", name: "Aegis Asteroid Deflection" },
                  { id: "EUROPA_ABYSS", label: "GAME 03", name: "Europa Subsurface Cryo" },
                ].map((contract) => {
                  const isSelected = (gameState.activeFlightContract || "ARC_600") === contract.id;
                  return (
                    <button
                      key={contract.id}
                      onClick={() => onSelectFlightContract?.(contract.id)}
                      style={{
                        padding: "3px 8px",
                        backgroundColor: isSelected ? "rgba(2, 132, 199, 0.45)" : "rgba(30, 41, 59, 0.7)",
                        border: isSelected ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.15)",
                        color: isSelected ? "#38bdf8" : "#94a3b8",
                        fontSize: "9px",
                        fontWeight: isSelected ? 700 : 500,
                        cursor: "pointer",
                        borderRadius: "2px",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ fontWeight: 700 }}>[{contract.label}]</span> {contract.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Cluster: Disembark & Cockpit Flight Controls Legend */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                pointerEvents: "auto",
              }}
            >
              <button
                onClick={() => onExitCockpit?.()}
                style={{
                  padding: "8px 14px",
                  backgroundColor: gameState.spacecraft.isLanded
                    ? "rgba(22, 101, 52, 0.9)"
                    : "rgba(30, 41, 59, 0.9)",
                  border: gameState.spacecraft.isLanded
                    ? "1px solid #22c55e"
                    : "1px solid rgba(56, 189, 248, 0.4)",
                  color: "#f8fafc",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backdropFilter: "blur(6px)",
                }}
              >
                {gameState.spacecraft.isLanded
                  ? "[H] Disembark onto Lunar Base"
                  : "[H] Disembark / Exit Cockpit"}
              </button>

              <div
                style={{
                  backgroundColor: "rgba(18, 22, 28, 0.9)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  padding: "6px 12px",
                  fontSize: "10px",
                  color: "#94a3b8",
                  display: "flex",
                  gap: "10px",
                }}
              >
                <span>W/S Thrust</span>
                <span>Shift Boost</span>
                <span>A/D Yaw</span>
                <span>Q/E Roll</span>
                <span>Space/C Vert</span>
                <span>X Brake</span>
              </div>
            </div>
          </>
        ) : isSurface ? (
          /* LUNAR SURFACE EXPLORATION HUD */
          <>
            {/* Left Cluster: Surface Life Support */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                backgroundColor: "rgba(18, 22, 28, 0.9)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                padding: "10px 14px",
                minWidth: "210px",
                backdropFilter: "blur(6px)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                <span style={{ color: "#94a3b8" }}>SUIT OXYGEN</span>
                <span className="font-mono" style={{ fontWeight: 600, color: "#22c55e" }}>
                  {gameState.oxygenPercent.toFixed(0)}%
                </span>
              </div>
              <div style={{ width: "100%", height: "4px", backgroundColor: "#1e293b" }}>
                <div style={{ width: `${gameState.oxygenPercent}%`, height: "100%", backgroundColor: "#22c55e" }} />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                <span style={{ color: "#94a3b8" }}>SURFACE GRAVITY</span>
                <span className="font-mono" style={{ fontWeight: 600, color: "#a855f7" }}>
                  1.62 m/s² (0.166 G)
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                <span style={{ color: "#94a3b8" }}>RADIATION</span>
                <span className="font-mono" style={{ fontWeight: 600, color: "#38bdf8" }}>
                  {(gameState.radiationLevelMsv ?? 0.14).toFixed(2)} mSv/h [NOMINAL]
                </span>
              </div>
            </div>

            {/* Center Cluster: Surface Objective / Sector Info */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "4px",
                backgroundColor: "rgba(18, 22, 28, 0.9)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                padding: "8px 20px",
                backdropFilter: "blur(6px)",
              }}
            >
              <div style={{ fontSize: "12px", color: "#f8fafc", fontWeight: 700, letterSpacing: "0.06em" }}>
                LUNAR BASE ALPHA · RESEARCH SECTOR
              </div>
              <div style={{ fontSize: "10px", color: "#38bdf8", fontFamily: "var(--font-mono)" }}>
                LOC: {gameState.surfaceCoordinates?.lat ?? "0.6740° N"}, {gameState.surfaceCoordinates?.lon ?? "23.4720° E"} {"//"} MARE TRANQUILLITATIS
              </div>
              <div style={{ fontSize: "10px", color: "#94a3b8" }}>
                Touchdown Pad PAD-01 | Habitat Module | S-Band Deep Space Mast
              </div>
              <div style={{ fontSize: "10px", color: gameState.lunarSampleCollected ? "#22c55e" : "#f59e0b", fontWeight: 600 }}>
                {gameState.lunarSampleCollected ? "[CORE-GEO-01 SECURED]" : "[CORE-GEO-01 SAMPLE READY FOR RETRIEVAL]"}
              </div>
            </div>

            {/* Right Cluster: Surface Controls Legend */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                pointerEvents: "auto",
              }}
            >
              <button
                onClick={() => onToggleFlashlight?.()}
                style={{
                  padding: "8px 14px",
                  backgroundColor: gameState.flashlightOn
                    ? "rgba(234, 179, 8, 0.25)"
                    : "rgba(30, 41, 59, 0.9)",
                  border: gameState.flashlightOn
                    ? "1px solid #eab308"
                    : "1px solid rgba(255, 255, 255, 0.2)",
                  color: gameState.flashlightOn ? "#fef08a" : "#f8fafc",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                [F] Helmet Flashlight: {gameState.flashlightOn ? "ON" : "OFF"}
              </button>

              <div
                style={{
                  backgroundColor: "rgba(18, 22, 28, 0.9)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  padding: "6px 12px",
                  fontSize: "10px",
                  color: "#94a3b8",
                  display: "flex",
                  gap: "10px",
                }}
              >
                <span>WASD Walk</span>
                <span>Shift Sprint</span>
                <span>Space Moon Jump</span>
                <span>E Interact</span>
              </div>
            </div>
          </>
        ) : gameState.step === "HANGAR_ASSEMBLY" ? (
          /* 3D SPACECRAFT CONSTRUCTION HANGAR // ASSEMBLY SANDBOX HUD */
          <>
            {/* Left Cluster: Live Spacecraft Telemetry Specs */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                backgroundColor: "rgba(18, 22, 28, 0.92)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                padding: "10px 14px",
                minWidth: "240px",
                backdropFilter: "blur(6px)",
                pointerEvents: "auto",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#64748b", borderBottom: "1px solid rgba(255,255,255,0.08)", paddingBottom: "4px" }}>
                <span>MODULAR SPACECRAFT STATS</span>
                <span style={{ color: "#38bdf8", fontWeight: 700 }}>VERIFIED JPL CML-4</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                <span style={{ color: "#94a3b8" }}>CHASSIS BUS:</span>
                <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 700 }}>
                  {gameState.hangarCraft?.chassis || "3U"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                <span style={{ color: "#94a3b8" }}>SOLAR ARRAY:</span>
                <span className="font-mono" style={{ color: "#38bdf8", fontWeight: 700 }}>
                  {gameState.hangarCraft?.solar || "SINGLE_WING"} ({gameState.hangarCraft?.solarDeployed ? "DEPLOYED" : "FOLDED"})
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                <span style={{ color: "#94a3b8" }}>PROPULSION:</span>
                <span className="font-mono" style={{ color: "#f59e0b", fontWeight: 700 }}>
                  {gameState.hangarCraft?.propulsion || "HYDRAZINE"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                <span style={{ color: "#94a3b8" }}>PAYLOAD / RF:</span>
                <span className="font-mono" style={{ color: "#a855f7", fontWeight: 700 }}>
                  {gameState.hangarCraft?.payload || "IMAGER"} / {gameState.hangarCraft?.telecom || "SBAND"}
                </span>
              </div>
            </div>

            {/* Center Cluster: Fast Engineering Cycle & Launch Controls */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                backgroundColor: "rgba(18, 22, 28, 0.92)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                padding: "8px 16px",
                backdropFilter: "blur(6px)",
                pointerEvents: "auto",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: "10px", color: "#38bdf8", fontWeight: 700, letterSpacing: "0.06em" }}>
                3D HANGAR QUICK ACTIONS &amp; FLIGHT LAUNCH
              </div>
              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", justifyContent: "center" }}>
                <button
                  onClick={() => onInteractHangar?.("hangar_chassis")}
                  style={{
                    padding: "5px 10px",
                    backgroundColor: "rgba(30, 41, 59, 0.8)",
                    border: "1px solid rgba(56, 189, 248, 0.4)",
                    color: "#f8fafc",
                    fontSize: "10px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  [CHASSIS: {gameState.hangarCraft?.chassis || "3U"}]
                </button>
                <button
                  onClick={() => onInteractHangar?.("hangar_solar_toggle")}
                  style={{
                    padding: "5px 10px",
                    backgroundColor: gameState.hangarCraft?.solarDeployed ? "rgba(14, 116, 144, 0.8)" : "rgba(30, 41, 59, 0.8)",
                    border: "1px solid rgba(56, 189, 248, 0.4)",
                    color: "#f8fafc",
                    fontSize: "10px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  [F] {gameState.hangarCraft?.solarDeployed ? "WINGS: DEPLOYED" : "WINGS: FOLDED"}
                </button>
                <button
                  onClick={() => onInteractHangar?.("hangar_static_fire")}
                  style={{
                    padding: "5px 10px",
                    backgroundColor: gameState.hangarCraft?.isThrusterFiring ? "rgba(220, 38, 38, 0.9)" : "rgba(180, 83, 9, 0.8)",
                    border: "1px solid #f59e0b",
                    color: "#fef3c7",
                    fontSize: "10px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: gameState.hangarCraft?.isThrusterFiring ? "0 0 15px #ef4444" : "none",
                  }}
                >
                  [R] {gameState.hangarCraft?.isThrusterFiring ? "PLUME FIRING!" : "TEST THRUSTER PLUME"}
                </button>
                <button
                  onClick={() => onInteractHangar?.("hangar_launch")}
                  style={{
                    padding: "5px 12px",
                    backgroundColor: "rgba(22, 101, 52, 0.9)",
                    border: "1px solid #22c55e",
                    color: "#86efac",
                    fontSize: "10px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 0 12px rgba(34, 197, 94, 0.4)",
                  }}
                >
                  [L] LAUNCH TO 3D FLIGHT SIM →
                </button>
              </div>
            </div>

            {/* Right Cluster: Movement & Interaction Keyguide */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                pointerEvents: "auto",
              }}
            >
              <div
                style={{
                  backgroundColor: "rgba(18, 22, 28, 0.9)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  padding: "8px 12px",
                  fontSize: "10px",
                  color: "#94a3b8",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                <div style={{ color: "#38bdf8", fontWeight: 700 }}>HANGAR CONTROLS</div>
                <div>WASD · Walk around bays</div>
                <div>[E] · Interact at console</div>
                <div>[F] · Toggle solar wings</div>
                <div>[R] · Static fire thrusters</div>
                <div>[L] · Launch to 3D orbit</div>
              </div>
            </div>
          </>
        ) : (
          /* ASTRONAUT SUIT VITALS & INVENTORY */
          <>
            {/* Suit Vitals (Oxygen & Power) */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                backgroundColor: "rgba(18, 22, 28, 0.85)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                padding: "10px 14px",
                minWidth: "210px",
                backdropFilter: "blur(6px)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                <span style={{ color: "#94a3b8" }}>SUIT OXYGEN</span>
                <span
                  className="font-mono"
                  style={{
                    fontWeight: 600,
                    color:
                      gameState.oxygenPercent > 40
                        ? "#22c55e"
                        : gameState.oxygenPercent > 20
                        ? "#f59e0b"
                        : "#ef4444",
                  }}
                >
                  {gameState.oxygenPercent.toFixed(0)}%
                </span>
              </div>
              <div style={{ width: "100%", height: "4px", backgroundColor: "#1e293b" }}>
                <div
                  style={{
                    width: `${gameState.oxygenPercent}%`,
                    height: "100%",
                    backgroundColor:
                      gameState.oxygenPercent > 40
                        ? "#22c55e"
                        : gameState.oxygenPercent > 20
                        ? "#f59e0b"
                        : "#ef4444",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginTop: "2px" }}>
                <span style={{ color: "#94a3b8" }}>SUIT POWER</span>
                <span className="font-mono" style={{ fontWeight: 600, color: "#38bdf8" }}>
                  {gameState.suitPowerPercent.toFixed(0)}%
                </span>
              </div>
              <div style={{ width: "100%", height: "4px", backgroundColor: "#1e293b" }}>
                <div
                  style={{
                    width: `${gameState.suitPowerPercent}%`,
                    height: "100%",
                    backgroundColor: "#38bdf8",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>

              <div
                onClick={() => onToggleFlashlight?.()}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "10px",
                  color: "#94a3b8",
                  marginTop: "4px",
                  paddingTop: "4px",
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  cursor: "pointer",
                  pointerEvents: "auto",
                }}
              >
                <span>[F] FLASHLIGHT</span>
                <span style={{ color: gameState.flashlightOn ? "#fef08a" : "#64748b", fontWeight: 600 }}>
                  {gameState.flashlightOn ? "ON" : "OFF"}
                </span>
              </div>
            </div>

            {/* Interactive Inventory Quickbar */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                backgroundColor: "rgba(18, 22, 28, 0.85)",
                border: "1px solid rgba(255,255,255,0.12)",
                padding: "8px 12px",
                backdropFilter: "blur(6px)",
                pointerEvents: "auto",
              }}
            >
              {inventoryItems.map((item) => {
                const hasItem = gameState.inventory.includes(item.id);
                const isEquipped = gameState.equippedItem === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => hasItem && onEquipItem?.(item.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 12px",
                      backgroundColor: isEquipped
                        ? "rgba(14, 116, 144, 0.75)"
                        : hasItem
                        ? "rgba(30, 41, 59, 0.9)"
                        : "rgba(15, 23, 42, 0.4)",
                      border: isEquipped
                        ? "1px solid #38bdf8"
                        : hasItem
                        ? "1px solid rgba(56, 189, 248, 0.3)"
                        : "1px solid rgba(255,255,255,0.08)",
                      boxShadow: isEquipped ? "0 0 12px rgba(56, 189, 248, 0.5)" : "none",
                      fontSize: "11px",
                      cursor: hasItem ? "pointer" : "default",
                      opacity: hasItem ? 1.0 : 0.45,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span className="font-mono" style={{ color: isEquipped ? "#ffffff" : hasItem ? "#38bdf8" : "#64748b" }}>
                      [{item.key}]
                    </span>
                    <span style={{ color: isEquipped ? "#ffffff" : hasItem ? "#f8fafc" : "#94a3b8", fontWeight: isEquipped ? 700 : 500 }}>
                      {item.name}
                    </span>
                    {hasItem && (
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: 700,
                          padding: "1px 4px",
                          borderRadius: "2px",
                          backgroundColor: isEquipped ? "#0284c7" : "rgba(34, 197, 94, 0.2)",
                          color: isEquipped ? "#ffffff" : "#22c55e",
                        }}
                      >
                        {isEquipped ? "EQUIPPED" : "READY"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Right Cluster: Sector Transition & Astronaut Controls Reference */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                pointerEvents: "auto",
              }}
            >
              <button
                onClick={() => onToggleSector?.()}
                style={{
                  padding: "7px 14px",
                  backgroundColor: "rgba(217, 119, 6, 0.85)",
                  border: "1px solid #f59e0b",
                  color: "#fef3c7",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  backdropFilter: "blur(6px)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  boxShadow: "0 0 10px rgba(245, 158, 11, 0.3)",
                }}
              >
                <span>[T]</span>
                <span>DESCEND TO LUNAR SURFACE (GRAVITY)</span>
              </button>

              <div
                style={{
                  backgroundColor: "rgba(18, 22, 28, 0.85)",
                  border: "1px solid rgba(255, 255, 255, 0.12)",
                  padding: "8px 12px",
                  fontSize: "10px",
                  color: "#94a3b8",
                  display: "flex",
                  flexDirection: "column",
                  gap: "3px",
                  backdropFilter: "blur(6px)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: "10px" }}>
                  <span>WASD Move · Shift Sprint</span>
                  <span style={{ color: "#38bdf8", cursor: "pointer" }} onClick={() => onToggleControlsOverlay?.()}>
                    [C] Controls
                  </span>
                </div>
                <div>{gameState.isEva ? "Space Up · Ctrl/X Down · [B] Re-tether" : "Space Jump · E Interact · F Torch"}</div>
              </div>
            </div>
          </>
        )}
      </footer>

      {/* ==================================================================== */}
      {/* CLICK TO PLAY / POINTER LOCK PROMPT OVERLAY                           */}
      {/* ==================================================================== */}
      {!hasEntered &&
        !isPointerLocked &&
        !showBriefingModal &&
        !gameState.paused &&
        gameState.step !== "MISSION_COMPLETE" &&
        gameState.step !== "MISSION_FAILED" && (
          <div
            onClick={handleEnter}
            style={{
              position: "absolute",
              inset: 0,
              backgroundColor: "rgba(6, 8, 12, 0.75)",
              backdropFilter: "blur(8px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "auto",
              cursor: "pointer",
              zIndex: 100,
            }}
          >
            <div
              style={{
                maxWidth: "540px",
                width: "100%",
                backgroundColor: "rgba(15, 23, 42, 0.95)",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                padding: "32px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
                textAlign: "center",
                boxShadow: "0 20px 40px rgba(0,0,0,0.8)",
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    color: "#38bdf8",
                    fontWeight: 700,
                    letterSpacing: "0.1em",
                  }}
                >
                  ORBITAL OUTPOST GATEWAY-1
                </div>
                <h1
                  style={{
                    fontSize: "20px",
                    fontWeight: 700,
                    color: "#f8fafc",
                    margin: "6px 0",
                    letterSpacing: "0.5px",
                  }}
                >
                  OPERATION ARTEMIS-VII: SHACKLETON CRADLE
                </h1>
                <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.5 }}>
                  A high-stakes 3-phase aerospace campaign. Atmospheric solar storm imminent. Restore deep-space sentinel relay during microgravity EVA, pilot shuttle ORV-1 through orbital debris in 6-DOF cockpit flight to dock with Gateway-1, and execute powered descent into Shackleton Crater to deploy the Apollo ALSEP station.
                </p>
              </div>

              <div
                style={{
                  backgroundColor: "rgba(30, 41, 59, 0.6)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: "14px",
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  fontSize: "11px",
                  textAlign: "left",
                }}
              >
                <div>
                  <strong style={{ color: "#f8fafc" }}>W, A, S, D:</strong> Move / Thrust
                </div>
                <div>
                  <strong style={{ color: "#f8fafc" }}>Mouse:</strong> Look / Pitch &amp; Yaw
                </div>
                <div>
                  <strong style={{ color: "#f8fafc" }}>Shift:</strong> Sprint (Station)
                </div>
                <div>
                  <strong style={{ color: "#f8fafc" }}>Q / E:</strong> Roll (Cockpit)
                </div>
                <div>
                  <strong style={{ color: "#f8fafc" }}>E:</strong> Interact with objects
                </div>
                <div>
                  <strong style={{ color: "#f8fafc" }}>F:</strong> Helmet Flashlight
                </div>
                <div>
                  <strong style={{ color: "#f8fafc" }}>Space / C:</strong> Vertical RCS
                </div>
                <div>
                  <strong style={{ color: "#f8fafc" }}>X:</strong> Retrograde Brake / SAS
                </div>
              </div>

              <button
                onClick={handleEnter}
                style={{
                  padding: "12px 24px",
                  backgroundColor: "#0284c7",
                  color: "#f8fafc",
                  border: "1px solid #38bdf8",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                CLICK TO ENTER STATION &amp; PLAY →
              </button>
            </div>
          </div>
        )}

      {/* ==================================================================== */}
      {/* PAUSE MENU MODAL                                                     */}
      {/* ==================================================================== */}
      {gameState.paused && !showSettings && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(6, 8, 12, 0.8)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
            zIndex: 150,
          }}
        >
          <div
            style={{
              maxWidth: "420px",
              width: "100%",
              backgroundColor: "rgba(15, 23, 42, 0.98)",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              padding: "32px",
              display: "flex",
              flexDirection: "column",
              gap: "16px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8)",
              textAlign: "center",
            }}
          >
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "12px" }}>
              <span className="font-mono" style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 700, letterSpacing: "0.08em" }}>
                SIMULATION PAUSED
              </span>
              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#f8fafc", marginTop: "4px" }}>
                Gateway-1 Operations
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
              <button
                onClick={() => {
                  onTogglePause?.();
                  onRequestPointerLock();
                }}
                style={{
                  padding: "12px 20px",
                  backgroundColor: "#0284c7",
                  color: "#f8fafc",
                  border: "1px solid #38bdf8",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Resume Mission
              </button>

              <button
                onClick={() => setShowSettings(true)}
                style={{
                  padding: "12px 20px",
                  backgroundColor: "rgba(30, 41, 59, 0.8)",
                  color: "#f8fafc",
                  border: "1px solid rgba(255,255,255,0.15)",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Settings (Controls &amp; Audio)
              </button>

              <button
                onClick={() => {
                  onRestartMission();
                  onTogglePause?.();
                }}
                style={{
                  padding: "12px 20px",
                  backgroundColor: "rgba(30, 41, 59, 0.8)",
                  color: "#f8fafc",
                  border: "1px solid rgba(255,255,255,0.15)",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Restart Mission
              </button>

              <button
                onClick={() => onReturnToHub?.()}
                style={{
                  padding: "12px 20px",
                  backgroundColor: "rgba(15, 23, 42, 0.8)",
                  color: "#94a3b8",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontSize: "13px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Exit to Flight Operations Hub
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* SETTINGS MODAL (SENSITIVITY, SOUND, GRAPHICS, INVERT Y)               */}
      {/* ==================================================================== */}
      {gameState.paused && showSettings && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(6, 8, 12, 0.85)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
            zIndex: 160,
          }}
        >
          <div
            style={{
              maxWidth: "460px",
              width: "100%",
              backgroundColor: "rgba(15, 23, 42, 0.98)",
              border: "1px solid #38bdf8",
              padding: "32px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              boxShadow: "0 20px 50px rgba(0, 0, 0, 0.9)",
            }}
          >
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "10px" }}>
              <span className="font-mono" style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 700, letterSpacing: "0.08em" }}>
                AVIONICS &amp; INPUT CONFIGURATION
              </span>
              <h2 style={{ fontSize: "18px", fontWeight: 700, color: "#f8fafc", marginTop: "4px" }}>
                Game Settings
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "16px", fontSize: "12px" }}>
              {/* Mouse Sensitivity */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ color: "#94a3b8" }}>Mouse Sensitivity:</span>
                  <span className="font-mono" style={{ color: "#38bdf8", fontWeight: 700 }}>
                    {(gameState.settings?.mouseSensitivity ?? 1.0).toFixed(1)}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.5"
                  max="2.5"
                  step="0.1"
                  value={gameState.settings?.mouseSensitivity ?? 1.0}
                  onChange={(e) => onUpdateSettings?.({ mouseSensitivity: parseFloat(e.target.value) })}
                  style={{ width: "100%", cursor: "pointer", accentColor: "#38bdf8" }}
                />
              </div>

              {/* Sound Volume */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span style={{ color: "#94a3b8" }}>Master Sound Volume:</span>
                  <span className="font-mono" style={{ color: "#22c55e", fontWeight: 700 }}>
                    {gameState.settings?.soundVolume ?? 80}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={gameState.settings?.soundVolume ?? 80}
                  onChange={(e) => onUpdateSettings?.({ soundVolume: parseInt(e.target.value, 10) })}
                  style={{ width: "100%", cursor: "pointer", accentColor: "#22c55e" }}
                />
              </div>

              {/* Invert Y-Axis */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ color: "#f8fafc", fontWeight: 500 }}>Invert Pitch Axis (Y)</div>
                  <div style={{ color: "#64748b", fontSize: "11px" }}>Flight simulation inverted control</div>
                </div>
                <button
                  onClick={() => onUpdateSettings?.({ invertY: !gameState.settings?.invertY })}
                  style={{
                    padding: "6px 14px",
                    backgroundColor: gameState.settings?.invertY ? "#0284c7" : "rgba(30, 41, 59, 0.8)",
                    border: "1px solid rgba(255,255,255,0.15)",
                    color: "#f8fafc",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {gameState.settings?.invertY ? "INVERTED" : "NORMAL"}
                </button>
              </div>

              {/* Graphics Quality */}
              <div>
                <div style={{ color: "#94a3b8", marginBottom: "6px" }}>Rendering Quality:</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
                  {(["HIGH", "MEDIUM", "LOW"] as const).map((q) => (
                    <button
                      key={q}
                      onClick={() => onUpdateSettings?.({ graphicsQuality: q })}
                      style={{
                        padding: "8px",
                        backgroundColor:
                          gameState.settings?.graphicsQuality === q
                            ? "#0284c7"
                            : "rgba(30, 41, 59, 0.8)",
                        border: "1px solid rgba(255,255,255,0.15)",
                        color: "#f8fafc",
                        fontSize: "11px",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowSettings(false)}
              style={{
                marginTop: "8px",
                padding: "10px 20px",
                backgroundColor: "#0284c7",
                color: "#f8fafc",
                border: "1px solid #38bdf8",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Back to Pause Menu
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MISSION BRIEFING MODAL                                               */}
      {/* ==================================================================== */}
      {showBriefingModal && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(6, 8, 12, 0.8)",
            backdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
            zIndex: 110,
          }}
        >
          <div
            style={{
              maxWidth: "600px",
              width: "100%",
              backgroundColor: "rgba(15, 23, 42, 0.98)",
              border: "1px solid rgba(56, 189, 248, 0.4)",
              padding: "28px",
              display: "flex",
              flexDirection: "column",
              gap: "18px",
              boxShadow: "0 20px 40px rgba(0,0,0,0.8)",
            }}
          >
            {/* Campaign Selector Tabs */}
            <div style={{ display: "flex", gap: "6px", borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "10px" }}>
              <button
                onClick={() => setSelectedCampaignTab("ARTEMIS")}
                style={{
                  padding: "6px 12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  backgroundColor: selectedCampaignTab === "ARTEMIS" ? "#0284c7" : "rgba(30, 41, 59, 0.7)",
                  color: selectedCampaignTab === "ARTEMIS" ? "#ffffff" : "#94a3b8",
                  border: selectedCampaignTab === "ARTEMIS" ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                01: ARTEMIS-VII
              </button>
              <button
                onClick={() => setSelectedCampaignTab("AEGIS")}
                style={{
                  padding: "6px 12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  backgroundColor: selectedCampaignTab === "AEGIS" ? "#b45309" : "rgba(30, 41, 59, 0.7)",
                  color: selectedCampaignTab === "AEGIS" ? "#ffffff" : "#94a3b8",
                  border: selectedCampaignTab === "AEGIS" ? "1px solid #f59e0b" : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                02: PROJECT AEGIS (DART)
              </button>
              <button
                onClick={() => setSelectedCampaignTab("EUROPA")}
                style={{
                  padding: "6px 12px",
                  fontSize: "11px",
                  fontWeight: 700,
                  cursor: "pointer",
                  backgroundColor: selectedCampaignTab === "EUROPA" ? "#4f46e5" : "rgba(30, 41, 59, 0.7)",
                  color: selectedCampaignTab === "EUROPA" ? "#ffffff" : "#94a3b8",
                  border: selectedCampaignTab === "EUROPA" ? "1px solid #818cf8" : "1px solid rgba(255,255,255,0.1)",
                }}
              >
                03: PROJECT EUROPA
              </button>
            </div>

            {selectedCampaignTab === "ARTEMIS" && (
              <>
                <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="font-mono" style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 700, letterSpacing: "1px" }}>
                      NASA DEEP SPACE DIRECTIVE // ARTEMIS-VII
                    </span>
                    <span className="font-mono" style={{ fontSize: "10px", backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#f87171", padding: "2px 8px", border: "1px solid rgba(239, 68, 68, 0.4)", fontWeight: 700 }}>
                      PRIORITY: ALPHA-1
                    </span>
                  </div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#f8fafc", marginTop: "6px" }}>
                    Operation Shackleton Cradle &amp; Orbital Crisis
                  </h2>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px", color: "#cbd5e1", lineHeight: 1.5 }}>
                  <p>
                    <strong>CRITICAL SITUATION:</strong> A severe Class X-4 Coronal Mass Ejection is tracking towards cis-lunar space (Impact Window: T-minus 18 minutes). Earth communication links will undergo full telemetry blackout. Lunar Base Alpha in the permanently shadowed Shackleton Crater depends on orbital relay satellite AERO-3X to sustain life-support telemetry.
                  </p>
                  <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", padding: "12px", border: "1px solid rgba(56, 189, 248, 0.2)" }}>
                    <strong style={{ color: "#38bdf8", letterSpacing: "0.5px" }}>MISSION EXECUTION DIRECTIVES:</strong>
                    <ol style={{ paddingLeft: "18px", margin: "6px 0 0 0", display: "flex", flexDirection: "column", gap: "4px" }}>
                      <li><strong>Workshop Procurement:</strong> Retrieve the Aerospace Toolkit [1], GaAs Solar Array [2], and high-gain S-Band Transceiver [3].</li>
                      <li><strong>Vacuum Depressurization:</strong> Cycle the airlock chamber to vacuum and commence exterior microgravity spacewalk along the gantry.</li>
                      <li><strong>Sentinel Restoration:</strong> Remove damaged wing, mount high-efficiency array and antenna, and lock telemetry beacon.</li>
                      <li><strong>Orbital Shuttle Insertion:</strong> Board ORV-1, fly 6-DOF RCS vectors through orbital debris corridor, and execute precision soft docking at Gateway Port DOCK-01.</li>
                      <li><strong>Lunar Touchdown &amp; Science:</strong> Engage de-orbit burn [T] into Shackleton Crater (Lunar Base Alpha PAD-01), deploy the Apollo ALSEP array, and extract cryogenic water-ice core samples.</li>
                    </ol>
                  </div>
                </div>
              </>
            )}

            {selectedCampaignTab === "AEGIS" && (
              <>
                <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="font-mono" style={{ fontSize: "11px", color: "#f59e0b", fontWeight: 700, letterSpacing: "1px" }}>
                      PLANETARY DEFENSE INITIATIVE // PROJECT AEGIS (DART-II)
                    </span>
                    <span className="font-mono" style={{ fontSize: "10px", backgroundColor: "rgba(245, 158, 11, 0.2)", color: "#fbbf24", padding: "2px 8px", border: "1px solid rgba(245, 158, 11, 0.4)", fontWeight: 700 }}>
                      NEO COLLISION ALERT: 72H
                    </span>
                  </div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#f8fafc", marginTop: "6px" }}>
                    Kinetic Asteroid Redirection // Target: 2032-XK Didymos
                  </h2>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px", color: "#cbd5e1", lineHeight: 1.5 }}>
                  <p>
                    <strong>PLANETARY THREAT:</strong> A 160-meter binary moonlet asteroid is gravitationally deflected onto an Earth-intersecting impact trajectory. Automated interceptor Aegis-IV must execute an Oberth gravity slingshot around Mars and perform a precision hypervelocity kinetic collision at 6.2 km/s.
                  </p>
                  <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", padding: "12px", border: "1px solid rgba(245, 158, 11, 0.3)" }}>
                    <strong style={{ color: "#f59e0b", letterSpacing: "0.5px" }}>KINETIC IMPACT DIRECTIVES:</strong>
                    <ol style={{ paddingLeft: "18px", margin: "6px 0 0 0", display: "flex", flexDirection: "column", gap: "4px" }}>
                      <li><strong>Mars Slingshot Maneuver:</strong> Time retrograde burn for Oberth effect amplification, reaching 11.4 km/s egress velocity.</li>
                      <li><strong>Autonomous SMART Nav:</strong> Under 14-minute lightspeed radio delay, lock optical LIDAR tracking on asteroid center-of-mass.</li>
                      <li><strong>Terminal 6.2 km/s Run:</strong> Fire cold-gas micro-thrusters to counter solar radiation pressure drift and impact within 3 meters of target boulder.</li>
                      <li><strong>LICIACube Damage Assessment:</strong> Eject companion CubeSat observer to photograph ejecta plume and measure 73-second orbital period deflection.</li>
                    </ol>
                  </div>
                </div>
              </>
            )}

            {selectedCampaignTab === "EUROPA" && (
              <>
                <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span className="font-mono" style={{ fontSize: "11px", color: "#818cf8", fontWeight: 700, letterSpacing: "1px" }}>
                      EXTREMO-ASTROBIOLOGY // PROJECT EUROPA ABYSS
                    </span>
                    <span className="font-mono" style={{ fontSize: "10px", backgroundColor: "rgba(99, 102, 241, 0.2)", color: "#a5b4fc", padding: "2px 8px", border: "1px solid rgba(99, 102, 241, 0.4)", fontWeight: 700 }}>
                      JOVIAN RADIATION: 400 RAD/H
                    </span>
                  </div>
                  <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#f8fafc", marginTop: "6px" }}>
                    Deep Subsurface Ocean &amp; Hydrothermal Vent Biosignatures
                  </h2>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px", color: "#cbd5e1", lineHeight: 1.5 }}>
                  <p>
                    <strong>ASTROBIOLOGY DISCOVERY:</strong> Jupiter&apos;s ice moon Europa conceals a 100km-deep liquid saltwater ocean beneath a 20km cryogenic ice crust. Mission Deep-Valkyrie must survive Jovian radiation belts, melt through the ice shell via nuclear thermal probe, and navigate an abyssal submarine to hydrothermal black smokers.
                  </p>
                  <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", padding: "12px", border: "1px solid rgba(99, 102, 241, 0.3)" }}>
                    <strong style={{ color: "#818cf8", letterSpacing: "0.5px" }}>ABYSSAL EXPLORATION DIRECTIVES:</strong>
                    <ol style={{ paddingLeft: "18px", margin: "6px 0 0 0", display: "flex", flexDirection: "column", gap: "4px" }}>
                      <li><strong>Jovian Flux Evasion:</strong> Orient lead-Kevlar shielding along magnetic flux lines to protect mission avionics.</li>
                      <li><strong>Chaos Terrain Landing:</strong> Avoid 15-meter jagged penitente ice blades; target smooth thermal fracture zone.</li>
                      <li><strong>Nuclear Cryo-Drill Melt:</strong> Engage 900°C thermal probe to melt through 20km cryogenic ice, navigating pressurized methane gas pockets.</li>
                      <li><strong>Abyssal Submersible Sonar:</strong> Pilot 6-DOF submersible through 130 MPa pitch-black ocean, locate volcanic vents, and sample extraterrestrial microbial RNA.</li>
                    </ol>
                  </div>
                </div>
              </>
            )}

            <button
              onClick={onCloseBriefing}
              style={{
                padding: "12px 24px",
                backgroundColor: selectedCampaignTab === "ARTEMIS" ? "#0284c7" : selectedCampaignTab === "AEGIS" ? "#b45309" : "#4f46e5",
                color: "#f8fafc",
                border: selectedCampaignTab === "ARTEMIS" ? "1px solid #38bdf8" : selectedCampaignTab === "AEGIS" ? "1px solid #f59e0b" : "1px solid #818cf8",
                fontSize: "12px",
                fontWeight: 700,
                cursor: "pointer",
                alignSelf: "flex-end",
                letterSpacing: "0.5px",
                boxShadow: "0 0 15px rgba(0, 0, 0, 0.5)",
              }}
            >
              ACCEPT DIRECTIVE // COMMENCE {selectedCampaignTab === "ARTEMIS" ? "ARTEMIS-VII" : selectedCampaignTab === "AEGIS" ? "PROJECT AEGIS" : "PROJECT EUROPA"} →
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MISSION COMPLETE DEBRIEFING MODAL                                    */}
      {/* ==================================================================== */}
      {gameState.step === "MISSION_COMPLETE" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(6, 8, 12, 0.85)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
            zIndex: 120,
          }}
        >
          <div
            style={{
              maxWidth: "640px",
              width: "100%",
              backgroundColor: "rgba(15, 23, 42, 0.98)",
              border: "1px solid #22c55e",
              padding: "32px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              boxShadow: "0 0 50px rgba(34, 197, 94, 0.2)",
            }}
          >
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "12px" }}>
              <span className="font-mono" style={{ fontSize: "11px", color: "#22c55e", fontWeight: 700, letterSpacing: "1px" }}>
                MISSION DEBRIEFING // OPERATION ARTEMIS-VII: COMPLETE (GRADE: A+)
              </span>
              <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#f8fafc", marginTop: "4px" }}>
                Deep Space Relay Online &amp; Lunar Base Alpha Secured
              </h2>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
                fontSize: "12px",
              }}
            >
              <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", padding: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span style={{ color: "#94a3b8" }}>Mission Elapsed Time:</span>
                <div className="font-mono" style={{ fontSize: "16px", fontWeight: 700, color: "#f8fafc" }}>
                  {formatMet(gameState.missionMetSeconds)}
                </div>
              </div>

              <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", padding: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span style={{ color: "#94a3b8" }}>Suit Oxygen Remaining:</span>
                <div className="font-mono" style={{ fontSize: "16px", fontWeight: 700, color: "#22c55e" }}>
                  {gameState.oxygenPercent.toFixed(1)}%
                </div>
              </div>

              <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", padding: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span style={{ color: "#94a3b8" }}>AERO-3X Telemetry:</span>
                <div className="font-mono" style={{ fontSize: "16px", fontWeight: 700, color: "#38bdf8" }}>
                  +8.4 dB Link Margin (Active)
                </div>
              </div>

              <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", padding: "10px", border: "1px solid rgba(255,255,255,0.08)" }}>
                <span style={{ color: "#94a3b8" }}>Docking Velocity:</span>
                <div className="font-mono" style={{ fontSize: "16px", fontWeight: 700, color: "#22c55e" }}>
                  {gameState.spacecraft.speedMps.toFixed(2)} m/s (Soft Capture)
                </div>
              </div>
            </div>

            <div
              style={{
                backgroundColor: "rgba(34, 197, 94, 0.1)",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                padding: "14px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "11px", color: "#86efac", fontWeight: 600 }}>FLIGHT DIRECTOR EVALUATION</div>
                <div style={{ fontSize: "13px", color: "#f8fafc", marginTop: "2px" }}>
                  All objectives met within safety limits. Spacecraft restored to operational status.
                </div>
              </div>
              <div className="font-mono" style={{ fontSize: "24px", fontWeight: 700, color: "#22c55e" }}>
                {gameState.score} PTS
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
              <button
                onClick={onRestartMission}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "rgba(30, 41, 59, 0.8)",
                  color: "#f8fafc",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Restart Mission
              </button>
              <button
                onClick={() => onReturnToHub?.()}
                style={{
                  padding: "10px 20px",
                  backgroundColor: "#22c55e",
                  color: "#052e16",
                  border: "1px solid #86efac",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Return to Flight Operations Hub →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* MISSION FAILED MODAL                                                 */}
      {/* ==================================================================== */}
      {gameState.step === "MISSION_FAILED" && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundColor: "rgba(6, 8, 12, 0.9)",
            backdropFilter: "blur(10px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
            zIndex: 130,
          }}
        >
          <div
            style={{
              maxWidth: "500px",
              width: "100%",
              backgroundColor: "rgba(24, 18, 18, 0.98)",
              border: "1px solid #ef4444",
              padding: "32px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              boxShadow: "0 0 50px rgba(239, 68, 68, 0.3)",
              textAlign: "center",
            }}
          >
            <div>
              <span className="font-mono" style={{ fontSize: "11px", color: "#ef4444", fontWeight: 700 }}>
                MISSION ABORTED // CRITICAL FAILURE
              </span>
              <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#f8fafc", marginTop: "6px" }}>
                Astronaut Life Support Depleted
              </h2>
              <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "10px", lineHeight: 1.5 }}>
                Suit oxygen or auxiliary power reached zero before mission completion. Always monitor consumables and refill at the Command Deck Life Support Station prior to EVA.
              </p>
            </div>

            <div style={{ display: "flex", justifyContent: "center", gap: "12px" }}>
              <button
                onClick={onRestartMission}
                style={{
                  padding: "10px 24px",
                  backgroundColor: "#ef4444",
                  color: "#f8fafc",
                  border: "1px solid #f87171",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Restart Mission
              </button>
              <button
                onClick={() => onReturnToHub?.()}
                style={{
                  padding: "10px 24px",
                  backgroundColor: "rgba(30, 41, 59, 0.8)",
                  color: "#f8fafc",
                  border: "1px solid rgba(255, 255, 255, 0.15)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Return to Hub
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* CONTROLS QUICK-REFERENCE MODAL (HOTKEY [C])                          */}
      {/* ==================================================================== */}
      {gameState.showControlsOverlay && (
        <div
          onClick={() => onToggleControlsOverlay?.()}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(3, 7, 18, 0.88)",
            backdropFilter: "blur(8px)",
            zIndex: 100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "auto",
            padding: "20px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "820px",
              maxHeight: "90vh",
              overflowY: "auto",
              backgroundColor: "rgba(15, 23, 42, 0.98)",
              border: "1px solid #38bdf8",
              boxShadow: "0 25px 60px rgba(0, 0, 0, 0.85), 0 0 20px rgba(56, 189, 248, 0.2)",
              padding: "28px 32px",
              display: "flex",
              flexDirection: "column",
              gap: "20px",
              borderRadius: "2px",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid rgba(255, 255, 255, 0.12)", paddingBottom: "16px" }}>
              <div>
                <div className="font-mono" style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                  NASA ASTRONAUT &amp; FLIGHT OPERATIONS MANUAL // REV 4.2
                </div>
                <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#f8fafc", margin: "4px 0 0" }}>
                  FLIGHT &amp; EVA CONTROLS CHEAT SHEET
                </h2>
              </div>
              <button
                onClick={() => onToggleControlsOverlay?.()}
                style={{
                  padding: "6px 14px",
                  backgroundColor: "rgba(239, 68, 68, 0.15)",
                  border: "1px solid #ef4444",
                  color: "#f87171",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                CLOSE [C / ESC]
              </button>
            </div>

            {/* Quick Sector Transfer Callout */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: isSurface ? "rgba(245, 158, 11, 0.12)" : "rgba(34, 197, 94, 0.12)",
                border: isSurface ? "1px solid rgba(245, 158, 11, 0.4)" : "1px solid rgba(34, 197, 94, 0.4)",
                padding: "12px 16px",
                borderRadius: "2px",
              }}
            >
              <div>
                <div style={{ fontSize: "11px", color: "#94a3b8", fontWeight: 600 }}>CURRENT SECTOR LOCATION</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: isSurface ? "#fbbf24" : "#4ade80" }}>
                  {isSurface ? "LUNAR BASE ALPHA (0.166g GRAVITY)" : "GATEWAY-1 ORBITAL STATION (MICROGRAVITY)"}
                </div>
              </div>
              <button
                onClick={() => {
                  onToggleSector?.();
                  onToggleControlsOverlay?.();
                }}
                style={{
                  padding: "8px 18px",
                  backgroundColor: isSurface ? "#d97706" : "#15803d",
                  border: "none",
                  color: "#f8fafc",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                  letterSpacing: "0.03em",
                }}
              >
                {isSurface ? "[T] ASCEND TO GATEWAY-1 STATION" : "[T] DESCEND TO LUNAR SURFACE"}
              </button>
            </div>

            {/* Two-Column Grid: EVA vs Flight */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
              {/* Section 1: Astronaut EVA */}
              <div
                style={{
                  backgroundColor: "rgba(30, 41, 59, 0.5)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div className="font-mono" style={{ fontSize: "12px", color: "#38bdf8", fontWeight: 700, borderBottom: "1px solid rgba(56, 189, 248, 0.2)", paddingBottom: "6px" }}>
                  1. ASTRONAUT EVA &amp; STATION
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 600 }}>W / A / S / D</span>
                    <span style={{ color: "#94a3b8" }}>Move / RCS translation</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 600 }}>SPACE</span>
                    <span style={{ color: "#94a3b8" }}>Jump / RCS Thrust UP</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 600 }}>CTRL / X / Z</span>
                    <span style={{ color: "#94a3b8" }}>RCS Thrust DOWN (EVA)</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 600 }}>LEFT SHIFT</span>
                    <span style={{ color: "#94a3b8" }}>Sprint / RCS Boost</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 600 }}>MOUSE</span>
                    <span style={{ color: "#94a3b8" }}>Look Pitch / Yaw</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 600 }}>E</span>
                    <span style={{ color: "#94a3b8" }}>Interact / Repair / Airlock</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 600 }}>F</span>
                    <span style={{ color: "#94a3b8" }}>Toggle Helmet Flashlight</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 600 }}>1 / 2 / 3</span>
                    <span style={{ color: "#94a3b8" }}>Equip Tools / Subsystems</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#38bdf8", fontWeight: 700 }}>G</span>
                    <span style={{ color: "#f8fafc", fontWeight: 600 }}>Toggle Mag-Boots Lock (Firm Walk vs Float)</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#ef4444", fontWeight: 700 }}>R / B</span>
                    <span style={{ color: "#f8fafc", fontWeight: 600 }}>Auto-Retether to Gantry Deck</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#38bdf8", fontWeight: 700 }}>C</span>
                    <span style={{ color: "#94a3b8" }}>Toggle Controls Cheat Sheet (Anytime)</span>
                  </div>
                </div>
              </div>

              {/* Section 2: Spacecraft Cockpit */}
              <div
                style={{
                  backgroundColor: "rgba(30, 41, 59, 0.5)",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                }}
              >
                <div className="font-mono" style={{ fontSize: "12px", color: "#38bdf8", fontWeight: 700, borderBottom: "1px solid rgba(56, 189, 248, 0.2)", paddingBottom: "6px" }}>
                  2. SPACECRAFT FLIGHT (SHUTTLE ORV-1)
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 600 }}>W / S</span>
                    <span style={{ color: "#94a3b8" }}>Throttle Main Engine Forward / Retro</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 600 }}>A / D</span>
                    <span style={{ color: "#94a3b8" }}>RCS Yaw Left / Right</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 600 }}>Q / E</span>
                    <span style={{ color: "#94a3b8" }}>RCS Roll Port / Starboard</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 600 }}>MOUSE / ARROWS</span>
                    <span style={{ color: "#94a3b8" }}>Pitch &amp; Flight Attitude</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 600 }}>SPACE</span>
                    <span style={{ color: "#94a3b8" }}>RCS Kill-Rot / Aerobrake</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 600 }}>G</span>
                    <span style={{ color: "#94a3b8" }}>Toggle Landing Gear Down/Up</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 600 }}>V</span>
                    <span style={{ color: "#94a3b8" }}>Switch Cockpit &amp; Chase View</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span className="font-mono" style={{ color: "#f8fafc", fontWeight: 600 }}>H / ENTER</span>
                    <span style={{ color: "#94a3b8" }}>Disembark / Docking Lock</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer with resume button */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", borderTop: "1px solid rgba(255, 255, 255, 0.1)", paddingTop: "16px" }}>
              <button
                onClick={() => onToggleControlsOverlay?.()}
                style={{
                  padding: "10px 24px",
                  backgroundColor: "#0284c7",
                  border: "1px solid #38bdf8",
                  color: "#f8fafc",
                  fontSize: "12px",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                RESUME GAMEPLAY
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
