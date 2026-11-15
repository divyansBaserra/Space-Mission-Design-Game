/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Mission Event Engine & Seeded Anomaly Timeline (Phase 3 Module 6)
 *
 * Implements the deterministic discrete-event timeline engine and stochastic anomaly generator:
 * - Array-backed binary min-heap priority queue with O(log N) enqueue/dequeue and O(1) peek.
 * - Deterministic ordering by composite priority tuple: (t_MET, priorityWeight, sequenceId).
 * - Strict IEEE-754 numeric timestamp equality in heap comparator (no epsilon threshold to preserve transitivity).
 * - Native unsigned 64-bit sequence ID counter (bigint) bounded by 2^64 - 1 with overflow protection.
 * - Portable 32-bit Mulberry32 pseudo-random number generator for deterministic anomaly seeding.
 * - Parameterized anomaly models for Single-Event Upset (SEU), Solar Flare, and Thruster degradation.
 * - Strict enforcement: Every anomaly event requires an explicit, validated caller priority weight (1-6).
 * - Comprehensive event cancellation, due-event step drainage, and immutable historical execution logging.
 * - Safe JSON serialization for BigInt sequence IDs.
 *
 * Source Classifications:
 * - VERIFIED: Standard binary min-heap algorithms (Cormen et al.), 32-bit Mulberry32 PRNG (Vigna / Lemire),
 *   CODATA / ISO standards.
 * - DERIVED: Composite priority tuple ordering (t_MET, priorityWeight, sequenceId),
 *   FIFO sequence tie-breaking, due-event horizon partitioning.
 * - GAME_ASSUMPTION: Single-Event Upset (60.0 s reboot), Solar flare (5% degradation),
 *   Thruster Isp drop (4% degradation).
 */

import {
  Seconds,
  seconds,
  ValidationError,
  assertFiniteNonNegative,
} from "./simUnits";

// ============================================================================
// 1. Event Priority Hierarchy & Validated Constants (Baseline v3 §8.1)
// ============================================================================

export type EventPriorityClass =
  | "CRITICAL_VIOLATION"
  | "STATE_RESET"
  | "MECHANISM_ACTUATION"
  | "ORBIT_BOUNDARY"
  | "COMM_OPERATION"
  | "TELEMETRY_LOG";

export const EVENT_PRIORITY_WEIGHTS: Readonly<Record<EventPriorityClass, number>> = Object.freeze({
  CRITICAL_VIOLATION: 1,
  STATE_RESET: 2,
  MECHANISM_ACTUATION: 3,
  ORBIT_BOUNDARY: 4,
  COMM_OPERATION: 5,
  TELEMETRY_LOG: 6,
});

export const VALID_PRIORITY_WEIGHTS: readonly number[] = Object.freeze([1, 2, 3, 4, 5, 6]);

/** Maximum unsigned 64-bit integer: 2^64 - 1 */
export const MAX_UINT64: bigint = 18446744073709551615n;

/** Minimum unsigned 64-bit integer */
export const MIN_UINT64: bigint = 0n;

// Standard Anomaly Constants (Baseline v3 §8.2)
export const SEU_REBOOT_DURATION_SECONDS = 60.0;
export const SOLAR_FLARE_DEGRADATION_FRACTION = 0.05;
export const THRUSTER_ISP_DEGRADATION_FRACTION = 0.04;

// ============================================================================
// 2. Event Interfaces & Payload Types
// ============================================================================

export interface SimulationEvent<TPayload = unknown> {
  readonly id: string;
  readonly timestampSeconds: Seconds;
  readonly priorityClass: EventPriorityClass;
  readonly priorityWeight: number; // 1 to 6
  readonly sequenceId: bigint; // Native unsigned 64-bit sequence integer
  readonly eventType: string;
  readonly description: string;
  readonly fatal: boolean;
  readonly payload?: TPayload;
}

export interface EnqueueEventInput<TPayload = unknown> {
  readonly id: string;
  readonly timestampSeconds: Seconds;
  readonly priorityClass?: EventPriorityClass;
  readonly priorityWeight?: number; // 1 to 6
  readonly eventType: string;
  readonly description: string;
  readonly fatal?: boolean;
  readonly payload?: TPayload;
}

export interface SeuAnomalyPayload {
  readonly rebootDurationSeconds: number;
  readonly affectedSubsystem: "CDH";
}

export interface SolarFlareAnomalyPayload {
  readonly efficiencyDegradationFraction: number;
  readonly affectedSubsystem: "EPS";
}

export interface ThrusterDegradationAnomalyPayload {
  readonly ispDegradationFraction: number;
  readonly affectedSubsystem: "PROPULSION";
}

export interface AnomalyInjectionOptions {
  readonly id?: string;
  readonly priorityWeight: number; // Mandatory explicit weight (1 to 6)
  readonly priorityClass?: EventPriorityClass;
  readonly description?: string;
}

// ============================================================================
// 2b. Deep Payload Detachment & Immutability Helpers
// ============================================================================

/**
 * Explicit Supported Payload Types Policy:
 *
 * 1. Supported Payload Types:
 *    - Primitives: number, string, boolean, bigint, symbol, null, undefined.
 *    - Arrays: Standard Array instances containing supported payload types (deep-cloned and Object.freeze'd).
 *    - Plain Objects: Objects with prototype === Object.prototype ({...}) or prototype === null (Object.create(null))
 *      containing supported payload types (deep-cloned and Object.freeze'd).
 *    - Circular References: Safely preserved and tracked via WeakMap during cloning.
 *
 * 2. Intentionally Rejected Types (throw ValidationError):
 *    - Date instances: Rejected due to mutable internal slots ([[DateValue]]) through methods like .setTime().
 *      Simulation callers must use numeric timestamp Seconds instead.
 *    - Map instances: Rejected due to mutable internal slots ([[MapData]]) through methods like .set() and .delete().
 *      Deep-cloning key objects breaks reference identity for .get(k). Use plain objects (Record<string, unknown>).
 *    - Set instances: Rejected due to mutable internal slots ([[SetData]]) through methods like .add() and .delete().
 *      Use readonly Arrays instead.
 *    - Functions: Executable code is non-serializable and prohibited in state/event payloads.
 *    - Custom class instances & non-plain prototypes: Instances of user classes, Error, RegExp, TypedArray, etc.
 *      are explicitly rejected to prevent silent loss of methods/prototype behavior. Use plain objects.
 */
export function deepCloneAndFreezePayload<T>(value: T, seen = new WeakMap<object, unknown>()): T {
  if (value === null || typeof value !== "object") {
    if (typeof value === "function") {
      throw new ValidationError(
        "deepCloneAndFreezePayload.Function",
        "Functions are not supported as event payloads."
      );
    }
    return value;
  }

  // Reject Date due to mutable internal slot [[DateValue]]
  if (value instanceof Date) {
    throw new ValidationError(
      "deepCloneAndFreezePayload.Date",
      "Date instances are rejected as event payloads due to mutable internal slots ([[DateValue]]). Use numeric simulation timestamp Seconds instead."
    );
  }

  // Reject Map due to mutable internal slot [[MapData]] and key reference identity breakage
  if (value instanceof Map) {
    throw new ValidationError(
      "deepCloneAndFreezePayload.Map",
      "Map instances are rejected as event payloads due to mutable internal slots ([[MapData]]). Use plain objects (Record<string, unknown>) instead."
    );
  }

  // Reject Set due to mutable internal slot [[SetData]]
  if (value instanceof Set) {
    throw new ValidationError(
      "deepCloneAndFreezePayload.Set",
      "Set instances are rejected as event payloads due to mutable internal slots ([[SetData]]). Use readonly arrays instead."
    );
  }

  // Handle circular references safely
  if (seen.has(value)) {
    return seen.get(value) as T;
  }

  // Handle standard Arrays
  if (Array.isArray(value)) {
    const clonedArray: unknown[] = new Array(value.length);
    seen.set(value, clonedArray);
    for (let i = 0; i < value.length; i++) {
      clonedArray[i] = deepCloneAndFreezePayload(value[i], seen);
    }
    return Object.freeze(clonedArray) as unknown as T;
  }

  // Validate prototype: only plain objects (Object.prototype or null prototype) are permitted.
  // Custom class instances and non-plain prototypes are rejected explicitly rather than silently converted.
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) {
    const className = proto?.constructor?.name ?? "unknown";
    throw new ValidationError(
      "deepCloneAndFreezePayload.prototype",
      `Custom class instances and unsupported object prototypes ("${className}") are rejected as event payloads. Use plain objects ({...} or Object.create(null)) or supported primitives.`
    );
  }

  // Plain objects
  const clonedObj: Record<string, unknown> = proto === null ? Object.create(null) : {};
  seen.set(value, clonedObj);

  for (const key of Object.keys(value)) {
    clonedObj[key] = deepCloneAndFreezePayload((value as Record<string, unknown>)[key], seen);
  }

  return Object.freeze(clonedObj) as T;
}

// ============================================================================
// 3. Strict Total Order Comparator (Critical Comparator Rule)
// ============================================================================

/**
 * Evaluates the strict total ordering between two events:
 * 1. Strict numeric timestamp comparison (t_A < t_B).
 * 2. Exact tie-breaker 1: priorityWeight (lower weight = higher priority).
 * 3. Exact tie-breaker 2: sequenceId (FIFO: lower sequenceId comes first).
 *
 * NOTE: Strict IEEE-754 numeric equality (===) is used. No approximate epsilon
 * is permitted in the comparator to preserve strict mathematical transitivity.
 */
export function compareSimulationEvents(a: SimulationEvent, b: SimulationEvent): number {
  if (a.timestampSeconds < b.timestampSeconds) return -1;
  if (a.timestampSeconds > b.timestampSeconds) return 1;

  if (a.priorityWeight < b.priorityWeight) return -1;
  if (a.priorityWeight > b.priorityWeight) return 1;

  if (a.sequenceId < b.sequenceId) return -1;
  if (a.sequenceId > b.sequenceId) return 1;

  return 0;
}

// ============================================================================
// 4. Priority Class & Weight Resolution Helpers
// ============================================================================

/**
 * Resolves priorityClass from a valid integer priorityWeight (1 to 6).
 */
export function getPriorityClassFromWeight(weight: number): EventPriorityClass {
  switch (weight) {
    case 1:
      return "CRITICAL_VIOLATION";
    case 2:
      return "STATE_RESET";
    case 3:
      return "MECHANISM_ACTUATION";
    case 4:
      return "ORBIT_BOUNDARY";
    case 5:
      return "COMM_OPERATION";
    case 6:
      return "TELEMETRY_LOG";
    default:
      throw new ValidationError(
        "getPriorityClassFromWeight",
        `Invalid priorityWeight ${weight}. Must be an integer between 1 and 6.`
      );
  }
}

/**
 * Validates and reconciles priorityClass and priorityWeight for any incoming event.
 */
export function validateAndReconcilePriority(
  priorityClass?: EventPriorityClass,
  priorityWeight?: number,
  isAnomaly = false
): { resolvedClass: EventPriorityClass; resolvedWeight: number } {
  // Requirement 11: Anomaly events MUST receive an explicit, validated priority weight
  if (isAnomaly) {
    if (priorityWeight === undefined && priorityClass === undefined) {
      throw new ValidationError(
        "validateAndReconcilePriority.anomaly",
        "Every anomaly event must receive an explicit, validated priority weight (1-6) or approved priority class. Defaults and fallbacks are strictly prohibited."
      );
    }
  }

  if (priorityWeight !== undefined) {
    if (!Number.isInteger(priorityWeight) || priorityWeight < 1 || priorityWeight > 6) {
      throw new ValidationError(
        "validateAndReconcilePriority.priorityWeight",
        `Priority weight ${priorityWeight} is invalid. Must be an integer from 1 to 6.`
      );
    }
    const expectedClass = getPriorityClassFromWeight(priorityWeight);
    if (priorityClass !== undefined && priorityClass !== expectedClass) {
      throw new ValidationError(
        "validateAndReconcilePriority",
        `Priority class "${priorityClass}" does not match provided priority weight ${priorityWeight} (expected "${expectedClass}").`
      );
    }
    return { resolvedClass: expectedClass, resolvedWeight: priorityWeight };
  }

  if (priorityClass !== undefined) {
    const weight = EVENT_PRIORITY_WEIGHTS[priorityClass];
    if (weight === undefined) {
      throw new ValidationError(
        "validateAndReconcilePriority.priorityClass",
        `Unknown priority class: "${priorityClass}". Valid classes are: ${Object.keys(EVENT_PRIORITY_WEIGHTS).join(", ")}.`
      );
    }
    return { resolvedClass: priorityClass, resolvedWeight: weight };
  }

  throw new ValidationError(
    "validateAndReconcilePriority",
    "Event must specify either a valid priorityClass or priorityWeight."
  );
}

// ============================================================================
// 5. Binary Min-Heap Priority Queue (EventPriorityQueue)
// ============================================================================

export class EventPriorityQueue {
  private readonly _heap: SimulationEvent[] = [];
  private readonly _indexMap: Map<string, number> = new Map();
  private _nextSequenceId: bigint = 1n;

  /** Current number of active events in the queue */
  public get size(): number {
    return this._heap.length;
  }

  /** Whether the queue has zero active events */
  public get isEmpty(): boolean {
    return this._heap.length === 0;
  }

  /** Current sequence ID counter value */
  public get nextSequenceId(): bigint {
    return this._nextSequenceId;
  }

  /**
   * Enqueues a validated simulation event into the binary min-heap in O(log N) time.
   */
  public enqueue<TPayload = unknown>(
    input: EnqueueEventInput<TPayload>,
    currentMetSeconds: Seconds = seconds(0.0)
  ): SimulationEvent<TPayload> {
    if (!input || typeof input !== "object") {
      throw new ValidationError("EventPriorityQueue.enqueue", "Event input must be a valid object.");
    }
    if (typeof input.id !== "string" || input.id.trim().length === 0) {
      throw new ValidationError("EventPriorityQueue.enqueue.id", "Event id must be a non-empty string.");
    }
    if (this._indexMap.has(input.id)) {
      throw new ValidationError(
        "EventPriorityQueue.enqueue.id",
        `Duplicate event ID "${input.id}" already exists in the active queue.`
      );
    }

    assertFiniteNonNegative(input.timestampSeconds, "EventPriorityQueue.enqueue.timestampSeconds");
    assertFiniteNonNegative(currentMetSeconds, "EventPriorityQueue.enqueue.currentMetSeconds");

    if (input.timestampSeconds < currentMetSeconds) {
      throw new ValidationError(
        "EventPriorityQueue.enqueue.timestampSeconds",
        `Cannot enqueue past event: event timestamp (${input.timestampSeconds} s) is prior to current simulation MET (${currentMetSeconds} s).`
      );
    }

    // 64-bit sequence counter overflow protection
    if (this._nextSequenceId > MAX_UINT64) {
      throw new ValidationError(
        "EventPriorityQueue.sequenceId",
        `64-bit unsigned sequence ID overflow: exceeded maximum value 2^64 - 1 (${MAX_UINT64.toString()}).`
      );
    }

    const isAnomaly = input.eventType.startsWith("ANOMALY_");
    const { resolvedClass, resolvedWeight } = validateAndReconcilePriority(
      input.priorityClass,
      input.priorityWeight,
      isAnomaly
    );

    // Finding 2: Deeply clone and freeze payload to guarantee complete immutability
    const clonedPayload = deepCloneAndFreezePayload(input.payload);

    const event: SimulationEvent<TPayload> = Object.freeze({
      id: input.id,
      timestampSeconds: input.timestampSeconds,
      priorityClass: resolvedClass,
      priorityWeight: resolvedWeight,
      sequenceId: this._nextSequenceId,
      eventType: input.eventType,
      description: input.description ?? "",
      fatal: Boolean(input.fatal || resolvedClass === "CRITICAL_VIOLATION"),
      payload: clonedPayload,
    });

    this._nextSequenceId++;

    // Insert at end of array and sift up
    const newIndex = this._heap.length;
    this._heap.push(event as SimulationEvent);
    this._indexMap.set(event.id, newIndex);
    this._siftUp(newIndex);

    return event;
  }

  /**
   * Returns the highest-priority event without removing it in O(1) time.
   */
  public peek(): SimulationEvent | undefined {
    return this._heap[0];
  }

  /**
   * Returns the timestamp of the highest-priority event in O(1) time.
   */
  public peekTimestamp(): Seconds | undefined {
    return this._heap[0]?.timestampSeconds;
  }

  /**
   * Removes and returns the highest-priority event in O(log N) time.
   */
  public dequeue(): SimulationEvent | undefined {
    if (this._heap.length === 0) {
      return undefined;
    }

    const root = this._heap[0];
    this._indexMap.delete(root.id);

    const last = this._heap.pop()!;
    if (this._heap.length > 0) {
      this._heap[0] = last;
      this._indexMap.set(last.id, 0);
      this._siftDown(0);
    }

    return root;
  }

  /**
   * Cancels a scheduled event by ID in O(log N) time.
   * Returns true if the event was found and removed; false otherwise.
   */
  public cancel(eventId: string): boolean {
    if (typeof eventId !== "string" || eventId.trim().length === 0) {
      return false;
    }

    const index = this._indexMap.get(eventId);
    if (index === undefined) {
      return false;
    }

    this._indexMap.delete(eventId);
    const last = this._heap.pop()!;

    if (index < this._heap.length) {
      this._heap[index] = last;
      this._indexMap.set(last.id, index);

      // Determine whether sifting up or down is needed
      const parentIndex = Math.floor((index - 1) / 2);
      if (index > 0 && compareSimulationEvents(this._heap[index], this._heap[parentIndex]) < 0) {
        this._siftUp(index);
      } else {
        this._siftDown(index);
      }
    }

    return true;
  }

  /**
   * Drains all events scheduled at or before currentMetSeconds in exact priority order.
   */
  public dequeueDueEvents(currentMetSeconds: Seconds): readonly SimulationEvent[] {
    assertFiniteNonNegative(currentMetSeconds, "EventPriorityQueue.dequeueDueEvents.currentMetSeconds");
    const dueEvents: SimulationEvent[] = [];

    while (this._heap.length > 0 && this._heap[0].timestampSeconds <= currentMetSeconds) {
      dueEvents.push(this.dequeue()!);
    }

    return Object.freeze(dueEvents);
  }

  /**
   * Returns a snapshot of pending events sorted by priority order without mutating the queue.
   */
  public getPendingEvents(): readonly SimulationEvent[] {
    return Object.freeze([...this._heap].sort(compareSimulationEvents));
  }

  /** Resets queue to empty state */
  public clear(): void {
    this._heap.length = 0;
    this._indexMap.clear();
  }

  // --- Internal Heap Mechanics ---

  private _siftUp(index: number): void {
    let curr = index;
    while (curr > 0) {
      const parent = Math.floor((curr - 1) / 2);
      if (compareSimulationEvents(this._heap[curr], this._heap[parent]) < 0) {
        this._swap(curr, parent);
        curr = parent;
      } else {
        break;
      }
    }
  }

  private _siftDown(index: number): void {
    let curr = index;
    const len = this._heap.length;

    while (true) {
      let smallest = curr;
      const left = 2 * curr + 1;
      const right = 2 * curr + 2;

      if (left < len && compareSimulationEvents(this._heap[left], this._heap[smallest]) < 0) {
        smallest = left;
      }
      if (right < len && compareSimulationEvents(this._heap[right], this._heap[smallest]) < 0) {
        smallest = right;
      }

      if (smallest !== curr) {
        this._swap(curr, smallest);
        curr = smallest;
      } else {
        break;
      }
    }
  }

  private _swap(i: number, j: number): void {
    const temp = this._heap[i];
    this._heap[i] = this._heap[j];
    this._heap[j] = temp;
    this._indexMap.set(this._heap[i].id, i);
    this._indexMap.set(this._heap[j].id, j);
  }
}

// ============================================================================
// 6. Portable Mulberry32 PRNG (Baseline v3 §8.2)
// ============================================================================

/**
 * 32-bit portable Mulberry32 pseudo-random number generator.
 * Operates purely on 32-bit unsigned integers via Math.imul and bitwise shifts.
 * Period: 2^32 (~4.29 billion values). Lightweight, deterministic generator
 * with uniform distribution across [0.0, 1.0) for discrete-event mission simulation.
 */
export class Mulberry32PRNG {
  private _state: number;

  constructor(seed: number) {
    if (!Number.isFinite(seed)) {
      throw new ValidationError("Mulberry32PRNG.seed", `Seed must be a finite number. Received: ${seed}`);
    }
    this._state = seed >>> 0;
  }

  /** Current internal 32-bit seed state */
  public getState(): number {
    return this._state;
  }

  /**
   * Advances PRNG state and returns next uniform float in [0.0, 1.0).
   */
  public next(): number {
    this._state = (this._state + 0x6D2B79F5) >>> 0;
    let z = this._state;
    z = Math.imul(z ^ (z >>> 15), z | 1);
    z ^= z + Math.imul(z ^ (z >>> 7), z | 61);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296.0;
  }

  /**
   * Generates a floating-point number in [min, max).
   */
  public nextRange(min: number, max: number): number {
    if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
      throw new ValidationError("Mulberry32PRNG.nextRange", `Invalid range: min=${min}, max=${max}`);
    }
    return min + (max - min) * this.next();
  }

  /**
   * Generates an integer in [min, max] inclusive.
   */
  public nextInt(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      throw new ValidationError("Mulberry32PRNG.nextInt", `Invalid integer range: min=${min}, max=${max}`);
    }
    return Math.floor(min + (max - min + 1) * this.next());
  }
}

// ============================================================================
// 7. Parameterized Anomaly Factory Helpers
// ============================================================================

/**
 * Creates an enqueuable Single-Event Upset (SEU) anomaly event.
 * Reboots flight computer for 60.0 s, temporarily halting science data accumulation.
 * F-M6-01: Explicit caller priority weight (1-6) is strictly required.
 */
export function createSeuAnomalyEvent(
  timestampSeconds: Seconds,
  options: AnomalyInjectionOptions
): EnqueueEventInput<SeuAnomalyPayload> {
  if (!options || typeof options !== "object") {
    throw new ValidationError("createSeuAnomalyEvent.options", "Options object must be provided.");
  }
  const { resolvedClass, resolvedWeight } = validateAndReconcilePriority(
    options.priorityClass,
    options.priorityWeight,
    true
  );

  return {
    id: options.id ?? `ANOMALY_SEU_${timestampSeconds.toFixed(2)}`,
    timestampSeconds,
    priorityClass: resolvedClass,
    priorityWeight: resolvedWeight,
    eventType: "ANOMALY_SEU",
    description: options.description ?? `Single-Event Upset: CDH flight computer reboot (${SEU_REBOOT_DURATION_SECONDS} s pause)`,
    fatal: false,
    payload: {
      rebootDurationSeconds: SEU_REBOOT_DURATION_SECONDS,
      affectedSubsystem: "CDH",
    },
  };
}

/**
 * Creates an enqueuable Solar Flare Particle Degradation anomaly event.
 * Reduces current solar cell efficiency by 5.0% per event.
 * F-M6-01: Explicit caller priority weight (1-6) is strictly required.
 */
export function createSolarFlareAnomalyEvent(
  timestampSeconds: Seconds,
  options: AnomalyInjectionOptions
): EnqueueEventInput<SolarFlareAnomalyPayload> {
  if (!options || typeof options !== "object") {
    throw new ValidationError("createSolarFlareAnomalyEvent.options", "Options object must be provided.");
  }
  const { resolvedClass, resolvedWeight } = validateAndReconcilePriority(
    options.priorityClass,
    options.priorityWeight,
    true
  );

  return {
    id: options.id ?? `ANOMALY_SOLAR_FLARE_${timestampSeconds.toFixed(2)}`,
    timestampSeconds,
    priorityClass: resolvedClass,
    priorityWeight: resolvedWeight,
    eventType: "ANOMALY_SOLAR_FLARE",
    description: options.description ?? `Solar Flare Particle Event: Solar cell efficiency degraded by ${(SOLAR_FLARE_DEGRADATION_FRACTION * 100).toFixed(1)}%`,
    fatal: false,
    payload: {
      efficiencyDegradationFraction: SOLAR_FLARE_DEGRADATION_FRACTION,
      affectedSubsystem: "EPS",
    },
  };
}

/**
 * Creates an enqueuable Thruster Isp Degradation anomaly event.
 * Drops thruster effective Isp by 4.0% during orbital maneuvers.
 * F-M6-01: Explicit caller priority weight (1-6) is strictly required.
 */
export function createThrusterDegradationAnomalyEvent(
  timestampSeconds: Seconds,
  options: AnomalyInjectionOptions
): EnqueueEventInput<ThrusterDegradationAnomalyPayload> {
  if (!options || typeof options !== "object") {
    throw new ValidationError("createThrusterDegradationAnomalyEvent.options", "Options object must be provided.");
  }
  const { resolvedClass, resolvedWeight } = validateAndReconcilePriority(
    options.priorityClass,
    options.priorityWeight,
    true
  );

  return {
    id: options.id ?? `ANOMALY_THRUSTER_DEGRADATION_${timestampSeconds.toFixed(2)}`,
    timestampSeconds,
    priorityClass: resolvedClass,
    priorityWeight: resolvedWeight,
    eventType: "ANOMALY_THRUSTER_DEGRADATION",
    description: options.description ?? `Thruster Performance Degradation: Isp reduced by ${(THRUSTER_ISP_DEGRADATION_FRACTION * 100).toFixed(1)}%`,
    fatal: false,
    payload: {
      ispDegradationFraction: THRUSTER_ISP_DEGRADATION_FRACTION,
      affectedSubsystem: "PROPULSION",
    },
  };
}

// ============================================================================
// 8. Safe BigInt Event Serialization Helpers
// ============================================================================

/**
 * Safely serializes a SimulationEvent to JSON, converting native bigint sequenceId to string.
 */
export function serializeSimulationEvent(event: SimulationEvent): string {
  return JSON.stringify(event, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

/**
 * Safely serializes an array of SimulationEvents to JSON, converting native bigint sequenceId to string.
 */
export function serializeSimulationEvents(events: readonly SimulationEvent[]): string {
  return JSON.stringify(events, (_, value) =>
    typeof value === "bigint" ? value.toString() : value
  );
}

// ============================================================================
// 9. MissionEventEngine Facade Class
// ============================================================================

export interface MissionEventEngineOptions {
  readonly initialMetSeconds?: Seconds;
  readonly seed?: number;
}

export type EventDispatchCallback = (event: SimulationEvent) => void;

/**
 * Stateful coordinator managing the global mission timeline, discrete event dispatching,
 * seeded anomaly generation, and historical execution logging.
 */
export class MissionEventEngine {
  private readonly _queue: EventPriorityQueue;
  private readonly _prng?: Mulberry32PRNG;
  private readonly _executionLog: SimulationEvent[] = [];
  private readonly _subscribers: EventDispatchCallback[] = [];
  private _currentMetSeconds: Seconds;
  private _isTerminated = false;
  private _fatalEvent?: SimulationEvent;

  constructor(options?: MissionEventEngineOptions) {
    this._currentMetSeconds = options?.initialMetSeconds ?? seconds(0.0);
    assertFiniteNonNegative(this._currentMetSeconds, "MissionEventEngine.initialMetSeconds");

    this._queue = new EventPriorityQueue();

    if (options?.seed !== undefined) {
      this._prng = new Mulberry32PRNG(options.seed);
    }
  }

  /** Current simulation master clock time recognized by the engine */
  public get currentMetSeconds(): Seconds {
    return this._currentMetSeconds;
  }

  /** Number of events pending in the queue */
  public get pendingEventCount(): number {
    return this._queue.size;
  }

  /** Whether the simulation timeline is in a fatal terminated state */
  public get isTerminated(): boolean {
    return this._isTerminated;
  }

  /** The fatal event that terminated the simulation, if any */
  public get fatalEvent(): SimulationEvent | undefined {
    return this._fatalEvent;
  }

  /** Seeded PRNG instance, if initialized */
  public get prng(): Mulberry32PRNG | undefined {
    return this._prng;
  }

  /**
   * Enqueues a simulation event onto the global timeline.
   */
  public enqueue<TPayload = unknown>(input: EnqueueEventInput<TPayload>): SimulationEvent<TPayload> {
    if (this._isTerminated) {
      throw new ValidationError(
        "MissionEventEngine.enqueue",
        "Cannot enqueue event: simulation has encountered a fatal terminal violation."
      );
    }
    return this._queue.enqueue(input, this._currentMetSeconds);
  }

  /**
   * Cancels a pending event by ID.
   */
  public cancel(eventId: string): boolean {
    return this._queue.cancel(eventId);
  }

  /**
   * Peeks at the next scheduled event without removing it.
   */
  public peek(): SimulationEvent | undefined {
    return this._queue.peek();
  }

  /**
   * Peeks at the timestamp of the next scheduled event.
   */
  public peekTimestamp(): Seconds | undefined {
    return this._queue.peekTimestamp();
  }

  /**
   * Registers a subscriber callback for dispatched events.
   */
  public subscribe(callback: EventDispatchCallback): () => void {
    if (typeof callback !== "function") {
      throw new ValidationError("MissionEventEngine.subscribe", "Callback must be a function.");
    }
    this._subscribers.push(callback);
    return () => {
      const idx = this._subscribers.indexOf(callback);
      if (idx !== -1) {
        this._subscribers.splice(idx, 1);
      }
    };
  }

  /**
   * Advances the engine timeline to newMetSeconds and dispatches all due events in priority order.
   * If a CRITICAL_VIOLATION or fatal event is encountered, halts subsequent dispatch immediately
   * and preserves all remaining un-dispatched events in the queue (F-M6-05).
   *
   * Fatal Termination Invariant:
   * The terminal state (_isTerminated = true and _fatalEvent) is locked immediately upon dequeueing
   * a fatal event before subscriber callbacks are invoked. Subscriber callbacks cannot enqueue new events
   * after a fatal event has executed.
   *
   * Callback-Exception Policy:
   * All subscriber callbacks in the current dispatch snapshot are executed so that a failure in one
   * listener does not prevent other listeners (e.g. flight safety monitors) from being notified.
   * Any errors thrown by callbacks are captured and rethrown immediately (never swallowed), while
   * maintaining all engine terminal invariants.
   */
  public stepTo(newMetSeconds: Seconds): readonly SimulationEvent[] {
    assertFiniteNonNegative(newMetSeconds, "MissionEventEngine.stepTo.newMetSeconds");

    if (newMetSeconds < this._currentMetSeconds) {
      throw new ValidationError(
        "MissionEventEngine.stepTo",
        `Cannot advance backwards: requested MET (${newMetSeconds} s) < current MET (${this._currentMetSeconds} s).`
      );
    }

    if (this._isTerminated) {
      return Object.freeze([]);
    }

    this._currentMetSeconds = newMetSeconds;
    const dispatchedThisStep: SimulationEvent[] = [];

    // F-M6-05: Incrementally process due events in priority order without pre-dequeuing batch
    while (!this._queue.isEmpty && this._queue.peek()!.timestampSeconds <= this._currentMetSeconds) {
      const event = this._queue.dequeue()!;
      this._executionLog.push(event);
      dispatchedThisStep.push(event);

      // Finding 1: Lock terminal failure state immediately upon dequeueing fatal event
      // before invoking subscriber callbacks, preventing callbacks from enqueuing new events
      // and ensuring the terminal state persists even if a callback throws.
      const isFatal = Boolean(event.fatal || event.priorityClass === "CRITICAL_VIOLATION");
      if (isFatal) {
        this._isTerminated = true;
        this._fatalEvent = event;
      }

      // F-M6-04: Dispatch using shallow snapshot to prevent subscriber mutation skipping
      const subscriberSnapshot = [...this._subscribers];
      const subscriberErrors: unknown[] = [];

      for (const subscriber of subscriberSnapshot) {
        try {
          subscriber(event);
        } catch (err) {
          subscriberErrors.push(err);
        }
      }

      // Consistent callback-exception policy:
      // If any subscriber threw, rethrow the error (or AggregateError if multiple).
      // Terminal state is already sealed and will remain sealed when the error unwinds.
      if (subscriberErrors.length > 0) {
        if (subscriberErrors.length === 1) {
          throw subscriberErrors[0];
        }
        throw new AggregateError(
          subscriberErrors,
          "Multiple subscriber callbacks threw errors during event dispatch."
        );
      }

      // F-M6-05: Halt immediately on fatal event; un-dispatched events remain in queue
      if (isFatal) {
        break;
      }
    }

    return Object.freeze(dispatchedThisStep);
  }

  /** Returns immutable historical log of all successfully dispatched events */
  public getExecutionLog(): readonly SimulationEvent[] {
    return Object.freeze([...this._executionLog]);
  }

  /** Returns pending events in priority order */
  public getPendingEvents(): readonly SimulationEvent[] {
    return this._queue.getPendingEvents();
  }

  /** Resets engine state, clearing queue and logs */
  public reset(newInitialMet: Seconds = seconds(0.0)): void {
    assertFiniteNonNegative(newInitialMet, "MissionEventEngine.reset.newInitialMet");
    this._queue.clear();
    this._executionLog.length = 0;
    this._currentMetSeconds = newInitialMet;
    this._isTerminated = false;
    this._fatalEvent = undefined;
  }
}
