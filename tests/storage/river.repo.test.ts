
import * as fs from 'fs';
import { initDB } from '../../src/storage/db';
import { migrate } from '../../src/storage/migrations';
import { RiverRepository } from '../../src/storage/repos/river.repo';
import { WorldRepository } from '../../src/storage/repos/world.repo';
import { World } from '../../src/schema/world';
import { RiverPath } from '../../src/schema/river';
import { FIXED_TIMESTAMP } from '../fixtures';

const TEST_DB_PATH = 'test-river-repo.db';

describe('RiverRepository', () => {
    let db: ReturnType<typeof initDB>;
    let repo: RiverRepository;
    let worldRepo: WorldRepository;

    beforeEach(() => {
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        db = initDB(TEST_DB_PATH);
        migrate(db);
        repo = new RiverRepository(db);
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

    it('should create and retrieve a river', () => {
        const river: RiverPath = {
            id: 'river-1',
            worldId: 'world-1',
            name: 'Great River',
            points: [{ x: 0, y: 100 }, { x: 50, y: 50 }, { x: 100, y: 0 }],
            width: 5,
            sourceElevation: 100,
            mouthElevation: 0,
        };

        repo.create(river);

        const retrieved = repo.findByWorldId('world-1');
        expect(retrieved).toHaveLength(1);
        expect(retrieved[0]).toEqual(river);
    });
});
