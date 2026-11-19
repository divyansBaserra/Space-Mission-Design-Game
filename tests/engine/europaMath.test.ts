import { describe, it, expect } from "bun:test";
import {
  calculateMeltVelocityMps,
  simulateIcePenetration,
  calculateHydrostaticPressureMpa,
  calculateNetBuoyancyForceN,
  calculateHydrodynamicDragN,
  calculateSonarRangeMeters,
  evaluateRnaBiomarker,
  EUROPA_CONSTANTS,
  type CryoProbeParams,
  type AbyssalHydroParams,
} from "../../src/game/europa/europaMath";

describe("GAME 03: PROJECT EUROPA - Cryospheric & Abyssal Physics", () => {
  describe("Act II: Nuclear Cryo-Melt Penetration Physics", () => {
    it("calibrates melt penetration rate to ~80 m/hr with 250 kW reactor core", () => {
      const probe: CryoProbeParams = {
        thermalPowerWatts: 280000,
        probeRadiusMeters: 0.08,
        iceSurfaceTempKelvin: 100,
        iceMeltingTempKelvin: 273.15,
      };

      const result = calculateMeltVelocityMps(probe);
      expect(result.velocityMetersPerHour > 60.0).toBe(true);
      expect(result.velocityMetersPerHour < 100.0).toBe(true);
      expect(result.specificEnergyJPerKg > 600000).toBe(true);
    });

    it("slows melt penetration when methane hazard gas pockets are encountered", () => {
      const nominalDepth = simulateIcePenetration(0, 100, 0.022, 0.0);
      const obstructedDepth = simulateIcePenetration(0, 100, 0.022, 0.8);
      expect(nominalDepth > obstructedDepth).toBe(true);
    });
  });

  describe("Act III: Hydrostatic Pressure & Hydrodynamics", () => {
    it("computes ~130 MPa crushing hydrostatic pressure at 95,000 meters depth", () => {
      const pressureMpa = calculateHydrostaticPressureMpa(95000);
      expect(pressureMpa > 120.0).toBe(true);
      expect(pressureMpa < 140.0).toBe(true);
    });

    it("calculates neutral/stable buoyancy force for deep-sea submersible", () => {
      const subParams: AbyssalHydroParams = {
        submersibleMassKg: 1200,
        submersibleVolumeM3: 1.17,
        seawaterDensityKgM3: EUROPA_CONSTANTS.seawaterDensityKgM3,
        europaGravityMps2: EUROPA_CONSTANTS.gravityMps2,
        dragCoefficient: 0.35,
        frontalAreaM2: 1.2,
      };

      const buoyancyN = calculateNetBuoyancyForceN(subParams);
      expect(buoyancyN > 0).toBe(true);
      expect(buoyancyN < 20).toBe(true);
    });

    it("evaluates quadratic hydrodynamic drag scaling with velocity squared", () => {
      const subParams: AbyssalHydroParams = {
        submersibleMassKg: 1200,
        submersibleVolumeM3: 1.17,
        seawaterDensityKgM3: EUROPA_CONSTANTS.seawaterDensityKgM3,
        europaGravityMps2: EUROPA_CONSTANTS.gravityMps2,
        dragCoefficient: 0.35,
        frontalAreaM2: 1.2,
      };

      const dragSlow = calculateHydrodynamicDragN(1.0, subParams);
      const dragFast = calculateHydrodynamicDragN(2.0, subParams);
      expect(dragFast > dragSlow * 3.5).toBe(true);
    });

    it("triangulates sonar echo distance using speed of sound in saline water", () => {
      const echoTime = 2.0;
      const range = calculateSonarRangeMeters(echoTime);
      expect(range).toBe(1440.0);
    });
  });

  describe("Act IV: Astrobiology RNA Ribosomal Biomarker Mass Spectrometry", () => {
    it("confirms biogenic alien life when nucleotide sequence exhibits high informational entropy and organic carbon depletion", () => {
      const biomarker = evaluateRnaBiomarker([25, 27, 24, 24]);
      expect(biomarker.shannonEntropyBits > 1.9).toBe(true);
      expect(biomarker.isBiogenicLifeConfirmed).toBe(true);
      expect(biomarker.carbonIsotopeRatioPerMil < -30.0).toBe(true);
    });

    it("rejects non-living mineral sample with zero entropy", () => {
      const biomarker = evaluateRnaBiomarker([100, 0, 0, 0]);
      expect(biomarker.shannonEntropyBits < 0.1).toBe(true);
      expect(biomarker.isBiogenicLifeConfirmed).toBe(false);
    });
  });
});
