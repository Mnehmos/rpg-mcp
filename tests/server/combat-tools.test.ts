import { describe, it, expect, beforeEach } from 'vitest';
import {
    handleCreateEncounter,
    handleGetEncounterState,
    handleExecuteCombatAction,
    handleAdvanceTurn,
    handleEndEncounter,
    handleLoadEncounter,
    clearCombatState
} from '../../src/server/combat-tools';
import { getCombatManager } from '../../src/server/state/combat-manager';

const mockCtx = { sessionId: 'test-session' };

describe('Combat MCP Tools', () => {
    beforeEach(() => {
        // Clear any existing combat state
        clearCombatState();
    });

    describe('create_encounter', () => {
        it('should create a new combat encounter with participants', async () => {
            const result = await handleCreateEncounter({
                seed: 'test-combat-1',
                participants: [
                    {
                        id: 'hero-1',
                        name: 'Fighter',
                        initiativeBonus: 2,
                        hp: 30,
                        maxHp: 30,
                        conditions: []
                    },
                    {
                        id: 'goblin-1',
                        name: 'Goblin',
                        initiativeBonus: 1,
                        hp: 10,
                        maxHp: 10,
                        conditions: []
                    }
                ]
            }, mockCtx);

            expect(result.content).toHaveLength(1);
            const response = JSON.parse(result.content[0].text);

            expect(response.encounterId).toBeDefined();
            expect(response.turnOrder).toBeDefined();
            expect(response.turnOrder.length).toBe(2);
            expect(response.round).toBe(1);
            expect(response.currentTurn).toBeDefined();
        });

        it('should allow multiple concurrent encounters', async () => {
            const result1 = await handleCreateEncounter({
                seed: 'test-combat-2',
                participants: [{
                    id: 'hero-1',
                    name: 'Fighter',
                    initiativeBonus: 2,
                    hp: 30,
                    maxHp: 30,
                    conditions: []
                }]
            }, mockCtx);
            const id1 = JSON.parse(result1.content[0].text).encounterId;

            const result2 = await handleCreateEncounter({
                seed: 'test-combat-3',
                participants: [{
                    id: 'hero-2',
                    name: 'Wizard',
                    initiativeBonus: 1,
                    hp: 20,
                    maxHp: 20,
                    conditions: []
                }]
            }, mockCtx);
            const id2 = JSON.parse(result2.content[0].text).encounterId;

            expect(id1).not.toBe(id2);

            // Verify both exist
            await expect(handleGetEncounterState({ encounterId: id1 }, mockCtx)).resolves.toBeDefined();
            await expect(handleGetEncounterState({ encounterId: id2 }, mockCtx)).resolves.toBeDefined();
        });
    });

    describe('get_encounter_state', () => {
        it('should return current encounter state', async () => {
            const createResult = await handleCreateEncounter({
                seed: 'test-state-1',
                participants: [
                    {
                        id: 'hero-1',
                        name: 'Wizard',
                        initiativeBonus: 1,
                        hp: 25,
                        maxHp: 25,
                        conditions: []
                    }
                ]
            }, mockCtx);
            const encounterId = JSON.parse(createResult.content[0].text).encounterId;

            const result = await handleGetEncounterState({ encounterId }, mockCtx);

            expect(result.content).toHaveLength(1);
            const state = JSON.parse(result.content[0].text);

            expect(state.participants).toBeDefined();
            expect(state.turnOrder).toBeDefined();
            expect(state.round).toBe(1);
        });

        it('should throw error when no encounter exists', async () => {
            await expect(handleGetEncounterState({ encounterId: 'non-existent' }, mockCtx)).rejects.toThrow('Encounter non-existent not found');
        });
    });

    describe('execute_combat_action', () => {
        async function createTestEncounter() {
            const result = await handleCreateEncounter({
                seed: 'test-actions',
                participants: [
                    {
                        id: 'attacker',
                        name: 'Fighter',
                        initiativeBonus: 3,
                        hp: 30,
                        maxHp: 30,
                        conditions: []
                    },
                    {
                        id: 'defender',
                        name: 'Orc',
                        initiativeBonus: 1,
                        hp: 15,
                        maxHp: 20,
                        conditions: []
                    }
                ]
            }, mockCtx);
            return JSON.parse(result.content[0].text).encounterId;
        }

        it('should execute attack action and apply damage', async () => {
            const encounterId = await createTestEncounter();
            const result = await handleExecuteCombatAction({
                encounterId,
                action: 'attack',
                actorId: 'attacker',
                targetId: 'defender',
                attackBonus: 5,
                dc: 12,
                damage: 8
            }, mockCtx);

            expect(result.content).toHaveLength(1);
            const response = JSON.parse(result.content[0].text);

            expect(response.action).toBe('attack');
            expect(response.success).toBeDefined();
            expect(response.damageDealt).toBeDefined();
        });

        it('should execute heal action', async () => {
            const encounterId = await createTestEncounter();
            const result = await handleExecuteCombatAction({
                encounterId,
                action: 'heal',
                actorId: 'attacker',
                targetId: 'defender',
                amount: 5
            }, mockCtx);

            expect(result.content).toHaveLength(1);
            const response = JSON.parse(result.content[0].text);

            expect(response.action).toBe('heal');
            expect(response.amountHealed).toBe(5);
        });

        it('should throw error when no encounter exists', async () => {
            await expect(handleExecuteCombatAction({
                encounterId: 'non-existent',
                action: 'attack',
                actorId: 'attacker',
                targetId: 'defender',
                attackBonus: 5,
                dc: 12
            }, mockCtx)).rejects.toThrow('Encounter non-existent not found');
        });
    });

    describe('advance_turn', () => {
        async function createTestEncounter() {
            const result = await handleCreateEncounter({
                seed: 'test-turn',
                participants: [
                    {
                        id: 'p1',
                        name: 'Hero',
                        initiativeBonus: 2,
                        hp: 30,
                        maxHp: 30,
                        conditions: []
                    },
                    {
                        id: 'p2',
                        name: 'Enemy',
                        initiativeBonus: 1,
                        hp: 20,
                        maxHp: 20,
                        conditions: []
                    }
                ]
            }, mockCtx);
            return JSON.parse(result.content[0].text).encounterId;
        }

        it('should advance to next participant turn', async () => {
            const encounterId = await createTestEncounter();
            const result = await handleAdvanceTurn({ encounterId }, mockCtx);

            expect(result.content).toHaveLength(1);
            const response = JSON.parse(result.content[0].text);

            expect(response.previousTurn).toBeDefined();
            expect(response.currentTurn).toBeDefined();
            expect(response.round).toBeDefined();
        });

        it('should increment round when cycling through all participants', async () => {
            const encounterId = await createTestEncounter();
            // Advance through both participants
            await handleAdvanceTurn({ encounterId }, mockCtx);
            const result = await handleAdvanceTurn({ encounterId }, mockCtx);

            const response = JSON.parse(result.content[0].text);
            expect(response.round).toBe(2);
        });

        it('should throw error when no encounter exists', async () => {
            await expect(handleAdvanceTurn({ encounterId: 'non-existent' }, mockCtx)).rejects.toThrow('Encounter non-existent not found');
        });
    });

    describe('end_encounter', () => {
        it('should end active encounter', async () => {
            const createResult = await handleCreateEncounter({
                seed: 'test-end',
                participants: [{
                    id: 'p1',
                    name: 'Hero',
                    initiativeBonus: 1,
                    hp: 30,
                    maxHp: 30,
                    conditions: []
                }]
            }, mockCtx);
            const encounterId = JSON.parse(createResult.content[0].text).encounterId;

            const result = await handleEndEncounter({ encounterId }, mockCtx);

            expect(result.content).toHaveLength(1);
            const response = JSON.parse(result.content[0].text);

            expect(response.message).toBe('Encounter ended');

            // Verify encounter cleared  
            await expect(handleGetEncounterState({ encounterId }, mockCtx)).rejects.toThrow('Encounter ' + encounterId + ' not found');
        });

        it('should throw error when no encounter exists', async () => {
            await expect(handleEndEncounter({ encounterId: 'non-existent' }, mockCtx)).rejects.toThrow('Encounter non-existent not found');
        });
    });

    describe('persistence', () => {
        it('should save and load encounter state', async () => {
            // 1. Create encounter
            const createResult = await handleCreateEncounter({
                seed: 'test-persistence',
                participants: [{
                    id: 'p1',
                    name: 'Hero',
                    initiativeBonus: 1,
                    hp: 30,
                    maxHp: 30,
                    conditions: []
                }, {
                    id: 'p2',
                    name: 'Enemy',
                    initiativeBonus: 0,
                    hp: 30,
                    maxHp: 30,
                    conditions: []
                }]
            }, mockCtx);
            const encounterId = JSON.parse(createResult.content[0].text).encounterId;

            // 2. Advance turn to change state
            await handleAdvanceTurn({ encounterId }, mockCtx);

            // 3. Verify state changed (round might be 1, but turn index changed)
            const stateResult = await handleGetEncounterState({ encounterId }, mockCtx);
            const stateBefore = JSON.parse(stateResult.content[0].text);

            // 4. "Forget" encounter from memory
            // Note: In the new implementation, we need to delete using the namespaced ID
            getCombatManager().delete(`${mockCtx.sessionId}:${encounterId}`);

            // 5. Verify auto-load from DB works (getState should still work)
            // The handler auto-loads from DB if not in memory

            // 6. Verify state is restored
            const stateAfterResult = await handleGetEncounterState({ encounterId }, mockCtx);
            const stateAfter = JSON.parse(stateAfterResult.content[0].text);

            expect(stateAfter.currentTurn).toEqual(stateBefore.currentTurn);
            expect(stateAfter.round).toBe(stateBefore.round);
            expect(stateAfter.participants).toEqual(stateBefore.participants);
        });
    });
});
