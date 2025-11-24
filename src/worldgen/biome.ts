import { BiomeType } from '../schema/biome';

/**
 * Biome Mapper
 *
 * Assigns biomes based on temperature and moisture using a lookup table.
 * Inspired by Azgaar's biome matrix system (reference/AZGAAR_SNAPSHOT.md Section 2).
 *
 * System:
 * - 5 temperature bands (hot to cold)
 * - 26 moisture levels (dry to wet, 0-100% mapped to 0-25)
 * - Matrix lookup: biomeMatrix[tempBand][moistureLevel] → BiomeType
 */

export interface BiomeMapOptions {
  width: number;
  height: number;
  temperature: number[][]; // Celsius
  moisture: number[][]; // Percentage (0-100)
  elevation: number[][]; // For ocean detection
}

export interface BiomeMap {
  width: number;
  height: number;
  biomes: BiomeType[][];
  temperature: number[][];
  moisture: number[][];
}

/**
 * Temperature bands (Celsius)
 */
const TEMP_BANDS = [
  { min: 19, max: Infinity, index: 0 }, // Hot
  { min: 10, max: 19, index: 1 }, // Warm
  { min: 0, max: 10, index: 2 }, // Temperate
  { min: -10, max: 0, index: 3 }, // Cool
  { min: -Infinity, max: -10, index: 4 }, // Cold
];

/**
 * Biome Matrix: [tempBand][moistureLevel] → BiomeType
 *
 * Adapted from Azgaar's system:
 * - Band 0 (hottest, >19°C): Desert → Savanna → Rainforest → Wetland
 * - Band 1: Savanna → Grassland → Forest → Wetland
 * - Band 2: Grassland → Forest → Swamp
 * - Band 3: Grassland → Forest → Taiga
 * - Band 4 (coldest, <-10°C): Tundra → Glacier
 *
 * Moisture levels: 0 (dry) to 25 (wet)
 */
const BIOME_MATRIX: BiomeType[][] = [
  // Band 0: Hot (>19°C)
  [
    BiomeType.DESERT, // 0-3% moisture
    BiomeType.DESERT,
    BiomeType.DESERT,
    BiomeType.DESERT,
    BiomeType.SAVANNA, // 4-10%
    BiomeType.SAVANNA,
    BiomeType.SAVANNA,
    BiomeType.SAVANNA,
    BiomeType.SAVANNA,
    BiomeType.SAVANNA,
    BiomeType.SAVANNA,
    BiomeType.FOREST, // 11-15% (dry forest)
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.RAINFOREST, // 16-22% (tropical rainforest)
    BiomeType.RAINFOREST,
    BiomeType.RAINFOREST,
    BiomeType.RAINFOREST,
    BiomeType.RAINFOREST,
    BiomeType.RAINFOREST,
    BiomeType.RAINFOREST,
    BiomeType.SWAMP, // 23-25% (very wet)
    BiomeType.SWAMP,
    BiomeType.SWAMP,
  ],

  // Band 1: Warm (10-19°C)
  [
    BiomeType.SAVANNA, // 0-2%
    BiomeType.SAVANNA,
    BiomeType.SAVANNA,
    BiomeType.GRASSLAND, // 3-10%
    BiomeType.GRASSLAND,
    BiomeType.GRASSLAND,
    BiomeType.GRASSLAND,
    BiomeType.GRASSLAND,
    BiomeType.GRASSLAND,
    BiomeType.GRASSLAND,
    BiomeType.GRASSLAND,
    BiomeType.FOREST, // 11-20%
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.SWAMP, // 21-25%
    BiomeType.SWAMP,
    BiomeType.SWAMP,
    BiomeType.SWAMP,
    BiomeType.SWAMP,
  ],

  // Band 2: Temperate (0-10°C)
  [
    BiomeType.GRASSLAND, // 0%
    BiomeType.GRASSLAND, // 1-5%
    BiomeType.GRASSLAND,
    BiomeType.GRASSLAND,
    BiomeType.GRASSLAND,
    BiomeType.GRASSLAND,
    BiomeType.FOREST, // 6-18%
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.TAIGA, // 19-22%
    BiomeType.TAIGA,
    BiomeType.TAIGA,
    BiomeType.TAIGA,
    BiomeType.SWAMP, // 23-25%
    BiomeType.SWAMP,
    BiomeType.SWAMP,
  ],

  // Band 3: Cool (-10 to 0°C)
  [
    BiomeType.GRASSLAND, // 0-5%
    BiomeType.GRASSLAND,
    BiomeType.GRASSLAND,
    BiomeType.GRASSLAND,
    BiomeType.GRASSLAND,
    BiomeType.GRASSLAND,
    BiomeType.FOREST, // 6-10%
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.FOREST,
    BiomeType.TAIGA, // 11-22%
    BiomeType.TAIGA,
    BiomeType.TAIGA,
    BiomeType.TAIGA,
    BiomeType.TAIGA,
    BiomeType.TAIGA,
    BiomeType.TAIGA,
    BiomeType.TAIGA,
    BiomeType.TAIGA,
    BiomeType.TAIGA,
    BiomeType.TAIGA,
    BiomeType.TAIGA,
    BiomeType.SWAMP, // 23-25%
    BiomeType.SWAMP,
    BiomeType.SWAMP,
  ],

  // Band 4: Cold (<-10°C)
  [
    BiomeType.TUNDRA, // 0-17%
    BiomeType.TUNDRA,
    BiomeType.TUNDRA,
    BiomeType.TUNDRA,
    BiomeType.TUNDRA,
    BiomeType.TUNDRA,
    BiomeType.TUNDRA,
    BiomeType.TUNDRA,
    BiomeType.TUNDRA,
    BiomeType.TUNDRA,
    BiomeType.TUNDRA,
    BiomeType.TUNDRA,
    BiomeType.TUNDRA,
    BiomeType.TUNDRA,
    BiomeType.TUNDRA,
    BiomeType.TUNDRA,
    BiomeType.TUNDRA,
    BiomeType.TUNDRA,
    BiomeType.GLACIER, // 18-25%
    BiomeType.GLACIER,
    BiomeType.GLACIER,
    BiomeType.GLACIER,
    BiomeType.GLACIER,
    BiomeType.GLACIER,
    BiomeType.GLACIER,
    BiomeType.GLACIER,
  ],
];

/**
 * Generate biome map from climate data
 */
export function generateBiomeMap(options: BiomeMapOptions): BiomeMap {
  const { width, height, temperature, moisture, elevation } = options;

  const SEA_LEVEL = 20;

  const biomes: BiomeType[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => BiomeType.OCEAN)
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Ocean biome for water cells
      if (elevation[y][x] < SEA_LEVEL) {
        biomes[y][x] = BiomeType.OCEAN;
        continue;
      }

      // Land biome based on temperature and moisture
      const temp = temperature[y][x];
      const moist = moisture[y][x];

      const tempBand = getTempBand(temp);
      const moistureLevel = getMoistureLevel(moist);

      biomes[y][x] = BIOME_MATRIX[tempBand][moistureLevel];
    }
  }

  return {
    width,
    height,
    biomes,
    temperature,
    moisture,
  };
}

/**
 * Get temperature band index (0-4)
 */
function getTempBand(temperature: number): number {
  for (const band of TEMP_BANDS) {
    if (temperature >= band.min && temperature < band.max) {
      return band.index;
    }
  }

  // Fallback to temperate
  return 2;
}

/**
 * Get moisture level index (0-25)
 *
 * Maps 0-100% moisture to 0-25 index
 */
function getMoistureLevel(moisture: number): number {
  const level = Math.floor((moisture / 100) * 26);
  return Math.min(25, Math.max(0, level));
}
