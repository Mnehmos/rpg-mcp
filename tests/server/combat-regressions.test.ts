
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleCreateEncounter, handleExecuteCombatAction } from '../../src/server/combat-tools.js';
import { getCombatManager } from '../../src/server/state/combat-manager.js';

// Mock DB
vi.mock('../../src/server/db.js', () => ({
    getDb: vi.fn(() => ({
        prepare: vi.fn(() => ({
            run: vi.fn(),
            get: vi.fn(),
            all: vi.fn(() => [])
        })),
        transaction: (fn: any) => fn(),
        exec: vi.fn()
    }))
}));

describe('Combat Regressions', () => {
    const mockCtx = { sessionId: 'test-session', connectionId: 'test-conn' };

    beforeEach(() => {
        const manager = getCombatManager();
        manager.clear();
    });

    it('should fuzzy match "Goblin Warrior" to "goblin" preset and populate AC', async () => {
        const result = await handleCreateEncounter({
            seed: 'test-seed',
            participants: [
                {
                    id: 'goblin-1',
                    name: 'Goblin Warrior', // Should match 'goblin'
                    hp: 7,
                    maxHp: 7,
                    initiativeBonus: 2,
                    isEnemy: true,
                    conditions: []
                }
            ]
        }, mockCtx);

        // Extract encounter ID from output
        const output = result.content[0].text;
        const encounterId = output.match(/Encounter ID: (encounter-[\w-]+)/)?.[1];
        expect(encounterId).toBeDefined();

        const engine = getCombatManager().get(`test-session:${encounterId}`);
        const goblin = engine?.getState().participants.find(p => p.id === 'goblin-1');

        expect(goblin).toBeDefined();
        expect(goblin?.ac).toBe(15); // Goblin preset AC
        expect(goblin?.name).toBe('Goblin'); // Should adopt preset name
    });

    it('should ignore "damage" parameter in cast_spell without error', async () => {
        // Setup encounter first
        const initResult = await handleCreateEncounter({
            seed: 'test-seed-2',
            participants: [
                { id: 'wizard', name: 'Wizard', hp: 20, maxHp: 20, isEnemy: false, initiativeBonus: 0, conditions: [] },
                { id: 'target', name: 'Target', hp: 20, maxHp: 20, isEnemy: true, initiativeBonus: 0, conditions: [] }
            ]
        }, mockCtx);
        
        const encounterId = initResult.content[0].text.match(/Encounter ID: (encounter-[\w-]+)/)?.[1];

        // Try casting spell with forbidden "damage" parameter
        // This fails currently
        try {
            await handleExecuteCombatAction({
                encounterId,
                action: 'cast_spell',
                actorId: 'wizard',
                targetId: 'target',
                spellName: 'Firebolt',
                slotLevel: 1,
                damage: 5, // This usually throws error, but should be ignored now
                damageType: 'fire' 
            }, mockCtx);
        } catch (e: any) {
            // It should fail because Character doesn't exist in DB, NOT because of damage param
            expect(e.message).toContain('Character wizard not found');
            expect(e.message).not.toContain('damage parameter not allowed');
        }
    });
});
