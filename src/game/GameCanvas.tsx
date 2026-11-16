"use client";

import React, { useRef, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import * as THREE from "three";
import { StationEnvironment } from "./StationEnvironment";
import { PlayerController } from "./PlayerController";
import { SpacecraftFlight } from "./SpacecraftFlight";
import { PostProcessingEffects } from "./PostProcessingEffects";
import { GameState, InventoryItemId } from "./types";
import { StationPhysics } from "./physics";

interface GameCanvasProps {
  gameState: GameState;
  physics: StationPhysics;
  onInteract: (targetId: string) => void;
  onToggleFlashlight: () => void;
  onSetInteractionPrompt: (target: string | null, prompt: string | null) => void;
  onPointerLockChange: (locked: boolean) => void;
  onUpdateSpacecraft: (
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
  ) => void;
  onDockComplete: () => void;
  onLandComplete?: (touchdownVy: number, touchdownDist: number, scoreAward: number) => void;
  onTogglePause?: () => void;
  onEquipItem?: (id: InventoryItemId) => void;
  onExitCockpit?: () => void;
  onToggleCameraView?: () => void;
  onToggleLandingGear?: () => void;
  onToggleControlsOverlay?: () => void;
  onToggleSector?: () => void;
}

export function GameCanvas({
  gameState,
  physics,
  onInteract,
  onToggleFlashlight,
  onSetInteractionPrompt,
  onPointerLockChange,
  onUpdateSpacecraft,
  onDockComplete,
  onLandComplete,
  onTogglePause,
  onEquipItem,
  onExitCockpit,
  onToggleCameraView,
  onToggleLandingGear,
  onToggleControlsOverlay,
  onToggleSector,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (gameState.paused) return;
    if (document.pointerLockElement !== e.currentTarget.querySelector("canvas")) {
      const canvasEl = e.currentTarget.querySelector("canvas");
      if (canvasEl) {
        try {
          const p = canvasEl.requestPointerLock() as unknown as Promise<void> | undefined;
          if (p && typeof p.catch === "function") {
            p.catch(() => {});
          }
        } catch {
          // Pointer lock best-effort in webview/headless
        }
      }
    }
  };

  const isShadowsEnabled = gameState.settings?.graphicsQuality === "HIGH";
  const dprSetting: [number, number] =
    gameState.settings?.graphicsQuality === "LOW"
      ? [1, 1]
      : gameState.settings?.graphicsQuality === "MEDIUM"
      ? [1, 1.5]
      : [1, 2];

  return (
    <div
      ref={containerRef}
      onClick={handleCanvasClick}
      style={{
        width: "100%",
        height: "100%",
        position: "relative",
        overflow: "hidden",
        backgroundColor: "#05070a",
      }}
    >
      <Canvas
        camera={{ position: [0, 1.65, 9], fov: 75, near: 0.04, far: 500 }}
        shadows={isShadowsEnabled}
        dpr={dprSetting}
        gl={{
          antialias: gameState.settings?.graphicsQuality !== "LOW",
          powerPreference: "high-performance",
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.28,
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 1.28;
          gl.shadowMap.enabled = isShadowsEnabled;
          gl.shadowMap.type = THREE.PCFShadowMap;
        }}
      >
        <Suspense fallback={null}>
          <StationEnvironment
            gameState={gameState}
            onInteract={onInteract}
          />
          <PlayerController
            gameState={gameState}
            physics={physics}
            onInteract={onInteract}
            onToggleFlashlight={onToggleFlashlight}
            onSetInteractionPrompt={onSetInteractionPrompt}
            onPointerLockChange={onPointerLockChange}
            onTogglePause={onTogglePause}
            onEquipItem={onEquipItem}
            onToggleControlsOverlay={onToggleControlsOverlay}
            onToggleSector={onToggleSector}
          />
          <SpacecraftFlight
            gameState={gameState}
            physics={physics}
            onUpdateSpacecraft={onUpdateSpacecraft}
            onDockComplete={onDockComplete}
            onLandComplete={onLandComplete}
            onTogglePause={onTogglePause}
            onExitCockpit={onExitCockpit}
            onToggleCameraView={onToggleCameraView}
            onToggleLandingGear={onToggleLandingGear}
            onToggleControlsOverlay={onToggleControlsOverlay}
            onToggleSector={onToggleSector}
          />
          <PostProcessingEffects gameState={gameState} />
        </Suspense>
      </Canvas>
    </div>
  );
}
