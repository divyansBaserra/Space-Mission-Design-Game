/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Simulation Units, Kinematics & Astrodynamical Constants (Phase 3 Module 1)
 *
 * Establishes simulation-specific nominal branded types, angular/kinematic converters,
 * precondition validation guards, and authoritative physical/astrodynamical constants.
 *
 * Re-exports compatible Phase 2B branded types from `src/engine/units.ts` to provide
 * a coherent, non-duplicated foundation for all Phase 3 simulation modules.
 *
 * Source Classifications:
 * - VERIFIED: Direct from authoritative literature (WGS-84, IERS 2010, CODATA 2018, IAU 2015).
 * - DERIVED: First-principles mathematical derivations from verified constants.
 * - GAME_ASSUMPTION: Educational gameplay simplifications (lumped thermal, 10 deg mask, CML targets).
 * - PENDING_SOURCE_VERIFICATION: Parameters subject to commercial provider variation.
 */

import {
  Kilograms,
  Grams,
  Watts,
  WattHours,
  Meters,
  Kilometers,
  Seconds,
  Minutes,
  Hours,
  Hertz,
  Decibels,
  DecibelWatts,
  DecibelIsotropic,
  DecibelHertz,
  DecibelWattsPerHertz,
  ValidationError,
  assertFinitePositive,
  assertFiniteNonNegative,
  assertFractionRange,
  assertInitialSocAboveFloor,
  kg,
  g,
  watts,
  wattHours,
  meters,
  kilometers,
  seconds,
  minutes,
  hours,
  hertz,
  dB,
  dBW,
  dBi,
  dBHz,
  dBW_Hz,
  toKilograms,
  toGrams,
  kilometersToMeters,
  metersToKilometers,
  minutesToHours,
  hoursToMinutes,
  secondsToMinutes,
  minutesToSeconds,
  wattsToDbw,
  dbwToWatts,
} from "../units";

// ============================================================================
// 1. Re-exported Phase 2B Branded Types & Core Utilities
// ============================================================================
export type {
  Kilograms,
  Grams,
  Watts,
  WattHours,
  Meters,
  Kilometers,
  Seconds,
  Minutes,
  Hours,
  Hertz,
  Decibels,
  DecibelWatts,
  DecibelIsotropic,
  DecibelHertz,
  DecibelWattsPerHertz,
};

export {
  ValidationError,
  assertFinitePositive,
  assertFiniteNonNegative,
  assertFractionRange,
  assertInitialSocAboveFloor,
  kg,
  g,
  watts,
  wattHours,
  meters,
  kilometers,
  seconds,
  minutes,
  hours,
  hertz,
  dB,
  dBW,
  dBi,
  dBHz,
  dBW_Hz,
  toKilograms,
  toGrams,
  kilometersToMeters,
  metersToKilometers,
  minutesToHours,
  hoursToMinutes,
  secondsToMinutes,
  minutesToSeconds,
  wattsToDbw,
  dbwToWatts,
};

// ============================================================================
// 2. Simulation Branded Angular Units
// ============================================================================
export type Radians = number & { readonly __brand: "rad" };
export type Degrees = number & { readonly __brand: "deg" };
export type DegreesPerSecond = number & { readonly __brand: "deg/s" };

// ============================================================================
// 3. Simulation Branded Kinematic, Orbital & Communication Units
// ============================================================================
export type MetersPerSecond = number & { readonly __brand: "m/s" };
export type MetersPerSecondSquared = number & { readonly __brand: "m/s2" };
export type KilometersPerSecond = number & { readonly __brand: "km/s" };
export type JulianDate = number & { readonly __brand: "JD" };
export type Megabits = number & { readonly __brand: "Mbit" };

// ============================================================================
// 4. Nominal Branded Casting Constructor Helpers
// ============================================================================
export const radians = (v: number): Radians => v as Radians;
export const degrees = (v: number): Degrees => v as Degrees;
export const degPerSec = (v: number): DegreesPerSecond => v as DegreesPerSecond;
export const mps = (v: number): MetersPerSecond => v as MetersPerSecond;
export const mps2 = (v: number): MetersPerSecondSquared => v as MetersPerSecondSquared;
export const kmps = (v: number): KilometersPerSecond => v as KilometersPerSecond;
export const julianDate = (v: number): JulianDate => v as JulianDate;
export const megabits = (v: number): Megabits => v as Megabits;

// ============================================================================
// 5. Angular & Kinematic Conversion Utilities
// ============================================================================

/** Converts an angle in degrees to radians */
export function degToRad(degVal: Degrees): Radians {
  assertFiniteNonNegativeOrNegative(degVal, "degToRad");
  return radians((degVal * Math.PI) / 180.0);
}

/** Converts an angle in radians to degrees */
export function radToDeg(radVal: Radians): Degrees {
  assertFiniteNonNegativeOrNegative(radVal, "radToDeg");
  return degrees((radVal * 180.0) / Math.PI);
}

/** Converts meters per second to kilometers per second */
export function mpsToKmps(mpsVal: MetersPerSecond): KilometersPerSecond {
  assertFiniteNonNegativeOrNegative(mpsVal, "mpsToKmps");
  return kmps(mpsVal / 1000.0);
}

/** Converts kilometers per second to meters per second */
export function kmpsToMps(kmpsVal: KilometersPerSecond): MetersPerSecond {
  assertFiniteNonNegativeOrNegative(kmpsVal, "kmpsToMps");
  return mps(kmpsVal * 1000.0);
}

/** Normalizes an angle in radians to the half-open interval [0, 2π) */
export function normalizeAngleRad(radVal: Radians): Radians {
  assertFiniteNonNegativeOrNegative(radVal, "normalizeAngleRad");
  const twoPi = 2.0 * Math.PI;
  const normalized = ((radVal % twoPi) + twoPi) % twoPi;
  return radians(normalized);
}

/** Normalizes an angle in degrees to the half-open interval [0, 360) */
export function normalizeAngleDeg(degVal: Degrees): Degrees {
  assertFiniteNonNegativeOrNegative(degVal, "normalizeAngleDeg");
  const normalized = ((degVal % 360.0) + 360.0) % 360.0;
  return degrees(normalized);
}

// ============================================================================
// 6. Verified Physical & Astrodynamical Constants (Earth Geocentric Domain)
// ============================================================================

/**
 * Standard Earth Gravitational Parameter [m³/s²]
 * Source: WGS-84 / EGM96 Geodetic Reference System (NIMA TR8350.2, §3).
 * Verification: VERIFIED
 */
export const EARTH_GRAVITATIONAL_PARAMETER_M3_S2 = 3.986004418e14;

/**
 * Standard Earth Gravitational Parameter [km³/s²]
 * Source: WGS-84 / EGM96 (3.986004418e14 m³/s² / 1e9).
 * Verification: VERIFIED
 */
export const EARTH_GRAVITATIONAL_PARAMETER_KM3_S2 = 398600.4418;

/**
 * Earth Equatorial Radius [km]
 * Source: WGS-84 Ellipsoid Semi-Major Axis (a).
 * Verification: VERIFIED
 */
export const EARTH_EQUATORIAL_RADIUS_KM = 6378.137;

/**
 * Earth Equatorial Radius [m]
 * Source: WGS-84 Ellipsoid Semi-Major Axis (a * 1000).
 * Verification: VERIFIED
 */
export const EARTH_EQUATORIAL_RADIUS_M = 6378137.0;

/**
 * Earth Second Zonal Harmonic (Oblateness coefficient J2)
 * Source: IERS Conventions (2010), Technical Note No. 36.
 * Verification: VERIFIED
 */
export const EARTH_J2_OBLATENESS = 1.08262668e-3;

/**
 * Earth Nominal Sidereal Rotation Rate [rad/s]
 * Source: IERS Conventions (2010).
 * Verification: VERIFIED
 */
export const EARTH_ROTATION_RATE_RAD_PER_S = 7.292115e-5;

/**
 * Standard Sea-Level Gravitational Acceleration [m/s²]
 * Source: ISO 80000-3 / CODATA standard gravity (exact).
 * Verification: VERIFIED
 */
export const STANDARD_GRAVITY_MPS2 = 9.80665;

/**
 * Speed of Light in Vacuum [m/s]
 * Source: CODATA / BIPM (exact SI redefinition).
 * Verification: VERIFIED
 */
export const SPEED_OF_LIGHT_MPS = 299792458;

/**
 * Stefan-Boltzmann Constant [W/(m²·K⁴)]
 * Source: CODATA 2018 (5.670374419e-8 W/(m²·K⁴)).
 * Verification: VERIFIED
 */
export const STEFAN_BOLTZMANN_CONSTANT = 5.670374419e-8;

/**
 * Mean Total Solar Irradiance at 1 AU [W/m²]
 * Source: IAU 2015 Resolution B3 nominal solar irradiance.
 * Verification: VERIFIED
 */
export const SOLAR_CONSTANT_1AU_WPM2 = 1361.0;

/**
 * Standard SI Day Duration in Seconds [s]
 * Source: 24 * 3600 seconds.
 * Verification: VERIFIED
 */
export const MEAN_SOLAR_DAY_SECONDS = 86400.0;

/**
 * Mean Tropical Year Duration in Days [days]
 * Source: Astronomical Almanac at J2000 epoch (365.2421897 days).
 * Verification: VERIFIED
 */
export const TROPICAL_YEAR_DAYS = 365.2421897;

/**
 * Mean Solar Orbital Motion Rate [deg/day]
 * Derived: 360.0 / 365.2421897 days = 0.98564736 deg/day.
 * Verification: DERIVED
 */
export const MEAN_SOLAR_MOTION_DEG_PER_DAY = 0.98564736;

/**
 * Mean Solar Orbital Motion Rate [rad/s]
 * Derived: (2 * pi) / (365.2421897 * 86400.0 s) = 1.99106385e-7 rad/s.
 * Verification: DERIVED
 */
export const MEAN_SOLAR_MOTION_RAD_PER_S = 1.99106385e-7;

// ============================================================================
// 7. Educational Game Assumptions & Operational Baselines
// ============================================================================

/**
 * Mean Earth Bond Albedo Fraction
 * Source: NASA RP-1090 nominal Earth radiation baseline (0.30).
 * Verification: GAME_ASSUMPTION
 */
export const EARTH_ALBEDO_FRACTION = 0.3;

/**
 * Mean Earth Outgoing Longwave Radiation (OLR) [W/m²]
 * Source: NASA nominal Earth thermal baseline (237.0 W/m²).
 * Verification: GAME_ASSUMPTION
 */
export const EARTH_OUTGOING_IR_WPM2 = 237.0;

/**
 * Default Ground Station Elevation Mask Cutoff [deg]
 * Source: Nominal operational ground mask baseline for LEO tracking.
 * Verification: GAME_ASSUMPTION
 */
export const GROUND_STATION_DEFAULT_ELEVATION_MASK_DEG = 10.0;

/**
 * Default JPL CML 4 Concept Study Dry Mass Margin Target [%]
 * Source: JPL CML 4 study heuristic (Phase 2A v5 §9 line 869).
 * Verification: GAME_ASSUMPTION
 */
export const DEFAULT_CML4_DRY_MASS_MARGIN_PERCENT = 35.0;

/**
 * Default JPL CML 4 Concept Study Power Margin Target [%]
 * Source: JPL CML 4 study heuristic.
 * Verification: GAME_ASSUMPTION
 */
export const DEFAULT_CML4_POWER_MARGIN_PERCENT = 35.0;

/**
 * Default Telecom Worst-Case Link Margin Threshold [dB]
 * Source: Standard LEO proximity communication link margin baseline.
 * Verification: GAME_ASSUMPTION
 */
export const DEFAULT_LINK_MARGIN_THRESHOLD_DB = 6.0;

/**
 * Maximum Permitted Orbital Eccentricity for Kepler Analytical Solver
 * Source: Numerical stability guard ensuring Danby starter + Newton-Raphson convergence.
 * Verification: GAME_ASSUMPTION
 */
export const MAX_PERMITTED_ECCENTRICITY = 0.85;

// ============================================================================
// 8. Simulation Precondition Validation Guards
// ============================================================================

/** Asserts number is finite (positive, zero, or negative) */
function assertFiniteNonNegativeOrNegative(val: number, name: string): void {
  if (!Number.isFinite(val)) {
    throw new ValidationError(name, `Must be a finite number, received ${val}`);
  }
}

/** Asserts angle in degrees is finite and within [minDeg, maxDeg] */
export function assertAngleRangeDeg(
  degVal: Degrees,
  name: string,
  minDeg = 0.0,
  maxDeg = 360.0
): void {
  if (!Number.isFinite(degVal) || degVal < minDeg || degVal > maxDeg) {
    throw new ValidationError(
      name,
      `Angle must be finite and within [${minDeg}, ${maxDeg}] deg, received ${degVal}`
    );
  }
}

/** Asserts orbital eccentricity is finite and within bounded range [0, 0.85] */
export function assertEccentricityBound(
  e: number,
  name = "eccentricity"
): void {
  if (!Number.isFinite(e) || e < 0.0 || e > MAX_PERMITTED_ECCENTRICITY) {
    throw new ValidationError(
      name,
      `Orbital eccentricity must be within [0.0, ${MAX_PERMITTED_ECCENTRICITY}], received ${e}`
    );
  }
}

/** Asserts Julian Date is finite and strictly positive */
export function assertJulianDateValid(
  jdVal: JulianDate,
  name = "julianDate"
): void {
  assertFinitePositive(jdVal, name);
}
