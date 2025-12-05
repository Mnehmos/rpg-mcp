# Design Proposal: Theft & Loot Systems
## HIGH-008 (Stolen Item Tracking) + FAILED-004 (Loot/Corpse System)

**Date:** December 5, 2025  
**Status:** DESIGN PHASE  
**Author:** Claude (TDD Framework Session)  
**Estimated Effort:** 4-6 hours implementation + 2 hours testing

---

## Executive Summary

This proposal outlines a modular, robust implementation for two interconnected systems:
1. **Stolen Item Tracking** (HIGH-008): Provenance tracking, heat decay, fence mechanics
2. **Corpse/Loot System** (FAILED-004): Death-triggered loot containers, loot tables, harvesting

These systems share infrastructure (item provenance tracking) and must integrate cleanly with existing inventory, combat, and NPC memory systems.

---

## Part 1: Stolen Item Tracking System (HIGH-008)

### Core Data Model

```typescript
// New schema: src/schema/theft.ts

import { z } from 'zod';

export const HeatLevelSchema = z.enum(['burning', 'hot', 'warm', 'cool', 'cold']);
export type HeatLevel = z.infer<typeof HeatLevelSchema>;

export const StolenItemRecordSchema = z.object({
    id: z.string().uuid(),
    itemId: z.string(),
    stolenFrom: z.string().describe('Original owner character ID'),
    stolenBy: z.string().describe('Thief character ID'),
    stolenAt: z.string().datetime(),
    stolenLocation: z.string().nullable().describe('Region/structure ID where theft occurred'),
    
    // Heat system
    heatLevel: HeatLevelSchema.default('burning'),
    heatUpdatedAt: z.string().datetime(),
    
    // Detection
    reportedToGuards: z.boolean().default(false),
    bounty: z.number().int().min(0).default(0),
    witnesses: z.array(z.string()).default([]).describe('NPC IDs who witnessed the theft'),
    
    // Resolution
    recovered: z.boolean().default(false),
    recoveredAt: z.string().datetime().nullable(),
    fenced: z.boolean().default(false),
    fencedAt: z.string().datetime().nullable(),
    fencedTo: z.string().nullable().describe('Fence NPC ID'),
    
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
});

export type StolenItemRecord = z.infer<typeof StolenItemRecordSchema>;

export const FenceNpcSchema = z.object({
    npcId: z.string(),
    factionId: z.string().nullable().describe("e.g., 'thieves-guild'"),
    buyRate: z.number().min(0.1).max(1.0).default(0.4).describe('Fraction of item value they pay'),
    maxHeatLevel: HeatLevelSchema.default('hot').describe('Maximum heat they will accept'),
    dailyHeatCapacity: z.number().int().min(0).default(100).describe('Total heat points they can absorb per day'),
    currentDailyHeat: z.number().int().min(0).default(0),
    lastResetAt: z.string().datetime(),
    specializations: z.array(z.string()).default([]).describe('Item types they prefer'),
    cooldownDays: z.number().int().min(0).default(7).describe('Days to remove stolen flag'),
    reputation: z.number().int().min(0).max(100).default(50).describe('Fence reliability')
});

export type FenceNpc = z.infer<typeof FenceNpcSchema>;

// Heat level to numeric value for capacity calculations
export const HEAT_VALUES: Record<HeatLevel, number> = {
    burning: 100,
    hot: 50,
    warm: 25,
    cool: 10,
    cold: 5
};

// Heat decay rules (in game days)
export const HEAT_DECAY_RULES = {
    burning_to_hot: 1,    // 1 day
    hot_to_warm: 3,       // 3 days
    warm_to_cool: 7,      // 1 week
    cool_to_cold: 14,     // 2 weeks
    cold_fully: 30        // Never fully clears for unique items
};
```

### Database Tables

```sql
-- Add to migrations.ts

CREATE TABLE IF NOT EXISTS stolen_items(
    id TEXT PRIMARY KEY,
    item_id TEXT NOT NULL,
    stolen_from TEXT NOT NULL,
    stolen_by TEXT NOT NULL,
    stolen_at TEXT NOT NULL,
    stolen_location TEXT,
    
    heat_level TEXT NOT NULL DEFAULT 'burning' CHECK (heat_level IN ('burning', 'hot', 'warm', 'cool', 'cold')),
    heat_updated_at TEXT NOT NULL,
    
    reported_to_guards INTEGER NOT NULL DEFAULT 0,
    bounty INTEGER NOT NULL DEFAULT 0,
    witnesses TEXT NOT NULL DEFAULT '[]',
    
    recovered INTEGER NOT NULL DEFAULT 0,
    recovered_at TEXT,
    fenced INTEGER NOT NULL DEFAULT 0,
    fenced_at TEXT,
    fenced_to TEXT,
    
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    
    FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE,
    FOREIGN KEY(stolen_from) REFERENCES characters(id),
    FOREIGN KEY(stolen_by) REFERENCES characters(id)
);

CREATE INDEX IF NOT EXISTS idx_stolen_items_item ON stolen_items(item_id);
CREATE INDEX IF NOT EXISTS idx_stolen_items_thief ON stolen_items(stolen_by);
CREATE INDEX IF NOT EXISTS idx_stolen_items_victim ON stolen_items(stolen_from);
CREATE INDEX IF NOT EXISTS idx_stolen_items_heat ON stolen_items(heat_level);

CREATE TABLE IF NOT EXISTS fence_npcs(
    npc_id TEXT PRIMARY KEY,
    faction_id TEXT,
    buy_rate REAL NOT NULL DEFAULT 0.4,
    max_heat_level TEXT NOT NULL DEFAULT 'hot',
    daily_heat_capacity INTEGER NOT NULL DEFAULT 100,
    current_daily_heat INTEGER NOT NULL DEFAULT 0,
    last_reset_at TEXT NOT NULL,
    specializations TEXT NOT NULL DEFAULT '[]',
    cooldown_days INTEGER NOT NULL DEFAULT 7,
    reputation INTEGER NOT NULL DEFAULT 50,
    FOREIGN KEY(npc_id) REFERENCES characters(id) ON DELETE CASCADE
);
```

### Repository Layer

```typescript
// src/storage/repos/theft.repo.ts

export class TheftRepository {
    constructor(private db: Database.Database) {}
    
    // ============================================================
    // STOLEN ITEM OPERATIONS
    // ============================================================
    
    /**
     * Record a theft event
     */
    recordTheft(record: Omit<StolenItemRecord, 'id' | 'createdAt' | 'updatedAt' | 'heatUpdatedAt' | 'recovered' | 'fenced'>): StolenItemRecord;
    
    /**
     * Check if an item is stolen
     */
    isStolen(itemId: string): boolean;
    
    /**
     * Get theft record for an item
     */
    getTheftRecord(itemId: string): StolenItemRecord | null;
    
    /**
     * Get all stolen items held by a character
     */
    getStolenItemsHeldBy(characterId: string): StolenItemRecord[];
    
    /**
     * Get all items stolen FROM a character
     */
    getItemsStolenFrom(characterId: string): StolenItemRecord[];
    
    /**
     * Update heat level (called by decay system)
     */
    updateHeatLevel(itemId: string, newHeat: HeatLevel): void;
    
    /**
     * Mark item as recovered (returned to owner or confiscated)
     */
    markRecovered(itemId: string): void;
    
    /**
     * Mark item as fenced (sold to fence, stolen flag can be removed later)
     */
    markFenced(itemId: string, fenceId: string): void;
    
    /**
     * Remove stolen flag completely (after cooldown period)
     */
    clearStolenFlag(itemId: string): void;
    
    /**
     * Process heat decay for all stolen items (call on game time advance)
     */
    processHeatDecay(gameTimeAdvancedDays: number): void;
    
    // ============================================================
    // FENCE OPERATIONS
    // ============================================================
    
    /**
     * Register an NPC as a fence
     */
    registerFence(fence: Omit<FenceNpc, 'currentDailyHeat' | 'lastResetAt'>): void;
    
    /**
     * Get fence data for an NPC
     */
    getFence(npcId: string): FenceNpc | null;
    
    /**
     * List all fences (optionally by faction)
     */
    listFences(factionId?: string): FenceNpc[];
    
    /**
     * Check if fence will accept an item
     */
    canFenceAccept(fenceId: string, stolenRecord: StolenItemRecord): { 
        accepted: boolean; 
        reason?: string;
        price?: number;
    };
    
    /**
     * Record a fence transaction
     */
    recordFenceTransaction(fenceId: string, stolenRecord: StolenItemRecord, price: number): void;
    
    /**
     * Reset daily heat capacity for all fences (call on game day advance)
     */
    resetFenceDailyCapacity(): void;
}
```

### MCP Tools

```typescript
// New tools for theft system

export const TheftTools = {
    STEAL_ITEM: {
        name: 'steal_item',
        description: `Record a theft event. This marks an item as stolen from one character and gives it to another.
        
The theft creates a "hot" item record that:
- Can be detected by the original owner
- May trigger guard searches
- Affects NPC disposition if detected
- Decays over time (burning → cold)

Example:
{
  "thiefId": "rogue-1",
  "victimId": "merchant-1", 
  "itemId": "ruby-necklace",
  "witnesses": ["guard-1"],
  "locationId": "marketplace"
}`,
        inputSchema: z.object({
            thiefId: z.string().describe('Character performing the theft'),
            victimId: z.string().describe('Character being stolen from'),
            itemId: z.string().describe('Item being stolen'),
            witnesses: z.array(z.string()).optional().describe('NPCs who witnessed the theft'),
            locationId: z.string().optional().describe('Where the theft occurred')
        })
    },
    
    CHECK_ITEM_STOLEN: {
        name: 'check_item_stolen',
        description: 'Check if an item is stolen and get its provenance details.',
        inputSchema: z.object({
            itemId: z.string()
        })
    },
    
    CHECK_STOLEN_ITEMS_ON_CHARACTER: {
        name: 'check_stolen_items_on_character',
        description: `Check if a character is carrying any stolen items.
Useful for guard searches, merchant inspections, etc.`,
        inputSchema: z.object({
            characterId: z.string(),
            checkerId: z.string().optional().describe('The NPC/guard doing the checking')
        })
    },
    
    CHECK_ITEM_RECOGNITION: {
        name: 'check_item_recognition',
        description: `Check if an NPC recognizes a stolen item as theirs or as stolen.
- Original owner always recognizes their items
- Guards have a chance based on bounty/heat
- Other NPCs rarely recognize unless item is famous`,
        inputSchema: z.object({
            npcId: z.string().describe('NPC who might recognize the item'),
            characterId: z.string().describe('Character carrying the item'),
            itemId: z.string().describe('Item to check')
        })
    },
    
    SELL_TO_FENCE: {
        name: 'sell_to_fence',
        description: `Sell a stolen item to a fence NPC.
Fences pay reduced prices but don't ask questions.
After cooldown period, the stolen flag is removed.`,
        inputSchema: z.object({
            sellerId: z.string(),
            fenceId: z.string(),
            itemId: z.string()
        })
    },
    
    REGISTER_FENCE: {
        name: 'register_fence',
        description: 'Register an NPC as a fence (buys stolen goods).',
        inputSchema: z.object({
            npcId: z.string(),
            factionId: z.string().optional(),
            buyRate: z.number().min(0.1).max(1.0).optional(),
            maxHeatLevel: HeatLevelSchema.optional(),
            specializations: z.array(z.string()).optional()
        })
    },
    
    REPORT_THEFT: {
        name: 'report_theft',
        description: 'Report a theft to guards, setting bounty and increasing detection chance.',
        inputSchema: z.object({
            reporterId: z.string(),
            itemId: z.string(),
            bountyOffered: z.number().int().min(0).optional()
        })
    },
    
    ADVANCE_HEAT_DECAY: {
        name: 'advance_heat_decay',
        description: 'Process heat decay for all stolen items (call when game time advances).',
        inputSchema: z.object({
            daysAdvanced: z.number().int().min(1)
        })
    }
};
```

### Integration with Existing Systems

#### NPC Memory Integration
When an NPC recognizes a stolen item:
```typescript
// Automatic relationship update
npcMemoryRepo.upsertRelationship({
    characterId: thief.id,
    npcId: victim.id,
    familiarity: 'enemy',  // Caught stealing
    disposition: 'hostile',
    notes: `Caught stealing ${item.name} on ${timestamp}`
});

npcMemoryRepo.recordMemory({
    characterId: thief.id,
    npcId: victim.id,
    summary: `${thief.name} stole my ${item.name}!`,
    importance: 'critical',
    topics: ['theft', 'crime', item.name]
});
```

#### Inventory Integration
The `inventory.repo.ts` needs a hook for theft tracking:
```typescript
// In transferItem or removeItem for theft context
if (isTheftContext) {
    theftRepo.recordTheft({ ... });
}
```

---

## Part 2: Corpse/Loot System (FAILED-004)

### Core Data Model

```typescript
// New schema: src/schema/corpse.ts

import { z } from 'zod';

export const CorpseStateSchema = z.enum(['fresh', 'decaying', 'skeletal', 'gone']);
export type CorpseState = z.infer<typeof CorpseStateSchema>;

export const CorpseSchema = z.object({
    id: z.string().uuid(),
    characterId: z.string().describe('Original character/creature ID'),
    characterName: z.string(),
    characterType: z.enum(['pc', 'npc', 'enemy', 'neutral']),
    
    // Location
    worldId: z.string().nullable(),
    regionId: z.string().nullable(),
    position: z.object({
        x: z.number(),
        y: z.number()
    }).nullable(),
    encounterId: z.string().nullable().describe('Encounter where death occurred'),
    
    // State
    state: CorpseStateSchema.default('fresh'),
    stateUpdatedAt: z.string().datetime(),
    
    // Loot
    lootGenerated: z.boolean().default(false),
    looted: z.boolean().default(false),
    lootedBy: z.string().nullable(),
    lootedAt: z.string().datetime().nullable(),
    
    // Harvesting
    harvestable: z.boolean().default(false),
    harvestableResources: z.array(z.object({
        resourceType: z.string(),
        quantity: z.number().int(),
        harvested: z.boolean().default(false)
    })).default([]),
    
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime()
});

export type Corpse = z.infer<typeof CorpseSchema>;

export const LootTableEntrySchema = z.object({
    itemId: z.string().nullable().describe('Specific item ID, or null for template-based'),
    itemTemplateId: z.string().nullable().describe('Item template to instantiate'),
    itemName: z.string().optional().describe('Name for dynamic item creation'),
    quantity: z.object({
        min: z.number().int().min(0),
        max: z.number().int().min(0)
    }),
    weight: z.number().min(0).max(1).describe('Drop probability 0-1'),
    conditions: z.array(z.string()).optional().describe('Conditions for this drop')
});

export const LootTableSchema = z.object({
    id: z.string(),
    name: z.string(),
    creatureTypes: z.array(z.string()).describe('Creature types this applies to (e.g., "goblin", "dragon")'),
    crRange: z.object({
        min: z.number().min(0),
        max: z.number().min(0)
    }).optional(),
    guaranteedDrops: z.array(LootTableEntrySchema).default([]),
    randomDrops: z.array(LootTableEntrySchema).default([]),
    currencyRange: z.object({
        gold: z.object({ min: z.number(), max: z.number() }),
        silver: z.object({ min: z.number(), max: z.number() }).optional(),
        copper: z.object({ min: z.number(), max: z.number() }).optional()
    }).optional(),
    harvestableResources: z.array(z.object({
        resourceType: z.string(),
        quantity: z.object({ min: z.number(), max: z.number() }),
        dcRequired: z.number().int().optional()
    })).optional()
});

export type LootTable = z.infer<typeof LootTableSchema>;

// Corpse decay rules (in game hours)
export const CORPSE_DECAY_RULES = {
    fresh_to_decaying: 24,    // 1 day
    decaying_to_skeletal: 168, // 1 week
    skeletal_to_gone: 720      // 30 days
};
```

### Database Tables

```sql
CREATE TABLE IF NOT EXISTS corpses(
    id TEXT PRIMARY KEY,
    character_id TEXT NOT NULL,
    character_name TEXT NOT NULL,
    character_type TEXT NOT NULL,
    
    world_id TEXT,
    region_id TEXT,
    position_x INTEGER,
    position_y INTEGER,
    encounter_id TEXT,
    
    state TEXT NOT NULL DEFAULT 'fresh' CHECK (state IN ('fresh', 'decaying', 'skeletal', 'gone')),
    state_updated_at TEXT NOT NULL,
    
    loot_generated INTEGER NOT NULL DEFAULT 0,
    looted INTEGER NOT NULL DEFAULT 0,
    looted_by TEXT,
    looted_at TEXT,
    
    harvestable INTEGER NOT NULL DEFAULT 0,
    harvestable_resources TEXT NOT NULL DEFAULT '[]',
    
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_corpses_encounter ON corpses(encounter_id);
CREATE INDEX IF NOT EXISTS idx_corpses_world_position ON corpses(world_id, position_x, position_y);
CREATE INDEX IF NOT EXISTS idx_corpses_state ON corpses(state);

CREATE TABLE IF NOT EXISTS corpse_inventory(
    corpse_id TEXT NOT NULL,
    item_id TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    looted INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY(corpse_id, item_id),
    FOREIGN KEY(corpse_id) REFERENCES corpses(id) ON DELETE CASCADE,
    FOREIGN KEY(item_id) REFERENCES items(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS loot_tables(
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    creature_types TEXT NOT NULL DEFAULT '[]',
    cr_min REAL,
    cr_max REAL,
    guaranteed_drops TEXT NOT NULL DEFAULT '[]',
    random_drops TEXT NOT NULL DEFAULT '[]',
    currency_range TEXT,
    harvestable_resources TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_loot_tables_name ON loot_tables(name);
```

### Repository Layer

```typescript
// src/storage/repos/corpse.repo.ts

export class CorpseRepository {
    constructor(private db: Database.Database) {}
    
    /**
     * Create a corpse when a character dies
     */
    createFromDeath(characterId: string, options: {
        encounterId?: string;
        position?: { x: number; y: number };
        worldId?: string;
        regionId?: string;
    }): Corpse;
    
    /**
     * Get corpse by ID
     */
    findById(id: string): Corpse | null;
    
    /**
     * Get corpse for a specific character
     */
    findByCharacterId(characterId: string): Corpse | null;
    
    /**
     * Get all corpses in an encounter
     */
    findByEncounterId(encounterId: string): Corpse[];
    
    /**
     * Get corpses in a region
     */
    findByRegion(worldId: string, regionId: string): Corpse[];
    
    /**
     * Get corpses at a specific position
     */
    findAtPosition(worldId: string, x: number, y: number): Corpse[];
    
    /**
     * Generate loot for a corpse based on loot tables
     */
    generateLoot(corpseId: string, creatureType: string, cr?: number): void;
    
    /**
     * Get items in corpse inventory (not yet looted)
     */
    getCorpseInventory(corpseId: string): Array<{ itemId: string; quantity: number; looted: boolean }>;
    
    /**
     * Loot an item from a corpse
     */
    lootItem(corpseId: string, itemId: string, looterId: string, quantity?: number): boolean;
    
    /**
     * Loot all items from a corpse
     */
    lootAll(corpseId: string, looterId: string): Array<{ itemId: string; quantity: number }>;
    
    /**
     * Harvest resources from a corpse
     */
    harvestResource(corpseId: string, resourceType: string, harvesterId: string): {
        success: boolean;
        quantity: number;
        resourceType: string;
    };
    
    /**
     * Process corpse decay (call on game time advance)
     */
    processDecay(gameTimeAdvancedHours: number): void;
    
    /**
     * Clean up gone corpses
     */
    cleanupGoneCorpses(): number;
}

// src/storage/repos/loot-table.repo.ts

export class LootTableRepository {
    constructor(private db: Database.Database) {}
    
    create(table: LootTable): void;
    findById(id: string): LootTable | null;
    findByCreatureType(type: string, cr?: number): LootTable | null;
    list(): LootTable[];
    update(id: string, updates: Partial<LootTable>): LootTable | null;
    delete(id: string): boolean;
    
    /**
     * Roll on a loot table and return items to add
     */
    rollLoot(tableId: string, seed?: string): Array<{
        itemId?: string;
        itemTemplateId?: string;
        itemName?: string;
        quantity: number;
    }>;
}
```

### Combat Integration

The key integration point is `handleEndEncounter` in `combat-tools.ts`:

```typescript
// In handleEndEncounter, after syncing HP:

// FAILED-004: Create corpses for defeated combatants
const corpseRepo = new CorpseRepository(db);
const lootTableRepo = new LootTableRepository(db);

for (const participant of finalState.participants) {
    if (participant.hp <= 0 && participant.isEnemy) {
        // Create corpse
        const corpse = corpseRepo.createFromDeath(participant.id, {
            encounterId: parsed.encounterId,
            position: participant.position
        });
        
        // Try to find and generate loot
        const lootTable = lootTableRepo.findByCreatureType(
            participant.creatureType || 'generic',
            participant.cr
        );
        
        if (lootTable) {
            corpseRepo.generateLoot(corpse.id, participant.creatureType, participant.cr);
        } else {
            // Fallback: Transfer participant's inventory to corpse
            // (if they had any items)
        }
    }
}
```

### MCP Tools

```typescript
export const CorpseTools = {
    GET_CORPSE: {
        name: 'get_corpse',
        description: 'Get details about a corpse, including loot and harvestable resources.',
        inputSchema: z.object({
            corpseId: z.string()
        })
    },
    
    LIST_CORPSES_IN_ENCOUNTER: {
        name: 'list_corpses_in_encounter',
        description: 'List all corpses from a combat encounter.',
        inputSchema: z.object({
            encounterId: z.string()
        })
    },
    
    LIST_CORPSES_NEARBY: {
        name: 'list_corpses_nearby',
        description: 'List corpses near a position in the world.',
        inputSchema: z.object({
            worldId: z.string(),
            x: z.number(),
            y: z.number(),
            radius: z.number().int().min(1).max(10).default(3)
        })
    },
    
    LOOT_CORPSE: {
        name: 'loot_corpse',
        description: `Loot items from a corpse. Can loot specific items or all at once.
        
Example (loot specific):
{
  "characterId": "hero-1",
  "corpseId": "corpse-goblin-1",
  "itemId": "rusty-sword",
  "quantity": 1
}

Example (loot all):
{
  "characterId": "hero-1",
  "corpseId": "corpse-goblin-1",
  "lootAll": true
}`,
        inputSchema: z.object({
            characterId: z.string().describe('Character doing the looting'),
            corpseId: z.string(),
            itemId: z.string().optional().describe('Specific item to loot'),
            quantity: z.number().int().min(1).optional(),
            lootAll: z.boolean().optional().describe('Loot everything from the corpse')
        })
    },
    
    HARVEST_CORPSE: {
        name: 'harvest_corpse',
        description: `Harvest resources from a corpse (e.g., dragon scales, wolf pelts).
May require a skill check depending on the resource.`,
        inputSchema: z.object({
            characterId: z.string(),
            corpseId: z.string(),
            resourceType: z.string(),
            skillBonus: z.number().int().optional().describe('Skill bonus for harvest check')
        })
    },
    
    CREATE_LOOT_TABLE: {
        name: 'create_loot_table',
        description: 'Create a loot table for a creature type.',
        inputSchema: LootTableSchema.omit({ id: true })
    },
    
    GET_LOOT_TABLE: {
        name: 'get_loot_table',
        description: 'Get a loot table by ID or creature type.',
        inputSchema: z.object({
            id: z.string().optional(),
            creatureType: z.string().optional(),
            cr: z.number().optional()
        })
    }
};
```

---

## Part 3: Edge Cases & TDD Failure Points

### Theft System Edge Cases

| Scenario | Expected Behavior | Test Case |
|----------|-------------------|-----------|
| Steal same item twice | Record updates, heat resets to burning | `theft-double-steal.test.ts` |
| Steal from corpse | Not tracked as theft (looting) | `theft-corpse-loot.test.ts` |
| Transfer stolen item to accomplice | Theft record follows item, heat preserved | `theft-transfer.test.ts` |
| Original owner dies | Heat still decays, but can't be returned | `theft-owner-death.test.ts` |
| Fence at capacity | Transaction rejected | `fence-capacity.test.ts` |
| Fence faction requirement | Non-guild members pay more/rejected | `fence-faction.test.ts` |
| Unique item sold to fence | Stolen flag eventually clears but item traceable | `fence-unique-item.test.ts` |
| Guard search, no stolen items | Clean result, no reputation change | `search-clean.test.ts` |
| Guard search, hot items | Detection based on heat level | `search-heat-detection.test.ts` |
| Item recognition in conversation | NPC mentions item if visible and recognized | `recognition-dialogue.test.ts` |

### Corpse/Loot System Edge Cases

| Scenario | Expected Behavior | Test Case |
|----------|-------------------|-----------|
| PC dies, becomes corpse | Corpse created but marked differently (resurrection possible) | `pc-death-corpse.test.ts` |
| Enemy has no loot table | Empty corpse or generic loot | `no-loot-table.test.ts` |
| Loot from decayed corpse | Some items may be destroyed | `decayed-corpse-loot.test.ts` |
| Skeletal corpse | Only bones/durable items remain | `skeletal-corpse.test.ts` |
| Corpse gone, items still in DB | Items deleted on cleanup | `corpse-cleanup.test.ts` |
| Harvest requires DC, no skill | Automatic failure or default DC | `harvest-no-skill.test.ts` |
| Multiple characters loot same corpse | First come, first served | `concurrent-loot.test.ts` |
| Loot stolen item from corpse | Theft provenance preserved | `loot-stolen-from-corpse.test.ts` |
| Corpse in encounter that ended | Corpse persists in region | `corpse-after-encounter.test.ts` |
| Resurrect character with looted corpse | Corpse becomes invalid, character HP = 1 | `resurrect-looted.test.ts` |

### Cross-System Edge Cases

| Scenario | Systems Involved | Expected Behavior |
|----------|------------------|-------------------|
| Steal item, victim dies, loot corpse | Theft + Corpse | Item on corpse shows stolen provenance |
| Fence stolen item from corpse | Theft + Corpse + Fence | Works, but heat still applies |
| Kill witness to theft | Theft + Combat + Corpse | Witness removed from record |
| NPC recognizes stolen item, attacks | Theft + NPC Memory + Combat | Combat initiated, relationship hostile |
| Party member caught stealing | Theft + Party | Party reputation affected |

---

## Part 4: Implementation Plan

### Phase 1: Schema & Migrations (1 hour)
1. Create `src/schema/theft.ts`
2. Create `src/schema/corpse.ts`
3. Update `src/storage/migrations.ts` with new tables
4. Run migrations on test database

### Phase 2: Repository Layer (2 hours)
1. Implement `TheftRepository`
2. Implement `CorpseRepository`
3. Implement `LootTableRepository`
4. Write repository unit tests

### Phase 3: MCP Tools (2 hours)
1. Implement theft tools in `src/server/theft-tools.ts`
2. Implement corpse/loot tools in `src/server/corpse-tools.ts`
3. Register tools in MCP server
4. Write integration tests

### Phase 4: Combat Integration (1 hour)
1. Update `handleEndEncounter` to create corpses
2. Update combat state to track creature types/CR
3. Test combat → corpse flow

### Phase 5: Testing & Documentation (1 hour)
1. Write TDD test suite covering edge cases
2. Update `Agents/TOOL_CATALOG.md`
3. Update `Agents/EMERGENT_DISCOVERY_LOG.md`

---

## Part 5: Test File Structure

```
tests/
├── server/
│   ├── theft.test.ts           # Core theft functionality
│   ├── theft-fence.test.ts     # Fence mechanics
│   ├── theft-detection.test.ts # Recognition and searches
│   ├── corpse.test.ts          # Core corpse functionality
│   ├── corpse-loot.test.ts     # Looting mechanics
│   ├── corpse-harvest.test.ts  # Resource harvesting
│   └── loot-tables.test.ts     # Loot table CRUD and rolling
├── integration/
│   ├── theft-inventory.test.ts # Theft + inventory system
│   ├── theft-npc-memory.test.ts # Theft + NPC relationships
│   ├── combat-corpse.test.ts   # Combat → corpse creation
│   └── theft-corpse-fence.test.ts # Full theft pipeline
└── edge-cases/
    ├── theft-edge-cases.test.ts
    └── corpse-edge-cases.test.ts
```

---

## Part 6: Acceptance Criteria

### HIGH-008 (Stolen Items) Complete When:
- [ ] `steal_item` tool creates theft record with heat tracking
- [ ] `check_item_stolen` returns provenance data
- [ ] Original owner always recognizes their items
- [ ] Heat decays over game time
- [ ] Fences buy stolen goods at reduced rate
- [ ] Fences have daily capacity limits
- [ ] Stolen flag can be cleared after cooldown
- [ ] Guards detect stolen items based on heat level
- [ ] NPC relationships update on theft detection
- [ ] All 10 theft edge case tests pass

### FAILED-004 (Corpse/Loot) Complete When:
- [ ] Corpses created automatically when enemies die in combat
- [ ] Corpses have position data from combat
- [ ] Loot tables can be defined per creature type
- [ ] `loot_corpse` transfers items to character
- [ ] `harvest_corpse` extracts resources with optional DC
- [ ] Corpses decay over game time
- [ ] Decayed corpses have reduced/destroyed loot
- [ ] Skeletal corpses cleaned up automatically
- [ ] All 10 corpse edge case tests pass
- [ ] Combat integration creates corpses on encounter end

---

## Appendix: Default Loot Tables

```typescript
export const DEFAULT_LOOT_TABLES: LootTable[] = [
    {
        id: 'loot-goblin',
        name: 'Goblin Loot',
        creatureTypes: ['goblin', 'hobgoblin'],
        crRange: { min: 0, max: 2 },
        guaranteedDrops: [],
        randomDrops: [
            { itemName: 'Rusty Scimitar', quantity: { min: 0, max: 1 }, weight: 0.3 },
            { itemName: 'Shortbow', quantity: { min: 0, max: 1 }, weight: 0.2 },
            { itemName: 'Crude Arrow', quantity: { min: 1, max: 10 }, weight: 0.5 }
        ],
        currencyRange: {
            gold: { min: 0, max: 2 },
            silver: { min: 1, max: 10 },
            copper: { min: 5, max: 30 }
        },
        harvestableResources: [
            { resourceType: 'goblin ear', quantity: { min: 1, max: 2 }, dcRequired: 10 }
        ]
    },
    {
        id: 'loot-dragon',
        name: 'Dragon Loot',
        creatureTypes: ['dragon', 'drake', 'wyvern'],
        crRange: { min: 5, max: 30 },
        guaranteedDrops: [
            { itemName: 'Dragon Scale', quantity: { min: 3, max: 10 }, weight: 1.0 }
        ],
        randomDrops: [
            { itemName: 'Dragon Tooth', quantity: { min: 1, max: 4 }, weight: 0.6 },
            { itemName: 'Dragon Blood Vial', quantity: { min: 0, max: 2 }, weight: 0.3 }
        ],
        currencyRange: {
            gold: { min: 500, max: 5000 }
        },
        harvestableResources: [
            { resourceType: 'dragon hide', quantity: { min: 5, max: 20 }, dcRequired: 15 },
            { resourceType: 'dragon heart', quantity: { min: 1, max: 1 }, dcRequired: 20 }
        ]
    }
];
```

---

## Ready for Implementation

This design document provides a complete, modular, TDD-ready specification for both systems. The implementation follows existing patterns in the codebase (Zod schemas, repository layer, MCP tool registration) and integrates cleanly with combat, inventory, and NPC memory systems.

**Next Step:** Begin with Phase 1 (Schema & Migrations) and write failing tests for the core repository methods.
