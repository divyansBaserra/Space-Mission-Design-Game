/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Orbital & Trajectory Simulation Engine (Phase 3 Module 4)
 *
 * Implements an analytical Keplerian orbital propagator incorporating:
 * - First-order secular J2 Earth oblateness perturbations (nodal precession and apsidal rotation)
 * - Anomalistic mean motion correction
 * - High-precision Kepler equation solver (Danby starter + Newton-Raphson + guaranteed bisection fallback)
 * - Cartesian <-> Keplerian transformations with robust atan2 quadrant determination across all 4 degenerate cases
 * - Greenwich Mean Sidereal Time (GMST) epoch initialization and ECI <-> ECEF rotating frame transformations
 *   including kinematic transport theorem velocity (-omega x r)
 * - Analytical low-precision solar ephemeris and cylindrical Earth shadow eclipse model
 * - Topocentric ground station slant-range, elevation angle, and contact mask evaluation
 * - Pure impulsive maneuver re-osculation contract and deterministic OrbitSimulator facade
 *
 * Source Classifications:
 * - VERIFIED: WGS-84 / EGM96 gravitation, IERS 2010 J2 & rotation, IAU-1982 GMST, CODATA 2018.
 * - DERIVED: Analytical J2 secular rates, Kepler solver bisection bracket, rotating frame transport theorem,
 *   cylindrical umbra geometry, topocentric elevation, Cartesian-to-Keplerian degenerate conventions.
 * - GAME_ASSUMPTION: Single-axis J2000-to-ECEF rotation, time-scale unification (UTC = UT1 = TT),
 *   spherical ground station radius, 10 deg elevation mask, impulsive midpoint maneuver sizing.
 */

import {
  Kilometers,
  KilometersPerSecond,
  Seconds,
  Degrees,
  Radians,
  JulianDate,
  Meters,
  kilometers,
  kmps,
  seconds,
  degrees,
  radians,
  julianDate,
  degToRad,
  radToDeg,
  normalizeAngleRad,
  normalizeAngleDeg,
  ValidationError,
  assertFinitePositive,
  assertFiniteNonNegative,
  assertEccentricityBound,
  assertAngleRangeDeg,
  EARTH_GRAVITATIONAL_PARAMETER_KM3_S2,
  EARTH_EQUATORIAL_RADIUS_KM,
  EARTH_J2_OBLATENESS,
  EARTH_ROTATION_RATE_RAD_PER_S,
  GROUND_STATION_DEFAULT_ELEVATION_MASK_DEG,
  MAX_PERMITTED_ECCENTRICITY,
} from "./simUnits";

import {
  KeplerianElements,
  validateKeplerianElements,
  GroundStationLocation,
} from "./missionConfig";

// Re-export KeplerianElements for consumer ergonomics
export type { KeplerianElements };

// ============================================================================
// 1. Data Structures & State Interfaces
// ============================================================================

export interface CartesianState {
  readonly positionEciKm: readonly [Kilometers, Kilometers, Kilometers];
  readonly velocityEciKmS: readonly [KilometersPerSecond, KilometersPerSecond, KilometersPerSecond];
  readonly altitudeKm: Kilometers;
  readonly speedKmS: KilometersPerSecond;
}

export interface EcefState {
  readonly positionEcefKm: readonly [Kilometers, Kilometers, Kilometers];
  readonly velocityEcefKmS?: readonly [KilometersPerSecond, KilometersPerSecond, KilometersPerSecond];
}

export interface SunEphemerisState {
  readonly sunVectorEci: readonly [number, number, number]; // Unit vector
  readonly inEclipse: boolean;
  readonly sunlightFraction: number; // 0.0 or 1.0 (cylindrical umbra)
  readonly shadowProjectionKm: Kilometers; // x_sun (projection along Sun vector)
  readonly shadowPerpendicularKm: Kilometers; // r_perp (perpendicular distance to shadow axis)
}

export interface GroundStationPassState {
  readonly stationId: string;
  readonly stationName: string;
  readonly slantRangeKm: Kilometers;
  readonly elevationDeg: Degrees;
  readonly azimuthDeg?: Degrees;
  readonly isContactActive: boolean; // elevationDeg >= minimumElevationMaskDeg
  readonly minimumElevationMaskDeg: Degrees;
}

export interface OrbitSummary {
  readonly semiMajorAxisKm: Kilometers;
  readonly eccentricity: number;
  readonly inclinationDeg: Degrees;
  readonly semiLatusRectumKm: Kilometers;
  readonly perigeeRadiusKm: Kilometers;
  readonly apogeeRadiusKm: Kilometers;
  readonly perigeeAltitudeKm: Kilometers;
  readonly apogeeAltitudeKm: Kilometers;
  readonly meanMotionRadS: number;
  readonly anomalisticMeanMotionRadS: number;
  readonly keplerianPeriodSeconds: Seconds;
  readonly anomalisticPeriodSeconds: Seconds;
  readonly raanDriftRateRadS: number;
  readonly raanDriftRateDegPerDay: number;
  readonly argOfPeriapsisDriftRateRadS: number;
  readonly argOfPeriapsisDriftRateDegPerDay: number;
  readonly nominalEclipseFraction: number;
  readonly nominalEclipseDurationSeconds: Seconds;
  readonly nominalSunlightDurationSeconds: Seconds;
}

export interface OrbitPropagationState {
  readonly metSeconds: Seconds;
  readonly julianDate: JulianDate;
  readonly osculatingElements: KeplerianElements;
  readonly cartesianEci: CartesianState;
  readonly cartesianEcef: EcefState;
  readonly gmstRad: Radians;
  readonly gmstDeg: Degrees;
  readonly sun: SunEphemerisState;
  readonly groundPasses: readonly GroundStationPassState[];
  readonly activeGroundStation?: GroundStationPassState;
}

// ============================================================================
// 2. Numerical Clamping & Utility Helpers
// ============================================================================

/** Clamps a number to the closed interval [-1.0, 1.0] to prevent NaN in acos/asin */
export function clampUnit(val: number): number {
  if (val < -1.0) return -1.0;
  if (val > 1.0) return 1.0;
  return val;
}

const TWO_PI = 2.0 * Math.PI;
const RAD_TO_DEG = 180.0 / Math.PI;
const DEG_TO_RAD = Math.PI / 180.0;
const SECONDS_PER_DAY = 86400.0;
const RAD_S_TO_DEG_DAY = RAD_TO_DEG * SECONDS_PER_DAY;

// Degenerate orbit tolerances [GAME_ASSUMPTION, Specification §6.4]
const EPS_CIRC = 1e-8;
const EPS_EQ = 1e-8;

// ============================================================================
// 3. Kepler Equation Solver (Danby Starter + Newton-Raphson + Bisection)
// ============================================================================

/**
 * Solves Kepler's transcendental equation M = E - e*sin(E) for Eccentric Anomaly E.
 *
 * Algorithm (Specification §6.1):
 * 1. Scope Guard: eccentricity e in [0.0, MAX_PERMITTED_ECCENTRICITY (0.85)].
 * 2. Mean anomaly normalized to [0, 2π).
 * 3. Circular case (e = 0): returns M directly in 0 iterations.
 * 4. Danby initial starter with symmetry reduction around π.
 * 5. Newton-Raphson iteration (up to 10 iterations, tolerance 1e-12 rad).
 * 6. Guaranteed bisection fallback over [max(0, M_w - e), min(π, M_w + e)].
 * 7. Symmetry restoration and residual check (< 1e-11 rad).
 */
export function solveKeplerEquation(meanAnomalyRad: Radians, eccentricity: number): Radians {
  assertEccentricityBound(eccentricity, "solveKeplerEquation.eccentricity");
  if (!Number.isFinite(meanAnomalyRad)) {
    throw new ValidationError("meanAnomalyRad", `Must be a finite number, received ${meanAnomalyRad}`);
  }

  // Normalize mean anomaly to [0, 2π)
  const M = ((meanAnomalyRad % TWO_PI) + TWO_PI) % TWO_PI;

  // Exact 0-iteration circular solution
  if (eccentricity === 0.0) {
    return radians(M);
  }

  // Symmetry reduction around π
  let M_work = M;
  let sign = 1.0;
  if (M > Math.PI) {
    M_work = TWO_PI - M;
    sign = -1.0;
  }

  // Danby initial starter [DERIVED]
  const sinM = Math.sin(M_work);
  const den = 1.0 - Math.sin(M_work + eccentricity) + sinM;
  let E = M_work + (eccentricity * sinM) / den;

  // Newton-Raphson iteration (quadratic convergence basin)
  let converged = false;
  for (let k = 0; k < 10; k++) {
    const f = E - eccentricity * Math.sin(E) - M_work;
    if (Math.abs(f) < 1e-12) {
      converged = true;
      break;
    }
    const fPrime = 1.0 - eccentricity * Math.cos(E);
    const delta = f / fPrime;
    E -= delta;
    if (Math.abs(delta) < 1e-13) {
      converged = true;
      break;
    }
  }

  // Guaranteed bisection fallback if Newton did not converge within tolerance
  if (!converged || Math.abs(E - eccentricity * Math.sin(E) - M_work) >= 1e-12) {
    let low = Math.max(0.0, M_work - eccentricity);
    let high = Math.min(Math.PI, M_work + eccentricity);

    for (let b = 0; b < 60; b++) {
      const mid = 0.5 * (low + high);
      const fMid = mid - eccentricity * Math.sin(mid) - M_work;
      if (Math.abs(fMid) < 1e-12 || (high - low) < 1e-14) {
        E = mid;
        break;
      }
      const fLow = low - eccentricity * Math.sin(low) - M_work;
      if (fLow * fMid <= 0.0) {
        high = mid;
      } else {
        low = mid;
      }
    }
  }

  // Restore symmetry
  if (sign === -1.0) {
    E = TWO_PI - E;
  }

  // Verify residual assertion
  const residual = Math.abs(E - eccentricity * Math.sin(E) - M);
  if (residual > 1e-11) {
    throw new ValidationError(
      "solveKeplerEquation",
      `Kepler solver residual ${residual} exceeded tolerance 1e-11 for e=${eccentricity}, M=${meanAnomalyRad}`
    );
  }

  return radians(E);
}

// ============================================================================
// 4. Orbital Summary & First-Order Secular J2 Perturbations
// ============================================================================

/**
 * Calculates orbital summary parameters including mean motions, orbital periods,
 * and secular J2 drift rates.
 * Specification §6.1 & §13.
 */
export function calculateOrbitSummary(elements: KeplerianElements): OrbitSummary {
  validateKeplerianElements(elements, "calculateOrbitSummary");

  const a = elements.semiMajorAxisKm;
  const e = elements.eccentricity;
  const iRad = degToRad(elements.inclinationDeg);

  // Semi-latus rectum p = a*(1 - e^2)
  const p = a * (1.0 - e * e);

  // Unperturbed Keplerian mean motion n = sqrt(mu / a^3)
  const n = Math.sqrt(EARTH_GRAVITATIONAL_PARAMETER_KM3_S2 / Math.pow(a, 3));
  const keplerianPeriodSeconds = seconds(TWO_PI / n);

  // Oblateness projection ratio (R_E / p)^2
  const reOverP = EARTH_EQUATORIAL_RADIUS_KM / p;
  const reOverPSq = reOverP * reOverP;

  const cosI = Math.cos(iRad);
  const cosISq = cosI * cosI;

  // Anomalistic mean motion correction n_bar [Specification §6.1 Eq 4]
  const sqrt1MinusESq = Math.sqrt(Math.max(0.0, 1.0 - e * e));
  const anomCorrectionFactor = 1.0 + 0.75 * EARTH_J2_OBLATENESS * reOverPSq * sqrt1MinusESq * (3.0 * cosISq - 1.0);
  const anomalisticMeanMotionRadS = n * anomCorrectionFactor;
  const anomalisticPeriodSeconds = seconds(TWO_PI / anomalisticMeanMotionRadS);

  // Secular J2 Nodal Precession Rate dOmega/dt [Specification §6.1 Eq 2]
  // Note: For prograde (i < 90 deg), cos(i) > 0 => dOmega/dt < 0 (westward).
  // For retrograde (i > 90 deg), cos(i) < 0 => dOmega/dt > 0 (eastward).
  const raanDriftRateRadS = -1.5 * n * EARTH_J2_OBLATENESS * reOverPSq * cosI;
  const raanDriftRateDegPerDay = raanDriftRateRadS * RAD_S_TO_DEG_DAY;

  // Secular J2 Apsidal Rotation Rate domega/dt [Specification §6.1 Eq 3]
  const argOfPeriapsisDriftRateRadS = 0.75 * n * EARTH_J2_OBLATENESS * reOverPSq * (5.0 * cosISq - 1.0);
  const argOfPeriapsisDriftRateDegPerDay = argOfPeriapsisDriftRateRadS * RAD_S_TO_DEG_DAY;

  // Perigee & Apogee geometry
  const perigeeRadiusKm = kilometers(a * (1.0 - e));
  const apogeeRadiusKm = kilometers(a * (1.0 + e));
  const perigeeAltitudeKm = kilometers(perigeeRadiusKm - EARTH_EQUATORIAL_RADIUS_KM);
  const apogeeAltitudeKm = kilometers(apogeeRadiusKm - EARTH_EQUATORIAL_RADIUS_KM);

  // Cylindrical eclipse half-angle at beta = 0 deg [Specification §13 Case S-1]
  const sinAlpha = clampUnit(EARTH_EQUATORIAL_RADIUS_KM / a);
  const alphaRad = Math.asin(sinAlpha);
  const nominalEclipseFraction = alphaRad / Math.PI;
  const nominalEclipseDurationSeconds = seconds(nominalEclipseFraction * keplerianPeriodSeconds);
  const nominalSunlightDurationSeconds = seconds(keplerianPeriodSeconds - nominalEclipseDurationSeconds);

  return {
    semiMajorAxisKm: elements.semiMajorAxisKm,
    eccentricity: elements.eccentricity,
    inclinationDeg: elements.inclinationDeg,
    semiLatusRectumKm: kilometers(p),
    perigeeRadiusKm,
    apogeeRadiusKm,
    perigeeAltitudeKm,
    apogeeAltitudeKm,
    meanMotionRadS: n,
    anomalisticMeanMotionRadS,
    keplerianPeriodSeconds,
    anomalisticPeriodSeconds,
    raanDriftRateRadS,
    raanDriftRateDegPerDay,
    argOfPeriapsisDriftRateRadS,
    argOfPeriapsisDriftRateDegPerDay,
    nominalEclipseFraction,
    nominalEclipseDurationSeconds,
    nominalSunlightDurationSeconds,
  };
}

/**
 * Propagates Keplerian orbital elements forward by elapsedSeconds using first-order
 * secular J2 perturbations (RAAN, argument of periapsis, and anomalistic mean anomaly).
 * Specification §6.1 Eq 5.
 */
export function propagateKeplerianElements(
  initialElements: KeplerianElements,
  elapsedSeconds: Seconds
): KeplerianElements {
  validateKeplerianElements(initialElements, "propagateKeplerianElements");
  assertFiniteNonNegative(elapsedSeconds, "propagateKeplerianElements.elapsedSeconds");

  if (elapsedSeconds === 0) {
    return initialElements;
  }

  const summary = calculateOrbitSummary(initialElements);

  // Propagate angles with secular drift
  const deltaRaanDeg = summary.raanDriftRateRadS * elapsedSeconds * RAD_TO_DEG;
  const deltaArgPDeg = summary.argOfPeriapsisDriftRateRadS * elapsedSeconds * RAD_TO_DEG;
  const deltaMeanAnomalyDeg = summary.anomalisticMeanMotionRadS * elapsedSeconds * RAD_TO_DEG;

  const newRaanDeg = normalizeAngleDeg(degrees(initialElements.raanDeg + deltaRaanDeg));
  const newArgPDeg = normalizeAngleDeg(degrees(initialElements.argOfPeriapsisDeg + deltaArgPDeg));
  const newMeanAnomalyDeg = normalizeAngleDeg(degrees(initialElements.meanAnomalyAtEpochDeg + deltaMeanAnomalyDeg));

  return {
    semiMajorAxisKm: initialElements.semiMajorAxisKm,
    eccentricity: initialElements.eccentricity,
    inclinationDeg: initialElements.inclinationDeg,
    raanDeg: newRaanDeg,
    argOfPeriapsisDeg: newArgPDeg,
    meanAnomalyAtEpochDeg: newMeanAnomalyDeg,
  };
}

// ============================================================================
// 5. Coordinate Transformations: Keplerian <-> Cartesian ECI
// ============================================================================

/**
 * Transforms osculating Keplerian orbital elements to ECI Cartesian position and velocity.
 * Specification §6.1 Eq 6 & Eq 7.
 */
export function keplerianToCartesian(elements: KeplerianElements): CartesianState {
  validateKeplerianElements(elements, "keplerianToCartesian");

  const a = elements.semiMajorAxisKm;
  const e = elements.eccentricity;
  const iRad = degToRad(elements.inclinationDeg);
  const raanRad = degToRad(elements.raanDeg);
  const argPRad = degToRad(elements.argOfPeriapsisDeg);
  const mRad = degToRad(elements.meanAnomalyAtEpochDeg);

  // Solve Kepler equation M -> E
  const eRad = solveKeplerEquation(mRad, e);

  const cosE = Math.cos(eRad);
  const sinE = Math.sin(eRad);

  // Orbital radius and semi-latus rectum
  const r = a * (1.0 - e * cosE);
  const p = a * (1.0 - e * e);

  // True anomaly nu
  const cosNu = (cosE - e) / (1.0 - e * cosE);
  const sinNu = (Math.sqrt(Math.max(0.0, 1.0 - e * e)) * sinE) / (1.0 - e * cosE);
  const nu = Math.atan2(sinNu, cosNu);

  // Perifocal frame coordinates (P, Q, W)
  const rPqwX = r * Math.cos(nu);
  const rPqwY = r * Math.sin(nu);

  const vFactor = Math.sqrt(EARTH_GRAVITATIONAL_PARAMETER_KM3_S2 / p);
  const vPqwX = -vFactor * Math.sin(nu);
  const vPqwY = vFactor * (e + Math.cos(nu));

  // Transformation matrix components from Perifocal to ECI
  const cosRaan = Math.cos(raanRad);
  const sinRaan = Math.sin(raanRad);
  const cosArgP = Math.cos(argPRad);
  const sinArgP = Math.sin(argPRad);
  const cosI = Math.cos(iRad);
  const sinI = Math.sin(iRad);

  const px = cosRaan * cosArgP - sinRaan * sinArgP * cosI;
  const py = sinRaan * cosArgP + cosRaan * sinArgP * cosI;
  const pz = sinArgP * sinI;

  const qx = -cosRaan * sinArgP - sinRaan * cosArgP * cosI;
  const qy = -sinRaan * sinArgP + cosRaan * cosArgP * cosI;
  const qz = cosArgP * sinI;

  const rx = kilometers(rPqwX * px + rPqwY * qx);
  const ry = kilometers(rPqwX * py + rPqwY * qy);
  const rz = kilometers(rPqwX * pz + rPqwY * qz);

  const vx = kmps(vPqwX * px + vPqwY * qx);
  const vy = kmps(vPqwX * py + vPqwY * qy);
  const vz = kmps(vPqwX * pz + vPqwY * qz);

  const rMag = Math.sqrt(rx * rx + ry * ry + rz * rz);
  const vMag = Math.sqrt(vx * vx + vy * vy + vz * vz);

  return {
    positionEciKm: [rx, ry, rz] as const,
    velocityEciKmS: [vx, vy, vz] as const,
    altitudeKm: kilometers(rMag - EARTH_EQUATORIAL_RADIUS_KM),
    speedKmS: kmps(vMag),
  };
}

/**
 * Inverts an ECI Cartesian state (r, v) to osculating Keplerian orbital elements.
 * Implements signed atan2 quadrant formulations across all 4 classical degenerate cases:
 * 1. General (inclined, eccentric)
 * 2. Equatorial Eccentric (inc ≈ 0 or π, e > 0)
 * 3. Circular Inclined (e ≈ 0, inc ≉ 0, π)
 * 4. Circular Equatorial (e ≈ 0, inc ≈ 0 or π)
 * Specification §6.4 [DEF-01 resolved]. Source: Vallado 4th ed. §2.5.
 */
export function cartesianToKeplerian(
  positionEciKm: readonly [Kilometers, Kilometers, Kilometers],
  velocityEciKmS: readonly [KilometersPerSecond, KilometersPerSecond, KilometersPerSecond]
): KeplerianElements {
  const rx = positionEciKm[0];
  const ry = positionEciKm[1];
  const rz = positionEciKm[2];

  const vx = velocityEciKmS[0];
  const vy = velocityEciKmS[1];
  const vz = velocityEciKmS[2];

  const r = Math.sqrt(rx * rx + ry * ry + rz * rz);
  const vSq = vx * vx + vy * vy + vz * vz;

  if (!Number.isFinite(r) || r <= EARTH_EQUATORIAL_RADIUS_KM) {
    throw new ValidationError(
      "cartesianToKeplerian",
      `Position radius ${r} km is subterranean (<= Earth equatorial radius ${EARTH_EQUATORIAL_RADIUS_KM} km)`
    );
  }

  // Specific angular momentum h = r x v
  const hx = ry * vz - rz * vy;
  const hy = rz * vx - rx * vz;
  const hz = rx * vy - ry * vx;
  const hMag = Math.sqrt(hx * hx + hy * hy + hz * hz);

  if (hMag <= 1e-12) {
    throw new ValidationError("cartesianToKeplerian", "Angular momentum magnitude is zero (rectilinear orbit)");
  }

  // Node line vector n = k x h = [-hy, hx, 0]
  const nx = -hy;
  const ny = hx;
  const nMag = Math.sqrt(nx * nx + ny * ny);

  // Specific mechanical energy & semi-major axis
  const energy = vSq / 2.0 - EARTH_GRAVITATIONAL_PARAMETER_KM3_S2 / r;
  if (energy >= 0.0) {
    throw new ValidationError("cartesianToKeplerian", "Parabolic or hyperbolic orbit (energy >= 0) is not supported");
  }
  const a = -EARTH_GRAVITATIONAL_PARAMETER_KM3_S2 / (2.0 * energy);

  // Eccentricity vector e = (1/mu) * [(v^2 - mu/r)*r - (r.v)*v]
  const rDotV = rx * vx + ry * vy + rz * vz;
  const coeffR = vSq - EARTH_GRAVITATIONAL_PARAMETER_KM3_S2 / r;
  const ex = (coeffR * rx - rDotV * vx) / EARTH_GRAVITATIONAL_PARAMETER_KM3_S2;
  const ey = (coeffR * ry - rDotV * vy) / EARTH_GRAVITATIONAL_PARAMETER_KM3_S2;
  const ez = (coeffR * rz - rDotV * vz) / EARTH_GRAVITATIONAL_PARAMETER_KM3_S2;
  const e = Math.sqrt(ex * ex + ey * ey + ez * ez);

  assertEccentricityBound(e, "cartesianToKeplerian.eccentricity");

  // Inclination i in [0, π]
  const incRad = Math.atan2(nMag, hz);

  const isCircular = e < EPS_CIRC;
  const isEquatorial = nMag < EPS_EQ;

  let raanRad = 0.0;
  let argPRad = 0.0;
  let nuRad = 0.0;

  if (!isEquatorial && !isCircular) {
    // Case 1: General (inclined, eccentric)
    raanRad = Math.atan2(hx, -hy);
    const nDotE = -hy * ex + hx * ey;
    argPRad = Math.atan2(hMag * ez, nDotE);

    // Vector cross-product: (r x h) . e / h
    const rxH_x = ry * hz - rz * hy;
    const rxH_y = rz * hx - rx * hz;
    const rxH_z = rx * hy - ry * hx;
    const sinNuTerm = (rxH_x * ex + rxH_y * ey + rxH_z * ez) / hMag;
    const cosNuTerm = rx * ex + ry * ey + rz * ez;
    nuRad = Math.atan2(sinNuTerm, cosNuTerm);
  } else if (isEquatorial && !isCircular) {
    // Case 2: Equatorial eccentric (inc ≈ 0 or π, e > 0)
    raanRad = 0.0;
    if (hz >= 0.0) {
      // Prograde equatorial
      argPRad = Math.atan2(ey, ex);
    } else {
      // Retrograde equatorial
      argPRad = Math.atan2(-ey, ex);
    }

    const rxH_x = ry * hz - rz * hy;
    const rxH_y = rz * hx - rx * hz;
    const rxH_z = rx * hy - ry * hx;
    const sinNuTerm = (rxH_x * ex + rxH_y * ey + rxH_z * ez) / hMag;
    const cosNuTerm = rx * ex + ry * ey + rz * ez;
    nuRad = Math.atan2(sinNuTerm, cosNuTerm);
  } else if (!isEquatorial && isCircular) {
    // Case 3: Circular inclined (e ≈ 0, inc != 0, π)
    raanRad = Math.atan2(hx, -hy);
    argPRad = 0.0;
    // nu = argument of latitude u = atan2(h * rz, n . r)
    const nDotR = -hy * rx + hx * ry;
    nuRad = Math.atan2(hMag * rz, nDotR);
  } else {
    // Case 4: Circular equatorial (e ≈ 0, inc ≈ 0 or π)
    raanRad = 0.0;
    argPRad = 0.0;
    // nu = true longitude lambda
    if (hz >= 0.0) {
      nuRad = Math.atan2(ry, rx);
    } else {
      nuRad = Math.atan2(-ry, rx);
    }
  }

  // Normalize angles to [0, 2π)
  raanRad = ((raanRad % TWO_PI) + TWO_PI) % TWO_PI;
  argPRad = ((argPRad % TWO_PI) + TWO_PI) % TWO_PI;
  nuRad = ((nuRad % TWO_PI) + TWO_PI) % TWO_PI;

  // Mean anomaly M calculation
  let mRad = nuRad;
  if (!isCircular) {
    const cosNu = Math.cos(nuRad);
    const sinNu = Math.sin(nuRad);
    const denom = 1.0 + e * cosNu;
    const cosE = (e + cosNu) / denom;
    const sinE = (Math.sqrt(Math.max(0.0, 1.0 - e * e)) * sinNu) / denom;
    const eAnomaly = Math.atan2(sinE, cosE);
    mRad = eAnomaly - e * Math.sin(eAnomaly);
    mRad = ((mRad % TWO_PI) + TWO_PI) % TWO_PI;
  }

  // Snap angles extremely close to 0 / 360 to exactly 0 to prevent floating-point branch jump
  const snapZeroDeg = (deg: number): Degrees => {
    const norm = ((deg % 360.0) + 360.0) % 360.0;
    if (norm < 1e-10 || Math.abs(norm - 360.0) < 1e-10) return degrees(0.0);
    return degrees(norm);
  };

  const elements: KeplerianElements = {
    semiMajorAxisKm: kilometers(a),
    eccentricity: e,
    inclinationDeg: snapZeroDeg(incRad * RAD_TO_DEG),
    raanDeg: snapZeroDeg(raanRad * RAD_TO_DEG),
    argOfPeriapsisDeg: snapZeroDeg(argPRad * RAD_TO_DEG),
    meanAnomalyAtEpochDeg: snapZeroDeg(mRad * RAD_TO_DEG),
  };

  validateKeplerianElements(elements, "cartesianToKeplerian.result");
  return elements;
}

// ============================================================================
// 6. GMST & ECI <-> ECEF Coordinate Transformations
// ============================================================================

/**
 * Calculates Greenwich Mean Sidereal Time (GMST) in radians at elapsedSeconds from epochJd.
 * Uses IAU-1982 linear epoch initialization formula [Specification §6.3 Point 4, DEF-05 resolved].
 */
export function calculateGmst(epochJd: JulianDate, elapsedSeconds: Seconds): Radians {
  assertFinitePositive(epochJd, "calculateGmst.epochJd");
  assertFiniteNonNegative(elapsedSeconds, "calculateGmst.elapsedSeconds");

  // Days from J2000.0 epoch (JD 2451545.0)
  const d = epochJd - 2451545.0;

  // IAU-1982 linear formula for GMST0 in degrees
  let gmst0Deg = (280.46061837 + 360.98564736629 * d) % 360.0;
  if (gmst0Deg < 0.0) gmst0Deg += 360.0;

  // Advance by nominal sidereal rotation rate
  const gmst0Rad = gmst0Deg * DEG_TO_RAD;
  const currentGmstRad = (gmst0Rad + EARTH_ROTATION_RATE_RAD_PER_S * elapsedSeconds) % TWO_PI;
  return radians(currentGmstRad < 0.0 ? currentGmstRad + TWO_PI : currentGmstRad);
}

/**
 * Transforms ECI Cartesian coordinates to ECEF rotating coordinates using GMST.
 * Rigorously incorporates the kinematic transport theorem for velocity:
 * v_ECEF = R_z(theta) * v_ECI - omega_E x r_ECEF [Specification §6.3 Point 5, DEF-02 resolved].
 */
export function transformEciToEcef(
  positionEciKm: readonly [Kilometers, Kilometers, Kilometers],
  gmstRad: Radians,
  velocityEciKmS?: readonly [KilometersPerSecond, KilometersPerSecond, KilometersPerSecond]
): EcefState {
  const cosT = Math.cos(gmstRad);
  const sinT = Math.sin(gmstRad);

  const xEci = positionEciKm[0];
  const yEci = positionEciKm[1];
  const zEci = positionEciKm[2];

  // Passive coordinate frame rotation matrix R_z(theta)
  const xEcef = kilometers(cosT * xEci + sinT * yEci);
  const yEcef = kilometers(-sinT * xEci + cosT * yEci);
  const zEcef = kilometers(zEci);

  let velocityEcefKmS: readonly [KilometersPerSecond, KilometersPerSecond, KilometersPerSecond] | undefined;

  if (velocityEciKmS) {
    const vxEci = velocityEciKmS[0];
    const vyEci = velocityEciKmS[1];
    const vzEci = velocityEciKmS[2];

    // Simply rotated velocity components
    const vxRot = cosT * vxEci + sinT * vyEci;
    const vyRot = -sinT * vxEci + cosT * vyEci;
    const vzRot = vzEci;

    // Transport theorem correction: - (omega_E x r_ECEF)
    // omega_E x r_ECEF = [-omega_E * y_ECEF, omega_E * x_ECEF, 0]
    // Subtracting: v_ECEF = [vxRot + omega_E * y_ECEF, vyRot - omega_E * x_ECEF, vzRot]
    const vxEcef = kmps(vxRot + EARTH_ROTATION_RATE_RAD_PER_S * yEcef);
    const vyEcef = kmps(vyRot - EARTH_ROTATION_RATE_RAD_PER_S * xEcef);
    const vzEcef = kmps(vzRot);

    velocityEcefKmS = [vxEcef, vyEcef, vzEcef] as const;
  }

  return {
    positionEcefKm: [xEcef, yEcef, zEcef] as const,
    velocityEcefKmS,
  };
}

// ============================================================================
// 7. Solar Ephemeris & Cylindrical Shadow Eclipse Geometry
// ============================================================================

/**
 * Calculates low-precision analytical solar vector and cylindrical Earth shadow eclipse state.
 * Specification §6.2.
 */
export function calculateSunEphemeris(
  jd: JulianDate,
  positionEciKm: readonly [Kilometers, Kilometers, Kilometers]
): SunEphemerisState {
  assertFinitePositive(jd, "calculateSunEphemeris.jd");

  const nDays = jd - 2451545.0;

  // Low-precision Astronomical Almanac / Meeus solar ephemeris
  let lSolarDeg = (280.46 + 0.9856474 * nDays) % 360.0;
  if (lSolarDeg < 0.0) lSolarDeg += 360.0;

  let gSolarDeg = (357.528 + 0.9856003 * nDays) % 360.0;
  if (gSolarDeg < 0.0) gSolarDeg += 360.0;

  const gSolarRad = gSolarDeg * DEG_TO_RAD;
  let lambdaDeg = lSolarDeg + 1.915 * Math.sin(gSolarRad) + 0.02 * Math.sin(2.0 * gSolarRad);
  lambdaDeg = lambdaDeg % 360.0;
  if (lambdaDeg < 0.0) lambdaDeg += 360.0;

  const epsRad = (23.439 - 0.0000004 * nDays) * DEG_TO_RAD;
  const lambdaRad = lambdaDeg * DEG_TO_RAD;

  const sx = Math.cos(lambdaRad);
  const sy = Math.sin(lambdaRad) * Math.cos(epsRad);
  const sz = Math.sin(lambdaRad) * Math.sin(epsRad);

  const sNorm = Math.sqrt(sx * sx + sy * sy + sz * sz);
  const sunVectorEci: readonly [number, number, number] = [sx / sNorm, sy / sNorm, sz / sNorm];

  const rx = positionEciKm[0];
  const ry = positionEciKm[1];
  const rz = positionEciKm[2];

  // Projection along Earth-Sun axis
  const xSun = rx * sunVectorEci[0] + ry * sunVectorEci[1] + rz * sunVectorEci[2];

  // Perpendicular distance from shadow axis with floating-point roundoff protection
  const rSatSq = rx * rx + ry * ry + rz * rz;
  const rPerpSq = Math.max(0.0, rSatSq - xSun * xSun);
  const rPerp = Math.sqrt(rPerpSq);

  // Cylindrical shadow eclipse condition: x_sun < 0 AND r_perp < R_earth
  const inEclipse = xSun < 0.0 && rPerp < EARTH_EQUATORIAL_RADIUS_KM;
  const sunlightFraction = inEclipse ? 0.0 : 1.0;

  return {
    sunVectorEci,
    inEclipse,
    sunlightFraction,
    shadowProjectionKm: kilometers(xSun),
    shadowPerpendicularKm: kilometers(rPerp),
  };
}

// ============================================================================
// 8. Ground Station Pass Topocentric Geometry
// ============================================================================

/**
 * Calculates topocentric slant range, elevation angle, and contact status for a ground station.
 * Specification §6.3 Point 3.
 */
export function calculateGroundStationPass(
  satPositionEcefKm: readonly [Kilometers, Kilometers, Kilometers],
  station: GroundStationLocation
): GroundStationPassState {
  const latRad = degToRad(station.latitudeDeg);
  const lonRad = degToRad(station.longitudeDeg);
  const stationAltKm = station.altitudeMeters / 1000.0;

  const cosLat = Math.cos(latRad);
  const sinLat = Math.sin(latRad);
  const cosLon = Math.cos(lonRad);
  const sinLon = Math.sin(lonRad);

  // Ground station position in ECEF [km] (spherical Earth assumption)
  const stationRadiusKm = EARTH_EQUATORIAL_RADIUS_KM + stationAltKm;
  const gsX = stationRadiusKm * cosLat * cosLon;
  const gsY = stationRadiusKm * cosLat * sinLon;
  const gsZ = stationRadiusKm * sinLat;

  // Local zenith unit vector
  const uUpX = cosLat * cosLon;
  const uUpY = cosLat * sinLon;
  const uUpZ = sinLat;

  // Slant range vector rho = r_sat - r_gs
  const rhoX = satPositionEcefKm[0] - gsX;
  const rhoY = satPositionEcefKm[1] - gsY;
  const rhoZ = satPositionEcefKm[2] - gsZ;
  const slantRangeKm = kilometers(Math.sqrt(rhoX * rhoX + rhoY * rhoY + rhoZ * rhoZ));

  if (slantRangeKm <= 1e-6) {
    // Satellite is coincident with station
    return {
      stationId: station.id,
      stationName: station.name,
      slantRangeKm,
      elevationDeg: degrees(90.0),
      azimuthDeg: degrees(0.0),
      isContactActive: true,
      minimumElevationMaskDeg: station.minimumElevationMaskDeg,
    };
  }

  // Topocentric elevation angle beta_elev = asin(clampUnit((rho . u_up) / d))
  const rhoDotUp = rhoX * uUpX + rhoY * uUpY + rhoZ * uUpZ;
  const sinElev = clampUnit(rhoDotUp / slantRangeKm);
  const elevRad = Math.asin(sinElev);
  const elevationDeg = degrees(elevRad * RAD_TO_DEG);

  // Topocentric Azimuth (East, North coordinates)
  const uEastX = -sinLon;
  const uEastY = cosLon;
  const uEastZ = 0.0;

  const uNorthX = -sinLat * cosLon;
  const uNorthY = -sinLat * sinLon;
  const uNorthZ = cosLat;

  const rhoEast = rhoX * uEastX + rhoY * uEastY + rhoZ * uEastZ;
  const rhoNorth = rhoX * uNorthX + rhoY * uNorthY + rhoZ * uNorthZ;

  let azRad = Math.atan2(rhoEast, rhoNorth);
  if (azRad < 0.0) azRad += TWO_PI;
  const azimuthDeg = degrees(azRad * RAD_TO_DEG);

  const maskDeg = station.minimumElevationMaskDeg ?? degrees(GROUND_STATION_DEFAULT_ELEVATION_MASK_DEG);
  const isContactActive = elevationDeg >= maskDeg;

  return {
    stationId: station.id,
    stationName: station.name,
    slantRangeKm,
    elevationDeg,
    azimuthDeg,
    isContactActive,
    minimumElevationMaskDeg: maskDeg,
  };
}

// ============================================================================
// 9. Impulsive Maneuver Re-osculation Contract
// ============================================================================

/**
 * Applies an impulsive delta-v maneuver in ECI Cartesian coordinates to current osculating elements,
 * returning the new post-burn osculating Keplerian elements.
 * Pure function with zero side effects [Specification §6.5, DEF-03 resolved].
 */
export function applyImpulsiveManeuver(
  currentElements: KeplerianElements,
  deltaVEciKmS: readonly [KilometersPerSecond, KilometersPerSecond, KilometersPerSecond]
): KeplerianElements {
  validateKeplerianElements(currentElements, "applyImpulsiveManeuver.currentElements");

  // Step 1: Evaluate Cartesian state of current elements
  const preBurnCartesian = keplerianToCartesian(currentElements);

  // Step 2: Instantaneous velocity update in ECI
  const postBurnVx = kmps(preBurnCartesian.velocityEciKmS[0] + deltaVEciKmS[0]);
  const postBurnVy = kmps(preBurnCartesian.velocityEciKmS[1] + deltaVEciKmS[1]);
  const postBurnVz = kmps(preBurnCartesian.velocityEciKmS[2] + deltaVEciKmS[2]);

  // Step 3: Re-osculate to new Keplerian elements
  return cartesianToKeplerian(preBurnCartesian.positionEciKm, [postBurnVx, postBurnVy, postBurnVz]);
}

// ============================================================================
// 10. High-Level Propagation Orchestrator
// ============================================================================

/**
 * Propagates the orbit to a target MET seconds, evaluating the full orbital, Cartesian,
 * planetary GMST, solar ephemeris, and ground station pass states.
 */
export function propagateOrbit(
  elements: KeplerianElements,
  epochJd: JulianDate,
  metSeconds: Seconds,
  groundStations?: readonly GroundStationLocation[]
): OrbitPropagationState {
  validateKeplerianElements(elements, "propagateOrbit.elements");
  assertFinitePositive(epochJd, "propagateOrbit.epochJd");
  assertFiniteNonNegative(metSeconds, "propagateOrbit.metSeconds");

  // Current Julian Date
  const currentJd = julianDate(epochJd + metSeconds / SECONDS_PER_DAY);

  // 1. Propagate osculating elements with secular J2 drift
  const osculatingElements = propagateKeplerianElements(elements, metSeconds);

  // 2. Cartesian ECI state
  const cartesianEci = keplerianToCartesian(osculatingElements);

  // 3. GMST and ECEF frame transformation
  const gmstRad = calculateGmst(epochJd, metSeconds);
  const gmstDeg = normalizeAngleDeg(degrees(gmstRad * RAD_TO_DEG));
  const cartesianEcef = transformEciToEcef(cartesianEci.positionEciKm, gmstRad, cartesianEci.velocityEciKmS);

  // 4. Solar ephemeris and cylindrical shadow eclipse
  const sun = calculateSunEphemeris(currentJd, cartesianEci.positionEciKm);

  // 5. Ground station visibility passes
  const groundPasses: GroundStationPassState[] = [];
  let activeGroundStation: GroundStationPassState | undefined;

  if (groundStations && groundStations.length > 0) {
    for (const station of groundStations) {
      const pass = calculateGroundStationPass(cartesianEcef.positionEcefKm, station);
      groundPasses.push(pass);
      if (pass.isContactActive && (!activeGroundStation || pass.elevationDeg > activeGroundStation.elevationDeg)) {
        activeGroundStation = pass;
      }
    }
  }

  return {
    metSeconds,
    julianDate: currentJd,
    osculatingElements,
    cartesianEci,
    cartesianEcef,
    gmstRad,
    gmstDeg,
    sun,
    groundPasses,
    activeGroundStation,
  };
}

// ============================================================================
// 11. Stateful OrbitSimulator Class Facade
// ============================================================================

export interface OrbitSimulatorOptions {
  readonly elements: KeplerianElements;
  readonly epochJulianDate?: JulianDate;
  readonly groundStations?: readonly GroundStationLocation[];
}

/**
 * Deterministic facade for orbital trajectory propagation, ground tracking,
 * and impulsive maneuver branching.
 */
export class OrbitSimulator {
  private _referenceElements: KeplerianElements;
  private _referenceEpochJd: JulianDate;
  private _referenceMetSeconds: Seconds;
  private _initialElements: KeplerianElements;
  private _initialEpochJd: JulianDate;
  private _groundStations: readonly GroundStationLocation[];
  private _summary: OrbitSummary;

  constructor(options: OrbitSimulatorOptions) {
    if (!options || typeof options !== "object") {
      throw new ValidationError("OrbitSimulator", "Options must be a defined object");
    }
    validateKeplerianElements(options.elements, "OrbitSimulator.elements");

    this._initialElements = options.elements;
    this._referenceElements = options.elements;
    this._initialEpochJd = options.epochJulianDate ?? julianDate(2451545.0); // Default J2000.0
    this._referenceEpochJd = this._initialEpochJd;
    this._referenceMetSeconds = seconds(0);
    this._groundStations = options.groundStations ? Object.freeze([...options.groundStations]) : Object.freeze([]);
    this._summary = calculateOrbitSummary(options.elements);
  }

  /** Returns orbital summary parameters of initial elements */
  public getSummary(): OrbitSummary {
    return this._summary;
  }

  /** Returns initial osculating elements at t = 0 */
  public getInitialElements(): KeplerianElements {
    return this._initialElements;
  }

  /** Returns current reference epoch Julian Date */
  public getEpochJulianDate(): JulianDate {
    return this._referenceEpochJd;
  }

  /**
   * Propagates orbit to specified Mission Elapsed Time (MET seconds).
   */
  public propagate(metSeconds: Seconds): OrbitPropagationState {
    assertFiniteNonNegative(metSeconds, "OrbitSimulator.propagate.metSeconds");

    // Elapsed seconds from current reference anchor
    const elapsedFromRef = seconds(metSeconds - this._referenceMetSeconds);
    if (elapsedFromRef < 0) {
      throw new ValidationError(
        "OrbitSimulator.propagate",
        `Requested MET ${metSeconds} s is prior to reference maneuver anchor ${this._referenceMetSeconds} s`
      );
    }

    return propagateOrbit(this._referenceElements, this._referenceEpochJd, elapsedFromRef, this._groundStations);
  }

  /**
   * Immutable branching: Returns a new OrbitSimulator instance anchored at the maneuver epoch
   * with post-burn osculating elements. Leaves current simulator instance unchanged.
   */
  public withManeuver(
    metSeconds: Seconds,
    deltaVEciKmS: readonly [KilometersPerSecond, KilometersPerSecond, KilometersPerSecond]
  ): OrbitSimulator {
    const currentState = this.propagate(metSeconds);
    const postBurnElements = applyImpulsiveManeuver(currentState.osculatingElements, deltaVEciKmS);

    return new OrbitSimulator({
      elements: postBurnElements,
      epochJulianDate: currentState.julianDate,
      groundStations: this._groundStations,
    });
  }

  /**
   * Monotonic forward transition: Updates internal reference elements in-place to post-burn elements.
   */
  public executeManeuver(
    metSeconds: Seconds,
    deltaVEciKmS: readonly [KilometersPerSecond, KilometersPerSecond, KilometersPerSecond]
  ): KeplerianElements {
    const currentState = this.propagate(metSeconds);
    const postBurnElements = applyImpulsiveManeuver(currentState.osculatingElements, deltaVEciKmS);

    this._referenceElements = postBurnElements;
    this._referenceEpochJd = currentState.julianDate;
    this._referenceMetSeconds = metSeconds;
    this._summary = calculateOrbitSummary(postBurnElements);

    return postBurnElements;
  }
}
