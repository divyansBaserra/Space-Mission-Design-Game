# PROJECT: NASA SPACE MISSION DESIGN GAME

## What This Is
An interactive, educational space mission engineering and design game built for the NASA Space Apps Challenge 2026. Players design, configure, simulate, and evaluate realistic robotic space missions (CubeSats and small satellites) through scientifically grounded subsystem engineering, orbital mechanics, launch vehicle selection, event simulation, and explainable engineering debriefs.

## Core Value
Delivering an authentic, explainable aerospace engineering workflow where subsystem choices, physics constraints, and flight regulations directly and transparently determine mission outcomes.

## Requirements

### Validated
- [x] Phase 0: Read-Only Audit, Literature Discovery & Context Lock complete.
- [x] Phase 1: Repository initialization (`D:\Space-Mission-Design-Game`), verified stack compatibility, aerospace design token foundation, and SSR-safe 3D viewport proof-of-concept.

### Active
- [ ] Phase 2: Spacecraft Engineering Engine & Subsystem Budgets (MEL, Mass, Power, Delta-V, Link Budget, CML Margins).
- [ ] Phase 3: Interactive 3D Spacecraft Viewport (Procedural 1U/3U/6U bus with modular subsystem slots).
- [ ] Phase 4: Mission Objectives, Requirements & Trajectory Planning (Keplerian orbits, ground tracks, launch vehicles).
- [ ] Phase 5: Deterministic Mission Simulation Loop & Event Engine (Inhibits, staging, solar storms, ground station passes).
- [ ] Phase 6: Engineering Debrief, JPL CML Evaluation & Explanations (Root cause tracing, failure diagnosis).
- [ ] Phase 7: Polish, Performance Optimization & Vercel Verification.

### Out of Scope
- Real-time multiplayer (architectural consideration preserved, single-player prioritized for competition quality)
- Machine learning / heavy neural network inference (core game relies on deterministic, explainable engineering physics)
- Google Stitch UI components (explicitly excluded by design directive)
- Standalone native desktop binaries (all runtime simulations execute in browser-native TypeScript)
- Spline MCP (treated as unavailable; Three.js / R3F is the primary 3D runtime)

## Context & Technology Stack
- **Framework**: Next.js 16 (App Router), React 19, TypeScript 5.9
- **Package Manager / Runtime**: Bun 1.3
- **3D Graphics**: Three.js 0.187, React Three Fiber 9.8, Drei 10.7
- **Styling**: Vanilla CSS Design Tokens (`tokens.css`, `globals.css`)
- **Reference Literature**: Located at `D:\NASA-Space-Apps-Resources` (JPL CML, NASA CubeSat 101, NASA Systems Engineering Handbook)
- **Target Deployment**: Vercel

## Constraints
- **Design Quality**: High-precision engineering aesthetic; zero generic AI clichés (no neon purple/blue gradients, glowing borders, or clutter).
- **Engineering Accuracy**: Every calculation tagged as `VERIFIED` (first-principles physics), `DERIVED` (subsystem formulas), or `GAME_ASSUMPTION` (educational simplifications).
- **Zero SSR Crashes**: 3D canvases must use dynamic imports with SSR disabled.
- **Maintainable CSS**: Design token architecture with CSS custom properties.

## Key Decisions
| Decision | Rationale | Outcome |
| :--- | :--- | :--- |
| Three.js / R3F over Spline | Spline MCP unavailable; Three.js provides direct React state binding, trajectory math, and WebGL control | Approved |
| Client-side Physics Engine | Vercel serverless cannot run native tools like GMAT; pure TypeScript ensures instant, zero-latency simulation | Approved |
| Separate Reference Directory | Keep `D:\NASA-Space-Apps-Resources` external to keep repository lean and build fast | Approved |
| Inhibit Rule Verification | Verified that 45-min RF inhibit is a NASA LSP / CDS §3.3.5 dispenser safety requirement, not FCC rule | Approved |
| JPL CML 4 Margin Scope | Clarified that 35% margin applies to Dry Mass, Power, and Energy, while other subsystems have tailored rules | Approved |

---
*Last updated: 2026-11-15 (Phase 1 Foundation)*
