/**
 * Simple Pub/Sub system for event streaming.
 */
export class PubSub {
    private subscribers: Map<string, Set<(payload: any) => void>> = new Map();

    subscribe(topic: string, callback: (payload: any) => void): () => void {
        if (!this.subscribers.has(topic)) {
            this.subscribers.set(topic, new Set());
        }

        this.subscribers.get(topic)!.add(callback);

        return () => {
            const subs = this.subscribers.get(topic);
            if (subs) {
                subs.delete(callback);
                if (subs.size === 0) {
                    this.subscribers.delete(topic);
                }
            }
        };
    }

    publish(topic: string, payload: any): void {
        const subs = this.subscribers.get(topic);
        if (subs) {
            subs.forEach(callback => {
                try {
                    callback(payload);
                } catch (error) {
                    console.error(`Error in subscriber for topic ${topic}:`, error);
                }
            });
        }
    }
}
