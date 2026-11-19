"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import * as THREE from "three";
import { GameCanvas } from "./GameCanvas";
import { HUD } from "./HUD";
import { GameState, InventoryItemId, GameSettings, GameMode } from "./types";
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
  substepText: "PRIORITY ALPHA-1 ALERT: Inbound Solar Storm. Access Command Deck Terminal [E] for Artemis-VII Flight Directive.",
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
    cameraViewMode: "COCKPIT",
    landingGearDeployed: false,
    isLanded: false,
    surfaceAltitudeMeters: 18.0,
    verticalSpeedMps: 0,
    landingTargetPos: new THREE.Vector3(0, -18.0, -110.0),
    distanceToLandingPad: 90.0,
    flightDestination: "LUNAR_BASE_ALPHA",
  },
  lunarSampleCollected: false,
  radiationLevelMsv: 0.14,
  surfaceCoordinates: { lat: "0.6740° N", lon: "23.4720° E" },
  missionMetSeconds: 0,
  score: 0,
  paused: false,
  showControlsOverlay: false,
  interactionTarget: null,
  interactionPrompt: null,
  hangarCraft: {
    chassis: "3U",
    solar: "SINGLE_WING",
    solarDeployed: true,
    propulsion: "HYDRAZINE",
    payload: "IMAGER",
    telecom: "SBAND",
    isThrusterFiring: false,
  },
  activeFlightContract: "ARC_600",
  alsepDeployed: false,
  alsepPosition: null,
  isMagBootsLocked: false,
};

interface GameManagerProps {
  onReturnToHub?: () => void;
  gameMode?: GameMode;
  onLaunchAegis?: () => void;
  onLaunchEuropa?: () => void;
}

export function GameManager({ onReturnToHub, gameMode = "ORBITAL_REPAIR", onLaunchAegis, onLaunchEuropa }: GameManagerProps) {
  const isInitialHangar = gameMode === "HANGAR_SANDBOX";
  const physics = useMemo(() => new StationPhysics(isInitialHangar), [isInitialHangar]);

  const [gameState, setGameState] = useState<GameState>(() => {
    if (gameMode === "FLIGHT_SIM") {
      return {
        ...INITIAL_GAME_STATE,
        controlMode: "SPACECRAFT_COCKPIT",
        step: "COCKPIT_ORBITAL_MANEUVER",
        substepText:
          "3D PILOTED FLIGHT SIMULATOR · Fly Shuttle ORV-1 in LEO Orbit · Select contracts or fly freely.",
        activeFlightContract: "ARC_600",
      };
    }
    if (gameMode === "HANGAR_SANDBOX") {
      return {
        ...INITIAL_GAME_STATE,
        controlMode: "ASTRONAUT",
        step: "HANGAR_ASSEMBLY",
        substepText:
          "3D SPACECRAFT ASSEMBLY HANGAR · Approach workstations [E] or use controls to build & test.",
      };
    }
    return INITIAL_GAME_STATE;
  });
  const [isPointerLocked, setIsPointerLocked] = useState<boolean>(false);
  const [showBriefingModal, setShowBriefingModal] = useState<boolean>(false);

  // Sync initial sound volume
  useEffect(() => {
    soundManager.setVolume(INITIAL_SETTINGS.soundVolume);

    const handleDevCockpit = () => {
      setGameState((prev) => ({
        ...prev,
        controlMode: prev.controlMode === "SPACECRAFT_COCKPIT" ? "ASTRONAUT" : "SPACECRAFT_COCKPIT",
        step: prev.controlMode === "SPACECRAFT_COCKPIT" ? "EVA_APPROACH_SATELLITE" : "COCKPIT_ORBITAL_MANEUVER",
        substepText: prev.controlMode === "SPACECRAFT_COCKPIT"
          ? "Disembarked back to astronaut mode."
          : "Cockpit active: Fly shuttle ORV-1 and align for docking.",
      }));
    };

    const handleDevTouchdown = () => {
      setGameState((prev) => ({
        ...prev,
        controlMode: "SPACECRAFT_COCKPIT",
        step: "SURFACE_LANDED",
        substepText:
          "TOUCHDOWN CONFIRMED ON PAD-01! Press [H] to disembark onto Lunar Base Alpha.",
        spacecraft: {
          ...prev.spacecraft,
          position: new THREE.Vector3(0, -16.2, -110.0),
          velocity: new THREE.Vector3(0, 0, 0),
          isLanded: true,
          landingGearDeployed: true,
          surfaceAltitudeMeters: 0,
          verticalSpeedMps: 0,
          distanceToLandingPad: 0,
        },
      }));
    };

    const handleDevSurface = () => {
      setGameState((prev) => ({
        ...prev,
        controlMode: "SURFACE_EXPLORATION",
        step: "EXPLORE_SURFACE",
        substepText:
          "Surface exploration active. Low lunar gravity (1.62 m/s²). Investigate base outpost.",
        spacecraft: {
          ...prev.spacecraft,
          position: new THREE.Vector3(0, -16.2, -110.0),
          velocity: new THREE.Vector3(0, 0, 0),
          isLanded: true,
        },
      }));
    };

    window.addEventListener("toggle-cockpit-mode", handleDevCockpit);
    window.addEventListener("toggle-touchdown-mode", handleDevTouchdown);
    window.addEventListener("toggle-surface-mode", handleDevSurface);
    return () => {
      window.removeEventListener("toggle-cockpit-mode", handleDevCockpit);
      window.removeEventListener("toggle-touchdown-mode", handleDevTouchdown);
      window.removeEventListener("toggle-surface-mode", handleDevSurface);
    };
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

        const radJitter = (Math.random() - 0.5) * 0.02;
        const nextRad = Math.max(0.08, Math.min(0.24, 0.14 + radJitter));

        return {
          ...prev,
          missionMetSeconds: nextMet,
          oxygenPercent: nextO2,
          suitPowerPercent: nextPwr,
          radiationLevelMsv: nextRad,
        };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState.step, gameState.paused]);

  // Synchronize physics collider partition between Orbital Repair and Hangar Sandbox
  useEffect(() => {
    physics.setHangarMode(gameState.step === "HANGAR_ASSEMBLY");
  }, [physics, gameState.step]);

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
        landingTargetPos: new THREE.Vector3(0, -18.0, -110.0),
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

  // Toggle Camera View Mode (Cockpit vs Chase)
  const handleToggleCameraView = useCallback(() => {
    setGameState((prev) => {
      const nextView = prev.spacecraft.cameraViewMode === "COCKPIT" ? "CHASE" : "COCKPIT";
      return {
        ...prev,
        spacecraft: {
          ...prev.spacecraft,
          cameraViewMode: nextView,
        },
      };
    });
  }, []);

  // Toggle Landing Gear (Down vs Up)
  const handleToggleLandingGear = useCallback(() => {
    setGameState((prev) => {
      const nextGear = !prev.spacecraft.landingGearDeployed;
      return {
        ...prev,
        spacecraft: {
          ...prev.spacecraft,
          landingGearDeployed: nextGear,
        },
      };
    });
  }, []);

  // Controls overlay toggle (Hotkey [C] or HUD button)
  const handleToggleControlsOverlay = useCallback(() => {
    if (typeof document !== "undefined" && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
    setGameState((prev) => ({
      ...prev,
      showControlsOverlay: !prev.showControlsOverlay,
    }));
    soundManager.playEquip();
  }, []);

  // Magnetic boots toggle (Hotkey [G] or HUD button)
  const handleToggleMagBoots = useCallback(() => {
    setGameState((prev) => {
      const nextLocked = !prev.isMagBootsLocked;
      soundManager.playEquip();
      soundManager.speakRadioComm(
        nextLocked
          ? "Magnetic boots engaged. Gantry deck lock confirmed."
          : "Magnetic boots disengaged. Microgravity EVA RCS active.",
        "ASTRONAUT"
      );
      return {
        ...prev,
        isMagBootsLocked: nextLocked,
      };
    });
  }, []);

  // Emergency safety retether to gantry deck (Hotkey [R] or HUD button)
  const handleRetetherToGantry = useCallback(() => {
    soundManager.playEquip();
    soundManager.speakRadioComm(
      "Safety tether retracted. Astronaut secured on Gateway-1 maintenance gantry deck.",
      "HOUSTON"
    );
    setGameState((prev) => ({
      ...prev,
      isMagBootsLocked: true,
    }));
  }, []);

  // Direct sector transition between Gateway-1 Orbit and Lunar Base Alpha (Hotkey [T] or HUD button)
  const handleToggleSector = useCallback(() => {
    setGameState((prev) => {
      const isCurrentlySurface =
        prev.controlMode === "SURFACE_EXPLORATION" ||
        prev.spacecraft.position.z < -60 ||
        prev.spacecraft.position.y < -5;

      if (isCurrentlySurface) {
        soundManager.playEngineRoar();
        soundManager.playEquip();
        soundManager.speakRadioComm(
          "Ascent trajectory confirmed, ORV-1. Gateway-1 orbital station beacon acquired.",
          "HOUSTON"
        );
        return {
          ...prev,
          controlMode: "ASTRONAUT",
          isEva: true,
          step: prev.satellite.diagnosticRun ? "BOARD_SPACECRAFT" : "EVA_APPROACH_SATELLITE",
          substepText:
            "Ascent trajectory complete. Stationed at Gateway-1 Orbital Facility (Microgravity EVA).",
          spacecraft: {
            ...prev.spacecraft,
            position: new THREE.Vector3(0, 1.0, -28.0),
            velocity: new THREE.Vector3(0, 0, 0),
            isLanded: false,
            surfaceAltitudeMeters: 18.0,
          },
        };
      } else {
        soundManager.playTouchdown();
        soundManager.playQuindarTone();
        soundManager.speakRadioComm(
          "De-orbit burn complete, ORV-1. Entering lunar descent corridor. Target is Pad Zero One.",
          "HOUSTON"
        );
        const nextInv = prev.inventory.includes("ALSEP_KIT") || prev.alsepDeployed
          ? prev.inventory
          : [...prev.inventory, "ALSEP_KIT" as InventoryItemId];
        return {
          ...prev,
          inventory: nextInv,
          controlMode: "SURFACE_EXPLORATION",
          isEva: true,
          step: "EXPLORE_SURFACE",
          substepText:
            "Descent burn nominal. Landed at Lunar Base Alpha (0.166g lunar gravity). Deploy ALSEP station [4/E].",
          spacecraft: {
            ...prev.spacecraft,
            position: new THREE.Vector3(0, -18.0, -110.0),
            velocity: new THREE.Vector3(0, 0, 0),
            isLanded: true,
            surfaceAltitudeMeters: 0,
          },
        };
      }
    });
  }, []);

  // Land Complete handler (PAD-01 Touchdown)
  const handleLandComplete = useCallback(
    (touchdownVy?: number, touchdownDist?: number, scoreAward?: number) => {
      setGameState((prev) => ({
        ...prev,
        step: "SURFACE_LANDED",
        score: prev.score + (scoreAward ?? 500),
        substepText:
          "TOUCHDOWN CONFIRMED ON PAD-01! Review flight log or press [H] to disembark.",
        spacecraft: {
          ...prev.spacecraft,
          isLanded: true,
          surfaceAltitudeMeters: 0,
          verticalSpeedMps: 0,
          touchdownVerticalSpeed: touchdownVy ?? 0.8,
          touchdownDistanceToPad: touchdownDist ?? 2.2,
          touchdownScore: scoreAward ?? 500,
        },
      }));
    },
    []
  );

  // Disembark / Exit Cockpit back to astronaut or surface exploration mode
  const handleExitCockpit = useCallback(() => {
    setGameState((prev) => {
      if (prev.controlMode !== "SPACECRAFT_COCKPIT") return prev;
      soundManager.playPickup();

      // If landed on lunar surface, disembark onto lunar base
      if (prev.spacecraft.isLanded) {
        const nextInv = prev.inventory.includes("ALSEP_KIT") || prev.alsepDeployed
          ? prev.inventory
          : [...prev.inventory, "ALSEP_KIT" as InventoryItemId];
        return {
          ...prev,
          inventory: nextInv,
          controlMode: "SURFACE_EXPLORATION",
          step: "EXPLORE_SURFACE",
          substepText:
            "SURFACE EVA ACTIVE: Shackleton Crater Floor. Deploy Apollo ALSEP Station [4/E] and extract cryogenic core sample.",
        };
      }

      // Otherwise disembark onto station gantry
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
          if (typeof document !== "undefined" && document.pointerLockElement) {
            document.exitPointerLock?.();
          }
          setShowBriefingModal(true);
          soundManager.playPickup();
          return prev;
        }

        // 1b. Streamlined Workshop Auto-Equip Action (All EVA Gear)
        if (targetId === "ws_equip_all") {
          const nextInv: InventoryItemId[] = ["TOOLKIT", "SOLAR_WING", "SBAND_ANTENNA"];
          soundManager.playPickup();
          soundManager.speakRadioComm("All EVA equipment secured. Proceed to the airlock chamber to depressurize.", "HOUSTON");
          return {
            ...prev,
            inventory: nextInv,
            equippedItem: "TOOLKIT",
            step: "ENTER_AIRLOCK",
            substepText: "All repair equipment collected! Proceed straight into the Airlock chamber ahead.",
          };
        }

        // 2. Workshop Left Table: Toolkit
        if (targetId === "ws_toolkit" && !prev.inventory.includes("TOOLKIT")) {
          const nextInv: InventoryItemId[] = [...prev.inventory, "TOOLKIT"];
          soundManager.playPickup();
          const allCollected =
            nextInv.includes("TOOLKIT") &&
            nextInv.includes("SOLAR_WING") &&
            nextInv.includes("SBAND_ANTENNA");

          if (allCollected) {
            soundManager.speakRadioComm("All EVA equipment secured. Proceed to the airlock chamber to depressurize.", "HOUSTON");
          }

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

          if (allCollected) {
            soundManager.speakRadioComm("All EVA equipment secured. Proceed to the airlock chamber to depressurize.", "HOUSTON");
          }

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

          if (allCollected) {
            soundManager.speakRadioComm("All EVA equipment secured. Proceed to the airlock chamber to depressurize.", "HOUSTON");
          }

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
              "Systems online in ORV-1 cockpit! Maneuver into orbital position or descend to Lunar Base Alpha.",
          };
        }

        // 9. Re-board Shuttle ORV-1 from Lunar Surface (PAD-01)
        if (targetId === "board_spacecraft_surface") {
          soundManager.playEngineRoar();
          return {
            ...prev,
            controlMode: "SPACECRAFT_COCKPIT",
            step: "COCKPIT_ORBITAL_MANEUVER",
            substepText:
              "ORV-1 cockpit online! Fire ascent thrusters [Space/W] to liftoff and return to orbit.",
          };
        }

        // 10. Lunar Base Alpha Habitat Science Terminal
        if (targetId === "lunar_base_terminal") {
          soundManager.playSuccessFanfare();
          return {
            ...prev,
            score: prev.score + 500,
            substepText:
              "Lunar Base Alpha science terminal accessed! Research telemetry transmitted to orbit (+500 pts).",
          };
        }

        // 11. Lunar Deep Space Comms Mast
        if (targetId === "lunar_comms_mast") {
          soundManager.playBeaconChime();
          return {
            ...prev,
            substepText:
              "High-gain S-band relay mast operational. Deep space communication link 100% nominal.",
          };
        }

        // 12. Collect Lunar Geological Regolith Core Sample (CORE-GEO-01)
        if (targetId === "lunar_sample" && !prev.lunarSampleCollected) {
          soundManager.playPickup();
          soundManager.playQuindarTone(true);
          const nextInv: InventoryItemId[] = [...prev.inventory, "LUNAR_SAMPLE"];
          return {
            ...prev,
            inventory: nextInv,
            lunarSampleCollected: true,
            score: prev.score + 750,
            substepText:
              "Lunar geological sample CORE-GEO-01 retrieved! (+750 pts). Return to ORV-1 or Habitat module.",
          };
        }

        // 12B. Deploy ALSEP Lunar Surface Science Package
        if (targetId === "deploy_alsep" && !prev.alsepDeployed) {
          soundManager.playSuccessFanfare();
          soundManager.playBeaconChime();
          const nextInv = prev.inventory.filter((id) => id !== "ALSEP_KIT");
          return {
            ...prev,
            inventory: nextInv,
            equippedItem: null,
            alsepDeployed: true,
            alsepPosition: new THREE.Vector3(5.0, -18.0, -104.0),
            score: prev.score + 1000,
            substepText:
              "ALSEP SCIENCE STATION DEPLOYED! RTG power nominal · Seismic & laser telemetry active (+1000 pts).",
          };
        }

        // ====================================================================
        // 13. HANGAR SANDBOX STATIONS
        // ====================================================================
        // Station 1: Chassis Selection
        if (targetId === "hangar_chassis") {
          const cycle: Record<string, "1U" | "3U" | "6U" | "ORBITER"> = {
            "1U": "3U",
            "3U": "6U",
            "6U": "ORBITER",
            "ORBITER": "1U",
          };
          const nextChassis = cycle[prev.hangarCraft.chassis] || "3U";
          soundManager.playEquip();
          return {
            ...prev,
            hangarCraft: { ...prev.hangarCraft, chassis: nextChassis },
            substepText: `Chassis updated to [${nextChassis}]. Mass and internal bus volume recalculated.`,
          };
        }

        // Station 2: Solar Array Bay
        if (targetId === "hangar_solar") {
          const cycle: Record<string, "BODY_MOUNTED" | "SINGLE_WING" | "DUAL_WING"> = {
            "BODY_MOUNTED": "SINGLE_WING",
            "SINGLE_WING": "DUAL_WING",
            "DUAL_WING": "BODY_MOUNTED",
          };
          const nextSolar = cycle[prev.hangarCraft.solar] || "SINGLE_WING";
          soundManager.playGearDeploy();
          return {
            ...prev,
            hangarCraft: { ...prev.hangarCraft, solar: nextSolar },
            substepText: `Solar array architecture changed to [${nextSolar}]. Generation budget adjusted.`,
          };
        }

        // Station 2B: Solar Deployment Actuator Toggle
        if (targetId === "hangar_solar_toggle") {
          const nextDeployed = !prev.hangarCraft.solarDeployed;
          soundManager.playGearDeploy();
          return {
            ...prev,
            hangarCraft: { ...prev.hangarCraft, solarDeployed: nextDeployed },
            substepText: nextDeployed
              ? "Solar wing deployment test: ACTUATORS EXTENDED (100% illumination)."
              : "Solar wing deployment test: ACTUATORS RETRACTED (Stowed inside fairing envelope).",
          };
        }

        // Station 3: Propulsion Bay
        if (targetId === "hangar_propulsion") {
          const cycle: Record<string, "NONE" | "COLD_GAS" | "HYDRAZINE" | "ION"> = {
            "NONE": "COLD_GAS",
            "COLD_GAS": "HYDRAZINE",
            "HYDRAZINE": "ION",
            "ION": "NONE",
          };
          const nextProp = cycle[prev.hangarCraft.propulsion] || "HYDRAZINE";
          soundManager.playThrusterPuff();
          return {
            ...prev,
            hangarCraft: { ...prev.hangarCraft, propulsion: nextProp },
            substepText: `Propulsion engine updated to [${nextProp}]. Specific impulse & Delta-V recalculated.`,
          };
        }

        // Station 4: Science Payload Bay
        if (targetId === "hangar_payload") {
          const cycle: Record<string, "IMAGER" | "PLASMA" | "LIDAR" | "RADAR"> = {
            "IMAGER": "PLASMA",
            "PLASMA": "LIDAR",
            "LIDAR": "RADAR",
            "RADAR": "IMAGER",
          };
          const nextPayload = cycle[prev.hangarCraft.payload] || "IMAGER";
          soundManager.playEquip();
          return {
            ...prev,
            hangarCraft: { ...prev.hangarCraft, payload: nextPayload },
            substepText: `Science payload set to [${nextPayload}]. Sensor power draw and link rates updated.`,
          };
        }

        // Station 5: Telecom Relay Bay
        if (targetId === "hangar_telecom") {
          const cycle: Record<string, "UHF" | "SBAND" | "XBAND"> = {
            "UHF": "SBAND",
            "SBAND": "XBAND",
            "XBAND": "UHF",
          };
          const nextTelecom = cycle[prev.hangarCraft.telecom] || "SBAND";
          soundManager.playBeaconChime();
          return {
            ...prev,
            hangarCraft: { ...prev.hangarCraft, telecom: nextTelecom },
            substepText: `Telecom transceiver set to [${nextTelecom}]. Link margin & downlink bandwidth updated.`,
          };
        }

        // Station 6: Static Fire Propulsion Stand
        if (targetId === "hangar_static_fire") {
          soundManager.playEngineRoar();
          setTimeout(() => {
            setGameState((s) => ({
              ...s,
              hangarCraft: { ...s.hangarCraft, isThrusterFiring: false },
            }));
          }, 2400);
          return {
            ...prev,
            hangarCraft: { ...prev.hangarCraft, isThrusterFiring: true },
            score: prev.score + 250,
            substepText: "STATIC FIRE TEST NOMINAL! Chamber pressure 100% · Thruster plume roaring (+250 pts).",
          };
        }

        // Station 7: Departure / Launch Airlock Gate
        if (targetId === "hangar_launch") {
          soundManager.playEngineRoar();
          soundManager.playSuccessFanfare();
          return {
            ...prev,
            controlMode: "SPACECRAFT_COCKPIT",
            step: "COCKPIT_ORBITAL_MANEUVER",
            substepText: "LAUNCH SUCCESSFUL! Orbital insertion nominal. 6-DOF Cockpit flight controls online.",
            spacecraft: {
              ...prev.spacecraft,
              position: new THREE.Vector3(0, 1.0, -28.0),
              velocity: new THREE.Vector3(0, 0, -2.0),
              isLanded: false,
            },
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
    soundManager.playQuindarTone(true);
    soundManager.speakRadioComm(
      "Houston confirms Artemis Seven directive acknowledged. Inbound solar storm window closing. Proceed to Engineering Workshop.",
      "HOUSTON"
    );
    setGameState((prev) => {
      if (prev.step === "BRIEFING") {
        return {
          ...prev,
          step: "COLLECT_EQUIPMENT",
          substepText:
            "OPERATION ARTEMIS-VII: Inbound Solar Storm. Enter Engineering Workshop and collect repair hardware (0/3).",
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
      alignAngle: number,
      cameraViewMode: "COCKPIT" | "CHASE",
      landingGearDeployed: boolean,
      isLanded: boolean,
      surfaceAltitudeMeters: number,
      verticalSpeedMps: number,
      distToPad: number
    ) => {
      setGameState((prev) => {
        if (prev.controlMode !== "SPACECRAFT_COCKPIT") return prev;

        let nextStep = prev.step;
        let nextSubstep = prev.substepText;

        if (isLanded) {
          nextStep = "SURFACE_LANDED";
          nextSubstep =
            "TOUCHDOWN CONFIRMED ON PAD-01! Press [H] to disembark onto Lunar Base Alpha.";
        } else if (distToPad < 35.0 && surfaceAltitudeMeters < 25.0) {
          nextStep = "SURFACE_DESCENT";
          nextSubstep =
            "Descent profile active. Deploy landing gear [G] and descend to PAD-01 (<3.8 m/s).";
        } else if (distToDock < 15.0 && pos.z > -40.0) {
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
            cameraViewMode,
            landingGearDeployed,
            isLanded,
            surfaceAltitudeMeters,
            verticalSpeedMps,
            distanceToLandingPad: distToPad,
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

  // Select active flight contract
  const handleSelectFlightContract = useCallback((contractId: string) => {
    soundManager.playBeaconChime();
    setGameState((prev) => {
      let nextSubstep = prev.substepText;
      let nextDest: "ORBIT_GATEWAY" | "LUNAR_BASE_ALPHA" = "ORBIT_GATEWAY";
      let nextTargetPos = new THREE.Vector3(0, 1.5, -11.2);

      if (contractId === "ARC_600") {
        nextSubstep = "FLIGHT CONTRACT ARC-600 ACTIVE: Maintain 600km Sun-Sync Orbit & downlink science.";
        nextDest = "ORBIT_GATEWAY";
      } else if (contractId === "ISS_400") {
        nextSubstep = "FLIGHT CONTRACT ISS-400 ACTIVE: Approach Gateway-1 and execute soft docking at Port DOCK-01.";
        nextDest = "ORBIT_GATEWAY";
        nextTargetPos = new THREE.Vector3(0, 1.5, -11.2);
      } else if (contractId === "LUN_PAD1") {
        nextSubstep = "FLIGHT CONTRACT LUN-PAD1 ACTIVE: Execute lunar deorbit burn and land on PAD-01 (<3.8 m/s).";
        nextDest = "LUNAR_BASE_ALPHA";
        nextTargetPos = new THREE.Vector3(0, -18.0, -110.0);
      } else if (contractId === "RET_100") {
        nextSubstep = "FLIGHT CONTRACT RET-100 ACTIVE: Retrograde deorbit burn. Maintain 40° entry pitch angle.";
        nextDest = "ORBIT_GATEWAY";
      } else if (contractId === "AEGIS_DART") {
        if (onLaunchAegis) {
          onLaunchAegis();
          return prev;
        }
        nextSubstep = "OPERATION AEGIS (GAME 02): Planetary Defense! Mars gravity assist complete. Optical SMART nav locked on Didymos moonlet (6.2 km/s terminal impact).";
        soundManager.speakRadioComm("Aegis Flight, Mars gravity assist nominal. Optical SMART nav locked on Didymos moonlet. Closing velocity 6.2 kilometers per second.", "HOUSTON");
        nextDest = "ORBIT_GATEWAY";
      } else if (contractId === "EUROPA_ABYSS") {
        if (onLaunchEuropa) {
          onLaunchEuropa();
          return prev;
        }
        nextSubstep = "OPERATION EUROPA (GAME 03): Jovian Radiation survived. Nuclear cryo-drill melted through 20km ice. Submersible navigating hydrothermal vents for biosignatures.";
        soundManager.speakRadioComm("Europa Control, submersible breach into subsurface ocean confirmed. Radiation shielding holding. Track hydrothermal plumes.", "HOUSTON");
        nextDest = "LUNAR_BASE_ALPHA";
      }

      return {
        ...prev,
        activeFlightContract: contractId,
        substepText: nextSubstep,
        spacecraft: {
          ...prev.spacecraft,
          flightDestination: nextDest,
          dockingTargetPos: nextTargetPos,
        },
      };
    });
  }, []);

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
        onLandComplete={handleLandComplete}
        onTogglePause={handleTogglePause}
        onEquipItem={handleEquipItem}
        onExitCockpit={handleExitCockpit}
        onToggleCameraView={handleToggleCameraView}
        onToggleLandingGear={handleToggleLandingGear}
        onToggleControlsOverlay={handleToggleControlsOverlay}
        onToggleSector={handleToggleSector}
        onToggleMagBoots={handleToggleMagBoots}
        onRetetherToGantry={handleRetetherToGantry}
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
        onToggleCameraView={handleToggleCameraView}
        onToggleLandingGear={handleToggleLandingGear}
        onReturnToHub={onReturnToHub}
        onToggleFlashlight={handleToggleFlashlight}
        onToggleControlsOverlay={handleToggleControlsOverlay}
        onToggleSector={handleToggleSector}
        onToggleMagBoots={handleToggleMagBoots}
        onRetetherToGantry={handleRetetherToGantry}
        onSelectFlightContract={handleSelectFlightContract}
        onInteractHangar={handleInteract}
      />
    </div>
  );
}
