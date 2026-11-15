/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Mission Configuration & Requirements Engine (Phase 3 Module 3)
 *
 * Establishes immutable mission configuration contracts, geocentric destination presets,
 * ground station network locations, science requirements baselines, and spacecraft design
 * reference validation prior to simulation execution.
 *
 * Physical & Astrodynamic Boundaries:
 * - Earth Geocentric Scope Boundary: Phase 3 models orbital dynamics exclusively around
 *   Earth (μ_earth, R_earth, J2_earth). Lunar orbits and interplanetary trajectories require
 *   non-geocentric multi-body gravity models and are strictly reserved for Phase 4.
 * - Cal Poly CDS Rev 14.1 (§2.2.10, §2.4.4, §2.4.5) form-factor and operational standards.
 * - NASA LSP-REQ-317.01 Rev B (§6.2.5, §§6.2.10–6.2.11) launch dispenser load limits & policies.
 * - JPL Concept Maturity Level (CML) 4 design margin heuristics (35% dry mass & power margins).
 *
 * Source Provenance Classifications:
 * - VERIFIED: Direct from authoritative flight standards (WGS-84, IERS 2010, CDS Rev 14.1, NASA LSP).
 * - DERIVED: Analytical derivations from verified physical constants.
 * - GAME_ASSUMPTION: Educational gameplay heuristics (10 deg elevation mask, CML margin targets).
 * - PENDING_SOURCE_VERIFICATION: Parameters subject to commercial provider or future phase expansion.
 */

import {
  Kilometers,
  Meters,
  Degrees,
  Radians,
  JulianDate,
  Megabits,
  Kilograms,
  Watts,
  WattHours,
  Hertz,
  Decibels,
  DecibelIsotropic,
  Seconds,
  kilometers,
  meters,
  degrees,
  radians,
  julianDate,
  megabits,
  kg,
  watts,
  wattHours,
  hertz,
  dB,
  dBi,
  seconds,
  ValidationError,
  assertFinitePositive,
  assertFiniteNonNegative,
  assertAngleRangeDeg,
  assertEccentricityBound,
  assertJulianDateValid,
  EARTH_EQUATORIAL_RADIUS_KM,
  GROUND_STATION_DEFAULT_ELEVATION_MASK_DEG,
  DEFAULT_CML4_DRY_MASS_MARGIN_PERCENT,
  DEFAULT_LINK_MARGIN_THRESHOLD_DB,
  MAX_PERMITTED_ECCENTRICITY,
} from "./simUnits";

import { DEFAULT_EPOCH_JULIAN_DATE } from "./missionLifecycle";

import {
  FormFactor,
  CdsStandardRevision,
  CDS_STANDARDS,
  getCdsStandard,
  getCdsMaxMass,
  assertValidFormFactor,
} from "../standards/cdsStandards";

import {
  DISPENSER_PROFILES,
  DispenserProfile,
  getDispenserProfile,
} from "../standards/dispenserProfiles";

// ============================================================================
// 1. Provenance Classifications & Traceability Tags
// ============================================================================

export type ProvenanceTag =
  | "VERIFIED"
  | "DERIVED"
  | "GAME_ASSUMPTION"
  | "PENDING_SOURCE_VERIFICATION";

// ============================================================================
// 2. Keplerian Orbital Elements Specification
// ============================================================================

/**
 * Classical Keplerian orbital elements defining spacecraft orbit at epoch.
 * Phase 3 Specification §6.1.
 */
export interface KeplerianElements {
  /** Semi-major axis [km] (must satisfy perigee radius a*(1 - e) > R_earth for Earth orbits) */
  readonly semiMajorAxisKm: Kilometers;
  /** Orbital eccentricity [dimensionless] (0.0 <= e <= 0.85 for numerical convergence) */
  readonly eccentricity: number;
  /** Orbital inclination [deg] (0.0 <= i <= 180.0 deg) */
  readonly inclinationDeg: Degrees;
  /** Right Ascension of Ascending Node (RAAN) [deg] [0.0, 360.0) */
  readonly raanDeg: Degrees;
  /** Argument of Periapsis [deg] [0.0, 360.0) */
  readonly argOfPeriapsisDeg: Degrees;
  /** Mean Anomaly at epoch [deg] [0.0, 360.0) */
  readonly meanAnomalyAtEpochDeg: Degrees;
}

/**
 * Validates Keplerian orbital elements for physical sanity, non-subterranean perigee,
 * and numerical convergence bounds.
 */
export function validateKeplerianElements(
  elements: KeplerianElements,
  contextName = "orbitalElements"
): void {
  if (!elements || typeof elements !== "object") {
    throw new ValidationError(contextName, "Orbital elements must be a defined object");
  }

  assertFinitePositive(elements.semiMajorAxisKm, `${contextName}.semiMajorAxisKm`);
  assertEccentricityBound(elements.eccentricity, `${contextName}.eccentricity`);

  // Inclination must be within physical orbital limits [0, 180] deg
  if (
    !Number.isFinite(elements.inclinationDeg) ||
    elements.inclinationDeg < 0.0 ||
    elements.inclinationDeg > 180.0
  ) {
    throw new ValidationError(
      `${contextName}.inclinationDeg`,
      `Orbital inclination must be finite and within [0.0, 180.0] deg, received ${elements.inclinationDeg}`
    );
  }

  // Angles must be finite and within [0, 360] deg
  assertAngleRangeDeg(elements.raanDeg, `${contextName}.raanDeg`, 0.0, 360.0);
  assertAngleRangeDeg(elements.argOfPeriapsisDeg, `${contextName}.argOfPeriapsisDeg`, 0.0, 360.0);
  assertAngleRangeDeg(elements.meanAnomalyAtEpochDeg, `${contextName}.meanAnomalyAtEpochDeg`, 0.0, 360.0);

  // Perigee physical constraint: perigee radius r_p = a * (1 - e) must be strictly above Earth's surface
  const perigeeRadiusKm = elements.semiMajorAxisKm * (1.0 - elements.eccentricity);
  if (perigeeRadiusKm <= EARTH_EQUATORIAL_RADIUS_KM) {
    const perigeeAltitudeKm = perigeeRadiusKm - EARTH_EQUATORIAL_RADIUS_KM;
    throw new ValidationError(
      `${contextName}.semiMajorAxisKm`,
      `Orbital perigee radius (${perigeeRadiusKm.toFixed(3)} km) is subterranean (altitude: ${perigeeAltitudeKm.toFixed(3)} km <= 0.0 km relative to Earth equatorial radius ${EARTH_EQUATORIAL_RADIUS_KM} km)`
    );
  }
}

// ============================================================================
// 3. Destination Presets & Geocentric Scope Boundary
// ============================================================================

export type MissionDestinationId =
  | "LEO_SSO_600KM"     // 600 km Near-Sun-Synchronous LEO, 97.79 deg inclination [Supported]
  | "LEO_ISS_400KM"     // 400 km ISS-compatible LEO, 51.6 deg inclination [Supported]
  | "POLAR_700KM"       // 700 km Polar Earth Orbit, 90.0 deg inclination [Supported]
  | "GEO_STATIONARY"    // 35,786 km Geostationary Earth Orbit, 0.0 deg inclination [Supported]
  | "LUNAR_RELAY_100KM" // Low Lunar Orbit [PHASE_4_EXPANSION - Unsupported in Phase 3]
  | "MARS_TRANSFER";    // Interplanetary Transfer [PHASE_4_EXPANSION - Unsupported in Phase 3]

export const ALL_MISSION_DESTINATION_IDS: readonly MissionDestinationId[] = Object.freeze([
  "LEO_SSO_600KM",
  "LEO_ISS_400KM",
  "POLAR_700KM",
  "GEO_STATIONARY",
  "LUNAR_RELAY_100KM",
  "MARS_TRANSFER",
]);

export interface DestinationProfile {
  readonly id: MissionDestinationId;
  readonly name: string;
  readonly centralBody: "EARTH" | "MOON" | "MARS";
  readonly isSupportedInPhase3: boolean;
  readonly nominalElements: KeplerianElements;
  readonly targetAltitudeKm?: Kilometers;
  readonly description: string;
  readonly provenance: ProvenanceTag;
}

/**
 * Standard Mission Destination Presets.
 * Specification §5.2.
 */
export const DESTINATION_PRESETS: Readonly<
  Record<MissionDestinationId, DestinationProfile>
> = Object.freeze({
  LEO_SSO_600KM: Object.freeze({
    id: "LEO_SSO_600KM",
    name: "600 km Near-Sun-Synchronous LEO",
    centralBody: "EARTH",
    isSupportedInPhase3: true,
    targetAltitudeKm: kilometers(600.0),
    nominalElements: Object.freeze({
      semiMajorAxisKm: kilometers(EARTH_EQUATORIAL_RADIUS_KM + 600.0), // 6978.137 km (Case S-1 baseline)
      eccentricity: 0.001,
      inclinationDeg: degrees(97.79), // Verified near-SSO inclination
      raanDeg: degrees(45.0),
      argOfPeriapsisDeg: degrees(0.0),
      meanAnomalyAtEpochDeg: degrees(0.0),
    }),
    description: "600 km circular Sun-Synchronous Orbit providing consistent solar illumination and global coverage.",
    provenance: "VERIFIED",
  }),

  LEO_ISS_400KM: Object.freeze({
    id: "LEO_ISS_400KM",
    name: "400 km ISS-Compatible Low Earth Orbit",
    centralBody: "EARTH",
    isSupportedInPhase3: true,
    targetAltitudeKm: kilometers(400.0),
    nominalElements: Object.freeze({
      semiMajorAxisKm: kilometers(EARTH_EQUATORIAL_RADIUS_KM + 400.0), // 6778.137 km
      eccentricity: 0.0005,
      inclinationDeg: degrees(51.64), // NASA ISS operational inclination
      raanDeg: degrees(0.0),
      argOfPeriapsisDeg: degrees(0.0),
      meanAnomalyAtEpochDeg: degrees(0.0),
    }),
    description: "400 km low-inclination LEO compatible with ISS airlock deployment and mid-latitude coverage.",
    provenance: "VERIFIED",
  }),

  POLAR_700KM: Object.freeze({
    id: "POLAR_700KM",
    name: "700 km Polar Earth Orbit",
    centralBody: "EARTH",
    isSupportedInPhase3: true,
    targetAltitudeKm: kilometers(700.0),
    nominalElements: Object.freeze({
      semiMajorAxisKm: kilometers(EARTH_EQUATORIAL_RADIUS_KM + 700.0), // 7078.137 km
      eccentricity: 0.001,
      inclinationDeg: degrees(90.0),
      raanDeg: degrees(0.0),
      argOfPeriapsisDeg: degrees(0.0),
      meanAnomalyAtEpochDeg: degrees(0.0),
    }),
    description: "700 km circular polar orbit maximizing Svalbard and high-latitude ground station visibility.",
    provenance: "VERIFIED",
  }),

  GEO_STATIONARY: Object.freeze({
    id: "GEO_STATIONARY",
    name: "35,786 km Geostationary Earth Orbit (GEO)",
    centralBody: "EARTH",
    isSupportedInPhase3: true,
    targetAltitudeKm: kilometers(35786.0),
    nominalElements: Object.freeze({
      semiMajorAxisKm: kilometers(EARTH_EQUATORIAL_RADIUS_KM + 35786.0), // 42164.137 km
      eccentricity: 0.0,
      inclinationDeg: degrees(0.0),
      raanDeg: degrees(0.0),
      argOfPeriapsisDeg: degrees(0.0),
      meanAnomalyAtEpochDeg: degrees(0.0),
    }),
    description: "35,786 km equatorial orbit with 24-hour sidereal period for continuous regional coverage.",
    provenance: "VERIFIED",
  }),

  LUNAR_RELAY_100KM: Object.freeze({
    id: "LUNAR_RELAY_100KM",
    name: "100 km Low Lunar Orbit (Lunar Relay)",
    centralBody: "MOON",
    isSupportedInPhase3: false,
    targetAltitudeKm: kilometers(100.0),
    nominalElements: Object.freeze({
      semiMajorAxisKm: kilometers(1737.4 + 100.0), // 1837.4 km (Moon radius 1737.4 km)
      eccentricity: 0.0,
      inclinationDeg: degrees(90.0),
      raanDeg: degrees(0.0),
      argOfPeriapsisDeg: degrees(0.0),
      meanAnomalyAtEpochDeg: degrees(0.0),
    }),
    description: "Low Lunar Polar Orbit. Reserved for Phase 4 Multi-Body Gravitational Expansion.",
    provenance: "PENDING_SOURCE_VERIFICATION",
  }),

  MARS_TRANSFER: Object.freeze({
    id: "MARS_TRANSFER",
    name: "Interplanetary Cruise / Mars Transfer",
    centralBody: "MARS",
    isSupportedInPhase3: false,
    nominalElements: Object.freeze({
      semiMajorAxisKm: kilometers(188270000.0), // Heliocentric transfer orbit
      eccentricity: 0.207,
      inclinationDeg: degrees(1.85),
      raanDeg: degrees(0.0),
      argOfPeriapsisDeg: degrees(0.0),
      meanAnomalyAtEpochDeg: degrees(0.0),
    }),
    description: "Heliocentric Mars Transfer Orbit. Reserved for Phase 4 Multi-Body Gravitational Expansion.",
    provenance: "PENDING_SOURCE_VERIFICATION",
  }),
});

/**
 * Retrieves the destination profile for a destination ID.
 */
export function getDestinationProfile(id: MissionDestinationId): DestinationProfile {
  const profile = DESTINATION_PRESETS[id];
  if (!profile) {
    throw new ValidationError("destinationId", `Unknown mission destination ID: "${id}"`);
  }
  return profile;
}

/**
 * Asserts that a destination is fully supported under the Phase 3 Geocentric Scope Boundary.
 * Throws a descriptive ValidationError if destination requires Phase 4 multi-body expansion.
 */
export function assertSupportedDestination(id: MissionDestinationId): void {
  const profile = getDestinationProfile(id);
  if (!profile.isSupportedInPhase3 || profile.centralBody !== "EARTH") {
    throw new ValidationError(
      "destinationId",
      `Destination "${id}" is outside Phase 3 Geocentric Scope Boundary (centralBody: "${profile.centralBody}"). Lunar and interplanetary non-geocentric multi-body trajectories are reserved for Phase 4 Multi-Body Expansion.`
    );
  }
}

// ============================================================================
// 4. Ground Station Network Locations & Presets
// ============================================================================

export interface GroundStationLocation {
  readonly id: string;
  readonly name: string;
  readonly latitudeDeg: Degrees;
  readonly longitudeDeg: Degrees;
  readonly altitudeMeters: Meters;
  readonly minimumElevationMaskDeg: Degrees; // Nominal 10.0 deg [GAME_ASSUMPTION]
  /**
   * Provenance of geographic coordinates. Note: The nominal 10.0 deg minimum elevation
   * mask is an educational simulation heuristic (GAME_ASSUMPTION).
   */
  readonly provenance?: ProvenanceTag;
}

/**
 * Verified Ground Station Network Presets.
 * Specification §5.3.
 *
 * NOTE on Provenance:
 * Geographic coordinates (lat, lon, altitude) are VERIFIED from official NASA/Kongsberg facility data.
 * The default minimumElevationMaskDeg is an educational simulation heuristic (GAME_ASSUMPTION, 10.0 deg).
 */
export const GROUND_STATION_PRESETS: Readonly<Record<string, GroundStationLocation>> = Object.freeze({
  NASA_WALLOPS_WFF: Object.freeze({
    id: "NASA_WALLOPS_WFF",
    name: "NASA Wallops Flight Facility (WFF)",
    latitudeDeg: degrees(37.9402),
    longitudeDeg: degrees(-75.4664),
    altitudeMeters: meters(10.0),
    minimumElevationMaskDeg: degrees(GROUND_STATION_DEFAULT_ELEVATION_MASK_DEG),
    provenance: "VERIFIED",
  }),

  SVALBARD_SG3: Object.freeze({
    id: "SVALBARD_SG3",
    name: "Svalbard Satellite Station (SG3)",
    latitudeDeg: degrees(78.2298),
    longitudeDeg: degrees(15.4078),
    altitudeMeters: meters(450.0),
    minimumElevationMaskDeg: degrees(GROUND_STATION_DEFAULT_ELEVATION_MASK_DEG),
    provenance: "VERIFIED",
  }),

  NASA_DSN_GOLDSTONE: Object.freeze({
    id: "NASA_DSN_GOLDSTONE",
    name: "NASA DSN Goldstone Deep Space Communications Complex (GDS)",
    latitudeDeg: degrees(35.4267),
    longitudeDeg: degrees(-116.89),
    altitudeMeters: meters(1000.0),
    minimumElevationMaskDeg: degrees(GROUND_STATION_DEFAULT_ELEVATION_MASK_DEG),
    provenance: "VERIFIED",
  }),
});

/** Convenient short alias references to canonical ground station presets */
export const WFF: GroundStationLocation = GROUND_STATION_PRESETS.NASA_WALLOPS_WFF;
export const SG3: GroundStationLocation = GROUND_STATION_PRESETS.SVALBARD_SG3;
export const GDS: GroundStationLocation = GROUND_STATION_PRESETS.NASA_DSN_GOLDSTONE;

/**
 * Validates ground station geographic coordinates and elevation mask.
 */
export function validateGroundStation(
  station: GroundStationLocation,
  contextName = "groundStation"
): void {
  if (!station || typeof station !== "object") {
    throw new ValidationError(contextName, "Ground station must be a defined object");
  }

  if (typeof station.id !== "string" || station.id.trim().length === 0) {
    throw new ValidationError(`${contextName}.id`, "Ground station id must be a non-empty string");
  }

  if (typeof station.name !== "string" || station.name.trim().length === 0) {
    throw new ValidationError(`${contextName}.name`, "Ground station name must be a non-empty string");
  }

  // Latitude must be within [-90, +90] deg
  if (
    !Number.isFinite(station.latitudeDeg) ||
    station.latitudeDeg < -90.0 ||
    station.latitudeDeg > 90.0
  ) {
    throw new ValidationError(
      `${contextName}.latitudeDeg`,
      `Ground station latitude must be finite and within [-90.0, +90.0] deg, received ${station.latitudeDeg}`
    );
  }

  // Longitude must be within [-180, +180] deg (or [-360, +360])
  if (
    !Number.isFinite(station.longitudeDeg) ||
    station.longitudeDeg < -180.0 ||
    station.longitudeDeg > 180.0
  ) {
    throw new ValidationError(
      `${contextName}.longitudeDeg`,
      `Ground station longitude must be finite and within [-180.0, +180.0] deg, received ${station.longitudeDeg}`
    );
  }

  // Altitude must be finite and within terrestrial range [-500 m, 90,000 m]
  if (
    !Number.isFinite(station.altitudeMeters) ||
    station.altitudeMeters < -500.0 ||
    station.altitudeMeters > 90000.0
  ) {
    throw new ValidationError(
      `${contextName}.altitudeMeters`,
      `Ground station altitude must be finite and within [-500.0, 90000.0] m, received ${station.altitudeMeters}`
    );
  }

  // Elevation mask must be within [0, 90] deg
  if (
    !Number.isFinite(station.minimumElevationMaskDeg) ||
    station.minimumElevationMaskDeg < 0.0 ||
    station.minimumElevationMaskDeg > 90.0
  ) {
    throw new ValidationError(
      `${contextName}.minimumElevationMaskDeg`,
      `Ground station elevation mask must be within [0.0, 90.0] deg, received ${station.minimumElevationMaskDeg}`
    );
  }
}

// ============================================================================
// 5. Mission Science Requirements & Baseline Defaults
// ============================================================================

export interface MissionScienceRequirements {
  readonly primaryScienceGoal: string;
  readonly requiredDataVolumeMbits: Megabits;
  readonly targetLifetimeDays: number;
  readonly minimumOperationalOrbits: number;
  readonly maxAllowedBatteryDodPercent: number;    // e.g. 20% or 30%
  readonly requiredCmlDryMassMarginPercent: number; // Baseline: 35.0% [GAME_ASSUMPTION]
  readonly requiredLinkMarginDb: Decibels;          // Baseline: 6.0 dB for LEO proximity
}

export const DEFAULT_SCIENCE_REQUIREMENTS: Readonly<MissionScienceRequirements> = Object.freeze({
  primaryScienceGoal: "Earth Multispectral Surface Imaging & Environmental Monitoring",
  requiredDataVolumeMbits: megabits(1000.0), // 1.0 Gbit baseline
  targetLifetimeDays: 30,
  minimumOperationalOrbits: 15,
  maxAllowedBatteryDodPercent: 20.0, // 20% DoD conservative LEO cycle life baseline
  requiredCmlDryMassMarginPercent: DEFAULT_CML4_DRY_MASS_MARGIN_PERCENT, // 35.0%
  requiredLinkMarginDb: dB(DEFAULT_LINK_MARGIN_THRESHOLD_DB), // 6.0 dB
});

/**
 * Validates mission science requirements.
 */
export function validateMissionScienceRequirements(
  reqs: MissionScienceRequirements,
  contextName = "scienceRequirements"
): void {
  if (!reqs || typeof reqs !== "object") {
    throw new ValidationError(contextName, "Science requirements must be a defined object");
  }

  if (typeof reqs.primaryScienceGoal !== "string" || reqs.primaryScienceGoal.trim().length === 0) {
    throw new ValidationError(
      `${contextName}.primaryScienceGoal`,
      "Primary science goal must be a non-empty string"
    );
  }

  assertFinitePositive(reqs.requiredDataVolumeMbits, `${contextName}.requiredDataVolumeMbits`);
  assertFinitePositive(reqs.targetLifetimeDays, `${contextName}.targetLifetimeDays`);

  if (
    !Number.isInteger(reqs.minimumOperationalOrbits) ||
    reqs.minimumOperationalOrbits < 1
  ) {
    throw new ValidationError(
      `${contextName}.minimumOperationalOrbits`,
      `Minimum operational orbits must be a positive integer >= 1, received ${reqs.minimumOperationalOrbits}`
    );
  }

  if (
    !Number.isFinite(reqs.maxAllowedBatteryDodPercent) ||
    reqs.maxAllowedBatteryDodPercent <= 0.0 ||
    reqs.maxAllowedBatteryDodPercent > 100.0
  ) {
    throw new ValidationError(
      `${contextName}.maxAllowedBatteryDodPercent`,
      `Maximum allowed battery DoD percent must be within (0.0, 100.0]%, received ${reqs.maxAllowedBatteryDodPercent}`
    );
  }

  assertFiniteNonNegative(
    reqs.requiredCmlDryMassMarginPercent,
    `${contextName}.requiredCmlDryMassMarginPercent`
  );

  if (!Number.isFinite(reqs.requiredLinkMarginDb)) {
    throw new ValidationError(
      `${contextName}.requiredLinkMarginDb`,
      `Required link margin must be a finite number, received ${reqs.requiredLinkMarginDb}`
    );
  }
}

// ============================================================================
// 6. Spacecraft Design Reference Configuration
// ============================================================================

export type LaunchServicePolicy = "NASA_CSLI" | "COMMERCIAL" | "CUSTOM";

/**
 * Reference spacecraft hardware configuration consumed by simulation subsystems.
 * Corresponds to Specification §7.1 and §12 SpacecraftDesignInput.
 */
export interface SpacecraftDesignInput {
  readonly spacecraftId: string;
  readonly spacecraftName: string;
  readonly formFactor: FormFactor;
  readonly dryMassKg: Kilograms;
  readonly batteryCapacityWh: WattHours;
  readonly nominalBusPowerW: Watts;
  readonly propellantMassKg?: Kilograms;
  readonly safeModePowerW?: Watts; // Default: 2.0 W per §7.2
  readonly payloadPowerW?: Watts;
  readonly solarCellAreaM2?: number;
  readonly solarCellEfficiency?: number;
  readonly txPowerWatts?: Watts;
  readonly txFrequencyHz?: Hertz;
  readonly dataRateBps?: number;
  readonly txAntennaGainDbi?: DecibelIsotropic;
  readonly rxAntennaGainDbi?: DecibelIsotropic;
  readonly thrusterIspSeconds?: Seconds;
  readonly thrustNewtons?: number;
  readonly cdsRevision?: CdsStandardRevision;
  readonly dispenserProfileId?: string;
  readonly launchServicePolicy?: LaunchServicePolicy;
}

/**
 * Validates spacecraft design configuration against physical bounds, Cal Poly CDS limits,
 * and launch vehicle dispenser load ratings & policy constraints.
 */
export function validateSpacecraftDesignInput(
  spacecraft: SpacecraftDesignInput,
  contextName = "spacecraft"
): void {
  if (!spacecraft || typeof spacecraft !== "object") {
    throw new ValidationError(contextName, "Spacecraft design input must be a defined object");
  }

  if (typeof spacecraft.spacecraftId !== "string" || spacecraft.spacecraftId.trim().length === 0) {
    throw new ValidationError(`${contextName}.spacecraftId`, "Spacecraft ID must be a non-empty string");
  }

  if (typeof spacecraft.spacecraftName !== "string" || spacecraft.spacecraftName.trim().length === 0) {
    throw new ValidationError(`${contextName}.spacecraftName`, "Spacecraft name must be a non-empty string");
  }

  assertValidFormFactor(spacecraft.formFactor);
  assertFinitePositive(spacecraft.dryMassKg, `${contextName}.dryMassKg`);
  assertFinitePositive(spacecraft.batteryCapacityWh, `${contextName}.batteryCapacityWh`);
  assertFinitePositive(spacecraft.nominalBusPowerW, `${contextName}.nominalBusPowerW`);

  const propellantMass = spacecraft.propellantMassKg ?? kg(0.0);
  assertFiniteNonNegative(propellantMass, `${contextName}.propellantMassKg`);

  const wetMassKg = kg(spacecraft.dryMassKg + propellantMass);

  if (spacecraft.safeModePowerW !== undefined) {
    assertFinitePositive(spacecraft.safeModePowerW, `${contextName}.safeModePowerW`);
  }

  if (spacecraft.payloadPowerW !== undefined) {
    assertFiniteNonNegative(spacecraft.payloadPowerW, `${contextName}.payloadPowerW`);
  }

  if (spacecraft.solarCellAreaM2 !== undefined) {
    assertFinitePositive(spacecraft.solarCellAreaM2, `${contextName}.solarCellAreaM2`);
  }

  if (spacecraft.solarCellEfficiency !== undefined) {
    if (
      !Number.isFinite(spacecraft.solarCellEfficiency) ||
      spacecraft.solarCellEfficiency <= 0.0 ||
      spacecraft.solarCellEfficiency > 1.0
    ) {
      throw new ValidationError(
        `${contextName}.solarCellEfficiency`,
        `Solar cell efficiency must be within (0.0, 1.0], received ${spacecraft.solarCellEfficiency}`
      );
    }
  }

  if (spacecraft.txPowerWatts !== undefined) {
    assertFinitePositive(spacecraft.txPowerWatts, `${contextName}.txPowerWatts`);
  }

  if (spacecraft.txFrequencyHz !== undefined) {
    assertFinitePositive(spacecraft.txFrequencyHz, `${contextName}.txFrequencyHz`);
  }

  if (spacecraft.dataRateBps !== undefined) {
    assertFinitePositive(spacecraft.dataRateBps, `${contextName}.dataRateBps`);
  }

  if (spacecraft.thrusterIspSeconds !== undefined) {
    assertFinitePositive(spacecraft.thrusterIspSeconds, `${contextName}.thrusterIspSeconds`);
  }

  if (spacecraft.thrustNewtons !== undefined) {
    assertFinitePositive(spacecraft.thrustNewtons, `${contextName}.thrustNewtons`);
  }

  // Cross-validation with CDS standards if specified
  if (spacecraft.cdsRevision) {
    const cdsProfile = getCdsStandard(spacecraft.cdsRevision);
    const maxCdsMass = cdsProfile.maxMassByFormFactorKg[spacecraft.formFactor];
    if (maxCdsMass === null) {
      throw new ValidationError(
        `${contextName}.formFactor`,
        `Form factor "${spacecraft.formFactor}" is not standardized in ${cdsProfile.name}`
      );
    }
  }

  // Cross-validation with Dispenser Profiles and NASA LSP Policies if specified
  if (spacecraft.dispenserProfileId) {
    const dispenser = getDispenserProfile(spacecraft.dispenserProfileId);

    // Form-factor compatibility
    if (dispenser.formFactor !== spacecraft.formFactor && dispenser.id !== "CUSTOM_OVERRIDE") {
      throw new ValidationError(
        `${contextName}.dispenserProfileId`,
        `Dispenser "${dispenser.name}" form factor (${dispenser.formFactor}) does not match spacecraft form factor (${spacecraft.formFactor})`
      );
    }

    // Physical rated structural payload mass rating
    if (wetMassKg > dispenser.ratedPayloadMassLimitKg) {
      throw new ValidationError(
        `${contextName}.wetMassKg`,
        `Total wet mass (${wetMassKg} kg) exceeds dispenser "${dispenser.name}" rated payload mass limit (${dispenser.ratedPayloadMassLimitKg} kg)`
      );
    }
  }

  // NASA LSP-REQ-317.01 Rev B §6.2.5 Propulsion prohibition policy
  // Only enforced when explicitly manifested under a NASA CSLI launch agreement.
  // Neither physical dispenser hardware (e.g. P-POD Mk III) nor commercial/custom launch policies
  // inherently prohibit non-hazardous propulsion systems.
  if (spacecraft.launchServicePolicy === "NASA_CSLI" && propellantMass > 0.0) {
    throw new ValidationError(
      `${contextName}.propellantMassKg`,
      `Propulsion systems are prohibited when manifested under NASA CSLI launch policy (LSP-REQ-317.01 Rev B §6.2.5). Propellant mass must be 0 kg.`
    );
  }
}

// ============================================================================
// 7. Full Mission Configuration Interface & Validation
// ============================================================================

/**
 * Complete immutable mission configuration consumed by Phase 3 simulation modules.
 * Specification §5.2.
 */
export interface MissionConfiguration {
  readonly missionId: string;
  readonly missionName: string;
  readonly destinationId: MissionDestinationId;
  readonly initialOrbitalElements: KeplerianElements;
  readonly groundStations: readonly GroundStationLocation[];
  readonly scienceRequirements: MissionScienceRequirements;
  readonly epochJulianDate: JulianDate;
  readonly spacecraft?: SpacecraftDesignInput;
}

export interface CreateMissionConfigurationOptions {
  readonly missionId: string;
  readonly missionName: string;
  readonly destinationId?: MissionDestinationId;
  readonly initialOrbitalElements?: KeplerianElements;
  readonly groundStations?: readonly GroundStationLocation[];
  readonly scienceRequirements?: Partial<MissionScienceRequirements>;
  readonly epochJulianDate?: JulianDate;
  readonly spacecraft?: SpacecraftDesignInput;
}

/**
 * Validates a complete MissionConfiguration against institutional standards,
 * geocentric scope boundaries, and cross-field consistency.
 */
export function validateMissionConfiguration(config: MissionConfiguration): void {
  if (!config || typeof config !== "object") {
    throw new ValidationError("config", "Mission configuration must be a defined object");
  }

  if (typeof config.missionId !== "string" || config.missionId.trim().length === 0) {
    throw new ValidationError("missionId", "Mission ID must be a non-empty string");
  }

  if (typeof config.missionName !== "string" || config.missionName.trim().length === 0) {
    throw new ValidationError("missionName", "Mission name must be a non-empty string");
  }

  // 1. Verify Geocentric Scope Boundary
  assertSupportedDestination(config.destinationId);

  // 2. Validate Orbital Elements
  validateKeplerianElements(config.initialOrbitalElements, "initialOrbitalElements");

  // 3. Validate Ground Station Network
  if (!Array.isArray(config.groundStations) || config.groundStations.length === 0) {
    throw new ValidationError(
      "groundStations",
      "Mission configuration must include at least one valid ground station location"
    );
  }

  const seenStationIds = new Set<string>();
  for (let i = 0; i < config.groundStations.length; i++) {
    const station = config.groundStations[i];
    validateGroundStation(station, `groundStations[${i}]`);
    if (seenStationIds.has(station.id)) {
      throw new ValidationError(
        `groundStations[${i}].id`,
        `Duplicate ground station ID: "${station.id}". Each ground station ID must be unique.`
      );
    }
    seenStationIds.add(station.id);
  }

  // 4. Validate Science Requirements
  validateMissionScienceRequirements(config.scienceRequirements, "scienceRequirements");

  // 5. Validate Mission Epoch
  assertJulianDateValid(config.epochJulianDate, "epochJulianDate");

  // 6. Validate Spacecraft Design Reference if provided
  if (config.spacecraft) {
    validateSpacecraftDesignInput(config.spacecraft, "spacecraft");
  }
}

/**
 * Factory helper that constructs, freezes, and validates a complete MissionConfiguration.
 */
export function createMissionConfiguration(
  options: CreateMissionConfigurationOptions
): MissionConfiguration {
  if (!options || typeof options !== "object") {
    throw new ValidationError("options", "Options must be a defined object");
  }

  const destinationId = options.destinationId ?? "LEO_SSO_600KM";
  const destinationPreset = getDestinationProfile(destinationId);

  const initialOrbitalElements: KeplerianElements =
    options.initialOrbitalElements ?? destinationPreset.nominalElements;

  const groundStations: readonly GroundStationLocation[] = Object.freeze(
    options.groundStations
      ? [...options.groundStations].map((gs) => Object.freeze({ ...gs }))
      : [
          GROUND_STATION_PRESETS.SVALBARD_SG3,
          GROUND_STATION_PRESETS.NASA_WALLOPS_WFF,
        ]
  );

  const mergedScience: MissionScienceRequirements = Object.freeze({
    primaryScienceGoal:
      options.scienceRequirements?.primaryScienceGoal ??
      DEFAULT_SCIENCE_REQUIREMENTS.primaryScienceGoal,
    requiredDataVolumeMbits:
      options.scienceRequirements?.requiredDataVolumeMbits ??
      DEFAULT_SCIENCE_REQUIREMENTS.requiredDataVolumeMbits,
    targetLifetimeDays:
      options.scienceRequirements?.targetLifetimeDays ??
      DEFAULT_SCIENCE_REQUIREMENTS.targetLifetimeDays,
    minimumOperationalOrbits:
      options.scienceRequirements?.minimumOperationalOrbits ??
      DEFAULT_SCIENCE_REQUIREMENTS.minimumOperationalOrbits,
    maxAllowedBatteryDodPercent:
      options.scienceRequirements?.maxAllowedBatteryDodPercent ??
      DEFAULT_SCIENCE_REQUIREMENTS.maxAllowedBatteryDodPercent,
    requiredCmlDryMassMarginPercent:
      options.scienceRequirements?.requiredCmlDryMassMarginPercent ??
      DEFAULT_SCIENCE_REQUIREMENTS.requiredCmlDryMassMarginPercent,
    requiredLinkMarginDb:
      options.scienceRequirements?.requiredLinkMarginDb ??
      DEFAULT_SCIENCE_REQUIREMENTS.requiredLinkMarginDb,
  });

  const epochJulianDate = options.epochJulianDate ?? DEFAULT_EPOCH_JULIAN_DATE;

  const spacecraft = options.spacecraft ? Object.freeze({ ...options.spacecraft }) : undefined;

  const config: MissionConfiguration = Object.freeze({
    missionId: options.missionId,
    missionName: options.missionName,
    destinationId,
    initialOrbitalElements: Object.freeze({ ...initialOrbitalElements }),
    groundStations,
    scienceRequirements: mergedScience,
    epochJulianDate,
    spacecraft,
  });

  // Strict validation prior to return
  validateMissionConfiguration(config);

  return config;
}
