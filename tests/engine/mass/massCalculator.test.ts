import { describe, expect, it } from "bun:test";
import {
  calculateMassBudget,
  calculateCbe,
  calculateMga,
  calculateMev,
  DEFAULT_CML_DRY_MARGIN_THRESHOLD_PERCENT,
  type MassComponentInput,
} from "../../../src/engine/mass/massCalculator";
import { CDS_STANDARDS } from "../../../src/engine/standards/cdsStandards";
import { DISPENSER_PROFILES } from "../../../src/engine/standards/dispenserProfiles";
import { ValidationError, kg } from "../../../src/engine/units";

describe("src/engine/mass/massCalculator.ts", () => {
  // Reference components matching Case M-1 (CBE = 2.40 kg, MGA = 0.24 kg, MEV = 2.64 kg)
  const componentsM1: MassComponentInput[] = [
    {
      id: "STR-01",
      name: "Primary Aluminum Structure",
      nominalMassKg: kg(1.00),
      contingencyFraction: 0.10,
    },
    {
      id: "BUS-01",
      name: "Avionics, EPS & Payload Stack",
      nominalMassKg: kg(1.40),
      contingencyFraction: 0.10,
    },
  ];

  describe("Analytical Case M-1: Baseline 3U CubeSat with P-POD Mk III", () => {
    it("computes exact mass quantities and margins matching Case M-1 specification", () => {
      const result = calculateMassBudget({
        components: componentsM1,
        propellantMassKg: kg(0.30),
        dryMassAllocationKg: kg(3.30),
        dispenserProfile: DISPENSER_PROFILES.PPOD_MK3_3U,
        cdsStandardProfile: CDS_STANDARDS.CDS_REV_13,
        formFactor: "3U",
      });

      // 1. Component aggregation
      expect(result.cbeDryMassKg).toBe(2.40);
      expect(result.mgaDryMassKg).toBeCloseTo(0.24, 4);
      expect(result.mevDryMassKg).toBeCloseTo(2.64, 4);
      expect(result.totalWetMassKg).toBeCloseTo(2.94, 4);

      // 2. System dry mass allocation and headroom
      expect(result.dryMassAllocationKg).toBe(3.30);
      expect(result.systemHeadroomOnMevKg).toBeCloseTo(0.66, 4);
      expect(result.systemHeadroomOnMevPercent).toBeCloseTo(25.0, 4);
      expect(result.combinedCmlDryMarginPercent).toBeCloseTo(37.5, 4);
      expect(result.meetsCmlDryMarginThreshold).toBeTrue();

      // 3. Dispenser rated payload mass capacity compliance (4.00 kg limit)
      expect(result.dispenserRatedLimitKg).toBe(4.00);
      expect(result.dispenserExcessKg).toBeCloseTo(1.06, 4);
      expect(result.dispenserMarginPercent).toBeCloseTo(36.0544, 3);
      expect(result.meetsDispenserLimit).toBeTrue();

      // 4. Cal Poly CDS Rev 13 document envelope compliance (4.00 kg limit)
      expect(result.cdsStandardLimitKg).toBe(4.00);
      expect(result.meetsCdsStandardLimit).toBeTrue();

      // 5. NASA LSP / CSLI Propulsion Prohibition Policy (NASA LSP-REQ-317.01 Rev B §6.2.5)
      expect(result.lspPropulsionCompliant).toBeFalse();
      expect(result.propellantPolicyNote).toContain("NON-COMPLIANT: NASA LSP-REQ-317.01 Rev B §6.2.5");
    });
  });

  describe("Analytical Case M-2: Modern CDS Rev 14.1 & EXOpod Comparison", () => {
    it("computes margins under CDS Rev 14.1 envelope and EXOpod payload mass limits", () => {
      const result = calculateMassBudget({
        components: componentsM1,
        propellantMassKg: kg(0.30),
        dryMassAllocationKg: kg(3.30),
        dispenserProfile: DISPENSER_PROFILES.EXOPOD_3U_HIGH_MASS,
        cdsStandardProfile: CDS_STANDARDS.CDS_REV_14_1,
        formFactor: "3U",
      });

      // Total wet mass remains 2.94 kg
      expect(result.totalWetMassKg).toBeCloseTo(2.94, 4);

      // Cal Poly CDS Rev 14.1 allows 6.00 kg for 3U
      expect(result.cdsStandardLimitKg).toBe(6.00);
      expect(result.meetsCdsStandardLimit).toBeTrue();

      // EXOpod 3U High-Mass rated at 6.00 kg
      expect(result.dispenserRatedLimitKg).toBe(6.00);
      expect(result.dispenserExcessKg).toBeCloseTo(3.06, 4);
      expect(result.dispenserMarginPercent).toBeCloseTo(104.0816, 3);
      expect(result.meetsDispenserLimit).toBeTrue();

      // Commercial profile: LSP §6.2.5 is not applicable
      expect(result.lspPropulsionCompliant).toBeNull();
      expect(result.propellantPolicyNote).toContain("NON-LSP PROFILE");
    });
  });

  describe("Propulsion Policy Variations & Zero Propellant Handling", () => {
    it("evaluates zero propellant under NASA LSP profile as compliant", () => {
      const result = calculateMassBudget({
        components: componentsM1,
        propellantMassKg: kg(0.0),
        dryMassAllocationKg: kg(3.30),
        dispenserProfile: DISPENSER_PROFILES.PPOD_MK3_3U,
        cdsStandardProfile: CDS_STANDARDS.CDS_REV_14_1,
        formFactor: "3U",
      });

      expect(result.totalWetMassKg).toBeCloseTo(2.64, 4);
      expect(result.lspPropulsionCompliant).toBeTrue();
      expect(result.propellantPolicyNote).toContain("COMPLIANT: No propulsion systems present");
    });

    it("evaluates zero propellant under non-LSP profile cleanly", () => {
      const result = calculateMassBudget({
        components: componentsM1,
        propellantMassKg: kg(0.0),
        dryMassAllocationKg: kg(3.30),
        dispenserProfile: DISPENSER_PROFILES.EXOPOD_3U_HIGH_MASS,
        cdsStandardProfile: CDS_STANDARDS.CDS_REV_14_1,
        formFactor: "3U",
      });

      expect(result.lspPropulsionCompliant).toBeNull();
      expect(result.propellantPolicyNote).toContain("Spacecraft does not include propulsion systems");
    });
  });

  describe("Form-Factor Handling & Unsupported Revisions", () => {
    it("returns null for CDS limits when form factor is not standardized in chosen revision (Rev 13 6U)", () => {
      const components6U: MassComponentInput[] = [
        { id: "STR-6U", name: "6U Structure", nominalMassKg: kg(2.50), contingencyFraction: 0.10 },
        { id: "PAY-6U", name: "Payload Stack", nominalMassKg: kg(3.50), contingencyFraction: 0.15 },
      ];

      const result = calculateMassBudget({
        components: components6U,
        propellantMassKg: kg(0.50),
        dryMassAllocationKg: kg(8.00),
        dispenserProfile: DISPENSER_PROFILES.CUSTOM_OVERRIDE,
        cdsStandardProfile: CDS_STANDARDS.CDS_REV_13, // 6U is null in Rev 13
        formFactor: "6U",
      });

      expect(result.cdsStandardLimitKg).toBeNull();
      expect(result.meetsCdsStandardLimit).toBeNull();
    });
  });

  describe("Negative Margins and Limit Exceedance", () => {
    it("correctly calculates negative dispenser margin when wet mass exceeds dispenser payload limit", () => {
      // Overweight satellite: 4.50 kg wet mass against 4.00 kg P-POD limit
      const heavyComponents: MassComponentInput[] = [
        { id: "HVY-1", name: "Heavy Payload", nominalMassKg: kg(4.00), contingencyFraction: 0.10 },
      ];

      const result = calculateMassBudget({
        components: heavyComponents,
        propellantMassKg: kg(0.50), // MEV = 4.40 kg, Wet = 4.90 kg
        dryMassAllocationKg: kg(5.00),
        dispenserProfile: DISPENSER_PROFILES.PPOD_MK3_3U,
        cdsStandardProfile: CDS_STANDARDS.CDS_REV_13,
        formFactor: "3U",
      });

      expect(result.totalWetMassKg).toBeCloseTo(4.90, 4);
      expect(result.dispenserExcessKg).toBeCloseTo(-0.90, 4);
      expect(result.dispenserMarginPercent < 0).toBeTrue();
      expect(result.meetsDispenserLimit).toBeFalse();
      expect(result.meetsCdsStandardLimit).toBeFalse();
    });

    it("correctly identifies allocation deficit when dry mass allocation is below MEV", () => {
      const result = calculateMassBudget({
        components: componentsM1, // CBE = 2.40 kg, MEV = 2.64 kg
        propellantMassKg: kg(0.10),
        dryMassAllocationKg: kg(2.50), // Less than MEV!
        dispenserProfile: DISPENSER_PROFILES.PPOD_MK3_3U,
        cdsStandardProfile: CDS_STANDARDS.CDS_REV_14_1,
        formFactor: "3U",
      });

      expect(result.systemHeadroomOnMevKg).toBeCloseTo(-0.14, 4);
      expect(result.systemHeadroomOnMevPercent < 0).toBeTrue();
      expect(result.meetsCmlDryMarginThreshold).toBeFalse();
    });
  });

  describe("Independent Aggregation Helpers", () => {
    it("calculates CBE, MGA, and MEV independently with high accuracy", () => {
      const cbe = calculateCbe(componentsM1);
      const mga = calculateMga(componentsM1);
      const mev = calculateMev(componentsM1);

      expect(cbe).toBe(2.40);
      expect(mga).toBeCloseTo(0.24, 4);
      expect(mev).toBeCloseTo(2.64, 4);
    });

    it("handles diverse contingency fractions per component", () => {
      const variedComponents: MassComponentInput[] = [
        { id: "C1", name: "COTS Part", nominalMassKg: kg(1.00), contingencyFraction: 0.05 },
        { id: "C2", name: "New Design", nominalMassKg: kg(2.00), contingencyFraction: 0.20 },
      ];

      expect(calculateCbe(variedComponents)).toBe(3.00);
      // MGA = 1.00*0.05 + 2.00*0.20 = 0.05 + 0.40 = 0.45
      expect(calculateMga(variedComponents)).toBeCloseTo(0.45, 4);
      expect(calculateMev(variedComponents)).toBeCloseTo(3.45, 4);
    });

    it("throws ValidationError for empty or non-array component input", () => {
      expect(() => calculateCbe([])).toThrow(ValidationError);
      expect(() => calculateMga([])).toThrow(ValidationError);
      expect(() => calculateMev([])).toThrow(ValidationError);
      // @ts-expect-error Testing invalid runtime input
      expect(() => calculateCbe(null)).toThrow(ValidationError);
    });
  });

  describe("Runtime Input Validation & Exception Handling", () => {
    it("rejects null, undefined, or non-object budget inputs", () => {
      // @ts-expect-error Testing null input
      expect(() => calculateMassBudget(null)).toThrow(ValidationError);
      // @ts-expect-error Testing undefined input
      expect(() => calculateMassBudget(undefined)).toThrow(ValidationError);
      // @ts-expect-error Testing primitive input
      expect(() => calculateMassBudget("invalid")).toThrow(ValidationError);
    });

    it("rejects invalid form factors", () => {
      expect(() =>
        calculateMassBudget({
          components: componentsM1,
          propellantMassKg: kg(0.0),
          dryMassAllocationKg: kg(3.0),
          dispenserProfile: DISPENSER_PROFILES.PPOD_MK3_3U,
          cdsStandardProfile: CDS_STANDARDS.CDS_REV_14_1,
          // @ts-expect-error Testing invalid form factor
          formFactor: "4U",
        })
      ).toThrow(ValidationError);
    });

    it("rejects negative propellant or non-positive dry mass allocation", () => {
      expect(() =>
        calculateMassBudget({
          components: componentsM1,
          propellantMassKg: kg(-0.5),
          dryMassAllocationKg: kg(3.0),
          dispenserProfile: DISPENSER_PROFILES.PPOD_MK3_3U,
          cdsStandardProfile: CDS_STANDARDS.CDS_REV_14_1,
          formFactor: "3U",
        })
      ).toThrow(ValidationError);

      expect(() =>
        calculateMassBudget({
          components: componentsM1,
          propellantMassKg: kg(0.0),
          dryMassAllocationKg: kg(0.0),
          dispenserProfile: DISPENSER_PROFILES.PPOD_MK3_3U,
          cdsStandardProfile: CDS_STANDARDS.CDS_REV_14_1,
          formFactor: "3U",
        })
      ).toThrow(ValidationError);
    });

    it("rejects malformed components in list", () => {
      expect(() =>
        calculateMassBudget({
          components: [
            { id: "", name: "Part", nominalMassKg: kg(1.0), contingencyFraction: 0.1 },
          ],
          propellantMassKg: kg(0.0),
          dryMassAllocationKg: kg(3.0),
          dispenserProfile: DISPENSER_PROFILES.PPOD_MK3_3U,
          cdsStandardProfile: CDS_STANDARDS.CDS_REV_14_1,
          formFactor: "3U",
        })
      ).toThrow(ValidationError);

      expect(() =>
        calculateMassBudget({
          components: [
            { id: "P1", name: "Part", nominalMassKg: kg(0.0), contingencyFraction: 0.1 },
          ],
          propellantMassKg: kg(0.0),
          dryMassAllocationKg: kg(3.0),
          dispenserProfile: DISPENSER_PROFILES.PPOD_MK3_3U,
          cdsStandardProfile: CDS_STANDARDS.CDS_REV_14_1,
          formFactor: "3U",
        })
      ).toThrow(ValidationError);

      expect(() =>
        calculateMassBudget({
          components: [
            { id: "P1", name: "Part", nominalMassKg: kg(1.0), contingencyFraction: -0.05 },
          ],
          propellantMassKg: kg(0.0),
          dryMassAllocationKg: kg(3.0),
          dispenserProfile: DISPENSER_PROFILES.PPOD_MK3_3U,
          cdsStandardProfile: CDS_STANDARDS.CDS_REV_14_1,
          formFactor: "3U",
        })
      ).toThrow(ValidationError);
    });

    it("rejects missing or malformed dispenser or CDS profiles", () => {
      expect(() =>
        calculateMassBudget({
          components: componentsM1,
          propellantMassKg: kg(0.0),
          dryMassAllocationKg: kg(3.0),
          // @ts-expect-error Testing missing dispenserProfile
          dispenserProfile: null,
          cdsStandardProfile: CDS_STANDARDS.CDS_REV_14_1,
          formFactor: "3U",
        })
      ).toThrow(ValidationError);

      expect(() =>
        calculateMassBudget({
          components: componentsM1,
          propellantMassKg: kg(0.0),
          dryMassAllocationKg: kg(3.0),
          dispenserProfile: DISPENSER_PROFILES.PPOD_MK3_3U,
          // @ts-expect-error Testing missing cdsStandardProfile
          cdsStandardProfile: null,
          formFactor: "3U",
        })
      ).toThrow(ValidationError);
    });
  });

  describe("Runtime Immutability Enforcement", () => {
    it("returns deeply frozen MassBudgetResult objects", () => {
      const result = calculateMassBudget({
        components: componentsM1,
        propellantMassKg: kg(0.30),
        dryMassAllocationKg: kg(3.30),
        dispenserProfile: DISPENSER_PROFILES.PPOD_MK3_3U,
        cdsStandardProfile: CDS_STANDARDS.CDS_REV_13,
        formFactor: "3U",
      });

      expect(Object.isFrozen(result)).toBeTrue();

      expect(() => {
        (result as { totalWetMassKg: number }).totalWetMassKg = 999;
      }).toThrow();

      expect(() => {
        (result as { meetsDispenserLimit: boolean }).meetsDispenserLimit = false;
      }).toThrow();
    });

    it("verifies DEFAULT_CML_DRY_MARGIN_THRESHOLD_PERCENT constant value", () => {
      expect(DEFAULT_CML_DRY_MARGIN_THRESHOLD_PERCENT).toBe(35.0);
    });
  });
});
