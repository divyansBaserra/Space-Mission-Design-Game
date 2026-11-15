/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Unified Engine Entry Point (Phase 2B Module 9)
 *
 * Public API entry point re-exporting all deterministic engineering models,
 * branded unit types, institutional flight standards, and subsystem calculators.
 *
 * Subsystem Modules:
 * - Units & Assertions: Branded physical types, SI converters, validation errors.
 * - CDS Standards: Cal Poly CubeSat Design Specification Rev 13 & Rev 14.1 profiles.
 * - Dispenser Profiles: P-POD Mk III, EXOpod 3U, and Custom ICD profiles.
 * - Operational Policies: CDS post-separation timers (30-min deploy, 45-min RF quiet) & state reset.
 * - Mass Budget: CBE, MGA, MEV, Dry Mass Margin, Wet Mass, CDS & Dispenser limits.
 * - Power Balance: Solar generation, battery DoD/SoC, C-rate limiting, sequential multi-orbit loop.
 * - Propulsion: Tsiolkovsky ideal impulsive Delta-V, burn duration, thrust-to-mass accelerations.
 * - Telecom: Free-space path loss, disaggregated losses, received power, C/N_0, Eb/N_0, link margin.
 */

// ============================================================================
// 1. Units, Branded Types, Constructors, Converters & Precondition Guards
// ============================================================================
export type {
  Kilograms,
  Grams,
  Watts,
  WattHours,
  Meters,
  Kilometers,
  Seconds,
  Minutes,
  Hours,
  Hertz,
  Decibels,
  DecibelWatts,
  DecibelIsotropic,
  DecibelHertz,
  DecibelWattsPerHertz,
} from "./units";

export {
  kg,
  g,
  watts,
  wattHours,
  meters,
  kilometers,
  seconds,
  minutes,
  hours,
  hertz,
  dB,
  dBW,
  dBi,
  dBHz,
  dBW_Hz,
  toKilograms,
  toGrams,
  kilometersToMeters,
  metersToKilometers,
  minutesToHours,
  hoursToMinutes,
  secondsToMinutes,
  minutesToSeconds,
  wattsToDbw,
  dbwToWatts,
  ValidationError,
  assertFinitePositive,
  assertFiniteNonNegative,
  assertFractionRange,
  assertInitialSocAboveFloor,
} from "./units";

// ============================================================================
// 2. CubeSat Design Specification (CDS) Standards
// ============================================================================
export type {
  FormFactor,
  CdsStandardRevision,
  DeployableDelayPolicyId,
  RfQuietPolicyId,
  CdsStandardProfile,
} from "./standards/cdsStandards";

export {
  CDS_STANDARDS,
  SUPPORTED_FORM_FACTORS,
  assertValidFormFactor,
  getCdsStandard,
  getCdsMaxMass,
  isFormFactorStandardized,
} from "./standards/cdsStandards";

// ============================================================================
// 3. Dispenser Profiles & Launcher Constraints
// ============================================================================
export type {
  DispenserStatus,
  DispenserProfile,
  CustomDispenserInput,
} from "./standards/dispenserProfiles";

export {
  DISPENSER_PROFILES,
  SUPPORTED_DISPENSER_IDS,
  getDispenserProfile,
  getDispenserLimit,
  isLspPropulsionProhibited,
  createCustomDispenserProfile,
} from "./standards/dispenserProfiles";

// ============================================================================
// 4. Operational Inhibit Policies & Timers
// ============================================================================
export type {
  InhibitPolicyType,
  InhibitPolicyStatus,
  InhibitPolicy,
  PolicyTimerInput,
  PolicyTimerResult,
  CustomInhibitPolicyInput,
} from "./standards/operationalPolicies";

export {
  CDS_REV_14_1_MIN_DEPLOYABLE_INHIBITS,
  CDS_REV_14_1_MIN_RF_INHIBITS,
  OPERATIONAL_POLICIES,
  SUPPORTED_OPERATIONAL_POLICY_IDS,
  getOperationalPolicy,
  getRequiredInhibitMinutes,
  isPolicyEnforced,
  evaluatePolicyTimer,
  createCustomOperationalPolicy,
} from "./standards/operationalPolicies";

// ============================================================================
// 5. Mass Budget Calculator
// ============================================================================
export type {
  MassComponentInput,
  MassBudgetInput,
  MassBudgetResult,
} from "./mass/massCalculator";

export {
  DEFAULT_CML_DRY_MARGIN_THRESHOLD_PERCENT,
  calculateCbe,
  calculateMga,
  calculateMev,
  calculateMassBudget,
} from "./mass/massCalculator";

// ============================================================================
// 6. Power Balance & Sequential Orbit Simulator
// ============================================================================
export type {
  SolarGeometryInput,
  PowerBalanceInput,
  OrbitStepRecord,
  PowerSimulationResult,
} from "./power/powerCalculator";

export {
  DEFAULT_SOLAR_CONSTANT_WPM2,
  DEFAULT_SIMULATION_ORBITS,
  calculateSolarGeneration,
  simulatePowerBalance,
} from "./power/powerCalculator";

// ============================================================================
// 7. Propulsion & Impulsive Delta-V Calculator
// ============================================================================
export type {
  PropulsionInput,
  PropulsionResult,
} from "./propulsion/propulsionCalculator";

export {
  STANDARD_GRAVITY_MPS2,
  PROPULSION_SCOPE_NOTE,
  calculatePropulsion,
} from "./propulsion/propulsionCalculator";

// ============================================================================
// 8. Telecom Link-Budget Calculator
// ============================================================================
export type {
  TelecomLosses,
  TelecomInput,
  LinkBudgetInput,
  TelecomResult,
  LinkBudgetResult,
} from "./telecom/telecomCalculator";

export {
  SPEED_OF_LIGHT_MPS,
  BOLTZMANN_CONSTANT_J_PER_K,
  BOLTZMANN_CONSTANT_DBW_PER_K_HZ,
  FSPL_CONSTANT_DB,
  TELECOM_SCOPE_NOTE,
  EDUCATIONAL_MODEL_NOTE,
  calculateTotalLosses,
  calculateFspl,
  calculateEirp,
  calculateNoiseSpectralDensity,
  calculateLinkBudget,
  calculateTelecomLinkBudget,
  calculateTelecom,
} from "./telecom/telecomCalculator";
