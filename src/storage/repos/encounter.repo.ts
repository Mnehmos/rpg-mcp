import Database from 'better-sqlite3';
import { Encounter, EncounterSchema } from '../../schema/encounter.js';

export class EncounterRepository {
    constructor(private db: Database.Database) { }

    create(encounter: Encounter): void {
        const validEncounter = EncounterSchema.parse(encounter);
        const stmt = this.db.prepare(`
      INSERT INTO encounters (id, region_id, tokens, round, active_token_id, status, created_at, updated_at)
      VALUES (@id, @regionId, @tokens, @round, @activeTokenId, @status, @createdAt, @updatedAt)
    `);
        stmt.run({
            id: validEncounter.id,
            regionId: validEncounter.regionId,
            tokens: JSON.stringify(validEncounter.tokens),
            round: validEncounter.round,
            activeTokenId: validEncounter.activeTokenId || null,
            status: validEncounter.status,
            createdAt: validEncounter.createdAt,
            updatedAt: validEncounter.updatedAt,
        });
    }

    findByRegionId(regionId: string): Encounter[] {
        const stmt = this.db.prepare('SELECT * FROM encounters WHERE region_id = ?');
        const rows = stmt.all(regionId) as EncounterRow[];

        return rows.map((row) =>
            EncounterSchema.parse({
                id: row.id,
                regionId: row.region_id,
                tokens: JSON.parse(row.tokens),
                round: row.round,
                activeTokenId: row.active_token_id || undefined,
                status: row.status,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
            })
        );
    }
}

interface EncounterRow {
    id: string;
    region_id: string;
    tokens: string;
    round: number;
    active_token_id: string | null;
    status: string;
    created_at: string;
    updated_at: string;
}
