/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Sequential Multi-Orbit Power & Energy Model
 *
 * Implements solar power generation with angle cutoff and degradation,
 * battery electrochemical charge acceptance (C-rate ceiling), independent
 * charge and discharge efficiencies, and sequential multi-orbit simulation
 * tracking battery state of charge (SoC) across distinct sunlight and eclipse phases.
 *
 * Physical & Engineering Conventions (Phase 2A Specification §5 & §8.1):
 * 1. Battery Internal Chemical Energy Scale [Wh]:
 *    All battery SoC, headroom, and acceptance metrics are tracked on the battery-internal
 *    chemical energy scale [Wh]. Delivered bus power is converted to chemical energy via
 *    charge efficiency (eta_charge); bus load extracts chemical energy via discharge efficiency (eta_discharge).
 * 2. Solar Generation with Angle Cutoff:
 *    cos(theta_eff) = max(0, cos(theta_sun))
 *    P_gen = (S_0 / d_AU^2) * A_cell * eta_cell * cos(theta_eff) * packingFactor * eta_mppt * (1 - delta_annual)^t [W]
 * 3. Battery Maximum Charge Rate (C-rate):
 *    P_chem_chg_max = C_rate * E_nameplate [W]
 *    E_rate_limit_chem = P_chem_chg_max * (T_sun_min / 60) [Wh]
 *    Evaluated strictly on the chemical energy scale [Wh]. C-rate limits do not apply to discharge.
 * 4. Chemical Charge Acceptance:
 *    E_charge_accepted = min(E_delivered_chem, headroom_chem, E_rate_limit_chem) [Wh]
 *    Unaccepted solar energy is dumped and not stored.
 * 5. Sequential Phase Stepping:
 *    Simulates exact non-linear phase sequence (Sunlight -> Eclipse or Eclipse -> Sunlight).
 *    Never replaces sequential stepping with orbit-averaged power.
 * 6. Fractional Orbits:
 *    Computes exact physical elapsed fractional orbits to minimum permitted SoC floor (DoD limit)
 *    and complete bus exhaustion (0 Wh) based on sequential phase timing and continuous drain rates.
 *
 * Educational Model Limitation:
 * Models early formulation energy budgets (CML 4) and does not replace flight EPS simulation or thermal-coupled battery modeling.
 */

import {
  Watts,
  WattHours,
  Minutes,
  watts,
  wattHours,
  assertFinitePositive,
  assertFiniteNonNegative,
  assertFractionRange,
  assertInitialSocAboveFloor,
  ValidationError,
} from "../units";

/** Default IAU 2015 nominal solar constant at 1 AU [W/m²] */
export const DEFAULT_SOLAR_CONSTANT_WPM2 = 1361.0;

/** Default number of sequential orbits simulated if not specified */
export const DEFAULT_SIMULATION_ORBITS = 15;

export interface SolarGeometryInput {
  readonly cellAreaM2: number;
  readonly cellEfficiency: number;
  readonly sunDistanceAu: number;
  readonly solarIncidenceAngleDeg: number;
  readonly packingFactor: number;
  readonly mpptEfficiency: number;
  readonly annualDegradation: number;
  readonly missionYears: number;
  readonly solarConstantWpm2?: number; // Defaults to 1361.0 W/m² (IAU 2015 nominal)
}

export interface PowerBalanceInput {
  readonly solarGeometry: SolarGeometryInput;
  readonly sunlightLoadWatts: Watts;
  readonly eclipseLoadWatts: Watts;
  readonly sunlightDurationMin: Minutes;
  readonly eclipseDurationMin: Minutes;
  readonly batteryNameplateWh: WattHours;
  readonly maxAllowedDodPercent: number; // e.g. 30.0 for LEO (min permitted SoC = 70.0%)
  readonly chargeEfficiency: number;     // e.g. 0.90
  readonly dischargeEfficiency: number;  // e.g. 0.95
  readonly maxChargeCRate?: number;      // e.g. 1.0C
  readonly initialSocPercent?: number;   // Defaults to 100%
  readonly phaseOrder?: "SUNLIGHT_THEN_ECLIPSE" | "ECLIPSE_THEN_SUNLIGHT";
  readonly simulationOrbits?: number;    // Defaults to 15
}

export interface OrbitStepRecord {
  readonly orbitIndex: number; // 1-based index (1, 2, ...)
  readonly startSoCWh: WattHours;
  readonly postPhase1SoCWh: WattHours;
  readonly postPhase2SoCWh: WattHours;
  readonly sunlightDeficitDischargeWh: WattHours;
  readonly eclipseDischargeWh: WattHours;
  readonly actualEnergyAcceptedWh: WattHours;
  readonly unacceptedSurplusWh: WattHours;
  readonly netOrbitBatteryChangeWh: WattHours; // postPhase2SoCWh - startSoCWh
  readonly minimumOrbitSoCWh: WattHours;       // min(startSoCWh, postPhase1SoCWh, postPhase2SoCWh)
  readonly maximumOrbitDodPercent: number;    // ((E_nameplate - minimumOrbitSoCWh) / E_nameplate) * 100
  readonly dodViolation: boolean;             // minimumOrbitSoCWh < minPermittedEnergyWh
  readonly depleted: boolean;                 // minimumOrbitSoCWh <= 0
  readonly depletedInPhase: "SUNLIGHT" | "ECLIPSE" | null;
}

export interface PowerSimulationResult {
  readonly solarGenerationWatts: Watts;
  readonly usableBatteryCapacityWh: WattHours;
  readonly minPermittedEnergyWh: WattHours;
  readonly initialAvailableEnergyWh: WattHours;
  readonly orbitHistory: readonly OrbitStepRecord[];
  readonly isPeriodicStable: boolean;
  readonly completeSafeOrbits: number;
  readonly fractionalOrbitsToSafeLimit: number | null;
  readonly completeOperationalOrbits: number;
  readonly fractionalOrbitsToExhaustion: number | null;
}

/**
 * Calculates instantaneous solar array electrical generation power in Watts.
 * Enforces cosine incidence cutoff (generation = 0 when theta >= 90 deg) and cumulative mission degradation.
 */
export function calculateSolarGeneration(geometry: SolarGeometryInput): Watts {
  if (!geometry || typeof geometry !== "object") {
    throw new ValidationError("geometry", "Solar geometry input must be a non-null object");
  }

  assertFiniteNonNegative(geometry.cellAreaM2, "cellAreaM2");
  assertFractionRange(geometry.cellEfficiency, "cellEfficiency", 0, 1);
  assertFinitePositive(geometry.sunDistanceAu, "sunDistanceAu");
  if (!Number.isFinite(geometry.solarIncidenceAngleDeg)) {
    throw new ValidationError("solarIncidenceAngleDeg", `Incidence angle must be finite, received ${geometry.solarIncidenceAngleDeg}`);
  }
  assertFractionRange(geometry.packingFactor, "packingFactor", 0, 1);
  assertFractionRange(geometry.mpptEfficiency, "mpptEfficiency", 0, 1);
  assertFractionRange(geometry.annualDegradation, "annualDegradation", 0, 1);
  assertFiniteNonNegative(geometry.missionYears, "missionYears");

  const s0 = geometry.solarConstantWpm2 !== undefined
    ? geometry.solarConstantWpm2
    : DEFAULT_SOLAR_CONSTANT_WPM2;
  assertFinitePositive(s0, "solarConstantWpm2");

  // Effective incidence angle cosine with cutoff at 90 degrees
  let cosEff = 0;
  if (Math.abs(geometry.solarIncidenceAngleDeg) < 90.0) {
    const angleRad = (geometry.solarIncidenceAngleDeg * Math.PI) / 180.0;
    const rawCos = Math.cos(angleRad);
    cosEff = rawCos > 1e-12 ? rawCos : 0;
  }

  if (cosEff <= 0 || geometry.cellAreaM2 <= 0 || geometry.cellEfficiency <= 0) {
    return watts(0);
  }

  // Solar flux at heliocentric distance d_AU
  const fluxWpm2 = s0 / (geometry.sunDistanceAu * geometry.sunDistanceAu);

  // Cumulative degradation factor over mission duration
  const degradationFactor = Math.pow(1.0 - geometry.annualDegradation, geometry.missionYears);

  const powerWatts =
    fluxWpm2 *
    geometry.cellAreaM2 *
    geometry.cellEfficiency *
    cosEff *
    geometry.packingFactor *
    geometry.mpptEfficiency *
    degradationFactor;

  return watts(Math.max(0, powerWatts));
}

/**
 * Executes sequential multi-orbit battery simulation across distinct sunlight and eclipse phases.
 * Tracks non-linear chemical charge acceptance, C-rate limits, DoD violation boundaries,
 * and bus blackout timing.
 */
export function simulatePowerBalance(input: PowerBalanceInput): PowerSimulationResult {
  if (!input || typeof input !== "object") {
    throw new ValidationError("input", "Power balance input must be a non-null object");
  }

  // 1. Validate Power & Duration Inputs
  assertFiniteNonNegative(input.sunlightLoadWatts, "sunlightLoadWatts");
  assertFiniteNonNegative(input.eclipseLoadWatts, "eclipseLoadWatts");
  assertFiniteNonNegative(input.sunlightDurationMin, "sunlightDurationMin");
  assertFiniteNonNegative(input.eclipseDurationMin, "eclipseDurationMin");
  if (input.sunlightDurationMin + input.eclipseDurationMin <= 0) {
    throw new ValidationError(
      "orbitDurationMin",
      `Total orbit duration (sunlight + eclipse) must be strictly > 0, received ${input.sunlightDurationMin + input.eclipseDurationMin}`
    );
  }
  assertFinitePositive(input.batteryNameplateWh, "batteryNameplateWh");

  // 2. Validate DoD and Efficiency Limits
  if (!Number.isFinite(input.maxAllowedDodPercent) || input.maxAllowedDodPercent <= 0 || input.maxAllowedDodPercent > 100) {
    throw new ValidationError("maxAllowedDodPercent", `Must be in range (0, 100], received ${input.maxAllowedDodPercent}`);
  }
  if (!Number.isFinite(input.chargeEfficiency) || input.chargeEfficiency <= 0 || input.chargeEfficiency > 1) {
    throw new ValidationError("chargeEfficiency", `Must be in range (0, 1], received ${input.chargeEfficiency}`);
  }
  if (!Number.isFinite(input.dischargeEfficiency) || input.dischargeEfficiency <= 0 || input.dischargeEfficiency > 1) {
    throw new ValidationError("dischargeEfficiency", `Must be in range (0, 1], received ${input.dischargeEfficiency}`);
  }

  // 3. Optional C-Rate Limit (Applies only to charging)
  if (input.maxChargeCRate !== undefined) {
    assertFiniteNonNegative(input.maxChargeCRate, "maxChargeCRate");
  }

  // 4. Initial State of Charge (Defaults to 100%)
  const initialSocPercent = input.initialSocPercent !== undefined ? input.initialSocPercent : 100.0;
  assertInitialSocAboveFloor(initialSocPercent, input.maxAllowedDodPercent);

  // 5. Phase Order & Simulation Orbit Count
  const phaseOrder = input.phaseOrder || "SUNLIGHT_THEN_ECLIPSE";
  if (phaseOrder !== "SUNLIGHT_THEN_ECLIPSE" && phaseOrder !== "ECLIPSE_THEN_SUNLIGHT") {
    throw new ValidationError("phaseOrder", `Invalid phaseOrder '${phaseOrder}'`);
  }

  const simulationOrbits = input.simulationOrbits !== undefined ? input.simulationOrbits : DEFAULT_SIMULATION_ORBITS;
  if (!Number.isInteger(simulationOrbits) || simulationOrbits < 1) {
    throw new ValidationError("simulationOrbits", `Simulation orbits must be a positive integer >= 1, received ${simulationOrbits}`);
  }

  // 6. Calculate Solar Generation & Capacity Baselines
  const solarGenWatts = calculateSolarGeneration(input.solarGeometry);
  const nameplateWh = input.batteryNameplateWh;
  const minPermittedSocPercent = 100.0 - input.maxAllowedDodPercent;
  const minPermittedEnergyWh = wattHours((nameplateWh * minPermittedSocPercent) / 100.0);
  const usableBatteryCapacityWh = wattHours((nameplateWh * input.maxAllowedDodPercent) / 100.0);

  const initialAvailableEnergyWh = wattHours(
    Math.max(
      0,
      Math.min(
        usableBatteryCapacityWh,
        (nameplateWh * (initialSocPercent - minPermittedSocPercent)) / 100.0
      )
    )
  );

  const orbitDurationMin = input.sunlightDurationMin + input.eclipseDurationMin;

  // 7. Initialize Sequential Simulation State
  let currentBatteryWh = (nameplateWh * initialSocPercent) / 100.0;
  let completeSafeOrbits = 0;
  let fractionalOrbitsToSafeLimit: number | null = null;
  let completeOperationalOrbits = 0;
  let fractionalOrbitsToExhaustion: number | null = null;

  let safeLimitReached = false;
  let exhaustionReached = false;

  const orbitHistory: OrbitStepRecord[] = [];

  // 8. Sequential Multi-Orbit Loop
  for (let k = 1; k <= simulationOrbits; k++) {
    const startSoCWh = wattHours(currentBatteryWh);

    let sunlightDeficitDischargeWh = wattHours(0);
    let actualEnergyAcceptedWh = wattHours(0);
    let unacceptedSurplusWh = wattHours(0);
    let eclipseDischargeWh = wattHours(0);

    let postPhase1SoCWh = wattHours(0);
    let postPhase2SoCWh = wattHours(0);

    let orbitDepleted = false;
    let orbitDepletedInPhase: "SUNLIGHT" | "ECLIPSE" | null = null;

    // Helper: Execute Sunlight Phase
    const runSunlightPhase = (phaseNumber: 1 | 2): void => {
      const durationHours = input.sunlightDurationMin / 60.0;

      if (solarGenWatts >= input.sunlightLoadWatts) {
        // Sunlight Surplus
        const surplusWatts = solarGenWatts - input.sunlightLoadWatts;
        const deliveredChemWh = surplusWatts * durationHours * input.chargeEfficiency;
        const headroomChemWh = Math.max(0, nameplateWh - currentBatteryWh);

        let rateLimitChemWh = Number.POSITIVE_INFINITY;
        if (input.maxChargeCRate !== undefined) {
          const maxChemPowerWatts = input.maxChargeCRate * nameplateWh;
          rateLimitChemWh = maxChemPowerWatts * durationHours;
        }

        const acceptedWh = Math.min(deliveredChemWh, headroomChemWh, rateLimitChemWh);
        const dumpedWh = deliveredChemWh - acceptedWh;

        actualEnergyAcceptedWh = wattHours(acceptedWh);
        unacceptedSurplusWh = wattHours(dumpedWh);
        currentBatteryWh += acceptedWh;
      } else {
        // Sunlight Deficit
        const deficitWatts = input.sunlightLoadWatts - solarGenWatts;
        const deficitDischargeWh = (deficitWatts * durationHours) / input.dischargeEfficiency;
        sunlightDeficitDischargeWh = wattHours(deficitDischargeWh);

        const drainRateWhPerMin = deficitWatts / (input.dischargeEfficiency * 60.0);
        const energyBeforePhase = currentBatteryWh;
        const energyAfterPhase = energyBeforePhase - deficitDischargeWh;

        // Check DoD floor violation
        if (!safeLimitReached && energyAfterPhase < minPermittedEnergyWh) {
          safeLimitReached = true;
          const energyToFloor = Math.max(0, energyBeforePhase - minPermittedEnergyWh);
          const timeToFloorMin = drainRateWhPerMin > 0 ? energyToFloor / drainRateWhPerMin : 0;
          const timeOffsetMin = phaseNumber === 1 ? 0 : (phaseOrder === "ECLIPSE_THEN_SUNLIGHT" ? input.eclipseDurationMin : input.sunlightDurationMin);
          fractionalOrbitsToSafeLimit = (k - 1) + (timeOffsetMin + timeToFloorMin) / orbitDurationMin;
        }

        // Check battery exhaustion
        if (!exhaustionReached && energyAfterPhase <= 0) {
          exhaustionReached = true;
          orbitDepleted = true;
          orbitDepletedInPhase = "SUNLIGHT";
          const energyToZero = Math.max(0, energyBeforePhase);
          const timeToZeroMin = drainRateWhPerMin > 0 ? energyToZero / drainRateWhPerMin : 0;
          const timeOffsetMin = phaseNumber === 1 ? 0 : (phaseOrder === "ECLIPSE_THEN_SUNLIGHT" ? input.eclipseDurationMin : input.sunlightDurationMin);
          fractionalOrbitsToExhaustion = (k - 1) + (timeOffsetMin + timeToZeroMin) / orbitDurationMin;
          currentBatteryWh = 0;
        } else {
          currentBatteryWh = Math.max(0, energyAfterPhase);
        }
      }

      if (phaseNumber === 1) {
        postPhase1SoCWh = wattHours(currentBatteryWh);
      } else {
        postPhase2SoCWh = wattHours(currentBatteryWh);
      }
    };

    // Helper: Execute Eclipse Phase
    const runEclipsePhase = (phaseNumber: 1 | 2): void => {
      const durationHours = input.eclipseDurationMin / 60.0;
      const nominalDischargeWh = (input.eclipseLoadWatts * durationHours) / input.dischargeEfficiency;
      eclipseDischargeWh = wattHours(nominalDischargeWh);

      if (currentBatteryWh <= 0) {
        // Battery already exhausted
        currentBatteryWh = 0;
      } else {
        const drainRateWhPerMin = input.eclipseLoadWatts / (input.dischargeEfficiency * 60.0);
        const energyBeforePhase = currentBatteryWh;
        const energyAfterPhase = energyBeforePhase - nominalDischargeWh;

        // Check DoD floor violation
        if (!safeLimitReached && energyAfterPhase < minPermittedEnergyWh) {
          safeLimitReached = true;
          const energyToFloor = Math.max(0, energyBeforePhase - minPermittedEnergyWh);
          const timeToFloorMin = drainRateWhPerMin > 0 ? energyToFloor / drainRateWhPerMin : 0;
          const timeOffsetMin = phaseNumber === 1 ? 0 : (phaseOrder === "SUNLIGHT_THEN_ECLIPSE" ? input.sunlightDurationMin : input.eclipseDurationMin);
          fractionalOrbitsToSafeLimit = (k - 1) + (timeOffsetMin + timeToFloorMin) / orbitDurationMin;
        }

        // Check battery exhaustion
        if (!exhaustionReached && energyAfterPhase <= 0) {
          exhaustionReached = true;
          orbitDepleted = true;
          orbitDepletedInPhase = "ECLIPSE";
          const energyToZero = Math.max(0, energyBeforePhase);
          const timeToZeroMin = drainRateWhPerMin > 0 ? energyToZero / drainRateWhPerMin : 0;
          const timeOffsetMin = phaseNumber === 1 ? 0 : (phaseOrder === "SUNLIGHT_THEN_ECLIPSE" ? input.sunlightDurationMin : input.eclipseDurationMin);
          fractionalOrbitsToExhaustion = (k - 1) + (timeOffsetMin + timeToZeroMin) / orbitDurationMin;
          currentBatteryWh = 0;
        } else {
          currentBatteryWh = Math.max(0, energyAfterPhase);
        }
      }

      if (phaseNumber === 1) {
        postPhase1SoCWh = wattHours(currentBatteryWh);
      } else {
        postPhase2SoCWh = wattHours(currentBatteryWh);
      }
    };

    // Execute phases according to configured sequence
    if (phaseOrder === "SUNLIGHT_THEN_ECLIPSE") {
      runSunlightPhase(1);
      runEclipsePhase(2);
    } else {
      runEclipsePhase(1);
      runSunlightPhase(2);
    }

    const minOrbitSoCWh = wattHours(Math.min(startSoCWh, postPhase1SoCWh, postPhase2SoCWh));
    const maxDodPercent = ((nameplateWh - minOrbitSoCWh) / nameplateWh) * 100.0;
    const isDodViolatedThisOrbit = minOrbitSoCWh < minPermittedEnergyWh - 1e-9;
    const isDepletedThisOrbit = minOrbitSoCWh <= 1e-9;

    if (!isDodViolatedThisOrbit && !safeLimitReached) {
      completeSafeOrbits++;
    }
    if (!isDepletedThisOrbit && !exhaustionReached) {
      completeOperationalOrbits++;
    }

    const netOrbitBatteryChangeWh = wattHours(postPhase2SoCWh - startSoCWh);

    const record: OrbitStepRecord = Object.freeze({
      orbitIndex: k,
      startSoCWh,
      postPhase1SoCWh,
      postPhase2SoCWh,
      sunlightDeficitDischargeWh,
      eclipseDischargeWh,
      actualEnergyAcceptedWh,
      unacceptedSurplusWh,
      netOrbitBatteryChangeWh,
      minimumOrbitSoCWh: minOrbitSoCWh,
      maximumOrbitDodPercent: maxDodPercent,
      dodViolation: isDodViolatedThisOrbit,
      depleted: isDepletedThisOrbit,
      depletedInPhase: orbitDepletedInPhase,
    });

    orbitHistory.push(record);
  }

  // Periodic equilibrium evaluation:
  // True if the final simulated orbit has zero net battery change (|delta| <= 1e-4 Wh)
  // and experienced neither DoD violation nor exhaustion.
  const lastRecord = orbitHistory[orbitHistory.length - 1];
  const isPeriodicStable =
    !lastRecord.dodViolation &&
    !lastRecord.depleted &&
    Math.abs(lastRecord.netOrbitBatteryChangeWh) <= 1e-4;

  return Object.freeze({
    solarGenerationWatts: solarGenWatts,
    usableBatteryCapacityWh,
    minPermittedEnergyWh,
    initialAvailableEnergyWh,
    orbitHistory: Object.freeze(orbitHistory),
    isPeriodicStable,
    completeSafeOrbits,
    fractionalOrbitsToSafeLimit,
    completeOperationalOrbits,
    fractionalOrbitsToExhaustion,
  });
}
