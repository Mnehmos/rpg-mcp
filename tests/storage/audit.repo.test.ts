import Database from 'better-sqlite3';
import { migrate } from '../../src/storage/migrations';
import { AuditRepository } from '../../src/storage/audit.repo';

describe('AuditRepository', () => {
    let db: Database.Database;
    let repo: AuditRepository;

    beforeEach(() => {
        db = new Database(':memory:');
        migrate(db);
        repo = new AuditRepository(db);
    });

    it('should create and list audit logs', () => {
        const log = {
            action: 'test_action',
            actorId: 'user-1',
            targetId: 'target-1',
            details: { foo: 'bar' },
            timestamp: new Date().toISOString()
        };

        const created = repo.create(log);
        expect(created.id).toBeDefined();
        expect(created.action).toBe(log.action);
        expect(created.details).toEqual(log.details);

        const list = repo.list();
        expect(list).toHaveLength(1);
        expect(list[0]).toEqual(created);
    });

    it('should handle missing optional fields', () => {
        const log = {
            action: 'simple_action',
            timestamp: new Date().toISOString()
        };

        const created = repo.create(log);
        expect(created.id).toBeDefined();
        expect(created.actorId).toBeNull();
        expect(created.details).toBeUndefined();
    });
});
