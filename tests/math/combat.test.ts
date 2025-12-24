import { CombatEngine } from '../../src/math/combat';

describe('CombatEngine', () => {
    const engine = new CombatEngine('combat-test');

    it('should resolve attacks', () => {
        // Seed 'combat-test' needs to be deterministic.
        // Let's rely on the result structure rather than exact values for now,
        // or check that it returns hit/miss/crit.
        const result = engine.attackRoll({ attackBonus: 5 }, { ac: 15 });
        expect(['hit', 'miss', 'crit']).toContain(result.result);
        expect(result.steps).toEqual(expect.arrayContaining([expect.stringMatching(/Target AC: 15/)]));
    });

    it('should handle critical hits in damage', () => {
        const result = engine.damageRoll('1d8+3', true);
        // Should roll 2d8+3
        expect(result.input).toContain('2d8+3');
        expect(result.steps[0]).toContain('Critical Hit');
    });

    it('should resolve saving throws', () => {
        const result = engine.savingThrow(15, 2);
        expect(['success', 'failure']).toContain(result.result);
        expect(result.steps).toEqual(expect.arrayContaining([expect.stringMatching(/DC: 15/)]));
    });

    it('should calculate fall damage', () => {
        const result = engine.fallDamage(35);
        // 3d6
        expect(result.input).toBe('3d6');
    });

    it('should cap fall damage', () => {
        const result = engine.fallDamage(300);
        // Max 20d6
        expect(result.input).toBe('20d6');
    });

    it('should calculate encounter balance', () => {
        // Party: 4 level 1s. XP Thresholds: Easy 100, Med 200, Hard 300, Deadly 400.
        // Enemies: 4 Goblins (CR 1/4 = 50 XP each). Total 200 XP.
        // Multiplier for 4 enemies: x2. Adjusted XP = 400.
        // Difficulty: Deadly.

        const result = engine.encounterBalance([1, 1, 1, 1], [0.25, 0.25, 0.25, 0.25]);
        expect(result.difficulty).toBe('Deadly');
        expect(result.adjustedXP).toBe(400);
    });
});
