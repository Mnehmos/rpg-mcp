import { z } from 'zod';
import { PubSub } from '../engine/pubsub';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export const EventTools = {
    SUBSCRIBE: {
        name: 'subscribe_to_events',
        description: `Subscribe to real-time events.
        
Events will be sent as JSON-RPC notifications with method 'notifications/rpg/event'.
Supported topics: 'world', 'combat'.`,
        inputSchema: z.object({
            topics: z.array(z.enum(['world', 'combat'])).min(1)
        })
    }
} as const;

export function registerEventTools(server: McpServer, pubsub: PubSub) {
    server.tool(
        EventTools.SUBSCRIBE.name,
        EventTools.SUBSCRIBE.description,
        EventTools.SUBSCRIBE.inputSchema.shape,
        async (args: any) => {
            const parsed = EventTools.SUBSCRIBE.inputSchema.parse(args);

            for (const topic of parsed.topics) {
                pubsub.subscribe(topic, (payload) => {
                    server.server.notification({
                        method: 'notifications/rpg/event',
                        params: {
                            topic,
                            payload
                        }
                    });
                });
            }

            return {
                content: [{
                    type: 'text',
                    text: `Subscribed to topics: ${parsed.topics.join(', ')}`
                }]
            };
        }
    );
}
