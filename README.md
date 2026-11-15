# NASA Space Mission Design Game

An interactive, educational space mission engineering and simulation game developed for the **NASA Space Apps Challenge 2026**.

Players design, configure, simulate, and evaluate realistic robotic small-satellite and CubeSat missions. Engineering decisions directly and transparently determine mission outcomes based on aerospace physics, institutional flight regulations, and flight standards.

---

## Key Features & Game Flow

### 1. Interactive Spacecraft Design & Engineering Budgets
- **Mission Profiles**: Sun-Synchronous LEO (600 km, 97.8° inc), ISS Co-Orbital (400 km, 51.6° inc), Polar Environmental (700 km, 90.0° inc), and Geostationary (35,786 km, 0.0° inc).
- **CubeSat Form Factors**: 1U (10×10×10 cm, ≤2.0 kg), 3U (10×10×30 cm, ≤4.0 kg standard / 5.0 kg dispenser), and 6U (10×20×30 cm, ≤12.0 kg).
- **Subsystem Catalog**:
  - Photovoltaic Arrays (Body-mounted GaAs cells, Deployable 1-wing, Deployable 2-wing with sun-tracking).
  - Energy Storage (20 Wh, 40 Wh, 80 Wh, 120 Wh Li-Ion packs).
  - Payloads (Multispectral UV/IR Imager, Plasma & Magnetometer Probe, Topographic LIDAR, Mini Synthetic Aperture Radar).
  - Propulsion (Cold Gas N2 thruster, Green Monopropellant, Electrospray Micro-Ion thruster).
  - Telecom (UHF whip 435 MHz, S-Band patch 2.2 GHz, X-Band high-gain dish 8.4 GHz).
- **Live Engineering Budgets (JPL CML 4 Compliance)**:
  - Mass Budget: CBE, 15% MGA, MEV, wet mass, and dry mass margin % vs CDS limits.
  - Power Balance: Solar generation in sunlight vs continuous platform + payload load.
  - Eclipse Battery Depth-of-Discharge (DoD): Predicted energy drain during destination eclipse vs 25% cycle-life target and 70% safe-mode floor.
  - RF Link Margin: Friis path loss and link margin (dB) vs 6.0 dB ground mask threshold.
  - Propulsive Impulse: Ideal Tsiolkovsky ΔV (m/s).

### 2. High-Fidelity 3D Viewport (React Three Fiber & Three.js)
- **Spacecraft Visualizer**: Real-time rendering of CubeSat chassis rails, gold MLI thermal insulation, photovoltaic tiles, deployable solar wing animations, payload lenses/horns, antenna styles, and thruster plasma exhaust.
- **Orbital Trajectory View**: True-to-scale Earth globe with atmospheric rim glow, orbital trajectory ring, live satellite beacon propagation, and day/night eclipse shadow cones.

### 3. Mission Simulation & Real-Time Flight Operations
- **Analytical Orbit Propagator**: Keplerian propagation incorporating J2 Earth oblateness perturbations, Greenwich Mean Sidereal Time (GMST), and cylindrical Earth umbra eclipse modeling.
- **Subsystem State Dynamics**: Chemical battery charging/discharging efficiency, thermal equilibrium (-15°C to +35°C), solid-state science data buffer, and downlink rates.
- **Flight Rules & Gating**:
  - Cal Poly CDS Rev 14.1 §2.4.4: 30-minute post-separation deployable delay.
  - Cal Poly CDS Rev 14.1 §2.4.5: 45-minute RF transmission quiet period.
- **Autonomous Safe Mode**: Autonomous payload load shedding on DoD floor breach (≥70% DoD) and automatic recovery at ≥85% SoC.
- **Ground Station Network**: AOS/LOS tracking for NASA Wallops Flight Facility (WFF), Svalbard Satellite Station (SG3), and NASA DSN Goldstone (GDS).
- **Time Warp Controls**: Real-time 1x, 5x, 20x, and 60x acceleration with live telemetry console.

### 4. Post-Flight Debrief & Diagnostics
- **Comprehensive Grading**: Grade A (Exceptional), Grade B (Nominal Flight), Grade C (Partial Success), Grade F (Mission Loss).
- **Flight Scorecard**: Science data volume collected vs mission requirements, peak battery DoD reached, thermal envelope min/max survival, and CML 4 margins.
- **Root-Cause Analysis**: Actionable aerospace engineering recommendations explaining subsystem bottlenecks and failure modes.
- **Iterative Redesign**: One-click transition back to the design workbench to refine configurations and re-fly.

---

## Engineering Foundations & Standards
- **NASA Systems Engineering Handbook** (`NASA SP-2016-6105 Rev 2`)
- **Cal Poly CubeSat Design Specification** (`CDS Rev 13 & Rev 14.1`)
- **NASA Launch Services Program CubeSat Requirements** (`LSP-REQ-317.01 Rev B`)
- **NASA JPL Concept Maturity Levels** (`CML 1–7`)
- **NASA Orbital Debris Mitigation Requirements** (`NASA-STD-8719.14A`)

---

## Technology Stack
- **Framework**: Next.js 16 (App Router with Turbopack)
- **Language**: TypeScript 5.9 (Strict Type Checking)
- **Package Manager & Runtime**: Bun 1.3
- **3D Graphics Engine**: Three.js 0.187 + React Three Fiber 9.8 / Drei 10.7
- **Styling Architecture**: Vanilla CSS Aerospace Design Tokens (`tokens.css`, `globals.css`)
- **Test Framework**: Bun Test (351 passed tests across 15 test files)

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh/) (v1.2+) or Node.js (v20+)

### Installation & Run
```bash
# 1. Install dependencies
bun install

# 2. Run local development server
bun run dev

# 3. Open http://localhost:3000 in your browser
```

### Verification & Testing
```bash
# Run complete test suite (351 tests)
bun test

# Run TypeScript strict type check
bun run type-check

# Production build
bun run build
```

---

## Submission Summary & Architecture
- **Deterministic Physics Engine**: All astrodynamics and subsystem state calculations execute deterministically client-side for zero latency and reproducible simulation.
- **Robustness**: 100% test pass rate with zero TypeScript errors and zero external API dependencies.
- **Responsive Aerospace UI**: Apple-caliber functional design system featuring high-contrast telemetry panels and real-time interactive 3D graphics.
