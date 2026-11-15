/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Mission Lifecycle & State Machine Unit Tests (Phase 3 Module 2)
 */

import { describe, expect, it } from "bun:test";
import {
  LEGAL_PHASE_TRANSITIONS,
  ALL_MISSION_PHASES,
  DEFAULT_EPOCH_JULIAN_DATE,
  isValidPhaseTransition,
  assertValidPhaseTransition,
  createInitialLifecycleState,
  stepLifecycleClock,
  transitionPhase,
  triggerSwitchReset,
  terminateSimulation,
  pauseSimulation,
  resumeSimulation,
  executeSimulationControl,
  getDeployableTimerStatus,
  getRfQuietTimerStatus,
  isDeployableReleasePermitted,
  isRfTransmissionPermitted,
  MissionLifecycleManager,
  MissionPhase,
} from "../../../src/engine/simulation/missionLifecycle";

import {
  seconds,
  minutes,
  degrees,
  julianDate,
  ValidationError,
} from "../../../src/engine/simulation/simUnits";

describe("Phase 3 Module 2: Mission Lifecycle & State Machine (missionLifecycle.ts)", () => {
  describe("Initial State Creation & Defaults", () => {
    it("creates nominal pre-launch lifecycle state with default epoch", () => {
      const state = createInitialLifecycleState();

      expect(state.missionElapsedSeconds).toBe(0);
      expect(state.epochJulianDate).toBe(DEFAULT_EPOCH_JULIAN_DATE);
      expect(state.currentJulianDate).toBe(DEFAULT_EPOCH_JULIAN_DATE);
      expect(state.orbitIndex).toBe(1);
      expect(state.trueAnomalyDeg).toBe(0);
      expect(state.currentPhase).toBe("PRE_LAUNCH");
      expect(state.previousPhase).toBeNull();
      expect(state.simulationStatus).toBe("IDLE");
      expect(state.isHardwareInhibited).toBeTrue();
      expect(state.separationOccurred).toBeFalse();
      expect(state.deployableTimerElapsedMin).toBe(0);
      expect(state.rfQuietTimerElapsedMin).toBe(0);
    });

    it("accepts custom initial options and preserves immutability", () => {
      const customJd = julianDate(2460000.5);
      const state = createInitialLifecycleState({
        epochJulianDate: customJd,
        orbitIndex: 3,
        trueAnomalyDeg: degrees(180),
      });

      expect(state.epochJulianDate).toBe(customJd);
      expect(state.currentJulianDate).toBe(customJd);
      expect(state.orbitIndex).toBe(3);
      expect(state.trueAnomalyDeg).toBe(180);
      expect(Object.isFrozen(state)).toBeTrue();
    });

    it("rejects invalid non-positive epoch Julian Date", () => {
      expect(() => createInitialLifecycleState({ epochJulianDate: julianDate(0) })).toThrow(ValidationError);
      expect(() => createInitialLifecycleState({ epochJulianDate: julianDate(-100) })).toThrow(ValidationError);
    });
  });

  describe("Phase Transition Graph Validation", () => {
    it("validates all legal transitions defined in specification §4.1", () => {
      // PRE_LAUNCH -> LAUNCH_ASCENT
      expect(isValidPhaseTransition("PRE_LAUNCH", "LAUNCH_ASCENT")).toBeTrue();

      // LAUNCH_ASCENT -> DISPENSER_DEPLOYMENT
      expect(isValidPhaseTransition("LAUNCH_ASCENT", "DISPENSER_DEPLOYMENT")).toBeTrue();

      // DISPENSER_DEPLOYMENT -> INHIBIT_COUNTDOWN
      expect(isValidPhaseTransition("DISPENSER_DEPLOYMENT", "INHIBIT_COUNTDOWN")).toBeTrue();

      // INHIBIT_COUNTDOWN -> SOLAR_ARRAY_DEPLOYMENT and PRE_LAUNCH (reset)
      expect(isValidPhaseTransition("INHIBIT_COUNTDOWN", "SOLAR_ARRAY_DEPLOYMENT")).toBeTrue();
      expect(isValidPhaseTransition("INHIBIT_COUNTDOWN", "PRE_LAUNCH")).toBeTrue();

      // SOLAR_ARRAY_DEPLOYMENT -> DETUMBLE_ACQUISITION and SAFE_MODE
      expect(isValidPhaseTransition("SOLAR_ARRAY_DEPLOYMENT", "DETUMBLE_ACQUISITION")).toBeTrue();
      expect(isValidPhaseTransition("SOLAR_ARRAY_DEPLOYMENT", "SAFE_MODE")).toBeTrue();

      // DETUMBLE_ACQUISITION -> COMMISSIONING and SAFE_MODE
      expect(isValidPhaseTransition("DETUMBLE_ACQUISITION", "COMMISSIONING")).toBeTrue();
      expect(isValidPhaseTransition("DETUMBLE_ACQUISITION", "SAFE_MODE")).toBeTrue();

      // COMMISSIONING -> SCIENCE_OPERATIONS and SAFE_MODE
      expect(isValidPhaseTransition("COMMISSIONING", "SCIENCE_OPERATIONS")).toBeTrue();
      expect(isValidPhaseTransition("COMMISSIONING", "SAFE_MODE")).toBeTrue();

      // SCIENCE_OPERATIONS -> GROUND_PASS, ORBIT_MANEUVER, SAFE_MODE, END_OF_MISSION_DISPOSAL
      expect(isValidPhaseTransition("SCIENCE_OPERATIONS", "GROUND_PASS")).toBeTrue();
      expect(isValidPhaseTransition("SCIENCE_OPERATIONS", "ORBIT_MANEUVER")).toBeTrue();
      expect(isValidPhaseTransition("SCIENCE_OPERATIONS", "SAFE_MODE")).toBeTrue();
      expect(isValidPhaseTransition("SCIENCE_OPERATIONS", "END_OF_MISSION_DISPOSAL")).toBeTrue();

      // Return transitions
      expect(isValidPhaseTransition("GROUND_PASS", "SCIENCE_OPERATIONS")).toBeTrue();
      expect(isValidPhaseTransition("GROUND_PASS", "SAFE_MODE")).toBeTrue();
      expect(isValidPhaseTransition("ORBIT_MANEUVER", "SCIENCE_OPERATIONS")).toBeTrue();
      expect(isValidPhaseTransition("ORBIT_MANEUVER", "SAFE_MODE")).toBeTrue();
      expect(isValidPhaseTransition("SAFE_MODE", "SCIENCE_OPERATIONS")).toBeTrue();
      expect(isValidPhaseTransition("SAFE_MODE", "DETUMBLE_ACQUISITION")).toBeTrue();

      // Terminal phase has no outgoing transitions
      expect(isValidPhaseTransition("END_OF_MISSION_DISPOSAL", "SCIENCE_OPERATIONS")).toBeFalse();
      expect(isValidPhaseTransition("END_OF_MISSION_DISPOSAL", "PRE_LAUNCH")).toBeFalse();
    });

    it("rejects illegal transitions with descriptive ValidationError", () => {
      expect(() => assertValidPhaseTransition("PRE_LAUNCH", "SCIENCE_OPERATIONS")).toThrow(ValidationError);
      expect(() => assertValidPhaseTransition("PRE_LAUNCH", "COMMISSIONING")).toThrow(ValidationError);
      expect(() => assertValidPhaseTransition("DISPENSER_DEPLOYMENT", "COMMISSIONING")).toThrow(ValidationError);
      expect(() => assertValidPhaseTransition("INHIBIT_COUNTDOWN", "SCIENCE_OPERATIONS")).toThrow(ValidationError);
      expect(() => assertValidPhaseTransition("END_OF_MISSION_DISPOSAL", "PRE_LAUNCH")).toThrow(ValidationError);
    });

    it("verifies completeness of LEGAL_PHASE_TRANSITIONS table", () => {
      expect(ALL_MISSION_PHASES.length).toBe(12);
      for (const phase of ALL_MISSION_PHASES) {
        expect(Array.isArray(LEGAL_PHASE_TRANSITIONS[phase])).toBeTrue();
      }
    });
  });

  describe("Master Simulation Clock & Time Progression", () => {
    it("advances master elapsed time and current Julian Date continuously", () => {
      let state = createInitialLifecycleState();

      // Step forward by 10.0 seconds
      state = stepLifecycleClock(state, seconds(10.0));
      expect(state.missionElapsedSeconds).toBe(10.0);
      expect(state.currentJulianDate).toBeCloseTo(DEFAULT_EPOCH_JULIAN_DATE + 10.0 / 86400.0, 10);
      expect(state.simulationStatus).toBe("RUNNING");

      // Step forward by 50.0 seconds
      state = stepLifecycleClock(state, seconds(50.0));
      expect(state.missionElapsedSeconds).toBe(60.0);
      expect(state.currentJulianDate).toBeCloseTo(DEFAULT_EPOCH_JULIAN_DATE + 60.0 / 86400.0, 10);
    });

    it("does not advance timers while pre-separation or hardware inhibited", () => {
      let state = createInitialLifecycleState(); // PRE_LAUNCH: inhibited = true, separated = false

      state = stepLifecycleClock(state, seconds(600.0));
      expect(state.missionElapsedSeconds).toBe(600.0);
      expect(state.deployableTimerElapsedMin).toBe(0.0);
      expect(state.rfQuietTimerElapsedMin).toBe(0.0);
    });

    it("advances post-separation timers independently once separated and uninhibited", () => {
      let state = createInitialLifecycleState();

      // Sequence to INHIBIT_COUNTDOWN
      state = transitionPhase(state, "LAUNCH_ASCENT");
      state = transitionPhase(state, "DISPENSER_DEPLOYMENT");
      state = transitionPhase(state, "INHIBIT_COUNTDOWN");

      expect(state.isHardwareInhibited).toBeFalse();
      expect(state.separationOccurred).toBeTrue();

      // Step forward by 1200 seconds (20 minutes)
      state = stepLifecycleClock(state, seconds(1200.0));
      expect(state.missionElapsedSeconds).toBe(1200.0);
      expect(state.deployableTimerElapsedMin).toBeCloseTo(20.0, 8);
      expect(state.rfQuietTimerElapsedMin).toBeCloseTo(20.0, 8);

      const deployStatus = getDeployableTimerStatus(state);
      expect(deployStatus.timerExpired).toBeFalse();
      expect(deployStatus.inhibitRemainingMinutes).toBeCloseTo(10.0, 8);

      const rfStatus = getRfQuietTimerStatus(state);
      expect(rfStatus.timerExpired).toBeFalse();
      expect(rfStatus.inhibitRemainingMinutes).toBeCloseTo(25.0, 8);
    });
  });

  describe("Inhibit Gating & Boundary Protections", () => {
    it("prohibits solar array deployment before 30 minutes post-separation (CDS §2.4.4)", () => {
      let state = createInitialLifecycleState();
      state = transitionPhase(state, "LAUNCH_ASCENT");
      state = transitionPhase(state, "DISPENSER_DEPLOYMENT");
      state = transitionPhase(state, "INHIBIT_COUNTDOWN");

      // Advance by only 25 minutes (1500 seconds)
      state = stepLifecycleClock(state, seconds(1500.0));
      expect(state.deployableTimerElapsedMin).toBeCloseTo(25.0, 8);
      expect(isDeployableReleasePermitted(state)).toBeFalse();

      // Attempting premature deployment must throw
      expect(() => transitionPhase(state, "SOLAR_ARRAY_DEPLOYMENT")).toThrow(ValidationError);

      // Advance by remaining 5 minutes (300 seconds) to reach 30.0 min
      state = stepLifecycleClock(state, seconds(300.0));
      expect(state.deployableTimerElapsedMin).toBeCloseTo(30.0, 8);
      expect(isDeployableReleasePermitted(state)).toBeTrue();

      // Now deployment is legally permitted
      expect(() => transitionPhase(state, "SOLAR_ARRAY_DEPLOYMENT")).not.toThrow();
    });

    it("prohibits commissioning before 45 minutes RF quiet has elapsed (CDS §2.4.5)", () => {
      let state = createInitialLifecycleState();
      state = transitionPhase(state, "LAUNCH_ASCENT");
      state = transitionPhase(state, "DISPENSER_DEPLOYMENT");
      state = transitionPhase(state, "INHIBIT_COUNTDOWN");

      // Step to 30 min (1800 s) and deploy arrays
      state = stepLifecycleClock(state, seconds(1800.0));
      state = transitionPhase(state, "SOLAR_ARRAY_DEPLOYMENT");
      state = transitionPhase(state, "DETUMBLE_ACQUISITION");

      // At t = 1800 s (30 min), RF quiet timer is 30 min < 45 min
      expect(isRfTransmissionPermitted(state)).toBeFalse();
      expect(() => transitionPhase(state, "COMMISSIONING")).toThrow(ValidationError);

      // Step by additional 15 min (900 s) to reach 45 min MET
      state = stepLifecycleClock(state, seconds(900.0));
      expect(state.rfQuietTimerElapsedMin).toBeCloseTo(45.0, 8);
      expect(isRfTransmissionPermitted(state)).toBeTrue();

      // Transition to COMMISSIONING is now legal
      expect(() => transitionPhase(state, "COMMISSIONING")).not.toThrow();
    });

    it("enforces that timers do NOT replace physical electrical inhibits", () => {
      let state = createInitialLifecycleState();
      state = transitionPhase(state, "LAUNCH_ASCENT");
      state = transitionPhase(state, "DISPENSER_DEPLOYMENT");
      state = transitionPhase(state, "INHIBIT_COUNTDOWN");

      // Advance timers well past 45 minutes
      state = stepLifecycleClock(state, seconds(3600.0)); // 60 minutes
      expect(state.deployableTimerElapsedMin).toBeCloseTo(60.0, 8);
      expect(state.rfQuietTimerElapsedMin).toBeCloseTo(60.0, 8);

      // Manually force hardware inhibited (e.g. physical test fixture switch or RBF pin inserted)
      const inhibitedState = Object.freeze({
        ...state,
        isHardwareInhibited: true,
      });

      // Even though timers are 60 min, release and transmission MUST be forbidden!
      expect(isDeployableReleasePermitted(inhibitedState)).toBeFalse();
      expect(isRfTransmissionPermitted(inhibitedState)).toBeFalse();
      expect(() => transitionPhase(inhibitedState, "SOLAR_ARRAY_DEPLOYMENT")).toThrow(ValidationError);
      expect(() => transitionPhase(inhibitedState, "COMMISSIONING")).toThrow(ValidationError);
    });
  });

  describe("CDS Rev 14.1 §2.3.2.4 Deployment Switch Restow / Bounce Reset", () => {
    it("resets post-separation timers and reverts to PRE_LAUNCH while preserving master MET", () => {
      let state = createInitialLifecycleState();
      state = transitionPhase(state, "LAUNCH_ASCENT");
      state = transitionPhase(state, "DISPENSER_DEPLOYMENT");
      state = transitionPhase(state, "INHIBIT_COUNTDOWN");

      // Step forward 20 minutes (1200 seconds)
      state = stepLifecycleClock(state, seconds(1200.0));
      expect(state.missionElapsedSeconds).toBe(1200.0);
      expect(state.deployableTimerElapsedMin).toBeCloseTo(20.0, 8);
      expect(state.rfQuietTimerElapsedMin).toBeCloseTo(20.0, 8);

      // Rail switch depressed / restowed at t = 1200 s via context
      state = stepLifecycleClock(state, seconds(0.0), {
        hardwareInhibited: true,
        separationOccurred: false,
      });

      // Verification of CDS §2.3.2.4 reset:
      expect(state.currentPhase).toBe("PRE_LAUNCH");
      expect(state.isHardwareInhibited).toBeTrue();
      expect(state.separationOccurred).toBeFalse();
      expect(state.deployableTimerElapsedMin).toBe(0.0);
      expect(state.rfQuietTimerElapsedMin).toBe(0.0);

      // CRITICAL CHECK: Master simulation clock must NOT reset!
      expect(state.missionElapsedSeconds).toBe(1200.0);

      // Re-separation occurs at t = 1500 s (after 300 s in pre-launch)
      state = stepLifecycleClock(state, seconds(300.0));
      expect(state.missionElapsedSeconds).toBe(1500.0);

      // Transition to INHIBIT_COUNTDOWN again
      state = transitionPhase(state, "LAUNCH_ASCENT");
      state = transitionPhase(state, "DISPENSER_DEPLOYMENT");
      state = transitionPhase(state, "INHIBIT_COUNTDOWN");

      // Timers now restart from 0.0 at t = 1500 s!
      expect(state.deployableTimerElapsedMin).toBe(0.0);
      expect(state.rfQuietTimerElapsedMin).toBe(0.0);

      // Advance by 30 minutes (1800 s) from re-separation
      state = stepLifecycleClock(state, seconds(1800.0));
      expect(state.missionElapsedSeconds).toBe(3300.0); // 1500 + 1800 = 3300 s
      expect(state.deployableTimerElapsedMin).toBeCloseTo(30.0, 8);

      // Solar array release permitted at t = 3300 s (Case S-3 baseline!)
      expect(isDeployableReleasePermitted(state)).toBeTrue();
    });

    it("executes manual switch reset via triggerSwitchReset helper", () => {
      let state = createInitialLifecycleState();
      state = transitionPhase(state, "LAUNCH_ASCENT");
      state = transitionPhase(state, "DISPENSER_DEPLOYMENT");
      state = transitionPhase(state, "INHIBIT_COUNTDOWN");
      state = stepLifecycleClock(state, seconds(900.0));

      expect(state.missionElapsedSeconds).toBe(900.0);
      expect(state.deployableTimerElapsedMin).toBeCloseTo(15.0, 8);

      const resetState = triggerSwitchReset(state);
      expect(resetState.currentPhase).toBe("PRE_LAUNCH");
      expect(resetState.previousPhase).toBe("INHIBIT_COUNTDOWN");
      expect(resetState.isHardwareInhibited).toBeTrue();
      expect(resetState.separationOccurred).toBeFalse();
      expect(resetState.deployableTimerElapsedMin).toBe(0.0);
      expect(resetState.rfQuietTimerElapsedMin).toBe(0.0);
      expect(resetState.missionElapsedSeconds).toBe(900.0); // Preserved!
    });
  });

  describe("Terminal State Protection & Simulation Control", () => {
    it("handles pause and resume commands accurately", () => {
      let state = createInitialLifecycleState();
      state = stepLifecycleClock(state, seconds(10.0));
      expect(state.simulationStatus).toBe("RUNNING");

      state = pauseSimulation(state);
      expect(state.simulationStatus).toBe("PAUSED");

      // Stepping while paused does not advance master clock
      const pausedStep = stepLifecycleClock(state, seconds(60.0));
      expect(pausedStep.missionElapsedSeconds).toBe(10.0);

      state = resumeSimulation(state);
      expect(state.simulationStatus).toBe("RUNNING");
      state = stepLifecycleClock(state, seconds(20.0));
      expect(state.missionElapsedSeconds).toBe(30.0);
    });

    it("terminates with failure and prevents further stepping or phase changes", () => {
      let state = createInitialLifecycleState();
      state = stepLifecycleClock(state, seconds(10.0));

      state = terminateSimulation(state, "FAILURE");
      expect(state.simulationStatus).toBe("TERMINATED_FAILURE");

      // Cannot advance time
      expect(() => stepLifecycleClock(state, seconds(10.0))).toThrow(ValidationError);

      // Cannot change phase
      expect(() => transitionPhase(state, "LAUNCH_ASCENT")).toThrow(ValidationError);

      // Cannot resume
      expect(() => resumeSimulation(state)).toThrow(ValidationError);
    });

    it("terminates with completion and locks state", () => {
      let state = createInitialLifecycleState();
      state = terminateSimulation(state, "COMPLETED");
      expect(state.simulationStatus).toBe("COMPLETED");

      expect(() => stepLifecycleClock(state, seconds(1.0))).toThrow(ValidationError);
      expect(() => transitionPhase(state, "LAUNCH_ASCENT")).toThrow(ValidationError);
    });

    it("executes simulation control commands via executeSimulationControl", () => {
      let state = createInitialLifecycleState();
      state = executeSimulationControl(state, { action: "START" });
      expect(state.simulationStatus).toBe("RUNNING");

      state = executeSimulationControl(state, { action: "STEP", stepDurationSeconds: seconds(15.0) });
      expect(state.missionElapsedSeconds).toBe(15.0);

      state = executeSimulationControl(state, { action: "FAST_FORWARD", stepDurationSeconds: seconds(100.0) });
      expect(state.missionElapsedSeconds).toBe(115.0);

      state = executeSimulationControl(state, { action: "PAUSE" });
      expect(state.simulationStatus).toBe("PAUSED");

      state = executeSimulationControl(state, { action: "RESET" });
      expect(state.missionElapsedSeconds).toBe(0.0);
      expect(state.simulationStatus).toBe("IDLE");
    });
  });

  describe("Object-Oriented MissionLifecycleManager Class Wrapper", () => {
    it("executes complete nominal mission lifecycle through class wrapper", () => {
      const manager = new MissionLifecycleManager();
      expect(manager.getState().currentPhase).toBe("PRE_LAUNCH");

      // Ascent & deployment
      manager.step(seconds(120.0));
      manager.transitionTo("LAUNCH_ASCENT");
      manager.step(seconds(600.0));
      manager.transitionTo("DISPENSER_DEPLOYMENT");
      manager.step(seconds(30.0));
      manager.transitionTo("INHIBIT_COUNTDOWN");

      expect(manager.isDeployablePermitted()).toBeFalse();
      expect(manager.isRfPermitted()).toBeFalse();

      // Step to 30 min (1800 s) post-separation
      manager.step(seconds(1800.0));
      expect(manager.isDeployablePermitted()).toBeTrue();
      expect(manager.isRfPermitted()).toBeFalse();

      manager.transitionTo("SOLAR_ARRAY_DEPLOYMENT");
      manager.step(seconds(60.0));
      manager.transitionTo("DETUMBLE_ACQUISITION");

      // Step additional 15 min (900 s) to reach 45 min
      manager.step(seconds(900.0));
      expect(manager.isRfPermitted()).toBeTrue();

      manager.transitionTo("COMMISSIONING");
      manager.step(seconds(600.0));
      manager.transitionTo("SCIENCE_OPERATIONS");

      expect(manager.getState().currentPhase).toBe("SCIENCE_OPERATIONS");

      // Science -> Ground Pass -> Science
      manager.transitionTo("GROUND_PASS");
      manager.step(seconds(480.0)); // 8 minute ground pass
      manager.transitionTo("SCIENCE_OPERATIONS");

      // Science -> Orbit Maneuver -> Science
      manager.transitionTo("ORBIT_MANEUVER");
      manager.step(seconds(863.0)); // Case S-5 burn duration
      manager.transitionTo("SCIENCE_OPERATIONS");

      // Science -> Safe Mode -> Science
      manager.transitionTo("SAFE_MODE");
      manager.step(seconds(1800.0));
      manager.transitionTo("SCIENCE_OPERATIONS");

      // Science -> Disposal -> Completion
      manager.transitionTo("END_OF_MISSION_DISPOSAL");
      manager.terminate("COMPLETED");

      expect(manager.getState().simulationStatus).toBe("COMPLETED");
      expect(manager.getState().currentPhase).toBe("END_OF_MISSION_DISPOSAL");
    });
  });
});
