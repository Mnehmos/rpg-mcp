/**
 * Tests for spawn_populated_location composite tool
 */
import * as fs from 'fs';
import { initDB } from '../../src/storage/db.js';
import { migrate } from '../../src/storage/migrations.js';
import { handleSpawnPopulatedLocation } from '../../src/server/composite-tools.js';
import { POIRepository } from '../../src/storage/repos/poi.repo.js';
import { SpatialRepository } from '../../src/storage/repos/spatial.repo.js';
import { CharacterRepository } from '../../src/storage/repos/character.repo.js';
import { ItemRepository } from '../../src/storage/repos/item.repo.js';

const TEST_DB_PATH = 'test-spawn-populated-location.db';

describe('spawn_populated_location', () => {
    let db: ReturnType<typeof initDB>;
    let poiRepo: POIRepository;
    let spatialRepo: SpatialRepository;
    let charRepo: CharacterRepository;
    let itemRepo: ItemRepository;

    beforeEach(() => {
        // Clean up any existing test DB
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }

        // Use file-based DB for tests (handler uses getDb which handles :memory: for NODE_ENV=test)
        process.env.NODE_ENV = 'test';
        db = initDB(TEST_DB_PATH);
        migrate(db);
        poiRepo = new POIRepository(db);
        spatialRepo = new SpatialRepository(db);
        charRepo = new CharacterRepository(db);
        itemRepo = new ItemRepository(db);
    });

    afterEach(() => {
        db.close();
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
    });

    const mockCtx = {
        sessionId: 'test-session',
        startedAt: new Date(),
        lastActiveAt: new Date()
    };

    describe('POI Creation', () => {
        it('creates a basic POI without rooms', async () => {
            const result = await handleSpawnPopulatedLocation({
                worldId: 'world-123',
                name: 'Ancient Monument',
                category: 'landmark',
                icon: 'monument',
                position: '50,30',
                description: 'An ancient monument marking a forgotten battle',
                tags: ['ancient', 'monument']
            }, mockCtx);

            const response = JSON.parse(result.content[0].text);
            expect(response.poi.name).toBe('Ancient Monument');
            expect(response.poi.category).toBe('landmark');
            expect(response.poi.icon).toBe('monument');
            expect(response.poi.position).toEqual({ x: 50, y: 30 });
            expect(response.network).toBeNull();
            expect(response.rooms).toHaveLength(0);
        });

        it('creates POI with object position', async () => {
            const result = await handleSpawnPopulatedLocation({
                worldId: 'world-123',
                name: 'Test Location',
                category: 'settlement',
                icon: 'village',
                position: { x: 100, y: 75 }
            }, mockCtx);

            const response = JSON.parse(result.content[0].text);
            expect(response.poi.position).toEqual({ x: 100, y: 75 });
        });

        it('creates POI with discovery settings', async () => {
            const result = await handleSpawnPopulatedLocation({
                worldId: 'world-123',
                name: 'Hidden Cave',
                category: 'hidden',
                icon: 'cave',
                position: '10,10',
                discoveryState: 'unknown',
                discoveryDC: 15
            }, mockCtx);

            const response = JSON.parse(result.content[0].text);
            expect(response.poi.discoveryState).toBe('unknown');
        });
    });

    describe('Room Network Creation', () => {
        it('creates room network with auto-linked rooms', async () => {
            const result = await handleSpawnPopulatedLocation({
                worldId: 'world-123',
                name: 'Small Dungeon',
                category: 'dungeon',
                icon: 'dungeon',
                position: '50,50',
                rooms: [
                    { name: 'Entrance Hall', description: 'A dusty entrance with cobwebs covering the walls.' },
                    { name: 'Guard Room', description: 'A small room with old weapon racks along the walls.' },
                    { name: 'Treasure Chamber', description: 'A chamber filled with glittering coins and gems.' }
                ]
            }, mockCtx);

            const response = JSON.parse(result.content[0].text);
            expect(response.network).not.toBeNull();
            expect(response.network.roomCount).toBe(3);
            expect(response.rooms).toHaveLength(3);
            expect(response.rooms[0].name).toBe('Entrance Hall');
        });

        it('uses specified biome for rooms', async () => {
            const result = await handleSpawnPopulatedLocation({
                worldId: 'world-123',
                name: 'Tavern',
                category: 'commercial',
                icon: 'inn',
                position: '50,50',
                rooms: [
                    { name: 'Common Room', description: 'A warm tavern common room with tables.', biome: 'urban' }
                ]
            }, mockCtx);

            const response = JSON.parse(result.content[0].text);
            expect(response.rooms).toHaveLength(1);
        });
    });

    describe('Inhabitant Spawning', () => {
        it('spawns creatures from templates', async () => {
            const result = await handleSpawnPopulatedLocation({
                worldId: 'world-123',
                name: 'Goblin Cave',
                category: 'dungeon',
                icon: 'cave',
                position: '50,50',
                rooms: [
                    { name: 'Cave Entrance', description: 'A dark cave entrance with wet stone.' }
                ],
                inhabitants: [
                    { template: 'goblin', room: 0, count: 2 }
                ]
            }, mockCtx);

            const response = JSON.parse(result.content[0].text);
            expect(response.inhabitants).toHaveLength(2);
            expect(response.inhabitants[0].name).toBe('Goblin 1');
            expect(response.inhabitants[1].name).toBe('Goblin 2');
        });

        it('spawns named NPCs', async () => {
            const result = await handleSpawnPopulatedLocation({
                worldId: 'world-123',
                name: 'Village Inn',
                category: 'commercial',
                icon: 'inn',
                position: '50,50',
                rooms: [
                    { name: 'Common Room', description: 'A warm common room with fireplace.' }
                ],
                inhabitants: [
                    { name: 'Bartholomew', race: 'Human', characterType: 'npc', room: 0 }
                ]
            }, mockCtx);

            const response = JSON.parse(result.content[0].text);
            expect(response.inhabitants).toHaveLength(1);
            expect(response.inhabitants[0].name).toBe('Bartholomew');
        });

        it('spawns boss creatures with custom names', async () => {
            const result = await handleSpawnPopulatedLocation({
                worldId: 'world-123',
                name: 'Dragon Lair',
                category: 'dungeon',
                icon: 'cave',
                position: '50,50',
                inhabitants: [
                    { template: 'hobgoblin:captain', name: 'Grishnak the Terrible' }
                ]
            }, mockCtx);

            const response = JSON.parse(result.content[0].text);
            expect(response.inhabitants[0].name).toBe('Grishnak the Terrible');
        });

        it('places inhabitants in correct rooms', async () => {
            const result = await handleSpawnPopulatedLocation({
                worldId: 'world-123',
                name: 'Bandit Hideout',
                category: 'dungeon',
                icon: 'cave',
                position: '50,50',
                rooms: [
                    { name: 'Entrance', description: 'A hidden entrance behind bushes.' },
                    { name: 'Barracks', description: 'Sleeping quarters with bedrolls.' }
                ],
                inhabitants: [
                    { template: 'bandit', room: 0 },
                    { template: 'bandit', room: 1, count: 3 }
                ]
            }, mockCtx);

            const response = JSON.parse(result.content[0].text);

            // Check room assignments
            const entranceInhabitants = response.inhabitants.filter((i: any) => i.roomName === 'Entrance');
            const barracksInhabitants = response.inhabitants.filter((i: any) => i.roomName === 'Barracks');

            expect(entranceInhabitants).toHaveLength(1);
            expect(barracksInhabitants).toHaveLength(3);
        });
    });

    describe('Loot Placement', () => {
        it('places loot items in rooms', async () => {
            const result = await handleSpawnPopulatedLocation({
                worldId: 'world-123',
                name: 'Treasure Vault',
                category: 'dungeon',
                icon: 'dungeon',
                position: '50,50',
                rooms: [
                    { name: 'Vault', description: 'A treasure vault with stone walls.' }
                ],
                loot: [
                    { preset: 'longsword', room: 0 },
                    { preset: 'potion_healing', room: 0, count: 3 }
                ]
            }, mockCtx);

            const response = JSON.parse(result.content[0].text);
            expect(response.loot).toHaveLength(2);
            expect(response.loot[0].name).toBe('Longsword');
            expect(response.loot[1].count).toBe(3);
        });
    });

    describe('Complete Location Setup', () => {
        it('creates a complete dungeon with rooms, creatures, and loot', async () => {
            const result = await handleSpawnPopulatedLocation({
                worldId: 'world-123',
                name: 'Shadowfang Cave',
                category: 'dungeon',
                icon: 'cave',
                position: '50,30',
                description: 'A dark cave system rumored to house goblin raiders',
                level: 3,
                tags: ['goblin', 'cave', 'treasure'],
                rooms: [
                    { name: 'Cave Entrance', description: 'A shadowy opening in the hillside with fresh tracks in the mud.', biome: 'cavern' },
                    { name: 'Guard Chamber', description: 'A small alcove where guards keep watch over the entrance.', biome: 'cavern' },
                    { name: 'Boss Lair', description: 'A larger chamber with crude furniture and stolen goods.', biome: 'cavern' }
                ],
                inhabitants: [
                    { template: 'goblin:warrior', room: 0, count: 2 },
                    { template: 'goblin:archer', room: 1 },
                    { template: 'hobgoblin:captain', name: 'Skullcrusher', room: 2 }
                ],
                loot: [
                    { preset: 'longsword', room: 2 },
                    { preset: 'potion_healing', room: 1, count: 2 }
                ]
            }, mockCtx);

            const response = JSON.parse(result.content[0].text);

            // Verify POI
            expect(response.poi.name).toBe('Shadowfang Cave');
            expect(response.poi.level).toBe(3);

            // Verify network and rooms
            expect(response.network.roomCount).toBe(3);
            expect(response.rooms).toHaveLength(3);

            // Verify inhabitants
            expect(response.summary.totalInhabitants).toBe(4); // 2 warriors + 1 archer + 1 captain
            expect(response.inhabitants.some((i: any) => i.name === 'Skullcrusher')).toBe(true);

            // Verify loot
            expect(response.summary.totalLootItems).toBe(3); // 1 sword + 2 potions

            // Verify message
            expect(response.message).toContain('Shadowfang Cave');
            expect(response.message).toContain('3 rooms');
            expect(response.message).toContain('4 inhabitants');
        });

        it('creates an inn with NPCs', async () => {
            const result = await handleSpawnPopulatedLocation({
                worldId: 'world-123',
                name: 'The Prancing Pony',
                category: 'commercial',
                icon: 'inn',
                position: '100,75',
                population: 15,
                discoveryState: 'discovered',
                rooms: [
                    { name: 'Common Room', description: 'A warm tavern with a crackling fireplace and several occupied tables.', biome: 'urban' },
                    { name: 'Kitchen', description: 'The busy kitchen smells of fresh bread and roasting meat.', biome: 'urban' }
                ],
                inhabitants: [
                    { name: 'Barliman Butterbur', race: 'Human', characterType: 'npc', room: 0 },
                    { template: 'bandit', name: 'Suspicious Stranger', characterType: 'neutral', room: 0 }
                ]
            }, mockCtx);

            const response = JSON.parse(result.content[0].text);

            expect(response.poi.population).toBe(15);
            expect(response.poi.discoveryState).toBe('discovered');
            expect(response.inhabitants).toHaveLength(2);
        });
    });

    describe('Edge Cases', () => {
        it('handles location without rooms, inhabitants, or loot', async () => {
            const result = await handleSpawnPopulatedLocation({
                worldId: 'world-123',
                name: 'Empty Landmark',
                category: 'landmark',
                icon: 'ruins',
                position: '50,50'
            }, mockCtx);

            const response = JSON.parse(result.content[0].text);
            expect(response.network).toBeNull();
            expect(response.rooms).toHaveLength(0);
            expect(response.inhabitants).toHaveLength(0);
            expect(response.loot).toHaveLength(0);
        });

        it('handles inhabitants without rooms (no placement)', async () => {
            const result = await handleSpawnPopulatedLocation({
                worldId: 'world-123',
                name: 'Wandering Monsters',
                category: 'natural',
                icon: 'unknown',
                position: '50,50',
                inhabitants: [
                    { template: 'wolf', count: 2 }
                ]
            }, mockCtx);

            const response = JSON.parse(result.content[0].text);
            expect(response.inhabitants).toHaveLength(2);
            expect(response.inhabitants[0].roomId).toBeUndefined();
        });
    });
});
