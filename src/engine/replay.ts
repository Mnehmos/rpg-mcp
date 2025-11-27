import { AuditRepository } from '../storage/audit.repo';

export class ReplayEngine {
    constructor(
        private repo: AuditRepository,
        private handlers: Record<string, (args: any) => Promise<any>>
    ) { }

    async replay(options: { limit?: number } = {}) {
        const limit = options.limit || 1000;
        const logs = this.repo.list(limit);

        // Sort by timestamp ascending (oldest first)
        logs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        console.log(`Replaying ${logs.length} logs`);

        const results = [];

        for (const log of logs) {
            const handler = this.handlers[log.action];
            if (handler) {
                try {
                    // We assume the handler modifies state or DB
                    // We don't necessarily care about the return value for replay,
                    // but capturing it might be useful for verification.
                    const result = await handler(log.details?.args);
                    results.push({ action: log.action, success: true, result });
                } catch (e: any) {
                    console.error(`Error replaying ${log.action}:`, e);
                    results.push({ action: log.action, success: false, error: e.message });
                }
            } else {
                console.warn(`No handler found for ${log.action}`);
                results.push({ action: log.action, skipped: true });
            }
        }

        return results;
    }
}
