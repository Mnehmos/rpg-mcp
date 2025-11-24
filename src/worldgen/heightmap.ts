import seedrandom from 'seedrandom';
import { createNoise2D } from 'simplex-noise';

/**
 * Heightmap Generator
 *
 * Generates deterministic heightmaps using layered Perlin/Simplex noise.
 * Inspired by Azgaar's heightmap-generator.js but implemented independently.
 *
 * Reference: reference/AZGAAR_SNAPSHOT.md Section 1
 */

export interface HeightmapOptions {
  /** Seed for deterministic generation */
  seed: string;
  /** Width of heightmap grid */
  width: number;
  /** Height of heightmap grid */
  height: number;
  /** Number of octaves (noise layers) for detail */
  octaves?: number;
  /** Persistence (amplitude decay per octave) */
  persistence?: number;
  /** Lacunarity (frequency increase per octave) */
  lacunarity?: number;
  /** Land ratio target (0-1, default 0.3 for ~30% land) */
  landRatio?: number;
}

export interface Heightmap {
  width: number;
  height: number;
  /** 2D array of elevation values (0-100) */
  data: number[][];
  /** Sea level threshold (typically 20) */
  seaLevel: number;
}

/**
 * Generate a heightmap from a seed
 */
export function generateHeightmap(
  seed: string,
  width: number,
  height: number,
  options?: Partial<HeightmapOptions>
): number[][] {
  const opts: HeightmapOptions = {
    seed,
    width,
    height,
    octaves: options?.octaves ?? 6,
    persistence: options?.persistence ?? 0.5,
    lacunarity: options?.lacunarity ?? 2.0,
    landRatio: options?.landRatio ?? 0.3,
  };

  // Create seeded RNG
  const rng = seedrandom(seed);

  // Create noise function with seeded RNG
  const noise2D = createNoise2D(rng);

  // Generate base heightmap
  const heightmap = generateLayeredNoise(noise2D, opts);

  // Normalize to target land ratio
  const normalized = normalizeHeightmap(heightmap, opts.landRatio!);

  return normalized;
}

/**
 * Generate layered noise heightmap
 */
function generateLayeredNoise(
  noise2D: (x: number, y: number) => number,
  options: HeightmapOptions
): number[][] {
  const { width, height, octaves, persistence, lacunarity } = options;

  const heightmap: number[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 0)
  );

  let maxAmplitude = 0;

  // Accumulate octaves
  for (let octave = 0; octave < octaves!; octave++) {
    const frequency = Math.pow(lacunarity!, octave);
    const amplitude = Math.pow(persistence!, octave);
    maxAmplitude += amplitude;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        // Scale coordinates by frequency
        const nx = (x / width) * frequency;
        const ny = (y / height) * frequency;

        // Sample noise (-1 to 1)
        const sample = noise2D(nx, ny);

        // Accumulate with amplitude
        heightmap[y][x] += sample * amplitude;
      }
    }
  }

  // Normalize to 0-1 range
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Noise is in range [-maxAmplitude, maxAmplitude]
      // Normalize to [0, 1]
      heightmap[y][x] = (heightmap[y][x] + maxAmplitude) / (2 * maxAmplitude);
    }
  }

  return heightmap;
}

/**
 * Normalize heightmap to achieve target land ratio
 *
 * Adjusts elevation distribution so that approximately `landRatio` of cells
 * are above sea level (20).
 */
function normalizeHeightmap(heightmap: number[][], targetLandRatio: number): number[][] {
  const height = heightmap.length;
  const width = heightmap[0].length;
  const SEA_LEVEL = 20;

  // Collect all elevations
  const elevations: number[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      elevations.push(heightmap[y][x]);
    }
  }

  // Sort to find percentile
  elevations.sort((a, b) => a - b);

  // Find elevation that represents sea level (1 - landRatio percentile)
  const seaLevelIndex = Math.floor((1 - targetLandRatio) * elevations.length);
  const seaLevelValue = elevations[seaLevelIndex];

  // Create normalized map
  const normalized: number[][] = Array.from({ length: height }, () =>
    Array.from({ length: width }, () => 0)
  );

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const rawValue = heightmap[y][x];

      // Map [0, seaLevelValue] → [0, SEA_LEVEL]
      // Map [seaLevelValue, 1] → [SEA_LEVEL, 100]
      let normalizedValue;

      if (rawValue <= seaLevelValue) {
        // Below sea level
        normalizedValue = (rawValue / seaLevelValue) * SEA_LEVEL;
      } else {
        // Above sea level
        const landRange = 100 - SEA_LEVEL;
        const rawLandRange = 1 - seaLevelValue;
        normalizedValue = SEA_LEVEL + ((rawValue - seaLevelValue) / rawLandRange) * landRange;
      }

      // Clamp and round to integer
      normalized[y][x] = Math.round(Math.max(0, Math.min(100, normalizedValue)));
    }
  }

  return normalized;
}

/**
 * Add ridges/tectonic features to heightmap
 *
 * Inspired by Azgaar's "Range" primitive for mountain ranges.
 */
export function addRidges(
  heightmap: number[][],
  rng: seedrandom.PRNG,
  count: number = 3
): number[][] {
  const height = heightmap.length;
  const width = heightmap[0].length;

  // Create copy
  const result = heightmap.map((row) => [...row]);

  for (let i = 0; i < count; i++) {
    // Random ridge line
    const startX = Math.floor(rng() * width);
    const startY = Math.floor(rng() * height);
    const angle = rng() * Math.PI * 2;

    const length = Math.floor(width * 0.3 + rng() * width * 0.4);
    const ridgeHeight = 40 + rng() * 30;
    const ridgeWidth = 3 + Math.floor(rng() * 5);

    // Draw ridge line
    for (let step = 0; step < length; step++) {
      const x = Math.floor(startX + Math.cos(angle) * step);
      const y = Math.floor(startY + Math.sin(angle) * step);

      if (x < 0 || x >= width || y < 0 || y >= height) continue;

      // Add elevation in a radius around the line
      for (let dy = -ridgeWidth; dy <= ridgeWidth; dy++) {
        for (let dx = -ridgeWidth; dx <= ridgeWidth; dx++) {
          const nx = x + dx;
          const ny = y + dy;

          if (nx < 0 || nx >= width || ny < 0 || ny >= height) continue;

          const distance = Math.sqrt(dx * dx + dy * dy);
          const falloff = Math.max(0, 1 - distance / ridgeWidth);
          const elevation = ridgeHeight * falloff;

          result[ny][nx] = Math.min(100, result[ny][nx] + elevation);
        }
      }
    }
  }

  return result;
}

/**
 * Smooth heightmap to reduce jaggedness
 *
 * Applies a simple averaging filter.
 */
export function smoothHeightmap(heightmap: number[][], iterations: number = 1): number[][] {
  let result = heightmap.map((row) => [...row]);

  for (let iter = 0; iter < iterations; iter++) {
    const temp = result.map((row) => [...row]);

    for (let y = 1; y < result.length - 1; y++) {
      for (let x = 1; x < result[0].length - 1; x++) {
        // Average with 8 neighbors
        const sum =
          result[y - 1][x - 1] +
          result[y - 1][x] +
          result[y - 1][x + 1] +
          result[y][x - 1] +
          result[y][x] +
          result[y][x + 1] +
          result[y + 1][x - 1] +
          result[y + 1][x] +
          result[y + 1][x + 1];

        temp[y][x] = Math.round(sum / 9);
      }
    }

    result = temp;
  }

  return result;
}
