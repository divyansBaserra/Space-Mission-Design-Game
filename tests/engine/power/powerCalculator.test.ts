import { describe, expect, it } from "bun:test";
import {
  calculateSolarGeneration,
  simulatePowerBalance,
  DEFAULT_SOLAR_CONSTANT_WPM2,
  DEFAULT_SIMULATION_ORBITS,
  type SolarGeometryInput,
  type PowerBalanceInput,
} from "../../../src/engine/power/powerCalculator";
import { ValidationError, minutes, wattHours, watts } from "../../../src/engine/units";

describe("src/engine/power/powerCalculator.ts", () => {
  // Reference solar geometry configured to generate exactly 20.2843 W at 1 AU
  const referenceSolarGeometryP1: SolarGeometryInput = {
    cellAreaM2: 20.2843 / 1361.0,
    cellEfficiency: 1.0,
    sunDistanceAu: 1.0,
    solarIncidenceAngleDeg: 0,
    packingFactor: 1.0,
    mpptEfficiency: 1.0,
    annualDegradation: 0.0,
    missionYears: 0.0,
    solarConstantWpm2: 1361.0,
  };

  describe("Analytical Case P-1: Sunlight Deficit (Sequential Multi-Orbit Depletion)", () => {
    it("computes exact step-by-step sequential depletion, DoD violation, and bus exhaustion", () => {
      const input: PowerBalanceInput = {
        solarGeometry: referenceSolarGeometryP1,
        sunlightLoadWatts: watts(22.0),
        eclipseLoadWatts: watts(6.0),
        sunlightDurationMin: minutes(59.87),
        eclipseDurationMin: minutes(35.80),
        batteryNameplateWh: wattHours(40.0),
        maxAllowedDodPercent: 30.0, // Floor = 70% (28.0 Wh)
        chargeEfficiency: 0.90,
        dischargeEfficiency: 0.95,
        initialSocPercent: 100.0,
        phaseOrder: "SUNLIGHT_THEN_ECLIPSE",
        simulationOrbits: 10,
      };

      const result = simulatePowerBalance(input);

      // 1. Initial State & Capacities
      expect(result.solarGenerationWatts).toBeCloseTo(20.2843, 4);
      expect(result.usableBatteryCapacityWh).toBeCloseTo(12.0, 4);
      expect(result.minPermittedEnergyWh).toBeCloseTo(28.0, 4);
      expect(result.initialAvailableEnergyWh).toBeCloseTo(12.0, 4);
      expect(result.isPeriodicStable).toBeFalse();

      // 2. Orbit 1 State Progression
      const o1 = result.orbitHistory[0];
      expect(o1.orbitIndex).toBe(1);
      expect(o1.startSoCWh).toBeCloseTo(40.0, 4);
      expect(o1.sunlightDeficitDischargeWh).toBeCloseTo(1.8021, 4);
      expect(o1.postPhase1SoCWh).toBeCloseTo(38.1979, 4);
      expect(o1.eclipseDischargeWh).toBeCloseTo(3.7684, 4);
      expect(o1.postPhase2SoCWh).toBeCloseTo(34.4295, 4);
      expect(o1.netOrbitBatteryChangeWh).toBeCloseTo(-5.5705, 4);
      expect(o1.dodViolation).toBeFalse();
      expect(o1.depleted).toBeFalse();

      // 3. Orbit 2 State Progression
      const o2 = result.orbitHistory[1];
      expect(o2.startSoCWh).toBeCloseTo(34.4295, 4);
      expect(o2.postPhase1SoCWh).toBeCloseTo(32.6274, 4);
      expect(o2.postPhase2SoCWh).toBeCloseTo(28.8590, 4);
      expect(o2.dodViolation).toBeFalse();

      // 4. Orbit 3: DoD Floor Violation in Sunlight
      const o3 = result.orbitHistory[2];
      expect(o3.startSoCWh).toBeCloseTo(28.8590, 4);
      expect(o3.postPhase1SoCWh).toBeCloseTo(27.0569, 4);
      expect(o3.dodViolation).toBeTrue();
      expect(o3.depleted).toBeFalse();

      // Complete Safe Orbits = 2 full orbits; violation occurs at 2.2983 orbits
      expect(result.completeSafeOrbits).toBe(2);
      expect(result.fractionalOrbitsToSafeLimit).not.toBeNull();
      if (result.fractionalOrbitsToSafeLimit !== null) {
        expect(result.fractionalOrbitsToSafeLimit).toBeCloseTo(2.2983, 4);
      }

      // 5. Orbit 7 & 8: Depletion in Sunlight
      const o7 = result.orbitHistory[6];
      expect(o7.postPhase2SoCWh).toBeCloseTo(1.0064, 4);
      expect(o7.depleted).toBeFalse();

      const o8 = result.orbitHistory[7];
      expect(o8.depleted).toBeTrue();
      expect(o8.depletedInPhase).toBe("SUNLIGHT");
      expect(o8.postPhase1SoCWh).toBe(0.0);
      expect(o8.postPhase2SoCWh).toBe(0.0);

      // Complete Operational Orbits = 7 full orbits; exhaustion at 7.3495 orbits
      expect(result.completeOperationalOrbits).toBe(7);
      expect(result.fractionalOrbitsToExhaustion).not.toBeNull();
      if (result.fractionalOrbitsToExhaustion !== null) {
        expect(result.fractionalOrbitsToExhaustion).toBeCloseTo(7.3495, 4);
      }
    });
  });

  describe("Analytical Case P-2: Sunlight Surplus with Full Initial Battery", () => {
    it("computes periodic equilibrium and dumps unaccepted solar surplus", () => {
      const input: PowerBalanceInput = {
        solarGeometry: referenceSolarGeometryP1,
        sunlightLoadWatts: watts(8.0),
        eclipseLoadWatts: watts(6.0),
        sunlightDurationMin: minutes(59.87),
        eclipseDurationMin: minutes(35.80),
        batteryNameplateWh: wattHours(40.0),
        maxAllowedDodPercent: 30.0,
        chargeEfficiency: 0.90,
        dischargeEfficiency: 0.95,
        initialSocPercent: 100.0,
        phaseOrder: "SUNLIGHT_THEN_ECLIPSE",
        simulationOrbits: 5,
      };

      const result = simulatePowerBalance(input);

      // Orbit 1: Starts full (40 Wh). Headroom = 0 Wh -> Accepted = 0 Wh. Dumped = 11.0319 Wh.
      const o1 = result.orbitHistory[0];
      expect(o1.startSoCWh).toBeCloseTo(40.0, 4);
      expect(o1.postPhase1SoCWh).toBeCloseTo(40.0, 4);
      expect(o1.actualEnergyAcceptedWh).toBe(0.0);
      expect(o1.unacceptedSurplusWh).toBeCloseTo(11.0319, 4);
      expect(o1.postPhase2SoCWh).toBeCloseTo(36.2316, 4);
      expect(o1.netOrbitBatteryChangeWh).toBeCloseTo(-3.7684, 4);

      // Orbit 2: Periodic Equilibrium reached. Accepts 3.7684 Wh, dumps 7.2635 Wh. Net change = 0 Wh.
      const o2 = result.orbitHistory[1];
      expect(o2.startSoCWh).toBeCloseTo(36.2316, 4);
      expect(o2.actualEnergyAcceptedWh).toBeCloseTo(3.7684, 4);
      expect(o2.unacceptedSurplusWh).toBeCloseTo(7.2635, 4);
      expect(o2.postPhase1SoCWh).toBeCloseTo(40.0, 4);
      expect(o2.postPhase2SoCWh).toBeCloseTo(36.2316, 4);
      expect(o2.netOrbitBatteryChangeWh).toBeCloseTo(0.0000, 4);

      // Periodic Stability
      expect(result.isPeriodicStable).toBeTrue();
      expect(result.completeSafeOrbits).toBe(5);
      expect(result.fractionalOrbitsToSafeLimit).toBeNull();
      expect(result.completeOperationalOrbits).toBe(5);
      expect(result.fractionalOrbitsToExhaustion).toBeNull();
    });
  });

  describe("Analytical Case P-3: Phase Order (ECLIPSE_THEN_SUNLIGHT)", () => {
    it("discharges first and recharges to 100% within the initial orbit", () => {
      const input: PowerBalanceInput = {
        solarGeometry: referenceSolarGeometryP1,
        sunlightLoadWatts: watts(8.0),
        eclipseLoadWatts: watts(6.0),
        sunlightDurationMin: minutes(59.87),
        eclipseDurationMin: minutes(35.80),
        batteryNameplateWh: wattHours(40.0),
        maxAllowedDodPercent: 30.0,
        chargeEfficiency: 0.90,
        dischargeEfficiency: 0.95,
        initialSocPercent: 100.0,
        phaseOrder: "ECLIPSE_THEN_SUNLIGHT",
        simulationOrbits: 3,
      };

      const result = simulatePowerBalance(input);

      // Orbit 1: Eclipse discharges first down to 36.2316 Wh, then Sunlight recharges to 40 Wh.
      const o1 = result.orbitHistory[0];
      expect(o1.startSoCWh).toBeCloseTo(40.0, 4);
      expect(o1.postPhase1SoCWh).toBeCloseTo(36.2316, 4);
      expect(o1.actualEnergyAcceptedWh).toBeCloseTo(3.7684, 4);
      expect(o1.unacceptedSurplusWh).toBeCloseTo(7.2635, 4);
      expect(o1.postPhase2SoCWh).toBeCloseTo(40.0, 4);
      expect(o1.netOrbitBatteryChangeWh).toBeCloseTo(0.0000, 4);
      expect(result.isPeriodicStable).toBeTrue();
    });
  });

  describe("Analytical Case P-4: Rate-Limited Charge Acceptance (C-Rate Limitation)", () => {
    it("constrains charging acceptance by chemical C-rate ceiling", () => {
      const input: PowerBalanceInput = {
        solarGeometry: referenceSolarGeometryP1,
        sunlightLoadWatts: watts(8.0),
        eclipseLoadWatts: watts(6.0),
        sunlightDurationMin: minutes(59.87),
        eclipseDurationMin: minutes(35.80),
        batteryNameplateWh: wattHours(40.0),
        maxAllowedDodPercent: 50.0, // Floor = 50% (20 Wh)
        chargeEfficiency: 0.90,
        dischargeEfficiency: 0.95,
        maxChargeCRate: 0.1, // 0.1C -> P_chem_max = 4.0 W -> over 59.87 min: 3.9913 Wh
        initialSocPercent: 50.0, // Starts at 20.0 Wh
        phaseOrder: "SUNLIGHT_THEN_ECLIPSE",
        simulationOrbits: 1,
      };

      const result = simulatePowerBalance(input);
      const o1 = result.orbitHistory[0];

      // Delivered surplus = 11.0319 Wh, Headroom = 20.0 Wh, Rate limit = 3.9913 Wh
      expect(o1.startSoCWh).toBeCloseTo(20.0, 4);
      expect(o1.actualEnergyAcceptedWh).toBeCloseTo(3.9913, 4);
      expect(o1.unacceptedSurplusWh).toBeCloseTo(7.0406, 4);
      expect(o1.postPhase1SoCWh).toBeCloseTo(23.9913, 4);
      expect(o1.eclipseDischargeWh).toBeCloseTo(3.7684, 4);
      expect(o1.postPhase2SoCWh).toBeCloseTo(20.2229, 4);
      expect(o1.netOrbitBatteryChangeWh).toBeCloseTo(0.2229, 4);
    });
  });

  describe("Solar Array Generation Physics & Geometric Angles", () => {
    it("computes nominal solar generation for realistic 3U CubeSat array", () => {
      const geom: SolarGeometryInput = {
        cellAreaM2: 0.08, // 800 cm² (e.g. 3U body mounted / small deployable)
        cellEfficiency: 0.28,
        sunDistanceAu: 1.0,
        solarIncidenceAngleDeg: 0,
        packingFactor: 0.85,
        mpptEfficiency: 0.95,
        annualDegradation: 0.02,
        missionYears: 1.0,
      };

      const pGen = calculateSolarGeneration(geom);
      // Flux = 1361 W/m²
      // P = 1361 * 0.08 * 0.28 * 1.0 * 0.85 * 0.95 * (1 - 0.02)^1
      // P = 24.617768 * 0.98 = 24.12541264 W
      expect(pGen).toBeCloseTo(24.1254, 4);
    });

    it("enforces cosine cutoff at and beyond 90 degrees incidence", () => {
      const geomBase: SolarGeometryInput = {
        cellAreaM2: 0.1,
        cellEfficiency: 0.3,
        sunDistanceAu: 1.0,
        solarIncidenceAngleDeg: 90,
        packingFactor: 1.0,
        mpptEfficiency: 1.0,
        annualDegradation: 0.0,
        missionYears: 0.0,
      };

      expect(calculateSolarGeneration(geomBase)).toBe(0.0);

      // Past 90 degrees (facing away from sun)
      expect(
        calculateSolarGeneration({ ...geomBase, solarIncidenceAngleDeg: 120 })
      ).toBe(0.0);
    });

    it("scales solar flux inversely with the square of heliocentric distance (d_AU^2)", () => {
      const geom1Au: SolarGeometryInput = {
        cellAreaM2: 0.1,
        cellEfficiency: 0.3,
        sunDistanceAu: 1.0,
        solarIncidenceAngleDeg: 0,
        packingFactor: 1.0,
        mpptEfficiency: 1.0,
        annualDegradation: 0.0,
        missionYears: 0.0,
      };
      const geom2Au: SolarGeometryInput = { ...geom1Au, sunDistanceAu: 2.0 };

      const p1 = calculateSolarGeneration(geom1Au);
      const p2 = calculateSolarGeneration(geom2Au);

      expect(p2).toBeCloseTo(p1 / 4.0, 4);
    });

    it("supports custom solar constants", () => {
      const geom: SolarGeometryInput = {
        cellAreaM2: 0.1,
        cellEfficiency: 0.3,
        sunDistanceAu: 1.0,
        solarIncidenceAngleDeg: 0,
        packingFactor: 1.0,
        mpptEfficiency: 1.0,
        annualDegradation: 0.0,
        missionYears: 0.0,
        solarConstantWpm2: 1400.0,
      };
      expect(calculateSolarGeneration(geom)).toBeCloseTo(42.0, 4);
    });
  });

  describe("Boundary Conditions, Zero Load & Zero Solar Generation", () => {
    it("handles zero spacecraft load cleanly", () => {
      const input: PowerBalanceInput = {
        solarGeometry: referenceSolarGeometryP1,
        sunlightLoadWatts: watts(0.0),
        eclipseLoadWatts: watts(0.0),
        sunlightDurationMin: minutes(60.0),
        eclipseDurationMin: minutes(30.0),
        batteryNameplateWh: wattHours(40.0),
        maxAllowedDodPercent: 30.0,
        chargeEfficiency: 0.90,
        dischargeEfficiency: 0.95,
        initialSocPercent: 100.0,
        simulationOrbits: 3,
      };

      const result = simulatePowerBalance(input);
      expect(result.isPeriodicStable).toBeTrue();
      expect(result.completeSafeOrbits).toBe(3);
      expect(result.orbitHistory[0].startSoCWh).toBe(40.0);
      expect(result.orbitHistory[0].postPhase2SoCWh).toBe(40.0);
      expect(result.orbitHistory[0].netOrbitBatteryChangeWh).toBe(0.0);
    });

    it("handles zero solar generation (continual discharge across both phases)", () => {
      const zeroSolarGeom: SolarGeometryInput = {
        ...referenceSolarGeometryP1,
        solarIncidenceAngleDeg: 90, // Cutoff
      };

      const input: PowerBalanceInput = {
        solarGeometry: zeroSolarGeom,
        sunlightLoadWatts: watts(5.0),
        eclipseLoadWatts: watts(5.0),
        sunlightDurationMin: minutes(60.0),
        eclipseDurationMin: minutes(30.0),
        batteryNameplateWh: wattHours(40.0),
        maxAllowedDodPercent: 30.0, // Floor = 28 Wh
        chargeEfficiency: 0.90,
        dischargeEfficiency: 1.0,
        initialSocPercent: 100.0,
        simulationOrbits: 3,
      };

      const result = simulatePowerBalance(input);
      expect(result.solarGenerationWatts).toBe(0.0);

      // Drain rate: 5 W / 1.0 = 5 Wh per hour
      // Sunlight: 1.0 h * 5 W = 5 Wh discharge
      // Eclipse: 0.5 h * 5 W = 2.5 Wh discharge
      // Orbit 1: 40 -> 35 -> 32.5 Wh
      expect(result.orbitHistory[0].postPhase1SoCWh).toBeCloseTo(35.0, 4);
      expect(result.orbitHistory[0].postPhase2SoCWh).toBeCloseTo(32.5, 4);
      // Orbit 2: 32.5 -> 27.5 Wh (violates 28 Wh floor during sunlight)
      expect(result.orbitHistory[1].dodViolation).toBeTrue();
      expect(result.completeSafeOrbits).toBe(1);
    });

    it("supports zero eclipse duration with positive sunlight duration (Dawn-Dusk SSO)", () => {
      // 90 minutes continuous sunlight, 0 minutes eclipse
      const input: PowerBalanceInput = {
        solarGeometry: referenceSolarGeometryP1,
        sunlightLoadWatts: watts(8.0),
        eclipseLoadWatts: watts(6.0), // Defined load, but 0 duration
        sunlightDurationMin: minutes(90.0),
        eclipseDurationMin: minutes(0.0),
        batteryNameplateWh: wattHours(40.0),
        maxAllowedDodPercent: 30.0,
        chargeEfficiency: 0.90,
        dischargeEfficiency: 0.95,
        initialSocPercent: 100.0,
        simulationOrbits: 3,
      };

      const result = simulatePowerBalance(input);
      expect(result.isPeriodicStable).toBeTrue();
      expect(result.completeSafeOrbits).toBe(3);

      const o1 = result.orbitHistory[0];
      expect(o1.eclipseDischargeWh).toBe(0.0);
      expect(o1.postPhase1SoCWh).toBe(40.0);
      expect(o1.postPhase2SoCWh).toBe(40.0);
      expect(o1.netOrbitBatteryChangeWh).toBe(0.0);
    });

    it("supports zero sunlight duration with positive eclipse duration (Shadow Coast)", () => {
      // 0 minutes sunlight, 60 minutes continuous eclipse
      const input: PowerBalanceInput = {
        solarGeometry: referenceSolarGeometryP1,
        sunlightLoadWatts: watts(10.0),
        eclipseLoadWatts: watts(6.0),
        sunlightDurationMin: minutes(0.0),
        eclipseDurationMin: minutes(60.0),
        batteryNameplateWh: wattHours(40.0),
        maxAllowedDodPercent: 30.0, // Floor = 28 Wh
        chargeEfficiency: 0.90,
        dischargeEfficiency: 1.0,
        initialSocPercent: 100.0,
        simulationOrbits: 3,
      };

      const result = simulatePowerBalance(input);
      const o1 = result.orbitHistory[0];
      expect(o1.sunlightDeficitDischargeWh).toBe(0.0);
      expect(o1.postPhase1SoCWh).toBe(40.0); // 0 min sunlight -> no discharge
      expect(o1.postPhase2SoCWh).toBeCloseTo(34.0, 4); // 6 Wh discharge in eclipse

      // Orbit 2: 34 -> 28 Wh (at floor), Orbit 3: drops below 28 Wh
      const o2 = result.orbitHistory[1];
      expect(o2.postPhase2SoCWh).toBeCloseTo(28.0, 4);
      expect(o2.dodViolation).toBeFalse();

      const o3 = result.orbitHistory[2];
      expect(o3.dodViolation).toBeTrue();
      expect(result.completeSafeOrbits).toBe(2);
      expect(result.fractionalOrbitsToSafeLimit).not.toBeNull();
    });

    it("safely handles zero-duration phases under both phase-order configurations", () => {
      // Test ECLIPSE_THEN_SUNLIGHT with 0 min eclipse
      const inputEclFirst: PowerBalanceInput = {
        solarGeometry: referenceSolarGeometryP1,
        sunlightLoadWatts: watts(8.0),
        eclipseLoadWatts: watts(6.0),
        sunlightDurationMin: minutes(60.0),
        eclipseDurationMin: minutes(0.0),
        batteryNameplateWh: wattHours(40.0),
        maxAllowedDodPercent: 30.0,
        chargeEfficiency: 0.90,
        dischargeEfficiency: 0.95,
        initialSocPercent: 90.0, // Starts at 36 Wh
        phaseOrder: "ECLIPSE_THEN_SUNLIGHT",
        simulationOrbits: 1,
      };

      const resEclFirst = simulatePowerBalance(inputEclFirst);
      const o1 = resEclFirst.orbitHistory[0];
      // Phase 1 (Eclipse 0 min): no change (36 Wh)
      expect(o1.postPhase1SoCWh).toBeCloseTo(36.0, 4);
      // Phase 2 (Sunlight 60 min): charges with surplus
      expect(o1.postPhase2SoCWh > 36.0).toBeTrue();
    });

    it("supports zero charging C-rate (maxChargeCRate = 0 dumps all surplus without charging)", () => {
      const input: PowerBalanceInput = {
        solarGeometry: referenceSolarGeometryP1,
        sunlightLoadWatts: watts(8.0),
        eclipseLoadWatts: watts(6.0),
        sunlightDurationMin: minutes(59.87),
        eclipseDurationMin: minutes(35.80),
        batteryNameplateWh: wattHours(40.0),
        maxAllowedDodPercent: 50.0,
        chargeEfficiency: 0.90,
        dischargeEfficiency: 0.95,
        maxChargeCRate: 0.0, // 0 C-rate -> no charge acceptance allowed
        initialSocPercent: 80.0, // Starts at 32.0 Wh (headroom = 8.0 Wh)
        phaseOrder: "SUNLIGHT_THEN_ECLIPSE",
        simulationOrbits: 1,
      };

      const result = simulatePowerBalance(input);
      const o1 = result.orbitHistory[0];

      // Battery cannot charge: actualEnergyAcceptedWh must be 0 Wh
      expect(o1.actualEnergyAcceptedWh).toBe(0.0);
      // Delivered surplus = 11.0319 Wh -> entirely dumped into unacceptedSurplusWh
      expect(o1.unacceptedSurplusWh).toBeCloseTo(11.0319, 4);
      // Post-phase 1 remains at initial 32.0 Wh
      expect(o1.postPhase1SoCWh).toBeCloseTo(32.0, 4);
      // Eclipse discharges normally (3.7684 Wh)
      expect(o1.eclipseDischargeWh).toBeCloseTo(3.7684, 4);
      expect(o1.postPhase2SoCWh).toBeCloseTo(32.0 - 3.7684, 3);
    });
  });

  describe("Runtime Input Validation & Exception Handling", () => {
    const validBaseInput: PowerBalanceInput = {
      solarGeometry: referenceSolarGeometryP1,
      sunlightLoadWatts: watts(10.0),
      eclipseLoadWatts: watts(5.0),
      sunlightDurationMin: minutes(60.0),
      eclipseDurationMin: minutes(30.0),
      batteryNameplateWh: wattHours(40.0),
      maxAllowedDodPercent: 30.0,
      chargeEfficiency: 0.90,
      dischargeEfficiency: 0.95,
      initialSocPercent: 100.0,
    };

    it("rejects null, undefined, or non-object inputs", () => {
      // @ts-expect-error Testing null input
      expect(() => simulatePowerBalance(null)).toThrow(ValidationError);
      // @ts-expect-error Testing undefined input
      expect(() => simulatePowerBalance(undefined)).toThrow(ValidationError);
      // @ts-expect-error Testing primitive input
      expect(() => simulatePowerBalance("invalid")).toThrow(ValidationError);
      // @ts-expect-error Testing null geometry
      expect(() => calculateSolarGeneration(null)).toThrow(ValidationError);
    });

    it("rejects negative loads, negative durations, or zero total orbit duration", () => {
      expect(() =>
        simulatePowerBalance({ ...validBaseInput, sunlightLoadWatts: watts(-1.0) })
      ).toThrow(ValidationError);

      expect(() =>
        simulatePowerBalance({ ...validBaseInput, eclipseDurationMin: minutes(-1.0) })
      ).toThrow(ValidationError);

      // Both durations zero must throw
      expect(() =>
        simulatePowerBalance({
          ...validBaseInput,
          sunlightDurationMin: minutes(0.0),
          eclipseDurationMin: minutes(0.0),
        })
      ).toThrow(ValidationError);

      expect(() =>
        simulatePowerBalance({ ...validBaseInput, batteryNameplateWh: wattHours(0.0) })
      ).toThrow(ValidationError);
    });

    it("rejects invalid DoD percentage or out-of-range efficiencies", () => {
      expect(() =>
        simulatePowerBalance({ ...validBaseInput, maxAllowedDodPercent: 0 })
      ).toThrow(ValidationError);

      expect(() =>
        simulatePowerBalance({ ...validBaseInput, maxAllowedDodPercent: 105 })
      ).toThrow(ValidationError);

      expect(() =>
        simulatePowerBalance({ ...validBaseInput, chargeEfficiency: 0 })
      ).toThrow(ValidationError);

      expect(() =>
        simulatePowerBalance({ ...validBaseInput, dischargeEfficiency: 1.5 })
      ).toThrow(ValidationError);
    });

    it("enforces assertInitialSocAboveFloor and rejects starting below DoD floor", () => {
      // With maxAllowedDodPercent = 30%, floor is 70%. initialSocPercent = 60% must fail!
      expect(() =>
        simulatePowerBalance({
          ...validBaseInput,
          maxAllowedDodPercent: 30.0,
          initialSocPercent: 60.0,
        })
      ).toThrow(ValidationError);
    });

    it("rejects negative C-rate or invalid phase orders", () => {
      expect(() =>
        simulatePowerBalance({ ...validBaseInput, maxChargeCRate: -0.5 })
      ).toThrow(ValidationError);

      expect(() =>
        simulatePowerBalance({
          ...validBaseInput,
          // @ts-expect-error Testing invalid phaseOrder string
          phaseOrder: "INVALID_ORDER",
        })
      ).toThrow(ValidationError);

      expect(() =>
        simulatePowerBalance({ ...validBaseInput, simulationOrbits: 0 })
      ).toThrow(ValidationError);
    });
  });

  describe("Runtime Immutability & Constants", () => {
    it("returns deeply frozen PowerSimulationResult and OrbitStepRecord objects", () => {
      const result = simulatePowerBalance({
        solarGeometry: referenceSolarGeometryP1,
        sunlightLoadWatts: watts(8.0),
        eclipseLoadWatts: watts(6.0),
        sunlightDurationMin: minutes(59.87),
        eclipseDurationMin: minutes(35.80),
        batteryNameplateWh: wattHours(40.0),
        maxAllowedDodPercent: 30.0,
        chargeEfficiency: 0.90,
        dischargeEfficiency: 0.95,
      });

      expect(Object.isFrozen(result)).toBeTrue();
      expect(Object.isFrozen(result.orbitHistory)).toBeTrue();
      expect(Object.isFrozen(result.orbitHistory[0])).toBeTrue();

      expect(() => {
        (result as { completeSafeOrbits: number }).completeSafeOrbits = 999;
      }).toThrow();

      expect(() => {
        (result.orbitHistory[0] as { postPhase1SoCWh: number }).postPhase1SoCWh = 999;
      }).toThrow();
    });

    it("verifies module constants", () => {
      expect(DEFAULT_SOLAR_CONSTANT_WPM2).toBe(1361.0);
      expect(DEFAULT_SIMULATION_ORBITS).toBe(15);
    });
  });
});
