"use client";

import React, { useEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { GameState, InventoryItemId } from "./types";
import { StationPhysics } from "./physics";
import { soundManager } from "./audio";
import { AstronautBootDust, DustTriggerState } from "./AstronautBootDust";

interface PlayerControllerProps {
  gameState: GameState;
  physics: StationPhysics;
  onInteract: (targetId: string) => void;
  onToggleFlashlight: () => void;
  onSetInteractionPrompt: (target: string | null, prompt: string | null) => void;
  onPointerLockChange: (locked: boolean) => void;
  onTogglePause?: () => void;
  onEquipItem?: (id: InventoryItemId) => void;
  onToggleControlsOverlay?: () => void;
  onToggleSector?: () => void;
  onToggleMagBoots?: () => void;
  onRetetherToGantry?: () => void;
}

export function PlayerController({
  gameState,
  physics,
  onInteract,
  onToggleFlashlight,
  onSetInteractionPrompt,
  onPointerLockChange,
  onTogglePause,
  onEquipItem,
  onToggleControlsOverlay,
  onToggleSector,
  onToggleMagBoots,
  onRetetherToGantry,
}: PlayerControllerProps) {
  const { camera, gl } = useThree();

  // Internal player state
  const playerPosRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 9));
  const velocityRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const isGroundedRef = useRef<boolean>(true);
  const yawRef = useRef<number>(0);
  const pitchRef = useRef<number>(0);
  const rollRef = useRef<number>(0);
  const swayOffsetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0));
  const isPointerLockedRef = useRef<boolean>(false);

  // Input keys
  const keysRef = useRef<{ [code: string]: boolean }>({});
  const lastFootstepDistRef = useRef<number>(0);
  const lastThrusterTimeRef = useRef<number>(0);
  const currentTargetIdRef = useRef<string | null>(null);
  const lastReportedTargetRef = useRef<string | null>(null);
  const lastReportedPromptRef = useRef<string | null>(null);
  const bobbingTimerRef = useRef<number>(0);

  // Helmet flashlight
  const flashlightRef = useRef<THREE.SpotLight>(null);
  const flashlightTargetRef = useRef<THREE.Object3D>(new THREE.Object3D());
  const itemGroupRef = useRef<THREE.Group>(null);
  const dustTriggerRef = useRef<DustTriggerState>({ jumpCount: 0, landCount: 0 });
  const isMovingRef = useRef<boolean>(false);

  useEffect(() => {
    // Add flashlight target to scene
    const target = flashlightTargetRef.current;
    camera.parent?.add(target);
    return () => {
      target.removeFromParent();
    };
  }, [camera]);

  // Synchronize player position when entering surface exploration or returning to station
  useEffect(() => {
    if (gameState.controlMode === "SURFACE_EXPLORATION") {
      playerPosRef.current.set(0, -18.0, -104.0);
      velocityRef.current.set(0, 0, 0);
      yawRef.current = Math.PI; // Face south towards Lunar Base habitat
      pitchRef.current = 0;
      isGroundedRef.current = true;
    } else if (gameState.controlMode === "ASTRONAUT") {
      if (playerPosRef.current.y < -10 || playerPosRef.current.z < -30) {
        playerPosRef.current.set(0, 0.05, -26.0);
        velocityRef.current.set(0, 0, 0);
        yawRef.current = 0; // Face north along gantry towards airlock
        pitchRef.current = 0;
        isGroundedRef.current = true;
      }
    }
  }, [gameState.controlMode]);

  // Clean reset on mission restart or Hangar Mode initialization
  useEffect(() => {
    if (gameState.step === "HANGAR_ASSEMBLY" && gameState.missionMetSeconds <= 1) {
      playerPosRef.current.set(0, 0, 3.2);
      velocityRef.current.set(0, 0, 0);
      yawRef.current = Math.PI; // Face north towards central assembly berth (Z = 0.5)
      pitchRef.current = 0;
      rollRef.current = 0;
      isGroundedRef.current = true;
      camera.position.set(0, 1.65, 3.2);
      camera.rotation.set(0, Math.PI, 0);
    } else if (gameState.step === "BRIEFING" && gameState.missionMetSeconds === 0) {
      playerPosRef.current.set(0, 0, 8.5);
      velocityRef.current.set(0, 0, 0);
      yawRef.current = Math.PI;
      pitchRef.current = -0.05;
      rollRef.current = 0;
      isGroundedRef.current = true;
      camera.position.set(0, 1.65, 8.5);
      camera.rotation.set(-0.05, Math.PI, 0);
    }
  }, [gameState.step, gameState.missionMetSeconds, camera]);

  // Synchronize dynamic state in stable refs to prevent tearing down window listeners on every frame
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const callbacksRef = useRef({
    onInteract,
    onToggleFlashlight,
    onPointerLockChange,
    onTogglePause,
    onEquipItem,
    onToggleControlsOverlay,
    onToggleSector,
    onToggleMagBoots,
    onRetetherToGantry,
  });
  callbacksRef.current = {
    onInteract,
    onToggleFlashlight,
    onPointerLockChange,
    onTogglePause,
    onEquipItem,
    onToggleControlsOverlay,
    onToggleSector,
    onToggleMagBoots,
    onRetetherToGantry,
  };

  // Pointer lock & keyboard event listeners: attached once to gl context
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const state = gameStateRef.current;
      // If player is in spacecraft cockpit, let SpacecraftFlight exclusively handle controls
      if (state.controlMode === "SPACECRAFT_COCKPIT") return;

      keysRef.current[e.code] = true;
      if (e.key) keysRef.current[e.key.toLowerCase()] = true;
      const cb = callbacksRef.current;

      const isKeyC = e.code === "KeyC" || e.key?.toLowerCase() === "c";
      const isKeyE = e.code === "KeyE" || e.key?.toLowerCase() === "e";
      const isKeyT = e.code === "KeyT" || e.key?.toLowerCase() === "t";
      const isKeyG = e.code === "KeyG" || e.key?.toLowerCase() === "g";
      const isKeyF = e.code === "KeyF" || e.key?.toLowerCase() === "f";
      const isKeyR = e.code === "KeyR" || e.key?.toLowerCase() === "r";
      const isKeyB = e.code === "KeyB" || e.key?.toLowerCase() === "b";
      const isKeyP = e.code === "KeyP" || e.key?.toLowerCase() === "p";
      const isKeyL = e.code === "KeyL" || e.key?.toLowerCase() === "l";

      // Controls overlay toggle (KeyC)
      if (isKeyC) {
        e.preventDefault();
        if (document.pointerLockElement) {
          document.exitPointerLock?.();
        }
        cb.onToggleControlsOverlay?.();
        return;
      }

      // Sector transition (KeyT: Orbit <-> Lunar Surface)
      if (isKeyT) {
        e.preventDefault();
        cb.onToggleSector?.();
        return;
      }

      // Magnetic boots lock toggle (KeyG)
      if (isKeyG) {
        e.preventDefault();
        cb.onToggleMagBoots?.();
        return;
      }

      // Emergency airlock / gantry tether return (KeyR or KeyB) when in microgravity EVA outside
      if ((isKeyR || isKeyB) && playerPosRef.current.z < -10.5 && state.controlMode === "ASTRONAUT") {
        e.preventDefault();
        playerPosRef.current.set(0, 0.05, -14.0);
        velocityRef.current.set(0, 0, 0);
        isGroundedRef.current = true;
        soundManager.playEquip();
        soundManager.speakRadioComm("Emergency safety tether engaged. Astronaut secured on Gateway-1 gantry deck.", "HOUSTON");
        cb.onRetetherToGantry?.();
        return;
      }

      // Pause toggle
      if (e.code === "Escape" || isKeyP) {
        e.preventDefault();
        if (document.pointerLockElement) {
          document.exitPointerLock?.();
        }
        cb.onTogglePause?.();
        return;
      }

      // Quickbar item equip keys (1, 2, 3, 4)
      if ((e.code === "Digit1" || e.key === "1") && state.inventory.includes("TOOLKIT")) {
        cb.onEquipItem?.("TOOLKIT");
      }
      if ((e.code === "Digit2" || e.key === "2") && state.inventory.includes("SOLAR_WING")) {
        cb.onEquipItem?.("SOLAR_WING");
      }
      if ((e.code === "Digit3" || e.key === "3") && state.inventory.includes("SBAND_ANTENNA")) {
        cb.onEquipItem?.("SBAND_ANTENNA");
      }
      if ((e.code === "Digit4" || e.key === "4") && state.inventory.includes("ALSEP_KIT")) {
        cb.onInteract("deploy_alsep");
      }

      // Flashlight toggle or Hangar Solar Deployment toggle
      if (isKeyF) {
        e.preventDefault();
        if (state.step === "HANGAR_ASSEMBLY") {
          cb.onInteract("hangar_solar_toggle");
          return;
        }
        cb.onToggleFlashlight();
        soundManager.playFlashlight();
      }

      // Hangar Quick Actions
      if (state.step === "HANGAR_ASSEMBLY") {
        if (isKeyR) {
          e.preventDefault();
          cb.onInteract("hangar_static_fire");
          return;
        }
        if (isKeyL) {
          e.preventDefault();
          cb.onInteract("hangar_launch");
          return;
        }
      }

      // Interaction key [E] (Reads synchronous currentTargetIdRef for zero latency)
      if (isKeyE) {
        e.preventDefault();
        const target = currentTargetIdRef.current || state.interactionTarget;
        if (target) {
          if (target === "briefing_table" && document.pointerLockElement) {
            document.exitPointerLock?.();
          }
          cb.onInteract(target);
        } else if (state.step === "BRIEFING") {
          // Intuitive fallback: pressing E anywhere in Command Deck opens the briefing!
          if (document.pointerLockElement) {
            document.exitPointerLock?.();
          }
          cb.onInteract("briefing_table");
        } else if (state.step === "COLLECT_EQUIPMENT") {
          // Intuitive fallback: 1-press auto-equips all 3 repair tools
          cb.onInteract("ws_equip_all");
        } else if (state.step === "ENTER_AIRLOCK" || state.step === "CYCLE_AIRLOCK_DEPRESS") {
          // Intuitive fallback: cycles airlock to vacuum
          cb.onInteract("airlock_console");
        } else if (state.step === "REPAIR_SATELLITE" || state.step === "EVA_APPROACH_SATELLITE") {
          // Intuitive fallback: triggers next satellite repair step
          cb.onInteract("satellite_repair");
        } else if (state.step === "BOARD_SPACECRAFT") {
          // Intuitive fallback: boards shuttle
          cb.onInteract("board_spacecraft");
        } else if (state.controlMode === "SURFACE_EXPLORATION") {
          if (!state.alsepDeployed) {
            cb.onInteract("deploy_alsep");
          } else if (!state.lunarSampleCollected) {
            cb.onInteract("lunar_sample");
          } else {
            cb.onInteract("board_spacecraft_surface");
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysRef.current[e.code] = false;
      if (e.key) keysRef.current[e.key.toLowerCase()] = false;
    };

    const handleMouseMove = (e: MouseEvent) => {
      const state = gameStateRef.current;
      if (!isPointerLockedRef.current || state.paused) return;

      const sensitivity = 0.0022 * (state.settings?.mouseSensitivity ?? 1.0);
      const invertY = state.settings?.invertY ? -1 : 1;
      yawRef.current -= e.movementX * sensitivity;
      pitchRef.current -= e.movementY * sensitivity * invertY;

      // Weapon and tool sway offset
      swayOffsetRef.current.x -= e.movementX * 0.00018;
      swayOffsetRef.current.y += e.movementY * 0.00018 * invertY;
      swayOffsetRef.current.clampLength(0, 0.045);

      // Clamp pitch (-85 deg to +85 deg)
      const maxPitch = (85 * Math.PI) / 180;
      pitchRef.current = Math.max(-maxPitch, Math.min(maxPitch, pitchRef.current));
    };

    const handlePointerLockChange = () => {
      const locked = document.pointerLockElement === gl.domElement;
      isPointerLockedRef.current = locked;
      callbacksRef.current.onPointerLockChange(locked);
    };

    const handleMouseDown = (e: MouseEvent) => {
      // Left click triggers interaction if looking at an interactable object, or intuitive fallback
      if (e.button === 0) {
        const state = gameStateRef.current;
        const target = currentTargetIdRef.current || state.interactionTarget;
        if (target) {
          if (target === "briefing_table" && document.pointerLockElement) {
            document.exitPointerLock?.();
          }
          callbacksRef.current.onInteract(target);
        } else if (state.step === "BRIEFING") {
          if (document.pointerLockElement) {
            document.exitPointerLock?.();
          }
          callbacksRef.current.onInteract("briefing_table");
        } else if (state.step === "COLLECT_EQUIPMENT") {
          callbacksRef.current.onInteract("ws_equip_all");
        } else if (state.step === "ENTER_AIRLOCK" || state.step === "CYCLE_AIRLOCK_DEPRESS") {
          callbacksRef.current.onInteract("airlock_console");
        } else if (state.step === "REPAIR_SATELLITE" || state.step === "EVA_APPROACH_SATELLITE") {
          callbacksRef.current.onInteract("satellite_repair");
        } else if (state.step === "BOARD_SPACECRAFT") {
          callbacksRef.current.onInteract("board_spacecraft");
        } else if (state.controlMode === "SURFACE_EXPLORATION") {
          if (!state.alsepDeployed) {
            callbacksRef.current.onInteract("deploy_alsep");
          } else if (!state.lunarSampleCollected) {
            callbacksRef.current.onInteract("lunar_sample");
          } else {
            callbacksRef.current.onInteract("board_spacecraft_surface");
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("pointerlockchange", handlePointerLockChange);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("pointerlockchange", handlePointerLockChange);
    };
  }, [gl]);

  // Main game physics and camera update loop
  useFrame((_, delta) => {
    // If paused, freeze updates
    if (gameState.paused) return;

    // If player is in spacecraft cockpit, let SpacecraftFlight handle controls and camera
    if (gameState.controlMode === "SPACECRAFT_COCKPIT") {
      if (flashlightRef.current) flashlightRef.current.visible = false;
      return;
    }

    // Limit delta to prevent tunneling on frame hitch
    const dt = Math.min(delta, 0.08);

    // Synchronize door colliders with airlock state
    physics.updateDoorColliders(
      gameState.airlockInnerDoorOpen,
      gameState.airlockOuterDoorOpen
    );

    const isSurface = gameState.controlMode === "SURFACE_EXPLORATION";
    const isEva = playerPosRef.current.z < -11.0 && !isSurface;
    const keys = keysRef.current;

    // Arrow keys camera rotation (accessible keyboard view controls)
    const turnSpeed = 2.2;
    if (keys["ArrowLeft"]) yawRef.current += turnSpeed * dt;
    if (keys["ArrowRight"]) yawRef.current -= turnSpeed * dt;
    if (keys["ArrowUp"]) pitchRef.current += turnSpeed * dt;
    if (keys["ArrowDown"]) pitchRef.current -= turnSpeed * dt;
    const maxPitch = (85 * Math.PI) / 180;
    pitchRef.current = Math.max(-maxPitch, Math.min(maxPitch, pitchRef.current));

    // Movement calculation
    const moveInput = new THREE.Vector3();
    if (keys["KeyW"] || keys["w"]) moveInput.z -= 1;
    if (keys["KeyS"] || keys["s"]) moveInput.z += 1;
    if (keys["KeyA"] || keys["a"]) moveInput.x -= 1;
    if (keys["KeyD"] || keys["d"]) moveInput.x += 1;

    if (moveInput.lengthSq() > 0) {
      moveInput.normalize();
    }

    const isSprinting = (!!keys["ShiftLeft"] || !!keys["ShiftRight"] || !!keys["shift"]) && !isEva;
    const baseSpeed = isEva ? 2.8 : isSprinting ? 5.2 : 3.2;

    // Camera forward and right vectors projected onto XZ
    const cosY = Math.cos(yawRef.current);
    const sinY = Math.sin(yawRef.current);
    const forward = new THREE.Vector3(-sinY, 0, -cosY);
    const right = new THREE.Vector3(cosY, 0, -sinY);

    if (isSurface) {
      // ======================================================================
      // 0. LUNAR BASE ALPHA (SURFACE EXPLORATION - LOW GRAVITY 1.62 m/s²)
      // ======================================================================
      const desiredVelX = (forward.x * -moveInput.z + right.x * moveInput.x) * baseSpeed;
      const desiredVelZ = (forward.z * -moveInput.z + right.z * moveInput.x) * baseSpeed;

      velocityRef.current.x = desiredVelX;
      velocityRef.current.z = desiredVelZ;

      // Floaty Moon Jump
      if ((keys["Space"] || keys[" "]) && isGroundedRef.current) {
        velocityRef.current.y = 3.8;
        isGroundedRef.current = false;
        dustTriggerRef.current.jumpCount++;
        soundManager.playJump();
      }

      // Lunar gravity: 1.62 m/s^2 (0.166 G)
      const lunarGravity = 1.62;
      velocityRef.current.y -= lunarGravity * dt;

      // Desired movement delta
      const deltaPos = new THREE.Vector3(
        velocityRef.current.x * dt,
        0,
        velocityRef.current.z * dt
      );

      // Solve collision with lunar base obstacles
      const { finalPos, collided } = physics.movePlayer(playerPosRef.current, deltaPos, 0.52);
      playerPosRef.current.x = finalPos.x;
      playerPosRef.current.z = finalPos.z;
      if (collided) {
        velocityRef.current.x *= 0.4;
        velocityRef.current.z *= 0.4;
      }

      // Solve Y ground plane (surface is at Y = -18.0)
      const wasGrounded = isGroundedRef.current;
      playerPosRef.current.y += velocityRef.current.y * dt;
      if (playerPosRef.current.y <= -18.0) {
        playerPosRef.current.y = -18.0;
        if (!wasGrounded && velocityRef.current.y < -0.6) {
          dustTriggerRef.current.landCount++;
        }
        velocityRef.current.y = 0;
        isGroundedRef.current = true;
      }

      // Head bobbing & footsteps with floaty stride
      const speedMagnitude = Math.sqrt(
        velocityRef.current.x * velocityRef.current.x +
          velocityRef.current.z * velocityRef.current.z
      );
      isMovingRef.current = speedMagnitude > 0.4;

      if (speedMagnitude > 0.5 && isGroundedRef.current) {
        bobbingTimerRef.current += dt * (isSprinting ? 11 : 7);
        lastFootstepDistRef.current += speedMagnitude * dt;
        if (lastFootstepDistRef.current >= (isSprinting ? 2.4 : 1.8)) {
          soundManager.playFootstep();
          lastFootstepDistRef.current = 0;
        }
      } else {
        bobbingTimerRef.current = 0;
      }
    } else if (!isEva) {
      // ======================================================================
      // 1. INSIDE STATION (EARTH NORMAL GRAVITY & WALKING)
      // ======================================================================
      const desiredVelX = (forward.x * -moveInput.z + right.x * moveInput.x) * baseSpeed;
      const desiredVelZ = (forward.z * -moveInput.z + right.z * moveInput.x) * baseSpeed;

      velocityRef.current.x = desiredVelX;
      velocityRef.current.z = desiredVelZ;

      // Jump
      if ((keys["Space"] || keys[" "]) && isGroundedRef.current) {
        velocityRef.current.y = 4.2;
        isGroundedRef.current = false;
        soundManager.playJump();
      }

      // Gravity inside station
      const gravity = 9.8;
      velocityRef.current.y -= gravity * dt;

      // Desired movement delta
      const deltaPos = new THREE.Vector3(
        velocityRef.current.x * dt,
        0,
        velocityRef.current.z * dt
      );

      // Solve XZ collision with station walls & doors
      const { finalPos, collided } = physics.movePlayer(playerPosRef.current, deltaPos, 0.52);
      playerPosRef.current.x = finalPos.x;
      playerPosRef.current.z = finalPos.z;
      if (collided) {
        velocityRef.current.x *= 0.4;
        velocityRef.current.z *= 0.4;
      }

      // Solve Y ground plane
      playerPosRef.current.y += velocityRef.current.y * dt;
      if (playerPosRef.current.y <= 0.0) {
        playerPosRef.current.y = 0.0;
        velocityRef.current.y = 0;
        isGroundedRef.current = true;
      }

      // Head bobbing & footsteps
      const speedMagnitude = Math.sqrt(
        velocityRef.current.x * velocityRef.current.x +
          velocityRef.current.z * velocityRef.current.z
      );

      if (speedMagnitude > 0.5 && isGroundedRef.current) {
        bobbingTimerRef.current += dt * (isSprinting ? 14 : 9);
        lastFootstepDistRef.current += speedMagnitude * dt;
        if (lastFootstepDistRef.current >= (isSprinting ? 1.8 : 1.4)) {
          soundManager.playFootstep();
          lastFootstepDistRef.current = 0;
        }
      } else {
        bobbingTimerRef.current = 0;
      }
    } else {
      // ======================================================================
      // 2. EXTERIOR EVA (ZERO-G RCS THRUSTERS OR MAGNETIC BOOTS LOCK)
      // ======================================================================
      if (gameState.isMagBootsLocked) {
        // Firm Magnetic Deck Walkway Mode
        const desiredVelX = (forward.x * -moveInput.z + right.x * moveInput.x) * baseSpeed;
        const desiredVelZ = (forward.z * -moveInput.z + right.z * moveInput.x) * baseSpeed;

        velocityRef.current.x = desiredVelX;
        velocityRef.current.z = desiredVelZ;
        velocityRef.current.y = 0;
        playerPosRef.current.y = 0.05;
        isGroundedRef.current = true;

        const deltaPos = new THREE.Vector3(
          velocityRef.current.x * dt,
          0,
          velocityRef.current.z * dt
        );
        const { finalPos, collided } = physics.movePlayer(playerPosRef.current, deltaPos, 0.52);
        playerPosRef.current.x = finalPos.x;
        playerPosRef.current.z = finalPos.z;
        if (collided) {
          velocityRef.current.x *= 0.4;
          velocityRef.current.z *= 0.4;
        }

        const speedMag = Math.sqrt(velocityRef.current.x ** 2 + velocityRef.current.z ** 2);
        if (speedMag > 0.4) {
          bobbingTimerRef.current += dt * 8;
          lastFootstepDistRef.current += speedMag * dt;
          if (lastFootstepDistRef.current >= 1.6) {
            soundManager.playFootstep();
            lastFootstepDistRef.current = 0;
          }
        }
      } else {
        // Zero-G RCS Thruster Flight Mode
        const rcsThrust = 3.6;
        const rcsAcc = new THREE.Vector3();

        if (moveInput.z !== 0) {
          rcsAcc.addScaledVector(forward, -moveInput.z * rcsThrust);
        }
        if (moveInput.x !== 0) {
          rcsAcc.addScaledVector(right, moveInput.x * rcsThrust);
        }
        if (keys["Space"] || keys[" "]) {
          rcsAcc.y += rcsThrust; // Thrust UP
        }
        if (keys["ControlLeft"] || keys["ControlRight"] || keys["control"] || keys["KeyX"] || keys["x"] || keys["KeyZ"] || keys["z"]) {
          rcsAcc.y -= rcsThrust; // Thrust DOWN
        }

        // Apply RCS acceleration
        velocityRef.current.addScaledVector(rcsAcc, dt);

        // Audio puff on thruster firing
        if (rcsAcc.lengthSq() > 0.1) {
          const now = Date.now();
          if (now - lastThrusterTimeRef.current > 350) {
            soundManager.playThrusterPuff();
            lastThrusterTimeRef.current = now;
          }
        }

        // Zero-G drag / damping
        velocityRef.current.multiplyScalar(Math.pow(0.85, dt * 8));

        // Move with collision checking along gantry
        const deltaPos = velocityRef.current.clone().multiplyScalar(dt);
        const { finalPos, collided } = physics.movePlayer(playerPosRef.current, deltaPos, 0.52);
        playerPosRef.current.copy(finalPos);
        if (collided) {
          velocityRef.current.multiplyScalar(0.3);
        }

        // Automatic Safety Tether Boundary Arrest
        if (
          playerPosRef.current.y > 16.0 ||
          playerPosRef.current.y < -12.0 ||
          playerPosRef.current.x > 8.0 ||
          playerPosRef.current.x < -8.0 ||
          playerPosRef.current.z < -42.0 ||
          playerPosRef.current.z > -9.5
        ) {
          playerPosRef.current.set(0, 0.05, -14.0);
          velocityRef.current.set(0, 0, 0);
          isGroundedRef.current = true;
          soundManager.playEquip();
          soundManager.speakRadioComm(
            "Safety tether limit reached. Astronaut reeled safely back to Gateway-1 gantry deck.",
            "HOUSTON"
          );
        }
      }
    }

    // Dynamic acoustic environment: vacuum in zero-g EVA vs pressurized module
    soundManager.setAcousticEnvironment(isEva);

    // Dynamic FOV Lerp (75 deg walking to 84 deg sprinting)
    const targetFov = isSprinting ? 84 : 75;
    const persCam = camera as THREE.PerspectiveCamera;
    if (persCam && persCam.isPerspectiveCamera && Math.abs(persCam.fov - targetFov) > 0.05) {
      persCam.fov = THREE.MathUtils.lerp(persCam.fov, targetFov, dt * 6);
      persCam.updateProjectionMatrix();
    }

    // Strafe banking roll tilt (0.75 to 1.5 deg on A/D)
    const rollTarget = !isEva && isGroundedRef.current ? -moveInput.x * 0.02 : 0;
    rollRef.current = THREE.MathUtils.lerp(rollRef.current, rollTarget, dt * 8);

    // Dual-frequency procedural Sin/Cos head bobbing
    const eyeHeight = 1.65;
    const verticalBob = Math.sin(bobbingTimerRef.current) * 0.032;
    const lateralBob = Math.cos(bobbingTimerRef.current * 0.5) * 0.014;

    camera.position.set(
      playerPosRef.current.x + lateralBob,
      playerPosRef.current.y + eyeHeight + verticalBob,
      playerPosRef.current.z
    );

    // Apply Euler rotations with strafe banking roll
    const euler = new THREE.Euler(pitchRef.current, yawRef.current, rollRef.current, "YXZ");
    camera.quaternion.setFromEuler(euler);

    // Update Helmet Flashlight
    if (flashlightRef.current) {
      flashlightRef.current.position.copy(camera.position);
      const forwardVec = new THREE.Vector3();
      camera.getWorldDirection(forwardVec);

      flashlightTargetRef.current.position
        .copy(camera.position)
        .addScaledVector(forwardVec, 8);
      flashlightRef.current.target = flashlightTargetRef.current;
      flashlightRef.current.visible = gameState.flashlightOn;
    }

    // Update Held Viewmodel Position with Inertia Sway Lag
    if (itemGroupRef.current) {
      swayOffsetRef.current.lerp(new THREE.Vector3(0, 0, 0), dt * 10);
      const viewmodelPos = camera.position
        .clone()
        .add(
          new THREE.Vector3(
            swayOffsetRef.current.x,
            swayOffsetRef.current.y,
            0
          ).applyQuaternion(camera.quaternion)
        );
      itemGroupRef.current.position.copy(viewmodelPos);
      itemGroupRef.current.quaternion.copy(camera.quaternion);
    }

    // ========================================================================
    // INTERACTION RAYCASTING & OBJECT DETECTION
    // ========================================================================
    let targetId: string | null = null;
    let targetPrompt: string | null = null;

    const p = playerPosRef.current;

    if (isSurface) {
      // 1. Landed Spacecraft on PAD-01 ([0, -16.2, -110.0])
      const distToShuttle = p.distanceTo(new THREE.Vector3(0, -18.0, -110.0));
      if (distToShuttle < 8.0) {
        targetId = "board_spacecraft_surface";
        targetPrompt = "[E] Enter Spacecraft Cockpit (Prepare for Ascent)";
      }

      // 2. Lunar Base Alpha Habitat Module ([16.0, -18.0, -102.0])
      const distToBase = p.distanceTo(new THREE.Vector3(16.0, -18.0, -102.0));
      if (distToBase < 7.5) {
        targetId = "lunar_base_terminal";
        targetPrompt = "[E] Access Lunar Base Alpha Science Terminal";
      }

      // 3. Communications Mast ([-14.0, -18.0, -100.0])
      const distToMast = p.distanceTo(new THREE.Vector3(-14.0, -18.0, -100.0));
      if (distToMast < 7.0) {
        targetId = "lunar_comms_mast";
        targetPrompt = "[E] Inspect Deep Space Relay Antenna";
      }

      // 4. Collectible Lunar Core Geological Sample (CORE-GEO-01)
      const distToSample = p.distanceTo(new THREE.Vector3(8.5, -18.0, -98.0));
      if (distToSample < 6.5 && !gameState.lunarSampleCollected) {
        targetId = "lunar_sample";
        targetPrompt = "[E] Collect Lunar Regolith Core Sample (CORE-GEO-01)";
      }

      // 5. Deploy Apollo ALSEP Lunar Science Station (at designated deployment site [5.0, -18.0, -104.0])
      const distToAlsepSite = p.distanceTo(new THREE.Vector3(5.0, -18.0, -104.0));
      if (distToAlsepSite < 8.5 && gameState.inventory.includes("ALSEP_KIT") && !gameState.alsepDeployed) {
        targetId = "deploy_alsep";
        targetPrompt = "[E / 4] Deploy Apollo ALSEP Lunar Science Station";
      }
    } else {
      // 1. Briefing Table (Command Deck: [0, 0, 11])
      const distToBriefing = p.distanceTo(new THREE.Vector3(0, 0, 11));
      if (distToBriefing < 5.5) {
        targetId = "briefing_table";
        targetPrompt = "[E] Review Mission Briefing";
      }

      // 2. Left Workbench - Toolkit
      const distToToolkit = p.distanceTo(new THREE.Vector3(-3.4, 0, 0.5));
      if (distToToolkit < 5.5 && !gameState.inventory.includes("TOOLKIT")) {
        targetId = "ws_toolkit";
        targetPrompt = "[E] Pick up Aerospace Toolkit [1]";
      }

      // 3. Right Workbench - Solar Wing
      const distToSolar = p.distanceTo(new THREE.Vector3(3.4, 0, -0.2));
      if (distToSolar < 5.5 && !gameState.inventory.includes("SOLAR_WING")) {
        targetId = "ws_solar_wing";
        targetPrompt = "[E] Pick up GaAs Solar Array (28W) [2]";
      }

      // 4. Right Workbench - S-Band Antenna
      const distToAntenna = p.distanceTo(new THREE.Vector3(3.4, 0, 1.2));
      if (distToAntenna < 5.5 && !gameState.inventory.includes("SBAND_ANTENNA")) {
        targetId = "ws_sband_antenna";
        targetPrompt = "[E] Pick up S-Band Transceiver [3]";
      }

      // 4b. Streamlined Workshop Auto-Equip Action (when inside workshop corridor)
      const hasAllWorkshopGear =
        gameState.inventory.includes("TOOLKIT") &&
        gameState.inventory.includes("SOLAR_WING") &&
        gameState.inventory.includes("SBAND_ANTENNA");
      if (!targetId && !hasAllWorkshopGear && p.z >= -4.5 && p.z <= 6.0 && Math.abs(p.x) < 4.8) {
        targetId = "ws_equip_all";
        targetPrompt = "[E] Equip All EVA Repair Gear (Toolkit, Wing, Antenna)";
      }

      // 5. Airlock Console
      const distToAirlockConsole = p.distanceTo(new THREE.Vector3(-1.85, 0, -8.0));
      if (distToAirlockConsole < 6.0) {
        targetId = "airlock_console";
        if (gameState.airlockStatus === "PRESSURIZED") {
          targetPrompt = "[E] Cycle Airlock (Depressurize to Vacuum)";
        } else if (gameState.airlockStatus === "VACUUM") {
          targetPrompt = "[E] Cycle Airlock (Repressurize to 1 atm)";
        } else {
          targetPrompt = "Airlock Cycling...";
        }
      }

      // 6. Damaged Satellite `AERO-3X`
      const distToSatellite = p.distanceTo(new THREE.Vector3(0, 0, -22.0));
      if (distToSatellite < 7.2) {
        targetId = "satellite_repair";
        if (!gameState.satellite.wingRemoved) {
          targetPrompt = "[E] Repair Step 1/4: Detach Damaged Solar Wing";
        } else if (!gameState.satellite.wingMounted) {
          targetPrompt = "[E] Repair Step 2/4: Mount GaAs Solar Array";
        } else if (!gameState.satellite.antennaMounted) {
          targetPrompt = "[E] Repair Step 3/4: Install S-Band Transceiver";
        } else if (!gameState.satellite.diagnosticRun) {
          targetPrompt = "[E] Repair Step 4/4: Run Avionics Diagnostics & Lock Telemetry";
        } else {
          targetPrompt = "AERO-3X Restored · Telemetry Active";
        }
      }

      // 7. Life Support Recharging Station (Command Deck West Wall)
      const distToLifeSupport = p.distanceTo(new THREE.Vector3(-4.3, 1.3, 8.5));
      if (distToLifeSupport < 5.0) {
        targetId = "life_support";
        targetPrompt = "[E] Refill Suit Oxygen & Recharge Battery";
      }

      // 8. Board Spacecraft Shuttle ORV-1 (Exterior Gantry Berth)
      const distToSpacecraft = p.distanceTo(new THREE.Vector3(0, 0.8, -28.0));
      if (distToSpacecraft < 7.5) {
        targetId = "board_spacecraft";
        targetPrompt = gameState.satellite.diagnosticRun
          ? "[E] Enter Spacecraft Cockpit (Prepare for Flight)"
          : "Orbital Shuttle Standby (Satellite Repair Required First)";
      }

      // 9. HANGAR SANDBOX STATIONS (Workstations strictly for HANGAR_SANDBOX game mode)
      if (gameState.step === "HANGAR_ASSEMBLY") {
        // Station 1: Chassis Selection Workstation ([-3.7, 0, -1.8])
        const distChassisWs = p.distanceTo(new THREE.Vector3(-3.5, 0, -1.8));
        if (distChassisWs < 2.8) {
          targetId = "hangar_chassis";
          targetPrompt = `[E] Cycle Spacecraft Chassis (Current: ${gameState.hangarCraft?.chassis || "3U"})`;
        }

        // Station 2: Solar Array Workstation ([3.7, 0, -1.8])
        const distSolarWs = p.distanceTo(new THREE.Vector3(3.5, 0, -1.8));
        if (distSolarWs < 2.8) {
          targetId = "hangar_solar";
          targetPrompt = `[E] Cycle Solar Arrays (Current: ${gameState.hangarCraft?.solar || "SINGLE_WING"})`;
        }

        // Station 3: Propulsion Workstation ([3.7, 0, 1.8])
        const distPropWs = p.distanceTo(new THREE.Vector3(3.5, 0, 1.8));
        if (distPropWs < 2.8) {
          targetId = "hangar_propulsion";
          targetPrompt = `[E] Cycle Propulsion Engine (Current: ${gameState.hangarCraft?.propulsion || "HYDRAZINE"})`;
        }

        // Station 4: Science Payload Workstation ([-3.7, 0, 1.8])
        const distPayloadWs = p.distanceTo(new THREE.Vector3(-3.5, 0, 1.8));
        if (distPayloadWs < 2.8) {
          targetId = "hangar_payload";
          targetPrompt = `[E] Cycle Mission Payload (Current: ${gameState.hangarCraft?.payload || "IMAGER"})`;
        }

        // Station 5: Telecom Relay Workstation ([-3.7, 0, 3.8])
        const distTelecomWs = p.distanceTo(new THREE.Vector3(-3.5, 0, 3.8));
        if (distTelecomWs < 2.8) {
          targetId = "hangar_telecom";
          targetPrompt = `[E] Cycle Telecom Transceiver (Current: ${gameState.hangarCraft?.telecom || "SBAND"})`;
        }

        // Station 6: Static Fire Propulsion Stand ([0, 0, 2.2])
        const distStaticFire = p.distanceTo(new THREE.Vector3(0, 0, 2.2));
        if (distStaticFire < 2.6) {
          targetId = "hangar_static_fire";
          targetPrompt = "[E / R] Static-Fire Thruster Test Plume";
        }

        // Station 7: Departure / Launch Airlock Gate ([0, 0, -4.6])
        const distLaunchGate = p.distanceTo(new THREE.Vector3(0, 0, -4.6));
        if (distLaunchGate < 2.8) {
          targetId = "hangar_launch";
          targetPrompt = "[E / L] Launch Spacecraft to 3D Orbit";
        }
      }
    }

    currentTargetIdRef.current = targetId;
    if (
      targetId !== lastReportedTargetRef.current ||
      targetPrompt !== lastReportedPromptRef.current
    ) {
      lastReportedTargetRef.current = targetId;
      lastReportedPromptRef.current = targetPrompt;
      onSetInteractionPrompt(targetId, targetPrompt);
    }
  });

  return (
    <>
      {/* Directional Helmet Spotlight */}
      <spotLight
        ref={flashlightRef}
        intensity={2.4}
        distance={24}
        angle={Math.PI / 6}
        penumbra={0.45}
        color="#fef08a"
        castShadow
      />

      {/* First-Person Equipped Item 3D Viewmodel */}
      {gameState.controlMode === "ASTRONAUT" && gameState.equippedItem && (
        <group ref={itemGroupRef}>
          <group position={[0.26, -0.22, -0.42]} rotation={[0.1, -0.25, 0.05]}>
            {gameState.equippedItem === "TOOLKIT" && (
              <group scale={[0.8, 0.8, 0.8]}>
                <mesh position={[0, 0.08, 0]}>
                  <cylinderGeometry args={[0.018, 0.018, 0.22, 12]} />
                  <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.2} />
                </mesh>
                <mesh position={[0, 0.18, 0.03]} rotation={[0, 0, Math.PI / 4]}>
                  <boxGeometry args={[0.045, 0.05, 0.03]} />
                  <meshStandardMaterial color="#0284c7" metalness={0.8} roughness={0.3} />
                </mesh>
                <mesh position={[0, 0.19, 0.048]}>
                  <sphereGeometry args={[0.008, 8, 8]} />
                  <meshBasicMaterial color="#38bdf8" />
                </mesh>
                <pointLight position={[0, 0.2, 0.05]} intensity={0.5} distance={1.2} color="#38bdf8" />
              </group>
            )}

            {gameState.equippedItem === "SOLAR_WING" && (
              <group scale={[0.45, 0.45, 0.45]}>
                <mesh position={[0, 0.1, 0]}>
                  <boxGeometry args={[0.22, 0.38, 0.02]} />
                  <meshStandardMaterial color="#0369a1" metalness={0.85} roughness={0.15} />
                </mesh>
                <mesh position={[0, -0.1, 0]}>
                  <cylinderGeometry args={[0.015, 0.015, 0.1, 8]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
                </mesh>
              </group>
            )}

            {gameState.equippedItem === "SBAND_ANTENNA" && (
              <group scale={[0.55, 0.55, 0.55]}>
                <mesh position={[0, 0.08, 0]}>
                  <boxGeometry args={[0.16, 0.16, 0.02]} />
                  <meshStandardMaterial color="#eab308" metalness={0.95} roughness={0.1} />
                </mesh>
                <mesh position={[0, 0.14, 0.02]}>
                  <cylinderGeometry args={[0.01, 0.01, 0.08, 8]} />
                  <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.3} />
                </mesh>
              </group>
            )}

            {gameState.equippedItem === "ALSEP_KIT" && (
              <group scale={[0.5, 0.5, 0.5]}>
                <mesh position={[0, 0.08, 0]}>
                  <boxGeometry args={[0.22, 0.16, 0.16]} />
                  <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.2} />
                </mesh>
                <mesh position={[0, 0.18, 0]}>
                  <cylinderGeometry args={[0.012, 0.012, 0.12, 8]} />
                  <meshStandardMaterial color="#94a3b8" metalness={0.9} />
                </mesh>
                <mesh position={[0, 0.25, 0]}>
                  <sphereGeometry args={[0.025, 8, 8]} />
                  <meshBasicMaterial color="#00f3ff" />
                </mesh>
              </group>
            )}
          </group>
        </group>
      )}

      {/* Dynamic Regolith Boot Dust Kick Puffs in 1/6th Lunar Gravity */}
      <AstronautBootDust
        isSurface={gameState.controlMode === "SURFACE_EXPLORATION"}
        playerPos={playerPosRef.current}
        isGrounded={isGroundedRef.current}
        isMoving={isMovingRef.current}
        dustTriggerRef={dustTriggerRef}
      />
    </>
  );
}
