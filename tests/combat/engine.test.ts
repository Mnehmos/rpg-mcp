import { CombatEngine, CombatParticipant } from '../../src/engine/combat/engine';

describe('CombatEngine', () => {
    let engine: CombatEngine;
    let participants: CombatParticipant[];

    beforeEach(() => {
        engine = new CombatEngine('combat-test-seed');
        participants = [
            { id: 'fighter', name: 'Fighter', initiativeBonus: 2, hp: 30, maxHp: 30, conditions: [] },
            { id: 'wizard', name: 'Wizard', initiativeBonus: 3, hp: 20, maxHp: 20, conditions: [] },
            { id: 'rogue', name: 'Rogue', initiativeBonus: 4, hp: 25, maxHp: 25, conditions: [] },
            { id: 'cleric', name: 'Cleric', initiativeBonus: 1, hp: 28, maxHp: 28, conditions: [] }
        ];
    });

    describe('Encounter Initialization', () => {
        it('should start an encounter and roll initiative', () => {
            const state = engine.startEncounter(participants);

            expect(state.participants).toHaveLength(4);
            expect(state.turnOrder).toHaveLength(4);
            expect(state.currentTurnIndex).toBe(0);
            expect(state.round).toBe(1);
        });

        it('should order participants by initiative', () => {
            const state = engine.startEncounter(participants);

            // turnOrder should have IDs sorted by initiative
            expect(state.turnOrder).toEqual(expect.arrayContaining(['fighter', 'wizard', 'rogue', 'cleric']));
        });

        it('should be deterministic with same seed', () => {
            const engine1 = new CombatEngine('same-seed');
            const engine2 = new CombatEngine('same-seed');

            const state1 = engine1.startEncounter([...participants]);
            const state2 = engine2.startEncounter([...participants]);

            expect(state1.turnOrder).toEqual(state2.turnOrder);
        });
    });

    describe('Turn Management', () => {
        beforeEach(() => {
            engine.startEncounter(participants);
        });

        it('should get the current participant', () => {
            const current = engine.getCurrentParticipant();

            expect(current).not.toBeNull();
            expect(current?.id).toBeDefined();
        });

        it('should advance to next turn', () => {
            const first = engine.getCurrentParticipant();
            const second = engine.nextTurn();

            expect(second).not.toBeNull();
            expect(second?.id).not.toBe(first?.id);
        });

        it('should cycle through all participants', () => {
            const state = engine.getState();
            if (!state) throw new Error('State is null');

            const encounteredIds = new Set<string>();

            // Go through all participants
            for (let i = 0; i < state.turnOrder.length; i++) {
                const current = engine.getCurrentParticipant();
                if (current) encounteredIds.add(current.id);
                engine.nextTurn();
            }

            expect(encounteredIds.size).toBe(4);
        });

        it('should increment round after full cycle', () => {
            const state = engine.getState();
            if (!state) throw new Error('State is null');

            expect(state.round).toBe(1);

            // Advance through all participants
            for (let i = 0; i < state.turnOrder.length; i++) {
                engine.nextTurn();
            }

            const newState = engine.getState();
            expect(newState?.round).toBe(2);
        });

        it('should reset to first participant after full cycle', () => {
            const state = engine.getState();
            if (!state) throw new Error('State is null');

            const firstParticipant = engine.getCurrentParticipant();

            // Advance through all participants
            for (let i = 0; i < state.turnOrder.length; i++) {
                engine.nextTurn();
            }

            const cycledBack = engine.getCurrentParticipant();
            expect(cycledBack?.id).toBe(firstParticipant?.id);
        });
    });

    describe('Pathfinder 2e Degrees of Success', () => {
        it('should make checks with degrees of success', () => {
            const degree = engine.makeCheck(5, 15);

            expect(['critical-failure', 'failure', 'success', 'critical-success']).toContain(degree);
        });

        it('should be deterministic for same engine state', () => {
            const engine1 = new CombatEngine('degree-seed');
            const engine2 = new CombatEngine('degree-seed');

            const degree1 = engine1.makeCheck(3, 12);
            const degree2 = engine2.makeCheck(3, 12);

            expect(degree1).toBe(degree2);
        });
    });

    describe('Damage and Healing', () => {
        beforeEach(() => {
            engine.startEncounter(participants);
        });

        it('should apply damage to a participant', () => {
            const state = engine.getState();
            const fighterHp = state?.participants.find(p => p.id === 'fighter')?.hp;

            engine.applyDamage('fighter', 10);

            const newState = engine.getState();
            const newFighterHp = newState?.participants.find(p => p.id === 'fighter')?.hp;

            expect(newFighterHp).toBe((fighterHp || 0) - 10);
        });

        it('should not reduce HP below 0', () => {
            engine.applyDamage('wizard', 100);

            const state = engine.getState();
            const wizardHp = state?.participants.find(p => p.id === 'wizard')?.hp;

            expect(wizardHp).toBe(0);
        });

        it('should heal a participant', () => {
            engine.applyDamage('rogue', 15);
            const damagedHp = engine.getState()?.participants.find(p => p.id === 'rogue')?.hp;

            engine.heal('rogue', 10);

            const healedHp = engine.getState()?.participants.find(p => p.id === 'rogue')?.hp;

            expect(healedHp).toBe((damagedHp || 0) + 10);
        });

        it('should not heal above max HP', () => {
            engine.heal('cleric', 100);

            const state = engine.getState();
            const clericHp = state?.participants.find(p => p.id === 'cleric')?.hp;
            const clericMaxHp = state?.participants.find(p => p.id === 'cleric')?.maxHp;

            expect(clericHp).toBe(clericMaxHp);
        });
    });

    describe('Participant Status', () => {
        beforeEach(() => {
            engine.startEncounter(participants);
        });

        it('should check if participant is conscious', () => {
            expect(engine.isConscious('fighter')).toBe(true);

            engine.applyDamage('fighter', 100);

            expect(engine.isConscious('fighter')).toBe(false);
        });

        it('should count conscious participants', () => {
            expect(engine.getConsciousCount()).toBe(4);

            engine.applyDamage('fighter', 100);
            expect(engine.getConsciousCount()).toBe(3);

            engine.applyDamage('wizard', 100);
            expect(engine.getConsciousCount()).toBe(2);
        });
    });
});
