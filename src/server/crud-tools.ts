import { randomUUID } from 'crypto';
import { WorldRepository } from '../storage/repos/world.repo.js';
import { CharacterRepository } from '../storage/repos/character.repo.js';
import { World, WorldSchema } from '../schema/world.js';
import { Character, NPC } from '../schema/character.js';
import { CharacterTypeSchema } from '../schema/party.js';
import { SpellSlotsSchema, PactMagicSlotsSchema, SpellcastingAbilitySchema } from '../schema/spell.js';
import { z } from 'zod';

import { getDb, closeDb } from '../storage/index.js';
import { SessionContext } from './types.js';
import { provisionStartingEquipment } from '../services/starting-equipment.service.js';
import { RichFormatter } from './utils/formatter.js';

function ensureDb() {
    const dbPath = process.env.NODE_ENV === 'test'
        ? ':memory:'
        : process.env.RPG_DATA_DIR
            ? `${process.env.RPG_DATA_DIR}/rpg.db`
            : 'rpg.db';
    const db = getDb(dbPath);
    const worldRepo = new WorldRepository(db);
    const charRepo = new CharacterRepository(db);
    return { db, worldRepo, charRepo };
}

// Tool definitions
export const CRUDTools = {
    // World tools
    CREATE_WORLD: {
        name: 'create_world',
        description: 'Create a new world in the database with name, seed, and dimensions. Example: { "name": "New World", "seed": "abc", "width": 50, "height": 50 }',
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
    UPDATE_WORLD_ENVIRONMENT: {
        name: 'update_world_environment',
        description: 'Update environmental properties (time, weather, lighting, etc.) for a world.',
        inputSchema: z.object({
            id: z.string(),
            environment: z.object({
                date: z.string().optional(),
                timeOfDay: z.string().optional(),
                season: z.string().optional(),
                moonPhase: z.string().optional(),
                weatherConditions: z.string().optional(),
                temperature: z.string().optional(),
                lighting: z.string().optional(),
            }).passthrough()
        })
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
        description: `Create a new character. Only name is required - everything else has sensible defaults.

Character types:
- pc: Player character (default)
- npc: Non-player character (ally or neutral)
- enemy: Hostile creature
- neutral: Non-hostile, non-ally

Class and race can be ANY string - use standard D&D classes/races or create custom ones.
Stats can be any positive integer (not limited to 3-18).

Example (minimal - just name):
{
  "name": "Mysterious Stranger"
}

Example (full):
{
  "name": "Valeros",
  "class": "Fighter",
  "race": "Human",
  "hp": 20,
  "maxHp": 20,
  "ac": 18,
  "level": 1,
  "stats": { "str": 16, "dex": 14, "con": 14, "int": 10, "wis": 12, "cha": 10 },
  "characterType": "pc"
}

Example (custom class/race):
{
  "name": "Whiskers",
  "class": "Chronomancer",
  "race": "Mousefolk",
  "stats": { "str": 6, "dex": 18, "con": 10, "int": 16, "wis": 14, "cha": 12 }
}`,
        // Flexible schema - only name required, everything else has defaults
        inputSchema: z.object({
            name: z.string().min(1).describe('Character name (required)'),
            // Class/race can be ANY string - no enum restriction
            class: z.string().optional().default('Adventurer')
                .describe('Character class - any string allowed (Fighter, Wizard, Chronomancer, Merchant...)'),
            race: z.string().optional().default('Human')
                .describe('Character race - any string allowed (Human, Elf, Mousefolk, Illithid...)'),
            background: z.string().optional().default('Folk Hero'),
            alignment: z.string().optional(),
            // Stats with no min/max - allow godlike or cursed entities
            stats: z.object({
                str: z.number().int().min(0).default(10),
                dex: z.number().int().min(0).default(10),
                con: z.number().int().min(0).default(10),
                int: z.number().int().min(0).default(10),
                wis: z.number().int().min(0).default(10),
                cha: z.number().int().min(0).default(10),
            }).optional().default({ str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }),
            // Combat stats with sensible defaults
            hp: z.number().int().min(1).optional(),
            maxHp: z.number().int().min(1).optional(),
            ac: z.number().int().min(0).optional().default(10),
            level: z.number().int().min(1).optional().default(1),
            // Type and NPC fields
            characterType: CharacterTypeSchema.optional().default('pc'),
            factionId: z.string().optional(),
            behavior: z.string().optional(),
            // Spellcasting
            characterClass: z.string().optional(),
            knownSpells: z.array(z.string()).optional().default([]),
            preparedSpells: z.array(z.string()).optional().default([]),
            // Damage modifiers
            resistances: z.array(z.string()).optional().default([]),
            vulnerabilities: z.array(z.string()).optional().default([]),
            immunities: z.array(z.string()).optional().default([]),
            // Starting equipment provisioning (default: true for PCs)
            provisionEquipment: z.boolean().optional().default(true)
                .describe('Auto-grant class-appropriate starting equipment and spells. Set to false for custom/improvised characters.'),
            // Custom equipment override (when provisionEquipment is true but you want specific items)
            customEquipment: z.array(z.string()).optional()
                .describe('Override default starting equipment with these items (still requires provisionEquipment: true)'),
            // Starting gold override
            startingGold: z.number().int().min(0).optional()
                .describe('Override default starting gold amount'),
        })
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
        description: `Update character properties. All fields except id are optional.

For conditions, you can pass an array to SET all conditions (replacing existing), or use addConditions/removeConditions for granular control.`,
        inputSchema: z.object({
            id: z.string(),
            name: z.string().min(1).optional(),
            race: z.string().optional(),
            class: z.string().optional(),
            hp: z.number().int().min(0).optional(),
            maxHp: z.number().int().min(1).optional(),
            ac: z.number().int().min(0).optional(),
            level: z.number().int().min(1).optional(),
            characterType: CharacterTypeSchema.optional(),
            stats: z.object({
                str: z.number().int().min(0).optional(),
                dex: z.number().int().min(0).optional(),
                con: z.number().int().min(0).optional(),
                int: z.number().int().min(0).optional(),
                wis: z.number().int().min(0).optional(),
                cha: z.number().int().min(0).optional(),
            }).optional(),
            // Spellcasting updates
            knownSpells: z.array(z.string()).optional(),
            preparedSpells: z.array(z.string()).optional(),
            cantripsKnown: z.array(z.string()).optional(),
            spellSlots: SpellSlotsSchema.optional(),
            pactMagicSlots: PactMagicSlotsSchema.optional(),
            spellcastingAbility: SpellcastingAbilitySchema.optional(),
            // Conditions/Status Effects
            conditions: z.array(z.object({
                name: z.string(),
                duration: z.number().int().optional(),
                source: z.string().optional()
            })).optional().describe('Replace all conditions with this array'),
            addConditions: z.array(z.object({
                name: z.string(),
                duration: z.number().int().optional(),
                source: z.string().optional()
            })).optional().describe('Add these conditions to existing ones'),
            removeConditions: z.array(z.string()).optional().describe('Remove conditions by name'),
        })
    },
    LIST_CHARACTERS: {
        name: 'list_characters',
        description: 'List all characters, optionally filtered by type (pc, npc, enemy, neutral).',
        inputSchema: z.object({
            characterType: CharacterTypeSchema.optional(),
        })
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
export async function handleCreateWorld(args: unknown, _ctx: SessionContext) {
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

    let output = RichFormatter.header('World Created', '🌍');
    output += RichFormatter.keyValue({
        'ID': `\`${world.id}\``,
        'Name': world.name,
        'Seed': world.seed || '-',
        'Dimensions': `${world.width || 100} x ${world.height || 100}`,
    });
    output += RichFormatter.success('World created successfully!');
    output += RichFormatter.embedJson(world, 'WORLD');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleGetWorld(args: unknown, _ctx: SessionContext) {
    const { worldRepo } = ensureDb();
    const parsed = CRUDTools.GET_WORLD.inputSchema.parse(args);

    const world = worldRepo.findById(parsed.id);
    if (!world) {
        throw new Error(`World not found: ${parsed.id}`);
    }

    let output = RichFormatter.world(world as any);
    output += RichFormatter.embedJson(world, 'WORLD');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleUpdateWorldEnvironment(args: unknown, _ctx: SessionContext) {
    const { worldRepo } = ensureDb();
    const parsed = CRUDTools.UPDATE_WORLD_ENVIRONMENT.inputSchema.parse(args);

    const updated = worldRepo.updateEnvironment(parsed.id, parsed.environment);
    if (!updated) {
        throw new Error(`World not found: ${parsed.id}`);
    }

    let output = RichFormatter.header('Environment Updated', '🌤️');
    output += RichFormatter.keyValue({
        'World ID': `\`${updated.id}\``,
        'Name': updated.name,
    });
    if (updated.environment) {
        output += RichFormatter.section('Environment');
        output += RichFormatter.keyValue(updated.environment as Record<string, unknown>);
    }
    output += RichFormatter.embedJson(updated, 'WORLD');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleListWorlds(args: unknown, _ctx: SessionContext) {
    const { worldRepo } = ensureDb();
    CRUDTools.LIST_WORLDS.inputSchema.parse(args);

    const worlds = worldRepo.findAll();

    let output = RichFormatter.header('Worlds', '🌍');
    if (worlds.length === 0) {
        output += RichFormatter.alert('No worlds found.', 'info');
    } else {
        const rows = worlds.map((w: any) => [w.name, `\`${w.id}\``, w.seed || '-']);
        output += RichFormatter.table(['Name', 'ID', 'Seed'], rows);
        output += `\n*${worlds.length} world(s) total*\n`;
    }
    output += RichFormatter.embedJson({ worlds, count: worlds.length }, 'WORLDS');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleDeleteWorld(args: unknown, _ctx: SessionContext) {
    const { worldRepo } = ensureDb();
    const parsed = CRUDTools.DELETE_WORLD.inputSchema.parse(args);

    worldRepo.delete(parsed.id);

    let output = RichFormatter.header('World Deleted', '🗑️');
    output += RichFormatter.keyValue({ 'ID': `\`${parsed.id}\`` });
    output += RichFormatter.success('World deleted successfully.');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

// Character handlers
export async function handleCreateCharacter(args: unknown, _ctx: SessionContext) {
    const { db, charRepo } = ensureDb();
    const parsed = CRUDTools.CREATE_CHARACTER.inputSchema.parse(args);

    const now = new Date().toISOString();
    const className = parsed.characterClass || parsed.class || 'Adventurer';

    // Calculate HP from constitution if not provided
    // Base HP = 8 + con modifier (minimum 1)
    const conModifier = Math.floor(((parsed.stats?.con ?? 10) - 10) / 2);
    const baseHp = Math.max(1, 8 + conModifier);
    const hp = parsed.hp ?? baseHp;
    const maxHp = parsed.maxHp ?? hp;

    const characterId = randomUUID();

    // Provision starting equipment and spells if enabled
    let provisioningResult = null;
    const shouldProvision = parsed.provisionEquipment !== false &&
        (parsed.characterType === 'pc' || parsed.characterType === undefined);

    if (shouldProvision) {
        provisioningResult = provisionStartingEquipment(
            db,
            characterId,
            className,
            parsed.level ?? 1,
            {
                customEquipment: parsed.customEquipment,
                customSpells: parsed.knownSpells?.length ? parsed.knownSpells : undefined,
                startingGold: parsed.startingGold
            }
        );
    }

    // Build character with provisioned data
    const character = {
        ...parsed,
        id: characterId,
        hp,
        maxHp,
        // Map 'class' to 'characterClass' for DB compatibility
        characterClass: className,
        // Merge provisioned spells with any explicitly provided
        knownSpells: provisioningResult?.spellsGranted.length
            ? [...new Set([...parsed.knownSpells || [], ...provisioningResult.spellsGranted])]
            : parsed.knownSpells || [],
        cantripsKnown: provisioningResult?.cantripsGranted.length
            ? [...new Set([...(parsed as any).cantripsKnown || [], ...provisioningResult.cantripsGranted])]
            : (parsed as any).cantripsKnown || [],
        spellSlots: provisioningResult?.spellSlots || undefined,
        pactMagicSlots: provisioningResult?.pactMagicSlots || undefined,
        createdAt: now,
        updatedAt: now
    } as unknown as Character | NPC;

    charRepo.create(character);

    // Return character with provisioning summary
    const response: Record<string, unknown> = { ...character };
    if (provisioningResult) {
        response._provisioning = {
            equipmentGranted: provisioningResult.itemsGranted,
            spellsGranted: provisioningResult.spellsGranted,
            cantripsGranted: provisioningResult.cantripsGranted,
            startingGold: provisioningResult.startingGold,
            errors: provisioningResult.errors.length > 0 ? provisioningResult.errors : undefined
        };
    }

    let output = RichFormatter.character(response as any);
    if (provisioningResult) {
        output += RichFormatter.section('Starting Equipment');
        if (provisioningResult.itemsGranted.length > 0) {
            output += RichFormatter.list(provisioningResult.itemsGranted);
        } else {
            output += '*None*\n';
        }
        if (provisioningResult.spellsGranted.length > 0) {
            output += RichFormatter.subSection('Spells Granted');
            output += RichFormatter.list(provisioningResult.spellsGranted);
        }
        if (provisioningResult.cantripsGranted.length > 0) {
            output += RichFormatter.subSection('Cantrips Granted');
            output += RichFormatter.list(provisioningResult.cantripsGranted);
        }
        output += `\n💰 **Starting Gold:** ${provisioningResult.startingGold}gp\n`;
    }
    output += RichFormatter.success('Character created!');
    output += RichFormatter.embedJson(response, 'CHARACTER');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleGetCharacter(args: unknown, _ctx: SessionContext) {
    const { charRepo } = ensureDb();
    const parsed = CRUDTools.GET_CHARACTER.inputSchema.parse(args);

    const character = charRepo.findById(parsed.id);
    if (!character) {
        throw new Error(`Character not found: ${parsed.id}`);
    }

    let output = RichFormatter.character(character as any);
    output += RichFormatter.embedJson(character, 'CHARACTER');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleUpdateCharacter(args: unknown, _ctx: SessionContext) {
    const { charRepo } = ensureDb();
    const parsed = CRUDTools.UPDATE_CHARACTER.inputSchema.parse(args);

    // Build update object with all provided fields
    const updateData: Record<string, unknown> = {};

    if (parsed.name !== undefined) updateData.name = parsed.name;
    if (parsed.race !== undefined) updateData.race = parsed.race;
    if (parsed.class !== undefined) updateData.characterClass = parsed.class; // Map to DB field
    if (parsed.hp !== undefined) updateData.hp = parsed.hp;
    if (parsed.maxHp !== undefined) updateData.maxHp = parsed.maxHp;
    if (parsed.ac !== undefined) updateData.ac = parsed.ac;
    if (parsed.level !== undefined) updateData.level = parsed.level;
    if (parsed.characterType !== undefined) updateData.characterType = parsed.characterType;
    if (parsed.stats !== undefined) updateData.stats = parsed.stats;

    // Spellcasting updates
    if (parsed.knownSpells !== undefined) updateData.knownSpells = parsed.knownSpells;
    if (parsed.preparedSpells !== undefined) updateData.preparedSpells = parsed.preparedSpells;
    if (parsed.cantripsKnown !== undefined) updateData.cantripsKnown = parsed.cantripsKnown;
    if (parsed.spellSlots !== undefined) updateData.spellSlots = parsed.spellSlots;
    if (parsed.pactMagicSlots !== undefined) updateData.pactMagicSlots = parsed.pactMagicSlots;
    if (parsed.spellcastingAbility !== undefined) updateData.spellcastingAbility = parsed.spellcastingAbility;

    // Conditions/Status Effects handling
    if (parsed.conditions !== undefined) {
        // Full replacement
        updateData.conditions = parsed.conditions;
    } else if (parsed.addConditions !== undefined || parsed.removeConditions !== undefined) {
        // Granular add/remove - need to fetch current state first
        const existing = charRepo.findById(parsed.id);
        if (!existing) {
            throw new Error(`Character not found: ${parsed.id}`);
        }

        let currentConditions: Array<{ name: string; duration?: number; source?: string }> =
            (existing as any).conditions || [];

        // Remove conditions by name
        if (parsed.removeConditions && parsed.removeConditions.length > 0) {
            const toRemove = new Set(parsed.removeConditions.map(n => n.toLowerCase()));
            currentConditions = currentConditions.filter(c => !toRemove.has(c.name.toLowerCase()));
        }

        // Add new conditions
        if (parsed.addConditions && parsed.addConditions.length > 0) {
            for (const newCond of parsed.addConditions) {
                // Check if already exists (by name)
                const existingIdx = currentConditions.findIndex(
                    c => c.name.toLowerCase() === newCond.name.toLowerCase()
                );
                if (existingIdx >= 0) {
                    // Update existing (refresh duration/source)
                    currentConditions[existingIdx] = { ...currentConditions[existingIdx], ...newCond };
                } else {
                    currentConditions.push(newCond);
                }
            }
        }

        updateData.conditions = currentConditions;
    }

    const updated = charRepo.update(parsed.id, updateData);

    if (!updated) {
        throw new Error(`Failed to update character: ${parsed.id}`);
    }

    let output = RichFormatter.header('Character Updated', '✏️');
    output += RichFormatter.character(updated as any);
    output += RichFormatter.success('Character updated successfully.');
    output += RichFormatter.embedJson(updated, 'CHARACTER');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleListCharacters(args: unknown, _ctx: SessionContext) {
    const { charRepo } = ensureDb();
    const parsed = CRUDTools.LIST_CHARACTERS.inputSchema.parse(args);

    const characters = charRepo.findAll({
        characterType: parsed.characterType,
    });

    let output = RichFormatter.header('Characters', '👥');
    output += RichFormatter.characterList(characters as any);
    output += `\n*${characters.length} character(s) total*\n`;
    output += RichFormatter.embedJson({ characters, count: characters.length }, 'CHARACTERS');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleDeleteCharacter(args: unknown, _ctx: SessionContext) {
    const { db } = ensureDb();
    const parsed = CRUDTools.DELETE_CHARACTER.inputSchema.parse(args);

    const stmt = db.prepare('DELETE FROM characters WHERE id = ?');
    stmt.run(parsed.id);

    let output = RichFormatter.header('Character Deleted', '🗑️');
    output += RichFormatter.keyValue({ 'ID': `\`${parsed.id}\`` });
    output += RichFormatter.success('Character deleted successfully.');

    return {
        content: [{
            type: 'text' as const,
            text: output
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
