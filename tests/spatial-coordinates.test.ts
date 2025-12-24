/**
 * Spatial Coordinate System Tests
 *
 * Tests integration of world map coordinates with node networks and room nodes.
 * Enables rooms to have world positions, belong to networks (towns, roads),
 * and have travel metadata for navigation.
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { closeDb, getDb } from '../src/storage/index.js';
import { SpatialRepository } from '../src/storage/repos/spatial.repo.js';
import { RoomNode, NodeNetwork, TravelTerrain } from '../src/schema/spatial.js';

const mockCtx = { sessionId: 'test-session' };

describe('Spatial Coordinate System', () => {
    let db: Database.Database;
    let spatialRepo: SpatialRepository;

    beforeEach(() => {
        closeDb();
        db = getDb(':memory:');
        spatialRepo = new SpatialRepository(db);
    });

    describe('Category 1: RoomNode Local Coordinates', () => {
        it('1.1: Room can have local coordinates within its network', () => {
            const town = createNodeNetwork({
                name: 'Bree',
                type: 'cluster',
                worldId: 'world-1',
                centerX: 10,
                centerY: 20
            });

            const tavern = createRoom({
                name: 'The Prancing Pony',
                networkId: town.id,
                localX: 0,
                localY: 0,
                biomeContext: 'urban'
            });

            const retrieved = spatialRepo.findById(tavern.id);
            expect(retrieved?.localX).toBe(0);
            expect(retrieved?.localY).toBe(0);
            expect(retrieved?.networkId).toBe(town.id);
        });

        it('1.2: Room coordinates are optional (for abstract/standalone rooms)', () => {
            const dreamscape = createRoom({
                name: 'Ethereal Dreamscape',
                biomeContext: 'arcane'
                // No localX/localY or networkId - abstract location
            });

            const retrieved = spatialRepo.findById(dreamscape.id);
            expect(retrieved?.localX).toBeUndefined();
            expect(retrieved?.localY).toBeUndefined();
            expect(retrieved?.networkId).toBeUndefined();
        });

        it('1.3: Multiple rooms can share same local coordinates (multi-level buildings)', () => {
            const town = createNodeNetwork({
                name: 'Neverwinter',
                type: 'cluster',
                worldId: 'world-1',
                centerX: 25,
                centerY: 25
            });

            const groundFloor = createRoom({
                name: 'Tavern - Ground Floor',
                networkId: town.id,
                localX: 5,
                localY: 5,
                biomeContext: 'urban'
            });

            const secondFloor = createRoom({
                name: 'Tavern - Second Floor',
                networkId: town.id,
                localX: 5,
                localY: 5,
                biomeContext: 'urban'
            });

            expect(groundFloor.localX).toBe(secondFloor.localX);
            expect(groundFloor.localY).toBe(secondFloor.localY);
            expect(groundFloor.networkId).toBe(secondFloor.networkId);
        });

        it('1.4: Rooms within network use local coordinate system', () => {
            const city = createNodeNetwork({
                name: 'Waterdeep',
                type: 'cluster',
                worldId: 'world-1',
                centerX: 100,
                centerY: 100
            });

            const mainGate = createRoom({
                name: 'Main Gate',
                networkId: city.id,
                localX: 0,
                localY: 0,
                biomeContext: 'urban'
            });

            const castleDistrict = createRoom({
                name: 'Castle District',
                networkId: city.id,
                localX: 10,
                localY: 10,
                biomeContext: 'urban'
            });

            // Local coordinates are relative to network, not world tiles
            expect(mainGate.localX).toBe(0);
            expect(castleDistrict.localX).toBe(10);
        });
    });

    describe('Category 2: NodeNetwork - Cluster Type (Towns/Dungeons)', () => {
        it('2.1: Can create a cluster node network for a town', () => {
            const waterdeep = createNodeNetwork({
                name: 'Waterdeep',
                type: 'cluster',
                worldId: 'world-1',
                centerX: 50,
                centerY: 50
            });

            const retrieved = spatialRepo.findNetworkById(waterdeep.id);
            expect(retrieved?.name).toBe('Waterdeep');
            expect(retrieved?.type).toBe('cluster');
            expect(retrieved?.centerX).toBe(50);
            expect(retrieved?.centerY).toBe(50);
        });

        it('2.2: Cluster network can have bounding box for large areas', () => {
            const baldursGate = createNodeNetwork({
                name: "Baldur's Gate",
                type: 'cluster',
                worldId: 'world-1',
                centerX: 100,
                centerY: 100,
                boundingBox: {
                    minX: 98,
                    maxX: 102,
                    minY: 98,
                    maxY: 102
                }
            });

            const retrieved = spatialRepo.findNetworkById(baldursGate.id);
            expect(retrieved?.boundingBox).toBeDefined();
            expect(retrieved?.boundingBox?.minX).toBe(98);
            expect(retrieved?.boundingBox?.maxX).toBe(102);
        });

        it('2.3: Rooms can belong to a node network', () => {
            const waterdeep = createNodeNetwork({
                name: 'Waterdeep',
                type: 'cluster',
                worldId: 'world-1',
                centerX: 50,
                centerY: 50
            });

            const tavern = createRoom({
                name: 'Yawning Portal',
                networkId: waterdeep.id,
                localX: 0,
                localY: 0,
                biomeContext: 'urban'
            });

            const market = createRoom({
                name: 'Market Square',
                networkId: waterdeep.id,
                localX: 1,
                localY: 0,
                biomeContext: 'urban'
            });

            expect(tavern.networkId).toBe(waterdeep.id);
            expect(market.networkId).toBe(waterdeep.id);
        });

        it('2.4: Can query all rooms in a network', () => {
            const dungeon = createNodeNetwork({
                name: 'Undermountain',
                type: 'cluster',
                worldId: 'world-1',
                centerX: 50,
                centerY: 49
            });

            const room1 = createRoom({
                name: 'Entrance Chamber',
                networkId: dungeon.id,
                biomeContext: 'dungeon'
            });

            const room2 = createRoom({
                name: 'Goblin Lair',
                networkId: dungeon.id,
                biomeContext: 'dungeon'
            });

            const room3 = createRoom({
                name: 'Separate Cave',
                // No networkId - not part of dungeon
                biomeContext: 'cavern'
            });

            const dungeonRooms = spatialRepo.findRoomsByNetwork(dungeon.id);
            expect(dungeonRooms).toHaveLength(2);
            expect(dungeonRooms.map(r => r.id)).toContain(room1.id);
            expect(dungeonRooms.map(r => r.id)).toContain(room2.id);
            expect(dungeonRooms.map(r => r.id)).not.toContain(room3.id);
        });
    });

    describe('Category 3: NodeNetwork - Linear Type (Roads/Paths)', () => {
        it('3.1: Can create a linear node network for a road', () => {
            const kingsRoad = createNodeNetwork({
                name: "King's Road",
                type: 'linear',
                worldId: 'world-1',
                centerX: 50,
                centerY: 50
            });

            const retrieved = spatialRepo.findNetworkById(kingsRoad.id);
            expect(retrieved?.name).toBe("King's Road");
            expect(retrieved?.type).toBe('linear');
        });

        it('3.2: Linear network rooms form a path with local coordinates', () => {
            const road = createNodeNetwork({
                name: 'Trade Route',
                type: 'linear',
                worldId: 'world-1',
                centerX: 30,
                centerY: 30
            });

            const waypoint1 = createRoom({
                name: 'Northern Crossroads',
                networkId: road.id,
                localX: 0,
                localY: 0,
                biomeContext: 'forest'
            });

            const waypoint2 = createRoom({
                name: 'Midway Inn',
                networkId: road.id,
                localX: 0,
                localY: 5,
                biomeContext: 'urban'
            });

            const waypoint3 = createRoom({
                name: 'Southern Bridge',
                networkId: road.id,
                localX: 0,
                localY: 10,
                biomeContext: 'coastal'
            });

            // Verify linear progression
            const roadRooms = spatialRepo.findRoomsByNetwork(road.id);
            expect(roadRooms).toHaveLength(3);

            // Should form a north-south line in local coordinates
            const yCoords = roadRooms.map(r => r.localY!).sort((a, b) => a - b);
            expect(yCoords).toEqual([0, 5, 10]);
        });
    });

    describe('Category 4: Exit Travel Metadata', () => {
        it('4.1: Exit can have travel time in minutes', () => {
            const tavern = createRoom({
                name: 'Tavern',
                biomeContext: 'urban'
            });

            const market = createRoom({
                name: 'Market',
                biomeContext: 'urban'
            });

            // Add exit with travel metadata
            spatialRepo.addExit(tavern.id, {
                direction: 'north',
                targetNodeId: market.id,
                type: 'OPEN',
                travelTime: 5,
                terrain: 'paved',
                description: 'A cobblestone street leads north to the market'
            });

            const updated = spatialRepo.findById(tavern.id);
            expect(updated?.exits).toHaveLength(1);
            expect(updated?.exits[0].travelTime).toBe(5);
            expect(updated?.exits[0].terrain).toBe('paved');
        });

        it('4.2: Different terrains affect travel', () => {
            const camp = createRoom({
                name: 'Base Camp',
                biomeContext: 'forest'
            });

            const cave = createRoom({
                name: 'Hidden Cave',
                biomeContext: 'cavern'
            });

            spatialRepo.addExit(camp.id, {
                direction: 'east',
                targetNodeId: cave.id,
                type: 'HIDDEN',
                dc: 15,
                travelTime: 30,
                terrain: 'wilderness',
                difficulty: 12,
                description: 'A barely visible trail winds through dense undergrowth'
            });

            const updated = spatialRepo.findById(camp.id);
            expect(updated?.exits[0].terrain).toBe('wilderness');
            expect(updated?.exits[0].travelTime).toBe(30); // Slower than paved
            expect(updated?.exits[0].difficulty).toBe(12);
        });

        it('4.3: Indoor exits have minimal travel time', () => {
            const hallway = createRoom({
                name: 'Hallway',
                biomeContext: 'dungeon'
            });

            const chamber = createRoom({
                name: 'Chamber',
                biomeContext: 'dungeon'
            });

            spatialRepo.addExit(hallway.id, {
                direction: 'west',
                targetNodeId: chamber.id,
                type: 'OPEN',
                travelTime: 0,
                terrain: 'indoor',
                description: 'A doorway to the west'
            });

            const updated = spatialRepo.findById(hallway.id);
            expect(updated?.exits[0].terrain).toBe('indoor');
            expect(updated?.exits[0].travelTime).toBe(0);
        });

        it('4.4: Locked exits can still have travel metadata', () => {
            const gate = createRoom({
                name: 'City Gate',
                biomeContext: 'urban'
            });

            const outside = createRoom({
                name: 'Outside Walls',
                biomeContext: 'forest'
            });

            spatialRepo.addExit(gate.id, {
                direction: 'north',
                targetNodeId: outside.id,
                type: 'LOCKED',
                dc: 18,
                travelTime: 2,
                terrain: 'paved',
                description: 'Heavy iron gates bar the exit'
            });

            const updated = spatialRepo.findById(gate.id);
            expect(updated?.exits[0].type).toBe('LOCKED');
            expect(updated?.exits[0].travelTime).toBe(2);
        });
    });

    describe('Category 5: Coordinate-based Queries for Networks', () => {
        it('5.1: Can find rooms by local coordinates within a network', () => {
            const town = createNodeNetwork({
                name: 'Neverwinter',
                type: 'cluster',
                worldId: 'world-1',
                centerX: 10,
                centerY: 10
            });

            const tavern1 = createRoom({
                name: 'Tavern Ground Floor',
                networkId: town.id,
                localX: 5,
                localY: 5,
                biomeContext: 'urban'
            });

            const tavern2 = createRoom({
                name: 'Tavern Upper Floor',
                networkId: town.id,
                localX: 5,
                localY: 5,
                biomeContext: 'urban'
            });

            const market = createRoom({
                name: 'Market',
                networkId: town.id,
                localX: 6,
                localY: 5,
                biomeContext: 'urban'
            });

            const roomsAt5_5 = spatialRepo.findRoomsByLocalCoordinates(town.id, 5, 5);
            expect(roomsAt5_5).toHaveLength(2);
            expect(roomsAt5_5.map(r => r.id)).toContain(tavern1.id);
            expect(roomsAt5_5.map(r => r.id)).toContain(tavern2.id);
            expect(roomsAt5_5.map(r => r.id)).not.toContain(market.id);
        });

        it('5.2: Can find networks in bounding box (area search)', () => {
            const north = createNodeNetwork({
                name: 'Northern City',
                type: 'cluster',
                worldId: 'world-1',
                centerX: 50,
                centerY: 48
            });

            const center = createNodeNetwork({
                name: 'Central City',
                type: 'cluster',
                worldId: 'world-1',
                centerX: 50,
                centerY: 50
            });

            const south = createNodeNetwork({
                name: 'Southern City',
                type: 'cluster',
                worldId: 'world-1',
                centerX: 50,
                centerY: 52
            });

            const farAway = createNodeNetwork({
                name: 'Distant Tower',
                type: 'cluster',
                worldId: 'world-1',
                centerX: 100,
                centerY: 100
            });

            const networksInArea = spatialRepo.findNetworksInBoundingBox(48, 52, 48, 52);
            expect(networksInArea).toHaveLength(3);
            expect(networksInArea.map(n => n.id)).not.toContain(farAway.id);
        });

        it('5.3: Can find nearest network to world coordinates', () => {
            const north = createNodeNetwork({
                name: 'Northern Outpost',
                type: 'cluster',
                worldId: 'world-1',
                centerX: 50,
                centerY: 45
            });

            const center = createNodeNetwork({
                name: 'Central Keep',
                type: 'cluster',
                worldId: 'world-1',
                centerX: 50,
                centerY: 50
            });

            const south = createNodeNetwork({
                name: 'Southern Watch',
                type: 'cluster',
                worldId: 'world-1',
                centerX: 50,
                centerY: 60
            });

            // Find nearest to (50, 47) - should be north (distance 2)
            // north at (50, 45) distance = 2
            // center at (50, 50) distance = 3
            // south at (50, 60) distance = 13
            const nearest = spatialRepo.findNearestNetwork(50, 47);
            expect(nearest?.id).toBe(north.id);
        });
    });

    describe('Category 6: Network-based Navigation', () => {
        it('6.1: Can get network center coordinates', () => {
            const network = createNodeNetwork({
                name: 'Neverwinter',
                type: 'cluster',
                worldId: 'world-1',
                centerX: 75,
                centerY: 75
            });

            const retrieved = spatialRepo.findNetworkById(network.id);
            expect(retrieved?.centerX).toBe(75);
            expect(retrieved?.centerY).toBe(75);
        });

        it('6.2: Network can determine if coordinates are within bounds', () => {
            const network = createNodeNetwork({
                name: 'Large City',
                type: 'cluster',
                worldId: 'world-1',
                centerX: 100,
                centerY: 100,
                boundingBox: {
                    minX: 95,
                    maxX: 105,
                    minY: 95,
                    maxY: 105
                }
            });

            const retrieved = spatialRepo.findNetworkById(network.id);

            // Helper to check if point is in network bounds
            const isInBounds = (x: number, y: number) => {
                if (!retrieved?.boundingBox) return false;
                return x >= retrieved.boundingBox.minX &&
                       x <= retrieved.boundingBox.maxX &&
                       y >= retrieved.boundingBox.minY &&
                       y <= retrieved.boundingBox.maxY;
            };

            expect(isInBounds(100, 100)).toBe(true); // Center
            expect(isInBounds(95, 95)).toBe(true);   // Corner
            expect(isInBounds(90, 90)).toBe(false);  // Outside
        });

        it('6.3: Can list all networks at a world coordinate', () => {
            const city = createNodeNetwork({
                name: 'City',
                type: 'cluster',
                worldId: 'world-1',
                centerX: 50,
                centerY: 50,
                boundingBox: { minX: 48, maxX: 52, minY: 48, maxY: 52 }
            });

            const road = createNodeNetwork({
                name: 'Highway',
                type: 'linear',
                worldId: 'world-1',
                centerX: 50,
                centerY: 50
            });

            const networksAt50_50 = spatialRepo.findNetworksAtCoordinates(50, 50);
            expect(networksAt50_50).toHaveLength(2);
            expect(networksAt50_50.map(n => n.id)).toContain(city.id);
            expect(networksAt50_50.map(n => n.id)).toContain(road.id);
        });
    });

    // Helper functions
    function createRoom(overrides: Partial<RoomNode> = {}): RoomNode {
        const now = new Date().toISOString();
        const room: RoomNode = {
            id: uuidv4(),
            name: overrides.name || 'Test Room',
            baseDescription: overrides.baseDescription || 'A test room for coordinate testing.',
            biomeContext: overrides.biomeContext || 'urban',
            atmospherics: overrides.atmospherics || [],
            exits: overrides.exits || [],
            entityIds: overrides.entityIds || [],
            createdAt: now,
            updatedAt: now,
            visitedCount: 0,
            localX: overrides.localX,
            localY: overrides.localY,
            networkId: overrides.networkId,
            ...overrides
        };
        spatialRepo.create(room);
        return room;
    }

    function createNodeNetwork(overrides: Partial<NodeNetwork> = {}): NodeNetwork {
        const now = new Date().toISOString();
        const network: NodeNetwork = {
            id: uuidv4(),
            name: overrides.name || 'Test Network',
            type: overrides.type || 'cluster',
            worldId: overrides.worldId || 'test-world',
            centerX: overrides.centerX || 0,
            centerY: overrides.centerY || 0,
            boundingBox: overrides.boundingBox,
            createdAt: now,
            updatedAt: now,
            ...overrides
        };
        spatialRepo.createNetwork(network);
        return network;
    }
});
