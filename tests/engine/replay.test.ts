import { ReplayEngine } from '../../src/engine/replay';
import { AuditRepository } from '../../src/storage/audit.repo';
import { getDb, closeDb } from '../../src/storage';

describe('ReplayEngine', () => {
    let repo: AuditRepository;
    let engine: ReplayEngine;
    let handlers: Record<string, any>;

    beforeEach(() => {
        closeDb();
        const db = getDb(':memory:');
        repo = new AuditRepository(db);

        handlers = {
            'action_1': vi.fn().mockResolvedValue('result_1'),
            'action_2': vi.fn().mockResolvedValue('result_2')
        };

        engine = new ReplayEngine(repo, handlers);
    });

    it('should replay actions in order', async () => {
        // Seed logs
        repo.create({
            action: 'action_1',
            details: { args: { val: 1 } },
            timestamp: new Date(Date.now() - 1000).toISOString()
        });

        repo.create({
            action: 'action_2',
            details: { args: { val: 2 } },
            timestamp: new Date(Date.now()).toISOString()
        });

        const results = await engine.replay();

        expect(results).toHaveLength(2);
        expect(results[0].action).toBe('action_1');
        expect(results[1].action).toBe('action_2');

        expect(handlers.action_1).toHaveBeenCalledWith({ val: 1 });
        expect(handlers.action_2).toHaveBeenCalledWith({ val: 2 });
    });

    it('should handle missing handlers', async () => {
        repo.create({
            action: 'unknown_action',
            timestamp: new Date().toISOString()
        });

        const results = await engine.replay();
        expect(results[0].skipped).toBe(true);
    });

    it('should handle handler errors', async () => {
        handlers.action_error = vi.fn().mockRejectedValue(new Error('Fail'));

        repo.create({
            action: 'action_error',
            timestamp: new Date().toISOString()
        });

        const results = await engine.replay();
        expect(results[0].success).toBe(false);
        expect(results[0].error).toBe('Fail');
    });
});
