/**
 * Composite Tools
 *
 * High-level MCP tools that combine multiple operations into single calls.
 * These reduce token overhead by 80-95% for common workflows.
 *
 * TIER 1 Optimizations from tool efficiency analysis.
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import { SessionContext } from './types.js';
import { getDb } from '../storage/index.js';
import { CharacterRepository } from '../storage/repos/character.repo.js';
import { ItemRepository } from '../storage/repos/item.repo.js';
import { InventoryRepository } from '../storage/repos/inventory.repo.js';
import { PartyRepository } from '../storage/repos/party.repo.js';
import { POIRepository } from '../storage/repos/poi.repo.js';
import { SpatialRepository } from '../storage/repos/spatial.repo.js';
import { POICategory, POIIcon } from '../schema/poi.js';
import { BiomeType } from '../schema/spatial.js';
import { expandCreatureTemplate } from '../data/creature-presets.js';
import { getItemPreset, getArmorPreset } from '../data/items/index.js';
import { getCombatManager } from './state/combat-manager.js';
import { CombatEngine, CombatParticipant } from '../engine/combat/engine.js';
import { getPatternGenerator } from './terrain-patterns.js';
import { Character } from '../schema/character.js';
import { Item } from '../schema/inventory.js';
import { parsePosition as parsePos } from '../utils/schema-shorthand.js';

type TerrainPatternName = 'river_valley' | 'canyon' | 'arena' | 'mountain_pass' | 'maze' | 'maze_rooms';

// Re-export parsePosition from schema-shorthand for backwards compatibility
export { parsePosition } from '../utils/schema-shorthand.js';

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Build a complete Character object with defaults
// ═══════════════════════════════════════════════════════════════════════════

function buildCharacter(data: {
    id: string;
    name: string;
    stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
    hp: number;
    maxHp: number;
    ac: number;
    level: number;
    characterType: 'pc' | 'npc' | 'enemy' | 'neutral';
    race: string;
    characterClass: string;
    resistances?: string[];
    vulnerabilities?: string[];
    immunities?: string[];
    position?: { x: number; y: number };
    createdAt: string;
    updatedAt: string;
}): Character {
    return {
        id: data.id,
        name: data.name,
        stats: data.stats,
        hp: data.hp,
        maxHp: data.maxHp,
        ac: data.ac,
        level: data.level,
        xp: 0,
        characterType: data.characterType,
        race: data.race,
        characterClass: data.characterClass,
        conditions: [],
        perceptionBonus: 0,
        stealthBonus: 0,
        knownSpells: [],
        preparedSpells: [],
        cantripsKnown: [],
        maxSpellLevel: 0,
        concentratingOn: null,
        activeSpells: [],
        resistances: data.resistances || [],
        vulnerabilities: data.vulnerabilities || [],
        immunities: data.immunities || [],
        skillProficiencies: [],
        saveProficiencies: [],
        expertise: [],
        hasLairActions: false,
        position: data.position,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Build a complete Item object with defaults
// ═══════════════════════════════════════════════════════════════════════════

function buildItem(data: {
    id: string;
    name: string;
    description?: string;
    type: 'weapon' | 'armor' | 'consumable' | 'quest' | 'misc' | 'scroll';
    weight?: number;
    value?: number;
    properties?: Record<string, unknown>;
    createdAt: string;
    updatedAt: string;
}): Item {
    return {
        id: data.id,
        name: data.name,
        description: data.description,
        type: data.type,
        weight: data.weight ?? 0,
        value: data.value ?? 0,
        properties: data.properties,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Local alias for position parsing
// ═══════════════════════════════════════════════════════════════════════════

// Use parsePos from schema-shorthand utilities (imported above)
const parsePosition = parsePos;

/**
 * Parse a list of positions from shorthand
 */
export function parsePositionList(inputs: (string | { x: number; y: number })[]): string[] {
    return inputs.map(input => {
        if (typeof input === 'string') {
            // Already in "x,y" format
            const parts = input.split(',');
            return `${parts[0]},${parts[1]}`;
        }
        return `${input.x},${input.y}`;
    });
}

// ═══════════════════════════════════════════════════════════════════════════
// DB HELPER
// ═══════════════════════════════════════════════════════════════════════════

function ensureDb() {
    const dbPath = process.env.NODE_ENV === 'test'
        ? ':memory:'
        : process.env.RPG_DATA_DIR
            ? `${process.env.RPG_DATA_DIR}/rpg.db`
            : 'rpg.db';
    const db = getDb(dbPath);
    return {
        db,
        charRepo: new CharacterRepository(db),
        itemRepo: new ItemRepository(db),
        inventoryRepo: new InventoryRepository(db),
        partyRepo: new PartyRepository(db),
        poiRepo: new POIRepository(db),
        spatialRepo: new SpatialRepository(db)
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// TOOL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

export const CompositeTools = {
    // ─────────────────────────────────────────────────────────────────────────
    // SETUP_TACTICAL_ENCOUNTER
    // ─────────────────────────────────────────────────────────────────────────
    SETUP_TACTICAL_ENCOUNTER: {
        name: 'setup_tactical_encounter',
        description: `Create a full combat encounter with creatures from presets and terrain patterns.

REPLACES: create_encounter + N×create_character + N×update_terrain (6-12 calls → 1 call)
TOKEN SAVINGS: ~90%

Creature templates: "goblin", "goblin:archer", "skeleton:warrior", "orc:berserker"
Position shorthand: "10,5" instead of {x:10, y:5, z:0}

Example - Goblin Ambush:
{
  "seed": "goblin-ambush",
  "participants": [
    { "template": "goblin:warrior", "position": "5,5" },
    { "template": "goblin:warrior", "position": "7,5" },
    { "template": "goblin:archer", "position": "6,2" },
    { "template": "hobgoblin:captain", "name": "Grishnak", "position": "6,3" }
  ],
  "terrain": {
    "obstacles": ["3,3", "3,4", "8,3", "8,4"],
    "difficultTerrain": ["5,6", "6,6", "7,6"]
  },
  "partyPositions": ["10,10", "11,10", "10,11", "11,11"]
}

Available creature templates: goblin, goblin:warrior, goblin:archer, goblin:boss, goblin:shaman,
skeleton, skeleton:warrior, skeleton:archer, zombie, zombie:brute, orc, orc:warrior, orc:berserker,
hobgoblin, hobgoblin:captain, wolf, dire_wolf, bandit, bandit_captain, ogre, troll, and more.
`,
        inputSchema: z.object({
            seed: z.string().describe('Seed for deterministic combat'),
            participants: z.array(z.object({
                template: z.string().describe('Creature template like "goblin:archer"'),
                name: z.string().optional().describe('Override the default name'),
                position: z.union([
                    z.string().regex(/^\d+,\d+(,\d+)?$/).describe('Position as "x,y" or "x,y,z"'),
                    z.object({ x: z.number(), y: z.number(), z: z.number().optional() })
                ]).describe('Position shorthand or object'),
                isEnemy: z.boolean().optional().default(true)
            })).min(1).describe('Enemy creatures to spawn'),
            terrain: z.object({
                obstacles: z.array(z.string()).optional().describe('Obstacle positions as "x,y" strings'),
                difficultTerrain: z.array(z.string()).optional().describe('Difficult terrain positions'),
                water: z.array(z.string()).optional().describe('Water positions'),
                pattern: z.string().optional().describe('Terrain pattern name (e.g., "river", "canyon")')
            }).optional().describe('Terrain configuration'),
            partyPositions: z.array(z.union([
                z.string().regex(/^\d+,\d+(,\d+)?$/),
                z.object({ x: z.number(), y: z.number(), z: z.number().optional() })
            ])).optional().describe('Starting positions for party members'),
            partyId: z.string().optional().describe('Party ID to auto-add party members'),
            gridSize: z.object({
                width: z.number().int().min(10).max(100).default(20),
                height: z.number().int().min(10).max(100).default(20)
            }).optional().describe('Grid dimensions')
        })
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SPAWN_EQUIPPED_CHARACTER
    // ─────────────────────────────────────────────────────────────────────────
    SPAWN_EQUIPPED_CHARACTER: {
        name: 'spawn_equipped_character',
        description: `Create a character with equipment from presets in a single call.

REPLACES: create_character + N×(create_item + give_item + equip_item) (8-16 calls → 1 call)
TOKEN SAVINGS: ~85%

Equipment can be preset names or full item specs.

Example - Dwarf Fighter:
{
  "name": "Gimli",
  "race": "Dwarf",
  "characterClass": "fighter",
  "level": 5,
  "stats": { "str": 18, "dex": 12, "con": 16, "int": 10, "wis": 12, "cha": 8 },
  "equipment": ["battleaxe", "chain_mail", "shield"],
  "partyId": "fellowship-123"
}

Example - From creature template:
{
  "template": "bandit_captain",
  "name": "Red Raven",
  "equipment": ["rapier", "studded_leather"],
  "characterType": "npc"
}

Available equipment presets: All PHB weapons (longsword, shortbow, greataxe...),
armor (chain_mail, plate, leather...), and gear (rope, torch, healers_kit...).
`,
        inputSchema: z.object({
            // Option 1: From template
            template: z.string().optional().describe('Creature template to use as base stats'),
            // Option 2: Manual stats
            name: z.string().describe('Character name'),
            race: z.string().optional().default('Human'),
            characterClass: z.string().optional().default('fighter'),
            level: z.number().int().min(1).max(20).optional().default(1),
            stats: z.object({
                str: z.number().int().min(1).max(30),
                dex: z.number().int().min(1).max(30),
                con: z.number().int().min(1).max(30),
                int: z.number().int().min(1).max(30),
                wis: z.number().int().min(1).max(30),
                cha: z.number().int().min(1).max(30)
            }).optional(),
            hp: z.number().int().min(1).optional(),
            maxHp: z.number().int().min(1).optional(),
            ac: z.number().int().min(0).optional(),
            // Equipment
            equipment: z.array(z.union([
                z.string().describe('Item preset name like "longsword" or "chain_mail"'),
                z.object({
                    preset: z.string(),
                    slot: z.enum(['mainhand', 'offhand', 'armor', 'head', 'feet', 'accessory']).optional()
                })
            ])).optional().default([]).describe('Equipment presets to create and equip'),
            // Character type (matches CharacterTypeSchema: pc, npc, enemy, neutral)
            characterType: z.enum(['pc', 'npc', 'enemy', 'neutral']).optional().default('pc'),
            // Party assignment
            partyId: z.string().optional().describe('Party to add character to'),
            partyRole: z.enum(['leader', 'member', 'companion', 'hireling']).optional().default('member')
        })
    },

    // ─────────────────────────────────────────────────────────────────────────
    // INITIALIZE_SESSION
    // ─────────────────────────────────────────────────────────────────────────
    INITIALIZE_SESSION: {
        name: 'initialize_session',
        description: `Initialize a new game session with world, party, and starting location.

REPLACES: create_world + create_party + N×create_character + move_party (6-10 calls → 1 call)

Example:
{
  "worldName": "Forgotten Realms",
  "partyName": "The Silver Blades",
  "characters": [
    { "name": "Valeros", "race": "Human", "characterClass": "fighter", "equipment": ["longsword", "chain_mail", "shield"] },
    { "name": "Seoni", "race": "Human", "characterClass": "sorcerer", "equipment": ["quarterstaff"] }
  ],
  "startingLocation": { "name": "Sandpoint", "x": 50, "y": 50 }
}
`,
        inputSchema: z.object({
            worldName: z.string().optional().default('New World'),
            worldSeed: z.string().optional(),
            partyName: z.string(),
            characters: z.array(z.object({
                name: z.string(),
                race: z.string().optional().default('Human'),
                characterClass: z.string().optional().default('fighter'),
                level: z.number().int().min(1).optional().default(1),
                stats: z.object({
                    str: z.number().int(),
                    dex: z.number().int(),
                    con: z.number().int(),
                    int: z.number().int(),
                    wis: z.number().int(),
                    cha: z.number().int()
                }).optional(),
                equipment: z.array(z.string()).optional().default([]),
                isLeader: z.boolean().optional()
            })).min(1),
            startingLocation: z.object({
                name: z.string(),
                x: z.number().int().optional(),
                y: z.number().int().optional()
            }).optional()
        })
    },

    // ─────────────────────────────────────────────────────────────────────────
    // SPAWN_POPULATED_LOCATION
    // ─────────────────────────────────────────────────────────────────────────
    SPAWN_POPULATED_LOCATION: {
        name: 'spawn_populated_location',
        description: `Create a complete location with POI, optional room network, and inhabitants in one call.

REPLACES: create_poi + create_network + N×create_room + N×spawn_character + N×(create_item + place_item)
TOKEN SAVINGS: ~90%

Example - Goblin Cave:
{
  "worldId": "world-123",
  "name": "Shadowfang Cave",
  "category": "dungeon",
  "icon": "cave",
  "position": "50,30",
  "description": "A dark cave system rumored to house goblin raiders",
  "level": 3,
  "tags": ["goblin", "cave", "treasure"],
  "rooms": [
    { "name": "Cave Entrance", "description": "A shadowy opening in the hillside...", "biome": "cavern" },
    { "name": "Guard Chamber", "description": "A small alcove where guards keep watch...", "biome": "cavern", "exits": ["north"] }
  ],
  "inhabitants": [
    { "template": "goblin:warrior", "room": 0, "count": 2 },
    { "template": "goblin:archer", "room": 1 },
    { "template": "hobgoblin:captain", "name": "Skullcrusher", "room": 1 }
  ],
  "loot": [
    { "preset": "longsword", "room": 1 },
    { "preset": "potion_healing", "room": 0, "count": 2 }
  ]
}

Example - Village Inn:
{
  "worldId": "world-123",
  "name": "The Prancing Pony",
  "category": "commercial",
  "icon": "inn",
  "position": "100,75",
  "population": 15,
  "discoveryState": "discovered",
  "rooms": [
    { "name": "Common Room", "description": "A warm tavern with crackling fireplace...", "biome": "urban" },
    { "name": "Kitchen", "description": "The busy kitchen smells of fresh bread...", "biome": "urban", "exits": ["west"] }
  ],
  "inhabitants": [
    { "name": "Barliman Butterbur", "race": "Human", "characterType": "npc", "room": 0 },
    { "template": "bandit", "name": "Suspicious Stranger", "characterType": "neutral", "room": 0 }
  ]
}

Categories: settlement, fortification, dungeon, landmark, religious, commercial, natural, hidden
Icons: city, town, village, castle, fort, tower, dungeon, cave, ruins, temple, shrine, inn, market, mine, farm, camp
Biomes: forest, mountain, urban, dungeon, coastal, cavern, divine, arcane`,
        inputSchema: z.object({
            // POI basics
            worldId: z.string().describe('World ID to create the location in'),
            name: z.string().min(1).max(100).describe('Location name'),
            category: z.enum(['settlement', 'fortification', 'dungeon', 'landmark', 'religious', 'commercial', 'natural', 'hidden'])
                .describe('POI category'),
            icon: z.enum(['city', 'town', 'village', 'castle', 'fort', 'tower', 'dungeon', 'cave', 'ruins', 'temple', 'shrine', 'inn', 'market', 'mine', 'farm', 'camp', 'portal', 'monument', 'tree', 'mountain', 'lake', 'waterfall', 'bridge', 'crossroads', 'unknown'])
                .describe('Map icon'),
            position: z.union([
                z.string().regex(/^\d+,\d+$/).describe('Position as "x,y"'),
                z.object({ x: z.number().int().min(0), y: z.number().int().min(0) })
            ]).describe('World map position'),
            description: z.string().max(500).optional().describe('Brief description for map tooltip'),

            // POI metadata
            population: z.number().int().min(0).optional().default(0).describe('Population for settlements'),
            level: z.number().int().min(1).max(20).optional().describe('Suggested character level for dungeons'),
            tags: z.array(z.string()).optional().default([]).describe('Searchable tags'),
            discoveryState: z.enum(['unknown', 'rumored', 'discovered', 'explored', 'mapped']).optional().default('unknown'),
            discoveryDC: z.number().int().min(0).max(30).optional().describe('DC to discover if hidden'),

            // Room network (optional)
            rooms: z.array(z.object({
                name: z.string().min(1).max(100),
                description: z.string().min(10).max(2000).describe('Room description'),
                biome: z.enum(['forest', 'mountain', 'urban', 'dungeon', 'coastal', 'cavern', 'divine', 'arcane'])
                    .optional().default('dungeon'),
                exits: z.array(z.enum(['north', 'south', 'east', 'west', 'up', 'down'])).optional()
                    .describe('Directions this room connects to (auto-linked sequentially if not specified)')
            })).optional().describe('Rooms to create (first room is entrance)'),

            // Inhabitants
            inhabitants: z.array(z.object({
                // From template OR manual
                template: z.string().optional().describe('Creature template like "goblin:warrior"'),
                name: z.string().optional().describe('Character name (required if no template)'),
                race: z.string().optional().default('Human'),
                characterClass: z.string().optional().default('commoner'),
                level: z.number().int().min(1).optional(),
                characterType: z.enum(['npc', 'enemy', 'neutral']).optional().default('enemy'),
                // Placement
                room: z.number().int().min(0).optional().describe('Room index to place in (0 = entrance)'),
                count: z.number().int().min(1).max(20).optional().default(1).describe('Number to spawn')
            })).optional().default([]).describe('NPCs/creatures to populate the location'),

            // Loot/items
            loot: z.array(z.object({
                preset: z.string().describe('Item preset name'),
                room: z.number().int().min(0).optional().describe('Room index to place in'),
                count: z.number().int().min(1).max(99).optional().default(1)
            })).optional().default([]).describe('Items to place in the location')
        })
    }
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// HANDLERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Handle setup_tactical_encounter
 */
export async function handleSetupTacticalEncounter(args: unknown, _ctx: SessionContext) {
    const parsed = CompositeTools.SETUP_TACTICAL_ENCOUNTER.inputSchema.parse(args);
    const { charRepo } = ensureDb();

    const combatManager = getCombatManager();
    const now = new Date().toISOString();

    // Build participants from templates
    const participants: CombatParticipant[] = [];
    const createdCharacterIds: string[] = [];

    for (let i = 0; i < parsed.participants.length; i++) {
        const p = parsed.participants[i];
        const preset = expandCreatureTemplate(p.template, p.name);

        if (!preset) {
            throw new Error(`Unknown creature template: ${p.template}`);
        }

        const pos = parsePosition(p.position);
        const characterId = randomUUID();

        // Create character in database using the helper for proper schema compliance
        const character = buildCharacter({
            id: characterId,
            name: preset.name,
            stats: preset.stats,
            hp: preset.hp,
            maxHp: preset.maxHp,
            ac: preset.ac,
            level: preset.level,
            characterType: preset.characterType,
            race: preset.race || 'Unknown',
            characterClass: preset.characterClass || 'monster',
            resistances: preset.resistances || [],
            vulnerabilities: preset.vulnerabilities || [],
            immunities: preset.immunities || [],
            position: { x: pos.x, y: pos.y },
            createdAt: now,
            updatedAt: now
        });

        charRepo.create(character);
        createdCharacterIds.push(characterId);

        // Build combat participant
        const dexMod = Math.floor((preset.stats.dex - 10) / 2);
        participants.push({
            id: characterId,
            name: preset.name,
            hp: preset.hp,
            maxHp: preset.maxHp,
            initiative: 0, // Will be rolled
            initiativeBonus: dexMod,
            isEnemy: p.isEnemy ?? true,
            conditions: [],
            position: pos,
            size: preset.size || 'medium',
            movementSpeed: preset.speed || 30,
            movementRemaining: preset.speed || 30,
            resistances: preset.resistances || [],
            vulnerabilities: preset.vulnerabilities || [],
            immunities: preset.immunities || []
        });
    }

    // Add party members if partyId provided
    if (parsed.partyId && parsed.partyPositions) {
        const { partyRepo } = ensureDb();
        const party = partyRepo.getPartyWithMembers(parsed.partyId);

        if (party && party.members) {
            for (let i = 0; i < party.members.length && i < parsed.partyPositions.length; i++) {
                const member = party.members[i];
                const pos = parsePosition(parsed.partyPositions[i]);
                const char = member.character;
                const dexMod = Math.floor((char.stats.dex - 10) / 2);

                participants.push({
                    id: char.id,
                    name: char.name,
                    hp: char.hp,
                    maxHp: char.maxHp,
                    initiative: 0,
                    initiativeBonus: dexMod,
                    isEnemy: false,
                    conditions: [],
                    position: pos,
                    size: 'medium',
                    movementSpeed: 30,
                    movementRemaining: 30,
                    resistances: (char as any).resistances || [],
                    vulnerabilities: (char as any).vulnerabilities || [],
                    immunities: (char as any).immunities || []
                });
            }
        }
    }

    // Build terrain
    let terrain: { obstacles: string[]; difficultTerrain?: string[]; water?: string[] } = {
        obstacles: parsed.terrain?.obstacles || [],
        difficultTerrain: parsed.terrain?.difficultTerrain,
        water: parsed.terrain?.water
    };

    // Apply pattern if specified (validate against known pattern names)
    if (parsed.terrain?.pattern) {
        const validPatterns: TerrainPatternName[] = ['river_valley', 'canyon', 'arena', 'mountain_pass', 'maze', 'maze_rooms'];
        if (validPatterns.includes(parsed.terrain.pattern as TerrainPatternName)) {
            const patternGen = getPatternGenerator(parsed.terrain.pattern as TerrainPatternName);
            const width = parsed.gridSize?.width || 20;
            const height = parsed.gridSize?.height || 20;
            const patternTerrain = patternGen(0, 0, width, height);
            terrain = {
                obstacles: [...terrain.obstacles, ...patternTerrain.obstacles],
                difficultTerrain: [...(terrain.difficultTerrain || []), ...(patternTerrain.difficultTerrain || [])],
                water: [...(terrain.water || []), ...(patternTerrain.water || [])]
            };
        }
    }

    // Create encounter using CombatEngine and CombatManager
    const encounterId = `encounter-${parsed.seed}-${Date.now()}`;
    const engine = new CombatEngine(parsed.seed);
    const encounterState = engine.startEncounter(participants);
    // Add terrain to the state (CRIT-003 pattern from combat-tools.ts)
    (encounterState as any).terrain = terrain;
    combatManager.create(encounterId, engine);

    // Generate ASCII map
    const width = parsed.gridSize?.width || 20;
    const height = parsed.gridSize?.height || 20;
    const asciiMap = generateEncounterMap({ state: encounterState }, width, height);

    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify({
                encounterId,
                round: encounterState.round,
                participantCount: participants.length,
                enemyCount: participants.filter(p => p.isEnemy).length,
                friendlyCount: participants.filter(p => !p.isEnemy).length,
                createdCharacterIds,
                turnOrder: encounterState.turnOrder.map((id: string) => {
                    const p = encounterState.participants.find((pp: CombatParticipant) => pp.id === id);
                    return { id, name: p?.name, initiative: p?.initiative };
                }),
                currentTurn: encounterState.turnOrder[0],
                terrain: {
                    obstacleCount: terrain.obstacles.length,
                    difficultTerrainCount: terrain.difficultTerrain?.length || 0,
                    waterCount: terrain.water?.length || 0
                },
                asciiMap
            }, null, 2)
        }]
    };
}

/**
 * Handle spawn_equipped_character
 */
export async function handleSpawnEquippedCharacter(args: unknown, _ctx: SessionContext) {
    const parsed = CompositeTools.SPAWN_EQUIPPED_CHARACTER.inputSchema.parse(args);
    const { charRepo, itemRepo, inventoryRepo, partyRepo } = ensureDb();

    const now = new Date().toISOString();
    const characterId = randomUUID();

    // Build character from template or manual stats
    let characterData: Character;

    if (parsed.template) {
        const preset = expandCreatureTemplate(parsed.template, parsed.name);
        if (!preset) {
            throw new Error(`Unknown creature template: ${parsed.template}`);
        }
        characterData = buildCharacter({
            id: characterId,
            name: parsed.name || preset.name,
            stats: parsed.stats || preset.stats,
            hp: parsed.hp || preset.hp,
            maxHp: parsed.maxHp || preset.maxHp,
            ac: parsed.ac || preset.ac,
            level: parsed.level || preset.level,
            characterType: parsed.characterType || preset.characterType,
            race: parsed.race || preset.race || 'Unknown',
            characterClass: parsed.characterClass || preset.characterClass || 'monster',
            resistances: preset.resistances || [],
            vulnerabilities: preset.vulnerabilities || [],
            immunities: preset.immunities || [],
            createdAt: now,
            updatedAt: now
        });
    } else {
        // Manual character creation
        const stats = parsed.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
        const conMod = Math.floor((stats.con - 10) / 2);
        const defaultHp = 10 + conMod + ((parsed.level || 1) - 1) * (5 + conMod);

        characterData = buildCharacter({
            id: characterId,
            name: parsed.name,
            stats,
            hp: parsed.hp || defaultHp,
            maxHp: parsed.maxHp || defaultHp,
            ac: parsed.ac || 10 + Math.floor((stats.dex - 10) / 2),
            level: parsed.level || 1,
            characterType: parsed.characterType || 'pc',
            race: parsed.race || 'Human',
            characterClass: parsed.characterClass || 'fighter',
            createdAt: now,
            updatedAt: now
        });
    }

    // Create character
    charRepo.create(characterData);

    // Create and equip items
    const equippedItems: { itemId: string; name: string; slot?: string }[] = [];
    let calculatedAC = 10 + Math.floor((characterData.stats.dex - 10) / 2);

    for (const equipSpec of parsed.equipment || []) {
        const presetName = typeof equipSpec === 'string' ? equipSpec : equipSpec.preset;
        const requestedSlot = typeof equipSpec === 'object' ? equipSpec.slot : undefined;

        const preset = getItemPreset(presetName);
        if (!preset) {
            console.warn(`Unknown item preset: ${presetName}, skipping`);
            continue;
        }

        // Create item using helper for proper schema compliance
        const itemId = randomUUID();
        // Map preset types to valid item types
        let itemType: 'weapon' | 'armor' | 'consumable' | 'quest' | 'misc' | 'scroll';
        if (preset.type === 'weapon') itemType = 'weapon';
        else if (preset.type === 'armor') itemType = 'armor';
        else if (preset.type === 'gear' || preset.type === 'tool') itemType = 'misc';
        else if (preset.type === 'consumable') itemType = 'consumable';
        else if (preset.type === 'magic') itemType = (preset as any).baseItem ? 'weapon' : 'misc';
        else itemType = 'misc';

        const item = buildItem({
            id: itemId,
            name: preset.name,
            description: (preset as any).description || '',
            type: itemType,
            weight: (preset as any).weight || 0,
            value: (preset as any).value || 0,
            properties: preset as any,
            createdAt: now,
            updatedAt: now
        });
        itemRepo.create(item);

        // Give to character
        inventoryRepo.addItem(characterId, itemId, 1);

        // Determine slot and equip
        let slot = requestedSlot;
        if (!slot) {
            if (preset.type === 'weapon') {
                slot = 'mainhand';
            } else if (preset.type === 'armor') {
                const armorPreset = preset as any;
                slot = armorPreset.category === 'shield' ? 'offhand' : 'armor';
            }
        }

        if (slot) {
            inventoryRepo.equipItem(characterId, itemId, slot);
            equippedItems.push({ itemId, name: preset.name, slot });

            // Update AC for armor
            if (preset.type === 'armor') {
                const armorPreset = getArmorPreset(presetName);
                if (armorPreset) {
                    if (armorPreset.category === 'shield') {
                        calculatedAC += armorPreset.ac;
                    } else {
                        const dexMod = Math.floor((characterData.stats.dex - 10) / 2);
                        const maxDex = armorPreset.maxDexBonus ?? 99;
                        const effectiveDex = Math.min(dexMod, maxDex);
                        calculatedAC = armorPreset.ac + effectiveDex;
                    }
                }
            }
        } else {
            equippedItems.push({ itemId, name: preset.name });
        }
    }

    // Update character AC based on armor
    if (calculatedAC !== characterData.ac) {
        charRepo.update(characterId, { ac: calculatedAC });
        characterData.ac = calculatedAC;
    }

    // Add to party if specified
    let partyInfo: { partyId: string; partyName: string; role: string } | null = null;
    if (parsed.partyId) {
        const party = partyRepo.findById(parsed.partyId);
        if (party) {
            partyRepo.addMember({
                id: randomUUID(),
                partyId: parsed.partyId,
                characterId,
                role: parsed.partyRole || 'member',
                isActive: false,
                sharePercentage: 100,
                joinedAt: now
            });
            partyInfo = {
                partyId: parsed.partyId,
                partyName: party.name,
                role: parsed.partyRole || 'member'
            };
        }
    }

    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify({
                character: {
                    id: characterId,
                    name: characterData.name,
                    race: characterData.race,
                    class: characterData.characterClass,
                    level: characterData.level,
                    hp: characterData.hp,
                    maxHp: characterData.maxHp,
                    ac: characterData.ac,
                    stats: characterData.stats,
                    type: characterData.characterType
                },
                equipment: equippedItems,
                party: partyInfo,
                message: `Created ${characterData.name} (${characterData.race} ${characterData.characterClass}) with ${equippedItems.length} items equipped`
            }, null, 2)
        }]
    };
}

/**
 * Handle initialize_session (stub - needs world tools integration)
 */
export async function handleInitializeSession(args: unknown, _ctx: SessionContext) {
    const parsed = CompositeTools.INITIALIZE_SESSION.inputSchema.parse(args);

    // This is a stub - full implementation needs world tools
    // For now, create party and characters

    const { charRepo, partyRepo } = ensureDb();
    const now = new Date().toISOString();

    // Create party
    const partyId = randomUUID();
    partyRepo.create({
        id: partyId,
        name: parsed.partyName,
        status: 'active',
        formation: 'standard',
        currentLocation: parsed.startingLocation?.name,
        positionX: parsed.startingLocation?.x,
        positionY: parsed.startingLocation?.y,
        createdAt: now,
        updatedAt: now,
        lastPlayedAt: now
    });

    // Create characters
    const createdCharacters: { id: string; name: string; race: string; class: string; level: number }[] = [];
    let leaderId: string | null = null;

    for (const charSpec of parsed.characters) {
        const characterId = randomUUID();
        const stats = charSpec.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
        const conMod = Math.floor((stats.con - 10) / 2);
        const hp = 10 + conMod + ((charSpec.level || 1) - 1) * (5 + conMod);

        const character = buildCharacter({
            id: characterId,
            name: charSpec.name,
            stats,
            hp,
            maxHp: hp,
            ac: 10 + Math.floor((stats.dex - 10) / 2),
            level: charSpec.level || 1,
            characterType: 'pc',
            race: charSpec.race || 'Human',
            characterClass: charSpec.characterClass || 'fighter',
            createdAt: now,
            updatedAt: now
        });
        charRepo.create(character);

        // Add to party
        const role = charSpec.isLeader ? 'leader' : 'member';
        partyRepo.addMember({
            id: randomUUID(),
            partyId,
            characterId,
            role,
            isActive: charSpec.isLeader || false,
            sharePercentage: 100,
            joinedAt: now
        });

        if (charSpec.isLeader) {
            leaderId = characterId;
        }

        createdCharacters.push({
            id: characterId,
            name: charSpec.name,
            race: charSpec.race || 'Human',
            class: charSpec.characterClass || 'fighter',
            level: charSpec.level || 1
        });
    }

    // Set leader if specified
    if (leaderId) {
        partyRepo.setLeader(partyId, leaderId);
    }

    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify({
                session: {
                    partyId,
                    partyName: parsed.partyName,
                    location: parsed.startingLocation?.name || 'Unknown',
                    characters: createdCharacters,
                    leaderId
                },
                message: `Session initialized: ${parsed.partyName} with ${createdCharacters.length} characters`
            }, null, 2)
        }]
    };
}

/**
 * Handle spawn_populated_location
 */
export async function handleSpawnPopulatedLocation(args: unknown, _ctx: SessionContext) {
    const parsed = CompositeTools.SPAWN_POPULATED_LOCATION.inputSchema.parse(args);
    const { charRepo, itemRepo, spatialRepo, poiRepo } = ensureDb();

    const now = new Date().toISOString();

    // Parse position
    let posX: number;
    let posY: number;
    if (typeof parsed.position === 'string') {
        const parts = parsed.position.split(',');
        posX = parseInt(parts[0], 10);
        posY = parseInt(parts[1], 10);
    } else {
        posX = parsed.position.x;
        posY = parsed.position.y;
    }

    // Create network and rooms if rooms are specified
    let networkId: string | undefined;
    let entranceRoomId: string | undefined;
    const createdRooms: { id: string; name: string; index: number }[] = [];

    if (parsed.rooms && parsed.rooms.length > 0) {
        // Create the node network
        networkId = randomUUID();
        spatialRepo.createNetwork({
            id: networkId,
            name: `${parsed.name} Network`,
            type: 'cluster',
            worldId: parsed.worldId,
            centerX: posX,
            centerY: posY,
            createdAt: now,
            updatedAt: now
        });

        // Create rooms
        const roomIds: string[] = [];
        for (let i = 0; i < parsed.rooms.length; i++) {
            const roomSpec = parsed.rooms[i];
            const roomId = randomUUID();
            roomIds.push(roomId);

            if (i === 0) {
                entranceRoomId = roomId;
            }

            spatialRepo.create({
                id: roomId,
                name: roomSpec.name,
                baseDescription: roomSpec.description,
                biomeContext: (roomSpec.biome || 'dungeon') as BiomeType,
                atmospherics: [],
                exits: [],
                entityIds: [],
                networkId,
                localX: i % 5, // Simple grid layout
                localY: Math.floor(i / 5),
                visitedCount: 0,
                createdAt: now,
                updatedAt: now
            });

            createdRooms.push({ id: roomId, name: roomSpec.name, index: i });
        }

        // Auto-link rooms sequentially (each room connects to next with north/south)
        for (let i = 0; i < roomIds.length - 1; i++) {
            const currentRoom = parsed.rooms[i];
            // Only auto-link if exits not explicitly specified
            if (!currentRoom.exits || currentRoom.exits.length === 0) {
                // Link current to next (north)
                spatialRepo.addExit(roomIds[i], {
                    direction: 'north',
                    targetNodeId: roomIds[i + 1],
                    type: 'OPEN'
                });
                // Link next to current (south)
                spatialRepo.addExit(roomIds[i + 1], {
                    direction: 'south',
                    targetNodeId: roomIds[i],
                    type: 'OPEN'
                });
            }
        }
    }

    // Create POI
    const poiId = randomUUID();
    poiRepo.create({
        id: poiId,
        worldId: parsed.worldId,
        x: posX,
        y: posY,
        name: parsed.name,
        description: parsed.description,
        category: parsed.category as POICategory,
        icon: parsed.icon as POIIcon,
        networkId,
        entranceRoomId,
        discoveryState: parsed.discoveryState || 'unknown',
        discoveredBy: [],
        discoveryDC: parsed.discoveryDC,
        childPOIIds: [],
        population: parsed.population || 0,
        level: parsed.level,
        tags: parsed.tags || [],
        createdAt: now,
        updatedAt: now
    });

    // Spawn inhabitants
    const createdInhabitants: { id: string; name: string; template?: string; roomId?: string; roomName?: string }[] = [];

    for (const inhab of parsed.inhabitants || []) {
        const count = inhab.count || 1;

        for (let c = 0; c < count; c++) {
            const characterId = randomUUID();
            let characterData: Character;

            if (inhab.template) {
                const preset = expandCreatureTemplate(inhab.template, inhab.name);
                if (!preset) {
                    console.warn(`Unknown creature template: ${inhab.template}, skipping`);
                    continue;
                }

                // For multiple spawns, add number suffix
                const displayName = count > 1 && !inhab.name
                    ? `${preset.name} ${c + 1}`
                    : (inhab.name || preset.name);

                characterData = buildCharacter({
                    id: characterId,
                    name: displayName,
                    stats: preset.stats,
                    hp: preset.hp,
                    maxHp: preset.maxHp,
                    ac: preset.ac,
                    level: inhab.level || preset.level,
                    characterType: inhab.characterType || preset.characterType,
                    race: inhab.race || preset.race || 'Unknown',
                    characterClass: inhab.characterClass || preset.characterClass || 'monster',
                    resistances: preset.resistances || [],
                    vulnerabilities: preset.vulnerabilities || [],
                    immunities: preset.immunities || [],
                    createdAt: now,
                    updatedAt: now
                });
            } else {
                // Manual character
                if (!inhab.name) {
                    console.warn('Inhabitant without template must have a name, skipping');
                    continue;
                }

                const stats = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };
                const level = inhab.level || 1;
                const conMod = Math.floor((stats.con - 10) / 2);
                const hp = 8 + conMod + (level - 1) * (5 + conMod);

                characterData = buildCharacter({
                    id: characterId,
                    name: inhab.name,
                    stats,
                    hp,
                    maxHp: hp,
                    ac: 10,
                    level,
                    characterType: inhab.characterType || 'npc',
                    race: inhab.race || 'Human',
                    characterClass: inhab.characterClass || 'commoner',
                    createdAt: now,
                    updatedAt: now
                });
            }

            // Set current room if rooms exist
            const roomIndex = inhab.room ?? 0;
            let roomId: string | undefined;
            let roomName: string | undefined;

            if (createdRooms.length > 0 && roomIndex < createdRooms.length) {
                roomId = createdRooms[roomIndex].id;
                roomName = createdRooms[roomIndex].name;
                characterData.currentRoomId = roomId;
            }

            charRepo.create(characterData);

            // Add entity to room
            if (roomId) {
                spatialRepo.addEntityToRoom(roomId, characterId);
            }

            createdInhabitants.push({
                id: characterId,
                name: characterData.name,
                template: inhab.template,
                roomId,
                roomName
            });
        }
    }

    // Place loot
    const placedLoot: { itemId: string; name: string; count: number; roomId?: string; roomName?: string }[] = [];

    for (const lootSpec of parsed.loot || []) {
        const preset = getItemPreset(lootSpec.preset);
        if (!preset) {
            console.warn(`Unknown item preset: ${lootSpec.preset}, skipping`);
            continue;
        }

        // Create item
        const itemId = randomUUID();
        let itemType: 'weapon' | 'armor' | 'consumable' | 'quest' | 'misc' | 'scroll';
        if (preset.type === 'weapon') itemType = 'weapon';
        else if (preset.type === 'armor') itemType = 'armor';
        else if (preset.type === 'gear' || preset.type === 'tool') itemType = 'misc';
        else if (preset.type === 'consumable') itemType = 'consumable';
        else if (preset.type === 'magic') itemType = (preset as any).baseItem ? 'weapon' : 'misc';
        else itemType = 'misc';

        const item = buildItem({
            id: itemId,
            name: preset.name,
            description: (preset as any).description || '',
            type: itemType,
            weight: (preset as any).weight || 0,
            value: (preset as any).value || 0,
            properties: preset as any,
            createdAt: now,
            updatedAt: now
        });
        itemRepo.create(item);

        // Determine room
        const roomIndex = lootSpec.room ?? 0;
        let roomId: string | undefined;
        let roomName: string | undefined;

        if (createdRooms.length > 0 && roomIndex < createdRooms.length) {
            roomId = createdRooms[roomIndex].id;
            roomName = createdRooms[roomIndex].name;
            // Add item to room's entity list
            spatialRepo.addEntityToRoom(roomId, itemId);
        }

        placedLoot.push({
            itemId,
            name: preset.name,
            count: lootSpec.count || 1,
            roomId,
            roomName
        });
    }

    return {
        content: [{
            type: 'text' as const,
            text: JSON.stringify({
                poi: {
                    id: poiId,
                    name: parsed.name,
                    category: parsed.category,
                    icon: parsed.icon,
                    position: { x: posX, y: posY },
                    discoveryState: parsed.discoveryState || 'unknown',
                    level: parsed.level,
                    population: parsed.population || 0
                },
                network: networkId ? {
                    id: networkId,
                    roomCount: createdRooms.length,
                    entranceRoomId
                } : null,
                rooms: createdRooms,
                inhabitants: createdInhabitants,
                loot: placedLoot,
                summary: {
                    totalInhabitants: createdInhabitants.length,
                    totalLootItems: placedLoot.reduce((sum, l) => sum + l.count, 0),
                    totalRooms: createdRooms.length
                },
                message: `Created ${parsed.name} with ${createdRooms.length} rooms, ${createdInhabitants.length} inhabitants, and ${placedLoot.length} loot items`
            }, null, 2)
        }]
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPER: Generate ASCII map
// ═══════════════════════════════════════════════════════════════════════════

function generateEncounterMap(encounter: any, width: number, height: number): string {
    const grid: string[][] = [];
    for (let y = 0; y < height; y++) {
        grid[y] = [];
        for (let x = 0; x < width; x++) {
            grid[y][x] = '·';
        }
    }

    // Place terrain
    const terrain = encounter.state.terrain || {};
    for (const obs of terrain.obstacles || []) {
        const [x, y] = obs.split(',').map(Number);
        if (x >= 0 && x < width && y >= 0 && y < height) {
            grid[y][x] = '█';
        }
    }
    for (const dt of terrain.difficultTerrain || []) {
        const [x, y] = dt.split(',').map(Number);
        if (x >= 0 && x < width && y >= 0 && y < height && grid[y][x] === '·') {
            grid[y][x] = '░';
        }
    }
    for (const w of terrain.water || []) {
        const [x, y] = w.split(',').map(Number);
        if (x >= 0 && x < width && y >= 0 && y < height && grid[y][x] === '·') {
            grid[y][x] = '~';
        }
    }

    // Place participants
    let friendlyIdx = 0;
    let enemyIdx = 0;
    for (const p of encounter.state.participants) {
        if (!p.position) continue;
        const { x, y } = p.position;
        if (x >= 0 && x < width && y >= 0 && y < height) {
            if (p.hp <= 0) {
                grid[y][x] = '☠';
            } else if (p.isEnemy) {
                grid[y][x] = String((enemyIdx % 9) + 1);
                enemyIdx++;
            } else {
                grid[y][x] = String.fromCharCode(65 + (friendlyIdx % 26));
                friendlyIdx++;
            }
        }
    }

    // Build output
    let output = '';
    for (let y = 0; y < height; y++) {
        output += grid[y].join('') + '\n';
    }
    return output;
}
