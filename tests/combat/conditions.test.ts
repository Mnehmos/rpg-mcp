import { CombatEngine, CombatParticipant } from '../../src/engine/combat/engine';
import { ConditionType, DurationType, Ability } from '../../src/engine/combat/conditions';

describe('Combat Conditions', () => {
    let engine: CombatEngine;
    let participants: CombatParticipant[];

    beforeEach(() => {
        engine = new CombatEngine('conditions-test-seed');
        participants = [
            {
                id: 'fighter',
                name: 'Fighter',
                initiativeBonus: 2,
                hp: 30,
                maxHp: 30,
                conditions: [],
                abilityScores: {
                    strength: 16,
                    dexterity: 12,
                    constitution: 14,
                    intelligence: 10,
                    wisdom: 10,
                    charisma: 10
                }
            },
            {
                id: 'wizard',
                name: 'Wizard',
                initiativeBonus: 3,
                hp: 20,
                maxHp: 20,
                conditions: [],
                abilityScores: {
                    strength: 8,
                    dexterity: 14,
                    constitution: 12,
                    intelligence: 18,
                    wisdom: 12,
                    charisma: 10
                }
            }
        ];
        engine.startEncounter(participants);
    });

    describe('Applying and Removing Conditions', () => {
        it('should apply a condition to a participant', () => {
            const condition = engine.applyCondition('fighter', {
                type: ConditionType.POISONED,
                durationType: DurationType.ROUNDS,
                duration: 3
            });

            expect(condition).toBeDefined();
            expect(condition.type).toBe(ConditionType.POISONED);
            expect(engine.hasCondition('fighter', ConditionType.POISONED)).toBe(true);
        });

        it('should remove a condition by ID', () => {
            const condition = engine.applyCondition('fighter', {
                type: ConditionType.BLINDED,
                durationType: DurationType.PERMANENT
            });

            const removed = engine.removeCondition('fighter', condition.id);
            expect(removed).toBe(true);
            expect(engine.hasCondition('fighter', ConditionType.BLINDED)).toBe(false);
        });

        it('should get all conditions on a participant', () => {
            engine.applyCondition('wizard', {
                type: ConditionType.POISONED,
                durationType: DurationType.ROUNDS,
                duration: 2
            });

            const conditions = engine.getConditions('wizard');
            expect(conditions).toHaveLength(1);
        });
    });

    describe('Action Restrictions', () => {
        it('should detect when participant cannot take actions', () => {
            expect(engine.canTakeActions('fighter')).toBe(true);

            engine.applyCondition('fighter', {
                type: ConditionType.STUNNED,
                durationType: DurationType.ROUNDS,
                duration: 1
            });

            expect(engine.canTakeActions('fighter')).toBe(false);
        });

        it('should detect when participant cannot take reactions', () => {
            expect(engine.canTakeReactions('wizard')).toBe(true);

            engine.applyCondition('wizard', {
                type: ConditionType.INCAPACITATED,
                durationType: DurationType.ROUNDS,
                duration: 1
            });

            expect(engine.canTakeReactions('wizard')).toBe(false);
        });
    });

    describe('Combat Modifiers', () => {
        it('should detect when attacks against participant have advantage', () => {
            expect(engine.attacksAgainstHaveAdvantage('fighter')).toBe(false);

            engine.applyCondition('fighter', {
                type: ConditionType.PARALYZED,
                durationType: DurationType.ROUNDS,
                duration: 1
            });

            expect(engine.attacksAgainstHaveAdvantage('fighter')).toBe(true);
        });

        it('should detect when participant attacks have disadvantage', () => {
            expect(engine.attacksHaveDisadvantage('wizard')).toBe(false);

            engine.applyCondition('wizard', {
                type: ConditionType.POISONED,
                durationType: DurationType.ROUNDS,
                duration: 1
            });

            expect(engine.attacksHaveDisadvantage('wizard')).toBe(true);
        });
    });
});
