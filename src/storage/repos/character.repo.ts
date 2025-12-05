import Database from 'better-sqlite3';
import { Character, CharacterSchema, NPC, NPCSchema } from '../../schema/character.js';
import { CharacterType } from '../../schema/party.js';

export class CharacterRepository {
    constructor(private db: Database.Database) { }

    create(character: Character | NPC): void {
        // Determine if it's an NPC or Character for validation
        const isNPC = 'factionId' in character || 'behavior' in character;
        const validChar = isNPC ? NPCSchema.parse(character) : CharacterSchema.parse(character);

        const stmt = this.db.prepare(`
      INSERT INTO characters (id, name, stats, hp, max_hp, ac, level, faction_id, behavior, character_type,
                              character_class, spell_slots, pact_magic_slots, known_spells, prepared_spells,
                              cantrips_known, max_spell_level, concentrating_on, conditions,
                              created_at, updated_at)
      VALUES (@id, @name, @stats, @hp, @maxHp, @ac, @level, @factionId, @behavior, @characterType,
              @characterClass, @spellSlots, @pactMagicSlots, @knownSpells, @preparedSpells,
              @cantripsKnown, @maxSpellLevel, @concentratingOn, @conditions,
              @createdAt, @updatedAt)
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
            characterType: validChar.characterType || 'pc',
            // CRIT-002/006: Spellcasting fields
            characterClass: validChar.characterClass || 'fighter',
            spellSlots: validChar.spellSlots ? JSON.stringify(validChar.spellSlots) : null,
            pactMagicSlots: validChar.pactMagicSlots ? JSON.stringify(validChar.pactMagicSlots) : null,
            knownSpells: JSON.stringify(validChar.knownSpells || []),
            preparedSpells: JSON.stringify(validChar.preparedSpells || []),
            cantripsKnown: JSON.stringify(validChar.cantripsKnown || []),
            maxSpellLevel: validChar.maxSpellLevel || 0,
            concentratingOn: validChar.concentratingOn || null,
            conditions: JSON.stringify(validChar.conditions || []),
            createdAt: validChar.createdAt,
            updatedAt: validChar.updatedAt,
        });
    }

    findById(id: string): Character | NPC | null {
        const stmt = this.db.prepare('SELECT * FROM characters WHERE id = ?');
        const row = stmt.get(id) as CharacterRow | undefined;

        if (!row) return null;
        return this.rowToCharacter(row);
    }

    findAll(filters?: { characterType?: CharacterType }): (Character | NPC)[] {
        let query = 'SELECT * FROM characters';
        const params: any[] = [];

        if (filters?.characterType) {
            query += ' WHERE character_type = ?';
            params.push(filters.characterType);
        }

        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params) as CharacterRow[];
        return rows.map(row => this.rowToCharacter(row));
    }

    findByType(characterType: CharacterType): (Character | NPC)[] {
        const stmt = this.db.prepare('SELECT * FROM characters WHERE character_type = ?');
        const rows = stmt.all(characterType) as CharacterRow[];
        return rows.map(row => this.rowToCharacter(row));
    }

    update(id: string, updates: Partial<Character | NPC>): Character | NPC | null {
        const existing = this.findById(id);
        if (!existing) return null;

        const updated = {
            ...existing,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        // Validate
        const isNPC = 'factionId' in updated || 'behavior' in updated;
        const validChar = isNPC ? NPCSchema.parse(updated) : CharacterSchema.parse(updated);

        const stmt = this.db.prepare(`
            UPDATE characters
            SET name = ?, stats = ?, hp = ?, max_hp = ?, ac = ?, level = ?,
                faction_id = ?, behavior = ?, character_type = ?,
                character_class = ?, spell_slots = ?, pact_magic_slots = ?,
                known_spells = ?, prepared_spells = ?, cantrips_known = ?,
                max_spell_level = ?, concentrating_on = ?, conditions = ?,
                updated_at = ?
            WHERE id = ?
        `);

        stmt.run(
            validChar.name,
            JSON.stringify(validChar.stats),
            validChar.hp,
            validChar.maxHp,
            validChar.ac,
            validChar.level,
            (validChar as NPC).factionId || null,
            (validChar as NPC).behavior || null,
            validChar.characterType || 'pc',
            // CRIT-002/006: Spellcasting fields
            validChar.characterClass || 'fighter',
            validChar.spellSlots ? JSON.stringify(validChar.spellSlots) : null,
            validChar.pactMagicSlots ? JSON.stringify(validChar.pactMagicSlots) : null,
            JSON.stringify(validChar.knownSpells || []),
            JSON.stringify(validChar.preparedSpells || []),
            JSON.stringify(validChar.cantripsKnown || []),
            validChar.maxSpellLevel || 0,
            validChar.concentratingOn || null,
            JSON.stringify(validChar.conditions || []),
            validChar.updatedAt,
            id
        );

        return validChar;
    }

    delete(id: string): boolean {
        const stmt = this.db.prepare('DELETE FROM characters WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    private rowToCharacter(row: CharacterRow): Character | NPC {
        const base = {
            id: row.id,
            name: row.name,
            stats: JSON.parse(row.stats),
            hp: row.hp,
            maxHp: row.max_hp,
            ac: row.ac,
            level: row.level,
            characterType: (row.character_type as CharacterType) || 'pc',
            // CRIT-002/006: Spellcasting fields
            characterClass: row.character_class || 'fighter',
            spellSlots: row.spell_slots ? JSON.parse(row.spell_slots) : undefined,
            pactMagicSlots: row.pact_magic_slots ? JSON.parse(row.pact_magic_slots) : undefined,
            knownSpells: row.known_spells ? JSON.parse(row.known_spells) : [],
            preparedSpells: row.prepared_spells ? JSON.parse(row.prepared_spells) : [],
            cantripsKnown: row.cantrips_known ? JSON.parse(row.cantrips_known) : [],
            maxSpellLevel: row.max_spell_level || 0,
            concentratingOn: row.concentrating_on || null,
            conditions: row.conditions ? JSON.parse(row.conditions) : [],
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
    character_type: string | null;
    // CRIT-002/006: Spellcasting columns
    character_class: string | null;
    spell_slots: string | null;
    pact_magic_slots: string | null;
    known_spells: string | null;
    prepared_spells: string | null;
    cantrips_known: string | null;
    max_spell_level: number | null;
    concentrating_on: string | null;
    conditions: string | null;
    created_at: string;
    updated_at: string;
}
