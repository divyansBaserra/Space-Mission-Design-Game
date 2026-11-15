import { describe, expect, it } from "bun:test";
import {
  DISPENSER_PROFILES,
  SUPPORTED_DISPENSER_IDS,
  getDispenserProfile,
  getDispenserLimit,
  isLspPropulsionProhibited,
  createCustomDispenserProfile,
} from "../../../src/engine/standards/dispenserProfiles";
import { CDS_STANDARDS } from "../../../src/engine/standards/cdsStandards";
import { ValidationError, kg } from "../../../src/engine/units";

describe("src/engine/standards/dispenserProfiles.ts", () => {
  describe("P-POD Mk III Profile Verification & LSP Policy Separation", () => {
    const ppod = DISPENSER_PROFILES.PPOD_MK3_3U;

    it("has institutional metadata and VERIFIED status", () => {
      expect(ppod.id).toBe("PPOD_MK3_3U");
      expect(ppod.status).toBe("VERIFIED");
      expect(ppod.name).toContain("P-POD");
      expect(ppod.provider).toBe("Cal Poly / NASA LSP");
      expect(ppod.sourceIcd).toContain("Cal Poly P-POD Mk. III User Guide Rev E");
      expect(ppod.sourceIcd).toContain("NASA CubeSat 101 App. C");
      expect(ppod.formFactor).toBe("3U");
    });

    it("enforces exact canister rated payload mass limit of 4.00 kg", () => {
      expect(ppod.ratedPayloadMassLimitKg).toBe(4.00);
      expect(getDispenserLimit("PPOD_MK3_3U")).toBe(4.00);
    });

    it("evaluates LSP/CSLI propulsion prohibition policy separately from canister mechanics", () => {
      // Governed by NASA LSP-REQ-317.01 Rev B §6.2.5 for CSLI missions
      expect(ppod.prohibitsPropulsionUnderLspPolicy).toBeTrue();
      expect(isLspPropulsionProhibited(ppod)).toBeTrue();
      expect(ppod.notes).toContain("LSP-REQ-317.01 Rev B §6.2.5");
      expect(ppod.notes).toContain("prohibits propulsion systems");
    });
  });

  describe("Commercial & User-Defined Dispenser Profiles", () => {
    const exopod = DISPENSER_PROFILES.EXOPOD_3U_HIGH_MASS;
    const custom = DISPENSER_PROFILES.CUSTOM_OVERRIDE;

    it("models EXOpod 3U high-mass canister with UNVERIFIED_COMMERCIAL_ASSUMPTION status", () => {
      expect(exopod.id).toBe("EXOPOD_3U_HIGH_MASS");
      expect(exopod.status).toBe("UNVERIFIED_COMMERCIAL_ASSUMPTION");
      expect(exopod.ratedPayloadMassLimitKg).toBe(6.00);
      expect(exopod.formFactor).toBe("3U");
      expect(exopod.provider).toBe("Exolaunch");
      expect(exopod.prohibitsPropulsionUnderLspPolicy).toBeFalse();
      expect(isLspPropulsionProhibited(exopod)).toBeFalse();
    });

    it("models default custom dispenser override with USER_DEFINED status", () => {
      expect(custom.id).toBe("CUSTOM_OVERRIDE");
      expect(custom.status).toBe("USER_DEFINED");
      expect(custom.ratedPayloadMassLimitKg).toBe(5.00);
      expect(custom.formFactor).toBe("3U");
      expect(custom.provider).toBe("Mission-Specific ICD");
      expect(custom.prohibitsPropulsionUnderLspPolicy).toBeFalse();
      expect(isLspPropulsionProhibited(custom)).toBeFalse();
    });
  });

  describe("Query Utilities & Runtime Input Validation", () => {
    it("retrieves dispenser profile by valid ID", () => {
      const profile = getDispenserProfile("PPOD_MK3_3U");
      expect(profile.id).toBe("PPOD_MK3_3U");
      expect(profile.ratedPayloadMassLimitKg).toBe(4.00);
    });

    it("trims non-empty string IDs before registry lookup (Fix 4)", () => {
      const trimmedProfile = getDispenserProfile("  PPOD_MK3_3U  ");
      expect(trimmedProfile.id).toBe("PPOD_MK3_3U");
      expect(trimmedProfile.ratedPayloadMassLimitKg).toBe(4.00);
    });

    it("lists all supported dispenser profile IDs", () => {
      expect(SUPPORTED_DISPENSER_IDS).toContain("PPOD_MK3_3U");
      expect(SUPPORTED_DISPENSER_IDS).toContain("CUSTOM_OVERRIDE");
      expect(SUPPORTED_DISPENSER_IDS).toContain("EXOPOD_3U_HIGH_MASS");
      expect(SUPPORTED_DISPENSER_IDS.length).toBe(3);
    });

    it("throws ValidationError for unknown dispenser profile ID", () => {
      expect(() => getDispenserProfile("UNKNOWN_DISPENSER")).toThrow(ValidationError);
      expect(() => getDispenserProfile("INVALID_CANISTER")).toThrow(ValidationError);
    });

    it("throws ValidationError for empty or whitespace-only profile ID", () => {
      expect(() => getDispenserProfile("")).toThrow(ValidationError);
      expect(() => getDispenserProfile("   ")).toThrow(ValidationError);
    });

    it("throws ValidationError for non-string profile ID", () => {
      // @ts-expect-error Testing runtime invalid input
      expect(() => getDispenserProfile(null)).toThrow(ValidationError);
      // @ts-expect-error Testing runtime invalid input
      expect(() => getDispenserProfile(undefined)).toThrow(ValidationError);
      // @ts-expect-error Testing runtime invalid input
      expect(() => getDispenserProfile(123)).toThrow(ValidationError);
    });

    it("throws ValidationError when checking propulsion on null/undefined profile", () => {
      // @ts-expect-error Testing runtime invalid input
      expect(() => isLspPropulsionProhibited(null)).toThrow(ValidationError);
      // @ts-expect-error Testing runtime invalid input
      expect(() => isLspPropulsionProhibited(undefined)).toThrow(ValidationError);
    });
  });

  describe("Custom Dispenser Profile Factory (createCustomDispenserProfile)", () => {
    it("rejects null and undefined input objects before property access (Fix 3)", () => {
      // @ts-expect-error Testing null input
      expect(() => createCustomDispenserProfile(null)).toThrow(ValidationError);
      // @ts-expect-error Testing undefined input
      expect(() => createCustomDispenserProfile(undefined)).toThrow(ValidationError);
      // @ts-expect-error Testing primitive input
      expect(() => createCustomDispenserProfile("not an object")).toThrow(ValidationError);
    });

    it("creates a valid, frozen USER_DEFINED dispenser profile", () => {
      const customProfile = createCustomDispenserProfile({
        id: "TEST_6U_POD",
        name: "Test 6U Deployer",
        provider: "Test Launch Services",
        sourceIcd: "TLS-ICD-001 Rev 1",
        formFactor: "6U",
        ratedPayloadMassLimitKg: kg(14.0),
        notes: "Test 6U deployer configuration",
        prohibitsPropulsionUnderLspPolicy: true,
      });

      expect(customProfile.id).toBe("TEST_6U_POD");
      expect(customProfile.name).toBe("Test 6U Deployer");
      expect(customProfile.provider).toBe("Test Launch Services");
      expect(customProfile.sourceIcd).toBe("TLS-ICD-001 Rev 1");
      expect(customProfile.formFactor).toBe("6U");
      expect(customProfile.ratedPayloadMassLimitKg).toBe(14.0);
      expect(customProfile.status).toBe("USER_DEFINED");
      expect(customProfile.prohibitsPropulsionUnderLspPolicy).toBeTrue();
      expect(Object.isFrozen(customProfile)).toBeTrue();
    });

    it("trims whitespace from string fields", () => {
      const profile = createCustomDispenserProfile({
        id: "  TRIMMED_ID  ",
        name: "  Trimmed Name  ",
        provider: "  Trimmed Provider  ",
        sourceIcd: "  Trimmed ICD  ",
        formFactor: "12U",
        ratedPayloadMassLimitKg: kg(25.0),
      });

      expect(profile.id).toBe("TRIMMED_ID");
      expect(profile.name).toBe("Trimmed Name");
      expect(profile.provider).toBe("Trimmed Provider");
      expect(profile.sourceIcd).toBe("Trimmed ICD");
      expect(profile.prohibitsPropulsionUnderLspPolicy).toBeFalse();
    });

    it("validates required fields and rejects empty strings", () => {
      expect(() =>
        createCustomDispenserProfile({
          id: "",
          name: "Name",
          provider: "Provider",
          sourceIcd: "ICD",
          formFactor: "3U",
          ratedPayloadMassLimitKg: kg(4.0),
        })
      ).toThrow(ValidationError);

      expect(() =>
        createCustomDispenserProfile({
          id: "ID",
          name: "  ",
          provider: "Provider",
          sourceIcd: "ICD",
          formFactor: "3U",
          ratedPayloadMassLimitKg: kg(4.0),
        })
      ).toThrow(ValidationError);

      expect(() =>
        createCustomDispenserProfile({
          id: "ID",
          name: "Name",
          provider: "",
          sourceIcd: "ICD",
          formFactor: "3U",
          ratedPayloadMassLimitKg: kg(4.0),
        })
      ).toThrow(ValidationError);

      expect(() =>
        createCustomDispenserProfile({
          id: "ID",
          name: "Name",
          provider: "Provider",
          sourceIcd: "",
          formFactor: "3U",
          ratedPayloadMassLimitKg: kg(4.0),
        })
      ).toThrow(ValidationError);
    });

    it("validates form factor and rejects non-standardized form factors", () => {
      expect(() =>
        createCustomDispenserProfile({
          id: "ID",
          name: "Name",
          provider: "Provider",
          sourceIcd: "ICD",
          // @ts-expect-error Testing invalid runtime form factor
          formFactor: "4U",
          ratedPayloadMassLimitKg: kg(4.0),
        })
      ).toThrow(ValidationError);
    });

    it("validates mass limit and rejects non-positive or non-finite values", () => {
      expect(() =>
        createCustomDispenserProfile({
          id: "ID",
          name: "Name",
          provider: "Provider",
          sourceIcd: "ICD",
          formFactor: "3U",
          ratedPayloadMassLimitKg: kg(0),
        })
      ).toThrow(ValidationError);

      expect(() =>
        createCustomDispenserProfile({
          id: "ID",
          name: "Name",
          provider: "Provider",
          sourceIcd: "ICD",
          formFactor: "3U",
          ratedPayloadMassLimitKg: kg(-2.5),
        })
      ).toThrow(ValidationError);

      expect(() =>
        createCustomDispenserProfile({
          id: "ID",
          name: "Name",
          provider: "Provider",
          sourceIcd: "ICD",
          formFactor: "3U",
          ratedPayloadMassLimitKg: kg(NaN),
        })
      ).toThrow(ValidationError);
    });
  });

  describe("Architectural Separation: Canister Structural Limits vs CDS Envelope Limits", () => {
    it("demonstrates independent evaluation of CDS envelope and canister structural limit", () => {
      // Scenario: A 3U satellite with 5.00 kg wet mass.
      const satelliteMass = 5.00;
      const cdsRev14_1_MaxMass = CDS_STANDARDS.CDS_REV_14_1.maxMassByFormFactorKg["3U"]!;
      const ppodMaxMass = DISPENSER_PROFILES.PPOD_MK3_3U.ratedPayloadMassLimitKg;
      const exopodMaxMass = DISPENSER_PROFILES.EXOPOD_3U_HIGH_MASS.ratedPayloadMassLimitKg;

      // 1. CDS Rev 14.1 mechanical envelope allows up to 6.00 kg for 3U (§2.2.10 Table 1)
      expect(cdsRev14_1_MaxMass).toBe(6.00);
      const compliesWithCdsEnvelope = satelliteMass <= cdsRev14_1_MaxMass;
      expect(compliesWithCdsEnvelope).toBeTrue();

      // 2. P-POD Mk III canister rated payload limit is 4.00 kg (Cal Poly P-POD Mk III User Guide Rev E)
      expect(ppodMaxMass).toBe(4.00);
      const compliesWithPpodCanister = satelliteMass <= ppodMaxMass;
      // 5.00 kg exceeds P-POD Mk III 4.00 kg canister rating!
      expect(compliesWithPpodCanister).toBeFalse();

      // 3. EXOpod 3U high-mass canister rating is 6.00 kg
      expect(exopodMaxMass).toBe(6.00);
      const compliesWithExopodCanister = satelliteMass <= exopodMaxMass;
      // 5.00 kg complies with EXOpod canister rating
      expect(compliesWithExopodCanister).toBeTrue();

      // Crucial architectural proof:
      // A design can be compliant with CDS Rev 14.1 envelope while violating P-POD canister structural limit.
      expect(compliesWithCdsEnvelope && !compliesWithPpodCanister).toBeTrue();
    });
  });

  describe("Runtime Immutability Enforcement", () => {
    it("prevents reassigning or adding properties to DISPENSER_PROFILES", () => {
      expect(() => {
        // @ts-expect-error Testing runtime mutation against readonly property
        DISPENSER_PROFILES.PPOD_MK3_3U = null;
      }).toThrow();

      expect(() => {
        (DISPENSER_PROFILES as Record<string, unknown>).NEW_DISPENSER = "malicious";
      }).toThrow();
    });

    it("prevents mutating properties of frozen dispenser profiles", () => {
      expect(() => {
        (DISPENSER_PROFILES.PPOD_MK3_3U as { name: string }).name = "Mutated Name";
      }).toThrow();

      expect(() => {
        (DISPENSER_PROFILES.PPOD_MK3_3U as { ratedPayloadMassLimitKg: number }).ratedPayloadMassLimitKg = 99;
      }).toThrow();

      expect(() => {
        (DISPENSER_PROFILES.EXOPOD_3U_HIGH_MASS as { status: string }).status = "VERIFIED";
      }).toThrow();
    });

    it("prevents mutating SUPPORTED_DISPENSER_IDS array", () => {
      expect(() => {
        (SUPPORTED_DISPENSER_IDS as unknown as string[]).push("MALICIOUS_ID");
      }).toThrow();
    });
  });
});
