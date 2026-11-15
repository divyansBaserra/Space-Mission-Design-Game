/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Tests for Mission Event Engine & Seeded Anomaly Timeline (Phase 3 Module 6)
 * `tests/engine/simulation/eventEngine.test.ts`
 *
 * Covers:
 * 1. Event Priority Hierarchy & Validated Constants
 * 2. Binary Min-Heap Mechanics & Queue Operations (Enqueue, Peek, Dequeue, Cancel)
 * 3. Deterministic Three-Tier Ordering (t_MET, priorityWeight, sequenceId)
 * 4. Critical Comparator Rule: Strict Numeric Timestamp Comparison (No Epsilon)
 * 5. Native BigInt 64-Bit Sequence IDs & Overflow Protection (2^64 - 1)
 * 6. Safe JSON Event Serialization
 * 7. Portable Mulberry32 PRNG Determinism & Range Generation
 * 8. Parameterized Anomaly Models (SEU 60s, Solar Flare 5%, Thruster Isp 4%)
 * 9. F-M6-01 Implementation Override: Mandatory Validated Caller Priority Weight
 * 10. Due-Event Horizon Drainage & Step Progression
 * 11. Precondition Guards & Validation Error Handling
 * 12. Terminal Mission State Protection (CRITICAL_VIOLATION & Fatal Freeze)
 * 13. High-Volume Heap Performance & Two-Tier Determinism Verification
 */

import { describe, test, expect } from "bun:test";
import {
  Seconds,
  seconds,
  ValidationError,
} from "../../../src/engine/simulation/simUnits";

import {
  EventPriorityClass,
  EVENT_PRIORITY_WEIGHTS,
  MAX_UINT64,
  SimulationEvent,
  EnqueueEventInput,
  EventPriorityQueue,
  Mulberry32PRNG,
  MissionEventEngine,
  compareSimulationEvents,
  validateAndReconcilePriority,
  getPriorityClassFromWeight,
  createSeuAnomalyEvent,
  createSolarFlareAnomalyEvent,
  createThrusterDegradationAnomalyEvent,
  serializeSimulationEvent,
  serializeSimulationEvents,
  deepCloneAndFreezePayload,
  SEU_REBOOT_DURATION_SECONDS,
  SOLAR_FLARE_DEGRADATION_FRACTION,
  THRUSTER_ISP_DEGRADATION_FRACTION,
} from "../../../src/engine/simulation/eventEngine";

describe("Phase 3 Module 6 — Mission Event Engine", () => {
  // ==========================================================================
  // 1. Event Priority Hierarchy & Validated Constants
  // ==========================================================================
  describe("1. Event Priority Hierarchy & Priority Weights", () => {
    test("verifies exact approved Phase 3 priority weights (1 through 6)", () => {
      expect(EVENT_PRIORITY_WEIGHTS.CRITICAL_VIOLATION).toBe(1);
      expect(EVENT_PRIORITY_WEIGHTS.STATE_RESET).toBe(2);
      expect(EVENT_PRIORITY_WEIGHTS.MECHANISM_ACTUATION).toBe(3);
      expect(EVENT_PRIORITY_WEIGHTS.ORBIT_BOUNDARY).toBe(4);
      expect(EVENT_PRIORITY_WEIGHTS.COMM_OPERATION).toBe(5);
      expect(EVENT_PRIORITY_WEIGHTS.TELEMETRY_LOG).toBe(6);
    });

    test("resolves priority class from integer weight bidirectionally", () => {
      expect(getPriorityClassFromWeight(1)).toBe("CRITICAL_VIOLATION");
      expect(getPriorityClassFromWeight(2)).toBe("STATE_RESET");
      expect(getPriorityClassFromWeight(3)).toBe("MECHANISM_ACTUATION");
      expect(getPriorityClassFromWeight(4)).toBe("ORBIT_BOUNDARY");
      expect(getPriorityClassFromWeight(5)).toBe("COMM_OPERATION");
      expect(getPriorityClassFromWeight(6)).toBe("TELEMETRY_LOG");
    });

    test("rejects invalid priority weights with ValidationError", () => {
      expect(() => getPriorityClassFromWeight(0)).toThrow(ValidationError);
      expect(() => getPriorityClassFromWeight(7)).toThrow(ValidationError);
      expect(() => getPriorityClassFromWeight(-1)).toThrow(ValidationError);
      expect(() => getPriorityClassFromWeight(2.5)).toThrow(ValidationError);
      expect(() => getPriorityClassFromWeight(NaN)).toThrow(ValidationError);
    });

    test("validates priority reconciliation when both class and weight are provided", () => {
      // Matching
      const res = validateAndReconcilePriority("STATE_RESET", 2);
      expect(res.resolvedClass).toBe("STATE_RESET");
      expect(res.resolvedWeight).toBe(2);

      // Conflicting -> throw
      expect(() => validateAndReconcilePriority("STATE_RESET", 3)).toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // 2. Binary Min-Heap Mechanics & Queue Operations
  // ==========================================================================
  describe("2. Binary Min-Heap Mechanics & Queue Operations", () => {
    test("enqueues and peeks the minimum event in O(1)", () => {
      const queue = new EventPriorityQueue();
      expect(queue.isEmpty).toBe(true);
      expect(queue.size).toBe(0);
      expect(queue.peek()).toBeUndefined();
      expect(queue.peekTimestamp()).toBeUndefined();

      queue.enqueue({
        id: "evt-200",
        timestampSeconds: seconds(200.0),
        priorityClass: "COMM_OPERATION",
        eventType: "SCIENCE_DOWNLINK",
        description: "Downlink pass",
      });

      expect(queue.isEmpty).toBe(false);
      expect(queue.size).toBe(1);
      expect(queue.peek()?.id).toBe("evt-200");
      expect(queue.peekTimestamp()).toBe(200.0);

      // Add earlier event
      queue.enqueue({
        id: "evt-100",
        timestampSeconds: seconds(100.0),
        priorityClass: "COMM_OPERATION",
        eventType: "BEACON",
        description: "Beacon keyed",
      });

      expect(queue.size).toBe(2);
      expect(queue.peek()?.id).toBe("evt-100");
      expect(queue.peekTimestamp()).toBe(100.0);
    });

    test("dequeues all elements in strictly increasing priority order (sift-up & sift-down)", () => {
      const queue = new EventPriorityQueue();
      const times = [500.0, 100.0, 300.0, 50.0, 400.0, 200.0];

      for (const t of times) {
        queue.enqueue({
          id: `evt-${t}`,
          timestampSeconds: seconds(t),
          priorityClass: "TELEMETRY_LOG",
          eventType: "LOG",
          description: `Log at ${t}`,
        });
      }

      const extracted: number[] = [];
      while (!queue.isEmpty) {
        extracted.push(queue.dequeue()!.timestampSeconds);
      }

      expect(extracted).toEqual([50.0, 100.0, 200.0, 300.0, 400.0, 500.0]);
      expect(queue.isEmpty).toBe(true);
      expect(queue.dequeue()).toBeUndefined();
    });

    test("cancels events accurately from head, middle, and tail of binary heap in O(log N)", () => {
      const queue = new EventPriorityQueue();
      queue.enqueue({ id: "e1", timestampSeconds: seconds(10.0), priorityClass: "COMM_OPERATION", eventType: "E1", description: "" });
      queue.enqueue({ id: "e2", timestampSeconds: seconds(20.0), priorityClass: "COMM_OPERATION", eventType: "E2", description: "" });
      queue.enqueue({ id: "e3", timestampSeconds: seconds(30.0), priorityClass: "COMM_OPERATION", eventType: "E3", description: "" });
      queue.enqueue({ id: "e4", timestampSeconds: seconds(40.0), priorityClass: "COMM_OPERATION", eventType: "E4", description: "" });

      expect(queue.size).toBe(4);

      // Cancel interior event
      expect(queue.cancel("e2")).toBe(true);
      expect(queue.size).toBe(3);

      // Cancel non-existent
      expect(queue.cancel("non-existent")).toBe(false);
      expect(queue.size).toBe(3);

      // Cancel head
      expect(queue.cancel("e1")).toBe(true);
      expect(queue.size).toBe(2);
      expect(queue.peek()?.id).toBe("e3");

      // Cancel remaining
      expect(queue.cancel("e4")).toBe(true);
      expect(queue.cancel("e3")).toBe(true);
      expect(queue.isEmpty).toBe(true);
    });

    test("exercises interior cancellation triggering sift-up and sift-down with index-map tracking (F-M6-08)", () => {
      const q = new EventPriorityQueue();

      // Setup 1: Interior cancellation requiring sift-up
      // Heap structure:
      //         e1 (10s) [idx 0]
      //       /          \
      //   e2 (100s) [1]    e3 (50s) [2]
      //   /       \        /       \
      // e4(200s)[3] e5(200s)[4] e6(200s)[5] e7(60s)[6]
      q.enqueue({ id: "e1", timestampSeconds: seconds(10.0), priorityWeight: 1, eventType: "", description: "" });
      q.enqueue({ id: "e2", timestampSeconds: seconds(100.0), priorityWeight: 1, eventType: "", description: "" });
      q.enqueue({ id: "e3", timestampSeconds: seconds(50.0), priorityWeight: 1, eventType: "", description: "" });
      q.enqueue({ id: "e4", timestampSeconds: seconds(200.0), priorityWeight: 1, eventType: "", description: "" });
      q.enqueue({ id: "e5", timestampSeconds: seconds(200.0), priorityWeight: 1, eventType: "", description: "" });
      q.enqueue({ id: "e6", timestampSeconds: seconds(200.0), priorityWeight: 1, eventType: "", description: "" });
      q.enqueue({ id: "e7", timestampSeconds: seconds(60.0), priorityWeight: 1, eventType: "", description: "" });

      // Cancel e4 (idx 3). Replacement tail is e7 (60s).
      // Since 60s < 100s (parent e2 at idx 1), e7 must sift UP to idx 1, moving e2 to idx 3!
      expect(q.cancel("e4")).toBe(true);
      expect((q as any)._indexMap.get("e7")).toBe(1);
      expect((q as any)._indexMap.get("e2")).toBe(3);

      const dequeuedOrder: string[] = [];
      while (!q.isEmpty) {
        dequeuedOrder.push(q.dequeue()!.id);
      }
      expect(dequeuedOrder).toEqual(["e1", "e3", "e7", "e2", "e5", "e6"]);

      // Setup 2: Interior cancellation requiring sift-down
      const q2 = new EventPriorityQueue();
      q2.enqueue({ id: "a1", timestampSeconds: seconds(10.0), priorityWeight: 1, eventType: "", description: "" });
      q2.enqueue({ id: "a2", timestampSeconds: seconds(20.0), priorityWeight: 1, eventType: "", description: "" });
      q2.enqueue({ id: "a3", timestampSeconds: seconds(30.0), priorityWeight: 1, eventType: "", description: "" });
      q2.enqueue({ id: "a4", timestampSeconds: seconds(40.0), priorityWeight: 1, eventType: "", description: "" });
      q2.enqueue({ id: "a5", timestampSeconds: seconds(50.0), priorityWeight: 1, eventType: "", description: "" });

      // Cancel a2 (idx 1). Tail a5 (50s) replaces a2 at idx 1.
      // Child of idx 1 is a4 (40s at idx 3). Since 50s > 40s, a5 must sift DOWN to idx 3, and a4 moves to idx 1!
      expect(q2.cancel("a2")).toBe(true);
      expect((q2 as any)._indexMap.get("a4")).toBe(1);
      expect((q2 as any)._indexMap.get("a5")).toBe(3);

      const dequeuedOrder2: string[] = [];
      while (!q2.isEmpty) {
        dequeuedOrder2.push(q2.dequeue()!.id);
      }
      expect(dequeuedOrder2).toEqual(["a1", "a3", "a4", "a5"]);
    });

    test("clears queue and resets index map completely via clear()", () => {
      const queue = new EventPriorityQueue();
      queue.enqueue({ id: "c1", timestampSeconds: seconds(10.0), priorityClass: "COMM_OPERATION", eventType: "C1", description: "" });
      queue.enqueue({ id: "c2", timestampSeconds: seconds(20.0), priorityClass: "COMM_OPERATION", eventType: "C2", description: "" });
      expect(queue.size).toBe(2);
      expect(queue.isEmpty).toBe(false);

      queue.clear();
      expect(queue.size).toBe(0);
      expect(queue.isEmpty).toBe(true);
      expect(queue.peek()).toBeUndefined();
      expect(queue.dequeue()).toBeUndefined();
      expect((queue as any)._indexMap.size).toBe(0);

      // Re-enqueue after clear
      queue.enqueue({ id: "c3", timestampSeconds: seconds(30.0), priorityClass: "COMM_OPERATION", eventType: "C3", description: "" });
      expect(queue.size).toBe(1);
      expect(queue.peek()?.id).toBe("c3");
    });
  });

  // ==========================================================================
  // 3. Deterministic Three-Tier Ordering
  // ==========================================================================
  describe("3. Deterministic Three-Tier Ordering (t_MET, priorityWeight, sequenceId)", () => {
    test("orders identical timestamp events by priority weight (1 to 6)", () => {
      const queue = new EventPriorityQueue();
      const t = seconds(1800.0);

      // Enqueue in reverse priority order
      queue.enqueue({ id: "e-log", timestampSeconds: t, priorityClass: "TELEMETRY_LOG", eventType: "LOG", description: "" }); // 6
      queue.enqueue({ id: "e-comm", timestampSeconds: t, priorityClass: "COMM_OPERATION", eventType: "COMM", description: "" }); // 5
      queue.enqueue({ id: "e-orbit", timestampSeconds: t, priorityClass: "ORBIT_BOUNDARY", eventType: "ORBIT", description: "" }); // 4
      queue.enqueue({ id: "e-mech", timestampSeconds: t, priorityClass: "MECHANISM_ACTUATION", eventType: "MECH", description: "" }); // 3
      queue.enqueue({ id: "e-reset", timestampSeconds: t, priorityClass: "STATE_RESET", eventType: "RESET", description: "" }); // 2
      queue.enqueue({ id: "e-crit", timestampSeconds: t, priorityClass: "CRITICAL_VIOLATION", eventType: "CRIT", description: "" }); // 1

      expect(queue.dequeue()!.id).toBe("e-crit");
      expect(queue.dequeue()!.id).toBe("e-reset");
      expect(queue.dequeue()!.id).toBe("e-mech");
      expect(queue.dequeue()!.id).toBe("e-orbit");
      expect(queue.dequeue()!.id).toBe("e-comm");
      expect(queue.dequeue()!.id).toBe("e-log");
    });

    test("orders simultaneous events with identical priority weight by sequenceId (FIFO tie-break)", () => {
      const queue = new EventPriorityQueue();
      const t = seconds(2700.0);

      // Three events with exact same timestamp and priority class
      queue.enqueue({ id: "first", timestampSeconds: t, priorityClass: "COMM_OPERATION", eventType: "BEACON_1", description: "" });
      queue.enqueue({ id: "second", timestampSeconds: t, priorityClass: "COMM_OPERATION", eventType: "BEACON_2", description: "" });
      queue.enqueue({ id: "third", timestampSeconds: t, priorityClass: "COMM_OPERATION", eventType: "BEACON_3", description: "" });

      const e1 = queue.dequeue()!;
      const e2 = queue.dequeue()!;
      const e3 = queue.dequeue()!;

      expect(e1.id).toBe("first");
      expect(e2.id).toBe("second");
      expect(e3.id).toBe("third");

      // Verify strictly increasing sequence IDs
      expect(e1.sequenceId < e2.sequenceId).toBe(true);
      expect(e2.sequenceId < e3.sequenceId).toBe(true);
    });
  });

  // ==========================================================================
  // 4. Critical Comparator Rule: Strict Numeric Equality (No Epsilon)
  // ==========================================================================
  describe("4. Critical Comparator Rule: Strict Numeric Equality (No Epsilon)", () => {
    test("does NOT treat close timestamps as equal (preserves strict numeric ordering without epsilon)", () => {
      const eClose1: SimulationEvent = {
        id: "e1",
        timestampSeconds: seconds(100.0),
        priorityClass: "TELEMETRY_LOG", // Weight 6
        priorityWeight: 6,
        sequenceId: 1n,
        eventType: "LOG",
        description: "",
        fatal: false,
      };

      const eClose2: SimulationEvent = {
        id: "e2",
        timestampSeconds: seconds(100.0000000001), // Differs by 1e-10 s
        priorityClass: "CRITICAL_VIOLATION", // Weight 1
        priorityWeight: 1,
        sequenceId: 2n,
        eventType: "CRIT",
        description: "",
        fatal: true,
      };

      // Because eClose1 has smaller numeric timestamp (100.0 < 100.0000000001),
      // it must compare strictly less than eClose2 despite having lower priority weight!
      // (If a 1e-9 epsilon were erroneously used, eClose2 would jump ahead due to priority).
      expect(compareSimulationEvents(eClose1, eClose2)).toBe(-1);
      expect(compareSimulationEvents(eClose2, eClose1)).toBe(1);
    });

    test("applies priority tie-breaking ONLY when timestamps are bitwise/numerically identical", () => {
      const eIdentical1: SimulationEvent = {
        id: "e1",
        timestampSeconds: seconds(100.0),
        priorityClass: "TELEMETRY_LOG", // Weight 6
        priorityWeight: 6,
        sequenceId: 1n,
        eventType: "LOG",
        description: "",
        fatal: false,
      };

      const eIdentical2: SimulationEvent = {
        id: "e2",
        timestampSeconds: seconds(100.0), // Exactly equal
        priorityClass: "CRITICAL_VIOLATION", // Weight 1
        priorityWeight: 1,
        sequenceId: 2n,
        eventType: "CRIT",
        description: "",
        fatal: true,
      };

      // Exactly equal timestamps -> Weight 1 comes first!
      expect(compareSimulationEvents(eIdentical1, eIdentical2)).toBe(1);
      expect(compareSimulationEvents(eIdentical2, eIdentical1)).toBe(-1);
    });
  });

  // ==========================================================================
  // 5. Native BigInt 64-Bit Sequence IDs & Overflow Protection
  // ==========================================================================
  describe("5. Native BigInt 64-Bit Sequence IDs & Overflow Protection", () => {
    test("assigns native unsigned 64-bit bigint sequence IDs starting from 1n", () => {
      const queue = new EventPriorityQueue();
      const e1 = queue.enqueue({ id: "e1", timestampSeconds: seconds(1.0), priorityClass: "COMM_OPERATION", eventType: "E1", description: "" });
      const e2 = queue.enqueue({ id: "e2", timestampSeconds: seconds(2.0), priorityClass: "COMM_OPERATION", eventType: "E2", description: "" });

      expect(typeof e1.sequenceId).toBe("bigint");
      expect(e1.sequenceId).toBe(1n);
      expect(e2.sequenceId).toBe(2n);
    });

    test("enforces maximum unsigned 64-bit integer (2^64 - 1) boundary and rejects overflow", () => {
      const queue = new EventPriorityQueue();

      // Simulate sequence counter near 2^64 - 1 limit
      (queue as any)._nextSequenceId = MAX_UINT64;

      const lastSafeEvent = queue.enqueue({
        id: "max-safe",
        timestampSeconds: seconds(10.0),
        priorityClass: "COMM_OPERATION",
        eventType: "SAFE",
        description: "",
      });
      expect(lastSafeEvent.sequenceId).toBe(MAX_UINT64);

      // Next attempt exceeds MAX_UINT64 -> throws ValidationError
      expect(() => {
        queue.enqueue({
          id: "overflow",
          timestampSeconds: seconds(11.0),
          priorityClass: "COMM_OPERATION",
          eventType: "OVERFLOW",
          description: "",
        });
      }).toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // 6. Safe JSON Event Serialization
  // ==========================================================================
  describe("6. Safe JSON Event Serialization", () => {
    test("serializes simulation events containing BigInt sequenceId without TypeError", () => {
      const queue = new EventPriorityQueue();
      const evt = queue.enqueue({
        id: "evt-json",
        timestampSeconds: seconds(123.45),
        priorityClass: "STATE_RESET",
        eventType: "SAFE_MODE_TRIGGERED",
        description: "DoD floor breach",
      });

      const serialized = serializeSimulationEvent(evt);
      expect(typeof serialized).toBe("string");
      expect(serialized).toContain('"sequenceId":"1"');

      const parsed = JSON.parse(serialized);
      expect(parsed.id).toBe("evt-json");
      expect(parsed.sequenceId).toBe("1");
      expect(parsed.priorityWeight).toBe(2);
    });

    test("serializes arrays of events safely", () => {
      const queue = new EventPriorityQueue();
      queue.enqueue({ id: "e1", timestampSeconds: seconds(10.0), priorityClass: "COMM_OPERATION", eventType: "E1", description: "" });
      queue.enqueue({ id: "e2", timestampSeconds: seconds(20.0), priorityClass: "COMM_OPERATION", eventType: "E2", description: "" });

      const all = queue.getPendingEvents();
      const json = serializeSimulationEvents(all);
      const parsed = JSON.parse(json);
      expect(parsed.length).toBe(2);
      expect(parsed[0].sequenceId).toBe("1");
      expect(parsed[1].sequenceId).toBe("2");
    });
  });

  // ==========================================================================
  // 7. Portable Mulberry32 PRNG Determinism & Range Generation
  // ==========================================================================
  describe("7. Portable Mulberry32 PRNG Determinism & Range Generation", () => {
    test("produces bit-for-bit identical sequence on the same runtime with identical seed", () => {
      const prng1 = new Mulberry32PRNG(1337);
      const prng2 = new Mulberry32PRNG(1337);

      const seq1 = Array.from({ length: 10 }, () => prng1.next());
      const seq2 = Array.from({ length: 10 }, () => prng2.next());

      expect(seq1).toEqual(seq2);
    });

    test("produces distinct sequences with differing seeds (seed sensitivity)", () => {
      const prngA = new Mulberry32PRNG(42);
      const prngB = new Mulberry32PRNG(43);

      expect(prngA.next()).not.toBe(prngB.next());
    });

    test("generates floats strictly within [0.0, 1.0) and respects custom ranges", () => {
      const prng = new Mulberry32PRNG(98765);
      for (let i = 0; i < 1000; i++) {
        const val = prng.next();
        expect(val >= 0.0).toBe(true);
        expect(val < 1.0).toBe(true);

        const rangeVal = prng.nextRange(10.0, 20.0);
        expect(rangeVal >= 10.0).toBe(true);
        expect(rangeVal < 20.0).toBe(true);

        const intVal = prng.nextInt(1, 6);
        expect(Number.isInteger(intVal)).toBe(true);
        expect(intVal >= 1).toBe(true);
        expect(intVal <= 6).toBe(true);
      }
    });

    test("rejects invalid seed or non-finite bounds with ValidationError", () => {
      expect(() => new Mulberry32PRNG(NaN)).toThrow(ValidationError);
      expect(() => new Mulberry32PRNG(Infinity)).toThrow(ValidationError);

      const prng = new Mulberry32PRNG(1);
      expect(() => prng.nextRange(20.0, 10.0)).toThrow(ValidationError);
      expect(() => prng.nextInt(10, 5)).toThrow(ValidationError);
    });

    test("matches independent known-output reference vectors for Mulberry32 (F-M6-08)", () => {
      // Independent canonical reference vector for seed = 1 (step-by-step 32-bit math verification)
      const prng1 = new Mulberry32PRNG(1);
      const expectedSeed1 = [
        0.6270739406086504,
        0.0027357212034985423,
        0.5274470400065184,
        0.9810509674716741,
        0.9683778982143849,
      ];
      for (let i = 0; i < expectedSeed1.length; i++) {
        expect(prng1.next()).toBeCloseTo(expectedSeed1[i], 10);
      }

      // Independent canonical reference vector for seed = 0
      const prng0 = new Mulberry32PRNG(0);
      const expectedSeed0 = [
        0.26642920868471265,
        0.0003297457005828619,
        0.2232720274478197,
      ];
      for (let i = 0; i < expectedSeed0.length; i++) {
        expect(prng0.next()).toBeCloseTo(expectedSeed0[i], 10);
      }
    });
  });

  // ==========================================================================
  // 8. Parameterized Anomaly Models
  // ==========================================================================
  describe("8. Parameterized Anomaly Models (Baseline v3 §8.2)", () => {
    test("creates Single-Event Upset (SEU) with exact 60.0 s CDH reboot duration", () => {
      const evt = createSeuAnomalyEvent(seconds(1200.0), {
        priorityWeight: 2, // Explicit caller weight
      });

      expect(evt.eventType).toBe("ANOMALY_SEU");
      expect(evt.timestampSeconds).toBe(1200.0);
      expect(evt.priorityWeight).toBe(2);
      expect(evt.payload?.rebootDurationSeconds).toBe(SEU_REBOOT_DURATION_SECONDS);
      expect(evt.payload?.affectedSubsystem).toBe("CDH");
    });

    test("creates Solar Flare anomaly with exact 5.0% solar degradation fraction", () => {
      const evt = createSolarFlareAnomalyEvent(seconds(3600.0), {
        priorityWeight: 3, // Explicit caller weight
      });

      expect(evt.eventType).toBe("ANOMALY_SOLAR_FLARE");
      expect(evt.payload?.efficiencyDegradationFraction).toBe(SOLAR_FLARE_DEGRADATION_FRACTION);
      expect(evt.payload?.affectedSubsystem).toBe("EPS");
    });

    test("creates Thruster Degradation anomaly with exact 4.0% Isp reduction", () => {
      const evt = createThrusterDegradationAnomalyEvent(seconds(5400.0), {
        priorityWeight: 3, // Explicit caller weight
      });

      expect(evt.eventType).toBe("ANOMALY_THRUSTER_DEGRADATION");
      expect(evt.payload?.ispDegradationFraction).toBe(THRUSTER_ISP_DEGRADATION_FRACTION);
      expect(evt.payload?.affectedSubsystem).toBe("PROPULSION");
    });
  });

  // ==========================================================================
  // 9. F-M6-01 Implementation Override: Mandatory Validated Caller Priority Weight
  // ==========================================================================
  describe("9. F-M6-01 Implementation Override: Mandatory Validated Caller Priority Weight", () => {
    test("strictly rejects anomaly creation when priorityWeight is missing or undefined", () => {
      expect(() => {
        createSeuAnomalyEvent(seconds(100.0), {} as any);
      }).toThrow(ValidationError);

      expect(() => {
        createSolarFlareAnomalyEvent(seconds(100.0), { priorityWeight: undefined as any });
      }).toThrow(ValidationError);
    });

    test("strictly rejects invalid or out-of-range priority weights on anomalies", () => {
      expect(() => {
        createSeuAnomalyEvent(seconds(100.0), { priorityWeight: 0 });
      }).toThrow(ValidationError);

      expect(() => {
        createSeuAnomalyEvent(seconds(100.0), { priorityWeight: 7 }); // No 7th class!
      }).toThrow(ValidationError);

      expect(() => {
        createSeuAnomalyEvent(seconds(100.0), { priorityWeight: -1 });
      }).toThrow(ValidationError);
    });

    test("enforces priority validation when enqueuing anomaly directly to queue without priority", () => {
      const queue = new EventPriorityQueue();
      expect(() => {
        queue.enqueue({
          id: "bad-anomaly",
          timestampSeconds: seconds(100.0),
          eventType: "ANOMALY_SEU",
          description: "Missing priority",
          // Neither priorityWeight nor priorityClass provided!
        });
      }).toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // 10. Due-Event Horizon Drainage & Step Progression
  // ==========================================================================
  describe("10. Due-Event Horizon Drainage & Step Progression", () => {
    test("drains due events up to current MET in exact priority order, retaining future events", () => {
      const engine = new MissionEventEngine();
      engine.enqueue({ id: "e1", timestampSeconds: seconds(10.0), priorityClass: "COMM_OPERATION", eventType: "E1", description: "" });
      engine.enqueue({ id: "e2", timestampSeconds: seconds(20.0), priorityClass: "COMM_OPERATION", eventType: "E2", description: "" });
      engine.enqueue({ id: "e3", timestampSeconds: seconds(30.0), priorityClass: "COMM_OPERATION", eventType: "E3", description: "" });
      engine.enqueue({ id: "e4", timestampSeconds: seconds(40.0), priorityClass: "COMM_OPERATION", eventType: "E4", description: "" });

      // Step to 25.0 s -> drains e1 and e2
      const step1 = engine.stepTo(seconds(25.0));
      expect(step1.length).toBe(2);
      expect(step1.map((e) => e.id)).toEqual(["e1", "e2"]);
      expect(engine.pendingEventCount).toBe(2);
      expect(engine.currentMetSeconds).toBe(25.0);

      // Step to 50.0 s -> drains e3 and e4
      const step2 = engine.stepTo(seconds(50.0));
      expect(step2.length).toBe(2);
      expect(step2.map((e) => e.id)).toEqual(["e3", "e4"]);
      expect(engine.pendingEventCount).toBe(0);

      // Execution log contains all 4 events in order
      expect(engine.getExecutionLog().map((e) => e.id)).toEqual(["e1", "e2", "e3", "e4"]);
    });

    test("notifies registered subscribers as events are dispatched", () => {
      const engine = new MissionEventEngine();
      const received: string[] = [];
      const unsubscribe = engine.subscribe((evt) => received.push(evt.id));

      engine.enqueue({ id: "ev1", timestampSeconds: seconds(5.0), priorityClass: "COMM_OPERATION", eventType: "EV1", description: "" });
      engine.enqueue({ id: "ev2", timestampSeconds: seconds(10.0), priorityClass: "COMM_OPERATION", eventType: "EV2", description: "" });

      engine.stepTo(seconds(10.0));
      expect(received).toEqual(["ev1", "ev2"]);

      unsubscribe();
      engine.enqueue({ id: "ev3", timestampSeconds: seconds(15.0), priorityClass: "COMM_OPERATION", eventType: "EV3", description: "" });
      engine.stepTo(seconds(20.0));
      expect(received).toEqual(["ev1", "ev2"]); // No ev3 after unsubscribe
    });

    test("dispatch snapshot prevents subscriber unsubscription from skipping sibling listeners (F-M6-04)", () => {
      const engine = new MissionEventEngine();
      const executionOrder: string[] = [];

      let unsubscribe1: () => void;
      let unsubscribe2: () => void;

      // Subscriber 1 unregisters itself on first invocation
      unsubscribe1 = engine.subscribe((evt) => {
        executionOrder.push(`sub1:${evt.id}`);
        unsubscribe1();
      });

      // Subscriber 2 should still receive the event during the SAME dispatch pass
      unsubscribe2 = engine.subscribe((evt) => {
        executionOrder.push(`sub2:${evt.id}`);
      });

      engine.enqueue({ id: "evt-1", timestampSeconds: seconds(5.0), priorityClass: "COMM_OPERATION", eventType: "E1", description: "" });
      engine.enqueue({ id: "evt-2", timestampSeconds: seconds(10.0), priorityClass: "COMM_OPERATION", eventType: "E2", description: "" });

      // First step dispatches evt-1: sub1 fires and unsubscribes; sub2 MUST still fire!
      engine.stepTo(seconds(5.0));
      expect(executionOrder).toEqual(["sub1:evt-1", "sub2:evt-1"]);

      // Second step dispatches evt-2: sub1 is now unsubscribed; sub2 fires
      engine.stepTo(seconds(10.0));
      expect(executionOrder).toEqual(["sub1:evt-1", "sub2:evt-1", "sub2:evt-2"]);

      unsubscribe2();
    });

    test("resets simulation engine state, queue, and logs via reset() (F-M6-08)", () => {
      const engine = new MissionEventEngine({ initialMetSeconds: seconds(100.0) });
      engine.enqueue({ id: "r1", timestampSeconds: seconds(100.0), priorityClass: "COMM_OPERATION", eventType: "R1", description: "" });
      engine.stepTo(seconds(100.0));
      expect(engine.getExecutionLog().length).toBe(1);

      // Reset to new MET
      engine.reset(seconds(200.0));
      expect(engine.currentMetSeconds).toBe(200.0);
      expect(engine.getExecutionLog().length).toBe(0);
      expect(engine.pendingEventCount).toBe(0);
      expect(engine.isTerminated).toBe(false);
      expect(engine.fatalEvent).toBeUndefined();

      // Enqueue at new MET
      engine.enqueue({ id: "r2", timestampSeconds: seconds(250.0), priorityClass: "COMM_OPERATION", eventType: "R2", description: "" });
      const dispatched = engine.stepTo(seconds(300.0));
      expect(dispatched.length).toBe(1);
      expect(dispatched[0].id).toBe("r2");
    });
  });

  // ==========================================================================
  // 11. Precondition Guards & Validation Error Handling
  // ==========================================================================
  describe("11. Precondition Guards & Validation Error Handling", () => {
    test("rejects past event submission relative to current MET", () => {
      const engine = new MissionEventEngine({ initialMetSeconds: seconds(100.0) });

      expect(() => {
        engine.enqueue({
          id: "past-event",
          timestampSeconds: seconds(99.0), // Prior to 100.0 s
          priorityClass: "COMM_OPERATION",
          eventType: "PAST",
          description: "",
        });
      }).toThrow(ValidationError);
    });

    test("rejects negative, non-finite, and NaN timestamps", () => {
      const engine = new MissionEventEngine();

      expect(() => {
        engine.enqueue({
          id: "neg",
          timestampSeconds: seconds(-10.0),
          priorityClass: "COMM_OPERATION",
          eventType: "NEG",
          description: "",
        });
      }).toThrow(ValidationError);

      expect(() => {
        engine.enqueue({
          id: "nan",
          timestampSeconds: seconds(NaN),
          priorityClass: "COMM_OPERATION",
          eventType: "NAN",
          description: "",
        });
      }).toThrow(ValidationError);
    });

    test("rejects duplicate event IDs in active queue", () => {
      const engine = new MissionEventEngine();
      engine.enqueue({ id: "unique-1", timestampSeconds: seconds(10.0), priorityClass: "COMM_OPERATION", eventType: "E1", description: "" });

      expect(() => {
        engine.enqueue({ id: "unique-1", timestampSeconds: seconds(20.0), priorityClass: "COMM_OPERATION", eventType: "E2", description: "" });
      }).toThrow(ValidationError);
    });

    test("rejects backwards time progression in stepTo", () => {
      const engine = new MissionEventEngine({ initialMetSeconds: seconds(100.0) });

      expect(() => {
        engine.stepTo(seconds(50.0));
      }).toThrow(ValidationError);
    });
  });

  // ==========================================================================
  // 12. Terminal Mission State Protection
  // ==========================================================================
  describe("12. Terminal Mission State Protection (CRITICAL_VIOLATION & Fatal Freeze)", () => {
    test("halts dispatch and locks engine upon encountering a CRITICAL_VIOLATION", () => {
      const engine = new MissionEventEngine();

      // Enqueue nominal event at 10 s
      engine.enqueue({ id: "nominal-1", timestampSeconds: seconds(10.0), priorityClass: "COMM_OPERATION", eventType: "COMM", description: "" });

      // Enqueue fatal blackout termination at 10 s (Weight 1)
      engine.enqueue({
        id: "fatal-blackout",
        timestampSeconds: seconds(10.0),
        priorityClass: "CRITICAL_VIOLATION",
        eventType: "BLACKOUT_TERMINATION",
        description: "Battery exhausted",
        fatal: true,
      });

      // Enqueue regular log at 10 s (Weight 6)
      engine.enqueue({ id: "log-1", timestampSeconds: seconds(10.0), priorityClass: "TELEMETRY_LOG", eventType: "LOG", description: "" });

      // Enqueue future event at 20 s
      engine.enqueue({ id: "future-1", timestampSeconds: seconds(20.0), priorityClass: "COMM_OPERATION", eventType: "FUTURE", description: "" });

      // Step to 10 s
      const dispatched = engine.stepTo(seconds(10.0));

      // At t = 10 s, fatal-blackout (Weight 1) executes FIRST!
      // Once fatal executes, engine immediately halts and freezes!
      expect(dispatched.length).toBe(1);
      expect(dispatched[0].id).toBe("fatal-blackout");
      expect(engine.isTerminated).toBe(true);
      expect(engine.fatalEvent?.id).toBe("fatal-blackout");

      // F-M6-05: Preserves un-dispatched events in queue (both same-timestamp and future)
      expect(engine.pendingEventCount).toBe(3);
      expect(engine.getPendingEvents().map((e) => e.id)).toEqual([
        "nominal-1",
        "log-1",
        "future-1",
      ]);

      // Attempting to enqueue further events throws ValidationError
      expect(() => {
        engine.enqueue({ id: "after-death", timestampSeconds: seconds(15.0), priorityClass: "COMM_OPERATION", eventType: "DEAD", description: "" });
      }).toThrow(ValidationError);

      // Attempting further steps returns zero events
      const afterStep = engine.stepTo(seconds(30.0));
      expect(afterStep.length).toBe(0);
      expect(engine.pendingEventCount).toBe(3);
    });

    test("preserves all not-yet-dispatched events in pending queue upon fatal termination without silent drop or ID re-allocation (F-M6-05)", () => {
      const engine = new MissionEventEngine();

      // Enqueue 3 events at exact same timestamp t = 100.0s with different priority weights
      const eCrit = engine.enqueue({
        id: "evt-fatal-crit",
        timestampSeconds: seconds(100.0),
        priorityClass: "CRITICAL_VIOLATION", // Weight 1 (fatal)
        eventType: "TERMINATION",
        description: "Spacecraft lost",
        fatal: true,
      });

      const eMed = engine.enqueue({
        id: "evt-sim-med",
        timestampSeconds: seconds(100.0),
        priorityClass: "MECHANISM_ACTUATION", // Weight 3
        eventType: "DEPLOY",
        description: "Antenna deploy",
      });

      const eLow = engine.enqueue({
        id: "evt-sim-low",
        timestampSeconds: seconds(100.0),
        priorityClass: "TELEMETRY_LOG", // Weight 6
        eventType: "LOG",
        description: "Log line",
      });

      // Enqueue 2 events at future timestamp t = 200.0s
      const eFut1 = engine.enqueue({
        id: "evt-future-1",
        timestampSeconds: seconds(200.0),
        priorityClass: "STATE_RESET", // Weight 2
        eventType: "RESET",
        description: "Planned reset",
      });

      const eFut2 = engine.enqueue({
        id: "evt-future-2",
        timestampSeconds: seconds(200.0),
        priorityClass: "ORBIT_BOUNDARY", // Weight 4
        eventType: "AOS",
        description: "AOS pass",
      });

      // Initial pending count
      expect(engine.pendingEventCount).toBe(5);

      // Record original sequence IDs
      const origSeqMed = eMed.sequenceId;
      const origSeqLow = eLow.sequenceId;
      const origSeqFut1 = eFut1.sequenceId;
      const origSeqFut2 = eFut2.sequenceId;

      // Step to 100.0s: fatal event executes and halts immediately
      const dispatched = engine.stepTo(seconds(100.0));
      expect(dispatched.length).toBe(1);
      expect(dispatched[0].id).toBe("evt-fatal-crit");
      expect(engine.isTerminated).toBe(true);

      // Exactly 4 events must remain in the pending queue
      expect(engine.pendingEventCount).toBe(4);
      const pending = engine.getPendingEvents();
      expect(pending.map((e) => e.id)).toEqual([
        "evt-sim-med",
        "evt-sim-low",
        "evt-future-1",
        "evt-future-2",
      ]);

      // Verify sequence IDs are strictly preserved (no re-allocation or modification)
      expect(pending[0].sequenceId).toBe(origSeqMed);
      expect(pending[1].sequenceId).toBe(origSeqLow);
      expect(pending[2].sequenceId).toBe(origSeqFut1);
      expect(pending[3].sequenceId).toBe(origSeqFut2);

      // Verify that further steps do NOT dispatch or disturb the preserved queue
      const afterStep = engine.stepTo(seconds(500.0));
      expect(afterStep.length).toBe(0);
      expect(engine.pendingEventCount).toBe(4);
      expect(engine.getPendingEvents().map((e) => e.id)).toEqual([
        "evt-sim-med",
        "evt-sim-low",
        "evt-future-1",
        "evt-future-2",
      ]);
    });

    test("ensures engine enters terminal state and preserves invariants when a subscriber throws on fatal event (Finding 1)", () => {
      const engine = new MissionEventEngine();
      let subscriber2Received = false;

      // Subscriber 1 throws when fatal event is encountered
      engine.subscribe((evt) => {
        if (evt.fatal) {
          throw new Error("Telemetry failure during fatal crash");
        }
      });

      // Subscriber 2 should still receive the fatal notification (consistent callback policy)
      engine.subscribe((evt) => {
        if (evt.fatal) {
          subscriber2Received = true;
        }
      });

      engine.enqueue({
        id: "fatal-crash",
        timestampSeconds: seconds(10.0),
        priorityClass: "CRITICAL_VIOLATION",
        eventType: "SPACECRAFT_LOSS",
        description: "Catastrophic loss of spacecraft",
        fatal: true,
      });

      engine.enqueue({
        id: "future-evt",
        timestampSeconds: seconds(20.0),
        priorityClass: "COMM_OPERATION",
        eventType: "COMM",
        description: "",
      });

      // 1. A subscriber throwing while a fatal event is dispatched:
      expect(() => {
        engine.stepTo(seconds(10.0));
      }).toThrow("Telemetry failure during fatal crash");

      // Verify sibling subscriber was NOT starved of fatal event
      expect(subscriber2Received).toBe(true);

      // 2. The engine remaining terminated:
      expect(engine.isTerminated).toBe(true);
      expect(engine.fatalEvent?.id).toBe("fatal-crash");
      expect(engine.getExecutionLog().map((e) => e.id)).toEqual(["fatal-crash"]);

      // 3. No subsequent event dispatch:
      const afterStep = engine.stepTo(seconds(30.0));
      expect(afterStep.length).toBe(0);

      // 4. No event enqueue after fatal execution:
      expect(() => {
        engine.enqueue({
          id: "post-death",
          timestampSeconds: seconds(15.0),
          priorityClass: "COMM_OPERATION",
          eventType: "ATTEMPT",
          description: "",
        });
      }).toThrow(ValidationError);

      // 5. Preserved pending queue: future event is untouched
      expect(engine.pendingEventCount).toBe(1);
      expect(engine.getPendingEvents()[0].id).toBe("future-evt");
    });

    test("prevents subscriber callbacks from enqueuing new events after a fatal event has executed (Finding 1)", () => {
      const engine = new MissionEventEngine();
      let enqueueThrewValidationError = false;

      engine.subscribe((evt) => {
        if (evt.fatal) {
          try {
            // Attempt to enqueue after fatal execution inside callback
            engine.enqueue({
              id: "illegal-enq-in-callback",
              timestampSeconds: seconds(10.0),
              priorityClass: "COMM_OPERATION",
              eventType: "ILLEGAL",
              description: "",
            });
          } catch (err) {
            if (err instanceof ValidationError) {
              enqueueThrewValidationError = true;
            }
          }
        }
      });

      engine.enqueue({
        id: "fatal-boom",
        timestampSeconds: seconds(10.0),
        priorityClass: "CRITICAL_VIOLATION",
        eventType: "EXPLOSION",
        description: "Fuel tank burst",
        fatal: true,
      });

      engine.stepTo(seconds(10.0));
      expect(engine.isTerminated).toBe(true);
      expect(enqueueThrewValidationError).toBe(true);
      expect(engine.pendingEventCount).toBe(0);
    });

    test("aggregates multiple subscriber errors without silently swallowing any (Finding 1)", () => {
      const engine = new MissionEventEngine();
      engine.subscribe(() => {
        throw new Error("Subscriber 1 error");
      });
      engine.subscribe(() => {
        throw new Error("Subscriber 2 error");
      });

      engine.enqueue({
        id: "fatal-agg",
        timestampSeconds: seconds(10.0),
        priorityClass: "CRITICAL_VIOLATION",
        eventType: "FATAL",
        description: "",
        fatal: true,
      });

      expect(() => engine.stepTo(seconds(10.0))).toThrow(AggregateError);
      expect(engine.isTerminated).toBe(true);
      expect(engine.fatalEvent?.id).toBe("fatal-agg");
    });
  });

  // ==========================================================================
  // 13. High-Volume Heap Performance & Two-Tier Determinism Verification
  // ==========================================================================
  describe("13. High-Volume Heap Performance & Two-Tier Determinism Verification", () => {
    test("handles 5,000 events with O(log N) efficiency and strictly sorted output", () => {
      const queue = new EventPriorityQueue();
      const prng = new Mulberry32PRNG(4242);
      const count = 5000;

      for (let i = 0; i < count; i++) {
        const t = seconds(prng.nextRange(0.0, 10000.0));
        const w = prng.nextInt(1, 6);
        queue.enqueue({
          id: `bulk-${i}`,
          timestampSeconds: t,
          priorityWeight: w,
          eventType: "BULK_TEST",
          description: "",
        });
      }

      expect(queue.size).toBe(count);

      let prev: SimulationEvent | undefined;
      let dequeuedCount = 0;

      while (!queue.isEmpty) {
        const curr = queue.dequeue()!;
        if (prev) {
          expect(compareSimulationEvents(prev, curr) <= 0).toBe(true);
        }
        prev = curr;
        dequeuedCount++;
      }

      expect(dequeuedCount).toBe(count);
    });

    test("verifies same-runtime bit-for-bit determinism across two identical simulation runs", () => {
      function runSimulationTimeline(seed: number): readonly SimulationEvent[] {
        const engine = new MissionEventEngine({ seed });
        const prng = engine.prng!;

        for (let i = 0; i < 50; i++) {
          const t = seconds(Math.floor(prng.nextRange(1.0, 500.0)));
          const w = prng.nextInt(2, 6); // Non-fatal operational weights (2 to 6)
          engine.enqueue({
            id: `evt-${i}`,
            timestampSeconds: t,
            priorityWeight: w,
            eventType: `TYPE_${w}`,
            description: `Run with seed ${seed}`,
          });
        }

        return engine.stepTo(seconds(600.0));
      }

      const run1 = runSimulationTimeline(9999);
      const run2 = runSimulationTimeline(9999);

      expect(run1.length).toBe(50);
      expect(run2.length).toBe(50);

      // Verify identical event IDs, timestamps, weights, and sequence IDs
      for (let i = 0; i < run1.length; i++) {
        expect(run1[i].id).toBe(run2[i].id);
        expect(run1[i].timestampSeconds).toBe(run2[i].timestampSeconds);
        expect(run1[i].priorityWeight).toBe(run2[i].priorityWeight);
        expect(run1[i].sequenceId).toBe(run2[i].sequenceId);
      }
    });
  });

  // ==========================================================================
  // 14. Payload Immutability & Deep Detachment (Finding 2)
  // ==========================================================================
  describe("14. Payload Immutability & Deep Detachment (Finding 2)", () => {
    test("prevents mutation of queued payload through mutation of original object supplied during enqueue", () => {
      const queue = new EventPriorityQueue();
      const rawPayload = {
        threshold: 42.0,
        settings: {
          gain: 1.5,
          activeModes: ["SAFE", "NOMINAL"],
        },
      };

      const event = queue.enqueue({
        id: "evt-payload-orig",
        timestampSeconds: seconds(100.0),
        priorityClass: "COMM_OPERATION",
        eventType: "PAYLOAD_TEST",
        description: "",
        payload: rawPayload,
      });

      // Mutate the original object after enqueuing
      rawPayload.threshold = 999.0;
      rawPayload.settings.gain = 10.0;
      rawPayload.settings.activeModes.push("HACKED");

      // Verify the queued event's payload is completely untouched
      const peeked = queue.peek()!;
      expect(peeked.payload).toBeDefined();
      expect((peeked.payload as any).threshold).toBe(42.0);
      expect((peeked.payload as any).settings.gain).toBe(1.5);
      expect((peeked.payload as any).settings.activeModes).toEqual(["SAFE", "NOMINAL"]);
      expect((event.payload as any).threshold).toBe(42.0);
    });

    test("prevents mutation through returned event reference (throws TypeError in strict mode)", () => {
      const queue = new EventPriorityQueue();
      queue.enqueue({
        id: "evt-frozen-ref",
        timestampSeconds: seconds(50.0),
        priorityClass: "STATE_RESET",
        eventType: "FROZEN_TEST",
        description: "",
        payload: {
          telemetry: {
            voltage: 28.0,
            flags: [true, false],
          },
        },
      });

      const peeked = queue.peek()!;
      const payload = peeked.payload as any;

      // Attempting to modify properties on payload throws TypeError
      expect(() => {
        payload.telemetry.voltage = 0.0;
      }).toThrow(TypeError);

      expect(() => {
        payload.telemetry.flags.push(true);
      }).toThrow(TypeError);

      expect(() => {
        payload.telemetry.newField = "illegal";
      }).toThrow(TypeError);
    });

    test("guarantees execution log payload immutability across simulation dispatch", () => {
      const engine = new MissionEventEngine();
      const raw = {
        stepData: {
          val: 100,
          subArray: [1, 2, 3],
        },
      };

      engine.enqueue({
        id: "evt-log-immut",
        timestampSeconds: seconds(10.0),
        priorityClass: "COMM_OPERATION",
        eventType: "LOG_IMMUT",
        description: "",
        payload: raw,
      });

      // Dispatch event
      engine.stepTo(seconds(10.0));

      // Attempt to mutate original after dispatch
      raw.stepData.val = 999;
      raw.stepData.subArray.push(4);

      const log = engine.getExecutionLog();
      expect(log.length).toBe(1);
      const loggedPayload = log[0].payload as any;
      expect(loggedPayload.stepData.val).toBe(100);
      expect(loggedPayload.stepData.subArray).toEqual([1, 2, 3]);

      // Attempting to mutate log payload throws
      expect(() => {
        loggedPayload.stepData.val = 0;
      }).toThrow(TypeError);
    });

    test("preserves supported arbitrary payload structures including BigInt, nested arrays, and circular references safely", () => {
      const queue = new EventPriorityQueue();

      interface CircularPayload {
        bigintVal: bigint;
        nested: {
          items: number[];
          active: boolean;
        };
        self?: CircularPayload;
      }

      const circularObj: CircularPayload = {
        bigintVal: 18446744073709551615n, // 2^64 - 1
        nested: {
          items: [10, 20, 30],
          active: true,
        },
      };
      circularObj.self = circularObj;

      const event = queue.enqueue({
        id: "evt-supported-complex",
        timestampSeconds: seconds(20.0),
        priorityClass: "TELEMETRY_LOG",
        eventType: "COMPLEX",
        description: "",
        payload: circularObj,
      });

      // Verify native BigInt preservation (not converted or truncated)
      expect(typeof event.payload?.bigintVal).toBe("bigint");
      expect(event.payload?.bigintVal).toBe(18446744073709551615n);

      // Verify nested structure and array preservation
      expect(event.payload?.nested.items).toEqual([10, 20, 30]);
      expect(event.payload?.nested.active).toBe(true);

      // Verify circular reference resolution and immutability
      expect(event.payload?.self).toBe(event.payload);
      expect(Object.isFrozen(event.payload)).toBe(true);
      expect(Object.isFrozen(event.payload?.nested)).toBe(true);
      expect(Object.isFrozen(event.payload?.nested.items)).toBe(true);
    });

    test("strictly rejects Date instances with ValidationError due to mutable internal slots (Finding 2)", () => {
      const queue = new EventPriorityQueue();

      // Top-level Date
      expect(() => {
        queue.enqueue({
          id: "evt-date-top",
          timestampSeconds: seconds(10.0),
          priorityClass: "COMM_OPERATION",
          eventType: "DATE_TEST",
          description: "",
          payload: new Date(),
        });
      }).toThrow(ValidationError);

      // Nested Date
      expect(() => {
        queue.enqueue({
          id: "evt-date-nested",
          timestampSeconds: seconds(10.0),
          priorityClass: "COMM_OPERATION",
          eventType: "DATE_TEST",
          description: "",
          payload: { telemetry: { timestamp: new Date() } },
        });
      }).toThrow(ValidationError);
    });

    test("strictly rejects Map instances with ValidationError due to mutable internal slots and identity breakage (Finding 2)", () => {
      const queue = new EventPriorityQueue();

      // Top-level Map
      expect(() => {
        queue.enqueue({
          id: "evt-map-top",
          timestampSeconds: seconds(10.0),
          priorityClass: "COMM_OPERATION",
          eventType: "MAP_TEST",
          description: "",
          payload: new Map([["key", "value"]]),
        });
      }).toThrow(ValidationError);

      // Nested Map
      expect(() => {
        queue.enqueue({
          id: "evt-map-nested",
          timestampSeconds: seconds(10.0),
          priorityClass: "COMM_OPERATION",
          eventType: "MAP_TEST",
          description: "",
          payload: { config: { lookup: new Map() } },
        });
      }).toThrow(ValidationError);
    });

    test("strictly rejects Set instances with ValidationError due to mutable internal slots (Finding 2)", () => {
      const queue = new EventPriorityQueue();

      // Top-level Set
      expect(() => {
        queue.enqueue({
          id: "evt-set-top",
          timestampSeconds: seconds(10.0),
          priorityClass: "COMM_OPERATION",
          eventType: "SET_TEST",
          description: "",
          payload: new Set([1, 2, 3]),
        });
      }).toThrow(ValidationError);

      // Nested Set
      expect(() => {
        queue.enqueue({
          id: "evt-set-nested",
          timestampSeconds: seconds(10.0),
          priorityClass: "COMM_OPERATION",
          eventType: "SET_TEST",
          description: "",
          payload: { metadata: { tags: new Set(["a", "b"]) } },
        });
      }).toThrow(ValidationError);
    });

    test("strictly rejects custom class instances and unsupported prototypes with ValidationError (no silent plain-object conversion) (Finding 2)", () => {
      const queue = new EventPriorityQueue();

      class CustomSensorReading {
        constructor(public channel: number, public readingMv: number) {}
        public computeVolts(): number {
          return this.readingMv / 1000.0;
        }
      }

      // Top-level custom class instance
      expect(() => {
        queue.enqueue({
          id: "evt-class-top",
          timestampSeconds: seconds(10.0),
          priorityClass: "COMM_OPERATION",
          eventType: "CLASS_TEST",
          description: "",
          payload: new CustomSensorReading(1, 2500),
        });
      }).toThrow(ValidationError);

      // Nested custom class instance
      expect(() => {
        queue.enqueue({
          id: "evt-class-nested",
          timestampSeconds: seconds(10.0),
          priorityClass: "COMM_OPERATION",
          eventType: "CLASS_TEST",
          description: "",
          payload: { packet: { sensor: new CustomSensorReading(2, 3300) } },
        });
      }).toThrow(ValidationError);

      // Other non-plain prototypes
      expect(() => {
        queue.enqueue({
          id: "evt-regex",
          timestampSeconds: seconds(10.0),
          priorityClass: "COMM_OPERATION",
          eventType: "REGEX_TEST",
          description: "",
          payload: /test-pattern/i,
        });
      }).toThrow(ValidationError);

      expect(() => {
        queue.enqueue({
          id: "evt-fn",
          timestampSeconds: seconds(10.0),
          priorityClass: "COMM_OPERATION",
          eventType: "FN_TEST",
          description: "",
          payload: (() => {}) as any,
        });
      }).toThrow(ValidationError);
    });

    test("preserves anomaly factory payloads with strict deep immutability", () => {
      const seu = createSeuAnomalyEvent(seconds(100.0), { priorityWeight: 2 });
      const flare = createSolarFlareAnomalyEvent(seconds(200.0), { priorityWeight: 3 });
      const thruster = createThrusterDegradationAnomalyEvent(seconds(300.0), { priorityWeight: 3 });

      const queue = new EventPriorityQueue();
      const eSeu = queue.enqueue(seu);
      const eFlare = queue.enqueue(flare);
      const eThruster = queue.enqueue(thruster);

      // SEU payload
      expect(eSeu.payload?.rebootDurationSeconds).toBe(SEU_REBOOT_DURATION_SECONDS);
      expect(eSeu.payload?.affectedSubsystem).toBe("CDH");
      expect(() => {
        (eSeu.payload as any).rebootDurationSeconds = 0;
      }).toThrow(TypeError);

      // Solar flare payload
      expect(eFlare.payload?.efficiencyDegradationFraction).toBe(SOLAR_FLARE_DEGRADATION_FRACTION);
      expect(eFlare.payload?.affectedSubsystem).toBe("EPS");
      expect(() => {
        (eFlare.payload as any).efficiencyDegradationFraction = 0;
      }).toThrow(TypeError);

      // Thruster payload
      expect(eThruster.payload?.ispDegradationFraction).toBe(THRUSTER_ISP_DEGRADATION_FRACTION);
      expect(eThruster.payload?.affectedSubsystem).toBe("PROPULSION");
      expect(() => {
        (eThruster.payload as any).ispDegradationFraction = 0;
      }).toThrow(TypeError);
    });
  });
});
