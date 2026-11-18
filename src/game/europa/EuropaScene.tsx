"use client";

import React, { useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

export type EuropaAct = "ACT_1_SURFACE_DESCENT" | "ACT_2_CRYO_MELT" | "ACT_3_ABYSSAL_SUB" | "ACT_4_SAMPLE_DISCOVERY";

interface EuropaSceneProps {
  act: EuropaAct;
  reactorPowerPercent: number;
  meltDepthMeters: number;
  subPosition: THREE.Vector3;
  subRotation: THREE.Euler;
  sonarPingTrigger: number;
  isSampling: boolean;
  sampleCollected: boolean;
  clawExtension: number;
}

export default function EuropaScene({
  act,
  reactorPowerPercent,
  meltDepthMeters,
  subPosition,
  subRotation,
  sonarPingTrigger,
  isSampling,
  sampleCollected,
  clawExtension,
}: EuropaSceneProps) {
  return (
    <group>
      {act === "ACT_1_SURFACE_DESCENT" && <Act1SurfaceScene />}
      {act === "ACT_2_CRYO_MELT" && (
        <Act2CryoMeltScene
          reactorPowerPercent={reactorPowerPercent}
          meltDepthMeters={meltDepthMeters}
        />
      )}
      {(act === "ACT_3_ABYSSAL_SUB" || act === "ACT_4_SAMPLE_DISCOVERY") && (
        <Act3And4AbyssalScene
          act={act}
          subPosition={subPosition}
          subRotation={subRotation}
          sonarPingTrigger={sonarPingTrigger}
          isSampling={isSampling}
          sampleCollected={sampleCollected}
          clawExtension={clawExtension}
        />
      )}
    </group>
  );
}

// ============================================================================
// ACT I: JOVIAN RADIATION FURNACE & PENITENTES SURFACE DESCENT
// ============================================================================
function Act1SurfaceScene() {
  const landerRef = useRef<THREE.Group>(null);
  const flameRef = useRef<THREE.Mesh>(null);

  // Procedural 15-meter penitentes (jagged cryogenic ice blades)
  const penitentesData = useMemo(() => {
    const data: { pos: [number, number, number]; scale: [number, number, number]; rot: number }[] = [];
    for (let i = 0; i < 75; i++) {
      const x = (Math.random() - 0.5) * 80;
      const z = (Math.random() - 0.5) * 80;
      // Leave landing zone clear near center
      if (Math.sqrt(x * x + z * z) > 8.0) {
        data.push({
          pos: [x, 0, z],
          scale: [0.6 + Math.random() * 0.8, 3.0 + Math.random() * 4.5, 0.6 + Math.random() * 0.8],
          rot: Math.random() * Math.PI,
        });
      }
    }
    return data;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (landerRef.current) {
      landerRef.current.position.y = 4.5 + Math.sin(t * 1.2) * 0.15;
      landerRef.current.rotation.z = Math.sin(t * 0.8) * 0.03;
    }
    if (flameRef.current) {
      flameRef.current.scale.y = 1.0 + Math.sin(t * 25.0) * 0.25;
    }
  });

  return (
    <group>
      {/* Distant Giant Jupiter Globe */}
      <group position={[120, 80, -220]}>
        <mesh>
          <sphereGeometry args={[65, 48, 48]} />
          <meshStandardMaterial
            color="#d97706"
            roughness={0.8}
            metalness={0.1}
            emissive="#78350f"
            emissiveIntensity={0.2}
          />
        </mesh>
        {/* Jupiter Atmospheric Cloud Belt Ring */}
        <mesh rotation={[Math.PI / 6, 0, 0]}>
          <ringGeometry args={[75, 105, 64]} />
          <meshBasicMaterial color="#b45309" transparent opacity={0.35} side={THREE.DoubleSide} />
        </mesh>
      </group>

      {/* Lighting: Dim, harsh distant Jovian solar lighting + blue flux tube radiance */}
      <directionalLight position={[100, 60, -100]} intensity={2.2} color="#fef3c7" />
      <ambientLight intensity={0.4} />
      <pointLight position={[0, 15, 0]} intensity={1.5} distance={50} color="#38bdf8" />

      {/* Europa Chaos Terrain Ground */}
      <mesh position={[0, -0.5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[160, 160, 48, 48]} />
        <meshStandardMaterial
          color="#94a3b8"
          roughness={0.9}
          metalness={0.2}
        />
      </mesh>

      {/* Target Landing Zone Fracture Pad (Safe Basin) */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[3.5, 5.0, 32]} />
        <meshBasicMaterial color="#38bdf8" wireframe />
      </mesh>
      <mesh position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.5, 32]} />
        <meshStandardMaterial color="#0284c7" transparent opacity={0.3} />
      </mesh>

      {/* Jagged Cryogenic Penitentes Ice Spires */}
      {penitentesData.map((p, idx) => (
        <mesh key={`penitente-${idx}`} position={p.pos} scale={p.scale} rotation={[0, p.rot, 0]} castShadow>
          <coneGeometry args={[1.0, 3.0, 4]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.4} />
        </mesh>
      ))}

      {/* Lead-Kevlar Shielded Europa Lander Craft */}
      <group ref={landerRef} position={[0, 4.5, 0]}>
        {/* Octagonal Heavy Radiation Shield Bus */}
        <mesh castShadow>
          <cylinderGeometry args={[2.0, 2.4, 1.4, 8]} />
          <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Gold Thermal Blanket Top Dome */}
        <mesh position={[0, 0.8, 0]}>
          <sphereGeometry args={[1.2, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#f59e0b" metalness={0.8} roughness={0.2} emissive="#b45309" emissiveIntensity={0.2} />
        </mesh>

        {/* Quad Heavy Landing Legs */}
        {[0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2].map((angle, idx) => (
          <group key={`leg-${idx}`} position={[Math.cos(angle) * 1.8, -0.6, Math.sin(angle) * 1.8]} rotation={[0, -angle, 0.4]}>
            <mesh>
              <cylinderGeometry args={[0.08, 0.08, 1.8, 8]} />
              <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.4} />
            </mesh>
            <mesh position={[0, -0.9, 0]}>
              <cylinderGeometry args={[0.35, 0.35, 0.08, 12]} />
              <meshStandardMaterial color="#1e293b" />
            </mesh>
          </group>
        ))}

        {/* Descent Engine Plume */}
        <mesh ref={flameRef} position={[0, -1.2, 0]}>
          <coneGeometry args={[0.5, 1.8, 12]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} />
        </mesh>
        <pointLight position={[0, -1.5, 0]} color="#38bdf8" intensity={3.5} distance={12} />
      </group>
    </group>
  );
}

// ============================================================================
// ACT II: 900°C NUCLEAR CRYO-MELT PROBE PENETRATION
// ============================================================================
function Act2CryoMeltScene({
  reactorPowerPercent,
  meltDepthMeters,
}: {
  reactorPowerPercent: number;
  meltDepthMeters: number;
}) {
  const probeRef = useRef<THREE.Group>(null);
  const steamPlumeRef = useRef<THREE.Mesh>(null);

  // Procedural methane hazard gas pockets
  const gasPockets = useMemo(() => {
    const list: { pos: [number, number, number]; scale: number }[] = [];
    for (let i = 0; i < 24; i++) {
      list.push({
        pos: [(Math.random() - 0.5) * 4.0, (Math.random() - 0.5) * 16.0, (Math.random() - 0.5) * 4.0],
        scale: 0.4 + Math.random() * 0.7,
      });
    }
    return list;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (probeRef.current) {
      probeRef.current.position.y = Math.sin(t * 3.0) * 0.08;
      probeRef.current.rotation.y = t * 0.8;
    }
    if (steamPlumeRef.current) {
      steamPlumeRef.current.scale.set(
        1.0 + Math.sin(t * 8.0) * 0.2,
        1.0 + Math.cos(t * 8.0) * 0.2,
        1.0 + Math.sin(t * 8.0) * 0.2
      );
    }
  });

  const glowIntensity = (reactorPowerPercent / 100.0) * 2.5;

  return (
    <group>
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 0, 3]} intensity={1.8} color="#93c5fd" />

      {/* Surrounding Translucent Ice Strata Column */}
      <mesh position={[0, 0, 0]}>
        <cylinderGeometry args={[4.5, 4.5, 24, 32, 1, true]} />
        <meshStandardMaterial
          color="#0284c7"
          roughness={0.1}
          metalness={0.1}
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Trailing Molten Water Tunnel Behind Probe */}
      <mesh position={[0, 5, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 10, 24]} />
        <meshStandardMaterial
          color="#38bdf8"
          roughness={0.2}
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* Methane Gas Hazard Pockets (Orange Bubbles in Ice) */}
      {gasPockets.map((pocket, idx) => (
        <mesh key={`methane-${idx}`} position={pocket.pos} scale={pocket.scale}>
          <sphereGeometry args={[0.6, 16, 16]} />
          <meshStandardMaterial
            color="#f97316"
            roughness={0.2}
            emissive="#ea580c"
            emissiveIntensity={0.6}
            transparent
            opacity={0.7}
          />
        </mesh>
      ))}

      {/* 900°C Nuclear Melt Probe (Cryobot Pencil) */}
      <group ref={probeRef} position={[0, 0, 0]}>
        {/* Slender Cylindrical Hull */}
        <mesh>
          <cylinderGeometry args={[0.4, 0.4, 3.8, 24]} />
          <meshStandardMaterial color="#64748b" metalness={0.8} roughness={0.2} />
        </mesh>

        {/* 900°C Incandescent Tungsten Melting Nose Cone */}
        <mesh position={[0, -2.1, 0]}>
          <coneGeometry args={[0.42, 0.8, 24]} />
          <meshStandardMaterial
            color="#ef4444"
            emissive="#f97316"
            emissiveIntensity={glowIntensity}
            roughness={0.1}
          />
        </mesh>
        <pointLight position={[0, -2.2, 0]} color="#f97316" intensity={glowIntensity * 3.0} distance={8} />

        {/* Boiling Steam Envelope around Nose */}
        <mesh ref={steamPlumeRef} position={[0, -2.0, 0]}>
          <sphereGeometry args={[0.7, 16, 16]} />
          <meshBasicMaterial color="#fed7aa" transparent opacity={0.25} />
        </mesh>
      </group>
    </group>
  );
}

// ============================================================================
// ACT III & IV: 6-DOF ABYSSAL SUBMERSIBLE & HYDROTHERMAL VENT DISCOVERY
// ============================================================================
function Act3And4AbyssalScene({
  act,
  subPosition,
  subRotation,
  sonarPingTrigger,
  isSampling,
  sampleCollected,
  clawExtension,
}: {
  act: EuropaAct;
  subPosition: THREE.Vector3;
  subRotation: THREE.Euler;
  sonarPingTrigger: number;
  isSampling: boolean;
  sampleCollected: boolean;
  clawExtension: number;
}) {
  const sonarRingRef = useRef<THREE.Mesh>(null);
  const ventPlumeRef = useRef<THREE.Group>(null);
  const marineSnowRef = useRef<THREE.Points>(null);

  // Procedural Marine Snow Particulates
  const snowParticles = useMemo(() => {
    const count = 1200;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 60;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 40;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 60;
    }
    return positions;
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Animate Sonar Wave expansion
    if (sonarRingRef.current) {
      const pingAge = (t * 2.5) % 3.0;
      const s = 1.0 + pingAge * 14.0;
      sonarRingRef.current.scale.set(s, s, s);
      const mat = sonarRingRef.current.material as THREE.MeshBasicMaterial;
      if (mat) {
        mat.opacity = Math.max(0, 0.6 - pingAge * 0.2);
      }
    }

    // Animate Hydrothermal Superheated Plume billowing
    if (ventPlumeRef.current) {
      ventPlumeRef.current.children.forEach((child, i) => {
        child.position.y += 0.04;
        if (child.position.y > 14.0) {
          child.position.y = 1.0;
        }
        child.scale.setScalar(1.0 + child.position.y * 0.25);
      });
    }

    // Gentle marine snow drift
    if (marineSnowRef.current) {
      marineSnowRef.current.rotation.y = t * 0.015;
    }
  });

  return (
    <group>
      {/* Abyssal water volume (130 MPa crushing depth with deep oceanic ambient glow) */}
      <ambientLight intensity={0.36} color="#0284c7" />
      <directionalLight position={[0, 10, -5]} intensity={0.25} color="#38bdf8" />

      {/* Floating Marine Snow Particle Field */}
      <points ref={marineSnowRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[snowParticles, 3]}
          />
        </bufferGeometry>
        <pointsMaterial size={0.12} color="#94a3b8" transparent opacity={0.65} />
      </points>

      {/* Volcanic Hydrothermal Black Smoker Vent Structure at [0, -6, -14] */}
      <group position={[0, -6, -14]}>
        {/* Basalt Chimney Column */}
        <mesh position={[0, 4, 0]} castShadow>
          <cylinderGeometry args={[1.4, 2.8, 8, 16]} />
          <meshStandardMaterial color="#1e293b" roughness={0.9} metalness={0.3} />
        </mesh>

        {/* Glowing Magmatic Mineral Fissures */}
        <mesh position={[0, 4, 0]}>
          <cylinderGeometry args={[1.42, 2.82, 7.8, 8, 1, true]} />
          <meshStandardMaterial
            color="#ea580c"
            emissive="#f97316"
            emissiveIntensity={1.4}
            wireframe
          />
        </mesh>
        <pointLight position={[0, 8.2, 0]} color="#f97316" intensity={3.5} distance={16} />

        {/* Bioluminescent Microbial Mats (Emerald / Cyan living colony) */}
        <mesh position={[0.8, 5.5, 0.8]}>
          <sphereGeometry args={[0.55, 12, 12]} />
          <meshStandardMaterial
            color="#10b981"
            emissive="#059669"
            emissiveIntensity={sampleCollected ? 0.3 : 1.8}
            roughness={0.3}
          />
        </mesh>

        {/* Billowing Superheated 350°C Mineral Plumes */}
        <group ref={ventPlumeRef} position={[0, 8.2, 0]}>
          {[1.5, 3.5, 6.0, 9.0].map((y, idx) => (
            <mesh key={`plume-${idx}`} position={[0, y, 0]}>
              <sphereGeometry args={[0.9, 12, 12]} />
              <meshStandardMaterial
                color="#0f172a"
                roughness={0.9}
                transparent
                opacity={0.4}
              />
            </mesh>
          ))}
        </group>
      </group>

      {/* 3D In-World Sonar Objective Beacon Marking Hydrothermal Vent */}
      <group position={[0, 3.2, -14.0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.5, 1.7, 32]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.8} side={THREE.DoubleSide} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 4]}>
          <ringGeometry args={[0.9, 1.1, 4]} />
          <meshBasicMaterial color="#f97316" transparent opacity={0.9} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, -0.6, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.3, 0.6, 8]} />
          <meshBasicMaterial color="#38bdf8" />
        </mesh>
        <pointLight position={[0, 0, 0]} intensity={2.5} distance={15} color="#38bdf8" />
      </group>

      {/* Active Sonar Ring Pulse */}
      <mesh ref={sonarRingRef} position={subPosition}>
        <sphereGeometry args={[1.5, 24, 24]} />
        <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.5} />
      </mesh>

      {/* 6-DOF Autonomous Deep-Sea Submersible (Titanium-Composite Hull) */}
      <group position={subPosition} rotation={subRotation}>
        {/* Hydrodynamic Streamlined Submarine Hull */}
        <mesh castShadow>
          <capsuleGeometry args={[0.65, 2.0, 16, 24]} />
          <meshStandardMaterial color="#f8fafc" metalness={0.4} roughness={0.3} />
        </mesh>

        {/* Forward Observation Dome Port */}
        <mesh position={[0, 0, -1.25]}>
          <sphereGeometry args={[0.45, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#38bdf8" metalness={0.9} roughness={0.1} transparent opacity={0.6} />
        </mesh>

        {/* Submarine Hull Ambient Aura & Running Lights */}
        <pointLight position={[0, 1.2, 0]} intensity={2.2} distance={12} color="#93c5fd" />
        <pointLight position={[0.85, 0, 0]} intensity={1.5} distance={5} color="#22c55e" />
        <pointLight position={[-0.85, 0, 0]} intensity={1.5} distance={5} color="#ef4444" />
        <pointLight position={[0, 0.4, 1.2]} intensity={1.8} distance={6} color="#f8fafc" />

        {/* Dual High-Intensity Forward Xenon Headlights */}
        <pointLight position={[0.45, -0.1, -1.8]} color="#e0f2fe" intensity={5.5} distance={30} />
        <pointLight position={[-0.45, -0.1, -1.8]} color="#e0f2fe" intensity={5.5} distance={30} />
        <pointLight position={[0, 0, -1.1]} color="#38bdf8" intensity={2.4} distance={8} />

        {/* Vector Thruster Ducts */}
        {[-0.85, 0.85].map((x, idx) => (
          <group key={`thruster-${idx}`} position={[x, 0, 0.6]}>
            <mesh>
              <cylinderGeometry args={[0.22, 0.22, 0.6, 16]} />
              <meshStandardMaterial color="#0284c7" metalness={0.8} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0, 0.35]}>
              <coneGeometry args={[0.18, 0.4, 12]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.7} />
            </mesh>
          </group>
        ))}

        {/* Robotic Manipulator Claw Arm (Act IV Sampling) */}
        <group position={[0.2, -0.4, -1.1]}>
          {/* Base Joint */}
          <mesh>
            <sphereGeometry args={[0.12, 12, 12]} />
            <meshStandardMaterial color="#334155" metalness={0.8} />
          </mesh>

          {/* Articulating Arm Segment */}
          <mesh position={[0, -0.15, -0.4 * (1.0 + clawExtension)]} rotation={[0.4, 0, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 0.8 * (1.0 + clawExtension), 8]} />
            <meshStandardMaterial color="#f59e0b" metalness={0.7} roughness={0.3} />
          </mesh>

          {/* 3-Prong Sampling Claw End-Effector */}
          <group position={[0, -0.4, -0.8 * (1.0 + clawExtension)]}>
            {[0, (2 * Math.PI) / 3, (4 * Math.PI) / 3].map((prongAngle, pIdx) => (
              <mesh
                key={`prong-${pIdx}`}
                position={[Math.cos(prongAngle) * 0.08, Math.sin(prongAngle) * 0.08, -0.1]}
                rotation={[0, 0, prongAngle]}
              >
                <coneGeometry args={[0.03, 0.15, 6]} />
                <meshStandardMaterial color="#cbd5e1" metalness={0.9} />
              </mesh>
            ))}

            {/* Collected Organic Microbial Sample Vial */}
            {sampleCollected && (
              <mesh position={[0, 0, -0.05]}>
                <sphereGeometry args={[0.08, 12, 12]} />
                <meshStandardMaterial color="#10b981" emissive="#059669" emissiveIntensity={1.5} />
              </mesh>
            )}
          </group>
        </group>
      </group>
    </group>
  );
}
