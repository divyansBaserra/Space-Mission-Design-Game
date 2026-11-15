"use client";

import * as THREE from "three";

export type InventoryItemId = "TOOLKIT" | "SOLAR_WING" | "SBAND_ANTENNA";

export interface InventoryItem {
  id: InventoryItemId;
  name: string;
  shortCode: string;
  description: string;
  icon: string;
}

export type PlayerControlMode = "ASTRONAUT" | "SPACECRAFT_COCKPIT";

export type MissionStep =
  | "BRIEFING"
  | "COLLECT_EQUIPMENT"
  | "ENTER_AIRLOCK"
  | "CYCLE_AIRLOCK_DEPRESS"
  | "EVA_APPROACH_SATELLITE"
  | "REPAIR_SATELLITE"
  | "BOARD_SPACECRAFT"
  | "COCKPIT_ORBITAL_MANEUVER"
  | "APPROACH_DOCKING_PORT"
  | "MISSION_COMPLETE"
  | "MISSION_FAILED";

export type AirlockStatus =
  | "PRESSURIZED"
  | "CYCLING_DEPRESS"
  | "VACUUM"
  | "CYCLING_REPRESS";

export interface SatelliteRepairState {
  wingRemoved: boolean;
  wingMounted: boolean;
  antennaMounted: boolean;
  diagnosticRun: boolean;
}

export interface SpacecraftFlightState {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  pitch: number;
  yaw: number;
  roll: number;
  propellantPercent: number; // 0..100
  powerPercent: number; // 0..100
  speedMps: number;
  distanceToDockMeters: number;
  relativeVelocityMps: number;
  alignmentAngleDeg: number;
  isDocked: boolean;
  dockingTargetPos: THREE.Vector3;
}

export interface GameSettings {
  mouseSensitivity: number; // 0.5 .. 2.5, baseline 1.0
  soundVolume: number; // 0 .. 100, baseline 80
  graphicsQuality: "HIGH" | "MEDIUM" | "LOW";
  invertY: boolean;
}

export interface GameState {
  controlMode: PlayerControlMode;
  step: MissionStep;
  substepText: string;
  inventory: InventoryItemId[];
  equippedItem: InventoryItemId | null;
  settings: GameSettings;
  oxygenPercent: number; // 0..100
  suitPowerPercent: number; // 0..100
  flashlightOn: boolean;
  isEva: boolean;
  airlockStatus: AirlockStatus;
  airlockProgress: number; // 0..1
  airlockInnerDoorOpen: boolean;
  airlockOuterDoorOpen: boolean;
  satellite: SatelliteRepairState;
  spacecraft: SpacecraftFlightState;
  missionMetSeconds: number;
  score: number;
  paused: boolean;
  interactionTarget: string | null;
  interactionPrompt: string | null;
}
