"use client";

import React, { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { RealisticEarth } from "./RealisticEarth";

export interface SpacecraftSceneProps {
  busSize?: "1U" | "3U" | "6U";
  solarArrayType?: "BODY_MOUNTED" | "SINGLE_WING" | "DUAL_WING";
  solarArrayDeployed?: boolean;
  antennaType?: "UHF" | "SBAND" | "XBAND";
  payloadType?: "IMAGER" | "PLASMA" | "LIDAR" | "RADAR";
  hasPropulsion?: boolean;
  thrusterActive?: boolean;
  isEclipse?: boolean;
  viewMode?: "SPACECRAFT" | "ORBIT";
  orbitAltitudeKm?: number;
  orbitProgress?: number; // 0 to 1
  activeStationName?: string | null;
}

export function SpacecraftScene({
  busSize = "3U",
  solarArrayType = "SINGLE_WING",
  solarArrayDeployed = true,
  antennaType = "SBAND",
  payloadType = "IMAGER",
  hasPropulsion = false,
  thrusterActive = false,
  isEclipse = false,
  viewMode = "SPACECRAFT",
  orbitAltitudeKm = 600,
  orbitProgress = 0,
  activeStationName = null,
}: SpacecraftSceneProps) {
  const meshRef = useRef<THREE.Group>(null);
  const earthRef = useRef<THREE.Group>(null);

  // Subtle continuous rotation for inspection
  useFrame((_, delta) => {
    if (viewMode === "SPACECRAFT" && meshRef.current) {
      meshRef.current.rotation.y += delta * 0.2;
    }
    if (viewMode === "ORBIT" && earthRef.current) {
      earthRef.current.rotation.y += delta * 0.04;
    }
  });

  // Standard CubeSat dimensions (1 unit = 10 cm)
  const heightMultiplier = busSize === "1U" ? 1.0 : 3.0;
  const widthMultiplier = busSize === "6U" ? 2.0 : 1.0;
  const halfH = heightMultiplier / 2;
  const halfW = widthMultiplier / 2;
  const halfD = 0.5;

  // Orbit radius scaled for visualization
  const earthRadius = 2.0;
  const scaledOrbitRadius =
    earthRadius + Math.min(2.5, Math.max(0.6, (orbitAltitudeKm / 1000) * 0.8));

  // Satellite position on orbit
  const orbitAngle = orbitProgress * 2 * Math.PI;
  const satX = scaledOrbitRadius * Math.cos(orbitAngle);
  const satZ = scaledOrbitRadius * Math.sin(orbitAngle);
  const satY = Math.sin(orbitAngle) * 0.35; // Inclination tilt

  // Ground stations locations on Earth globe (lat/long)
  const groundStations = useMemo(() => [
    { name: "Wallops WFF", lat: 37.9, lon: -75.5, col: "#22c55e" },
    { name: "Svalbard SG3", lat: 78.2, lon: 15.4, col: "#38bdf8" },
    { name: "Goldstone GDS", lat: 35.4, lon: -116.9, col: "#f59e0b" },
  ], []);

  // Solar wing dimensions
  const wingSpan = 1.15;
  const wingHeight = heightMultiplier * 0.82;
  const wingXOffset = halfW;

  // ==========================================================================
  // VIEW MODE: ORBIT VIEW (Photorealistic Blue Marble Earth + Orbit Track)
  // ==========================================================================
  if (viewMode === "ORBIT") {
    return (
      <>
        {/* Starfield in deep space */}
        <Stars radius={80} depth={50} count={3500} factor={4} saturation={0} fade speed={0.6} />

        {/* Orbital Lighting */}
        <ambientLight intensity={isEclipse ? 0.08 : 0.32} />
        {/* Sun light from +X direction */}
        <directionalLight position={[12, 3, 6]} intensity={1.6} color="#ffffff" />
        <directionalLight position={[-12, -3, -6]} intensity={0.04} color="#1e293b" />

        {/* Central Photorealistic NASA Blue Marble Earth Globe */}
        <RealisticEarth radius={earthRadius} rotationSpeed={0.03} />

        <group ref={earthRef}>
          {/* Ground Station Markers on Globe */}
          {groundStations.map((st) => {
            const phi = (90 - st.lat) * (Math.PI / 180);
            const theta = (st.lon + 180) * (Math.PI / 180);
            const r = earthRadius + 0.01;
            const gx = -r * Math.sin(phi) * Math.cos(theta);
            const gy = r * Math.cos(phi);
            const gz = r * Math.sin(phi) * Math.sin(theta);
            const isActive = activeStationName && activeStationName.includes(st.name.split(" ")[0]);

            return (
              <group key={st.name} position={[gx, gy, gz]}>
                <mesh>
                  <sphereGeometry args={[0.035, 12, 12]} />
                  <meshBasicMaterial color={isActive ? "#22c55e" : st.col} />
                </mesh>
                {isActive && (
                  <mesh>
                    <ringGeometry args={[0.05, 0.14, 16]} />
                    <meshBasicMaterial color="#22c55e" transparent opacity={0.65} side={THREE.DoubleSide} />
                  </mesh>
                )}
              </group>
            );
          })}
        </group>

        {/* Orbit Trajectory Ribbon */}
        <mesh rotation={[Math.PI / 2, 0.12, 0]}>
          <ringGeometry args={[scaledOrbitRadius - 0.01, scaledOrbitRadius + 0.01, 96]} />
          <meshBasicMaterial
            color={isEclipse ? "#ef4444" : "#38bdf8"}
            transparent
            opacity={0.45}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* Earth Shadow (Umbra Cylinder Visual Cue) */}
        <mesh position={[-scaledOrbitRadius / 2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[earthRadius, earthRadius, scaledOrbitRadius, 32, 1, true]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.14} side={THREE.DoubleSide} />
        </mesh>

        {/* Satellite Position on Orbit */}
        <group position={[satX, satY, satZ]}>
          {/* Main Spacecraft Core Marker */}
          <mesh>
            <boxGeometry args={[0.18, 0.18, 0.18]} />
            <meshStandardMaterial
              color={isEclipse ? "#64748b" : "#f8fafc"}
              emissive={isEclipse ? "#000000" : "#38bdf8"}
              emissiveIntensity={isEclipse ? 0 : 0.4}
            />
          </mesh>
          {/* Mini Solar Array Wings */}
          <mesh position={[0.18, 0, 0]}>
            <boxGeometry args={[0.16, 0.02, 0.12]} />
            <meshStandardMaterial color="#0369a1" />
          </mesh>
          <mesh position={[-0.18, 0, 0]}>
            <boxGeometry args={[0.16, 0.02, 0.12]} />
            <meshStandardMaterial color="#0369a1" />
          </mesh>
          {/* Active Thruster Plume in Orbit */}
          {thrusterActive && (
            <mesh position={[0, -0.16, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.08, 0.22, 12]} />
              <meshBasicMaterial color="#38bdf8" transparent opacity={0.85} />
            </mesh>
          )}
        </group>

        <OrbitControls
          enablePan={false}
          minDistance={3.5}
          maxDistance={12}
          autoRotate={false}
        />
      </>
    );
  }

  // ==========================================================================
  // VIEW MODE: DETAILED SPACECRAFT INSPECTION (High-Fidelity Flight Hardware)
  // ==========================================================================
  return (
    <>
      {/* Background Starfield */}
      <Stars radius={60} depth={30} count={1500} factor={3} saturation={0} fade speed={0.4} />

      {/* Product-Visualization Studio Lighting */}
      <ambientLight intensity={isEclipse ? 0.08 : 0.42} />
      {/* Main Sun Key Light */}
      <directionalLight
        position={[6, 8, 7]}
        intensity={isEclipse ? 0.08 : 1.45}
        color={isEclipse ? "#94a3b8" : "#ffffff"}
      />
      {/* Fill Light (Soft neutral) */}
      <directionalLight
        position={[-6, -3, -5]}
        intensity={isEclipse ? 0.02 : 0.28}
        color="#cbd5e1"
      />
      {/* Rim / Edge Light */}
      <directionalLight
        position={[0, -6, 4]}
        intensity={isEclipse ? 0.01 : 0.22}
        color="#38bdf8"
      />

      <group ref={meshRef}>
        {/* ================================================================== */}
        {/* 1. INTERNAL CHASSIS & STRUCTURAL RAILS                             */}
        {/* ================================================================== */}
        {/* Main Chassis Body (Hard-anodized aluminum 6061-T6 internal core) */}
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[widthMultiplier * 0.98, heightMultiplier * 0.98, 0.98]} />
          <meshStandardMaterial
            color="#141820"
            metalness={0.85}
            roughness={0.3}
          />
        </mesh>

        {/* 4 Structural Corner Rails (CDS Standard 8.5 mm Extruded Rails) */}
        {[
          [-halfW, -halfD],
          [halfW, -halfD],
          [-halfW, halfD],
          [halfW, halfD],
        ].map(([rx, rz], idx) => (
          <group key={`rail-${idx}`} position={[rx, 0, rz]}>
            {/* Corner Angle Rail Body */}
            <mesh>
              <boxGeometry args={[0.07, heightMultiplier * 1.0, 0.07]} />
              <meshStandardMaterial color="#222834" metalness={0.9} roughness={0.25} />
            </mesh>

            {/* Top P-POD Standoff Foot (CDS Rev 14.1 §2.2.4) */}
            <mesh position={[0, halfH + 0.04, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 0.08, 12]} />
              <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
            </mesh>

            {/* Bottom P-POD Standoff Foot */}
            <mesh position={[0, -halfH - 0.04, 0]}>
              <cylinderGeometry args={[0.035, 0.035, 0.08, 12]} />
              <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
            </mesh>

            {/* Separation Switch Plunger on diagonal feet */}
            {(idx === 0 || idx === 3) && (
              <mesh position={[0, halfH + 0.085, 0]}>
                <cylinderGeometry args={[0.012, 0.012, 0.03, 8]} />
                <meshStandardMaterial color="#d97706" metalness={0.9} roughness={0.2} />
              </mesh>
            )}
          </group>
        ))}

        {/* Structural Edge Outlines */}
        <lineSegments>
          <edgesGeometry
            args={[new THREE.BoxGeometry(widthMultiplier * 1.002, heightMultiplier * 1.002, 1.002)]}
          />
          <lineBasicMaterial color="#3b4458" />
        </lineSegments>

        {/* ================================================================== */}
        {/* 2. THERMAL MULTI-LAYER INSULATION (MLI) GOLD BLANKETS              */}
        {/* ================================================================== */}
        {/* Left Face (-X) Gold Kapton Thermal Blanket */}
        <mesh position={[-halfW - 0.005, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[0.82, heightMultiplier * 0.76]} />
          <meshStandardMaterial
            color="#d49725"
            metalness={0.95}
            roughness={0.26}
          />
        </mesh>
        {/* Carbon tape grounding border around left MLI */}
        <lineSegments position={[-halfW - 0.006, 0, 0]} rotation={[0, -Math.PI / 2, 0]}>
          <edgesGeometry args={[new THREE.PlaneGeometry(0.82, heightMultiplier * 0.76)]} />
          <lineBasicMaterial color="#1e222b" />
        </lineSegments>

        {/* Right Face (+X) Gold Kapton Thermal Blanket */}
        <mesh position={[halfW + 0.005, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[0.82, heightMultiplier * 0.76]} />
          <meshStandardMaterial
            color="#d49725"
            metalness={0.95}
            roughness={0.26}
          />
        </mesh>

        {/* ================================================================== */}
        {/* 3. PHOTOVOLTAIC SOLAR ARRAYS                                       */}
        {/* ================================================================== */}
        {/* Front (+Z) Face Solar Cells */}
        <group position={[0, 0, halfD + 0.005]}>
          <mesh>
            <planeGeometry args={[widthMultiplier * 0.86, heightMultiplier * 0.86]} />
            <meshStandardMaterial color="#0f131a" roughness={0.8} />
          </mesh>
          {Array.from({ length: Math.round(heightMultiplier * 2) }).map((_, cIdx) => (
            <mesh
              key={`front-cell-${cIdx}`}
              position={[
                0,
                -halfH * 0.8 + ((cIdx + 0.5) * (heightMultiplier * 0.8)) / (heightMultiplier * 2),
                0.002,
              ]}
            >
              <planeGeometry args={[widthMultiplier * 0.82, (heightMultiplier * 0.76) / (heightMultiplier * 2)]} />
              <meshStandardMaterial
                color="#0b172d"
                metalness={0.9}
                roughness={0.14}
              />
            </mesh>
          ))}
          {/* Silver busbar collector traces */}
          <mesh position={[0, 0, 0.003]}>
            <planeGeometry args={[0.015, heightMultiplier * 0.82]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.1} />
          </mesh>
        </group>

        {/* Back (-Z) Face Solar Cells */}
        <group position={[0, 0, -halfD - 0.005]} rotation={[0, Math.PI, 0]}>
          <mesh>
            <planeGeometry args={[widthMultiplier * 0.86, heightMultiplier * 0.86]} />
            <meshStandardMaterial color="#0f131a" roughness={0.8} />
          </mesh>
          {Array.from({ length: Math.round(heightMultiplier * 2) }).map((_, cIdx) => (
            <mesh
              key={`back-cell-${cIdx}`}
              position={[
                0,
                -halfH * 0.8 + ((cIdx + 0.5) * (heightMultiplier * 0.8)) / (heightMultiplier * 2),
                0.002,
              ]}
            >
              <planeGeometry args={[widthMultiplier * 0.82, (heightMultiplier * 0.76) / (heightMultiplier * 2)]} />
              <meshStandardMaterial
                color="#0b172d"
                metalness={0.9}
                roughness={0.14}
              />
            </mesh>
          ))}
          <mesh position={[0, 0, 0.003]}>
            <planeGeometry args={[0.015, heightMultiplier * 0.82]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.95} roughness={0.1} />
          </mesh>
        </group>

        {/* Deployable Solar Panel Wings (Single or Dual Wing) */}
        {(solarArrayType === "SINGLE_WING" || solarArrayType === "DUAL_WING") && (
          <>
            {/* Right Wing (+X) */}
            <group
              position={[
                wingXOffset,
                0,
                solarArrayDeployed ? 0 : 0.52,
              ]}
              rotation={[0, solarArrayDeployed ? 0 : -Math.PI / 2, 0]}
            >
              {/* CFRP Panel Substrate Body */}
              <mesh position={[wingSpan / 2 + 0.06, 0, 0]}>
                <boxGeometry args={[wingSpan, wingHeight, 0.024]} />
                <meshStandardMaterial color="#16181f" roughness={0.65} metalness={0.2} />
              </mesh>

              {/* Front Triple-Junction Solar Cell Tile Grid */}
              <group position={[wingSpan / 2 + 0.06, 0, 0.013]}>
                {[0, 1, 2].map((col) => (
                  <mesh key={`r-cell-${col}`} position={[-wingSpan * 0.32 + col * (wingSpan * 0.32), 0, 0]}>
                    <planeGeometry args={[wingSpan * 0.28, wingHeight * 0.9]} />
                    <meshStandardMaterial
                      color="#0c1930"
                      metalness={0.92}
                      roughness={0.13}
                    />
                  </mesh>
                ))}
                {/* Silver busbars */}
                <mesh position={[0, 0, 0.001]}>
                  <planeGeometry args={[wingSpan * 0.9, 0.01]} />
                  <meshStandardMaterial color="#e2e8f0" metalness={0.9} />
                </mesh>
              </group>

              {/* Rear Face Gold Mylar Backing with Wiring Harness */}
              <mesh position={[wingSpan / 2 + 0.06, 0, -0.013]} rotation={[0, Math.PI, 0]}>
                <planeGeometry args={[wingSpan * 0.94, wingHeight * 0.94]} />
                <meshStandardMaterial color="#b47818" metalness={0.85} roughness={0.3} />
              </mesh>

              {/* Machined Hinge Assemblies (Top & Bottom) */}
              <mesh position={[0.025, wingHeight * 0.35, 0]}>
                <cylinderGeometry args={[0.035, 0.035, 0.12, 12]} />
                <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
              </mesh>
              <mesh position={[0.025, -wingHeight * 0.35, 0]}>
                <cylinderGeometry args={[0.035, 0.035, 0.12, 12]} />
                <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
              </mesh>
            </group>

            {/* Left Wing (-X) for Dual-Wing */}
            {solarArrayType === "DUAL_WING" && (
              <group
                position={[
                  -wingXOffset,
                  0,
                  solarArrayDeployed ? 0 : 0.52,
                ]}
                rotation={[0, solarArrayDeployed ? 0 : Math.PI / 2, 0]}
              >
                {/* CFRP Panel Substrate Body */}
                <mesh position={[-wingSpan / 2 - 0.06, 0, 0]}>
                  <boxGeometry args={[wingSpan, wingHeight, 0.024]} />
                  <meshStandardMaterial color="#16181f" roughness={0.65} metalness={0.2} />
                </mesh>

                {/* Front Triple-Junction Solar Cell Grid */}
                <group position={[-wingSpan / 2 - 0.06, 0, 0.013]}>
                  {[0, 1, 2].map((col) => (
                    <mesh key={`l-cell-${col}`} position={[-wingSpan * 0.32 + col * (wingSpan * 0.32), 0, 0]}>
                      <planeGeometry args={[wingSpan * 0.28, wingHeight * 0.9]} />
                      <meshStandardMaterial
                        color="#0c1930"
                        metalness={0.92}
                        roughness={0.13}
                      />
                    </mesh>
                  ))}
                  <mesh position={[0, 0, 0.001]}>
                    <planeGeometry args={[wingSpan * 0.9, 0.01]} />
                    <meshStandardMaterial color="#e2e8f0" metalness={0.9} />
                  </mesh>
                </group>

                {/* Rear Face Gold Mylar Backing */}
                <mesh position={[-wingSpan / 2 - 0.06, 0, -0.013]} rotation={[0, Math.PI, 0]}>
                  <planeGeometry args={[wingSpan * 0.94, wingHeight * 0.94]} />
                  <meshStandardMaterial color="#b47818" metalness={0.85} roughness={0.3} />
                </mesh>

                {/* Machined Hinge Assemblies */}
                <mesh position={[-0.025, wingHeight * 0.35, 0]}>
                  <cylinderGeometry args={[0.035, 0.035, 0.12, 12]} />
                  <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
                </mesh>
                <mesh position={[-0.025, -wingHeight * 0.35, 0]}>
                  <cylinderGeometry args={[0.035, 0.035, 0.12, 12]} />
                  <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
                </mesh>
              </group>
            )}
          </>
        )}

        {/* ================================================================== */}
        {/* 4. SCIENCE PAYLOAD APERTURE (Nadir Face: Top +Y)                   */}
        {/* ================================================================== */}
        <group position={[0, halfH + 0.05, 0]}>
          {payloadType === "IMAGER" && (
            <group>
              {/* Outer knurled lens barrel with light baffles */}
              <mesh>
                <cylinderGeometry args={[0.26, 0.32, 0.14, 32]} />
                <meshStandardMaterial color="#1b202c" metalness={0.85} roughness={0.25} />
              </mesh>
              {/* Lens Baffle Ring */}
              <mesh position={[0, 0.06, 0]}>
                <cylinderGeometry args={[0.28, 0.28, 0.02, 32]} />
                <meshStandardMaterial color="#0f1117" metalness={0.9} roughness={0.2} />
              </mesh>
              {/* Multi-coated Optical Glass Front Element */}
              <mesh position={[0, 0.071, 0]}>
                <cylinderGeometry args={[0.22, 0.22, 0.008, 32]} />
                <meshStandardMaterial
                  color="#0284c7"
                  metalness={0.95}
                  roughness={0.04}
                  emissive="#0369a1"
                  emissiveIntensity={0.25}
                />
              </mesh>
              {/* Internal Aperture Stop */}
              <mesh position={[0, 0.05, 0]}>
                <ringGeometry args={[0.1, 0.22, 24]} />
                <meshBasicMaterial color="#000000" side={THREE.DoubleSide} />
              </mesh>
            </group>
          )}

          {payloadType === "RADAR" && (
            <group position={[0, 0.03, 0]}>
              <mesh>
                <boxGeometry args={[widthMultiplier * 0.7, 0.04, 0.7]} />
                <meshStandardMaterial color="#1e222a" metalness={0.5} roughness={0.4} />
              </mesh>
              <mesh position={[0, 0.022, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[widthMultiplier * 0.62, 0.62]} />
                <meshStandardMaterial color="#d49725" metalness={0.9} roughness={0.25} />
              </mesh>
            </group>
          )}

          {payloadType === "LIDAR" && (
            <group>
              <mesh position={[-0.14, 0.05, 0]}>
                <cylinderGeometry args={[0.09, 0.09, 0.12, 20]} />
                <meshStandardMaterial color="#1e2430" metalness={0.85} />
              </mesh>
              <mesh position={[-0.14, 0.112, 0]}>
                <cylinderGeometry args={[0.07, 0.07, 0.005, 20]} />
                <meshStandardMaterial color="#10b981" emissive="#059669" emissiveIntensity={0.4} roughness={0.1} />
              </mesh>

              <mesh position={[0.14, 0.06, 0]}>
                <cylinderGeometry args={[0.15, 0.15, 0.14, 24]} />
                <meshStandardMaterial color="#1e2430" metalness={0.85} />
              </mesh>
              <mesh position={[0.14, 0.131, 0]}>
                <cylinderGeometry args={[0.12, 0.12, 0.005, 24]} />
                <meshStandardMaterial color="#1e293b" metalness={0.95} roughness={0.08} />
              </mesh>
            </group>
          )}

          {payloadType === "PLASMA" && (
            <group position={[0.2, 0.05, -0.2]}>
              <mesh position={[0.25, 0.25, -0.25]} rotation={[Math.PI / 4, 0, -Math.PI / 4]}>
                <cylinderGeometry args={[0.015, 0.015, 0.7, 8]} />
                <meshStandardMaterial color="#222630" roughness={0.6} metalness={0.3} />
              </mesh>
              <mesh position={[0.5, 0.5, -0.5]}>
                <sphereGeometry args={[0.06, 20, 20]} />
                <meshStandardMaterial color="#d49725" metalness={0.95} roughness={0.15} />
              </mesh>
              <mesh position={[0.25, 0.25, -0.25]}>
                <boxGeometry args={[0.06, 0.06, 0.06]} />
                <meshStandardMaterial color="#e2e8f0" metalness={0.8} />
              </mesh>
            </group>
          )}
        </group>

        {/* ================================================================== */}
        {/* 5. TELECOM COMMUNICATIONS HARDWARE                                 */}
        {/* ================================================================== */}
        <group position={[0, halfH + 0.03, 0.32]}>
          {antennaType === "SBAND" && (
            <group>
              <mesh>
                <cylinderGeometry args={[0.15, 0.15, 0.03, 24]} />
                <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
              </mesh>
              <mesh position={[0, 0.016, 0]}>
                <cylinderGeometry args={[0.11, 0.11, 0.005, 24]} />
                <meshStandardMaterial color="#d49725" metalness={0.9} roughness={0.25} />
              </mesh>
            </group>
          )}

          {antennaType === "XBAND" && (
            <group rotation={[Math.PI / 5, 0, 0]}>
              <mesh>
                <cylinderGeometry args={[0.06, 0.06, 0.05, 16]} />
                <meshStandardMaterial color="#475569" metalness={0.9} />
              </mesh>
              <mesh position={[0, 0.08, 0]}>
                <cylinderGeometry args={[0.22, 0.06, 0.14, 24, 1, true]} />
                <meshStandardMaterial color="#e2e8f0" metalness={0.92} roughness={0.18} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[0, 0.04, 0]}>
                <sphereGeometry args={[0.02, 12, 12]} />
                <meshStandardMaterial color="#d49725" metalness={0.95} />
              </mesh>
            </group>
          )}

          {antennaType === "UHF" && (
            <group>
              <mesh>
                <boxGeometry args={[0.22, 0.03, 0.22]} />
                <meshStandardMaterial color="#334155" metalness={0.8} />
              </mesh>
              {[
                [0.18, 0.18, Math.PI / 4, 0],
                [-0.18, 0.18, -Math.PI / 4, 0],
                [0.18, -0.18, Math.PI / 4, Math.PI],
                [-0.18, -0.18, -Math.PI / 4, Math.PI],
              ].map(([wx, wz, rotZ, rotY], uIdx) => (
                <mesh key={`uhf-whip-${uIdx}`} position={[wx, 0.12, wz]} rotation={[0, rotY, rotZ]}>
                  <cylinderGeometry args={[0.006, 0.006, 0.32, 6]} />
                  <meshStandardMaterial color="#d97706" metalness={0.85} roughness={0.3} />
                </mesh>
              ))}
            </group>
          )}
        </group>

        {/* ================================================================== */}
        {/* 6. PROPULSION THRUSTER & NOZZLE (Aft Face: Bottom -Y)              */}
        {/* ================================================================== */}
        {hasPropulsion && (
          <group position={[0, -halfH - 0.06, 0]}>
            <mesh>
              <cylinderGeometry args={[0.16, 0.16, 0.04, 20]} />
              <meshStandardMaterial color="#334155" metalness={0.85} roughness={0.3} />
            </mesh>

            <mesh position={[0, -0.09, 0]} rotation={[Math.PI, 0, 0]}>
              <cylinderGeometry args={[0.15, 0.05, 0.15, 20, 1, true]} />
              <meshStandardMaterial color="#64748b" metalness={0.95} roughness={0.2} side={THREE.DoubleSide} />
            </mesh>

            {thrusterActive && (
              <mesh position={[0, -0.26, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.16, 0.38, 20]} />
                <meshBasicMaterial
                  color="#38bdf8"
                  transparent
                  opacity={0.85}
                />
              </mesh>
            )}
          </group>
        )}
      </group>

      <OrbitControls
        enablePan={false}
        minDistance={2.4}
        maxDistance={8.5}
        autoRotate={false}
      />
    </>
  );
}
