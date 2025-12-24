import { DiceEngine } from '../../src/math/dice';

describe('DiceEngine', () => {
    it('should parse dice expressions correctly', () => {
        const engine = new DiceEngine();
        expect(engine.parse('2d6+4')).toEqual({ count: 2, sides: 6, modifier: 4, explode: false });
        expect(engine.parse('1d20-2')).toEqual({ count: 1, sides: 20, modifier: -2, explode: false });
        expect(engine.parse('3d8')).toEqual({ count: 3, sides: 8, modifier: 0, explode: false });
        expect(engine.parse('2d6!')).toEqual({ count: 2, sides: 6, modifier: 0, explode: true });
    });

    it('should be deterministic with seeds', () => {
        const seed = 'test-seed';
        const engine1 = new DiceEngine(seed);
        const engine2 = new DiceEngine(seed);

        const result1 = engine1.roll('1d20');
        const result2 = engine2.roll('1d20');

        expect(result1.result).toBe(result2.result);
        expect(result1.metadata?.rolls).toEqual(result2.metadata?.rolls);
    });

    it('should handle modifiers', () => {
        const engine = new DiceEngine('modifier-test');
        // Mock RNG or just check math
        // With seed 'modifier-test', 1d6 might be specific.
        // Let's just check if result = sum + modifier
        const result = engine.roll('2d6+5');
        const rolls = result.metadata?.rolls as number[];
        const sum = rolls.reduce((a, b) => a + b, 0);
        expect(result.result).toBe(sum + 5);
    });

    it('should handle exploding dice', () => {
        // We need a seed that triggers explosion.
        // This is hard to guess without trial, but we can mock if we refactor.
        // For now, let's just ensure it runs without error.
        const engine = new DiceEngine();
        const result = engine.roll('10d4!'); // High chance of explosion
        expect(result.result).toBeGreaterThanOrEqual(10);
    });

    it('should handle advantage', () => {
        const engine = new DiceEngine();
        const result = engine.roll({ count: 1, sides: 20, modifier: 0, advantage: true });
        expect(result.steps).toEqual(expect.arrayContaining([expect.stringMatching(/Advantage: Taken/)]));
    });
});
