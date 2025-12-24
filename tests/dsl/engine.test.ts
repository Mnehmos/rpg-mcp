import { applyPatch } from '../../src/engine/dsl/engine';
import { CommandType } from '../../src/engine/dsl/schema';
import { StructureType } from '../../src/schema/structure';
import { BiomeType } from '../../src/schema/biome';
import { GeneratedWorld } from '../../src/engine/worldgen/index';

describe('Patch Engine', () => {
    let world: GeneratedWorld;

    beforeEach(() => {
        // Create a minimal mock world
        const width = 10;
        const height = 10;
        world = {
            seed: 'test',
            width,
            height,
            elevation: new Uint8Array(width * height).fill(100),
            temperature: new Int8Array(width * height).fill(20),
            moisture: new Uint8Array(width * height).fill(50),
            biomes: Array(height).fill(null).map(() => Array(width).fill(BiomeType.GRASSLAND)),
            rivers: new Uint8Array(width * height).fill(0),
            regions: [],
            regionMap: new Int32Array(width * height).fill(-1),
            structures: []
        };
    });

    it('should apply ADD_STRUCTURE command', () => {
        const command = {
            command: CommandType.ADD_STRUCTURE,
            args: {
                type: StructureType.CITY,
                x: 5,
                y: 5,
                name: 'Test City'
            }
        } as const;

        applyPatch(world, [command]);

        expect(world.structures).toHaveLength(1);
        expect(world.structures[0]).toEqual({
            type: StructureType.CITY,
            location: { x: 5, y: 5 },
            name: 'Test City',
            score: 100
        });
    });

    it('should apply SET_BIOME command', () => {
        const command = {
            command: CommandType.SET_BIOME,
            args: {
                x: 0,
                y: 0,
                type: BiomeType.DESERT
            }
        } as const;

        applyPatch(world, [command]);

        expect(world.biomes[0][0]).toBe(BiomeType.DESERT);
    });

    it('should apply EDIT_TILE command', () => {
        const command = {
            command: CommandType.EDIT_TILE,
            args: {
                x: 1,
                y: 1,
                elevation: 200,
                temperature: 30
            }
        } as const;

        applyPatch(world, [command]);

        const idx = 1 * world.width + 1;
        expect(world.elevation[idx]).toBe(200);
        expect(world.temperature[idx]).toBe(30);
        expect(world.moisture[idx]).toBe(50); // Unchanged
    });

    it('should apply MOVE_STRUCTURE command', () => {
        // Setup initial structure
        world.structures.push({
            type: StructureType.TOWN,
            location: { x: 2, y: 2 },
            name: 'Old Town',
            score: 50
        });

        const command = {
            command: CommandType.MOVE_STRUCTURE,
            args: {
                id: 'Old Town',
                x: 8,
                y: 8
            }
        } as const;

        applyPatch(world, [command]);

        expect(world.structures[0].location).toEqual({ x: 8, y: 8 });
    });

    it('should return error when moving non-existent structure', () => {
        const command = {
            command: CommandType.MOVE_STRUCTURE,
            args: {
                id: 'Ghost Town',
                x: 5,
                y: 5
            }
        } as const;

        const result = applyPatch(world, [command]);
        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0].message).toBe('Structure not found: Ghost Town');
    });

    it('should ignore out-of-bounds coordinates for tile edits', () => {
        const command = {
            command: CommandType.EDIT_TILE,
            args: {
                x: 999,
                y: 999,
                elevation: 0
            }
        } as const;

        // Should not throw, just ignore
        applyPatch(world, [command]);
    });
});
