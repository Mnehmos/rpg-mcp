import { PubSub } from '../../src/engine/pubsub';

describe('PubSub System', () => {
    it('should allow subscription to topics', () => {
        const pubsub = new PubSub();
        const callback = vi.fn();

        pubsub.subscribe('combat', callback);

        pubsub.publish('combat', { type: 'test' });

        expect(callback).toHaveBeenCalledWith({ type: 'test' });
    });

    it('should not receive events for other topics', () => {
        const pubsub = new PubSub();
        const callback = vi.fn();

        pubsub.subscribe('combat', callback);

        pubsub.publish('world', { type: 'test' });

        expect(callback).not.toHaveBeenCalled();
    });

    it('should allow unsubscription', () => {
        const pubsub = new PubSub();
        const callback = vi.fn();

        const unsubscribe = pubsub.subscribe('combat', callback);
        unsubscribe();

        pubsub.publish('combat', { type: 'test' });

        expect(callback).not.toHaveBeenCalled();
    });

    it('should handle multiple subscribers', () => {
        const pubsub = new PubSub();
        const cb1 = vi.fn();
        const cb2 = vi.fn();

        pubsub.subscribe('combat', cb1);
        pubsub.subscribe('combat', cb2);

        pubsub.publish('combat', { type: 'test' });

        expect(cb1).toHaveBeenCalled();
        expect(cb2).toHaveBeenCalled();
    });
});
