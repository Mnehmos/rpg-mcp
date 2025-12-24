
import {
    handleCreateEncounter,
    handleExecuteCombatAction,
    clearCombatState
} from '../../src/server/combat-tools';

const mockCtx = { sessionId: 'verify-session' };

function extractStateJson(responseText: string): any {
    const match = responseText.match(/<!-- STATE_JSON\n([\s\S]*?)\nSTATE_JSON -->/);
    if (match) return JSON.parse(match[1]);
    try { return JSON.parse(responseText); } catch { return null; }
}

describe('Verify Deep Scope Fixes', () => {
    beforeEach(() => {
        clearCombatState();
    });

    it('should respect custom movement speed and allow dash', async () => {
        // 1. Create encounter with speed 40
        const createResult = await handleCreateEncounter({
            seed: 'verify-1',
            participants: [{
                id: 'speedster',
                name: 'Flash',
                initiativeBonus: 10,
                hp: 10,
                maxHp: 10,
                conditions: [],
                // @ts-ignore - bypassing strict type check if types aren't updated in test env
                movementSpeed: 40 
            }]
        }, mockCtx);
        
        const state1 = extractStateJson(createResult.content[0].text);
        const p1 = state1.participants.find((p: any) => p.id === 'speedster');
        
        // CHECK 1: Speed preserved
        expect(p1.movementSpeed).toBe(40);
        // Initial movement remaining should be 40 (or undefined which defaults to speed in logic)
        // Wait, logic says movementRemaining ?? speed ?? 30.
        // In create_encounter, initializeMovement is called?
        // Let's check state.
        const speed = p1.movementSpeed ?? 30;
        const current = p1.movementRemaining ?? speed;
        expect(current).toBe(40);

        // 2. Dash Action
        const encounterId = state1.encounterId;
        const dashResult = await handleExecuteCombatAction({
            encounterId,
            // @ts-ignore
            action: 'dash', 
            actorId: 'speedster'
        }, mockCtx);

        // CHECK 2: Action success
        const state2 = extractStateJson(dashResult.content[0].text);
        const p2 = state2.participants.find((p: any) => p.id === 'speedster');
        
        expect(p2.hasDashed).toBe(true);
        // Should be 40 + 40 = 80
        expect(p2.movementRemaining).toBe(80);
    });

    it('should allow movement > 30ft if speed is higher', async () => {
        // Create encounter with speed 40
        const createResult = await handleCreateEncounter({
            seed: 'verify-move',
            participants: [{
                id: 'runner',
                name: 'Runner',
                initiativeBonus: 0,
                hp: 10,
                maxHp: 10,
                conditions: [],
                position: { x: 0, y: 0 },
                // @ts-ignore
                movementSpeed: 40
            }]
        }, mockCtx);
        const encounterId = extractStateJson(createResult.content[0].text).encounterId;

        // Try to move 35 feet (requires > 30)
        // From 0,0 to 7,0 (7 squares = 35ft)
        const moveResult = await handleExecuteCombatAction({
            encounterId,
            action: 'move',
            actorId: 'runner',
            targetPosition: { x: 7, y: 0 }
        }, mockCtx);

        const text = moveResult.content[0].text;
        expect(text).toContain('moved');
        expect(text).not.toContain('Insufficient movement');
        
        // Verify position
        const state = extractStateJson(text);
        const p = state.participants.find((p: any) => p.id === 'runner');
        expect(p.position).toEqual({ x: 7, y: 0 });
        expect(p.movementRemaining).toBe(5); // 40 - 35 = 5
    });
});
