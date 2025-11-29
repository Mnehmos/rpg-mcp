# RPG-MCP: Agentic Embodied Simulation Kernel

[![License: ISC](https://img.shields.io/badge/license-ISC-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)]()
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)]()

**A deterministic, schema-driven, multi-world simulation engine for embodied AI agents.**

RPG-MCP is not a game—it's a **world kernel**. It provides the physics, constraints, persistence, and deterministic execution layer that allows LLM agents to inhabit a simulated reality with real bodies, real limits, and real consequences.

---

## Architecture Philosophy

This engine implements the **Event-Driven Agentic AI Architecture** described in our [white paper](docs/WHITE_PAPER.md):

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                         │
│   EVENT                                                                                 │
│     │                                                                                   │
│     ▼                                                                                   │
│   ┌───────────┐     ┌───────────┐     ┌────────────┐     ┌───────────┐     ┌─────────┐ │
│   │  OBSERVE  │ ──▶ │  ORIENT   │ ──▶ │   DECIDE   │ ──▶ │    ACT    │ ──▶ │VALIDATE │ │
│   │           │     │           │     │            │     │           │     │         │ │
│   │ MCP Read  │     │ LLM Brain │     │Orchestrator│     │ MCP Write │     │ Engine  │ │
│   │  Tools    │     │  Analyze  │     │   Plan     │     │   Tools   │     │  Rules  │ │
│   └───────────┘     └───────────┘     └────────────┘     └───────────┘     └────┬────┘ │
│         ▲                                                                       │      │
│         │                                                                       │      │
│         └───────────────────────────────────────────────────────────────────────┘      │
│                                    WORLD STATE                                         │
│                                  (updates & loops)                                     │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

### The Embodiment Model

| Biological System | RPG-MCP Component | Role |
|-------------------|-------------------|------|
| **Brain** | LLM Agent (external) | Strategic reasoning, planning, interpretation |
| **Nervous System** | Engine + Orchestrator | Validates intent, enforces constraints, routes actions |
| **Reflex Arc** | Constraint Validator | Blocks impossible actions before execution |
| **Sensory Organs** | Observation Tools | `getObservation`, `queryEntities`, `getWorldSnapshot` |
| **Muscles** | Action Tools | `proposeAction`, `moveEntity`, `attack`, `interact` |
| **Environment** | World State + Physics | SQLite-persisted, deterministic, forkable reality |

**Key invariant**: LLMs propose intentions. The engine validates and executes. LLMs never directly mutate world state.

---

## Features

**Multi-tenant & Multi-world**
- Isolated projects (`projectId`) and parallel worlds (`worldId`)
- Fork worlds for branching timelines or "what-if" simulations

**Embodied Entities**
- Position, velocity, orientation in 3D space
- Stats, inventories, status effects, controller links
- Sensory radius, line-of-sight, perception limits

**Intent-Based Actions**
- Agents submit intentions: `MOVE_TO`, `ATTACK`, `CAST_SPELL`, `INTERACT`
- Engine validates against physics, rules, and constraints
- Invalid actions rejected with structured feedback

**Deterministic Physics**
- Collision detection, projectile trajectories, movement costs
- Reproducible world steps—same inputs always yield same outputs
- Full audit trail: snapshots, event logs, action history

**MCP Tool Interface**
- Standard Model Context Protocol tools for LLM integration
- Clean separation: read tools (sensors) vs. write tools (muscles)
- Designed for Claude, GPT, or any MCP-compatible agent

---

## Project Structure

```
src/
├── schema/          # Zod schemas: entities, actions, world state, constraints
├── engine/          # World loop, physics, constraint validator, action queue
├── storage/
│   ├── migrations/  # SQLite schema definitions
│   └── repos/       # Repository pattern for persistence
├── api/             # MCP tool definitions
└── tests/           # Unit & integration tests
```

---

## Installation

### Option 1: Standalone Binaries (Recommended)

Download the pre-built binary for your platform from the [Releases](https://github.com/Mnehmos/rpg-mcp/releases) page:

**Windows:**
```bash
# Download rpg-mcp-win.exe
# No Node.js installation required!
.\rpg-mcp-win.exe
```

**macOS:**
```bash
# Download rpg-mcp-macos
chmod +x rpg-mcp-macos
./rpg-mcp-macos
```

**Linux:**
```bash
# Download rpg-mcp-linux
chmod +x rpg-mcp-linux
./rpg-mcp-linux
```

The binaries are self-contained and include all dependencies. No Node.js installation needed.

### Option 2: From Source

```bash
git clone https://github.com/Mnehmos/rpg-mcp.git
cd rpg-mcp
npm install
npm run build
```

To build binaries yourself:
```bash
npm run build:binaries
# Output: bin/rpg-mcp-win.exe, bin/rpg-mcp-macos, bin/rpg-mcp-linux
```

### MCP Client Configuration

To use with an MCP-compatible client (Claude Desktop, etc.), add to your client's configuration:

**Using Binary:**
```json
{
  "mcpServers": {
    "rpg-mcp": {
      "command": "path/to/rpg-mcp-win.exe"
    }
  }
}
```

**Using Source:**
```json
{
  "mcpServers": {
    "rpg-mcp": {
      "command": "npx",
      "args": ["tsx", "path/to/rpg-mcp/src/server/index.js"]
    }
  }
}
```

---

## Quick Start

```bash
git clone https://github.com/Mnehmos/rpg-mcp.git
cd rpg-mcp
npm install
npm run build
npm test
```

### Basic Usage

```typescript
import { 
  createWorld, 
  worldStep, 
  proposeAction, 
  getObservation 
} from 'rpg-mcp'

// Initialize world
const world = createWorld({ 
  projectId: 'campaign-alpha', 
  worldId: 'dungeon-level-1' 
})

// Spawn an entity
await spawnEntity(world, {
  entityId: 'hero-1',
  position: { x: 0, y: 0, z: 0 },
  stats: { hp: 100, speed: 5 }
})

// Agent observes (OODA: Observe)
const obs = await getObservation(world, 'hero-1')
console.log(obs.visibleEntities, obs.nearbyTerrain)

// Agent decides and acts (OODA: Orient → Decide → Act)
const result = await proposeAction(world, {
  actionType: 'MOVE_TO',
  actorEntityId: 'hero-1',
  target: { x: 10, y: 5, z: 0 }
})

if (!result.success) {
  console.log('Action rejected:', result.reason)
  // e.g., "Path blocked by wall at (5, 5, 0)"
}

// Advance simulation (physics tick)
await worldStep(world, { deltaTime: 1 })

// Loop continues...
```

This is the **closed-loop OODA pattern**: Observe → Orient → Decide → Act → (Validate) → Observe...

---

## MCP Tools Reference

### Observation Tools (Sensors)

| Tool | Description |
|------|-------------|
| `getObservation(worldId, entityId)` | Returns visible entities, terrain, sounds within sensory range |
| `getWorldSnapshot(worldId)` | Full world state dump (admin/debug) |
| `queryEntities(worldId, filter)` | Query entities by type, position, status |
| `getEntityState(worldId, entityId)` | Detailed state for a single entity |

### Action Tools (Muscles)

| Tool | Description |
|------|-------------|
| `proposeAction(worldId, action)` | Submit intent; engine validates and queues |
| `worldStep(worldId, deltaTime)` | Advance physics simulation by N ticks |
| `forkWorld(sourceWorldId, newWorldId)` | Branch world state for parallel simulation |
| `revertToSnapshot(worldId, snapshotId)` | Restore world to previous state |

### Action Types

```typescript
type ActionType = 
  | 'MOVE_TO'        // Navigate to position
  | 'ATTACK'         // Melee/ranged attack target
  | 'CAST_SPELL'     // Use ability with targeting
  | 'INTERACT'       // Use object, open door, etc.
  | 'PICK_UP'        // Add item to inventory
  | 'DROP'           // Remove item from inventory
  | 'WAIT'           // Pass turn / hold action
```

### Math Engine Tools

| Tool | Description |
|------|-------------|
| `dice_roll(expression, seed?, exportFormat?)` | Roll dice with standard notation (2d6+3), supports advantage/disadvantage |
| `probability_calculate(expression, target, comparison)` | Calculate probabilities and expected values for dice rolls |
| `algebra_solve(equation, variable?, exportFormat?)` | Solve algebraic equations symbolically |
| `algebra_simplify(expression, exportFormat?)` | Simplify algebraic expressions |
| `physics_projectile(velocity, angle, height?, gravity?)` | Calculate projectile motion trajectories |

**Export Formats**: `latex`, `mathml`, `plaintext`, `steps`

---

## Use Cases

**Tabletop RPG Backend**  
Run D&D, Död Magiker, or custom systems with AI dungeon masters and NPCs that have real bodies and spatial reasoning.

**Multi-Agent Simulation**  
Test agent coordination, emergent behavior, or adversarial scenarios in a controlled, reproducible environment.

**Embodied AI Research**  
Study how LLMs behave when constrained by physics, resources, and perception limits—not just text.

**Game Development**  
Use as a headless game server with deterministic state, replay capability, and clean API boundaries.

**Training Data Generation**  
Fork worlds, run thousands of parallel scenarios, collect structured action/outcome pairs.

---

## Design Principles

1. **LLMs propose, never execute**  
   The brain suggests; the nervous system validates.

2. **All action is tool-mediated**  
   No direct world mutation. Every change flows through MCP tools.

3. **Validation precedes observation**  
   Act → Validate → Observe. The reflex arc pattern.

4. **Events trigger tasks**  
   JIT execution. No polling, no stale state.

5. **Deterministic outcomes**  
   Same inputs → same outputs. Always reproducible.

6. **Schema-driven everything**  
   Zod validates all data at boundaries. Type safety end-to-end.

---

## Contributing

Contributions welcome! Please:

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Write tests for new functionality
4. Follow existing code style (TypeScript + Zod + tests)
5. Submit a pull request

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines.

---

## Roadmap

- [ ] WebSocket real-time subscriptions
- [ ] Spatial indexing (R-tree) for large worlds
- [ ] Plugin system for custom physics/rules
- [ ] Multi-agent turn coordination modes
- [ ] Visual debugger / world inspector UI
- [ ] Docker deployment template

---

## License

[ISC](LICENSE) — Use freely, attribution appreciated.

---

## Related

- [White Paper: Event-Driven Agentic AI Architecture](docs/WHITE_PAPER.md)
- [Model Context Protocol Specification](https://modelcontextprotocol.io)
- [Quest Keeper](https://github.com/Mnehmos/quest-keeper) — Browser-based AI dungeon master using this engine

---

## Documentation & Build Diary

For a detailed history of the development process, technical decisions, and progress logs, see the **[Build Diary](docs/BUILD_DIARY.md)**.

---

<p align="center">
<em>"AI-native autonomic organisms capable of maintaining and improving themselves in complex environments"</em>
</p>
