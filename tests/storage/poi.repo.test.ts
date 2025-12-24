/**
 * POI Repository Tests
 *
 * Tests for POI (Point of Interest) persistence and queries.
 */

import * as fs from 'fs';
import { initDB } from '../../src/storage/db.js';
import { migrate } from '../../src/storage/migrations.js';
import { POIRepository } from '../../src/storage/repos/poi.repo.js';
import { WorldRepository } from '../../src/storage/repos/world.repo.js';
import { POI } from '../../src/schema/poi.js';
import { World } from '../../src/schema/world.js';

const TEST_DB_PATH = 'test-poi-repo.db';

describe('POIRepository', () => {
    let db: ReturnType<typeof initDB>;
    let repo: POIRepository;
    let worldRepo: WorldRepository;
    let testWorldId: string;

    beforeEach(() => {
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        db = initDB(TEST_DB_PATH);
        migrate(db);
        repo = new POIRepository(db);
        worldRepo = new WorldRepository(db);

        // Create test world
        testWorldId = 'test-world-1';
        const world: World = {
            id: testWorldId,
            name: 'Test World',
            seed: 'test-seed',
            width: 100,
            height: 100,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        worldRepo.create(world);
    });

    afterEach(() => {
        db.close();
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
    });

    function createTestPOI(overrides: Partial<POI> = {}): POI {
        return {
            id: crypto.randomUUID(),
            worldId: testWorldId,
            x: 50,
            y: 50,
            name: 'Test POI',
            category: 'settlement',
            icon: 'town',
            discoveryState: 'unknown',
            discoveredBy: [],
            childPOIIds: [],
            population: 100,
            tags: ['test'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            ...overrides
        };
    }

    describe('CRUD Operations', () => {
        it('creates and retrieves a POI', () => {
            const poi = createTestPOI({ name: 'Riverside Town' });
            repo.create(poi);

            const retrieved = repo.findById(poi.id);
            expect(retrieved).not.toBeNull();
            expect(retrieved!.name).toBe('Riverside Town');
            expect(retrieved!.x).toBe(50);
            expect(retrieved!.y).toBe(50);
            expect(retrieved!.category).toBe('settlement');
        });

        it('finds POI by coordinates', () => {
            const poi = createTestPOI({ x: 25, y: 75 });
            repo.create(poi);

            const found = repo.findByCoordinates(testWorldId, 25, 75);
            expect(found).not.toBeNull();
            expect(found!.id).toBe(poi.id);
        });

        it('finds POIs by world', () => {
            repo.create(createTestPOI({ name: 'POI 1', x: 10, y: 10 }));
            repo.create(createTestPOI({ name: 'POI 2', x: 20, y: 20 }));
            repo.create(createTestPOI({ name: 'POI 3', x: 30, y: 30 }));

            const pois = repo.findByWorldId(testWorldId);
            expect(pois).toHaveLength(3);
        });

        it('updates a POI', () => {
            const poi = createTestPOI({ population: 100 });
            repo.create(poi);

            const updated = repo.update(poi.id, { population: 500, name: 'Growing Town' });
            expect(updated).not.toBeNull();
            expect(updated!.population).toBe(500);
            expect(updated!.name).toBe('Growing Town');
        });

        it('deletes a POI', () => {
            const poi = createTestPOI();
            repo.create(poi);

            const deleted = repo.delete(poi.id);
            expect(deleted).toBe(true);

            const retrieved = repo.findById(poi.id);
            expect(retrieved).toBeNull();
        });
    });

    describe('Discovery Operations', () => {
        it('marks POI as discovered by character', () => {
            const poi = createTestPOI({ discoveryState: 'unknown' });
            repo.create(poi);

            const characterId = crypto.randomUUID();
            const updated = repo.discoverPOI(poi.id, characterId);

            expect(updated).not.toBeNull();
            expect(updated!.discoveryState).toBe('discovered');
            expect(updated!.discoveredBy).toContain(characterId);
        });

        it('does not duplicate discoverer', () => {
            const poi = createTestPOI();
            repo.create(poi);

            const characterId = crypto.randomUUID();
            repo.discoverPOI(poi.id, characterId);
            repo.discoverPOI(poi.id, characterId);

            const retrieved = repo.findById(poi.id);
            expect(retrieved!.discoveredBy.filter(id => id === characterId)).toHaveLength(1);
        });

        it('finds POIs discovered by character', () => {
            const characterId = crypto.randomUUID();

            const poi1 = createTestPOI({ name: 'Discovered', x: 10, y: 10 });
            const poi2 = createTestPOI({ name: 'Not Discovered', x: 20, y: 20 });
            repo.create(poi1);
            repo.create(poi2);

            repo.discoverPOI(poi1.id, characterId);

            const discovered = repo.findDiscoveredByCharacter(testWorldId, characterId);
            expect(discovered).toHaveLength(1);
            expect(discovered[0].name).toBe('Discovered');
        });

        it('finds POIs by discovery state', () => {
            repo.create(createTestPOI({ name: 'Unknown 1', discoveryState: 'unknown', x: 1, y: 1 }));
            repo.create(createTestPOI({ name: 'Unknown 2', discoveryState: 'unknown', x: 2, y: 2 }));
            repo.create(createTestPOI({ name: 'Discovered', discoveryState: 'discovered', x: 3, y: 3 }));

            const unknown = repo.findByDiscoveryState(testWorldId, 'unknown');
            expect(unknown).toHaveLength(2);

            const discovered = repo.findByDiscoveryState(testWorldId, 'discovered');
            expect(discovered).toHaveLength(1);
        });
    });

    describe('Spatial Queries', () => {
        it('finds POIs in bounding box', () => {
            repo.create(createTestPOI({ name: 'Inside', x: 25, y: 25 }));
            repo.create(createTestPOI({ name: 'Outside', x: 75, y: 75 }));

            const found = repo.findInBoundingBox(testWorldId, 0, 50, 0, 50);
            expect(found).toHaveLength(1);
            expect(found[0].name).toBe('Inside');
        });

        it('finds POIs nearby', () => {
            repo.create(createTestPOI({ name: 'Close', x: 52, y: 52 }));
            repo.create(createTestPOI({ name: 'Far', x: 90, y: 90 }));

            const nearby = repo.findNearby(testWorldId, 50, 50, 10);
            expect(nearby).toHaveLength(1);
            expect(nearby[0].name).toBe('Close');
        });

        it('finds nearest POI', () => {
            repo.create(createTestPOI({ name: 'Far', x: 90, y: 90 }));
            repo.create(createTestPOI({ name: 'Near', x: 55, y: 55 }));
            repo.create(createTestPOI({ name: 'Medium', x: 70, y: 70 }));

            const nearest = repo.findNearest(testWorldId, 50, 50);
            expect(nearest).not.toBeNull();
            expect(nearest!.name).toBe('Near');
        });
    });

    describe('Category Queries', () => {
        it('finds POIs by category', () => {
            repo.create(createTestPOI({ name: 'Town', category: 'settlement', x: 10, y: 10 }));
            repo.create(createTestPOI({ name: 'Castle', category: 'fortification', x: 20, y: 20 }));
            repo.create(createTestPOI({ name: 'Dungeon', category: 'dungeon', x: 30, y: 30 }));

            const settlements = repo.findByCategory(testWorldId, 'settlement');
            expect(settlements).toHaveLength(1);
            expect(settlements[0].name).toBe('Town');
        });
    });

    describe('Linking Operations', () => {
        it('links POI to network', () => {
            const poi = createTestPOI();
            repo.create(poi);

            const networkId = crypto.randomUUID();
            const entranceRoomId = crypto.randomUUID();

            const updated = repo.linkToNetwork(poi.id, networkId, entranceRoomId);
            expect(updated).not.toBeNull();
            expect(updated!.networkId).toBe(networkId);
            expect(updated!.entranceRoomId).toBe(entranceRoomId);
        });

        it('links POI to structure', () => {
            const poi = createTestPOI();
            repo.create(poi);

            const structureId = crypto.randomUUID();
            const updated = repo.linkToStructure(poi.id, structureId);

            expect(updated).not.toBeNull();
            expect(updated!.structureId).toBe(structureId);
        });

        it('finds POI by network ID', () => {
            const networkId = crypto.randomUUID();
            const poi = createTestPOI({ networkId });
            repo.create(poi);

            const found = repo.findByNetworkId(networkId);
            expect(found).not.toBeNull();
            expect(found!.id).toBe(poi.id);
        });

        it('adds child POIs', () => {
            const parent = createTestPOI({ name: 'Dungeon', x: 10, y: 10 });
            const child1 = createTestPOI({ name: 'Level 1', x: 10, y: 11 });
            const child2 = createTestPOI({ name: 'Level 2', x: 10, y: 12 });

            repo.create(parent);
            repo.create(child1);
            repo.create(child2);

            repo.addChildPOI(parent.id, child1.id);
            repo.addChildPOI(parent.id, child2.id);

            const updatedParent = repo.findById(parent.id);
            expect(updatedParent!.childPOIIds).toHaveLength(2);
            expect(updatedParent!.childPOIIds).toContain(child1.id);
            expect(updatedParent!.childPOIIds).toContain(child2.id);

            const updatedChild = repo.findById(child1.id);
            expect(updatedChild!.parentPOIId).toBe(parent.id);
        });
    });

    describe('Search & Filter', () => {
        it('finds POIs by tag', () => {
            repo.create(createTestPOI({ name: 'Goblin Cave', tags: ['goblin', 'cave'], x: 10, y: 10 }));
            repo.create(createTestPOI({ name: 'Orc Camp', tags: ['orc', 'camp'], x: 20, y: 20 }));

            const goblins = repo.findByTag(testWorldId, 'goblin');
            expect(goblins).toHaveLength(1);
            expect(goblins[0].name).toBe('Goblin Cave');
        });

        it('searches POIs by name', () => {
            repo.create(createTestPOI({ name: 'Dragon\'s Lair', x: 10, y: 10 }));
            repo.create(createTestPOI({ name: 'Dragonstone Castle', x: 20, y: 20 }));
            repo.create(createTestPOI({ name: 'Riverside Town', x: 30, y: 30 }));

            const dragons = repo.search(testWorldId, 'dragon');
            expect(dragons).toHaveLength(2);
        });
    });

    describe('Batch Operations', () => {
        it('creates multiple POIs in a single transaction', () => {
            const pois = [
                createTestPOI({ name: 'Capital City', category: 'settlement', icon: 'city', x: 50, y: 50, population: 50000 }),
                createTestPOI({ name: 'Harbor Town', category: 'settlement', icon: 'town', x: 10, y: 80, population: 5000 }),
                createTestPOI({ name: 'Dark Dungeon', category: 'dungeon', icon: 'dungeon', x: 70, y: 30, population: 0, level: 5 }),
                createTestPOI({ name: 'Ancient Temple', category: 'religious', icon: 'temple', x: 30, y: 60 }),
            ];

            const count = repo.createBatch(pois);
            expect(count).toBe(4);

            const retrieved = repo.findByWorldId(testWorldId);
            expect(retrieved).toHaveLength(4);
        });

        it('returns 0 for empty array', () => {
            const count = repo.createBatch([]);
            expect(count).toBe(0);
        });

        it('validates POIs during batch creation', () => {
            const invalidPois = [
                {
                    ...createTestPOI({ name: 'Invalid' }),
                    category: 'invalid_category' // Invalid category
                }
            ];

            expect(() => repo.createBatch(invalidPois as POI[])).toThrow();
        });
    });

    describe('deleteByWorldId', () => {
        it('deletes all POIs for a world', () => {
            const pois = [
                createTestPOI({ name: 'POI 1', x: 10, y: 10 }),
                createTestPOI({ name: 'POI 2', x: 20, y: 20 }),
                createTestPOI({ name: 'POI 3', x: 30, y: 30 }),
            ];
            repo.createBatch(pois);

            expect(repo.findByWorldId(testWorldId)).toHaveLength(3);

            const deleted = repo.deleteByWorldId(testWorldId);
            expect(deleted).toBe(3);
            expect(repo.findByWorldId(testWorldId)).toHaveLength(0);
        });

        it('returns 0 when no POIs exist', () => {
            const deleted = repo.deleteByWorldId('nonexistent-world');
            expect(deleted).toBe(0);
        });
    });
});
