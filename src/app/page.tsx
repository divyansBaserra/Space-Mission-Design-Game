"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { SpacecraftViewport } from "@/components/viewport";
import { GameManager } from "@/game/GameManager";
import AegisGameManager from "@/game/aegis/AegisGameManager";
import EuropaGameManager from "@/game/europa/EuropaGameManager";
import { soundManager } from "@/game/audio";
import { preloadAllGameAssets } from "@/game/useNASAModel";
import {
  DESTINATION_PRESETS,
  GROUND_STATION_PRESETS,
  DEFAULT_SCIENCE_REQUIREMENTS,
  MissionDestinationId,
} from "@/engine/simulation/missionConfig";
import {
  OrbitSimulator,
  calculateOrbitSummary,
} from "@/engine/simulation/orbitSimulator";
import {
  FormFactor,
  getCdsMaxMass,
} from "@/engine/standards/cdsStandards";
import {
  kilometers,
  seconds,
  julianDate,
  toKilograms,
} from "@/engine/simulation/simUnits";

// ============================================================================
// Game Progression & Contract Architecture
// ============================================================================

type GameStage =
  | "FIRST_PERSON_GAME"
  | "FLIGHT_SIM_GAME"
  | "HANGAR_GAME"
  | "PROJECT_AEGIS_GAME"
  | "PROJECT_EUROPA_GAME"
  | "MAIN_MENU"
  | "MISSION_SELECT"
  | "MISSION_BRIEFING"
  | "WORKSHOP"
  | "LAUNCH_PREP"
  | "SPACE_GAMEPLAY"
  | "MISSION_DEBRIEF"
  | "MANUAL";

type SupportedFormFactor = "1U" | "3U" | "6U";
type SpacecraftOperatingMode = "SCIENCE" | "CONSERVE" | "COMMS_PRIORITY" | "SAFE_MODE";

interface MissionContract {
  readonly id: MissionDestinationId;
  readonly code: string;
  readonly title: string;
  readonly agency: string;
  readonly orbitType: string;
  readonly difficulty: "Standard" | "Challenging" | "Advanced" | "Master";
  readonly difficultyStars: string;
  readonly altitudeKm: number;
  readonly inclinationDeg: number;
  readonly periodMin: number;
  readonly eclipseMin: number;
  readonly scienceTargetMb: number;
  readonly narrative: string;
  readonly objectives: readonly string[];
  readonly bonusObjectives: readonly string[];
  readonly requiredCareerScore: number;
  readonly rewardCredits: number;
}

const MISSION_CONTRACTS: readonly MissionContract[] = [
  {
    id: "LEO_SSO_600KM",
    code: "ARC-600",
    title: "Solar Guardian: Climate Sentinel",
    agency: "NASA Earth Science Division",
    orbitType: "LEO-SSO",
    difficulty: "Standard",
    difficultyStars: "★☆☆☆☆",
    altitudeKm: 600,
    inclinationDeg: 97.79,
    periodMin: 96.6,
    eclipseMin: 35.2,
    scienceTargetMb: 500,
    narrative:
      "A massive solar maximum demands continuous global multispectral Earth observing from Sun-Synchronous Orbit. You must deliver 500 Mb of science telemetry while surviving 15 deep-umbra eclipses under strict Cal Poly CDS Rev 14.1 deployment inhibits.",
    objectives: [
      "Downlink ≥ 500.0 Mb multispectral science data",
      "Survive 15 full operational orbits without battery blackout",
      "Honor 30-min solar deployment & 45-min RF quiet inhibits",
      "Maintain JPL CML-4 dry mass margin ≥ 35.0%",
    ],
    bonusObjectives: [
      "Zero autonomous Safe Mode triggers (+150 pts)",
      "Downlink ≥ 120% target science data (+200 pts)",
      "Peak battery Depth-of-Discharge < 20% (+150 pts)",
    ],
    requiredCareerScore: 0,
    rewardCredits: 1000,
  },
  {
    id: "LEO_ISS_400KM",
    code: "ISS-400",
    title: "Station Runner: Edge Computing",
    agency: "NASA Space Technology Directorate",
    orbitType: "ISS-LEO",
    difficulty: "Challenging",
    difficultyStars: "★★☆☆☆",
    altitudeKm: 400,
    inclinationDeg: 51.64,
    periodMin: 92.5,
    eclipseMin: 35.8,
    scienceTargetMb: 350,
    narrative:
      "Airlock-deployed into a 400 km co-orbit from the International Space Station. Range safety enforces 3 independent electrical inhibits. Dense mid-latitude passes demand rapid, high-rate telecom link acquisition.",
    objectives: [
      "Downlink ≥ 350.0 Mb edge-computed science data",
      "Maintain positive power margin during rapid 92-minute orbit cycles",
      "Survive upper atmospheric drag without bus voltage collapse",
    ],
    bonusObjectives: [
      "Achieve telecom link closure with ≥ 8.0 dB margin (+100 pts)",
      "Maintain CML-4 dry mass margin ≥ 40.0% (+150 pts)",
    ],
    requiredCareerScore: 800,
    rewardCredits: 1400,
  },
  {
    id: "POLAR_700KM",
    code: "POL-700",
    title: "Aurora Sounder: Magnetic Storms",
    agency: "NOAA Space Weather Prediction Center",
    orbitType: "POLAR",
    difficulty: "Advanced",
    difficultyStars: "★★★☆☆",
    altitudeKm: 700,
    inclinationDeg: 90.0,
    periodMin: 98.7,
    eclipseMin: 34.8,
    scienceTargetMb: 800,
    narrative:
      "High-latitude polar orbit traversing Earth's auroral cusps. Extreme radiation flux triggers Single Event Upsets; requires active Flight Director power management during solar storms and frequent Svalbard SG3 downlinks.",
    objectives: [
      "Downlink ≥ 800.0 Mb geomagnetic and plasma sensor data",
      "Manage SEU radiation alarms and preserve memory buffer",
      "Survive 15 polar orbits under fluctuating thermal extremes",
    ],
    bonusObjectives: [
      "Stream high-rate downlink during every Svalbard pass (+200 pts)",
      "Zero solid-state memory buffer overflows (+150 pts)",
    ],
    requiredCareerScore: 1800,
    rewardCredits: 2000,
  },
  {
    id: "GEO_STATIONARY",
    code: "GEO-36000",
    title: "Deep Space Horizon: Corona Watch",
    agency: "ESA & NASA Heliophysics Fleet",
    orbitType: "GEO",
    difficulty: "Master",
    difficultyStars: "★★★★☆",
    altitudeKm: 35786,
    inclinationDeg: 0.0,
    periodMin: 1436.1,
    eclipseMin: 0.0,
    scienceTargetMb: 1200,
    narrative:
      "Geostationary equatorial orbit at 35,786 km. Continuous 24-hour solar line-of-sight eliminates night eclipse, but 36,000 km path loss demands high-gain microwave telecom, large structural allowance, and stationkeeping propulsion.",
    objectives: [
      "Downlink ≥ 1,200.0 Mb deep space solar coronal telemetry",
      "Close RF link at 35,786 km range (link margin ≥ 6.0 dB)",
      "Provide active propulsion delta-V capability for stationkeeping",
    ],
    bonusObjectives: [
      "Downlink ≥ 1,500.0 Mb continuous telemetry (+250 pts)",
      "Execute orbital delta-V stationkeeping burn (+200 pts)",
    ],
    requiredCareerScore: 3200,
    rewardCredits: 3000,
  },
];

// Subsystem Catalogs
interface ChassisOption {
  readonly id: SupportedFormFactor;
  readonly name: string;
  readonly dimensions: string;
  readonly maxMassKg: number;
  readonly structuralMassKg: number;
  readonly busHousekeepingPowerW: number;
  readonly costCredits: number;
}

const CHASSIS_CATALOG: readonly ChassisOption[] = [
  {
    id: "1U",
    name: "1U CubeSat Chassis",
    dimensions: "10 × 10 × 10 cm",
    maxMassKg: 2.0,
    structuralMassKg: 0.35,
    busHousekeepingPowerW: 2.0,
    costCredits: 250,
  },
  {
    id: "3U",
    name: "3U CubeSat Baseline",
    dimensions: "10 × 10 × 30 cm",
    maxMassKg: 4.0,
    structuralMassKg: 0.85,
    busHousekeepingPowerW: 3.5,
    costCredits: 500,
  },
  {
    id: "6U",
    name: "6U CubeSat Heavy",
    dimensions: "10 × 20 × 30 cm",
    maxMassKg: 12.0,
    structuralMassKg: 1.80,
    busHousekeepingPowerW: 6.0,
    costCredits: 950,
  },
];

interface SolarArrayOption {
  readonly id: "BODY_MOUNTED" | "SINGLE_WING" | "DUAL_WING";
  readonly name: string;
  readonly powerWatts: number;
  readonly massKg: number;
  readonly areaM2: number;
  readonly costCredits: number;
  readonly description: string;
}

const SOLAR_CATALOG: readonly SolarArrayOption[] = [
  {
    id: "BODY_MOUNTED",
    name: "Body-Mounted GaAs Cells",
    powerWatts: 8.0,
    massKg: 0.15,
    areaM2: 0.015,
    costCredits: 180,
    description: "Tumble-proof; 0 deployment risk; low generation",
  },
  {
    id: "SINGLE_WING",
    name: "Deployable 1-Wing Array",
    powerWatts: 28.0,
    massKg: 0.42,
    areaM2: 0.060,
    costCredits: 420,
    description: "Standard LEO balance; requires 30m deploy inhibit",
  },
  {
    id: "DUAL_WING",
    name: "Deployable 2-Wing Array",
    powerWatts: 56.0,
    massKg: 0.78,
    areaM2: 0.120,
    costCredits: 780,
    description: "High-power science baseline; full sun illumination",
  },
];

interface BatteryOption {
  readonly id: string;
  readonly name: string;
  readonly capacityWh: number;
  readonly massKg: number;
  readonly costCredits: number;
  readonly description: string;
}

const BATTERY_CATALOG: readonly BatteryOption[] = [
  {
    id: "BATT_20WH",
    name: "20 Wh Li-Ion (UL 1642)",
    capacityWh: 20.0,
    massKg: 0.22,
    costCredits: 160,
    description: "Ultralight; high DoD risk in 35m eclipse",
  },
  {
    id: "BATT_40WH",
    name: "40 Wh Li-Ion Spacepack",
    capacityWh: 40.0,
    massKg: 0.38,
    costCredits: 320,
    description: "Standard baseline for 3U LEO operations",
  },
  {
    id: "BATT_80WH",
    name: "80 Wh High-Capacity Pack",
    capacityWh: 80.0,
    massKg: 0.72,
    costCredits: 580,
    description: "Deep discharge endurance for active sensors",
  },
  {
    id: "BATT_120WH",
    name: "120 Wh Extended Storage",
    capacityWh: 120.0,
    massKg: 1.05,
    costCredits: 820,
    description: "Maximum energy reserve for heavy radar/6U",
  },
];

interface PayloadOption {
  readonly id: "IMAGER" | "PLASMA" | "LIDAR" | "RADAR";
  readonly name: string;
  readonly powerWatts: number;
  readonly massKg: number;
  readonly dataRateMbps: number;
  readonly costCredits: number;
  readonly description: string;
}

const PAYLOAD_CATALOG: readonly PayloadOption[] = [
  {
    id: "IMAGER",
    name: "Multispectral UV/IR Imager",
    powerWatts: 8.0,
    massKg: 0.60,
    dataRateMbps: 50,
    costCredits: 600,
    description: "Earth surface observing & vegetation mapping",
  },
  {
    id: "PLASMA",
    name: "Plasma Probe & Magnetometer",
    powerWatts: 3.0,
    massKg: 0.25,
    dataRateMbps: 5,
    costCredits: 350,
    description: "Low-power ionosphere space weather sensing",
  },
  {
    id: "LIDAR",
    name: "Topographic Laser Altimeter",
    powerWatts: 18.0,
    massKg: 1.40,
    dataRateMbps: 80,
    costCredits: 900,
    description: "High-precision surface elevation profiling",
  },
  {
    id: "RADAR",
    name: "Mini Synthetic Aperture Radar",
    powerWatts: 26.0,
    massKg: 2.20,
    dataRateMbps: 120,
    costCredits: 1200,
    description: "All-weather surface penetration & radar mapping",
  },
];

interface PropulsionOption {
  readonly id: "NONE" | "COLD_GAS" | "HYDRAZINE" | "ELECTROSPRAY";
  readonly name: string;
  readonly ispSeconds: number;
  readonly dryMassKg: number;
  readonly propMassKg: number;
  readonly thrustN: number;
  readonly costCredits: number;
  readonly description: string;
}

const PROPULSION_CATALOG: readonly PropulsionOption[] = [
  {
    id: "NONE",
    name: "No Propulsion (Passive Decay)",
    ispSeconds: 0,
    dryMassKg: 0.0,
    propMassKg: 0.0,
    thrustN: 0,
    costCredits: 0,
    description: "Zero propulsive ΔV; passive atmospheric drag disposal",
  },
  {
    id: "COLD_GAS",
    name: "Cold Gas N2 Thruster",
    ispSeconds: 65,
    dryMassKg: 0.40,
    propMassKg: 0.30,
    thrustN: 0.1,
    costCredits: 350,
    description: "Safe non-toxic stationkeeping (~60 m/s ΔV)",
  },
  {
    id: "HYDRAZINE",
    name: "Green Monopropellant",
    ispSeconds: 220,
    dryMassKg: 0.70,
    propMassKg: 0.80,
    thrustN: 1.0,
    costCredits: 750,
    description: "High thrust orbit maneuvers (~340 m/s ΔV)",
  },
  {
    id: "ELECTROSPRAY",
    name: "Electrospray Micro-Ion Thruster",
    ispSeconds: 1200,
    dryMassKg: 0.50,
    propMassKg: 0.25,
    thrustN: 0.001,
    costCredits: 850,
    description: "Ultra-efficient drag compensation (~460 m/s ΔV)",
  },
];

interface TelecomOption {
  readonly id: "UHF" | "SBAND" | "XBAND";
  readonly name: string;
  readonly rfPowerWatts: number;
  readonly dcPowerWatts: number;
  readonly massKg: number;
  readonly dataRateKbps: number;
  readonly gainDbi: number;
  readonly costCredits: number;
  readonly description: string;
}

const TELECOM_CATALOG: readonly TelecomOption[] = [
  {
    id: "UHF",
    name: "UHF Deployable Whip (435 MHz)",
    rfPowerWatts: 0.5,
    dcPowerWatts: 2.0,
    massKg: 0.15,
    dataRateKbps: 9.6,
    gainDbi: 0.0,
    costCredits: 150,
    description: "Low power telemetry beacon; slow science transfer",
  },
  {
    id: "SBAND",
    name: "S-Band Patch Antenna (2.2 GHz)",
    rfPowerWatts: 2.0,
    dcPowerWatts: 10.0,
    massKg: 0.25,
    dataRateKbps: 1000,
    gainDbi: 6.0,
    costCredits: 400,
    description: "Standard high-rate payload downlink",
  },
  {
    id: "XBAND",
    name: "X-Band High-Gain Dish (8.4 GHz)",
    rfPowerWatts: 5.0,
    dcPowerWatts: 22.0,
    massKg: 0.55,
    dataRateKbps: 10000,
    gainDbi: 12.0,
    costCredits: 800,
    description: "High-throughput downlink for imagery & radar",
  },
];

interface TelemetryLogEntry {
  readonly id: string;
  readonly metFormatted: string;
  readonly text: string;
  readonly level: "nominal" | "caution" | "critical" | "telemetry";
}

interface CareerSaveData {
  careerScore: number;
  credits: number;
  completedContracts: string[];
  medalsEarned: string[];
}

function NasaJudgesGithubBanner({ inline = false }: { inline?: boolean }) {
  return (
    <a
      href="https://github.com/divyansBaserra/Space-Mission-Design-Game"
      target="_blank"
      rel="noopener noreferrer"
      style={{
        position: inline ? "relative" : "fixed",
        top: inline ? undefined : "14px",
        right: inline ? undefined : "24px",
        zIndex: inline ? 10 : 999999,
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "8px 16px",
        background: "linear-gradient(135deg, rgba(9, 13, 22, 0.98) 0%, rgba(17, 24, 39, 0.95) 100%)",
        border: "1.5px solid #38bdf8",
        borderRadius: "6px",
        boxShadow: "0 0 20px rgba(56, 189, 248, 0.45), 0 8px 32px rgba(0, 0, 0, 0.9), inset 0 1px 0 rgba(255, 255, 255, 0.2)",
        textDecoration: "none",
        pointerEvents: "auto",
        backdropFilter: "blur(12px)",
        cursor: "pointer",
        flexShrink: 0,
        transition: "all 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = "scale(1.04)";
        e.currentTarget.style.borderColor = "#67e8f9";
        e.currentTarget.style.boxShadow = "0 0 45px rgba(56, 189, 248, 0.8), 0 12px 40px rgba(0, 0, 0, 0.95)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = "scale(1)";
        e.currentTarget.style.borderColor = "#38bdf8";
        e.currentTarget.style.boxShadow = "0 0 25px rgba(56, 189, 248, 0.55), 0 8px 32px rgba(0, 0, 0, 0.9)";
      }}
    >
      {/* Telemetry Status Cluster */}
      <div style={{ display: "flex", flexDirection: "column", gap: "2px", borderRight: "1px solid rgba(255, 255, 255, 0.15)", paddingRight: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#22c55e", boxShadow: "0 0 10px #22c55e" }} />
          <span style={{ fontSize: "10px", fontWeight: 800, color: "#22c55e", letterSpacing: "0.12em", fontFamily: "monospace" }}>
            NASA EVALUATION
          </span>
        </div>
        <span style={{ fontSize: "9px", color: "#f59e0b", fontWeight: 700, letterSpacing: "0.08em", fontFamily: "monospace" }}>
          OFFICIAL SUBMISSION
        </span>
      </div>

      {/* GitHub Octocat Icon Box */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "36px", height: "36px", borderRadius: "6px", backgroundColor: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.3)" }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#38bdf8">
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
        </svg>
      </div>

      {/* Main Action Header & Subtitle */}
      <div style={{ display: "flex", flexDirection: "column", textAlign: "left" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "14px", fontWeight: 800, color: "#ffffff", letterSpacing: "0.05em" }}>
            INSPECT CODEBASE ON GITHUB
          </span>
          <span style={{ fontSize: "14px", color: "#38bdf8", fontWeight: 800 }}>&rarr;</span>
        </div>
        <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 500, letterSpacing: "0.04em", fontFamily: "monospace" }}>
          NASA Space Apps 2026 // Next.js + Three.js // MIT License
        </span>
      </div>
    </a>
  );
}

// ============================================================================
// Main Space Mission Design Game Component
// ============================================================================

export default function SpaceMissionGame() {
  // Navigation Stage: Boot into Main Menu (Cinematic Interstellar Vista)
  const [stage, setStage] = useState<GameStage>("MAIN_MENU");
  const [viewMode, setViewMode] = useState<"SPACECRAFT" | "ORBIT">("SPACECRAFT");
  const [mainMenuCosmicMode, setMainMenuCosmicMode] = useState<"BLACK_HOLE" | "ORBIT">("BLACK_HOLE");
  const [workshopActiveTab, setWorkshopActiveTab] = useState<"CHASSIS" | "SOLAR" | "BATTERY" | "PAYLOAD" | "PROPULSION" | "TELECOM">("CHASSIS");
  const [solarArrayDeployedInHangar, setSolarArrayDeployedInHangar] = useState<boolean>(true);
  const [hangarThrusterActive, setHangarThrusterActive] = useState<boolean>(false);
  const [hangarEclipseActive, setHangarEclipseActive] = useState<boolean>(false);
  const [contractFilter, setContractFilter] = useState<"ALL" | "LEO" | "POLAR" | "GEO">("ALL");
  const [showHangarGuide, setShowHangarGuide] = useState<boolean>(true);
  const [showWelcomeGuide, setShowWelcomeGuide] = useState<boolean>(false);
  const [showConsoleFeed, setShowConsoleFeed] = useState<boolean>(false);
  const [mainMenuOrbitProgress, setMainMenuOrbitProgress] = useState<number>(0.25);

  // Career Progress
  const [careerScore, setCareerScore] = useState<number>(0);
  const [careerCredits, setCareerCredits] = useState<number>(3000);
  const [completedContracts, setCompletedContracts] = useState<string[]>([]);
  const [medalsEarned, setMedalsEarned] = useState<string[]>([]);

  // Selected Active Contract
  const [activeContractId, setActiveContractId] = useState<MissionDestinationId>("LEO_SSO_600KM");

  // Spacecraft Architecture Configuration
  const [formFactor, setFormFactor] = useState<SupportedFormFactor>("3U");
  const [solarArray, setSolarArray] = useState<"BODY_MOUNTED" | "SINGLE_WING" | "DUAL_WING">("SINGLE_WING");
  const [batteryId, setBatteryId] = useState<string>("BATT_40WH");
  const [payloadId, setPayloadId] = useState<"IMAGER" | "PLASMA" | "LIDAR" | "RADAR">("IMAGER");
  const [propulsionId, setPropulsionId] = useState<"NONE" | "COLD_GAS" | "HYDRAZINE" | "ELECTROSPRAY">("NONE");
  const [telecomId, setTelecomId] = useState<"UHF" | "SBAND" | "XBAND">("SBAND");

  // Launch Sequence State
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);
  const [launchStageMessage, setLaunchStageMessage] = useState<string>("");

  // Live Simulation Interactive Gameplay State
  const [simRunning, setSimRunning] = useState<boolean>(false);
  const [simSpeed, setSimSpeed] = useState<number>(20);
  const [simMetSeconds, setSimMetSeconds] = useState<number>(0);
  const [orbitCount, setOrbitCount] = useState<number>(0);
  const [inEclipse, setInEclipse] = useState<boolean>(false);
  const [currentAltitudeKm, setCurrentAltitudeKm] = useState<number>(600);
  const [currentVelocityKmS, setCurrentVelocityKmS] = useState<number>(7.56);
  const [solarArrayDeployed, setSolarArrayDeployed] = useState<boolean>(false);
  const [rfQuietExpired, setRfQuietExpired] = useState<boolean>(false);
  const [operatingMode, setOperatingMode] = useState<SpacecraftOperatingMode>("SCIENCE");
  const [safeModeActive, setSafeModeActive] = useState<boolean>(false);
  const [safeModeTriggerCount, setSafeModeTriggerCount] = useState<number>(0);
  const [fatalBlackout, setFatalBlackout] = useState<boolean>(false);
  const [batteryEnergyWh, setBatteryEnergyWh] = useState<number>(40);
  const [batteryDodPercent, setBatteryDodPercent] = useState<number>(0);
  const [peakBatteryDodPercent, setPeakBatteryDodPercent] = useState<number>(0);
  const [temperatureCelsius, setTemperatureCelsius] = useState<number>(18.0);
  const [minTempCelsius, setMinTempCelsius] = useState<number>(18.0);
  const [maxTempCelsius, setMaxTempCelsius] = useState<number>(18.0);
  const [activeGroundStation, setActiveGroundStation] = useState<string | null>(null);
  const [dataBufferMb, setDataBufferMb] = useState<number>(0);
  const [dataDownlinkedMb, setDataDownlinkedMb] = useState<number>(0);
  const [orbitProgress, setOrbitProgress] = useState<number>(0);
  const [propellantRemainingKg, setPropellantRemainingKg] = useState<number>(0);
  const [thrusterActive, setThrusterActive] = useState<boolean>(false);
  const [solarFlareActive, setSolarFlareActive] = useState<boolean>(false);
  const [telemetryLogs, setTelemetryLogs] = useState<readonly TelemetryLogEntry[]>([]);

  const logContainerRef = useRef<HTMLDivElement>(null);

  // Load persistent save data on mount with defensive schema sanitization and preload assets
  useEffect(() => {
    preloadAllGameAssets();
    try {
      const saved = localStorage.getItem("smdg_career_data");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (
          typeof parsed === "object" &&
          parsed !== null &&
          !Array.isArray(parsed)
        ) {
          if (
            typeof parsed.careerScore === "number" &&
            Number.isFinite(parsed.careerScore) &&
            parsed.careerScore >= 0
          ) {
            setCareerScore(Math.floor(parsed.careerScore));
          }
          if (
            typeof parsed.credits === "number" &&
            Number.isFinite(parsed.credits) &&
            parsed.credits >= 0
          ) {
            setCareerCredits(Math.floor(parsed.credits));
          }
          if (Array.isArray(parsed.completedContracts)) {
            const cleanContracts = parsed.completedContracts
              .filter((c: unknown): c is string => typeof c === "string")
              .slice(0, 50);
            setCompletedContracts(cleanContracts);
          }
          if (Array.isArray(parsed.medalsEarned)) {
            const cleanMedals = parsed.medalsEarned
              .filter((m: unknown): m is string => typeof m === "string")
              .slice(0, 50);
            setMedalsEarned(cleanMedals);
          }
        }
      }
    } catch {
      // Ignore corrupted or tampered localStorage data
    }
  }, []);

  // Save persistent data
  const saveCareer = useCallback(
    (newScore: number, newCredits: number, newContracts: string[], newMedals: string[]) => {
      try {
        const data: CareerSaveData = {
          careerScore: newScore,
          credits: newCredits,
          completedContracts: newContracts,
          medalsEarned: newMedals,
        };
        localStorage.setItem("smdg_career_data", JSON.stringify(data));
      } catch {
        // Ignore
      }
    },
    []
  );

  // Main menu orbit progress baseline (R3F useFrame handles 60 FPS celestial rotation smoothly without React re-renders)

  // One-Click Engineering Presets for Workshop / Hangar
  const handleApplyPreset = (preset: "BALANCED_3U" | "DEEP_SPACE_6U" | "MINIMALIST_1U") => {
    soundManager.playEquip();
    if (preset === "BALANCED_3U") {
      setFormFactor("3U");
      setSolarArray("SINGLE_WING");
      setBatteryId("BATT_40WH");
      setPayloadId("IMAGER");
      setPropulsionId("NONE");
      setTelecomId("SBAND");
    } else if (preset === "DEEP_SPACE_6U") {
      setFormFactor("6U");
      setSolarArray("DUAL_WING");
      setBatteryId("BATT_80WH");
      setPayloadId("RADAR");
      setPropulsionId("HYDRAZINE");
      setTelecomId("XBAND");
    } else if (preset === "MINIMALIST_1U") {
      setFormFactor("1U");
      setSolarArray("BODY_MOUNTED");
      setBatteryId("BATT_20WH");
      setPayloadId("PLASMA");
      setPropulsionId("NONE");
      setTelecomId("UHF");
    }
  };

  // Active Contract Lookup
  const contract = useMemo(
    () => MISSION_CONTRACTS.find((c) => c.id === activeContractId) ?? MISSION_CONTRACTS[0],
    [activeContractId]
  );
  const activeChassis = useMemo(
    () => CHASSIS_CATALOG.find((c) => c.id === formFactor) ?? CHASSIS_CATALOG[1],
    [formFactor]
  );
  const activeSolar = useMemo(
    () => SOLAR_CATALOG.find((s) => s.id === solarArray) ?? SOLAR_CATALOG[1],
    [solarArray]
  );
  const activeBattery = useMemo(
    () => BATTERY_CATALOG.find((b) => b.id === batteryId) ?? BATTERY_CATALOG[1],
    [batteryId]
  );
  const activePayload = useMemo(
    () => PAYLOAD_CATALOG.find((p) => p.id === payloadId) ?? PAYLOAD_CATALOG[0],
    [payloadId]
  );
  const activePropulsion = useMemo(
    () => PROPULSION_CATALOG.find((pr) => pr.id === propulsionId) ?? PROPULSION_CATALOG[0],
    [propulsionId]
  );
  const activeTelecom = useMemo(
    () => TELECOM_CATALOG.find((t) => t.id === telecomId) ?? TELECOM_CATALOG[1],
    [telecomId]
  );

  // ============================================================================
  // Live Engineering Budget Calculations (JPL CML 4 Compliance)
  // ============================================================================

  // 1. Mass Budget
  const avionicsMassKg = formFactor === "1U" ? 0.25 : formFactor === "3U" ? 0.55 : 0.90;
  const dryMassCbeKg =
    activeChassis.structuralMassKg +
    avionicsMassKg +
    activeSolar.massKg +
    activeBattery.massKg +
    activePayload.massKg +
    activePropulsion.dryMassKg +
    activeTelecom.massKg;

  // Mass Growth Allowance (15% for CML 4)
  const mgaKg = dryMassCbeKg * 0.15;
  const dryMassMevKg = dryMassCbeKg + mgaKg;
  const wetMassKg = dryMassMevKg + activePropulsion.propMassKg;
  const cdsLimitKg = activeChassis.maxMassKg;
  const dryMassMarginPercent = ((cdsLimitKg - dryMassMevKg) / cdsLimitKg) * 100;
  const massCompliant = dryMassMarginPercent >= 0;
  const massMarginNominal = dryMassMarginPercent >= 35.0;

  // 2. Cost Budget
  const totalCostCredits =
    activeChassis.costCredits +
    activeSolar.costCredits +
    activeBattery.costCredits +
    activePayload.costCredits +
    activePropulsion.costCredits +
    activeTelecom.costCredits;
  const budgetCompliant = careerCredits >= totalCostCredits;

  // 3. Power Balance
  const platformHousekeepingW = activeChassis.busHousekeepingPowerW;
  const totalNominalLoadW = platformHousekeepingW + activePayload.powerWatts;
  const solarGenWatts = activeSolar.powerWatts;
  const powerMarginPercent = ((solarGenWatts - totalNominalLoadW) / solarGenWatts) * 100;
  const powerPositive = solarGenWatts > totalNominalLoadW;

  // 4. Eclipse Battery Depth-of-Discharge (DoD)
  const eclipseDurationHours = contract.eclipseMin / 60.0;
  const energyConsumedDuringEclipseWh = totalNominalLoadW * eclipseDurationHours;
  const estimatedEclipseDodPercent = (energyConsumedDuringEclipseWh / activeBattery.capacityWh) * 100;
  const dodNominal = estimatedEclipseDodPercent <= 25.0;
  const dodSafeModeRisk = estimatedEclipseDodPercent > 70.0;
  const dodFatalRisk = estimatedEclipseDodPercent >= 100.0;

  // 5. Telecom Link Margin
  const distanceKm = Math.sqrt(
    Math.pow(contract.altitudeKm, 2) + Math.pow(contract.altitudeKm * 0.8, 2)
  );
  const baseFreqGhz = activeTelecom.id === "UHF" ? 0.435 : activeTelecom.id === "SBAND" ? 2.2 : 8.4;
  const fsplDb = 20 * Math.log10(distanceKm) + 20 * Math.log10(baseFreqGhz * 1000) + 32.44;
  const estimatedLinkMarginDb = Math.max(
    -12.0,
    Math.min(22.0, 10 * Math.log10(activeTelecom.rfPowerWatts) + activeTelecom.gainDbi + 18.0 - (fsplDb - 150))
  );
  const linkMarginNominal = estimatedLinkMarginDb >= 6.0;

  // 6. Available ΔV (Tsiolkovsky)
  const availableDeltaVMps =
    activePropulsion.ispSeconds > 0 && activePropulsion.propMassKg > 0
      ? activePropulsion.ispSeconds * 9.80665 * Math.log(wetMassKg / (wetMassKg - activePropulsion.propMassKg))
      : 0;

  // Launch Gate Readiness
  const launchReady =
    massCompliant &&
    !dodFatalRisk &&
    (powerPositive || contract.eclipseMin === 0) &&
    budgetCompliant;

  // Telemetry Logger
  const addLog = useCallback(
    (text: string, level: "nominal" | "caution" | "critical" | "telemetry" = "nominal", metSec?: number) => {
      const met = metSec !== undefined ? metSec : simMetSeconds;
      const hrs = Math.floor(met / 3600).toString().padStart(2, "0");
      const mins = Math.floor((met % 3600) / 60).toString().padStart(2, "0");
      const secs = Math.floor(met % 60).toString().padStart(2, "0");
      const metFormatted = `${hrs}:${mins}:${secs}`;
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      setTelemetryLogs((prev) => [...prev.slice(-120), { id, metFormatted, text, level }]);
    },
    [simMetSeconds]
  );

  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [telemetryLogs]);

  // ============================================================================
  // Interactive Launch Sequence & Countdown Engine
  // ============================================================================

  const startLaunchSequence = () => {
    setStage("LAUNCH_PREP");
    setCountdownSeconds(10);
    setLaunchStageMessage("Initiating terminal flight readiness poll...");
  };

  useEffect(() => {
    if (stage !== "LAUNCH_PREP" || countdownSeconds === null) return;

    if (countdownSeconds > 0) {
      const timer = setTimeout(() => {
        setCountdownSeconds((sec) => {
          if (sec === null) return null;
          const next = sec - 1;
          if (next === 7) setLaunchStageMessage("Telemetry locks confirmed. Range safety armed.");
          if (next === 4) setLaunchStageMessage("Main engine ignition sequence start.");
          if (next === 1) setLaunchStageMessage("All engines at full thrust. Liftoff!");
          if (next === 0) setLaunchStageMessage("Dispenser separation confirmed! Spacecraft entering orbit.");
          return next;
        });
      }, 1000);
      return () => clearTimeout(timer);
    } else {
      // Countdown complete: transition directly to orbit simulation!
      const timer = setTimeout(() => {
        setCountdownSeconds(null);
        handleEnterOrbitSimulation();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [stage, countdownSeconds]);

  const handleEnterOrbitSimulation = () => {
    // Deduct credits
    setCareerCredits((prev) => Math.max(0, prev - totalCostCredits));

    setStage("SPACE_GAMEPLAY");
    setViewMode("ORBIT");
    setSimRunning(true);
    setSimMetSeconds(0);
    setOrbitCount(0);
    setSolarArrayDeployed(false);
    setRfQuietExpired(false);
    setOperatingMode("SCIENCE");
    setSafeModeActive(false);
    setSafeModeTriggerCount(0);
    setFatalBlackout(false);
    setBatteryEnergyWh(activeBattery.capacityWh);
    setBatteryDodPercent(0);
    setPeakBatteryDodPercent(0);
    setTemperatureCelsius(18.0);
    setMinTempCelsius(18.0);
    setMaxTempCelsius(18.0);
    setDataBufferMb(0);
    setDataDownlinkedMb(0);
    setOrbitProgress(0);
    setCurrentAltitudeKm(contract.altitudeKm);
    setPropellantRemainingKg(activePropulsion.propMassKg);
    setThrusterActive(false);
    setSolarFlareActive(false);

    setTelemetryLogs([
      {
        id: "l1",
        metFormatted: "00:00:00",
        text: `Orbital insertion confirmed: ${contract.title} (${contract.code}) in ${contract.orbitType}.`,
        level: "nominal",
      },
      {
        id: "l2",
        metFormatted: "00:00:00",
        text: `P-POD dispenser separation switch released. Hardware inhibits armed (CDS Rev 14.1 §2.4.4 & §2.4.5).`,
        level: "telemetry",
      },
      {
        id: "l3",
        metFormatted: "00:00:00",
        text: `Post-separation timers active: 30-min solar deployment inhibit, 45-min RF quiet period.`,
        level: "telemetry",
      },
    ]);
  };

  // Player Command: Manual Deploy Solar Arrays
  const handleDeploySolarArrays = () => {
    if (simMetSeconds < 1800) {
      soundManager.playWarningBeep();
      addLog("REJECTED: Solar deployment blocked - CDS Rev 14.1 30-minute inhibit still active.", "caution");
      return;
    }
    soundManager.playGearDeploy();
    setSolarArrayDeployed(true);
    addLog("MANUAL COMMAND: Solar array wings deployed and oriented toward Sun vector.", "nominal");
  };

  // Player Command: Orbital Delta-V Burn
  const handleExecuteBurn = () => {
    if (propellantRemainingKg <= 0.02) {
      soundManager.playWarningBeep();
      addLog("THRUST REJECTED: Propellant exhausted. Zero delta-V remaining.", "caution");
      return;
    }

    soundManager.playEngineRoar();
    setThrusterActive(true);
    setPropellantRemainingKg((prev) => Math.max(0, prev - 0.05));
    setCurrentAltitudeKm((alt) => alt + 14.5);
    setCurrentVelocityKmS((vel) => Number((vel + 0.04).toFixed(3)));
    setCareerScore((s) => s + 75);
    addLog("ORBITAL MANEUVER: Main thruster fired! Apogee +14.5 km, ΔV +40 m/s confirmed nominal (+75 XP).", "nominal");

    setTimeout(() => {
      setThrusterActive(false);
    }, 2000);
  };

  // Player Command: Manual AOS High-Rate Telemetry Downlink Burst
  const handleManualTelemetryDownlink = () => {
    if (dataBufferMb <= 0.1) {
      soundManager.playWarningBeep();
      addLog("DOWNLINK STANDBY: Sensor buffer empty. Capture Earth snapshot or run payload first.", "caution");
      return;
    }

    soundManager.playBeaconChime();
    const packetSizeMb = Math.min(dataBufferMb, activeGroundStation ? 60.0 : 30.0);
    setDataBufferMb((buf) => Math.max(0, buf - packetSizeMb));
    setDataDownlinkedMb((dl) => dl + packetSizeMb);
    setCareerCredits((c) => c + Math.round(packetSizeMb * 3.5));
    addLog(
      `AOS TELEMETRY BURST: Downlinked ${packetSizeMb.toFixed(1)} Mb telemetry${activeGroundStation ? ` to [${activeGroundStation}]` : ""}. Earned +${Math.round(packetSizeMb * 3.5)} Cr!`,
      "nominal"
    );
  };

  // Player Command: Manual Optical/Radar Earth Snapshot
  const handleCaptureEarthSnapshot = () => {
    if (operatingMode === "CONSERVE") {
      soundManager.playWarningBeep();
      addLog("SENSOR INHIBITED: Cannot image in Conserve Mode. Switch to Science Mode first.", "caution");
      return;
    }

    soundManager.playPickup();
    const scienceGeneratedMb = activePayload.id === "RADAR" ? 45.0 : activePayload.id === "LIDAR" ? 35.0 : 25.0;
    setDataBufferMb((buf) => Math.min(2048, buf + scienceGeneratedMb));
    setCareerScore((s) => s + 40);
    addLog(
      `ORBITAL SENSOR TRIGGER: ${activePayload.name} captured multispectral swath (+${scienceGeneratedMb.toFixed(1)} Mb science data, +40 XP).`,
      "nominal"
    );
  };

  // Player Command: Orbital Retrograde Burn (-ΔV, lower orbit)
  const handleRetrogradeBurn = () => {
    if (propellantRemainingKg <= 0.02) {
      soundManager.playWarningBeep();
      addLog("THRUST REJECTED: Propellant exhausted. Zero delta-V remaining.", "caution");
      return;
    }

    soundManager.playEngineRoar();
    setThrusterActive(true);
    setPropellantRemainingKg((prev) => Math.max(0, prev - 0.05));
    setCurrentAltitudeKm((alt) => Math.max(180, alt - 14.5));
    setCurrentVelocityKmS((vel) => Number(Math.max(6.5, vel - 0.04).toFixed(3)));
    setCareerScore((s) => s + 75);
    addLog("ORBITAL MANEUVER: Retrograde thruster fired! Perigee -14.5 km, braking delta-V applied (+75 XP).", "nominal");

    setTimeout(() => {
      setThrusterActive(false);
    }, 2000);
  };

  // Player Command: Auto-Orient Solar Panels to Sun Vector
  const handleSunTracking = () => {
    soundManager.playPickup();
    addLog("ATTITUDE ORIENTATION: Solar arrays locked to Sun vector (+15% solar recharge rate).", "nominal");
    if (!inEclipse) {
      setBatteryEnergyWh((wh) => Math.min(activeBattery.capacityWh, wh + 2.5));
    }
  };

  // Keyboard Event Handler for Interactive 3D Workshop (PUBG/Armored Core style shortcuts)
  useEffect(() => {
    if (stage !== "WORKSHOP") return;

    const handleWorkshopKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === "KeyL" && launchReady) {
        e.preventDefault();
        soundManager.playEngineRoar();
        startLaunchSequence();
      } else if (e.code === "KeyF") {
        e.preventDefault();
        soundManager.playGearDeploy();
        setSolarArrayDeployedInHangar((prev) => !prev);
      } else if (e.code === "KeyR" && propulsionId !== "NONE") {
        e.preventDefault();
        soundManager.playThrusterPuff();
        setHangarThrusterActive(true);
        setTimeout(() => setHangarThrusterActive(false), 2000);
      } else if (e.code === "KeyE") {
        e.preventDefault();
        soundManager.playFlashlight();
        setHangarEclipseActive((prev) => !prev);
      } else if (e.code === "Digit1") {
        e.preventDefault();
        soundManager.playEquip();
        setWorkshopActiveTab("CHASSIS");
      } else if (e.code === "Digit2") {
        e.preventDefault();
        soundManager.playEquip();
        setWorkshopActiveTab("SOLAR");
      } else if (e.code === "Digit3") {
        e.preventDefault();
        soundManager.playEquip();
        setWorkshopActiveTab("BATTERY");
      } else if (e.code === "Digit4") {
        e.preventDefault();
        soundManager.playEquip();
        setWorkshopActiveTab("PAYLOAD");
      } else if (e.code === "Digit5") {
        e.preventDefault();
        soundManager.playEquip();
        setWorkshopActiveTab("PROPULSION");
      } else if (e.code === "Digit6") {
        e.preventDefault();
        soundManager.playEquip();
        setWorkshopActiveTab("TELECOM");
      }
    };

    window.addEventListener("keydown", handleWorkshopKeyDown);
    return () => window.removeEventListener("keydown", handleWorkshopKeyDown);
  }, [stage, launchReady, propulsionId]);

  // Keyboard Event Handler for Active 3D Flight Simulation
  useEffect(() => {
    if (stage !== "SPACE_GAMEPLAY") return;

    const handleSpaceKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.code === "KeyW" || e.code === "ArrowUp") {
        e.preventDefault();
        handleExecuteBurn();
      } else if (e.code === "KeyS" || e.code === "ArrowDown") {
        e.preventDefault();
        handleRetrogradeBurn();
      } else if (e.code === "Digit1") {
        e.preventDefault();
        if (!safeModeActive && !fatalBlackout) {
          soundManager.playEquip();
          setOperatingMode("SCIENCE");
          addLog("KEY COMMAND [1]: Science Mode active.", "nominal");
        }
      } else if (e.code === "Digit2") {
        e.preventDefault();
        if (!safeModeActive && !fatalBlackout) {
          soundManager.playEquip();
          setOperatingMode("CONSERVE");
          addLog("KEY COMMAND [2]: Conserve Mode active.", "caution");
        }
      } else if (e.code === "Digit3") {
        e.preventDefault();
        if (!safeModeActive && !fatalBlackout) {
          soundManager.playEquip();
          setOperatingMode("COMMS_PRIORITY");
          addLog("KEY COMMAND [3]: Comms Priority active.", "nominal");
        }
      } else if (e.code === "KeyT") {
        e.preventDefault();
        handleManualTelemetryDownlink();
      } else if (e.code === "KeyR") {
        e.preventDefault();
        handleSunTracking();
      } else if (e.code === "Space") {
        e.preventDefault();
        handleCaptureEarthSnapshot();
      } else if (e.code === "KeyC") {
        e.preventDefault();
        soundManager.playEquip();
        setViewMode((prev) => (prev === "ORBIT" ? "SPACECRAFT" : "ORBIT"));
      }
    };

    window.addEventListener("keydown", handleSpaceKeyDown);
    return () => window.removeEventListener("keydown", handleSpaceKeyDown);
  }, [
    stage,
    safeModeActive,
    fatalBlackout,
    propellantRemainingKg,
    thrusterActive,
    dataBufferMb,
    activeGroundStation,
    operatingMode,
    viewMode,
    inEclipse,
    activeBattery.capacityWh,
  ]);

  // Live Simulation Clock Tick Loop
  useEffect(() => {
    if (stage !== "SPACE_GAMEPLAY" || !simRunning || fatalBlackout) {
      return;
    }

    const intervalMs = 200;
    const timer = setInterval(() => {
      setSimMetSeconds((prevMet) => {
        const dtSeconds = (intervalMs / 1000.0) * simSpeed;
        const nextMet = prevMet + dtSeconds;

        const periodSec = contract.periodMin * 60.0;
        const currentProgress = (nextMet % periodSec) / periodSec;
        setOrbitProgress(currentProgress);
        setOrbitCount(Math.floor(nextMet / periodSec));

        // Eclipse Geometry
        const eclipseSec = contract.eclipseMin * 60.0;
        const eclipseFraction = eclipseSec / periodSec;
        const isInEclipseNow =
          contract.eclipseMin > 0 &&
          currentProgress >= 0.5 - eclipseFraction / 2 &&
          currentProgress <= 0.5 + eclipseFraction / 2;

        setInEclipse(isInEclipseNow);

        // Milestone Inhibit Timers
        if (prevMet < 1800 && nextMet >= 1800) {
          setSolarArrayDeployed(true);
          addLog("CDS Rev 14.1 §2.4.4: 30-minute inhibit expired. Solar arrays automatically deployed.", "nominal", 1800);
        }

        if (prevMet < 2700 && nextMet >= 2700) {
          setRfQuietExpired(true);
          addLog("CDS Rev 14.1 §2.4.5: 45-minute RF quiet period expired. Transmitters active.", "nominal", 2700);
        }

        // Stochastic Solar Flare Challenge at MET 2.5 hrs
        if (prevMet < 9000 && nextMet >= 9000) {
          setSolarFlareActive(true);
          addLog("ALERT: NOAA reports energetic Solar Flare proton flux. Switch to CONSERVE mode to prevent SEU memory corruption.", "caution", 9000);
        }
        if (prevMet < 12600 && nextMet >= 12600 && solarFlareActive) {
          setSolarFlareActive(false);
          addLog("Space weather update: Proton flux returned to quiet baseline.", "nominal", 12600);
        }

        // Ground Station Contact Tracking (Wallops WFF, Svalbard SG3, Goldstone GDS)
        const inPassWindow =
          (currentProgress >= 0.06 && currentProgress <= 0.13) ||
          (currentProgress >= 0.68 && currentProgress <= 0.75);
        const stationName = currentProgress < 0.5 ? "Svalbard SG3" : "Wallops WFF";

        if (inPassWindow && nextMet >= 2700) {
          setActiveGroundStation(stationName);
        } else {
          setActiveGroundStation(null);
        }

        // Subsystem Power Balance & Energy Drain
        const isArrayOpen = nextMet >= 1800 || activeSolar.id === "BODY_MOUNTED";
        let rawSolarW = isInEclipseNow ? 0 : isArrayOpen ? activeSolar.powerWatts : activeSolar.powerWatts * 0.2;
        if (solarFlareActive && isArrayOpen) {
          rawSolarW *= 0.88;
        }

        setBatteryEnergyWh((prevEnergy) => {
          let currentLoadW = platformHousekeepingW;

          // Mode-specific power consumption (Meaningful player decision!)
          if (operatingMode === "SAFE_MODE" || safeModeActive) {
            currentLoadW = 2.0;
          } else if (operatingMode === "CONSERVE") {
            currentLoadW = platformHousekeepingW;
          } else if (operatingMode === "COMMS_PRIORITY") {
            currentLoadW = platformHousekeepingW + (inPassWindow ? activeTelecom.dcPowerWatts : 0);
          } else {
            currentLoadW = platformHousekeepingW + activePayload.powerWatts;
            if (inPassWindow && nextMet >= 2700) {
              currentLoadW += activeTelecom.dcPowerWatts;
            }
          }

          const netPowerW = rawSolarW - currentLoadW;
          const dtHours = dtSeconds / 3600.0;
          let nextEnergyWh = prevEnergy;

          if (netPowerW >= 0) {
            nextEnergyWh = Math.min(activeBattery.capacityWh, prevEnergy + netPowerW * dtHours * 0.95);
          } else {
            nextEnergyWh = prevEnergy + (netPowerW * dtHours) / 0.95;
          }

          const currentDod = Math.max(0, ((activeBattery.capacityWh - nextEnergyWh) / activeBattery.capacityWh) * 100);
          setBatteryDodPercent(currentDod);
          setPeakBatteryDodPercent((prevPeak) => Math.max(prevPeak, currentDod));

          // Autonomous Safe Mode Trigger
          if (!safeModeActive && currentDod >= 70.0) {
            setSafeModeActive(true);
            setSafeModeTriggerCount((c) => c + 1);
            setOperatingMode("SAFE_MODE");
            addLog(`CRITICAL: Battery DoD reached ${currentDod.toFixed(1)}% (≥70%). Autonomous SAFE MODE engaged; payload shed.`, "critical", nextMet);
          } else if (safeModeActive && currentDod <= 15.0) {
            setSafeModeActive(false);
            setOperatingMode("SCIENCE");
            addLog(`RECOVERY: Battery recharged to ${(100 - currentDod).toFixed(1)}% SoC. Resumed nominal operations.`, "nominal", nextMet);
          }

          // Fatal Blackout Check
          if (nextEnergyWh <= 0.05) {
            setFatalBlackout(true);
            setSimRunning(false);
            addLog("MISSION LOSS: Complete battery depletion. Total electrical blackout.", "critical", nextMet);
            return 0;
          }

          return Math.max(0, nextEnergyWh);
        });

        // Thermal Dynamics
        setTemperatureCelsius((prevTemp) => {
          let targetTemp = isInEclipseNow ? -14.0 : 26.0;
          if (operatingMode === "CONSERVE" || safeModeActive) targetTemp -= 4.0;
          const nextTemp = prevTemp + (targetTemp - prevTemp) * Math.min(1.0, (dtSeconds / 600.0));
          setMinTempCelsius((min) => Math.min(min, nextTemp));
          setMaxTempCelsius((max) => Math.max(max, nextTemp));
          return nextTemp;
        });

        // Science Telemetry Collection & Downlink
        if (!safeModeActive && operatingMode === "SCIENCE" && nextMet >= 1800) {
          const generatedMb = (activePayload.dataRateMbps * dtSeconds) / 8.0;
          setDataBufferMb((prev) => Math.min(2048, prev + generatedMb));
        }

        if (inPassWindow && nextMet >= 2700 && !safeModeActive) {
          const multiplier = operatingMode === "COMMS_PRIORITY" ? 1.5 : 1.0;
          const downlinkRateMbS = (activeTelecom.dataRateKbps * multiplier) / 1000.0;
          const downlinkMb = Math.min(dataBufferMb, (downlinkRateMbS * dtSeconds) / 8.0);
          if (downlinkMb > 0) {
            setDataBufferMb((prev) => Math.max(0, prev - downlinkMb));
            setDataDownlinkedMb((prev) => prev + downlinkMb);
          }
        }

        // Automatic completion when 15 operational orbits are reached
        if (Math.floor(nextMet / periodSec) >= 15) {
          setSimRunning(false);
          addLog("Target 15 orbits completed. Flight operations nominal. Ready for mission debrief.", "nominal", nextMet);
        }

        return nextMet;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [
    stage,
    simRunning,
    fatalBlackout,
    simSpeed,
    contract,
    activeSolar,
    activeBattery,
    activePayload,
    activeTelecom,
    platformHousekeepingW,
    operatingMode,
    safeModeActive,
    solarFlareActive,
    dataBufferMb,
    addLog,
  ]);

  const formatMet = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600).toString().padStart(2, "0");
    const mins = Math.floor((totalSec % 3600) / 60).toString().padStart(2, "0");
    const secs = Math.floor(totalSec % 60).toString().padStart(2, "0");
    return `${hrs}:${mins}:${secs}`;
  };

  // End Mission & Score Calculation
  const handleEndMission = () => {
    setSimRunning(false);
    setStage("MISSION_DEBRIEF");

    const targetMb = contract.scienceTargetMb;
    const sciencePct = Math.min(100, (dataDownlinkedMb / targetMb) * 100);

    let earnedScore = 0;
    const earnedMedals: string[] = [];

    if (!fatalBlackout) {
      earnedScore += Math.floor(sciencePct * 10);
      if (dryMassMarginPercent >= 35) earnedScore += 200;
      if (peakBatteryDodPercent <= 25) earnedScore += 150;
      if (safeModeTriggerCount === 0) {
        earnedScore += 150;
        earnedMedals.push("Zero Safe Mode");
      }
      if (sciencePct >= 100) {
        earnedMedals.push("Contract Fulfilled");
      }
      if (sciencePct >= 120) {
        earnedMedals.push("Data Torrent");
      }
      if (peakBatteryDodPercent <= 20) {
        earnedMedals.push("Power Master");
      }

      const newCompleted = Array.from(new Set([...completedContracts, contract.id]));
      const newTotalScore = careerScore + earnedScore;
      const newCredits = careerCredits + contract.rewardCredits;
      const newMedals = Array.from(new Set([...medalsEarned, ...earnedMedals]));

      setCareerScore(newTotalScore);
      setCareerCredits(newCredits);
      setCompletedContracts(newCompleted);
      setMedalsEarned(newMedals);
      saveCareer(newTotalScore, newCredits, newCompleted, newMedals);
    }
  };

  const scienceTargetMb = contract.scienceTargetMb;
  const scienceCompletionPercent = Math.min(100, (dataDownlinkedMb / scienceTargetMb) * 100);

  let missionGrade: "GRADE A+" | "GRADE A" | "GRADE B" | "GRADE C" | "GRADE F" = "GRADE B";
  let gradeStatusDot = "status-dot-nominal";
  let gradeSummary = "";

  if (fatalBlackout) {
    missionGrade = "GRADE F";
    gradeStatusDot = "status-dot-critical";
    gradeSummary = "Mission Loss: Complete battery exhaustion occurred during Earth eclipse umbra.";
  } else if (
    scienceCompletionPercent >= 100 &&
    safeModeTriggerCount === 0 &&
    peakBatteryDodPercent < 25 &&
    dryMassMarginPercent >= 35
  ) {
    missionGrade = "GRADE A+";
    gradeStatusDot = "status-dot-nominal";
    gradeSummary = "Exceptional Flight: All primary and bonus objectives exceeded with verified JPL CML 4 design margins.";
  } else if (scienceCompletionPercent >= 90 && peakBatteryDodPercent < 35 && dryMassMarginPercent >= 35) {
    missionGrade = "GRADE A";
    gradeStatusDot = "status-dot-nominal";
    gradeSummary = "Optimal Flight: Science objectives fulfilled cleanly within operational tolerances.";
  } else if (scienceCompletionPercent >= 70 && peakBatteryDodPercent < 60) {
    missionGrade = "GRADE B";
    gradeStatusDot = "status-dot-nominal";
    gradeSummary = "Successful Flight: Primary mission objectives completed with manageable subsystem degradation.";
  } else if (scienceCompletionPercent >= 30) {
    missionGrade = "GRADE C";
    gradeStatusDot = "status-dot-caution";
    gradeSummary = "Partial Success: Data yield was curtailed by safe-mode load shedding or power deficits.";
  } else {
    missionGrade = "GRADE F";
    gradeStatusDot = "status-dot-critical";
    gradeSummary = "Mission Failure: Insufficient scientific data downlinked or subsystem failure.";
  }

  // ============================================================================
  // STAGE 0: FIRST-PERSON 3D BROWSER GAME (Orbital Outpost Gateway-1)
  // ============================================================================
  if (stage === "FIRST_PERSON_GAME") {
    return (
      <main style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", backgroundColor: "#06080c" }}>
        <GameManager gameMode="ORBITAL_REPAIR" onReturnToHub={() => setStage("MAIN_MENU")} onLaunchAegis={() => setStage("PROJECT_AEGIS_GAME")} onLaunchEuropa={() => setStage("PROJECT_EUROPA_GAME")} />
      </main>
    );
  }

  // ============================================================================
  // STAGE 0B: 3D PILOTED FLIGHT SIMULATOR (Shuttle ORV-1 6-DOF Flight Sim)
  // ============================================================================
  if (stage === "FLIGHT_SIM_GAME") {
    return (
      <main style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", backgroundColor: "#06080c" }}>
        <GameManager gameMode="FLIGHT_SIM" onReturnToHub={() => setStage("MAIN_MENU")} onLaunchAegis={() => setStage("PROJECT_AEGIS_GAME")} onLaunchEuropa={() => setStage("PROJECT_EUROPA_GAME")} />
      </main>
    );
  }

  // ============================================================================
  // STAGE 0C: 3D SPACECRAFT CONSTRUCTION HANGAR & ASSEMBLY SANDBOX
  // ============================================================================
  if (stage === "HANGAR_GAME") {
    return (
      <main style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", backgroundColor: "#06080c" }}>
        <GameManager gameMode="HANGAR_SANDBOX" onReturnToHub={() => setStage("MAIN_MENU")} onLaunchAegis={() => setStage("PROJECT_AEGIS_GAME")} onLaunchEuropa={() => setStage("PROJECT_EUROPA_GAME")} />
      </main>
    );
  }

  // ============================================================================
  // STAGE 0D: GAME 02 - PROJECT AEGIS (HYPERVELOCITY DART DEFLECTION)
  // ============================================================================
  if (stage === "PROJECT_AEGIS_GAME") {
    return (
      <main style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", backgroundColor: "#040608" }}>
        <AegisGameManager onReturnToHub={() => setStage("MAIN_MENU")} />
      </main>
    );
  }

  // ============================================================================
  // STAGE 0E: GAME 03 - PROJECT EUROPA (ABYSS OF JUPITER)
  // ============================================================================
  if (stage === "PROJECT_EUROPA_GAME") {
    return (
      <main style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", backgroundColor: "#020408" }}>
        <EuropaGameManager onReturnToHub={() => setStage("MAIN_MENU")} />
      </main>
    );
  }

  // ============================================================================
  // STAGE 1: MAIN MENU (Cinematic Space Game Entry Screen)
  // ============================================================================
  if (stage === "MAIN_MENU") {
    return (
      <main style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", backgroundColor: "#06080c" }}>
        {/* Fullscreen 3D Celestial Background Viewport (Interstellar Black Hole or Blue Marble Earth) */}
        <div style={{ position: "absolute", inset: 0, zIndex: 1 }}>
          <SpacecraftViewport
            busSize="3U"
            viewMode={mainMenuCosmicMode}
            solarArrayType="DUAL_WING"
            solarArrayDeployed={true}
            payloadType="IMAGER"
            antennaType="SBAND"
            hasPropulsion={true}
            thrusterActive={false}
            isEclipse={false}
            orbitAltitudeKm={600}
            orbitProgress={mainMenuOrbitProgress}
          />
        </div>

        {/* Foreground Minimalist Game UI Overlay */}
        <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", height: "100%", padding: "var(--space-6) var(--space-8)", justifyContent: "space-between", pointerEvents: "none", overflowY: "auto" }}>
          {/* Top Bar with Integrated Non-Overlapping Layout */}
          <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", pointerEvents: "auto", flexWrap: "wrap", gap: "16px", width: "100%", marginBottom: "16px" }}>
            {/* Left Header: Title + Celestial Vista Switcher */}
            <div style={{ display: "flex", alignItems: "center", gap: "20px", flexWrap: "wrap" }}>
              <div>
                <div className="font-mono" style={{ fontSize: "11px", color: "var(--color-status-telemetry)", letterSpacing: "0.15em", textTransform: "uppercase", fontWeight: 700 }}>
                  NASA Space Apps 2026 // Orbital Engineering
                </div>
                <h1 style={{ fontSize: "var(--text-2xl)", fontWeight: 700, letterSpacing: "-0.02em", color: "#f8fafc", marginTop: "2px" }}>
                  SPACE MISSION DESIGN GAME
                </h1>
              </div>

              {/* Celestial Vista Switcher */}
              <div style={{ display: "flex", gap: "4px", backgroundColor: "rgba(15, 23, 42, 0.85)", padding: "4px", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "4px", backdropFilter: "blur(8px)" }}>
                <button
                  onClick={() => {
                    setMainMenuCosmicMode("BLACK_HOLE");
                    soundManager.playEquip();
                  }}
                  style={{
                    padding: "6px 12px",
                    fontSize: "11px",
                    fontWeight: 700,
                    backgroundColor: mainMenuCosmicMode === "BLACK_HOLE" ? "rgba(245, 158, 11, 0.25)" : "transparent",
                    border: mainMenuCosmicMode === "BLACK_HOLE" ? "1px solid #f59e0b" : "1px solid transparent",
                    color: mainMenuCosmicMode === "BLACK_HOLE" ? "#fbbf24" : "#94a3b8",
                    borderRadius: "2px",
                    cursor: "pointer",
                    letterSpacing: "0.04em",
                  }}
                  title="Interstellar-style Gravitational Lensing Black Hole with Relativistic Accretion Disk"
                >
                  GARGANTUA BLACK HOLE
                </button>
                <button
                  onClick={() => {
                    setMainMenuCosmicMode("ORBIT");
                    soundManager.playEquip();
                  }}
                  style={{
                    padding: "6px 12px",
                    fontSize: "11px",
                    fontWeight: 700,
                    backgroundColor: mainMenuCosmicMode === "ORBIT" ? "rgba(2, 132, 199, 0.25)" : "transparent",
                    border: mainMenuCosmicMode === "ORBIT" ? "1px solid #38bdf8" : "1px solid transparent",
                    color: mainMenuCosmicMode === "ORBIT" ? "#38bdf8" : "#94a3b8",
                    borderRadius: "2px",
                    cursor: "pointer",
                    letterSpacing: "0.04em",
                  }}
                  title="Photorealistic Blue Marble Earth with Rayleigh Scattering"
                >
                  EARTH BLUE MARBLE
                </button>
              </div>
            </div>

            {/* Right Header: Career Telemetry + Embedded Inline NASA GitHub Banner */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", gap: "var(--space-3)", backgroundColor: "rgba(12, 14, 18, 0.85)", padding: "8px 14px", border: "1px solid var(--color-border-subtle)", borderRadius: "4px", backdropFilter: "blur(8px)" }}>
                <div style={{ fontSize: "12px" }}>
                  <span style={{ color: "var(--color-text-muted)" }}>Level: </span>
                  <strong className="font-mono" style={{ color: "var(--color-text-primary)" }}>{Math.floor(careerScore / 1000) + 1}</strong>
                </div>
                <div style={{ width: "1px", height: "14px", backgroundColor: "var(--color-border-default)" }} />
                <div style={{ fontSize: "12px" }}>
                  <span style={{ color: "var(--color-text-muted)" }}>Score: </span>
                  <strong className="font-mono" style={{ color: "var(--color-text-primary)" }}>{careerScore.toLocaleString()} pts</strong>
                </div>
                <div style={{ width: "1px", height: "14px", backgroundColor: "var(--color-border-default)" }} />
                <div style={{ fontSize: "12px" }}>
                  <span style={{ color: "var(--color-text-muted)" }}>Budget: </span>
                  <strong className="font-mono" style={{ color: "var(--color-status-nominal)" }}>{careerCredits.toLocaleString()} Cr</strong>
                </div>
              </div>

              {/* Seamless Inline NASA Evaluation GitHub Banner */}
              <NasaJudgesGithubBanner inline={true} />
            </div>
          </header>

          {/* Center / Left Main Menu Actions */}
          <div style={{ maxWidth: "440px", display: "flex", flexDirection: "column", gap: "var(--space-3)", pointerEvents: "auto" }}>
            {/* Mission Intel & How to Play Button */}
            <button
              onClick={() => {
                soundManager.playEquip();
                setShowWelcomeGuide(true);
              }}
              style={{
                padding: "12px 18px",
                backgroundColor: "rgba(14, 165, 233, 0.2)",
                border: "1px solid #38bdf8",
                color: "#38bdf8",
                fontWeight: 700,
                fontSize: "12px",
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderRadius: "3px",
                cursor: "pointer",
                backdropFilter: "blur(8px)",
                letterSpacing: "0.04em",
                boxShadow: "0 0 15px rgba(56, 189, 248, 0.2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "14px" }}>ℹ</span>
                <span>HOW TO PLAY &amp; MISSION MODES GUIDE</span>
              </div>
              <span style={{ fontSize: "12px", fontWeight: 700, backgroundColor: "#0284c7", color: "#ffffff", padding: "2px 8px", borderRadius: "2px" }}>[OPEN GUIDE]</span>
            </button>

            <button
              onClick={() => {
                soundManager.playEquip();
                setStage("FIRST_PERSON_GAME");
              }}
              style={{
                padding: "16px 20px",
                backgroundColor: "rgba(2, 132, 199, 0.25)",
                border: "1px solid #38bdf8",
                color: "#38bdf8",
                fontWeight: 700,
                fontSize: "var(--text-sm)",
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transition: "all var(--duration-fast)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 4px 20px rgba(56, 189, 248, 0.15)",
                cursor: "pointer",
              }}
            >
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>1. PLAY GAME 01: OPERATION ARTEMIS-VII</div>
                <div style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 500, marginTop: "2px" }}>Gateway-1 Orbital Facility &amp; Shackleton Lunar Touchdown</div>
              </div>
              <span style={{ fontSize: "18px" }}>→</span>
            </button>

            <button
              onClick={() => {
                soundManager.playEquip();
                setStage("PROJECT_AEGIS_GAME");
              }}
              style={{
                padding: "16px 20px",
                backgroundColor: "rgba(180, 83, 9, 0.25)",
                border: "1px solid #f59e0b",
                color: "#f59e0b",
                fontWeight: 700,
                fontSize: "var(--text-sm)",
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transition: "all var(--duration-fast)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 4px 20px rgba(245, 158, 11, 0.2)",
                cursor: "pointer",
              }}
            >
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>2. PLAY GAME 02: PROJECT AEGIS (DART DEFLECTION)</div>
                <div style={{ fontSize: "11px", color: "#fbbf24", fontWeight: 500, marginTop: "2px" }}>Mars Oberth Slingshot · SMART Nav · 6.2 km/s Kinetic Impact</div>
              </div>
              <span style={{ fontSize: "18px" }}>→</span>
            </button>

            <button
              onClick={() => {
                soundManager.playEquip();
                setStage("PROJECT_EUROPA_GAME");
              }}
              style={{
                padding: "16px 20px",
                backgroundColor: "rgba(14, 165, 233, 0.25)",
                border: "1px solid #38bdf8",
                color: "#38bdf8",
                fontWeight: 700,
                fontSize: "var(--text-sm)",
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                transition: "all var(--duration-fast)",
                backdropFilter: "blur(8px)",
                boxShadow: "0 4px 20px rgba(56, 189, 248, 0.2)",
                cursor: "pointer",
              }}
            >
              <div>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "#ffffff" }}>3. PLAY GAME 03: PROJECT EUROPA (ABYSS OF JUPITER)</div>
                <div style={{ fontSize: "11px", color: "#7dd3fc", fontWeight: 500, marginTop: "2px" }}>900°C Cryo-Melt Probe · 130 MPa Abyssal Submarine · Alien RNA Discovery</div>
              </div>
              <span style={{ fontSize: "18px" }}>→</span>
            </button>

            <button
              onClick={() => {
                soundManager.playEquip();
                setStage("MANUAL");
              }}
              style={{
                padding: "14px 20px",
                backgroundColor: "rgba(15, 23, 42, 0.85)",
                border: "1px solid rgba(255, 255, 255, 0.15)",
                color: "var(--color-text-secondary)",
                fontSize: "var(--text-xs)",
                fontWeight: 500,
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backdropFilter: "blur(8px)",
                cursor: "pointer",
              }}
            >
              <div>
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#f8fafc" }}>4. FLIGHT ACADEMY &amp; REFERENCE MANUAL</div>
                <div style={{ fontSize: "10px", color: "var(--color-text-muted)", marginTop: "2px" }}>CDS Standards, Telecom Link Budgets, JPL Margins</div>
              </div>
              <span>→</span>
            </button>

            {/* NASA Evaluators Direct Code Link Button */}
            <a
              href="https://github.com/divyansBaserra/Space-Mission-Design-Game"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginTop: "var(--space-2)",
                padding: "14px 20px",
                backgroundColor: "rgba(12, 74, 110, 0.35)",
                border: "2px solid #38bdf8",
                color: "#f8fafc",
                fontSize: "var(--text-xs)",
                fontWeight: 700,
                textAlign: "left",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                textDecoration: "none",
                boxShadow: "0 0 16px rgba(56, 189, 248, 0.35)",
                transition: "all 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="#38bdf8">
                  <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                </svg>
                <span>5. NASA JUDGES: GITHUB CODEBASE</span>
              </div>
              <span style={{ color: "#38bdf8", fontWeight: 700 }}>↗</span>
            </a>
          </div>

          {/* Bottom Bar Info */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px", color: "var(--color-text-muted)" }}>
            <div>REAL-TIME ASTRODYNAMICS &amp; SUB-SYSTEM ENGINEERING SIMULATOR</div>
            <div className="font-mono">VER 1.0 // CDS REV 14.1 &amp; JPL CML 4</div>
          </div>
        </div>

        {/* Comprehensive Interactive Welcome & How to Play Modal */}
        {showWelcomeGuide && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              backgroundColor: "rgba(3, 7, 18, 0.88)",
              backdropFilter: "blur(12px)",
              zIndex: 100,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "24px",
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                maxWidth: "780px",
                width: "100%",
                maxHeight: "90vh",
                overflowY: "auto",
                backgroundColor: "rgba(15, 23, 42, 0.96)",
                border: "1px solid #38bdf8",
                boxShadow: "0 20px 50px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.25)",
                padding: "28px",
                borderRadius: "4px",
                display: "flex",
                flexDirection: "column",
                gap: "20px",
              }}
            >
              {/* Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid rgba(255, 255, 255, 0.1)", paddingBottom: "16px" }}>
                <div>
                  <div className="font-mono" style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 700, letterSpacing: "0.15em", textTransform: "uppercase" }}>
                    FLIGHT OPERATIONS MANUAL // ONBOARDING BRIEFING
                  </div>
                  <h2 style={{ fontSize: "22px", fontWeight: 700, color: "#f8fafc", margin: "4px 0 0" }}>
                    HOW TO PLAY: SPACE MISSION DESIGN GAME
                  </h2>
                </div>
                <button
                  onClick={() => setShowWelcomeGuide(false)}
                  style={{
                    padding: "6px 14px",
                    backgroundColor: "rgba(239, 68, 68, 0.2)",
                    border: "1px solid #ef4444",
                    color: "#f87171",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    borderRadius: "2px",
                  }}
                >
                  CLOSE [X]
                </button>
              </div>

              {/* 3 Game Modes Overview Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div style={{ padding: "14px", backgroundColor: "rgba(2, 132, 199, 0.12)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "3px" }}>
                  <div className="font-mono" style={{ fontSize: "10px", color: "#38bdf8", fontWeight: 700 }}>GAME MODE 1</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff", marginTop: "2px" }}>Orbital EVA Repair</div>
                  <p style={{ fontSize: "11px", color: "#94a3b8", lineHeight: 1.45, marginTop: "6px" }}>
                    First-person astronaut exploration on Gateway-1. Walk the gantry in microgravity, replace shattered GaAs solar wings, equip S-band antennas, and reboot telemetry on satellite AERO-3X.
                  </p>
                </div>

                <div style={{ padding: "14px", backgroundColor: "rgba(16, 185, 129, 0.12)", border: "1px solid rgba(52, 211, 153, 0.3)", borderRadius: "3px" }}>
                  <div className="font-mono" style={{ fontSize: "10px", color: "#34d399", fontWeight: 700 }}>GAME MODE 2</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff", marginTop: "2px" }}>3D Piloted Flight Sim</div>
                  <p style={{ fontSize: "11px", color: "#94a3b8", lineHeight: 1.45, marginTop: "6px" }}>
                    Pilot Orbital Utility Shuttle ORV-1 with 6-DOF RCS thrusters. Perform soft-capture docking at Port DOCK-01, execute lunar descent burns, and touch down on Base Alpha PAD-01.
                  </p>
                </div>

                <div style={{ padding: "14px", backgroundColor: "rgba(245, 158, 11, 0.12)", border: "1px solid rgba(251, 191, 36, 0.3)", borderRadius: "3px" }}>
                  <div className="font-mono" style={{ fontSize: "10px", color: "#fbbf24", fontWeight: 700 }}>GAME MODE 3</div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#ffffff", marginTop: "2px" }}>Hangar Assembly</div>
                  <p style={{ fontSize: "11px", color: "#94a3b8", lineHeight: 1.45, marginTop: "6px" }}>
                    Construct modular CubeSats (1U, 3U, 6U) adhering to Cal Poly CDS Rev 14.1 standards. Run thruster static-fire tests, balance power/mass budgets, and launch into Earth orbit.
                  </p>
                </div>
              </div>

              {/* Step-by-Step Instructions */}
              <div style={{ padding: "14px 18px", backgroundColor: "rgba(30, 41, 59, 0.5)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "3px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "#f8fafc", marginBottom: "8px" }}>
                  HOW TO BUILD &amp; LAUNCH IN THE SPACECRAFT WORKSHOP:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "11px", color: "#cbd5e1", lineHeight: 1.5 }}>
                  <div><strong>1. Choose Form Factor:</strong> 1U (Scout), 3U (Standard Science), or 6U (Deep Space Relay).</div>
                  <div><strong>2. Balance Solar Power:</strong> Ensure solar panel wattage exceeds continuous subsystem electrical draw.</div>
                  <div><strong>3. Battery Storage:</strong> Ensure battery survives the 35-minute Earth eclipse shadow without depleting.</div>
                  <div><strong>4. Launch Authorization:</strong> When all engineering matrix rows turn green &apos;Nominal&apos;, click [Proceed to Launch]!</div>
                </div>
              </div>

              {/* Keybinds Reference Table */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div style={{ padding: "12px", backgroundColor: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(56, 189, 248, 0.2)", borderRadius: "2px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8", marginBottom: "6px" }}>FLIGHT COCKPIT CONTROLS</div>
                  <div style={{ fontSize: "10px", color: "#94a3b8", display: "grid", gridTemplateColumns: "80px 1fr", rowGap: "4px" }}>
                    <span className="font-mono" style={{ color: "#f8fafc" }}>W / S</span><span>Forward / Reverse Thrusters</span>
                    <span className="font-mono" style={{ color: "#f8fafc" }}>A / D</span><span>Yaw Port / Starboard</span>
                    <span className="font-mono" style={{ color: "#f8fafc" }}>Q / E</span><span>Roll Counter / Clockwise</span>
                    <span className="font-mono" style={{ color: "#f8fafc" }}>Space / Ctrl</span><span>Translate Up / Down</span>
                    <span className="font-mono" style={{ color: "#f8fafc" }}>V / G</span><span>Toggle Camera View / Landing Gear</span>
                  </div>
                </div>

                <div style={{ padding: "12px", backgroundColor: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(52, 211, 153, 0.2)", borderRadius: "2px" }}>
                  <div style={{ fontSize: "11px", fontWeight: 700, color: "#34d399", marginBottom: "6px" }}>ASTRONAUT EVA CONTROLS</div>
                  <div style={{ fontSize: "10px", color: "#94a3b8", display: "grid", gridTemplateColumns: "80px 1fr", rowGap: "4px" }}>
                    <span className="font-mono" style={{ color: "#f8fafc" }}>W A S D</span><span>Move Astronaut</span>
                    <span className="font-mono" style={{ color: "#f8fafc" }}>Space</span><span>Low-G Lunar Jump / Thruster</span>
                    <span className="font-mono" style={{ color: "#f8fafc" }}>E</span><span>Interact / Board Shuttle / Repair</span>
                    <span className="font-mono" style={{ color: "#f8fafc" }}>1 / 2 / 3 / 4</span><span>Equip Toolkit / Solar / Antenna / ALSEP</span>
                    <span className="font-mono" style={{ color: "#f8fafc" }}>C / T</span><span>Controls Sheet / Sector Jump</span>
                  </div>
                </div>
              </div>

              {/* Start Playing CTA */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", paddingTop: "8px" }}>
                <button
                  onClick={() => {
                    soundManager.playEquip();
                    setShowWelcomeGuide(false);
                    setStage("FIRST_PERSON_GAME");
                  }}
                  style={{
                    padding: "10px 22px",
                    backgroundColor: "#0284c7",
                    border: "none",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    borderRadius: "2px",
                    letterSpacing: "0.04em",
                  }}
                >
                  START ORBITAL REPAIR MISSION →
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    );
  }

  // ============================================================================
  // STAGE 2: MISSION SELECTION (Tactical Orbital Missions Map)
  // ============================================================================
  if (stage === "MISSION_SELECT") {
    const selectedContract = MISSION_CONTRACTS.find((c) => c.id === activeContractId) || MISSION_CONTRACTS[0];
    const filteredContracts = MISSION_CONTRACTS.filter((c) => {
      if (contractFilter === "ALL") return true;
      if (contractFilter === "LEO") return c.orbitType.includes("LEO");
      if (contractFilter === "POLAR") return c.orbitType.includes("POLAR");
      if (contractFilter === "GEO") return c.orbitType.includes("GEO");
      return true;
    });

    return (
      <main style={{ position: "relative", display: "flex", flexDirection: "column", height: "100vh", width: "100vw", backgroundColor: "#06080c", overflow: "hidden" }}>
        {/* Tactical Command Header */}
        <header style={{ position: "relative", zIndex: 20, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 var(--space-6)", height: "54px", borderBottom: "1px solid rgba(56, 189, 248, 0.25)", backgroundColor: "rgba(10, 15, 26, 0.96)", backdropFilter: "blur(12px)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <button
              onClick={() => {
                soundManager.playEquip();
                setStage("MAIN_MENU");
              }}
              style={{ padding: "6px 14px", fontSize: "11px", fontWeight: 700, color: "#38bdf8", backgroundColor: "rgba(56, 189, 248, 0.12)", border: "1px solid #38bdf8", borderRadius: "3px", cursor: "pointer", letterSpacing: "0.05em" }}
            >
              ← MAIN MENU
            </button>
            <div style={{ width: "1px", height: "16px", backgroundColor: "rgba(255, 255, 255, 0.2)" }} />
            <div>
              <div style={{ fontSize: "12px", fontWeight: 800, letterSpacing: "0.08em", color: "#f8fafc", textTransform: "uppercase" }}>
                TACTICAL STAR COMMAND OPERATIONS // FLIGHT CONTRACTS
              </div>
              <div style={{ fontSize: "10px", color: "#38bdf8", fontFamily: "var(--font-mono)" }}>
                NASA LSP FLIGHT DISPATCH · 3D ORBITAL TRAJECTORY MAPPING
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "rgba(34, 197, 94, 0.12)", border: "1px solid rgba(34, 197, 94, 0.3)", padding: "4px 10px", borderRadius: "3px" }}>
              <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>FLIGHT DIRECTOR BUDGET:</span>
              <span className="font-mono" style={{ fontSize: "12px", color: "#22c55e", fontWeight: 700 }}>{careerCredits.toLocaleString()} Cr</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "rgba(56, 189, 248, 0.12)", border: "1px solid rgba(56, 189, 248, 0.3)", padding: "4px 10px", borderRadius: "3px" }}>
              <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>CLEARANCE:</span>
              <span className="font-mono" style={{ fontSize: "12px", color: "#38bdf8", fontWeight: 700 }}>{completedContracts.length} / {MISSION_CONTRACTS.length} CLEARED</span>
            </div>
          </div>
        </header>

        {/* 2-Pane Command Operations Center */}
        <div style={{ display: "grid", gridTemplateColumns: "480px 1fr", flex: 1, height: "calc(100vh - 54px)", overflow: "hidden" }}>
          {/* LEFT PANE: Mission Feed */}
          <div style={{ backgroundColor: "rgba(10, 15, 26, 0.96)", borderRight: "1px solid rgba(56, 189, 248, 0.2)", display: "flex", flexDirection: "column", height: "100%", overflowY: "auto", padding: "16px 20px", gap: "14px", position: "relative", zIndex: 10 }}>
            {/* Quick-Launch 3D Piloted Shuttle Mission Callout Banner */}
            <div
              style={{
                padding: "12px 16px",
                backgroundColor: "rgba(12, 74, 110, 0.4)",
                border: "1.5px solid #38bdf8",
                borderRadius: "4px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backdropFilter: "blur(12px)",
                boxShadow: "0 0 16px rgba(56, 189, 248, 0.2)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "20px" }}>🚀</span>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#ffffff", letterSpacing: "0.04em" }}>
                    PILOT SHUTTLE ORV-1 DIRECTLY
                  </div>
                  <div style={{ fontSize: "10px", color: "#38bdf8", marginTop: "1px" }}>
                    6-DOF Cockpit Flight · Gateway-1 Mooring
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  soundManager.playEngineRoar();
                  setStage("FLIGHT_SIM_GAME");
                }}
                style={{
                  padding: "6px 12px",
                  backgroundColor: "#0284c7",
                  border: "1px solid #38bdf8",
                  color: "#ffffff",
                  fontSize: "11px",
                  fontWeight: 700,
                  borderRadius: "3px",
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  whiteSpace: "nowrap",
                }}
              >
                PILOT NOW →
              </button>
            </div>

            {/* Filter Pills */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Select Active Contract:
              </div>
              <div style={{ display: "flex", gap: "4px", backgroundColor: "rgba(15, 23, 42, 0.8)", padding: "3px", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "4px" }}>
                {(["ALL", "LEO", "POLAR", "GEO"] as const).map((tag) => (
                  <button
                    key={tag}
                    onClick={() => {
                      soundManager.playEquip();
                      setContractFilter(tag);
                    }}
                    style={{
                      padding: "4px 10px",
                      fontSize: "10px",
                      fontWeight: 700,
                      backgroundColor: contractFilter === tag ? "#0284c7" : "transparent",
                      color: contractFilter === tag ? "#ffffff" : "#94a3b8",
                      border: "none",
                      borderRadius: "2px",
                      cursor: "pointer",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {tag === "ALL" ? "ALL" : tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Contract Dossier Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {filteredContracts.map((c) => {
                const isUnlocked = careerScore >= c.requiredCareerScore || c.id === "LEO_SSO_600KM";
                const isDone = completedContracts.includes(c.id);
                const isSelected = activeContractId === c.id;

                return (
                  <div
                    key={c.id}
                    onClick={() => {
                      soundManager.playEquip();
                      setActiveContractId(c.id);
                    }}
                    style={{
                      padding: "14px 16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "10px",
                      opacity: isUnlocked ? 1.0 : 0.5,
                      backgroundColor: isSelected ? "rgba(14, 116, 144, 0.22)" : "rgba(15, 23, 42, 0.85)",
                      border: isSelected ? "1.5px solid #38bdf8" : isDone ? "1px solid #22c55e" : "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "4px",
                      boxShadow: isSelected ? "0 0 16px rgba(56, 189, 248, 0.3)" : "none",
                      cursor: isUnlocked ? "pointer" : "not-allowed",
                      position: "relative",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {/* Top Orbit Tag & Difficulty Stars */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <span className="font-mono" style={{ fontSize: "10px", padding: "2px 6px", backgroundColor: isSelected ? "#0284c7" : "rgba(56, 189, 248, 0.15)", border: "1px solid rgba(56, 189, 248, 0.3)", color: isSelected ? "#ffffff" : "#38bdf8", fontWeight: 700, borderRadius: "2px" }}>
                            {c.code}
                          </span>
                          <span className="font-mono" style={{ fontSize: "10px", color: "#94a3b8" }}>
                            {c.orbitType} · {c.altitudeKm} KM
                          </span>
                          {isSelected && (
                            <span style={{ fontSize: "9px", padding: "2px 6px", backgroundColor: "rgba(34, 197, 94, 0.2)", border: "1px solid #22c55e", color: "#22c55e", fontWeight: 700, borderRadius: "2px" }}>
                              ACTIVE TARGET
                            </span>
                          )}
                        </div>
                        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "#f8fafc", marginTop: "4px" }}>{c.title}</h3>
                        <div style={{ fontSize: "10px", color: "var(--color-status-telemetry)", fontWeight: 600 }}>{c.agency}</div>
                      </div>
                      <span className="font-mono" style={{ fontSize: "12px", color: "#fbbf24", letterSpacing: "1px" }}>
                        {c.difficultyStars}
                      </span>
                    </div>

                    {/* Telemetry Stats & Rewards Pills */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px", backgroundColor: "rgba(30, 41, 59, 0.4)", padding: "6px 8px", borderRadius: "3px", border: "1px solid rgba(255, 255, 255, 0.05)" }}>
                      <div>
                        <div style={{ fontSize: "8px", color: "#64748b", fontWeight: 700 }}>ORBIT ALT</div>
                        <div className="font-mono" style={{ fontSize: "11px", color: "#f8fafc", fontWeight: 600 }}>{c.altitudeKm} km</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "8px", color: "#64748b", fontWeight: 700 }}>SCIENCE TARGET</div>
                        <div className="font-mono" style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 600 }}>{c.scienceTargetMb} Mb</div>
                      </div>
                      <div>
                        <div style={{ fontSize: "8px", color: "#64748b", fontWeight: 700 }}>REWARD</div>
                        <div className="font-mono" style={{ fontSize: "11px", color: "#22c55e", fontWeight: 700 }}>+{c.rewardCredits.toLocaleString()} Cr</div>
                      </div>
                    </div>

                    {/* Bottom Actions */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "4px", borderTop: "1px solid rgba(255, 255, 255, 0.06)" }}>
                      <span className="font-mono" style={{ fontSize: "10px", color: isDone ? "#22c55e" : isUnlocked ? "#38bdf8" : "#64748b", fontWeight: 600 }}>
                        {isDone ? "STATUS: COMPLETED" : isUnlocked ? "CLEARANCE: GRANTED" : `LOCKED: ${c.requiredCareerScore} PTS`}
                      </span>

                      <button
                        disabled={!isUnlocked}
                        onClick={(e) => {
                          e.stopPropagation();
                          soundManager.playEquip();
                          setActiveContractId(c.id);
                          setStage("WORKSHOP");
                        }}
                        style={{
                          padding: "6px 14px",
                          backgroundColor: isSelected ? "#0284c7" : "transparent",
                          border: isSelected ? "1px solid #38bdf8" : "1px solid rgba(56, 189, 248, 0.4)",
                          color: isUnlocked ? "#ffffff" : "#64748b",
                          fontSize: "10px",
                          fontWeight: 700,
                          cursor: isUnlocked ? "pointer" : "not-allowed",
                          letterSpacing: "0.04em",
                          borderRadius: "2px",
                        }}
                      >
                        {isDone ? "RECONFIGURE →" : "BUILD & FLY →"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT PANE: 3D Holographic Orbit Globe & Tactical Dossier */}
          <div style={{ position: "relative", width: "100%", height: "100%", backgroundColor: "#06080c" }}>
            {/* Interactive 3D Orbit Globe Viewport */}
            <div style={{ position: "absolute", inset: 0 }}>
              <SpacecraftViewport
                busSize="3U"
                viewMode="ORBIT"
                solarArrayType="DUAL_WING"
                solarArrayDeployed={true}
                payloadType="IMAGER"
                antennaType="SBAND"
                hasPropulsion={true}
                thrusterActive={false}
                isEclipse={false}
                orbitAltitudeKm={selectedContract.altitudeKm}
                orbitProgress={0.35}
              />
            </div>

            {/* Top-Right Holographic Orbital Parameters HUD */}
            <div
              style={{
                position: "absolute",
                top: "16px",
                right: "20px",
                zIndex: 10,
                width: "360px",
                backgroundColor: "rgba(10, 15, 26, 0.9)",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                borderRadius: "6px",
                padding: "16px 18px",
                backdropFilter: "blur(12px)",
                boxShadow: "0 10px 30px rgba(0,0,0,0.8)",
                display: "flex",
                flexDirection: "column",
                gap: "10px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid rgba(56, 189, 248, 0.2)", paddingBottom: "6px" }}>
                <span className="font-mono" style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8" }}>
                  MISSION INTEL // {selectedContract.code}
                </span>
                <span className="font-mono" style={{ fontSize: "10px", color: "#fbbf24" }}>
                  {selectedContract.orbitType}
                </span>
              </div>

              <div>
                <h2 style={{ fontSize: "15px", fontWeight: 700, color: "#ffffff" }}>{selectedContract.title}</h2>
                <p style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", lineHeight: 1.45 }}>
                  {selectedContract.narrative}
                </p>
              </div>

              {/* Orbital Mechanics Parameters Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", backgroundColor: "rgba(15, 23, 42, 0.6)", padding: "10px", borderRadius: "4px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
                <div>
                  <div style={{ fontSize: "9px", color: "#64748b", fontWeight: 700 }}>ORBIT ALTITUDE</div>
                  <div className="font-mono" style={{ fontSize: "12px", color: "#f8fafc", fontWeight: 700 }}>{selectedContract.altitudeKm} km</div>
                </div>
                <div>
                  <div style={{ fontSize: "9px", color: "#64748b", fontWeight: 700 }}>INCLINATION</div>
                  <div className="font-mono" style={{ fontSize: "12px", color: "#f8fafc", fontWeight: 700 }}>{selectedContract.inclinationDeg}°</div>
                </div>
                <div>
                  <div style={{ fontSize: "9px", color: "#64748b", fontWeight: 700 }}>ORBITAL PERIOD</div>
                  <div className="font-mono" style={{ fontSize: "12px", color: "#38bdf8", fontWeight: 700 }}>{selectedContract.periodMin} min</div>
                </div>
                <div>
                  <div style={{ fontSize: "9px", color: "#64748b", fontWeight: 700 }}>ECLIPSE SHADOW</div>
                  <div className="font-mono" style={{ fontSize: "12px", color: "#f59e0b", fontWeight: 700 }}>{selectedContract.eclipseMin} min/orbit</div>
                </div>
              </div>

              {/* Mission Objectives Checklist */}
              <div>
                <div style={{ fontSize: "10px", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", marginBottom: "4px" }}>
                  Key Directives:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "10px", color: "#cbd5e1" }}>
                  {selectedContract.objectives.map((obj, i) => (
                    <div key={i} style={{ display: "flex", gap: "6px", alignItems: "flex-start" }}>
                      <span style={{ color: "#22c55e", fontWeight: 700 }}>✓</span>
                      <span>{obj}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Bottom-Right Tactical Launch Command Dock */}
            <div
              style={{
                position: "absolute",
                bottom: "20px",
                right: "20px",
                zIndex: 10,
                display: "flex",
                gap: "10px",
                alignItems: "center",
              }}
            >
              <button
                onClick={() => {
                  soundManager.playRadioStatic(200);
                  soundManager.playQuindarTone(true);
                }}
                style={{
                  padding: "12px 18px",
                  backgroundColor: "rgba(15, 23, 42, 0.85)",
                  border: "1px solid rgba(56, 189, 248, 0.4)",
                  color: "#38bdf8",
                  fontSize: "11px",
                  fontWeight: 700,
                  borderRadius: "4px",
                  cursor: "pointer",
                  letterSpacing: "0.04em",
                  backdropFilter: "blur(8px)",
                }}
              >
                📻 HEAR RADIO BRIEFING
              </button>

              <button
                onClick={() => {
                  soundManager.playQuindarTone(true);
                  setActiveContractId(selectedContract.id);
                  setStage("WORKSHOP");
                }}
                style={{
                  padding: "12px 26px",
                  backgroundColor: "#0284c7",
                  border: "1.5px solid #38bdf8",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: 800,
                  borderRadius: "4px",
                  cursor: "pointer",
                  letterSpacing: "0.06em",
                  boxShadow: "0 0 20px rgba(56, 189, 248, 0.5)",
                }}
              >
                ACCEPT CONTRACT &amp; ENTER 3D WORKSHOP →
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ============================================================================
  // STAGE 3: MISSION BRIEFING (The "Why")
  // ============================================================================
  if (stage === "MISSION_BRIEFING") {
    return (
      <main style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", backgroundColor: "var(--color-canvas)" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 var(--space-6)", height: "48px", borderBottom: "1px solid var(--color-border-subtle)", backgroundColor: "var(--color-surface-1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <button onClick={() => setStage("MISSION_SELECT")} style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
              ← Mission Selection
            </button>
            <div style={{ width: "1px", height: "12px", backgroundColor: "var(--color-border-default)" }} />
            <h1 style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Flight Operations Briefing // {contract.code}</h1>
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto", padding: "var(--space-8)", display: "flex", flexDirection: "column", alignItems: "center" }}>
          <div style={{ maxWidth: "800px", width: "100%", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <div className="panel" style={{ padding: "var(--space-5)" }}>
              <div className="font-mono" style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>{contract.agency}</div>
              <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, margin: "var(--space-2) 0" }}>{contract.title}</h2>
              <p style={{ fontSize: "var(--text-sm)", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                {contract.narrative}
              </p>
            </div>

            {/* Orbit Dynamics Table */}
            <div className="panel" style={{ padding: "var(--space-4)" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-3)" }}>
                Flight Dynamics & Orbital Target
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Parameter</th>
                    <th>Specification</th>
                    <th>Flight Rules</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  <tr>
                    <td>Target Altitude</td>
                    <td>{contract.altitudeKm.toLocaleString()} km</td>
                    <td>Circular geocentric orbit</td>
                  </tr>
                  <tr>
                    <td>Orbital Inclination</td>
                    <td>{contract.inclinationDeg.toFixed(2)}°</td>
                    <td>{contract.orbitType} ground track</td>
                  </tr>
                  <tr>
                    <td>Orbital Period</td>
                    <td>{contract.periodMin.toFixed(1)} minutes</td>
                    <td>15 orbits per mission flight</td>
                  </tr>
                  <tr>
                    <td>Earth Eclipse Duration</td>
                    <td>{contract.eclipseMin.toFixed(1)} minutes / orbit</td>
                    <td>Battery discharge regime in umbra shadow</td>
                  </tr>
                  <tr>
                    <td>Required Data Volume</td>
                    <td>≥ {contract.scienceTargetMb} Mb</td>
                    <td>Delivered via Wallops or Svalbard passes</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Requirements & Objectives */}
            <div className="panel" style={{ padding: "var(--space-4)" }}>
              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-3)" }}>
                Primary Contract Objectives
              </div>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--text-xs)" }}>
                {contract.objectives.map((obj, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--color-text-primary)" }}>
                    <span className="status-dot status-dot-nominal" />
                    {obj}
                  </li>
                ))}
              </ul>

              <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", margin: "var(--space-4) 0 var(--space-2) 0" }}>
                Optional Bonus Challenges
              </div>
              <ul style={{ listStyle: "none", display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "var(--text-xs)" }}>
                {contract.bonusObjectives.map((bObj, i) => (
                  <li key={i} style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", color: "var(--color-text-secondary)" }}>
                    <span className="status-dot status-dot-neutral" />
                    {bObj}
                  </li>
                ))}
              </ul>
            </div>

            {/* Action */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={() => setStage("WORKSHOP")}
                style={{
                  padding: "10px 24px",
                  backgroundColor: "var(--color-surface-elevated)",
                  color: "var(--color-text-primary)",
                  border: "1px solid var(--color-border-focus)",
                  fontSize: "var(--text-xs)",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Accept Contract & Enter Spacecraft Workshop →
              </button>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ============================================================================
  // STAGE 4: SPACECRAFT WORKSHOP (Interactive 3D Assembly Bay)
  // ============================================================================
  if (stage === "WORKSHOP") {
    // Compute plain-English guidance recommendations for players
    const guidanceTips: string[] = [];
    if (!massCompliant) {
      guidanceTips.push(
        `Mass Exceeded: Total wet mass is ${wetMassKg.toFixed(2)} kg (limit is ${cdsLimitKg.toFixed(1)} kg for ${formFactor}). Upgrade chassis to ${formFactor === "1U" ? "3U" : "6U"} or pick a lighter battery/payload.`
      );
    }
    if (!powerPositive) {
      guidanceTips.push(
        `Power Deficit: Subsystems draw ${totalNominalLoadW.toFixed(1)} W, but solar panels only generate ${solarGenWatts.toFixed(1)} W. Upgrade to Single-Wing or Dual-Wing Solar Array.`
      );
    }
    if (!dodNominal) {
      guidanceTips.push(
        `Battery DoD (${estimatedEclipseDodPercent.toFixed(1)}%): Exceeds safe 25% limit for 35-min eclipse shadow. Upgrade battery capacity.`
      );
    }
    if (!linkMarginNominal) {
      guidanceTips.push(
        `Low RF Link Margin (${estimatedLinkMarginDb.toFixed(1)} dB): NASA requires ≥ 6.0 dB. Upgrade antenna to S-Band or X-Band.`
      );
    }
    if (!budgetCompliant) {
      guidanceTips.push(
        `Over Budget: Hardware cost (${totalCostCredits.toLocaleString()} Cr) exceeds credits (${careerCredits.toLocaleString()} Cr).`
      );
    }

    return (
      <main style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", overflow: "hidden", backgroundColor: "var(--color-canvas)" }}>
        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 var(--space-5)", height: "48px", borderBottom: "1px solid var(--color-border-subtle)", backgroundColor: "var(--color-surface-1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <button onClick={() => setStage("MISSION_BRIEFING")} style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
              ← Briefing
            </button>
            <div style={{ width: "1px", height: "12px", backgroundColor: "var(--color-border-default)" }} />
            <h1 style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Spacecraft Design Workshop // {contract.code}</h1>
            <button
              onClick={() => setShowHangarGuide(!showHangarGuide)}
              style={{
                padding: "3px 8px",
                fontSize: "11px",
                fontWeight: 600,
                backgroundColor: showHangarGuide ? "rgba(56, 189, 248, 0.15)" : "var(--color-surface-2)",
                color: showHangarGuide ? "#38bdf8" : "var(--color-text-muted)",
                border: "1px solid rgba(56, 189, 248, 0.3)",
                borderRadius: "3px",
                cursor: "pointer",
              }}
            >
              [GUIDE] {showHangarGuide ? "Hide Guide" : "Show Guide"}
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", fontSize: "11px" }}>
            <span>Available Credits: <strong className="font-mono" style={{ color: "var(--color-status-nominal)" }}>{careerCredits.toLocaleString()} Cr</strong></span>
            <span>Spacecraft Cost: <strong className="font-mono" style={{ color: budgetCompliant ? "var(--color-text-primary)" : "var(--color-status-critical)" }}>{totalCostCredits.toLocaleString()} Cr</strong></span>
          </div>
        </header>

        {/* Workshop Split */}
        <div style={{ display: "grid", gridTemplateColumns: "410px 1fr", flex: 1, overflow: "hidden" }}>
          {/* Left Part Assembly Rail */}
          <aside style={{ borderRight: "1px solid var(--color-border-subtle)", backgroundColor: "var(--color-surface-1)", padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: "var(--space-3)", overflowY: "auto" }}>
            {/* Quickstart Guide Banner */}
            {showHangarGuide && (
              <div
                style={{
                  padding: "10px 12px",
                  backgroundColor: "rgba(2, 132, 199, 0.1)",
                  border: "1px solid rgba(56, 189, 248, 0.35)",
                  borderRadius: "4px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    How to Build Your Spacecraft
                  </span>
                  <button
                    onClick={() => setShowHangarGuide(false)}
                    style={{ background: "transparent", border: "none", color: "var(--color-text-muted)", fontSize: "11px", cursor: "pointer", fontFamily: "var(--font-mono)" }}
                  >
                    [X]
                  </button>
                </div>
                <div style={{ fontSize: "10px", color: "var(--color-text-secondary)", lineHeight: 1.45 }}>
                  <strong>1. Form Factor:</strong> Select Chassis (1U, 3U, 6U) to meet your payload and mass budget.<br />
                  <strong>2. Power Balance:</strong> Solar generation (W) must exceed total load in sunlight.<br />
                  <strong>3. Battery Storage:</strong> Must survive 35-min eclipse shadow with Depth-of-Discharge &lt; 25%.<br />
                  <strong>4. Payload &amp; Radio:</strong> Match contract payload and ensure RF link margin &ge; 6.0 dB.<br />
                  <strong>5. Ready to Fly:</strong> When all matrix rows turn green &apos;Nominal&apos;, Launch unlocks!
                </div>
              </div>
            )}

            {/* One-Click Presets */}
            <div>
              <div style={{ fontSize: "10px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>
                One-Click Architecture Presets
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
                <button
                  onClick={() => handleApplyPreset("BALANCED_3U")}
                  style={{
                    padding: "5px 4px",
                    backgroundColor: "var(--color-surface-2)",
                    border: "1px solid var(--color-border-subtle)",
                    color: "var(--color-text-primary)",
                    fontSize: "10px",
                    fontWeight: 600,
                    borderRadius: "3px",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                  title="Balanced 3U Earth Observation setup"
                >
                  3U Earth Obs
                </button>
                <button
                  onClick={() => handleApplyPreset("DEEP_SPACE_6U")}
                  style={{
                    padding: "5px 4px",
                    backgroundColor: "var(--color-surface-2)",
                    border: "1px solid var(--color-border-subtle)",
                    color: "var(--color-text-primary)",
                    fontSize: "10px",
                    fontWeight: 600,
                    borderRadius: "3px",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                  title="Deep space high-power 6U relay setup"
                >
                  6U Relay
                </button>
                <button
                  onClick={() => handleApplyPreset("MINIMALIST_1U")}
                  style={{
                    padding: "5px 4px",
                    backgroundColor: "var(--color-surface-2)",
                    border: "1px solid var(--color-border-subtle)",
                    color: "var(--color-text-primary)",
                    fontSize: "10px",
                    fontWeight: 600,
                    borderRadius: "3px",
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                  title="Minimalist 1U scout science setup"
                >
                  1U Scout
                </button>
              </div>
            </div>

            {/* Subsystem Module Tabs (PUBG / Armored Core Vehicle Assembly Style) */}
            <div>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "6px" }}>
                Tactical Subsystem Modules
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
                {[
                  { id: "CHASSIS", label: "CHASSIS", equipped: formFactor },
                  { id: "SOLAR", label: "SOLAR", equipped: solarArray === "BODY_MOUNTED" ? "8W GaAs" : solarArray === "SINGLE_WING" ? "28W 1-Wing" : "56W 2-Wing" },
                  { id: "BATTERY", label: "BATTERY", equipped: `${activeBattery.capacityWh} Wh` },
                  { id: "PAYLOAD", label: "PAYLOAD", equipped: activePayload.id },
                  { id: "PROPULSION", label: "THRUSTER", equipped: propulsionId === "NONE" ? "Passive" : propulsionId },
                  { id: "TELECOM", label: "TELECOM", equipped: telecomId },
                ].map((tab) => {
                  const isActive = workshopActiveTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => {
                        soundManager.playEquip();
                        setWorkshopActiveTab(tab.id as typeof workshopActiveTab);
                      }}
                      style={{
                        padding: "6px 4px",
                        backgroundColor: isActive ? "rgba(2, 132, 199, 0.25)" : "var(--color-surface-2)",
                        border: isActive ? "1px solid #38bdf8" : "1px solid var(--color-border-subtle)",
                        borderRadius: "3px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        gap: "2px",
                        boxShadow: isActive ? "0 0 10px rgba(56, 189, 248, 0.25)" : "none",
                        transition: "all 0.15s ease",
                      }}
                    >
                      <span style={{ fontSize: "10px", fontWeight: 700, color: isActive ? "#38bdf8" : "var(--color-text-secondary)" }}>
                        [{tab.label}]
                      </span>
                      <span className="font-mono" style={{ fontSize: "9px", color: isActive ? "#ffffff" : "var(--color-text-muted)" }}>
                        {tab.equipped}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Subsystem Module Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {/* CHASSIS TAB */}
              {workshopActiveTab === "CHASSIS" &&
                CHASSIS_CATALOG.map((c) => {
                  const isSelected = formFactor === c.id;
                  return (
                    <div
                      key={c.id}
                      onClick={() => {
                        soundManager.playEquip();
                        setFormFactor(c.id);
                      }}
                      style={{
                        padding: "10px 12px",
                        backgroundColor: isSelected ? "rgba(14, 116, 144, 0.2)" : "var(--color-surface-2)",
                        border: isSelected ? "1.5px solid #22c55e" : "1px solid var(--color-border-subtle)",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        boxShadow: isSelected ? "0 0 12px rgba(34, 197, 94, 0.2)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: isSelected ? "#22c55e" : "#ffffff" }}>
                          {c.name}
                        </span>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "2px",
                            backgroundColor: isSelected ? "rgba(34, 197, 94, 0.25)" : "var(--color-surface-3)",
                            color: isSelected ? "#22c55e" : "var(--color-text-muted)",
                            border: `1px solid ${isSelected ? "#22c55e" : "transparent"}`,
                          }}
                        >
                          {isSelected ? "EQUIPPED" : "SELECT"}
                        </span>
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>
                        Standardized CDS structure ({c.dimensions}).
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px", fontSize: "10px", fontFamily: "var(--font-mono)" }}>
                        <span style={{ color: "#38bdf8" }}>Limit: ≤{c.maxMassKg} kg</span>
                        <span style={{ color: "#94a3b8" }}>Dry: {c.structuralMassKg} kg</span>
                        <span style={{ color: "#f59e0b" }}>{c.costCredits} Cr</span>
                      </div>
                    </div>
                  );
                })}

              {/* SOLAR TAB */}
              {workshopActiveTab === "SOLAR" &&
                SOLAR_CATALOG.map((s) => {
                  const isSelected = solarArray === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        soundManager.playEquip();
                        setSolarArray(s.id);
                      }}
                      style={{
                        padding: "10px 12px",
                        backgroundColor: isSelected ? "rgba(14, 116, 144, 0.2)" : "var(--color-surface-2)",
                        border: isSelected ? "1.5px solid #22c55e" : "1px solid var(--color-border-subtle)",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        boxShadow: isSelected ? "0 0 12px rgba(34, 197, 94, 0.2)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: isSelected ? "#22c55e" : "#ffffff" }}>
                          {s.name}
                        </span>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "2px",
                            backgroundColor: isSelected ? "rgba(34, 197, 94, 0.25)" : "var(--color-surface-3)",
                            color: isSelected ? "#22c55e" : "var(--color-text-muted)",
                            border: `1px solid ${isSelected ? "#22c55e" : "transparent"}`,
                          }}
                        >
                          {isSelected ? "EQUIPPED" : "SELECT"}
                        </span>
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>
                        {s.description}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px", fontSize: "10px", fontFamily: "var(--font-mono)" }}>
                        <span style={{ color: "#22c55e" }}>+{s.powerWatts} W</span>
                        <span style={{ color: "#94a3b8" }}>{s.massKg} kg</span>
                        <span style={{ color: "#f59e0b" }}>{s.costCredits} Cr</span>
                      </div>
                    </div>
                  );
                })}

              {/* BATTERY TAB */}
              {workshopActiveTab === "BATTERY" &&
                BATTERY_CATALOG.map((b) => {
                  const isSelected = batteryId === b.id;
                  return (
                    <div
                      key={b.id}
                      onClick={() => {
                        soundManager.playEquip();
                        setBatteryId(b.id);
                      }}
                      style={{
                        padding: "10px 12px",
                        backgroundColor: isSelected ? "rgba(14, 116, 144, 0.2)" : "var(--color-surface-2)",
                        border: isSelected ? "1.5px solid #22c55e" : "1px solid var(--color-border-subtle)",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        boxShadow: isSelected ? "0 0 12px rgba(34, 197, 94, 0.2)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: isSelected ? "#22c55e" : "#ffffff" }}>
                          {b.name}
                        </span>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "2px",
                            backgroundColor: isSelected ? "rgba(34, 197, 94, 0.25)" : "var(--color-surface-3)",
                            color: isSelected ? "#22c55e" : "var(--color-text-muted)",
                            border: `1px solid ${isSelected ? "#22c55e" : "transparent"}`,
                          }}
                        >
                          {isSelected ? "EQUIPPED" : "SELECT"}
                        </span>
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>
                        {b.description}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px", fontSize: "10px", fontFamily: "var(--font-mono)" }}>
                        <span style={{ color: "#38bdf8" }}>{b.capacityWh} Wh</span>
                        <span style={{ color: "#94a3b8" }}>{b.massKg} kg</span>
                        <span style={{ color: "#f59e0b" }}>{b.costCredits} Cr</span>
                      </div>
                    </div>
                  );
                })}

              {/* PAYLOAD TAB */}
              {workshopActiveTab === "PAYLOAD" &&
                PAYLOAD_CATALOG.map((p) => {
                  const isSelected = payloadId === p.id;
                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        soundManager.playEquip();
                        setPayloadId(p.id);
                      }}
                      style={{
                        padding: "10px 12px",
                        backgroundColor: isSelected ? "rgba(14, 116, 144, 0.2)" : "var(--color-surface-2)",
                        border: isSelected ? "1.5px solid #22c55e" : "1px solid var(--color-border-subtle)",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        boxShadow: isSelected ? "0 0 12px rgba(34, 197, 94, 0.2)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: isSelected ? "#22c55e" : "#ffffff" }}>
                          {p.name}
                        </span>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "2px",
                            backgroundColor: isSelected ? "rgba(34, 197, 94, 0.25)" : "var(--color-surface-3)",
                            color: isSelected ? "#22c55e" : "var(--color-text-muted)",
                            border: `1px solid ${isSelected ? "#22c55e" : "transparent"}`,
                          }}
                        >
                          {isSelected ? "EQUIPPED" : "SELECT"}
                        </span>
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>
                        {p.description}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px", fontSize: "10px", fontFamily: "var(--font-mono)" }}>
                        <span style={{ color: "#f87171" }}>-{p.powerWatts} W</span>
                        <span style={{ color: "#38bdf8" }}>{p.dataRateMbps} Mbps</span>
                        <span style={{ color: "#f59e0b" }}>{p.costCredits} Cr</span>
                      </div>
                    </div>
                  );
                })}

              {/* PROPULSION TAB */}
              {workshopActiveTab === "PROPULSION" &&
                PROPULSION_CATALOG.map((pr) => {
                  const isSelected = propulsionId === pr.id;
                  return (
                    <div
                      key={pr.id}
                      onClick={() => {
                        soundManager.playEquip();
                        setPropulsionId(pr.id);
                      }}
                      style={{
                        padding: "10px 12px",
                        backgroundColor: isSelected ? "rgba(14, 116, 144, 0.2)" : "var(--color-surface-2)",
                        border: isSelected ? "1.5px solid #22c55e" : "1px solid var(--color-border-subtle)",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        boxShadow: isSelected ? "0 0 12px rgba(34, 197, 94, 0.2)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: isSelected ? "#22c55e" : "#ffffff" }}>
                          {pr.name}
                        </span>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "2px",
                            backgroundColor: isSelected ? "rgba(34, 197, 94, 0.25)" : "var(--color-surface-3)",
                            color: isSelected ? "#22c55e" : "var(--color-text-muted)",
                            border: `1px solid ${isSelected ? "#22c55e" : "transparent"}`,
                          }}
                        >
                          {isSelected ? "EQUIPPED" : "SELECT"}
                        </span>
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>
                        {pr.description}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px", fontSize: "10px", fontFamily: "var(--font-mono)" }}>
                        <span style={{ color: "#38bdf8" }}>{pr.ispSeconds > 0 ? `Isp ${pr.ispSeconds}s` : "0 Δv"}</span>
                        <span style={{ color: "#94a3b8" }}>{pr.dryMassKg + pr.propMassKg} kg</span>
                        <span style={{ color: "#f59e0b" }}>{pr.costCredits} Cr</span>
                      </div>
                    </div>
                  );
                })}

              {/* TELECOM TAB */}
              {workshopActiveTab === "TELECOM" &&
                TELECOM_CATALOG.map((t) => {
                  const isSelected = telecomId === t.id;
                  return (
                    <div
                      key={t.id}
                      onClick={() => {
                        soundManager.playEquip();
                        setTelecomId(t.id);
                      }}
                      style={{
                        padding: "10px 12px",
                        backgroundColor: isSelected ? "rgba(14, 116, 144, 0.2)" : "var(--color-surface-2)",
                        border: isSelected ? "1.5px solid #22c55e" : "1px solid var(--color-border-subtle)",
                        borderRadius: "4px",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        boxShadow: isSelected ? "0 0 12px rgba(34, 197, 94, 0.2)" : "none",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: isSelected ? "#22c55e" : "#ffffff" }}>
                          {t.name}
                        </span>
                        <span
                          style={{
                            fontSize: "9px",
                            fontWeight: 700,
                            padding: "2px 6px",
                            borderRadius: "2px",
                            backgroundColor: isSelected ? "rgba(34, 197, 94, 0.25)" : "var(--color-surface-3)",
                            color: isSelected ? "#22c55e" : "var(--color-text-muted)",
                            border: `1px solid ${isSelected ? "#22c55e" : "transparent"}`,
                          }}
                        >
                          {isSelected ? "EQUIPPED" : "SELECT"}
                        </span>
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--color-text-secondary)" }}>
                        {t.description}
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px", fontSize: "10px", fontFamily: "var(--font-mono)" }}>
                        <span style={{ color: "#38bdf8" }}>{t.rfPowerWatts} W RF</span>
                        <span style={{ color: "#22c55e" }}>+{t.gainDbi} dBi</span>
                        <span style={{ color: "#f59e0b" }}>{t.costCredits} Cr</span>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Plain-English Compliance Guidance Callout */}
            <div
              style={{
                marginTop: "auto",
                padding: "8px 10px",
                backgroundColor: launchReady ? "rgba(34, 197, 94, 0.12)" : "rgba(239, 68, 68, 0.12)",
                border: `1px solid ${launchReady ? "rgba(34, 197, 94, 0.4)" : "rgba(239, 68, 68, 0.4)"}`,
                borderRadius: "4px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
              }}
            >
              <div style={{ fontSize: "11px", fontWeight: 700, color: launchReady ? "#22c55e" : "#ef4444", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {launchReady ? "Flight Ready for Launch" : "Action Required for Clearance"}
              </div>
              {launchReady ? (
                <div style={{ fontSize: "10px", color: "var(--color-text-secondary)", lineHeight: 1.35 }}>
                  All engineering constraints satisfied. Subsystems verified to NASA LSP-REQ-317.01 standards.
                </div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: "14px", fontSize: "10px", color: "var(--color-text-secondary)", lineHeight: 1.35 }}>
                  {guidanceTips.map((tip, idx) => (
                    <li key={idx} style={{ marginBottom: "2px" }}>{tip}</li>
                  ))}
                </ul>
              )}
            </div>

            {/* Proceed to Launch Sequence */}
            <div>
              <button
                disabled={!launchReady}
                onClick={startLaunchSequence}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: launchReady ? "rgba(34, 197, 94, 0.25)" : "var(--color-surface-2)",
                  color: launchReady ? "#ffffff" : "var(--color-text-disabled)",
                  border: launchReady ? "1.5px solid #22c55e" : "1px solid var(--color-border-subtle)",
                  fontWeight: 700,
                  fontSize: "var(--text-xs)",
                  cursor: launchReady ? "pointer" : "not-allowed",
                  borderRadius: "4px",
                  boxShadow: launchReady ? "0 0 15px rgba(34, 197, 94, 0.35)" : "none",
                  transition: "all 0.15s ease",
                }}
              >
                {launchReady ? "PROCEED TO LAUNCH PREPARATION →" : "CONSTRAINTS UNMET TO LAUNCH"}
              </button>
            </div>
          </aside>

          {/* Right 3D Visualizer & Live Verification Matrix */}
          <div style={{ display: "grid", gridTemplateRows: "1fr 240px", height: "100%", overflow: "hidden" }}>
            <div style={{ position: "relative", width: "100%", height: "100%", backgroundColor: "var(--color-surface-sunken)" }}>
              {/* Floating Tactical Hangar Toolbar */}
              <div style={{ position: "absolute", top: "var(--space-3)", left: "var(--space-4)", zIndex: 10, display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ display: "flex", gap: "1px", backgroundColor: "rgba(18, 21, 27, 0.85)", border: "1px solid var(--color-border-subtle)", borderRadius: "3px", overflow: "hidden" }}>
                  <button
                    onClick={() => {
                      soundManager.playEquip();
                      setViewMode("SPACECRAFT");
                    }}
                    style={{ padding: "4px 8px", fontSize: "11px", fontWeight: 600, backgroundColor: viewMode === "SPACECRAFT" ? "var(--color-surface-elevated)" : "transparent", color: viewMode === "SPACECRAFT" ? "#38bdf8" : "var(--color-text-muted)", cursor: "pointer" }}
                  >
                    Spacecraft Model
                  </button>
                  <button
                    onClick={() => {
                      soundManager.playEquip();
                      setViewMode("ORBIT");
                    }}
                    style={{ padding: "4px 8px", fontSize: "11px", fontWeight: 600, backgroundColor: viewMode === "ORBIT" ? "var(--color-surface-elevated)" : "transparent", color: viewMode === "ORBIT" ? "#38bdf8" : "var(--color-text-muted)", cursor: "pointer" }}
                  >
                    Orbital Context
                  </button>
                </div>

                {/* 3D Hangar Interactive Test Triggers */}
                <button
                  onClick={() => {
                    soundManager.playGearDeploy();
                    setSolarArrayDeployedInHangar(!solarArrayDeployedInHangar);
                  }}
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontWeight: 600,
                    backgroundColor: solarArrayDeployedInHangar ? "rgba(34, 197, 94, 0.2)" : "rgba(100, 116, 139, 0.2)",
                    border: `1px solid ${solarArrayDeployedInHangar ? "#22c55e" : "rgba(100, 116, 139, 0.5)"}`,
                    color: solarArrayDeployedInHangar ? "#22c55e" : "#94a3b8",
                    borderRadius: "3px",
                    cursor: "pointer",
                  }}
                >
                  [WINGS: {solarArrayDeployedInHangar ? "DEPLOYED" : "RETRACTED"}]
                </button>

                <button
                  disabled={propulsionId === "NONE"}
                  onClick={() => {
                    if (propulsionId !== "NONE") {
                      soundManager.playThrusterPuff();
                      setHangarThrusterActive(true);
                      setTimeout(() => setHangarThrusterActive(false), 2000);
                    }
                  }}
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontWeight: 600,
                    backgroundColor: hangarThrusterActive ? "rgba(245, 158, 11, 0.3)" : "rgba(15, 23, 42, 0.75)",
                    border: `1px solid ${hangarThrusterActive ? "#f59e0b" : "rgba(245, 158, 11, 0.4)"}`,
                    color: propulsionId === "NONE" ? "var(--color-text-disabled)" : hangarThrusterActive ? "#fbbf24" : "#f59e0b",
                    borderRadius: "3px",
                    cursor: propulsionId === "NONE" ? "not-allowed" : "pointer",
                  }}
                >
                  {hangarThrusterActive ? "[THRUSTER FIRING!]" : "[TEST THRUSTER PLUME]"}
                </button>

                <button
                  onClick={() => {
                    soundManager.playFlashlight();
                    setHangarEclipseActive(!hangarEclipseActive);
                  }}
                  style={{
                    padding: "4px 10px",
                    fontSize: "11px",
                    fontWeight: 600,
                    backgroundColor: hangarEclipseActive ? "rgba(56, 189, 248, 0.25)" : "rgba(15, 23, 42, 0.75)",
                    border: `1px solid ${hangarEclipseActive ? "#38bdf8" : "rgba(56, 189, 248, 0.4)"}`,
                    color: hangarEclipseActive ? "#38bdf8" : "#94a3b8",
                    borderRadius: "3px",
                    cursor: "pointer",
                  }}
                >
                  [ECLIPSE: {hangarEclipseActive ? "SHADOW" : "SUNLIGHT"}]
                </button>

                <div style={{ padding: "4px 8px", backgroundColor: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(56, 189, 248, 0.3)", borderRadius: "3px", fontSize: "10px", color: "#38bdf8", fontFamily: "var(--font-mono)" }}>
                  [DRAG 3D MODEL TO ROTATE 360° · SCROLL TO ZOOM]
                </div>
              </div>

              <SpacecraftViewport
                busSize={formFactor}
                viewMode={viewMode}
                solarArrayType={solarArray}
                solarArrayDeployed={solarArrayDeployedInHangar}
                payloadType={payloadId}
                antennaType={telecomId}
                hasPropulsion={propulsionId !== "NONE"}
                thrusterActive={hangarThrusterActive}
                isEclipse={hangarEclipseActive}
                orbitAltitudeKm={contract.altitudeKm}
              />
            </div>

            {/* Live Verification Gauges (Tactical Flight Matrix) */}
            <div style={{ backgroundColor: "var(--color-surface-1)", borderTop: "1px solid var(--color-border-subtle)", padding: "var(--space-3) var(--space-5)", overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Engineering Verification Matrix // JPL CML 4 Standard
                </span>
                <span className="font-mono" style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                  CDS Rev 14.1 / NASA LSP-REQ-317.01
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "var(--space-3)" }}>
                {/* 1. MASS BUDGET GAUGE */}
                <div style={{ backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-border-subtle)", borderRadius: "4px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                    <span style={{ color: "var(--color-text-secondary)", fontWeight: 600 }}>Dry Mass (CBE+15%)</span>
                    <span className="font-mono" style={{ color: massMarginNominal ? "#22c55e" : massCompliant ? "#f59e0b" : "#ef4444" }}>
                      {massMarginNominal ? "NOMINAL" : massCompliant ? "WARNING" : "EXCEEDED"}
                    </span>
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                    {dryMassMevKg.toFixed(2)} kg <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>/ ≤{cdsLimitKg.toFixed(1)} kg</span>
                  </div>
                  <div style={{ width: "100%", height: "4px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, (dryMassMevKg / cdsLimitKg) * 100)}%`, height: "100%", backgroundColor: massCompliant ? "#22c55e" : "#ef4444" }} />
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                    Margin: {dryMassMarginPercent >= 0 ? `+${dryMassMarginPercent.toFixed(1)}%` : `${dryMassMarginPercent.toFixed(1)}%`} (Req ≥35%)
                  </div>
                </div>

                {/* 2. POWER BALANCE GAUGE */}
                <div style={{ backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-border-subtle)", borderRadius: "4px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                    <span style={{ color: "var(--color-text-secondary)", fontWeight: 600 }}>Power Balance</span>
                    <span className="font-mono" style={{ color: powerMarginPercent >= 35 ? "#22c55e" : powerPositive ? "#f59e0b" : "#ef4444" }}>
                      {powerMarginPercent >= 35 ? "SURPLUS" : powerPositive ? "LOW" : "DEFICIT"}
                    </span>
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                    +{solarGenWatts.toFixed(1)} W <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>/ -{totalNominalLoadW.toFixed(1)} W</span>
                  </div>
                  <div style={{ width: "100%", height: "4px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, (totalNominalLoadW / Math.max(1, solarGenWatts)) * 100)}%`, height: "100%", backgroundColor: powerPositive ? "#22c55e" : "#ef4444" }} />
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                    Headroom: {powerMarginPercent >= 0 ? `+${powerMarginPercent.toFixed(1)}%` : `${powerMarginPercent.toFixed(1)}%`}
                  </div>
                </div>

                {/* 3. BATTERY DoD GAUGE */}
                <div style={{ backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-border-subtle)", borderRadius: "4px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                    <span style={{ color: "var(--color-text-secondary)", fontWeight: 600 }}>Eclipse Battery DoD</span>
                    <span className="font-mono" style={{ color: dodNominal ? "#22c55e" : !dodSafeModeRisk ? "#f59e0b" : "#ef4444" }}>
                      {dodFatalRisk ? "BLACKOUT" : dodSafeModeRisk ? "RISK" : dodNominal ? "NOMINAL" : "DEGRADED"}
                    </span>
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                    {estimatedEclipseDodPercent.toFixed(1)}% DoD <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>({energyConsumedDuringEclipseWh.toFixed(1)} Wh)</span>
                  </div>
                  <div style={{ width: "100%", height: "4px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, (estimatedEclipseDodPercent / 25.0) * 100)}%`, height: "100%", backgroundColor: dodNominal ? "#22c55e" : "#ef4444" }} />
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                    Safe Floor: &lt; 25% (35m shadow)
                  </div>
                </div>

                {/* 4. RF LINK MARGIN GAUGE */}
                <div style={{ backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-border-subtle)", borderRadius: "4px", padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px" }}>
                    <span style={{ color: "var(--color-text-secondary)", fontWeight: 600 }}>RF Link Margin</span>
                    <span className="font-mono" style={{ color: linkMarginNominal ? "#22c55e" : "#ef4444" }}>
                      {linkMarginNominal ? "FEASIBLE" : "LINK DROP"}
                    </span>
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, fontFamily: "var(--font-mono)" }}>
                    {estimatedLinkMarginDb >= 0 ? `+${estimatedLinkMarginDb.toFixed(1)} dB` : `${estimatedLinkMarginDb.toFixed(1)} dB`} <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>/ ≥ 6.0 dB</span>
                  </div>
                  <div style={{ width: "100%", height: "4px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                    <div style={{ width: `${Math.min(100, Math.max(0, (estimatedLinkMarginDb / 15.0) * 100))}%`, height: "100%", backgroundColor: linkMarginNominal ? "#22c55e" : "#ef4444" }} />
                  </div>
                  <div style={{ fontSize: "10px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
                    NASA Req: ≥ 6.0 dB @ {contract.altitudeKm} km
                  </div>
                </div>
              </div>

              {/* Bottom Launch & Verification Action Strip */}
              <div style={{ marginTop: "10px", display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "8px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span className={`status-dot ${launchReady ? "status-dot-nominal" : "status-dot-critical"}`} />
                  <span className="font-mono" style={{ fontSize: "11px", fontWeight: 700, color: launchReady ? "#22c55e" : "#ef4444" }}>
                    {launchReady ? "FLIGHT CERTIFIED // ALL JPL CML 4 MARGINS VERIFIED NOMINAL" : "FLIGHT REJECTED // RESOLVE MARGIN WARNINGS TO CLEAR LAUNCH"}
                  </span>
                </div>
                <button
                  disabled={!launchReady}
                  onClick={startLaunchSequence}
                  style={{
                    padding: "8px 24px",
                    backgroundColor: launchReady ? "#0284c7" : "rgba(100, 116, 139, 0.2)",
                    border: `1.5px solid ${launchReady ? "#38bdf8" : "rgba(100, 116, 139, 0.4)"}`,
                    color: launchReady ? "#ffffff" : "#64748b",
                    fontSize: "11px",
                    fontWeight: 800,
                    borderRadius: "4px",
                    cursor: launchReady ? "pointer" : "not-allowed",
                    letterSpacing: "0.06em",
                    boxShadow: launchReady ? "0 0 18px rgba(56, 189, 248, 0.45)" : "none",
                    whiteSpace: "nowrap",
                  }}
                >
                  {launchReady ? "PROCEED TO LAUNCH COUNTDOWN →" : "RESOLVE WARNINGS TO LAUNCH"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ============================================================================
  // STAGE 5: LAUNCH PREPARATION & COUNTDOWN (Authentic Launch Experience)
  // ============================================================================
  if (stage === "LAUNCH_PREP") {
    return (
      <main style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", backgroundColor: "#06080c", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        {/* Background 3D View */}
        <div style={{ position: "absolute", inset: 0, opacity: 0.35 }}>
          <SpacecraftViewport
            busSize={formFactor}
            viewMode="SPACECRAFT"
            solarArrayType={solarArray}
            solarArrayDeployed={false}
            payloadType={payloadId}
            antennaType={telecomId}
            hasPropulsion={propulsionId !== "NONE"}
            isEclipse={false}
          />
        </div>

        <div className="panel" style={{ position: "relative", zIndex: 10, maxWidth: "600px", width: "100%", padding: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-5)" }}>
          <div style={{ borderBottom: "1px solid var(--color-border-subtle)", paddingBottom: "var(--space-3)" }}>
            <span className="font-mono" style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>MISSION LAUNCH SEQUENCE</span>
            <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 700, marginTop: "2px" }}>Falcon 9 // CSLI Flight Operations</h2>
          </div>

          {/* GO / NO-GO Flight Poll */}
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", fontSize: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>CML-4 Dry Mass Budget (≥35.0%)</span>
              <span className="font-mono" style={{ color: "var(--color-status-nominal)" }}>GO (+{dryMassMarginPercent.toFixed(1)}%)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Photovoltaic Sunlight Generation</span>
              <span className="font-mono" style={{ color: "var(--color-status-nominal)" }}>GO ({solarGenWatts.toFixed(1)} W vs {totalNominalLoadW.toFixed(1)} W)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Battery Eclipse Endurance (&lt;70% DoD)</span>
              <span className="font-mono" style={{ color: "var(--color-status-nominal)" }}>GO ({estimatedEclipseDodPercent.toFixed(1)}% DoD)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>RF Link Closure at {contract.altitudeKm} km</span>
              <span className="font-mono" style={{ color: "var(--color-status-nominal)" }}>GO (+{estimatedLinkMarginDb.toFixed(1)} dB)</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>CDS Rev 14.1 Range Safety Inhibits</span>
              <span className="font-mono" style={{ color: "var(--color-status-nominal)" }}>ARMED (§2.4.4 &amp; §2.4.5)</span>
            </div>
          </div>

          {/* Countdown Clock */}
          <div style={{ textAlign: "center", padding: "var(--space-4) 0", backgroundColor: "var(--color-surface-2)", border: "1px solid var(--color-border-subtle)" }}>
            <div className="font-mono" style={{ fontSize: "var(--text-2xl)", fontWeight: 700, color: countdownSeconds && countdownSeconds <= 3 ? "var(--color-status-nominal)" : "var(--color-text-primary)" }}>
              {countdownSeconds !== null && countdownSeconds > 0 ? `T - 00:00:${countdownSeconds.toString().padStart(2, "0")}` : "LIFTOFF & DEPLOYMENT"}
            </div>
            <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)", marginTop: "4px" }}>
              {launchStageMessage}
            </p>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={() => {
                setCountdownSeconds(null);
                setStage("WORKSHOP");
              }}
              style={{ padding: "6px 14px", backgroundColor: "transparent", color: "var(--color-text-muted)", fontSize: "11px" }}
            >
              Abort Countdown
            </button>
          </div>
        </div>
      </main>
    );
  }

  // ============================================================================
  // STAGE 6: SPACE GAMEPLAY (Active Orbit Operations & Decisions)
  // ============================================================================
  if (stage === "SPACE_GAMEPLAY") {
    return (
      <main style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", overflow: "hidden", backgroundColor: "#06080c" }}>
        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 var(--space-5)", height: "50px", borderBottom: "1px solid rgba(56, 189, 248, 0.25)", backgroundColor: "rgba(10, 15, 26, 0.94)", backdropFilter: "blur(12px)", position: "relative", zIndex: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <h1 style={{ fontSize: "var(--text-sm)", fontWeight: 700, color: "#ffffff" }}>{contract.code} {"//"} Flight Control Center</h1>
            <div style={{ width: "1px", height: "12px", backgroundColor: "rgba(255, 255, 255, 0.2)" }} />
            <span style={{ fontSize: "11px", color: "#38bdf8", fontFamily: "var(--font-mono)" }}>{contract.orbitType} · {contract.altitudeKm} km</span>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginLeft: "10px", padding: "2px 8px", backgroundColor: "rgba(15, 23, 42, 0.8)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "3px" }}>
              <span className={`status-dot ${fatalBlackout ? "status-dot-critical" : safeModeActive ? "status-dot-caution" : "status-dot-nominal"}`} />
              <span className="font-mono" style={{ fontSize: "10px", fontWeight: 700, color: fatalBlackout ? "#ef4444" : safeModeActive ? "#fbbf24" : "#22c55e" }}>
                {fatalBlackout ? "BLACKOUT" : safeModeActive ? "SAFE MODE" : operatingMode}
              </span>
            </div>
          </div>

          {/* Quick Mission Objective Bar */}
          <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "rgba(15, 23, 42, 0.8)", padding: "4px 12px", borderRadius: "4px", border: "1px solid rgba(56, 189, 248, 0.2)" }}>
            <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>DOWNLINK:</span>
            <span className="font-mono" style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 700 }}>
              {dataDownlinkedMb.toFixed(0)} / {contract.scienceTargetMb} Mb ({scienceCompletionPercent.toFixed(0)}%)
            </span>
            <div style={{ width: "60px", height: "5px", backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ width: `${Math.min(100, scienceCompletionPercent)}%`, height: "100%", backgroundColor: scienceCompletionPercent >= 100 ? "#22c55e" : "#38bdf8" }} />
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button
              onClick={() => setShowConsoleFeed(!showConsoleFeed)}
              style={{ padding: "4px 10px", fontSize: "10px", fontWeight: 700, backgroundColor: showConsoleFeed ? "#0284c7" : "rgba(15, 23, 42, 0.8)", color: showConsoleFeed ? "#ffffff" : "#38bdf8", border: "1px solid rgba(56, 189, 248, 0.4)", borderRadius: "3px", cursor: "pointer" }}
            >
              CONSOLE ({telemetryLogs.length})
            </button>
            <button
              onClick={handleEndMission}
              style={{ padding: "4px 10px", fontSize: "10px", fontWeight: 700, backgroundColor: "rgba(239, 68, 68, 0.2)", color: "#f87171", border: "1px solid rgba(239, 68, 68, 0.4)", borderRadius: "3px", cursor: "pointer" }}
            >
              END FLIGHT
            </button>
          </div>
        </header>

        {/* Space Operations Fullscreen Viewport Container */}
        <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
          {/* Main 3D Orbital Canvas */}
          <div style={{ position: "absolute", inset: 0, width: "100%", height: "100%", backgroundColor: "#06080c" }}>
            {/* Top-Left Status Overlay */}
            <div style={{ position: "absolute", top: "var(--space-3)", left: "var(--space-4)", zIndex: 10, display: "flex", alignItems: "center", gap: "var(--space-3)", backgroundColor: "rgba(18, 21, 27, 0.85)", padding: "4px 8px", border: "1px solid var(--color-border-subtle)" }}>
              <div style={{ display: "flex", gap: "1px" }}>
                <button
                  onClick={() => setViewMode("ORBIT")}
                  style={{ padding: "2px 6px", fontSize: "11px", fontWeight: 500, backgroundColor: viewMode === "ORBIT" ? "var(--color-surface-elevated)" : "transparent", color: viewMode === "ORBIT" ? "var(--color-text-primary)" : "var(--color-text-muted)" }}
                >
                  Orbit View
                </button>
                <button
                  onClick={() => setViewMode("SPACECRAFT")}
                  style={{ padding: "2px 6px", fontSize: "11px", fontWeight: 500, backgroundColor: viewMode === "SPACECRAFT" ? "var(--color-surface-elevated)" : "transparent", color: viewMode === "SPACECRAFT" ? "var(--color-text-primary)" : "var(--color-text-muted)" }}
                >
                  Spacecraft View
                </button>
              </div>

              <div style={{ width: "1px", height: "10px", backgroundColor: "var(--color-border-subtle)" }} />

              <span className="font-mono" style={{ fontSize: "11px", color: inEclipse ? "var(--color-status-caution)" : "var(--color-text-secondary)" }}>
                {inEclipse ? "Earth Umbra (Eclipse)" : "Direct Sunlight"}
              </span>

              {activeGroundStation && (
                <>
                  <div style={{ width: "1px", height: "10px", backgroundColor: "var(--color-border-subtle)" }} />
                  <span className="font-mono" style={{ fontSize: "11px", color: "var(--color-status-nominal)" }}>
                    AOS: {activeGroundStation}
                  </span>
                </>
              )}

              {solarFlareActive && (
                <>
                  <div style={{ width: "1px", height: "10px", backgroundColor: "var(--color-border-subtle)" }} />
                  <span className="font-mono" style={{ fontSize: "11px", color: "var(--color-status-caution)" }}>
                    Solar Storm Alert
                  </span>
                </>
              )}
            </div>

            {/* Top-Right Time Controls */}
            <div style={{ position: "absolute", top: "var(--space-3)", right: "var(--space-4)", zIndex: 10, display: "flex", alignItems: "center", gap: "var(--space-2)", backgroundColor: "rgba(18, 21, 27, 0.85)", padding: "3px 6px", border: "1px solid var(--color-border-subtle)" }}>
              <button
                onClick={() => setSimRunning(!simRunning)}
                style={{ padding: "3px 8px", fontSize: "11px", fontWeight: 600, backgroundColor: "var(--color-surface-elevated)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-default)" }}
              >
                {simRunning ? "Pause" : "Resume"}
              </button>

              <div style={{ display: "flex", gap: "1px", backgroundColor: "var(--color-surface-2)" }}>
                {[1, 5, 20, 60].map((speed) => (
                  <button
                    key={speed}
                    onClick={() => setSimSpeed(speed)}
                    style={{ padding: "3px 6px", fontSize: "10px", fontWeight: 500, backgroundColor: simSpeed === speed ? "var(--color-surface-elevated)" : "transparent", color: simSpeed === speed ? "var(--color-text-primary)" : "var(--color-text-muted)" }}
                  >
                    {speed}×
                  </button>
                ))}
              </div>

              <button
                onClick={handleEndMission}
                style={{ padding: "3px 8px", fontSize: "11px", backgroundColor: "transparent", color: "var(--color-text-secondary)", border: "1px solid var(--color-border-subtle)" }}
              >
                End Mission
              </button>
            </div>

            {/* 3D Viewport Component */}
            <SpacecraftViewport
              busSize={formFactor}
              viewMode={viewMode}
              solarArrayType={solarArray}
              solarArrayDeployed={solarArrayDeployed || activeSolar.id === "BODY_MOUNTED"}
              payloadType={payloadId}
              antennaType={telecomId}
              hasPropulsion={propulsionId !== "NONE"}
              thrusterActive={thrusterActive}
              isEclipse={inEclipse}
              orbitAltitudeKm={contract.altitudeKm}
              orbitProgress={orbitProgress}
              activeStationName={activeGroundStation}
            />

            {/* On-Screen Interactive 3D Tactical Flight Controls Bar */}
            <div
              style={{
                position: "absolute",
                bottom: "44px",
                left: "50%",
                transform: "translateX(-50%)",
                zIndex: 10,
                display: "flex",
                gap: "6px",
                backgroundColor: "rgba(10, 15, 26, 0.9)",
                padding: "8px 12px",
                border: "1px solid rgba(56, 189, 248, 0.4)",
                borderRadius: "6px",
                backdropFilter: "blur(12px)",
                boxShadow: "0 0 25px rgba(0, 0, 0, 0.8)",
                alignItems: "center",
              }}
            >
              <div style={{ fontSize: "10px", fontWeight: 700, color: "#38bdf8", marginRight: "6px", fontFamily: "var(--font-mono)" }}>
                PILOT HUD:
              </div>

              <button
                disabled={propellantRemainingKg <= 0.02 || thrusterActive || fatalBlackout}
                onClick={handleExecuteBurn}
                style={{
                  padding: "6px 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  backgroundColor: thrusterActive ? "rgba(245, 158, 11, 0.4)" : "rgba(15, 23, 42, 0.8)",
                  border: "1px solid #f59e0b",
                  color: "#fbbf24",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
                title="Fire Prograde Burn [W / Up Arrow] (+14.5km Altitude, +40 m/s ΔV)"
              >
                [W] PROGRADE (+ΔV)
              </button>

              <button
                disabled={propellantRemainingKg <= 0.02 || thrusterActive || fatalBlackout}
                onClick={handleRetrogradeBurn}
                style={{
                  padding: "6px 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  backgroundColor: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid #ef4444",
                  color: "#f87171",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
                title="Fire Retrograde Burn [S / Down Arrow] (-14.5km Altitude, Braking ΔV)"
              >
                [S] RETROGRADE (-ΔV)
              </button>

              <button
                disabled={safeModeActive || fatalBlackout}
                onClick={() => {
                  soundManager.playEquip();
                  setOperatingMode("SCIENCE");
                  addLog("MODE CHANGED [1]: Science Mode active.", "nominal");
                }}
                style={{
                  padding: "6px 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  backgroundColor: operatingMode === "SCIENCE" ? "rgba(2, 132, 199, 0.4)" : "rgba(15, 23, 42, 0.8)",
                  border: operatingMode === "SCIENCE" ? "1px solid #38bdf8" : "1px solid rgba(255,255,255,0.15)",
                  color: operatingMode === "SCIENCE" ? "#38bdf8" : "#94a3b8",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
                title="Switch to Science Operating Mode [1]"
              >
                [1] SCIENCE
              </button>

              <button
                disabled={safeModeActive || fatalBlackout}
                onClick={() => {
                  soundManager.playEquip();
                  setOperatingMode("CONSERVE");
                  addLog("MODE CHANGED [2]: Conserve Mode active.", "caution");
                }}
                style={{
                  padding: "6px 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  backgroundColor: operatingMode === "CONSERVE" ? "rgba(245, 158, 11, 0.4)" : "rgba(15, 23, 42, 0.8)",
                  border: operatingMode === "CONSERVE" ? "1px solid #f59e0b" : "1px solid rgba(255,255,255,0.15)",
                  color: operatingMode === "CONSERVE" ? "#fbbf24" : "#94a3b8",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
                title="Switch to Battery Conserve Mode [2]"
              >
                [2] CONSERVE
              </button>

              <button
                disabled={safeModeActive || fatalBlackout}
                onClick={() => {
                  soundManager.playEquip();
                  setOperatingMode("COMMS_PRIORITY");
                  addLog("MODE CHANGED [3]: Comms Priority active.", "nominal");
                }}
                style={{
                  padding: "6px 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  backgroundColor: operatingMode === "COMMS_PRIORITY" ? "rgba(34, 197, 94, 0.4)" : "rgba(15, 23, 42, 0.8)",
                  border: operatingMode === "COMMS_PRIORITY" ? "1px solid #22c55e" : "1px solid rgba(255,255,255,0.15)",
                  color: operatingMode === "COMMS_PRIORITY" ? "#22c55e" : "#94a3b8",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
                title="Switch to Comms Priority Downlink Mode [3]"
              >
                [3] COMMS
              </button>

              <button
                onClick={handleSunTracking}
                style={{
                  padding: "6px 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  backgroundColor: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid #eab308",
                  color: "#fde047",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
                title="Lock Solar Arrays to Sun [R] (Recharges Battery)"
              >
                [R] SUN TRACK
              </button>

              <button
                disabled={dataBufferMb <= 0.1 || fatalBlackout}
                onClick={handleManualTelemetryDownlink}
                style={{
                  padding: "6px 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  backgroundColor: dataBufferMb > 0.1 ? "rgba(56, 189, 248, 0.25)" : "rgba(15, 23, 42, 0.8)",
                  border: "1px solid #38bdf8",
                  color: dataBufferMb > 0.1 ? "#38bdf8" : "var(--color-text-disabled)",
                  borderRadius: "3px",
                  cursor: dataBufferMb > 0.1 ? "pointer" : "not-allowed",
                }}
                title="Downlink Telemetry to Ground Station [T]"
              >
                [T] DOWNLINK
              </button>

              <button
                disabled={operatingMode === "CONSERVE" || fatalBlackout}
                onClick={handleCaptureEarthSnapshot}
                style={{
                  padding: "6px 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  backgroundColor: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid #22c55e",
                  color: "#22c55e",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
                title="Capture Earth Optical/Radar Sensor Scan [Space]"
              >
                [SPACE] SNAPSHOT
              </button>

              <button
                onClick={() => {
                  soundManager.playEquip();
                  setViewMode(viewMode === "ORBIT" ? "SPACECRAFT" : "ORBIT");
                }}
                style={{
                  padding: "6px 10px",
                  fontSize: "11px",
                  fontWeight: 700,
                  backgroundColor: "rgba(15, 23, 42, 0.8)",
                  border: "1px solid #a855f7",
                  color: "#c084fc",
                  borderRadius: "3px",
                  cursor: "pointer",
                }}
                title="Cycle Camera View: Orbit vs Satellite Close-Up [C]"
              >
                [C] {viewMode === "ORBIT" ? "VIEW CRAFT" : "VIEW ORBIT"}
              </button>
            </div>

            {/* Bottom Monospace Telemetry Strip */}
            <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "var(--space-2) var(--space-4)", borderTop: "1px solid var(--color-border-subtle)", backgroundColor: "rgba(12, 14, 18, 0.9)", display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "11px", color: "var(--color-text-secondary)" }}>
              <div className="font-mono" style={{ display: "flex", gap: "var(--space-5)" }}>
                <span>MET <strong style={{ color: "var(--color-text-primary)" }}>{formatMet(simMetSeconds)}</strong></span>
                <span>ORBIT <strong style={{ color: "var(--color-text-primary)" }}>{orbitCount}</strong> / 15</span>
                <span>ALT <strong style={{ color: "var(--color-text-primary)" }}>{currentAltitudeKm.toFixed(1)} km</strong></span>
                <span>VEL <strong style={{ color: "var(--color-text-primary)" }}>{currentVelocityKmS.toFixed(2)} km/s</strong></span>
                <span>TEMP <strong style={{ color: "var(--color-text-primary)" }}>{temperatureCelsius >= 0 ? `+${temperatureCelsius.toFixed(1)}` : temperatureCelsius.toFixed(1)}°C</strong></span>
                {activePropulsion.ispSeconds > 0 && (
                  <span>PROP <strong style={{ color: "var(--color-text-primary)" }}>{propellantRemainingKg.toFixed(2)} kg</strong></span>
                )}
              </div>
              <div className="font-mono" style={{ color: "var(--color-text-muted)" }}>
                SPEED: {simSpeed}×
              </div>
            </div>
          </div>

          {/* Right Flight Director Console Drawer */}
          {showConsoleFeed && (
            <aside style={{ position: "absolute", top: 0, right: 0, bottom: 0, width: "380px", zIndex: 30, borderLeft: "1px solid rgba(56, 189, 248, 0.3)", backgroundColor: "rgba(10, 15, 26, 0.95)", backdropFilter: "blur(14px)", boxShadow: "-10px 0 30px rgba(0,0,0,0.8)", display: "flex", flexDirection: "column", overflow: "hidden" }}>
            {/* Player Agency Flight Commands (Interactive Mission Flight Cockpit) */}
            <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--color-border-subtle)", display: "flex", flexDirection: "column", gap: "var(--space-3)", backgroundColor: "var(--color-surface-1)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                  Flight Director Command Deck
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "3px",
                    backgroundColor: safeModeActive ? "rgba(245, 158, 11, 0.2)" : fatalBlackout ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)",
                    color: safeModeActive ? "#fbbf24" : fatalBlackout ? "#ef4444" : "#22c55e",
                    border: `1px solid ${safeModeActive ? "#f59e0b" : fatalBlackout ? "#ef4444" : "#22c55e"}`,
                  }}
                >
                  {fatalBlackout ? "BLACKOUT" : safeModeActive ? "SAFE MODE" : operatingMode}
                </span>
              </div>

              {/* Operating Mode Buttons with Glowing Status */}
              <div>
                <div style={{ fontSize: "10px", color: "var(--color-text-muted)", marginBottom: "4px" }}>
                  Flight Operating Mode:
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "4px" }}>
                  <button
                    disabled={safeModeActive || fatalBlackout}
                    onClick={() => {
                      soundManager.playEquip();
                      setOperatingMode("SCIENCE");
                      addLog("MODE CHANGED: Science Mode active (Full sensor data generation).", "nominal");
                    }}
                    style={{
                      padding: "7px 4px",
                      textAlign: "center",
                      backgroundColor: operatingMode === "SCIENCE" ? "rgba(2, 132, 199, 0.3)" : "var(--color-surface-2)",
                      border: operatingMode === "SCIENCE" ? "1px solid #38bdf8" : "1px solid var(--color-border-subtle)",
                      borderRadius: "3px",
                      color: operatingMode === "SCIENCE" ? "#38bdf8" : "var(--color-text-muted)",
                      fontSize: "10px",
                      fontWeight: 700,
                      cursor: safeModeActive ? "not-allowed" : "pointer",
                      boxShadow: operatingMode === "SCIENCE" ? "0 0 10px rgba(56, 189, 248, 0.25)" : "none",
                    }}
                  >
                    SCIENCE
                  </button>

                  <button
                    disabled={safeModeActive || fatalBlackout}
                    onClick={() => {
                      soundManager.playEquip();
                      setOperatingMode("CONSERVE");
                      addLog("MODE CHANGED: Conserve Mode active (Payload shed to preserve power).", "caution");
                    }}
                    style={{
                      padding: "7px 4px",
                      textAlign: "center",
                      backgroundColor: operatingMode === "CONSERVE" ? "rgba(245, 158, 11, 0.25)" : "var(--color-surface-2)",
                      border: operatingMode === "CONSERVE" ? "1px solid #f59e0b" : "1px solid var(--color-border-subtle)",
                      borderRadius: "3px",
                      color: operatingMode === "CONSERVE" ? "#fbbf24" : "var(--color-text-muted)",
                      fontSize: "10px",
                      fontWeight: 700,
                      cursor: safeModeActive ? "not-allowed" : "pointer",
                      boxShadow: operatingMode === "CONSERVE" ? "0 0 10px rgba(245, 158, 11, 0.25)" : "none",
                    }}
                  >
                    CONSERVE
                  </button>

                  <button
                    disabled={safeModeActive || fatalBlackout}
                    onClick={() => {
                      soundManager.playEquip();
                      setOperatingMode("COMMS_PRIORITY");
                      addLog("MODE CHANGED: Comms Priority active (High-rate RF downlink).", "nominal");
                    }}
                    style={{
                      padding: "7px 4px",
                      textAlign: "center",
                      backgroundColor: operatingMode === "COMMS_PRIORITY" ? "rgba(34, 197, 94, 0.25)" : "var(--color-surface-2)",
                      border: operatingMode === "COMMS_PRIORITY" ? "1px solid #22c55e" : "1px solid var(--color-border-subtle)",
                      borderRadius: "3px",
                      color: operatingMode === "COMMS_PRIORITY" ? "#22c55e" : "var(--color-text-muted)",
                      fontSize: "10px",
                      fontWeight: 700,
                      cursor: safeModeActive ? "not-allowed" : "pointer",
                      boxShadow: operatingMode === "COMMS_PRIORITY" ? "0 0 10px rgba(34, 197, 94, 0.25)" : "none",
                    }}
                  >
                    COMMS
                  </button>
                </div>
              </div>

              {/* Active Tactical Flight Actions (Image 3 Game Mechanics) */}
              <div>
                <div style={{ fontSize: "10px", color: "var(--color-text-muted)", marginBottom: "4px" }}>
                  Interactive Flight Controls:
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {/* Action 1: Thruster Burn */}
                  {activePropulsion.ispSeconds > 0 && (
                    <button
                      disabled={propellantRemainingKg <= 0.02 || thrusterActive || fatalBlackout}
                      onClick={handleExecuteBurn}
                      style={{
                        padding: "8px 10px",
                        backgroundColor: thrusterActive ? "rgba(245, 158, 11, 0.35)" : propellantRemainingKg > 0.02 ? "rgba(245, 158, 11, 0.15)" : "var(--color-surface-2)",
                        border: `1px solid ${thrusterActive ? "#f59e0b" : propellantRemainingKg > 0.02 ? "rgba(245, 158, 11, 0.5)" : "var(--color-border-subtle)"}`,
                        borderRadius: "4px",
                        color: propellantRemainingKg > 0.02 ? "#fbbf24" : "var(--color-text-disabled)",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: propellantRemainingKg > 0.02 && !thrusterActive ? "pointer" : "not-allowed",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        boxShadow: thrusterActive ? "0 0 15px rgba(245, 158, 11, 0.4)" : "none",
                      }}
                    >
                      <span>{thrusterActive ? "[THRUSTER ROARING!]" : "[FIRE ORBITAL THRUSTER (+ΔV)]"}</span>
                      <span className="font-mono" style={{ fontSize: "10px" }}>{propellantRemainingKg.toFixed(2)} kg rem</span>
                    </button>
                  )}

                  {/* Action 2: Telemetry Downlink Burst */}
                  <button
                    disabled={dataBufferMb <= 0.1 || fatalBlackout}
                    onClick={handleManualTelemetryDownlink}
                    style={{
                      padding: "8px 10px",
                      backgroundColor: dataBufferMb > 0.1 ? "rgba(56, 189, 248, 0.15)" : "var(--color-surface-2)",
                      border: `1px solid ${dataBufferMb > 0.1 ? "#38bdf8" : "var(--color-border-subtle)"}`,
                      borderRadius: "4px",
                      color: dataBufferMb > 0.1 ? "#38bdf8" : "var(--color-text-disabled)",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: dataBufferMb > 0.1 ? "pointer" : "not-allowed",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      boxShadow: dataBufferMb > 0.1 ? "0 0 10px rgba(56, 189, 248, 0.2)" : "none",
                    }}
                  >
                    <span>[TRANSMIT TELEMETRY (AOS BURST)]</span>
                    <span className="font-mono" style={{ fontSize: "10px", color: "#22c55e" }}>+Credits</span>
                  </button>

                  {/* Action 3: Earth Multispectral Shutter */}
                  <button
                    disabled={operatingMode === "CONSERVE" || fatalBlackout}
                    onClick={handleCaptureEarthSnapshot}
                    style={{
                      padding: "8px 10px",
                      backgroundColor: operatingMode !== "CONSERVE" ? "rgba(34, 197, 94, 0.15)" : "var(--color-surface-2)",
                      border: `1px solid ${operatingMode !== "CONSERVE" ? "#22c55e" : "var(--color-border-subtle)"}`,
                      borderRadius: "4px",
                      color: operatingMode !== "CONSERVE" ? "#22c55e" : "var(--color-text-disabled)",
                      fontSize: "11px",
                      fontWeight: 700,
                      cursor: operatingMode !== "CONSERVE" ? "pointer" : "not-allowed",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      boxShadow: operatingMode !== "CONSERVE" ? "0 0 10px rgba(34, 197, 94, 0.2)" : "none",
                    }}
                  >
                    <span>[CAPTURE EARTH SNAPSHOT]</span>
                    <span className="font-mono" style={{ fontSize: "10px", color: "#38bdf8" }}>+Science</span>
                  </button>

                  {/* Action 4: Deploy Solar Arrays if stowed */}
                  {!solarArrayDeployed && activeSolar.id !== "BODY_MOUNTED" && (
                    <button
                      disabled={simMetSeconds < 1800 || fatalBlackout}
                      onClick={handleDeploySolarArrays}
                      style={{
                        padding: "8px 10px",
                        backgroundColor: simMetSeconds >= 1800 ? "rgba(56, 189, 248, 0.2)" : "var(--color-surface-2)",
                        border: "1px solid var(--color-border-subtle)",
                        borderRadius: "4px",
                        color: simMetSeconds >= 1800 ? "#ffffff" : "var(--color-text-disabled)",
                        fontSize: "11px",
                        fontWeight: 700,
                        cursor: simMetSeconds >= 1800 ? "pointer" : "not-allowed",
                      }}
                    >
                      [DEPLOY SOLAR WINGS]
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Subsystem Telemetry HUD Gauges */}
            <div style={{ padding: "var(--space-4)", borderBottom: "1px solid var(--color-border-subtle)", display: "flex", flexDirection: "column", gap: "10px", fontSize: "11px" }}>
              {/* Battery Energy Meter */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                  <span style={{ color: "var(--color-text-secondary)", fontWeight: 600 }}>Battery Storage</span>
                  <span className="font-mono" style={{ color: batteryDodPercent > 70 ? "#ef4444" : batteryDodPercent > 35 ? "#f59e0b" : "#22c55e" }}>
                    {batteryEnergyWh.toFixed(1)} / {activeBattery.capacityWh} Wh ({(100 - batteryDodPercent).toFixed(0)}%)
                  </span>
                </div>
                <div style={{ width: "100%", height: "6px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.max(0, 100 - batteryDodPercent)}%`,
                      height: "100%",
                      backgroundColor: batteryDodPercent > 70 ? "#ef4444" : batteryDodPercent > 35 ? "#f59e0b" : "#22c55e",
                      transition: "width 0.2s ease",
                    }}
                  />
                </div>
              </div>

              {/* Science Downlink Progress */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                  <span style={{ color: "var(--color-text-secondary)", fontWeight: 600 }}>Science Telemetry Downlinked</span>
                  <span className="font-mono" style={{ color: "#38bdf8" }}>
                    {dataDownlinkedMb.toFixed(1)} / {contract.scienceTargetMb} Mb ({scienceCompletionPercent.toFixed(0)}%)
                  </span>
                </div>
                <div style={{ width: "100%", height: "6px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(100, scienceCompletionPercent)}%`,
                      height: "100%",
                      backgroundColor: "#38bdf8",
                      boxShadow: "0 0 8px rgba(56, 189, 248, 0.5)",
                      transition: "width 0.2s ease",
                    }}
                  />
                </div>
              </div>

              {/* Onboard Buffer Occupancy */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "3px" }}>
                  <span style={{ color: "var(--color-text-secondary)", fontWeight: 600 }}>Onboard Buffer (SSR)</span>
                  <span className="font-mono" style={{ color: dataBufferMb > 1500 ? "#f59e0b" : "#94a3b8" }}>
                    {dataBufferMb.toFixed(1)} / 2048 Mb
                  </span>
                </div>
                <div style={{ width: "100%", height: "4px", backgroundColor: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${Math.min(100, (dataBufferMb / 2048) * 100)}%`,
                      height: "100%",
                      backgroundColor: dataBufferMb > 1500 ? "#f59e0b" : "#64748b",
                      transition: "width 0.2s ease",
                    }}
                  />
                </div>
              </div>

              {/* Flight Inhibit Countdown Status */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px", fontSize: "10px", fontFamily: "var(--font-mono)" }}>
                <div style={{ padding: "6px", backgroundColor: "var(--color-surface-2)", borderRadius: "3px", border: "1px solid var(--color-border-subtle)" }}>
                  <div style={{ color: "var(--color-text-muted)" }}>30m Wing Inhibit</div>
                  <div style={{ color: solarArrayDeployed ? "#22c55e" : "#f59e0b", fontWeight: 700, marginTop: "2px" }}>
                    {solarArrayDeployed ? "DEPLOYED" : `${Math.max(0, 30 - Math.floor(simMetSeconds / 60))}m left`}
                  </div>
                </div>
                <div style={{ padding: "6px", backgroundColor: "var(--color-surface-2)", borderRadius: "3px", border: "1px solid var(--color-border-subtle)" }}>
                  <div style={{ color: "var(--color-text-muted)" }}>45m RF Quiet</div>
                  <div style={{ color: rfQuietExpired ? "#22c55e" : "#f59e0b", fontWeight: 700, marginTop: "2px" }}>
                    {rfQuietExpired ? "ACTIVE" : `${Math.max(0, 45 - Math.floor(simMetSeconds / 60))}m left`}
                  </div>
                </div>
              </div>
            </div>

            {/* Console Log Feed */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "var(--space-3) var(--space-4)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "var(--space-2)" }}>
                <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                  Flight Console Feed
                </span>
                <span className="font-mono" style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>
                  {telemetryLogs.length} events
                </span>
              </div>

              <div
                ref={logContainerRef}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                {telemetryLogs.map((log) => (
                  <div
                    key={log.id}
                    style={{
                      display: "flex",
                      gap: "var(--space-2)",
                      color:
                        log.level === "critical"
                          ? "var(--color-status-critical)"
                          : log.level === "caution"
                          ? "var(--color-status-caution)"
                          : "var(--color-text-primary)",
                      lineHeight: 1.4,
                    }}
                  >
                    <span style={{ color: "var(--color-text-muted)", flexShrink: 0 }}>{log.metFormatted}</span>
                    <span>{log.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        )}

        {/* Mission Victory Modal Overlay */}
        {scienceCompletionPercent >= 100 && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              zIndex: 40,
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backdropFilter: "blur(8px)",
            }}
          >
            <div
              style={{
                width: "480px",
                backgroundColor: "rgba(10, 15, 26, 0.96)",
                border: "2px solid #22c55e",
                borderRadius: "8px",
                padding: "24px 28px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                boxShadow: "0 0 50px rgba(34, 197, 94, 0.4)",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "40px" }}>🏆</div>
              <div>
                <div className="font-mono" style={{ fontSize: "11px", color: "#22c55e", fontWeight: 700, letterSpacing: "0.1em" }}>
                  MISSION OBJECTIVE ACCOMPLISHED!
                </div>
                <h2 style={{ fontSize: "20px", fontWeight: 800, color: "#ffffff", marginTop: "4px" }}>
                  {contract.title}
                </h2>
                <p style={{ fontSize: "12px", color: "#94a3b8", marginTop: "6px", lineHeight: 1.5 }}>
                  All primary science telemetry packets delivered successfully. Design verified compliant under NASA JPL CML 4 standards.
                </p>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", backgroundColor: "rgba(15, 23, 42, 0.8)", padding: "12px", borderRadius: "4px", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
                <div>
                  <div style={{ fontSize: "9px", color: "#64748b", fontWeight: 700 }}>SCIENCE DOWNLINKED</div>
                  <div className="font-mono" style={{ fontSize: "14px", color: "#38bdf8", fontWeight: 800 }}>
                    {dataDownlinkedMb.toFixed(0)} Mb
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: "9px", color: "#64748b", fontWeight: 700 }}>CREDITS EARNED</div>
                  <div className="font-mono" style={{ fontSize: "14px", color: "#22c55e", fontWeight: 800 }}>
                    +{contract.rewardCredits.toLocaleString()} Cr
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                <button
                  onClick={handleEndMission}
                  style={{
                    padding: "10px 24px",
                    backgroundColor: "#0284c7",
                    border: "1.5px solid #38bdf8",
                    color: "#ffffff",
                    fontSize: "12px",
                    fontWeight: 700,
                    borderRadius: "4px",
                    cursor: "pointer",
                    boxShadow: "0 0 16px rgba(56, 189, 248, 0.4)",
                  }}
                >
                  RETURN TO MISSION DISPATCH →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}

  // ============================================================================
  // STAGE: FLIGHT ACADEMY & AEROSPACE ENGINEERING REFERENCE MANUAL
  // ============================================================================
  if (stage === "MANUAL") {
    return (
      <main style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", overflowY: "auto", backgroundColor: "var(--color-canvas)" }}>
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 var(--space-6)", height: "48px", borderBottom: "1px solid var(--color-border-subtle)", backgroundColor: "var(--color-surface-1)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
            <button onClick={() => setStage("MAIN_MENU")} style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
              ← Mission Hub
            </button>
            <div style={{ width: "1px", height: "12px", backgroundColor: "var(--color-border-default)" }} />
            <h1 style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Flight Academy &amp; Technical Manual // NASA &amp; CDS Standards</h1>
          </div>
          <div style={{ display: "flex", gap: "var(--space-3)" }}>
            <button
              onClick={() => setStage("FIRST_PERSON_GAME")}
              style={{
                padding: "6px 14px",
                backgroundColor: "#0284c7",
                color: "#f8fafc",
                border: "1px solid #38bdf8",
                fontSize: "var(--text-xs)",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              ▶ Play First-Person Mission
            </button>
            <button
              onClick={() => setStage("MAIN_MENU")}
              style={{
                padding: "6px 14px",
                backgroundColor: "var(--color-surface-2)",
                color: "var(--color-text-primary)",
                border: "1px solid var(--color-border-default)",
                fontSize: "var(--text-xs)",
                cursor: "pointer",
              }}
            >
              Return to Hub
            </button>
          </div>
        </header>

        <div style={{ flex: 1, padding: "var(--space-6)", maxWidth: "1100px", margin: "0 auto", width: "100%" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
            <div>
              <span className="font-mono" style={{ fontSize: "11px", color: "#38bdf8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Section 1 · Astronautics &amp; Flight Procedures
              </span>
              <h2 style={{ fontSize: "20px", fontWeight: 700, marginTop: "4px" }}>
                Mission 01: Orbital Station EVA &amp; Utility Shuttle Piloting
              </h2>
              <p style={{ fontSize: "13px", color: "var(--color-text-secondary)", marginTop: "6px", lineHeight: 1.6 }}>
                The first-person mission simulator trains astronauts in dual-mode space operations: pressurized station logistics, extravehicular spacewalk (EVA) zero-g repair on the AERO-3X Earth Observation CubeSat, and 6-DOF orbital shuttle flight and station docking.
              </p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
              <div className="panel" style={{ padding: "var(--space-4)" }}>
                <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "8px" }}>
                  Phase A: Station Exploration &amp; Zero-G EVA
                </h3>
                <ul style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6, paddingLeft: "16px" }}>
                  <li><strong>Command Deck:</strong> Review mission objectives at the central holographic terminal [E].</li>
                  <li><strong>Engineering Workshop:</strong> Collect the 3 repair parts (Aerospace Toolkit, 28W GaAs Solar Wing, S-Band Transceiver) from the workbenches.</li>
                  <li><strong>Life Support:</strong> Replenish oxygen and suit battery at the wall station [E] before EVA.</li>
                  <li><strong>Airlock Protocol:</strong> Cycle the airlock console [E] to depressurize to vacuum. Spacewalk along the exterior gantry.</li>
                  <li><strong>Satellite Repair:</strong> Perform the 4-step sequence on AERO-3X (detach debris, mount array, mount antenna, run diagnostics).</li>
                </ul>
              </div>

              <div className="panel" style={{ padding: "var(--space-4)" }}>
                <h3 style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-primary)", marginBottom: "8px" }}>
                  Phase B: 6-DOF Spacecraft Piloting &amp; Soft Capture
                </h3>
                <ul style={{ fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.6, paddingLeft: "16px" }}>
                  <li><strong>Boarding:</strong> Board the Orbital Utility Transport ORV-1 at the exterior gantry berth [E].</li>
                  <li><strong>6-DOF Controls:</strong> W/S for main thrust, A/D for yaw, Q/E for roll, Space/C for vertical RCS, X for retrograde brake / SAS stabilization.</li>
                  <li><strong>Approach Corridor:</strong> Align the shuttle nose with Station Docking Port DOCK-01 (at Z = -11.2).</li>
                  <li><strong>Capture Criteria:</strong> Relative velocity &le; 2.5 m/s, angular alignment &le; 25&deg;, distance &le; 2.2 m for magnetic soft capture latch.</li>
                  <li><strong>Mission Scoring:</strong> Performance scorecard evaluates mission elapsed time, propellant efficiency, and docking velocity.</li>
                </ul>
              </div>
            </div>

            <div style={{ borderTop: "1px solid var(--color-border-subtle)", paddingTop: "var(--space-4)" }}>
              <span className="font-mono" style={{ fontSize: "11px", color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                Section 2 · Cal Poly CDS &amp; NASA Technical Specifications
              </span>
              <h2 style={{ fontSize: "18px", fontWeight: 700, marginTop: "4px" }}>
                Engineering Calculators &amp; Physics Standards
              </h2>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "var(--space-4)" }}>
              <div className="panel" style={{ padding: "var(--space-4)" }}>
                <h4 style={{ fontSize: "12px", fontWeight: 600, color: "#38bdf8", marginBottom: "6px" }}>
                  1. Mass Budget (CDS Rev 14.1 &amp; JPL CML 4)
                </h4>
                <p style={{ fontSize: "11px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                  Maximum standard allowable mass: 1U = 2.00 kg, 3U = 6.00 kg, 6U = 12.00 kg. Preliminary designs (CML 4) require &ge; 35% dry mass margin to ensure launcher compatibility.
                </p>
              </div>

              <div className="panel" style={{ padding: "var(--space-4)" }}>
                <h4 style={{ fontSize: "12px", fontWeight: 600, color: "#eab308", marginBottom: "6px" }}>
                  2. Power &amp; Orbit Thermal Balance
                </h4>
                <p style={{ fontSize: "11px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                  Solar constant S = 1361 W/m&sup2;. Batteries must preserve DoD &le; 25% nominal and &le; 70% safe floor during umbra eclipse. Stefan-Boltzmann radiation maintains temperatures between -20&deg;C and +50&deg;C.
                </p>
              </div>

              <div className="panel" style={{ padding: "var(--space-4)" }}>
                <h4 style={{ fontSize: "12px", fontWeight: 600, color: "#22c55e", marginBottom: "6px" }}>
                  3. Telecom Link Budget &amp; Inhibit Safety
                </h4>
                <p style={{ fontSize: "11px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
                  Free space path loss calculated using Friis transmission equation. Link margin must exceed +3.0 dB. Cal Poly CDS Rev 14.1 &sect;2.4.4 (30-min deploy) and &sect;2.4.5 (45-min RF inhibit) strictly enforced.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  // ============================================================================
  // STAGE 7: MISSION DEBRIEF & CAREER PROGRESSION
  // ============================================================================
  return (
    <main style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", overflowY: "auto", backgroundColor: "var(--color-canvas)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 var(--space-6)", height: "48px", borderBottom: "1px solid var(--color-border-subtle)", backgroundColor: "var(--color-surface-1)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <button onClick={() => setStage("MAIN_MENU")} style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
            ← Mission Hub
          </button>
          <div style={{ width: "1px", height: "12px", backgroundColor: "var(--color-border-default)" }} />
          <h1 style={{ fontSize: "var(--text-sm)", fontWeight: 600 }}>Flight Operations Debrief // {contract.code}</h1>
        </div>
      </header>

      <div style={{ flex: 1, padding: "var(--space-8)", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ maxWidth: "800px", width: "100%", display: "flex", flexDirection: "column", gap: "var(--space-6)" }}>
          {/* Header Banner */}
          <div className="panel" style={{ padding: "var(--space-5)", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Flight Debrief · {contract.title}
              </span>
              <h2 style={{ fontSize: "var(--text-xl)", fontWeight: 600, margin: "var(--space-2) 0 var(--space-1) 0" }}>
                {missionGrade}
              </h2>
              <p style={{ fontSize: "var(--text-xs)", color: "var(--color-text-secondary)" }}>
                {gradeSummary}
              </p>
            </div>

            <div style={{ textAlign: "right" }}>
              <span className="status-indicator">
                <span className={`status-dot ${gradeStatusDot}`} />
                {fatalBlackout ? "Mission Loss" : "Contract Completed"}
              </span>
              <div className="font-mono" style={{ fontSize: "11px", color: "var(--color-text-muted)", marginTop: "4px" }}>
                Duration: {formatMet(simMetSeconds)} ({orbitCount} orbits)
              </div>
            </div>
          </div>

          {/* Performance Scorecard */}
          <div className="panel" style={{ padding: "var(--space-4)" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-3)" }}>
              Flight Performance Metrics
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>Metric</th>
                  <th>Measured Outcome</th>
                  <th>Requirement Target</th>
                  <th>Evaluation</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                <tr>
                  <td>Science Data Volume</td>
                  <td>{dataDownlinkedMb.toFixed(1)} Mb</td>
                  <td>≥ {contract.scienceTargetMb} Mb</td>
                  <td style={{ color: scienceCompletionPercent >= 100 ? "var(--color-status-nominal)" : "var(--color-text-secondary)" }}>
                    {scienceCompletionPercent.toFixed(1)}% fulfilled
                  </td>
                </tr>

                <tr>
                  <td>Peak Battery Depth-of-Discharge</td>
                  <td>{peakBatteryDodPercent.toFixed(1)}% DoD</td>
                  <td>≤ 25.0% nominal / ≤ 70.0% safe floor</td>
                  <td style={{ color: peakBatteryDodPercent <= 25 ? "var(--color-status-nominal)" : peakBatteryDodPercent <= 70 ? "var(--color-status-caution)" : "var(--color-status-critical)" }}>
                    {peakBatteryDodPercent <= 25 ? "Optimal Cycle Life" : peakBatteryDodPercent <= 70 ? "Elevated Degradation" : "Safe Mode Triggered"}
                  </td>
                </tr>

                <tr>
                  <td>Autonomous Safe Mode Triggers</td>
                  <td>{safeModeTriggerCount}</td>
                  <td>0 desired</td>
                  <td style={{ color: safeModeTriggerCount === 0 ? "var(--color-status-nominal)" : "var(--color-status-caution)" }}>
                    {safeModeTriggerCount === 0 ? "Zero Interruptions" : `${safeModeTriggerCount} events`}
                  </td>
                </tr>

                <tr>
                  <td>Thermal Survival Range</td>
                  <td>{minTempCelsius.toFixed(1)}°C to {maxTempCelsius.toFixed(1)}°C</td>
                  <td>-20°C to +50°C operational</td>
                  <td style={{ color: "var(--color-status-nominal)" }}>Thermal Envelope Preserved</td>
                </tr>

                <tr>
                  <td>JPL CML 4 Dry Mass Margin</td>
                  <td>+{dryMassMarginPercent.toFixed(1)}%</td>
                  <td>≥ 35.0% threshold</td>
                  <td style={{ color: dryMassMarginPercent >= 35 ? "var(--color-status-nominal)" : "var(--color-status-caution)" }}>
                    {dryMassMarginPercent >= 35 ? "Standards Compliant" : "Sub-Optimal Margin"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Root-Cause Feedback */}
          <div className="panel" style={{ padding: "var(--space-4)" }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "var(--space-3)" }}>
              Flight Director Diagnosis & Lessons Learned
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)", fontSize: "12px", color: "var(--color-text-secondary)", lineHeight: 1.5 }}>
              {fatalBlackout && (
                <div>
                  <strong style={{ color: "var(--color-status-critical)" }}>Power System Exhaustion: </strong>
                  Complete electrical blackout occurred during the {contract.eclipseMin}-minute Earth umbra eclipse. The {activeBattery.capacityWh} Wh battery could not support the continuous {totalNominalLoadW.toFixed(1)} W load in darkness. Upgrade to a 40 Wh or 80 Wh pack or select a lower-draw sensor.
                </div>
              )}

              {safeModeTriggerCount > 0 && !fatalBlackout && (
                <div>
                  <strong style={{ color: "var(--color-status-caution)" }}>Battery Stress & Payload Shedding: </strong>
                  Autonomous Safe Mode triggered {safeModeTriggerCount} time(s) as battery DoD reached {peakBatteryDodPercent.toFixed(1)}%. Upgrade to deployable dual solar wings or increase battery storage to buffer eclipse periods.
                </div>
              )}

              {dryMassMarginPercent < 35 && (
                <div>
                  <strong style={{ color: "var(--color-text-primary)" }}>Mass Margin Optimization: </strong>
                  Dry mass margin of +{dryMassMarginPercent.toFixed(1)}% falls below the 35% CML-4 target. Consider upgrading from {formFactor} to a larger form factor for increased structural allowance.
                </div>
              )}

              <div>
                <strong style={{ color: "var(--color-text-primary)" }}>Range Safety & Inhibit Verification: </strong>
                Cal Poly CDS Rev 14.1 §2.4.4 (30-min deploy delay) and §2.4.5 (45-min RF quiet period) were strictly verified and enforced before transmitter activation.
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "var(--space-3)" }}>
            <button
              onClick={() => setStage("WORKSHOP")}
              style={{ padding: "8px 16px", backgroundColor: "var(--color-surface-2)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-default)", fontSize: "var(--text-xs)", fontWeight: 500, cursor: "pointer" }}
            >
              ← Revise Spacecraft Design
            </button>

            <button
              onClick={() => setStage("MAIN_MENU")}
              style={{ padding: "8px 16px", backgroundColor: "var(--color-surface-elevated)", color: "var(--color-text-primary)", border: "1px solid var(--color-border-focus)", fontSize: "var(--text-xs)", fontWeight: 600, cursor: "pointer" }}
            >
              Return to Mission Hub →
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
