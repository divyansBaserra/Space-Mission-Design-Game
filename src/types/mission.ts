/**
 * Domain Models for NASA Space Mission Design Game
 * Engineering Standards: JPL Concept Maturity Levels (CML), NASA CubeSat 101, NPR 7120.5E
 */

export type FormFactor = "1U" | "1.5U" | "2U" | "3U" | "6U" | "12U";

export type MissionDestination = 
  | "LEO_SSO"         // Low Earth Orbit Sun-Synchronous (500-600 km)
  | "ISS_ORBIT"        // 400 km ISS Deployment
  | "LUNAR_ORBIT"      // Low Lunar Orbit (100 km)
  | "SUN_EARTH_L1"     // Lagrange Point 1 (Heliophysics)
  | "MARS_TRANSFER";   // Interplanetary cruise to Mars

export type SubsystemCategory = 
  | "STRUCTURE"
  | "EPS"             // Electrical Power System
  | "PROPULSION"
  | "ADCS"            // Attitude Determination & Control
  | "TELECOM"
  | "CDH"             // Command & Data Handling
  | "PAYLOAD"
  | "THERMAL";

export interface SubsystemComponent {
  id: string;
  name: string;
  category: SubsystemCategory;
  massKg: number;
  powerWatts: number;
  volumeU: number;
  description: string;
  heritageFlightCount: number;
  outgassingCompliant: boolean; // CVCM < 0.1%, TML < 1.0%
}

export interface MissionRequirements {
  destination: MissionDestination;
  primaryScienceGoal: string;
  targetLifetimeDays: number;
  maxMassKg: number;
  minDeltaVMps: number;
  minLinkMarginDb: number;
}

export interface EngineeringBudgets {
  totalDryMassKg: number;
  totalWetMassKg: number;
  massMarginPercent: number;      // JPL CML 4 target: >= 35%
  
  nominalPowerDrawW: number;
  peakPowerDrawW: number;
  solarGenerationW: number;
  powerMarginPercent: number;     // JPL CML 4 target: >= 35%
  
  batteryCapacityWh: number;
  eclipseDurationMin: number;
  batteryDepthOfDischarge: number; // Target: <= 30% for LEO
  
  totalDeltaVMps: number;
  availableDeltaVMps: number;
  
  rfLinkMarginDb: number;         // Deep space >= 3dB, proximity >= 6dB
  rfInhibitTimerMin: number;      // Launch range safety requirement: >= 45 min
}

export type MissionPhase = 
  | "PRE_LAUNCH"
  | "LAUNCH_ASCENT"
  | "DISPENSER_DEPLOYMENT"
  | "INHIBIT_COUNTDOWN"
  | "SOLAR_ARRAY_DEPLOYMENT"
  | "DETUMBLE_ATTITUDE_ACQUISITION"
  | "COMMISSIONING"
  | "CRUISE_ORBIT_MAINTENANCE"
  | "SCIENCE_OPERATIONS"
  | "GROUND_CONTACT"
  | "END_OF_MISSION_DISPOSAL";

export interface TelemetryPoint {
  missionElapsedSeconds: number;
  phase: MissionPhase;
  altitudeKm: number;
  velocityKmS: number;
  batterySocPercent: number;
  solarInputWatts: number;
  subsystemDrawWatts: number;
  rfSignalDb: number;
  dataBufferMb: number;
  isEclipse: boolean;
}
