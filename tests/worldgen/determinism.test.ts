import { generateWorld } from '../../src/engine/worldgen/index';

describe('World Generation Determinism', () => {
    it('should generate identical worlds from the same seed', () => {
        const seed = 'determinism-test-123';
        const width = 50;
        const height = 50;
        const options = {
            seed,
            width,
            height,
            numRegions: 5,
            numCities: 3,
            numTowns: 5,
            numDungeons: 3
        };

        const world1 = generateWorld(options);
        const world2 = generateWorld(options);

        // Check elevation
        expect(world1.elevation).toEqual(world2.elevation);

        // Check temperature
        expect(world1.temperature).toEqual(world2.temperature);

        // Check moisture
        expect(world1.moisture).toEqual(world2.moisture);

        // Check biomes
        expect(world1.biomes).toEqual(world2.biomes);

        // Check rivers
        expect(world1.rivers).toEqual(world2.rivers);

        // Check regions
        expect(world1.regionMap).toEqual(world2.regionMap);
        expect(world1.regions).toEqual(world2.regions);

        // Check structures
        expect(world1.structures).toEqual(world2.structures);
    });

    it('should generate different worlds from different seeds', () => {
        const width = 50;
        const height = 50;

        const world1 = generateWorld({ seed: 'seed-a', width, height });
        const world2 = generateWorld({ seed: 'seed-b', width, height });

        // At least one component should be different
        const elevationDifferent = !world1.elevation.every((v, i) => v === world2.elevation[i]);
        const biomeDifferent = JSON.stringify(world1.biomes) !== JSON.stringify(world2.biomes);

        expect(elevationDifferent || biomeDifferent).toBe(true);
    });
});
