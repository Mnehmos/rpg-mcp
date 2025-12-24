import { ExportEngine } from '../../src/math/export';
import { CalculationResult } from '../../src/math/schemas';

describe('ExportEngine', () => {
    const engine = new ExportEngine();
    const mockResult: CalculationResult = {
        input: '2x',
        result: '2*x',
        steps: ['Simplified'],
        timestamp: new Date().toISOString()
    };

    it('should export to plaintext', () => {
        expect(engine.export(mockResult, 'plaintext')).toBe('2*x');
    });

    it('should export to steps', () => {
        const output = engine.export(mockResult, 'steps');
        expect(output).toContain('Input: 2x');
        expect(output).toContain('1. Simplified');
    });

    it('should export to latex', () => {
        // nerdamer 2*x -> 2x or 2 \cdot x
        const output = engine.export(mockResult, 'latex');
        // nerdamer usually outputs 2 \cdot x or 2 x
        expect(output).toContain('x');
    });
});
