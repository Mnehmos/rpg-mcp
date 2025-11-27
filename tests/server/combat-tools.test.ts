import { describe, it, expect, beforeEach } from 'vitest';
import {
    handleCreateEncounter,
    handleGetEncounterState,
    handleExecuteCombatAction,
    handleAdvanceTurn,
    handleEndEncounter,
    clearCombatState
} from '../../src/server/combat-tools';

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
            });

            expect(result.content).toHaveLength(1);
            const response = JSON.parse(result.content[0].text);

            expect(response.encounterId).toBeDefined();
            expect(response.turnOrder).toBeDefined();
            expect(response.turnOrder.length).toBe(2);
            expect(response.round).toBe(1);
            expect(response.currentTurn).toBeDefined();
        });

        it('should throw error when encounter already exists', async () => {
            await handleCreateEncounter({
                seed: 'test-combat-2',
                participants: [{
                    id: 'hero-1',
                    name: 'Fighter',
                    initiativeBonus: 2,
                    hp: 30,
                    maxHp: 30,
                    conditions: []
                }]
            });

            await expect(handleCreateEncounter({
                seed: 'test-combat-3',
                participants: []
            })).rejects.toThrow('An encounter is already in progress');
        });
    });

    describe('get_encounter_state', () => {
        it('should return current encounter state', async () => {
            await handleCreateEncounter({
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
            });

            const result = await handleGetEncounterState({});

            expect(result.content).toHaveLength(1);
            const state = JSON.parse(result.content[0].text);

            expect(state.participants).toBeDefined();
            expect(state.turnOrder).toBeDefined();
            expect(state.round).toBe(1);
        });

        it('should throw error when no encounter exists', async () => {
            await expect(handleGetEncounterState({})).rejects.toThrow('No active encounter');
        });
    });

    describe('execute_combat_action', () => {
        beforeEach(async () => {
            await handleCreateEncounter({
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
                        hp: 20,
                        maxHp: 20,
                        conditions: []
                    }
                ]
            });
        });

        it('should execute attack action and apply damage', async () => {
            const result = await handleExecuteCombatAction({
                action: 'attack',
                actorId: 'attacker',
                targetId: 'defender',
                attackBonus: 5,
                dc: 12,
                damage: 8
            });

            expect(result.content).toHaveLength(1);
            const response = JSON.parse(result.content[0].text);

            expect(response.action).toBe('attack');
            expect(response.success).toBeDefined();
            expect(response.damageDealt).toBeDefined();
        });

        it('should execute heal action', async () => {
            const result = await handleExecuteCombatAction({
                action: 'heal',
                actorId: 'attacker',
                targetId: 'defender',
                amount: 5
            });

            expect(result.content).toHaveLength(1);
            const response = JSON.parse(result.content[0].text);

            expect(response.action).toBe('heal');
            expect(response.amountHealed).toBe(5);
        });

        it('should throw error when no encounter exists', async () => {
            clearCombatState();

            await expect(handleExecuteCombatAction({
                action: 'attack',
                actorId: 'attacker',
                targetId: 'defender',
                attackBonus: 5,
                dc: 12
            })).rejects.toThrow('No active encounter');
        });
    });

    describe('advance_turn', () => {
        beforeEach(async () => {
            await handleCreateEncounter({
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
            });
        });

        it('should advance to next participant turn', async () => {
            const result = await handleAdvanceTurn({});

            expect(result.content).toHaveLength(1);
            const response = JSON.parse(result.content[0].text);

            expect(response.previousTurn).toBeDefined();
            expect(response.currentTurn).toBeDefined();
            expect(response.round).toBeDefined();
        });

        it('should increment round when cycling through all participants', async () => {
            // Advance through both participants
            await handleAdvanceTurn({});
            const result = await handleAdvanceTurn({});

            const response = JSON.parse(result.content[0].text);
            expect(response.round).toBe(2);
        });

        it('should throw error when no encounter exists', async () => {
            clearCombatState();

            await expect(handleAdvanceTurn({})).rejects.toThrow('No active encounter');
        });
    });

    describe('end_encounter', () => {
        it('should end active encounter', async () => {
            await handleCreateEncounter({
                seed: 'test-end',
                participants: [{
                    id: 'p1',
                    name: 'Hero',
                    initiativeBonus: 1,
                    hp: 30,
                    maxHp: 30,
                    conditions: []
                }]
            });

            const result = await handleEndEncounter({});

            expect(result.content).toHaveLength(1);
            const response = JSON.parse(result.content[0].text);

            expect(response.message).toBe('Encounter ended');

            // Verify encounter cleared  
            await expect(handleGetEncounterState({})).rejects.toThrow('No active encounter');
        });

        it('should throw error when no encounter exists', async () => {
            await expect(handleEndEncounter({})).rejects.toThrow('No active encounter');
        });
    });
});
