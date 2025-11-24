# Azgaar Algorithm Snapshot

**Purpose**: Document key algorithms, data structures, and quality benchmarks from Azgaar Fantasy Map Generator for reference during independent implementation.

**Date**: 2025-01-23
**Azgaar Version**: Cloned from main branch
**Reference Seed**: (To be determined during testing)

---

## 1. HEIGHTMAP GENERATION

### Key Modules
- `modules/heightmap-generator.js`

### Algorithm Overview
Azgaar uses a **template-based heightmap system** with composition of primitives:

#### Primitive Operations
1. **Hill** - Circular raised area (blob-based)
2. **Pit** - Circular depression
3. **Range** - Linear mountain range
4. **Trough** - Linear valley
5. **Strait** - Narrow water passage
6. **Mask** - Apply mask filter
7. **Smooth** - Averaging filter
8. **Add/Multiply** - Arithmetic operations

#### Blob Power (Cell Count → Decay)
```javascript
{
  1000:  0.93,
  2000:  0.95,
  5000:  0.97,
  10000: 0.98,
  20000: 0.99,
  30000: 0.991,
  // ... scales with cell count
}
```

### Key Constants
- **MIN_LAND_HEIGHT**: 20 (heightmap units, 0-100 scale)
- **Seed-based PRNG**: Uses `aleaPRNG(seed)` for determinism

### Quality Gates
- ✅ **Terrain Continuity**: No abrupt elevation jumps between neighbors
- ✅ **Elevation Distribution**: Realistic land/sea ratio (~30% land)
- ✅ **Mountain Placement**: Believable tectonic patterns

---

## 2. BIOME SYSTEM

### Key Modules
- `modules/biomes.js`

### Biome Matrix (Temperature × Moisture)

#### Biome Types (13 total)
```
0:  Marine
1:  Hot desert
2:  Cold desert
3:  Savanna
4:  Grassland
5:  Tropical seasonal forest
6:  Temperate deciduous forest
7:  Tropical rainforest
8:  Temperate rainforest
9:  Taiga
10: Tundra
11: Glacier
12: Wetland
```

#### Assignment Matrix
5 temperature bands (hot → cold) × 26 moisture levels (dry → wet)

```javascript
biomesMartix = [
  // Temperature band 0 (hottest, >19°C)
  [1,1,1,1,1,1,1,1,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,10],

  // Temperature band 1
  [3,3,3,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,9,9,9,9,10,10,10],

  // Temperature band 2
  [5,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,6,9,9,9,9,9,10,10,10],

  // Temperature band 3
  [5,6,6,6,6,6,6,8,8,8,8,8,8,8,8,8,8,9,9,9,9,9,9,10,10,10],

  // Temperature band 4 (coldest, <-4°C)
  [7,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,8,9,9,9,9,9,9,9,10,10]
];
```

### Biome Properties
- **Habitability**: 0-100 (affects settlement placement)
- **Movement Cost**: 10-5000 (gameplay impact)
- **Icon Density**: Visual feature density

### Quality Gates
- ✅ **Climate Plausibility**: No tropical forests next to glaciers
- ✅ **Transition Smoothness**: Gradual biome boundaries
- ✅ **Latitude Correlation**: Cold biomes toward poles

---

## 3. CLIMATE SYSTEM

### Temperature Model
- **Latitude-based gradient**: Equator hot → poles cold
- **Temperature bands**: 5 discrete bands (>19°C to <-4°C)
- **Elevation adjustment**: Higher elevation = colder

### Moisture Model
- **Precipitation distribution**: Moisture levels 0-25 (26 levels)
- **Ocean proximity**: Coastal areas more moisture
- **Rain shadow**: Mountains block moisture flow

### Key Constants
- **Temperature threshold (hot)**: >19°C
- **Temperature threshold (cold)**: <-4°C
- **Moisture levels**: 0 (desert) to 25 (rainforest)

---

## 4. RIVER GENERATION

### Key Modules
- `modules/river-generator.js`
- `modules/lakes.js`

### Algorithm Workflow
1. **Alter Heights**: Apply gradient for drainage
2. **Detect Lakes**: Find closed depressions
3. **Resolve Depressions**: Ensure no sinks
4. **Drain Water**: Flow accumulation from precipitation
5. **Define Rivers**: Create river objects where flux > threshold
6. **Calculate Confluences**: Merge tributary flows
7. **Downcut Rivers**: Erosion simulation (optional)

### Key Constants
```javascript
MIN_FLUX_TO_FORM_RIVER = 30  // Minimum water flux
MIN_LAND_HEIGHT = 20         // Sea level threshold
```

### Flow Accumulation
```javascript
// Each cell accumulates:
cells.fl[i] += prec[cells.g[i]] / cellsNumberModifier
```

### River Properties
- **Flux (fl)**: Water volume flowing through cell
- **River ID (r)**: Which river system cell belongs to
- **Confluence (conf)**: River merge points

### Quality Gates
- ✅ **Downhill Flow**: Rivers MUST flow from high → low elevation
- ✅ **No Loops**: Directed acyclic graph structure
- ✅ **Realistic Branching**: Tributaries merge (not split)
- ✅ **Lake Handling**: Proper inlet/outlet flow

---

## 5. STRUCTURE & SETTLEMENT PLACEMENT

### Key Modules
- `modules/burgs-and-states.js`
- `modules/features.js`

### Settlement Placement Rules

#### Cities
- **Coastal preference**: Near oceans/large lakes
- **Harbor locations**: Protected bays
- **River mouths**: Where rivers meet ocean

#### Towns
- **River proximity**: Along major rivers (high flux)
- **Biome habitability**: Prefer high habitability zones
- **Elevation**: Avoid extreme heights

#### Villages
- **Agricultural land**: Grasslands, forests
- **Resource proximity**: Near resources
- **Spacing**: Min distance from other settlements

### Quality Gates
- ✅ **Geographic Logic**: Settlements in habitable zones
- ✅ **Resource Access**: Near water, fertile land
- ✅ **Spacing**: Not clustered unrealistically

---

## 6. DATA STRUCTURES

### Grid/Graph System
Azgaar uses **Voronoi diagram** for cells:

```javascript
grid = {
  cellsDesired,  // Target cell count
  cells: {
    h: [],       // Height
    i: [],       // Index
    g: [],       // Grid cell reference
    c: [],       // Neighbors
    b: [],       // Border cells
    f: [],       // Feature (lake/landmass)
    fl: [],      // Water flux
    r: [],       // River ID
    conf: [],    // Confluence flag
    temp: [],    // Temperature
    prec: []     // Precipitation
  },
  points: []     // Voronoi points
}
```

### Our Implementation Plan
We'll use **square/hex grid** instead:
```typescript
interface Tile {
  x: number;
  y: number;
  elevation: number;
  temperature: number;
  moisture: number;
  biome: BiomeType;
  riverId?: string;
  waterFlux?: number;
}
```

---

## 7. QUALITY BENCHMARKS

### Sample Seeds for Testing
(To be captured after running Azgaar with specific seeds)

#### Test Seed 1: "benchmark-001"
- **Expected**: Balanced continents, realistic rivers
- **Terrain**: ~30% land, mountains along tectonic lines
- **Biomes**: Diverse, climate-appropriate distribution
- **Rivers**: No loops, downhill flow verified

#### Test Seed 2: "island-archipelago"
- **Expected**: Multiple islands, island chains
- **Terrain**: Small landmasses, deep ocean
- **Biomes**: Island-specific climate patterns
- **Rivers**: Short, coastal-draining rivers

#### Test Seed 3: "pangaea-supercontinent"
- **Expected**: Single large landmass
- **Terrain**: Continental interior, coastal ranges
- **Biomes**: Arid interior, wet coasts
- **Rivers**: Long continental rivers

---

## 8. IMPLEMENTATION NOTES

### What We'll Adapt
1. **Biome matrix concept** - Temperature × moisture lookup
2. **Flow accumulation algorithm** - Precipitation → flux → rivers
3. **Heightmap composition** - Layered primitive operations
4. **Quality gates** - Use same validation criteria

### What We'll Change
1. **Grid system**: Voronoi → Square/Hex grid
2. **Language**: JavaScript → TypeScript
3. **Runtime**: Browser → Node.js server
4. **Validation**: Manual → Zod schema validation
5. **State**: Mutable global → Immutable functional

### Key Differences
- **Determinism**: No browser APIs, pure Node.js
- **Schema-driven**: All data Zod-validated
- **TDD approach**: Tests written first
- **Repository pattern**: Clean data layer separation

---

## 9. NEXT STEPS

### Research Tasks
- [ ] Run Azgaar with known seed, capture output
- [ ] Measure quality metrics (land ratio, biome distribution)
- [ ] Document exact parameters used
- [ ] Create visual reference snapshots

### Implementation Tasks
- [ ] Design our grid coordinate system
- [ ] Write failing tests for terrain continuity
- [ ] Implement seedable noise function
- [ ] Build biome lookup table
- [ ] Create flow accumulation algorithm
- [ ] Validate against Azgaar quality benchmarks

---

## 10. REFERENCES

### Key Files Reviewed
- `modules/heightmap-generator.js` - Terrain generation
- `modules/biomes.js` - Biome system and matrix
- `modules/river-generator.js` - River flow algorithm
- `modules/burgs-and-states.js` - Settlement placement
- `modules/lakes.js` - Lake detection and handling

### Algorithm Credits
All algorithms and constants documented here are from:
**Azgaar's Fantasy Map Generator**
Copyright 2017-2024 Max Haniyeu (Azgaar)
Licensed under MIT License

Our implementation will be independent, using these concepts as inspiration only.
