import { AuditRepository } from '../storage/audit.repo';
import { getDb } from '../storage';

export class AuditLogger {
    private repo: AuditRepository;

    constructor() {
        const db = getDb(process.env.NODE_ENV === 'test' ? ':memory:' : 'rpg.db');
        this.repo = new AuditRepository(db);
    }

    wrapHandler(toolName: string, handler: (args: any) => Promise<any>) {
        return async (args: any) => {
            const startTime = Date.now();
            let result: any;
            let error: any;

            try {
                result = await handler(args);
                return result;
            } catch (e: any) {
                error = e;
                throw e;
            } finally {
                try {
                    this.repo.create({
                        action: toolName,
                        actorId: null,
                        targetId: null,
                        details: {
                            args,
                            result,
                            error: error ? error.message : undefined,
                            duration: Date.now() - startTime
                        },
                        timestamp: new Date().toISOString()
                    });
                } catch (logError) {
                    console.error('Failed to write audit log:', logError);
                }
            }
        };
    }
}
