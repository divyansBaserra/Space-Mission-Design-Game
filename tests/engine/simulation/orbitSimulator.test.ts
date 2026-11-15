/**
 * Tests for Orbital & Trajectory Simulation Engine (Phase 3 Module 4)
 * `tests/engine/simulation/orbitSimulator.test.ts`
 *
 * Covers:
 * 1. Kepler equation solver (Danby starter + Newton-Raphson + bisection fallback)
 * 2. First-order secular J2 perturbations (S-1 SSO eastward precession, apsidal drift, period)
 * 3. Cartesian <-> Keplerian transformations across all 4 degenerate cases with signed atan2
 * 4. GMST epoch initialization (J2000 and arbitrary epochs) and sidereal rotation
 * 5. ECI-to-ECEF coordinate and kinematic velocity transport (-omega x r)
 * 6. Solar ephemeris and cylindrical Earth shadow eclipse geometry
 * 7. Topocentric ground station pass, elevation angle, and 10 deg mask evaluation
 * 8. Impulsive maneuver re-osculation (Case S-5) and OrbitSimulator class facade
 * 9. Input validation guards and numerical edge cases
 */

import { describe, test, expect } from "bun:test";
import {
  Kilometers,
  KilometersPerSecond,
  Seconds,
  Degrees,
  Radians,
  JulianDate,
  kilometers,
  kmps,
  seconds,
  degrees,
  radians,
  julianDate,
  degToRad,
  radToDeg,
  ValidationError,
  EARTH_GRAVITATIONAL_PARAMETER_KM3_S2,
  EARTH_EQUATORIAL_RADIUS_KM,
} from "../../../src/engine/simulation/simUnits";

import {
  KeplerianElements,
  GROUND_STATION_PRESETS,
  GroundStationLocation,
} from "../../../src/engine/simulation/missionConfig";

import {
  solveKeplerEquation,
  calculateOrbitSummary,
  propagateKeplerianElements,
  keplerianToCartesian,
  cartesianToKeplerian,
  calculateGmst,
  transformEciToEcef,
  calculateSunEphemeris,
  calculateGroundStationPass,
  applyImpulsiveManeuver,
  propagateOrbit,
  OrbitSimulator,
  clampUnit,
} from "../../../src/engine/simulation/orbitSimulator";

describe("Phase 3 Module 4 — Orbit Simulator", () => {
  // Canonical Case S-1 baseline parameters
  const s1Elements: KeplerianElements = {
    semiMajorAxisKm: kilometers(6978.137), // h = 600.0 km
    eccentricity: 0.001,
    inclinationDeg: degrees(97.79),
    raanDeg: degrees(45.0),
    argOfPeriapsisDeg: degrees(30.0),
    meanAnomalyAtEpochDeg: degrees(0.0),
  };

  // ==========================================================================
  // 1. Kepler Equation Solver ($M \to E$)
  // ==========================================================================
  describe("1. Kepler Equation Solver", () => {
    test("solves circular orbit (e = 0.0) in zero iterations exactly", () => {
      const angles = [0.0, 0.5, Math.PI / 2, Math.PI, 1.5 * Math.PI, 2.0 * Math.PI - 1e-6];
      for (const m of angles) {
        const E = solveKeplerEquation(radians(m), 0.0);
        expect(E).toBeCloseTo(m, 12);
      }
    });

    test("converges with Danby starter for low eccentricity (S-1 baseline e = 0.001)", () => {
      const mValues = [0.0, 0.1, Math.PI / 4, Math.PI / 2, Math.PI, 1.5 * Math.PI, 2.0 * Math.PI - 0.01];
      for (const m of mValues) {
        const E = solveKeplerEquation(radians(m), 0.001);
        const residual = Math.abs(E - 0.001 * Math.sin(E) - m);
        expect(residual < 1e-11).toBe(true);
      }
    });

    test("converges for high eccentricity limit (e = 0.85)", () => {
      const mValues = [1e-6, 0.01, 0.1, Math.PI / 4, Math.PI / 2, Math.PI, 1.5 * Math.PI, 2.0 * Math.PI - 1e-6];
      for (const m of mValues) {
        const E = solveKeplerEquation(radians(m), 0.85);
        const residual = Math.abs(E - 0.85 * Math.sin(E) - m);
        expect(residual < 1e-11).toBe(true);
      }
    });

    test("handles mean anomalies outside [0, 2pi) via normalization", () => {
      const E_pos = solveKeplerEquation(radians(4 * Math.PI + 0.5), 0.1);
      const E_base = solveKeplerEquation(radians(0.5), 0.1);
      expect(E_pos).toBeCloseTo(E_base, 10);

      const E_neg = solveKeplerEquation(radians(-0.5), 0.1);
      const E_equiv = solveKeplerEquation(radians(2 * Math.PI - 0.5), 0.1);
      expect(E_neg).toBeCloseTo(E_equiv, 10);
    });

    test("throws ValidationError if eccentricity is out of bounds", () => {
      expect(() => solveKeplerEquation(radians(1.0), -0.01)).toThrow(ValidationError);
      expect(() => solveKeplerEquation(radians(1.0), 0.86)).toThrow(ValidationError);
      expect(() => solveKeplerEquation(radians(1.0), 1.0)).toThrow(ValidationError);
      expect(() => solveKeplerEquation(radians(NaN), 0.1)).toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // 2. Secular J2 Perturbations & Orbit Summary (Case S-1 Benchmark)
  // ==========================================================================
  describe("2. Secular J2 Perturbations & Orbit Summary", () => {
    test("calculates Case S-1 mean motion, periods, and semi-latus rectum exactly", () => {
      const summary = calculateOrbitSummary(s1Elements);

      // p = a * (1 - e^2)
      expect(summary.semiLatusRectumKm).toBeCloseTo(6978.130022, 4);

      // n = sqrt(mu / a^3) = 0.0010830778 rad/s
      expect(summary.meanMotionRadS).toBeCloseTo(0.0010830778, 7);

      // T_kepler = 2*pi / n = 5801.2318 s (~96.6872 min)
      expect(summary.keplerianPeriodSeconds).toBeCloseTo(5801.2318, 3);
      expect(summary.keplerianPeriodSeconds / 60.0).toBeCloseTo(96.6872, 3);

      // Anomalistic mean motion n_bar and period T_anom = 5804.9525 s (~96.7492 min)
      expect(summary.anomalisticMeanMotionRadS).toBeCloseTo(0.0010823836, 7);
      expect(summary.anomalisticPeriodSeconds).toBeCloseTo(5804.9525, 3);
      expect(summary.anomalisticPeriodSeconds / 60.0).toBeCloseTo(96.7492, 3);

      // Perigee and Apogee altitudes
      expect(summary.perigeeAltitudeKm).toBeCloseTo(593.0219, 3); // 600 - 6.978
      expect(summary.apogeeAltitudeKm).toBeCloseTo(606.9781, 3);
    });

    test("verifies Case S-1 strictly positive eastward nodal precession rate (+0.985942 deg/day)", () => {
      const summary = calculateOrbitSummary(s1Elements);

      // dOmega/dt = +1.99166e-7 rad/s = +0.985942 deg/day
      expect(summary.raanDriftRateRadS > 0.0).toBe(true);
      expect(summary.raanDriftRateRadS).toBeCloseTo(1.99166e-7, 10);
      expect(summary.raanDriftRateDegPerDay).toBeCloseTo(0.985942, 5);

      // domega/dt = -6.67210e-7 rad/s = -3.302926 deg/day
      expect(summary.argOfPeriapsisDriftRateRadS < 0.0).toBe(true);
      expect(summary.argOfPeriapsisDriftRateRadS).toBeCloseTo(-6.6721e-7, 9);
      expect(summary.argOfPeriapsisDriftRateDegPerDay).toBeCloseTo(-3.302926, 4);
    });

    test("verifies zero nodal precession for polar orbit (i = 90.0 deg)", () => {
      const polarElements: KeplerianElements = {
        ...s1Elements,
        inclinationDeg: degrees(90.0),
      };
      const summary = calculateOrbitSummary(polarElements);
      expect(Math.abs(summary.raanDriftRateRadS) < 1e-15).toBe(true);
      expect(Math.abs(summary.raanDriftRateDegPerDay) < 1e-10).toBe(true);
    });

    test("verifies maximum westward regression for equatorial orbit (i = 0.0 deg)", () => {
      const equatorialElements: KeplerianElements = {
        ...s1Elements,
        inclinationDeg: degrees(0.0),
      };
      const summary = calculateOrbitSummary(equatorialElements);
      expect(summary.raanDriftRateRadS < 0.0).toBe(true); // Westward
      expect(summary.raanDriftRateDegPerDay).toBeCloseTo(-7.2758, 2);
    });

    test("verifies critical inclination frozen line of apsides (i = 63.434949 deg)", () => {
      const critInclinationRad = Math.acos(1.0 / Math.sqrt(5.0));
      const critInclinationDeg = degrees(critInclinationRad * 180.0 / Math.PI);

      const molniyaLike: KeplerianElements = {
        ...s1Elements,
        inclinationDeg: critInclinationDeg,
      };
      const summary = calculateOrbitSummary(molniyaLike);
      expect(Math.abs(summary.argOfPeriapsisDriftRateRadS) < 1e-14).toBe(true);
      expect(Math.abs(summary.argOfPeriapsisDriftRateDegPerDay) < 1e-9).toBe(true);
    });

    test("propagates Keplerian elements with secular drift over 1 day", () => {
      const oneDay = seconds(86400.0);
      const propagated = propagateKeplerianElements(s1Elements, oneDay);

      // RAAN should advance eastward by +0.985942 deg
      const expectedRaan = (45.0 + 0.985942) % 360.0;
      expect(propagated.raanDeg).toBeCloseTo(expectedRaan, 4);

      // Argument of periapsis should drift by -3.302926 deg
      const expectedArgP = (30.0 - 3.302926 + 360.0) % 360.0;
      expect(propagated.argOfPeriapsisDeg).toBeCloseTo(expectedArgP, 4);
    });
  });

  // ==========================================================================
  // 3. Cartesian <-> Keplerian Transformations & Degenerate Cases (§6.4)
  // ==========================================================================
  describe("3. Cartesian <-> Keplerian Transformations", () => {
    test("round-trips Case S-1 baseline state to high precision", () => {
      const cartesian = keplerianToCartesian(s1Elements);

      // Magnitude of r must equal a*(1 - e*cos(E))
      const rMag = Math.sqrt(
        cartesian.positionEciKm[0] ** 2 + cartesian.positionEciKm[1] ** 2 + cartesian.positionEciKm[2] ** 2
      );
      expect(rMag).toBeCloseTo(6978.137 * (1.0 - 0.001), 3); // Perigee at M = 0

      // Speed must match vis-viva at perigee: sqrt(mu * (2/r - 1/a))
      const expectedSpeed = Math.sqrt(EARTH_GRAVITATIONAL_PARAMETER_KM3_S2 * (2.0 / rMag - 1.0 / 6978.137));
      expect(cartesian.speedKmS).toBeCloseTo(expectedSpeed, 4);

      // Inverse transform
      const recovered = cartesianToKeplerian(cartesian.positionEciKm, cartesian.velocityEciKmS);
      expect(recovered.semiMajorAxisKm).toBeCloseTo(s1Elements.semiMajorAxisKm, 5);
      expect(recovered.eccentricity).toBeCloseTo(s1Elements.eccentricity, 7);
      expect(recovered.inclinationDeg).toBeCloseTo(s1Elements.inclinationDeg, 5);
      expect(recovered.raanDeg).toBeCloseTo(s1Elements.raanDeg, 5);
      expect(recovered.argOfPeriapsisDeg).toBeCloseTo(s1Elements.argOfPeriapsisDeg, 5);
      expect(recovered.meanAnomalyAtEpochDeg).toBeCloseTo(s1Elements.meanAnomalyAtEpochDeg, 5);
    });

    test("Vector 1: General inclined eccentric orbit round-trip", () => {
      const general: KeplerianElements = {
        semiMajorAxisKm: kilometers(8500.0), // Perigee = 8500 * (1 - 0.2) = 6800 km > R_earth
        eccentricity: 0.2,
        inclinationDeg: degrees(60.0),
        raanDeg: degrees(45.0),
        argOfPeriapsisDeg: degrees(120.0),
        meanAnomalyAtEpochDeg: degrees(200.0),
      };

      const cart = keplerianToCartesian(general);
      const rec = cartesianToKeplerian(cart.positionEciKm, cart.velocityEciKmS);

      expect(rec.semiMajorAxisKm).toBeCloseTo(general.semiMajorAxisKm, 5);
      expect(rec.eccentricity).toBeCloseTo(general.eccentricity, 7);
      expect(rec.inclinationDeg).toBeCloseTo(general.inclinationDeg, 5);
      expect(rec.raanDeg).toBeCloseTo(general.raanDeg, 5);
      expect(rec.argOfPeriapsisDeg).toBeCloseTo(general.argOfPeriapsisDeg, 5);
      expect(rec.meanAnomalyAtEpochDeg).toBeCloseTo(general.meanAnomalyAtEpochDeg, 5);
    });

    test("Vector 2: Equatorial eccentric orbit (inc = 0 deg, e = 0.1025)", () => {
      const rPqw: readonly [Kilometers, Kilometers, Kilometers] = [kilometers(7000.0), kilometers(0.0), kilometers(0.0)];
      const vCirc = Math.sqrt(EARTH_GRAVITATIONAL_PARAMETER_KM3_S2 / 7000.0);
      const vPqw: readonly [KilometersPerSecond, KilometersPerSecond, KilometersPerSecond] = [
        kmps(0.0),
        kmps(vCirc * 1.05),
        kmps(0.0),
      ];

      const rec = cartesianToKeplerian(rPqw, vPqw);
      expect(rec.inclinationDeg).toBeCloseTo(0.0, 5);
      expect(rec.raanDeg).toBeCloseTo(0.0, 5);
      expect(rec.argOfPeriapsisDeg).toBeCloseTo(0.0, 5);
      expect(rec.eccentricity).toBeCloseTo(0.1025, 4);
      expect(rec.meanAnomalyAtEpochDeg).toBeCloseTo(0.0, 5);
    });

    test("Vector 3: Circular inclined orbit (inc = 45 deg, e = 0.0, u = 135 deg)", () => {
      const uRad = 135.0 * Math.PI / 180.0;
      const incRad = 45.0 * Math.PI / 180.0;
      const rMag = 7000.0;
      const vMag = Math.sqrt(EARTH_GRAVITATIONAL_PARAMETER_KM3_S2 / rMag);

      // In orbital plane at u = 135 deg (Q2)
      const rx = kilometers(rMag * Math.cos(uRad));
      const ry = kilometers(rMag * Math.sin(uRad) * Math.cos(incRad));
      const rz = kilometers(rMag * Math.sin(uRad) * Math.sin(incRad));

      const vx = kmps(-vMag * Math.sin(uRad));
      const vy = kmps(vMag * Math.cos(uRad) * Math.cos(incRad));
      const vz = kmps(vMag * Math.cos(uRad) * Math.sin(incRad));

      const rec = cartesianToKeplerian([rx, ry, rz], [vx, vy, vz]);
      expect(rec.semiMajorAxisKm).toBeCloseTo(7000.0, 4);
      expect(rec.eccentricity < 1e-7).toBe(true);
      expect(rec.inclinationDeg).toBeCloseTo(45.0, 4);
      expect(rec.raanDeg).toBeCloseTo(0.0, 4);
      expect(rec.argOfPeriapsisDeg).toBeCloseTo(0.0, 4);
      expect(rec.meanAnomalyAtEpochDeg).toBeCloseTo(135.0, 4); // Argument of latitude
    });

    test("Vector 4: Circular equatorial orbit (inc = 0 deg, e = 0.0, lambda = 315 deg in Q4)", () => {
      const lambdaRad = -45.0 * Math.PI / 180.0; // 315 deg
      const rMag = 7000.0;
      const vMag = Math.sqrt(EARTH_GRAVITATIONAL_PARAMETER_KM3_S2 / rMag);

      const rx = kilometers(rMag * Math.cos(lambdaRad));
      const ry = kilometers(rMag * Math.sin(lambdaRad));
      const rz = kilometers(0.0);

      const vx = kmps(-vMag * Math.sin(lambdaRad));
      const vy = kmps(vMag * Math.cos(lambdaRad));
      const vz = kmps(0.0);

      const rec = cartesianToKeplerian([rx, ry, rz], [vx, vy, vz]);
      expect(rec.semiMajorAxisKm).toBeCloseTo(7000.0, 4);
      expect(rec.eccentricity < 1e-7).toBe(true);
      expect(rec.inclinationDeg).toBeCloseTo(0.0, 4);
      expect(rec.raanDeg).toBeCloseTo(0.0, 4);
      expect(rec.argOfPeriapsisDeg).toBeCloseTo(0.0, 4);
      expect(rec.meanAnomalyAtEpochDeg).toBeCloseTo(315.0, 4); // True longitude
    });

    test("throws ValidationError on subterranean position radius", () => {
      const subterranean: readonly [Kilometers, Kilometers, Kilometers] = [
        kilometers(5000.0),
        kilometers(0.0),
        kilometers(0.0),
      ];
      const v: readonly [KilometersPerSecond, KilometersPerSecond, KilometersPerSecond] = [
        kmps(0.0),
        kmps(7.5),
        kmps(0.0),
      ];
      expect(() => cartesianToKeplerian(subterranean, v)).toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // 4. GMST & Coordinate Transformations (§6.3)
  // ==========================================================================
  describe("4. GMST & Coordinate Transformations", () => {
    test("calculates IAU-1982 GMST at J2000.0 epoch (JD 2451545.0)", () => {
      const j2000 = julianDate(2451545.0);
      const gmstRad = calculateGmst(j2000, seconds(0.0));
      const gmstDeg = radToDeg(gmstRad);

      expect(gmstDeg).toBeCloseTo(280.460618, 4);
      expect(gmstRad).toBeCloseTo(4.894961, 5);
    });

    test("calculates GMST at non-J2000 epoch: 2024-01-01 00:00:00 UTC (JD 2460310.5)", () => {
      const epoch2024 = julianDate(2460310.5);
      const gmstRad = calculateGmst(epoch2024, seconds(0.0));
      const gmstDeg = radToDeg(gmstRad);

      expect(gmstDeg).toBeCloseTo(100.1526, 3);
    });

    test("advances GMST by sidereal rate over 1 solar day (86400 s)", () => {
      const j2000 = julianDate(2451545.0);
      const gmst0 = radToDeg(calculateGmst(j2000, seconds(0.0)));
      const gmst1 = radToDeg(calculateGmst(j2000, seconds(86400.0)));

      // In 1 solar day, Earth rotates 360 deg + ~0.9856 deg = 360.9856 deg
      const diffDeg = ((gmst1 - gmst0 + 360.0) % 360.0);
      expect(diffDeg).toBeCloseTo(0.98564, 3); // 360.98564 mod 360 = 0.98564
    });

    test("verifies ECI-to-ECEF velocity includes transport theorem cross-product for GEO", () => {
      // Geostationary orbit radius
      const rGeo = 42164.1696;
      const vGeo = Math.sqrt(EARTH_GRAVITATIONAL_PARAMETER_KM3_S2 / rGeo); // ~3.07466 km/s

      const rEci: readonly [Kilometers, Kilometers, Kilometers] = [kilometers(rGeo), kilometers(0.0), kilometers(0.0)];
      const vEci: readonly [KilometersPerSecond, KilometersPerSecond, KilometersPerSecond] = [
        kmps(0.0),
        kmps(vGeo),
        kmps(0.0),
      ];

      // At GMST = 0 rad
      const ecefState = transformEciToEcef(rEci, radians(0.0), vEci);
      expect(ecefState.velocityEcefKmS).toBeDefined();

      const vEcef = ecefState.velocityEcefKmS!;
      const speedEcef = Math.sqrt(vEcef[0] ** 2 + vEcef[1] ** 2 + vEcef[2] ** 2);

      // In ECEF, GEO satellite is stationary (speed ≈ 0 km/s)
      expect(speedEcef < 1e-5).toBe(true); // < 1 cm/s
    });

    test("preserves vector magnitude in ECI-to-ECEF position transformation", () => {
      const rEci: readonly [Kilometers, Kilometers, Kilometers] = [
        kilometers(4000.0),
        kilometers(5000.0),
        kilometers(3000.0),
      ];
      const gmst = radians(1.2345);
      const ecef = transformEciToEcef(rEci, gmst);

      const rEciMag = Math.sqrt(rEci[0] ** 2 + rEci[1] ** 2 + rEci[2] ** 2);
      const rEcefMag = Math.sqrt(ecef.positionEcefKm[0] ** 2 + ecef.positionEcefKm[1] ** 2 + ecef.positionEcefKm[2] ** 2);

      expect(rEcefMag).toBeCloseTo(rEciMag, 10);
      expect(ecef.positionEcefKm[2]).toBeCloseTo(rEci[2], 10); // Z is invariant under R_z
    });
  });

  // ==========================================================================
  // 5. Solar Ephemeris & Cylindrical Earth Shadow Eclipse (§6.2)
  // ==========================================================================
  describe("5. Solar Ephemeris & Cylindrical Shadow Eclipse", () => {
    test("computes normalized solar unit vector in ECI", () => {
      const jd = julianDate(2451545.0);
      const rPos: readonly [Kilometers, Kilometers, Kilometers] = [
        kilometers(7000.0),
        kilometers(0.0),
        kilometers(0.0),
      ];
      const sun = calculateSunEphemeris(jd, rPos);

      const norm = Math.sqrt(sun.sunVectorEci[0] ** 2 + sun.sunVectorEci[1] ** 2 + sun.sunVectorEci[2] ** 2);
      expect(norm).toBeCloseTo(1.0, 12);
    });

    test("detects spacecraft in full sunlight on day-side (x_sun > 0)", () => {
      const jd = julianDate(2451545.0);
      // Place satellite along Sun direction at 7000 km
      const sun = calculateSunEphemeris(jd, [kilometers(0.0), kilometers(0.0), kilometers(0.0)]);
      const rDay: readonly [Kilometers, Kilometers, Kilometers] = [
        kilometers(7000.0 * sun.sunVectorEci[0]),
        kilometers(7000.0 * sun.sunVectorEci[1]),
        kilometers(7000.0 * sun.sunVectorEci[2]),
      ];

      const state = calculateSunEphemeris(jd, rDay);
      expect(state.inEclipse).toBe(false);
      expect(state.sunlightFraction).toBe(1.0);
      expect(state.shadowProjectionKm > 0.0).toBe(true);
    });

    test("detects spacecraft in umbra shadow cylinder (x_sun < 0 and r_perp < R_earth)", () => {
      const jd = julianDate(2451545.0);
      const sun = calculateSunEphemeris(jd, [kilometers(0.0), kilometers(0.0), kilometers(0.0)]);
      // Place satellite anti-Sun behind Earth inside cylinder (r_perp = 1000 km < 6378 km)
      const rNight: readonly [Kilometers, Kilometers, Kilometers] = [
        kilometers(-7000.0 * sun.sunVectorEci[0]),
        kilometers(-7000.0 * sun.sunVectorEci[1]),
        kilometers(-7000.0 * sun.sunVectorEci[2]),
      ];

      const state = calculateSunEphemeris(jd, rNight);
      expect(state.inEclipse).toBe(true);
      expect(state.sunlightFraction).toBe(0.0);
      expect(state.shadowProjectionKm < 0.0).toBe(true);
      expect(state.shadowPerpendicularKm < EARTH_EQUATORIAL_RADIUS_KM).toBe(true);
    });

    test("detects spacecraft in sunlight when behind Earth but outside cylinder (r_perp > R_earth)", () => {
      const jd = julianDate(2451545.0);
      const sun = calculateSunEphemeris(jd, [kilometers(0.0), kilometers(0.0), kilometers(0.0)]);
      // Find a perpendicular vector to sun vector
      const perpX = -sun.sunVectorEci[1];
      const perpY = sun.sunVectorEci[0];
      const perpZ = 0.0;
      const perpNorm = Math.sqrt(perpX * perpX + perpY * perpY);

      // r = -7000 * sun + 10000 * perp (r_perp = 10000 km > 6378 km)
      const rOutside: readonly [Kilometers, Kilometers, Kilometers] = [
        kilometers(-7000.0 * sun.sunVectorEci[0] + 10000.0 * (perpX / perpNorm)),
        kilometers(-7000.0 * sun.sunVectorEci[1] + 10000.0 * (perpY / perpNorm)),
        kilometers(-7000.0 * sun.sunVectorEci[2] + 10000.0 * (perpZ / perpNorm)),
      ];

      const state = calculateSunEphemeris(jd, rOutside);
      expect(state.inEclipse).toBe(false);
      expect(state.sunlightFraction).toBe(1.0);
      expect(state.shadowPerpendicularKm > EARTH_EQUATORIAL_RADIUS_KM).toBe(true);
    });

    test("verifies Case S-1 nominal eclipse duration (2129.26 s) and sunlight duration (3671.97 s)", () => {
      const summary = calculateOrbitSummary(s1Elements);

      expect(summary.nominalEclipseFraction).toBeCloseTo(0.367036, 4);
      expect(summary.nominalEclipseDurationSeconds).toBeCloseTo(2129.26, 1);
      expect(summary.nominalSunlightDurationSeconds).toBeCloseTo(3671.97, 1);
      expect(summary.nominalEclipseDurationSeconds + summary.nominalSunlightDurationSeconds).toBeCloseTo(
        summary.keplerianPeriodSeconds,
        3
      );
    });
  });

  // ==========================================================================
  // 6. Topocentric Ground Station Passes (§6.3)
  // ==========================================================================
  describe("6. Topocentric Ground Station Passes", () => {
    const svalbard = GROUND_STATION_PRESETS.SVALBARD_SG3;

    test("evaluates satellite directly overhead at zenith (elevation = 90 deg)", () => {
      const latRad = degToRad(svalbard.latitudeDeg);
      const lonRad = degToRad(svalbard.longitudeDeg);
      const satAlt = 600.0;
      const satRadius = EARTH_EQUATORIAL_RADIUS_KM + satAlt;

      const satEcef: readonly [Kilometers, Kilometers, Kilometers] = [
        kilometers(satRadius * Math.cos(latRad) * Math.cos(lonRad)),
        kilometers(satRadius * Math.cos(latRad) * Math.sin(lonRad)),
        kilometers(satRadius * Math.sin(latRad)),
      ];

      const pass = calculateGroundStationPass(satEcef, svalbard);
      expect(pass.elevationDeg).toBeCloseTo(90.0, 3);
      expect(pass.slantRangeKm).toBeCloseTo(satAlt - svalbard.altitudeMeters / 1000.0, 3);
      expect(pass.isContactActive).toBe(true);
    });

    test("evaluates ground station elevation mask cutoff (10.0 deg)", () => {
      const latRad = degToRad(svalbard.latitudeDeg);
      const lonRad = degToRad(svalbard.longitudeDeg);

      // Create geometry with known elevation angle
      const satRadius = EARTH_EQUATORIAL_RADIUS_KM + 600.0;
      const satEcef: readonly [Kilometers, Kilometers, Kilometers] = [
        kilometers(satRadius * Math.cos(latRad) * Math.cos(lonRad)),
        kilometers(satRadius * Math.cos(latRad) * Math.sin(lonRad)),
        kilometers(satRadius * Math.sin(latRad)),
      ];

      // Custom station with 95 deg mask should be inactive
      const strictStation: GroundStationLocation = {
        ...svalbard,
        minimumElevationMaskDeg: degrees(95.0),
      };
      const passStrict = calculateGroundStationPass(satEcef, strictStation);
      expect(passStrict.isContactActive).toBe(false);

      // Station with 10 deg mask should be active
      const passNormal = calculateGroundStationPass(satEcef, svalbard);
      expect(passNormal.isContactActive).toBe(true);
    });

    test("evaluates negative elevation angle for satellite on opposite side of Earth", () => {
      const latRad = degToRad(svalbard.latitudeDeg);
      const lonRad = degToRad(svalbard.longitudeDeg);

      // Opposite side: antipodal coordinates
      const satRadius = EARTH_EQUATORIAL_RADIUS_KM + 600.0;
      const satAntipodal: readonly [Kilometers, Kilometers, Kilometers] = [
        kilometers(-satRadius * Math.cos(latRad) * Math.cos(lonRad)),
        kilometers(-satRadius * Math.cos(latRad) * Math.sin(lonRad)),
        kilometers(-satRadius * Math.sin(latRad)),
      ];

      const pass = calculateGroundStationPass(satAntipodal, svalbard);
      expect(pass.elevationDeg < 0.0).toBe(true);
      expect(pass.isContactActive).toBe(false);
      expect(pass.slantRangeKm > 2 * EARTH_EQUATORIAL_RADIUS_KM).toBe(true);
    });
  });

  // ==========================================================================
  // 7. Impulsive Maneuvers (Case S-5) & OrbitSimulator Class Facade
  // ==========================================================================
  describe("7. Impulsive Maneuver Re-osculation & OrbitSimulator Facade", () => {
    test("applies Case S-5 impulsive delta-v maneuver in velocity direction", () => {
      // Case S-5: Delta v = 227.3114 m/s = 0.2273114 km/s
      const deltaVKmps = 0.2273114;

      // At perigee (M = 0), velocity is in +Y perifocal direction
      const cartBefore = keplerianToCartesian(s1Elements);
      const speedBefore = cartBefore.speedKmS;

      // Prograde delta-v in direction of velocity
      const vUnit: readonly [number, number, number] = [
        cartBefore.velocityEciKmS[0] / speedBefore,
        cartBefore.velocityEciKmS[1] / speedBefore,
        cartBefore.velocityEciKmS[2] / speedBefore,
      ];
      const deltaVEci: readonly [KilometersPerSecond, KilometersPerSecond, KilometersPerSecond] = [
        kmps(deltaVKmps * vUnit[0]),
        kmps(deltaVKmps * vUnit[1]),
        kmps(deltaVKmps * vUnit[2]),
      ];

      const postBurnElements = applyImpulsiveManeuver(s1Elements, deltaVEci);

      // Prograde burn at perigee raises apogee and increases semi-major axis
      expect(postBurnElements.semiMajorAxisKm > s1Elements.semiMajorAxisKm).toBe(true);
      expect(postBurnElements.eccentricity > s1Elements.eccentricity).toBe(true);
      // Perigee radius should remain roughly unchanged
      const perigeeBefore = s1Elements.semiMajorAxisKm * (1.0 - s1Elements.eccentricity);
      const perigeeAfter = postBurnElements.semiMajorAxisKm * (1.0 - postBurnElements.eccentricity);
      expect(perigeeAfter).toBeCloseTo(perigeeBefore, 2);
    });

    test("OrbitSimulator facade propagates orbit deterministically", () => {
      const simulator = new OrbitSimulator({
        elements: s1Elements,
        epochJulianDate: julianDate(2451545.0),
        groundStations: [GROUND_STATION_PRESETS.NASA_WALLOPS_WFF, GROUND_STATION_PRESETS.SVALBARD_SG3],
      });

      const summary = simulator.getSummary();
      expect(summary.keplerianPeriodSeconds).toBeCloseTo(5801.2318, 3);

      // Propagate 1000 s
      const state1 = simulator.propagate(seconds(1000.0));
      expect(state1.metSeconds).toBe(1000.0);
      expect(state1.groundPasses.length).toBe(2);

      // Propagate again to same MET -> bit-for-bit identical
      const state2 = simulator.propagate(seconds(1000.0));
      expect(state2.cartesianEci.positionEciKm[0]).toBe(state1.cartesianEci.positionEciKm[0]);
      expect(state2.cartesianEci.positionEciKm[1]).toBe(state1.cartesianEci.positionEciKm[1]);
      expect(state2.cartesianEci.positionEciKm[2]).toBe(state1.cartesianEci.positionEciKm[2]);
    });

    test("OrbitSimulator withManeuver creates an immutable branch without mutating original", () => {
      const simOriginal = new OrbitSimulator({
        elements: s1Elements,
        epochJulianDate: julianDate(2451545.0),
      });

      const initialA = simOriginal.getSummary().semiMajorAxisKm;

      // Apply prograde delta-v at t = 1800 s
      const deltaV: readonly [KilometersPerSecond, KilometersPerSecond, KilometersPerSecond] = [
        kmps(0.1),
        kmps(0.0),
        kmps(0.0),
      ];
      const simBranched = simOriginal.withManeuver(seconds(1800.0), deltaV);

      // Original simulator remains completely unchanged
      expect(simOriginal.getSummary().semiMajorAxisKm).toBe(initialA);
      expect(simOriginal.getInitialElements().semiMajorAxisKm).toBe(initialA);

      // Branched simulator has new orbit summary
      expect(simBranched.getSummary().semiMajorAxisKm).not.toBe(initialA);
    });

    test("OrbitSimulator executeManeuver performs monotonic in-place forward update", () => {
      const sim = new OrbitSimulator({
        elements: s1Elements,
        epochJulianDate: julianDate(2451545.0),
      });

      const initialA = sim.getSummary().semiMajorAxisKm;
      const deltaV: readonly [KilometersPerSecond, KilometersPerSecond, KilometersPerSecond] = [
        kmps(0.1),
        kmps(0.0),
        kmps(0.0),
      ];

      sim.executeManeuver(seconds(1000.0), deltaV);
      expect(sim.getSummary().semiMajorAxisKm).not.toBe(initialA);

      // Backward propagation prior to maneuver anchor throws ValidationError
      expect(() => sim.propagate(seconds(500.0))).toThrow(ValidationError);

      // Forward propagation at or after maneuver anchor succeeds
      const state = sim.propagate(seconds(1200.0));
      expect(state.metSeconds).toBe(200.0); // 1200 - 1000
    });
  });

  // ==========================================================================
  // 8. Precondition Validation & Input Bounds
  // ==========================================================================
  describe("8. Precondition Validation & Numerical Clamping", () => {
    test("clampUnit clamps values outside [-1.0, 1.0]", () => {
      expect(clampUnit(1.00000001)).toBe(1.0);
      expect(clampUnit(-1.00000001)).toBe(-1.0);
      expect(clampUnit(0.5)).toBe(0.5);
    });

    test("validates initial Keplerian elements on OrbitSimulator constructor", () => {
      const invalidElements: any = {
        ...s1Elements,
        semiMajorAxisKm: -5000.0,
      };
      expect(() => new OrbitSimulator({ elements: invalidElements })).toThrow(ValidationError);
    });

    test("propagating with negative MET throws ValidationError", () => {
      const sim = new OrbitSimulator({ elements: s1Elements });
      expect(() => sim.propagate(seconds(-10.0))).toThrow(ValidationError);
    });
  });
});
