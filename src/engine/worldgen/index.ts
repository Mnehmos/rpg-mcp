/**
 * World Generation Module
 *
 * Integrates heightmap, climate, and biome generation into a unified API.
 * Follows TDD principles with deterministic, seed-based generation.
 */

export * from './heightmap';
export * from './climate';
export * from './biome';
export * from './river';
export * from './regions';
export * from './structures';

import { generateHeightmap } from './heightmap';
import { generateClimateMap } from './climate';
import { generateBiomeMap } from './biome';
import { generateRivers } from './river';
import { generateRegions, Region } from './regions';
import { placeStructures, StructureLocation } from './structures';
import { BiomeType } from '../../schema/biome';

/**
 * Complete world generation output
 */
export interface GeneratedWorld {
  seed: string;
  width: number;
  height: number;
  /** Elevation map (0-100, sea level at 20) */
  elevation: Uint8Array;
  /** Temperature map (Celsius, -20 to 40) */
  temperature: Int8Array;
  /** Moisture map (percentage, 0-100) */
  moisture: Uint8Array;
  /** Biome assignment */
  biomes: BiomeType[][];
  /** River map (1 = river, 0 = no river) */
  rivers: Uint8Array;
  /** Region definitions */
  regions: Region[];
  /** Region ID map */
  regionMap: Int32Array;
  /** Placed structures */
  structures: StructureLocation[];
}

/**
 * World generation options
 */
export interface WorldGenOptions {
  /** Deterministic seed */
  seed: string;
  /** Map width in cells */
  width: number;
  /** Map height in cells */
  height: number;
  /** Target land ratio (default 0.3 for 30% land) */
  landRatio?: number;
  /** Number of noise octaves (default 6) */
  octaves?: number;
  /** Equator temperature in Celsius (default 30) */
  equatorTemp?: number;
  /** Pole temperature in Celsius (default -10) */
  poleTemp?: number;
  /** Number of regions (default 10) */
  numRegions?: number;
  /** Number of cities (default 5) */
  numCities?: number;
  /** Number of towns (default 10) */
  numTowns?: number;
  /** Number of dungeons (default 5) */
  numDungeons?: number;
}

/**
 * Generate a complete world
 *
 * This is the primary entry point for world generation.
 * Produces a deterministic world from a seed.
 *
 * @example
 * ```typescript
 * const world = generateWorld({
 *   seed: 'my-world-42',
 *   width: 100,
 *   height: 100,
 * });
 *
 * console.log(world.biomes[50][50]); // BiomeType at equator, center
 * ```
 */
export function generateWorld(options: WorldGenOptions): GeneratedWorld {
  const {
    seed, width, height, landRatio, octaves,
    numRegions, numCities, numTowns, numDungeons
  } = options;

  // Step 1: Generate heightmap
  const elevation = generateHeightmap(seed, width, height, {
    landRatio,
    octaves,
  });

  // Step 2: Generate climate (temperature + moisture)
  const climate = generateClimateMap(seed, width, height, elevation);

  // Step 3: Assign biomes
  const biomeMap = generateBiomeMap({
    width,
    height,
    temperature: climate.temperature,
    moisture: climate.moisture,
    elevation,
  });

  // Step 4: Generate Rivers
  // Convert moisture to precipitation (Float32Array)
  const precipitation = new Float32Array(width * height);
  for (let i = 0; i < width * height; i++) precipitation[i] = climate.moisture[i];

  const riverSystem = generateRivers({
    seed,
    width,
    height,
    elevation,
    precipitation
  });

  // Create raster river map from vector rivers
  const riverMap = new Uint8Array(width * height).fill(0);
  for (const river of riverSystem.rivers) {
    for (const p of river.path) {
      riverMap[p.y * width + p.x] = 1;
    }
  }

  // Step 5: Generate Regions
  const regionData = generateRegions({
    seed,
    width,
    height,
    elevation,
    biomes: biomeMap.biomes,
    numRegions
  });

  // Step 6: Place Structures
  const structures = placeStructures({
    seed,
    width,
    height,
    elevation,
    biomes: biomeMap.biomes,
    riverMap,
    numCities,
    numTowns,
    numDungeons
  });

  return {
    seed,
    width,
    height,
    elevation,
    temperature: climate.temperature,
    moisture: climate.moisture,
    biomes: biomeMap.biomes,
    rivers: riverMap,
    regions: regionData.regions,
    regionMap: regionData.regionMap,
    structures
  };
}

/**
 * Quick world generation with defaults
 *
 * @example
 * ```typescript
 * const world = quickWorld('seed123', 50, 50);
 * ```
 */
export function quickWorld(seed: string, width: number = 50, height: number = 50): GeneratedWorld {
  return generateWorld({ seed, width, height });
}
