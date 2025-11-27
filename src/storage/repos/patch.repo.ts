import Database from 'better-sqlite3';
import { MapPatch, MapPatchSchema } from '../../schema/patch.js';

export class PatchRepository {
    constructor(private db: Database.Database) { }

    log(patch: MapPatch): void {
        const validPatch = MapPatchSchema.parse(patch);
        const stmt = this.db.prepare(`
      INSERT INTO patches (op, path, value, timestamp)
      VALUES (@op, @path, @value, @timestamp)
    `);
        stmt.run({
            op: validPatch.op,
            path: validPatch.path,
            value: validPatch.value ? JSON.stringify(validPatch.value) : null,
            timestamp: validPatch.timestamp,
        });
    }

    getHistory(): MapPatch[] {
        const stmt = this.db.prepare('SELECT * FROM patches ORDER BY id ASC');
        const rows = stmt.all() as PatchRow[];

        return rows.map((row) =>
            MapPatchSchema.parse({
                op: row.op,
                path: row.path,
                value: row.value ? JSON.parse(row.value) : undefined,
                timestamp: row.timestamp,
            })
        );
    }
}

interface PatchRow {
    op: string;
    path: string;
    value: string | null;
    timestamp: string;
}
