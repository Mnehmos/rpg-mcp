import seedrandom from 'seedrandom';
import { createNoise2D } from 'simplex-noise';

/**
 * Climate Generator
 *
 * Generates temperature and moisture maps based on:
 * - Latitude (equator hot, poles cold)
 * - Elevation (mountains colder)
 * - Ocean proximity (coasts wetter)
 * - Perlin noise for variation
 *
 * Reference: reference/AZGAAR_SNAPSHOT.md Section 3
 */

export interface ClimateOptions {
  seed: string;
  width: number;
  height: number;
  /** Heightmap for elevation-adjusted temperature */
  heightmap: number[][];
  /** Equator temperature in Celsius (default 30°C) */
  equatorTemp?: number;
  /** Pole temperature in Celsius (default -10°C) */
  poleTemp?: number;
  /** Temperature decrease per 10 elevation units (default 3°C) */
  elevationLapseRate?: number;
}

export interface ClimateMap {
  width: number;
  height: number;
  temperature: number[][]; // Celsius (-20 to 40°C)
  moisture: number[][]; // Percentage (0-100%)
  elevation: number[][]; // Reference to input heightmap
}

/**
 * Generate climate map (temperature + moisture)
 */
export function generateClimateMap(
  seed: string,
  width: number,
  height: number,
  heightmap: number[][]
): ClimateMap {
  const options: ClimateOptions = {
    seed,
    width,
    height,
    heightmap,
    equatorTemp: 30,
    poleTemp: -10,
    elevationLapseRate: 3,
  };

  const temperature = generateTemperatureMap(options);
  const moisture = generateMoistureMap(options);

  return {
    width,
    height,
    temperature,
    moisture,
    elevation: heightmap,
  };
}

/**
 * Generate temperature map
 *
 * Temperature = Base(latitude) - Elevation adjustment + Noise variation
 */
function generateTemperatureMap(options: ClimateOptions): number[][] {
  const { width, height, seed, heightmap, equatorTemp, poleTemp, elevationLapseRate } = options;

  const rng = seedrandom(seed + '-temp');
  const noise2D = createNoise2D(rng);

  const temperature: number[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 0)
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Base temperature from latitude
      // y=0 (north pole), y=height/2 (equator), y=height (south pole)
      const latitudeFactor = 1 - Math.abs(y - height / 2) / (height / 2);
      const baseTemp = poleTemp! + latitudeFactor * (equatorTemp! - poleTemp!);

      // Elevation adjustment (higher = colder)
      const elevation = heightmap[y][x];
      const SEA_LEVEL = 20;
      const elevationAboveSeaLevel = Math.max(0, elevation - SEA_LEVEL);
      const elevationAdjustment = -(elevationAboveSeaLevel / 10) * elevationLapseRate!;

      // Noise variation (±5°C)
      const noiseValue = noise2D(x / (width * 0.3), y / (height * 0.3));
      const noiseAdjustment = noiseValue * 5;

      // Combined temperature
      const temp = baseTemp + elevationAdjustment + noiseAdjustment;

      // Clamp to realistic range
      temperature[y][x] = Math.round(Math.max(-20, Math.min(40, temp)));
    }
  }

  return temperature;
}

/**
 * Generate moisture map
 *
 * Moisture = Ocean distance + Latitude (tropical wet) + Noise
 */
function generateMoistureMap(options: ClimateOptions): number[][] {
  const { width, height, seed, heightmap } = options;

  const rng = seedrandom(seed + '-moisture');
  const noise2D = createNoise2D(rng);

  const SEA_LEVEL = 20;

  // Calculate distance to ocean for each land cell
  const oceanDistance = calculateOceanDistance(heightmap, SEA_LEVEL);

  const moisture: number[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 0)
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const elevation = heightmap[y][x];

      // Ocean cells have high moisture
      if (elevation < SEA_LEVEL) {
        moisture[y][x] = 100;
        continue;
      }

      // Base moisture from ocean proximity (closer = wetter)
      const distance = oceanDistance[y][x];
      const maxDistance = Math.max(width, height) / 4;
      const proximityFactor = Math.max(0, 1 - distance / maxDistance);
      const baseMoisture = proximityFactor * 60; // 0-60% from proximity

      // Latitude factor (tropics wetter, poles drier)
      const latitudeFactor = 1 - Math.abs(y - height / 2) / (height / 2);
      const latitudeMoisture = latitudeFactor * 30; // 0-30% from latitude

      // Noise variation (±20%)
      const noiseValue = noise2D(x / (width * 0.25), y / (height * 0.25));
      const noiseAdjustment = noiseValue * 20;

      // Combined moisture
      const totalMoisture = baseMoisture + latitudeMoisture + noiseAdjustment;

      // Clamp to 0-100%
      moisture[y][x] = Math.round(Math.max(0, Math.min(100, totalMoisture)));
    }
  }

  return moisture;
}

/**
 * Calculate distance to nearest ocean for each cell
 *
 * Uses simple flood-fill BFS from ocean cells
 */
function calculateOceanDistance(heightmap: number[][], seaLevel: number): number[][] {
  const height = heightmap.length;
  const width = heightmap[0].length;

  const distance: number[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => Infinity)
  );

  // Queue for BFS: [x, y, distance]
  const queue: Array<[number, number, number]> = [];

  // Initialize with ocean cells
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (heightmap[y][x] < seaLevel) {
        distance[y][x] = 0;
        queue.push([x, y, 0]);
      }
    }
  }

  // BFS to propagate distance
  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  while (queue.length > 0) {
    const [x, y, dist] = queue.shift()!;

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const newDist = dist + 1;

        if (newDist < distance[ny][nx]) {
          distance[ny][nx] = newDist;
          queue.push([nx, ny, newDist]);
        }
      }
    }
  }

  return distance;
}
