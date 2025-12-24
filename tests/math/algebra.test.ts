import { AlgebraEngine } from '../../src/math/algebra';

describe('AlgebraEngine', () => {
    const engine = new AlgebraEngine();

    it('should solve linear equations', () => {
        const result = engine.solve('2x + 4 = 10', 'x');
        // nerdamer returns [3] usually
        expect(result.result).toContain('3');
    });

    it('should solve quadratic equations', () => {
        const result = engine.solve('x^2 - 4 = 0', 'x');
        // returns [2, -2]
        expect(result.result).toContain('2');
        expect(result.result).toContain('-2');
    });

    it('should simplify expressions', () => {
        const result = engine.simplify('2x + 3x');
        expect(result.result).toBe('5*x');
    });

    it('should substitute variables', () => {
        const result = engine.substitute('2x + y', { x: 3, y: 4 });
        // 2*3 + 4 = 10
        expect(result.result).toBe('10');
    });

    it('should differentiate expressions', () => {
        const result = engine.differentiate('x^2', 'x');
        expect(result.result).toBe('2*x');
    });

    it('should integrate expressions', () => {
        const result = engine.integrate('2*x', 'x');
        // nerdamer usually returns x^2
        expect(result.result).toBe('x^2');
    });

    it('should handle errors gracefully', () => {
        const result = engine.solve('invalid syntax', 'x');
        // nerdamer might return empty array for things it can't solve
        expect(['Error', '[]']).toContain(result.result);
    });
});
