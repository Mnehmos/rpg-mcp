import Database from 'better-sqlite3';
import { Region, RegionSchema } from '../../schema/region.js';

export class RegionRepository {
    constructor(private db: Database.Database) { }

    create(region: Region): void {
        const validRegion = RegionSchema.parse(region);
        const stmt = this.db.prepare(`
      INSERT INTO regions (id, world_id, name, type, center_x, center_y, color, created_at, updated_at)
      VALUES (@id, @worldId, @name, @type, @centerX, @centerY, @color, @createdAt, @updatedAt)
    `);
        stmt.run({
            id: validRegion.id,
            worldId: validRegion.worldId,
            name: validRegion.name,
            type: validRegion.type,
            centerX: validRegion.centerX,
            centerY: validRegion.centerY,
            color: validRegion.color,
            createdAt: validRegion.createdAt,
            updatedAt: validRegion.updatedAt,
        });
    }

    findById(id: string): Region | null {
        const stmt = this.db.prepare('SELECT * FROM regions WHERE id = ?');
        const row = stmt.get(id) as RegionRow | undefined;

        if (!row) return null;

        return RegionSchema.parse({
            id: row.id,
            worldId: row.world_id,
            name: row.name,
            type: row.type,
            centerX: row.center_x,
            centerY: row.center_y,
            color: row.color,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }

    findByWorldId(worldId: string): Region[] {
        const stmt = this.db.prepare('SELECT * FROM regions WHERE world_id = ?');
        const rows = stmt.all(worldId) as RegionRow[];

        return rows.map((row) =>
            RegionSchema.parse({
                id: row.id,
                worldId: row.world_id,
                name: row.name,
                type: row.type,
                centerX: row.center_x,
                centerY: row.center_y,
                color: row.color,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            })
        );
    }
}

interface RegionRow {
    id: string;
    world_id: string;
    name: string;
    type: string;
    center_x: number;
    center_y: number;
    color: string;
    created_at: string;
    updated_at: string;
}
