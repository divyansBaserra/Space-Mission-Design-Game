/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Mass Budget & Margin Framework
 *
 * Implements mass budget aggregation, component growth allowances,
 * system allocation headroom, dispenser payload mass capacity check,
 * Cal Poly CDS mechanical envelope compliance, and NASA LSP CSLI propulsion compliance.
 *
 * Equations & Engineering Methodology (Phase 2A Specification §4):
 * 1. Current Best Estimate (CBE):
 *    CBE = Sum(M_component_nominal) [kg]
 * 2. Mass Growth Allowance (MGA):
 *    MGA = Sum(M_component_nominal * contingency_fraction) [kg]
 * 3. Maximum Expected Value (MEV):
 *    MEV = CBE + MGA [kg]
 * 4. System Headroom on MEV:
 *    Headroom_kg = M_dry_allocation - MEV [kg]
 *    Headroom_% = (Headroom_kg / MEV) * 100 [%]
 * 5. Combined CML 4 Margin over CBE (Source Status: PENDING_SOURCE_VERIFICATION):
 *    Combined_Margin_% = ((M_dry_allocation - CBE) / CBE) * 100 [%]
 * 6. Total Wet Mass:
 *    M_wet = MEV + M_propellant [kg]
 * 7. Dispenser Margin (Dispenser Rated Payload Mass Capacity):
 *    Dispenser_Excess_kg = M_dispenser_limit - M_wet [kg]
 *    Dispenser_Margin_% = (Dispenser_Excess_kg / M_wet) * 100 [%]
 * 8. CDS Standard Envelope Compliance (Cal Poly CDS Document Limit):
 *    totalWetMassKg <= cdsStandardLimitKg
 *    Source Classification:
 *    - CDS maximum-mass values: VERIFIED source transcription from applicable Cal Poly CDS revision.
 *    - Applying the CDS limit to total wet mass: DERIVED engineering interpretation assuming propellant
 *      is part of the integrated flight unit at deployment.
 *    - Note: CDS specifications do not explicitly provide a separate dry-mass versus wet-mass rule
 *      in the cited mass tables, nor does CDS grant propulsion approval (governed by launch provider ICD / safety).
 * 9. NASA LSP Profile Propulsion Compliance (NASA LSP-REQ-317.01 Rev B §6.2.5):
 *    CSLI missions prohibit propulsion systems. If propellantMassKg > 0 under an LSP profile,
 *    lspPropulsionCompliant = false.
 *
 * Educational Model Limitation:
 * These calculations model early formulation engineering budgets (CML 4) and do not
 * constitute flight-safety certification or coupled loads analysis (CLA).
 */

import {
  Kilograms,
  kg,
  assertFinitePositive,
  assertFiniteNonNegative,
  ValidationError,
} from "../units";
import {
  FormFactor,
  CdsStandardProfile,
  assertValidFormFactor,
} from "../standards/cdsStandards";
import { DispenserProfile } from "../standards/dispenserProfiles";

/**
 * Default Combined CML 4 dry mass growth allowance threshold (35.0%).
 * Source Status: PENDING_SOURCE_VERIFICATION / GAME_ASSUMPTION.
 * Derived from JPL Concept Maturity Level guidelines for early formulation (CML 4).
 */
export const DEFAULT_CML_DRY_MARGIN_THRESHOLD_PERCENT = 35.0;

export interface MassComponentInput {
  readonly id: string;
  readonly name: string;
  readonly nominalMassKg: Kilograms;
  readonly contingencyFraction: number; // e.g. 0.05 to 0.20
}

export interface MassBudgetInput {
  readonly components: readonly MassComponentInput[];
  readonly propellantMassKg: Kilograms;
  readonly dryMassAllocationKg: Kilograms;
  readonly dispenserProfile: DispenserProfile;
  readonly cdsStandardProfile: CdsStandardProfile;
  readonly formFactor: FormFactor;
  readonly requiredCmlDryMarginPercent?: number; // Configurable (default 35.0%)
}

export interface MassBudgetResult {
  readonly cbeDryMassKg: Kilograms;
  readonly mgaDryMassKg: Kilograms;
  readonly mevDryMassKg: Kilograms;
  readonly totalWetMassKg: Kilograms;

  // Dry-Mass System Allocation
  readonly dryMassAllocationKg: Kilograms;
  readonly systemHeadroomOnMevKg: Kilograms;
  readonly systemHeadroomOnMevPercent: number;
  readonly combinedCmlDryMarginPercent: number;
  readonly meetsCmlDryMarginThreshold: boolean;

  // Dispenser Compliance (Dispenser Rated Payload Mass Capacity)
  readonly dispenserRatedLimitKg: Kilograms;
  readonly dispenserExcessKg: Kilograms;
  readonly dispenserMarginPercent: number;
  readonly meetsDispenserLimit: boolean;

  // CDS Form Factor Compliance (Cal Poly CDS Mechanical Document Standard)
  readonly cdsStandardLimitKg: Kilograms | null;
  /**
   * Evaluates totalWetMassKg <= cdsStandardLimitKg.
   * Source Status:
   * - Limit values: VERIFIED source transcription from applicable Cal Poly CDS revision.
   * - Wet-mass application: DERIVED engineering interpretation assuming propellant is
   *   part of the integrated flight unit at deployment.
   * - Note: CDS specifications do not explicitly provide a separate dry-mass versus wet-mass rule
   *   in the cited mass tables, nor does CDS grant propulsion approval (governed by launch provider ICD / safety).
   * - null if form factor is not standardized in chosen revision.
   */
  readonly meetsCdsStandardLimit: boolean | null;

  // Institutional Launch Profile Compliance (NASA LSP-REQ-317.01 Rev B §6.2.5)
  readonly lspPropulsionCompliant: boolean | null; // false if propellantMassKg > 0 under LSP profile; true if 0 kg; null if non-LSP profile
  readonly propellantPolicyNote: string;
}

/**
 * Calculates Current Best Estimate (CBE) of dry mass by summing nominal component masses.
 */
export function calculateCbe(components: readonly MassComponentInput[]): Kilograms {
  if (!Array.isArray(components) || components.length === 0) {
    throw new ValidationError("components", "Component list must be a non-empty array");
  }
  let sum = 0;
  for (let i = 0; i < components.length; i++) {
    const c = components[i];
    if (!c || typeof c !== "object") {
      throw new ValidationError(`components[${i}]`, "Component must be a non-null object");
    }
    assertFinitePositive(c.nominalMassKg, `components[${i}].nominalMassKg`);
    sum += c.nominalMassKg;
  }
  return kg(sum);
}

/**
 * Calculates Mass Growth Allowance (MGA) by summing component nominal masses multiplied by contingency fractions.
 */
export function calculateMga(components: readonly MassComponentInput[]): Kilograms {
  if (!Array.isArray(components) || components.length === 0) {
    throw new ValidationError("components", "Component list must be a non-empty array");
  }
  let sum = 0;
  for (let i = 0; i < components.length; i++) {
    const c = components[i];
    if (!c || typeof c !== "object") {
      throw new ValidationError(`components[${i}]`, "Component must be a non-null object");
    }
    assertFinitePositive(c.nominalMassKg, `components[${i}].nominalMassKg`);
    assertFiniteNonNegative(c.contingencyFraction, `components[${i}].contingencyFraction`);
    sum += c.nominalMassKg * c.contingencyFraction;
  }
  return kg(sum);
}

/**
 * Calculates Maximum Expected Value (MEV) = CBE + MGA.
 */
export function calculateMev(components: readonly MassComponentInput[]): Kilograms {
  const cbe = calculateCbe(components);
  const mga = calculateMga(components);
  return kg(cbe + mga);
}

/**
 * Performs complete, deterministic spacecraft mass budget analysis according to
 * Phase 2A Specification §4 standards.
 */
export function calculateMassBudget(input: MassBudgetInput): MassBudgetResult {
  if (!input || typeof input !== "object") {
    throw new ValidationError("input", "Mass budget input must be a non-null object");
  }

  // 1. Validate Form Factor
  assertValidFormFactor(input.formFactor);

  // 2. Validate Component List and calculate CBE, MGA, MEV
  if (!Array.isArray(input.components) || input.components.length === 0) {
    throw new ValidationError("components", "Mass budget must include at least one component");
  }

  let cbeSum = 0;
  let mgaSum = 0;
  for (let i = 0; i < input.components.length; i++) {
    const c = input.components[i];
    if (!c || typeof c !== "object") {
      throw new ValidationError(`components[${i}]`, "Component must be a non-null object");
    }
    if (!c.id || typeof c.id !== "string" || c.id.trim().length === 0) {
      throw new ValidationError(`components[${i}].id`, "Component ID must be a non-empty string");
    }
    if (!c.name || typeof c.name !== "string" || c.name.trim().length === 0) {
      throw new ValidationError(`components[${i}].name`, "Component name must be a non-empty string");
    }
    assertFinitePositive(c.nominalMassKg, `components[${i}].nominalMassKg`);
    assertFiniteNonNegative(c.contingencyFraction, `components[${i}].contingencyFraction`);

    cbeSum += c.nominalMassKg;
    mgaSum += c.nominalMassKg * c.contingencyFraction;
  }

  const cbeDryMassKg = kg(cbeSum);
  const mgaDryMassKg = kg(mgaSum);
  const mevDryMassKg = kg(cbeSum + mgaSum);

  // 3. Validate Propellant & Dry Mass Allocation
  assertFiniteNonNegative(input.propellantMassKg, "propellantMassKg");
  assertFinitePositive(input.dryMassAllocationKg, "dryMassAllocationKg");

  // 4. Calculate Wet Mass
  const totalWetMassKg = kg(mevDryMassKg + input.propellantMassKg);

  // 5. System Allocation Headroom & Combined CML Dry Margin
  const systemHeadroomOnMevKg = kg(input.dryMassAllocationKg - mevDryMassKg);
  const systemHeadroomOnMevPercent = (systemHeadroomOnMevKg / mevDryMassKg) * 100;

  const combinedCmlDryMarginPercent = ((input.dryMassAllocationKg - cbeDryMassKg) / cbeDryMassKg) * 100;
  const cmlThreshold = input.requiredCmlDryMarginPercent !== undefined
    ? input.requiredCmlDryMarginPercent
    : DEFAULT_CML_DRY_MARGIN_THRESHOLD_PERCENT;

  assertFiniteNonNegative(cmlThreshold, "requiredCmlDryMarginPercent");
  const meetsCmlDryMarginThreshold = combinedCmlDryMarginPercent >= cmlThreshold;

  // 6. Dispenser Rated Payload Mass Capacity Compliance
  if (!input.dispenserProfile || typeof input.dispenserProfile !== "object") {
    throw new ValidationError("dispenserProfile", "Dispenser profile must be a non-null object");
  }
  assertFinitePositive(input.dispenserProfile.ratedPayloadMassLimitKg, "dispenserProfile.ratedPayloadMassLimitKg");

  const dispenserRatedLimitKg = input.dispenserProfile.ratedPayloadMassLimitKg;
  const dispenserExcessKg = kg(dispenserRatedLimitKg - totalWetMassKg);
  const dispenserMarginPercent = (dispenserExcessKg / totalWetMassKg) * 100;
  const meetsDispenserLimit = totalWetMassKg <= dispenserRatedLimitKg;

  // 7. Cal Poly CDS Document Envelope Compliance
  // Evaluates totalWetMassKg <= cdsStandardLimitKg.
  // CDS maximum mass limits are VERIFIED source values; applying them to total wet mass is a
  // DERIVED engineering interpretation assuming propellant is part of the integrated flight unit
  // at deployment. Note that CDS does not explicitly specify separate dry vs wet mass rules in
  // its cited tables, nor does CDS grant propulsion approval.
  if (!input.cdsStandardProfile || typeof input.cdsStandardProfile !== "object") {
    throw new ValidationError("cdsStandardProfile", "CDS standard profile must be a non-null object");
  }

  const cdsMassMap = input.cdsStandardProfile.maxMassByFormFactorKg;
  const cdsStandardLimitKg = cdsMassMap ? cdsMassMap[input.formFactor] : null;
  const meetsCdsStandardLimit = cdsStandardLimitKg !== null
    ? totalWetMassKg <= cdsStandardLimitKg
    : null;

  // 8. NASA LSP Profile Propulsion Compliance (NASA LSP-REQ-317.01 Rev B §6.2.5)
  let lspPropulsionCompliant: boolean | null = null;
  let propellantPolicyNote: string;

  if (input.dispenserProfile.prohibitsPropulsionUnderLspPolicy) {
    if (input.propellantMassKg > 0) {
      lspPropulsionCompliant = false;
      propellantPolicyNote = "NON-COMPLIANT: NASA LSP-REQ-317.01 Rev B §6.2.5 explicitly prohibits propulsion systems for CubeSats under the CubeSat Launch Initiative.";
    } else {
      lspPropulsionCompliant = true;
      propellantPolicyNote = "COMPLIANT: No propulsion systems present under NASA LSP-REQ-317.01 Rev B §6.2.5.";
    }
  } else {
    lspPropulsionCompliant = null;
    if (input.propellantMassKg > 0) {
      propellantPolicyNote = "NON-LSP PROFILE: Spacecraft includes propellant; propulsion acceptability is governed by mission-specific launch provider ICD.";
    } else {
      propellantPolicyNote = "NON-LSP PROFILE: Spacecraft does not include propulsion systems.";
    }
  }

  return Object.freeze({
    cbeDryMassKg,
    mgaDryMassKg,
    mevDryMassKg,
    totalWetMassKg,

    dryMassAllocationKg: input.dryMassAllocationKg,
    systemHeadroomOnMevKg,
    systemHeadroomOnMevPercent,
    combinedCmlDryMarginPercent,
    meetsCmlDryMarginThreshold,

    dispenserRatedLimitKg,
    dispenserExcessKg,
    dispenserMarginPercent,
    meetsDispenserLimit,

    cdsStandardLimitKg,
    meetsCdsStandardLimit,

    lspPropulsionCompliant,
    propellantPolicyNote,
  });
}
