/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Operational Inhibit Policies & Timers
 *
 * Single source of truth for operational post-separation timing policies:
 * - Deployable mechanism release delay: 30 minutes (CDS Rev 13 §3.4.4 / CDS Rev 14.1 §2.4.4)
 * - RF transmission quiet period: 45 minutes (CDS Rev 13 §3.4.5 / CDS Rev 14.1 §2.4.5)
 *
 * Architectural & Safety Boundaries:
 * 1. Physical vs. Operational Timer Distinction:
 *    Per CubeSat 101 §6.7: "An inhibit is a physical device between a power source and a hazard.
 *    A timer is not considered an independent inhibit."
 *    Software countdown timers gate operational sequencing, but NEVER satisfy physical hardware
 *    inhibit circuit requirements.
 * 2. Separation Gating:
 *    Timers must never commence countdown before physical dispenser separation occurs.
 * 3. Pre-Launch Operational State Reset (CDS Rev 14.1 §2.3.2.4):
 *    If a deployment switch toggles from actuated back to unactuated (e.g. switch bounce,
 *    dispenser re-stow, handling), the spacecraft must immediately reset to its pre-launch
 *    operational state, resetting elapsed timers to zero.
 * 4. Educational Game Model Limitation:
 *    These evaluations do not constitute flight-safety certification or range-safety authorization.
 */

import { Minutes, minutes, assertFiniteNonNegative, ValidationError } from "../units";

export type InhibitPolicyType = "DEPLOYABLE_RELEASE" | "RF_TRANSMISSION";
export type InhibitPolicyStatus = "VERIFIED" | "GAME_ASSUMPTION";

/**
 * Baseline physical independent electrical inhibit requirements under Cal Poly CDS Rev 14.1:
 * - Deployables: CDS Rev 14.1 §2.3.8 / LSP-REQ-317.01 Rev B §6.2.11 (3 physical inhibits).
 * - RF Transmitters: CDS Rev 14.1 §2.3.7 / LSP-REQ-317.01 Rev B §§6.2.10–6.2.11 (3 physical inhibits).
 * Kept strictly distinct from software timers.
 */
export const CDS_REV_14_1_MIN_DEPLOYABLE_INHIBITS = 3;
export const CDS_REV_14_1_MIN_RF_INHIBITS = 3;

export interface InhibitPolicy {
  readonly id: string;
  readonly name: string;
  readonly type: InhibitPolicyType;
  readonly requiredInhibitMinutes: Minutes;
  readonly mandatingStandard: string;
  readonly section: string;
  readonly isEnforced: boolean;
  readonly status: InhibitPolicyStatus;
  readonly notes?: string;
}

export const OPERATIONAL_POLICIES: Readonly<Record<string, InhibitPolicy>> = Object.freeze({
  CDS_REV_13_DEPLOY_DELAY: Object.freeze({
    id: "CDS_REV_13_DEPLOY_DELAY",
    name: "CDS Rev 13 Deployable Mechanism Release Delay",
    type: "DEPLOYABLE_RELEASE",
    requiredInhibitMinutes: minutes(30),
    mandatingStandard: "Cal Poly CubeSat Design Specification Rev 13",
    section: "§3.4.4",
    isEnforced: true,
    status: "VERIFIED",
    notes: "Requires at least 30 minutes after dispenser deployment before deployable mechanisms are commanded to release.",
  }),
  CDS_REV_13_RF_QUIET: Object.freeze({
    id: "CDS_REV_13_RF_QUIET",
    name: "CDS Rev 13 RF Transmission Quiet Period",
    type: "RF_TRANSMISSION",
    requiredInhibitMinutes: minutes(45),
    mandatingStandard: "Cal Poly CubeSat Design Specification Rev 13",
    section: "§3.4.5",
    isEnforced: true,
    status: "VERIFIED",
    notes: "Requires at least 45 minutes after dispenser deployment before RF transmitters are permitted to key.",
  }),
  CDS_REV_14_1_DEPLOY_DELAY: Object.freeze({
    id: "CDS_REV_14_1_DEPLOY_DELAY",
    name: "CDS Rev 14.1 Deployable Mechanism Release Delay",
    type: "DEPLOYABLE_RELEASE",
    requiredInhibitMinutes: minutes(30),
    mandatingStandard: "Cal Poly CubeSat Design Specification Rev 14.1",
    section: "§2.4.4",
    isEnforced: true,
    status: "VERIFIED",
    notes: "Requires at least 30 minutes after dispenser deployment before deployable mechanisms are commanded to release.",
  }),
  CDS_REV_14_1_RF_QUIET: Object.freeze({
    id: "CDS_REV_14_1_RF_QUIET",
    name: "CDS Rev 14.1 RF Transmission Quiet Period",
    type: "RF_TRANSMISSION",
    requiredInhibitMinutes: minutes(45),
    mandatingStandard: "Cal Poly CubeSat Design Specification Rev 14.1",
    section: "§2.4.5",
    isEnforced: true,
    status: "VERIFIED",
    notes: "Requires at least 45 minutes after dispenser deployment before RF transmitters are permitted to key.",
  }),
});

export const SUPPORTED_OPERATIONAL_POLICY_IDS: readonly string[] = Object.freeze(
  Object.keys(OPERATIONAL_POLICIES)
);

/**
 * Retrieves a registered operational policy by its ID.
 * Automatically trims whitespace. Throws ValidationError for invalid or unknown IDs.
 */
export function getOperationalPolicy(id: string): InhibitPolicy {
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    throw new ValidationError("id", "Operational policy ID must be a non-empty string");
  }
  const trimmedId = id.trim();
  const policy = OPERATIONAL_POLICIES[trimmedId];
  if (!policy) {
    throw new ValidationError(
      "id",
      `Unknown operational policy "${trimmedId}". Available: ${SUPPORTED_OPERATIONAL_POLICY_IDS.join(", ")}`
    );
  }
  return policy;
}

/**
 * Retrieves the required inhibit duration in minutes for an operational policy.
 */
export function getRequiredInhibitMinutes(id: string): Minutes {
  return getOperationalPolicy(id).requiredInhibitMinutes;
}

/**
 * Checks whether an operational policy is currently enforced.
 */
export function isPolicyEnforced(id: string): boolean {
  return getOperationalPolicy(id).isEnforced;
}

export interface PolicyTimerInput {
  readonly policyId: string;
  readonly separationOccurred: boolean;
  readonly hardwareCurrentlyInhibited: boolean;
  readonly timerElapsedMinutes: Minutes;
}

export interface PolicyTimerResult {
  readonly policyId: string;
  readonly policyType: InhibitPolicyType;
  readonly timerRequiredMinutes: Minutes;
  readonly timerElapsedMinutes: Minutes;
  readonly timerExpired: boolean;
  readonly inhibitRemainingMinutes: Minutes;
  readonly hardwareCurrentlyInhibited: boolean;
  readonly separationOccurred: boolean;
}

/**
 * Evaluates an operational countdown timer with strict dispenser separation gating
 * and CDS Rev 14.1 §2.3.2.4 state reset logic.
 *
 * Rules:
 * 1. If separation has NOT occurred (`separationOccurred === false`), the timer cannot run.
 * 2. If hardware is inhibited (`hardwareCurrentlyInhibited === true`, e.g. microswitches depressed
 *    inside dispenser, RBF pin inserted, or switch toggled back), the spacecraft resets to
 *    its pre-launch operational state per CDS Rev 14.1 §2.3.2.4:
 *    - Timer elapsed time resets to 0.0 minutes.
 *    - Inhibit remaining minutes resets to full required delay.
 *    - Timer is not expired.
 * 3. Only when `separationOccurred === true` and `hardwareCurrentlyInhibited === false` does
 *    the countdown timer advance toward expiration.
 */
export function evaluatePolicyTimer(input: PolicyTimerInput): PolicyTimerResult {
  if (!input || typeof input !== "object") {
    throw new ValidationError("input", "Policy timer input must be a non-null object");
  }

  const policy = getOperationalPolicy(input.policyId);
  const requiredMinutes = policy.requiredInhibitMinutes;

  assertFiniteNonNegative(input.timerElapsedMinutes, "timerElapsedMinutes");

  // CDS Rev 14.1 §2.3.2.4 Reset Rule:
  // If hardware is currently inhibited or separation has not occurred,
  // the spacecraft is in or resets to its pre-launch state.
  const isResetOrInhibited = !input.separationOccurred || input.hardwareCurrentlyInhibited;

  const effectiveElapsedMinutes = isResetOrInhibited ? minutes(0.0) : input.timerElapsedMinutes;
  const timerExpired = !isResetOrInhibited && effectiveElapsedMinutes >= requiredMinutes;

  const remainingMinutes = timerExpired
    ? minutes(0.0)
    : minutes(Math.max(0.0, requiredMinutes - effectiveElapsedMinutes));

  return Object.freeze({
    policyId: policy.id,
    policyType: policy.type,
    timerRequiredMinutes: requiredMinutes,
    timerElapsedMinutes: effectiveElapsedMinutes,
    timerExpired,
    inhibitRemainingMinutes: remainingMinutes,
    hardwareCurrentlyInhibited: input.hardwareCurrentlyInhibited,
    separationOccurred: input.separationOccurred,
  });
}

export interface CustomInhibitPolicyInput {
  id: string;
  name: string;
  type: InhibitPolicyType;
  requiredInhibitMinutes: Minutes;
  mandatingStandard: string;
  section: string;
  isEnforced?: boolean;
  notes?: string;
}

/**
 * Factory for creating immutable user-defined or scenario-specific operational policies.
 * Tagged with GAME_ASSUMPTION status.
 */
export function createCustomOperationalPolicy(input: CustomInhibitPolicyInput): InhibitPolicy {
  if (!input || typeof input !== "object") {
    throw new ValidationError("input", "Custom operational policy input must be a non-null object");
  }
  if (!input.id || input.id.trim().length === 0) {
    throw new ValidationError("id", "Custom operational policy ID cannot be empty");
  }
  if (!input.name || input.name.trim().length === 0) {
    throw new ValidationError("name", "Custom operational policy name cannot be empty");
  }
  if (input.type !== "DEPLOYABLE_RELEASE" && input.type !== "RF_TRANSMISSION") {
    throw new ValidationError(
      "type",
      `Invalid policy type "${input.type}". Must be "DEPLOYABLE_RELEASE" or "RF_TRANSMISSION"`
    );
  }
  assertFiniteNonNegative(input.requiredInhibitMinutes, "requiredInhibitMinutes");

  if (!input.mandatingStandard || input.mandatingStandard.trim().length === 0) {
    throw new ValidationError("mandatingStandard", "Mandating standard cannot be empty");
  }
  if (!input.section || input.section.trim().length === 0) {
    throw new ValidationError("section", "Standard section cannot be empty");
  }

  return Object.freeze({
    id: input.id.trim(),
    name: input.name.trim(),
    type: input.type,
    requiredInhibitMinutes: input.requiredInhibitMinutes,
    mandatingStandard: input.mandatingStandard.trim(),
    section: input.section.trim(),
    isEnforced: input.isEnforced !== undefined ? Boolean(input.isEnforced) : true,
    status: "GAME_ASSUMPTION" as const,
    notes: input.notes?.trim() || "User-defined custom operational policy. Produces no institutional verification claim.",
  });
}
