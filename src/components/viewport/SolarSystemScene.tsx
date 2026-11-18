"use client";

import React, { useRef, useMemo, useState } from "react";
import { useFrame } from "@react-three/fiber";
import { Stars } from "@react-three/drei";
import * as THREE from "three";
import { RealisticEarth } from "./RealisticEarth";
import {
  getSunTexture,
  getMercuryTexture,
  getVenusTexture,
  getMarsTexture,
  getJupiterTexture,
  getSaturnTexture,
  getSaturnRingTexture,
  getUranusTexture,
  getNeptuneTexture,
} from "./planetTextures";

export interface PlanetaryData {
  id: string;
  name: string;
  distance: number;
  radius: number;
  orbitSpeed: number; // relative angular speed
  axialTilt: number; // radians
  rotationSpeed: number;
  realDistanceAU: string;
  orbitalPeriod: string;
  gravity: string;
  meanTemp: string;
  atmosphere: string;
  missionLink?: string;
}

export const PLANETS_CATALOG: PlanetaryData[] = [
  {
    id: "sun",
    name: "Sun (Sol)",
    distance: 0,
    radius: 2.8,
    orbitSpeed: 0,
    axialTilt: 0.12,
    rotationSpeed: 0.05,
    realDistanceAU: "0.00 AU (Center)",
    orbitalPeriod: "230 Million Years (Galactic)",
    gravity: "274.0 m/s² (28.0 g)",
    meanTemp: "+5,500°C (Photosphere)",
    atmosphere: "73% H, 25% He, 2% Metals",
    missionLink: "Parker Solar Probe & SOHO Heliospheric Sentinel",
  },
  {
    id: "mercury",
    name: "Mercury",
    distance: 5.2,
    radius: 0.36,
    orbitSpeed: 1.6,
    axialTilt: 0.01,
    rotationSpeed: 0.15,
    realDistanceAU: "0.39 AU (57.9M km)",
    orbitalPeriod: "87.97 Earth Days",
    gravity: "3.70 m/s² (0.38 g)",
    meanTemp: "-180°C to +430°C",
    atmosphere: "Exosphere: Oxygen, Sodium, Hydrogen",
    missionLink: "BepiColombo & MESSENGER Cratering Survey",
  },
  {
    id: "venus",
    name: "Venus",
    distance: 8.2,
    radius: 0.68,
    orbitSpeed: 1.18,
    axialTilt: 3.09, // retrograde rotation
    rotationSpeed: -0.08,
    realDistanceAU: "0.72 AU (108.2M km)",
    orbitalPeriod: "224.70 Earth Days",
    gravity: "8.87 m/s² (0.91 g)",
    meanTemp: "+464°C (Runaway Greenhouse)",
    atmosphere: "96.5% CO2, 3.5% N2, H2SO4 Clouds",
    missionLink: "DAVINCI+ Atmospheric Probe & EnVision Radar",
  },
  {
    id: "earth",
    name: "Earth & Moon (Luna)",
    distance: 12.0,
    radius: 0.78,
    orbitSpeed: 1.0,
    axialTilt: 0.41,
    rotationSpeed: 0.22,
    realDistanceAU: "1.00 AU (149.6M km)",
    orbitalPeriod: "365.25 Earth Days",
    gravity: "9.81 m/s² (1.00 g)",
    meanTemp: "+15°C (Habitable Baseline)",
    atmosphere: "78.08% N2, 20.95% O2, 0.93% Ar",
    missionLink: "Operation Artemis-VII: Gateway-1 & Shackleton Cradle",
  },
  {
    id: "mars",
    name: "Mars",
    distance: 16.2,
    radius: 0.48,
    orbitSpeed: 0.81,
    axialTilt: 0.44,
    rotationSpeed: 0.21,
    realDistanceAU: "1.52 AU (227.9M km)",
    orbitalPeriod: "686.98 Earth Days",
    gravity: "3.72 m/s² (0.38 g)",
    meanTemp: "-63°C (-140°C to +20°C)",
    atmosphere: "95.3% CO2, 2.6% N2, 1.9% Ar",
    missionLink: "Project Aegis: Mars Oberth Slingshot Corridor",
  },
  {
    id: "jupiter",
    name: "Jupiter & Europa",
    distance: 24.5,
    radius: 1.85,
    orbitSpeed: 0.43,
    axialTilt: 0.05,
    rotationSpeed: 0.52,
    realDistanceAU: "5.20 AU (778.5M km)",
    orbitalPeriod: "11.86 Earth Years",
    gravity: "24.79 m/s² (2.53 g)",
    meanTemp: "-110°C (1 bar level)",
    atmosphere: "89.8% H2, 10.2% He, CH4, NH3",
    missionLink: "Project Europa: 130 MPa Abyssal Ocean Exploration",
  },
  {
    id: "saturn",
    name: "Saturn & Titan",
    distance: 33.0,
    radius: 1.55,
    orbitSpeed: 0.32,
    axialTilt: 0.47,
    rotationSpeed: 0.48,
    realDistanceAU: "9.58 AU (1.43B km)",
    orbitalPeriod: "29.45 Earth Years",
    gravity: "10.44 m/s² (1.06 g)",
    meanTemp: "-140°C (1 bar level)",
    atmosphere: "96.3% H2, 3.25% He, CH4 Ice Rings",
    missionLink: "Cassini-Huygens & Dragonfly Titan Rotorcraft",
  },
  {
    id: "uranus",
    name: "Uranus",
    distance: 40.5,
    radius: 1.05,
    orbitSpeed: 0.23,
    axialTilt: 1.71, // 97.8 degrees - rotates on its side!
    rotationSpeed: -0.31,
    realDistanceAU: "19.22 AU (2.87B km)",
    orbitalPeriod: "84.02 Earth Years",
    gravity: "8.69 m/s² (0.89 g)",
    meanTemp: "-195°C (Coldest Planetary Atmosphere)",
    atmosphere: "82.5% H2, 15.2% He, 2.3% CH4",
    missionLink: "Voyager 2 & Future Flagship Uranus Orbiter Probe",
  },
  {
    id: "neptune",
    name: "Neptune",
    distance: 47.0,
    radius: 1.02,
    orbitSpeed: 0.18,
    axialTilt: 0.49,
    rotationSpeed: 0.33,
    realDistanceAU: "30.05 AU (4.50B km)",
    orbitalPeriod: "164.79 Earth Years",
    gravity: "11.15 m/s² (1.14 g)",
    meanTemp: "-200°C (Supersonic Winds 2,100 km/h)",
    atmosphere: "80.0% H2, 19.0% He, 1.5% CH4",
    missionLink: "Voyager 2 Flyby & Triton Cryovolcano Survey",
  },
];

export interface SolarSystemSceneProps {
  selectedPlanetId?: string | null;
  onSelectPlanet?: (id: string | null) => void;
}

export function SolarSystemScene({
  selectedPlanetId: controlledPlanetId,
  onSelectPlanet,
}: SolarSystemSceneProps = {}) {
  const [internalPlanetId, setInternalPlanetId] = useState<string | null>(null);
  const selectedPlanetId = controlledPlanetId !== undefined ? controlledPlanetId : internalPlanetId;

  const handleSelectPlanet = (id: string | null) => {
    setInternalPlanetId(id);
    onSelectPlanet?.(id);
  };

  const handlePointerOver = () => {
    if (typeof document !== "undefined") {
      document.body.style.cursor = "pointer";
    }
  };

  const handlePointerOut = () => {
    if (typeof document !== "undefined") {
      document.body.style.cursor = "auto";
    }
  };

  // References for spinning bodies
  const sunRef = useRef<THREE.Mesh>(null);
  const mercuryRef = useRef<THREE.Group>(null);
  const venusRef = useRef<THREE.Group>(null);
  const earthOrbitGroupRef = useRef<THREE.Group>(null);
  const earthGlobeRef = useRef<THREE.Group>(null);
  const moonRef = useRef<THREE.Mesh>(null);
  const marsRef = useRef<THREE.Group>(null);
  const jupiterRef = useRef<THREE.Group>(null);
  const saturnRef = useRef<THREE.Group>(null);
  const uranusRef = useRef<THREE.Group>(null);
  const neptuneRef = useRef<THREE.Group>(null);
  const asteroidBeltRef = useRef<THREE.Points>(null);

  // Master time accumulation
  const timeRef = useRef<number>(0);

  // Textures
  const sunTex = useMemo(() => getSunTexture(), []);
  const mercuryTex = useMemo(() => getMercuryTexture(), []);
  const venusTex = useMemo(() => getVenusTexture(), []);
  const marsTex = useMemo(() => getMarsTexture(), []);
  const jupiterTex = useMemo(() => getJupiterTexture(), []);
  const saturnTex = useMemo(() => getSaturnTexture(), []);
  const saturnRingTex = useMemo(() => getSaturnRingTexture(), []);
  const uranusTex = useMemo(() => getUranusTexture(), []);
  const neptuneTex = useMemo(() => getNeptuneTexture(), []);

  // Procedural Asteroid Belt Particles (between Mars and Jupiter)
  const asteroidParticles = useMemo(() => {
    const count = 750;
    const positions = new Float32Array(count * 3);
    const colors = new Float32Array(count * 3);
    const innerR = 18.5;
    const outerR = 21.8;

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const radius = innerR + Math.random() * (outerR - innerR);
      const height = (Math.random() - 0.5) * 0.9;

      positions[i * 3] = Math.cos(angle) * radius;
      positions[i * 3 + 1] = height;
      positions[i * 3 + 2] = Math.sin(angle) * radius;

      const shade = 0.5 + Math.random() * 0.4;
      colors[i * 3] = shade * 0.9;
      colors[i * 3 + 1] = shade * 0.85;
      colors[i * 3 + 2] = shade * 0.8;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    return geo;
  }, []);

  // Orbit loop line geometry factory
  const createOrbitGeometry = (dist: number) => {
    const points: THREE.Vector3[] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(theta) * dist, 0, Math.sin(theta) * dist));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  };

  const orbitGeometries = useMemo(() => {
    return PLANETS_CATALOG.filter((p) => p.distance > 0).map((p) => ({
      id: p.id,
      geo: createOrbitGeometry(p.distance),
    }));
  }, []);

  // Animation frame loop: Keplerian orbital positions + Diurnal axial rotations
  useFrame((state, delta) => {
    timeRef.current += delta * 0.35;
    const t = timeRef.current;

    // 1. Sun Rotation
    if (sunRef.current) {
      sunRef.current.rotation.y += delta * 0.08;
    }

    // 2. Mercury
    if (mercuryRef.current) {
      const a = t * 1.6;
      mercuryRef.current.position.set(Math.cos(a) * 5.2, 0, Math.sin(a) * 5.2);
      mercuryRef.current.rotation.y += delta * 0.4;
    }

    // 3. Venus
    if (venusRef.current) {
      const a = t * 1.18;
      venusRef.current.position.set(Math.cos(a) * 8.2, 0, Math.sin(a) * 8.2);
      venusRef.current.rotation.y -= delta * 0.15; // retrograde
    }

    // 4. Earth & Moon
    if (earthOrbitGroupRef.current) {
      const a = t * 1.0;
      earthOrbitGroupRef.current.position.set(Math.cos(a) * 12.0, 0, Math.sin(a) * 12.0);
    }
    if (earthGlobeRef.current) {
      earthGlobeRef.current.rotation.y += delta * 0.5;
    }
    if (moonRef.current) {
      const moonAngle = t * 4.2;
      moonRef.current.position.set(Math.cos(moonAngle) * 1.45, Math.sin(moonAngle) * 0.2, Math.sin(moonAngle) * 1.45);
      moonRef.current.rotation.y += delta * 0.3;
    }

    // 5. Mars
    if (marsRef.current) {
      const a = t * 0.81;
      marsRef.current.position.set(Math.cos(a) * 16.2, 0, Math.sin(a) * 16.2);
      marsRef.current.rotation.y += delta * 0.45;
    }

    // 6. Asteroid belt subtle drift
    if (asteroidBeltRef.current) {
      asteroidBeltRef.current.rotation.y += delta * 0.02;
    }

    // 7. Jupiter
    if (jupiterRef.current) {
      const a = t * 0.43;
      jupiterRef.current.position.set(Math.cos(a) * 24.5, 0, Math.sin(a) * 24.5);
      jupiterRef.current.rotation.y += delta * 0.7;
    }

    // 8. Saturn
    if (saturnRef.current) {
      const a = t * 0.32;
      saturnRef.current.position.set(Math.cos(a) * 33.0, 0, Math.sin(a) * 33.0);
      saturnRef.current.rotation.y += delta * 0.65;
    }

    // 9. Uranus
    if (uranusRef.current) {
      const a = t * 0.23;
      uranusRef.current.position.set(Math.cos(a) * 40.5, 0, Math.sin(a) * 40.5);
      uranusRef.current.rotation.x += delta * 0.4;
    }

    // 10. Neptune
    if (neptuneRef.current) {
      const a = t * 0.18;
      neptuneRef.current.position.set(Math.cos(a) * 47.0, 0, Math.sin(a) * 47.0);
      neptuneRef.current.rotation.y += delta * 0.5;
    }

    // Camera follow / smooth tracking if a planet is selected
    const controls = (state as unknown as { controls?: { target?: THREE.Vector3; update?: () => void } }).controls;
    if (selectedPlanetId) {
      const targetPos = new THREE.Vector3(0, 0, 0);
      const camOffset = new THREE.Vector3(0, 3, 6);

      if (selectedPlanetId === "sun") {
        targetPos.set(0, 0, 0);
        camOffset.set(0, 4, 8);
      } else if (selectedPlanetId === "mercury" && mercuryRef.current) {
        targetPos.copy(mercuryRef.current.position);
        camOffset.set(0, 0.8, 1.8);
      } else if (selectedPlanetId === "venus" && venusRef.current) {
        targetPos.copy(venusRef.current.position);
        camOffset.set(0, 1.2, 2.8);
      } else if (selectedPlanetId === "earth" && earthOrbitGroupRef.current) {
        targetPos.copy(earthOrbitGroupRef.current.position);
        camOffset.set(0, 1.5, 3.2);
      } else if (selectedPlanetId === "mars" && marsRef.current) {
        targetPos.copy(marsRef.current.position);
        camOffset.set(0, 1.1, 2.4);
      } else if (selectedPlanetId === "jupiter" && jupiterRef.current) {
        targetPos.copy(jupiterRef.current.position);
        camOffset.set(0, 3.5, 7.5);
      } else if (selectedPlanetId === "saturn" && saturnRef.current) {
        targetPos.copy(saturnRef.current.position);
        camOffset.set(0, 3.2, 7.0);
      } else if (selectedPlanetId === "uranus" && uranusRef.current) {
        targetPos.copy(uranusRef.current.position);
        camOffset.set(0, 2.2, 5.0);
      } else if (selectedPlanetId === "neptune" && neptuneRef.current) {
        targetPos.copy(neptuneRef.current.position);
        camOffset.set(0, 2.2, 5.0);
      }

      const desiredCamPos = targetPos.clone().add(camOffset);
      state.camera.position.lerp(desiredCamPos, 0.05);
      if (controls && controls.target) {
        controls.target.lerp(targetPos, 0.05);
        controls.update?.();
      } else {
        state.camera.lookAt(targetPos);
      }
    } else {
      if (controls && controls.target) {
        controls.target.lerp(new THREE.Vector3(0, 0, 0), 0.04);
        controls.update?.();
      }
    }
  });

  const selectedData = useMemo(() => {
    return PLANETS_CATALOG.find((p) => p.id === selectedPlanetId);
  }, [selectedPlanetId]);

  return (
    <>
      {/* Deep Space Milky Way Starfield */}
      <Stars radius={120} depth={60} count={6000} factor={4.5} saturation={0.1} fade speed={0.4} />

      {/* Primary Solar Illumination: Omni PointLight from Central Sun */}
      <pointLight position={[0, 0, 0]} intensity={4.5} distance={160} decay={0.8} color="#fff6e5" />
      <ambientLight intensity={0.22} color="#1e293b" />

      {/* 1. CENTRAL SUN (Sol) */}
      <group
        position={[0, 0, 0]}
        onClick={(e) => {
          e.stopPropagation();
          handleSelectPlanet("sun");
        }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <mesh ref={sunRef}>
          <sphereGeometry args={[2.8, 64, 64]} />
          <meshStandardMaterial
            map={sunTex}
            emissive="#ffaa00"
            emissiveMap={sunTex}
            emissiveIntensity={2.8}
            roughness={0.2}
          />
        </mesh>
        {/* Soft Volumetric Solar Corona Halo */}
        <mesh scale={1.22}>
          <sphereGeometry args={[2.8, 32, 32]} />
          <meshBasicMaterial
            color="#ff8800"
            transparent={true}
            opacity={0.28}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
        <mesh scale={1.45}>
          <sphereGeometry args={[2.8, 32, 32]} />
          <meshBasicMaterial
            color="#ff5500"
            transparent={true}
            opacity={0.14}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* Planetary Orbit Lines */}
      {orbitGeometries.map(({ id, geo }) => (
        <primitive
          key={id}
          object={
            new THREE.Line(
              geo,
              new THREE.LineBasicMaterial({
                color: selectedPlanetId === id ? "#38bdf8" : "#334155",
                transparent: true,
                opacity: selectedPlanetId === id ? 0.75 : 0.35,
                linewidth: 1,
              })
            )
          }
        />
      ))}

      {/* 2. MERCURY */}
      <group
        ref={mercuryRef}
        onClick={(e) => {
          e.stopPropagation();
          handleSelectPlanet("mercury");
        }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <mesh rotation={[0.01, 0, 0]}>
          <sphereGeometry args={[0.36, 32, 32]} />
          <meshStandardMaterial map={mercuryTex} roughness={0.9} metalness={0.15} />
        </mesh>
      </group>

      {/* 3. VENUS */}
      <group
        ref={venusRef}
        onClick={(e) => {
          e.stopPropagation();
          handleSelectPlanet("venus");
        }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <mesh rotation={[3.09, 0, 0]}>
          <sphereGeometry args={[0.68, 48, 48]} />
          <meshStandardMaterial map={venusTex} roughness={0.65} metalness={0.05} />
        </mesh>
        {/* Greenhouse Atmosphere Haze */}
        <mesh scale={1.04}>
          <sphereGeometry args={[0.68, 32, 32]} />
          <meshBasicMaterial
            color="#d8c29d"
            transparent={true}
            opacity={0.22}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* 4. EARTH & MOON (LUNA) */}
      <group
        ref={earthOrbitGroupRef}
        onClick={(e) => {
          e.stopPropagation();
          handleSelectPlanet("earth");
        }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        {/* Photorealistic NASA Blue Marble Earth System */}
        <group ref={earthGlobeRef} rotation={[0, 0, 0.41]}>
          <RealisticEarth radius={0.78} rotationSpeed={0.02} sunPosition={[0, 0, 0]} />
        </group>

        {/* Orbiting Moon */}
        <mesh ref={moonRef}>
          <sphereGeometry args={[0.21, 32, 32]} />
          <meshStandardMaterial map={mercuryTex} roughness={0.92} color="#cccccc" />
        </mesh>
      </group>

      {/* 5. MARS */}
      <group
        ref={marsRef}
        onClick={(e) => {
          e.stopPropagation();
          handleSelectPlanet("mars");
        }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <mesh rotation={[0, 0, 0.44]}>
          <sphereGeometry args={[0.48, 48, 48]} />
          <meshStandardMaterial map={marsTex} roughness={0.85} metalness={0.1} />
        </mesh>
        {/* Thin Red Atmosphere Glow */}
        <mesh scale={1.03}>
          <sphereGeometry args={[0.48, 32, 32]} />
          <meshBasicMaterial
            color="#ef4444"
            transparent={true}
            opacity={0.18}
            side={THREE.BackSide}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      </group>

      {/* ASTEROID BELT PARTICLES */}
      <points ref={asteroidBeltRef} geometry={asteroidParticles}>
        <pointsMaterial size={0.08} vertexColors transparent opacity={0.65} sizeAttenuation />
      </points>

      {/* 6. JUPITER & EUROPA */}
      <group
        ref={jupiterRef}
        onClick={(e) => {
          e.stopPropagation();
          handleSelectPlanet("jupiter");
        }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <mesh rotation={[0, 0, 0.05]}>
          <sphereGeometry args={[1.85, 64, 64]} />
          <meshStandardMaterial map={jupiterTex} roughness={0.55} />
        </mesh>
        {/* Europa Moon (Target of Project Europa - Game 03) */}
        <mesh position={[2.6, 0.2, 0]}>
          <sphereGeometry args={[0.18, 24, 24]} />
          <meshStandardMaterial color="#cbd5e1" roughness={0.3} metalness={0.4} />
        </mesh>
        {/* Europa Targeting Reticle */}
        <mesh position={[2.6, 0.2, 0]} scale={1.3}>
          <sphereGeometry args={[0.18, 16, 16]} />
          <meshBasicMaterial color="#38bdf8" wireframe transparent opacity={0.35} />
        </mesh>
      </group>

      {/* 7. SATURN WITH CASSINI RINGS */}
      <group
        ref={saturnRef}
        onClick={(e) => {
          e.stopPropagation();
          handleSelectPlanet("saturn");
        }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <mesh rotation={[0, 0, 0.47]}>
          <sphereGeometry args={[1.55, 64, 64]} />
          <meshStandardMaterial map={saturnTex} roughness={0.6} />
        </mesh>

        {/* Photorealistic Double-Sided Saturn Ring Plane */}
        <mesh rotation={[Math.PI / 2 + 0.47, 0, 0]}>
          <ringGeometry args={[2.0, 3.8, 64]} />
          <meshStandardMaterial
            map={saturnRingTex}
            side={THREE.DoubleSide}
            transparent={true}
            opacity={0.92}
            roughness={0.5}
          />
        </mesh>

        {/* Titan Moon */}
        <mesh position={[4.6, 0.4, 0]}>
          <sphereGeometry args={[0.26, 24, 24]} />
          <meshStandardMaterial color="#fbbf24" roughness={0.7} />
        </mesh>
      </group>

      {/* 8. URANUS WITH FAINT VERTICAL RINGS */}
      <group
        ref={uranusRef}
        onClick={(e) => {
          e.stopPropagation();
          handleSelectPlanet("uranus");
        }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <mesh rotation={[1.71, 0, 0]}>
          <sphereGeometry args={[1.05, 48, 48]} />
          <meshStandardMaterial map={uranusTex} roughness={0.5} />
        </mesh>
        {/* Uranus Tilted Rings */}
        <mesh rotation={[0, Math.PI / 2, 0]}>
          <ringGeometry args={[1.4, 2.1, 48]} />
          <meshStandardMaterial
            color="#a5f3fc"
            side={THREE.DoubleSide}
            transparent={true}
            opacity={0.35}
            roughness={0.8}
          />
        </mesh>
      </group>

      {/* 9. NEPTUNE */}
      <group
        ref={neptuneRef}
        onClick={(e) => {
          e.stopPropagation();
          handleSelectPlanet("neptune");
        }}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <mesh rotation={[0, 0, 0.49]}>
          <sphereGeometry args={[1.02, 48, 48]} />
          <meshStandardMaterial map={neptuneTex} roughness={0.5} />
        </mesh>
      </group>

      {/* Interactive Selection HUD overlay rendered in HTML via Drei if clicked */}
    </>
  );
}

/**
 * Planetary Telemetry Inspector HUD Pill & Card Component
 * Displayed when user inspects the Solar System
 */
export function SolarSystemInspectorHUD({
  selectedPlanet,
  onSelectPlanet,
  onResetView,
  style,
}: {
  selectedPlanet: PlanetaryData | null;
  onSelectPlanet: (id: string) => void;
  onResetView: () => void;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "10px",
        pointerEvents: "auto",
        zIndex: 50,
        maxWidth: "960px",
        width: "100%",
        ...style,
      }}
    >
      {/* Planetary Quick-Selector Toolbar */}
      <div
        style={{
          display: "flex",
          gap: "6px",
          backgroundColor: "rgba(10, 14, 22, 0.88)",
          padding: "6px 12px",
          borderRadius: "8px",
          border: "1px solid rgba(56, 189, 248, 0.35)",
          boxShadow: "0 8px 32px rgba(0, 0, 0, 0.85), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
          backdropFilter: "blur(12px)",
          flexWrap: "wrap",
          justifyContent: "center",
        }}
      >
        <button
          onClick={onResetView}
          style={{
            padding: "4px 10px",
            fontSize: "11px",
            fontWeight: 700,
            backgroundColor: selectedPlanet === null ? "rgba(56, 189, 248, 0.3)" : "transparent",
            border: selectedPlanet === null ? "1px solid #38bdf8" : "1px solid transparent",
            color: selectedPlanet === null ? "#ffffff" : "#94a3b8",
            borderRadius: "4px",
            cursor: "pointer",
            fontFamily: "monospace",
          }}
        >
          [ORRERY OVERVIEW]
        </button>

        {PLANETS_CATALOG.map((planet) => {
          const isSelected = selectedPlanet?.id === planet.id;
          return (
            <button
              key={planet.id}
              onClick={() => onSelectPlanet(planet.id)}
              style={{
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 700,
                backgroundColor: isSelected ? "rgba(56, 189, 248, 0.3)" : "rgba(255, 255, 255, 0.05)",
                border: isSelected ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.08)",
                color: isSelected ? "#38bdf8" : "#cbd5e1",
                borderRadius: "4px",
                cursor: "pointer",
                fontFamily: "monospace",
                transition: "all 0.15s ease",
              }}
            >
              {planet.name.split(" ")[0]}
            </button>
          );
        })}
      </div>

      {/* Selected Planet Deep NASA Telemetry Card */}
      {selectedPlanet && (
        <div
          style={{
            width: "100%",
            backgroundColor: "rgba(10, 14, 22, 0.94)",
            border: "1.5px solid #38bdf8",
            borderRadius: "8px",
            padding: "14px 20px",
            boxShadow: "0 12px 40px rgba(0, 0, 0, 0.95), 0 0 25px rgba(56, 189, 248, 0.25)",
            backdropFilter: "blur(16px)",
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr 1.5fr",
            gap: "16px",
            fontSize: "11px",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          <div>
            <div style={{ color: "#38bdf8", fontWeight: 800, fontSize: "14px", marginBottom: "4px" }}>
              {selectedPlanet.name}
            </div>
            <div style={{ color: "#94a3b8" }}>
              Distance: <strong style={{ color: "#ffffff" }}>{selectedPlanet.realDistanceAU}</strong>
            </div>
            <div style={{ color: "#94a3b8" }}>
              Orbit Period: <strong style={{ color: "#ffffff" }}>{selectedPlanet.orbitalPeriod}</strong>
            </div>
          </div>

          <div>
            <div style={{ color: "#94a3b8", textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.08em" }}>
              Surface Physics
            </div>
            <div style={{ color: "#94a3b8", marginTop: "4px" }}>
              Gravity: <strong style={{ color: "#22c55e" }}>{selectedPlanet.gravity}</strong>
            </div>
            <div style={{ color: "#94a3b8" }}>
              Mean Temp: <strong style={{ color: "#fbbf24" }}>{selectedPlanet.meanTemp}</strong>
            </div>
          </div>

          <div>
            <div style={{ color: "#94a3b8", textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.08em" }}>
              Atmosphere / Envelope
            </div>
            <div style={{ color: "#e2e8f0", marginTop: "4px", lineHeight: 1.4 }}>
              {selectedPlanet.atmosphere}
            </div>
          </div>

          <div style={{ borderLeft: "1px solid rgba(255, 255, 255, 0.12)", paddingLeft: "16px" }}>
            <div style={{ color: "#38bdf8", textTransform: "uppercase", fontSize: "10px", letterSpacing: "0.08em" }}>
              Mission Connection &amp; NASA Program
            </div>
            <div style={{ color: "#f8fafc", marginTop: "4px", fontWeight: 600, lineHeight: 1.4 }}>
              {selectedPlanet.missionLink}
            </div>
            <div style={{ marginTop: "6px" }}>
              <button
                onClick={onResetView}
                style={{
                  fontSize: "10px",
                  color: "#94a3b8",
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                &larr; Return to System Overview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
