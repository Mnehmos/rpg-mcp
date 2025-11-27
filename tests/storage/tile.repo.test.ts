
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
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
});
