"use client";

import React, { useRef, useMemo, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Stars, useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { GameState, InventoryItemId } from "./types";
import { RealisticEarth } from "@/components/viewport/RealisticEarth";
import { useNASAModel } from "./useNASAModel";
import { LunarDustPlume } from "./LunarDustPlume";

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

function SpaceDust({ count = 280 }: { count?: number }) {
  const pointsRef = useRef<THREE.Points>(null);
  const { camera } = useThree();

  const [positions] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 60;
      pos[i * 3 + 1] = (Math.random() - 0.5) * 40;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    return [pos];
  }, [count]);

  useFrame(() => {
    if (!pointsRef.current) return;
    const pos = pointsRef.current.geometry.attributes.position.array as Float32Array;
    const cx = camera.position.x;
    const cy = camera.position.y;
    const cz = camera.position.z;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      if (pos[idx] - cx > 30) pos[idx] -= 60;
      else if (pos[idx] - cx < -30) pos[idx] += 60;

      if (pos[idx + 1] - cy > 20) pos[idx + 1] -= 40;
      else if (pos[idx + 1] - cy < -20) pos[idx + 1] += 40;

      if (pos[idx + 2] - cz > 30) pos[idx + 2] -= 60;
      else if (pos[idx + 2] - cz < -30) pos[idx + 2] += 60;
    }
    pointsRef.current.geometry.attributes.position.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.065}
        color="#38bdf8"
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function WorkstationConsole({
  position,
  rotation,
  title,
  subtitle,
  themeColor,
  iconType,
}: {
  position: [number, number, number];
  rotation: [number, number, number];
  title: string;
  subtitle: string;
  themeColor: string;
  iconType: "CHASSIS" | "SOLAR" | "PROPULSION" | "PAYLOAD" | "TELECOM";
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* Console Desk Pedestal */}
      <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.9, 0.9, 0.6]} />
        <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.5} />
      </mesh>
      {/* Upper Sloped Surface */}
      <mesh position={[0, 0.95, 0]} rotation={[-Math.PI / 4, 0, 0]}>
        <boxGeometry args={[0.85, 0.05, 0.45]} />
        <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.6} />
      </mesh>
      {/* Holographic Interactive Display Screen */}
      <mesh position={[0, 1.45, 0]}>
        <planeGeometry args={[0.7, 0.45]} />
        <meshBasicMaterial color={themeColor} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      {/* Holographic Wireframe Icon */}
      <group position={[0, 1.45, 0.02]} scale={[0.15, 0.15, 0.15]}>
        {iconType === "CHASSIS" && (
          <mesh>
            <boxGeometry args={[1, 2, 1]} />
            <meshBasicMaterial color={themeColor} wireframe />
          </mesh>
        )}
        {iconType === "SOLAR" && (
          <mesh>
            <boxGeometry args={[2.5, 1, 0.1]} />
            <meshBasicMaterial color={themeColor} wireframe />
          </mesh>
        )}
        {iconType === "PROPULSION" && (
          <mesh rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.8, 1.5, 8]} />
            <meshBasicMaterial color={themeColor} wireframe />
          </mesh>
        )}
        {iconType === "PAYLOAD" && (
          <mesh>
            <cylinderGeometry args={[0.8, 0.8, 1.2, 8]} />
            <meshBasicMaterial color={themeColor} wireframe />
          </mesh>
        )}
        {iconType === "TELECOM" && (
          <mesh>
            <sphereGeometry args={[1.0, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshBasicMaterial color={themeColor} wireframe side={THREE.DoubleSide} />
          </mesh>
        )}
      </group>
      <pointLight position={[0, 1.5, 0.1]} intensity={0.8} distance={2.5} color={themeColor} />
    </group>
  );
}

function HangarSandboxBay({ gameState }: { gameState: GameState }) {
  const craft = gameState.hangarCraft || {
    chassis: "3U",
    solar: "SINGLE_WING",
    solarDeployed: true,
    propulsion: "HYDRAZINE",
    payload: "IMAGER",
    telecom: "SBAND",
    isThrusterFiring: false,
  };

  const levitateGroupRef = useRef<THREE.Group>(null);
  const thrusterPlumeRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (levitateGroupRef.current) {
      levitateGroupRef.current.position.y = 1.35 + Math.sin(t * 1.5) * 0.04;
      levitateGroupRef.current.rotation.y = t * 0.25;
    }
    if (thrusterPlumeRef.current && craft.isThrusterFiring) {
      thrusterPlumeRef.current.scale.set(
        1.0 + Math.random() * 0.3,
        1.0 + Math.random() * 0.5,
        1.0 + Math.random() * 0.3
      );
    }
  });

  return (
    <group position={[0, 0, 0.5]}>
      {/* Cleanroom Studio Lighting (Guarantees 100% illuminated, vibrant PBR surfaces without shadows) */}
      <ambientLight intensity={1.2} />
      <pointLight position={[0, 3.5, 0]} intensity={3.2} distance={10} color="#f8fafc" />
      <directionalLight position={[2.5, 4.0, 3.0]} intensity={2.4} color="#ffffff" />
      <directionalLight position={[-2.5, 3.5, 2.5]} intensity={1.9} color="#e0f2fe" />
      <directionalLight position={[0, 2.5, -3.5]} intensity={1.6} color="#bae6fd" />

      {/* 1. CENTRAL MAGNETIC RIG PEDESTAL */}
      <group position={[0, 0, 0]}>
        <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.2, 1.4, 0.4, 24]} />
          <meshStandardMaterial color="#0f172a" roughness={0.4} metalness={0.7} />
        </mesh>
        {/* Glowing Magnetic Emitter Rings */}
        <mesh position={[0, 0.41, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.7, 1.15, 32]} />
          <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.42, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.3, 0.55, 32]} />
          <meshBasicMaterial color="#0284c7" side={THREE.DoubleSide} />
        </mesh>
        <pointLight position={[0, 0.8, 0]} intensity={1.8} distance={4} color="#38bdf8" />

        {/* 4 Angled Mag-Lev Projectors */}
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, i) => (
          <group key={`mag-proj-${i}`} position={[Math.cos(angle) * 1.25, 0.25, Math.sin(angle) * 1.25]} rotation={[0, -angle, 0.3]}>
            <mesh>
              <boxGeometry args={[0.18, 0.35, 0.25]} />
              <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.18, 0]}>
              <cylinderGeometry args={[0.06, 0.08, 0.06, 12]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
          </group>
        ))}
      </group>

      {/* 2. LEVITATING MODULAR SPACECRAFT */}
      <group ref={levitateGroupRef} position={[0, 1.35, 0]}>
        {/* Chassis Model */}
        {craft.chassis === "1U" && (
          <group scale={[0.9, 0.9, 0.9]}>
            {/* NASA Gold Kapton MLI Thermal Core */}
            <mesh castShadow>
              <boxGeometry args={[0.5, 0.5, 0.5]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.55} roughness={0.35} emissive="#b45309" emissiveIntensity={0.15} />
            </mesh>
            {[-0.26, 0.26].map((x) =>
              [-0.26, 0.26].map((z) => (
                <mesh key={`r1u-${x}-${z}`} position={[x, 0, z]}>
                  <boxGeometry args={[0.04, 0.52, 0.04]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.8} roughness={0.2} />
                </mesh>
              ))
            )}
          </group>
        )}

        {craft.chassis === "3U" && (
          <group scale={[0.85, 0.85, 0.85]}>
            {/* 3U Gold MLI Chassis Body */}
            <mesh castShadow>
              <boxGeometry args={[0.45, 1.35, 0.45]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.55} roughness={0.35} emissive="#b45309" emissiveIntensity={0.15} />
            </mesh>
            {/* GaAs Solar Face Panels */}
            <mesh position={[0, 0, 0.23]}>
              <planeGeometry args={[0.4, 1.25]} />
              <meshStandardMaterial color="#1e3a8a" metalness={0.7} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0, -0.23]} rotation={[0, Math.PI, 0]}>
              <planeGeometry args={[0.4, 1.25]} />
              <meshStandardMaterial color="#1e3a8a" metalness={0.7} roughness={0.2} />
            </mesh>
            {[-0.23, 0.23].map((x) =>
              [-0.23, 0.23].map((z) => (
                <mesh key={`r3u-${x}-${z}`} position={[x, 0, z]}>
                  <boxGeometry args={[0.04, 1.38, 0.04]} />
                  <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.2} />
                </mesh>
              ))
            )}
          </group>
        )}

        {craft.chassis === "6U" && (
          <group scale={[0.8, 0.8, 0.8]}>
            <mesh castShadow>
              <boxGeometry args={[0.9, 1.35, 0.45]} />
              <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0, 0.23]}>
              <planeGeometry args={[0.86, 1.3]} />
              <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.2} />
            </mesh>
            {[-0.46, 0.46].map((x) =>
              [-0.23, 0.23].map((z) => (
                <mesh key={`r6u-${x}-${z}`} position={[x, 0, z]}>
                  <boxGeometry args={[0.04, 1.38, 0.04]} />
                  <meshStandardMaterial color="#64748b" metalness={0.85} roughness={0.2} />
                </mesh>
              ))
            )}
          </group>
        )}

        {craft.chassis === "ORBITER" && (
          <group position={[0, -0.3, 0]} scale={[0.08, 0.08, 0.08]}>
            <Suspense fallback={null}>
              <NASAModelObject
                url="/assets/models/nasa/space-shuttle-a.glb"
                position={[0, 0, 0]}
                rotation={[0, Math.PI, 0]}
                scale={[1, 1, 1]}
              />
            </Suspense>
          </group>
        )}

        {/* Solar Wing Assemblies (Single or Dual Wings) */}
        {craft.solar === "SINGLE_WING" && (
          <group
            position={[-0.45, 0, 0]}
            rotation={[0, 0, craft.solarDeployed ? 0 : Math.PI / 2]}
            scale={[craft.solarDeployed ? 1 : 0.25, 1, 1]}
          >
            <mesh position={[-0.55, 0, 0]}>
              <boxGeometry args={[1.1, 0.8, 0.03]} />
              <meshStandardMaterial color="#1e3a8a" metalness={0.85} roughness={0.15} />
            </mesh>
            <mesh position={[-0.55, 0, 0.02]}>
              <planeGeometry args={[1.05, 0.74]} />
              <meshBasicMaterial color="#0284c7" />
            </mesh>
            <Suspense fallback={null}>
              <NASAModelObject
                url="/assets/models/nasa/satellite-wing.glb"
                position={[-0.6, 0, 0]}
                scale={[0.015, 0.015, 0.015]}
              />
            </Suspense>
          </group>
        )}

        {craft.solar === "DUAL_WING" && (
          <>
            {/* Left Wing */}
            <group
              position={[-0.45, 0, 0]}
              rotation={[0, 0, craft.solarDeployed ? 0 : Math.PI / 2]}
              scale={[craft.solarDeployed ? 1 : 0.25, 1, 1]}
            >
              <mesh position={[-0.55, 0, 0]}>
                <boxGeometry args={[1.1, 0.8, 0.03]} />
                <meshStandardMaterial color="#1e3a8a" metalness={0.85} roughness={0.15} />
              </mesh>
              <mesh position={[-0.55, 0, 0.02]}>
                <planeGeometry args={[1.05, 0.74]} />
                <meshBasicMaterial color="#0284c7" />
              </mesh>
            </group>
            {/* Right Wing */}
            <group
              position={[0.45, 0, 0]}
              rotation={[0, 0, craft.solarDeployed ? 0 : -Math.PI / 2]}
              scale={[craft.solarDeployed ? 1 : 0.25, 1, 1]}
            >
              <mesh position={[0.55, 0, 0]}>
                <boxGeometry args={[1.1, 0.8, 0.03]} />
                <meshStandardMaterial color="#1e3a8a" metalness={0.85} roughness={0.15} />
              </mesh>
              <mesh position={[0.55, 0, 0.02]}>
                <planeGeometry args={[1.05, 0.74]} />
                <meshBasicMaterial color="#0284c7" />
              </mesh>
            </group>
          </>
        )}

        {/* Propulsion Thruster Nozzles & Exhaust Plume */}
        {craft.propulsion !== "NONE" && (
          <group position={[0, -0.72, 0]}>
            <mesh rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.16, 0.28, 16]} />
              <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.2} />
            </mesh>
            {craft.isThrusterFiring && (
              <group ref={thrusterPlumeRef} position={[0, -0.4, 0]}>
                <pointLight intensity={3.5} distance={6} color="#38bdf8" />
                <mesh rotation={[Math.PI, 0, 0]}>
                  <cylinderGeometry args={[0.04, 0.22, 0.75, 16]} />
                  <meshBasicMaterial color="#e0f2fe" />
                </mesh>
                <mesh rotation={[Math.PI, 0, 0]}>
                  <cylinderGeometry args={[0.08, 0.35, 0.85, 16]} />
                  <meshBasicMaterial color="#38bdf8" transparent opacity={0.65} />
                </mesh>
              </group>
            )}
          </group>
        )}

        {/* Payload Module on Top (+Y) */}
        {craft.payload === "IMAGER" && (
          <group position={[0, 0.75, 0]}>
            <mesh>
              <cylinderGeometry args={[0.14, 0.16, 0.24, 16]} />
              <meshStandardMaterial color="#1e293b" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.125, 0]}>
              <circleGeometry args={[0.12, 16]} />
              <meshStandardMaterial color="#38bdf8" metalness={0.9} roughness={0.05} />
            </mesh>
          </group>
        )}
        {craft.payload === "LIDAR" && (
          <group position={[0, 0.75, 0]}>
            <mesh>
              <cylinderGeometry args={[0.15, 0.15, 0.22, 6]} />
              <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} />
            </mesh>
            <mesh position={[0, 0.12, 0]}>
              <circleGeometry args={[0.11, 6]} />
              <meshBasicMaterial color="#ef4444" />
            </mesh>
          </group>
        )}
        {craft.payload === "PLASMA" && (
          <group position={[0, 0.75, 0]}>
            <mesh position={[0.2, 0.2, 0]} rotation={[0, 0, -0.6]}>
              <cylinderGeometry args={[0.015, 0.015, 0.6, 8]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.9} />
            </mesh>
            <mesh position={[-0.2, 0.2, 0]} rotation={[0, 0, 0.6]}>
              <cylinderGeometry args={[0.015, 0.015, 0.6, 8]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.9} />
            </mesh>
          </group>
        )}

        {/* Telecom Transceiver */}
        {craft.telecom === "XBAND" && (
          <group position={[0, 0.72, -0.25]} rotation={[-Math.PI / 4, 0, 0]}>
            <mesh>
              <sphereGeometry args={[0.24, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#f8fafc" metalness={0.6} roughness={0.2} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0.12, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 0.2, 8]} />
              <meshStandardMaterial color="#d97706" />
            </mesh>
          </group>
        )}
        {craft.telecom === "SBAND" && (
          <mesh position={[0.25, 0.4, 0.24]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.16, 0.16, 0.04]} />
            <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.15} />
          </mesh>
        )}

        {/* Floating Holographic Specification Rings */}
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.5, 1.54, 32]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* 3. WORKSTATION CONSOLES AROUND THE HANGAR */}
      {/* Console 1: Chassis Selection Bay */}
      <WorkstationConsole
        position={[-3.7, 0, -1.8]}
        rotation={[0, Math.PI / 2, 0]}
        title="CHASSIS WORKSTATION"
        subtitle={`Current: ${craft.chassis}`}
        themeColor="#38bdf8"
        iconType="CHASSIS"
      />

      {/* Console 2: Solar Array Bay */}
      <WorkstationConsole
        position={[3.7, 0, -1.8]}
        rotation={[0, -Math.PI / 2, 0]}
        title="SOLAR WORKSTATION"
        subtitle={`Current: ${craft.solar} (${craft.solarDeployed ? "DEPLOYED" : "FOLDED"})`}
        themeColor="#38bdf8"
        iconType="SOLAR"
      />

      {/* Console 3: Propulsion Bay */}
      <WorkstationConsole
        position={[3.7, 0, 1.8]}
        rotation={[0, -Math.PI / 2, 0]}
        title="PROPULSION WORKSTATION"
        subtitle={`Current: ${craft.propulsion}`}
        themeColor="#f59e0b"
        iconType="PROPULSION"
      />

      {/* Console 4: Science Payload Bay */}
      <WorkstationConsole
        position={[-3.7, 0, 1.8]}
        rotation={[0, Math.PI / 2, 0]}
        title="PAYLOAD WORKSTATION"
        subtitle={`Current: ${craft.payload}`}
        themeColor="#a855f7"
        iconType="PAYLOAD"
      />

      {/* Console 5: Telecom Relay Bay */}
      <WorkstationConsole
        position={[-3.7, 0, 3.8]}
        rotation={[0, Math.PI / 2, 0]}
        title="TELECOM WORKSTATION"
        subtitle={`Current: ${craft.telecom}`}
        themeColor="#10b981"
        iconType="TELECOM"
      />

      {/* Console 6: Static Fire Propulsion Stand */}
      <group position={[0, 0, 2.2]}>
        <mesh position={[0, 0.45, 0]} castShadow>
          <boxGeometry args={[0.7, 0.9, 0.5]} />
          <meshStandardMaterial color="#1e293b" roughness={0.5} metalness={0.6} />
        </mesh>
        <mesh position={[0, 0.95, 0]} rotation={[-Math.PI / 4, 0, 0]}>
          <boxGeometry args={[0.65, 0.05, 0.4]} />
          <meshStandardMaterial color="#0f172a" roughness={0.3} metalness={0.7} />
        </mesh>
        <mesh position={[0, 1.05, -0.05]}>
          <cylinderGeometry args={[0.08, 0.08, 0.06, 16]} />
          <meshStandardMaterial
            color={craft.isThrusterFiring ? "#ef4444" : "#dc2626"}
            emissive="#ef4444"
            emissiveIntensity={craft.isThrusterFiring ? 0.9 : 0.4}
          />
        </mesh>
        <pointLight position={[0, 1.3, 0]} intensity={craft.isThrusterFiring ? 2.5 : 0.6} color="#ef4444" distance={3} />
      </group>

      {/* Console 7: Departure / Launch Airlock Gate */}
      <group position={[0, 0, -4.6]}>
        <mesh position={[-1.2, 1.5, 0]}>
          <boxGeometry args={[0.2, 3.0, 0.2]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
        <mesh position={[1.2, 1.5, 0]}>
          <boxGeometry args={[0.2, 3.0, 0.2]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
        <mesh position={[0, 2.8, 0]}>
          <boxGeometry args={[2.4, 0.2, 0.2]} />
          <meshBasicMaterial color="#22c55e" />
        </mesh>
        <pointLight position={[0, 2.2, 0]} intensity={1.5} distance={5} color="#22c55e" />
      </group>
    </group>
  );
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

  // Lunar crater ground texture
  const moonTexture = useMemo(() => {
    if (typeof window === "undefined") return null;
    const loader = new THREE.TextureLoader();
    const tex = loader.load("/assets/textures/earth/moon.jpg");
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    return tex;
  }, []);

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

  const isSurface = gameState.controlMode === "SURFACE_EXPLORATION";
  const isLandedOnMoon =
    isSurface ||
    gameState.spacecraft.isLanded ||
    gameState.step === "SURFACE_LANDED" ||
    gameState.step === "EXPLORE_SURFACE";
  const isNearMoon =
    isLandedOnMoon ||
    gameState.step === "SURFACE_DESCENT" ||
    (gameState.controlMode === "SPACECRAFT_COCKPIT" && gameState.spacecraft.position.z < -80);

  return (
    <group>
      {/* ==================================================================== */}
      {/* EXTERIOR DEEP SPACE & EARTH ORBIT                                     */}
      {/* ==================================================================== */}
      <Stars radius={120} depth={60} count={4000} factor={4} saturation={0} fade speed={0.5} />
      <SpaceDust count={280} />

      {/* Deep Space Sunlight: Active in orbit; isolated from lunar surface to prevent double-exposure */}
      {!isLandedOnMoon && (
        <directionalLight
          position={[45, 28, 20]}
          intensity={2.2}
          color="#fffaf0"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.00012}
          shadow-camera-near={0.5}
          shadow-camera-far={120}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
        />
      )}
      {/* Deep Space Vacuum Ambient Light: Near zero for authentic pitch-black shadows */}
      <ambientLight intensity={0.035} />

      {/* Planetary Albedo Bounce Light: Earth blue scatter illuminating underside of spacecraft & station */}
      {!isLandedOnMoon && (
        <directionalLight position={[0, -10, 5]} intensity={0.38} color="#38bdf8" />
      )}

      {/* Photorealistic NASA Blue Marble Earth in true low Earth orbit */}
      {!isLandedOnMoon ? (
        <RealisticEarth
          radius={480}
          position={[0, -520, 20]}
          rotationSpeed={0.008}
        />
      ) : (
        /* Distant Earth Blue Marble viewed from Lunar Surface Sky (Earthrise vista) */
        <RealisticEarth
          radius={14}
          position={[60, 95, -160]}
          rotationSpeed={0.005}
        />
      )}

      {/* Real NASA International Space Station Superstructure (Mounted along Station Truss) */}
      {!isLandedOnMoon && (
        <Suspense fallback={null}>
          <NASAModelObject
            url="/assets/models/nasa/iss-station.glb"
            position={[0, 16.5, 3.5]}
            rotation={[0, 0, 0]}
            scale={[0.7, 0.7, 0.7]}
          />
        </Suspense>
      )}

      {/* Orbiting Asteroid Belt (Authentic NASA Asteroid 3D Models) */}
      <group>
        {[
          { pos: [-42, 14, -55], scale: 0.007, rot: [0.4, 0.2, 0.1] },
          { pos: [48, -10, -68], scale: 0.009, rot: [0.1, 0.8, 0.3] },
          { pos: [-32, -14, -88], scale: 0.006, rot: [0.6, 0.1, 0.5] },
          { pos: [36, 24, -98], scale: 0.008, rot: [0.2, 0.4, 0.9] },
          { pos: [-20, 32, -35], scale: 0.005, rot: [0.7, 0.6, 0.2] },
          { pos: [58, 12, -42], scale: 0.011, rot: [0.3, 0.9, 0.4] },
          { pos: [15, -22, -125], scale: 0.012, rot: [0.5, 0.3, 0.7] },
          { pos: [-45, -16, -115], scale: 0.008, rot: [0.8, 0.5, 0.2] },
        ].map((ast, i) => (
          <Suspense key={`asteroid-${i}`} fallback={null}>
            <NASAModelObject
              url="/assets/models/nasa/asteroid.glb"
              position={ast.pos as [number, number, number]}
              rotation={ast.rot as [number, number, number]}
              scale={[ast.scale, ast.scale, ast.scale]}
            />
          </Suspense>
        ))}
      </group>

      {/* ==================================================================== */}
      {/* 1. COMMAND DECK, LAB, AIRLOCK & GANTRY (Mounted on Gateway-1 Station) */}
      {/* Rendered only when aboard or orbiting Gateway-1; hidden on Moon       */}
      {/* ==================================================================== */}
      {!isLandedOnMoon && (
        <group name="gateway_orbital_station">
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

        {/* High-Fidelity 3D Holographic Satellite Display (AERO-3X Earth Observation Sentinel) */}
        <group ref={holoSatRef} position={[0, 1.45, 0]} scale={[0.42, 0.42, 0.42]}>
          {/* Main 3U CubeSat Bus (Gold Kapton MLI with Holographic Shimmer) */}
          <mesh>
            <boxGeometry args={[0.42, 1.25, 0.42]} />
            <meshStandardMaterial
              color="#d97706"
              emissive="#0284c7"
              emissiveIntensity={0.25}
              metalness={0.85}
              roughness={0.2}
              transparent
              opacity={0.88}
            />
          </mesh>

          {/* Titanium Extruded Corner Rails */}
          {[-0.21, 0.21].map((x) =>
            [-0.21, 0.21].map((z) => (
              <mesh key={`holo-rail-${x}-${z}`} position={[x, 0, z]}>
                <boxGeometry args={[0.04, 1.28, 0.04]} />
                <meshStandardMaterial color="#94a3b8" metalness={0.9} roughness={0.2} />
              </mesh>
            ))
          )}

          {/* Intact Left GaAs Solar Wing (-X) */}
          <group position={[-0.75, 0, 0]}>
            <mesh>
              <boxGeometry args={[1.0, 0.85, 0.02]} />
              <meshStandardMaterial color="#1e3a8a" emissive="#172554" emissiveIntensity={0.3} metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Photovoltaic Cell Divisions */}
            <mesh position={[0, 0, 0.012]}>
              <planeGeometry args={[0.94, 0.8]} />
              <meshStandardMaterial color="#0284c7" emissive="#0369a1" emissiveIntensity={0.35} metalness={0.9} roughness={0.1} />
            </mesh>
            {/* Hinge Bracket */}
            <mesh position={[0.52, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.02, 0.02, 0.08, 8]} />
              <meshStandardMaterial color="#64748b" metalness={0.9} />
            </mesh>
          </group>

          {/* Damaged Right Solar Wing (+X) - Fracture Angle & Diagnostic Warning */}
          <group position={[0.72, -0.15, 0]} rotation={[0, 0.15, -0.35]}>
            <mesh>
              <boxGeometry args={[0.85, 0.75, 0.02]} />
              <meshStandardMaterial color="#ef4444" emissive="#b91c1c" emissiveIntensity={0.4} metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Shattered Cell Substrate */}
            <mesh position={[0, 0, 0.012]}>
              <planeGeometry args={[0.78, 0.7]} />
              <meshStandardMaterial color="#7f1d1d" emissive="#ef4444" emissiveIntensity={0.2} />
            </mesh>
          </group>

          {/* Earth-Facing Parabolic Telemetry Dish */}
          <group position={[0, 0.68, 0]} rotation={[-Math.PI / 4, 0, 0]}>
            <mesh>
              <sphereGeometry args={[0.16, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />
              <meshStandardMaterial color="#f8fafc" emissive="#38bdf8" emissiveIntensity={0.2} side={THREE.DoubleSide} />
            </mesh>
            <mesh position={[0, 0.09, 0]}>
              <cylinderGeometry args={[0.01, 0.01, 0.14, 8]} />
              <meshStandardMaterial color="#d97706" />
            </mesh>
          </group>

          {/* Holographic Diagnostic Data Rings */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.4, 1.43, 32]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.4} side={THREE.DoubleSide} />
          </mesh>
          <mesh rotation={[Math.PI / 2.3, 0.3, 0]}>
            <ringGeometry args={[1.65, 1.67, 32]} />
            <meshBasicMaterial color="#0284c7" transparent opacity={0.3} side={THREE.DoubleSide} />
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

      {/* 3D Modular Spacecraft Hangar & Construction Rig */}
      <HangarSandboxBay gameState={gameState} />

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
        {/* NASA Gold Kapton MLI Thermal Core & Titanium Rails */}
        <mesh>
          <boxGeometry args={[0.42, 0.98, 0.42]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.6} roughness={0.32} emissive="#b45309" emissiveIntensity={0.2} />
        </mesh>

        {/* Aluminum 6061-T6 Structural Rails */}
        {[-0.22, 0.22].map((x) =>
          [-0.22, 0.22].map((z) => (
            <mesh key={`rail-${x}-${z}`} position={[x, 0, z]}>
              <boxGeometry args={[0.035, 1.0, 0.035]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.85} roughness={0.25} />
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
        <Suspense fallback={null}>
          <NASAModelObject
            url="/assets/models/nasa/cubesat-icecube.glb"
            position={[0, 0, 0]}
            rotation={[0, 0, 0]}
            scale={[0.18, 0.18, 0.18]}
          />
        </Suspense>

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
        </group>
      )}

      {/* 5. PLANETARY / LUNAR SURFACE LANDING ZONE (LUNAR BASE ALPHA) */}
      {/* Rendered when approaching lunar descent sector or landed on Moon */}
      {isNearMoon && (
        <>
          <LunarDustPlume gameState={gameState} />
          <group position={[0, -18.0, -110.0]}>
          {/* Cratered Lunar Terrain Ground Plane (Dark basaltic regolith tone preventing bloom whiteout) */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
            <planeGeometry args={[160, 160, 32, 32]} />
            <meshStandardMaterial
              map={moonTexture ?? undefined}
              color={moonTexture ? "#555c68" : "#47515e"}
              roughness={0.94}
              metalness={0.06}
            />
          </mesh>

        {/* Illuminated Octagonal Surface Landing Pad (PAD-01) */}
        <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 8]} receiveShadow>
          <cylinderGeometry args={[9.5, 10.0, 0.15, 8]} />
          <meshStandardMaterial color="#1e293b" metalness={0.7} roughness={0.4} />
        </mesh>
        {/* Landing Pad Inner Touchdown Circle */}
        <mesh position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[5.2, 5.6, 32]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        {/* Landing Target Crosshair Marker */}
        <mesh position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[7.5, 0.4]} />
          <meshBasicMaterial color="#eab308" />
        </mesh>
        <mesh position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
          <planeGeometry args={[7.5, 0.4]} />
          <meshBasicMaterial color="#eab308" />
        </mesh>

        {/* Perimeter Green/Amber Touchdown Guide Beacons */}
        {[-8.5, 0, 8.5].map((x) =>
          [-8.5, 8.5].map((z) => (
            <group key={`pad-light-${x}-${z}`} position={[x, 0.35, z]}>
              <mesh>
                <cylinderGeometry args={[0.08, 0.12, 0.6, 8]} />
                <meshStandardMaterial color="#334155" />
              </mesh>
              <mesh position={[0, 0.35, 0]}>
                <sphereGeometry args={[0.12, 12, 12]} />
                <meshBasicMaterial color="#22c55e" />
              </mesh>
              <pointLight position={[0, 0.5, 0]} intensity={1.2} distance={8} color="#22c55e" />
            </group>
          ))
        )}

        {/* Surface Base Habitat Module (NASA Base Station Model) */}
        <Suspense fallback={null}>
          <NASAModelObject
            url="/assets/models/nasa/base-station.glb"
            position={[16.0, 0.2, 8.0]}
            rotation={[0, -0.6, 0]}
            scale={[0.85, 0.85, 0.85]}
          />
        </Suspense>

        {/* Surface Communication Mast & Beacon */}
        <group position={[-14.0, 0, 10.0]}>
          <mesh position={[0, 4.0, 0]}>
            <cylinderGeometry args={[0.1, 0.2, 8.0, 8]} />
            <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.3} />
          </mesh>
          <mesh position={[0, 8.2, 0]}>
            <sphereGeometry args={[0.2, 12, 12]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          <pointLight position={[0, 8.4, 0]} intensity={2.0} distance={25} color="#ef4444" />
        </group>

        {/* Calibrated Lunar Surface Sun (Authentic solar radiance without bloom whiteout) */}
        <directionalLight
          position={[-35, 50, 25]}
          intensity={1.5}
          color="#fffdf7"
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
          shadow-bias={-0.0001}
          shadow-camera-near={1.0}
          shadow-camera-far={160}
          shadow-camera-left={-40}
          shadow-camera-right={40}
          shadow-camera-top={40}
          shadow-camera-bottom={-40}
        />
        {/* Regolith Diffuse Albedo Bounce Light: Charcoal-gray upward scatter from lunar ground */}
        <directionalLight position={[0, -1, 0]} intensity={0.22} color="#94a3b8" />
        {/* Earthrise Blue Albedo Ambient Vista Light */}
        <directionalLight position={[60, 95, -160]} intensity={0.20} color="#60a5fa" />
        <pointLight position={[0, 14.0, 0]} intensity={0.5} distance={65} color="#e0f2fe" />

        {/* Perimeter Blast Shields (Matching Starfield Lunar Base Reference) */}
        {[-8, -4, 0, 4, 8].map((x) => (
          <group key={`shield-${x}`} position={[x, 1.1, 14.0]}>
            <mesh receiveShadow castShadow>
              <boxGeometry args={[3.6, 2.0, 0.16]} />
              <meshStandardMaterial color="#0284c7" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Support Strut */}
            <mesh position={[0, -0.5, -0.45]} rotation={[0.4, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 1.4, 8]} />
              <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
            </mesh>
          </group>
        ))}

        {/* Cryogenic Storage Tanks & Habitat Support (Matching Reference 6) */}
        {[8.5, 11.8].map((x) => (
          <group key={`tank-${x}`} position={[x, 2.8, 16.0]}>
            <mesh receiveShadow castShadow>
              <cylinderGeometry args={[1.1, 1.1, 5.2, 24]} />
              <meshStandardMaterial color="#e2e8f0" metalness={0.7} roughness={0.25} />
            </mesh>
            <mesh position={[0, 2.6, 0]}>
              <sphereGeometry args={[1.1, 24, 16]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.7} roughness={0.25} />
            </mesh>
          </group>
        ))}

        {/* Collectible Lunar Geological Core Sample (CORE-GEO-01) */}
        {!gameState.lunarSampleCollected && (
          <group position={[8.5, 0.45, 12.0]}>
            <mesh position={[0, -0.2, 0]}>
              <cylinderGeometry args={[0.35, 0.45, 0.25, 8]} />
              <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.12, 0]} rotation={[0.4, 0.8, 0.2]}>
              <dodecahedronGeometry args={[0.22, 1]} />
              <meshStandardMaterial color="#94a3b8" roughness={0.7} metalness={0.4} />
            </mesh>
            <pointLight position={[0, 0.6, 0]} intensity={1.8} distance={8} color="#38bdf8" />
            <mesh position={[0, 0.45, 0]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshBasicMaterial color="#38bdf8" />
            </mesh>
          </group>
        )}

        {/* Deployed Apollo ALSEP Lunar Surface Science Station */}
        {gameState.alsepDeployed && (
          <group position={[5.0, 0.0, 6.0]}>
            {/* Central Station Base Box (Gold Foil & Sunshield) */}
            <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.9, 0.7, 0.7]} />
              <meshStandardMaterial color="#eab308" metalness={0.9} roughness={0.2} />
            </mesh>
            {/* White Thermal Radiator Top */}
            <mesh position={[0, 0.72, 0]}>
              <boxGeometry args={[0.95, 0.04, 0.75]} />
              <meshStandardMaterial color="#f8fafc" roughness={0.3} />
            </mesh>
            {/* Helical Telemetry Antenna Mast */}
            <mesh position={[0.2, 1.3, 0]}>
              <cylinderGeometry args={[0.015, 0.015, 1.2, 8]} />
              <meshStandardMaterial color="#94a3b8" metalness={0.8} />
            </mesh>
            <mesh position={[0.2, 1.9, 0]}>
              <sphereGeometry args={[0.06, 12, 12]} />
              <meshBasicMaterial color="#00f3ff" />
            </mesh>

            {/* RTG Nuclear Power Unit (SNAP-27) with Cooling Fins */}
            <group position={[-1.2, 0.35, 0]}>
              <mesh>
                <cylinderGeometry args={[0.18, 0.18, 0.55, 12]} />
                <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.4} />
              </mesh>
              {[0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4].map((rad, i) => (
                <mesh key={`rtg-fin-${i}`} rotation={[0, rad, 0]}>
                  <boxGeometry args={[0.48, 0.5, 0.02]} />
                  <meshStandardMaterial color="#334155" metalness={0.9} />
                </mesh>
              ))}
              <pointLight position={[0, 0.4, 0]} intensity={0.8} distance={3} color="#f59e0b" />
            </group>

            {/* Laser Ranging Retroreflector (LRRR) Array */}
            <group position={[1.1, 0.25, 0.4]} rotation={[-0.45, 0.3, 0]}>
              <mesh>
                <boxGeometry args={[0.55, 0.4, 0.08]} />
                <meshStandardMaterial color="#1e293b" metalness={0.8} />
              </mesh>
              <mesh position={[0, 0, 0.05]}>
                <planeGeometry args={[0.48, 0.34]} />
                <meshStandardMaterial color="#38bdf8" metalness={0.95} roughness={0.05} />
              </mesh>
            </group>

            {/* Upward Laser Telemetry Beam to Orbit */}
            <mesh position={[0.2, 15.0, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 30.0, 8]} />
              <meshBasicMaterial color="#00f3ff" transparent opacity={0.65} />
            </mesh>
            <pointLight position={[0.2, 2.0, 0]} intensity={2.2} distance={10} color="#00f3ff" />
          </group>
        )}

        {/* Astronaut Outpost Crewmember on Surface (NASA Spacesuit Model) */}
        <Suspense fallback={null}>
          <NASAModelObject
            url="/assets/models/nasa/astronaut-engine.glb"
            position={[3.0, 0.05, 5.0]}
            rotation={[0, -0.6, 0]}
            scale={[0.024, 0.024, 0.024]}
          />
        </Suspense>

        {/* ================================================================ */}
        {/* LUNAR PERIMETER BOULDERS & CRATER EJECTA SCATTER                 */}
        {/* ================================================================ */}
        {[
          { pos: [-12.5, 0.7, -8.0], scale: [1.8, 1.4, 1.6], rot: [0.3, 0.7, -0.2], col: "#475569" },
          { pos: [-16.0, 1.0, -15.0], scale: [2.4, 2.0, 2.2], rot: [-0.4, 1.2, 0.5], col: "#334155" },
          { pos: [-2.0, 1.1, -18.0], scale: [2.8, 2.2, 2.5], rot: [0.6, -0.8, 0.1], col: "#475569" },
          { pos: [14.0, 0.85, -16.0], scale: [2.1, 1.7, 1.9], rot: [-0.2, 2.1, -0.4], col: "#334155" },
          { pos: [19.0, 0.95, -6.0], scale: [2.5, 1.9, 2.2], rot: [0.8, 0.3, -0.6], col: "#475569" },
          { pos: [18.0, 0.75, 14.0], scale: [1.9, 1.5, 1.7], rot: [-0.5, 1.6, 0.3], col: "#334155" },
          { pos: [-18.0, 0.9, 4.0], scale: [2.2, 1.8, 2.0], rot: [0.4, -1.4, 0.2], col: "#475569" },
          { pos: [-16.0, 0.65, 18.0], scale: [1.7, 1.3, 1.5], rot: [0.2, 0.9, -0.5], col: "#334155" },
        ].map((b, i) => (
          <group key={`lunar-boulder-${i}`} position={b.pos as [number, number, number]} rotation={b.rot as [number, number, number]}>
            <mesh castShadow receiveShadow scale={b.scale as [number, number, number]}>
              <dodecahedronGeometry args={[1.0, 1]} />
              <meshStandardMaterial
                color={b.col}
                roughness={0.94}
                metalness={0.12}
                flatShading
              />
            </mesh>
          </group>
        ))}

        {/* Smaller Secondary Regolith Pebble & Rock Scatter */}
        {[
          [-10.2, 0.15, -4.5, 0.35],
          [-6.5, 0.12, -12.0, 0.28],
          [5.8, 0.14, -14.2, 0.32],
          [11.5, 0.12, -10.0, 0.26],
          [16.2, 0.15, -2.5, 0.38],
          [12.8, 0.12, 6.5, 0.3],
          [-5.2, 0.14, 11.5, 0.34],
          [-13.5, 0.12, 1.8, 0.25],
        ].map(([rx, ry, rz, s], i) => (
          <mesh
            key={`lunar-pebble-${i}`}
            position={[rx, ry, rz]}
            rotation={[Math.sin(i), Math.cos(i), 0]}
            scale={[s, s * 0.7, s * 0.9]}
            receiveShadow
          >
            <dodecahedronGeometry args={[1.0, 0]} />
            <meshStandardMaterial color="#64748b" roughness={0.96} metalness={0.08} flatShading />
          </mesh>
        ))}
      </group>
      </>
      )}

      {/* ==================================================================== */}
      {/* 6. ORBITAL UTILITY SHUTTLE `ORV-1` (NASA Spacecraft Orbiter)         */}
      {/* ==================================================================== */}
      {/* DOCKED UTILITY SHUTTLE AT BERTH (when in Astronaut exploration mode) */}
      {gameState.controlMode === "ASTRONAUT" && (
        <group position={[0, 0.4, -36.5]}>
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

      {/* SHUTTLE ON SURFACE LANDING PAD (when landed or in surface exploration mode) */}
      {(gameState.controlMode === "SURFACE_EXPLORATION" ||
        (gameState.controlMode !== "SPACECRAFT_COCKPIT" && gameState.spacecraft.isLanded)) && (
        <group position={[0, -18.0 + 1.8, -110.0]}>
          <NASAModelObject
            url="/assets/models/nasa/space-shuttle-engine.glb"
            position={[0, 0, 0]}
            rotation={[0, Math.PI, 0]}
            scale={[0.18, 0.18, 0.18]}
          />
          <pointLight position={[0, 1.2, 0]} intensity={1.2} distance={10} color="#38bdf8" />
        </group>
      )}

      {/* FLYING SHUTTLE IN SPACE (external 3D mesh rendered strictly in CHASE camera mode) */}
      {gameState.controlMode === "SPACECRAFT_COCKPIT" && gameState.spacecraft.cameraViewMode === "CHASE" && (
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
          {/* Layered Translucent Rocket Exhaust Plume with Additive Blending & Thermal Shock Diamonds */}
          {gameState.spacecraft.speedMps > 0.3 && (
            <group position={[0, 0, 2.6]}>
              {/* Outer Cyan Plasma Expansion Envelope */}
              <mesh rotation={[Math.PI / 2, 0, 0]}>
                <coneGeometry args={[0.42, 2.2, 24]} />
                <meshBasicMaterial
                  color="#0284c7"
                  transparent
                  opacity={0.45}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
              {/* Mid High-Energy Ionization Plume */}
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.25]}>
                <coneGeometry args={[0.26, 1.6, 20]} />
                <meshBasicMaterial
                  color="#38bdf8"
                  transparent
                  opacity={0.75}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
              {/* Core Thermal Shock Diamond (Metallic White Heat Core) */}
              <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.5]}>
                <coneGeometry args={[0.14, 1.0, 16]} />
                <meshBasicMaterial
                  color="#ffffff"
                  transparent
                  opacity={0.95}
                  blending={THREE.AdditiveBlending}
                  depthWrite={false}
                />
              </mesh>
              <pointLight position={[0, 0, 0.9]} intensity={3.8} distance={8} color="#38bdf8" />
            </group>
          )}
        </group>
      )}
    </group>
  );
}
