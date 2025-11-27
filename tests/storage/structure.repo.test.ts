
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { initDB } from '../../src/storage/db';
import { migrate } from '../../src/storage/migrations';
import { StructureRepository } from '../../src/storage/repos/structure.repo';
import { WorldRepository } from '../../src/storage/repos/world.repo';
import { Structure, StructureType } from '../../src/schema/structure';
import { World } from '../../src/schema/world';
import { FIXED_TIMESTAMP } from '../fixtures';

const TEST_DB_PATH = 'test-structure-repo.db';

describe('StructureRepository', () => {
    let db: ReturnType<typeof initDB>;
    let repo: StructureRepository;
    let worldRepo: WorldRepository;

    beforeEach(() => {
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        db = initDB(TEST_DB_PATH);
        migrate(db);
        repo = new StructureRepository(db);
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

    it('should create and retrieve a structure', () => {
        const structure: Structure = {
            id: 'struct-1',
            worldId: 'world-1',
            name: 'Castle Black',
            type: StructureType.CASTLE,
            x: 50,
            y: 50,
            population: 100,
            createdAt: FIXED_TIMESTAMP,
            updatedAt: FIXED_TIMESTAMP,
        };

        repo.create(structure);

        const retrieved = repo.findByWorldId('world-1');
        expect(retrieved).toHaveLength(1);
        expect(retrieved[0]).toEqual(structure);
    });

    it('should find structures by worldId', () => {
        const s1: Structure = {
            id: 's1',
            worldId: 'world-1',
            name: 'Town 1',
            type: StructureType.TOWN,
            x: 10,
            y: 10,
            population: 500,
            createdAt: FIXED_TIMESTAMP,
            updatedAt: FIXED_TIMESTAMP,
        };
        const s2: Structure = {
            id: 's2',
            worldId: 'world-1',
            name: 'Village 1',
            type: StructureType.VILLAGE,
            x: 20,
            y: 20,
            population: 50,
            createdAt: FIXED_TIMESTAMP,
            updatedAt: FIXED_TIMESTAMP,
        };

        repo.create(s1);
        repo.create(s2);

        const structures = repo.findByWorldId('world-1');
        expect(structures).toHaveLength(2);
        expect(structures).toContainEqual(s1);
        expect(structures).toContainEqual(s2);
    });
});
