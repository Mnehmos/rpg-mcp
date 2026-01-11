/**
 * Consolidated Item Management Tool
 * Replaces 6 separate tools: create_item_template, get_item, list_items, search_items, update_item, delete_item
 */

import { z } from 'zod';
import { randomUUID } from 'crypto';
import { createActionRouter, ActionDefinition, McpResponse } from '../../utils/action-router.js';
import { ItemRepository } from '../../storage/repos/item.repo.js';
import { ItemSchema } from '../../schema/inventory.js';
import { getDb } from '../../storage/index.js';
import { SessionContext } from '../types.js';
import { RichFormatter } from '../utils/formatter.js';

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const ACTIONS = ['create', 'get', 'list', 'search', 'update', 'delete'] as const;
type ItemAction = typeof ACTIONS[number];

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE HELPER
// ═══════════════════════════════════════════════════════════════════════════

function ensureDb() {
    const dbPath = process.env.NODE_ENV === 'test'
        ? ':memory:'
        : process.env.RPG_DATA_DIR
            ? `${process.env.RPG_DATA_DIR}/rpg.db`
            : 'rpg.db';
    const db = getDb(dbPath);
    const itemRepo = new ItemRepository(db);
    return { itemRepo };
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTION SCHEMAS
// ═══════════════════════════════════════════════════════════════════════════

const CreateSchema = z.object({
    action: z.literal('create'),
    name: z.string().min(1).describe('Item name'),
    type: z.enum(['weapon', 'armor', 'consumable', 'quest', 'misc', 'scroll']).describe('Item type'),
    description: z.string().optional().describe('Item description'),
    weight: z.number().min(0).describe('Item weight in lbs'),
    value: z.number().min(0).describe('Item value in gold pieces'),
    properties: z.record(z.any()).optional().describe('Additional item properties')
});

const GetSchema = z.object({
    action: z.literal('get'),
    itemId: z.string().describe('The unique ID of the item to retrieve')
});

const ListSchema = z.object({
    action: z.literal('list'),
    type: z.enum(['weapon', 'armor', 'consumable', 'quest', 'misc', 'scroll']).optional().describe('Filter by item type')
});

const SearchSchema = z.object({
    action: z.literal('search'),
    name: z.string().optional().describe('Search by name (partial match)'),
    type: z.enum(['weapon', 'armor', 'consumable', 'quest', 'misc', 'scroll']).optional().describe('Filter by item type'),
    minValue: z.number().min(0).optional().describe('Minimum item value'),
    maxValue: z.number().min(0).optional().describe('Maximum item value')
});

const UpdateSchema = z.object({
    action: z.literal('update'),
    itemId: z.string().describe('The ID of the item to update'),
    name: z.string().optional(),
    description: z.string().optional(),
    type: z.enum(['weapon', 'armor', 'consumable', 'quest', 'misc', 'scroll']).optional(),
    weight: z.number().min(0).optional(),
    value: z.number().min(0).optional(),
    properties: z.record(z.any()).optional()
});

const DeleteSchema = z.object({
    action: z.literal('delete'),
    itemId: z.string().describe('The ID of the item to delete')
});

// ═══════════════════════════════════════════════════════════════════════════
// ACTION DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const definitions: Record<ItemAction, ActionDefinition> = {
    create: {
        schema: CreateSchema,
        handler: async (params: z.infer<typeof CreateSchema>) => {
            const { itemRepo } = ensureDb();

            const now = new Date().toISOString();
            const item = {
                name: params.name,
                type: params.type,
                description: params.description,
                weight: params.weight,
                value: params.value,
                properties: params.properties,
                id: randomUUID(),
                createdAt: now,
                updatedAt: now
            };

            itemRepo.create(item);

            return {
                success: true,
                item,
                message: `Item template "${item.name}" created`
            };
        },
        aliases: ['new', 'add', 'template']
    },

    get: {
        schema: GetSchema,
        handler: async (params: z.infer<typeof GetSchema>) => {
            const { itemRepo } = ensureDb();

            const item = itemRepo.findById(params.itemId);
            if (!item) {
                throw new Error(`Item not found: ${params.itemId}`);
            }

            return {
                success: true,
                item
            };
        },
        aliases: ['fetch', 'find', 'read']
    },

    list: {
        schema: ListSchema,
        handler: async (params: z.infer<typeof ListSchema>) => {
            const { itemRepo } = ensureDb();

            let items;
            if (params.type) {
                items = itemRepo.findByType(params.type);
            } else {
                items = itemRepo.findAll();
            }

            return {
                success: true,
                items,
                count: items.length,
                filter: params.type || null
            };
        },
        aliases: ['all', 'show']
    },

    search: {
        schema: SearchSchema,
        handler: async (params: z.infer<typeof SearchSchema>) => {
            const { itemRepo } = ensureDb();

            const items = itemRepo.search({
                name: params.name,
                type: params.type,
                minValue: params.minValue,
                maxValue: params.maxValue
            });

            return {
                success: true,
                items,
                count: items.length,
                query: params
            };
        },
        aliases: ['query', 'filter', 'find_by']
    },

    update: {
        schema: UpdateSchema,
        handler: async (params: z.infer<typeof UpdateSchema>) => {
            const { itemRepo } = ensureDb();

            const { itemId, action, ...updates } = params;
            const item = itemRepo.update(itemId, updates);

            if (!item) {
                throw new Error(`Item not found: ${itemId}`);
            }

            return {
                success: true,
                item,
                message: `Item "${item.name}" updated`
            };
        },
        aliases: ['modify', 'edit', 'patch']
    },

    delete: {
        schema: DeleteSchema,
        handler: async (params: z.infer<typeof DeleteSchema>) => {
            const { itemRepo } = ensureDb();

            const existing = itemRepo.findById(params.itemId);
            if (!existing) {
                throw new Error(`Item not found: ${params.itemId}`);
            }

            itemRepo.delete(params.itemId);

            return {
                success: true,
                deletedItem: existing,
                message: `Item "${existing.name}" deleted`
            };
        },
        aliases: ['remove', 'destroy']
    }
};

// ═══════════════════════════════════════════════════════════════════════════
// ROUTER & TOOL DEFINITION
// ═══════════════════════════════════════════════════════════════════════════

const router = createActionRouter({
    actions: ACTIONS,
    definitions,
    threshold: 0.6
});

export const ItemManageTool = {
    name: 'item_manage',
    description: `Unified item template management. Actions: ${ACTIONS.join(', ')}. Aliases: new/add→create, fetch→get, all→list, query→search, modify→update, remove→delete.`,
    inputSchema: z.object({
        action: z.string().describe(`Action to perform: ${ACTIONS.join(', ')}`),
        itemId: z.string().optional().describe('Item ID (for get, update, delete)'),
        name: z.string().optional().describe('Item name'),
        type: z.enum(['weapon', 'armor', 'consumable', 'quest', 'misc', 'scroll']).optional().describe('Item type'),
        description: z.string().optional().describe('Item description'),
        weight: z.number().optional().describe('Item weight in lbs'),
        value: z.number().optional().describe('Item value in gp'),
        properties: z.record(z.any()).optional().describe('Additional properties'),
        minValue: z.number().optional().describe('Minimum value for search'),
        maxValue: z.number().optional().describe('Maximum value for search')
    })
};

// ═══════════════════════════════════════════════════════════════════════════
// HANDLER
// ═══════════════════════════════════════════════════════════════════════════

export async function handleItemManage(args: unknown, _ctx: SessionContext): Promise<McpResponse> {
    const result = await router(args as Record<string, unknown>);

    // The router already returns McpResponse format
    // But we want to add rich formatting
    const parsed = JSON.parse(result.content[0].text);

    let output = '';

    if (parsed.error) {
        output = RichFormatter.header('Error', '❌');
        output += RichFormatter.alert(parsed.message || 'Unknown error', 'error');
        if (parsed.suggestions) {
            output += '\n**Did you mean:**\n';
            parsed.suggestions.forEach((s: { action: string; similarity: number }) => {
                output += `  • ${s.action} (${s.similarity}% match)\n`;
            });
        }
    } else if (parsed.item) {
        const item = parsed.item;
        output = RichFormatter.header(item.name || 'Item', '📦');
        output += RichFormatter.keyValue({
            'ID': `\`${item.id}\``,
            'Type': item.type,
            'Weight': `${item.weight} lbs`,
            'Value': `${item.value} gp`,
        });
        if (item.description) {
            output += `\n${item.description}\n`;
        }
        if (parsed.message) {
            output += RichFormatter.success(parsed.message);
        }
    } else if (parsed.items) {
        output = RichFormatter.header('Items', '📦');
        if (parsed.filter) {
            output += RichFormatter.keyValue({ 'Filter': parsed.filter });
        }
        if (parsed.query) {
            const queryInfo: Record<string, unknown> = {};
            if (parsed.query.name) queryInfo['Name'] = parsed.query.name;
            if (parsed.query.type) queryInfo['Type'] = parsed.query.type;
            if (parsed.query.minValue !== undefined) queryInfo['Min Value'] = parsed.query.minValue;
            if (parsed.query.maxValue !== undefined) queryInfo['Max Value'] = parsed.query.maxValue;
            output += RichFormatter.keyValue(queryInfo);
        }
        if (parsed.items.length === 0) {
            output += RichFormatter.alert('No items found.', 'info');
        } else {
            const rows = parsed.items.map((i: { name: string; type: string; weight: number; value: number }) =>
                [i.name, i.type, `${i.weight}`, `${i.value} gp`]
            );
            output += RichFormatter.table(['Name', 'Type', 'Weight', 'Value'], rows);
            output += `\n*${parsed.count} item(s) total*\n`;
        }
    } else if (parsed.deletedItem) {
        output = RichFormatter.header('Item Deleted', '🗑️');
        output += RichFormatter.keyValue({
            'Name': parsed.deletedItem.name,
            'ID': `\`${parsed.deletedItem.id}\``,
        });
        output += RichFormatter.success(parsed.message);
    }

    output += RichFormatter.embedJson(parsed, 'ITEM_MANAGE');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}
