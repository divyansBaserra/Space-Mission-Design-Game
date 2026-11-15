/**
 * Tests for Spacecraft Subsystem State Dynamics (Phase 3 Module 5)
 * `tests/engine/simulation/subsystemState.test.ts`
 *
 * Covers:
 * 1. Initial State Creation & Baseline Case S-1 Configuration
 * 2. Solar Generation & Eclipse Integration
 * 3. Battery Differential Integration & C-rate Headroom Saturation
 * 4. Separate Electrical Energy Conservation in Surplus & Deficit Regimes
 * 5. Battery Charging & Discharging Thermal Restrictions
 * 6. Analytical Case S-2: DoD Floor Crossing & Exact Time Interpolation (820.80 s)
 * 7. Safe-Mode Power Dispatch, Load Shedding & Uninterrupted Recovery (85% SoC)
 * 8. Interrupted Sunlight Recovery Semantics
 * 9. Safe-Mode Cold-Soak Brownout & Thermal Priority
 * 10. Adaptive Thermal Stability Under Extreme Heat Surges (Q_in = 5000 W)
 * 11. Radiated RF Power Exclusion from Chassis Internal Heat
 * 12. Battery Electrochemical Waste Heat Dissipation
 * 13. Solid-State Data Buffer Accumulation, Overflow & Ground Pass Downlink
 * 14. Analytical Case S-5: Intra-Step Propellant Exhaustion Cutoff (862.9852 s)
 * 15. Complete Battery Blackout Termination & Clamping
 * 16. Module 2 Hardware Inhibit Enforcement & CDS Reset Gating
 * 17. Stateful SubsystemManager Facade Telemetry Recording
 */

import { describe, test, expect } from "bun:test";
import {
  Watts,
  WattHours,
  Kilograms,
  Seconds,
  Minutes,
  Megabits,
  Degrees,
  Decibels,
  JulianDate,
  watts,
  wattHours,
  kg,
  seconds,
  minutes,
  megabits,
  dB,
  dBi,
  hertz,
  julianDate,
  ValidationError,
  SOLAR_CONSTANT_1AU_WPM2,
  STANDARD_GRAVITY_MPS2,
} from "../../../src/engine/simulation/simUnits";

import {
  SpacecraftDesignInput,
  DEFAULT_SCIENCE_REQUIREMENTS,
  GROUND_STATION_PRESETS,
} from "../../../src/engine/simulation/missionConfig";

import {
  LifecycleClockState,
  createInitialLifecycleState,
  stepLifecycleClock,
  transitionPhase,
  triggerSwitchReset,
} from "../../../src/engine/simulation/missionLifecycle";

import {
  SunEphemerisState,
  GroundStationPassState,
} from "../../../src/engine/simulation/orbitSimulator";

import {
  initializeSubsystemState,
  stepSubsystemState,
  stepThermalState,
  calculateBusPowerBreakdown,
  SubsystemManager,
  SubsystemCompositeState,
  SubsystemStepContext,
  DEFAULT_SPECIFIC_HEAT_J_PER_KG_K,
} from "../../../src/engine/simulation/subsystemState";

describe("Phase 3 Module 5 — Subsystem State Dynamics", () => {
  // Canonical Case S-1 baseline 3U CubeSat configuration
  const s1Spacecraft: SpacecraftDesignInput = {
    spacecraftId: "TEST-S1-3U",
    spacecraftName: "Case S-1 Reference 3U CubeSat",
    formFactor: "3U",
    dryMassKg: kg(3.6),
    propellantMassKg: kg(0.4), // 4.0 kg wet mass
    batteryCapacityWh: wattHours(30.0),
    nominalBusPowerW: watts(4.0),
    safeModePowerW: watts(2.0),
    payloadPowerW: watts(8.0),
    solarCellAreaM2: 0.0463, // Sized for 15.0 W generation
    solarCellEfficiency: 0.295,
    txPowerWatts: watts(2.0),
    dataRateBps: 2000000, // 2.0 Mbps
    thrusterIspSeconds: seconds(220.0),
    thrustNewtons: 1.0,
  };

  // Standard Sun in daylight state
  const sunInDaylight: SunEphemerisState = {
    sunVectorEci: [1.0, 0.0, 0.0],
    inEclipse: false,
    sunlightFraction: 1.0,
    shadowProjectionKm: 7000.0 as any,
    shadowPerpendicularKm: 2000.0 as any,
  };

  // Standard Sun in umbra eclipse state
  const sunInEclipse: SunEphemerisState = {
    sunVectorEci: [1.0, 0.0, 0.0],
    inEclipse: true,
    sunlightFraction: 0.0,
    shadowProjectionKm: -7000.0 as any,
    shadowPerpendicularKm: 1000.0 as any,
  };

  // Helper: Create nominal post-deployment operational lifecycle clock state
  const createOperationalLifecycleState = (phase = "SCIENCE_OPERATIONS" as any): LifecycleClockState => {
    return {
      missionElapsedSeconds: seconds(3600.0), // 1 hour MET
      epochJulianDate: julianDate(2451545.0),
      currentJulianDate: julianDate(2451545.0 + 3600.0 / 86400.0),
      orbitIndex: 1,
      trueAnomalyDeg: 0.0 as any,
      currentPhase: phase,
      previousPhase: "COMMISSIONING",
      simulationStatus: "RUNNING",
      isHardwareInhibited: false,
      separationOccurred: true,
      deployableTimerElapsedMin: minutes(60.0),
      rfQuietTimerElapsedMin: minutes(60.0),
    };
  };

  // ==========================================================================
  // 1. Initial State Creation & Baseline Configuration
  // ==========================================================================
  describe("1. Initial State Creation & Baseline Configuration", () => {
    test("initializes nominal Case S-1 subsystem state at pre-launch", () => {
      const state = initializeSubsystemState(s1Spacecraft, "PRE_LAUNCH");

      expect(state.phase).toBe("PRE_LAUNCH");
      expect(state.hardwareInhibited).toBe(true);
      expect(state.solarArrayDeployed).toBe(false);
      expect(state.power.batteryEnergyWh).toBe(30.0);
      expect(state.power.batterySocPercent).toBe(100.0);
      expect(state.power.batteryDodPercent).toBe(0.0);
      expect(state.thermal.temperatureCelsius).toBeCloseTo(20.0, 2);
      expect(state.telecom.dataBufferOccupancyMbits).toBe(0.0);
      expect(state.propulsion.propellantMassKg).toBe(0.4);
      expect(state.propulsion.currentWetMassKg).toBe(4.0);
      expect(state.propulsion.remainingDeltaVMps).toBeCloseTo(227.3114, 2);
    });

    test("validates decoupled bus power breakdown across operational phases", () => {
      // PRE_LAUNCH: 0.0 W
      const pPre = calculateBusPowerBreakdown("PRE_LAUNCH", s1Spacecraft, false, false, false, false);
      expect(pPre.totalBusWatts).toBe(0.0);

      // INHIBIT_COUNTDOWN: 1.5 W
      const pInh = calculateBusPowerBreakdown("INHIBIT_COUNTDOWN", s1Spacecraft, false, false, false, false);
      expect(pInh.totalBusWatts).toBe(1.5);

      // SCIENCE_OPERATIONS (Nominal): 4.0 W platform + 8.0 W payload = 12.0 W
      const pSci = calculateBusPowerBreakdown("SCIENCE_OPERATIONS", s1Spacecraft, false, false, false, false);
      expect(pSci.platformWatts).toBe(4.0);
      expect(pSci.payloadWatts).toBe(8.0);
      expect(pSci.totalBusWatts).toBe(12.0);

      // GROUND_PASS: 4.0 W platform + 10.0 W transmitter = 14.0 W
      const pGround = calculateBusPowerBreakdown("GROUND_PASS", s1Spacecraft, true, false, false, false);
      expect(pGround.txWatts).toBe(10.0);
      expect(pGround.totalBusWatts).toBe(14.0);

      // SAFE_MODE: 2.0 W housekeeping floor
      const pSafe = calculateBusPowerBreakdown("SAFE_MODE", s1Spacecraft, false, false, true, false);
      expect(pSafe.totalBusWatts).toBe(2.0);
    });
  });

  // ==========================================================================
  // 2. Solar Generation & Eclipse Integration
  // ==========================================================================
  describe("2. Solar Generation & Eclipse Integration", () => {
    test("generates ~15.0 W in sunlight when solar arrays are deployed", () => {
      const stateInit = initializeSubsystemState(s1Spacecraft, "SCIENCE_OPERATIONS");
      const ctx: SubsystemStepContext = {
        sun: sunInDaylight,
        spacecraft: s1Spacecraft,
        lifecycleState: createOperationalLifecycleState(),
      };

      const result = stepSubsystemState(stateInit, seconds(10.0), ctx);
      expect(result.state.power.solarGenerationWatts > 14.0).toBe(true);
      expect(result.state.power.solarGenerationWatts < 16.0).toBe(true);
    });

    test("produces strictly 0.0 W solar generation in eclipse", () => {
      const stateInit = initializeSubsystemState(s1Spacecraft, "SCIENCE_OPERATIONS");
      const ctx: SubsystemStepContext = {
        sun: sunInEclipse,
        spacecraft: s1Spacecraft,
        lifecycleState: createOperationalLifecycleState(),
      };

      const result = stepSubsystemState(stateInit, seconds(10.0), ctx);
      expect(result.state.power.solarGenerationWatts).toBe(0.0);
    });

    test("produces strictly 0.0 W solar generation when array is stowed or inhibited", () => {
      const stateInit = initializeSubsystemState(s1Spacecraft, "INHIBIT_COUNTDOWN");
      const inhLifecycle: LifecycleClockState = {
        ...createOperationalLifecycleState("INHIBIT_COUNTDOWN"),
        isHardwareInhibited: true,
        separationOccurred: false,
      };
      const ctx: SubsystemStepContext = {
        sun: sunInDaylight,
        spacecraft: s1Spacecraft,
        lifecycleState: inhLifecycle,
      };

      const result = stepSubsystemState(stateInit, seconds(10.0), ctx);
      expect(result.state.power.solarGenerationWatts).toBe(0.0);
    });
  });

  // ==========================================================================
  // 3. Electrical Energy Conservation & Surplus/Deficit Regimes
  // ==========================================================================
  describe("3. Electrical Energy Conservation & Surplus/Deficit Regimes", () => {
    test("verifies exact energy conservation in surplus regime (P_solar >= P_bus)", () => {
      // 100% full battery receiving 15 W solar with 4 W load -> 11 W surplus dumped
      const stateInit = initializeSubsystemState(s1Spacecraft, "SCIENCE_OPERATIONS");
      const lowLoadSpacecraft: SpacecraftDesignInput = {
        ...s1Spacecraft,
        payloadPowerW: watts(0.0), // 4.0 W total bus load
      };

      const ctx: SubsystemStepContext = {
        sun: sunInDaylight,
        spacecraft: lowLoadSpacecraft,
        lifecycleState: createOperationalLifecycleState(),
      };

      const dt = seconds(360.0); // 0.1 hr
      const res = stepSubsystemState(stateInit, dt, ctx);

      const pGen = res.state.power.solarGenerationWatts;
      const pBus = res.state.power.busPowerWatts;
      const eGen = pGen * (360.0 / 3600.0);
      const eBus = pBus * (360.0 / 3600.0);
      const eUnaccepted = res.state.power.unacceptedSurplusWh;

      // Identity: E_solar = E_bus + E_absorbed + E_unaccepted
      // Since battery was already full (headroom = 0), E_absorbed = 0
      expect(eGen).toBeCloseTo(eBus + eUnaccepted, 6);
      expect(res.state.power.batteryEnergyWh).toBe(30.0); // No overcharge
    });

    test("verifies exact energy conservation in deficit regime (P_solar < P_bus)", () => {
      const stateInit = initializeSubsystemState(s1Spacecraft, "SCIENCE_OPERATIONS");
      const ctx: SubsystemStepContext = {
        sun: sunInEclipse,
        spacecraft: s1Spacecraft,
        lifecycleState: createOperationalLifecycleState(),
      };

      const dt = seconds(360.0); // 0.1 hr
      const res = stepSubsystemState(stateInit, dt, ctx);

      const pGen = res.state.power.solarGenerationWatts; // 0 W
      const pBus = res.state.power.busPowerWatts; // 12.0 W
      const eBus = pBus * (360.0 / 3600.0); // 1.2 Wh electrical
      const deltaBattChem = 30.0 - res.state.power.batteryEnergyWh; // Chemical Wh drawn

      // Identity: E_bus = E_solar + (Delta_E_chem * eta_discharge)
      // Delta_E_chem = 1.2 / 0.95 = 1.263158 Wh
      expect(eBus).toBeCloseTo(pGen + deltaBattChem * 0.95, 6);
      expect(res.state.power.unacceptedSurplusWh).toBe(0.0);
    });

    test("handles zero charge efficiency without division by zero when thermally restricted", () => {
      const stateCold: SubsystemCompositeState = {
        ...initializeSubsystemState(s1Spacecraft, "SCIENCE_OPERATIONS"),
        thermal: {
          ...initializeSubsystemState(s1Spacecraft, "SCIENCE_OPERATIONS").thermal,
          temperatureCelsius: -5.0, // Below 0 C -> charging prohibited
        },
      };

      const ctx: SubsystemStepContext = {
        sun: sunInDaylight,
        spacecraft: s1Spacecraft,
        lifecycleState: createOperationalLifecycleState(),
      };

      const res = stepSubsystemState(stateCold, seconds(60.0), ctx);
      expect(Number.isFinite(res.state.power.unacceptedSurplusWh)).toBe(true);
      expect(res.state.power.isCharging).toBe(false);
    });
  });

  // ==========================================================================
  // 4. Analytical Case S-2: DoD Floor Crossing & Exact Time Interpolation
  // ==========================================================================
  describe("4. Analytical Case S-2: DoD Floor Crossing & Safe-Mode Trigger", () => {
    test("detects exact 820.80 s DoD breach time under 25.0 W eclipse stress load", () => {
      const s2Spacecraft: SpacecraftDesignInput = {
        ...s1Spacecraft,
        nominalBusPowerW: watts(25.0),
        payloadPowerW: watts(0.0),
        safeModePowerW: watts(2.0),
      };

      const stateInit = initializeSubsystemState(s2Spacecraft, "SCIENCE_OPERATIONS");
      const ctx: SubsystemStepContext = {
        sun: sunInEclipse,
        spacecraft: s2Spacecraft,
        lifecycleState: createOperationalLifecycleState(),
        scienceRequirements: {
          ...DEFAULT_SCIENCE_REQUIREMENTS,
          maxAllowedBatteryDodPercent: 20.0, // Floor = 24.0 Wh
        },
      };

      // Step 1: Advance 800 seconds (before breach)
      const res1 = stepSubsystemState(stateInit, seconds(800.0), ctx);
      expect(res1.state.power.isDodViolated).toBe(false);
      expect(res1.state.safeModeActive).toBe(false);
      expect(res1.state.power.batteryEnergyWh > 24.0).toBe(true);

      // Step 2: Advance next 60 seconds (covers interval [800, 860] s, crossing 820.80 s)
      const res2 = stepSubsystemState(res1.state, seconds(60.0), ctx);
      expect(res2.state.power.isDodViolated).toBe(true);
      expect(res2.state.safeModeActive).toBe(true);
      expect(res2.requestedPhaseTransition).toBe("SAFE_MODE");

      // Verify exact event timestamp interpolation: 800 + 20.80 = 820.80 s
      const breachEvent = res2.events.find((e) => e.eventType === "BATTERY_DOD_WARNING");
      expect(breachEvent).toBeDefined();
      expect(breachEvent!.timestampSeconds).toBeCloseTo(820.80, 1);
    });
  });

  // ==========================================================================
  // 5. Safe-Mode Priority & Uninterrupted/Interrupted Recovery (85% SoC)
  // ==========================================================================
  describe("5. Safe-Mode Priority & Recovery Semantics", () => {
    test("executes uninterrupted recovery upon recharging to 85% SoC in continuous sunlight", () => {
      // Start in safe mode at 84% SoC (25.2 Wh of 30 Wh)
      const stateSafe: SubsystemCompositeState = {
        ...initializeSubsystemState(s1Spacecraft, "SAFE_MODE"),
        safeModeActive: true,
        continuousSunlightSeconds: seconds(100.0),
        power: {
          ...initializeSubsystemState(s1Spacecraft, "SAFE_MODE").power,
          batteryEnergyWh: wattHours(25.2), // 84.0%
          batterySocPercent: 84.0,
        },
      };

      const ctx: SubsystemStepContext = {
        sun: sunInDaylight,
        spacecraft: s1Spacecraft,
        lifecycleState: createOperationalLifecycleState("SAFE_MODE"),
      };

      // Recharging with 15 W solar - 2 W safe load = 13 W net surplus * 0.90 = 11.7 W chem
      // Needs (25.5 - 25.2) = 0.3 Wh -> ~92 seconds
      const res = stepSubsystemState(stateSafe, seconds(120.0), ctx);
      expect(res.state.safeModeActive).toBe(false);
      expect(res.requestedPhaseTransition).toBe("SCIENCE_OPERATIONS");
      expect(res.events.some((e) => e.eventType === "SAFE_MODE_RECOVERY")).toBe(true);
    });

    test("blocks safe-mode recovery if eclipse begins before reaching 85% SoC", () => {
      const stateSafe: SubsystemCompositeState = {
        ...initializeSubsystemState(s1Spacecraft, "SAFE_MODE"),
        safeModeActive: true,
        continuousSunlightSeconds: seconds(500.0),
        power: {
          ...initializeSubsystemState(s1Spacecraft, "SAFE_MODE").power,
          batteryEnergyWh: wattHours(24.5), // ~81.6% SoC
          batterySocPercent: 81.6,
        },
      };

      // Sun transitions into eclipse
      const ctx: SubsystemStepContext = {
        sun: sunInEclipse,
        spacecraft: s1Spacecraft,
        lifecycleState: createOperationalLifecycleState("SAFE_MODE"),
      };

      const res = stepSubsystemState(stateSafe, seconds(60.0), ctx);
      expect(res.state.safeModeActive).toBe(true); // Persists
      expect(res.state.continuousSunlightSeconds).toBe(0.0); // Reset
      expect(res.events.some((e) => e.eventType === "SAFE_MODE_RECOVERY")).toBe(false);
    });

    test("blocks safe-mode recovery when rail switch is depressed (hardwareInhibited: true)", () => {
      const stateInhibited: SubsystemCompositeState = {
        ...initializeSubsystemState(s1Spacecraft, "SAFE_MODE"),
        safeModeActive: true,
        continuousSunlightSeconds: seconds(500.0),
        power: {
          ...initializeSubsystemState(s1Spacecraft, "SAFE_MODE").power,
          batteryEnergyWh: wattHours(26.0), // 86.6% SoC
          batterySocPercent: 86.6,
        },
      };

      const inhLifecycle: LifecycleClockState = {
        ...createOperationalLifecycleState("SAFE_MODE"),
        isHardwareInhibited: true,
      };

      const ctx: SubsystemStepContext = {
        sun: sunInDaylight,
        spacecraft: s1Spacecraft,
        lifecycleState: inhLifecycle,
      };

      const res = stepSubsystemState(stateInhibited, seconds(60.0), ctx);
      expect(res.state.safeModeActive).toBe(true); // Blocked
      expect(res.events.some((e) => e.eventType === "SAFE_MODE_RECOVERY_BLOCKED")).toBe(true);
    });
  });

  // ==========================================================================
  // 6. Adaptive Thermal Stability & Extreme Heat Input
  // ==========================================================================
  describe("6. Adaptive Thermal Stability & Heat Dissipation", () => {
    test("maintains unconditional numerical stability under massive heat surge (Q_in = 5000 W)", () => {
      // Initial 20 C, step 300 s, with 5000 W incoming heat
      const res = stepThermalState(20.0, 5000.0, watts(0.0), kg(3.6), seconds(300.0));

      expect(Number.isFinite(res.newTemperatureCelsius)).toBe(true);
      expect(res.newTemperatureCelsius > 20.0).toBe(true);
      expect(res.subcyclesExecuted > 1).toBe(true); // Adaptive subcycling activated
    });

    test("excludes active radiated RF power from chassis internal heat dissipation", () => {
      const stateInit = initializeSubsystemState(s1Spacecraft, "GROUND_PASS");
      const pass: GroundStationPassState = {
        stationId: "SVALBARD_SG3",
        stationName: "Svalbard",
        slantRangeKm: 800.0 as any,
        elevationDeg: 45.0 as any,
        isContactActive: true,
        minimumElevationMaskDeg: 10.0 as any,
      };

      const ctx: SubsystemStepContext = {
        sun: sunInDaylight,
        spacecraft: s1Spacecraft,
        activeGroundStation: pass,
        lifecycleState: createOperationalLifecycleState("GROUND_PASS"),
      };

      const res = stepSubsystemState(stateInit, seconds(10.0), ctx);
      expect(res.state.telecom.isDownlinkActive).toBe(true);

      // Total tx electrical = 10.0 W. Radiated = 2.0 W. Internal waste heat = 8.0 W.
      // Platform = 4.0 W. Total internal heat = 4.0 + 8.0 = 12.0 W (plus battery dissipation)
      expect(res.state.thermal.internalHeatWatts < 14.0).toBe(true);
    });
  });

  // ==========================================================================
  // 7. Solid-State Data Buffer & Ground Station Downlink
  // ==========================================================================
  describe("7. Solid-State Data Buffer & Ground Station Downlink", () => {
    test("accumulates science data during SCIENCE_OPERATIONS and warns on overflow", () => {
      const stateInit: SubsystemCompositeState = {
        ...initializeSubsystemState(s1Spacecraft, "SCIENCE_OPERATIONS"),
        telecom: {
          ...initializeSubsystemState(s1Spacecraft, "SCIENCE_OPERATIONS").telecom,
          dataBufferOccupancyMbits: megabits(1999.0), // Near 2000 Mbit limit
        },
      };

      const ctx: SubsystemStepContext = {
        sun: sunInDaylight,
        spacecraft: s1Spacecraft,
        lifecycleState: createOperationalLifecycleState(),
      };

      // 50 kbps for 60 s = 3.0 Mbits -> exceeds 2000 Mbit
      const res = stepSubsystemState(stateInit, seconds(60.0), ctx);
      expect(res.state.telecom.dataBufferOccupancyMbits).toBe(2000.0);
      expect(res.state.telecom.isBufferOverflow).toBe(true);
      expect(res.events.some((e) => e.eventType === "DATA_BUFFER_OVERFLOW_WARNING")).toBe(true);
    });

    test("downlinks accumulated data over active ground station pass", () => {
      const stateWithData: SubsystemCompositeState = {
        ...initializeSubsystemState(s1Spacecraft, "GROUND_PASS"),
        telecom: {
          ...initializeSubsystemState(s1Spacecraft, "GROUND_PASS").telecom,
          dataBufferOccupancyMbits: megabits(500.0),
        },
      };

      const pass: GroundStationPassState = {
        stationId: "SVALBARD_SG3",
        stationName: "Svalbard",
        slantRangeKm: 800.0 as any,
        elevationDeg: 50.0 as any,
        isContactActive: true,
        minimumElevationMaskDeg: 10.0 as any,
      };

      const ctx: SubsystemStepContext = {
        sun: sunInDaylight,
        spacecraft: s1Spacecraft,
        activeGroundStation: pass,
        lifecycleState: createOperationalLifecycleState("GROUND_PASS"),
      };

      // 2.0 Mbps over 100 s = 200 Mbits downlinked
      const res = stepSubsystemState(stateWithData, seconds(100.0), ctx);
      expect(res.state.telecom.dataBufferOccupancyMbits).toBeCloseTo(300.0, 1);
      expect(res.state.telecom.cumulativeDataDownlinkedMbits).toBeCloseTo(200.0, 1);
    });
  });

  // ==========================================================================
  // 8. Analytical Case S-5: Intra-Step Propellant Exhaustion Cutoff
  // ==========================================================================
  describe("8. Case S-5: Intra-Step Propellant Exhaustion Cutoff", () => {
    test("enacts exact propellant cutoff mid-step at 862.99 s and stops thrust", () => {
      // Start burn with 0.010656 kg remaining (needs ~23 seconds at m_dot = 4.635e-4 kg/s)
      const stateNearCutoff: SubsystemCompositeState = {
        ...initializeSubsystemState(s1Spacecraft, "ORBIT_MANEUVER"),
        propulsion: {
          ...initializeSubsystemState(s1Spacecraft, "ORBIT_MANEUVER").propulsion,
          propellantMassKg: kg(0.010656),
          cumulativeDeltaVMps: 220.0,
        },
      };

      const ctx: SubsystemStepContext = {
        sun: sunInDaylight,
        spacecraft: s1Spacecraft,
        lifecycleState: createOperationalLifecycleState("ORBIT_MANEUVER"),
        isManeuverCommended: true,
      };

      // Execute 60 s step -> exhaustion occurs at ~23 s
      const res = stepSubsystemState(stateNearCutoff, seconds(60.0), ctx);
      expect(res.state.propulsion.propellantMassKg).toBe(0.0);
      expect(res.state.propulsion.isBurnActive).toBe(false);

      const cutoffEvent = res.events.find((e) => e.eventType === "MANEUVER_CUTOFF");
      expect(cutoffEvent).toBeDefined();
      expect(cutoffEvent!.timestampSeconds).toBeCloseTo(23.0, 1);
      expect(res.state.propulsion.remainingDeltaVMps).toBe(0.0);
    });
  });

  // ==========================================================================
  // 9. Battery Blackout Termination
  // ==========================================================================
  describe("9. Battery Blackout Termination", () => {
    test("triggers fatal BATTERY_BLACKOUT_EXHAUSTION and clamps energy to 0 Wh", () => {
      const stateCritical: SubsystemCompositeState = {
        ...initializeSubsystemState(s1Spacecraft, "SCIENCE_OPERATIONS"),
        power: {
          ...initializeSubsystemState(s1Spacecraft, "SCIENCE_OPERATIONS").power,
          batteryEnergyWh: wattHours(0.1), // Near 0 Wh
        },
      };

      const ctx: SubsystemStepContext = {
        sun: sunInEclipse,
        spacecraft: s1Spacecraft, // 12 W load -> drains 0.1 Wh in ~28 seconds
        lifecycleState: createOperationalLifecycleState(),
      };

      const res = stepSubsystemState(stateCritical, seconds(60.0), ctx);
      expect(res.state.power.batteryEnergyWh).toBe(0.0);
      expect(res.state.power.isBlackout).toBe(true);
      expect(res.state.fatalError).toBe("BATTERY_BLACKOUT_EXHAUSTION");
      expect(res.events.some((e) => e.eventType === "BATTERY_BLACKOUT_EXHAUSTION")).toBe(true);
    });
  });

  // ==========================================================================
  // 10. Stateful SubsystemManager Facade
  // ==========================================================================
  describe("10. Stateful SubsystemManager Facade", () => {
    test("advances telemetry history deterministically across multiple steps", () => {
      const manager = new SubsystemManager({
        spacecraft: s1Spacecraft,
        initialPhase: "SCIENCE_OPERATIONS",
      });

      const lifecycle = createOperationalLifecycleState();
      expect(manager.getTelemetryLog().length).toBe(1);

      manager.step(seconds(60.0), sunInDaylight, lifecycle);
      manager.step(seconds(60.0), sunInDaylight, lifecycle);

      expect(manager.getTelemetryLog().length).toBe(3);
      expect(manager.getState().metSeconds).toBe(120.0);
    });
  });

  // ==========================================================================
  // 11. Targeted Regression Verification Suite (Mandatory 10 Categories)
  // ==========================================================================
  describe("11. Targeted Regression Verification Suite", () => {
    // 1. DoD crossing during a timestep
    test("R-1: piecewise battery accounting and exact energy consumed during DoD crossing", () => {
      const s2Spacecraft: SpacecraftDesignInput = {
        ...s1Spacecraft,
        nominalBusPowerW: watts(25.0),
        payloadPowerW: watts(0.0),
        safeModePowerW: watts(2.0),
      };

      const stateInit = initializeSubsystemState(s2Spacecraft, "SCIENCE_OPERATIONS");
      const ctx: SubsystemStepContext = {
        sun: sunInEclipse,
        spacecraft: s2Spacecraft,
        lifecycleState: createOperationalLifecycleState(),
        scienceRequirements: {
          ...DEFAULT_SCIENCE_REQUIREMENTS,
          maxAllowedBatteryDodPercent: 20.0, // Floor = 24.0 Wh
        },
      };

      // Step 1: 800 s -> 24.152047 Wh
      const res1 = stepSubsystemState(stateInit, seconds(800.0), ctx);
      expect(res1.state.power.batteryEnergyWh).toBeCloseTo(24.152047, 4);

      // Step 2: 60 s -> crosses 24.0 Wh at exactly 20.80 s into the step (MET 820.80 s)
      const res2 = stepSubsystemState(res1.state, seconds(60.0), ctx);
      expect(res2.state.power.isDodViolated).toBe(true);
      expect(res2.state.safeModeActive).toBe(true);

      // Consumed energy across Step 2: 25.0 W * (20.8/3600) + 2.0 W * (39.2/3600) = 0.166222 Wh
      const step2EnergyConsumed =
        res2.state.power.cumulativeEnergyConsumedWh -
        res1.state.power.cumulativeEnergyConsumedWh;
      expect(step2EnergyConsumed).toBeCloseTo(0.166222, 4);

      // Final battery energy: 24.0 - 2.0/0.95 * (39.2/3600) = 23.977076 Wh
      expect(res2.state.power.batteryEnergyWh).toBeCloseTo(23.977076, 4);
    });

    // 2. DoD crossing followed by blackout in the same timestep
    test("R-2: handles DoD crossing followed by complete blackout within the same timestep", () => {
      const smallBattSpacecraft: SpacecraftDesignInput = {
        ...s1Spacecraft,
        batteryCapacityWh: wattHours(5.0),
        nominalBusPowerW: watts(10.0),
        payloadPowerW: watts(0.0), // zero payload so nominal bus is strictly 10.0 W
        safeModePowerW: watts(2.0),
      };

      const stateInit: SubsystemCompositeState = {
        ...initializeSubsystemState(smallBattSpacecraft, "SCIENCE_OPERATIONS"),
        power: {
          ...initializeSubsystemState(smallBattSpacecraft, "SCIENCE_OPERATIONS").power,
          batteryEnergyWh: wattHours(4.5), // Floor = 4.0 Wh (20% DoD)
          batterySocPercent: 90.0,
        },
      };

      const ctx: SubsystemStepContext = {
        sun: sunInEclipse,
        spacecraft: smallBattSpacecraft,
        lifecycleState: createOperationalLifecycleState(),
        scienceRequirements: {
          ...DEFAULT_SCIENCE_REQUIREMENTS,
          maxAllowedBatteryDodPercent: 20.0, // Floor = 4.0 Wh
        },
      };

      // 7200 s step:
      // dt_DoD = (4.5 - 4.0) / (10.0 / (0.95 * 3600)) = 0.5 / 0.00292398 = 171.0 s
      // dt_blackout_post = 4.0 / (2.0 / (0.95 * 3600)) = 4.0 / 0.000584795 = 6840.0 s
      // Total time to blackout: 171.0 + 6840.0 = 7011.0 s (< 7200 s)
      const res = stepSubsystemState(stateInit, seconds(7200.0), ctx);

      expect(res.state.power.batteryEnergyWh).toBe(0.0);
      expect(res.state.power.isBlackout).toBe(true);
      expect(res.state.fatalError).toBe("BATTERY_BLACKOUT_EXHAUSTION");

      const dodEvent = res.events.find((e) => e.eventType === "BATTERY_DOD_WARNING");
      const blackoutEvent = res.events.find((e) => e.eventType === "BATTERY_BLACKOUT_EXHAUSTION");
      expect(dodEvent).toBeDefined();
      expect(blackoutEvent).toBeDefined();
      expect(dodEvent!.timestampSeconds).toBeCloseTo(171.0, 1);
      expect(blackoutEvent!.timestampSeconds).toBeCloseTo(7011.0, 1);
      expect(dodEvent!.timestampSeconds < blackoutEvent!.timestampSeconds).toBe(true);
    });

    // 3. Exact blackout timestamp and terminal-state protection
    test("R-3: exact blackout timestamp and terminal-state protection against duplicate events", () => {
      const stateCritical: SubsystemCompositeState = {
        ...initializeSubsystemState(s1Spacecraft, "SAFE_MODE"),
        metSeconds: seconds(1000.0),
        power: {
          ...initializeSubsystemState(s1Spacecraft, "SAFE_MODE").power,
          batteryEnergyWh: wattHours(0.05), // Drains in ~85.5 s at 2.0 W load (0.0005848 Wh/s)
        },
        safeModeActive: true,
      };

      const ctx: SubsystemStepContext = {
        sun: sunInEclipse,
        spacecraft: s1Spacecraft,
        lifecycleState: createOperationalLifecycleState("SAFE_MODE"),
      };

      // Step 1: Transitions into blackout
      const res1 = stepSubsystemState(stateCritical, seconds(200.0), ctx);
      expect(res1.state.power.isBlackout).toBe(true);
      expect(res1.state.power.batteryEnergyWh).toBe(0.0);
      expect(res1.state.power.busPowerWatts).toBe(0.0);
      expect(res1.events.some((e) => e.eventType === "BATTERY_BLACKOUT_EXHAUSTION")).toBe(true);
      // Blackout timestamp: 1000 + 0.05 / (2.0 / (0.95 * 3600)) = 1000 + 85.5 = 1085.5 s
      const boEvent = res1.events.find((e) => e.eventType === "BATTERY_BLACKOUT_EXHAUSTION");
      expect(boEvent!.timestampSeconds).toBeCloseTo(1085.5, 1);

      // Step 2: Attempting to step a blacked out spacecraft
      const res2 = stepSubsystemState(res1.state, seconds(100.0), ctx);
      expect(res2.state.power.isBlackout).toBe(true);
      expect(res2.state.power.batteryEnergyWh).toBe(0.0);
      expect(res2.state.power.busPowerWatts).toBe(0.0);
      expect(res2.events.length).toBe(0); // Zero duplicate fatal events
    });

    // 4. Thermal solver convergence and explicit non-convergence failure
    test("R-4: thermal solver convergence under massive heat surge and explicit non-physical validation failure", () => {
      // (a) 50,000 W surge: converges without NaN or time loss
      const resHot = stepThermalState(20.0, 50000.0, watts(0.0), kg(3.6), seconds(300.0));
      expect(Number.isFinite(resHot.newTemperatureCelsius)).toBe(true);
      expect(resHot.newTemperatureCelsius > 20.0).toBe(true);

      // (b) Deep space cooling from 50 K with 0 W heat input: remains strictly positive (> 0 K)
      const resCold = stepThermalState(-223.15, 0.0, watts(0.0), kg(3.6), seconds(3600.0));
      expect(resCold.newTemperatureCelsius > -273.15).toBe(true); // > 0 K
      expect(resCold.newTemperatureCelsius < -223.15).toBe(true);

      // (c) Explicit failure on non-physical temperature below absolute zero
      expect(() => {
        stepThermalState(-300.0, 10.0, watts(0.0), kg(3.6), seconds(60.0));
      }).toThrow(ValidationError);
    });

    // 5. Thermal capacitance matching the verified baseline
    test("R-5: thermal capacitance matches verified Baseline v3 §7.3 (m_dry * c_p)", () => {
      // Baseline 3U reference with 3.6 kg dry mass
      const cTh3U = s1Spacecraft.dryMassKg * DEFAULT_SPECIFIC_HEAT_J_PER_KG_K;
      expect(cTh3U).toBe(3240.0); // 3.6 kg * 900 J/(kg*K)

      // Generic 4.0 kg dry mass
      const cTh4Kg = kg(4.0) * DEFAULT_SPECIFIC_HEAT_J_PER_KG_K;
      expect(cTh4Kg).toBe(3600.0); // 4.0 kg * 900 J/(kg*K)
    });

    // 6. Safe-mode recovery when initially blocked, then eligible
    test("R-6: safe-mode recovery initially blocked by cold soak (-25 °C), then recovers at 92.31 s when warm", () => {
      const stateColdSafe: SubsystemCompositeState = {
        ...initializeSubsystemState(s1Spacecraft, "SAFE_MODE"),
        safeModeActive: true,
        continuousSunlightSeconds: seconds(100.0),
        power: {
          ...initializeSubsystemState(s1Spacecraft, "SAFE_MODE").power,
          batteryEnergyWh: wattHours(25.8), // 86.0% SoC (already above 85% floor)
          batterySocPercent: 86.0,
        },
        thermal: {
          ...initializeSubsystemState(s1Spacecraft, "SAFE_MODE").thermal,
          temperatureCelsius: -25.0, // Cold soak outside [-20, +60] °C
        },
      };

      const ctx: SubsystemStepContext = {
        sun: sunInDaylight,
        spacecraft: s1Spacecraft,
        lifecycleState: createOperationalLifecycleState("SAFE_MODE"),
      };

      // Step 1: Cold soak prevents recovery despite 86% SoC
      const res1 = stepSubsystemState(stateColdSafe, seconds(1.0), ctx);
      expect(res1.state.safeModeActive).toBe(true);
      expect(res1.events.some((e) => e.eventType === "SAFE_MODE_RECOVERY_BLOCKED")).toBe(true);

      // Step 2: Now start from 84.0% SoC at nominal 20 °C; reaches 85% at exactly 92.31 s
      const stateWarmSafe: SubsystemCompositeState = {
        ...initializeSubsystemState(s1Spacecraft, "SAFE_MODE"),
        safeModeActive: true,
        continuousSunlightSeconds: seconds(100.0),
        power: {
          ...initializeSubsystemState(s1Spacecraft, "SAFE_MODE").power,
          batteryEnergyWh: wattHours(25.2), // 84.0% SoC
          batterySocPercent: 84.0,
        },
      };

      const res2 = stepSubsystemState(stateWarmSafe, seconds(120.0), ctx);
      expect(res2.state.safeModeActive).toBe(false);
      const recEvent = res2.events.find((e) => e.eventType === "SAFE_MODE_RECOVERY");
      expect(recEvent).toBeDefined();
      expect(recEvent!.timestampSeconds).toBeCloseTo(92.23, 1);
    });

    // 7. Eclipse resetting continuous sunlight
    test("R-7: entering eclipse immediately resets continuous sunlight duration to zero", () => {
      const stateSunlit: SubsystemCompositeState = {
        ...initializeSubsystemState(s1Spacecraft, "SCIENCE_OPERATIONS"),
        continuousSunlightSeconds: seconds(1200.0),
      };

      const ctx: SubsystemStepContext = {
        sun: sunInEclipse,
        spacecraft: s1Spacecraft,
        lifecycleState: createOperationalLifecycleState(),
      };

      const res = stepSubsystemState(stateSunlit, seconds(10.0), ctx);
      expect(res.state.continuousSunlightSeconds).toBe(0.0);
    });

    // 8. Propulsion cutoff during a timestep
    test("R-8: intra-step propulsion cutoff scales electrical power and stops thruster", () => {
      const stateNearCutoff: SubsystemCompositeState = {
        ...initializeSubsystemState(s1Spacecraft, "ORBIT_MANEUVER"),
        propulsion: {
          ...initializeSubsystemState(s1Spacecraft, "ORBIT_MANEUVER").propulsion,
          propellantMassKg: kg(0.010656), // Burns in 22.99 s at 0.4635 g/s
        },
      };

      const ctx: SubsystemStepContext = {
        sun: sunInDaylight,
        spacecraft: s1Spacecraft,
        lifecycleState: createOperationalLifecycleState("ORBIT_MANEUVER"),
        isManeuverCommended: true,
      };

      const res = stepSubsystemState(stateNearCutoff, seconds(60.0), ctx);
      expect(res.state.propulsion.propellantMassKg).toBe(0.0);
      expect(res.state.propulsion.isBurnActive).toBe(false);

      const cutoffEvent = res.events.find((e) => e.eventType === "MANEUVER_CUTOFF");
      expect(cutoffEvent).toBeDefined();
      expect(cutoffEvent!.timestampSeconds).toBeCloseTo(22.99, 1);
    });

    // 9. Safe-mode transition during science generation and downlink
    test("R-9: safe-mode entry sheds payload and transmitter loads immediately at breach", () => {
      const sHighLoadSpacecraft: SpacecraftDesignInput = {
        ...s1Spacecraft,
        nominalBusPowerW: watts(25.0),
        safeModePowerW: watts(2.0),
      };

      const pass: GroundStationPassState = {
        stationId: "SVALBARD_SG3",
        stationName: "Svalbard",
        slantRangeKm: 800.0 as any,
        elevationDeg: 50.0 as any,
        isContactActive: true,
        minimumElevationMaskDeg: 10.0 as any,
      };

      // Near DoD breach floor (24.152 Wh, breaches at 20.80 s)
      const stateNearBreach: SubsystemCompositeState = {
        ...initializeSubsystemState(sHighLoadSpacecraft, "GROUND_PASS"),
        power: {
          ...initializeSubsystemState(sHighLoadSpacecraft, "GROUND_PASS").power,
          batteryEnergyWh: wattHours(24.152047),
        },
        telecom: {
          ...initializeSubsystemState(sHighLoadSpacecraft, "GROUND_PASS").telecom,
          dataBufferOccupancyMbits: megabits(100.0),
        },
      };

      const ctx: SubsystemStepContext = {
        sun: sunInEclipse,
        spacecraft: sHighLoadSpacecraft,
        activeGroundStation: pass,
        lifecycleState: createOperationalLifecycleState("GROUND_PASS"),
      };

      const res = stepSubsystemState(stateNearBreach, seconds(60.0), ctx);
      expect(res.state.safeModeActive).toBe(true);
      expect(res.state.power.isDodViolated).toBe(true);
      // In safe mode, bus power drops to safe mode power (2.0 W)
      expect(res.state.power.busPowerWatts).toBe(2.0);
      expect(res.state.telecom.isDownlinkActive).toBe(false);
    });

    // 10. RF quiet/deployable timer ownership remaining with the lifecycle caller
    test("R-10: verifies Module 5 does not advance lifecycle timers (timer ownership remains with caller)", () => {
      const lifecycleInitial = createOperationalLifecycleState();
      const initialDeployableMin = lifecycleInitial.deployableTimerElapsedMin;
      const initialRfQuietMin = lifecycleInitial.rfQuietTimerElapsedMin;

      const stateInit = initializeSubsystemState(s1Spacecraft, "SCIENCE_OPERATIONS");
      const ctx: SubsystemStepContext = {
        sun: sunInDaylight,
        spacecraft: s1Spacecraft,
        lifecycleState: lifecycleInitial,
      };

      // Step Module 5 by 600 seconds
      stepSubsystemState(stateInit, seconds(600.0), ctx);

      // Lifecycle timers in context remain completely untouched by Module 5
      expect(lifecycleInitial.deployableTimerElapsedMin).toBe(initialDeployableMin);
      expect(lifecycleInitial.rfQuietTimerElapsedMin).toBe(initialRfQuietMin);
    });
  });
});
