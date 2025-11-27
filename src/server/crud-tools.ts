import { z } from 'zod';
import { randomUUID } from 'crypto';
import { WorldRepository } from '../storage/repos/world.repo';
import { CharacterRepository } from '../storage/repos/character.repo';
import { World, WorldSchema } from '../schema/world';
import { Character, CharacterSchema, NPC, NPCSchema } from '../schema/character';

import { getDb, closeDb } from '../storage';

function ensureDb() {
    const db = getDb(process.env.NODE_ENV === 'test' ? ':memory:' : 'rpg.db');
    const worldRepo = new WorldRepository(db);
    const charRepo = new CharacterRepository(db);
    return { db, worldRepo, charRepo };
}

// Tool definitions
export const CRUDTools = {
    // World tools
    CREATE_WORLD: {
        name: 'create_world',
        description: `Create a new world in the database.

Example:
{
  "name": "My Campaign World",
  "seed": "campaign-1",
  "width": 100,
  "height": 100
}`,
        inputSchema: WorldSchema.omit({ id: true, createdAt: true, updatedAt: true })
    },
    GET_WORLD: {
        name: 'get_world',
        description: 'Retrieve a world by ID.',
        inputSchema: z.object({
            id: z.string()
        })
    },
    LIST_WORLDS: {
        name: 'list_worlds',
        description: 'List all worlds.',
        inputSchema: z.object({})
    },
    DELETE_WORLD: {
        name: 'delete_world',
        description: 'Delete a world by ID.',
        inputSchema: z.object({
            id: z.string()
        })
    },

    // Character tools
    CREATE_CHARACTER: {
        name: 'create_character',
        description: `Create a new character.

Example:
{
  "name": "Valeros",
  "hp": 20,
  "maxHp": 20,
  "ac": 18,
  "level": 1,
  "stats": { "str": 16, "dex": 14, "con": 14, "int": 10, "wis": 12, "cha": 10 }
}`,
        inputSchema: z.union([
            NPCSchema.omit({ id: true, createdAt: true, updatedAt: true }),
            CharacterSchema.omit({ id: true, createdAt: true, updatedAt: true })
        ])
    },
    GET_CHARACTER: {
        name: 'get_character',
        description: 'Retrieve a character by ID.',
        inputSchema: z.object({
            id: z.string()
        })
    },
    UPDATE_CHARACTER: {
        name: 'update_character',
        description: `Update character properties.

Example:
{
  "id": "char-123",
  "hp": 15,
  "level": 2
}`,
        inputSchema: z.object({
            id: z.string(),
            hp: z.number().int().min(0).optional(),
            level: z.number().int().min(1).optional()
        })
    },
    LIST_CHARACTERS: {
        name: 'list_characters',
        description: 'List all characters.',
        inputSchema: z.object({})
    },
    DELETE_CHARACTER: {
        name: 'delete_character',
        description: 'Delete a character by ID.',
        inputSchema: z.object({
            id: z.string()
        })
    }
} as const;

// World handlers
export async function handleCreateWorld(args: unknown) {
    const { worldRepo } = ensureDb();
    const parsed = CRUDTools.CREATE_WORLD.inputSchema.parse(args);

    const now = new Date().toISOString();
    const world: World = {
        ...parsed,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now
    };

    worldRepo.create(world);

    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify(world, null, 2)
        }]
    };
}

export async function handleGetWorld(args: unknown) {
    const { worldRepo } = ensureDb();
    const parsed = CRUDTools.GET_WORLD.inputSchema.parse(args);

    const world = worldRepo.findById(parsed.id);
    if (!world) {
        throw new Error(`World not found: ${parsed.id}`);
    }

    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify(world, null, 2)
        }]
    };
}

export async function handleListWorlds(args: unknown) {
    const { worldRepo } = ensureDb();
    CRUDTools.LIST_WORLDS.inputSchema.parse(args);

    const worlds = worldRepo.findAll();

    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify({
                worlds,
                count: worlds.length
            }, null, 2)
        }]
    };
}

export async function handleDeleteWorld(args: unknown) {
    const { worldRepo } = ensureDb();
    const parsed = CRUDTools.DELETE_WORLD.inputSchema.parse(args);

    worldRepo.delete(parsed.id);

    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify({
                message: 'World deleted',
                id: parsed.id
            }, null, 2)
        }]
    };
}

// Character handlers
export async function handleCreateCharacter(args: unknown) {
    const { charRepo } = ensureDb();
    const parsed = CRUDTools.CREATE_CHARACTER.inputSchema.parse(args);

    const now = new Date().toISOString();
    const character = {
        ...parsed,
        id: randomUUID(),
        createdAt: now,
        updatedAt: now
    } as Character | NPC;

    charRepo.create(character);

    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify(character, null, 2)
        }]
    };
}

export async function handleGetCharacter(args: unknown) {
    const { charRepo } = ensureDb();
    const parsed = CRUDTools.GET_CHARACTER.inputSchema.parse(args);

    const character = charRepo.findById(parsed.id);
    if (!character) {
        throw new Error(`Character not found: ${parsed.id}`);
    }

    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify(character, null, 2)
        }]
    };
}

export async function handleUpdateCharacter(args: unknown) {
    const { charRepo, db } = ensureDb();
    const parsed = CRUDTools.UPDATE_CHARACTER.inputSchema.parse(args);

    // Get existing character
    const existing = charRepo.findById(parsed.id);
    if (!existing) {
        throw new Error(`Character not found: ${parsed.id}`);
    }

    // Update fields
    const updated = {
        ...existing,
        ...(parsed.hp !== undefined && { hp: parsed.hp }),
        ...(parsed.level !== undefined && { level: parsed.level }),
        updatedAt: new Date().toISOString()
    };

    // Update in database (manual SQL since repo doesn't have update method)
    const stmt = db.prepare(`
        UPDATE characters
        SET hp = ?, level = ?, updated_at = ?
        WHERE id = ?
    `);
    stmt.run(updated.hp, updated.level, updated.updatedAt, updated.id);

    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify(updated, null, 2)
        }]
    };
}

export async function handleListCharacters(args: unknown) {
    const { db } = ensureDb();
    CRUDTools.LIST_CHARACTERS.inputSchema.parse(args);

    const stmt = db.prepare('SELECT * FROM characters');
    const rows = stmt.all() as any[];

    const characters = rows.map(row => ({
        id: row.id,
        name: row.name,
        stats: JSON.parse(row.stats),
        hp: row.hp,
        maxHp: row.max_hp,
        ac: row.ac,
        level: row.level,
        factionId: row.faction_id,
        behavior: row.behavior,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    }));

    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify({
                characters,
                count: characters.length
            }, null, 2)
        }]
    };
}

export async function handleDeleteCharacter(args: unknown) {
    const { db } = ensureDb();
    const parsed = CRUDTools.DELETE_CHARACTER.inputSchema.parse(args);

    const stmt = db.prepare('DELETE FROM characters WHERE id = ?');
    stmt.run(parsed.id);

    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify({
                message: 'Character deleted',
                id: parsed.id
            }, null, 2)
        }]
    };
}

// Test helpers
export function getTestDb(): any {
    return ensureDb();
}

export function closeTestDb() {
    closeDb();
}
