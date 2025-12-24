/**
 * Batch Operations Tools
 * 
 * Enables "one prompt → complex generation" by allowing batch creation
 * of characters, NPCs, and item distribution.
 */
import { randomUUID } from 'crypto';
import { CharacterRepository } from '../storage/repos/character.repo.js';
import { Character, NPC } from '../schema/character.js';
import { CharacterTypeSchema } from '../schema/party.js';
import { z } from 'zod';
import { getDb } from '../storage/index.js';
import { SessionContext } from './types.js';
import { RichFormatter } from './utils/formatter.js';

function ensureDb() {
    const dbPath = process.env.NODE_ENV === 'test'
        ? ':memory:'
        : process.env.RPG_DATA_DIR
            ? `${process.env.RPG_DATA_DIR}/rpg.db`
            : 'rpg.db';
    const db = getDb(dbPath);
    const charRepo = new CharacterRepository(db);
    return { db, charRepo };
}

// Common character schema for batch creation
const BatchCharacterSchema = z.object({
    name: z.string().min(1),
    class: z.string().optional().default('Adventurer'),
    race: z.string().optional().default('Human'),
    level: z.number().int().min(1).optional().default(1),
    hp: z.number().int().min(1).optional(),
    maxHp: z.number().int().min(1).optional(),
    ac: z.number().int().min(0).optional().default(10),
    stats: z.object({
        str: z.number().int().min(0).default(10),
        dex: z.number().int().min(0).default(10),
        con: z.number().int().min(0).default(10),
        int: z.number().int().min(0).default(10),
        wis: z.number().int().min(0).default(10),
        cha: z.number().int().min(0).default(10),
    }).optional(),
    characterType: CharacterTypeSchema.optional().default('pc'),
    background: z.string().optional(),
});

// Tool definitions
export const BatchTools = {
    BATCH_CREATE_CHARACTERS: {
        name: 'batch_create_characters',
        description: `Create multiple characters at once. Perfect for generating a party, a squad of enemies, or a group of NPCs.

Maximum 20 characters per call. Each character needs at minimum a name.

Example - Create a 4-person adventuring party:
{
  "characters": [
    { "name": "Valeros", "class": "Fighter", "race": "Human" },
    { "name": "Kyra", "class": "Cleric", "race": "Human" },
    { "name": "Merisiel", "class": "Rogue", "race": "Elf" },
    { "name": "Ezren", "class": "Wizard", "race": "Human" }
  ]
}

Example - Create enemy goblins:
{
  "characters": [
    { "name": "Goblin Warrior 1", "class": "Warrior", "race": "Goblin", "characterType": "enemy", "hp": 7, "ac": 15 },
    { "name": "Goblin Warrior 2", "class": "Warrior", "race": "Goblin", "characterType": "enemy", "hp": 7, "ac": 15 },
    { "name": "Goblin Boss", "class": "Champion", "race": "Goblin", "characterType": "enemy", "hp": 21, "ac": 17 }
  ]
}`,
        inputSchema: z.object({
            characters: z.array(BatchCharacterSchema)
                .min(1)
                .max(20)
                .describe('Array of characters to create (1-20)')
        })
    },

    BATCH_CREATE_NPCS: {
        name: 'batch_create_npcs',
        description: `Generate NPCs for a settlement or location. Creates a group of NPCs with specified roles.

Roles are flexible strings - use any profession like "blacksmith", "innkeeper", "guard captain", etc.

Example - Populate a village:
{
  "locationName": "Thornwood Village",
  "npcs": [
    { "name": "Marta", "role": "Innkeeper", "race": "Human" },
    { "name": "Grom", "role": "Blacksmith", "race": "Dwarf" },
    { "name": "Elara", "role": "Herbalist", "race": "Half-Elf" },
    { "name": "Captain Vance", "role": "Guard Captain", "race": "Human" }
  ]
}`,
        inputSchema: z.object({
            locationName: z.string().optional().describe('Name of the location these NPCs belong to'),
            npcs: z.array(z.object({
                name: z.string().min(1),
                role: z.string().describe('NPC profession or role'),
                race: z.string().optional().default('Human'),
                behavior: z.string().optional().describe('NPC personality or behavior pattern'),
                factionId: z.string().optional(),
            })).min(1).max(50).describe('Array of NPCs to create (1-50)')
        })
    },

    BATCH_DISTRIBUTE_ITEMS: {
        name: 'batch_distribute_items',
        description: `Give items to multiple characters at once. Perfect for starting equipment, loot distribution, or quest rewards.

Example - Give starting equipment:
{
  "distributions": [
    { "characterId": "char-1", "items": ["Longsword", "Chain Mail", "Shield"] },
    { "characterId": "char-2", "items": ["Staff", "Spellbook", "Component Pouch"] },
    { "characterId": "char-3", "items": ["Shortbow", "Leather Armor", "Thieves' Tools"] }
  ]
}

Example - Distribute loot:
{
  "distributions": [
    { "characterId": "party-leader", "items": ["Gold Ring", "Healing Potion"] },
    { "characterId": "wizard", "items": ["Scroll of Fireball", "Wand of Magic Missiles"] }
  ]
}`,
        inputSchema: z.object({
            distributions: z.array(z.object({
                characterId: z.string().describe('ID of the character to receive items'),
                items: z.array(z.string()).min(1).describe('List of item names to give')
            })).min(1).max(20).describe('Distribution list (1-20 recipients)')
        })
    }
} as const;

// Handlers

export async function handleBatchCreateCharacters(args: unknown, _ctx: SessionContext) {
    const { charRepo } = ensureDb();
    const parsed = BatchTools.BATCH_CREATE_CHARACTERS.inputSchema.parse(args);
    const now = new Date().toISOString();

    const createdCharacters: any[] = [];
    const errors: string[] = [];

    for (const charData of parsed.characters) {
        try {
            // Calculate HP from constitution if not provided
            const stats = charData.stats ?? { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
            const conModifier = Math.floor((stats.con - 10) / 2);
            const baseHp = Math.max(1, 8 + conModifier);
            const hp = charData.hp ?? baseHp;
            const maxHp = charData.maxHp ?? hp;

            const character = {
                ...charData,
                id: randomUUID(),
                stats,
                hp,
                maxHp,
                characterClass: charData.class || 'Adventurer',
                createdAt: now,
                updatedAt: now
            } as unknown as Character | NPC;

            charRepo.create(character);
            createdCharacters.push({
                id: character.id,
                name: charData.name,
                class: charData.class,
                race: charData.race,
                characterType: charData.characterType
            });
        } catch (err: any) {
            errors.push(`Failed to create ${charData.name}: ${err.message}`);
        }
    }

    let output = RichFormatter.header('Batch Characters Created', '👥');
    output += RichFormatter.characterList(createdCharacters as any);
    output += `\n*${createdCharacters.length} character(s) created*\n`;
    if (errors.length > 0) {
        output += RichFormatter.section('Errors');
        output += RichFormatter.list(errors);
    }
    output += RichFormatter.embedJson({ success: errors.length === 0, created: createdCharacters, createdCount: createdCharacters.length, errors: errors.length > 0 ? errors : undefined }, 'BATCH');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleBatchCreateNpcs(args: unknown, _ctx: SessionContext) {
    const { charRepo } = ensureDb();
    const parsed = BatchTools.BATCH_CREATE_NPCS.inputSchema.parse(args);
    const now = new Date().toISOString();

    const createdNpcs: any[] = [];
    const errors: string[] = [];

    for (const npcData of parsed.npcs) {
        try {
            const npc = {
                id: randomUUID(),
                name: npcData.name,
                race: npcData.race,
                characterClass: npcData.role, // Use role as class
                characterType: 'npc' as const,
                behavior: npcData.behavior,
                factionId: npcData.factionId,
                hp: 10,
                maxHp: 10,
                ac: 10,
                level: 1,
                stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
                createdAt: now,
                updatedAt: now,
                // Store location reference in metadata
                metadata: parsed.locationName ? { location: parsed.locationName } : undefined
            } as unknown as NPC;

            charRepo.create(npc);
            createdNpcs.push({
                id: npc.id,
                name: npcData.name,
                role: npcData.role,
                race: npcData.race,
                location: parsed.locationName
            });
        } catch (err: any) {
            errors.push(`Failed to create NPC ${npcData.name}: ${err.message}`);
        }
    }

    let output = RichFormatter.header('NPCs Created', '🧑');
    if (parsed.locationName) {
        output += RichFormatter.keyValue({ 'Location': parsed.locationName });
    }
    const rows = createdNpcs.map(n => [n.name, n.role, n.race]);
    output += RichFormatter.table(['Name', 'Role', 'Race'], rows);
    output += `\n*${createdNpcs.length} NPC(s) created*\n`;
    if (errors.length > 0) {
        output += RichFormatter.section('Errors');
        output += RichFormatter.list(errors);
    }
    output += RichFormatter.embedJson({ success: errors.length === 0, locationName: parsed.locationName, created: createdNpcs, createdCount: createdNpcs.length }, 'NPCS');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleBatchDistributeItems(args: unknown, _ctx: SessionContext) {
    const { db } = ensureDb();
    const parsed = BatchTools.BATCH_DISTRIBUTE_ITEMS.inputSchema.parse(args);

    const distributions: any[] = [];
    const errors: string[] = [];

    for (const dist of parsed.distributions) {
        try {
            // Get current character
            const charStmt = db.prepare('SELECT * FROM characters WHERE id = ?');
            const character = charStmt.get(dist.characterId) as any;

            if (!character) {
                errors.push(`Character not found: ${dist.characterId}`);
                continue;
            }

            // Parse existing inventory
            let inventory: string[] = [];
            if (character.inventory) {
                try {
                    inventory = JSON.parse(character.inventory);
                } catch {
                    inventory = [];
                }
            }

            // Add new items
            inventory.push(...dist.items);

            // Update character inventory
            const updateStmt = db.prepare('UPDATE characters SET inventory = ?, updatedAt = ? WHERE id = ?');
            updateStmt.run(JSON.stringify(inventory), new Date().toISOString(), dist.characterId);

            distributions.push({
                characterId: dist.characterId,
                characterName: character.name,
                itemsGiven: dist.items,
                newInventorySize: inventory.length
            });
        } catch (err: any) {
            errors.push(`Failed to distribute to ${dist.characterId}: ${err.message}`);
        }
    }

    const totalItems = distributions.reduce((sum, d) => sum + d.itemsGiven.length, 0);
    let output = RichFormatter.header('Items Distributed', '🎁');
    output += RichFormatter.keyValue({ 'Total Items': totalItems, 'Recipients': distributions.length });
    for (const dist of distributions) {
        output += `\n**${dist.characterName}**: ${dist.itemsGiven.join(', ')}\n`;
    }
    if (errors.length > 0) {
        output += RichFormatter.section('Errors');
        output += RichFormatter.list(errors);
    }
    output += RichFormatter.embedJson({ success: errors.length === 0, distributions, totalItemsDistributed: totalItems }, 'DIST');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}
