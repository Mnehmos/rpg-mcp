# Unified MCP Simulation Server

A deterministic, schema-driven RPG simulation server built with TypeScript and Test-Driven Development.

## Features

- **Deterministic World Generation**: Reproducible worlds from seeds
- **Schema-Driven Development**: All data validated with Zod schemas
- **SQLite Persistence**: Robust storage layer with full CRUD operations
- **Test-Driven**: Every feature built test-first
- **Type-Safe**: Strict TypeScript with comprehensive type checking

## Project Structure

```
src/
  schema/          # Zod schemas for all data types
  storage/         # SQLite persistence layer
    migrations/    # Database schema definitions
    repos/         # Repository pattern implementations
  worldgen/        # World generation algorithms
    heightmap.ts   # Layered noise heightmap generator
    climate.ts     # Temperature and moisture simulation
    biome.ts       # Biome assignment logic
    river.ts       # Hydraulic erosion and river generation
tests/
  schema/          # Schema validation tests
  storage/         # Storage layer tests
  worldgen/        # World generation tests
reference/
  azgaar/          # Reference implementation (not our code)
```

## Development

### Setup

```bash
npm install
```

### Testing

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

### Building

```bash
npm run build
```

## Usage

### World Generation

```typescript
import { generateWorld } from './src/worldgen';

const world = generateWorld({
  seed: 'my-deterministic-seed',
  width: 100,
  height: 100,
  landRatio: 0.3, // 30% land
});

console.log(world.biomes[50][50]); // Access biome at center
```

## Principles

1. **Determinism First**: Identical seeds produce identical outputs
2. **Schema-Driven**: All boundaries validated via Zod
3. **TDD-Driven**: Tests before implementation
4. **Zero Hidden State**: All state explicit and serializable
5. **Replayable**: Every operation logged deterministically

## License

ISC
