# ASSET CREDITS & LICENSING MANIFEST

Project: Space Mission Design Game
Date: November 15, 2026

## 1. 3D Model Assets (glTF / GLB)

| Asset File | Description | Source | Creator | License |
| :--- | :--- | :--- | :--- | :--- |
| `craft_cargoA.glb` | Orbital Utility Transport Spacecraft (Flyable Vehicle) | Kenney Space Kit ([kenney.nl](https://kenney.nl/assets/space-kit)) | Kenney | CC0 1.0 Universal (Public Domain) |
| `craft_speederA.glb` | Orbital Reconnaissance Spacecraft | Kenney Space Kit ([kenney.nl](https://kenney.nl/assets/space-kit)) | Kenney | CC0 1.0 Universal (Public Domain) |
| `astronautA.glb` | EVA Spacesuit & Life Support Hardware | Kenney Space Kit ([kenney.nl](https://kenney.nl/assets/space-kit)) | Kenney | CC0 1.0 Universal (Public Domain) |
| `satelliteDish_detailed.glb` | Space Station Deep Space Communications Dish | Kenney Space Kit ([kenney.nl](https://kenney.nl/assets/space-kit)) | Kenney | CC0 1.0 Universal (Public Domain) |
| `door-double.glb` | Space Station Airlock Heavy Bulkhead Door | Kenney Space Station Kit ([kenney.nl](https://kenney.nl/assets/space-station-kit)) | Kenney | CC0 1.0 Universal (Public Domain) |
| `wall-window.glb` | Observation Cupola Reinforced Window Module | Kenney Space Station Kit ([kenney.nl](https://kenney.nl/assets/space-station-kit)) | Kenney | CC0 1.0 Universal (Public Domain) |

## 2. Procedural & NASA Scientific Standards

| Component | Description | Reference / Standard | Source |
| :--- | :--- | :--- | :--- |
| **Procedural Blue Marble Earth** | Dynamic canvas texture rendering continental geometry, oceanic gradients, deserts, and cloud layers | NASA Visible Earth / Blue Marble reference data | In-engine procedural generation (`earthTexture.ts`) |
| **Procedural Solar System Textures** | Dynamic procedural high-resolution surface maps for Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, and Neptune | NASA Scientific Visualization Studio Planetary Maps | In-engine procedural generation (`planetTextures.ts`) |
| **Gargantua Gravitational Lensing** | Relativistic curved photon ring, event horizon silhouette, and 1,400 Keplerian swirling particles | Thorne et al. gravitational lensing models & Interstellar physics | In-engine procedural geometry (`BlackHoleScene.tsx`) |
| **Project Aegis Impactor & Dimorphos** | Hypervelocity kinetic collision target boulder, DRACO optical guidance reticle, and LICIACube ejecta plume | NASA DART Mission Data (JPL/APL) | In-engine procedural geometry (`AegisScene.tsx`) |
| **Project Europa Cryosphere & Abyssal Sub** | Cryogenic chaotic terrain, thermal drill plume, 130 MPa submersible, and hydrothermal black smoker chimney | NASA Ocean Worlds Life Surveyor (OWLS) & Galileo data | In-engine procedural geometry (`EuropaScene.tsx`) |
| **CubeSat 3U/6U Spacecraft Architecture** | Hard-anodized Al 6061-T6 corner rails, P-POD separation switches, Kapton MLI thermal blankets, GaAs photovoltaic cells | Cal Poly CDS Rev 14.1 & NASA LSP-REQ-317.01 | In-engine aerospace CAD model |
| **Audio Synthesizer Engine** | Spacecraft telemetry beeps, active sonar pings, airlock cycling hiss, Doppler radar whines, and RCS puffs | Standard Web Audio API zero-latency synthesis | Custom synthesis engine (`audio.ts`) |

## 3. License Terms (CC0 1.0 Universal)

The person who associated a work with this deed has dedicated the work to the public domain by waiving all of his or her rights to the work worldwide under copyright law, including all related and neighboring rights, to the extent allowed by law. You can copy, modify, distribute and perform the work, even for commercial purposes, all without asking permission.
