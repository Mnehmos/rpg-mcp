import Database from 'better-sqlite3';
import { RoomNode, RoomNodeSchema, Exit, NodeNetwork, NodeNetworkSchema } from '../../schema/spatial.js';

export class SpatialRepository {
    constructor(private db: Database.Database) { }

    create(room: RoomNode): void {
        const validRoom = RoomNodeSchema.parse(room);

        const stmt = this.db.prepare(`
            INSERT INTO room_nodes (
                id, name, base_description, biome_context, atmospherics,
                exits, entity_ids, created_at, updated_at, visited_count, last_visited_at,
                world_x, world_y, network_id
            )
            VALUES (
                @id, @name, @baseDescription, @biomeContext, @atmospherics,
                @exits, @entityIds, @createdAt, @updatedAt, @visitedCount, @lastVisitedAt,
                @worldX, @worldY, @networkId
            )
        `);

        stmt.run({
            id: validRoom.id,
            name: validRoom.name,
            baseDescription: validRoom.baseDescription,
            biomeContext: validRoom.biomeContext,
            atmospherics: JSON.stringify(validRoom.atmospherics),
            exits: JSON.stringify(validRoom.exits),
            entityIds: JSON.stringify(validRoom.entityIds),
            createdAt: validRoom.createdAt,
            updatedAt: validRoom.updatedAt,
            visitedCount: validRoom.visitedCount,
            lastVisitedAt: validRoom.lastVisitedAt || null,
            worldX: validRoom.worldX !== undefined ? validRoom.worldX : null,
            worldY: validRoom.worldY !== undefined ? validRoom.worldY : null,
            networkId: validRoom.networkId || null,
        });
    }

    findById(id: string): RoomNode | null {
        const stmt = this.db.prepare('SELECT * FROM room_nodes WHERE id = ?');
        const row = stmt.get(id) as RoomNodeRow | undefined;

        if (!row) return null;
        return this.rowToRoomNode(row);
    }

    findAll(): RoomNode[] {
        const stmt = this.db.prepare('SELECT * FROM room_nodes ORDER BY name');
        const rows = stmt.all() as RoomNodeRow[];
        return rows.map(row => this.rowToRoomNode(row));
    }

    findByBiome(biome: string): RoomNode[] {
        const stmt = this.db.prepare('SELECT * FROM room_nodes WHERE biome_context = ? ORDER BY name');
        const rows = stmt.all(biome) as RoomNodeRow[];
        return rows.map(row => this.rowToRoomNode(row));
    }

    update(id: string, updates: Partial<RoomNode>): RoomNode | null {
        const existing = this.findById(id);
        if (!existing) return null;

        const updated = {
            ...existing,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        // Validate full object
        const validRoom = RoomNodeSchema.parse(updated);

        const stmt = this.db.prepare(`
            UPDATE room_nodes
            SET name = ?, base_description = ?, biome_context = ?,
                atmospherics = ?, exits = ?, entity_ids = ?,
                visited_count = ?, last_visited_at = ?, updated_at = ?,
                world_x = ?, world_y = ?, network_id = ?
            WHERE id = ?
        `);

        stmt.run(
            validRoom.name,
            validRoom.baseDescription,
            validRoom.biomeContext,
            JSON.stringify(validRoom.atmospherics),
            JSON.stringify(validRoom.exits),
            JSON.stringify(validRoom.entityIds),
            validRoom.visitedCount,
            validRoom.lastVisitedAt || null,
            validRoom.updatedAt,
            validRoom.worldX !== undefined ? validRoom.worldX : null,
            validRoom.worldY !== undefined ? validRoom.worldY : null,
            validRoom.networkId || null,
            id
        );

        return validRoom;
    }

    delete(id: string): boolean {
        const stmt = this.db.prepare('DELETE FROM room_nodes WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    // Helper methods for entity management
    addEntityToRoom(roomId: string, entityId: string): void {
        const room = this.findById(roomId);
        if (!room) throw new Error(`Room ${roomId} not found`);

        if (!room.entityIds.includes(entityId)) {
            room.entityIds.push(entityId);
            this.update(roomId, { entityIds: room.entityIds });
        }
    }

    removeEntityFromRoom(roomId: string, entityId: string): void {
        const room = this.findById(roomId);
        if (!room) throw new Error(`Room ${roomId} not found`);

        room.entityIds = room.entityIds.filter(id => id !== entityId);
        this.update(roomId, { entityIds: room.entityIds });
    }

    getEntitiesInRoom(roomId: string): string[] {
        const room = this.findById(roomId);
        if (!room) return [];
        return room.entityIds;
    }

    // Helper methods for exit management
    addExit(roomId: string, exit: Exit): void {
        const room = this.findById(roomId);
        if (!room) throw new Error(`Room ${roomId} not found`);

        room.exits.push(exit);
        this.update(roomId, { exits: room.exits });
    }

    findConnectedRooms(roomId: string): RoomNode[] {
        const room = this.findById(roomId);
        if (!room) return [];

        const connectedRooms: RoomNode[] = [];
        for (const exit of room.exits) {
            const targetRoom = this.findById(exit.targetNodeId);
            if (targetRoom) {
                connectedRooms.push(targetRoom);
            }
        }

        return connectedRooms;
    }

    incrementVisitCount(roomId: string): void {
        const room = this.findById(roomId);
        if (!room) throw new Error(`Room ${roomId} not found`);

        this.update(roomId, {
            visitedCount: room.visitedCount + 1,
            lastVisitedAt: new Date().toISOString()
        });
    }

    // ============================================================
    // COORDINATE-BASED QUERIES
    // ============================================================

    findRoomsByCoordinates(x: number, y: number): RoomNode[] {
        const stmt = this.db.prepare(
            'SELECT * FROM room_nodes WHERE world_x = ? AND world_y = ? ORDER BY name'
        );
        const rows = stmt.all(x, y) as RoomNodeRow[];
        return rows.map(row => this.rowToRoomNode(row));
    }

    findRoomsInBoundingBox(minX: number, maxX: number, minY: number, maxY: number): RoomNode[] {
        const stmt = this.db.prepare(`
            SELECT * FROM room_nodes
            WHERE world_x >= ? AND world_x <= ?
              AND world_y >= ? AND world_y <= ?
            ORDER BY world_x, world_y, name
        `);
        const rows = stmt.all(minX, maxX, minY, maxY) as RoomNodeRow[];
        return rows.map(row => this.rowToRoomNode(row));
    }

    findNearestRoom(x: number, y: number): RoomNode | null {
        // Find room with minimum Euclidean distance
        const stmt = this.db.prepare(`
            SELECT *,
                   ((world_x - ?) * (world_x - ?) + (world_y - ?) * (world_y - ?)) as distance_squared
            FROM room_nodes
            WHERE world_x IS NOT NULL AND world_y IS NOT NULL
            ORDER BY distance_squared
            LIMIT 1
        `);
        const row = stmt.get(x, x, y, y) as RoomNodeRow | undefined;
        if (!row) return null;
        return this.rowToRoomNode(row);
    }

    // ============================================================
    // NODE NETWORK METHODS
    // ============================================================

    createNetwork(network: NodeNetwork): void {
        const validNetwork = NodeNetworkSchema.parse(network);

        const stmt = this.db.prepare(`
            INSERT INTO node_networks (
                id, name, type, world_id, center_x, center_y,
                bounding_box, created_at, updated_at
            )
            VALUES (
                @id, @name, @type, @worldId, @centerX, @centerY,
                @boundingBox, @createdAt, @updatedAt
            )
        `);

        stmt.run({
            id: validNetwork.id,
            name: validNetwork.name,
            type: validNetwork.type,
            worldId: validNetwork.worldId,
            centerX: validNetwork.centerX,
            centerY: validNetwork.centerY,
            boundingBox: validNetwork.boundingBox ? JSON.stringify(validNetwork.boundingBox) : null,
            createdAt: validNetwork.createdAt,
            updatedAt: validNetwork.updatedAt,
        });
    }

    findNetworkById(id: string): NodeNetwork | null {
        const stmt = this.db.prepare('SELECT * FROM node_networks WHERE id = ?');
        const row = stmt.get(id) as NodeNetworkRow | undefined;

        if (!row) return null;
        return this.rowToNodeNetwork(row);
    }

    findRoomsByNetwork(networkId: string): RoomNode[] {
        const stmt = this.db.prepare(
            'SELECT * FROM room_nodes WHERE network_id = ? ORDER BY name'
        );
        const rows = stmt.all(networkId) as RoomNodeRow[];
        return rows.map(row => this.rowToRoomNode(row));
    }

    findNetworksAtCoordinates(x: number, y: number): NodeNetwork[] {
        // Find networks where (x,y) is within their bounds or at their center
        const stmt = this.db.prepare(`
            SELECT * FROM node_networks
            WHERE center_x = ? AND center_y = ?
        `);
        const rows = stmt.all(x, y) as NodeNetworkRow[];

        // Also check bounding boxes
        const boundedNetworks = this.db.prepare(`
            SELECT * FROM node_networks
            WHERE bounding_box IS NOT NULL
        `).all() as NodeNetworkRow[];

        const allNetworks = [...rows];

        for (const row of boundedNetworks) {
            if (row.bounding_box) {
                const bbox = JSON.parse(row.bounding_box);
                if (x >= bbox.minX && x <= bbox.maxX && y >= bbox.minY && y <= bbox.maxY) {
                    if (!allNetworks.find(n => n.id === row.id)) {
                        allNetworks.push(row);
                    }
                }
            }
        }

        return allNetworks.map(row => this.rowToNodeNetwork(row));
    }

    private rowToRoomNode(row: RoomNodeRow): RoomNode {
        return RoomNodeSchema.parse({
            id: row.id,
            name: row.name,
            baseDescription: row.base_description,
            biomeContext: row.biome_context,
            atmospherics: JSON.parse(row.atmospherics),
            exits: JSON.parse(row.exits),
            entityIds: JSON.parse(row.entity_ids),
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            visitedCount: row.visited_count,
            lastVisitedAt: row.last_visited_at || undefined,
            worldX: row.world_x !== null ? row.world_x : undefined,
            worldY: row.world_y !== null ? row.world_y : undefined,
            networkId: row.network_id || undefined,
        });
    }

    private rowToNodeNetwork(row: NodeNetworkRow): NodeNetwork {
        return NodeNetworkSchema.parse({
            id: row.id,
            name: row.name,
            type: row.type,
            worldId: row.world_id,
            centerX: row.center_x,
            centerY: row.center_y,
            boundingBox: row.bounding_box ? JSON.parse(row.bounding_box) : undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }
}

interface RoomNodeRow {
    id: string;
    name: string;
    base_description: string;
    biome_context: string;
    atmospherics: string;
    exits: string;
    entity_ids: string;
    created_at: string;
    updated_at: string;
    visited_count: number;
    last_visited_at: string | null;
    world_x: number | null;
    world_y: number | null;
    network_id: string | null;
}

interface NodeNetworkRow {
    id: string;
    name: string;
    type: 'cluster' | 'linear';
    world_id: string;
    center_x: number;
    center_y: number;
    bounding_box: string | null;
    created_at: string;
    updated_at: string;
}
