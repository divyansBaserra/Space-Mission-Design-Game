"use client";

import React, { useState, useMemo } from "react";
import { soundManager } from "@/game/audio";

interface FlightAcademyProps {
  onBackToHub: () => void;
  onLaunchGame1: () => void;
  onLaunchGame2: () => void;
  onLaunchGame3: () => void;
}

type MissionTab = "GAME1" | "GAME2" | "GAME3";

export function FlightAcademyPage({
  onBackToHub,
  onLaunchGame1,
  onLaunchGame2,
  onLaunchGame3,
}: FlightAcademyProps) {
  const [activeMission, setActiveMission] = useState<MissionTab>("GAME1");
  const [activeKey, setActiveKey] = useState<string | null>(null);

  // --------------------------------------------------------------------------
  // CALCULATOR 1: CUBESAT MASS BUDGET & CDS STANDARDS
  // --------------------------------------------------------------------------
  const [formFactor, setFormFactor] = useState<"1U" | "3U" | "6U" | "12U">("3U");
  const [payloadMass, setPayloadMass] = useState<number>(1.2);
  const [busMass, setBusMass] = useState<number>(2.4);
  const [propellantMass, setPropellantMass] = useState<number>(0.6);

  const cdsLimits = {
    "1U": 2.0,
    "3U": 6.0,
    "6U": 12.0,
    "12U": 24.0,
  };

  const massCalc = useMemo(() => {
    const limit = cdsLimits[formFactor];
    const dryMassCBE = payloadMass + busMass;
    const mga = dryMassCBE * 0.15; // 15% Mass Growth Allowance
    const dryMassMEV = dryMassCBE + mga;
    const totalWetMass = dryMassMEV + propellantMass;
    const massHeadroom = limit - totalWetMass;
    const dryMassMargin = ((limit - dryMassCBE) / dryMassCBE) * 100;
    const isCompliant = totalWetMass <= limit;
    const isCML4Compliant = dryMassMargin >= 35.0;

    return {
      limit,
      dryMassCBE,
      mga,
      dryMassMEV,
      totalWetMass,
      massHeadroom,
      dryMassMargin,
      isCompliant,
      isCML4Compliant,
    };
  }, [formFactor, payloadMass, busMass, propellantMass]);

  // --------------------------------------------------------------------------
  // CALCULATOR 2: SOLAR POWER & ORBITAL THERMAL BALANCE
  // --------------------------------------------------------------------------
  const [altitudeKm, setAltitudeKm] = useState<number>(600);
  const [panelAreaM2, setPanelAreaM2] = useState<number>(0.24);
  const [batteryWh, setBatteryWh] = useState<number>(45);
  const [powerDrawW, setPowerDrawW] = useState<number>(18);

  const powerCalc = useMemo(() => {
    // Earth constants
    const rEarth = 6371; // km
    const mu = 398600.4418; // km^3/s^2
    const a = rEarth + altitudeKm;
    // Keplerian Orbit Period T = 2 * pi * sqrt(a^3 / mu)
    const periodSec = 2 * Math.PI * Math.sqrt(Math.pow(a, 3) / mu);
    const periodMin = periodSec / 60;

    // Eclipse geometry (spherical Earth shadow)
    const theta = Math.asin(rEarth / a);
    const eclipseFraction = theta / Math.PI;
    const eclipseMin = periodMin * eclipseFraction;
    const sunlitMin = periodMin - eclipseMin;

    // GaAs Triple-Junction Solar Power Generation (S = 1361 W/m^2, efficiency = 29.5%)
    const solarFlux = 1361; // W/m^2
    const solarEfficiency = 0.295;
    const solarGenWatts = panelAreaM2 * solarFlux * solarEfficiency;

    // Energy during eclipse
    const energyConsumedEclipseWh = (powerDrawW * eclipseMin) / 60;
    const dodPercent = (energyConsumedEclipseWh / batteryWh) * 100;

    // Stefan-Boltzmann Thermal Equilibrium (Absorptivity = 0.85, Emissivity = 0.80)
    // T_eq = [ (S * alpha) / (4 * sigma * epsilon) ] ^ (1/4)
    const sigma = 5.670374419e-8;
    const alpha = 0.85;
    const epsilon = 0.8;
    const tempKelvin = Math.pow((solarFlux * alpha) / (4 * sigma * epsilon), 0.25);
    const tempCelsius = tempKelvin - 273.15;

    const isPowerPositive = solarGenWatts * (sunlitMin / periodMin) > powerDrawW;
    const isDodNominal = dodPercent <= 25.0;

    return {
      periodMin,
      eclipseMin,
      sunlitMin,
      solarGenWatts,
      energyConsumedEclipseWh,
      dodPercent,
      tempCelsius,
      isPowerPositive,
      isDodNominal,
    };
  }, [altitudeKm, panelAreaM2, batteryWh, powerDrawW]);

  // --------------------------------------------------------------------------
  // CALCULATOR 3: FRIIS TELECOM LINK BUDGET
  // --------------------------------------------------------------------------
  const [band, setBand] = useState<"UHF" | "SBAND" | "XBAND">("SBAND");
  const [txPowerW, setTxPowerW] = useState<number>(2.0);
  const [distanceKm, setDistanceKm] = useState<number>(600);
  const [dataRateKbps, setDataRateKbps] = useState<number>(128);

  const telecomCalc = useMemo(() => {
    const freqs = {
      UHF: 437.5e6,
      SBAND: 2.2e9,
      XBAND: 8.4e9,
    };
    const gains = {
      UHF: { tx: 0.0, rx: 12.0 },
      SBAND: { tx: 6.0, rx: 26.0 },
      XBAND: { tx: 14.0, rx: 34.0 },
    };

    const freqHz = freqs[band];
    const { tx: txGainDbi, rx: rxGainDbi } = gains[band];
    const dMeters = distanceKm * 1000;

    // P_tx_dBW = 10 * log10(P_Watts)
    const pTxDbw = 10 * Math.log10(txPowerW);
    const eirpDbw = pTxDbw + txGainDbi - 1.0; // 1.0 dB line loss

    // FSPL = 20*log10(d) + 20*log10(f) - 147.5522
    const fsplDb =
      20 * Math.log10(dMeters) + 20 * Math.log10(freqHz) - 147.5522;

    const totalLosses = 2.5; // rx line loss + pointing loss + polarization loss
    const pRxDbw = eirpDbw - fsplDb + rxGainDbi - totalLosses;

    // Noise Spectral Density N0 = -228.6 + 10*log10(Tsys)
    const tSys = 150; // Kelvin
    const n0DbwHz = -228.5992 + 10 * Math.log10(tSys);
    const cn0 = pRxDbw - n0DbwHz;

    // Eb/N0 = C/N0 - 10*log10(BitRate)
    const ebN0 = cn0 - 10 * Math.log10(dataRateKbps * 1000);
    const reqEbN0 = 9.6; // dB for BER 10^-5 with QPSK
    const linkMargin = ebN0 - reqEbN0;
    const isLinkClosed = linkMargin >= 3.0; // NASA requires +3 dB margin

    return {
      eirpDbw,
      fsplDb,
      pRxDbw,
      cn0,
      ebN0,
      linkMargin,
      isLinkClosed,
    };
  }, [band, txPowerW, distanceKm, dataRateKbps]);

  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        width: "100vw",
        overflowY: "auto",
        backgroundColor: "#06090e",
        color: "#f8fafc",
        fontFamily: "var(--font-sans, system-ui, -apple-system, sans-serif)",
      }}
    >
      {/* ==================================================================== */}
      {/* TOP COMMAND HEADER BAR                                               */}
      {/* ==================================================================== */}
      <header
        style={{
          position: "sticky",
          top: 0,
          zIndex: 40,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 24px",
          backgroundColor: "rgba(10, 14, 22, 0.96)",
          borderBottom: "1.5px solid rgba(56, 189, 248, 0.25)",
          backdropFilter: "blur(12px)",
          boxShadow: "0 4px 20px rgba(0, 0, 0, 0.8)",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <button
            onClick={() => {
              soundManager.playEquip();
              onBackToHub();
            }}
            style={{
              padding: "6px 12px",
              fontSize: "12px",
              fontWeight: 700,
              color: "#38bdf8",
              backgroundColor: "rgba(56, 189, 248, 0.12)",
              border: "1px solid rgba(56, 189, 248, 0.35)",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            ← MISSION HUB
          </button>
          <div style={{ width: "1px", height: "18px", backgroundColor: "rgba(255, 255, 255, 0.15)" }} />
          <div>
            <div style={{ fontSize: "10px", color: "#22c55e", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase", fontFamily: "monospace" }}>
              NASA SPACE APPS 2026 // FLIGHT OPERATIONS ACADEMY
            </div>
            <h1 style={{ fontSize: "15px", fontWeight: 800, color: "#ffffff", letterSpacing: "0.02em", margin: 0 }}>
              FLIGHT ACADEMY &amp; ASTRODYNAMICS REFERENCE LAB
            </h1>
          </div>
        </div>

        {/* Direct Action Launchers */}
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button
            onClick={() => {
              soundManager.playEngineRoar();
              onLaunchGame1();
            }}
            style={{
              padding: "7px 14px",
              backgroundColor: "rgba(2, 132, 199, 0.3)",
              border: "1px solid #38bdf8",
              color: "#38bdf8",
              fontSize: "11px",
              fontWeight: 800,
              borderRadius: "4px",
              cursor: "pointer",
              boxShadow: "0 0 12px rgba(56, 189, 248, 0.25)",
            }}
          >
            ▶ PLAY GAME 01: ARTEMIS-VII
          </button>
          <button
            onClick={() => {
              soundManager.playEngineRoar();
              onLaunchGame2();
            }}
            style={{
              padding: "7px 14px",
              backgroundColor: "rgba(245, 158, 11, 0.25)",
              border: "1px solid #f59e0b",
              color: "#fbbf24",
              fontSize: "11px",
              fontWeight: 800,
              borderRadius: "4px",
              cursor: "pointer",
              boxShadow: "0 0 12px rgba(245, 158, 11, 0.25)",
            }}
          >
            ▶ PLAY GAME 02: AEGIS (DART)
          </button>
          <button
            onClick={() => {
              soundManager.playEngineRoar();
              onLaunchGame3();
            }}
            style={{
              padding: "7px 14px",
              backgroundColor: "rgba(14, 165, 233, 0.25)",
              border: "1px solid #0ea5e9",
              color: "#7dd3fc",
              fontSize: "11px",
              fontWeight: 800,
              borderRadius: "4px",
              cursor: "pointer",
              boxShadow: "0 0 12px rgba(14, 165, 233, 0.25)",
            }}
          >
            ▶ PLAY GAME 03: EUROPA
          </button>
        </div>
      </header>

      {/* ==================================================================== */}
      {/* MAIN ACADEMY BODY CONTAINER                                          */}
      {/* ==================================================================== */}
      <div style={{ flex: 1, maxWidth: "1280px", margin: "0 auto", width: "100%", padding: "24px 20px 48px" }}>
        {/* ================================================================== */}
        {/* SECTION 1: INTERACTIVE MISSION FLIGHT DIRECTIVES                    */}
        {/* ================================================================== */}
        <section style={{ marginBottom: "36px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", borderBottom: "1px solid rgba(56, 189, 248, 0.2)", paddingBottom: "12px", marginBottom: "18px", flexWrap: "wrap", gap: "10px" }}>
            <div>
              <span className="font-mono" style={{ fontSize: "11px", color: "#38bdf8", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
                SECTION 01 // MISSION OPERATIONS &amp; 6-DOF PILOTING
              </span>
              <h2 style={{ fontSize: "22px", fontWeight: 800, margin: "2px 0 0", color: "#ffffff" }}>
                Active Space Flight Briefings &amp; Controls Manual
              </h2>
            </div>

            {/* Interactive Mission Tabs */}
            <div style={{ display: "flex", gap: "6px", backgroundColor: "rgba(15, 23, 42, 0.8)", padding: "4px", borderRadius: "6px", border: "1px solid rgba(255, 255, 255, 0.1)" }}>
              <button
                onClick={() => {
                  soundManager.playEquip();
                  setActiveMission("GAME1");
                }}
                style={{
                  padding: "6px 14px",
                  fontSize: "11px",
                  fontWeight: 700,
                  backgroundColor: activeMission === "GAME1" ? "rgba(2, 132, 199, 0.35)" : "transparent",
                  color: activeMission === "GAME1" ? "#38bdf8" : "#94a3b8",
                  border: activeMission === "GAME1" ? "1px solid #38bdf8" : "1px solid transparent",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                01: ARTEMIS-VII
              </button>
              <button
                onClick={() => {
                  soundManager.playEquip();
                  setActiveMission("GAME2");
                }}
                style={{
                  padding: "6px 14px",
                  fontSize: "11px",
                  fontWeight: 700,
                  backgroundColor: activeMission === "GAME2" ? "rgba(245, 158, 11, 0.35)" : "transparent",
                  color: activeMission === "GAME2" ? "#f59e0b" : "#94a3b8",
                  border: activeMission === "GAME2" ? "1px solid #f59e0b" : "1px solid transparent",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                02: PROJECT AEGIS
              </button>
              <button
                onClick={() => {
                  soundManager.playEquip();
                  setActiveMission("GAME3");
                }}
                style={{
                  padding: "6px 14px",
                  fontSize: "11px",
                  fontWeight: 700,
                  backgroundColor: activeMission === "GAME3" ? "rgba(14, 165, 233, 0.35)" : "transparent",
                  color: activeMission === "GAME3" ? "#7dd3fc" : "#94a3b8",
                  border: activeMission === "GAME3" ? "1px solid #0ea5e9" : "1px solid transparent",
                  borderRadius: "4px",
                  cursor: "pointer",
                }}
              >
                03: PROJECT EUROPA
              </button>
            </div>
          </div>

          {/* Active Mission Card Detail */}
          {activeMission === "GAME1" && (
            <div style={{ backgroundColor: "rgba(13, 19, 31, 0.85)", border: "1.5px solid rgba(56, 189, 248, 0.3)", borderRadius: "8px", padding: "20px 24px", backdropFilter: "blur(10px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#38bdf8", fontFamily: "monospace", letterSpacing: "0.1em" }}>
                    MISSION 01: LUNAR CRADLE &amp; SHACKLETON TOUCHDOWN
                  </span>
                  <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#ffffff", margin: "2px 0 6px" }}>
                    Operation Artemis-VII (Orbital Facility &amp; Base Alpha)
                  </h3>
                  <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.5, margin: 0, maxWidth: "750px" }}>
                    A solar storm threatens the cis-lunar corridor. Astronauts must conduct zero-g spacewalk repair on orbital sentinel satellite AERO-3X, pilot utility shuttle ORV-1 through debris corridors to Gateway-1, and perform a powered lunar descent to deploy the Apollo ALSEP station in Shackleton Crater.
                  </p>
                </div>
                <button
                  onClick={() => {
                    soundManager.playEngineRoar();
                    onLaunchGame1();
                  }}
                  style={{
                    padding: "10px 18px",
                    backgroundColor: "#0284c7",
                    color: "#ffffff",
                    border: "1.5px solid #38bdf8",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 0 16px rgba(56, 189, 248, 0.4)",
                  }}
                >
                  ▶ LAUNCH OPERATION ARTEMIS-VII
                </button>
              </div>

              {/* 2-Column Progression breakdown */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginTop: "16px" }}>
                <div style={{ backgroundColor: "rgba(18, 26, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "6px", padding: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#38bdf8", letterSpacing: "0.08em", marginBottom: "8px", textTransform: "uppercase" }}>
                    Phase A: Station Logistics &amp; Microgravity EVA
                  </div>
                  <ul style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.6, paddingLeft: "18px", margin: 0 }}>
                    <li><strong>Command Deck:</strong> Review mission objectives at central holo-table `[E]`.</li>
                    <li><strong>Workshop:</strong> Equip Toolkit `[1]`, GaAs Solar Array `[2]`, and S-Band Transceiver `[3]` (`[E]` or 1-Click HUD Pill).</li>
                    <li><strong>Airlock Protocol:</strong> Cycle chamber to vacuum `[E]`. Spacewalk along gantry.</li>
                    <li><strong>AERO-3X Restoration:</strong> Detach damaged wing `[E]`, mount solar array `[E]`, install antenna `[E]`, and lock telemetry beacon `[E]`.</li>
                  </ul>
                </div>

                <div style={{ backgroundColor: "rgba(18, 26, 42, 0.6)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "6px", padding: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#22c55e", letterSpacing: "0.08em", marginBottom: "8px", textTransform: "uppercase" }}>
                    Phase B: 6-DOF Cockpit Piloting &amp; Lunar Touchdown
                  </div>
                  <ul style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.6, paddingLeft: "18px", margin: 0 }}>
                    <li><strong>Boarding:</strong> Enter ORV-1 cockpit at exterior gantry berth `[E]`.</li>
                    <li><strong>Flight Maneuvering:</strong> `[W/S]` main thrust, `[A/D]` yaw, `[Q/E]` roll, `[Space/C]` vertical RCS, `[X]` retrograde brake.</li>
                    <li><strong>Powered Descent:</strong> Press `[T]` to enter descent corridor into Shackleton Crater.</li>
                    <li><strong>Base Alpha Science:</strong> Deploy Apollo ALSEP station `[4 / E]`, collect core sample `CORE-GEO-01`, and board shuttle for ascent.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeMission === "GAME2" && (
            <div style={{ backgroundColor: "rgba(26, 20, 12, 0.85)", border: "1.5px solid rgba(245, 158, 11, 0.4)", borderRadius: "8px", padding: "20px 24px", backdropFilter: "blur(10px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#f59e0b", fontFamily: "monospace", letterSpacing: "0.1em" }}>
                    MISSION 02: DART HYPERVELOCITY DEFLECTION INITIATIVE
                  </span>
                  <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#ffffff", margin: "2px 0 6px" }}>
                    Project Aegis (Kinetic Impactor &amp; SMART Nav)
                  </h3>
                  <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.5, margin: 0, maxWidth: "750px" }}>
                    Planetary defense simulation against binary asteroid 65803 Didymos and its moonlet Dimorphos. Execute hyperbolic Mars Oberth slingshot, engage autonomous SMART Nav optical seeker to null line-of-sight angular drift, and achieve hypervelocity kinetic impact at 6.2 km/s.
                  </p>
                </div>
                <button
                  onClick={() => {
                    soundManager.playEngineRoar();
                    onLaunchGame2();
                  }}
                  style={{
                    padding: "10px 18px",
                    backgroundColor: "#d97706",
                    color: "#ffffff",
                    border: "1.5px solid #f59e0b",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 0 16px rgba(245, 158, 11, 0.4)",
                  }}
                >
                  ▶ LAUNCH PROJECT AEGIS
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginTop: "16px" }}>
                <div style={{ backgroundColor: "rgba(36, 26, 16, 0.6)", border: "1px solid rgba(245, 158, 11, 0.15)", borderRadius: "6px", padding: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#f59e0b", letterSpacing: "0.08em", marginBottom: "8px", textTransform: "uppercase" }}>
                    Act I &amp; II: Mars Oberth Slingshot &amp; Cruise
                  </div>
                  <ul style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.6, paddingLeft: "18px", margin: 0 }}>
                    <li><strong>Oberth Periapsis Burn:</strong> Throttle main engine `[Space]` at Mars closest approach to reach 11.4 km/s egress velocity.</li>
                    <li><strong>Mid-Course Trajectory Correction:</strong> Align spacecraft prograde vector with Didymos heliocentric transfer orbit.</li>
                  </ul>
                </div>

                <div style={{ backgroundColor: "rgba(36, 26, 16, 0.6)", border: "1px solid rgba(245, 158, 11, 0.15)", borderRadius: "6px", padding: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#22c55e", letterSpacing: "0.08em", marginBottom: "8px", textTransform: "uppercase" }}>
                    Act III &amp; IV: SMART Nav &amp; Kinetic Impact
                  </div>
                  <ul style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.6, paddingLeft: "18px", margin: 0 }}>
                    <li><strong>Optical Tracking:</strong> Use `[W/A/S/D]` thruster pulses to keep Dimorphos centered inside the reticle.</li>
                    <li><strong>Kinetic Collision:</strong> Impact target boulder within 3-meter CEP at 6.2 km/s. Verify binary period shift &gt; 73 seconds.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {activeMission === "GAME3" && (
            <div style={{ backgroundColor: "rgba(10, 20, 28, 0.85)", border: "1.5px solid rgba(14, 165, 233, 0.4)", borderRadius: "8px", padding: "20px 24px", backdropFilter: "blur(10px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
                <div>
                  <span style={{ fontSize: "11px", fontWeight: 800, color: "#38bdf8", fontFamily: "monospace", letterSpacing: "0.1em" }}>
                    MISSION 03: SUBTERRANEAN OCEAN CRYO-EXPLORATION
                  </span>
                  <h3 style={{ fontSize: "18px", fontWeight: 800, color: "#ffffff", margin: "2px 0 6px" }}>
                    Project Europa (Abyss of Jupiter)
                  </h3>
                  <p style={{ fontSize: "13px", color: "#94a3b8", lineHeight: 1.5, margin: 0, maxWidth: "750px" }}>
                    JPL OWLS cryo-explorer mission to find alien life in Europa&apos;s hidden ocean. Survive Jovian atmospheric braking, melt through 20 kilometers of ice crust with a 250 kW thermal nuclear probe, navigate pitch-black abyssal waters (5,200m depth, 130 MPa) via active sonar, and sample hydrothermal vents.
                  </p>
                </div>
                <button
                  onClick={() => {
                    soundManager.playEngineRoar();
                    onLaunchGame3();
                  }}
                  style={{
                    padding: "10px 18px",
                    backgroundColor: "#0284c7",
                    color: "#ffffff",
                    border: "1.5px solid #38bdf8",
                    borderRadius: "4px",
                    fontSize: "12px",
                    fontWeight: 800,
                    cursor: "pointer",
                    boxShadow: "0 0 16px rgba(14, 165, 233, 0.4)",
                  }}
                >
                  ▶ LAUNCH PROJECT EUROPA
                </button>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px", marginTop: "16px" }}>
                <div style={{ backgroundColor: "rgba(14, 28, 42, 0.6)", border: "1px solid rgba(56, 189, 248, 0.15)", borderRadius: "6px", padding: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#38bdf8", letterSpacing: "0.08em", marginBottom: "8px", textTransform: "uppercase" }}>
                    Act I &amp; II: Jovian Entry &amp; 900°C Cryo-Melt
                  </div>
                  <ul style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.6, paddingLeft: "18px", margin: 0 }}>
                    <li><strong>Atmospheric Capture:</strong> Fire retrograde RCS `[Space]` to touch down onto the Europan ice sheet.</li>
                    <li><strong>Thermal Penetration:</strong> Power 250 kW reactor core `[Space]` to bore through 20 km ice crust, dodging methane pockets.</li>
                  </ul>
                </div>

                <div style={{ backgroundColor: "rgba(14, 28, 42, 0.6)", border: "1px solid rgba(56, 189, 248, 0.15)", borderRadius: "6px", padding: "16px" }}>
                  <div style={{ fontSize: "12px", fontWeight: 800, color: "#22c55e", letterSpacing: "0.08em", marginBottom: "8px", textTransform: "uppercase" }}>
                    Act III &amp; IV: 130 MPa Sub &amp; Alien RNA
                  </div>
                  <ul style={{ fontSize: "12px", color: "#cbd5e1", lineHeight: 1.6, paddingLeft: "18px", margin: 0 }}>
                    <li><strong>Abyssal Sub Navigation:</strong> Steer with `[W/A/S/D]`, ping 1200 Hz active sonar `[Space]`, and home in on the 3D glowing waypoint ring.</li>
                    <li><strong>Hydrothermal Discovery:</strong> Deploy robotic sampling claw at &lt;10m range, sequence alien RNA nucleotides, and transmit confirmation to Earth.</li>
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Interactive 6-DOF Controls Visualizer Strip */}
          <div style={{ marginTop: "16px", backgroundColor: "rgba(15, 23, 42, 0.7)", border: "1px solid rgba(255, 255, 255, 0.1)", borderRadius: "6px", padding: "14px 18px" }}>
            <div style={{ fontSize: "11px", fontWeight: 800, color: "#94a3b8", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "10px" }}>
              INTERACTIVE 6-DOF FLIGHT CONTROLS &amp; RCS VECTORS SIMULATOR (CLICK KEYS TO TEST)
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              {[
                { key: "W", label: "MAIN THRUST (+Z)", effect: "FORWARD VECTOR ACCELERATION" },
                { key: "S", label: "RETROGRADE (-Z)", effect: "OPPOSING DECELERATION BRAKE" },
                { key: "A", label: "YAW PORT (-Y)", effect: "RCS NOSE SLEW LEFT" },
                { key: "D", label: "YAW STBD (+Y)", effect: "RCS NOSE SLEW RIGHT" },
                { key: "Q", label: "ROLL PORT (-X)", effect: "AXIAL CCW COUNTER-ROTATION" },
                { key: "E", label: "ROLL STBD (+X)", effect: "AXIAL CW CLOCKWISE ROTATION" },
                { key: "SPACE", label: "RCS UP / BRAKE", effect: "POSITIVE DORSAL HEAVE" },
                { key: "C", label: "RCS DOWN", effect: "NEGATIVE VENTRAL HEAVE" },
                { key: "G", label: "LANDING GEAR", effect: "TRIPLE OLEO STRUT EXTENSION" },
                { key: "T", label: "SECTOR / ORBIT", effect: "ATMOSPHERIC DESCENT BURN" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => {
                    soundManager.playThrusterPuff();
                    setActiveKey(item.key);
                  }}
                  style={{
                    padding: "6px 12px",
                    backgroundColor: activeKey === item.key ? "rgba(2, 132, 199, 0.4)" : "rgba(30, 41, 59, 0.8)",
                    border: activeKey === item.key ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.15)",
                    borderRadius: "4px",
                    color: activeKey === item.key ? "#38bdf8" : "#f8fafc",
                    fontSize: "11px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "2px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "#facc15" }}>[{item.key}]</span>
                  <span style={{ fontSize: "9px", color: "#94a3b8" }}>{item.label}</span>
                </button>
              ))}
            </div>
            {activeKey && (
              <div style={{ marginTop: "10px", fontSize: "12px", color: "#38bdf8", fontFamily: "monospace", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#38bdf8", boxShadow: "0 0 8px #38bdf8" }} />
                <span>SIMULATED RCS RESPONSE: {activeKey} FIRED &rarr; {[
                  { key: "W", effect: "Forward Main Thrusters 100% Throttle · Prograde Delta-V +4.5 m/s²" },
                  { key: "S", effect: "Bow RCS Quads Active · Retrograde Delta-V -3.2 m/s²" },
                  { key: "A", effect: "Left Wingtip Quad Firing · Yaw Rate -8.5 deg/sec" },
                  { key: "D", effect: "Right Wingtip Quad Firing · Yaw Rate +8.5 deg/sec" },
                  { key: "Q", effect: "Dorsal/Ventral Opposed RCS · Roll Rate -14.2 deg/sec" },
                  { key: "E", effect: "Dorsal/Ventral Opposed RCS · Roll Rate +14.2 deg/sec" },
                  { key: "SPACE", effect: "Ventral Thrusters Firing · Vertical Heave +2.0 m/s" },
                  { key: "C", effect: "Dorsal Thrusters Firing · Vertical Heave -2.0 m/s" },
                  { key: "G", effect: "Hydraulic Actuators Extending Three-Point Lunar Landing Skids" },
                  { key: "T", effect: "De-Orbit Guidance Computer Locked · Orbital Transfer Burn Nominal" },
                ].find((k) => k.key === activeKey)?.effect}</span>
              </div>
            )}
          </div>
        </section>

        {/* ================================================================== */}
        {/* SECTION 2: INTERACTIVE REAL-TIME ENGINEERING CALCULATORS           */}
        {/* ================================================================== */}
        <section>
          <div style={{ borderBottom: "1px solid rgba(56, 189, 248, 0.2)", paddingBottom: "12px", marginBottom: "20px" }}>
            <span className="font-mono" style={{ fontSize: "11px", color: "#22c55e", fontWeight: 800, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              SECTION 02 // CAL POLY CDS &amp; NASA JPL CML 4 SPECIFICATIONS
            </span>
            <h2 style={{ fontSize: "22px", fontWeight: 800, margin: "2px 0 0", color: "#ffffff" }}>
              Interactive Real-Time Engineering Physics Lab
            </h2>
            <p style={{ fontSize: "13px", color: "#94a3b8", margin: "4px 0 0" }}>
              Adjust live parameters to evaluate flight mass budgets, orbital power/thermal equilibrium, and RF space loss link margins.
            </p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "20px" }}>
            {/* -------------------------------------------------------------- */}
            {/* MODULE 1: CUBESAT MASS BUDGET CALCULATOR                       */}
            {/* -------------------------------------------------------------- */}
            <div style={{ backgroundColor: "rgba(15, 23, 42, 0.8)", border: "1.5px solid rgba(56, 189, 248, 0.3)", borderRadius: "8px", padding: "18px", backdropFilter: "blur(8px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <span style={{ fontSize: "10px", color: "#38bdf8", fontWeight: 800, fontFamily: "monospace" }}>MODULE 01</span>
                  <h3 style={{ fontSize: "15px", fontWeight: 800, margin: "0", color: "#ffffff" }}>CubeSat Mass &amp; CML 4 Margin</h3>
                </div>
                <span style={{ fontSize: "10px", fontWeight: 800, padding: "3px 8px", borderRadius: "3px", backgroundColor: massCalc.isCML4Compliant ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)", border: massCalc.isCML4Compliant ? "1px solid #22c55e" : "1px solid #ef4444", color: massCalc.isCML4Compliant ? "#86efac" : "#fca5a5" }}>
                  {massCalc.isCML4Compliant ? "✓ CML 4 NOMINAL" : "⚠ MARGIN DEFICIT"}
                </span>
              </div>

              {/* Form Factor Switcher */}
              <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
                {(["1U", "3U", "6U", "12U"] as const).map((ff) => (
                  <button
                    key={ff}
                    onClick={() => {
                      soundManager.playEquip();
                      setFormFactor(ff);
                    }}
                    style={{
                      flex: 1,
                      padding: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      backgroundColor: formFactor === ff ? "rgba(2, 132, 199, 0.3)" : "rgba(30, 41, 59, 0.6)",
                      border: formFactor === ff ? "1px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.1)",
                      color: formFactor === ff ? "#38bdf8" : "#94a3b8",
                      borderRadius: "3px",
                      cursor: "pointer",
                    }}
                  >
                    {ff} ({cdsLimits[ff]}kg)
                  </button>
                ))}
              </div>

              {/* Sliders */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span style={{ color: "#94a3b8" }}>Scientific Payload:</span>
                    <strong className="font-mono" style={{ color: "#ffffff" }}>{payloadMass.toFixed(2)} kg</strong>
                  </div>
                  <input
                    type="range"
                    min="0.2"
                    max={formFactor === "1U" ? 1.5 : formFactor === "3U" ? 4.5 : 12.0}
                    step="0.1"
                    value={payloadMass}
                    onChange={(e) => setPayloadMass(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#38bdf8" }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span style={{ color: "#94a3b8" }}>Bus Electronics &amp; Batteries:</span>
                    <strong className="font-mono" style={{ color: "#ffffff" }}>{busMass.toFixed(2)} kg</strong>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max={formFactor === "1U" ? 1.8 : formFactor === "3U" ? 5.0 : 15.0}
                    step="0.1"
                    value={busMass}
                    onChange={(e) => setBusMass(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#38bdf8" }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span style={{ color: "#94a3b8" }}>Hydrazine Propellant:</span>
                    <strong className="font-mono" style={{ color: "#ffffff" }}>{propellantMass.toFixed(2)} kg</strong>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max={formFactor === "1U" ? 0.6 : formFactor === "3U" ? 2.5 : 6.0}
                    step="0.1"
                    value={propellantMass}
                    onChange={(e) => setPropellantMass(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#38bdf8" }}
                  />
                </div>
              </div>

              {/* Real-time Math Output Card */}
              <div style={{ marginTop: "14px", backgroundColor: "rgba(10, 14, 22, 0.8)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "6px", padding: "10px 12px", fontSize: "11px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Current Best Estimate (CBE):</span>
                  <span className="font-mono" style={{ color: "#ffffff" }}>{massCalc.dryMassCBE.toFixed(2)} kg</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Growth Allowance (MGA @ 15%):</span>
                  <span className="font-mono" style={{ color: "#facc15" }}>+{massCalc.mga.toFixed(2)} kg</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Total Flight Wet Mass:</span>
                  <span className="font-mono" style={{ color: massCalc.isCompliant ? "#22c55e" : "#ef4444", fontWeight: 700 }}>
                    {massCalc.totalWetMass.toFixed(2)} / {massCalc.limit.toFixed(2)} kg
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "4px" }}>
                  <span style={{ color: "#94a3b8" }}>Dry Mass Margin (Req &ge; 35%):</span>
                  <span className="font-mono" style={{ color: massCalc.dryMassMargin >= 35 ? "#22c55e" : "#f59e0b", fontWeight: 800 }}>
                    {massCalc.dryMassMargin.toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------- */}
            {/* MODULE 2: POWER & THERMAL EQUILIBRIUM                          */}
            {/* -------------------------------------------------------------- */}
            <div style={{ backgroundColor: "rgba(15, 23, 42, 0.8)", border: "1.5px solid rgba(245, 158, 11, 0.3)", borderRadius: "8px", padding: "18px", backdropFilter: "blur(8px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <span style={{ fontSize: "10px", color: "#f59e0b", fontWeight: 800, fontFamily: "monospace" }}>MODULE 02</span>
                  <h3 style={{ fontSize: "15px", fontWeight: 800, margin: "0", color: "#ffffff" }}>Solar Power &amp; Thermal Balance</h3>
                </div>
                <span style={{ fontSize: "10px", fontWeight: 800, padding: "3px 8px", borderRadius: "3px", backgroundColor: powerCalc.isDodNominal ? "rgba(34, 197, 94, 0.2)" : "rgba(245, 158, 11, 0.2)", border: powerCalc.isDodNominal ? "1px solid #22c55e" : "1px solid #f59e0b", color: powerCalc.isDodNominal ? "#86efac" : "#fbbf24" }}>
                  {powerCalc.isDodNominal ? "✓ BATTERY NOMINAL" : "⚠ HIGH DOD"}
                </span>
              </div>

              {/* Sliders */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span style={{ color: "#94a3b8" }}>Orbit Altitude:</span>
                    <strong className="font-mono" style={{ color: "#ffffff" }}>{altitudeKm} km</strong>
                  </div>
                  <input
                    type="range"
                    min="300"
                    max="1200"
                    step="50"
                    value={altitudeKm}
                    onChange={(e) => setAltitudeKm(parseInt(e.target.value))}
                    style={{ width: "100%", accentColor: "#f59e0b" }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span style={{ color: "#94a3b8" }}>GaAs Solar Array Area:</span>
                    <strong className="font-mono" style={{ color: "#ffffff" }}>{panelAreaM2.toFixed(2)} m²</strong>
                  </div>
                  <input
                    type="range"
                    min="0.08"
                    max="0.80"
                    step="0.02"
                    value={panelAreaM2}
                    onChange={(e) => setPanelAreaM2(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#f59e0b" }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span style={{ color: "#94a3b8" }}>Average Spacecraft Draw:</span>
                    <strong className="font-mono" style={{ color: "#ffffff" }}>{powerDrawW} W</strong>
                  </div>
                  <input
                    type="range"
                    min="5"
                    max="60"
                    step="1"
                    value={powerDrawW}
                    onChange={(e) => setPowerDrawW(parseInt(e.target.value))}
                    style={{ width: "100%", accentColor: "#f59e0b" }}
                  />
                </div>
              </div>

              {/* Real-time Math Output Card */}
              <div style={{ marginTop: "14px", backgroundColor: "rgba(10, 14, 22, 0.8)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "6px", padding: "10px 12px", fontSize: "11px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Orbit Period (Keplerian):</span>
                  <span className="font-mono" style={{ color: "#ffffff" }}>{powerCalc.periodMin.toFixed(1)} min ({powerCalc.eclipseMin.toFixed(1)}m in Umbra)</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>GaAs Generation (S = 1361 W/m²):</span>
                  <span className="font-mono" style={{ color: "#facc15" }}>{powerCalc.solarGenWatts.toFixed(1)} W</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Battery Depth of Discharge (DoD):</span>
                  <span className="font-mono" style={{ color: powerCalc.dodPercent <= 25 ? "#22c55e" : "#f59e0b", fontWeight: 700 }}>
                    {powerCalc.dodPercent.toFixed(1)}% (Limit &le; 25% nominal)
                  </span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "4px" }}>
                  <span style={{ color: "#94a3b8" }}>Stefan-Boltzmann Equilibrium Temp:</span>
                  <span className="font-mono" style={{ color: "#38bdf8", fontWeight: 800 }}>
                    +{powerCalc.tempCelsius.toFixed(1)}°C (Nominal: -20°C to +50°C)
                  </span>
                </div>
              </div>
            </div>

            {/* -------------------------------------------------------------- */}
            {/* MODULE 3: TELECOM LINK BUDGET                                  */}
            {/* -------------------------------------------------------------- */}
            <div style={{ backgroundColor: "rgba(15, 23, 42, 0.8)", border: "1.5px solid rgba(34, 197, 94, 0.3)", borderRadius: "8px", padding: "18px", backdropFilter: "blur(8px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div>
                  <span style={{ fontSize: "10px", color: "#22c55e", fontWeight: 800, fontFamily: "monospace" }}>MODULE 03</span>
                  <h3 style={{ fontSize: "15px", fontWeight: 800, margin: "0", color: "#ffffff" }}>Friis Space Loss Link Budget</h3>
                </div>
                <span style={{ fontSize: "10px", fontWeight: 800, padding: "3px 8px", borderRadius: "3px", backgroundColor: telecomCalc.isLinkClosed ? "rgba(34, 197, 94, 0.2)" : "rgba(239, 68, 68, 0.2)", border: telecomCalc.isLinkClosed ? "1px solid #22c55e" : "1px solid #ef4444", color: telecomCalc.isLinkClosed ? "#86efac" : "#fca5a5" }}>
                  {telecomCalc.isLinkClosed ? "✓ LINK CLOSED (+3dB)" : "⚠ LOSS DEFICIT"}
                </span>
              </div>

              {/* Band Selector */}
              <div style={{ display: "flex", gap: "6px", marginBottom: "14px" }}>
                {(["UHF", "SBAND", "XBAND"] as const).map((b) => (
                  <button
                    key={b}
                    onClick={() => {
                      soundManager.playEquip();
                      setBand(b);
                    }}
                    style={{
                      flex: 1,
                      padding: "6px",
                      fontSize: "11px",
                      fontWeight: 700,
                      backgroundColor: band === b ? "rgba(34, 197, 94, 0.3)" : "rgba(30, 41, 59, 0.6)",
                      border: band === b ? "1px solid #22c55e" : "1px solid rgba(255, 255, 255, 0.1)",
                      color: band === b ? "#86efac" : "#94a3b8",
                      borderRadius: "3px",
                      cursor: "pointer",
                    }}
                  >
                    {b === "UHF" ? "UHF (437MHz)" : b === "SBAND" ? "S-Band (2.2GHz)" : "X-Band (8.4GHz)"}
                  </button>
                ))}
              </div>

              {/* Sliders */}
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span style={{ color: "#94a3b8" }}>RF Transmit Power:</span>
                    <strong className="font-mono" style={{ color: "#ffffff" }}>{txPowerW.toFixed(1)} W ({telecomCalc.eirpDbw.toFixed(1)} dBW EIRP)</strong>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="10.0"
                    step="0.5"
                    value={txPowerW}
                    onChange={(e) => setTxPowerW(parseFloat(e.target.value))}
                    style={{ width: "100%", accentColor: "#22c55e" }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span style={{ color: "#94a3b8" }}>Downlink Slant Distance:</span>
                    <strong className="font-mono" style={{ color: "#ffffff" }}>{distanceKm} km</strong>
                  </div>
                  <input
                    type="range"
                    min="400"
                    max="3500"
                    step="100"
                    value={distanceKm}
                    onChange={(e) => setDistanceKm(parseInt(e.target.value))}
                    style={{ width: "100%", accentColor: "#22c55e" }}
                  />
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "2px" }}>
                    <span style={{ color: "#94a3b8" }}>Data Bitrate:</span>
                    <strong className="font-mono" style={{ color: "#ffffff" }}>{dataRateKbps} kbps</strong>
                  </div>
                  <input
                    type="range"
                    min="16"
                    max="1024"
                    step="16"
                    value={dataRateKbps}
                    onChange={(e) => setDataRateKbps(parseInt(e.target.value))}
                    style={{ width: "100%", accentColor: "#22c55e" }}
                  />
                </div>
              </div>

              {/* Real-time Math Output Card */}
              <div style={{ marginTop: "14px", backgroundColor: "rgba(10, 14, 22, 0.8)", border: "1px solid rgba(255, 255, 255, 0.08)", borderRadius: "6px", padding: "10px 12px", fontSize: "11px", display: "flex", flexDirection: "column", gap: "4px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Free-Space Path Loss (FSPL):</span>
                  <span className="font-mono" style={{ color: "#f87171" }}>-{telecomCalc.fsplDb.toFixed(1)} dB</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Received Carrier Power (Prx):</span>
                  <span className="font-mono" style={{ color: "#fde047" }}>{telecomCalc.pRxDbw.toFixed(1)} dBW</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "#94a3b8" }}>Energy per Bit (Eb/N0):</span>
                  <span className="font-mono" style={{ color: "#ffffff" }}>{telecomCalc.ebN0.toFixed(1)} dB</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255, 255, 255, 0.08)", paddingTop: "4px" }}>
                  <span style={{ color: "#94a3b8" }}>Link Margin (NASA Req &ge; +3.0 dB):</span>
                  <span className="font-mono" style={{ color: telecomCalc.isLinkClosed ? "#22c55e" : "#ef4444", fontWeight: 800 }}>
                    {telecomCalc.linkMargin >= 0 ? `+${telecomCalc.linkMargin.toFixed(1)}` : telecomCalc.linkMargin.toFixed(1)} dB
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
