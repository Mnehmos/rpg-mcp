import { handleDiceRoll, handleProbabilityCalculate, handleAlgebraSolve, handleAlgebraSimplify, handlePhysicsProjectile } from '../../src/server/math-tools';
import { CalculationRepository } from '../../src/storage/repos/calculation.repo';
import { getDb, closeDb } from '../../src/storage';
import { migrate } from '../../src/storage/migrations';
import Database from 'better-sqlite3';

describe('Math Tools', () => {
    let db: Database.Database;
    let repo: CalculationRepository;

    beforeEach(() => {
        db = getDb(':memory:');
        migrate(db);
        repo = new CalculationRepository(db);
    });

    afterEach(() => {
        closeDb();
    });

    it('should roll dice and persist result', async () => {
        const result = await handleDiceRoll({ expression: '2d6+3', seed: 'test-seed', exportFormat: 'steps' });
        expect(result.content[0].text).toContain('Total');

        const calculations = repo.findAll();
        expect(calculations).toHaveLength(1);
        expect(calculations[0].input).toBe('2d6+3');
        expect(calculations[0].seed).toBe('test-seed');
    });

    it('should calculate probability and persist result', async () => {
        const result = await handleProbabilityCalculate({
            expression: '1d20',
            target: 15,
            comparison: 'gte',
            modifiers: [],
            exportFormat: 'steps'
        });
        expect(result.content[0].text).toContain('Probability');

        const calculations = repo.findAll();
        expect(calculations).toHaveLength(1);
        expect(calculations[0].metadata?.probability).toBeDefined();
    });

    it('should solve algebra and persist result', async () => {
        const result = await handleAlgebraSolve({ equation: 'x^2 - 4', variable: 'x', exportFormat: 'steps' });
        expect(result.content[0].text).toContain('Result');

        const calculations = repo.findAll();
        expect(calculations).toHaveLength(1);
    });

    it('should simplify algebra and persist result', async () => {
        const result = await handleAlgebraSimplify({ expression: '2*x + 3*x', exportFormat: 'steps' });
        expect(result.content[0].text).toContain('5*x');

        const calculations = repo.findAll();
        expect(calculations).toHaveLength(1);
    });

    it('should calculate projectile physics and persist result', async () => {
        const result = await handlePhysicsProjectile({
            velocity: 10,
            angle: 45,
            height: 0,
            gravity: 9.81,
            exportFormat: 'steps'
        });
        expect(result.content[0].text).toContain('Max Height');

        const calculations = repo.findAll();
        expect(calculations).toHaveLength(1);
        expect(calculations[0].metadata?.flightTime).toBeDefined();
    });
});
