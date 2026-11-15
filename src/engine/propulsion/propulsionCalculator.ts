/**
 * NASA Space Mission Design Game — Spacecraft Engineering Engine
 * Propulsion & Ideal Impulsive Delta-V Framework
 *
 * Implements the classical Tsiolkovsky rocket equation for ideal impulsive
 * velocity increments (Delta-V), burn duration, mass ratio, and thrust-to-mass acceleration.
 *
 * Equations & Physical Modeling (Phase 2A Specification §6 & §8.3):
 * 1. Initial and Final Total Mass:
 *    m_0 = m_dry + m_propellant [kg]
 *    m_f = m_dry [kg]
 * 2. Mass Ratio:
 *    R = m_0 / m_f
 * 3. Tsiolkovsky Ideal Rocket Equation:
 *    Delta_v_ideal = Isp * g_0 * ln(m_0 / m_f) [m/s]
 * 4. Burn Duration:
 *    t_burn = (m_propellant * Isp * g_0) / F [s]
 * 5. Accelerations:
 *    a_initial = F / m_0 [m/s²]
 *    a_final = F / m_f [m/s²]
 *
 * Physical Constants:
 * - Standard gravitational acceleration: g_0 = 9.80665 m/s² (exact).
 *
 * Scope, Decoupling & Educational Model Limitations:
 * - Scope: Evaluates ideal impulsive velocity increment (Delta-v).
 * - Exclusions: Gravity losses (Delta_v_grav), steering/cosine losses (Delta_v_steering),
 *   and atmospheric drag/finite-burn numerical integration losses are excluded from Phase 2
 *   and deferred to Phase 4 orbit propagation.
 * - Decoupling: Propulsion physics are evaluated independently of launch provider institutional
 *   restrictions. However, institutional policies such as NASA LSP-REQ-317.01 Rev B §6.2.5
 *   (which prohibits propulsion for CSLI CubeSats) are evaluated in the Mass Budget module.
 * - Zero-Propellant Case: Spacecraft without propulsion (m_prop = 0) return Delta_v = 0.0 m/s,
 *   t_burn = 0.0 s, and hasPropulsion = false without error.
 */

import {
  Kilograms,
  Seconds,
  kg,
  seconds,
  assertFinitePositive,
  assertFiniteNonNegative,
  ValidationError,
} from "../units";

/** Standard gravitational acceleration constant [m/s²] */
export const STANDARD_GRAVITY_MPS2 = 9.80665;

/** Fixed analytical scope note required by Phase 2A Specification §6 */
export const PROPULSION_SCOPE_NOTE =
  "Ideal impulsive delta-v; trajectory losses evaluated in Phase 4" as const;

export interface PropulsionInput {
  readonly dryMassKg: Kilograms;
  readonly propellantMassKg: Kilograms;
  readonly specificImpulseSeconds: Seconds;
  readonly thrustNewtons: number;
}

export interface PropulsionResult {
  readonly hasPropulsion: boolean;
  readonly initialWetMassKg: Kilograms;
  readonly finalDryMassKg: Kilograms;
  readonly massRatio: number;
  readonly idealDeltaVMps: number;
  readonly burnDurationSeconds: Seconds;
  readonly accelerationInitialMps2: number;
  readonly accelerationFinalMps2: number;
  readonly scopeNote: "Ideal impulsive delta-v; trajectory losses evaluated in Phase 4";
}

/**
 * Calculates ideal impulsive delta-v and burn characteristics using the Tsiolkovsky equation.
 * Validates physical constraints and cleanly handles zero-propellant configurations.
 */
export function calculatePropulsion(input: PropulsionInput): PropulsionResult {
  if (!input || typeof input !== "object") {
    throw new ValidationError("input", "Propulsion input must be a non-null object");
  }

  // 1. Validate Dry Mass (must be strictly positive)
  assertFinitePositive(input.dryMassKg, "dryMassKg");

  // 2. Validate Propellant Mass (must be non-negative)
  assertFiniteNonNegative(input.propellantMassKg, "propellantMassKg");

  // 3. Validate Specific Impulse (must be non-negative)
  assertFiniteNonNegative(input.specificImpulseSeconds, "specificImpulseSeconds");

  // 4. Validate Thrust (must be non-negative)
  assertFiniteNonNegative(input.thrustNewtons, "thrustNewtons");

  const dryMass = input.dryMassKg;
  const propMass = input.propellantMassKg;
  const isp = input.specificImpulseSeconds;
  const thrust = input.thrustNewtons;

  const initialWetMass = kg(dryMass + propMass);
  const finalDryMass = dryMass;

  // Mass ratio: m_0 / m_f
  const massRatio = initialWetMass / finalDryMass;

  // Zero-Propellant Case (Case PR-1)
  if (propMass === 0) {
    return Object.freeze({
      hasPropulsion: false,
      initialWetMassKg: initialWetMass,
      finalDryMassKg: finalDryMass,
      massRatio: 1.0,
      idealDeltaVMps: 0.0,
      burnDurationSeconds: seconds(0.0),
      accelerationInitialMps2: thrust > 0 ? thrust / initialWetMass : 0.0,
      accelerationFinalMps2: thrust > 0 ? thrust / finalDryMass : 0.0,
      scopeNote: PROPULSION_SCOPE_NOTE,
    });
  }

  // Active Propulsion Configuration: Validate Positive Physical Operating Parameters
  if (isp <= 0) {
    throw new ValidationError(
      "specificImpulseSeconds",
      `Active propulsion with propellant requires strictly positive specific impulse, received ${isp}`
    );
  }
  if (thrust <= 0) {
    throw new ValidationError(
      "thrustNewtons",
      `Active propulsion with propellant requires strictly positive thrust, received ${thrust}`
    );
  }

  // Tsiolkovsky Rocket Equation: Delta_v = Isp * g_0 * ln(m_0 / m_f)
  const idealDeltaVMps = isp * STANDARD_GRAVITY_MPS2 * Math.log(massRatio);

  // Burn Duration: t_burn = (m_prop * Isp * g_0) / F
  const burnDurationSeconds = seconds((propMass * isp * STANDARD_GRAVITY_MPS2) / thrust);

  // Accelerations: a = F / m
  const accelerationInitialMps2 = thrust / initialWetMass;
  const accelerationFinalMps2 = thrust / finalDryMass;

  return Object.freeze({
    hasPropulsion: true,
    initialWetMassKg: initialWetMass,
    finalDryMassKg: finalDryMass,
    massRatio,
    idealDeltaVMps,
    burnDurationSeconds,
    accelerationInitialMps2,
    accelerationFinalMps2,
    scopeNote: PROPULSION_SCOPE_NOTE,
  });
}
