import Database from 'better-sqlite3';
import { Character, CharacterSchema, NPC, NPCSchema } from '../../schema/character.js';

export class CharacterRepository {
    constructor(private db: Database.Database) { }

    create(character: Character | NPC): void {
        // Determine if it's an NPC or Character for validation
        const isNPC = 'factionId' in character || 'behavior' in character;
        const validChar = isNPC ? NPCSchema.parse(character) : CharacterSchema.parse(character);

        const stmt = this.db.prepare(`
      INSERT INTO characters (id, name, stats, hp, max_hp, ac, level, faction_id, behavior, created_at, updated_at)
      VALUES (@id, @name, @stats, @hp, @maxHp, @ac, @level, @factionId, @behavior, @createdAt, @updatedAt)
    `);

        stmt.run({
            id: validChar.id,
            name: validChar.name,
            stats: JSON.stringify(validChar.stats),
            hp: validChar.hp,
            maxHp: validChar.maxHp,
            ac: validChar.ac,
            level: validChar.level,
            factionId: (validChar as NPC).factionId || null,
            behavior: (validChar as NPC).behavior || null,
            createdAt: validChar.createdAt,
            updatedAt: validChar.updatedAt,
        });
    }

    findById(id: string): Character | NPC | null {
        const stmt = this.db.prepare('SELECT * FROM characters WHERE id = ?');
        const row = stmt.get(id) as CharacterRow | undefined;

        if (!row) return null;

        const base = {
            id: row.id,
            name: row.name,
            stats: JSON.parse(row.stats),
            hp: row.hp,
            maxHp: row.max_hp,
            ac: row.ac,
            level: row.level,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        };

        if (row.faction_id || row.behavior) {
            return NPCSchema.parse({
                ...base,
                factionId: row.faction_id || undefined,
                behavior: row.behavior || undefined,
            });
        }

        return CharacterSchema.parse(base);
    }
}

interface CharacterRow {
    id: string;
    name: string;
    stats: string;
    hp: number;
    max_hp: number;
    ac: number;
    level: number;
    faction_id: string | null;
    behavior: string | null;
    created_at: string;
    updated_at: string;
}
