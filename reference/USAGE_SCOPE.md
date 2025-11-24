# Azgaar Reference - Usage Scope

## What We Will NOT Reuse

### ❌ Direct Code Copying
- No direct module imports from Azgaar codebase
- No copy-paste of functions or classes
- All code written independently from scratch

### ❌ Frontend-Specific Components
- UI/rendering components (React, DOM manipulation)
- Browser-based libraries (D3.js for SVG rendering)
- Canvas/WebGL rendering logic
- Client-side state management

### ❌ Visual Presentation Layer
- SVG generation and styling
- Interactive map controls
- Color schemes and theming
- Export/download functionality

### ❌ Browser Dependencies
- IndexedDB storage
- Web Workers
- Browser APIs (localStorage, fetch, etc.)
- Frontend build tools and configurations

---

## What We WILL Reference

### ✅ Algorithm Concepts
Study algorithmic approaches for:
- **Heightmap generation**: Layered noise, tectonic simulation
- **Climate modeling**: Temperature gradients, moisture distribution
- **Biome assignment**: Lookup tables based on climate parameters
- **River generation**: Flow accumulation, drainage basins
- **Region segmentation**: Territory partitioning algorithms

### ✅ Quality Gates & Validation
Use as benchmarks for:
- **Terrain continuity**: No abrupt elevation changes
- **Biome plausibility**: Realistic climate-biome relationships
- **River validity**: Downhill flow, no loops, proper branching
- **Settlement placement**: Logical positioning (coasts, rivers)

### ✅ Data Structures & Formats
Understand patterns for:
- **Grid layouts**: Hex vs square grids, coordinate systems
- **Biome tables**: Temperature/moisture matrix mappings
- **Elevation ranges**: Thresholds for sea level, mountains, etc.
- **River networks**: Graph structures for flow paths

### ✅ Parameter Ranges & Constants
Reference realistic values for:
- **Temperature gradients**: Equator-to-pole variations
- **Moisture levels**: Precipitation distributions
- **Elevation thresholds**: Sea level, hills, mountains
- **Generation scales**: Map sizes, feature densities

### ✅ Generation Patterns
Learn workflows for:
- **Layered generation**: Heightmap → climate → biomes → features
- **Noise functions**: Octaves, persistence, lacunarity
- **Constraint satisfaction**: Ensuring geographic plausibility
- **Seed-based determinism**: Reproducible generation

---

## Implementation Principles

### Independent TypeScript Implementation
All code in `rpg-mcp` will be:
- Written from scratch in TypeScript
- Designed for Node.js server-side execution
- Type-safe with strict TypeScript configuration
- Schema-validated using Zod

### Deterministic & Testable
Following TDD principles:
- Tests written before implementation
- Seedable PRNG (no `Math.random()`)
- Deterministic timestamps (no `Date.now()`)
- Full test coverage (positive, negative, edge cases)

### Repository Pattern Architecture
Maintaining clean separation:
- Schema validation at all boundaries
- Database constraints matching schemas
- No hidden state or side effects
- Explicit input/output contracts

---

## Research Workflow

1. **Study Azgaar implementation** (reference only)
2. **Extract algorithmic concepts** (write pseudocode)
3. **Write failing tests** (TDD approach)
4. **Implement independently** (from scratch in TypeScript)
5. **Validate quality** (compare against Azgaar benchmarks)

This ensures we benefit from Azgaar's research while maintaining:
- Legal compliance (MIT license attribution)
- Code independence (no direct copying)
- Architectural alignment (server-side, schema-driven)
- Quality standards (TDD, determinism, type safety)
