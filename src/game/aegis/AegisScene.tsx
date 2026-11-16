"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { DIDYMOS_SYSTEM } from "./aegisMath";

export type AegisAct = "ACT_I_MARS_OBERTH" | "ACT_II_SMART_NAV" | "ACT_III_TERMINAL_RUN" | "ACT_IV_LICIACUBE";

export interface AegisSceneProps {
  currentAct: AegisAct;
  closingVelocityKms: number;
  distanceToTargetKm: number;
  lateralOffsetX: number;
  lateralOffsetY: number;
  rcsFiringX: number; // -1, 0, 1
  rcsFiringY: number; // -1, 0, 1
  isSmartNavLocked: boolean;
  impactTriggered: boolean;
  ejectaProgress: number; // 0..1
  burnThrottle: number; // 0..1
}

// ----------------------------------------------------------------------------
// Procedural Mars Globe with Rayleigh Atmospheric Limb (Act I)
// ----------------------------------------------------------------------------
function MarsPlanet({ isBurning }: { isBurning: boolean }) {
  const marsRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (marsRef.current) {
      marsRef.current.rotation.y += delta * 0.05;
    }
  });

  return (
    <group ref={marsRef} position={[0, -2.5, -6]}>
      {/* Mars Terrestrial Core */}
      <mesh>
        <sphereGeometry args={[4.2, 64, 64]} />
        <meshStandardMaterial
          color="#c1440e"
          roughness={0.85}
          metalness={0.15}
          bumpScale={0.05}
        />
      </mesh>
      {/* Polar Ice Cap (Planum Boreum) */}
      <mesh position={[0, 4.05, 0]}>
        <cylinderGeometry args={[1.2, 1.6, 0.3, 32]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.3} metalness={0.1} />
      </mesh>
      {/* Atmospheric Rayleigh Limb Scattering */}
      <mesh scale={[1.03, 1.03, 1.03]}>
        <sphereGeometry args={[4.2, 32, 32]} />
        <meshBasicMaterial
          color="#fb923c"
          transparent
          opacity={0.28}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      {/* Hyperbolic Orbit Trajectory Ribbon */}
      <mesh rotation={[Math.PI / 3, 0.2, 0]}>
        <ringGeometry args={[4.6, 4.65, 128]} />
        <meshBasicMaterial
          color={isBurning ? "#f59e0b" : "#38bdf8"}
          transparent
          opacity={0.7}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  );
}

// ----------------------------------------------------------------------------
// High-Fidelity 3D Probe Model: Aegis-IV (DART Impactor)
// ----------------------------------------------------------------------------
function AegisProbeModel({
  isBurning,
  rcsX,
  rcsY,
}: {
  isBurning: boolean;
  rcsX: number;
  rcsY: number;
}) {
  return (
    <group>
      {/* Central Hexagonal Bus Core */}
      <mesh castShadow receiveShadow>
        <cylinderGeometry args={[0.42, 0.42, 0.8, 6]} />
        <meshStandardMaterial color="#f59e0b" metalness={0.75} roughness={0.25} />
      </mesh>

      {/* DRACO High-Resolution Optical Camera Telescope (Nadir Aperture) */}
      <group position={[0, 0, -0.45]} rotation={[Math.PI / 2, 0, 0]}>
        <mesh>
          <cylinderGeometry args={[0.15, 0.2, 0.35, 24]} />
          <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.15} />
        </mesh>
        <mesh position={[0, -0.18, 0]}>
          <cylinderGeometry args={[0.13, 0.13, 0.02, 24]} />
          <meshStandardMaterial
            color="#38bdf8"
            emissive="#0284c7"
            emissiveIntensity={0.6}
            roughness={0.05}
          />
        </mesh>
      </group>

      {/* Dual Roll-Out Solar Arrays (ROSA - 8.5 meters span scaled) */}
      {[-1, 1].map((dir, idx) => (
        <group key={`rosa-${idx}`} position={[dir * 1.55, 0, 0]}>
          {/* Main GaAs Photovoltaic Panel */}
          <mesh rotation={[0, 0, 0]}>
            <boxGeometry args={[2.0, 0.02, 0.7]} />
            <meshStandardMaterial
              color="#0284c7"
              metalness={0.8}
              roughness={0.2}
              emissive="#0369a1"
              emissiveIntensity={0.15}
            />
          </mesh>
          {/* Carbon-Composite Boom Support */}
          <mesh position={[-dir * 0.95, 0, 0]}>
            <cylinderGeometry args={[0.025, 0.025, 0.35, 8]} />
            <meshStandardMaterial color="#334155" metalness={0.9} />
          </mesh>
        </group>
      ))}

      {/* NEXT-C Ion Propulsion Engine / Chemical Burn Plume (Aft) */}
      {isBurning && (
        <group position={[0, 0, 0.52]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh>
            <coneGeometry args={[0.22, 0.75, 20]} />
            <meshBasicMaterial
              color="#60a5fa"
              transparent
              opacity={0.85}
              blending={THREE.AdditiveBlending}
            />
          </mesh>
          <pointLight color="#38bdf8" intensity={3.5} distance={6} />
        </group>
      )}

      {/* Cold-Gas RCS Micro-Thruster Plumes */}
      {rcsX !== 0 && (
        <mesh position={[-rcsX * 0.48, 0, 0]} rotation={[0, 0, (rcsX * Math.PI) / 2]}>
          <coneGeometry args={[0.06, 0.28, 12]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
        </mesh>
      )}
      {rcsY !== 0 && (
        <mesh position={[0, -rcsY * 0.48, 0]} rotation={[(rcsY * Math.PI) / 2, 0, 0]}>
          <coneGeometry args={[0.06, 0.28, 12]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  );
}

// ----------------------------------------------------------------------------
// Procedural Binary Asteroid System: Didymos (780m) & Dimorphos (160m)
// ----------------------------------------------------------------------------
function BinaryAsteroidSystem({
  distanceKm,
  lateralX,
  lateralY,
  isSmartNavLocked,
  isTerminal,
}: {
  distanceKm: number;
  lateralX: number;
  lateralY: number;
  isSmartNavLocked: boolean;
  isTerminal: boolean;
}) {
  const systemRef = useRef<THREE.Group>(null);
  const moonletRef = useRef<THREE.Group>(null);

  // Scaled distance along -Z axis
  const zPos = Math.max(0.8, Math.min(60, distanceKm * 0.6));

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (moonletRef.current && !isTerminal) {
      // Keplerian orbit of Dimorphos around Didymos
      moonletRef.current.position.x = Math.cos(t * 0.4) * 2.8;
      moonletRef.current.position.y = Math.sin(t * 0.4) * 0.7;
      moonletRef.current.position.z = Math.sin(t * 0.4) * 1.8;
      moonletRef.current.rotation.y = t * 0.3;
    }
  });

  // Boulder rubble positions on Dimorphos moonlet
  const boulders = useMemo(() => {
    const list: { pos: [number, number, number]; scale: number }[] = [];
    for (let i = 0; i < 48; i++) {
      const phi = Math.acos(2 * Math.random() - 1);
      const theta = Math.random() * Math.PI * 2;
      const r = 0.98 + (Math.random() - 0.5) * 0.12;
      list.push({
        pos: [r * Math.sin(phi) * Math.cos(theta), r * Math.sin(phi) * Math.sin(theta), r * Math.cos(phi)],
        scale: 0.08 + Math.random() * 0.14,
      });
    }
    return list;
  }, []);

  return (
    <group ref={systemRef} position={[lateralX * 0.08, lateralY * 0.08, -zPos]}>
      {/* 1. PRIMARY ASTEROID: 65803 Didymos (780m Rubble Pile) */}
      <group position={[4.2, 1.2, 3.5]}>
        <mesh castShadow receiveShadow>
          <dodecahedronGeometry args={[2.4, 2]} />
          <meshStandardMaterial
            color="#475569"
            roughness={0.92}
            metalness={0.08}
            flatShading
          />
        </mesh>
      </group>

      {/* 2. TARGET MOONLET: Dimorphos (160m Moonlet & Target Boulder) */}
      <group ref={moonletRef} position={[0, 0, 0]}>
        {/* Core Rubble-Pile Body */}
        <mesh castShadow receiveShadow>
          <icosahedronGeometry args={[1.0, 3]} />
          <meshStandardMaterial
            color="#64748b"
            roughness={0.88}
            metalness={0.12}
            flatShading
          />
        </mesh>

        {/* Surface Boulders & Regolith Field */}
        {boulders.map((b, i) => (
          <mesh key={`boulder-${i}`} position={b.pos} scale={[b.scale, b.scale, b.scale]}>
            <dodecahedronGeometry args={[1, 1]} />
            <meshStandardMaterial color="#334155" roughness={0.95} metalness={0.05} flatShading />
          </mesh>
        ))}

        {/* High-Value Target Boulder (Direct Impact Objective - 3m CEP) */}
        <group position={[0, 0, 0.98]}>
          <mesh>
            <dodecahedronGeometry args={[0.22, 1]} />
            <meshStandardMaterial
              color="#f59e0b"
              emissive="#b45309"
              emissiveIntensity={0.35}
              roughness={0.85}
            />
          </mesh>

          {/* Holographic Target Reticle Bracket */}
          {isSmartNavLocked && (
            <mesh rotation={[0, 0, Math.PI / 4]}>
              <ringGeometry args={[0.32, 0.36, 16]} />
              <meshBasicMaterial
                color="#38bdf8"
                side={THREE.DoubleSide}
                transparent
                opacity={0.85}
              />
            </mesh>
          )}
        </group>
      </group>
    </group>
  );
}

// ----------------------------------------------------------------------------
// Act IV: LICIACube Perspective & Expanding Ejecta Particle Cloud
// ----------------------------------------------------------------------------
function EjectaDebrisCloud({ progress }: { progress: number }) {
  const count = 1800;
  const [positions, velocities, colors] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const vel = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);

    const cHot = new THREE.Color("#fbbf24");
    const cCool = new THREE.Color("#475569");

    for (let i = 0; i < count; i++) {
      // Conical ejecta plume along +Z axis
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * 0.65; // ~37° half-cone angle
      const speed = 1.2 + Math.random() * 6.5;

      vel[i * 3] = speed * Math.sin(phi) * Math.cos(theta);
      vel[i * 3 + 1] = speed * Math.sin(phi) * Math.sin(theta);
      vel[i * 3 + 2] = speed * Math.cos(phi);

      const t = Math.random();
      const c = cHot.clone().lerp(cCool, t);
      col[i * 3] = c.r;
      col[i * 3 + 1] = c.g;
      col[i * 3 + 2] = c.b;
    }
    return [pos, vel, col];
  }, []);

  const pointsRef = useRef<THREE.Points>(null);

  useFrame((_, delta) => {
    if (pointsRef.current && progress > 0) {
      const posArray = pointsRef.current.geometry.attributes.position.array as Float32Array;
      for (let i = 0; i < count; i++) {
        posArray[i * 3] += velocities[i * 3] * delta * 2.2;
        posArray[i * 3 + 1] += velocities[i * 3 + 1] * delta * 2.2;
        posArray[i * 3 + 2] += velocities[i * 3 + 2] * delta * 2.2;
      }
      pointsRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);

  return (
    <group position={[0, 0, -2.5]}>
      <points ref={pointsRef} geometry={geo}>
        <pointsMaterial
          size={0.08}
          vertexColors
          transparent
          opacity={Math.max(0, 1.0 - progress * 0.4)}
          blending={THREE.AdditiveBlending}
        />
      </points>

      {/* Incandescent Flash Core at Impact Point */}
      <mesh scale={[1 + progress * 2, 1 + progress * 2, 1 + progress * 2]}>
        <sphereGeometry args={[0.45, 16, 16]} />
        <meshBasicMaterial
          color="#ffffff"
          transparent
          opacity={Math.max(0, 0.9 - progress * 1.5)}
        />
      </mesh>
      <pointLight color="#f59e0b" intensity={Math.max(0, 8.0 - progress * 10)} distance={15} />
    </group>
  );
}

// ----------------------------------------------------------------------------
// Master 3D Scene Assembler for Project Aegis
// ----------------------------------------------------------------------------
export function AegisScene({
  currentAct,
  closingVelocityKms,
  distanceToTargetKm,
  lateralOffsetX,
  lateralOffsetY,
  rcsFiringX,
  rcsFiringY,
  isSmartNavLocked,
  impactTriggered,
  ejectaProgress,
  burnThrottle,
}: AegisSceneProps) {
  return (
    <>
      {/* Deep Space Starfield Background */}
      <Stars radius={120} depth={60} count={4000} factor={4} saturation={0.1} fade speed={0.4} />

      {/* Realistic Deep Space Directional Sunlight */}
      <ambientLight intensity={0.18} />
      <directionalLight position={[10, 6, 8]} intensity={2.4} color="#ffffff" castShadow />
      <directionalLight position={[-10, -4, -6]} intensity={0.12} color="#1e293b" />

      {/* ACT I: Mars Encounter & Oberth Slingshot */}
      {currentAct === "ACT_I_MARS_OBERTH" && (
        <>
          <MarsPlanet isBurning={burnThrottle > 0.05} />
          <group position={[0, 0, 1.2]} rotation={[0, 0.15, 0]}>
            <AegisProbeModel isBurning={burnThrottle > 0.05} rcsX={0} rcsY={0} />
          </group>
        </>
      )}

      {/* ACT II: Autonomous SMART Nav Approach */}
      {currentAct === "ACT_II_SMART_NAV" && (
        <>
          <BinaryAsteroidSystem
            distanceKm={distanceToTargetKm}
            lateralX={lateralOffsetX}
            lateralY={lateralOffsetY}
            isSmartNavLocked={isSmartNavLocked}
            isTerminal={false}
          />
          <group position={[0, 0, 1.5]} rotation={[0, 0, 0]}>
            <AegisProbeModel isBurning={false} rcsX={rcsFiringX} rcsY={rcsFiringY} />
          </group>
        </>
      )}

      {/* ACT III: Terminal 6.2 km/s Kinetic Impact Run */}
      {currentAct === "ACT_III_TERMINAL_RUN" && (
        <>
          <BinaryAsteroidSystem
            distanceKm={distanceToTargetKm}
            lateralX={lateralOffsetX}
            lateralY={lateralOffsetY}
            isSmartNavLocked={isSmartNavLocked}
            isTerminal={true}
          />
          {/* Probe directly in front of camera until impact */}
          {!impactTriggered && (
            <group position={[0, -0.4, 1.8]}>
              <AegisProbeModel isBurning={false} rcsX={rcsFiringX} rcsY={rcsFiringY} />
            </group>
          )}
        </>
      )}

      {/* ACT IV: LICIACube Observer & Ejecta Cloud */}
      {currentAct === "ACT_IV_LICIACUBE" && (
        <>
          {/* Shattered Target Moonlet Dimorphos with Impact Crater */}
          <group position={[0, 0, -2.5]}>
            <mesh>
              <icosahedronGeometry args={[1.0, 3]} />
              <meshStandardMaterial color="#475569" roughness={0.92} metalness={0.08} flatShading />
            </mesh>
            {/* Impact Crater Rim */}
            <mesh position={[0, 0, 0.98]} rotation={[Math.PI / 2, 0, 0]}>
              <torusGeometry args={[0.35, 0.08, 16, 32]} />
              <meshStandardMaterial color="#1e293b" roughness={0.98} />
            </mesh>
          </group>

          {/* Incandescent Kinetic Ejecta Cloud */}
          <EjectaDebrisCloud progress={ejectaProgress} />

          {/* LICIACube Companion CubeSat (6U) in foreground */}
          <group position={[1.4, -0.8, 1.2]} rotation={[0.2, -0.4, 0]}>
            <mesh>
              <boxGeometry args={[0.3, 0.6, 0.15]} />
              <meshStandardMaterial color="#334155" metalness={0.8} roughness={0.25} />
            </mesh>
            {/* Dual Optical Lenses (LUKE & LEIA) */}
            <mesh position={[0, 0.12, -0.09]}>
              <cylinderGeometry args={[0.04, 0.04, 0.04, 16]} />
              <meshStandardMaterial color="#38bdf8" emissive="#0284c7" emissiveIntensity={0.6} />
            </mesh>
            <mesh position={[0, -0.12, -0.09]}>
              <cylinderGeometry args={[0.035, 0.035, 0.04, 16]} />
              <meshStandardMaterial color="#f59e0b" emissive="#b45309" emissiveIntensity={0.5} />
            </mesh>
          </group>
        </>
      )}
    </>
  );
}
