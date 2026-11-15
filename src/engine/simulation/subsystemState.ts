/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Spacecraft Subsystem State Dynamics (Phase 3 Module 5)
 *
 * Implements deterministic dynamic differential subsystem state integration over arbitrary timesteps Δt:
 * - Deterministic intra-step event-slicing engine eliminating state and timing contradictions.
 * - Dynamic electrical power balance on the battery-internal chemical scale (Wh) with independent
 *   charge (η_charge) and discharge (η_discharge) efficiencies, C-rate ceilings, and saturation dumping.
 * - Exact piecewise electrical energy conservation across surplus and deficit operational regimes.
 * - Electrochemical battery charging and discharging operational thermal boundaries.
 * - Single-node lumped spacecraft thermal equilibrium dynamics with A-stable, L-stable Backward Euler
 *   solved via safeguarded Newton-Raphson bisection within a strict physical bracket.
 * - Accurate thermal dissipation accounting excluding radiated RF electromagnetic energy.
 * - Solid-state telemetry data buffer with science generation and ground-pass link budget downlink.
 * - Propulsion subsystem mass depletion with exact intra-step propellant exhaustion cutoff and power scaling.
 * - Deterministic autonomous Safe Mode entry on DoD floor breach (Case S-2) and recovery at >=85% SoC.
 * - Hardware inhibit enforcement driven directly by Module 2 LifecycleClockState.
 * - Terminal blackout state protection preventing post-mortem advancement or duplicate fatal events.
 *
 * Source Classifications:
 * - VERIFIED: CODATA 2018 Stefan-Boltzmann constant, IAU 2015 solar irradiance, standard gravity,
 *   Cal Poly CDS Rev 14.1 timers (§2.4.4, §2.4.5), switch reset semantics (§2.3.2.4).
 * - DERIVED: Tsiolkovsky delta-v depletion, Friis path loss and link margin, chemical energy balance,
 *   Backward Euler root bracket [min(T_n, T_eq), max(T_n, T_eq)], linear threshold interpolation.
 * - GAME_ASSUMPTION: Single-node lumped thermal capacitance (m_dry * c_p), Earth albedo (0.30) &
 *   OLR (237.0 W/m²), default 3U thermal envelope, safe-mode power floor (2.0 W), RF PA efficiency (20%).
 */

import {
  Watts,
  WattHours,
  Kilograms,
  Seconds,
  Minutes,
  Megabits,
  Degrees,
  Decibels,
  DecibelIsotropic,
  Hertz,
  JulianDate,
  watts,
  wattHours,
  kg,
  seconds,
  minutes,
  megabits,
  dB,
  dBi,
  hertz,
  degToRad,
  ValidationError,
  assertFinitePositive,
  assertFiniteNonNegative,
  STEFAN_BOLTZMANN_CONSTANT,
  SOLAR_CONSTANT_1AU_WPM2,
  EARTH_ALBEDO_FRACTION,
  EARTH_OUTGOING_IR_WPM2,
  STANDARD_GRAVITY_MPS2,
  DEFAULT_LINK_MARGIN_THRESHOLD_DB,
  EARTH_EQUATORIAL_RADIUS_KM,
} from "./simUnits";

import {
  MissionPhase,
  LifecycleClockState,
  SimulationStatus,
  isValidPhaseTransition,
} from "./missionLifecycle";

import {
  SpacecraftDesignInput,
  MissionScienceRequirements,
  GroundStationLocation,
} from "./missionConfig";

import {
  SunEphemerisState,
  GroundStationPassState,
} from "./orbitSimulator";

import {
  calculateSolarGeneration,
  SolarGeometryInput,
} from "../power/powerCalculator";

import {
  calculateLinkBudget,
  TelecomInput,
} from "../telecom/telecomCalculator";

// ============================================================================
// 1. Data Structures & State Interfaces
// ============================================================================

export interface PowerSubsystemState {
  readonly batteryEnergyWh: WattHours;
  readonly batterySocPercent: number; // 0.0 to 100.0%
  readonly batteryDodPercent: number; // 0.0 to 100.0%
  readonly solarGenerationWatts: Watts;
  readonly busPowerWatts: Watts;
  readonly netPowerWatts: Watts; // P_solar - P_bus
  readonly chemicalPowerWatts: Watts; // Positive = charging chemical, Negative = discharging chemical
  readonly isCharging: boolean;
  readonly isDischarging: boolean;
  readonly isBlackout: boolean;
  readonly isDodViolated: boolean;
  readonly unacceptedSurplusWh: WattHours;
  readonly cumulativeEnergyGeneratedWh: WattHours;
  readonly cumulativeEnergyConsumedWh: WattHours;
}

export interface ThermalSubsystemState {
  readonly temperatureCelsius: number;
  readonly temperatureKelvin: number;
  readonly heatAbsorbedWatts: number; // Q_solar + Q_albedo + Q_earth_ir
  readonly heatRadiatedWatts: number; // eps * sigma * A * T^4
  readonly internalHeatWatts: Watts; // Platform + payload + tx_waste + prop + battery_dissipation
  readonly netHeatWatts: number;
  readonly isChargingPermitted: boolean; // T in [0, +45] deg C
  readonly isDischargingPermitted: boolean; // T in [-20, +50] deg C
  readonly isThermalExcursion: boolean; // T < -20 deg C or T > +60 deg C
  readonly subcyclesExecuted: number;
}

export interface TelecomSubsystemState {
  readonly dataBufferOccupancyMbits: Megabits;
  readonly dataBufferCapacityMbits: Megabits;
  readonly dataBufferFraction: number; // 0.0 to 1.0
  readonly cumulativeDataGeneratedMbits: Megabits;
  readonly cumulativeDataDownlinkedMbits: Megabits;
  readonly isDownlinkActive: boolean;
  readonly activeStationId?: string;
  readonly linkMarginDb?: Decibels;
  readonly linkFeasible?: boolean;
  readonly isBufferOverflow: boolean;
}

export interface PropulsionSubsystemState {
  readonly propellantMassKg: Kilograms;
  readonly initialPropellantMassKg: Kilograms;
  readonly dryMassKg: Kilograms;
  readonly currentWetMassKg: Kilograms;
  readonly isBurnActive: boolean;
  readonly cumulativeDeltaVMps: number;
  readonly remainingDeltaVMps: number;
  readonly thrustNewtons: number;
  readonly ispSeconds: Seconds;
  readonly massFlowRateKgS: number;
}

export type SubsystemEventType =
  | "BATTERY_BLACKOUT_EXHAUSTION"
  | "BATTERY_DOD_WARNING"
  | "SAFE_MODE_TRIGGERED"
  | "SAFE_MODE_RECOVERY"
  | "SAFE_MODE_RECOVERY_BLOCKED"
  | "THERMAL_DISCHARGE_RESTRICTION"
  | "THERMAL_EXCURSION_WARNING"
  | "DATA_BUFFER_OVERFLOW_WARNING"
  | "MANEUVER_IGNITION"
  | "MANEUVER_CUTOFF"
  | "SCIENCE_DOWNLINK_ACTIVE";

export interface SubsystemEvent {
  readonly eventType: SubsystemEventType;
  readonly timestampSeconds: Seconds;
  readonly description: string;
  readonly fatal: boolean;
}

export interface SubsystemCompositeState {
  readonly metSeconds: Seconds;
  readonly phase: MissionPhase;
  readonly power: PowerSubsystemState;
  readonly thermal: ThermalSubsystemState;
  readonly telecom: TelecomSubsystemState;
  readonly propulsion: PropulsionSubsystemState;
  readonly safeModeActive: boolean;
  readonly continuousSunlightSeconds: Seconds;
  readonly solarArrayDeployed: boolean;
  readonly rfTransmissionPermitted: boolean;
  readonly hardwareInhibited: boolean;
  readonly warnings: readonly string[];
  readonly fatalError?: string;
}

export interface SubsystemStepContext {
  readonly sun: SunEphemerisState;
  readonly activeGroundStation?: GroundStationPassState;
  readonly spacecraft: SpacecraftDesignInput;
  readonly lifecycleState: LifecycleClockState;
  readonly isManeuverCommended?: boolean;
  readonly scienceRequirements?: MissionScienceRequirements;
  readonly solarIncidenceAngleDeg?: number;
}

export interface SubsystemStepResult {
  readonly state: SubsystemCompositeState;
  readonly events: readonly SubsystemEvent[];
  readonly requestedPhaseTransition?: MissionPhase;
}

// ============================================================================
// 2. Physical Constants & Thermal Defaults [GAME_ASSUMPTION]
// ============================================================================

/** Aluminum 6061-T6 specific heat capacity [J/(kg*K)] (Specification §7.3) */
export const DEFAULT_SPECIFIC_HEAT_J_PER_KG_K = 900.0;

/** Standard 3U CubeSat six-face surface area (10x10x30 cm) [m²] */
export const DEFAULT_TOTAL_SURFACE_AREA_M2 = 0.14;

/** Cauchy isotropic average projected area (A_total / 4) [m²] */
export const DEFAULT_PROJECTED_AREA_M2 = 0.035;

/** Surface absorptivity for hard-anodized aluminum and solar cells */
export const DEFAULT_SURFACE_ABSORPTIVITY = 0.85;

/** Surface emissivity for hard-anodized aluminum and solar cells */
export const DEFAULT_SURFACE_EMISSIVITY = 0.85;

// S-Band Transmitter default characteristics
export const DEFAULT_TX_PA_EFFICIENCY = 0.20; // 2.0 W RF output / 10.0 W DC draw
export const DEFAULT_TX_ELECTRICAL_POWER_W = 10.0;
export const DEFAULT_TX_RF_RADIATED_POWER_W = 2.0;

// Propulsion Electrical Power
export const DEFAULT_PROPULSION_ELECTRICAL_POWER_W = 6.0;

// Nominal housekeeping power floors
export const DEFAULT_NOMINAL_BUS_POWER_W = 4.0;
export const DEFAULT_SAFE_MODE_POWER_W = 2.0;
export const DEFAULT_INHIBIT_COUNTDOWN_POWER_W = 1.5;
export const DEFAULT_PAYLOAD_POWER_W = 8.0;

// Substep limits for thermal solver
export const THERMAL_MAX_SUBSTEP_S = 60.0;

// ============================================================================
// 3. Additive Bus Power Load Partitioning
// ============================================================================

export interface BusPowerBreakdown {
  readonly platformWatts: Watts;
  readonly payloadWatts: Watts;
  readonly txWatts: Watts;
  readonly propWatts: Watts;
  readonly totalBusWatts: Watts;
}

/**
 * Calculates decoupled additive electrical bus power loads across operational phases.
 * Prevents double-counting of transmitter, payload, and propulsion loads.
 */
export function calculateBusPowerBreakdown(
  phase: MissionPhase,
  spacecraft: SpacecraftDesignInput,
  isDownlinking: boolean,
  isBurning: boolean,
  safeModeActive: boolean,
  isHardwareInhibited: boolean
): BusPowerBreakdown {
  assertFinitePositive(spacecraft.dryMassKg, "calculateBusPowerBreakdown.dryMassKg");

  // 1. Hardware inhibited / pre-launch: completely unpowered
  if (phase === "PRE_LAUNCH" || isHardwareInhibited) {
    return {
      platformWatts: watts(0.0),
      payloadWatts: watts(0.0),
      txWatts: watts(0.0),
      propWatts: watts(0.0),
      totalBusWatts: watts(0.0),
    };
  }

  // 2. Inhibit countdown: flight computer timer only
  if (phase === "INHIBIT_COUNTDOWN") {
    return {
      platformWatts: watts(DEFAULT_INHIBIT_COUNTDOWN_POWER_W),
      payloadWatts: watts(0.0),
      txWatts: watts(0.0),
      propWatts: watts(0.0),
      totalBusWatts: watts(DEFAULT_INHIBIT_COUNTDOWN_POWER_W),
    };
  }

  // 3. Safe mode: stripped housekeeping floor (all payloads, transmitters, thrusters shed)
  if (safeModeActive || phase === "SAFE_MODE") {
    const pSafe = spacecraft.safeModePowerW ?? watts(DEFAULT_SAFE_MODE_POWER_W);
    return {
      platformWatts: pSafe,
      payloadWatts: watts(0.0),
      txWatts: watts(0.0),
      propWatts: watts(0.0),
      totalBusWatts: pSafe,
    };
  }

  // 4. Nominal platform baseline
  const pPlatform = spacecraft.nominalBusPowerW ?? watts(DEFAULT_NOMINAL_BUS_POWER_W);
  let pPayload = watts(0.0);
  let pTx = watts(0.0);
  let pProp = watts(0.0);

  // Payload is active during nominal science operations
  if (phase === "SCIENCE_OPERATIONS") {
    pPayload = spacecraft.payloadPowerW ?? watts(DEFAULT_PAYLOAD_POWER_W);
  }

  // Transmitter is active during active contact downlink or ground pass carrier window
  if (isDownlinking || phase === "GROUND_PASS") {
    pTx = spacecraft.txPowerWatts
      ? watts(spacecraft.txPowerWatts / DEFAULT_TX_PA_EFFICIENCY)
      : watts(DEFAULT_TX_ELECTRICAL_POWER_W);
  }

  // Propulsion is active strictly during active thruster firing
  if (isBurning) {
    pProp = watts(DEFAULT_PROPULSION_ELECTRICAL_POWER_W);
  }

  const total = watts(pPlatform + pPayload + pTx + pProp);
  return {
    platformWatts: pPlatform,
    payloadWatts: pPayload,
    txWatts: pTx,
    propWatts: pProp,
    totalBusWatts: total,
  };
}

// ============================================================================
// 4. Safeguarded Newton-Bisection Thermal Backward Euler Solver
// ============================================================================

export interface ThermalIntegrationResult {
  readonly newTemperatureCelsius: number;
  readonly heatAbsorbedWatts: number;
  readonly heatRadiatedWatts: number;
  readonly internalHeatWatts: Watts;
  readonly subcyclesExecuted: number;
}

/**
 * Advances single-node spacecraft lumped thermal state over deltaTSeconds using Backward Euler
 * solved via safeguarded Newton-Raphson bisection within a strict physical root bracket.
 * Guarantees unconditional A-stability, strictly positive absolute temperatures, and zero time loss.
 */
export function stepThermalState(
  currentTempC: number,
  qAbsorbedWatts: number,
  internalHeatWatts: Watts,
  dryMassKg: Kilograms,
  deltaTSeconds: Seconds
): ThermalIntegrationResult {
  assertFinitePositive(dryMassKg, "stepThermalState.dryMassKg");
  assertFinitePositive(deltaTSeconds, "stepThermalState.deltaTSeconds");

  if (!Number.isFinite(currentTempC) || currentTempC < -273.15) {
    throw new ValidationError(
      "stepThermalState.currentTempC",
      `Temperature ${currentTempC} °C is below absolute zero (-273.15 °C) or non-finite`
    );
  }
  if (!Number.isFinite(qAbsorbedWatts) || qAbsorbedWatts < 0.0) {
    throw new ValidationError(
      "stepThermalState.qAbsorbedWatts",
      `Absorbed heat ${qAbsorbedWatts} W must be a finite non-negative number`
    );
  }
  if (!Number.isFinite(internalHeatWatts) || internalHeatWatts < 0.0) {
    throw new ValidationError(
      "stepThermalState.internalHeatWatts",
      `Internal heat ${internalHeatWatts} W must be a finite non-negative number`
    );
  }

  // Thermal capacitance C_th = m_dry * c_p [J/K] (Specification §7.3)
  const cTh = dryMassKg * DEFAULT_SPECIFIC_HEAT_J_PER_KG_K;
  const qIn = qAbsorbedWatts + internalHeatWatts;
  const epsSigmaA =
    DEFAULT_SURFACE_EMISSIVITY *
    STEFAN_BOLTZMANN_CONSTANT *
    DEFAULT_TOTAL_SURFACE_AREA_M2;

  let currentTk = currentTempC + 273.15;
  let remainingTime: number = deltaTSeconds;
  let totalSubcycles = 0;

  // Maximum sub-step to bound first-order time-lag truncation error
  const maxSubstep = THERMAL_MAX_SUBSTEP_S;

  while (remainingTime > 1e-9) {
    const h = Math.min(remainingTime, maxSubstep);
    const k = (h * epsSigmaA) / cTh;
    const B = currentTk + (h * qIn) / cTh;

    // Physical asymptotic equilibrium temperature: T_eq = (qIn / epsSigmaA)^0.25
    const tEq = qIn > 0.0 ? Math.pow(qIn / epsSigmaA, 0.25) : 0.0;

    // Strict physical root bracket: T* is strictly between currentTk and tEq
    let tLow = Math.min(currentTk, tEq);
    let tHigh = Math.max(currentTk, tEq);

    // If already at equilibrium, no temperature change occurs
    if (Math.abs(tHigh - tLow) < 1e-12) {
      currentTk = tEq;
      remainingTime -= h;
      totalSubcycles++;
      continue;
    }

    // Residual function: g(T) = T + k*T^4 - B [units: Kelvin]
    const g = (T: number): number => T + k * Math.pow(T, 4) - B;
    const gPrime = (T: number): number => 1.0 + 4.0 * k * Math.pow(T, 3);

    // Initial guess at start of bracket
    let tIter = currentTk;
    let converged = false;
    const maxIterations = 50;

    for (let iter = 0; iter < maxIterations; iter++) {
      const gVal = g(tIter);
      const gpVal = gPrime(tIter);

      // Check convergence based on residual tolerance [Kelvin] or narrow bracket [Kelvin]
      if (Math.abs(gVal) <= 1e-6 || Math.abs(tHigh - tLow) <= 1e-6) {
        converged = true;
        break;
      }

      // Update bracket based on sign of residual
      if (gVal < 0.0) {
        tLow = Math.max(tLow, tIter);
      } else {
        tHigh = Math.min(tHigh, tIter);
      }

      // Safeguarded Newton step
      const tNewton = tIter - gVal / gpVal;

      // If Newton candidate is within the open bracket, accept it; otherwise bisect
      if (tNewton > tLow && tNewton < tHigh) {
        tIter = tNewton;
      } else {
        tIter = 0.5 * (tLow + tHigh);
      }
    }

    if (!converged && Math.abs(g(tIter)) > 1e-4 && Math.abs(tHigh - tLow) > 1e-4) {
      throw new ValidationError(
        "stepThermalState",
        `Safeguarded Newton-bisection failed to converge at T_init=${currentTk.toFixed(2)} K, qIn=${qIn.toFixed(2)} W, h=${h.toFixed(2)} s`
      );
    }

    currentTk = tIter;
    remainingTime -= h;
    totalSubcycles++;
  }

  const finalTempC = currentTk - 273.15;
  const heatRadiatedWatts = epsSigmaA * Math.pow(currentTk, 4);

  return {
    newTemperatureCelsius: finalTempC,
    heatAbsorbedWatts: qAbsorbedWatts,
    heatRadiatedWatts,
    internalHeatWatts,
    subcyclesExecuted: totalSubcycles,
  };
}

// ============================================================================
// 5. Initial Subsystem State Constructor
// ============================================================================

/**
 * Initializes the full subsystem state container matching Case S-1 baseline parameters.
 */
export function initializeSubsystemState(
  spacecraft: SpacecraftDesignInput,
  initialPhase: MissionPhase = "PRE_LAUNCH",
  initialMetSeconds: Seconds = seconds(0.0)
): SubsystemCompositeState {
  if (!spacecraft || typeof spacecraft !== "object") {
    throw new ValidationError("initializeSubsystemState.spacecraft", "Spacecraft design must be a defined object");
  }
  assertFinitePositive(spacecraft.batteryCapacityWh, "initializeSubsystemState.batteryCapacityWh");
  assertFinitePositive(spacecraft.dryMassKg, "initializeSubsystemState.dryMassKg");
  assertFiniteNonNegative(initialMetSeconds, "initializeSubsystemState.initialMetSeconds");

  const nameplateWh = spacecraft.batteryCapacityWh;
  const dryMass = spacecraft.dryMassKg;
  const propMass = spacecraft.propellantMassKg ?? kg(0.0);
  const wetMass = kg(dryMass + propMass);

  const initialTempC = 20.0; // Standard room temperature 293.15 K
  const isSeparated = initialPhase !== "PRE_LAUNCH" && initialPhase !== "LAUNCH_ASCENT" && initialPhase !== "DISPENSER_DEPLOYMENT";
  const isArrayDeployed = isSeparated && initialPhase !== "INHIBIT_COUNTDOWN";

  const power: PowerSubsystemState = {
    batteryEnergyWh: nameplateWh,
    batterySocPercent: 100.0,
    batteryDodPercent: 0.0,
    solarGenerationWatts: watts(0.0),
    busPowerWatts: watts(0.0),
    netPowerWatts: watts(0.0),
    chemicalPowerWatts: watts(0.0),
    isCharging: false,
    isDischarging: false,
    isBlackout: false,
    isDodViolated: false,
    unacceptedSurplusWh: wattHours(0.0),
    cumulativeEnergyGeneratedWh: wattHours(0.0),
    cumulativeEnergyConsumedWh: wattHours(0.0),
  };

  const thermal: ThermalSubsystemState = {
    temperatureCelsius: initialTempC,
    temperatureKelvin: initialTempC + 273.15,
    heatAbsorbedWatts: 0.0,
    heatRadiatedWatts: DEFAULT_SURFACE_EMISSIVITY * STEFAN_BOLTZMANN_CONSTANT * DEFAULT_TOTAL_SURFACE_AREA_M2 * Math.pow(initialTempC + 273.15, 4),
    internalHeatWatts: watts(0.0),
    netHeatWatts: 0.0,
    isChargingPermitted: true,
    isDischargingPermitted: true,
    isThermalExcursion: false,
    subcyclesExecuted: 0,
  };

  const telecom: TelecomSubsystemState = {
    dataBufferOccupancyMbits: megabits(0.0),
    dataBufferCapacityMbits: megabits(2000.0), // 2.0 Gbit solid-state recorder
    dataBufferFraction: 0.0,
    cumulativeDataGeneratedMbits: megabits(0.0),
    cumulativeDataDownlinkedMbits: megabits(0.0),
    isDownlinkActive: false,
    isBufferOverflow: false,
  };

  const isp = spacecraft.thrusterIspSeconds ?? seconds(220.0);
  const thrust = spacecraft.thrustNewtons ?? (propMass > 0 ? 1.0 : 0.0);
  const mDot = (thrust > 0 && isp > 0) ? thrust / (isp * STANDARD_GRAVITY_MPS2) : 0.0;
  const initialDeltaVMps = (propMass > 0 && isp > 0) ? isp * STANDARD_GRAVITY_MPS2 * Math.log((dryMass + propMass) / dryMass) : 0.0;

  const propulsion: PropulsionSubsystemState = {
    propellantMassKg: propMass,
    initialPropellantMassKg: propMass,
    dryMassKg: dryMass,
    currentWetMassKg: wetMass,
    isBurnActive: false,
    cumulativeDeltaVMps: 0.0,
    remainingDeltaVMps: initialDeltaVMps,
    thrustNewtons: thrust,
    ispSeconds: isp,
    massFlowRateKgS: mDot,
  };

  return {
    metSeconds: initialMetSeconds,
    phase: initialPhase,
    power,
    thermal,
    telecom,
    propulsion,
    safeModeActive: false,
    continuousSunlightSeconds: seconds(0.0),
    solarArrayDeployed: isArrayDeployed,
    rfTransmissionPermitted: false,
    hardwareInhibited: initialPhase === "PRE_LAUNCH" || initialPhase === "INHIBIT_COUNTDOWN",
    warnings: [],
  };
}

// ============================================================================
// 6. Comprehensive Subsystem Step Function (Event-Slicing Engine)
// ============================================================================

/**
 * Advances spacecraft subsystem states over deltaTSeconds honoring strict priority,
 * exact piecewise energy conservation, deterministic event slicing, and analytical benchmark thresholds.
 */
export function stepSubsystemState(
  currentState: SubsystemCompositeState,
  deltaTSeconds: Seconds,
  context: SubsystemStepContext
): SubsystemStepResult {
  // 1. Precondition Validation
  assertFinitePositive(deltaTSeconds, "stepSubsystemState.deltaTSeconds");
  if (!currentState || typeof currentState !== "object") {
    throw new ValidationError("stepSubsystemState.currentState", "Current state must be a valid object");
  }
  if (!context || typeof context !== "object") {
    throw new ValidationError("stepSubsystemState.context", "Step context must be a valid object");
  }
  if (!context.spacecraft || typeof context.spacecraft !== "object") {
    throw new ValidationError("stepSubsystemState.spacecraft", "Spacecraft configuration must be provided");
  }
  if (!context.lifecycleState || typeof context.lifecycleState !== "object") {
    throw new ValidationError("stepSubsystemState.lifecycleState", "Lifecycle state must be provided");
  }
  if (!context.sun || typeof context.sun !== "object") {
    throw new ValidationError("stepSubsystemState.sun", "Sun ephemeris state must be provided");
  }

  // 2. Terminal State Guard
  // A blacked out or fatally terminated spacecraft cannot advance active subsystems or emit duplicate fatal events.
  if (currentState.power.isBlackout || currentState.fatalError !== undefined) {
    return {
      state: currentState,
      events: Object.freeze([]),
      requestedPhaseTransition: undefined,
    };
  }

  const events: SubsystemEvent[] = [];
  const warnings: string[] = [];
  let fatalError: string | undefined;
  let requestedPhaseTransition: MissionPhase | undefined;

  const spacecraft = context.spacecraft;
  const lifecycle = context.lifecycleState;
  const currentPhase = lifecycle.currentPhase;
  const nameplateWh = spacecraft.batteryCapacityWh;
  const maxDodPercent = context.scienceRequirements?.maxAllowedBatteryDodPercent ?? 20.0;
  const energyFloorWh = nameplateWh * (1.0 - maxDodPercent / 100.0);

  // Module 2 Hardware Inhibit & Deployable State Derivation
  const isHardwareInhibited = lifecycle.isHardwareInhibited;
  const separationOccurred = lifecycle.separationOccurred;
  const isArrayDeployed = Boolean(
    separationOccurred &&
    currentPhase !== "PRE_LAUNCH" &&
    currentPhase !== "LAUNCH_ASCENT" &&
    currentPhase !== "DISPENSER_DEPLOYMENT" &&
    currentPhase !== "INHIBIT_COUNTDOWN"
  );
  const isRfQuietExpired = lifecycle.rfQuietTimerElapsedMin >= 45.0 && !isHardwareInhibited && separationOccurred;

  // External orbital geometry & illumination
  const inEclipse = context.sun.inEclipse || context.sun.sunlightFraction === 0.0;

  const distRatio = EARTH_EQUATORIAL_RADIUS_KM / (EARTH_EQUATORIAL_RADIUS_KM + 600.0);
  const viewFactorEarth = 0.5 * (1.0 - Math.sqrt(Math.max(0.0, 1.0 - distRatio * distRatio)));
  const qSolar = inEclipse ? 0.0 : DEFAULT_SURFACE_ABSORPTIVITY * SOLAR_CONSTANT_1AU_WPM2 * DEFAULT_PROJECTED_AREA_M2;
  const qAlbedo = inEclipse ? 0.0 : DEFAULT_SURFACE_ABSORPTIVITY * (EARTH_ALBEDO_FRACTION * SOLAR_CONSTANT_1AU_WPM2) * viewFactorEarth * DEFAULT_PROJECTED_AREA_M2;
  const qEarthIr = DEFAULT_SURFACE_EMISSIVITY * EARTH_OUTGOING_IR_WPM2 * viewFactorEarth * (DEFAULT_TOTAL_SURFACE_AREA_M2 / 6.0);
  const qAbsorbed = qSolar + qAlbedo + qEarthIr;

  const groundContact = context.activeGroundStation;
  const isContactActive = Boolean(groundContact && groundContact.isContactActive);

  // Propulsion parameters
  const isp = spacecraft.thrusterIspSeconds ?? seconds(220.0);
  const thrust = spacecraft.thrustNewtons ?? (currentState.propulsion.propellantMassKg > 0 ? 1.0 : 0.0);
  const mDot = (thrust > 0 && isp > 0) ? thrust / (isp * STANDARD_GRAVITY_MPS2) : 0.0;
  const isManeuverCommended = Boolean(context.isManeuverCommended || currentPhase === "ORBIT_MANEUVER");

  // Sub-interval progression tracking
  let remainingTime: number = deltaTSeconds;
  let timeElapsed = 0.0;
  let currentMet = currentState.metSeconds;
  let battWh = currentState.power.batteryEnergyWh;
  let tempC = currentState.thermal.temperatureCelsius;
  let propMass = currentState.propulsion.propellantMassKg;
  let cumDeltaV = currentState.propulsion.cumulativeDeltaVMps;
  let bufferMbits = currentState.telecom.dataBufferOccupancyMbits;
  let cumDataGen = currentState.telecom.cumulativeDataGeneratedMbits;
  let cumDataDown = currentState.telecom.cumulativeDataDownlinkedMbits;
  let continuousSunSec = currentState.continuousSunlightSeconds;
  let safeModeActive = currentState.safeModeActive;
  let isDodViolated: boolean = currentState.power.isDodViolated;
  let isBlackout: boolean = currentState.power.isBlackout;
  let cumEnergyGenWh = currentState.power.cumulativeEnergyGeneratedWh;
  let cumEnergyConsWh = currentState.power.cumulativeEnergyConsumedWh;
  let totalUnacceptedSurplusWh = wattHours(0.0);

  let lastPowerBreakdown: BusPowerBreakdown = calculateBusPowerBreakdown(
    currentPhase,
    spacecraft,
    false,
    false,
    safeModeActive,
    isHardwareInhibited
  );
  let lastPSolar = watts(0.0);
  let lastChemicalPowerWatts = 0.0;
  let lastIsBurnActive = false;
  let lastIsDownlinkActive = false;
  let lastLinkMarginDb: Decibels | undefined;
  let lastLinkFeasible = false;
  let lastIsBufferOverflow = false;
  let totalThermalSubcycles = 0;

  // ==========================================================================
  // DETERMINISTIC INTRA-STEP EVENT-SLICING LOOP
  // ==========================================================================
  while (remainingTime > 1e-9 && !fatalError) {
    // 1. Solar Generation for this sub-interval
    let pSolar = watts(0.0);
    if (isArrayDeployed && !inEclipse && !isHardwareInhibited) {
      const cellArea = spacecraft.solarCellAreaM2 ?? 0.05;
      const cellEff = spacecraft.solarCellEfficiency ?? 0.295;
      const incAngle = context.solarIncidenceAngleDeg ?? 0.0;
      const geomInput: SolarGeometryInput = {
        cellAreaM2: cellArea,
        cellEfficiency: cellEff,
        sunDistanceAu: 1.0,
        solarIncidenceAngleDeg: incAngle,
        packingFactor: 0.85,
        mpptEfficiency: 0.95,
        annualDegradation: 0.025,
        missionYears: (currentMet + timeElapsed) / (365.25 * 86400.0),
        solarConstantWpm2: SOLAR_CONSTANT_1AU_WPM2,
      };
      pSolar = calculateSolarGeneration(geomInput);
    }
    lastPSolar = pSolar;

    // 2. Active subsystems for this sub-interval
    const isBurning = isManeuverCommended && propMass > 1e-9 && !safeModeActive && !isHardwareInhibited && currentPhase !== "PRE_LAUNCH";
    const isCarrierActive = (currentPhase === "GROUND_PASS" || isContactActive) && isRfQuietExpired && !isHardwareInhibited && !safeModeActive && currentPhase !== "PRE_LAUNCH";

    let linkMarginDb: Decibels | undefined;
    let linkFeasible = false;
    if (isCarrierActive && groundContact) {
      const telInput: TelecomInput = {
        transmitPowerWatts: spacecraft.txPowerWatts ?? watts(2.0),
        frequencyHz: spacecraft.txFrequencyHz ?? hertz(2200000000),
        distanceKm: groundContact.slantRangeKm,
        txAntennaGainDbi: spacecraft.txAntennaGainDbi ?? dBi(2.0),
        rxAntennaGainDbi: spacecraft.rxAntennaGainDbi ?? dBi(25.0),
        dataRateBps: spacecraft.dataRateBps ?? 2000000,
        systemNoiseTemperatureK: 135.0,
        requiredEbN0Db: dB(9.6),
        losses: {
          txLineLossDb: dB(1.0),
          rxLineLossDb: dB(1.0),
          pointingLossDb: dB(0.5),
          polarizationLossDb: dB(0.5),
        },
        requiredLinkMarginDb: context.scienceRequirements?.requiredLinkMarginDb,
      };
      const telResult = calculateLinkBudget(telInput);
      linkMarginDb = telResult.linkMarginDb;
      linkFeasible = telResult.linkFeasible;
    }
    const isDownlinkActive = isCarrierActive && isContactActive && linkFeasible;

    lastIsBurnActive = isBurning;
    lastIsDownlinkActive = isDownlinkActive;
    lastLinkMarginDb = linkMarginDb;
    lastLinkFeasible = linkFeasible;

    // 3. Additive Bus Electrical Load
    const powerBreakdown = calculateBusPowerBreakdown(
      currentPhase,
      spacecraft,
      isCarrierActive,
      isBurning,
      safeModeActive,
      isHardwareInhibited
    );
    lastPowerBreakdown = powerBreakdown;
    const pBus = powerBreakdown.totalBusWatts;

    // 4. Chemical Battery Rates
    const isChargingPermitted = tempC >= 0.0 && tempC <= 45.0 && !isHardwareInhibited;
    const isDischargingPermitted = tempC >= -20.0 && tempC <= 50.0 && !isHardwareInhibited;

    const isSurplus = pSolar >= pBus;
    let dotEChemIn = 0.0;
    let dotEChemDrain = 0.0;
    let pChargeAvail = 0.0;
    let pDeficit = 0.0;

    if (isSurplus) {
      const pSurplus = pSolar - pBus;
      const etaCharge = isChargingPermitted ? 0.90 : 0.0;
      const cRateLimitW = 1.0 * nameplateWh;
      pChargeAvail = Math.min(pSurplus, cRateLimitW);
      dotEChemIn = (etaCharge * pChargeAvail) / 3600.0;
    } else {
      pDeficit = pBus - pSolar;
      const etaDischarge = 0.95;
      if (isDischargingPermitted) {
        dotEChemDrain = pDeficit / (etaDischarge * 3600.0);
      } else {
        dotEChemDrain = 0.0;
        if (pSolar === 0.0) {
          fatalError = "UNRECOVERABLE_BROWNOUT";
          isBlackout = true;
          warnings.push(`THERMAL_DISCHARGE_RESTRICTION: Brownout at ${tempC.toFixed(2)} °C`);
          break;
        }
      }
    }

    // 5. Candidate Horizon Timing
    let dtSlice = remainingTime;
    let nextEventType: "CUTOFF" | "DOD_BREACH" | "BLACKOUT" | "RECOVERY" | undefined;

    // (a) Thruster exhaustion cutoff
    if (isBurning && mDot > 0.0) {
      const dtBurn = propMass / mDot;
      if (dtBurn < dtSlice - 1e-9) {
        dtSlice = dtBurn;
        nextEventType = "CUTOFF";
      }
    }

    // (b) DoD floor breach
    if (!isSurplus && dotEChemDrain > 0.0 && !safeModeActive && battWh > energyFloorWh) {
      const dtDod = (battWh - energyFloorWh) / dotEChemDrain;
      if (dtDod < dtSlice - 1e-9) {
        dtSlice = dtDod;
        nextEventType = "DOD_BREACH";
      }
    }

    // (c) Battery blackout exhaustion
    if (!isSurplus && dotEChemDrain > 0.0 && battWh > 0.0) {
      const dtBlackout = battWh / dotEChemDrain;
      if (dtBlackout < dtSlice - 1e-9) {
        dtSlice = dtBlackout;
        nextEventType = "BLACKOUT";
      }
    }

    // (d) Safe-mode recovery at 85% SoC
    const targetEnergy85Wh = 0.85 * nameplateWh;
    if (safeModeActive && isSurplus && dotEChemIn > 0.0 && battWh < targetEnergy85Wh && !inEclipse && !isHardwareInhibited) {
      const dtRec = (targetEnergy85Wh - battWh) / dotEChemIn;
      if (dtRec < dtSlice - 1e-9) {
        dtSlice = dtRec;
        nextEventType = "RECOVERY";
      }
    }

    dtSlice = Math.min(remainingTime, Math.max(1e-6, dtSlice));

    // 6. Continuous State Advancement
    if (!inEclipse) {
      continuousSunSec = seconds(continuousSunSec + dtSlice);
    } else {
      continuousSunSec = seconds(0.0);
    }

    let pBattWaste = 0.0;
    if (isSurplus) {
      const etaCharge = isChargingPermitted ? 0.90 : 0.0;
      const deltaEChem = dotEChemIn * dtSlice;
      const headroom = Math.max(0.0, nameplateWh - battWh);
      const deltaEAccepted = Math.min(deltaEChem, headroom);
      const deltaEElecAbsorbed = etaCharge > 0.0 ? deltaEAccepted / etaCharge : 0.0;
      const pSurplus = pSolar - pBus;
      const unacceptedWh = Math.max(0.0, pSurplus * (dtSlice / 3600.0) - deltaEElecAbsorbed);
      totalUnacceptedSurplusWh = wattHours(totalUnacceptedSurplusWh + unacceptedWh);

      battWh = wattHours(Math.min(nameplateWh, battWh + deltaEAccepted));
      pBattWaste = deltaEElecAbsorbed > 0.0 ? (deltaEElecAbsorbed - deltaEAccepted) / (dtSlice / 3600.0) : 0.0;
      lastChemicalPowerWatts = deltaEAccepted / (dtSlice / 3600.0);
    } else {
      const deltaEChem = dotEChemDrain * dtSlice;
      battWh = wattHours(Math.max(0.0, battWh - deltaEChem));
      pBattWaste = pDeficit * (1.0 / 0.95 - 1.0);
      lastChemicalPowerWatts = -pDeficit / 0.95;
    }

    if (isBurning) {
      const deltaM = mDot * dtSlice;
      const actualDeltaM = Math.min(propMass, deltaM);
      const mInitial = spacecraft.dryMassKg + propMass;
      const mFinal = spacecraft.dryMassKg + propMass - actualDeltaM;
      const deltaV = isp * STANDARD_GRAVITY_MPS2 * Math.log(mInitial / mFinal);
      propMass = kg(Math.max(0.0, propMass - actualDeltaM));
      cumDeltaV += deltaV;
    }

    // Data buffer generation in science phase
    if (currentPhase === "SCIENCE_OPERATIONS" && !safeModeActive && !isHardwareInhibited) {
      const rateBps = 50000;
      const genMbits = (rateBps * dtSlice) / 1000000.0;
      cumDataGen = megabits(cumDataGen + genMbits);
      if (bufferMbits + genMbits > 2000.0) {
        bufferMbits = megabits(2000.0);
        lastIsBufferOverflow = true;
        warnings.push("DATA_BUFFER_OVERFLOW_WARNING: Solid-state buffer capacity exceeded; data dropped");
        events.push({
          eventType: "DATA_BUFFER_OVERFLOW_WARNING",
          timestampSeconds: seconds(currentMet + timeElapsed + dtSlice),
          description: "Buffer overflow; unrecorded science data dropped",
          fatal: false,
        });
      } else {
        bufferMbits = megabits(bufferMbits + genMbits);
      }
    }

    // Data buffer downlink
    if (isDownlinkActive) {
      const downRateBps = spacecraft.dataRateBps ?? 2000000;
      const downMbitsAvail = (downRateBps * dtSlice) / 1000000.0;
      const actualDown = Math.min(bufferMbits, downMbitsAvail);
      bufferMbits = megabits(bufferMbits - actualDown);
      cumDataDown = megabits(cumDataDown + actualDown);
      events.push({
        eventType: "SCIENCE_DOWNLINK_ACTIVE",
        timestampSeconds: seconds(currentMet + timeElapsed + dtSlice),
        description: `Downlinked ${actualDown.toFixed(2)} Mbits to ${groundContact?.stationName}`,
        fatal: false,
      });
    }

    cumEnergyGenWh = wattHours(cumEnergyGenWh + pSolar * (dtSlice / 3600.0));
    cumEnergyConsWh = wattHours(cumEnergyConsWh + pBus * (dtSlice / 3600.0));

    // Internal waste heat
    const pTxWaste = isCarrierActive ? Math.max(0.0, powerBreakdown.txWatts - DEFAULT_TX_RF_RADIATED_POWER_W) : 0.0;
    const internalHeatWatts = watts(
      powerBreakdown.platformWatts +
      powerBreakdown.payloadWatts +
      pTxWaste +
      powerBreakdown.propWatts +
      pBattWaste
    );

    const thermalRes = stepThermalState(
      tempC,
      qAbsorbed,
      internalHeatWatts,
      spacecraft.dryMassKg,
      seconds(dtSlice)
    );
    tempC = thermalRes.newTemperatureCelsius;
    totalThermalSubcycles += thermalRes.subcyclesExecuted;

    // 7. Discrete Event Dispatch
    const eventMet = seconds(currentMet + timeElapsed + dtSlice);

    if (nextEventType === "CUTOFF" || (isBurning && propMass <= 1e-9)) {
      propMass = kg(0.0);
      events.push({
        eventType: "MANEUVER_CUTOFF",
        timestampSeconds: eventMet,
        description: `Propellant exhausted at MET ${eventMet.toFixed(2)} s; thruster cutoff cleanly enacted`,
        fatal: false,
      });
      warnings.push(`PROPELLANT_EXHAUSTED at MET ${eventMet.toFixed(2)} s`);
    } else if (nextEventType === "DOD_BREACH") {
      isDodViolated = true;
      safeModeActive = true;
      requestedPhaseTransition = "SAFE_MODE";
      events.push({
        eventType: "BATTERY_DOD_WARNING",
        timestampSeconds: eventMet,
        description: `Battery breached DoD floor (${maxDodPercent}%) at MET ${eventMet.toFixed(2)} s`,
        fatal: false,
      });
      events.push({
        eventType: "SAFE_MODE_TRIGGERED",
        timestampSeconds: eventMet,
        description: `Autonomous safe-mode commanded at MET ${eventMet.toFixed(2)} s`,
        fatal: false,
      });
      warnings.push(`BATTERY_DOD_WARNING at MET ${eventMet.toFixed(2)} s`);
    } else if (nextEventType === "BLACKOUT" || (!isSurplus && battWh <= 1e-9)) {
      battWh = wattHours(0.0);
      isBlackout = true;
      fatalError = "BATTERY_BLACKOUT_EXHAUSTION";
      events.push({
        eventType: "BATTERY_BLACKOUT_EXHAUSTION",
        timestampSeconds: eventMet,
        description: `Battery completely exhausted (0 Wh) at MET ${eventMet.toFixed(2)} s; mission failure`,
        fatal: true,
      });
      timeElapsed += dtSlice;
      remainingTime = 0.0;
      break;
    } else if (nextEventType === "RECOVERY" || (safeModeActive && battWh >= targetEnergy85Wh - 1e-9 && !inEclipse && continuousSunSec > 0)) {
      if (isHardwareInhibited || tempC < -20.0 || tempC > 60.0) {
        warnings.push("SAFE_MODE_RECOVERY_BLOCKED by active safety restriction");
        events.push({
          eventType: "SAFE_MODE_RECOVERY_BLOCKED",
          timestampSeconds: eventMet,
          description: `Recovery blocked: HardwareInhibited=${isHardwareInhibited}, Temp=${tempC.toFixed(2)} °C`,
          fatal: false,
        });
      } else {
        safeModeActive = false;
        requestedPhaseTransition = "SCIENCE_OPERATIONS";
        events.push({
          eventType: "SAFE_MODE_RECOVERY",
          timestampSeconds: eventMet,
          description: `Battery recharged to ${((battWh / nameplateWh) * 100.0).toFixed(1)}% SoC in continuous sunlight; restoring science operations`,
          fatal: false,
        });
      }
    }

    timeElapsed += dtSlice;
    remainingTime -= dtSlice;
  }

  const updatedWetMass = kg(spacecraft.dryMassKg + propMass);
  const remainingDeltaVMps = propMass > 0
    ? isp * STANDARD_GRAVITY_MPS2 * Math.log((spacecraft.dryMassKg + propMass) / spacecraft.dryMassKg)
    : 0.0;

  const currentSoc = (battWh / nameplateWh) * 100.0;
  const currentDod = Math.max(0.0, 100.0 - currentSoc);

  const finalBusPower = isBlackout ? watts(0.0) : lastPowerBreakdown.totalBusWatts;
  const finalSolarPower = isBlackout ? watts(0.0) : lastPSolar;

  const nextState: SubsystemCompositeState = {
    metSeconds: seconds(currentMet + timeElapsed),
    phase: currentPhase,
    power: {
      batteryEnergyWh: battWh,
      batterySocPercent: currentSoc,
      batteryDodPercent: currentDod,
      solarGenerationWatts: finalSolarPower,
      busPowerWatts: finalBusPower,
      netPowerWatts: watts(finalSolarPower - finalBusPower),
      chemicalPowerWatts: watts(isBlackout ? 0.0 : lastChemicalPowerWatts),
      isCharging: !isBlackout && lastChemicalPowerWatts > 0.0,
      isDischarging: !isBlackout && lastChemicalPowerWatts < 0.0,
      isBlackout,
      isDodViolated,
      unacceptedSurplusWh: totalUnacceptedSurplusWh,
      cumulativeEnergyGeneratedWh: cumEnergyGenWh,
      cumulativeEnergyConsumedWh: cumEnergyConsWh,
    },
    thermal: {
      temperatureCelsius: tempC,
      temperatureKelvin: tempC + 273.15,
      heatAbsorbedWatts: qAbsorbed,
      heatRadiatedWatts: DEFAULT_SURFACE_EMISSIVITY * STEFAN_BOLTZMANN_CONSTANT * DEFAULT_TOTAL_SURFACE_AREA_M2 * Math.pow(tempC + 273.15, 4),
      internalHeatWatts: watts(isBlackout ? 0.0 : lastPowerBreakdown.platformWatts),
      netHeatWatts: qAbsorbed - (DEFAULT_SURFACE_EMISSIVITY * STEFAN_BOLTZMANN_CONSTANT * DEFAULT_TOTAL_SURFACE_AREA_M2 * Math.pow(tempC + 273.15, 4)),
      isChargingPermitted: tempC >= 0.0 && tempC <= 45.0 && !isHardwareInhibited,
      isDischargingPermitted: tempC >= -20.0 && tempC <= 50.0 && !isHardwareInhibited,
      isThermalExcursion: tempC < -20.0 || tempC > 60.0,
      subcyclesExecuted: totalThermalSubcycles,
    },
    telecom: {
      dataBufferOccupancyMbits: bufferMbits,
      dataBufferCapacityMbits: currentState.telecom.dataBufferCapacityMbits,
      dataBufferFraction: bufferMbits / currentState.telecom.dataBufferCapacityMbits,
      cumulativeDataGeneratedMbits: cumDataGen,
      cumulativeDataDownlinkedMbits: cumDataDown,
      isDownlinkActive: !isBlackout && lastIsDownlinkActive,
      activeStationId: lastIsDownlinkActive ? groundContact?.stationId : undefined,
      linkMarginDb: lastLinkMarginDb,
      linkFeasible: lastLinkFeasible,
      isBufferOverflow: lastIsBufferOverflow,
    },
    propulsion: {
      propellantMassKg: propMass,
      initialPropellantMassKg: currentState.propulsion.initialPropellantMassKg,
      dryMassKg: spacecraft.dryMassKg,
      currentWetMassKg: updatedWetMass,
      isBurnActive: !isBlackout && lastIsBurnActive,
      cumulativeDeltaVMps: cumDeltaV,
      remainingDeltaVMps,
      thrustNewtons: currentState.propulsion.thrustNewtons,
      ispSeconds: currentState.propulsion.ispSeconds,
      massFlowRateKgS: currentState.propulsion.massFlowRateKgS,
    },
    safeModeActive,
    continuousSunlightSeconds: continuousSunSec,
    solarArrayDeployed: isArrayDeployed,
    rfTransmissionPermitted: isRfQuietExpired,
    hardwareInhibited: isHardwareInhibited,
    warnings: Object.freeze([...currentState.warnings, ...warnings]),
    fatalError,
  };

  return {
    state: nextState,
    events: Object.freeze(events),
    requestedPhaseTransition,
  };
}

// ============================================================================
// 7. Stateful SubsystemManager Facade
// ============================================================================

export interface SubsystemManagerOptions {
  readonly spacecraft: SpacecraftDesignInput;
  readonly initialPhase?: MissionPhase;
  readonly initialMetSeconds?: Seconds;
  readonly scienceRequirements?: MissionScienceRequirements;
}

/**
 * Deterministic facade managing continuous spacecraft subsystem dynamics,
 * telemetry time-series recording, and lifecycle phase interactions.
 */
export class SubsystemManager {
  private _state: SubsystemCompositeState;
  private readonly _spacecraft: SpacecraftDesignInput;
  private readonly _scienceRequirements?: MissionScienceRequirements;
  private readonly _telemetryLog: SubsystemCompositeState[] = [];
  private readonly _eventLog: SubsystemEvent[] = [];

  constructor(options: SubsystemManagerOptions) {
    if (!options || typeof options !== "object") {
      throw new ValidationError("SubsystemManager", "Options must be a defined object");
    }
    this._spacecraft = options.spacecraft;
    this._scienceRequirements = options.scienceRequirements;
    this._state = initializeSubsystemState(
      options.spacecraft,
      options.initialPhase ?? "PRE_LAUNCH",
      options.initialMetSeconds ?? seconds(0.0)
    );
    this._telemetryLog.push(this._state);
  }

  /** Returns current composite subsystem state */
  public getState(): SubsystemCompositeState {
    return this._state;
  }

  /** Returns recorded historical telemetry frames */
  public getTelemetryLog(): readonly SubsystemCompositeState[] {
    return this._telemetryLog;
  }

  /** Returns recorded discrete events */
  public getEventLog(): readonly SubsystemEvent[] {
    return this._eventLog;
  }

  /**
   * Advances subsystem states over stepSeconds given external orbital and lifecycle context.
   */
  public step(
    stepSeconds: Seconds,
    sun: SunEphemerisState,
    lifecycleState: LifecycleClockState,
    activeGroundStation?: GroundStationPassState,
    isManeuverCommended?: boolean,
    solarIncidenceAngleDeg?: number
  ): SubsystemStepResult {
    const context: SubsystemStepContext = {
      sun,
      activeGroundStation,
      spacecraft: this._spacecraft,
      lifecycleState,
      isManeuverCommended,
      scienceRequirements: this._scienceRequirements,
      solarIncidenceAngleDeg,
    };

    const result = stepSubsystemState(this._state, stepSeconds, context);
    this._state = result.state;
    this._telemetryLog.push(result.state);

    if (result.events.length > 0) {
      this._eventLog.push(...result.events);
    }

    return result;
  }
}
