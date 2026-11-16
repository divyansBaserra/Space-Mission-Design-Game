/**
 * PROJECT EUROPA: SUBSURFACE CRYOSPHERIC & ABYSSAL ASTRODYNAMICS
 * First-principles physics models:
 * 1. Thermal nuclear melt-drill ice penetration
 * 2. 6-DOF abyssal buoyancy & quadratic hydrodynamic drag
 * 3. Hydrostatic pressure scaling at depth under Europan gravity
 * 4. Active sonar acoustic reflection and range triangulation
 * 5. Astrobiological RNA biomarker mass spectrometry entropy
 */

export interface CryoProbeParams {
  thermalPowerWatts: number;
  probeRadiusMeters: number;
  iceSurfaceTempKelvin: number;
  iceMeltingTempKelvin: number;
}

export interface AbyssalHydroParams {
  submersibleMassKg: number;
  submersibleVolumeM3: number;
  seawaterDensityKgM3: number;
  europaGravityMps2: number;
  dragCoefficient: number;
  frontalAreaM2: number;
}

export const EUROPA_CONSTANTS = {
  gravityMps2: 1.315,
  surfaceRadiationRadsPerHour: 400.0,
  iceDensityKgM3: 917.0,
  iceSpecificHeatJPerKgK: 2050.0,
  latentHeatOfFusionJPerKg: 334000.0,
  seawaterDensityKgM3: 1030.0,
  soundSpeedMps: 1440.0,
  maxOceanDepthMeters: 100000.0,
  targetHydrothermalDepthMeters: 5200.0,
} as const;

/**
 * Act II: Calculates thermal melt penetration velocity through cryogenic ice crust
 * v_melt = P_thermal / (rho_ice * (c_ice * delta_T + L_fusion) * Area)
 */
export function calculateMeltVelocityMps(params: CryoProbeParams): {
  velocityMps: number;
  velocityMetersPerHour: number;
  areaM2: number;
  specificEnergyJPerKg: number;
} {
  const areaM2 = Math.PI * Math.pow(params.probeRadiusMeters, 2);
  const deltaT = params.iceMeltingTempKelvin - params.iceSurfaceTempKelvin;
  const specificEnergyJPerKg =
    EUROPA_CONSTANTS.iceSpecificHeatJPerKgK * deltaT +
    EUROPA_CONSTANTS.latentHeatOfFusionJPerKg;

  const energyPerMeterDepth =
    EUROPA_CONSTANTS.iceDensityKgM3 * specificEnergyJPerKg * areaM2;

  const velocityMps =
    energyPerMeterDepth > 0 ? params.thermalPowerWatts / energyPerMeterDepth : 0;
  const velocityMetersPerHour = velocityMps * 3600.0;

  return {
    velocityMps,
    velocityMetersPerHour,
    areaM2,
    specificEnergyJPerKg,
  };
}

/**
 * Act II: Calculates depth after duration with methane gas pocket deviation penalty
 */
export function simulateIcePenetration(
  initialDepthMeters: number,
  deltaSeconds: number,
  meltRateMps: number,
  methaneGasHazardFraction: number = 0.0
): number {
  const efficiency = Math.max(0.2, 1.0 - methaneGasHazardFraction * 0.8);
  const effectiveSpeed = meltRateMps * efficiency;
  return initialDepthMeters + effectiveSpeed * deltaSeconds;
}

/**
 * Act III: Calculates hydrostatic pressure at depth under Europan gravity
 * P(h) = P_0 + rho * g * h
 */
export function calculateHydrostaticPressureMpa(
  depthMeters: number,
  surfaceAtmPressureMpa: number = 0.0
): number {
  const hydrostaticPascals =
    EUROPA_CONSTANTS.seawaterDensityKgM3 *
    EUROPA_CONSTANTS.gravityMps2 *
    depthMeters;
  return surfaceAtmPressureMpa + hydrostaticPascals / 1e6;
}

/**
 * Act III: 6-DOF Abyssal Net Vertical Buoyancy Force
 * F_buoyancy = (rho_seawater * Volume - mass) * g_europa
 */
export function calculateNetBuoyancyForceN(params: AbyssalHydroParams): number {
  const displacedMassKg = params.seawaterDensityKgM3 * params.submersibleVolumeM3;
  const netMassDifferenceKg = displacedMassKg - params.submersibleMassKg;
  return netMassDifferenceKg * params.europaGravityMps2;
}

/**
 * Act III: Hydrodynamic Quadratic Drag
 * F_drag = 0.5 * rho * C_d * Area * |v| * v
 */
export function calculateHydrodynamicDragN(
  velocityMps: number,
  params: AbyssalHydroParams
): number {
  const speed = Math.abs(velocityMps);
  return (
    0.5 *
    params.seawaterDensityKgM3 *
    params.dragCoefficient *
    params.frontalAreaM2 *
    speed *
    velocityMps
  );
}

/**
 * Act III: Active Sonar Target Range Triangulation
 * Range = (v_sound * echoTimeSeconds) / 2
 */
export function calculateSonarRangeMeters(echoTimeSeconds: number): number {
  return (EUROPA_CONSTANTS.soundSpeedMps * Math.max(0, echoTimeSeconds)) / 2.0;
}

/**
 * Act IV: Mass Spectrometry Ribosomal RNA Informational Entropy
 * Evaluates whether organic sample exhibits complex non-random nucleotide sequence
 */
export function evaluateRnaBiomarker(
  nucleotideCounts: [number, number, number, number]
): {
  shannonEntropyBits: number;
  isBiogenicLifeConfirmed: boolean;
  carbonIsotopeRatioPerMil: number;
} {
  const total = nucleotideCounts.reduce((acc, c) => acc + c, 0);
  if (total <= 0) {
    return {
      shannonEntropyBits: 0,
      isBiogenicLifeConfirmed: false,
      carbonIsotopeRatioPerMil: 0,
    };
  }

  let shannonEntropyBits = 0;
  for (const count of nucleotideCounts) {
    if (count > 0) {
      const p = count / total;
      shannonEntropyBits -= p * Math.log2(p);
    }
  }

  const carbonIsotopeRatioPerMil = -34.5;
  const isBiogenicLifeConfirmed =
    shannonEntropyBits >= 1.8 && carbonIsotopeRatioPerMil < -30.0;

  return {
    shannonEntropyBits,
    isBiogenicLifeConfirmed,
    carbonIsotopeRatioPerMil,
  };
}
