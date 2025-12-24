import { AuditLogger } from '../../src/server/audit';
import { AuditRepository } from '../../src/storage/audit.repo';
import { getDb } from '../../src/storage';

describe('AuditLogger', () => {
    let logger: AuditLogger;
    let repo: AuditRepository;

    beforeEach(() => {
        const db = getDb(':memory:');
        repo = new AuditRepository(db);
        logger = new AuditLogger();
    });

    it('should log tool execution success', async () => {
        const handler = async (args: any) => {
            return { success: true, value: args.value };
        };

        const wrapped = logger.wrapHandler('test_tool', handler);
        const args = { value: 123 };

        const result = await wrapped(args);
        expect(result).toEqual({ success: true, value: 123 });

        // Verify log
        const logs = repo.list();
        const log = logs.find(l => l.action === 'test_tool');
        expect(log).toBeDefined();
        expect(log?.details?.args).toEqual(args);
        expect(log?.details?.result).toEqual({ success: true, value: 123 });
    });

    it('should log tool execution error', async () => {
        const handler = async () => {
            throw new Error('Test Error');
        };

        const wrapped = logger.wrapHandler('test_error_tool', handler);

        await expect(wrapped({})).rejects.toThrow('Test Error');

        // Verify log
        const logs = repo.list();
        const log = logs.find(l => l.action === 'test_error_tool');
        expect(log).toBeDefined();
        expect(log?.details?.error).toBe('Test Error');
    });
});
