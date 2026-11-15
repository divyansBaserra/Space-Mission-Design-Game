/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * CubeSat Design Specification (CDS) Form-Factor Standards
 *
 * Defines exterior mechanical envelope mass limits and operational policy references
 * for standardized CubeSat form factors across Cal Poly CDS revisions.
 *
 * Standards Attribution:
 * - CDS Rev 13 (2014): Cal Poly SLO CDS Rev 13 (§3.2.10–§3.2.13, §3.4.4, §3.4.5) [VERIFIED]
 * - CDS Rev 14.1 (2022): Cal Poly SLO CDS Rev 14.1 (§2.2.10 Table 1, §2.4.4, §2.4.5) [VERIFIED]
 */

import { Kilograms, kg, ValidationError } from "../units";

export type FormFactor = "1U" | "1.5U" | "2U" | "3U" | "6U" | "12U";

export type CdsStandardRevision = "CDS_REV_13" | "CDS_REV_14_1";

export type DeployableDelayPolicyId = "CDS_REV_13_DEPLOY_DELAY" | "CDS_REV_14_1_DEPLOY_DELAY";
export type RfQuietPolicyId = "CDS_REV_13_RF_QUIET" | "CDS_REV_14_1_RF_QUIET";

export interface CdsStandardProfile {
  readonly revision: CdsStandardRevision;
  readonly name: string;
  readonly sourceDocument: string;
  /**
   * Status indicating that dimensional and envelope mass parameters were transcribed directly
   * from the published Cal Poly CubeSat Design Specification.
   * NOTE: This does NOT certify flight safety, launch-provider integration approval, or
   * propulsion compliance (which is governed separately by launch vehicle ICDs and LSP-REQ-317.01).
   */
  readonly status: "VERIFIED";
  readonly maxMassByFormFactorKg: Readonly<Record<FormFactor, Kilograms | null>>;
  readonly deployableDelayPolicyId: DeployableDelayPolicyId;
  readonly rfQuietPolicyId: RfQuietPolicyId;
}

export const CDS_STANDARDS: Readonly<Record<CdsStandardRevision, CdsStandardProfile>> = Object.freeze({
  CDS_REV_13: Object.freeze({
    revision: "CDS_REV_13",
    name: "Cal Poly CubeSat Design Specification Rev 13 (2014)",
    sourceDocument: "Cal Poly SLO CDS Rev 13 (§3.2.10–§3.2.13, §3.4.4, §3.4.5)",
    status: "VERIFIED",
    maxMassByFormFactorKg: Object.freeze({
      "1U": kg(1.33),   // §3.2.10
      "1.5U": kg(2.00), // §3.2.11
      "2U": kg(2.66),   // §3.2.12
      "3U": kg(4.00),   // §3.2.13
      "6U": null,       // 6U was not standardized in CDS Rev 13
      "12U": null,      // 12U was not standardized in CDS Rev 13
    }),
    deployableDelayPolicyId: "CDS_REV_13_DEPLOY_DELAY", // §3.4.4 (30 min delay)
    rfQuietPolicyId: "CDS_REV_13_RF_QUIET",             // §3.4.5 (45 min quiet period)
  }),
  CDS_REV_14_1: Object.freeze({
    revision: "CDS_REV_14_1",
    name: "Cal Poly CubeSat Design Specification Rev 14.1 (2022)",
    sourceDocument: "Cal Poly SLO CDS Rev 14.1 (§2.2.10 Table 1, §2.4.4, §2.4.5)",
    status: "VERIFIED",
    maxMassByFormFactorKg: Object.freeze({
      "1U": kg(2.00),   // Table 1 (2.00 kg/U baseline)
      "1.5U": kg(3.00), // Table 1
      "2U": kg(4.00),   // Table 1
      "3U": kg(6.00),   // Table 1
      "6U": kg(12.00),  // Table 1
      "12U": kg(24.00), // Table 1
    }),
    deployableDelayPolicyId: "CDS_REV_14_1_DEPLOY_DELAY", // §2.4.4 (30 min delay)
    rfQuietPolicyId: "CDS_REV_14_1_RF_QUIET",             // §2.4.5 (45 min quiet period)
  }),
});

export const SUPPORTED_FORM_FACTORS: readonly FormFactor[] = Object.freeze([
  "1U",
  "1.5U",
  "2U",
  "3U",
  "6U",
  "12U",
] as const);

/**
 * Validates that an arbitrary string matches a valid FormFactor literal.
 */
export function assertValidFormFactor(val: string, paramName = "formFactor"): FormFactor {
  if (!SUPPORTED_FORM_FACTORS.includes(val as FormFactor)) {
    throw new ValidationError(
      paramName,
      `Invalid form factor "${val}". Supported form factors: ${SUPPORTED_FORM_FACTORS.join(", ")}`
    );
  }
  return val as FormFactor;
}

/**
 * Retrieves a CDS standard profile by revision key.
 * Throws ValidationError if revision is unrecognized.
 */
export function getCdsStandard(revision: CdsStandardRevision): CdsStandardProfile {
  const profile = CDS_STANDARDS[revision];
  if (!profile) {
    throw new ValidationError("revision", `Unknown CDS standard revision: ${revision}`);
  }
  return profile;
}

/**
 * Retrieves the maximum allowable mass for a given form factor under a specific CDS revision.
 * Validates the formFactor argument using assertValidFormFactor before accessing the mass map.
 * Returns null if the form factor was not standardized in the specified revision (e.g. 6U/12U in Rev 13).
 */
export function getCdsMaxMass(revision: CdsStandardRevision, formFactor: FormFactor): Kilograms | null {
  const standard = getCdsStandard(revision);
  const validatedFormFactor = assertValidFormFactor(formFactor);
  return standard.maxMassByFormFactorKg[validatedFormFactor];
}

/**
 * Checks whether a form factor is standardized under the specified revision.
 * Validates the formFactor argument via getCdsMaxMass, returning false if unstandardized (null).
 */
export function isFormFactorStandardized(revision: CdsStandardRevision, formFactor: FormFactor): boolean {
  return getCdsMaxMass(revision, formFactor) !== null;
}
