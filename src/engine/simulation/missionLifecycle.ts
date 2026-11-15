/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Mission Lifecycle & State Machine (Phase 3 Module 2)
 *
 * Implements the deterministic spacecraft operational lifecycle state machine,
 * master simulation clock, independent countdown timer progression, legal transition
 * verification, physical inhibit gating, and CDS Rev 14.1 §2.3.2.4 reset semantics.
 *
 * Physical & Standards Compliance:
 * - Cal Poly CDS Rev 14.1 §2.4.4: 30-minute post-separation deployable delay.
 * - Cal Poly CDS Rev 14.1 §2.4.5: 45-minute post-separation RF transmission quiet period.
 * - Cal Poly CDS Rev 14.1 §2.3.2.4: Switch depression / restow resets timers and pre-launch state
 *   while preserving master mission elapsed time.
 * - NASA LSP-REQ-317.01 Rev B §§6.2.10–6.2.11: Physical electrical inhibit independence (timers
 *   do not replace physical inhibits).
 */

import {
  Seconds,
  Minutes,
  Degrees,
  JulianDate,
  seconds,
  minutes,
  degrees,
  julianDate,
  ValidationError,
  assertFinitePositive,
  assertFiniteNonNegative,
} from "./simUnits";

import {
  evaluatePolicyTimer,
  PolicyTimerResult,
  OPERATIONAL_POLICIES,
} from "../standards/operationalPolicies";

// ============================================================================
// 1. Simulation Lifecycle Types & Statuses
// ============================================================================

export type SimulationStatus =
  | "IDLE"
  | "RUNNING"
  | "PAUSED"
  | "COMPLETED"
  | "TERMINATED_FAILURE";

export type MissionPhase =
  | "PRE_LAUNCH"
  | "LAUNCH_ASCENT"
  | "DISPENSER_DEPLOYMENT"
  | "INHIBIT_COUNTDOWN"
  | "SOLAR_ARRAY_DEPLOYMENT"
  | "DETUMBLE_ACQUISITION"
  | "COMMISSIONING"
  | "SCIENCE_OPERATIONS"
  | "GROUND_PASS"
  | "ORBIT_MANEUVER"
  | "SAFE_MODE"
  | "END_OF_MISSION_DISPOSAL";

export interface LifecycleClockState {
  readonly missionElapsedSeconds: Seconds;
  readonly epochJulianDate: JulianDate;
  readonly currentJulianDate: JulianDate;
  readonly orbitIndex: number;
  readonly trueAnomalyDeg: Degrees;
  readonly currentPhase: MissionPhase;
  readonly previousPhase: MissionPhase | null;
  readonly simulationStatus: SimulationStatus;
  readonly isHardwareInhibited: boolean;
  readonly separationOccurred: boolean;
  readonly deployableTimerElapsedMin: Minutes;
  readonly rfQuietTimerElapsedMin: Minutes;
}

export interface SimulationControlCommand {
  readonly action: "START" | "PAUSE" | "RESUME" | "STEP" | "FAST_FORWARD" | "RESET";
  readonly stepDurationSeconds?: Seconds;
}

export interface InitialLifecycleOptions {
  readonly epochJulianDate?: JulianDate;
  readonly initialPhase?: MissionPhase;
  readonly initialStatus?: SimulationStatus;
  readonly isHardwareInhibited?: boolean;
  readonly separationOccurred?: boolean;
  readonly orbitIndex?: number;
  readonly trueAnomalyDeg?: Degrees;
}

export interface StepContext {
  readonly hardwareInhibited?: boolean;
  readonly separationOccurred?: boolean;
  readonly orbitIndex?: number;
  readonly trueAnomalyDeg?: Degrees;
}

export interface TransitionContext {
  readonly bypassTimerGuards?: boolean; // For testing anomaly injects only
  readonly reason?: string;
}

// ============================================================================
// 2. Legal Phase Transition Table
// ============================================================================

/**
 * Directed graph defining all legally permitted spacecraft operational transitions.
 * Derived from Phase 3 Specification §4.1 state diagram.
 */
export const LEGAL_PHASE_TRANSITIONS: Readonly<
  Record<MissionPhase, readonly MissionPhase[]>
> = Object.freeze({
  PRE_LAUNCH: Object.freeze<MissionPhase[]>(["LAUNCH_ASCENT"]),
  LAUNCH_ASCENT: Object.freeze<MissionPhase[]>(["DISPENSER_DEPLOYMENT"]),
  DISPENSER_DEPLOYMENT: Object.freeze<MissionPhase[]>(["INHIBIT_COUNTDOWN"]),
  INHIBIT_COUNTDOWN: Object.freeze<MissionPhase[]>(["SOLAR_ARRAY_DEPLOYMENT", "PRE_LAUNCH"]),
  SOLAR_ARRAY_DEPLOYMENT: Object.freeze<MissionPhase[]>(["DETUMBLE_ACQUISITION", "SAFE_MODE"]),
  DETUMBLE_ACQUISITION: Object.freeze<MissionPhase[]>(["COMMISSIONING", "SAFE_MODE"]),
  COMMISSIONING: Object.freeze<MissionPhase[]>(["SCIENCE_OPERATIONS", "SAFE_MODE"]),
  SCIENCE_OPERATIONS: Object.freeze<MissionPhase[]>([
    "GROUND_PASS",
    "ORBIT_MANEUVER",
    "SAFE_MODE",
    "END_OF_MISSION_DISPOSAL",
  ]),
  GROUND_PASS: Object.freeze<MissionPhase[]>(["SCIENCE_OPERATIONS", "SAFE_MODE"]),
  ORBIT_MANEUVER: Object.freeze<MissionPhase[]>(["SCIENCE_OPERATIONS", "SAFE_MODE"]),
  SAFE_MODE: Object.freeze<MissionPhase[]>(["SCIENCE_OPERATIONS", "DETUMBLE_ACQUISITION"]),
  END_OF_MISSION_DISPOSAL: Object.freeze<MissionPhase[]>([]), // Terminal operational phase
});

export const ALL_MISSION_PHASES: readonly MissionPhase[] = Object.freeze(
  Object.keys(LEGAL_PHASE_TRANSITIONS) as MissionPhase[]
);

// Default J2000 epoch: 2000-01-01 12:00:00 TT (JD 2451545.0)
export const DEFAULT_EPOCH_JULIAN_DATE: JulianDate = julianDate(2451545.0);

// ============================================================================
// 3. Validation & Transition Query Functions
// ============================================================================

/**
 * Evaluates whether a transition between two operational phases is legally permitted.
 */
export function isValidPhaseTransition(
  from: MissionPhase,
  to: MissionPhase
): boolean {
  const allowed = LEGAL_PHASE_TRANSITIONS[from];
  return allowed ? allowed.includes(to) : false;
}

/**
 * Asserts that a phase transition is legally permitted, throwing ValidationError on failure.
 */
export function assertValidPhaseTransition(
  from: MissionPhase,
  to: MissionPhase
): void {
  if (!isValidPhaseTransition(from, to)) {
    const allowed = LEGAL_PHASE_TRANSITIONS[from];
    const allowedStr = allowed && allowed.length > 0 ? allowed.join(", ") : "none (terminal phase)";
    throw new ValidationError(
      "phaseTransition",
      `Illegal mission phase transition from "${from}" to "${to}". Allowed transitions: ${allowedStr}`
    );
  }
}

// ============================================================================
// 4. Policy Timer Evaluation Helpers
// ============================================================================

/**
 * Evaluates the Cal Poly CDS 30-minute deployable delay timer status.
 */
export function getDeployableTimerStatus(
  state: LifecycleClockState
): PolicyTimerResult {
  return evaluatePolicyTimer({
    policyId: OPERATIONAL_POLICIES.CDS_REV_14_1_DEPLOY_DELAY.id,
    separationOccurred: state.separationOccurred,
    hardwareCurrentlyInhibited: state.isHardwareInhibited,
    timerElapsedMinutes: state.deployableTimerElapsedMin,
  });
}

/**
 * Evaluates the Cal Poly CDS 45-minute RF transmission quiet period timer status.
 */
export function getRfQuietTimerStatus(
  state: LifecycleClockState
): PolicyTimerResult {
  return evaluatePolicyTimer({
    policyId: OPERATIONAL_POLICIES.CDS_REV_14_1_RF_QUIET.id,
    separationOccurred: state.separationOccurred,
    hardwareCurrentlyInhibited: state.isHardwareInhibited,
    timerElapsedMinutes: state.rfQuietTimerElapsedMin,
  });
}

/**
 * Evaluates whether deployable release (antennas/arrays) is legally and physically permitted.
 * Both the 30-minute timer AND physical separation switches must be clear.
 */
export function isDeployableReleasePermitted(
  state: LifecycleClockState
): boolean {
  if (state.isHardwareInhibited || !state.separationOccurred) {
    return false;
  }
  return getDeployableTimerStatus(state).timerExpired;
}

/**
 * Evaluates whether RF transmitter keying is legally and physically permitted.
 * Both the 45-minute timer AND physical electrical inhibits must be clear.
 */
export function isRfTransmissionPermitted(
  state: LifecycleClockState
): boolean {
  if (state.isHardwareInhibited || !state.separationOccurred) {
    return false;
  }
  return getRfQuietTimerStatus(state).timerExpired;
}

// ============================================================================
// 5. Lifecycle State Construction & Factory
// ============================================================================

/**
 * Creates an immutable initial mission lifecycle state.
 */
export function createInitialLifecycleState(
  options?: InitialLifecycleOptions
): LifecycleClockState {
  const epoch = options?.epochJulianDate ?? DEFAULT_EPOCH_JULIAN_DATE;
  assertFinitePositive(epoch, "epochJulianDate");

  const phase: MissionPhase = options?.initialPhase ?? "PRE_LAUNCH";
  const status: SimulationStatus = options?.initialStatus ?? "IDLE";

  // Pre-separation phases default to inhibited and not separated
  const isPreSeparation =
    phase === "PRE_LAUNCH" ||
    phase === "LAUNCH_ASCENT" ||
    phase === "DISPENSER_DEPLOYMENT";

  const isHardwareInhibited =
    options?.isHardwareInhibited !== undefined
      ? options.isHardwareInhibited
      : isPreSeparation;

  const separationOccurred =
    options?.separationOccurred !== undefined
      ? options.separationOccurred
      : !isPreSeparation;

  const orbitIndex = options?.orbitIndex ?? 1;
  const trueAnomalyDeg = options?.trueAnomalyDeg ?? degrees(0.0);

  return Object.freeze({
    missionElapsedSeconds: seconds(0.0),
    epochJulianDate: epoch,
    currentJulianDate: epoch,
    orbitIndex,
    trueAnomalyDeg,
    currentPhase: phase,
    previousPhase: null,
    simulationStatus: status,
    isHardwareInhibited,
    separationOccurred,
    deployableTimerElapsedMin: minutes(0.0),
    rfQuietTimerElapsedMin: minutes(0.0),
  });
}

// ============================================================================
// 6. State Machine Transitions & Stepping Core
// ============================================================================

/**
 * Advances the simulation master clock and post-separation timers forward by stepSeconds.
 * Handles CDS Rev 14.1 §2.3.2.4 switch bounce / restow reset without resetting mission elapsed time.
 */
export function stepLifecycleClock(
  state: LifecycleClockState,
  stepSeconds: Seconds,
  context?: StepContext
): LifecycleClockState {
  assertFiniteNonNegative(stepSeconds, "stepSeconds");

  // Terminal states cannot advance
  if (
    state.simulationStatus === "TERMINATED_FAILURE" ||
    state.simulationStatus === "COMPLETED"
  ) {
    if (stepSeconds > 0) {
      throw new ValidationError(
        "simulationStatus",
        `Cannot step simulation in terminal status: "${state.simulationStatus}"`
      );
    }
    return state;
  }

  // Paused simulation does not advance clock
  if (state.simulationStatus === "PAUSED") {
    return state;
  }

  // Check switch state overrides from context
  const hardwareInhibited =
    context?.hardwareInhibited !== undefined
      ? context.hardwareInhibited
      : state.isHardwareInhibited;

  const separationOccurred =
    context?.separationOccurred !== undefined
      ? context.separationOccurred
      : state.separationOccurred;

  const orbitIndex = context?.orbitIndex ?? state.orbitIndex;
  const trueAnomalyDeg = context?.trueAnomalyDeg ?? state.trueAnomalyDeg;

  // Advance master simulation clock (MET is strictly monotonic and never resets)
  const newElapsedSeconds = seconds(state.missionElapsedSeconds + stepSeconds);
  const newJulianDate = julianDate(
    state.epochJulianDate + newElapsedSeconds / 86400.0
  );

  // Check CDS Rev 14.1 §2.3.2.4 reset condition:
  // If the switch toggles back to depressed or separation was canceled during countdown
  const isSwitchRestowedOrDepressed =
    hardwareInhibited || !separationOccurred;

  let currentPhase = state.currentPhase;
  let previousPhase = state.previousPhase;
  let newDeployableTimerMin = state.deployableTimerElapsedMin;
  let newRfQuietTimerMin = state.rfQuietTimerElapsedMin;

  if (isSwitchRestowedOrDepressed) {
    // CDS §2.3.2.4 Reset Enactment:
    // Timers reset to 0.0, phase reverts to PRE_LAUNCH, separation cancelled
    if (state.currentPhase === "INHIBIT_COUNTDOWN") {
      previousPhase = state.currentPhase;
      currentPhase = "PRE_LAUNCH";
    }
    newDeployableTimerMin = minutes(0.0);
    newRfQuietTimerMin = minutes(0.0);
  } else if (separationOccurred && !hardwareInhibited) {
    // Both timers advance independently based on post-separation elapsed time
    const stepMinutes = stepSeconds / 60.0;
    newDeployableTimerMin = minutes(state.deployableTimerElapsedMin + stepMinutes);
    newRfQuietTimerMin = minutes(state.rfQuietTimerElapsedMin + stepMinutes);
  }

  return Object.freeze({
    missionElapsedSeconds: newElapsedSeconds,
    epochJulianDate: state.epochJulianDate,
    currentJulianDate: newJulianDate,
    orbitIndex,
    trueAnomalyDeg,
    currentPhase,
    previousPhase,
    simulationStatus: state.simulationStatus === "IDLE" ? "RUNNING" : state.simulationStatus,
    isHardwareInhibited: hardwareInhibited,
    separationOccurred: isSwitchRestowedOrDepressed ? false : separationOccurred,
    deployableTimerElapsedMin: newDeployableTimerMin,
    rfQuietTimerElapsedMin: newRfQuietTimerMin,
  });
}

/**
 * Transitions the spacecraft to the next operational phase after verifying legal transitions
 * and institutional safety inhibit requirements.
 */
export function transitionPhase(
  state: LifecycleClockState,
  nextPhase: MissionPhase,
  context?: TransitionContext
): LifecycleClockState {
  if (
    state.simulationStatus === "TERMINATED_FAILURE" ||
    state.simulationStatus === "COMPLETED"
  ) {
    throw new ValidationError(
      "simulationStatus",
      `Cannot transition phase in terminal status: "${state.simulationStatus}"`
    );
  }

  if (state.currentPhase === nextPhase) {
    return state;
  }

  // 1. Verify Legal Graph Transition
  assertValidPhaseTransition(state.currentPhase, nextPhase);

  // 2. Verify Institutional Inhibit Guards (unless explicitly bypassed for anomaly testing)
  if (!context?.bypassTimerGuards) {
    // Guard A: Deployable Mechanism Release (CDS Rev 14.1 §2.4.4)
    if (nextPhase === "SOLAR_ARRAY_DEPLOYMENT") {
      if (state.isHardwareInhibited) {
        throw new ValidationError(
          "phaseTransition",
          "Cannot deploy solar arrays: hardware is physically inhibited inside dispenser"
        );
      }
      if (!state.separationOccurred) {
        throw new ValidationError(
          "phaseTransition",
          "Cannot deploy solar arrays: dispenser separation has not occurred"
        );
      }
      const deployStatus = getDeployableTimerStatus(state);
      if (!deployStatus.timerExpired) {
        throw new ValidationError(
          "phaseTransition",
          `Premature deployable actuation violation (CDS Rev 14.1 §2.4.4): 30-minute delay has not expired. Elapsed: ${state.deployableTimerElapsedMin} min, Remaining: ${deployStatus.inhibitRemainingMinutes} min`
        );
      }
    }

    // Guard B: RF Transmitter Keying / Commissioning (CDS Rev 14.1 §2.4.5)
    if (nextPhase === "COMMISSIONING") {
      if (state.isHardwareInhibited) {
        throw new ValidationError(
          "phaseTransition",
          "Cannot enter commissioning: RF transmitters are physically inhibited"
        );
      }
      if (!state.separationOccurred) {
        throw new ValidationError(
          "phaseTransition",
          "Cannot enter commissioning: dispenser separation has not occurred"
        );
      }
      const rfStatus = getRfQuietTimerStatus(state);
      if (!rfStatus.timerExpired) {
        throw new ValidationError(
          "phaseTransition",
          `Range Safety RF inhibit violation (CDS Rev 14.1 §2.4.5): 45-minute RF quiet period has not expired. Elapsed: ${state.rfQuietTimerElapsedMin} min, Remaining: ${rfStatus.inhibitRemainingMinutes} min`
        );
      }
    }
  }

  // Phase transition state updates:
  let isHardwareInhibited = state.isHardwareInhibited;
  let separationOccurred = state.separationOccurred;

  if (nextPhase === "INHIBIT_COUNTDOWN") {
    // Dispenser exit: rail switches release
    isHardwareInhibited = false;
    separationOccurred = true;
  } else if (nextPhase === "PRE_LAUNCH") {
    // Restowed or reset
    isHardwareInhibited = true;
    separationOccurred = false;
  }

  return Object.freeze({
    ...state,
    currentPhase: nextPhase,
    previousPhase: state.currentPhase,
    isHardwareInhibited,
    separationOccurred,
  });
}

/**
 * Manually executes a CDS Rev 14.1 §2.3.2.4 deployment switch restow / bounce reset.
 * Resets timers to 0.0 and reverts to PRE_LAUNCH while preserving cumulative missionElapsedSeconds.
 */
export function triggerSwitchReset(
  state: LifecycleClockState
): LifecycleClockState {
  return Object.freeze({
    ...state,
    currentPhase: "PRE_LAUNCH",
    previousPhase: state.currentPhase,
    isHardwareInhibited: true,
    separationOccurred: false,
    deployableTimerElapsedMin: minutes(0.0),
    rfQuietTimerElapsedMin: minutes(0.0),
  });
}

/**
 * Transitions the simulation to a terminal status (COMPLETED or TERMINATED_FAILURE).
 */
export function terminateSimulation(
  state: LifecycleClockState,
  outcome: "FAILURE" | "COMPLETED"
): LifecycleClockState {
  const finalStatus: SimulationStatus =
    outcome === "FAILURE" ? "TERMINATED_FAILURE" : "COMPLETED";

  return Object.freeze({
    ...state,
    simulationStatus: finalStatus,
  });
}

/**
 * Pauses a running simulation.
 */
export function pauseSimulation(
  state: LifecycleClockState
): LifecycleClockState {
  if (state.simulationStatus !== "RUNNING") {
    throw new ValidationError(
      "simulationStatus",
      `Cannot pause simulation from status: "${state.simulationStatus}"`
    );
  }
  return Object.freeze({
    ...state,
    simulationStatus: "PAUSED",
  });
}

/**
 * Resumes a paused or idle simulation.
 */
export function resumeSimulation(
  state: LifecycleClockState
): LifecycleClockState {
  if (state.simulationStatus !== "PAUSED" && state.simulationStatus !== "IDLE") {
    throw new ValidationError(
      "simulationStatus",
      `Cannot resume simulation from status: "${state.simulationStatus}"`
    );
  }
  return Object.freeze({
    ...state,
    simulationStatus: "RUNNING",
  });
}

/**
 * Executes a high-level simulation control command.
 */
export function executeSimulationControl(
  state: LifecycleClockState,
  command: SimulationControlCommand,
  context?: StepContext
): LifecycleClockState {
  switch (command.action) {
    case "START":
    case "RESUME":
      return resumeSimulation(state);
    case "PAUSE":
      return pauseSimulation(state);
    case "STEP":
      return stepLifecycleClock(
        state,
        command.stepDurationSeconds ?? seconds(10.0),
        context
      );
    case "FAST_FORWARD":
      return stepLifecycleClock(
        state,
        command.stepDurationSeconds ?? seconds(60.0),
        context
      );
    case "RESET":
      return createInitialLifecycleState({
        epochJulianDate: state.epochJulianDate,
      });
    default:
      throw new ValidationError(
        "action",
        `Unknown simulation control action: "${(command as { action: string }).action}"`
      );
  }
}

// ============================================================================
// 7. Object-Oriented Lifecycle Manager Class Wrapper
// ============================================================================

export class MissionLifecycleManager {
  private _state: LifecycleClockState;

  constructor(options?: InitialLifecycleOptions) {
    this._state = createInitialLifecycleState(options);
  }

  public getState(): LifecycleClockState {
    return this._state;
  }

  public step(stepSeconds: Seconds, context?: StepContext): LifecycleClockState {
    this._state = stepLifecycleClock(this._state, stepSeconds, context);
    return this._state;
  }

  public transitionTo(
    nextPhase: MissionPhase,
    context?: TransitionContext
  ): LifecycleClockState {
    this._state = transitionPhase(this._state, nextPhase, context);
    return this._state;
  }

  public triggerSwitchReset(): LifecycleClockState {
    this._state = triggerSwitchReset(this._state);
    return this._state;
  }

  public pause(): LifecycleClockState {
    this._state = pauseSimulation(this._state);
    return this._state;
  }

  public resume(): LifecycleClockState {
    this._state = resumeSimulation(this._state);
    return this._state;
  }

  public terminate(outcome: "FAILURE" | "COMPLETED"): LifecycleClockState {
    this._state = terminateSimulation(this._state, outcome);
    return this._state;
  }

  public executeControl(
    command: SimulationControlCommand,
    context?: StepContext
  ): LifecycleClockState {
    this._state = executeSimulationControl(this._state, command, context);
    return this._state;
  }

  public isDeployablePermitted(): boolean {
    return isDeployableReleasePermitted(this._state);
  }

  public isRfPermitted(): boolean {
    return isRfTransmissionPermitted(this._state);
  }
}
