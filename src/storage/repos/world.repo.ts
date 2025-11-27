import Database from 'better-sqlite3';
import { World, WorldSchema } from '../../schema/world.js';

export class WorldRepository {
    constructor(private db: Database.Database) { }

    create(world: World): void {
        const validWorld = WorldSchema.parse(world);
        const stmt = this.db.prepare(`
      INSERT INTO worlds (id, name, seed, width, height, created_at, updated_at)
      VALUES (@id, @name, @seed, @width, @height, @createdAt, @updatedAt)
    `);
        stmt.run({
            id: validWorld.id,
            name: validWorld.name,
            seed: validWorld.seed,
            width: validWorld.width,
            height: validWorld.height,
            createdAt: validWorld.createdAt,
            updatedAt: validWorld.updatedAt,
        });
    }

    findById(id: string): World | null {
        const stmt = this.db.prepare('SELECT * FROM worlds WHERE id = ?');
        const row = stmt.get(id) as WorldRow | undefined;

        if (!row) return null;

        return WorldSchema.parse({
            id: row.id,
            name: row.name,
            seed: row.seed,
            width: row.width,
            height: row.height,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        });
    }

    findAll(): World[] {
        const stmt = this.db.prepare('SELECT * FROM worlds');
        const rows = stmt.all() as WorldRow[];

        return rows.map((row) =>
            WorldSchema.parse({
                id: row.id,
                name: row.name,
                seed: row.seed,
                width: row.width,
                height: row.height,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            })
        );
    }

    delete(id: string): void {
        const stmt = this.db.prepare('DELETE FROM worlds WHERE id = ?');
        stmt.run(id);
    }
}

interface WorldRow {
    id: string;
    name: string;
    seed: string;
    width: number;
    height: number;
    created_at: string;
    updated_at: string;
}
