import Database from 'better-sqlite3';
import { RiverPath, RiverPathSchema } from '../../schema/river.js';

export class RiverRepository {
    constructor(private db: Database.Database) { }

    create(river: RiverPath): void {
        const validRiver = RiverPathSchema.parse(river);
        const stmt = this.db.prepare(`
      INSERT INTO rivers (id, world_id, name, path, width, source_elevation, mouth_elevation)
      VALUES (@id, @worldId, @name, @path, @width, @sourceElevation, @mouthElevation)
    `);
        stmt.run({
            id: validRiver.id,
            worldId: validRiver.worldId,
            name: validRiver.name,
            path: JSON.stringify(validRiver.points),
            width: validRiver.width,
            sourceElevation: validRiver.sourceElevation,
            mouthElevation: validRiver.mouthElevation,
        });
    }

    findByWorldId(worldId: string): RiverPath[] {
        const stmt = this.db.prepare('SELECT * FROM rivers WHERE world_id = ?');
        const rows = stmt.all(worldId) as RiverRow[];

        return rows.map((row) =>
            RiverPathSchema.parse({
                id: row.id,
                worldId: row.world_id,
                name: row.name,
                points: JSON.parse(row.path),
                width: row.width,
                sourceElevation: row.source_elevation,
                mouthElevation: row.mouth_elevation,
            })
        );
    }
}

interface RiverRow {
    id: string;
    world_id: string;
    name: string;
    path: string;
    width: number;
    source_elevation: number;
    mouth_elevation: number;
}
