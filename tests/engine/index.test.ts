/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Unified Engine Entry Point Integration Tests (Phase 2B Module 9)
 *
 * Verifies that all intended public types, constants, constructors, standard queries,
 * and subsystem calculators can be imported directly from the unified entry point
 * (`src/engine/index.ts`) and execute correctly in an integrated mission design context.
 */

import { describe, it, expect } from "bun:test";
import {
  // 1. Units & Branded Constructors
  kg,
  watts,
  wattHours,
  kilometers,
  seconds,
  minutes,
  hertz,
  dB,
  dBi,
  ValidationError,

  // 2. CDS Standards
  CDS_STANDARDS,
  getCdsStandard,
  getCdsMaxMass,
  isFormFactorStandardized,

  // 3. Dispenser Profiles
  DISPENSER_PROFILES,
  getDispenserProfile,
  getDispenserLimit,

  // 4. Operational Policies
  OPERATIONAL_POLICIES,
  getOperationalPolicy,
  evaluatePolicyTimer,

  // 5. Mass Calculator
  calculateMassBudget,
  calculateCbe,
  calculateMga,
  calculateMev,

  // 6. Power Calculator
  simulatePowerBalance,
  calculateSolarGeneration,

  // 7. Propulsion Calculator
  calculatePropulsion,
  STANDARD_GRAVITY_MPS2,

  // 8. Telecom Calculator
  calculateLinkBudget,
  calculateTelecom,
  calculateFspl,
  SPEED_OF_LIGHT_MPS,
  BOLTZMANN_CONSTANT_J_PER_K,
} from "../../src/engine/index";

describe("Unified Engine Entry Point (src/engine/index.ts)", () => {
  it("exports all physical constants and standard registries correctly", () => {
    expect(STANDARD_GRAVITY_MPS2).toBe(9.80665);
    expect(SPEED_OF_LIGHT_MPS).toBe(299792458);
    expect(BOLTZMANN_CONSTANT_J_PER_K).toBe(1.380649e-23);

    expect(Object.isFrozen(CDS_STANDARDS)).toBeTrue();
    expect(Object.isFrozen(DISPENSER_PROFILES)).toBeTrue();
    expect(Object.isFrozen(OPERATIONAL_POLICIES)).toBeTrue();
  });

  it("executes standard query and validation functions via public entry point", () => {
    const cds = getCdsStandard("CDS_REV_14_1");
    expect(cds.revision).toBe("CDS_REV_14_1");
    expect(isFormFactorStandardized("CDS_REV_14_1", "3U")).toBeTrue();
    expect(getCdsMaxMass("CDS_REV_14_1", "3U")).toBe(6.0);

    const dispenser = getDispenserProfile("PPOD_MK3_3U");
    expect(dispenser.id).toBe("PPOD_MK3_3U");
    expect(getDispenserLimit("PPOD_MK3_3U")).toBe(4.0);

    const policy = getOperationalPolicy("CDS_REV_14_1_RF_QUIET");
    expect(policy.requiredInhibitMinutes).toBe(45.0);

    expect(() => getCdsStandard("INVALID" as unknown as "CDS_REV_14_1")).toThrow(ValidationError);
  });

  it("executes an integrated 3U satellite mission design across all 5 engineering calculators", () => {
    // A. Mass Budget
    const components = [
      { id: "STR-01", name: "Structure", nominalMassKg: kg(1.0), contingencyFraction: 0.15 },
      { id: "AV-01", name: "Avionics & Comm", nominalMassKg: kg(0.8), contingencyFraction: 0.1 },
      { id: "EPS-01", name: "EPS & Solar", nominalMassKg: kg(0.9), contingencyFraction: 0.1 },
    ];

    const cbe = calculateCbe(components);
    const mga = calculateMga(components);
    const mev = calculateMev(components);
    expect(cbe > 0).toBeTrue();
    expect(mga > 0).toBeTrue();
    expect(mev > cbe).toBeTrue();

    const massRes = calculateMassBudget({
      components,
      propellantMassKg: kg(0.0),
      dryMassAllocationKg: kg(3.5),
      dispenserProfile: DISPENSER_PROFILES.EXOPOD_3U_HIGH_MASS,
      cdsStandardProfile: CDS_STANDARDS.CDS_REV_14_1,
      formFactor: "3U",
    });

    expect(massRes.meetsCdsStandardLimit).toBeTrue();
    expect(massRes.meetsDispenserLimit).toBeTrue();
    expect(massRes.cbeDryMassKg > 0).toBeTrue();
    expect(massRes.mevDryMassKg > massRes.cbeDryMassKg).toBeTrue();

    // B. Power Balance Simulation
    const solarGeo = {
      cellAreaM2: 0.03,
      cellEfficiency: 0.3,
      sunDistanceAu: 1.0,
      solarIncidenceAngleDeg: 0.0,
      packingFactor: 0.9,
      mpptEfficiency: 0.95,
      annualDegradation: 0.0,
      missionYears: 0.0,
      solarConstantWpm2: 1361.0,
    };

    const solarGenWatts = calculateSolarGeneration(solarGeo);
    expect(solarGenWatts > 0).toBeTrue();

    const powerRes = simulatePowerBalance({
      solarGeometry: solarGeo,
      sunlightLoadWatts: watts(4.0),
      eclipseLoadWatts: watts(2.0),
      sunlightDurationMin: minutes(60.0),
      eclipseDurationMin: minutes(30.0),
      batteryNameplateWh: wattHours(40.0),
      maxAllowedDodPercent: 20.0,
      chargeEfficiency: 0.9,
      dischargeEfficiency: 0.95,
      initialSocPercent: 100.0,
      phaseOrder: "SUNLIGHT_THEN_ECLIPSE",
      simulationOrbits: 2,
    });

    expect(powerRes.usableBatteryCapacityWh).toBe(8.0); // 20% of 40 Wh = 8 Wh usable
    expect(powerRes.minPermittedEnergyWh).toBe(32.0);   // 40 - 8 = 32 Wh floor
    expect(powerRes.completeSafeOrbits).toBe(2);
    expect(powerRes.orbitHistory.length).toBe(2);

    // C. Propulsion (zero propellant baseline)
    const propRes = calculatePropulsion({
      dryMassKg: massRes.mevDryMassKg,
      propellantMassKg: kg(0.0),
      specificImpulseSeconds: seconds(0.0),
      thrustNewtons: 0.0,
    });

    expect(propRes.hasPropulsion).toBeFalse();
    expect(propRes.idealDeltaVMps).toBe(0.0);

    // D. Telecom Link Budget
    const telecomRes = calculateTelecom({
      carrierFrequencyHz: hertz(2.2e9),
      slantRangeKm: kilometers(1000.0),
      transmitPowerWatts: watts(2.0),
      transmitAntennaGainDbi: dBi(3.0),
      receiveAntennaGainDbi: dBi(38.0),
      losses: {
        txLineLossDb: dB(1.0),
        rxLineLossDb: dB(0.5),
        pointingLossDb: dB(1.0),
        polarizationLossDb: dB(0.0),
      },
      systemNoiseTemperatureK: 150.0,
      dataRateBps: 1.0e6,
      requiredEbN0Db: dB(10.5),
      requiredLinkMarginDb: dB(6.0),
    });

    expect(telecomRes.linkFeasible).toBeTrue();
    expect(telecomRes.linkMarginDb > 6.0).toBeTrue();
    expect(calculateFspl(kilometers(1000.0), hertz(2.2e9)) > 150.0).toBeTrue();

    // E. Operational Policy & Inhibit Timer
    const timerRes = evaluatePolicyTimer({
      policyId: "CDS_REV_14_1_RF_QUIET",
      separationOccurred: true,
      hardwareCurrentlyInhibited: false,
      timerElapsedMinutes: minutes(45.0),
    });

    expect(timerRes.timerExpired).toBeTrue();
    expect(timerRes.inhibitRemainingMinutes).toBe(0.0);
  });
});
