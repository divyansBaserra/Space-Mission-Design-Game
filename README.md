<div align="center">

# Space Mission Design Game

**High-Fidelity Aerospace Systems Engineering & Orbit Simulation Simulator**

Developed for the **NASA Space Apps Challenge 2026**

[![Live Demo](https://img.shields.io/badge/Live_Demo-Vercel_Production-000000?style=flat-square&logo=vercel)](https://space-mission-design-game-i023rdwwh.vercel.app)
[![Next.js](https://img.shields.io/badge/Framework-Next.js_16_Turbopack-000000?style=flat-square&logo=next.js)](https://nextjs.org)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript_5.9_Strict-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org)
[![Three.js](https://img.shields.io/badge/Graphics-Three.js_/_R3F-000000?style=flat-square&logo=three.js)](https://threejs.org)
[![Tests](https://img.shields.io/badge/Test_Suite-351_Passed-2ea44f?style=flat-square)](https://bun.sh)
[![License](https://img.shields.io/badge/License-MIT-lightgrey?style=flat-square)](./LICENSE)

<br />

<img src="./screen.png" alt="Space Mission Design Game - Viewport & Mission Operations Console" width="100%" style="border-radius: 8px; border: 1px solid #30363d;" />

</div>

> **Live Production Simulator**: [https://space-mission-design-game-i023rdwwh.vercel.app](https://space-mission-design-game-i023rdwwh.vercel.app)

---

## Overview

**Space Mission Design Game** is an authentic, browser-native aerospace mission design and orbit operations simulator. Players architect, balance, simulate, and debrief robotic small-satellite and CubeSat missions through rigorous first-principles engineering. 

Subsystem choices, orbital mechanics, power budgets, and flight safety regulations directly and deterministically govern mission success, culminating in an explainable post-flight evaluation based on **NASA JPL Concept Maturity Level (CML 4)** methodologies.

---

## Core System Architecture

### 1. Subsystem Engineering Engine
The core calculation engine executes purely client-side in TypeScript with zero latency, providing deterministic budgets:

| Budget Domain | Governing Formulation | Flight Margin & Verification Target |
| :--- | :--- | :--- |
| **Mass & Envelope (MEL)** | Current Best Estimate (CBE) + 15% Mass Growth Allowance (MGA) | Dry mass margin $\ge 35.0\%$ vs. P-POD / Rail dispenser limits |
| **Electrical Power (EPS)** | Solar irradiance ($1361\text{ W/m}^2$) $\times$ cell efficiency vs. bus load | Battery Depth-of-Discharge (DoD) $< 25\%$ (Nominal), $< 70\%$ (Floor) |
| **Telecommunications** | Friis free-space path loss formula ($435\text{ MHz}$ to $8.4\text{ GHz}$) | Downlink signal-to-noise margin $\ge 6.0\text{ dB}$ at ground mask |
| **Propulsion & Impulse** | Ideal Tsiolkovsky rocket equation ($\Delta v = I_{sp} g_0 \ln(m_0/m_f)$) | Orbit maintenance $\Delta v$ margin against station-keeping requirements |
| **Flight Safety Inhibits** | Cal Poly CDS Rev 14.1 deployment timers | 30-min solar deployment delay ($\S 2.4.4$), 45-min RF silence ($\S 2.4.5$) |

### 2. Supported CubeSat Form Factors

| Form Factor | Exterior Dimensions | Maximum Allowable Mass | Standard Deployment Envelopes |
| :--- | :--- | :--- | :--- |
| **1U** | $10 \times 10 \times 10\text{ cm}$ | $\le 2.0\text{ kg}$ | Educational technology demonstrations |
| **3U** | $10 \times 10 \times 30\text{ cm}$ | $\le 4.0\text{ kg}$ ($5.0\text{ kg}$ Dispenser Limit) | Standard Earth observing and magnetospheric platforms |
| **6U** | $10 \times 20 \times 30\text{ cm}$ | $\le 12.0\text{ kg}$ | Deep-space small satellite scientific missions |

### 3. Mission Profiles & Orbital Mechanics

| Mission Code | Destination & Orbit | Altitude | Inclination | Orbital Period | Eclipse Duration | Primary Science Objective |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **ARC-600** | LEO Sun-Synchronous (SSO) | $600\text{ km}$ | $97.79^\circ$ | $96.6\text{ min}$ | $35.2\text{ min}$ | $\ge 500\text{ Mb}$ Multispectral UV/IR Earth observation |
| **ISS-400** | ISS Co-Orbital LEO | $400\text{ km}$ | $51.64^\circ$ | $92.5\text{ min}$ | $36.1\text{ min}$ | $\ge 350\text{ Mb}$ Edge computing and telemetry relay |
| **POL-700** | High-Inclination Polar | $700\text{ km}$ | $90.00^\circ$ | $98.7\text{ min}$ | $34.5\text{ min}$ | $\ge 800\text{ Mb}$ Space weather, plasma & auroral sensing |
| **GEO-35K** | Geostationary Orbit | $35,786\text{ km}$ | $0.00^\circ$ | $1436.1\text{ min}$ | $72.0\text{ min}$ (Equinox) | $\ge 2000\text{ Mb}$ Continuous weather & communications link |

---

## Visualizer & Simulation Loop

* **3D Spacecraft Viewport**: Real-time rendering of chassis rails, Kapton MLI thermal blankets, GaAs solar tiles, articulable solar wings, sensor optics, and propulsion thruster exhausts powered by Three.js and React Three Fiber.
* **Procedural Earth & Atmosphere**: Dynamic canvas-driven Blue Marble planetary shader rendering continental morphology, cloud layers, day/night terminators, and atmospheric rim glow without heavy static texture downloads.
* **First-Person Outpost Exploration**: Interactive station and cockpit operational mode with zero-latency synthesized audio (RCS thrusters, relay clicks, and airlock decompression via Web Audio API).
* **Deterministic Simulation Engine**: Keplerian orbital stepping factoring $J_2$ Earth oblateness, cylindrical Earth umbra eclipses, ground station passes (WFF, Svalbard SG3, DSN Goldstone), and automatic safe-mode load shedding.
* **JPL CML Scorecard**: Post-flight engineering debrief classifying outcomes (Grade A through F) with root-cause diagnostics on power deficits, thermal limits, and mass margin breaches.

---

## Aerospace Standards & Verification

All physical equations and operational constraints within the application are strictly verified against official space agency specifications:

| Institutional Standard | Document Reference | Application Implementation |
| :--- | :--- | :--- |
| **NASA Systems Engineering Handbook** | `NASA SP-2016-6105 Rev 2` | Requirements allocation, trade studies, and margin management |
| **Cal Poly CubeSat Design Specification** | `CDS Rev 13 & Rev 14.1` | P-POD dimensional limits, separation switch logic, and timers |
| **NASA Launch Services Program** | `LSP-REQ-317.01 Rev B` | Range safety deployment delays and RF transmission inhibits |
| **NASA JPL Team X Methodology** | `JPL CML Levels 1–7` | Mission maturity progression and post-flight grading metrics |
| **NASA Orbital Debris Mitigation** | `NASA-STD-8719.14A` | Post-mission orbital lifetime verification |

---

## Technology Stack

```
Frontend Architecture      Next.js 16 (App Router, Turbopack)
Language                   TypeScript 5.9 (Strict Type Checking)
Runtime & Package Manager  Bun 1.3
3D Graphics & WebGL        Three.js 0.187 + React Three Fiber 9.8 / Drei 10.7
Audio Synthesis            Web Audio API (Procedural Telemetry Engine)
Design System              Aerospace Design Tokens (tokens.css, globals.css)
Testing Framework          Bun Test (351 Unit Tests across 15 suites)
Deployment Platform        Vercel Cloud Platform
```

---

## Getting Started

### Prerequisites
- [Bun](https://bun.sh/) (v1.2+) or Node.js (v20+)

### Quick Start
```bash
# 1. Clone repository
git clone https://github.com/divyansBaserra/Space-Mission-Design-Game.git
cd Space-Mission-Design-Game

# 2. Install dependencies
bun install

# 3. Start local development server
bun run dev

# 4. Open in browser
# http://localhost:3000
```

### Verification & Testing
```bash
# Run unit test suite (351 passed tests)
bun test

# Run strict TypeScript verification
bun run type-check

# Compile production build
bun run build
```

---

## Asset Credits & Attributions

All third-party 3D geometries and planetary resources are utilized under permissive open-source licenses:
- **3D Modular Assets**: Kenney Space & Space Station Kits (CC0 1.0 Universal / Public Domain).
- **Planetary Standards**: NASA Scientific Visualization Studio & Visible Earth (NASA Public Domain).
- Comprehensive licensing manifests and creator links are documented in [ASSET_CREDITS.md](./ASSET_CREDITS.md).

---

<div align="center">
  <sub>Developed for the <strong>NASA Space Apps Challenge 2026</strong>. Built with precision and first-principles aerospace engineering.</sub>
</div>
