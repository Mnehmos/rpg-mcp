import { Database } from 'better-sqlite3';
import { AuditLog, AuditLogSchema } from '../schema/audit.js';

export class AuditRepository {
    constructor(private db: Database) { }

    create(log: Omit<AuditLog, 'id'>): AuditLog {
        // Validate input
        const validated = AuditLogSchema.omit({ id: true }).parse(log);

        const stmt = this.db.prepare(`
            INSERT INTO audit_logs (action, actor_id, target_id, details, timestamp)
            VALUES (@action, @actorId, @targetId, @details, @timestamp)
        `);

        const info = stmt.run({
            action: validated.action,
            actorId: validated.actorId || null,
            targetId: validated.targetId || null,
            details: validated.details ? JSON.stringify(validated.details) : null,
            timestamp: validated.timestamp
        });

        return {
            ...validated,
            actorId: validated.actorId ?? null,
            targetId: validated.targetId ?? null,
            id: Number(info.lastInsertRowid)
        };
    }

    list(limit: number = 50): AuditLog[] {
        const stmt = this.db.prepare(`
            SELECT id, action, actor_id as actorId, target_id as targetId, details, timestamp
            FROM audit_logs
            ORDER BY timestamp DESC
            LIMIT ?
        `);

        const rows = stmt.all(limit) as any[];
        console.error(`AuditRepository.list found ${rows.length} rows`);

        return rows.map(row => ({
            id: row.id,
            action: row.action,
            actorId: row.actorId,
            targetId: row.targetId,
            details: row.details ? JSON.parse(row.details) : undefined,
            timestamp: row.timestamp
        }));
    }
}
