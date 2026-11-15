/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Branded Unit Types, Validation Guards & Physical Converters
 *
 * All physical and logarithmic quantities are strongly typed using TypeScript nominal branding.
 * Validation assertion functions enforce physical invariants, rejecting NaN, Infinity,
 * and out-of-range bounds at runtime.
 */

// --- Base Physical SI Units (Branded) ---
export type Kilograms = number & { readonly __brand: "kg" };
export type Grams = number & { readonly __brand: "g" };
export type Watts = number & { readonly __brand: "W" };
export type WattHours = number & { readonly __brand: "Wh" };
export type Meters = number & { readonly __brand: "m" };
export type Kilometers = number & { readonly __brand: "km" };
export type Seconds = number & { readonly __brand: "s" };
export type Minutes = number & { readonly __brand: "min" };
export type Hours = number & { readonly __brand: "h" };
export type Hertz = number & { readonly __brand: "Hz" };

// --- Explicit Logarithmic Unit Differentiation (Branded) ---
export type Decibels = number & { readonly __brand: "dB" };                     // Dimensionless ratios (margins, line losses)
export type DecibelWatts = number & { readonly __brand: "dBW" };                // Absolute power relative to 1 Watt: 10*log10(P_watts)
export type DecibelIsotropic = number & { readonly __brand: "dBi" };            // Antenna gain relative to isotropic radiator
export type DecibelHertz = number & { readonly __brand: "dBHz" };               // Carrier-to-noise density ratio (C/N0)
export type DecibelWattsPerHertz = number & { readonly __brand: "dBW/Hz" };     // Noise spectral density (N0)

// --- Type Cast / Constructor Helpers ---
export const kg = (v: number): Kilograms => v as Kilograms;
export const g = (v: number): Grams => v as Grams;
export const watts = (v: number): Watts => v as Watts;
export const wattHours = (v: number): WattHours => v as WattHours;
export const meters = (v: number): Meters => v as Meters;
export const kilometers = (v: number): Kilometers => v as Kilometers;
export const seconds = (v: number): Seconds => v as Seconds;
export const minutes = (v: number): Minutes => v as Minutes;
export const hours = (v: number): Hours => v as Hours;
export const hertz = (v: number): Hertz => v as Hertz;
export const dB = (v: number): Decibels => v as Decibels;
export const dBW = (v: number): DecibelWatts => v as DecibelWatts;
export const dBi = (v: number): DecibelIsotropic => v as DecibelIsotropic;
export const dBHz = (v: number): DecibelHertz => v as DecibelHertz;
export const dBW_Hz = (v: number): DecibelWattsPerHertz => v as DecibelWattsPerHertz;

// --- Physical Conversion Utilities ---
export function toKilograms(gramsVal: Grams): Kilograms {
  return (gramsVal / 1000) as Kilograms;
}

export function toGrams(kgVal: Kilograms): Grams {
  return (kgVal * 1000) as Grams;
}

export function kilometersToMeters(kmVal: Kilometers): Meters {
  return (kmVal * 1000) as Meters;
}

export function metersToKilometers(mVal: Meters): Kilometers {
  return (mVal / 1000) as Kilometers;
}

export function minutesToHours(minVal: Minutes): Hours {
  return (minVal / 60) as Hours;
}

export function hoursToMinutes(hVal: Hours): Minutes {
  return (hVal * 60) as Minutes;
}

export function secondsToMinutes(sVal: Seconds): Minutes {
  return (sVal / 60) as Minutes;
}

export function minutesToSeconds(minVal: Minutes): Seconds {
  return (minVal * 60) as Seconds;
}

export function wattsToDbw(wVal: Watts): DecibelWatts {
  assertFinitePositive(wVal, "wattsToDbw: input power");
  return (10 * Math.log10(wVal)) as DecibelWatts;
}

export function dbwToWatts(dbwVal: DecibelWatts): Watts {
  if (!Number.isFinite(dbwVal)) {
    throw new ValidationError("dbwToWatts", `DecibelWatts must be finite, received ${dbwVal}`);
  }
  return Math.pow(10, dbwVal / 10) as Watts;
}

// --- Validation Errors & Precondition Guards ---
export class ValidationError extends Error {
  constructor(public readonly parameter: string, message: string) {
    super(`[Engineering Validation Error] ${parameter}: ${message}`);
    this.name = "ValidationError";
    Object.setPrototypeOf(this, ValidationError.prototype);
  }
}

/** Asserts number is finite and strictly > 0 */
export function assertFinitePositive(val: number, name: string): void {
  if (!Number.isFinite(val) || val <= 0) {
    throw new ValidationError(name, `Must be finite and > 0, received ${val}`);
  }
}

/** Asserts number is finite and >= 0 */
export function assertFiniteNonNegative(val: number, name: string): void {
  if (!Number.isFinite(val) || val < 0) {
    throw new ValidationError(name, `Must be finite and >= 0, received ${val}`);
  }
}

/** Asserts number is finite and within [min, max] fraction range */
export function assertFractionRange(val: number, name: string, min = 0, max = 1): void {
  if (!Number.isFinite(val) || val < min || val > max) {
    throw new ValidationError(name, `Must be in range [${min}, ${max}], received ${val}`);
  }
}

/** Asserts initial state-of-charge does not violate DoD floor */
export function assertInitialSocAboveFloor(initialSocPercent: number, maxAllowedDodPercent: number): void {
  assertFractionRange(initialSocPercent, "initialSocPercent", 0, 100);
  assertFractionRange(maxAllowedDodPercent, "maxAllowedDodPercent", 0, 100);
  const minPermittedSoc = 100 - maxAllowedDodPercent;
  if (initialSocPercent < minPermittedSoc) {
    throw new ValidationError(
      "initialSocPercent",
      `Initial State of Charge (${initialSocPercent}%) cannot start below the minimum permitted DoD floor (${minPermittedSoc}%)`
    );
  }
}
