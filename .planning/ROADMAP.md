# Roadmap: NASA Space Mission Design Game

## Overview
A 7-phase disciplined engineering roadmap to build an educational, high-precision space mission design game for NASA Space Apps Challenge 2026.

## Phases

- [x] **Phase 0: Project Initialization, Context Lock & Read-Only Audit** — Completed in reference workspace.
- [x] **Phase 1: Repository Setup, Audit Corrections & Application Foundation** — New repo initialized, verified stack, design tokens, SSR-safe 3D viewport.
- [ ] **Phase 2: Spacecraft Engineering Engine & Subsystem Budgets** — Master Equipment List (MEL) data models, Mass, Power, Delta-V, Link Budget, and CML 4 margin calculators.
- [ ] **Phase 3: Interactive 3D Spacecraft Viewport** — Procedural 1U, 3U, 6U CubeSat chassis and modular subsystem 3D component mounting.
- [ ] **Phase 4: Mission Requirements, Destination & Trajectory Planning** — Orbital mechanics solver (Keplerian orbits, ground tracks, eclipses) and launch vehicle selection.
- [ ] **Phase 5: Deterministic Mission Simulation Loop & Event Engine** — Operational phase stepping, inhibit timer countdown, anomaly generators, telemetry streamer.
- [ ] **Phase 6: Engineering Debrief, JPL CML Evaluation & Explanations** — Post-flight evaluation matrix, root-cause failure explanations, and redesign loop.
- [ ] **Phase 7: End-to-End Polish, Performance Optimization & Vercel Verification** — Bundle optimization, WebGL cleanup, responsive QA, and deployment check.

## Phase Details

### Phase 1: Repository Setup, Audit Corrections & Application Foundation
**Goal**: Establish a pristine, buildable Next.js + React 19 + TypeScript + Bun repository with design tokens and SSR-safe 3D rendering.
**Depends on**: Phase 0
**Success Criteria**:
  1. Repository created at `D:\Space-Mission-Design-Game` with Git and clean `.gitignore`.
  2. Phase 0 audit findings corrected (texture specs, 45-min inhibit source, CML margin scope, Spline status).
  3. Clean production build (`bun run build`) with zero SSR errors and zero type warnings.
**Status**: Complete

### Phase 2: Spacecraft Engineering Engine & Subsystem Budgets
**Goal**: Build pure TypeScript deterministic calculation engines for spacecraft mass, power balance, propulsion, telecommunications, and CML 4 margins.
**Depends on**: Phase 1
**Requirements**: REQ-MEL-01, REQ-MASS-01, REQ-POWER-01, REQ-PROP-01, REQ-COMM-01, REQ-CML-01
**Success Criteria**:
  1. Master Equipment List (MEL) data model supports standard CubeSat components (1U/3U/6U).
  2. Mass calculator validates dry mass, propellant mass, and checks $\ge 35\%$ margin against dispenser limits.
  3. Power balance calculator computes solar generation at 1 AU vs. subsystem consumption across daylight and eclipse periods.
  4. Propulsion calculator computes $\Delta v$ via Tsiolkovsky rocket equation.
  5. Telecom calculator computes link margin via Friis equation and flags range safety inhibit requirement (< 45 min).
  6. Comprehensive unit test suite confirms mathematical accuracy.
**Status**: Ready for approval to begin

---
*Last updated: 2026-11-15 (Phase 1 Complete)*
