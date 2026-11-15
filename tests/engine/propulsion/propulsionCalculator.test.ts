import { describe, expect, it } from "bun:test";
import {
  calculatePropulsion,
  STANDARD_GRAVITY_MPS2,
  PROPULSION_SCOPE_NOTE,
  type PropulsionInput,
} from "../../../src/engine/propulsion/propulsionCalculator";
import { ValidationError, kg, seconds } from "../../../src/engine/units";

describe("src/engine/propulsion/propulsionCalculator.ts", () => {
  describe("Analytical Reference Case PR-2: Active Propellant Burn", () => {
    it("computes exact Tsiolkovsky delta-v, burn duration, and accelerations matching Case PR-2 specification", () => {
      const input: PropulsionInput = {
        dryMassKg: kg(3.0),
        propellantMassKg: kg(0.5),
        specificImpulseSeconds: seconds(220),
        thrustNewtons: 1.0,
      };

      const result = calculatePropulsion(input);

      // 1. Mass characteristics
      expect(result.hasPropulsion).toBeTrue();
      expect(result.initialWetMassKg).toBe(3.5);
      expect(result.finalDryMassKg).toBe(3.0);
      expect(result.massRatio).toBeCloseTo(3.5 / 3.0, 6);

      // 2. Tsiolkovsky Ideal Delta-V: Delta_v = 220 * 9.80665 * ln(3.5 / 3.0) = 332.5744 m/s
      expect(result.idealDeltaVMps).toBeCloseTo(332.5744, 4);

      // 3. Burn Duration: t_burn = (0.5 * 220 * 9.80665) / 1.0 = 1078.7315 s
      expect(result.burnDurationSeconds).toBeCloseTo(1078.7315, 4);

      // 4. Accelerations: a_0 = 1.0 / 3.5 = 0.285714 m/s², a_f = 1.0 / 3.0 = 0.333333 m/s²
      expect(result.accelerationInitialMps2).toBeCloseTo(0.285714, 4);
      expect(result.accelerationFinalMps2).toBeCloseTo(0.333333, 4);

      // 5. Educational Scope Note
      expect(result.scopeNote).toBe(PROPULSION_SCOPE_NOTE);
    });
  });

  describe("Analytical Reference Case PR-1: Zero Propellant Clean Handling", () => {
    it("returns zero delta-v and zero burn duration without error or NaN", () => {
      const input: PropulsionInput = {
        dryMassKg: kg(3.0),
        propellantMassKg: kg(0.0),
        specificImpulseSeconds: seconds(220),
        thrustNewtons: 0.0,
      };

      const result = calculatePropulsion(input);

      expect(result.hasPropulsion).toBeFalse();
      expect(result.initialWetMassKg).toBe(3.0);
      expect(result.finalDryMassKg).toBe(3.0);
      expect(result.massRatio).toBe(1.0);
      expect(result.idealDeltaVMps).toBe(0.0);
      expect(result.burnDurationSeconds).toBe(0.0);
      expect(result.accelerationInitialMps2).toBe(0.0);
      expect(result.accelerationFinalMps2).toBe(0.0);
      expect(result.scopeNote).toBe(PROPULSION_SCOPE_NOTE);
    });

    it("handles zero propellant when thrust is positive (e.g. cold gas thruster without loaded propellant)", () => {
      const input: PropulsionInput = {
        dryMassKg: kg(2.0),
        propellantMassKg: kg(0.0),
        specificImpulseSeconds: seconds(65),
        thrustNewtons: 0.5,
      };

      const result = calculatePropulsion(input);

      expect(result.hasPropulsion).toBeFalse();
      expect(result.idealDeltaVMps).toBe(0.0);
      expect(result.burnDurationSeconds).toBe(0.0);
      expect(result.massRatio).toBe(1.0);
    });
  });

  describe("Alternative Propulsion Technologies", () => {
    it("calculates high-Isp electric propulsion (Hall / Gridded Ion Thruster)", () => {
      // Small CubeSat ion thruster: Isp = 3000 s, Thrust = 5 mN (0.005 N), Dry mass = 8.0 kg, Prop = 0.5 kg (Xenon)
      const input: PropulsionInput = {
        dryMassKg: kg(8.0),
        propellantMassKg: kg(0.5),
        specificImpulseSeconds: seconds(3000),
        thrustNewtons: 0.005,
      };

      const result = calculatePropulsion(input);

      // m_0 = 8.5 kg, m_f = 8.0 kg -> ln(8.5 / 8.0) = 0.0606246
      // Delta-V = 3000 * 9.80665 * 0.0606246 = 1783.56 m/s
      const expectedDeltaV = 3000 * 9.80665 * Math.log(8.5 / 8.0);
      expect(result.idealDeltaVMps).toBeCloseTo(expectedDeltaV, 4);
      expect(result.idealDeltaVMps > 1780.0).toBeTrue();

      // Burn duration: (0.5 * 3000 * 9.80665) / 0.005 = 2,941,995 seconds (~34 days continuous)
      expect(result.burnDurationSeconds).toBeCloseTo(2941995.0, 1);
      expect(result.accelerationInitialMps2).toBeCloseTo(0.005 / 8.5, 6);
    });

    it("calculates low-Isp cold gas thruster (e.g. R134a / Butane / Nitrogen)", () => {
      // Cold gas: Isp = 68 s, Thrust = 0.1 N, Dry mass = 1.2 kg, Prop = 0.05 kg
      const input: PropulsionInput = {
        dryMassKg: kg(1.2),
        propellantMassKg: kg(0.05),
        specificImpulseSeconds: seconds(68),
        thrustNewtons: 0.1,
      };

      const result = calculatePropulsion(input);

      const expectedDeltaV = 68 * 9.80665 * Math.log(1.25 / 1.2);
      expect(result.idealDeltaVMps).toBeCloseTo(expectedDeltaV, 4);
      expect(result.burnDurationSeconds).toBeCloseTo((0.05 * 68 * 9.80665) / 0.1, 4);
    });
  });

  describe("Runtime Input Validation & Exception Handling", () => {
    it("rejects null, undefined, or non-object inputs", () => {
      // @ts-expect-error Testing null input
      expect(() => calculatePropulsion(null)).toThrow(ValidationError);
      // @ts-expect-error Testing undefined input
      expect(() => calculatePropulsion(undefined)).toThrow(ValidationError);
      // @ts-expect-error Testing primitive input
      expect(() => calculatePropulsion("invalid")).toThrow(ValidationError);
    });

    it("rejects non-positive dry mass", () => {
      expect(() =>
        calculatePropulsion({
          dryMassKg: kg(0.0),
          propellantMassKg: kg(0.5),
          specificImpulseSeconds: seconds(220),
          thrustNewtons: 1.0,
        })
      ).toThrow(ValidationError);

      expect(() =>
        calculatePropulsion({
          dryMassKg: kg(-1.0),
          propellantMassKg: kg(0.5),
          specificImpulseSeconds: seconds(220),
          thrustNewtons: 1.0,
        })
      ).toThrow(ValidationError);
    });

    it("rejects negative propellant mass", () => {
      expect(() =>
        calculatePropulsion({
          dryMassKg: kg(3.0),
          propellantMassKg: kg(-0.2),
          specificImpulseSeconds: seconds(220),
          thrustNewtons: 1.0,
        })
      ).toThrow(ValidationError);
    });

    it("rejects non-positive specific impulse when propellant is present", () => {
      expect(() =>
        calculatePropulsion({
          dryMassKg: kg(3.0),
          propellantMassKg: kg(0.5),
          specificImpulseSeconds: seconds(0),
          thrustNewtons: 1.0,
        })
      ).toThrow(ValidationError);

      expect(() =>
        calculatePropulsion({
          dryMassKg: kg(3.0),
          propellantMassKg: kg(0.5),
          specificImpulseSeconds: seconds(-50),
          thrustNewtons: 1.0,
        })
      ).toThrow(ValidationError);
    });

    it("rejects non-positive thrust when propellant is present", () => {
      expect(() =>
        calculatePropulsion({
          dryMassKg: kg(3.0),
          propellantMassKg: kg(0.5),
          specificImpulseSeconds: seconds(220),
          thrustNewtons: 0.0,
        })
      ).toThrow(ValidationError);

      expect(() =>
        calculatePropulsion({
          dryMassKg: kg(3.0),
          propellantMassKg: kg(0.5),
          specificImpulseSeconds: seconds(220),
          thrustNewtons: -1.0,
        })
      ).toThrow(ValidationError);
    });

    it("rejects non-finite inputs (NaN and Infinity)", () => {
      expect(() =>
        calculatePropulsion({
          dryMassKg: kg(NaN),
          propellantMassKg: kg(0.5),
          specificImpulseSeconds: seconds(220),
          thrustNewtons: 1.0,
        })
      ).toThrow(ValidationError);

      expect(() =>
        calculatePropulsion({
          dryMassKg: kg(3.0),
          propellantMassKg: kg(Number.POSITIVE_INFINITY),
          specificImpulseSeconds: seconds(220),
          thrustNewtons: 1.0,
        })
      ).toThrow(ValidationError);

      expect(() =>
        calculatePropulsion({
          dryMassKg: kg(3.0),
          propellantMassKg: kg(0.5),
          specificImpulseSeconds: seconds(NaN),
          thrustNewtons: 1.0,
        })
      ).toThrow(ValidationError);

      expect(() =>
        calculatePropulsion({
          dryMassKg: kg(3.0),
          propellantMassKg: kg(0.5),
          specificImpulseSeconds: seconds(220),
          thrustNewtons: Number.NaN,
        })
      ).toThrow(ValidationError);
    });
  });

  describe("Runtime Immutability & Constants", () => {
    it("returns deeply frozen PropulsionResult objects", () => {
      const result = calculatePropulsion({
        dryMassKg: kg(3.0),
        propellantMassKg: kg(0.5),
        specificImpulseSeconds: seconds(220),
        thrustNewtons: 1.0,
      });

      expect(Object.isFrozen(result)).toBeTrue();

      expect(() => {
        (result as { idealDeltaVMps: number }).idealDeltaVMps = 999;
      }).toThrow();

      expect(() => {
        (result as { hasPropulsion: boolean }).hasPropulsion = false;
      }).toThrow();
    });

    it("verifies module constants", () => {
      expect(STANDARD_GRAVITY_MPS2).toBe(9.80665);
      expect(PROPULSION_SCOPE_NOTE).toBe(
        "Ideal impulsive delta-v; trajectory losses evaluated in Phase 4"
      );
    });
  });
});
