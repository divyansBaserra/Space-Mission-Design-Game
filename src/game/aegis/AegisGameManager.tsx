"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import * as THREE from "three";
import AegisCanvas from "./AegisCanvas";
import { AegisHUD } from "./AegisHUD";
import { AegisAct } from "./AegisScene";
import {
  calculateOberthSlingshot,
  calculateSmartNavGuidance,
  calculateTargetBoulderCep,
  calculateOrbitalPeriodDeflection,
  MARS_CONSTANTS,
  DIDYMOS_SYSTEM,
} from "./aegisMath";
import { soundManager } from "../audio";

export interface AegisGameManagerProps {
  onReturnToHub: () => void;
  onLaunchEuropa?: () => void;
}

export function AegisGameManager({ onReturnToHub, onLaunchEuropa }: AegisGameManagerProps) {
  const [currentAct, setCurrentAct] = useState<AegisAct>("ACT_I_MARS_OBERTH");
  const [velocityKms, setVelocityKms] = useState<number>(MARS_CONSTANTS.baselineBurnVelocityKms);
  const [distanceKm, setDistanceKm] = useState<number>(180.0);
  const [lateralOffsetX, setLateralOffsetX] = useState<number>(1.8);
  const [lateralOffsetY, setLateralOffsetY] = useState<number>(-1.2);
  const [rcsFiringX, setRcsFiringX] = useState<number>(0);
  const [rcsFiringY, setRcsFiringY] = useState<number>(0);
  const [burnThrottle, setBurnThrottle] = useState<number>(0);
  const [isSmartNavLocked, setIsSmartNavLocked] = useState<boolean>(false);
  const [impactTriggered, setImpactTriggered] = useState<boolean>(false);
  const [ejectaProgress, setEjectaProgress] = useState<number>(0);
  const [score, setScore] = useState<number>(0);

  // Derived calculations
  const cepData = calculateTargetBoulderCep(lateralOffsetX, lateralOffsetY);
  const deflectionData = calculateOrbitalPeriodDeflection(6.2, 3.6, 570);

  // Guidance vectors
  const relPos = new THREE.Vector3(lateralOffsetX, lateralOffsetY, -Math.max(1, distanceKm * 1000));
  const relVel = new THREE.Vector3(0, 0, 6200);
  const guidance = calculateSmartNavGuidance(relPos, relVel);

  // --------------------------------------------------------------------------
  // Act I: Oberth Slingshot Burn Action
  // --------------------------------------------------------------------------
  const handleIgniteOberthBurn = useCallback(() => {
    soundManager.playEngineRoar();
    setBurnThrottle(1.0);

    const slingshot = calculateOberthSlingshot(MARS_CONSTANTS.baselineBurnVelocityKms, 180.0);

    let progress = 0;
    const interval = setInterval(() => {
      progress += 0.1;
      setVelocityKms((v) => {
        const next = Math.min(slingshot.vHypEgressKms, v + 0.12);
        return Number(next.toFixed(2));
      });

      if (progress >= 1.0) {
        clearInterval(interval);
        setBurnThrottle(0);
        soundManager.speakRadioComm(
          "Aegis Flight, Mars periapsis burn nominal. Oberth effect amplification confirmed at 11.4 kilometers per second egress.",
          "HOUSTON"
        );
        setScore((s) => s + 500);
      }
    }, 100);
  }, []);

  // --------------------------------------------------------------------------
  // Act II: SMART Nav Autonomous Optical Lock
  // --------------------------------------------------------------------------
  const handleEngageSmartNav = useCallback(() => {
    soundManager.playEquip();
    soundManager.playBeaconChime();
    setIsSmartNavLocked(true);
    setScore((s) => s + 750);
    soundManager.speakRadioComm(
      "Optical SMART Nav lock confirmed on Dimorphos center-of-mass. Autonomous proportional navigation active.",
      "HOUSTON"
    );
  }, []);

  // --------------------------------------------------------------------------
  // Act III: Cold-Gas RCS Micro-thruster Steering
  // --------------------------------------------------------------------------
  const handleFireRcs = useCallback((dirX: number, dirY: number) => {
    soundManager.playThrusterPuff();
    setRcsFiringX(dirX);
    setRcsFiringY(dirY);

    setLateralOffsetX((x) => Number((x + dirX * 0.45).toFixed(2)));
    setLateralOffsetY((y) => Number((y + dirY * 0.45).toFixed(2)));

    setTimeout(() => {
      setRcsFiringX(0);
      setRcsFiringY(0);
    }, 200);
  }, []);

  // --------------------------------------------------------------------------
  // Transition between acts
  // --------------------------------------------------------------------------
  const handleNextAct = useCallback(() => {
    soundManager.playEquip();
    if (currentAct === "ACT_I_MARS_OBERTH") {
      setCurrentAct("ACT_II_SMART_NAV");
      setVelocityKms(11.4);
      setDistanceKm(42000.0);
    } else if (currentAct === "ACT_II_SMART_NAV") {
      setCurrentAct("ACT_III_TERMINAL_RUN");
      setVelocityKms(6.2);
      setDistanceKm(12.0);
      soundManager.startDopplerWhine(6.2);
      soundManager.speakRadioComm(
        "Aegis IV entering terminal hypervelocity run. Closing speed 6.2 kilometers per second. Maintain target boulder lock.",
        "HOUSTON"
      );
    }
  }, [currentAct]);

  // --------------------------------------------------------------------------
  // Act III: Terminal Hypervelocity Impact Loop
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (currentAct !== "ACT_III_TERMINAL_RUN" || impactTriggered) return;

    const timer = setInterval(() => {
      setDistanceKm((dist) => {
        // Closing at hypervelocity: 6.2 km/s (scaled for 12-second run)
        const next = Math.max(0, dist - 0.95);

        // Update Doppler whine pitch as distance collapses
        soundManager.updateDopplerWhine(Math.max(1.0, 6.2 * (next / 12.0)));

        // Solar radiation pressure drift
        setLateralOffsetX((x) => x + (Math.random() - 0.48) * 0.08);
        setLateralOffsetY((y) => y + (Math.random() - 0.48) * 0.08);

        if (next <= 0.05) {
          clearInterval(timer);
          // Impact triggered!
          setImpactTriggered(true);
          soundManager.playKineticImpactCrunch();

          const accuracyBonus = cepData.isWithinCepTarget ? 1500 : 500;
          setScore((s) => s + accuracyBonus);

          // Transition to Act IV LICIACube observer after 1.2s
          setTimeout(() => {
            setCurrentAct("ACT_IV_LICIACUBE");
            soundManager.speakRadioComm(
              "Impact confirmed! Telemetry loss on Aegis-IV. Switching to companion CubeSat LICIACube.",
              "HOUSTON"
            );
          }, 1200);
        }
        return Number(next.toFixed(2));
      });
    }, 150);

    return () => clearInterval(timer);
  }, [currentAct, impactTriggered, cepData.isWithinCepTarget]);

  // --------------------------------------------------------------------------
  // Act IV: LICIACube Telemetry & Beacon Pulses
  // --------------------------------------------------------------------------
  useEffect(() => {
    if (currentAct !== "ACT_IV_LICIACUBE") return;

    // Expanding ejecta animation loop
    const ejectaTimer = setInterval(() => {
      setEjectaProgress((p) => Math.min(1.0, p + 0.04));
    }, 100);

    // Periodic 1800 Hz LICIACube beacon pulses
    const beaconTimer = setInterval(() => {
      soundManager.playLiciacubeBeacon();
    }, 1800);

    soundManager.speakRadioComm(
      "LICIACube LUKE imager confirms massive ejecta cloud. Doppler radar verifies 32-minute orbital period reduction. Planetary defense successful!",
      "HOUSTON"
    );

    return () => {
      clearInterval(ejectaTimer);
      clearInterval(beaconTimer);
    };
  }, [currentAct]);

  // --------------------------------------------------------------------------
  // Keyboard Listeners for Game 02
  // --------------------------------------------------------------------------
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      const isSpace = e.code === "Space" || e.key === " ";
      const isEnter = e.code === "Enter" || e.key === "Enter";
      const isKeyE = e.code === "KeyE" || e.key?.toLowerCase() === "e";
      const isKeyW = e.code === "KeyW" || e.key?.toLowerCase() === "w" || e.code === "ArrowUp";
      const isKeyA = e.code === "KeyA" || e.key?.toLowerCase() === "a" || e.code === "ArrowLeft";
      const isKeyS = e.code === "KeyS" || e.key?.toLowerCase() === "s" || e.code === "ArrowDown";
      const isKeyD = e.code === "KeyD" || e.key?.toLowerCase() === "d" || e.code === "ArrowRight";

      if ((isSpace || isEnter) && currentAct === "ACT_I_MARS_OBERTH") {
        e.preventDefault();
        if (velocityKms >= 11.3) {
          handleNextAct();
        } else {
          handleIgniteOberthBurn();
        }
      } else if (currentAct === "ACT_II_SMART_NAV") {
        if (isKeyE || (isSpace && !isSmartNavLocked)) {
          e.preventDefault();
          handleEngageSmartNav();
        } else if ((isEnter || isSpace) && isSmartNavLocked) {
          e.preventDefault();
          handleNextAct();
        }
      } else if (currentAct === "ACT_III_TERMINAL_RUN" && !impactTriggered) {
        if (isKeyA) {
          e.preventDefault();
          handleFireRcs(-1, 0);
        } else if (isKeyD) {
          e.preventDefault();
          handleFireRcs(1, 0);
        } else if (isKeyW) {
          e.preventDefault();
          handleFireRcs(0, -1);
        } else if (isKeyS) {
          e.preventDefault();
          handleFireRcs(0, 1);
        }
      } else if (currentAct === "ACT_IV_LICIACUBE") {
        if (isEnter || isSpace) {
          e.preventDefault();
          if (onLaunchEuropa) {
            onLaunchEuropa();
          } else {
            onReturnToHub();
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentAct, impactTriggered, velocityKms, isSmartNavLocked, handleIgniteOberthBurn, handleEngageSmartNav, handleFireRcs, handleNextAct, onLaunchEuropa, onReturnToHub]);

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden", backgroundColor: "#040608" }}>
      <AegisCanvas
        currentAct={currentAct}
        closingVelocityKms={velocityKms}
        distanceToTargetKm={distanceKm}
        lateralOffsetX={lateralOffsetX}
        lateralOffsetY={lateralOffsetY}
        rcsFiringX={rcsFiringX}
        rcsFiringY={rcsFiringY}
        isSmartNavLocked={isSmartNavLocked}
        impactTriggered={impactTriggered}
        ejectaProgress={ejectaProgress}
        burnThrottle={burnThrottle}
      />

      <AegisHUD
        currentAct={currentAct}
        velocityKms={velocityKms}
        distanceKm={distanceKm}
        lateralOffsetX={lateralOffsetX}
        lateralOffsetY={lateralOffsetY}
        omegaLosMagnitude={guidance.omegaLosMagnitude}
        isSmartNavLocked={isSmartNavLocked}
        impactTriggered={impactTriggered}
        cepDistanceM={cepData.cepDistanceMeters}
        isWithinCep={cepData.isWithinCepTarget}
        periodShiftMinutes={deflectionData.periodShiftMinutes}
        planetaryDefenseConfirmed={deflectionData.planetaryDefenseConfirmed}
        burnThrottle={burnThrottle}
        score={score}
        onIgniteOberthBurn={handleIgniteOberthBurn}
        onEngageSmartNav={handleEngageSmartNav}
        onFireRcs={handleFireRcs}
        onNextAct={handleNextAct}
        onReturnToHub={onReturnToHub}
        onLaunchEuropa={onLaunchEuropa}
      />
    </div>
  );
}
export default AegisGameManager;
