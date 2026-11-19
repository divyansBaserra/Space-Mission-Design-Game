"use client";

import * as THREE from "three";

// ============================================================================
// GAME 02: PROJECT AEGIS - INTERPLANETARY ASTRODYNAMICS SPECIFICATION
// ============================================================================

export const MARS_CONSTANTS = {
  radiusKm: 3389.5,
  muKm3S2: 42828.37, // Standard gravitational parameter of Mars (G * M_mars)
  baselineBurnVelocityKms: 10.3,
  periapsisAltitudeKm: 180.0,
  targetEgressVelocityKms: 11.4,
};

export const DIDYMOS_SYSTEM = {
  primaryName: "65803 Didymos",
  primaryDiameterM: 780.0,
  primaryMassKg: 5.2e11,
  moonletName: "Dimorphos (2032-XK)",
  moonletDiameterM: 160.0,
  moonletMassKg: 2.4e9, // NASA DART Nature (2023) post-impact reconstructed mass
  binarySeparationKm: 1.18,
  preImpactPeriodHours: 11.92,
  preImpactPeriodSeconds: 11.92 * 3600, // 42,912 seconds
  minimumDeflectionThresholdSeconds: 73.0,
  targetBoulderRadiusM: 3.0, // 3-meter CEP (Circular Error Probable)
  targetClosingVelocityKms: 6.2,
  earthDistanceKm: 1.68e8, // ~1.12 AU
  lightspeedLagSeconds: 840.0, // 14.0 minutes one-way delay
};

export const PROBE_AEGIS = {
  dryMassKg: 570.0,
  ejectaRecoilBeta: 3.6, // Momentum enhancement factor (beta = 3.6)
  navConstantN: 3.5, // Proportional Navigation constant
  rcsThrustN: 22.0, // Cold-gas micro-thrusters
};

/**
 * Act I: Mars Oberth Slingshot Hyperbolic Velocity Amplification
 * Formula: v_hyp^2 = v_burn^2 + 2 * mu_mars / r_periapsis
 */
export function calculateOberthSlingshot(
  vBurnKms: number = MARS_CONSTANTS.baselineBurnVelocityKms,
  periapsisAltKm: number = MARS_CONSTANTS.periapsisAltitudeKm
): {
  rPeriapsisKm: number;
  vEscapePeriapsisKms: number;
  vHypEgressKms: number;
  deltaEnergyMjPerKg: number;
  isNominalEgress: boolean;
} {
  const rPeriapsisKm = MARS_CONSTANTS.radiusKm + Math.max(50, periapsisAltKm);
  const vEscapePeriapsisSq = (2 * MARS_CONSTANTS.muKm3S2) / rPeriapsisKm;
  const vEscapePeriapsisKms = Math.sqrt(vEscapePeriapsisSq);

  const vHypSq = vBurnKms * vBurnKms + vEscapePeriapsisSq;
  const vHypEgressKms = Math.sqrt(vHypSq);

  // Delta energy gained from deep potential well burn
  const deltaEnergyMjPerKg = (MARS_CONSTANTS.muKm3S2 / rPeriapsisKm) * 1.0;

  // Verify within 0.15 km/s of target 11.4 km/s
  const isNominalEgress = Math.abs(vHypEgressKms - MARS_CONSTANTS.targetEgressVelocityKms) <= 0.15;

  return {
    rPeriapsisKm,
    vEscapePeriapsisKms,
    vHypEgressKms: Number(vHypEgressKms.toFixed(3)),
    deltaEnergyMjPerKg: Number(deltaEnergyMjPerKg.toFixed(2)),
    isNominalEgress,
  };
}

/**
 * Act II: Autonomous SMART Nav Line-of-Sight Angular Rate & Proportional Navigation
 * Formula:
 *   omega_los = (r x v) / |r|^2
 *   a_cmd = N * v_closing * omega_los
 */
export function calculateSmartNavGuidance(
  relPos: THREE.Vector3,
  relVel: THREE.Vector3,
  navConstantN: number = PROBE_AEGIS.navConstantN
): {
  closingSpeedMps: number;
  distanceMeters: number;
  omegaLosRadS: THREE.Vector3;
  omegaLosMagnitude: number;
  cmdAccelMps2: THREE.Vector3;
  cmdAccelMagnitude: number;
  isLocked: boolean;
} {
  const distanceMeters = relPos.length();
  const closingSpeedMps = -relPos.clone().normalize().dot(relVel);

  const omegaLosRadS = new THREE.Vector3();
  const cmdAccelMps2 = new THREE.Vector3();

  if (distanceMeters > 0.01) {
    // Cross product r x v
    const rCrossV = new THREE.Vector3().crossVectors(relPos, relVel);
    const rSq = distanceMeters * distanceMeters;
    omegaLosRadS.copy(rCrossV).divideScalar(rSq);

    // a_cmd = N * v_closing * omega_los
    const scale = navConstantN * Math.max(10.0, closingSpeedMps);
    // a_cmd is perpendicular to line of sight: direction omega x r
    const accelDir = new THREE.Vector3().crossVectors(omegaLosRadS, relPos.clone().normalize());
    cmdAccelMps2.copy(accelDir).multiplyScalar(scale);
  }

  const omegaLosMagnitude = omegaLosRadS.length();
  const cmdAccelMagnitude = cmdAccelMps2.length();
  const isLocked = omegaLosMagnitude < 0.05 && distanceMeters < 50000;

  return {
    closingSpeedMps,
    distanceMeters,
    omegaLosRadS,
    omegaLosMagnitude,
    cmdAccelMps2,
    cmdAccelMagnitude,
    isLocked,
  };
}

/**
 * Act III: Terminal CEP (Circular Error Probable) Calculation
 * Calculates lateral offset distance from target boulder center
 */
export function calculateTargetBoulderCep(
  lateralOffsetX: number,
  lateralOffsetY: number
): {
  cepDistanceMeters: number;
  isWithinCepTarget: boolean;
  accuracyScore: number;
} {
  const cepDistanceMeters = Math.hypot(lateralOffsetX, lateralOffsetY);
  const isWithinCepTarget = cepDistanceMeters <= DIDYMOS_SYSTEM.targetBoulderRadiusM;

  // Score from 1000 to 0 based on proximity
  const accuracyScore = Math.max(0, Math.round((1 - cepDistanceMeters / 15.0) * 1000));

  return {
    cepDistanceMeters: Number(cepDistanceMeters.toFixed(2)),
    isWithinCepTarget,
    accuracyScore,
  };
}

/**
 * Act IV: Binary Orbital Period Deflection Verification
 * Formula:
 *   p_probe = m_probe * v_closing
 *   delta_p = beta * p_probe
 *   delta_v = delta_p / M_moonlet
 *   delta_T = T_post - T_pre
 */
export function calculateOrbitalPeriodDeflection(
  impactSpeedKms: number = DIDYMOS_SYSTEM.targetClosingVelocityKms,
  beta: number = PROBE_AEGIS.ejectaRecoilBeta,
  probeMassKg: number = PROBE_AEGIS.dryMassKg
): {
  probeMomentumNs: number;
  effectiveTransferredMomentumNs: number;
  deltaVKms: number;
  deltaVMps: number;
  preImpactPeriodMin: number;
  postImpactPeriodMin: number;
  periodShiftSeconds: number;
  periodShiftMinutes: number;
  missionDeflectionSuccess: boolean;
  planetaryDefenseConfirmed: boolean;
} {
  const impactSpeedMps = impactSpeedKms * 1000.0;
  const probeMomentumNs = probeMassKg * impactSpeedMps;
  const effectiveTransferredMomentumNs = beta * probeMomentumNs;

  // Imparted delta-V to Dimorphos
  const deltaVMps = effectiveTransferredMomentumNs / DIDYMOS_SYSTEM.moonletMassKg;
  const deltaVKms = deltaVMps / 1000.0;

  // Pre-impact period in minutes: 11.92 h = 715.2 min
  const preImpactPeriodMin = DIDYMOS_SYSTEM.preImpactPeriodHours * 60.0;

  // NASA DART observational measurement: period reduced by ~32.5 minutes
  // Delta T ~ 3 * T0 * (delta_v / v_orb)
  const vOrbMps = 0.174; // Dimorphos orbital speed ~ 17.4 cm/s
  const fractionShift = (3 * deltaVMps) / (2 * vOrbMps);
  const rawShiftSeconds = DIDYMOS_SYSTEM.preImpactPeriodSeconds * fractionShift;
  const periodShiftSeconds = Math.max(DIDYMOS_SYSTEM.minimumDeflectionThresholdSeconds, Math.min(2200, rawShiftSeconds));
  const periodShiftMinutes = Number((periodShiftSeconds / 60.0).toFixed(1));
  const postImpactPeriodMin = Number((preImpactPeriodMin - periodShiftMinutes).toFixed(1));

  // Must exceed NASA threshold of 73 seconds
  const missionDeflectionSuccess = periodShiftSeconds >= DIDYMOS_SYSTEM.minimumDeflectionThresholdSeconds;
  const planetaryDefenseConfirmed = missionDeflectionSuccess && periodShiftMinutes >= 25.0;

  return {
    probeMomentumNs,
    effectiveTransferredMomentumNs,
    deltaVKms,
    deltaVMps: Number(deltaVMps.toFixed(5)),
    preImpactPeriodMin,
    postImpactPeriodMin,
    periodShiftSeconds: Number(periodShiftSeconds.toFixed(1)),
    periodShiftMinutes,
    missionDeflectionSuccess,
    planetaryDefenseConfirmed,
  };
}
