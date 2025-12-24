import { placeStructures, StructureGenerationOptions } from '../../src/engine/worldgen/structures';
import { BiomeType } from '../../src/schema/biome';
import { StructureType } from '../../src/schema/structure';

describe('Structure Placement', () => {
    const width = 50;
    const height = 50;
    const size = width * height;

    // Mock inputs
    const elevation = new Uint8Array(size);
    const biomes: BiomeType[][] = Array.from({ length: height }, () => Array(width).fill(BiomeType.GRASSLAND));
    const riverMap = new Uint8Array(size).fill(0); // 0 = no river, 1 = river

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

    // Add a river
    for (let x = 0; x < width; x++) {
        riverMap[25 * width + x] = 1;
    }

    it('should be deterministic', () => {
        const options: StructureGenerationOptions = {
            seed: 'struct-seed',
            width,
            height,
            elevation,
            biomes,
            riverMap,
            numCities: 2,
            numTowns: 5,
            numDungeons: 3
        };

        const result1 = placeStructures(options);
        const result2 = placeStructures(options);

        expect(result1).toEqual(result2);
    });

    it('should place approximately the requested number of structures', () => {
        const options: StructureGenerationOptions = {
            seed: 'count-test',
            width,
            height,
            elevation,
            biomes,
            riverMap,
            numCities: 2,
            numTowns: 5,
            numDungeons: 3
        };

        const structures = placeStructures(options);

        const cities = structures.filter(s => s.type === StructureType.CITY);
        const towns = structures.filter(s => s.type === StructureType.TOWN);
        const dungeons = structures.filter(s => s.type === StructureType.DUNGEON);

        // Might fail if not enough valid spots, but for this map it should be fine
        expect(cities.length).toBeLessThanOrEqual(2);
        expect(cities.length).toBeGreaterThan(0);

        expect(towns.length).toBeLessThanOrEqual(5);
        expect(towns.length).toBeGreaterThan(0);

        expect(dungeons.length).toBeLessThanOrEqual(3);
        expect(dungeons.length).toBeGreaterThan(0);
    });

    it('should only place cities and towns on land', () => {
        const options: StructureGenerationOptions = {
            seed: 'land-test',
            width,
            height,
            elevation,
            biomes,
            riverMap,
            numCities: 5,
            numTowns: 10,
            numDungeons: 0
        };

        const structures = placeStructures(options);

        for (const s of structures) {
            const idx = s.location.y * width + s.location.x;
            expect(elevation[idx]).toBeGreaterThanOrEqual(20); // Assuming 20 is sea level
            expect(biomes[s.location.y][s.location.x]).not.toBe(BiomeType.OCEAN);
        }
    });

    it('should place dungeons in valid locations', () => {
        // Dungeons can be anywhere technically, but usually land or specific biomes
        // For now, just ensure they exist
        const options: StructureGenerationOptions = {
            seed: 'dungeon-test',
            width,
            height,
            elevation,
            biomes,
            riverMap,
            numCities: 0,
            numTowns: 0,
            numDungeons: 5
        };

        const structures = placeStructures(options);
        expect(structures.length).toBeGreaterThan(0);
    });
});
