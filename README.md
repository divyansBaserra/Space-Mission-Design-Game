# NASA Space Mission Design Game

An interactive, educational space mission engineering and simulation game developed for the **NASA Space Apps Challenge 2026**.

Players design, configure, simulate, and evaluate realistic robotic small-satellite and CubeSat missions. Engineering decisions directly and transparently determine mission outcomes based on aerospace physics and flight regulations.

## Engineering Foundations & Standards
- **NASA Systems Engineering Handbook** (`NASA SP-2016-6105`)
- **NASA CubeSat 101 & CDS Standards** (`LSP-REQ-317.01`)
- **NASA JPL Concept Maturity Levels** (`CML 1–7`)
- **NASA Orbital Debris Mitigation Requirements** (`NASA-STD-8719.14A`)

## Technology Stack
- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5.9
- **Runtime & Package Manager**: Bun 1.3
- **3D Graphics Engine**: Three.js 0.187 + React Three Fiber 9.8 / Drei 10.7
- **Styling Architecture**: Vanilla CSS Design Tokens (`tokens.css`, `globals.css`)
- **Target Deployment**: Vercel

## Development Commands
```bash
# Install dependencies
bun install

# Run local development server
bun run dev

# Run TypeScript type check
bun run type-check

# Production build
bun run build
```

## Project Structure
```
src/
├── app/                  # Next.js App Router (Layout & Pages)
├── components/
│   └── viewport/         # SSR-safe React Three Fiber 3D Canvas
├── styles/
│   ├── tokens.css        # Aerospace design tokens & color variables
│   └── globals.css       # Base CSS reset & layout primitives
└── types/
    └── mission.ts        # Verified domain types & engineering budget schemas
```

## Architectural Boundaries
- **Client-Side Physics**: Deterministic calculations execute entirely in client-side TypeScript for instant simulation without serverless latency.
- **SSR-Safe 3D Canvas**: All Three.js viewports use dynamic imports with SSR disabled.
- **Separate Resources**: NASA reference manuals and GMAT offline binaries remain in external reference storage (`D:\NASA-Space-Apps-Resources`).
