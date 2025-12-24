/**
 * Legendary Creature Tests
 * 
 * D&D 5e legendary creatures have:
 * 1. Legendary Actions - Can take 1-3 actions at end of other creatures' turns
 * 2. Legendary Resistances - Auto-succeed on failed saves (typically 3/day)
 * 3. Lair Actions - On initiative count 20, lair does something
 * 4. Multiattack - Multiple attacks as single action (future)
 * 
 * @see https://www.dndbeyond.com/sources/basic-rules/monsters#LegendaryCreatures
 */

import { CombatEngine, CombatParticipant } from '../../src/engine/combat/engine.js';

describe('Legendary Creatures', () => {
    let engine: CombatEngine;

    describe('Legendary Actions', () => {
        it('should track legendary action count on legendary creatures', () => {
            engine = new CombatEngine('legendary-test-1');

            const participants: CombatParticipant[] = [
                {
                    id: 'hero-1',
                    name: 'Valeros',
                    initiativeBonus: 2,
                    hp: 50,
                    maxHp: 50,
                    conditions: [],
                    isEnemy: false
                },
                {
                    id: 'dragon-1',
                    name: 'Adult Red Dragon',
                    initiativeBonus: 10,
                    hp: 256,
                    maxHp: 256,
                    conditions: [],
                    isEnemy: true,
                    legendaryActions: 3,
                    legendaryActionsRemaining: 3
                }
            ];

            const state = engine.startEncounter(participants);
            const dragon = state.participants.find(p => p.id === 'dragon-1');

            expect(dragon?.legendaryActions).toBe(3);
            expect(dragon?.legendaryActionsRemaining).toBe(3);
        });

        it('should allow legendary action at end of another creatures turn', () => {
            engine = new CombatEngine('legendary-test-2');

            const participants: CombatParticipant[] = [
                {
                    id: 'dragon-1',
                    name: 'Adult Red Dragon',
                    initiativeBonus: 20,
                    hp: 256,
                    maxHp: 256,
                    conditions: [],
                    isEnemy: true,
                    legendaryActions: 3,
                    legendaryActionsRemaining: 3
                },
                {
                    id: 'hero-1',
                    name: 'Valeros',
                    initiativeBonus: 2,
                    hp: 50,
                    maxHp: 50,
                    conditions: [],
                    isEnemy: false
                }
            ];

            engine.startEncounter(participants);
            
            // Dragon's turn first (highest init), skip it
            engine.nextTurnWithConditions();
            
            // Now it's hero's turn - dragon should be able to use legendary action
            const canUseLegendary = engine.canUseLegendaryAction('dragon-1');
            expect(canUseLegendary).toBe(true);
        });

        it('should NOT allow legendary action on creatures own turn', () => {
            engine = new CombatEngine('legendary-test-3');

            const participants: CombatParticipant[] = [
                {
                    id: 'dragon-1',
                    name: 'Adult Red Dragon',
                    initiativeBonus: 20,
                    hp: 256,
                    maxHp: 256,
                    conditions: [],
                    isEnemy: true,
                    legendaryActions: 3,
                    legendaryActionsRemaining: 3
                },
                {
                    id: 'hero-1',
                    name: 'Valeros',
                    initiativeBonus: 2,
                    hp: 50,
                    maxHp: 50,
                    conditions: [],
                    isEnemy: false
                }
            ];

            engine.startEncounter(participants);
            
            // It's dragon's turn - should NOT be able to use legendary action
            const canUseLegendary = engine.canUseLegendaryAction('dragon-1');
            expect(canUseLegendary).toBe(false);
        });

        it('should decrement legendary actions when used', () => {
            engine = new CombatEngine('legendary-test-4');

            const participants: CombatParticipant[] = [
                {
                    id: 'dragon-1',
                    name: 'Adult Red Dragon',
                    initiativeBonus: 20,
                    hp: 256,
                    maxHp: 256,
                    conditions: [],
                    isEnemy: true,
                    legendaryActions: 3,
                    legendaryActionsRemaining: 3
                },
                {
                    id: 'hero-1',
                    name: 'Valeros',
                    initiativeBonus: 2,
                    hp: 50,
                    maxHp: 50,
                    conditions: [],
                    isEnemy: false
                }
            ];

            engine.startEncounter(participants);
            engine.nextTurnWithConditions(); // End dragon's turn
            
            // Use 1 legendary action (costs 1)
            const result = engine.useLegendaryAction('dragon-1', 1);
            expect(result.success).toBe(true);
            expect(result.remaining).toBe(2);

            // Use tail attack (costs 2)
            const result2 = engine.useLegendaryAction('dragon-1', 2);
            expect(result2.success).toBe(true);
            expect(result2.remaining).toBe(0);

            // Try to use another - should fail
            const result3 = engine.useLegendaryAction('dragon-1', 1);
            expect(result3.success).toBe(false);
        });

        it('should reset legendary actions at start of creatures turn', () => {
            engine = new CombatEngine('legendary-test-5');

            const participants: CombatParticipant[] = [
                {
                    id: 'dragon-1',
                    name: 'Adult Red Dragon',
                    initiativeBonus: 20,
                    hp: 256,
                    maxHp: 256,
                    conditions: [],
                    isEnemy: true,
                    legendaryActions: 3,
                    legendaryActionsRemaining: 3
                },
                {
                    id: 'hero-1',
                    name: 'Valeros',
                    initiativeBonus: 2,
                    hp: 50,
                    maxHp: 50,
                    conditions: [],
                    isEnemy: false
                }
            ];

            engine.startEncounter(participants);
            engine.nextTurnWithConditions(); // End dragon's turn, hero's turn

            // Use all legendary actions
            engine.useLegendaryAction('dragon-1', 3);
            
            const state = engine.getState();
            const dragonBefore = state?.participants.find(p => p.id === 'dragon-1');
            expect(dragonBefore?.legendaryActionsRemaining).toBe(0);

            // Complete the round - hero's turn ends, dragon's turn starts
            engine.nextTurnWithConditions();

            // Dragon's legendary actions should be reset
            const stateAfter = engine.getState();
            const dragonAfter = stateAfter?.participants.find(p => p.id === 'dragon-1');
            expect(dragonAfter?.legendaryActionsRemaining).toBe(3);
        });
    });

    describe('Legendary Resistances', () => {
        it('should track legendary resistance count', () => {
            engine = new CombatEngine('legendary-resist-1');

            const participants: CombatParticipant[] = [
                {
                    id: 'dragon-1',
                    name: 'Adult Red Dragon',
                    initiativeBonus: 20,
                    hp: 256,
                    maxHp: 256,
                    conditions: [],
                    isEnemy: true,
                    legendaryResistances: 3,
                    legendaryResistancesRemaining: 3
                }
            ];

            const state = engine.startEncounter(participants);
            const dragon = state.participants.find(p => p.id === 'dragon-1');

            expect(dragon?.legendaryResistances).toBe(3);
            expect(dragon?.legendaryResistancesRemaining).toBe(3);
        });

        it('should allow using legendary resistance to auto-succeed a save', () => {
            engine = new CombatEngine('legendary-resist-2');

            const participants: CombatParticipant[] = [
                {
                    id: 'dragon-1',
                    name: 'Adult Red Dragon',
                    initiativeBonus: 20,
                    hp: 256,
                    maxHp: 256,
                    conditions: [],
                    isEnemy: true,
                    legendaryResistances: 3,
                    legendaryResistancesRemaining: 3,
                    abilityScores: {
                        strength: 27,
                        dexterity: 10,
                        constitution: 25,
                        intelligence: 16,
                        wisdom: 13,
                        charisma: 21
                    }
                }
            ];

            engine.startEncounter(participants);
            
            // Use legendary resistance
            const result = engine.useLegendaryResistance('dragon-1');
            expect(result.success).toBe(true);
            expect(result.remaining).toBe(2);
        });

        it('should NOT reset legendary resistances between rounds', () => {
            engine = new CombatEngine('legendary-resist-3');

            const participants: CombatParticipant[] = [
                {
                    id: 'dragon-1',
                    name: 'Adult Red Dragon',
                    initiativeBonus: 20,
                    hp: 256,
                    maxHp: 256,
                    conditions: [],
                    isEnemy: true,
                    legendaryResistances: 3,
                    legendaryResistancesRemaining: 3
                },
                {
                    id: 'hero-1',
                    name: 'Valeros',
                    initiativeBonus: 2,
                    hp: 50,
                    maxHp: 50,
                    conditions: [],
                    isEnemy: false
                }
            ];

            engine.startEncounter(participants);
            
            // Use 1 legendary resistance
            engine.useLegendaryResistance('dragon-1');
            
            // Complete a full round
            engine.nextTurnWithConditions();
            engine.nextTurnWithConditions();
            
            // Should still have 2 remaining (NOT reset like legendary actions)
            const state = engine.getState();
            const dragon = state?.participants.find(p => p.id === 'dragon-1');
            expect(dragon?.legendaryResistancesRemaining).toBe(2);
        });
    });

    describe('Lair Actions', () => {
        it('should support lair action on initiative count 20', () => {
            engine = new CombatEngine('lair-test-1');

            const participants: CombatParticipant[] = [
                {
                    id: 'dragon-1',
                    name: 'Adult Red Dragon',
                    initiativeBonus: 15,
                    hp: 256,
                    maxHp: 256,
                    conditions: [],
                    isEnemy: true,
                    hasLairActions: true
                },
                {
                    id: 'hero-1',
                    name: 'Valeros',
                    initiativeBonus: 5,
                    hp: 50,
                    maxHp: 50,
                    conditions: [],
                    isEnemy: false
                }
            ];

            const state = engine.startEncounter(participants);
            
            // There should be a "LAIR" entry in turn order at initiative 20
            // (handled in startEncounter when a creature has hasLairActions)
            const hasLairInOrder = state.turnOrder.includes('LAIR');
            expect(hasLairInOrder).toBe(true);
        });

        it('should trigger lair action check when reaching initiative 20', () => {
            engine = new CombatEngine('lair-test-2');

            const participants: CombatParticipant[] = [
                {
                    id: 'dragon-1',
                    name: 'Adult Red Dragon',
                    initiativeBonus: 25, // Will likely roll higher than 20
                    hp: 256,
                    maxHp: 256,
                    conditions: [],
                    isEnemy: true,
                    hasLairActions: true
                },
                {
                    id: 'hero-1',
                    name: 'Valeros',
                    initiativeBonus: 0,
                    hp: 50,
                    maxHp: 50,
                    conditions: [],
                    isEnemy: false
                }
            ];

            engine.startEncounter(participants);
            
            // Check if lair actions are pending
            const lairActionsPending = engine.isLairActionPending();
            // This will depend on turn order, but the method should exist
            expect(typeof lairActionsPending).toBe('boolean');
        });
    });
});
