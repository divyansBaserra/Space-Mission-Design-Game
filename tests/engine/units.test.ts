import { describe, expect, it } from "bun:test";
import {
  kg,
  g,
  watts,
  wattHours,
  kilometers,
  meters,
  seconds,
  minutes,
  hours,
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
  assertFinitePositive,
  assertFiniteNonNegative,
  assertFractionRange,
  assertInitialSocAboveFloor,
  ValidationError,
} from "../../src/engine/units";

describe("src/engine/units.ts", () => {
  describe("Nominal Branded Casting Constructors", () => {
    it("preserves numeric values with branded types", () => {
      expect(kg(2.5)).toBe(2.5);
      expect(g(2500)).toBe(2500);
      expect(watts(100)).toBe(100);
      expect(wattHours(40)).toBe(40);
      expect(kilometers(1000)).toBe(1000);
      expect(meters(500)).toBe(500);
      expect(seconds(60)).toBe(60);
      expect(minutes(30)).toBe(30);
      expect(hours(2)).toBe(2);
      expect(dB(3.0)).toBe(3.0);
      expect(dBW(10)).toBe(10);
      expect(dBi(6)).toBe(6);
      expect(dBHz(80)).toBe(80);
      expect(dBW_Hz(-206.8)).toBe(-206.8);
    });
  });

  describe("Physical Unit Conversions", () => {
    it("converts grams and kilograms bidirectionally", () => {
      expect(toKilograms(g(2500))).toBe(2.5);
      expect(toGrams(kg(3.5))).toBe(3500);
    });

    it("converts kilometers and meters bidirectionally", () => {
      expect(kilometersToMeters(kilometers(500))).toBe(500000);
      expect(metersToKilometers(meters(1200))).toBe(1.2);
    });

    it("converts time units accurately", () => {
      expect(minutesToHours(minutes(90))).toBe(1.5);
      expect(hoursToMinutes(hours(1.5))).toBe(90);
      expect(secondsToMinutes(seconds(120))).toBe(2);
      expect(minutesToSeconds(minutes(2))).toBe(120);
    });

    it("converts Watts to dBW and vice-versa", () => {
      // 1 W = 0 dBW
      expect(wattsToDbw(watts(1.0))).toBeCloseTo(0.0, 4);
      // 2 W = 10*log10(2) = 3.0103 dBW
      expect(wattsToDbw(watts(2.0))).toBeCloseTo(3.0103, 4);
      // 10 W = 10 dBW
      expect(wattsToDbw(watts(10.0))).toBeCloseTo(10.0, 4);
      // 100 W = 20 dBW
      expect(wattsToDbw(watts(100.0))).toBeCloseTo(20.0, 4);

      // Inverse conversions
      expect(dbwToWatts(dBW(0.0))).toBeCloseTo(1.0, 4);
      expect(dbwToWatts(dBW(3.0103))).toBeCloseTo(2.0, 4);
      expect(dbwToWatts(dBW(10.0))).toBeCloseTo(10.0, 4);
    });
  });

  describe("Precondition Guards & Assertions", () => {
    it("validates assertFinitePositive", () => {
      expect(() => assertFinitePositive(10, "testParam")).not.toThrow();
      expect(() => assertFinitePositive(0.001, "testParam")).not.toThrow();
      expect(() => assertFinitePositive(0, "testParam")).toThrow(ValidationError);
      expect(() => assertFinitePositive(-5, "testParam")).toThrow(ValidationError);
      expect(() => assertFinitePositive(NaN, "testParam")).toThrow(ValidationError);
      expect(() => assertFinitePositive(Infinity, "testParam")).toThrow(ValidationError);
    });

    it("validates assertFiniteNonNegative", () => {
      expect(() => assertFiniteNonNegative(0, "testParam")).not.toThrow();
      expect(() => assertFiniteNonNegative(5.5, "testParam")).not.toThrow();
      expect(() => assertFiniteNonNegative(-0.0001, "testParam")).toThrow(ValidationError);
      expect(() => assertFiniteNonNegative(NaN, "testParam")).toThrow(ValidationError);
      expect(() => assertFiniteNonNegative(-Infinity, "testParam")).toThrow(ValidationError);
    });

    it("validates assertFractionRange", () => {
      expect(() => assertFractionRange(0, "fraction")).not.toThrow();
      expect(() => assertFractionRange(0.5, "fraction")).not.toThrow();
      expect(() => assertFractionRange(1, "fraction")).not.toThrow();
      expect(() => assertFractionRange(-0.01, "fraction")).toThrow(ValidationError);
      expect(() => assertFractionRange(1.01, "fraction")).toThrow(ValidationError);
      expect(() => assertFractionRange(NaN, "fraction")).toThrow(ValidationError);
      // Custom bounds
      expect(() => assertFractionRange(50, "percentage", 0, 100)).not.toThrow();
      expect(() => assertFractionRange(101, "percentage", 0, 100)).toThrow(ValidationError);
    });

    it("validates assertInitialSocAboveFloor", () => {
      // 30% max DoD => min SoC is 70%
      expect(() => assertInitialSocAboveFloor(100, 30)).not.toThrow();
      expect(() => assertInitialSocAboveFloor(70, 30)).not.toThrow();
      expect(() => assertInitialSocAboveFloor(69.9, 30)).toThrow(ValidationError);
      expect(() => assertInitialSocAboveFloor(50, 30)).toThrow(ValidationError);
    });
  });
});
