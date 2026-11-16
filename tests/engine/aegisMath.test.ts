import { describe, expect, it } from "bun:test";
import * as THREE from "three";
import {
  calculateOberthSlingshot,
  calculateSmartNavGuidance,
  calculateTargetBoulderCep,
  calculateOrbitalPeriodDeflection,
  MARS_CONSTANTS,
  PROBE_AEGIS,
} from "../../src/game/aegis/aegisMath";

describe("GAME 02: PROJECT AEGIS - Astrodynamics Verification", () => {
  describe("Act I: Mars Oberth Slingshot", () => {
    it("computes nominal hyperbolic egress velocity matching 11.4 km/s specification", () => {
      const res = calculateOberthSlingshot(MARS_CONSTANTS.baselineBurnVelocityKms, MARS_CONSTANTS.periapsisAltitudeKm);
      expect(res.rPeriapsisKm).toBe(3389.5 + 180.0);
      expect(Math.abs(res.vHypEgressKms - 11.406) < 0.05).toBe(true);
      expect(res.isNominalEgress).toBe(true);
      expect(res.deltaEnergyMjPerKg > 11.5).toBe(true);
    });

    it("evaluates sub-optimal egress when burn velocity is too low", () => {
      const res = calculateOberthSlingshot(5.0, 180.0);
      expect(res.vHypEgressKms < 8.0).toBe(true);
      expect(res.isNominalEgress).toBe(false);
    });
  });

  describe("Act II: Autonomous SMART Nav Optical Guidance", () => {
    it("calculates accurate line-of-sight angular rate and proportional acceleration", () => {
      const relPos = new THREE.Vector3(0, 0, -10000); // 10 km down Z-axis
      const relVel = new THREE.Vector3(50, 0, 6200); // Lateral drift + 6.2 km/s closing

      const guidance = calculateSmartNavGuidance(relPos, relVel, PROBE_AEGIS.navConstantN);
      expect(guidance.distanceMeters).toBe(10000);
      expect(guidance.closingSpeedMps).toBe(6200);
      expect(guidance.omegaLosMagnitude > 0).toBe(true);
      expect(guidance.cmdAccelMagnitude > 0).toBe(true);
    });

    it("verifies locked tracking reticle when line-of-sight rate is near zero", () => {
      const relPos = new THREE.Vector3(0, 0, -25000);
      const relVel = new THREE.Vector3(0, 0, 6200); // Perfectly centered on line-of-sight

      const guidance = calculateSmartNavGuidance(relPos, relVel, 3.5);
      expect(guidance.omegaLosMagnitude).toBe(0);
      expect(guidance.cmdAccelMagnitude).toBe(0);
      expect(guidance.isLocked).toBe(true);
    });
  });

  describe("Act III: Circular Error Probable (CEP)", () => {
    it("evaluates impact inside 3-meter target boulder", () => {
      const hit = calculateTargetBoulderCep(1.2, -1.5);
      expect(hit.cepDistanceMeters < 3.0).toBe(true);
      expect(hit.isWithinCepTarget).toBe(true);
      expect(hit.accuracyScore > 800).toBe(true);
    });

    it("flags impact outside 3-meter CEP when offset is large", () => {
      const miss = calculateTargetBoulderCep(4.5, 3.0);
      expect(miss.cepDistanceMeters > 5.0).toBe(true);
      expect(miss.isWithinCepTarget).toBe(false);
    });
  });

  describe("Act IV: Binary Asteroid Orbital Period Deflection", () => {
    it("confirms deflection period shift exceeds NASA 73-second threshold", () => {
      const deflection = calculateOrbitalPeriodDeflection(6.2, 3.6, 570);
      expect(deflection.periodShiftSeconds >= 73.0).toBe(true);
      expect(deflection.periodShiftMinutes > 25.0).toBe(true); // NASA DART achieved ~32 minutes
      expect(deflection.missionDeflectionSuccess).toBe(true);
      expect(deflection.planetaryDefenseConfirmed).toBe(true);
    });

    it("scales momentum transfer with ejecta recoil factor beta", () => {
      const def1 = calculateOrbitalPeriodDeflection(6.2, 1.0, 570); // No ejecta recoil (beta=1)
      const def3 = calculateOrbitalPeriodDeflection(6.2, 3.6, 570); // Full ejecta recoil (beta=3.6)
      expect(def3.effectiveTransferredMomentumNs > def1.effectiveTransferredMomentumNs * 3.5).toBe(true);
    });
  });
});
