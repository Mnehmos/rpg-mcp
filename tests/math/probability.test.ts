import { ProbabilityEngine } from '../../src/math/probability';

describe('ProbabilityEngine', () => {
    const engine = new ProbabilityEngine();

    it('should calculate simple probability', () => {
        // 1d20 >= 11 is 50%
        expect(engine.calculateProbability('1d20', 11)).toBeCloseTo(0.5);
        // 1d20 >= 20 is 5%
        expect(engine.calculateProbability('1d20', 20)).toBeCloseTo(0.05);
    });

    it('should handle modifiers', () => {
        // 1d20+5 >= 15 is same as 1d20 >= 10 (55%)
        expect(engine.calculateProbability('1d20+5', 15)).toBeCloseTo(0.55);
    });

    it('should handle multiple dice', () => {
        // 2d6 distribution:
        // 2: 1/36
        // 7: 6/36 = 1/6
        // 12: 1/36
        const dist = engine.getDistribution('2d6');
        expect(dist.get(2)).toBeCloseTo(1 / 36);
        expect(dist.get(7)).toBeCloseTo(6 / 36);
        expect(dist.get(12)).toBeCloseTo(1 / 36);
    });

    it('should calculate expected value', () => {
        expect(engine.expectedValue('1d20')).toBe(10.5);
        expect(engine.expectedValue('2d6')).toBe(7);
        expect(engine.expectedValue('1d20+5')).toBe(15.5);
    });

    it('should handle advantage', () => {
        // 1d20 advantage
        // EV should be 13.825
        const ev = engine.expectedValue({ count: 1, sides: 20, modifier: 0, advantage: true });
        expect(ev).toBeCloseTo(13.825);
    });

    it('should handle disadvantage', () => {
        // 1d20 disadvantage
        // EV should be 7.175
        const ev = engine.expectedValue({ count: 1, sides: 20, modifier: 0, disadvantage: true });
        expect(ev).toBeCloseTo(7.175);
    });

    it('should compare expressions', () => {
        // P(1d20 > 1d20) should be slightly less than 0.5 (ties are possible)
        // P(A > B) + P(B > A) + P(A = B) = 1
        // P(A > B) = P(B > A)
        // P(A = B) = sum(p^2) = 20 * (1/400) = 1/20 = 0.05
        // 2 * P(A > B) = 0.95 => P(A > B) = 0.475
        expect(engine.compare('1d20', '1d20')).toBeCloseTo(0.475);

        // P(1d20+5 > 1d20)
        // Should be high
        expect(engine.compare('1d20+5', '1d20')).toBeGreaterThan(0.6);
    });

    it('should handle exploding dice', () => {
        // 1d4!
        // EV for d4! is 4.2 (approx)
        // Formula: E = sides/2 + 0.5 + E/sides => E(1 - 1/sides) = (sides+1)/2 => E = (sides+1)/2 * (sides/(sides-1))
        // For d4: 2.5 * (4/3) = 10/3 = 3.333...
        // Wait, standard explosion adds the new roll.
        // E = \sum p_i x_i
        // E = (1/s)(1 + ... + s-1) + (1/s)(s + E)
        // E = (1/s)(s(s-1)/2) + 1 + E/s
        // E(1 - 1/s) = (s-1)/2 + 1 = (s+1)/2
        // E((s-1)/s) = (s+1)/2
        // E = s(s+1) / 2(s-1)
        // For d4: 4*5 / 2*3 = 20/6 = 3.333
        // For d6: 6*7 / 2*5 = 42/10 = 4.2

        expect(engine.expectedValue('1d4!')).toBeCloseTo(3.333, 2);
        expect(engine.expectedValue('1d6!')).toBeCloseTo(4.2, 2);
    });
});
