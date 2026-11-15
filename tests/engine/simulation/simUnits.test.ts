/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Simulation Units, Kinematics & Astrodynamical Constants Unit Tests (Phase 3 Module 1)
 */

import { describe, expect, it } from "bun:test";
import {
  // 1. Re-exported Phase 2B Types & Utilities
  kg,
  watts,
  wattHours,
  kilometers,
  meters,
  seconds,
  minutes,
  hours,
  hertz,
  dB,
  dBW,
  dBi,
  dBHz,
  dBW_Hz,
  kilometersToMeters,
  metersToKilometers,
  minutesToSeconds,
  secondsToMinutes,
  minutesToHours,
  hoursToMinutes,
  toKilograms,
  toGrams,
  wattsToDbw,
  dbwToWatts,
  ValidationError,
  assertFinitePositive,
  assertFiniteNonNegative,
  assertFractionRange,

  // 2. Simulation Branded Constructors
  radians,
  degrees,
  degPerSec,
  mps,
  mps2,
  kmps,
  julianDate,
  megabits,

  // 3. Conversion & Normalization Utilities
  degToRad,
  radToDeg,
  mpsToKmps,
  kmpsToMps,
  normalizeAngleRad,
  normalizeAngleDeg,

  // 4. Precondition Validation Guards
  assertAngleRangeDeg,
  assertEccentricityBound,
  assertJulianDateValid,

  // 5. Astrodynamical & Physical Constants
  EARTH_GRAVITATIONAL_PARAMETER_M3_S2,
  EARTH_GRAVITATIONAL_PARAMETER_KM3_S2,
  EARTH_EQUATORIAL_RADIUS_KM,
  EARTH_EQUATORIAL_RADIUS_M,
  EARTH_J2_OBLATENESS,
  EARTH_ROTATION_RATE_RAD_PER_S,
  STANDARD_GRAVITY_MPS2,
  SPEED_OF_LIGHT_MPS,
  STEFAN_BOLTZMANN_CONSTANT,
  SOLAR_CONSTANT_1AU_WPM2,
  MEAN_SOLAR_DAY_SECONDS,
  TROPICAL_YEAR_DAYS,
  MEAN_SOLAR_MOTION_DEG_PER_DAY,
  MEAN_SOLAR_MOTION_RAD_PER_S,

  // 6. Educational Game Assumptions
  EARTH_ALBEDO_FRACTION,
  EARTH_OUTGOING_IR_WPM2,
  GROUND_STATION_DEFAULT_ELEVATION_MASK_DEG,
  DEFAULT_CML4_DRY_MASS_MARGIN_PERCENT,
  DEFAULT_CML4_POWER_MARGIN_PERCENT,
  DEFAULT_LINK_MARGIN_THRESHOLD_DB,
  MAX_PERMITTED_ECCENTRICITY,
} from "../../../src/engine/simulation/simUnits";

describe("Phase 3 Module 1: Simulation Units & Kinematics (simUnits.ts)", () => {
  describe("Simulation Branded Casting Constructors", () => {
    it("preserves numeric values with simulation branded types", () => {
      expect(radians(Math.PI)).toBe(Math.PI);
      expect(degrees(180)).toBe(180);
      expect(degPerSec(2.5)).toBe(2.5);
      expect(mps(7500)).toBe(7500);
      expect(mps2(9.81)).toBe(9.81);
      expect(kmps(7.5)).toBe(7.5);
      expect(julianDate(2451545.0)).toBe(2451545.0);
      expect(megabits(100.5)).toBe(100.5);
    });
  });

  describe("Angular & Kinematic Conversions", () => {
    it("converts degrees to radians and vice-versa accurately", () => {
      expect(degToRad(degrees(0))).toBe(radians(0));
      expect(degToRad(degrees(90))).toBeCloseTo(Math.PI / 2, 10);
      expect(degToRad(degrees(180))).toBeCloseTo(Math.PI, 10);
      expect(degToRad(degrees(360))).toBeCloseTo(2 * Math.PI, 10);

      expect(radToDeg(radians(0))).toBe(degrees(0));
      expect(radToDeg(radians(Math.PI / 2))).toBeCloseTo(90, 10);
      expect(radToDeg(radians(Math.PI))).toBeCloseTo(180, 10);
      expect(radToDeg(radians(2 * Math.PI))).toBeCloseTo(360, 10);
    });

    it("verifies bidirectional consistency of angular conversions", () => {
      const angles = [0, 45, 90, 97.79, 180, 270, 360];
      for (const a of angles) {
        expect(radToDeg(degToRad(degrees(a)))).toBeCloseTo(a, 10);
      }
    });

    it("converts meters per second and kilometers per second bidirectionally", () => {
      expect(mpsToKmps(mps(1000))).toBe(kmps(1));
      expect(mpsToKmps(mps(7500))).toBe(kmps(7.5));
      expect(mpsToKmps(mps(11200))).toBe(kmps(11.2));

      expect(kmpsToMps(kmps(1))).toBe(mps(1000));
      expect(kmpsToMps(kmps(7.5))).toBe(mps(7500));
      expect(kmpsToMps(kmps(11.2))).toBe(mps(11200));
    });

    it("normalizes angles in radians to [0, 2π)", () => {
      const twoPi = 2 * Math.PI;
      expect(normalizeAngleRad(radians(0))).toBe(radians(0));
      expect(normalizeAngleRad(radians(twoPi))).toBeCloseTo(0, 10);
      expect(normalizeAngleRad(radians(3 * Math.PI))).toBeCloseTo(Math.PI, 10);
      expect(normalizeAngleRad(radians(-Math.PI / 2))).toBeCloseTo(1.5 * Math.PI, 10);
      expect(normalizeAngleRad(radians(-twoPi))).toBeCloseTo(0, 10);
      expect(normalizeAngleRad(radians(-3 * twoPi))).toBeCloseTo(0, 10);
    });

    it("normalizes angles in degrees to [0, 360)", () => {
      expect(normalizeAngleDeg(degrees(0))).toBe(degrees(0));
      expect(normalizeAngleDeg(degrees(360))).toBe(degrees(0));
      expect(normalizeAngleDeg(degrees(450))).toBe(degrees(90));
      expect(normalizeAngleDeg(degrees(-90))).toBe(degrees(270));
      expect(normalizeAngleDeg(degrees(-360))).toBe(degrees(0));
      expect(normalizeAngleDeg(degrees(-720))).toBe(degrees(0));
      expect(normalizeAngleDeg(degrees(725))).toBe(degrees(5));
    });

    it("rejects non-finite inputs in conversion functions", () => {
      expect(() => degToRad(degrees(NaN))).toThrow(ValidationError);
      expect(() => degToRad(degrees(Infinity))).toThrow(ValidationError);
      expect(() => radToDeg(radians(NaN))).toThrow(ValidationError);
      expect(() => mpsToKmps(mps(NaN))).toThrow(ValidationError);
      expect(() => kmpsToMps(kmps(Infinity))).toThrow(ValidationError);
      expect(() => normalizeAngleRad(radians(NaN))).toThrow(ValidationError);
      expect(() => normalizeAngleDeg(degrees(Infinity))).toThrow(ValidationError);
    });
  });

  describe("Simulation Precondition Validation Guards", () => {
    it("validates assertAngleRangeDeg within boundaries", () => {
      expect(() => assertAngleRangeDeg(degrees(0), "angle")).not.toThrow();
      expect(() => assertAngleRangeDeg(degrees(180), "angle")).not.toThrow();
      expect(() => assertAngleRangeDeg(degrees(360), "angle")).not.toThrow();

      expect(() => assertAngleRangeDeg(degrees(-0.1), "angle")).toThrow(ValidationError);
      expect(() => assertAngleRangeDeg(degrees(360.1), "angle")).toThrow(ValidationError);
      expect(() => assertAngleRangeDeg(degrees(NaN), "angle")).toThrow(ValidationError);
      expect(() => assertAngleRangeDeg(degrees(Infinity), "angle")).toThrow(ValidationError);
    });

    it("validates assertEccentricityBound within [0.0, 0.85]", () => {
      expect(() => assertEccentricityBound(0.0)).not.toThrow();
      expect(() => assertEccentricityBound(0.001)).not.toThrow();
      expect(() => assertEccentricityBound(0.5)).not.toThrow();
      expect(() => assertEccentricityBound(0.85)).not.toThrow();

      expect(() => assertEccentricityBound(-0.001)).toThrow(ValidationError);
      expect(() => assertEccentricityBound(0.85001)).toThrow(ValidationError);
      expect(() => assertEccentricityBound(0.99)).toThrow(ValidationError);
      expect(() => assertEccentricityBound(1.0)).toThrow(ValidationError);
      expect(() => assertEccentricityBound(NaN)).toThrow(ValidationError);
      expect(() => assertEccentricityBound(Infinity)).toThrow(ValidationError);
    });

    it("validates assertJulianDateValid strictly > 0", () => {
      expect(() => assertJulianDateValid(julianDate(2451545.0))).not.toThrow();
      expect(() => assertJulianDateValid(julianDate(0.0001))).not.toThrow();

      expect(() => assertJulianDateValid(julianDate(0))).toThrow(ValidationError);
      expect(() => assertJulianDateValid(julianDate(-100))).toThrow(ValidationError);
      expect(() => assertJulianDateValid(julianDate(NaN))).toThrow(ValidationError);
      expect(() => assertJulianDateValid(julianDate(Infinity))).toThrow(ValidationError);
    });
  });

  describe("Verified Physical & Astrodynamical Constants", () => {
    it("verifies Earth geocentric gravitational parameter (WGS-84 / EGM96)", () => {
      expect(EARTH_GRAVITATIONAL_PARAMETER_M3_S2).toBe(3.986004418e14);
      expect(EARTH_GRAVITATIONAL_PARAMETER_KM3_S2).toBe(398600.4418);
      expect(EARTH_GRAVITATIONAL_PARAMETER_KM3_S2 * 1e9).toBe(EARTH_GRAVITATIONAL_PARAMETER_M3_S2);
    });

    it("verifies Earth equatorial radius (WGS-84 ellipsoid semi-major axis)", () => {
      expect(EARTH_EQUATORIAL_RADIUS_KM).toBe(6378.137);
      expect(EARTH_EQUATORIAL_RADIUS_M).toBe(6378137.0);
      expect(EARTH_EQUATORIAL_RADIUS_KM * 1000).toBe(EARTH_EQUATORIAL_RADIUS_M);
    });

    it("verifies Earth J2 oblateness second zonal harmonic (IERS Conventions 2010)", () => {
      expect(EARTH_J2_OBLATENESS).toBe(1.08262668e-3);
    });

    it("verifies Earth nominal sidereal rotation rate (IERS Conventions 2010)", () => {
      expect(EARTH_ROTATION_RATE_RAD_PER_S).toBe(7.292115e-5);
    });

    it("verifies standard sea-level gravitational acceleration (ISO 80000-3 / CODATA)", () => {
      expect(STANDARD_GRAVITY_MPS2).toBe(9.80665);
    });

    it("verifies speed of light in vacuum (CODATA / BIPM)", () => {
      expect(SPEED_OF_LIGHT_MPS).toBe(299792458);
    });

    it("verifies Stefan-Boltzmann constant (CODATA 2018)", () => {
      expect(STEFAN_BOLTZMANN_CONSTANT).toBe(5.670374419e-8);
    });

    it("verifies nominal solar constant at 1 AU (IAU 2015 Resolution B3)", () => {
      expect(SOLAR_CONSTANT_1AU_WPM2).toBe(1361.0);
    });

    it("verifies mean solar day and tropical year duration", () => {
      expect(MEAN_SOLAR_DAY_SECONDS).toBe(86400.0);
      expect(TROPICAL_YEAR_DAYS).toBe(365.2421897);
    });

    it("verifies derived mean solar motion rate in deg/day and rad/s", () => {
      expect(MEAN_SOLAR_MOTION_DEG_PER_DAY).toBeCloseTo(360.0 / 365.2421897, 8);
      expect(MEAN_SOLAR_MOTION_RAD_PER_S).toBeCloseTo((2.0 * Math.PI) / (365.2421897 * 86400.0), 12);
    });
  });

  describe("Educational Game Assumptions & Operational Thresholds", () => {
    it("verifies Earth albedo and outgoing IR thermal baselines", () => {
      expect(EARTH_ALBEDO_FRACTION).toBe(0.3);
      expect(EARTH_OUTGOING_IR_WPM2).toBe(237.0);
    });

    it("verifies ground station default elevation mask", () => {
      expect(GROUND_STATION_DEFAULT_ELEVATION_MASK_DEG).toBe(10.0);
    });

    it("verifies JPL CML 4 concept margin targets and telecom threshold", () => {
      expect(DEFAULT_CML4_DRY_MASS_MARGIN_PERCENT).toBe(35.0);
      expect(DEFAULT_CML4_POWER_MARGIN_PERCENT).toBe(35.0);
      expect(DEFAULT_LINK_MARGIN_THRESHOLD_DB).toBe(6.0);
      expect(MAX_PERMITTED_ECCENTRICITY).toBe(0.85);
    });
  });

  describe("Phase 2B Compatibility & Re-export Integrity", () => {
    it("seamlessly works with Phase 2B units and conversion utilities", () => {
      expect(kg(4.0)).toBe(4.0);
      expect(watts(25.0)).toBe(25.0);
      expect(wattHours(30.0)).toBe(30.0);
      expect(kilometers(600.0)).toBe(600.0);
      expect(meters(600000.0)).toBe(600000.0);
      expect(seconds(3600)).toBe(3600);
      expect(minutes(60)).toBe(60);
      expect(hours(1)).toBe(1);
      expect(dB(6.0)).toBe(6.0);

      expect(kilometersToMeters(kilometers(600))).toBe(meters(600000));
      expect(metersToKilometers(meters(600000))).toBe(kilometers(600));
      expect(minutesToSeconds(minutes(30))).toBe(seconds(1800));
      expect(secondsToMinutes(seconds(2700))).toBe(minutes(45));
      expect(minutesToHours(minutes(60))).toBe(hours(1));
      expect(hoursToMinutes(hours(1.5))).toBe(minutes(90));
      expect(toKilograms(toGrams(kg(3.5)))).toBe(kg(3.5));

      expect(wattsToDbw(watts(10.0))).toBeCloseTo(10.0, 5);
      expect(dbwToWatts(dBW(10.0))).toBeCloseTo(10.0, 5);

      expect(() => assertFinitePositive(10, "test")).not.toThrow();
      expect(() => assertFiniteNonNegative(0, "test")).not.toThrow();
      expect(() => assertFractionRange(0.5, "test", 0, 1)).not.toThrow();
    });
  });
});
