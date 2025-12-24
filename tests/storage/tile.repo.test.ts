
import * as fs from 'fs';
import { initDB } from '../../src/storage/db';
import { migrate } from '../../src/storage/migrations';
import { TileRepository } from '../../src/storage/repos/tile.repo';
import { WorldRepository } from '../../src/storage/repos/world.repo';
import { World } from '../../src/schema/world';
import { Tile } from '../../src/schema/tile';
import { FIXED_TIMESTAMP } from '../fixtures';

const TEST_DB_PATH = 'test-tile-repo.db';

describe('TileRepository', () => {
    let db: ReturnType<typeof initDB>;
    let repo: TileRepository;
    let worldRepo: WorldRepository;

    beforeEach(() => {
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        db = initDB(TEST_DB_PATH);
        migrate(db);
        repo = new TileRepository(db);
        worldRepo = new WorldRepository(db);

        const world: World = {
            id: 'world-1',
            name: 'Test World',
            seed: 'seed-1',
            width: 100,
            height: 100,
            createdAt: FIXED_TIMESTAMP,
            updatedAt: FIXED_TIMESTAMP,
        };
        worldRepo.create(world);
    });

    afterEach(() => {
        db.close();
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
    });

    it('should create and retrieve a tile', () => {
        const tile: Tile = {
            id: 'tile-0-0',
            worldId: 'world-1',
            x: 0,
            y: 0,
            biome: 'forest',
            elevation: 10,
            moisture: 0.5,
            temperature: 20,
        };

        repo.create(tile);

        const retrieved = repo.findByCoordinates('world-1', 0, 0);
        expect(retrieved).toEqual(tile);
    });

    it('should find tiles by worldId', () => {
        const t1: Tile = {
            id: 't1',
            worldId: 'world-1',
            x: 0,
            y: 0,
            biome: 'plains',
            elevation: 5,
            moisture: 0.4,
            temperature: 25,
        };
        const t2: Tile = {
            id: 't2',
            worldId: 'world-1',
            x: 1,
            y: 0,
            biome: 'mountain',
            elevation: 80,
            moisture: 0.1,
            temperature: 10,
        };

        repo.create(t1);
        repo.create(t2);

        const tiles = repo.findByWorldId('world-1');
        expect(tiles).toHaveLength(2);
    });

    describe('createBatch', () => {
        it('should create multiple tiles in a single transaction', () => {
            const tiles: Tile[] = [];
            for (let i = 0; i < 100; i++) {
                tiles.push({
                    id: `batch-tile-${i}`,
                    worldId: 'world-1',
                    x: i % 10,
                    y: Math.floor(i / 10),
                    biome: 'forest',
                    elevation: 50,
                    moisture: 0.5,
                    temperature: 20,
                });
            }

            const count = repo.createBatch(tiles);
            expect(count).toBe(100);

            const retrieved = repo.findByWorldId('world-1');
            expect(retrieved).toHaveLength(100);
        });

        it('should return 0 for empty array', () => {
            const count = repo.createBatch([]);
            expect(count).toBe(0);
        });

        it('should validate tiles during batch creation', () => {
            const invalidTiles = [
                {
                    id: 'invalid-tile',
                    worldId: 'world-1',
                    x: 0,
                    y: 0,
                    biome: 'forest',
                    elevation: 50,
                    moisture: 2.0, // Invalid: > 1
                    temperature: 20,
                }
            ];

            expect(() => repo.createBatch(invalidTiles as Tile[])).toThrow();
        });
    });

    describe('createFromWorldgen', () => {
        it('should create tiles from worldgen arrays', () => {
            const width = 10;
            const height = 10;
            const biomes: string[][] = [];
            const elevation = new Uint8Array(width * height);
            const moisture = new Uint8Array(width * height);
            const temperature = new Int8Array(width * height);

            // Initialize arrays
            for (let y = 0; y < height; y++) {
                biomes[y] = [];
                for (let x = 0; x < width; x++) {
                    const idx = y * width + x;
                    biomes[y][x] = 'grassland';
                    elevation[idx] = 50 + (x % 10);
                    moisture[idx] = 50; // 50% (will be converted to 0.5)
                    temperature[idx] = 20;
                }
            }

            const count = repo.createFromWorldgen(
                'world-1',
                width,
                height,
                biomes,
                elevation,
                moisture,
                temperature
            );

            expect(count).toBe(100);

            // Verify a specific tile
            const tile = repo.findByCoordinates('world-1', 5, 5);
            expect(tile).not.toBeNull();
            expect(tile?.biome).toBe('grassland');
            expect(tile?.elevation).toBe(55); // 50 + (5 % 10)
            expect(tile?.moisture).toBe(0.5); // 50 / 100
            expect(tile?.temperature).toBe(20);
        });

        it('should use custom id prefix', () => {
            const biomes = [['desert']];
            const elevation = new Uint8Array([30]);
            const moisture = new Uint8Array([10]);
            const temperature = new Int8Array([35]);

            repo.createFromWorldgen(
                'world-1', 1, 1,
                biomes, elevation, moisture, temperature,
                'custom'
            );

            const tile = repo.findByCoordinates('world-1', 0, 0);
            expect(tile?.id).toBe('custom-world-1-0-0');
        });
    });

    describe('deleteByWorldId', () => {
        it('should delete all tiles for a world', () => {
            const tiles: Tile[] = [
                { id: 't1', worldId: 'world-1', x: 0, y: 0, biome: 'forest', elevation: 50, moisture: 0.5, temperature: 20 },
                { id: 't2', worldId: 'world-1', x: 1, y: 0, biome: 'forest', elevation: 50, moisture: 0.5, temperature: 20 },
                { id: 't3', worldId: 'world-1', x: 2, y: 0, biome: 'forest', elevation: 50, moisture: 0.5, temperature: 20 },
            ];
            repo.createBatch(tiles);

            expect(repo.findByWorldId('world-1')).toHaveLength(3);

            const deleted = repo.deleteByWorldId('world-1');
            expect(deleted).toBe(3);
            expect(repo.findByWorldId('world-1')).toHaveLength(0);
        });

        it('should return 0 when no tiles exist', () => {
            const deleted = repo.deleteByWorldId('nonexistent-world');
            expect(deleted).toBe(0);
        });
    });
});
