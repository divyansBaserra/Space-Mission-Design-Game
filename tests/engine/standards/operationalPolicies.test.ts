import { describe, expect, it } from "bun:test";
import {
  OPERATIONAL_POLICIES,
  SUPPORTED_OPERATIONAL_POLICY_IDS,
  CDS_REV_14_1_MIN_DEPLOYABLE_INHIBITS,
  CDS_REV_14_1_MIN_RF_INHIBITS,
  getOperationalPolicy,
  getRequiredInhibitMinutes,
  isPolicyEnforced,
  evaluatePolicyTimer,
  createCustomOperationalPolicy,
} from "../../../src/engine/standards/operationalPolicies";
import { ValidationError, minutes } from "../../../src/engine/units";

describe("src/engine/standards/operationalPolicies.ts", () => {
  describe("Cal Poly CDS Rev 13 Operational Policies", () => {
    const deployRev13 = OPERATIONAL_POLICIES.CDS_REV_13_DEPLOY_DELAY;
    const rfRev13 = OPERATIONAL_POLICIES.CDS_REV_13_RF_QUIET;

    it("verifies 30-minute deployable delay policy under CDS Rev 13 §3.4.4", () => {
      expect(deployRev13.id).toBe("CDS_REV_13_DEPLOY_DELAY");
      expect(deployRev13.type).toBe("DEPLOYABLE_RELEASE");
      expect(deployRev13.requiredInhibitMinutes).toBe(30);
      expect(deployRev13.mandatingStandard).toContain("Rev 13");
      expect(deployRev13.section).toBe("§3.4.4");
      expect(deployRev13.isEnforced).toBeTrue();
      expect(deployRev13.status).toBe("VERIFIED");
    });

    it("verifies 45-minute RF quiet period policy under CDS Rev 13 §3.4.5", () => {
      expect(rfRev13.id).toBe("CDS_REV_13_RF_QUIET");
      expect(rfRev13.type).toBe("RF_TRANSMISSION");
      expect(rfRev13.requiredInhibitMinutes).toBe(45);
      expect(rfRev13.mandatingStandard).toContain("Rev 13");
      expect(rfRev13.section).toBe("§3.4.5");
      expect(rfRev13.isEnforced).toBeTrue();
      expect(rfRev13.status).toBe("VERIFIED");
    });
  });

  describe("Cal Poly CDS Rev 14.1 Operational Policies", () => {
    const deployRev14 = OPERATIONAL_POLICIES.CDS_REV_14_1_DEPLOY_DELAY;
    const rfRev14 = OPERATIONAL_POLICIES.CDS_REV_14_1_RF_QUIET;

    it("verifies 30-minute deployable delay policy under CDS Rev 14.1 §2.4.4", () => {
      expect(deployRev14.id).toBe("CDS_REV_14_1_DEPLOY_DELAY");
      expect(deployRev14.type).toBe("DEPLOYABLE_RELEASE");
      expect(deployRev14.requiredInhibitMinutes).toBe(30);
      expect(deployRev14.mandatingStandard).toContain("Rev 14.1");
      expect(deployRev14.section).toBe("§2.4.4");
      expect(deployRev14.isEnforced).toBeTrue();
      expect(deployRev14.status).toBe("VERIFIED");
    });

    it("verifies 45-minute RF quiet period policy under CDS Rev 14.1 §2.4.5", () => {
      expect(rfRev14.id).toBe("CDS_REV_14_1_RF_QUIET");
      expect(rfRev14.type).toBe("RF_TRANSMISSION");
      expect(rfRev14.requiredInhibitMinutes).toBe(45);
      expect(rfRev14.mandatingStandard).toContain("Rev 14.1");
      expect(rfRev14.section).toBe("§2.4.5");
      expect(rfRev14.isEnforced).toBeTrue();
      expect(rfRev14.status).toBe("VERIFIED");
    });
  });

  describe("Physical Hardware Inhibit Requirements vs Software Timers", () => {
    it("defines CDS Rev 14.1 baseline of at least 3 independent physical electrical inhibits", () => {
      // CDS Rev 14.1 §2.3.8 / LSP-REQ-317.01 Rev B §6.2.11
      expect(CDS_REV_14_1_MIN_DEPLOYABLE_INHIBITS).toBe(3);
      // CDS Rev 14.1 §2.3.7 / LSP-REQ-317.01 Rev B §§6.2.10–6.2.11
      expect(CDS_REV_14_1_MIN_RF_INHIBITS).toBe(3);
    });

    it("confirms physical inhibit requirements are independent from timer countdowns", () => {
      // A timer is an operational sequencing parameter, never a substitute for an independent physical inhibit
      expect(CDS_REV_14_1_MIN_DEPLOYABLE_INHIBITS >= 3).toBeTrue();
      expect(CDS_REV_14_1_MIN_RF_INHIBITS >= 3).toBeTrue();
    });
  });

  describe("Query Utilities & Validation", () => {
    it("retrieves policies by ID", () => {
      const policy = getOperationalPolicy("CDS_REV_14_1_DEPLOY_DELAY");
      expect(policy.id).toBe("CDS_REV_14_1_DEPLOY_DELAY");
      expect(policy.requiredInhibitMinutes).toBe(30);
    });

    it("trims whitespace from policy IDs", () => {
      const policy = getOperationalPolicy("  CDS_REV_14_1_RF_QUIET  ");
      expect(policy.id).toBe("CDS_REV_14_1_RF_QUIET");
      expect(policy.requiredInhibitMinutes).toBe(45);
    });

    it("lists all supported operational policy IDs", () => {
      expect(SUPPORTED_OPERATIONAL_POLICY_IDS).toContain("CDS_REV_13_DEPLOY_DELAY");
      expect(SUPPORTED_OPERATIONAL_POLICY_IDS).toContain("CDS_REV_13_RF_QUIET");
      expect(SUPPORTED_OPERATIONAL_POLICY_IDS).toContain("CDS_REV_14_1_DEPLOY_DELAY");
      expect(SUPPORTED_OPERATIONAL_POLICY_IDS).toContain("CDS_REV_14_1_RF_QUIET");
      expect(SUPPORTED_OPERATIONAL_POLICY_IDS.length).toBe(4);
    });

    it("retrieves required inhibit minutes and enforcement status", () => {
      expect(getRequiredInhibitMinutes("CDS_REV_14_1_DEPLOY_DELAY")).toBe(30);
      expect(getRequiredInhibitMinutes("CDS_REV_14_1_RF_QUIET")).toBe(45);
      expect(isPolicyEnforced("CDS_REV_14_1_DEPLOY_DELAY")).toBeTrue();
      expect(isPolicyEnforced("CDS_REV_14_1_RF_QUIET")).toBeTrue();
    });

    it("throws ValidationError for unknown, empty, or non-string policy IDs", () => {
      expect(() => getOperationalPolicy("UNKNOWN_POLICY")).toThrow(ValidationError);
      expect(() => getOperationalPolicy("")).toThrow(ValidationError);
      expect(() => getOperationalPolicy("   ")).toThrow(ValidationError);
      // @ts-expect-error Testing invalid runtime input
      expect(() => getOperationalPolicy(null)).toThrow(ValidationError);
      // @ts-expect-error Testing invalid runtime input
      expect(() => getOperationalPolicy(undefined)).toThrow(ValidationError);
      // @ts-expect-error Testing invalid runtime input
      expect(() => getOperationalPolicy(123)).toThrow(ValidationError);
    });
  });

  describe("Policy Countdown Timer Gating & State Reset (CDS Rev 14.1 §2.3.2.4)", () => {
    it("prevents timer from running prior to physical dispenser separation", () => {
      // In dispenser: separationOccurred = false
      const result = evaluatePolicyTimer({
        policyId: "CDS_REV_14_1_DEPLOY_DELAY",
        separationOccurred: false,
        hardwareCurrentlyInhibited: true,
        timerElapsedMinutes: minutes(20.0),
      });

      expect(result.timerElapsedMinutes).toBe(0.0);
      expect(result.timerExpired).toBeFalse();
      expect(result.inhibitRemainingMinutes).toBe(30.0);
    });

    it("evaluates in-progress countdown after separation (normal case)", () => {
      // Post-separation: 10 minutes elapsed
      const deployResult = evaluatePolicyTimer({
        policyId: "CDS_REV_14_1_DEPLOY_DELAY",
        separationOccurred: true,
        hardwareCurrentlyInhibited: false,
        timerElapsedMinutes: minutes(10.0),
      });

      expect(deployResult.timerElapsedMinutes).toBe(10.0);
      expect(deployResult.timerExpired).toBeFalse();
      expect(deployResult.inhibitRemainingMinutes).toBe(20.0);

      // RF Quiet: 10 minutes elapsed of 45 required
      const rfResult = evaluatePolicyTimer({
        policyId: "CDS_REV_14_1_RF_QUIET",
        separationOccurred: true,
        hardwareCurrentlyInhibited: false,
        timerElapsedMinutes: minutes(10.0),
      });

      expect(rfResult.timerElapsedMinutes).toBe(10.0);
      expect(rfResult.timerExpired).toBeFalse();
      expect(rfResult.inhibitRemainingMinutes).toBe(35.0);
    });

    it("evaluates boundary condition just prior to expiration (29.9 min and 44.9 min)", () => {
      const deployResult = evaluatePolicyTimer({
        policyId: "CDS_REV_14_1_DEPLOY_DELAY",
        separationOccurred: true,
        hardwareCurrentlyInhibited: false,
        timerElapsedMinutes: minutes(29.9),
      });

      expect(deployResult.timerExpired).toBeFalse();
      expect(deployResult.inhibitRemainingMinutes).toBeCloseTo(0.1, 5);

      const rfResult = evaluatePolicyTimer({
        policyId: "CDS_REV_14_1_RF_QUIET",
        separationOccurred: true,
        hardwareCurrentlyInhibited: false,
        timerElapsedMinutes: minutes(44.9),
      });

      expect(rfResult.timerExpired).toBeFalse();
      expect(rfResult.inhibitRemainingMinutes).toBeCloseTo(0.1, 5);
    });

    it("evaluates exact boundary expiration and beyond", () => {
      // Exact boundary: 30.0 min
      const deployAtLimit = evaluatePolicyTimer({
        policyId: "CDS_REV_14_1_DEPLOY_DELAY",
        separationOccurred: true,
        hardwareCurrentlyInhibited: false,
        timerElapsedMinutes: minutes(30.0),
      });
      expect(deployAtLimit.timerExpired).toBeTrue();
      expect(deployAtLimit.inhibitRemainingMinutes).toBe(0.0);

      // Beyond limit: 35.0 min
      const deployBeyond = evaluatePolicyTimer({
        policyId: "CDS_REV_14_1_DEPLOY_DELAY",
        separationOccurred: true,
        hardwareCurrentlyInhibited: false,
        timerElapsedMinutes: minutes(35.0),
      });
      expect(deployBeyond.timerExpired).toBeTrue();
      expect(deployBeyond.inhibitRemainingMinutes).toBe(0.0);

      // RF exact boundary: 45.0 min
      const rfAtLimit = evaluatePolicyTimer({
        policyId: "CDS_REV_14_1_RF_QUIET",
        separationOccurred: true,
        hardwareCurrentlyInhibited: false,
        timerElapsedMinutes: minutes(45.0),
      });
      expect(rfAtLimit.timerExpired).toBeTrue();
      expect(rfAtLimit.inhibitRemainingMinutes).toBe(0.0);

      // RF beyond limit: 60.0 min
      const rfBeyond = evaluatePolicyTimer({
        policyId: "CDS_REV_14_1_RF_QUIET",
        separationOccurred: true,
        hardwareCurrentlyInhibited: false,
        timerElapsedMinutes: minutes(60.0),
      });
      expect(rfBeyond.timerExpired).toBeTrue();
      expect(rfBeyond.inhibitRemainingMinutes).toBe(0.0);
    });

    it("executes CDS Rev 14.1 §2.3.2.4 reset when deployment switch toggles back to depressed", () => {
      // Scenario: Satellite was deployed and timer was at 25.0 minutes.
      // Switch bounces or is re-depressed (e.g., during integration handling):
      // Spacecraft must immediately reset to pre-launch state per CDS Rev 14.1 §2.3.2.4.
      const resetResult = evaluatePolicyTimer({
        policyId: "CDS_REV_14_1_DEPLOY_DELAY",
        separationOccurred: true,
        hardwareCurrentlyInhibited: true, // switch toggled back!
        timerElapsedMinutes: minutes(25.0),
      });

      expect(resetResult.timerElapsedMinutes).toBe(0.0);
      expect(resetResult.timerExpired).toBeFalse();
      expect(resetResult.inhibitRemainingMinutes).toBe(30.0);
    });

    it("validates evaluatePolicyTimer input rejecting null, undefined, and negative elapsed time", () => {
      // @ts-expect-error Testing invalid runtime input
      expect(() => evaluatePolicyTimer(null)).toThrow(ValidationError);
      // @ts-expect-error Testing invalid runtime input
      expect(() => evaluatePolicyTimer(undefined)).toThrow(ValidationError);
      // @ts-expect-error Testing invalid runtime input
      expect(() => evaluatePolicyTimer("string")).toThrow(ValidationError);

      expect(() =>
        evaluatePolicyTimer({
          policyId: "CDS_REV_14_1_DEPLOY_DELAY",
          separationOccurred: true,
          hardwareCurrentlyInhibited: false,
          timerElapsedMinutes: minutes(-5.0),
        })
      ).toThrow(ValidationError);
    });
  });

  describe("Custom Operational Policy Factory (createCustomOperationalPolicy)", () => {
    it("creates a valid, frozen user-defined policy with GAME_ASSUMPTION status", () => {
      const custom = createCustomOperationalPolicy({
        id: "EXPEDITION_DEPLOY_DELAY",
        name: "Expedition Mission Custom Deploy Delay",
        type: "DEPLOYABLE_RELEASE",
        requiredInhibitMinutes: minutes(15),
        mandatingStandard: "Custom Mission Specification",
        section: "§4.1",
        isEnforced: true,
        notes: "Custom scenario deploy delay",
      });

      expect(custom.id).toBe("EXPEDITION_DEPLOY_DELAY");
      expect(custom.type).toBe("DEPLOYABLE_RELEASE");
      expect(custom.requiredInhibitMinutes).toBe(15);
      expect(custom.status).toBe("GAME_ASSUMPTION");
      expect(custom.isEnforced).toBeTrue();
      expect(Object.isFrozen(custom)).toBeTrue();
    });

    it("trims whitespace from string fields", () => {
      const custom = createCustomOperationalPolicy({
        id: "  TRIMMED_ID  ",
        name: "  Trimmed Name  ",
        type: "RF_TRANSMISSION",
        requiredInhibitMinutes: minutes(20),
        mandatingStandard: "  Custom Standard  ",
        section: "  §1.2  ",
      });

      expect(custom.id).toBe("TRIMMED_ID");
      expect(custom.name).toBe("Trimmed Name");
      expect(custom.mandatingStandard).toBe("Custom Standard");
      expect(custom.section).toBe("§1.2");
      expect(custom.isEnforced).toBeTrue();
    });

    it("rejects null, undefined, and non-object inputs", () => {
      // @ts-expect-error Testing null input
      expect(() => createCustomOperationalPolicy(null)).toThrow(ValidationError);
      // @ts-expect-error Testing undefined input
      expect(() => createCustomOperationalPolicy(undefined)).toThrow(ValidationError);
      // @ts-expect-error Testing primitive input
      expect(() => createCustomOperationalPolicy("not an object")).toThrow(ValidationError);
    });

    it("validates required fields rejecting empty strings", () => {
      expect(() =>
        createCustomOperationalPolicy({
          id: "",
          name: "Name",
          type: "DEPLOYABLE_RELEASE",
          requiredInhibitMinutes: minutes(10),
          mandatingStandard: "Standard",
          section: "§1",
        })
      ).toThrow(ValidationError);

      expect(() =>
        createCustomOperationalPolicy({
          id: "ID",
          name: "   ",
          type: "DEPLOYABLE_RELEASE",
          requiredInhibitMinutes: minutes(10),
          mandatingStandard: "Standard",
          section: "§1",
        })
      ).toThrow(ValidationError);

      expect(() =>
        createCustomOperationalPolicy({
          id: "ID",
          name: "Name",
          type: "DEPLOYABLE_RELEASE",
          requiredInhibitMinutes: minutes(10),
          mandatingStandard: "",
          section: "§1",
        })
      ).toThrow(ValidationError);

      expect(() =>
        createCustomOperationalPolicy({
          id: "ID",
          name: "Name",
          type: "DEPLOYABLE_RELEASE",
          requiredInhibitMinutes: minutes(10),
          mandatingStandard: "Standard",
          section: "  ",
        })
      ).toThrow(ValidationError);
    });

    it("rejects invalid policy types and negative durations", () => {
      expect(() =>
        createCustomOperationalPolicy({
          id: "ID",
          name: "Name",
          // @ts-expect-error Testing invalid runtime type
          type: "INVALID_TYPE",
          requiredInhibitMinutes: minutes(10),
          mandatingStandard: "Standard",
          section: "§1",
        })
      ).toThrow(ValidationError);

      expect(() =>
        createCustomOperationalPolicy({
          id: "ID",
          name: "Name",
          type: "DEPLOYABLE_RELEASE",
          requiredInhibitMinutes: minutes(-1),
          mandatingStandard: "Standard",
          section: "§1",
        })
      ).toThrow(ValidationError);
    });
  });

  describe("Runtime Immutability Enforcement", () => {
    it("prevents reassigning or adding properties to OPERATIONAL_POLICIES", () => {
      expect(() => {
        // @ts-expect-error Testing runtime mutation against readonly property
        OPERATIONAL_POLICIES.CDS_REV_14_1_DEPLOY_DELAY = null;
      }).toThrow();

      expect(() => {
        (OPERATIONAL_POLICIES as Record<string, unknown>).NEW_POLICY = "malicious";
      }).toThrow();
    });

    it("prevents mutating properties of frozen operational policies", () => {
      expect(() => {
        (OPERATIONAL_POLICIES.CDS_REV_14_1_DEPLOY_DELAY as { name: string }).name = "Mutated";
      }).toThrow();

      expect(() => {
        (OPERATIONAL_POLICIES.CDS_REV_14_1_RF_QUIET as { requiredInhibitMinutes: number }).requiredInhibitMinutes = 0;
      }).toThrow();
    });

    it("prevents mutating SUPPORTED_OPERATIONAL_POLICY_IDS array", () => {
      expect(() => {
        (SUPPORTED_OPERATIONAL_POLICY_IDS as unknown as string[]).push("MALICIOUS_POLICY");
      }).toThrow();
    });
  });
});
