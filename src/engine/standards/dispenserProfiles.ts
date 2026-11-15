/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Launch Dispenser Profiles (Physical Canister Structural Load Ratings & Launch Policies)
 *
 * Defines canister structural load limits, launch provider interface specifications (ICD),
 * and compliance statuses for deployer systems (e.g., P-POD Mk III, EXOpod).
 *
 * Architectural Boundary Note:
 * Dispenser payload limits represent physical structural canister ratings and are decoupled
 * from Cal Poly CDS document-based exterior mechanical envelope mass limits.
 *
 * Standards & ICD Attributions:
 * - P-POD Mk III: Cal Poly P-POD Mk. III User Guide Rev E / NASA CubeSat 101 App. C [VERIFIED]
 *   Note: NASA LSP-REQ-317.01 Rev B §6.2.5 explicitly prohibits propulsion systems under the
 *   applicable NASA CSLI launch service profile (mission policy, not a mechanical canister limitation).
 * - EXOpod 3U High-Mass: Exolaunch EXOpod User Manual v4.2 [UNVERIFIED_COMMERCIAL_ASSUMPTION]
 * - Custom Override: User-configured flight parameters [USER_DEFINED]
 */

import { Kilograms, kg, assertFinitePositive, ValidationError } from "../units";
import { FormFactor, assertValidFormFactor } from "./cdsStandards";

export type DispenserStatus =
  | "VERIFIED"
  | "UNVERIFIED_COMMERCIAL_ASSUMPTION"
  | "USER_DEFINED";

export interface DispenserProfile {
  readonly id: string;
  readonly name: string;
  readonly provider: string;
  readonly sourceIcd: string;
  readonly formFactor: FormFactor;
  readonly ratedPayloadMassLimitKg: Kilograms;
  readonly status: DispenserStatus;
  readonly notes?: string;
  /**
   * Whether propulsion systems are prohibited under this launch/dispenser profile.
   * Note: This represents NASA Launch Services Program (LSP) CubeSat Launch Initiative (CSLI)
   * mission-profile policy per LSP-REQ-317.01 Rev B §6.2.5, NOT an inherent physical/mechanical
   * limitation of the deployer canister hardware itself.
   */
  readonly prohibitsPropulsionUnderLspPolicy: boolean;
}

export const DISPENSER_PROFILES: Readonly<Record<string, DispenserProfile>> = Object.freeze({
  PPOD_MK3_3U: Object.freeze({
    id: "PPOD_MK3_3U",
    name: "Poly-Picosatellite Orbital Deployer (P-POD) Mk III",
    provider: "Cal Poly / NASA LSP",
    sourceIcd: "Cal Poly P-POD Mk. III User Guide Rev E / NASA CubeSat 101 App. C",
    formFactor: "3U",
    ratedPayloadMassLimitKg: kg(4.00),
    status: "VERIFIED",
    notes: "Physical canister rated payload mass limit is 4.00 kg. When manifested on NASA CSLI missions, NASA LSP-REQ-317.01 Rev B §6.2.5 additionally prohibits propulsion systems.",
    prohibitsPropulsionUnderLspPolicy: true,
  }),
  CUSTOM_OVERRIDE: Object.freeze({
    id: "CUSTOM_OVERRIDE",
    name: "User-Configured Dispenser / Flight Adapter Override",
    provider: "Mission-Specific ICD",
    sourceIcd: "Custom Flight ICD Parameters (User Defined)",
    formFactor: "3U",
    ratedPayloadMassLimitKg: kg(5.00),
    status: "USER_DEFINED",
    notes: "User-defined flight adapter rating. Produces no institutional verification claim.",
    prohibitsPropulsionUnderLspPolicy: false,
  }),
  EXOPOD_3U_HIGH_MASS: Object.freeze({
    id: "EXOPOD_3U_HIGH_MASS",
    name: "Exolaunch EXOpod 3U (High-Mass Option)",
    provider: "Exolaunch",
    sourceIcd: "EXOpod User Manual v4.2 (Reference draft)",
    formFactor: "3U",
    ratedPayloadMassLimitKg: kg(6.00),
    status: "UNVERIFIED_COMMERCIAL_ASSUMPTION",
    notes: "Requires official manufacturer ICD revision substantiation.",
    prohibitsPropulsionUnderLspPolicy: false,
  }),
});

export const SUPPORTED_DISPENSER_IDS: readonly string[] = Object.freeze(
  Object.keys(DISPENSER_PROFILES)
);

/**
 * Retrieves a registered dispenser profile by its unique ID.
 * Automatically trims leading and trailing whitespace.
 * Throws ValidationError if profile ID is unrecognized or empty.
 */
export function getDispenserProfile(id: string): DispenserProfile {
  if (!id || typeof id !== "string" || id.trim().length === 0) {
    throw new ValidationError("id", "Dispenser profile ID must be a non-empty string");
  }
  const trimmedId = id.trim();
  const profile = DISPENSER_PROFILES[trimmedId];
  if (!profile) {
    throw new ValidationError(
      "id",
      `Unknown dispenser profile "${trimmedId}". Available: ${SUPPORTED_DISPENSER_IDS.join(", ")}`
    );
  }
  return profile;
}

/**
 * Retrieves the structural payload mass limit for a registered dispenser profile.
 */
export function getDispenserLimit(id: string): Kilograms {
  return getDispenserProfile(id).ratedPayloadMassLimitKg;
}

/**
 * Checks whether a launch/dispenser profile prohibits propulsion systems under NASA LSP policy.
 * Evaluates NASA LSP-REQ-317.01 Rev B §6.2.5 CSLI compliance, NOT physical canister capability.
 */
export function isLspPropulsionProhibited(profile: DispenserProfile): boolean {
  if (!profile) {
    throw new ValidationError("profile", "Dispenser profile cannot be null or undefined");
  }
  return profile.prohibitsPropulsionUnderLspPolicy;
}

export interface CustomDispenserInput {
  id: string;
  name: string;
  provider: string;
  sourceIcd: string;
  formFactor: FormFactor;
  ratedPayloadMassLimitKg: Kilograms;
  notes?: string;
  prohibitsPropulsionUnderLspPolicy?: boolean;
}

/**
 * Constructs and validates an immutable custom dispenser profile.
 * Classified as USER_DEFINED with no institutional verification claim.
 */
export function createCustomDispenserProfile(input: CustomDispenserInput): DispenserProfile {
  if (!input || typeof input !== "object") {
    throw new ValidationError("input", "Custom dispenser input must be a non-null object");
  }
  if (!input.id || input.id.trim().length === 0) {
    throw new ValidationError("id", "Custom dispenser ID cannot be empty");
  }
  if (!input.name || input.name.trim().length === 0) {
    throw new ValidationError("name", "Custom dispenser name cannot be empty");
  }
  if (!input.provider || input.provider.trim().length === 0) {
    throw new ValidationError("provider", "Custom dispenser provider cannot be empty");
  }
  if (!input.sourceIcd || input.sourceIcd.trim().length === 0) {
    throw new ValidationError("sourceIcd", "Custom dispenser source ICD cannot be empty");
  }
  assertValidFormFactor(input.formFactor);
  assertFinitePositive(input.ratedPayloadMassLimitKg, "ratedPayloadMassLimitKg");

  return Object.freeze({
    id: input.id.trim(),
    name: input.name.trim(),
    provider: input.provider.trim(),
    sourceIcd: input.sourceIcd.trim(),
    formFactor: input.formFactor,
    ratedPayloadMassLimitKg: input.ratedPayloadMassLimitKg,
    status: "USER_DEFINED" as const,
    notes: input.notes?.trim() || "User-defined flight adapter rating. Produces no institutional verification claim.",
    prohibitsPropulsionUnderLspPolicy: Boolean(input.prohibitsPropulsionUnderLspPolicy),
  });
}
