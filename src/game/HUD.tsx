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
  onReturnToHub?: () => void;
  onToggleFlashlight?: () => void;
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
  onReturnToHub,
  onToggleFlashlight,
}: HUDProps) {
  const [hasEntered, setHasEntered] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

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
  ];

  const isCockpit = gameState.controlMode === "SPACECRAFT_COCKPIT";
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
      {/* ==================================================================== */}
      {/* TOP BAR: OBJECTIVE, TELEMETRY & SYSTEM CONTROLS                      */}
      {/* ==================================================================== */}
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
            {/* Flight Crosshair Diamond */}
            <div
              style={{
                width: "24px",
                height: "24px",
                border: "1px solid rgba(56, 189, 248, 0.6)",
                transform: "rotate(45deg)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <div
                style={{
                  width: "4px",
                  height: "4px",
                  backgroundColor: "#38bdf8",
                  borderRadius: "50%",
                }}
              />
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
                  ✓ ENGAGE DOCKING LATCH (ENTER)
                </button>
                <span style={{ fontSize: "10px", color: "#86efac", fontWeight: 600 }}>
                  Soft capture envelope aligned (&lt;2.5 m/s, &lt;25°)
                </span>
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
            {/* Left Cluster: Propulsion & Power */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                backgroundColor: "rgba(18, 22, 28, 0.9)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                padding: "10px 14px",
                minWidth: "200px",
                backdropFilter: "blur(6px)",
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

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginTop: "4px" }}>
                <span style={{ color: "#94a3b8" }}>SPEED</span>
                <span className="font-mono" style={{ fontWeight: 600, color: "#f8fafc" }}>
                  {gameState.spacecraft.speedMps.toFixed(2)} m/s
                </span>
              </div>
            </div>

            {/* Center Cluster: Docking Radar */}
            <div
              style={{
                display: "flex",
                gap: "18px",
                backgroundColor: "rgba(18, 22, 28, 0.9)",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                padding: "10px 18px",
                fontSize: "11px",
                backdropFilter: "blur(6px)",
              }}
            >
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

            {/* Right Cluster: Disembark & Cockpit Controls */}
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
                  backgroundColor: "rgba(30, 41, 59, 0.9)",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  color: "#f8fafc",
                  fontSize: "11px",
                  fontWeight: 600,
                  cursor: "pointer",
                  backdropFilter: "blur(6px)",
                }}
              >
                [H] Disembark / Exit Cockpit
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
                <span>A/D Yaw</span>
                <span>Q/E Roll</span>
                <span>Space/C Vert RCS</span>
                <span>X Brake</span>
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

            {/* Controls Reference */}
            <div
              style={{
                backgroundColor: "rgba(18, 22, 28, 0.85)",
                border: "1px solid rgba(255,255,255,0.12)",
                padding: "8px 12px",
                fontSize: "10px",
                color: "#94a3b8",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                backdropFilter: "blur(6px)",
              }}
            >
              <div>WASD Move · Shift Sprint · Space Jump</div>
              <div>E Interact · F Flashlight · 1-3 Equip</div>
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
                  }}
                >
                  MISSION 01: ORBITAL REPAIR &amp; RETURN
                </h1>
                <p style={{ fontSize: "12px", color: "#94a3b8", lineHeight: 1.5 }}>
                  A dual-phase first-person 3D space mission. Explore the station on foot, perform zero-g EVA to repair the damaged Earth Sentinel CubeSat, then pilot the orbital shuttle ORV-1 in cockpit flight mode and dock back with the station.
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
            <div style={{ borderBottom: "1px solid rgba(255,255,255,0.1)", paddingBottom: "12px" }}>
              <span className="font-mono" style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 700 }}>
                FLIGHT OPERATIONS BRIEFING // MISSION 01: REPAIR &amp; RETURN
              </span>
              <h2 style={{ fontSize: "20px", fontWeight: 700, color: "#f8fafc", marginTop: "4px" }}>
                Target: AERO-3X Earth Observation Sentinel
              </h2>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px", color: "#cbd5e1", lineHeight: 1.5 }}>
              <p>
                <strong>Situation:</strong> The AERO-3X Earth observation CubeSat in Berth 1 suffered orbital micrometeoroid damage. The primary solar wing is shattered and the S-Band telemetry patch antenna is offline.
              </p>
              <div style={{ backgroundColor: "rgba(30, 41, 59, 0.6)", padding: "12px", border: "1px solid rgba(255,255,255,0.08)" }}>
                <strong style={{ color: "#38bdf8" }}>Primary Directives:</strong>
                <ol style={{ paddingLeft: "18px", margin: "6px 0 0 0" }}>
                  <li>Enter the Engineering Workshop and collect the Toolkit, GaAs Solar Wing (28W), and S-Band Transceiver.</li>
                  <li>Proceed to the Airlock Chamber and depressurize to vacuum.</li>
                  <li>Perform zero-g EVA along the exterior gantry to satellite AERO-3X.</li>
                  <li>Detach the broken wing, mount the replacement wing and transceiver, and run avionics diagnostics.</li>
                  <li>Board the orbital utility shuttle ORV-1 at Berth 2, pilot it into orbital space, and execute precision soft docking at Station Port DOCK-01.</li>
                </ol>
              </div>
            </div>

            <button
              onClick={onCloseBriefing}
              style={{
                padding: "12px 20px",
                backgroundColor: "#0284c7",
                color: "#f8fafc",
                border: "1px solid #38bdf8",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                alignSelf: "flex-end",
              }}
            >
              Acknowledge &amp; Enter Workshop →
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
              <span className="font-mono" style={{ fontSize: "11px", color: "#22c55e", fontWeight: 700 }}>
                MISSION 01 COMPLETE // GRADE: A+ MASTER ASTRONAUT
              </span>
              <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#f8fafc", marginTop: "4px" }}>
                Orbital Repair &amp; Precision Docking Accomplished
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
    </div>
  );
}
