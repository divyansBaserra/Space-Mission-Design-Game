"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import * as THREE from "three";
import EuropaCanvas from "./EuropaCanvas";
import EuropaHUD from "./EuropaHUD";
import { type EuropaAct } from "./EuropaScene";
import { soundManager } from "../audio";
import {
  calculateHydrostaticPressureMpa,
  evaluateRnaBiomarker,
  simulateIcePenetration,
  calculateSonarRangeMeters,
} from "./europaMath";

interface EuropaGameManagerProps {
  onReturnToHub: () => void;
}

export default function EuropaGameManager({ onReturnToHub }: EuropaGameManagerProps) {
  // Act State
  const [act, setAct] = useState<EuropaAct>("ACT_1_SURFACE_DESCENT");

  // Act I: Surface Descent State
  const [radiationFluxRads, setRadiationFluxRads] = useState<number>(400.0);
  const [shieldAlignmentPercent, setShieldAlignmentPercent] = useState<number>(98.2);
  const [altitudeMeters, setAltitudeMeters] = useState<number>(45.0);
  const [isLanded, setIsLanded] = useState<boolean>(false);

  // Act II: Cryo-Melt State
  const [reactorPowerPercent, setReactorPowerPercent] = useState<number>(100);
  const [meltDepthMeters, setMeltDepthMeters] = useState<number>(18450);

  // Act III: Abyssal Sub State
  const [subPosition, setSubPosition] = useState<THREE.Vector3>(() => new THREE.Vector3(0, 0, 5.0));
  const [subRotation, setSubRotation] = useState<THREE.Euler>(() => new THREE.Euler(0, 0, 0));
  const [subDepthMeters, setSubDepthMeters] = useState<number>(5200.0);
  const [sonarPingTrigger, setSonarPingTrigger] = useState<number>(0);
  const [sonarDistanceMeters, setSonarDistanceMeters] = useState<number>(19.0);
  const [waterTempCelsius, setWaterTempCelsius] = useState<number>(4.1);

  // Act IV: Sampling & RNA Discovery State
  const [isSampling, setIsSampling] = useState<boolean>(false);
  const [sampleCollected, setSampleCollected] = useState<boolean>(false);
  const [clawExtension, setClawExtension] = useState<number>(0);
  const [shannonEntropyBits, setShannonEntropyBits] = useState<number>(1.94);
  const [carbonRatio, setCarbonRatio] = useState<number>(-34.5);
  const [score, setScore] = useState<number>(750);

  // Dynamic hydrostatic pressure
  const hydrostaticPressureMpa = calculateHydrostaticPressureMpa(
    act === "ACT_2_CRYO_MELT" ? meltDepthMeters : subDepthMeters
  );

  // Clean up procedural audio on unmount
  useEffect(() => {
    return () => {
      soundManager.stopAbyssalDrone();
      soundManager.stopHydrothermalBoil();
    };
  }, []);

  // Handle Act I Landing Burn
  const handleIgniteLanding = useCallback(() => {
    soundManager.playEngineRoar();
    let currentAlt = altitudeMeters;
    const interval = setInterval(() => {
      currentAlt = Math.max(0, currentAlt - 6.0);
      setAltitudeMeters(currentAlt);
      if (currentAlt <= 0) {
        clearInterval(interval);
        setIsLanded(true);
        soundManager.playSuccessFanfare();
        setScore((prev) => prev + 500);
      }
    }, 100);
  }, [altitudeMeters]);

  // Transition from Act I -> Act II
  const handleProceedToAct2 = useCallback(() => {
    soundManager.playEquip();
    setAct("ACT_2_CRYO_MELT");
    setScore((prev) => prev + 400);
  }, []);

  // Handle Act II Reactor Throttle & Methane Evade
  const handleThrottleReactor = useCallback((delta: number) => {
    soundManager.playRcsBurst();
    setReactorPowerPercent((prev) => Math.min(100, Math.max(20, prev + delta)));
    setMeltDepthMeters((prev) => Math.min(20000, prev + 250));
    setScore((prev) => prev + 150);
  }, []);

  const handleEvadeMethane = useCallback((direction: number) => {
    soundManager.playThrusterPuff();
    setMeltDepthMeters((prev) => Math.min(20000, prev + 150));
    setScore((prev) => prev + 100);
  }, []);

  // Transition from Act II -> Act III (Ocean Breach)
  const handleProceedToAct3 = useCallback(() => {
    soundManager.playQuindarTone(false);
    soundManager.startAbyssalDrone();
    soundManager.playHullPressureCreak();
    soundManager.startHydrothermalBoil();
    setAct("ACT_3_ABYSSAL_SUB");
    setScore((prev) => prev + 750);
  }, []);

  // Handle Act III Active Sonar Ping
  const handleFireSonar = useCallback(() => {
    soundManager.playActiveSonarPing();
    setSonarPingTrigger((prev) => prev + 1);
    setScore((prev) => prev + 50);

    // Recompute target distance towards hydrothermal vent chimney at [0, -6, -14]
    const target = new THREE.Vector3(0, -6, -14);
    const dist = subPosition.distanceTo(target);
    setSonarDistanceMeters(dist);

    if (dist < 20.0) {
      soundManager.playHullPressureCreak();
    }
  }, [subPosition]);

  // Handle Submarine 6-DOF Movement
  const handleMoveSub = useCallback((dx: number, dy: number, dz: number) => {
    soundManager.playRcsBurst();
    setSubPosition((prev) => {
      const next = prev.clone().add(new THREE.Vector3(dx, dy, dz));
      const target = new THREE.Vector3(0, -6, -14);
      const dist = next.distanceTo(target);
      setSonarDistanceMeters(dist);
      setWaterTempCelsius(Math.min(350, 4.0 + (1.0 / Math.max(0.1, dist)) * 12.0));
      return next;
    });
  }, []);

  // Transition from Act III -> Act IV (Claw Sampling)
  const handleProceedToAct4 = useCallback(() => {
    soundManager.playEquip();
    setAct("ACT_4_SAMPLE_DISCOVERY");
    setScore((prev) => prev + 1000);
  }, []);

  // Handle Act IV Robotic Claw Sample Extraction
  const handleExtractSample = useCallback(() => {
    setIsSampling(true);
    soundManager.playRcsBurst();

    let ext = 0;
    const interval = setInterval(() => {
      ext += 0.2;
      setClawExtension(ext);
      if (ext >= 1.0) {
        clearInterval(interval);
        setSampleCollected(true);
        setIsSampling(false);

        // Biogenic RNA evaluation confirmation
        const biomarker = evaluateRnaBiomarker([28, 26, 25, 25]);
        setShannonEntropyBits(biomarker.shannonEntropyBits);
        setCarbonRatio(biomarker.carbonIsotopeRatioPerMil);

        soundManager.playSuccessFanfare();
        setScore((prev) => prev + 2500);
      }
    }, 120);
  }, []);

  // Global Keyboard Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        if (act === "ACT_1_SURFACE_DESCENT" && !isLanded) {
          handleIgniteLanding();
        } else if (act === "ACT_3_ABYSSAL_SUB") {
          handleFireSonar();
        } else if (act === "ACT_4_SAMPLE_DISCOVERY" && !sampleCollected) {
          handleExtractSample();
        }
      } else if (e.code === "KeyW") {
        if (act === "ACT_2_CRYO_MELT") {
          handleThrottleReactor(10);
        } else if (act === "ACT_3_ABYSSAL_SUB") {
          handleMoveSub(0, 0, -2.0);
        }
      } else if (e.code === "KeyS") {
        if (act === "ACT_3_ABYSSAL_SUB") {
          handleMoveSub(0, 0, 2.0);
        }
      } else if (e.code === "KeyA") {
        if (act === "ACT_2_CRYO_MELT") {
          handleEvadeMethane(-1);
        } else if (act === "ACT_3_ABYSSAL_SUB") {
          handleMoveSub(-1.5, 0, 0);
        }
      } else if (e.code === "KeyD") {
        if (act === "ACT_2_CRYO_MELT") {
          handleEvadeMethane(1);
        } else if (act === "ACT_3_ABYSSAL_SUB") {
          handleMoveSub(1.5, 0, 0);
        }
      } else if (e.code === "KeyQ") {
        if (act === "ACT_3_ABYSSAL_SUB") {
          handleMoveSub(0, -1.0, 0);
        }
      } else if (e.code === "KeyE") {
        if (act === "ACT_3_ABYSSAL_SUB") {
          handleMoveSub(0, 1.0, 0);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    act,
    isLanded,
    sampleCollected,
    handleIgniteLanding,
    handleFireSonar,
    handleExtractSample,
    handleThrottleReactor,
    handleEvadeMethane,
    handleMoveSub,
  ]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden", backgroundColor: "#020408" }}>
      <EuropaCanvas
        act={act}
        reactorPowerPercent={reactorPowerPercent}
        meltDepthMeters={meltDepthMeters}
        subPosition={subPosition}
        subRotation={subRotation}
        sonarPingTrigger={sonarPingTrigger}
        isSampling={isSampling}
        sampleCollected={sampleCollected}
        clawExtension={clawExtension}
      />
      <EuropaHUD
        act={act}
        radiationFluxRads={radiationFluxRads}
        shieldAlignmentPercent={shieldAlignmentPercent}
        altitudeMeters={altitudeMeters}
        isLanded={isLanded}
        reactorPowerPercent={reactorPowerPercent}
        meltDepthMeters={meltDepthMeters}
        subDepthMeters={subDepthMeters}
        hydrostaticPressureMpa={hydrostaticPressureMpa}
        waterTempCelsius={waterTempCelsius}
        sonarDistanceMeters={sonarDistanceMeters}
        isSampling={isSampling}
        sampleCollected={sampleCollected}
        shannonEntropyBits={shannonEntropyBits}
        carbonRatio={carbonRatio}
        score={score}
        onIgniteLanding={handleIgniteLanding}
        onProceedToAct2={handleProceedToAct2}
        onThrottleReactor={handleThrottleReactor}
        onEvadeMethane={handleEvadeMethane}
        onProceedToAct3={handleProceedToAct3}
        onFireSonar={handleFireSonar}
        onMoveSub={handleMoveSub}
        onProceedToAct4={handleProceedToAct4}
        onExtractSample={handleExtractSample}
        onReturnToHub={onReturnToHub}
      />
    </div>
  );
}
