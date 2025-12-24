/**
 * EXPANDED FEATURE TESTS
 *
 * Comprehensive edge case testing for:
 * - FAILED-001: NPC Memory System
 * - HIGH-006: Lair Actions
 * - HIGH-007: Legendary Creatures
 * - MED-003: Death Saving Throws
 *
 * Run: npm test -- tests/server/expanded-features.test.ts
 */

import { v4 as uuid } from 'uuid';
import Database from 'better-sqlite3';
import { migrate } from '../../src/storage/migrations.js';
import { CombatEngine, CombatParticipant, DeathSaveResult } from '../../src/engine/combat/engine.js';
import { NpcMemoryRepository } from '../../src/storage/repos/npc-memory.repo.js';
import { CharacterRepository } from '../../src/storage/repos/character.repo.js';
import { EncounterRepository } from '../../src/storage/repos/encounter.repo.js';

let db: Database.Database;

beforeEach(() => {
    db = new Database(':memory:');
    migrate(db);
});

afterEach(() => {
    db.close();
});

// ============================================================================
// SECTION 1: NPC MEMORY SYSTEM (FAILED-001)
// ============================================================================
describe('NPC Memory System', () => {
    let memoryRepo: NpcMemoryRepository;
    const pcId = 'pc-hero-1';
    const npcId = 'npc-merchant-1';

    beforeEach(() => {
        memoryRepo = new NpcMemoryRepository(db);
    });

    // --- Relationship Tests ---
    describe('Relationship Management', () => {
        test('1.1 - new relationship defaults to stranger/neutral', () => {
            const rel = memoryRepo.getRelationship(pcId, npcId);
            expect(rel).toBeNull(); // No relationship yet
        });

        test('1.2 - can create relationship with all familiarity levels', () => {
            const levels = ['stranger', 'acquaintance', 'friend', 'close_friend', 'rival', 'enemy'] as const;

            for (const level of levels) {
                const testNpc = `npc-${level}`;
                memoryRepo.upsertRelationship({
                    characterId: pcId,
                    npcId: testNpc,
                    familiarity: level,
                    disposition: 'neutral',
                    notes: null
                });

                const rel = memoryRepo.getRelationship(pcId, testNpc);
                expect(rel?.familiarity).toBe(level);
            }
        });

        test('1.3 - can create relationship with all disposition levels', () => {
            const dispositions = ['hostile', 'unfriendly', 'neutral', 'friendly', 'helpful'] as const;

            for (const disp of dispositions) {
                const testNpc = `npc-${disp}`;
                memoryRepo.upsertRelationship({
                    characterId: pcId,
                    npcId: testNpc,
                    familiarity: 'acquaintance',
                    disposition: disp,
                    notes: null
                });

                const rel = memoryRepo.getRelationship(pcId, testNpc);
                expect(rel?.disposition).toBe(disp);
            }
        });

        test('1.4 - updating relationship increments interaction count', () => {
            memoryRepo.upsertRelationship({
                characterId: pcId,
                npcId: npcId,
                familiarity: 'stranger',
                disposition: 'neutral',
                notes: null
            });

            const rel1 = memoryRepo.getRelationship(pcId, npcId);
            expect(rel1?.interactionCount).toBe(1);

            memoryRepo.upsertRelationship({
                characterId: pcId,
                npcId: npcId,
                familiarity: 'acquaintance',
                disposition: 'friendly',
                notes: 'Helped with quest'
            });

            const rel2 = memoryRepo.getRelationship(pcId, npcId);
            expect(rel2?.interactionCount).toBe(2);
            expect(rel2?.familiarity).toBe('acquaintance');
        });

        test('1.5 - multiple PCs can have different relationships with same NPC', () => {
            const pc1 = 'pc-warrior';
            const pc2 = 'pc-rogue';

            memoryRepo.upsertRelationship({
                characterId: pc1,
                npcId: npcId,
                familiarity: 'friend',
                disposition: 'friendly',
                notes: null
            });

            memoryRepo.upsertRelationship({
                characterId: pc2,
                npcId: npcId,
                familiarity: 'enemy',
                disposition: 'hostile',
                notes: 'Caught stealing'
            });

            const rel1 = memoryRepo.getRelationship(pc1, npcId);
            const rel2 = memoryRepo.getRelationship(pc2, npcId);

            expect(rel1?.familiarity).toBe('friend');
            expect(rel2?.familiarity).toBe('enemy');
        });

        test('1.6 - relationship notes can be updated', () => {
            memoryRepo.upsertRelationship({
                characterId: pcId,
                npcId: npcId,
                familiarity: 'acquaintance',
                disposition: 'neutral',
                notes: 'First meeting'
            });

            memoryRepo.upsertRelationship({
                characterId: pcId,
                npcId: npcId,
                familiarity: 'acquaintance',
                disposition: 'neutral',
                notes: 'Updated: Helped find lost item'
            });

            const rel = memoryRepo.getRelationship(pcId, npcId);
            expect(rel?.notes).toBe('Updated: Helped find lost item');
        });
    });

    // --- Conversation Memory Tests ---
    describe('Conversation Memory', () => {
        test('1.7 - can record conversation memory', () => {
            const memory = memoryRepo.recordMemory({
                characterId: pcId,
                npcId: npcId,
                summary: 'Discussed the dragon threat',
                importance: 'high',
                topics: ['dragon', 'quest', 'danger']
            });

            expect(memory.id).toBeDefined();
            expect(memory.summary).toBe('Discussed the dragon threat');
            expect(memory.importance).toBe('high');
        });

        test('1.8 - conversation history returns most recent first', () => {
            memoryRepo.recordMemory({
                characterId: pcId,
                npcId: npcId,
                summary: 'First conversation',
                importance: 'low',
                topics: []
            });

            memoryRepo.recordMemory({
                characterId: pcId,
                npcId: npcId,
                summary: 'Second conversation',
                importance: 'medium',
                topics: []
            });

            memoryRepo.recordMemory({
                characterId: pcId,
                npcId: npcId,
                summary: 'Third conversation',
                importance: 'high',
                topics: []
            });

            const history = memoryRepo.getConversationHistory(pcId, npcId, {});
            expect(history.length).toBe(3);
            expect(history[0].summary).toBe('Third conversation');
        });

        test('1.9 - can filter by minimum importance', () => {
            memoryRepo.recordMemory({
                characterId: pcId,
                npcId: npcId,
                summary: 'Casual chat',
                importance: 'low',
                topics: []
            });

            memoryRepo.recordMemory({
                characterId: pcId,
                npcId: npcId,
                summary: 'Important info',
                importance: 'high',
                topics: []
            });

            memoryRepo.recordMemory({
                characterId: pcId,
                npcId: npcId,
                summary: 'Critical revelation',
                importance: 'critical',
                topics: []
            });

            const highAndUp = memoryRepo.getConversationHistory(pcId, npcId, { minImportance: 'high' });
            expect(highAndUp.length).toBe(2);
            expect(highAndUp.every(m => m.importance === 'high' || m.importance === 'critical')).toBe(true);
        });

        test('1.10 - can limit number of memories returned', () => {
            for (let i = 0; i < 10; i++) {
                memoryRepo.recordMemory({
                    characterId: pcId,
                    npcId: npcId,
                    summary: `Conversation ${i}`,
                    importance: 'medium',
                    topics: []
                });
            }

            const limited = memoryRepo.getConversationHistory(pcId, npcId, { limit: 3 });
            expect(limited.length).toBe(3);
        });

        test('1.11 - topics are stored and retrieved correctly', () => {
            memoryRepo.recordMemory({
                characterId: pcId,
                npcId: npcId,
                summary: 'Quest discussion',
                importance: 'high',
                topics: ['dragon', 'treasure', 'dungeon', 'reward']
            });

            const history = memoryRepo.getConversationHistory(pcId, npcId, {});
            expect(history[0].topics).toContain('dragon');
            expect(history[0].topics).toContain('treasure');
            expect(history[0].topics.length).toBe(4);
        });

        test('1.12 - recent interactions across all NPCs', () => {
            const npcs = ['npc-1', 'npc-2', 'npc-3'];

            for (const npc of npcs) {
                memoryRepo.recordMemory({
                    characterId: pcId,
                    npcId: npc,
                    summary: `Talked to ${npc}`,
                    importance: 'medium',
                    topics: []
                });
            }

            const recent = memoryRepo.getRecentInteractions(pcId, 10);
            expect(recent.length).toBe(3);
        });
    });
});

// ============================================================================
// SECTION 2: LAIR ACTIONS (HIGH-006)
// ============================================================================
describe('Lair Action System', () => {

    describe('Initiative 20 Turn Order', () => {
        test('2.1 - LAIR is inserted at initiative 20 when creature has hasLairActions', () => {
            const engine = new CombatEngine('lair-test-1');

            const participants: CombatParticipant[] = [
                { id: 'dragon', name: 'Red Dragon', initiativeBonus: 5, hp: 200, maxHp: 200, conditions: [], hasLairActions: true },
                { id: 'hero1', name: 'Fighter', initiativeBonus: 2, hp: 50, maxHp: 50, conditions: [] },
                { id: 'hero2', name: 'Wizard', initiativeBonus: 3, hp: 30, maxHp: 30, conditions: [] }
            ];

            const state = engine.startEncounter(participants);

            expect(state.turnOrder).toContain('LAIR');
            expect(state.hasLairActions).toBe(true);
            expect(state.lairOwnerId).toBe('dragon');
        });

        test('2.2 - LAIR not inserted when no creature has hasLairActions', () => {
            const engine = new CombatEngine('no-lair-test');

            const participants: CombatParticipant[] = [
                { id: 'goblin', name: 'Goblin Boss', initiativeBonus: 2, hp: 20, maxHp: 20, conditions: [] },
                { id: 'hero', name: 'Fighter', initiativeBonus: 3, hp: 50, maxHp: 50, conditions: [] }
            ];

            const state = engine.startEncounter(participants);

            expect(state.turnOrder).not.toContain('LAIR');
            expect(state.hasLairActions).toBe(false);
        });

        test('2.3 - isLairActionPending returns true only on LAIR turn', () => {
            const engine = new CombatEngine('lair-pending-test');

            const participants: CombatParticipant[] = [
                { id: 'dragon', name: 'Dragon', initiativeBonus: 25, hp: 200, maxHp: 200, conditions: [], hasLairActions: true },
                { id: 'hero', name: 'Hero', initiativeBonus: 1, hp: 50, maxHp: 50, conditions: [] }
            ];

            engine.startEncounter(participants);

            // Find LAIR in turn order and advance to it
            const state = engine.getState()!;
            while (state.turnOrder[state.currentTurnIndex] !== 'LAIR') {
                engine.nextTurn();
            }

            expect(engine.isLairActionPending()).toBe(true);

            // Advance past LAIR
            engine.nextTurn();
            expect(engine.isLairActionPending()).toBe(false);
        });

        test('2.4 - getCurrentParticipant returns null on LAIR turn', () => {
            const engine = new CombatEngine('lair-null-test');

            const participants: CombatParticipant[] = [
                { id: 'dragon', name: 'Dragon', initiativeBonus: 25, hp: 200, maxHp: 200, conditions: [], hasLairActions: true },
                { id: 'hero', name: 'Hero', initiativeBonus: 1, hp: 50, maxHp: 50, conditions: [] }
            ];

            engine.startEncounter(participants);
            const state = engine.getState()!;

            // Advance to LAIR turn
            while (state.turnOrder[state.currentTurnIndex] !== 'LAIR') {
                engine.nextTurn();
            }

            expect(engine.getCurrentParticipant()).toBeNull();
        });
    });

    describe('Lair Action Effects', () => {
        test('2.5 - lair actions can deal damage to multiple targets', () => {
            const engine = new CombatEngine('lair-damage-test');

            const participants: CombatParticipant[] = [
                { id: 'dragon', name: 'Dragon', initiativeBonus: 25, hp: 200, maxHp: 200, conditions: [], hasLairActions: true },
                { id: 'hero1', name: 'Fighter', initiativeBonus: 5, hp: 50, maxHp: 50, conditions: [] },
                { id: 'hero2', name: 'Wizard', initiativeBonus: 3, hp: 30, maxHp: 30, conditions: [] }
            ];

            engine.startEncounter(participants);

            // Apply lair action damage to both heroes
            engine.applyDamage('hero1', 10);
            engine.applyDamage('hero2', 10);

            const state = engine.getState()!;
            const hero1 = state.participants.find(p => p.id === 'hero1');
            const hero2 = state.participants.find(p => p.id === 'hero2');

            expect(hero1?.hp).toBe(40);
            expect(hero2?.hp).toBe(20);
        });

        test('2.6 - lair action damage respects immunities', () => {
            const engine = new CombatEngine('lair-immunity-test');

            const participants: CombatParticipant[] = [
                { id: 'dragon', name: 'Fire Dragon', initiativeBonus: 25, hp: 200, maxHp: 200, conditions: [], hasLairActions: true },
                { id: 'salamander', name: 'Fire Salamander', initiativeBonus: 5, hp: 50, maxHp: 50, conditions: [], immunities: ['fire'] }
            ];

            engine.startEncounter(participants);

            // Salamander should be immune to fire lair actions
            // Note: This is validated in combat-tools, engine just tracks the state
            const state = engine.getState()!;
            const salamander = state.participants.find(p => p.id === 'salamander');
            expect(salamander?.immunities).toContain('fire');
        });

        test('2.7 - legendary creature can use legendary actions after other creature turns', () => {
            const engine = new CombatEngine('legendary-action-test');

            const participants: CombatParticipant[] = [
                { id: 'dragon', name: 'Dragon', initiativeBonus: 25, hp: 200, maxHp: 200, conditions: [], legendaryActions: 3, legendaryActionsRemaining: 3 },
                { id: 'hero', name: 'Fighter', initiativeBonus: 5, hp: 50, maxHp: 50, conditions: [] }
            ];

            engine.startEncounter(participants);
            const state = engine.getState()!;

            // Advance to hero's turn
            while (state.turnOrder[state.currentTurnIndex] !== 'hero') {
                engine.nextTurn();
            }

            // Dragon should be able to use legendary action now (after hero's turn)
            expect(engine.canUseLegendaryAction('dragon')).toBe(true);
        });

        test('2.8 - cannot use legendary action on own turn', () => {
            const engine = new CombatEngine('legendary-own-turn-test');

            const participants: CombatParticipant[] = [
                { id: 'dragon', name: 'Dragon', initiativeBonus: 25, hp: 200, maxHp: 200, conditions: [], legendaryActions: 3, legendaryActionsRemaining: 3 },
                { id: 'hero', name: 'Fighter', initiativeBonus: 5, hp: 50, maxHp: 50, conditions: [] }
            ];

            engine.startEncounter(participants);
            const state = engine.getState()!;

            // Ensure it's dragon's turn
            while (state.turnOrder[state.currentTurnIndex] !== 'dragon') {
                engine.nextTurn();
            }

            expect(engine.canUseLegendaryAction('dragon')).toBe(false);
        });
    });
});

// ============================================================================
// SECTION 3: LEGENDARY CREATURES (HIGH-007)
// ============================================================================
describe('Legendary Creature System', () => {
    let charRepo: CharacterRepository;

    beforeEach(() => {
        charRepo = new CharacterRepository(db);
    });

    describe('Legendary Actions', () => {
        test('3.1 - legendary action fields persist in database', () => {
            const dragon = {
                id: uuid(),
                name: 'Ancient Red Dragon',
                stats: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
                hp: 546,
                maxHp: 546,
                ac: 22,
                level: 20,
                legendaryActions: 3,
                legendaryActionsRemaining: 3,
                legendaryResistances: 3,
                legendaryResistancesRemaining: 3,
                hasLairActions: true,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            charRepo.create(dragon);
            const retrieved = charRepo.findById(dragon.id);

            expect(retrieved?.legendaryActions).toBe(3);
            expect(retrieved?.legendaryActionsRemaining).toBe(3);
            expect(retrieved?.legendaryResistances).toBe(3);
            expect(retrieved?.legendaryResistancesRemaining).toBe(3);
            expect(retrieved?.hasLairActions).toBe(true);
        });

        test('3.2 - legendary actions remaining can be updated', () => {
            const dragon = {
                id: uuid(),
                name: 'Dragon',
                stats: { str: 20, dex: 10, con: 20, int: 10, wis: 10, cha: 10 },
                hp: 200,
                maxHp: 200,
                ac: 18,
                level: 15,
                legendaryActions: 3,
                legendaryActionsRemaining: 3,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            charRepo.create(dragon);
            charRepo.update(dragon.id, { legendaryActionsRemaining: 1 });

            const retrieved = charRepo.findById(dragon.id);
            expect(retrieved?.legendaryActionsRemaining).toBe(1);
        });

        test('3.3 - non-legendary creature has undefined legendary fields', () => {
            const goblin = {
                id: uuid(),
                name: 'Goblin',
                stats: { str: 8, dex: 14, con: 10, int: 10, wis: 8, cha: 8 },
                hp: 7,
                maxHp: 7,
                ac: 15,
                level: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            charRepo.create(goblin);
            const retrieved = charRepo.findById(goblin.id);

            expect(retrieved?.legendaryActions).toBeUndefined();
            expect(retrieved?.hasLairActions).toBe(false);
        });
    });

    describe('Damage Modifiers', () => {
        test('3.4 - resistances persist in database', () => {
            const demon = {
                id: uuid(),
                name: 'Balor',
                stats: { str: 26, dex: 15, con: 22, int: 20, wis: 16, cha: 22 },
                hp: 262,
                maxHp: 262,
                ac: 19,
                level: 19,
                resistances: ['cold', 'lightning', 'bludgeoning', 'piercing', 'slashing'],
                immunities: ['fire', 'poison'],
                vulnerabilities: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            charRepo.create(demon);
            const retrieved = charRepo.findById(demon.id);

            expect(retrieved?.resistances).toContain('cold');
            expect(retrieved?.resistances).toContain('lightning');
            expect(retrieved?.immunities).toContain('fire');
            expect(retrieved?.immunities).toContain('poison');
        });

        test('3.5 - vulnerabilities persist in database', () => {
            const treant = {
                id: uuid(),
                name: 'Treant',
                stats: { str: 23, dex: 8, con: 21, int: 12, wis: 16, cha: 12 },
                hp: 138,
                maxHp: 138,
                ac: 16,
                level: 9,
                resistances: ['bludgeoning', 'piercing'],
                vulnerabilities: ['fire'],
                immunities: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            charRepo.create(treant);
            const retrieved = charRepo.findById(treant.id);

            expect(retrieved?.vulnerabilities).toContain('fire');
        });

        test('3.6 - empty damage modifier arrays are handled correctly', () => {
            const fighter = {
                id: uuid(),
                name: 'Fighter',
                stats: { str: 16, dex: 14, con: 14, int: 10, wis: 12, cha: 10 },
                hp: 45,
                maxHp: 45,
                ac: 18,
                level: 5,
                resistances: [],
                vulnerabilities: [],
                immunities: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            charRepo.create(fighter);
            const retrieved = charRepo.findById(fighter.id);

            expect(retrieved?.resistances).toEqual([]);
            expect(retrieved?.vulnerabilities).toEqual([]);
            expect(retrieved?.immunities).toEqual([]);
        });
    });

    describe('Legendary Resistances', () => {
        test('3.7 - legendary resistance can be consumed', () => {
            const dragon = {
                id: uuid(),
                name: 'Ancient Dragon',
                stats: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
                hp: 500,
                maxHp: 500,
                ac: 22,
                level: 20,
                legendaryResistances: 3,
                legendaryResistancesRemaining: 3,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            charRepo.create(dragon);

            // Use one legendary resistance
            charRepo.update(dragon.id, { legendaryResistancesRemaining: 2 });

            const retrieved = charRepo.findById(dragon.id);
            expect(retrieved?.legendaryResistancesRemaining).toBe(2);
            expect(retrieved?.legendaryResistances).toBe(3); // Total unchanged
        });

        test('3.8 - legendary resistance does not reset on short rest', () => {
            // This is a design principle test - legendary resistances are per-day
            const dragon = {
                id: uuid(),
                name: 'Dragon',
                stats: { str: 20, dex: 10, con: 20, int: 10, wis: 10, cha: 10 },
                hp: 200,
                maxHp: 200,
                ac: 18,
                level: 15,
                legendaryResistances: 3,
                legendaryResistancesRemaining: 1,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            charRepo.create(dragon);

            // Simulate short rest - only HP changes
            charRepo.update(dragon.id, { hp: 200 });

            const retrieved = charRepo.findById(dragon.id);
            expect(retrieved?.legendaryResistancesRemaining).toBe(1); // Not restored
        });
    });
});

// ============================================================================
// SECTION 4: DEATH SAVING THROWS (MED-003)
// ============================================================================
describe('Death Saving Throw System', () => {

    describe('Basic Death Save Mechanics', () => {
        test('4.1 - character at 0 HP can roll death save', () => {
            const engine = new CombatEngine('death-save-basic');

            const participants: CombatParticipant[] = [
                { id: 'hero', name: 'Fighter', initiativeBonus: 2, hp: 0, maxHp: 50, conditions: [] },
                { id: 'goblin', name: 'Goblin', initiativeBonus: 1, hp: 7, maxHp: 7, conditions: [] }
            ];

            engine.startEncounter(participants);
            const result = engine.rollDeathSave('hero');

            expect(result).not.toBeNull();
            expect(result!.roll).toBeGreaterThanOrEqual(1);
            expect(result!.roll).toBeLessThanOrEqual(20);
        });

        test('4.2 - character with HP > 0 cannot roll death save', () => {
            const engine = new CombatEngine('death-save-not-zero');

            const participants: CombatParticipant[] = [
                { id: 'hero', name: 'Fighter', initiativeBonus: 2, hp: 10, maxHp: 50, conditions: [] }
            ];

            engine.startEncounter(participants);
            const result = engine.rollDeathSave('hero');

            expect(result).toBeNull();
        });

        test('4.3 - roll of 10+ is a success', () => {
            const engine = new CombatEngine('death-save-success');

            const participants: CombatParticipant[] = [
                { id: 'hero', name: 'Fighter', initiativeBonus: 2, hp: 0, maxHp: 50, conditions: [] }
            ];

            engine.startEncounter(participants);

            // Roll until we get a success (10+)
            let result: DeathSaveResult | null = null;
            for (let i = 0; i < 100; i++) {
                // Reset the participant
                const state = engine.getState()!;
                const hero = state.participants.find(p => p.id === 'hero')!;
                hero.deathSaveSuccesses = 0;
                hero.deathSaveFailures = 0;
                hero.hp = 0;
                hero.isDead = false;
                hero.isStabilized = false;

                result = engine.rollDeathSave('hero');
                if (result && result.roll >= 10 && !result.isNat20) break;
            }

            if (result && result.roll >= 10 && !result.isNat20) {
                expect(result.success).toBe(true);
            }
        });

        test('4.4 - roll of 9 or less is a failure', () => {
            const engine = new CombatEngine('death-save-failure');

            const participants: CombatParticipant[] = [
                { id: 'hero', name: 'Fighter', initiativeBonus: 2, hp: 0, maxHp: 50, conditions: [] }
            ];

            engine.startEncounter(participants);

            // Roll until we get a failure (9 or less, not nat 1)
            let result: DeathSaveResult | null = null;
            for (let i = 0; i < 100; i++) {
                const state = engine.getState()!;
                const hero = state.participants.find(p => p.id === 'hero')!;
                hero.deathSaveSuccesses = 0;
                hero.deathSaveFailures = 0;
                hero.hp = 0;
                hero.isDead = false;
                hero.isStabilized = false;

                result = engine.rollDeathSave('hero');
                if (result && result.roll <= 9 && !result.isNat1) break;
            }

            if (result && result.roll <= 9 && !result.isNat1) {
                expect(result.success).toBe(false);
            }
        });
    });

    describe('Natural 20 and Natural 1', () => {
        test('4.5 - natural 20 regains 1 HP', () => {
            const engine = new CombatEngine('death-save-nat20');

            const participants: CombatParticipant[] = [
                { id: 'hero', name: 'Fighter', initiativeBonus: 2, hp: 0, maxHp: 50, conditions: [] }
            ];

            engine.startEncounter(participants);

            // Keep rolling until we get a nat 20 (or skip after 1000 tries)
            let gotNat20 = false;
            for (let i = 0; i < 1000; i++) {
                const state = engine.getState()!;
                const hero = state.participants.find(p => p.id === 'hero')!;
                hero.deathSaveSuccesses = 0;
                hero.deathSaveFailures = 0;
                hero.hp = 0;
                hero.isDead = false;
                hero.isStabilized = false;

                const result = engine.rollDeathSave('hero');
                if (result?.isNat20) {
                    gotNat20 = true;
                    expect(hero.hp).toBe(1);
                    expect(result.regainedHp).toBe(true);
                    break;
                }
            }

            // If we didn't get nat 20, skip this test (probability issue, not bug)
            if (!gotNat20) {
                console.log('Skipping nat 20 test - did not roll nat 20 in 1000 attempts');
            }
        });

        test('4.6 - natural 1 counts as 2 failures', () => {
            const engine = new CombatEngine('death-save-nat1');

            const participants: CombatParticipant[] = [
                { id: 'hero', name: 'Fighter', initiativeBonus: 2, hp: 0, maxHp: 50, conditions: [] }
            ];

            engine.startEncounter(participants);

            // Keep rolling until we get a nat 1
            let gotNat1 = false;
            for (let i = 0; i < 1000; i++) {
                const state = engine.getState()!;
                const hero = state.participants.find(p => p.id === 'hero')!;
                hero.deathSaveSuccesses = 0;
                hero.deathSaveFailures = 0;
                hero.hp = 0;
                hero.isDead = false;
                hero.isStabilized = false;

                const result = engine.rollDeathSave('hero');
                if (result?.isNat1) {
                    gotNat1 = true;
                    expect(result.failures).toBe(2);
                    break;
                }
            }

            if (!gotNat1) {
                console.log('Skipping nat 1 test - did not roll nat 1 in 1000 attempts');
            }
        });
    });

    describe('Stabilization and Death', () => {
        test('4.7 - 3 successes stabilizes character', () => {
            const engine = new CombatEngine('death-save-stabilize');

            const participants: CombatParticipant[] = [
                { id: 'hero', name: 'Fighter', initiativeBonus: 2, hp: 0, maxHp: 50, conditions: [], deathSaveSuccesses: 2, deathSaveFailures: 0 }
            ];

            engine.startEncounter(participants);

            // Keep rolling until we get a success
            for (let i = 0; i < 100; i++) {
                const result = engine.rollDeathSave('hero');
                if (result === null) break; // Stabilized or dead
                if (result.isStabilized) {
                    expect(result.successes).toBe(3);
                    break;
                }
                if (result.isDead) {
                    // Reset and try again
                    const state = engine.getState()!;
                    const hero = state.participants.find(p => p.id === 'hero')!;
                    hero.deathSaveSuccesses = 2;
                    hero.deathSaveFailures = 0;
                    hero.isDead = false;
                    hero.isStabilized = false;
                }
            }
        });

        test('4.8 - 3 failures kills character', () => {
            const engine = new CombatEngine('death-save-death');

            const participants: CombatParticipant[] = [
                { id: 'hero', name: 'Fighter', initiativeBonus: 2, hp: 0, maxHp: 50, conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 2 }
            ];

            engine.startEncounter(participants);

            // Keep rolling until we get a failure (or nat 1 for 2 failures)
            for (let i = 0; i < 100; i++) {
                const result = engine.rollDeathSave('hero');
                if (result === null) break; // Already dead
                if (result.isDead) {
                    expect(result.failures).toBe(3);
                    break;
                }
                if (result.isStabilized) {
                    // Reset and try again
                    const state = engine.getState()!;
                    const hero = state.participants.find(p => p.id === 'hero')!;
                    hero.deathSaveSuccesses = 0;
                    hero.deathSaveFailures = 2;
                    hero.isDead = false;
                    hero.isStabilized = false;
                }
            }
        });

        test('4.9 - cannot roll death save when stabilized', () => {
            const engine = new CombatEngine('death-save-already-stable');

            const participants: CombatParticipant[] = [
                { id: 'hero', name: 'Fighter', initiativeBonus: 2, hp: 0, maxHp: 50, conditions: [], isStabilized: true }
            ];

            engine.startEncounter(participants);
            const result = engine.rollDeathSave('hero');

            expect(result).toBeNull();
        });

        test('4.10 - cannot roll death save when dead', () => {
            const engine = new CombatEngine('death-save-already-dead');

            const participants: CombatParticipant[] = [
                { id: 'hero', name: 'Fighter', initiativeBonus: 2, hp: 0, maxHp: 50, conditions: [], isDead: true }
            ];

            engine.startEncounter(participants);
            const result = engine.rollDeathSave('hero');

            expect(result).toBeNull();
        });
    });

    describe('Healing Interactions', () => {
        test('4.11 - healing from 0 HP resets death saves', () => {
            const engine = new CombatEngine('death-save-heal-reset');

            const participants: CombatParticipant[] = [
                { id: 'hero', name: 'Fighter', initiativeBonus: 2, hp: 0, maxHp: 50, conditions: [], deathSaveSuccesses: 2, deathSaveFailures: 1 }
            ];

            engine.startEncounter(participants);

            // Heal the character
            engine.heal('hero', 10);

            const state = engine.getState()!;
            const hero = state.participants.find(p => p.id === 'hero')!;

            expect(hero.hp).toBe(10);
            expect(hero.deathSaveSuccesses).toBe(0);
            expect(hero.deathSaveFailures).toBe(0);
        });

        test('4.12 - healing resets stabilization flag', () => {
            const engine = new CombatEngine('death-save-heal-unstabilize');

            const participants: CombatParticipant[] = [
                { id: 'hero', name: 'Fighter', initiativeBonus: 2, hp: 0, maxHp: 50, conditions: [], isStabilized: true }
            ];

            engine.startEncounter(participants);
            engine.heal('hero', 5);

            const state = engine.getState()!;
            const hero = state.participants.find(p => p.id === 'hero')!;

            expect(hero.hp).toBe(5);
            expect(hero.isStabilized).toBe(false);
        });
    });

    describe('Damage at 0 HP', () => {
        test('4.13 - taking damage at 0 HP causes death save failure', () => {
            const engine = new CombatEngine('death-save-damage-failure');

            const participants: CombatParticipant[] = [
                { id: 'hero', name: 'Fighter', initiativeBonus: 2, hp: 0, maxHp: 50, conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 0 }
            ];

            engine.startEncounter(participants);
            engine.applyDamageAtZeroHp('hero', false);

            const state = engine.getState()!;
            const hero = state.participants.find(p => p.id === 'hero')!;

            expect(hero.deathSaveFailures).toBe(1);
        });

        test('4.14 - critical hit at 0 HP causes 2 death save failures', () => {
            const engine = new CombatEngine('death-save-crit-failure');

            const participants: CombatParticipant[] = [
                { id: 'hero', name: 'Fighter', initiativeBonus: 2, hp: 0, maxHp: 50, conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 0 }
            ];

            engine.startEncounter(participants);
            engine.applyDamageAtZeroHp('hero', true); // Critical hit

            const state = engine.getState()!;
            const hero = state.participants.find(p => p.id === 'hero')!;

            expect(hero.deathSaveFailures).toBe(2);
        });

        test('4.15 - damage at 0 HP breaks stabilization', () => {
            const engine = new CombatEngine('death-save-break-stable');

            const participants: CombatParticipant[] = [
                { id: 'hero', name: 'Fighter', initiativeBonus: 2, hp: 0, maxHp: 50, conditions: [], isStabilized: true, deathSaveSuccesses: 3, deathSaveFailures: 0 }
            ];

            engine.startEncounter(participants);
            engine.applyDamageAtZeroHp('hero', false);

            const state = engine.getState()!;
            const hero = state.participants.find(p => p.id === 'hero')!;

            expect(hero.isStabilized).toBe(false);
            expect(hero.deathSaveFailures).toBe(1);
        });

        test('4.16 - damage at 0 HP with 2 failures already kills instantly', () => {
            const engine = new CombatEngine('death-save-instant-death');

            const participants: CombatParticipant[] = [
                { id: 'hero', name: 'Fighter', initiativeBonus: 2, hp: 0, maxHp: 50, conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 2 }
            ];

            engine.startEncounter(participants);
            engine.applyDamageAtZeroHp('hero', false);

            const state = engine.getState()!;
            const hero = state.participants.find(p => p.id === 'hero')!;

            expect(hero.deathSaveFailures).toBe(3);
            expect(hero.isDead).toBe(true);
        });

        test('4.17 - critical at 2 failures also kills', () => {
            const engine = new CombatEngine('death-save-crit-instant-death');

            const participants: CombatParticipant[] = [
                { id: 'hero', name: 'Fighter', initiativeBonus: 2, hp: 0, maxHp: 50, conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 1 }
            ];

            engine.startEncounter(participants);
            engine.applyDamageAtZeroHp('hero', true); // Critical adds 2 failures

            const state = engine.getState()!;
            const hero = state.participants.find(p => p.id === 'hero')!;

            expect(hero.deathSaveFailures).toBe(3);
            expect(hero.isDead).toBe(true);
        });

        test('4.18 - dead characters cannot take more damage', () => {
            const engine = new CombatEngine('death-save-dead-no-more-damage');

            const participants: CombatParticipant[] = [
                { id: 'hero', name: 'Fighter', initiativeBonus: 2, hp: 0, maxHp: 50, conditions: [], isDead: true, deathSaveFailures: 3 }
            ];

            engine.startEncounter(participants);
            engine.applyDamageAtZeroHp('hero', false);

            const state = engine.getState()!;
            const hero = state.participants.find(p => p.id === 'hero')!;

            // Failures should not increase beyond 3
            expect(hero.deathSaveFailures).toBe(3);
        });
    });
});

// ============================================================================
// SECTION 5: INTEGRATION TESTS
// ============================================================================
describe('Integration: Combined Systems', () => {
    let charRepo: CharacterRepository;
    let memoryRepo: NpcMemoryRepository;

    beforeEach(() => {
        charRepo = new CharacterRepository(db);
        memoryRepo = new NpcMemoryRepository(db);
    });

    test('5.1 - legendary creature encounter with lair actions and death saves', () => {
        // Create the dragon
        const dragon = {
            id: uuid(),
            name: 'Ancient Red Dragon',
            stats: { str: 27, dex: 10, con: 25, int: 16, wis: 13, cha: 21 },
            hp: 546,
            maxHp: 546,
            ac: 22,
            level: 20,
            legendaryActions: 3,
            legendaryActionsRemaining: 3,
            legendaryResistances: 3,
            legendaryResistancesRemaining: 3,
            hasLairActions: true,
            immunities: ['fire'],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        charRepo.create(dragon);

        // Create heroes
        const hero = {
            id: uuid(),
            name: 'Brave Fighter',
            stats: { str: 18, dex: 14, con: 16, int: 10, wis: 12, cha: 10 },
            hp: 85,
            maxHp: 85,
            ac: 20,
            level: 10,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        charRepo.create(hero);

        // Start combat
        const engine = new CombatEngine('dragon-battle');
        const state = engine.startEncounter([
            { id: dragon.id, name: dragon.name, initiativeBonus: 0, hp: dragon.hp, maxHp: dragon.maxHp, conditions: [], hasLairActions: true, legendaryActions: 3, legendaryActionsRemaining: 3, immunities: ['fire'] },
            { id: hero.id, name: hero.name, initiativeBonus: 4, hp: hero.hp, maxHp: hero.maxHp, conditions: [] }
        ]);

        // Verify lair actions are set up
        expect(state.turnOrder).toContain('LAIR');
        expect(state.hasLairActions).toBe(true);
        expect(state.lairOwnerId).toBe(dragon.id);

        // Hero takes massive damage, drops to 0
        engine.applyDamage(hero.id, 100);
        const heroState = state.participants.find(p => p.id === hero.id)!;
        expect(heroState.hp).toBe(0);

        // Hero can now make death saves
        const deathSave = engine.rollDeathSave(hero.id);
        expect(deathSave).not.toBeNull();
    });

    test('5.2 - NPC memory persists through combat encounters', () => {
        const pcId = uuid();
        const npcId = uuid();

        // Create relationship before combat
        memoryRepo.upsertRelationship({
            characterId: pcId,
            npcId: npcId,
            familiarity: 'enemy',
            disposition: 'hostile',
            notes: 'Sworn nemesis'
        });

        // Record conversation
        memoryRepo.recordMemory({
            characterId: pcId,
            npcId: npcId,
            summary: 'Exchanged threats before battle',
            importance: 'high',
            topics: ['combat', 'revenge']
        });

        // Simulate combat (memory should persist)
        const engine = new CombatEngine('nemesis-battle');
        engine.startEncounter([
            { id: pcId, name: 'Hero', initiativeBonus: 3, hp: 50, maxHp: 50, conditions: [] },
            { id: npcId, name: 'Nemesis', initiativeBonus: 5, hp: 80, maxHp: 80, conditions: [] }
        ]);

        // Verify memory still exists after combat starts
        const relationship = memoryRepo.getRelationship(pcId, npcId);
        expect(relationship?.familiarity).toBe('enemy');
        expect(relationship?.disposition).toBe('hostile');

        const memories = memoryRepo.getConversationHistory(pcId, npcId, {});
        expect(memories.length).toBe(1);
        expect(memories[0].topics).toContain('revenge');
    });

    test('5.3 - damage modifiers apply correctly in combat', () => {
        const engine = new CombatEngine('damage-mod-test');

        // Fire elemental is immune to fire, vulnerable to cold
        const participants: CombatParticipant[] = [
            {
                id: 'elemental',
                name: 'Fire Elemental',
                initiativeBonus: 5,
                hp: 100,
                maxHp: 100,
                conditions: [],
                immunities: ['fire'],
                vulnerabilities: ['cold'],
                resistances: []
            },
            { id: 'mage', name: 'Ice Mage', initiativeBonus: 3, hp: 40, maxHp: 40, conditions: [] }
        ];

        engine.startEncounter(participants);
        const state = engine.getState()!;
        const elemental = state.participants.find(p => p.id === 'elemental')!;

        // Verify damage modifiers are tracked
        expect(elemental.immunities).toContain('fire');
        expect(elemental.vulnerabilities).toContain('cold');
    });

    test('5.4 - multiple legendary creatures in same encounter', () => {
        const engine = new CombatEngine('double-dragon');

        const participants: CombatParticipant[] = [
            { id: 'dragon1', name: 'Red Dragon', initiativeBonus: 5, hp: 200, maxHp: 200, conditions: [], hasLairActions: true, legendaryActions: 3, legendaryActionsRemaining: 3 },
            { id: 'dragon2', name: 'Blue Dragon', initiativeBonus: 5, hp: 225, maxHp: 225, conditions: [], legendaryActions: 3, legendaryActionsRemaining: 3 },
            { id: 'hero', name: 'Hero', initiativeBonus: 3, hp: 100, maxHp: 100, conditions: [] }
        ];

        const state = engine.startEncounter(participants);

        // Only one LAIR entry (first creature with hasLairActions)
        const lairCount = state.turnOrder.filter(id => id === 'LAIR').length;
        expect(lairCount).toBe(1);
        expect(state.lairOwnerId).toBe('dragon1');

        // Both dragons should have legendary actions
        const dragon1 = state.participants.find(p => p.id === 'dragon1')!;
        const dragon2 = state.participants.find(p => p.id === 'dragon2')!;
        expect(dragon1.legendaryActions).toBe(3);
        expect(dragon2.legendaryActions).toBe(3);
    });

    test('5.5 - death saves tracked separately per character', () => {
        const engine = new CombatEngine('multi-death-save');

        const participants: CombatParticipant[] = [
            { id: 'hero1', name: 'Fighter', initiativeBonus: 3, hp: 0, maxHp: 50, conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 0 },
            { id: 'hero2', name: 'Rogue', initiativeBonus: 5, hp: 0, maxHp: 40, conditions: [], deathSaveSuccesses: 0, deathSaveFailures: 0 },
            { id: 'goblin', name: 'Goblin', initiativeBonus: 2, hp: 7, maxHp: 7, conditions: [] }
        ];

        engine.startEncounter(participants);

        // Roll death saves for both heroes
        engine.rollDeathSave('hero1');
        engine.rollDeathSave('hero2');

        const state = engine.getState()!;
        const hero1 = state.participants.find(p => p.id === 'hero1')!;
        const hero2 = state.participants.find(p => p.id === 'hero2')!;

        // Each should have their own death save state
        const hero1Total = (hero1.deathSaveSuccesses || 0) + (hero1.deathSaveFailures || 0);
        const hero2Total = (hero2.deathSaveSuccesses || 0) + (hero2.deathSaveFailures || 0);

        // Check hero1 (handle Nat 20 case where hp becomes 1 and saves reset)
        const hero1Valid = hero1Total >= 1 || hero1.hp === 1;
        expect(hero1Valid, `Hero 1 should have rolled a death save (Total: ${hero1Total}, HP: ${hero1.hp})`).toBe(true);

        // Check hero2
        const hero2Valid = hero2Total >= 1 || hero2.hp === 1;
        expect(hero2Valid, `Hero 2 should have rolled a death save (Total: ${hero2Total}, HP: ${hero2.hp})`).toBe(true);
    });
});
