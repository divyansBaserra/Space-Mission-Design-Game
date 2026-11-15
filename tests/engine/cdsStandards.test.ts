import { describe, expect, it } from "bun:test";
import {
  CDS_STANDARDS,
  SUPPORTED_FORM_FACTORS,
  getCdsStandard,
  getCdsMaxMass,
  isFormFactorStandardized,
  assertValidFormFactor,
  type FormFactor,
} from "../../src/engine/standards/cdsStandards";
import { ValidationError } from "../../src/engine/units";

describe("src/engine/standards/cdsStandards.ts", () => {
  describe("CDS Rev 13 Profile Verification", () => {
    const rev13 = CDS_STANDARDS.CDS_REV_13;

    it("has institutional metadata and VERIFIED status", () => {
      expect(rev13.revision).toBe("CDS_REV_13");
      expect(rev13.status).toBe("VERIFIED");
      expect(rev13.name).toContain("Rev 13");
      expect(rev13.sourceDocument).toContain("CDS Rev 13");
      expect(rev13.deployableDelayPolicyId).toBe("CDS_REV_13_DEPLOY_DELAY");
      expect(rev13.rfQuietPolicyId).toBe("CDS_REV_13_RF_QUIET");
    });

    it("enforces exact standard mass limits for 1U–3U (§3.2.10–§3.2.13)", () => {
      expect(rev13.maxMassByFormFactorKg["1U"]).toBe(1.33);
      expect(rev13.maxMassByFormFactorKg["1.5U"]).toBe(2.00);
      expect(rev13.maxMassByFormFactorKg["2U"]).toBe(2.66);
      expect(rev13.maxMassByFormFactorKg["3U"]).toBe(4.00);
    });

    it("correctly models 6U and 12U as non-standardized (null) in Rev 13", () => {
      expect(rev13.maxMassByFormFactorKg["6U"]).toBeNull();
      expect(rev13.maxMassByFormFactorKg["12U"]).toBeNull();
      expect(isFormFactorStandardized("CDS_REV_13", "6U")).toBeFalse();
      expect(isFormFactorStandardized("CDS_REV_13", "12U")).toBeFalse();
    });
  });

  describe("CDS Rev 14.1 Profile Verification", () => {
    const rev14 = CDS_STANDARDS.CDS_REV_14_1;

    it("has institutional metadata and VERIFIED status", () => {
      expect(rev14.revision).toBe("CDS_REV_14_1");
      expect(rev14.status).toBe("VERIFIED");
      expect(rev14.name).toContain("Rev 14.1");
      expect(rev14.sourceDocument).toContain("CDS Rev 14.1");
      expect(rev14.deployableDelayPolicyId).toBe("CDS_REV_14_1_DEPLOY_DELAY");
      expect(rev14.rfQuietPolicyId).toBe("CDS_REV_14_1_RF_QUIET");
    });

    it("enforces modern 2.0 kg/U baseline mass limits for 1U–12U (§2.2.10 Table 1)", () => {
      expect(rev14.maxMassByFormFactorKg["1U"]).toBe(2.00);
      expect(rev14.maxMassByFormFactorKg["1.5U"]).toBe(3.00);
      expect(rev14.maxMassByFormFactorKg["2U"]).toBe(4.00);
      expect(rev14.maxMassByFormFactorKg["3U"]).toBe(6.00);
      expect(rev14.maxMassByFormFactorKg["6U"]).toBe(12.00);
      expect(rev14.maxMassByFormFactorKg["12U"]).toBe(24.00);
    });

    it("confirms 6U and 12U are standardized under Rev 14.1", () => {
      expect(isFormFactorStandardized("CDS_REV_14_1", "6U")).toBeTrue();
      expect(isFormFactorStandardized("CDS_REV_14_1", "12U")).toBeTrue();
    });
  });

  describe("Runtime Form-Factor Validation & Query Utilities (F-B1 & F-SF1)", () => {
    it("retrieves standard profiles via getCdsStandard", () => {
      expect(getCdsStandard("CDS_REV_13").revision).toBe("CDS_REV_13");
      expect(getCdsStandard("CDS_REV_14_1").revision).toBe("CDS_REV_14_1");
    });

    it("throws ValidationError for invalid standard revision", () => {
      // @ts-expect-error Testing invalid runtime input
      expect(() => getCdsStandard("CDS_REV_99")).toThrow(ValidationError);
    });

    it("queries maximum allowable mass via getCdsMaxMass for all valid form factors", () => {
      expect(getCdsMaxMass("CDS_REV_13", "1U")).toBe(1.33);
      expect(getCdsMaxMass("CDS_REV_13", "1.5U")).toBe(2.00);
      expect(getCdsMaxMass("CDS_REV_13", "2U")).toBe(2.66);
      expect(getCdsMaxMass("CDS_REV_13", "3U")).toBe(4.00);
      expect(getCdsMaxMass("CDS_REV_13", "6U")).toBeNull();
      expect(getCdsMaxMass("CDS_REV_13", "12U")).toBeNull();

      expect(getCdsMaxMass("CDS_REV_14_1", "1U")).toBe(2.00);
      expect(getCdsMaxMass("CDS_REV_14_1", "3U")).toBe(6.00);
      expect(getCdsMaxMass("CDS_REV_14_1", "6U")).toBe(12.00);
      expect(getCdsMaxMass("CDS_REV_14_1", "12U")).toBe(24.00);
    });

    it("validates form factor in getCdsMaxMass and throws ValidationError on invalid inputs (F-SF1)", () => {
      // @ts-expect-error Testing runtime invalid inputs
      expect(() => getCdsMaxMass("CDS_REV_13", "invalid")).toThrow(ValidationError);
      // @ts-expect-error Testing runtime invalid inputs
      expect(() => getCdsMaxMass("CDS_REV_14_1", "4U")).toThrow(ValidationError);
      // @ts-expect-error Testing runtime invalid inputs
      expect(() => getCdsMaxMass("CDS_REV_13", "")).toThrow(ValidationError);
    });

    it("prevents isFormFactorStandardized from returning true on invalid form factors (F-B1)", () => {
      // @ts-expect-error Testing runtime invalid input
      expect(() => isFormFactorStandardized("CDS_REV_13", "invalid")).toThrow(ValidationError);
      // @ts-expect-error Testing runtime invalid input
      expect(() => isFormFactorStandardized("CDS_REV_14_1", "99U")).toThrow(ValidationError);
      // @ts-expect-error Testing runtime invalid input
      expect(() => isFormFactorStandardized("CDS_REV_13", "")).toThrow(ValidationError);
    });

    it("correctly evaluates valid but unsupported form factors as false in isFormFactorStandardized", () => {
      expect(isFormFactorStandardized("CDS_REV_13", "6U")).toBeFalse();
      expect(isFormFactorStandardized("CDS_REV_13", "12U")).toBeFalse();
      expect(isFormFactorStandardized("CDS_REV_14_1", "6U")).toBeTrue();
      expect(isFormFactorStandardized("CDS_REV_14_1", "12U")).toBeTrue();
    });

    it("validates form factors using assertValidFormFactor", () => {
      for (const ff of SUPPORTED_FORM_FACTORS) {
        expect(assertValidFormFactor(ff)).toBe(ff);
      }
      expect(() => assertValidFormFactor("4U")).toThrow(ValidationError);
      expect(() => assertValidFormFactor("")).toThrow(ValidationError);
      expect(() => assertValidFormFactor("custom")).toThrow(ValidationError);
    });
  });

  describe("Runtime Immutability Enforcement (F-SF2)", () => {
    it("prevents reassigning or adding properties to CDS_STANDARDS", () => {
      expect(() => {
        // @ts-expect-error Testing runtime mutation against readonly property
        CDS_STANDARDS.CDS_REV_13 = null;
      }).toThrow();

      expect(() => {
        (CDS_STANDARDS as Record<string, unknown>).NEW_REVISION = "malicious";
      }).toThrow();
    });

    it("prevents mutating CDS standard profile objects", () => {
      expect(() => {
        (CDS_STANDARDS.CDS_REV_13 as { name: string }).name = "Mutated Name";
      }).toThrow();

      expect(() => {
        (CDS_STANDARDS.CDS_REV_14_1 as { status: string }).status = "GAME_ASSUMPTION";
      }).toThrow();
    });

    it("prevents mutating nested maxMassByFormFactorKg dictionaries", () => {
      expect(() => {
        (CDS_STANDARDS.CDS_REV_13.maxMassByFormFactorKg as Record<string, unknown>)["1U"] = 999;
      }).toThrow();

      expect(() => {
        (CDS_STANDARDS.CDS_REV_14_1.maxMassByFormFactorKg as Record<string, unknown>)["6U"] = 0;
      }).toThrow();

      expect(() => {
        (getCdsStandard("CDS_REV_13").maxMassByFormFactorKg as Record<string, unknown>)["3U"] = 50;
      }).toThrow();
    });

    it("prevents mutating SUPPORTED_FORM_FACTORS array", () => {
      expect(() => {
        (SUPPORTED_FORM_FACTORS as unknown as string[]).push("4U");
      }).toThrow();
    });
  });
});
