
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

    describe('createBatch', () => {
        it('should create multiple structures in a single transaction', () => {
            const structures: Structure[] = [
                { id: 'b1', worldId: 'world-1', name: 'City 1', type: StructureType.CITY, x: 10, y: 10, population: 10000, createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP },
                { id: 'b2', worldId: 'world-1', name: 'Town 1', type: StructureType.TOWN, x: 20, y: 20, population: 2000, createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP },
                { id: 'b3', worldId: 'world-1', name: 'Village 1', type: StructureType.VILLAGE, x: 30, y: 30, population: 100, createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP },
                { id: 'b4', worldId: 'world-1', name: 'Dungeon 1', type: StructureType.DUNGEON, x: 40, y: 40, population: 0, createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP },
            ];

            const count = repo.createBatch(structures);
            expect(count).toBe(4);

            const retrieved = repo.findByWorldId('world-1');
            expect(retrieved).toHaveLength(4);
        });

        it('should return 0 for empty array', () => {
            const count = repo.createBatch([]);
            expect(count).toBe(0);
        });
    });

    describe('findById', () => {
        it('should find a structure by id', () => {
            const structure: Structure = {
                id: 'find-me',
                worldId: 'world-1',
                name: 'Findable Castle',
                type: StructureType.CASTLE,
                x: 50,
                y: 50,
                population: 500,
                createdAt: FIXED_TIMESTAMP,
                updatedAt: FIXED_TIMESTAMP,
            };
            repo.create(structure);

            const found = repo.findById('find-me');
            expect(found).not.toBeNull();
            expect(found?.name).toBe('Findable Castle');
        });

        it('should return null for non-existent id', () => {
            const found = repo.findById('nonexistent');
            expect(found).toBeNull();
        });
    });

    describe('findByCoordinates', () => {
        it('should find structure at coordinates', () => {
            const structure: Structure = {
                id: 'coord-struct',
                worldId: 'world-1',
                name: 'Located Town',
                type: StructureType.TOWN,
                x: 75,
                y: 25,
                population: 1000,
                createdAt: FIXED_TIMESTAMP,
                updatedAt: FIXED_TIMESTAMP,
            };
            repo.create(structure);

            const found = repo.findByCoordinates('world-1', 75, 25);
            expect(found).not.toBeNull();
            expect(found?.name).toBe('Located Town');
        });

        it('should return null for empty coordinates', () => {
            const found = repo.findByCoordinates('world-1', 99, 99);
            expect(found).toBeNull();
        });
    });

    describe('findByType', () => {
        it('should find structures by type', () => {
            const structures: Structure[] = [
                { id: 't1', worldId: 'world-1', name: 'Town A', type: StructureType.TOWN, x: 10, y: 10, population: 1000, createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP },
                { id: 't2', worldId: 'world-1', name: 'Town B', type: StructureType.TOWN, x: 20, y: 20, population: 2000, createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP },
                { id: 't3', worldId: 'world-1', name: 'City A', type: StructureType.CITY, x: 30, y: 30, population: 10000, createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP },
            ];
            repo.createBatch(structures);

            const towns = repo.findByType('world-1', StructureType.TOWN);
            expect(towns).toHaveLength(2);
            expect(towns.every(s => s.type === StructureType.TOWN)).toBe(true);

            const cities = repo.findByType('world-1', StructureType.CITY);
            expect(cities).toHaveLength(1);
        });
    });

    describe('deleteByWorldId', () => {
        it('should delete all structures for a world', () => {
            const structures: Structure[] = [
                { id: 'd1', worldId: 'world-1', name: 'Town A', type: StructureType.TOWN, x: 10, y: 10, population: 1000, createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP },
                { id: 'd2', worldId: 'world-1', name: 'Town B', type: StructureType.TOWN, x: 20, y: 20, population: 2000, createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP },
            ];
            repo.createBatch(structures);

            expect(repo.findByWorldId('world-1')).toHaveLength(2);

            const deleted = repo.deleteByWorldId('world-1');
            expect(deleted).toBe(2);
            expect(repo.findByWorldId('world-1')).toHaveLength(0);
        });

        it('should return 0 when no structures exist', () => {
            const deleted = repo.deleteByWorldId('nonexistent-world');
            expect(deleted).toBe(0);
        });
    });
});
