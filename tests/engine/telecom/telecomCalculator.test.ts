/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Telecom Link Budget Calculator Unit Tests
 *
 * Verifies link budget calculations against Phase 2A Specification §7 and §8.4 baselines,
 * including S-band reference case T-1, UHF CubeSat baseline, negative gains, margin checks,
 * validation boundaries, and deterministic immutability.
 */

import { describe, it, expect } from "bun:test";
import {
  calculateLinkBudget,
  calculateTelecomLinkBudget,
  calculateTelecom,
  calculateTotalLosses,
  calculateFspl,
  calculateEirp,
  calculateNoiseSpectralDensity,
  TelecomInput,
  LinkBudgetInput,
  SPEED_OF_LIGHT_MPS,
  BOLTZMANN_CONSTANT_J_PER_K,
  BOLTZMANN_CONSTANT_DBW_PER_K_HZ,
  FSPL_CONSTANT_DB,
  TELECOM_SCOPE_NOTE,
  EDUCATIONAL_MODEL_NOTE,
} from "../../../src/engine/telecom/telecomCalculator";
import {
  watts,
  kilometers,
  hertz,
  dB,
  dBi,
  ValidationError,
} from "../../../src/engine/units";

const EPSILON = 1e-4;

function isClose(actual: number, expected: number, tol: number = EPSILON): boolean {
  return Math.abs(actual - expected) <= tol;
}

describe("Telecom Link Budget Calculator", () => {
  describe("Constants & Metadata", () => {
    it("exports standard physical constants and scope notes matching specification", () => {
      expect(SPEED_OF_LIGHT_MPS).toBe(299792458);
      expect(BOLTZMANN_CONSTANT_J_PER_K).toBe(1.380649e-23);
      expect(BOLTZMANN_CONSTANT_DBW_PER_K_HZ).toBe(-228.5992);
      expect(FSPL_CONSTANT_DB).toBe(-147.5522);
      expect(TELECOM_SCOPE_NOTE).toBe(
        "Ideal link budget; atmospheric and ionospheric attenuation evaluated in Phase 4"
      );
      expect(EDUCATIONAL_MODEL_NOTE).toBe(
        "Simplified educational engineering model; does not constitute flight-safety certification or formal launch-provider compliance."
      );
    });

    it("exports function aliases that refer to the exact same implementation", () => {
      expect(calculateTelecomLinkBudget).toBe(calculateLinkBudget);
      expect(calculateTelecom).toBe(calculateLinkBudget);
    });
  });

  describe("Specification §8.4 Case T-1: S-Band Downlink Reference Baseline", () => {
    const caseT1Input: LinkBudgetInput = {
      carrierFrequencyHz: hertz(2.2e9), // 2.2 GHz S-Band
      slantRangeKm: kilometers(1000.0),  // 1000 km (10^6 m)
      transmitPowerWatts: watts(2.0),    // 2.0 W (+3.0103 dBW)
      transmitAntennaGainDbi: dBi(3.0),  // +3.0 dBi patch
      receiveAntennaGainDbi: dBi(38.0),  // +38.0 dBi ground parabolic dish
      losses: {
        txLineLossDb: dB(1.0),
        rxLineLossDb: dB(0.5),
        pointingLossDb: dB(1.0),
        polarizationLossDb: dB(0.0),
      },
      systemNoiseTemperatureK: 150.0,    // 150 K
      dataRateBps: 1.0e6,                // 1.0 Mbps
      requiredEbN0Db: dB(10.5),          // 10.5 dB
      requiredLinkMarginDb: dB(6.0),     // 6.0 dB required margin
    };

    it("accurately calculates Case T-1 intermediate and final RF quantities within 1e-4 tolerance", () => {
      const res = calculateLinkBudget(caseT1Input);

      // Transmit Power: 10 * log10(2.0) = +3.0103 dBW
      expect(isClose(res.transmitPowerDbw, 3.0103)).toBeTrue();
      expect(res.txPowerDbw).toBe(res.transmitPowerDbw);

      // EIRP: 3.0103 + 3.0 - 1.0 = +5.0103 dBW
      expect(isClose(res.eirpDbw, 5.0103)).toBeTrue();

      // Free Space Path Loss: 20*log10(10^6) + 20*log10(2.2e9) - 147.5522 = 159.2963 dB
      expect(isClose(res.freeSpacePathLossDb, 159.2963)).toBeTrue();
      expect(res.fsplDb).toBe(res.freeSpacePathLossDb);

      // Total Losses: 1.0 + 0.5 + 1.0 + 0.0 = 2.5 dB
      expect(isClose(res.totalLossesDb, 2.5)).toBeTrue();

      // Received Carrier Power: 5.0103 - 159.2963 + 38.0 - (0.5 + 1.0 + 0.0) = -117.7860 dBW
      expect(isClose(res.receivedPowerDbw, -117.7860)).toBeTrue();
      expect(res.rxPowerDbw).toBe(res.receivedPowerDbw);

      // Noise Spectral Density N0: -228.5992 + 10*log10(150) = -206.8383 dBW/Hz
      expect(isClose(res.noiseSpectralDensityDbwPerHz, -206.8383)).toBeTrue();
      expect(res.noiseSpectralDensityDbwHz).toBe(res.noiseSpectralDensityDbwPerHz);

      // Carrier-to-Noise Density C/N0: -117.7860 - (-206.8383) = 89.0523 dBHz
      expect(isClose(res.carrierToNoiseDensityDbHz, 89.0523)).toBeTrue();

      // Received Eb/N0: 89.0523 - 10*log10(1e6) = 29.0523 dB
      expect(isClose(res.energyPerBitToNoiseDensityDb, 29.0523)).toBeTrue();
      expect(res.receivedEbN0Db).toBe(res.energyPerBitToNoiseDensityDb);

      // Link Margin: 29.0523 - 10.5 = 18.5523 dB
      expect(isClose(res.linkMarginDb, 18.5523)).toBeTrue();

      // Feasibility: 18.5523 >= 6.0 dB required margin -> true
      expect(res.linkFeasible).toBeTrue();

      // Scope note verification
      expect(res.scopeNote).toBe(TELECOM_SCOPE_NOTE);
      expect(res.educationalModelNote).toBe(EDUCATIONAL_MODEL_NOTE);
      expect(Object.isFrozen(res)).toBeTrue();
    });

    it("accepts canonical specification alias property names (frequencyHz, distanceKm, etc.)", () => {
      const aliasInput: LinkBudgetInput = {
        frequencyHz: hertz(2.2e9),
        distanceKm: kilometers(1000.0),
        transmitPowerWatts: watts(2.0),
        txAntennaGainDbi: dBi(3.0),
        rxAntennaGainDbi: dBi(38.0),
        systemNoiseTempKelvin: 150.0,
        dataRateBps: 1.0e6,
        requiredEbN0Db: dB(10.5),
        losses: {
          txLineLossDb: dB(1.0),
          rxLineLossDb: dB(0.5),
          pointingLossDb: dB(1.0),
          polarizationLossDb: dB(0.0),
        },
        requiredLinkMarginDb: dB(6.0),
      };

      const res = calculateLinkBudget(aliasInput);
      expect(isClose(res.linkMarginDb, 18.5523)).toBeTrue();
      expect(res.linkFeasible).toBeTrue();
    });
  });

  describe("UHF 437.5 MHz Amateur CubeSat Downlink Baseline", () => {
    const uhfInput: TelecomInput = {
      carrierFrequencyHz: hertz(437.5e6), // 437.5 MHz
      slantRangeKm: kilometers(800.0),    // 800 km LEO slant range
      transmitPowerWatts: watts(1.0),     // 1.0 W (0.0 dBW)
      transmitAntennaGainDbi: dBi(0.0),   // 0.0 dBi dipole
      receiveAntennaGainDbi: dBi(14.0),   // 14.0 dBi ground Yagi
      losses: {
        txLineLossDb: dB(1.0),
        rxLineLossDb: dB(0.5),
        pointingLossDb: dB(1.0),
        polarizationLossDb: dB(3.0),
      },
      systemNoiseTemperatureK: 450.0,     // 450 K noisy ground UHF station
      dataRateBps: 9600,                  // 9600 bps telemetry
      requiredEbN0Db: dB(10.0),           // 10.0 dB
    };

    it("accurately calculates UHF 9600 bps telemetry link budget within 1e-4 tolerance", () => {
      const res = calculateLinkBudget(uhfInput);

      expect(isClose(res.transmitPowerDbw, 0.0)).toBeTrue();
      expect(isClose(res.eirpDbw, -1.0)).toBeTrue();
      expect(isClose(res.freeSpacePathLossDb, 143.3292)).toBeTrue();
      expect(isClose(res.totalLossesDb, 5.5)).toBeTrue();
      expect(isClose(res.receivedPowerDbw, -134.8292)).toBeTrue();
      expect(isClose(res.noiseSpectralDensityDbwPerHz, -202.0671)).toBeTrue();
      expect(isClose(res.carrierToNoiseDensityDbHz, 67.2379)).toBeTrue();
      expect(isClose(res.energyPerBitToNoiseDensityDb, 27.4152)).toBeTrue();
      expect(isClose(res.linkMarginDb, 17.4152)).toBeTrue();
      expect(res.linkFeasible).toBeTrue();
    });
  });

  describe("Margin & Feasibility Edge Cases", () => {
    it("reports linkFeasible = false when link margin is negative due to high data rate", () => {
      const highRateInput: TelecomInput = {
        carrierFrequencyHz: hertz(437.5e6),
        slantRangeKm: kilometers(800.0),
        transmitPowerWatts: watts(0.1), // Low power 100 mW (-10 dBW)
        transmitAntennaGainDbi: dBi(0.0),
        receiveAntennaGainDbi: dBi(5.0),
        losses: {
          txLineLossDb: dB(1.0),
          rxLineLossDb: dB(1.0),
          pointingLossDb: dB(2.0),
          polarizationLossDb: dB(3.0),
        },
        systemNoiseTemperatureK: 500.0,
        dataRateBps: 5.0e6, // 5 Mbps on UHF
        requiredEbN0Db: dB(12.0),
      };

      const res = calculateLinkBudget(highRateInput);
      expect(res.linkMarginDb < 0.0).toBeTrue();
      expect(res.linkFeasible).toBeFalse();
    });

    it("reports linkFeasible = false when link margin is positive but below specified requiredLinkMarginDb", () => {
      const tightMarginInput: TelecomInput = {
        carrierFrequencyHz: hertz(2.2e9),
        slantRangeKm: kilometers(2000.0),
        transmitPowerWatts: watts(1.0),
        transmitAntennaGainDbi: dBi(0.0),
        receiveAntennaGainDbi: dBi(30.0),
        losses: {
          txLineLossDb: dB(1.0),
          rxLineLossDb: dB(1.0),
          pointingLossDb: dB(1.0),
          polarizationLossDb: dB(1.0),
        },
        systemNoiseTemperatureK: 200.0,
        dataRateBps: 500000,
        requiredEbN0Db: dB(10.0),
        requiredLinkMarginDb: dB(12.0), // Demands 12 dB margin
      };

      const res = calculateLinkBudget(tightMarginInput);
      // Even if margin is positive (e.g. 5 dB), it fails the 12 dB requirement
      expect(res.linkMarginDb < 12.0).toBeTrue();
      expect(res.linkFeasible).toBeFalse();
    });

    it("evaluates exactly closed link (margin = 0.0 dB) as feasible", () => {
      // Create a case where Eb/N0 equals requiredEbN0Db exactly
      const baseInput: TelecomInput = {
        carrierFrequencyHz: hertz(1.0e9),
        slantRangeKm: kilometers(100.0),
        transmitPowerWatts: watts(1.0),
        transmitAntennaGainDbi: dBi(0.0),
        receiveAntennaGainDbi: dBi(0.0),
        losses: {
          txLineLossDb: dB(0.0),
          rxLineLossDb: dB(0.0),
          pointingLossDb: dB(0.0),
          polarizationLossDb: dB(0.0),
        },
        systemNoiseTemperatureK: 290.0,
        dataRateBps: 1000,
        requiredEbN0Db: dB(0.0), // Will be set to receivedEbN0Db
      };

      const firstPass = calculateLinkBudget(baseInput);
      const exactInput: TelecomInput = {
        ...baseInput,
        requiredEbN0Db: dB(firstPass.energyPerBitToNoiseDensityDb),
      };

      const exactRes = calculateLinkBudget(exactInput);
      expect(isClose(exactRes.linkMarginDb, 0.0)).toBeTrue();
      expect(exactRes.linkFeasible).toBeTrue();
    });
  });

  describe("Antenna Gains & Distance Boundaries", () => {
    it("handles negative antenna gains properly (e.g. antenna nulls or omni loss)", () => {
      const negativeGainInput: TelecomInput = {
        carrierFrequencyHz: hertz(400e6),
        slantRangeKm: kilometers(500.0),
        transmitPowerWatts: watts(0.5),
        transmitAntennaGainDbi: dBi(-3.5), // -3.5 dBi antenna null
        receiveAntennaGainDbi: dBi(-1.0),  // -1.0 dBi ground antenna null
        losses: {
          txLineLossDb: dB(0.5),
          rxLineLossDb: dB(0.5),
          pointingLossDb: dB(0.5),
          polarizationLossDb: dB(0.5),
        },
        systemNoiseTemperatureK: 300.0,
        dataRateBps: 1200,
        requiredEbN0Db: dB(8.0),
      };

      const res = calculateLinkBudget(negativeGainInput);
      expect(Number.isFinite(res.eirpDbw)).toBeTrue();
      expect(Number.isFinite(res.receivedPowerDbw)).toBeTrue();
      expect(Number.isFinite(res.linkMarginDb)).toBeTrue();
      // EIRP = 10*log10(0.5) + (-3.5) - 0.5 = -3.0103 - 3.5 - 0.5 = -7.0103 dBW
      expect(isClose(res.eirpDbw, -7.0103)).toBeTrue();
    });

    it("evaluates deep-space lunar distance link budget with low system noise temperature", () => {
      const lunarInput: TelecomInput = {
        carrierFrequencyHz: hertz(8.45e9),     // 8.45 GHz X-Band
        slantRangeKm: kilometers(384400.0),    // Lunar distance 384,400 km
        transmitPowerWatts: watts(10.0),       // 10 W (+10 dBW)
        transmitAntennaGainDbi: dBi(12.0),     // Medium gain antenna
        receiveAntennaGainDbi: dBi(68.0),      // 70 m DSN dish
        losses: {
          txLineLossDb: dB(1.0),
          rxLineLossDb: dB(0.2),
          pointingLossDb: dB(0.5),
          polarizationLossDb: dB(0.3),
        },
        systemNoiseTemperatureK: 25.0,         // Cryogenic receiver 25 K
        dataRateBps: 100000,                   // 100 kbps
        requiredEbN0Db: dB(3.0),               // Turbo/LDPC code
      };

      const res = calculateLinkBudget(lunarInput);
      expect(res.freeSpacePathLossDb > 220.0).toBeTrue();
      expect(Number.isFinite(res.carrierToNoiseDensityDbHz)).toBeTrue();
      expect(Number.isFinite(res.linkMarginDb)).toBeTrue();
      expect(res.linkFeasible).toBeTrue();
    });
  });

  describe("Helper Functions", () => {
    it("calculateTotalLosses accurately sums all 4 disaggregated loss components", () => {
      const losses = {
        txLineLossDb: dB(1.2),
        rxLineLossDb: dB(0.8),
        pointingLossDb: dB(1.5),
        polarizationLossDb: dB(3.0),
      };
      const total = calculateTotalLosses(losses);
      expect(isClose(total, 6.5)).toBeTrue();
    });

    it("calculateFspl matches theoretical path loss", () => {
      // 100 km at 1 GHz:
      // d = 100,000 m (10^5) -> 20*log10(10^5) = 100 dB
      // f = 10^9 Hz -> 20*log10(10^9) = 180 dB
      // FSPL = 100 + 180 - 147.5522 = 132.4478 dB
      const fspl = calculateFspl(kilometers(100.0), hertz(1.0e9));
      expect(isClose(fspl, 132.4478)).toBeTrue();
    });

    it("calculateEirp accurately computes radiated power", () => {
      // 5 W = +6.9897 dBW, Gain = 6 dBi, Loss = 1 dB -> 6.9897 + 6 - 1 = 11.9897 dBW
      const eirp = calculateEirp(watts(5.0), dBi(6.0), dB(1.0));
      expect(isClose(eirp, 11.9897)).toBeTrue();
    });

    it("calculateNoiseSpectralDensity accurately scales with temperature", () => {
      // T = 290 K standard noise temp: -228.5992 + 10*log10(290) = -228.5992 + 24.6240 = -203.9752 dBW/Hz
      const n0 = calculateNoiseSpectralDensity(290.0);
      expect(isClose(n0, -203.9752)).toBeTrue();
    });
  });

  describe("Input Validation & Safety Precondition Guards", () => {
    const validBase: TelecomInput = {
      carrierFrequencyHz: hertz(2.2e9),
      slantRangeKm: kilometers(1000.0),
      transmitPowerWatts: watts(2.0),
      transmitAntennaGainDbi: dBi(3.0),
      receiveAntennaGainDbi: dBi(38.0),
      losses: {
        txLineLossDb: dB(1.0),
        rxLineLossDb: dB(0.5),
        pointingLossDb: dB(1.0),
        polarizationLossDb: dB(0.0),
      },
      systemNoiseTemperatureK: 150.0,
      dataRateBps: 1.0e6,
      requiredEbN0Db: dB(10.5),
    };

    it("rejects null or non-object input", () => {
      expect(() => calculateLinkBudget(null as unknown as TelecomInput)).toThrow(ValidationError);
      expect(() => calculateLinkBudget(undefined as unknown as TelecomInput)).toThrow(ValidationError);
      expect(() => calculateLinkBudget("invalid" as unknown as TelecomInput)).toThrow(ValidationError);
    });

    it("rejects non-positive transmit power (0 W, negative, NaN, Infinity)", () => {
      expect(() => calculateLinkBudget({ ...validBase, transmitPowerWatts: watts(0) })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, transmitPowerWatts: watts(-2.0) })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, transmitPowerWatts: watts(NaN) })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, transmitPowerWatts: watts(Infinity) })).toThrow(ValidationError);
    });

    it("rejects non-positive frequency (0 Hz, negative, NaN, Infinity)", () => {
      expect(() => calculateLinkBudget({ ...validBase, carrierFrequencyHz: hertz(0) })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, carrierFrequencyHz: hertz(-100) })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, carrierFrequencyHz: hertz(NaN) })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, carrierFrequencyHz: hertz(Infinity) })).toThrow(ValidationError);
    });

    it("rejects non-positive distance (0 km, negative, NaN, Infinity)", () => {
      expect(() => calculateLinkBudget({ ...validBase, slantRangeKm: kilometers(0) })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, slantRangeKm: kilometers(-500) })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, slantRangeKm: kilometers(NaN) })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, slantRangeKm: kilometers(Infinity) })).toThrow(ValidationError);
    });

    it("rejects non-finite antenna gains (NaN, Infinity)", () => {
      expect(() => calculateLinkBudget({ ...validBase, transmitAntennaGainDbi: dBi(NaN) })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, transmitAntennaGainDbi: dBi(Infinity) })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, receiveAntennaGainDbi: dBi(NaN) })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, receiveAntennaGainDbi: dBi(-Infinity) })).toThrow(ValidationError);
    });

    it("rejects non-positive system noise temperature (0 K, negative, NaN, Infinity)", () => {
      expect(() => calculateLinkBudget({ ...validBase, systemNoiseTemperatureK: 0 })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, systemNoiseTemperatureK: -100 })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, systemNoiseTemperatureK: NaN })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, systemNoiseTemperatureK: Infinity })).toThrow(ValidationError);
    });

    it("rejects non-positive data rate (0 bps, negative, NaN, Infinity)", () => {
      expect(() => calculateLinkBudget({ ...validBase, dataRateBps: 0 })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, dataRateBps: -9600 })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, dataRateBps: NaN })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, dataRateBps: Infinity })).toThrow(ValidationError);
    });

    it("rejects non-finite required Eb/N0 (NaN, Infinity)", () => {
      expect(() => calculateLinkBudget({ ...validBase, requiredEbN0Db: dB(NaN) })).toThrow(ValidationError);
      expect(() => calculateLinkBudget({ ...validBase, requiredEbN0Db: dB(Infinity) })).toThrow(ValidationError);
    });

    it("rejects negative line losses", () => {
      expect(() =>
        calculateLinkBudget({
          ...validBase,
          losses: { ...validBase.losses, txLineLossDb: dB(-0.5) },
        })
      ).toThrow(ValidationError);
      expect(() =>
        calculateLinkBudget({
          ...validBase,
          losses: { ...validBase.losses, rxLineLossDb: dB(-0.1) },
        })
      ).toThrow(ValidationError);
      expect(() =>
        calculateLinkBudget({
          ...validBase,
          losses: { ...validBase.losses, pointingLossDb: dB(-1.0) },
        })
      ).toThrow(ValidationError);
      expect(() =>
        calculateLinkBudget({
          ...validBase,
          losses: { ...validBase.losses, polarizationLossDb: dB(-0.2) },
        })
      ).toThrow(ValidationError);
    });

    it("rejects missing or non-object losses", () => {
      expect(() =>
        calculateLinkBudget({
          ...validBase,
          losses: null as unknown as TelecomInput["losses"],
        })
      ).toThrow(ValidationError);
    });

    it("rejects non-finite requiredLinkMarginDb if provided", () => {
      expect(() =>
        calculateLinkBudget({
          ...validBase,
          requiredLinkMarginDb: dB(NaN),
        })
      ).toThrow(ValidationError);
      expect(() =>
        calculateLinkBudget({
          ...validBase,
          requiredLinkMarginDb: dB(Infinity),
        })
      ).toThrow(ValidationError);
    });
  });
});
