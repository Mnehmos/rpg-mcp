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
            regionId: validEncounter.regionId || null,
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
    saveState(encounterId: string, state: any): void {
        const stmt = this.db.prepare(`
            UPDATE encounters 
            SET tokens = ?, round = ?, active_token_id = ?, status = ?, updated_at = ?
            WHERE id = ?
        `);

        // Map CombatState to DB format
        // We store participants in 'tokens' column
        const currentTurnId = state.turnOrder[state.currentTurnIndex];

        stmt.run(
            JSON.stringify(state.participants),
            state.round,
            currentTurnId,
            'active',
            new Date().toISOString(),
            encounterId
        );
    }

    loadState(encounterId: string): any | null {
        const row = this.findById(encounterId);
        if (!row) return null;

        const participants = JSON.parse(row.tokens);

        return {
            participants: participants,
            turnOrder: participants.map((p: any) => p.id), // This assumes participants are sorted by turn order
            currentTurnIndex: participants.findIndex((p: any) => p.id === row.active_token_id),
            round: row.round
        };
    }

    findById(id: string): EncounterRow | undefined {
        const stmt = this.db.prepare('SELECT * FROM encounters WHERE id = ?');
        return stmt.get(id) as EncounterRow | undefined;
    }

    delete(id: string): boolean {
        const stmt = this.db.prepare('DELETE FROM encounters WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }
}

interface EncounterRow {
    id: string;
    region_id: string | null;
    tokens: string;
    round: number;
    active_token_id: string | null;
    status: string;
    created_at: string;
    updated_at: string;
}
