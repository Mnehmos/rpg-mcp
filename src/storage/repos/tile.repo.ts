import Database from 'better-sqlite3';
import { Tile, TileSchema } from '../../schema/tile.js';

export class TileRepository {
    constructor(private db: Database.Database) { }

    create(tile: Tile): void {
        const validTile = TileSchema.parse(tile);
        const stmt = this.db.prepare(`
      INSERT INTO tiles (id, world_id, x, y, biome, elevation, moisture, temperature)
      VALUES (@id, @worldId, @x, @y, @biome, @elevation, @moisture, @temperature)
    `);
        stmt.run({
            id: validTile.id,
            worldId: validTile.worldId,
            x: validTile.x,
            y: validTile.y,
            biome: validTile.biome,
            elevation: validTile.elevation,
            moisture: validTile.moisture,
            temperature: validTile.temperature,
        });
    }

    findByCoordinates(worldId: string, x: number, y: number): Tile | null {
        const stmt = this.db.prepare('SELECT * FROM tiles WHERE world_id = ? AND x = ? AND y = ?');
        const row = stmt.get(worldId, x, y) as TileRow | undefined;

        if (!row) return null;

        return TileSchema.parse({
            id: row.id,
            worldId: row.world_id,
            x: row.x,
            y: row.y,
            biome: row.biome,
            elevation: row.elevation,
            moisture: row.moisture,
            temperature: row.temperature,
        });
    }

    findByWorldId(worldId: string): Tile[] {
        const stmt = this.db.prepare('SELECT * FROM tiles WHERE world_id = ?');
        const rows = stmt.all(worldId) as TileRow[];

        return rows.map((row) =>
            TileSchema.parse({
                id: row.id,
                worldId: row.world_id,
                x: row.x,
                y: row.y,
                biome: row.biome,
                elevation: row.elevation,
                moisture: row.moisture,
                temperature: row.temperature,
            })
        );
    }
}

interface TileRow {
    id: string;
    world_id: string;
    x: number;
    y: number;
    biome: string;
    elevation: number;
    moisture: number;
    temperature: number;
}
