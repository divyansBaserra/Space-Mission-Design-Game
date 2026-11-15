"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";
import { GameCanvas } from "./GameCanvas";
import { HUD } from "./HUD";
import { GameState, InventoryItemId, GameSettings } from "./types";
import { StationPhysics } from "./physics";
import { soundManager } from "./audio";

const INITIAL_SETTINGS: GameSettings = {
  mouseSensitivity: 1.0,
  soundVolume: 80,
  graphicsQuality: "HIGH",
  invertY: false,
};

const INITIAL_GAME_STATE: GameState = {
  controlMode: "ASTRONAUT",
  step: "BRIEFING",
  substepText: "Visit the Command Deck Terminal [E] to review the Mission 01 Briefing.",
  inventory: [],
  equippedItem: null,
  settings: INITIAL_SETTINGS,
  oxygenPercent: 100,
  suitPowerPercent: 100,
  flashlightOn: false,
  isEva: false,
  airlockStatus: "PRESSURIZED",
  airlockProgress: 1.0,
  airlockInnerDoorOpen: true,
  airlockOuterDoorOpen: false,
  satellite: {
    wingRemoved: false,
    wingMounted: false,
    antennaMounted: false,
    diagnosticRun: false,
  },
  spacecraft: {
    position: new THREE.Vector3(0, 1.0, -28.0),
    velocity: new THREE.Vector3(0, 0, 0),
    pitch: 0,
    yaw: 0,
    roll: 0,
    propellantPercent: 100,
    powerPercent: 100,
    speedMps: 0,
    distanceToDockMeters: 16.8,
    relativeVelocityMps: 0,
    alignmentAngleDeg: 0,
    isDocked: false,
    dockingTargetPos: new THREE.Vector3(0, 1.5, -11.2),
  },
  missionMetSeconds: 0,
  score: 0,
  paused: false,
  interactionTarget: null,
  interactionPrompt: null,
};

interface GameManagerProps {
  onReturnToHub?: () => void;
}

export function GameManager({ onReturnToHub }: GameManagerProps) {
  const physics = useMemo(() => new StationPhysics(), []);

  const [gameState, setGameState] = useState<GameState>(INITIAL_GAME_STATE);
  const [isPointerLocked, setIsPointerLocked] = useState<boolean>(false);
  const [showBriefingModal, setShowBriefingModal] = useState<boolean>(false);

  // Sync initial sound volume
  useEffect(() => {
    soundManager.setVolume(INITIAL_SETTINGS.soundVolume);
  }, []);

  // MET and Vitals timer loop
  useEffect(() => {
    if (
      gameState.step === "MISSION_COMPLETE" ||
      gameState.step === "MISSION_FAILED" ||
      gameState.paused
    ) {
      return;
    }

    const interval = setInterval(() => {
      setGameState((prev) => {
        if (prev.paused) return prev;

        const nextMet = prev.missionMetSeconds + 1;
        let nextO2 = prev.oxygenPercent;
        let nextPwr = prev.suitPowerPercent;

        // Oxygen consumption in EVA (~0.18% per second = ~9 minutes of air)
        if (prev.isEva && prev.controlMode === "ASTRONAUT") {
          nextO2 = Math.max(0, prev.oxygenPercent - 0.2);
          if (nextO2 < 20 && Math.floor(nextO2) % 5 === 0) {
            soundManager.playWarningBeep();
          }
        }

        // Power consumption (flashlight uses 0.1%/sec)
        if (prev.flashlightOn && prev.controlMode === "ASTRONAUT") {
          nextPwr = Math.max(0, prev.suitPowerPercent - 0.1);
        }

        // Check oxygen failure
        if (prev.isEva && prev.controlMode === "ASTRONAUT" && nextO2 <= 0) {
          soundManager.playWarningBeep();
          return {
            ...prev,
            oxygenPercent: 0,
            step: "MISSION_FAILED",
            substepText: "CRITICAL FAILURE: Suit life support exhausted.",
          };
        }

        return {
          ...prev,
          missionMetSeconds: nextMet,
          oxygenPercent: nextO2,
          suitPowerPercent: nextPwr,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.step, gameState.paused]);

  // Restart Mission handler
  const handleRestartMission = useCallback(() => {
    setGameState((prev) => ({
      ...INITIAL_GAME_STATE,
      settings: prev.settings, // Preserve player settings
      spacecraft: {
        ...INITIAL_GAME_STATE.spacecraft,
        position: new THREE.Vector3(0, 1.0, -28.0),
        velocity: new THREE.Vector3(0, 0, 0),
        dockingTargetPos: new THREE.Vector3(0, 1.5, -11.2),
      },
    }));
    setShowBriefingModal(false);
  }, []);

  // Flashlight toggle
  const handleToggleFlashlight = useCallback(() => {
    setGameState((prev) => ({
      ...prev,
      flashlightOn: !prev.flashlightOn,
    }));
  }, []);

  // Pause toggle
  const handleTogglePause = useCallback(() => {
    setGameState((prev) => ({
      ...prev,
      paused: !prev.paused,
    }));
  }, []);

  // Settings update
  const handleUpdateSettings = useCallback((newSettings: Partial<GameSettings>) => {
    setGameState((prev) => {
      const merged: GameSettings = { ...prev.settings, ...newSettings };
      if (typeof newSettings.soundVolume === "number") {
        soundManager.setVolume(newSettings.soundVolume);
      }
      return {
        ...prev,
        settings: merged,
      };
    });
  }, []);

  // Equip item toggle
  const handleEquipItem = useCallback((id: InventoryItemId) => {
    setGameState((prev) => {
      if (!prev.inventory.includes(id)) return prev;
      soundManager.playEquip();
      const isAlreadyEquipped = prev.equippedItem === id;
      return {
        ...prev,
        equippedItem: isAlreadyEquipped ? null : id,
      };
    });
  }, []);

  // Disembark / Exit Cockpit back to astronaut mode
  const handleExitCockpit = useCallback(() => {
    setGameState((prev) => {
      if (prev.controlMode !== "SPACECRAFT_COCKPIT") return prev;
      soundManager.playPickup();
      return {
        ...prev,
        controlMode: "ASTRONAUT",
        step: prev.spacecraft.isDocked ? "MISSION_COMPLETE" : "EVA_APPROACH_SATELLITE",
        substepText: prev.spacecraft.isDocked
          ? "Hard capture locked. Disembarked at Gateway-1 docking port."
          : "Exited shuttle cockpit onto exterior gantry.",
      };
    });
  }, []);

  // Update dynamic interaction prompt from player raycast
  const handleSetInteractionPrompt = useCallback(
    (target: string | null, prompt: string | null) => {
      setGameState((prev) => {
        if (prev.interactionTarget === target && prev.interactionPrompt === prompt) {
          return prev;
        }
        return {
          ...prev,
          interactionTarget: target,
          interactionPrompt: prompt,
        };
      });
    },
    []
  );

  // Execute player interaction [E]
  const handleInteract = useCallback(
    (targetId: string) => {
      setGameState((prev) => {
        // 1. Briefing Table
        if (targetId === "briefing_table") {
          setShowBriefingModal(true);
          soundManager.playPickup();
          return prev;
        }

        // 2. Workshop Left Table: Toolkit
        if (targetId === "ws_toolkit" && !prev.inventory.includes("TOOLKIT")) {
          const nextInv: InventoryItemId[] = [...prev.inventory, "TOOLKIT"];
          soundManager.playPickup();
          const allCollected =
            nextInv.includes("TOOLKIT") &&
            nextInv.includes("SOLAR_WING") &&
            nextInv.includes("SBAND_ANTENNA");

          return {
            ...prev,
            inventory: nextInv,
            equippedItem: "TOOLKIT",
            step: allCollected ? "ENTER_AIRLOCK" : "COLLECT_EQUIPMENT",
            substepText: allCollected
              ? "All repair equipment collected! Proceed to the Airlock chamber."
              : `Collected Aerospace Toolkit (${nextInv.length}/3 items). Equipped [1].`,
          };
        }

        // 3. Workshop Right Table: Solar Wing
        if (targetId === "ws_solar_wing" && !prev.inventory.includes("SOLAR_WING")) {
          const nextInv: InventoryItemId[] = [...prev.inventory, "SOLAR_WING"];
          soundManager.playPickup();
          const allCollected =
            nextInv.includes("TOOLKIT") &&
            nextInv.includes("SOLAR_WING") &&
            nextInv.includes("SBAND_ANTENNA");

          return {
            ...prev,
            inventory: nextInv,
            equippedItem: "SOLAR_WING",
            step: allCollected ? "ENTER_AIRLOCK" : "COLLECT_EQUIPMENT",
            substepText: allCollected
              ? "All repair equipment collected! Proceed to the Airlock chamber."
              : `Collected GaAs Solar Wing (${nextInv.length}/3 items). Equipped [2].`,
          };
        }

        // 4. Workshop Right Table: S-Band Antenna
        if (targetId === "ws_sband_antenna" && !prev.inventory.includes("SBAND_ANTENNA")) {
          const nextInv: InventoryItemId[] = [...prev.inventory, "SBAND_ANTENNA"];
          soundManager.playPickup();
          const allCollected =
            nextInv.includes("TOOLKIT") &&
            nextInv.includes("SOLAR_WING") &&
            nextInv.includes("SBAND_ANTENNA");

          return {
            ...prev,
            inventory: nextInv,
            equippedItem: "SBAND_ANTENNA",
            step: allCollected ? "ENTER_AIRLOCK" : "COLLECT_EQUIPMENT",
            substepText: allCollected
              ? "All repair equipment collected! Proceed to the Airlock chamber."
              : `Collected S-Band Transceiver (${nextInv.length}/3 items). Equipped [3].`,
          };
        }

        // 5. Airlock Console
        if (targetId === "airlock_console") {
          if (prev.airlockStatus === "PRESSURIZED") {
            soundManager.playAirlockAlarm();
            soundManager.playVentingHiss();

            setTimeout(() => {
              setGameState((s) => ({
                ...s,
                airlockStatus: "VACUUM",
                airlockInnerDoorOpen: false,
                airlockOuterDoorOpen: true,
                isEva: true,
                step: "EVA_APPROACH_SATELLITE",
                substepText:
                  "Airlock depressurized. Spacewalk outside along the gantry to the damaged satellite.",
              }));
              soundManager.playAirlockAlarm();
            }, 2200);

            return {
              ...prev,
              airlockStatus: "CYCLING_DEPRESS",
              airlockInnerDoorOpen: false,
              airlockOuterDoorOpen: false,
              substepText: "Airlock cycling: Depressurizing to vacuum...",
            };
          } else if (prev.airlockStatus === "VACUUM") {
            soundManager.playAirlockAlarm();
            soundManager.playVentingHiss();

            setTimeout(() => {
              setGameState((s) => ({
                ...s,
                airlockStatus: "PRESSURIZED",
                airlockInnerDoorOpen: true,
                airlockOuterDoorOpen: false,
                isEva: false,
                step: s.satellite.diagnosticRun ? "BOARD_SPACECRAFT" : "COLLECT_EQUIPMENT",
                substepText: s.satellite.diagnosticRun
                  ? "Satellite restored! Board the orbital utility shuttle ORV-1 for flight test."
                  : "Station repressurized.",
              }));
              soundManager.playSuccessFanfare();
            }, 2200);

            return {
              ...prev,
              airlockStatus: "CYCLING_REPRESS",
              airlockInnerDoorOpen: false,
              airlockOuterDoorOpen: false,
              substepText: "Airlock cycling: Repressurizing to 1.0 atm...",
            };
          }
        }

        // 6. Damaged Satellite `AERO-3X`
        if (targetId === "satellite_repair") {
          // Subtask A: Detach broken wing
          if (!prev.satellite.wingRemoved) {
            if (!prev.inventory.includes("TOOLKIT")) {
              return {
                ...prev,
                substepText: "Cannot detach wing: Aerospace Toolkit required! Equip [1].",
              };
            }
            soundManager.playRepairClank();
            return {
              ...prev,
              satellite: { ...prev.satellite, wingRemoved: true },
              step: "REPAIR_SATELLITE",
              substepText: "Damaged wing detached. Mount replacement GaAs solar array [E].",
            };
          }

          // Subtask B: Mount new solar array
          if (!prev.satellite.wingMounted) {
            if (!prev.inventory.includes("SOLAR_WING")) {
              return {
                ...prev,
                substepText: "Cannot mount array: GaAs Solar Wing required! Equip [2].",
              };
            }
            soundManager.playRepairClank();
            return {
              ...prev,
              satellite: { ...prev.satellite, wingMounted: true },
              step: "REPAIR_SATELLITE",
              substepText: "GaAs solar wing secured! Install S-Band transceiver antenna [E].",
            };
          }

          // Subtask C: Install antenna
          if (!prev.satellite.antennaMounted) {
            if (!prev.inventory.includes("SBAND_ANTENNA")) {
              return {
                ...prev,
                substepText: "Cannot install antenna: S-Band Transceiver required! Equip [3].",
              };
            }
            soundManager.playRepairClank();
            return {
              ...prev,
              satellite: { ...prev.satellite, antennaMounted: true },
              step: "REPAIR_SATELLITE",
              substepText: "Antenna installed! Run avionics telemetry diagnostics [E].",
            };
          }

          // Subtask D: Run telemetry diagnostics
          if (!prev.satellite.diagnosticRun) {
            soundManager.playBeaconChime();
            return {
              ...prev,
              satellite: { ...prev.satellite, diagnosticRun: true },
              step: "BOARD_SPACECRAFT",
              substepText:
                "Avionics diagnostic nominal! Comms locked. Return along gantry and board Shuttle ORV-1 [E].",
            };
          }
        }

        // 7. Life Support Recharging Station (Command Deck West Wall)
        if (targetId === "life_support") {
          soundManager.playRefillChime();
          return {
            ...prev,
            oxygenPercent: 100,
            suitPowerPercent: 100,
            substepText: "Suit oxygen replenished (100%) and auxiliary battery recharged.",
          };
        }

        // 8. Board Shuttle ORV-1 (Gantry Berth)
        if (targetId === "board_spacecraft") {
          if (!prev.satellite.diagnosticRun) {
            return {
              ...prev,
              substepText: "Shuttle on pre-flight standby: Repair satellite AERO-3X first.",
            };
          }

          soundManager.playEngineRoar();
          return {
            ...prev,
            controlMode: "SPACECRAFT_COCKPIT",
            step: "COCKPIT_ORBITAL_MANEUVER",
            substepText:
              "Systems online in ORV-1 cockpit! Maneuver into orbital position and align for docking.",
          };
        }

        return prev;
      });
    },
    []
  );

  // Close Briefing Modal
  const handleCloseBriefing = useCallback(() => {
    setShowBriefingModal(false);
    setGameState((prev) => {
      if (prev.step === "BRIEFING") {
        return {
          ...prev,
          step: "COLLECT_EQUIPMENT",
          substepText:
            "Go to the Engineering Workshop and collect repair hardware: Toolkit, Solar Wing, and Antenna (0/3).",
        };
      }
      return prev;
    });
  }, []);

  // Request pointer lock
  const handleRequestPointerLock = useCallback(() => {
    setIsPointerLocked(true);
    const canvas = document.querySelector("canvas");
    if (canvas) {
      try {
        const p = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
        if (p && typeof p.catch === "function") {
          p.catch(() => {});
        }
      } catch {
        // Pointer lock best-effort in webview/headless
      }
    }
  }, []);

  // Spacecraft telemetry updates from SpacecraftFlight
  const handleUpdateSpacecraft = useCallback(
    (
      pos: THREE.Vector3,
      vel: THREE.Vector3,
      pitch: number,
      yaw: number,
      roll: number,
      propellant: number,
      power: number,
      speed: number,
      distToDock: number,
      relVel: number,
      alignAngle: number
    ) => {
      setGameState((prev) => {
        if (prev.controlMode !== "SPACECRAFT_COCKPIT") return prev;

        let nextStep = prev.step;
        let nextSubstep = prev.substepText;

        if (prev.step === "COCKPIT_ORBITAL_MANEUVER" && distToDock < 15.0) {
          nextStep = "APPROACH_DOCKING_PORT";
          nextSubstep =
            "Align shuttle nose with Station Docking Port DOCK-01 (<2.5 m/s, <25° error).";
        }

        return {
          ...prev,
          step: nextStep,
          substepText: nextSubstep,
          spacecraft: {
            ...prev.spacecraft,
            position: pos,
            velocity: vel,
            pitch,
            yaw,
            roll,
            propellantPercent: propellant,
            powerPercent: power,
            speedMps: speed,
            distanceToDockMeters: distToDock,
            relativeVelocityMps: relVel,
            alignmentAngleDeg: alignAngle,
          },
        };
      });
    },
    []
  );

  // Docking capture handler
  const handleDockComplete = useCallback(() => {
    setGameState((prev) => {
      if (prev.step === "MISSION_COMPLETE") return prev;

      const baseScore = 1000;
      const timeBonus = Math.max(0, 600 - prev.missionMetSeconds * 2);
      const propBonus = Math.round(prev.spacecraft.propellantPercent * 4);
      const o2Bonus = Math.round(prev.oxygenPercent * 3);
      const finalScore = baseScore + timeBonus + propBonus + o2Bonus;

      return {
        ...prev,
        step: "MISSION_COMPLETE",
        score: finalScore,
        substepText:
          "HARD CAPTURE CONFIRMED! Orbital Shuttle ORV-1 securely docked at Station Port DOCK-01.",
        spacecraft: {
          ...prev.spacecraft,
          isDocked: true,
        },
      };
    });
  }, []);

  // Manual Dock button handler
  const handleManualDock = useCallback(() => {
    soundManager.playDockingLatch();
    soundManager.playSuccessFanfare();
    handleDockComplete();
  }, [handleDockComplete]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      <GameCanvas
        gameState={gameState}
        physics={physics}
        onInteract={handleInteract}
        onToggleFlashlight={handleToggleFlashlight}
        onSetInteractionPrompt={handleSetInteractionPrompt}
        onPointerLockChange={setIsPointerLocked}
        onUpdateSpacecraft={handleUpdateSpacecraft}
        onDockComplete={handleDockComplete}
        onTogglePause={handleTogglePause}
        onEquipItem={handleEquipItem}
        onExitCockpit={handleExitCockpit}
      />
      <HUD
        gameState={gameState}
        isPointerLocked={isPointerLocked}
        showBriefingModal={showBriefingModal}
        onCloseBriefing={handleCloseBriefing}
        onRestartMission={handleRestartMission}
        onRequestPointerLock={handleRequestPointerLock}
        onTogglePause={handleTogglePause}
        onUpdateSettings={handleUpdateSettings}
        onEquipItem={handleEquipItem}
        onExitCockpit={handleExitCockpit}
        onManualDock={handleManualDock}
        onReturnToHub={onReturnToHub}
        onToggleFlashlight={handleToggleFlashlight}
      />
    </div>
  );
}
