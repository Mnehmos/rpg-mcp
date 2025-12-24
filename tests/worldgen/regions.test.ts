import { generateRegions, RegionGenerationOptions } from '../../src/engine/worldgen/regions';
import { BiomeType } from '../../src/schema/biome';

describe('Region Generation', () => {
    const width = 50;
    const height = 50;
    const size = width * height;

    // Mock inputs
    const elevation = new Uint8Array(size);
    const biomes: BiomeType[][] = Array.from({ length: height }, () => Array(width).fill(BiomeType.GRASSLAND));

    // Create a simple island
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dx = x - width / 2;
            const dy = y - height / 2;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < 20) {
                elevation[y * width + x] = 50; // Land
            } else {
                elevation[y * width + x] = 10; // Ocean
                biomes[y][x] = BiomeType.OCEAN;
            }
        }
    }

    it('should be deterministic', () => {
        const options: RegionGenerationOptions = {
            seed: 'test-seed',
            width,
            height,
            elevation,
            biomes,
            numRegions: 5
        };

        const result1 = generateRegions(options);
        const result2 = generateRegions(options);

        expect(result1.regionMap).toEqual(result2.regionMap);
        expect(result1.regions).toEqual(result2.regions);
    });

    it('should generate the requested number of regions (approx)', () => {
        const options: RegionGenerationOptions = {
            seed: 'count-test',
            width,
            height,
            elevation,
            biomes,
            numRegions: 5
        };

        const result = generateRegions(options);
        // It might be slightly less if seeds land in ocean or merge, but should be close
        expect(result.regions.length).toBeGreaterThan(0);
        expect(result.regions.length).toBeLessThanOrEqual(5);
    });

    it('should assign every land tile to a region', () => {
        const options: RegionGenerationOptions = {
            seed: 'coverage-test',
            width,
            height,
            elevation,
            biomes,
            numRegions: 5
        };

        const result = generateRegions(options);
        const { regionMap } = result;

        for (let i = 0; i < size; i++) {
            if (elevation[i] >= 20) { // Land
                expect(regionMap[i]).toBeGreaterThanOrEqual(0);
            }
        }
    });

    it('should not assign ocean tiles to a region', () => {
        const options: RegionGenerationOptions = {
            seed: 'ocean-test',
            width,
            height,
            elevation,
            biomes,
            numRegions: 5
        };

        const result = generateRegions(options);
        const { regionMap } = result;

        for (let i = 0; i < size; i++) {
            if (elevation[i] < 20) { // Ocean
                expect(regionMap[i]).toBe(-1); // -1 for no region
            }
        }
    });
});
