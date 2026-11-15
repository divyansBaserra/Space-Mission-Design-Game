/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Telecom Link Budget Calculator
 *
 * Implements deterministic telecom link budget calculations for space mission communication links.
 *
 * Mathematical Foundations (Phase 2A Specification §7 & §8.4):
 * 1. Logarithmic Power Conversion:
 *    P_tx_dBW = 10 * log10(P_tx_Watts) [dBW]
 * 2. Effective Isotropically Radiated Power (EIRP):
 *    EIRP = P_tx_dBW + G_tx_dBi - txLineLossDb [dBW]
 * 3. Free-Space Path Loss (FSPL):
 *    FSPL = 20 * log10(d_meters) + 20 * log10(f_Hz) - 147.5522 [dB]
 *    where -147.5522 = 20 * log10(4 * pi / c) with c = 299,792,458 m/s.
 * 4. Disaggregated Non-Duplicated Loss Accounting:
 *    L_total = txLineLossDb + rxLineLossDb + pointingLossDb + polarizationLossDb [dB]
 * 5. Received Carrier Power (P_rx):
 *    P_rx_dBW = EIRP - FSPL + G_rx_dBi - (rxLineLossDb + pointingLossDb + polarizationLossDb) [dBW]
 *    (Equivalently: P_rx_dBW = P_tx_dBW + G_tx_dBi + G_rx_dBi - FSPL - L_total)
 * 6. Noise Spectral Density (N_0):
 *    N_0 = -228.5992 + 10 * log10(T_sys_Kelvin) [dBW/Hz]
 *    using Boltzmann constant k = 1.380649e-23 J/K where 10 * log10(k) = -228.5992 dBW/(K·Hz).
 * 7. Carrier-to-Noise Density Ratio (C/N_0):
 *    C/N_0 = P_rx_dBW - N_0 [dBHz]
 * 8. Energy per Bit to Noise Density Ratio (Eb/N_0):
 *    Eb/N_0 = C/N_0 - 10 * log10(R_data_bps) [dB]
 * 9. Link Margin:
 *    Link Margin = Eb/N_0 - (Eb/N_0)_required [dB]
 * 10. Link Feasibility:
 *    linkFeasible = linkMarginDb >= (requiredLinkMarginDb ?? 0.0)
 *
 * Architectural & Safety Boundaries:
 * - Pure Physics Link Calculation:
 *   Evaluates RF propagation physics, antenna gains, path losses, noise figures, and margins.
 * - Decoupling from Range Safety / RF Inhibit Policies:
 *   Per specification §7 and user direction, the telecom calculator does NOT evaluate or enforce
 *   post-separation operational countdown timers (e.g. 45-min RF quiet period) or physical inhibit
 *   switches (CDS Rev 14.1 §2.3.7 / §2.3.2.4). Those operational policies and hardware circuits
 *   are maintained exclusively in `src/engine/standards/operationalPolicies.ts`.
 * - Educational Scope Note:
 *   Ideal free-space link budget. Atmospheric, ionospheric, rain attenuation, and multipath
 *   are not modeled in Phase 2 and are deferred to Phase 4.
 */

import {
  Watts,
  Kilometers,
  Hertz,
  Decibels,
  DecibelWatts,
  DecibelIsotropic,
  DecibelHertz,
  DecibelWattsPerHertz,
  dB,
  dBW,
  dBHz,
  dBW_Hz,
  kilometersToMeters,
  assertFinitePositive,
  assertFiniteNonNegative,
  ValidationError,
} from "../units";

/** Speed of light in vacuum [m/s] (CODATA / BIPM standard) */
export const SPEED_OF_LIGHT_MPS = 299792458;

/** Boltzmann constant [J/K] (SI exact 2019 redefinition) */
export const BOLTZMANN_CONSTANT_J_PER_K = 1.380649e-23;

/** Boltzmann constant in dBW/(K·Hz): 10 * log10(1.380649e-23) rounded to spec baseline */
export const BOLTZMANN_CONSTANT_DBW_PER_K_HZ = -228.5992;

/** Free-space path loss constant [dB]: 20 * log10(4 * pi / c) rounded to spec baseline */
export const FSPL_CONSTANT_DB = -147.5522;

/** Fixed analytical scope note required by Phase 2A Specification §7 */
export const TELECOM_SCOPE_NOTE =
  "Ideal link budget; atmospheric and ionospheric attenuation evaluated in Phase 4" as const;

/** Educational model disclaimer note */
export const EDUCATIONAL_MODEL_NOTE =
  "Simplified educational engineering model; does not constitute flight-safety certification or formal launch-provider compliance." as const;

/** Disaggregated non-duplicated RF line, pointing, and polarization losses */
export interface TelecomLosses {
  readonly txLineLossDb: Decibels;
  readonly rxLineLossDb: Decibels;
  readonly pointingLossDb: Decibels;
  readonly polarizationLossDb: Decibels;
}

/** Comprehensive link budget input supporting both canonical and specification v5 property aliases */
export interface TelecomInput {
  // Transmit power:
  readonly transmitPowerWatts: Watts;

  // Frequency properties (carrierFrequencyHz canonical, frequencyHz spec alias):
  readonly carrierFrequencyHz?: Hertz;
  readonly frequencyHz?: Hertz;

  // Distance properties (slantRangeKm canonical, distanceKm spec alias):
  readonly slantRangeKm?: Kilometers;
  readonly distanceKm?: Kilometers;

  // Transmit antenna gain (transmitAntennaGainDbi canonical, txAntennaGainDbi spec alias):
  readonly transmitAntennaGainDbi?: DecibelIsotropic;
  readonly txAntennaGainDbi?: DecibelIsotropic;

  // Receive antenna gain (receiveAntennaGainDbi canonical, rxAntennaGainDbi spec alias):
  readonly receiveAntennaGainDbi?: DecibelIsotropic;
  readonly rxAntennaGainDbi?: DecibelIsotropic;

  // System noise temperature (systemNoiseTemperatureK canonical, systemNoiseTempKelvin spec alias):
  readonly systemNoiseTemperatureK?: number;
  readonly systemNoiseTempKelvin?: number;

  // Data rate and thresholds:
  readonly dataRateBps: number;
  readonly requiredEbN0Db: Decibels;
  readonly losses: TelecomLosses;
  readonly requiredLinkMarginDb?: Decibels;
}

/** Specification v5 alias for TelecomInput */
export type LinkBudgetInput = TelecomInput;

/** Detailed telecom calculation results with standard and specification v5 property aliases */
export interface TelecomResult {
  // Transmit power & EIRP
  readonly transmitPowerDbw: DecibelWatts;
  readonly txPowerDbw: DecibelWatts; // Alias matching LinkBudgetResult
  readonly eirpDbw: DecibelWatts;

  // Path loss & losses
  readonly freeSpacePathLossDb: Decibels;
  readonly fsplDb: Decibels; // Alias matching LinkBudgetResult
  readonly totalLossesDb: Decibels;

  // Received carrier power
  readonly receivedPowerDbw: DecibelWatts;
  readonly rxPowerDbw: DecibelWatts; // Alias matching LinkBudgetResult

  // Noise & Signal-to-Noise metrics
  readonly noiseSpectralDensityDbwPerHz: DecibelWattsPerHertz;
  readonly noiseSpectralDensityDbwHz: DecibelWattsPerHertz; // Alias matching LinkBudgetResult
  readonly carrierToNoiseDensityDbHz: DecibelHertz;
  readonly energyPerBitToNoiseDensityDb: Decibels;
  readonly receivedEbN0Db: Decibels; // Alias matching LinkBudgetResult

  // Link margin & Feasibility
  readonly linkMarginDb: Decibels;
  readonly linkFeasible: boolean;

  // Educational scope & notes
  readonly scopeNote: typeof TELECOM_SCOPE_NOTE;
  readonly educationalModelNote: typeof EDUCATIONAL_MODEL_NOTE;
}

/** Specification v5 alias for TelecomResult */
export type LinkBudgetResult = TelecomResult;

/**
 * Calculates total disaggregated RF losses in dB.
 */
export function calculateTotalLosses(losses: TelecomLosses): Decibels {
  if (!losses || typeof losses !== "object") {
    throw new ValidationError("losses", "Telecom losses must be a non-null object");
  }
  assertFiniteNonNegative(losses.txLineLossDb, "losses.txLineLossDb");
  assertFiniteNonNegative(losses.rxLineLossDb, "losses.rxLineLossDb");
  assertFiniteNonNegative(losses.pointingLossDb, "losses.pointingLossDb");
  assertFiniteNonNegative(losses.polarizationLossDb, "losses.polarizationLossDb");

  return dB(
    losses.txLineLossDb + losses.rxLineLossDb + losses.pointingLossDb + losses.polarizationLossDb
  );
}

/**
 * Calculates Free-Space Path Loss (FSPL) in dB:
 * FSPL = 20 * log10(d_meters) + 20 * log10(f_Hz) - 147.5522 [dB]
 */
export function calculateFspl(distanceKm: Kilometers, frequencyHz: Hertz): Decibels {
  assertFinitePositive(distanceKm, "distanceKm");
  assertFinitePositive(frequencyHz, "frequencyHz");

  const distanceMeters = kilometersToMeters(distanceKm);
  const fspl = 20 * Math.log10(distanceMeters) + 20 * Math.log10(frequencyHz) + FSPL_CONSTANT_DB;

  return dB(fspl);
}

/**
 * Calculates Effective Isotropically Radiated Power (EIRP) in dBW:
 * EIRP = P_tx_dBW + G_tx_dBi - txLineLossDb [dBW]
 */
export function calculateEirp(
  transmitPowerWatts: Watts,
  transmitAntennaGainDbi: DecibelIsotropic,
  txLineLossDb: Decibels
): DecibelWatts {
  assertFinitePositive(transmitPowerWatts, "transmitPowerWatts");
  if (!Number.isFinite(transmitAntennaGainDbi)) {
    throw new ValidationError(
      "transmitAntennaGainDbi",
      `Antenna gain must be finite, received ${transmitAntennaGainDbi}`
    );
  }
  assertFiniteNonNegative(txLineLossDb, "txLineLossDb");

  const txPowerDbw = 10 * Math.log10(transmitPowerWatts);
  return dBW(txPowerDbw + transmitAntennaGainDbi - txLineLossDb);
}

/**
 * Calculates Noise Spectral Density (N_0) in dBW/Hz:
 * N_0 = -228.5992 + 10 * log10(T_sys_Kelvin) [dBW/Hz]
 */
export function calculateNoiseSpectralDensity(systemNoiseTempK: number): DecibelWattsPerHertz {
  assertFinitePositive(systemNoiseTempK, "systemNoiseTempK");
  return dBW_Hz(BOLTZMANN_CONSTANT_DBW_PER_K_HZ + 10 * Math.log10(systemNoiseTempK));
}

/**
 * Calculates the complete deterministic RF telecom link budget.
 *
 * Validates physical and numerical constraints, computes path loss, received power,
 * noise spectral density, C/N_0, Eb/N_0, link margin, and overall link feasibility.
 */
export function calculateLinkBudget(input: TelecomInput): TelecomResult {
  if (!input || typeof input !== "object") {
    throw new ValidationError("input", "Telecom input must be a non-null object");
  }

  // 1. Transmit Power (strictly positive)
  assertFinitePositive(input.transmitPowerWatts, "transmitPowerWatts");

  // 2. Frequency (strictly positive)
  const frequencyHz = input.carrierFrequencyHz ?? input.frequencyHz;
  if (frequencyHz === undefined) {
    throw new ValidationError("carrierFrequencyHz", "Carrier frequency is required");
  }
  assertFinitePositive(frequencyHz, "carrierFrequencyHz");

  // 3. Distance / Slant range (strictly positive)
  const distanceKm = input.slantRangeKm ?? input.distanceKm;
  if (distanceKm === undefined) {
    throw new ValidationError("slantRangeKm", "Slant range / distance is required");
  }
  assertFinitePositive(distanceKm, "slantRangeKm");

  // 4. Transmit Antenna Gain (finite number, can be negative, zero, or positive)
  const txGainDbi = input.transmitAntennaGainDbi ?? input.txAntennaGainDbi;
  if (txGainDbi === undefined || !Number.isFinite(txGainDbi)) {
    throw new ValidationError(
      "transmitAntennaGainDbi",
      `Transmit antenna gain must be a finite number, received ${txGainDbi}`
    );
  }

  // 5. Receive Antenna Gain (finite number, can be negative, zero, or positive)
  const rxGainDbi = input.receiveAntennaGainDbi ?? input.rxAntennaGainDbi;
  if (rxGainDbi === undefined || !Number.isFinite(rxGainDbi)) {
    throw new ValidationError(
      "receiveAntennaGainDbi",
      `Receive antenna gain must be a finite number, received ${rxGainDbi}`
    );
  }

  // 6. System Noise Temperature (strictly positive)
  const noiseTempK = input.systemNoiseTemperatureK ?? input.systemNoiseTempKelvin;
  if (noiseTempK === undefined) {
    throw new ValidationError("systemNoiseTemperatureK", "System noise temperature is required");
  }
  assertFinitePositive(noiseTempK, "systemNoiseTemperatureK");

  // 7. Data Rate in bps (strictly positive)
  assertFinitePositive(input.dataRateBps, "dataRateBps");

  // 8. Required Eb/N0 threshold in dB (finite number)
  if (input.requiredEbN0Db === undefined || !Number.isFinite(input.requiredEbN0Db)) {
    throw new ValidationError(
      "requiredEbN0Db",
      `Required Eb/N0 must be a finite number, received ${input.requiredEbN0Db}`
    );
  }

  // 9. Losses (non-negative)
  if (!input.losses || typeof input.losses !== "object") {
    throw new ValidationError("losses", "Telecom losses must be a non-null object");
  }
  assertFiniteNonNegative(input.losses.txLineLossDb, "losses.txLineLossDb");
  assertFiniteNonNegative(input.losses.rxLineLossDb, "losses.rxLineLossDb");
  assertFiniteNonNegative(input.losses.pointingLossDb, "losses.pointingLossDb");
  assertFiniteNonNegative(input.losses.polarizationLossDb, "losses.polarizationLossDb");

  // 10. Required Link Margin threshold (if provided, must be finite)
  if (input.requiredLinkMarginDb !== undefined && !Number.isFinite(input.requiredLinkMarginDb)) {
    throw new ValidationError(
      "requiredLinkMarginDb",
      `Required link margin must be a finite number, received ${input.requiredLinkMarginDb}`
    );
  }

  // Core Link Budget Calculations
  const txPowerDbw = dBW(10 * Math.log10(input.transmitPowerWatts));
  const eirpDbw = dBW(txPowerDbw + txGainDbi - input.losses.txLineLossDb);
  const totalLossesDb = calculateTotalLosses(input.losses);
  const fsplDb = calculateFspl(distanceKm, frequencyHz);

  const rxOtherLosses =
    input.losses.rxLineLossDb + input.losses.pointingLossDb + input.losses.polarizationLossDb;
  const rxPowerDbw = dBW(eirpDbw - fsplDb + rxGainDbi - rxOtherLosses);

  const noiseSpectralDensityDbwHz = calculateNoiseSpectralDensity(noiseTempK);
  const carrierToNoiseDensityDbHz = dBHz(rxPowerDbw - noiseSpectralDensityDbwHz);
  const receivedEbN0Db = dB(carrierToNoiseDensityDbHz - 10 * Math.log10(input.dataRateBps));
  const linkMarginDb = dB(receivedEbN0Db - input.requiredEbN0Db);

  const minRequiredMargin =
    input.requiredLinkMarginDb !== undefined ? input.requiredLinkMarginDb : 0.0;
  const linkFeasible = linkMarginDb >= minRequiredMargin;

  return Object.freeze({
    transmitPowerDbw: txPowerDbw,
    txPowerDbw,
    eirpDbw,
    freeSpacePathLossDb: fsplDb,
    fsplDb,
    totalLossesDb,
    receivedPowerDbw: rxPowerDbw,
    rxPowerDbw,
    noiseSpectralDensityDbwPerHz: noiseSpectralDensityDbwHz,
    noiseSpectralDensityDbwHz,
    carrierToNoiseDensityDbHz,
    energyPerBitToNoiseDensityDb: receivedEbN0Db,
    receivedEbN0Db,
    linkMarginDb,
    linkFeasible,
    scopeNote: TELECOM_SCOPE_NOTE,
    educationalModelNote: EDUCATIONAL_MODEL_NOTE,
  });
}

/** Aliases for calculateLinkBudget to satisfy all spec references */
export const calculateTelecomLinkBudget = calculateLinkBudget;
export const calculateTelecom = calculateLinkBudget;
