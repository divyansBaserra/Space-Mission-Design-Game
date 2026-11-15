"use client";

import React, { useRef, useMemo, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GameState, InventoryItemId } from "./types";
import { RealisticEarth } from "@/components/viewport/RealisticEarth";
import { useNASAModel } from "./useNASAModel";

interface StationEnvironmentProps {
  gameState: GameState;
  onInteract: (targetId: string) => void;
}

function NASAModelObject({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
}: {
  url: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}) {
  const model = useNASAModel(url);
  if (!model) return null;
  return <primitive object={model} position={position} rotation={rotation} scale={scale} />;
}

function StationModel({
  url,
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = [1, 1, 1],
}: {
  url: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
}) {
  const gltf = useGLTF(url);
  const cloned = useMemo(() => gltf.scene.clone(), [gltf.scene]);
  return <primitive object={cloned} position={position} rotation={rotation} scale={scale} />;
}

export function StationEnvironment({
  gameState,
}: StationEnvironmentProps) {
  const earthGroupRef = useRef<THREE.Group>(null);
  const sparkRef = useRef<THREE.PointLight>(null);
  const innerDoorLeftRef = useRef<THREE.Mesh>(null);
  const innerDoorRightRef = useRef<THREE.Mesh>(null);
  const outerDoorLeftRef = useRef<THREE.Mesh>(null);
  const outerDoorRightRef = useRef<THREE.Mesh>(null);
  const satBeaconRef = useRef<THREE.PointLight>(null);
  const holoSatRef = useRef<THREE.Group>(null);

  // Frame animations
  useFrame((_, delta) => {
    // Hologram rotation in command deck
    if (holoSatRef.current) {
      holoSatRef.current.rotation.y += delta * 0.8;
      holoSatRef.current.rotation.x = Math.sin(Date.now() * 0.001) * 0.15;
    }

    // Damaged satellite sparking effect
    if (sparkRef.current && !gameState.satellite.wingRemoved) {
      const isSpark = Math.random() > 0.82;
      sparkRef.current.intensity = isSpark ? 2.5 + Math.random() * 3.0 : 0.05;
    }

    // Satellite beacon pulse once repaired
    if (satBeaconRef.current) {
      if (gameState.satellite.diagnosticRun) {
        satBeaconRef.current.intensity = 1.0 + Math.sin(Date.now() * 0.005) * 0.8;
      } else {
        satBeaconRef.current.intensity = Math.sin(Date.now() * 0.008) > 0 ? 1.2 : 0.0;
      }
    }

    // Smooth door sliding animation
    const targetInnerOpen = gameState.airlockInnerDoorOpen ? 1.1 : 0.0;
    const targetOuterOpen = gameState.airlockOuterDoorOpen ? 1.1 : 0.0;

    if (innerDoorLeftRef.current && innerDoorRightRef.current) {
      innerDoorLeftRef.current.position.x = THREE.MathUtils.lerp(
        innerDoorLeftRef.current.position.x,
        -0.55 - targetInnerOpen * 0.55,
        delta * 6
      );
      innerDoorRightRef.current.position.x = THREE.MathUtils.lerp(
        innerDoorRightRef.current.position.x,
        0.55 + targetInnerOpen * 0.55,
        delta * 6
      );
    }

    if (outerDoorLeftRef.current && outerDoorRightRef.current) {
      outerDoorLeftRef.current.position.x = THREE.MathUtils.lerp(
        outerDoorLeftRef.current.position.x,
        -0.55 - targetOuterOpen * 0.55,
        delta * 6
      );
      outerDoorRightRef.current.position.x = THREE.MathUtils.lerp(
        outerDoorRightRef.current.position.x,
        0.55 + targetOuterOpen * 0.55,
        delta * 6
      );
    }
  });

  const hasItem = (id: InventoryItemId) => gameState.inventory.includes(id);

  return (
    <group>
      {/* ==================================================================== */}
      {/* EXTERIOR DEEP SPACE & EARTH ORBIT                                     */}
      {/* ==================================================================== */}
      <Stars radius={120} depth={60} count={4000} factor={4} saturation={0} fade speed={0.5} />

      {/* Sun Directional Light (crisp space lighting) */}
      <directionalLight position={[25, 12, 10]} intensity={1.8} castShadow shadow-bias={-0.0001} />
      <ambientLight intensity={0.12} />

      {/* Photorealistic NASA Blue Marble Earth in Low Earth Orbit */}
      <RealisticEarth
        radius={75}
        position={[0, -76, 10]}
        rotationSpeed={0.012}
      />

      {/* ==================================================================== */}
      {/* 1. COMMAND DECK / BRIDGE (X: [-4.5, 4.5], Z: [6, 16], Y: [0, 3])     */}
      {/* ==================================================================== */}
      {/* Floor */}
      <mesh position={[0, 0, 11]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[9, 10]} />
        <meshStandardMaterial color="#1e2229" roughness={0.65} metalness={0.3} />
      </mesh>

      {/* Floor Hazard Stripe along exit door */}
      <mesh position={[0, 0.005, 6.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[2.4, 0.15]} />
        <meshStandardMaterial color="#f59e0b" roughness={0.4} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, 3.0, 11]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9, 10]} />
        <meshStandardMaterial color="#2d333f" roughness={0.7} />
      </mesh>

      {/* Ceiling LED Light Strips */}
      <mesh position={[-2.2, 2.98, 11]}>
        <boxGeometry args={[0.3, 0.04, 7.5]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[2.2, 2.98, 11]}>
        <boxGeometry args={[0.3, 0.04, 7.5]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <pointLight position={[0, 2.7, 11]} intensity={0.9} distance={12} color="#f0f4ff" />

      {/* West & East Walls */}
      <mesh position={[-4.5, 1.5, 11]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[10, 3.0]} />
        <meshStandardMaterial color="#333b47" roughness={0.8} />
      </mesh>
      <mesh position={[4.5, 1.5, 11]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[10, 3.0]} />
        <meshStandardMaterial color="#333b47" roughness={0.8} />
      </mesh>

      {/* Life Support Recharging & Oxygen Refill Station on West Wall */}
      <group position={[-4.35, 1.3, 8.5]}>
        <mesh castShadow>
          <boxGeometry args={[0.2, 1.2, 0.8]} />
          <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.6} />
        </mesh>
        {/* Glowing O2 & Power Status Indicator */}
        <mesh position={[0.11, 0.25, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.6, 0.35]} />
          <meshBasicMaterial color="#059669" />
        </mesh>
        <pointLight position={[0.25, 0.25, 0]} intensity={0.8} distance={3.0} color="#10b981" />
      </group>

      {/* South Panoramic Window looking out at Earth */}
      {/* Lower sill */}
      <mesh position={[0, 0.3, 16]}>
        <boxGeometry args={[9, 0.6, 0.3]} />
        <meshStandardMaterial color="#1e2229" roughness={0.7} />
      </mesh>
      {/* Top beam */}
      <mesh position={[0, 2.85, 16]}>
        <boxGeometry args={[9, 0.3, 0.3]} />
        <meshStandardMaterial color="#1e2229" roughness={0.7} />
      </mesh>
      {/* Window mullions */}
      {[-3, 0, 3].map((x) => (
        <mesh key={`mullion-${x}`} position={[x, 1.6, 16]}>
          <boxGeometry args={[0.15, 2.4, 0.25]} />
          <meshStandardMaterial color="#2a303c" roughness={0.7} metalness={0.4} />
        </mesh>
      ))}
      {/* Reinforced Transparent Glass Pane */}
      <mesh position={[0, 1.6, 16]}>
        <planeGeometry args={[8.8, 2.3]} />
        <meshPhysicalMaterial
          color="#a5f3fc"
          transmission={0.92}
          opacity={0.3}
          transparent
          roughness={0.1}
          metalness={0.1}
        />
      </mesh>

      {/* Partition Wall to Workshop (Z = 6, Doorway [-1.2, 1.2]) */}
      <mesh position={[-2.85, 1.5, 6]}>
        <boxGeometry args={[3.3, 3.0, 0.25]} />
        <meshStandardMaterial color="#2d333f" roughness={0.75} />
      </mesh>
      <mesh position={[2.85, 1.5, 6]}>
        <boxGeometry args={[3.3, 3.0, 0.25]} />
        <meshStandardMaterial color="#2d333f" roughness={0.75} />
      </mesh>
      <mesh position={[0, 2.65, 6]}>
        <boxGeometry args={[2.4, 0.7, 0.25]} />
        <meshStandardMaterial color="#2d333f" roughness={0.75} />
      </mesh>

      {/* Command Deck Center Holo-Table & Briefing Terminal */}
      <group position={[0, 0, 11]}>
        {/* Pedestal */}
        <mesh position={[0, 0.45, 0]}>
          <cylinderGeometry args={[0.7, 0.85, 0.9, 16]} />
          <meshStandardMaterial color="#181c22" roughness={0.5} metalness={0.5} />
        </mesh>
        {/* Holographic Emitter Ring */}
        <mesh position={[0, 0.91, 0]}>
          <cylinderGeometry args={[0.6, 0.6, 0.04, 24]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        <pointLight position={[0, 1.3, 0]} intensity={1.2} distance={4} color="#38bdf8" />

        {/* Floating Holographic Satellite Model */}
        <group ref={holoSatRef} position={[0, 1.45, 0]} scale={[0.4, 0.4, 0.4]}>
          {/* Main 3U bus */}
          <mesh>
            <boxGeometry args={[0.5, 1.5, 0.5]} />
            <meshBasicMaterial color="#38bdf8" wireframe />
          </mesh>
          {/* Intact Left wing */}
          <mesh position={[-0.8, 0, 0]}>
            <boxGeometry args={[1.0, 1.2, 0.05]} />
            <meshBasicMaterial color="#38bdf8" wireframe />
          </mesh>
          {/* Damaged Right wing (blinking red wireframe) */}
          <mesh position={[0.7, -0.2, 0]} rotation={[0, 0, -0.4]}>
            <boxGeometry args={[0.8, 0.9, 0.05]} />
            <meshBasicMaterial color="#ef4444" wireframe />
          </mesh>
        </group>

        {/* Mission Briefing Touch Display */}
        <mesh position={[0, 0.95, -0.6]} rotation={[-Math.PI / 4, 0, 0]}>
          <planeGeometry args={[0.8, 0.45]} />
          <meshBasicMaterial color="#0284c7" />
        </mesh>
      </group>

      {/* ==================================================================== */}
      {/* 2. ENGINEERING WORKSHOP (X: [-4.5, 4.5], Z: [-5, 6], Y: [0, 3])      */}
      {/* ==================================================================== */}
      {/* Floor */}
      <mesh position={[0, 0, 0.5]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[9, 11]} />
        <meshStandardMaterial color="#191d24" roughness={0.7} metalness={0.25} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, 3.0, 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9, 11]} />
        <meshStandardMaterial color="#2d333f" roughness={0.7} />
      </mesh>

      {/* Workshop Lights */}
      <pointLight position={[0, 2.7, 0.5]} intensity={1.1} distance={12} color="#f8fafc" />
      <mesh position={[-2.2, 2.98, 0.5]}>
        <boxGeometry args={[0.3, 0.04, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
      <mesh position={[2.2, 2.98, 0.5]}>
        <boxGeometry args={[0.3, 0.04, 8]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>

      {/* West Wall & East Wall */}
      <mesh position={[-4.5, 1.5, 0.5]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[11, 3.0]} />
        <meshStandardMaterial color="#28303d" roughness={0.8} />
      </mesh>
      <mesh position={[4.5, 1.5, 0.5]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[11, 3.0]} />
        <meshStandardMaterial color="#28303d" roughness={0.8} />
      </mesh>

      {/* LEFT WORKBENCH (Tool Assembly Rack - holds Toolkit) */}
      <group position={[-3.7, 0, 0.5]}>
        {/* Table structure */}
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.1, 0.9, 2.8]} />
          <meshStandardMaterial color="#1a202c" roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.91, 0]}>
          <boxGeometry args={[1.2, 0.04, 2.9]} />
          <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.6} />
        </mesh>

        {/* Tool pegboard on wall */}
        <mesh position={[-0.78, 1.6, 0]}>
          <boxGeometry args={[0.04, 1.2, 2.6]} />
          <meshStandardMaterial color="#0f172a" roughness={0.8} />
        </mesh>

        {/* TOOLKIT 3D ITEM (if not collected) */}
        {!hasItem("TOOLKIT") && (
          <group position={[0, 0.96, 0]}>
            {/* Heavy-duty aerospace tool case */}
            <mesh castShadow>
              <boxGeometry args={[0.38, 0.12, 0.55]} />
              <meshStandardMaterial color="#eab308" roughness={0.35} metalness={0.3} />
            </mesh>
            {/* Metallic latches & handle */}
            <mesh position={[0.2, 0.02, 0]}>
              <boxGeometry args={[0.03, 0.06, 0.25]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.2} />
            </mesh>
            {/* Torque driver on top */}
            <mesh position={[0, 0.08, 0]} rotation={[0, 0.4, 0]}>
              <cylinderGeometry args={[0.022, 0.022, 0.28, 12]} />
              <meshStandardMaterial color="#38bdf8" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Interactive hover glow */}
            <pointLight position={[0, 0.3, 0]} intensity={0.6} distance={1.8} color="#facc15" />
          </group>
        )}
      </group>

      {/* RIGHT WORKBENCH (Component Assembly - holds Solar Wing & Antenna) */}
      <group position={[3.7, 0, 0.5]}>
        {/* Table structure */}
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.1, 0.9, 2.8]} />
          <meshStandardMaterial color="#1a202c" roughness={0.6} metalness={0.4} />
        </mesh>
        <mesh position={[0, 0.91, 0]}>
          <boxGeometry args={[1.2, 0.04, 2.9]} />
          <meshStandardMaterial color="#334155" roughness={0.4} metalness={0.6} />
        </mesh>

        {/* Cleanroom laminar flow hood / test screen */}
        <mesh position={[0.55, 1.5, 0]}>
          <boxGeometry args={[0.04, 0.9, 2.4]} />
          <meshBasicMaterial color="#0369a1" />
        </mesh>

        {/* SOLAR WING 3D ITEM (if not collected) */}
        {!hasItem("SOLAR_WING") && (
          <group position={[0, 0.95, -0.65]}>
            {/* Folded GaAs solar panel assembly */}
            <mesh castShadow>
              <boxGeometry args={[0.26, 0.05, 0.65]} />
              <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.5} />
            </mesh>
            {/* Triple junction deep-blue photovoltaic cell grid */}
            <mesh position={[0, 0.03, 0]}>
              <boxGeometry args={[0.24, 0.01, 0.62]} />
              <meshStandardMaterial color="#0284c7" roughness={0.15} metalness={0.6} />
            </mesh>
            {/* Gold Kapton backing & titanium hinges */}
            <mesh position={[-0.14, 0, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.65, 8]} />
              <meshStandardMaterial color="#d97706" metalness={0.9} roughness={0.25} />
            </mesh>
            <pointLight position={[0, 0.25, 0]} intensity={0.6} distance={1.8} color="#38bdf8" />
          </group>
        )}

        {/* S-BAND ANTENNA 3D ITEM (if not collected) */}
        {!hasItem("SBAND_ANTENNA") && (
          <group position={[0, 0.95, 0.65]}>
            {/* Square gold patch antenna with coaxial connector */}
            <mesh castShadow>
              <boxGeometry args={[0.22, 0.03, 0.22]} />
              <meshStandardMaterial color="#eab308" metalness={0.88} roughness={0.18} />
            </mesh>
            {/* RF ground plane backing */}
            <mesh position={[0, -0.02, 0]}>
              <boxGeometry args={[0.26, 0.02, 0.26]} />
              <meshStandardMaterial color="#64748b" metalness={0.7} roughness={0.4} />
            </mesh>
            {/* SMA coaxial connector */}
            <mesh position={[0, -0.05, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.06, 12]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
            </mesh>
            <pointLight position={[0, 0.25, 0]} intensity={0.6} distance={1.8} color="#f59e0b" />
          </group>
        )}
      </group>

      {/* Workshop Spacesuit Rack (Real NASA EMU Spacesuit) */}
      <group position={[4.1, 0.95, -3.5]}>
        <mesh position={[0, -0.9, 0]}>
          <boxGeometry args={[0.9, 0.1, 0.9]} />
          <meshStandardMaterial color="#1e293b" roughness={0.6} />
        </mesh>
        <Suspense fallback={null}>
          <NASAModelObject
            url="/assets/models/nasa/astronaut-engine.glb"
            position={[0, 0, 0]}
            rotation={[0, -Math.PI / 2, 0]}
            scale={[0.024, 0.024, 0.024]}
          />
        </Suspense>
      </group>

      {/* Partition Wall to Airlock (Z = -5, Doorway [-1.1, 1.1]) */}
      <mesh position={[-2.85, 1.5, -5]}>
        <boxGeometry args={[3.3, 3.0, 0.35]} />
        <meshStandardMaterial color="#2d333f" roughness={0.75} />
      </mesh>
      <mesh position={[2.85, 1.5, -5]}>
        <boxGeometry args={[3.3, 3.0, 0.35]} />
        <meshStandardMaterial color="#2d333f" roughness={0.75} />
      </mesh>
      <mesh position={[0, 2.65, -5]}>
        <boxGeometry args={[2.4, 0.7, 0.35]} />
        <meshStandardMaterial color="#2d333f" roughness={0.75} />
      </mesh>

      {/* ==================================================================== */}
      {/* 3. AIRLOCK CHAMBER (X: [-2.0, 2.0], Z: [-11, -5], Y: [0, 3])         */}
      {/* ==================================================================== */}
      {/* Floor with non-slip grating */}
      <mesh position={[0, 0, -8]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[4, 6]} />
        <meshStandardMaterial color="#111418" roughness={0.8} metalness={0.4} />
      </mesh>

      {/* Ceiling */}
      <mesh position={[0, 3.0, -8]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[4, 6]} />
        <meshStandardMaterial color="#1f242d" roughness={0.7} />
      </mesh>

      {/* Airlock Chamber Light (changes color based on status: Green/Amber/Red) */}
      <pointLight
        position={[0, 2.7, -8]}
        intensity={1.2}
        distance={8}
        color={
          gameState.airlockStatus === "PRESSURIZED"
            ? "#22c55e"
            : gameState.airlockStatus === "VACUUM"
            ? "#ef4444"
            : "#f59e0b"
        }
      />

      {/* West & East Reinforced Bulkhead Walls */}
      <mesh position={[-2.0, 1.5, -8]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[6, 3.0]} />
        <meshStandardMaterial color="#2b323e" roughness={0.75} />
      </mesh>
      <mesh position={[2.0, 1.5, -8]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[6, 3.0]} />
        <meshStandardMaterial color="#2b323e" roughness={0.75} />
      </mesh>

      {/* Heavy EVA Handrails inside airlock */}
      <mesh position={[-1.85, 1.1, -8]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 5.2, 12]} />
        <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.8} />
      </mesh>
      <mesh position={[1.85, 1.1, -8]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.025, 0.025, 5.2, 12]} />
        <meshStandardMaterial color="#eab308" roughness={0.3} metalness={0.8} />
      </mesh>

      {/* AIRLOCK CONTROL CONSOLE on West Wall (Z = -8) */}
      <group position={[-1.85, 1.25, -8]}>
        {/* Console chassis */}
        <mesh castShadow>
          <boxGeometry args={[0.15, 0.7, 0.9]} />
          <meshStandardMaterial color="#181c22" roughness={0.4} metalness={0.6} />
        </mesh>
        {/* Screen */}
        <mesh position={[0.08, 0.05, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[0.7, 0.45]} />
          <meshBasicMaterial
            color={
              gameState.airlockStatus === "PRESSURIZED"
                ? "#15803d"
                : gameState.airlockStatus === "VACUUM"
                ? "#b91c1c"
                : "#b45309"
            }
          />
        </mesh>
        {/* Status Light Bar */}
        <mesh position={[0.08, 0.31, 0]}>
          <boxGeometry args={[0.02, 0.04, 0.6]} />
          <meshBasicMaterial
            color={
              gameState.airlockStatus === "PRESSURIZED"
                ? "#4ade80"
                : gameState.airlockStatus === "VACUUM"
                ? "#f87171"
                : "#fbbf24"
            }
          />
        </mesh>
      </group>

      {/* INNER BULKHEAD SLIDING DOORS (at Z = -5) */}
      <group position={[0, 1.15, -5]}>
        {/* Left Leaf */}
        <mesh ref={innerDoorLeftRef} position={[-0.55, 0, 0]} castShadow>
          <boxGeometry args={[1.1, 2.3, 0.12]} />
          <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.35} />
        </mesh>
        {/* Right Leaf */}
        <mesh ref={innerDoorRightRef} position={[0.55, 0, 0]} castShadow>
          <boxGeometry args={[1.1, 2.3, 0.12]} />
          <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.35} />
        </mesh>
      </group>

      {/* OUTER BULKHEAD WALL (Z = -11, Doorway [-1.1, 1.1]) */}
      <mesh position={[-2.5, 1.5, -11]}>
        <boxGeometry args={[3.0, 3.0, 0.4]} />
        <meshStandardMaterial color="#1e242d" roughness={0.7} />
      </mesh>
      <mesh position={[2.5, 1.5, -11]}>
        <boxGeometry args={[3.0, 3.0, 0.4]} />
        <meshStandardMaterial color="#1e242d" roughness={0.7} />
      </mesh>
      <mesh position={[0, 2.65, -11]}>
        <boxGeometry args={[2.4, 0.7, 0.4]} />
        <meshStandardMaterial color="#1e242d" roughness={0.7} />
      </mesh>

      {/* OUTER BULKHEAD SLIDING DOORS (at Z = -11) */}
      <group position={[0, 1.15, -11]}>
        {/* Left Leaf */}
        <mesh ref={outerDoorLeftRef} position={[-0.55, 0, 0]} castShadow>
          <boxGeometry args={[1.1, 2.3, 0.14]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
        </mesh>
        {/* Right Leaf */}
        <mesh ref={outerDoorRightRef} position={[0.55, 0, 0]} castShadow>
          <boxGeometry args={[1.1, 2.3, 0.14]} />
          <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
        </mesh>
      </group>

      {/* ==================================================================== */}
      {/* 4. EXTERIOR GANTRY & EVA AREA (Z: [-32, -11])                        */}
      {/* ==================================================================== */}
      {/* Exterior Station Hull Plates */}
      <mesh position={[0, 1.5, -11.25]}>
        <boxGeometry args={[12, 5, 0.3]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.4} />
      </mesh>

      {/* DEEP SPACE COMMUNICATIONS DISH (Kenney model on station exterior roof) */}
      <Suspense fallback={null}>
        <StationModel
          url="/assets/models/satelliteDish_detailed.glb"
          position={[3.6, 3.2, 9.5]}
          rotation={[-0.35, 0.75, 0]}
          scale={[1.4, 1.4, 1.4]}
        />
      </Suspense>

      {/* STATION DOCKING PORT COLLAR & NASA ORBITER DOCKING SYSTEM (at Z = -11.2, X = 0, Y = 1.5) */}
      <group position={[0, 1.5, -11.2]}>
        {/* Real NASA Orbiter Docking System APAS Petal Mechanism */}
        <NASAModelObject
          url="/assets/models/nasa/orbiter-docking-system-engine.glb"
          position={[0, 0, 0.12]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[0.012, 0.012, 0.012]}
        />
        <mesh rotation={[Math.PI / 2, 0, Math.PI / 8]}>
          <cylinderGeometry args={[1.5, 1.6, 0.35, 8]} />
          <meshStandardMaterial color="#475569" metalness={0.85} roughness={0.25} />
        </mesh>
        {/* Docking Target Alignment Guide Lights (Green when aligned, Amber when far) */}
        {[-0.9, 0.9].map((x) => (
          <mesh key={`dock-light-x-${x}`} position={[x, 0, 0.2]}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshBasicMaterial
              color={
                gameState.controlMode === "SPACECRAFT_COCKPIT" &&
                gameState.spacecraft.alignmentAngleDeg < 25 &&
                gameState.spacecraft.distanceToDockMeters < 15
                  ? "#22c55e"
                  : "#f59e0b"
              }
            />
          </mesh>
        ))}
        {[-0.9, 0.9].map((y) => (
          <mesh key={`dock-light-y-${y}`} position={[0, y, 0.2]}>
            <sphereGeometry args={[0.07, 12, 12]} />
            <meshBasicMaterial
              color={
                gameState.controlMode === "SPACECRAFT_COCKPIT" &&
                gameState.spacecraft.alignmentAngleDeg < 25 &&
                gameState.spacecraft.distanceToDockMeters < 15
                  ? "#22c55e"
                  : "#f59e0b"
              }
            />
          </mesh>
        ))}
        <pointLight
          position={[0, 0, 0.6]}
          intensity={gameState.controlMode === "SPACECRAFT_COCKPIT" ? 1.5 : 0.6}
          distance={10}
          color="#22c55e"
        />
      </group>

      {/* Gold MLI insulation blankets on exterior station module */}
      <mesh position={[-4.5, 1.5, -11.45]}>
        <boxGeometry args={[2.8, 3.5, 0.1]} />
        <meshStandardMaterial color="#d97706" metalness={0.85} roughness={0.25} />
      </mesh>
      <mesh position={[4.5, 1.5, -11.45]}>
        <boxGeometry args={[2.8, 3.5, 0.1]} />
        <meshStandardMaterial color="#d97706" metalness={0.85} roughness={0.25} />
      </mesh>

      {/* Maintenance Gantry Walkway (Z: -11 to -32) */}
      <mesh position={[0, -0.05, -21.5]} receiveShadow>
        <boxGeometry args={[4.2, 0.1, 21]} />
        <meshStandardMaterial color="#1e293b" metalness={0.6} roughness={0.6} />
      </mesh>

      {/* Yellow Safety Edges */}
      <mesh position={[-2.1, 0.02, -21.5]}>
        <boxGeometry args={[0.15, 0.02, 21]} />
        <meshStandardMaterial color="#eab308" roughness={0.3} />
      </mesh>
      <mesh position={[2.1, 0.02, -21.5]}>
        <boxGeometry args={[0.15, 0.02, 21]} />
        <meshStandardMaterial color="#eab308" roughness={0.3} />
      </mesh>

      {/* Exterior Gantry Safety Handrails & Stanchions */}
      {[-12, -16, -20, -24, -28, -32].map((z) => (
        <group key={`stanchion-${z}`}>
          {/* Left stanchion */}
          <mesh position={[-2.1, 0.55, z]}>
            <cylinderGeometry args={[0.025, 0.025, 1.1, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
          </mesh>
          {/* Right stanchion */}
          <mesh position={[2.1, 0.55, z]}>
            <cylinderGeometry args={[0.025, 0.025, 1.1, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.8} roughness={0.2} />
          </mesh>
        </group>
      ))}

      {/* Continuous Top Rails */}
      <mesh position={[-2.1, 1.1, -21.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 21, 12]} />
        <meshStandardMaterial color="#eab308" metalness={0.8} roughness={0.2} />
      </mesh>
      <mesh position={[2.1, 1.1, -21.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.02, 0.02, 21, 12]} />
        <meshStandardMaterial color="#eab308" metalness={0.8} roughness={0.2} />
      </mesh>
      {/* End Rail */}
      <mesh position={[0, 1.1, -32.0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, 4.2, 12]} />
        <meshStandardMaterial color="#eab308" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Exterior Floodlights shining on Satellite */}
      <pointLight position={[-2.5, 3.5, -18]} intensity={1.5} distance={15} color="#e0f2fe" />
      <pointLight position={[2.5, 3.5, -26]} intensity={1.5} distance={15} color="#e0f2fe" />

      {/* ==================================================================== */}
      {/* 5. DAMAGED SATELLITE `AERO-3X` (at Z = -22.0, X = 0, Y = 1.0)        */}
      {/* ==================================================================== */}
      <group position={[0, 1.0, -22.0]}>
        {/* Docking Cradle / Mounting Arm */}
        <mesh position={[0, -0.65, 0]}>
          <cylinderGeometry args={[0.15, 0.25, 0.7, 16]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} />
        </mesh>
        <mesh position={[0, -0.32, 0]}>
          <boxGeometry args={[0.5, 0.08, 0.5]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
        </mesh>

        {/* --- MAIN 3U CUBESAT CHASSIS --- */}
        {/* Aluminum 6061-T6 Structural Rails */}
        {[-0.22, 0.22].map((x) =>
          [-0.22, 0.22].map((z) => (
            <mesh key={`rail-${x}-${z}`} position={[x, 0, z]}>
              <boxGeometry args={[0.035, 1.0, 0.035]} />
              <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.25} />
            </mesh>
          ))
        )}

        {/* P-POD Separation Plunger Feet */}
        {[-0.22, 0.22].map((x) =>
          [-0.22, 0.22].map((z) => (
            <mesh key={`foot-${x}-${z}`} position={[x, 0.52, z]}>
              <cylinderGeometry args={[0.012, 0.012, 0.04, 8]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.95} roughness={0.1} />
            </mesh>
          ))
        )}

        {/* NASA IceCube Earth Observation Satellite 3D Model */}
        <NASAModelObject
          url="/assets/models/nasa/cubesat-icecube.glb"
          position={[0, 0, 0]}
          rotation={[0, 0, 0]}
          scale={[0.18, 0.18, 0.18]}
        />

        {/* Earth Observation Optical Payload Lens on Nadir (-Y) face */}
        <mesh position={[0, -0.48, 0]}>
          <cylinderGeometry args={[0.12, 0.14, 0.08, 24]} />
          <meshStandardMaterial color="#0f172a" metalness={0.8} roughness={0.2} />
        </mesh>
        <mesh position={[0, -0.52, 0]}>
          <cylinderGeometry args={[0.1, 0.1, 0.02, 24]} />
          <meshPhysicalMaterial
            color="#0284c7"
            transmission={0.85}
            roughness={0.1}
            metalness={0.1}
          />
        </mesh>

        {/* --- STARBOARD SOLAR ARRAY (RIGHT - DAMAGED vs REPAIRED) --- */}
        {!gameState.satellite.wingRemoved && (
          /* DAMAGED SHATTERED WING (pre-repair) */
          <group position={[0.24, -0.15, 0]} rotation={[0.2, 0, -0.45]}>
            <mesh position={[0.25, 0, 0]}>
              <boxGeometry args={[0.5, 0.65, 0.02]} />
              <meshStandardMaterial color="#334155" roughness={0.8} />
            </mesh>
            {/* Scorched broken cells */}
            <mesh position={[0.25, 0, 0.012]}>
              <boxGeometry args={[0.45, 0.6, 0.005]} />
              <meshStandardMaterial color="#1c1917" roughness={0.9} />
            </mesh>
            {/* Sparking light effect */}
            <pointLight ref={sparkRef} position={[0.4, 0, 0]} color="#f97316" distance={2} />
          </group>
        )}

        {gameState.satellite.wingMounted && (
          /* REPLACEMENT GaAs SOLAR WING (post-repair) */
          <group position={[0.24, 0, 0]}>
            <mesh position={[0.03, 0, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.8, 8]} />
              <meshStandardMaterial color="#64748b" metalness={0.9} roughness={0.3} />
            </mesh>
            <mesh position={[0.48, 0, 0]}>
              <boxGeometry args={[0.9, 0.78, 0.02]} />
              <meshStandardMaterial color="#1e293b" metalness={0.5} roughness={0.5} />
            </mesh>
            <mesh position={[0.48, 0, 0.012]}>
              <boxGeometry args={[0.86, 0.74, 0.005]} />
              <meshStandardMaterial color="#0284c7" metalness={0.7} roughness={0.15} />
            </mesh>
          </group>
        )}

        {/* --- S-BAND ANTENNA PORT (Zenith +Y face) --- */}
        {gameState.satellite.antennaMounted ? (
          /* INSTALLED S-BAND PATCH TRANSCEIVER */
          <group position={[0, 0.5, 0]}>
            <mesh position={[0, 0.02, 0]}>
              <boxGeometry args={[0.2, 0.03, 0.2]} />
              <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.15} />
            </mesh>
            <mesh position={[0, 0.05, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.04, 12]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        ) : (
          /* EMPTY SHEARED ANTENNA BRACKET */
          <mesh position={[0, 0.48, 0]}>
            <boxGeometry args={[0.1, 0.02, 0.1]} />
            <meshStandardMaterial color="#475569" roughness={0.7} />
          </mesh>
        )}

        {/* --- SATELLITE AVIONICS STATUS BEACON LED --- */}
        <mesh position={[0.18, 0.42, 0.22]}>
          <sphereGeometry args={[0.03, 12, 12]} />
          <meshBasicMaterial
            color={gameState.satellite.diagnosticRun ? "#22c55e" : "#ef4444"}
          />
        </mesh>
        <pointLight
          ref={satBeaconRef}
          position={[0.18, 0.42, 0.25]}
          distance={2.5}
          color={gameState.satellite.diagnosticRun ? "#22c55e" : "#ef4444"}
        />
      </group>

      {/* ==================================================================== */}
      {/* 6. ORBITAL UTILITY SHUTTLE `ORV-1` (NASA Spacecraft Orbiter)         */}
      {/* ==================================================================== */}
      {/* DOCKED UTILITY SHUTTLE AT BERTH (when in Astronaut exploration mode) */}
      {gameState.controlMode === "ASTRONAUT" && (
        <group position={[0, 0.8, -28.0]}>
          {/* Cradle Docking Stanchion */}
          <mesh position={[0, -0.6, 0]}>
            <cylinderGeometry args={[0.3, 0.45, 0.8, 12]} />
            <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.4} />
          </mesh>
          <NASAModelObject
            url="/assets/models/nasa/space-shuttle-engine.glb"
            position={[0, 0.4, 0]}
            rotation={[0, Math.PI, 0]}
            scale={[0.18, 0.18, 0.18]}
          />
          <pointLight position={[0, 1.2, 0]} intensity={1.0} distance={8} color="#38bdf8" />
        </group>
      )}

      {/* FLYING SHUTTLE IN SPACE (when in Cockpit Flight mode, external 3D mesh) */}
      {gameState.controlMode === "SPACECRAFT_COCKPIT" && (
        <group
          position={gameState.spacecraft.position}
          rotation={[
            gameState.spacecraft.pitch,
            gameState.spacecraft.yaw,
            gameState.spacecraft.roll,
          ]}
        >
          <NASAModelObject
            url="/assets/models/nasa/space-shuttle-engine.glb"
            position={[0, -0.3, 0]}
            rotation={[0, Math.PI, 0]}
            scale={[0.18, 0.18, 0.18]}
          />
          {/* Cyan Thruster Exhaust Plume when moving */}
          {gameState.spacecraft.speedMps > 0.4 && (
            <mesh position={[0, 0, 2.4]} rotation={[Math.PI / 2, 0, 0]}>
              <coneGeometry args={[0.25, 1.2, 12]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} />
            </mesh>
          )}
        </group>
      )}
    </group>
  );
}
