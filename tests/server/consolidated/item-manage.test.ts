/**
 * Tests for consolidated item_manage tool
 * Validates all 6 actions: create, get, list, search, update, delete
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { handleItemManage, ItemManageTool } from '../../../src/server/consolidated/item-manage.js';
import { getDb } from '../../../src/storage/index.js';

// Force test mode
process.env.NODE_ENV = 'test';

function parseResult(result: { content: Array<{ type: string; text: string }> }) {
    const text = result.content[0].text;
    // Match HTML comment format: <!-- ITEM_MANAGE_JSON ... ITEM_MANAGE_JSON -->
    const jsonMatch = text.match(/<!-- ITEM_MANAGE_JSON\n([\s\S]*?)\nITEM_MANAGE_JSON -->/);
    return jsonMatch ? JSON.parse(jsonMatch[1]) : null;
}

describe('item_manage consolidated tool', () => {
    const ctx = { sessionId: 'test-session' };

    beforeEach(() => {
        // Reset test database
        const db = getDb(':memory:');
        db.exec('DELETE FROM items');
    });

    describe('Tool Definition', () => {
        it('should have correct tool name', () => {
            expect(ItemManageTool.name).toBe('item_manage');
        });

        it('should list all available actions in description', () => {
            expect(ItemManageTool.description).toContain('create');
            expect(ItemManageTool.description).toContain('get');
            expect(ItemManageTool.description).toContain('list');
            expect(ItemManageTool.description).toContain('search');
            expect(ItemManageTool.description).toContain('update');
            expect(ItemManageTool.description).toContain('delete');
        });

        it('should have action in input schema', () => {
            const shape = ItemManageTool.inputSchema.shape;
            expect(shape.action).toBeDefined();
        });
    });

    describe('create action', () => {
        it('should create a new item template', async () => {
            const result = await handleItemManage({
                action: 'create',
                name: 'Iron Sword',
                type: 'weapon',
                description: 'A sturdy iron sword',
                weight: 3,
                value: 10
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.item.name).toBe('Iron Sword');
            expect(data.item.type).toBe('weapon');
            expect(data.item.id).toBeDefined();
        });

        it('should accept "new" alias for create', async () => {
            const result = await handleItemManage({
                action: 'new',
                name: 'Health Potion',
                type: 'consumable',
                weight: 0.5,
                value: 50
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.item.name).toBe('Health Potion');
        });

        it('should accept "template" alias for create', async () => {
            const result = await handleItemManage({
                action: 'template',
                name: 'Magic Staff',
                type: 'weapon',
                weight: 4,
                value: 200
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.item.name).toBe('Magic Staff');
        });
    });

    describe('get action', () => {
        it('should retrieve an item by ID', async () => {
            // Create first
            const createResult = await handleItemManage({
                action: 'create',
                name: 'Leather Armor',
                type: 'armor',
                weight: 10,
                value: 25
            }, ctx);
            const createData = parseResult(createResult);

            // Get
            const result = await handleItemManage({
                action: 'get',
                itemId: createData.item.id
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.item.name).toBe('Leather Armor');
        });

        it('should accept "fetch" alias for get', async () => {
            const createResult = await handleItemManage({
                action: 'create',
                name: 'Ring of Protection',
                type: 'misc',
                weight: 0.1,
                value: 500
            }, ctx);
            const createData = parseResult(createResult);

            const result = await handleItemManage({
                action: 'fetch',
                itemId: createData.item.id
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.item.name).toBe('Ring of Protection');
        });

        it('should return error for non-existent item', async () => {
            const result = await handleItemManage({
                action: 'get',
                itemId: 'non-existent-id'
            }, ctx);

            const data = parseResult(result);
            expect(data.error).toBeDefined();
            expect(data.message).toContain('Item not found');
        });
    });

    describe('list action', () => {
        beforeEach(async () => {
            // Create test items
            await handleItemManage({
                action: 'create',
                name: 'Sword',
                type: 'weapon',
                weight: 3,
                value: 15
            }, ctx);
            await handleItemManage({
                action: 'create',
                name: 'Shield',
                type: 'armor',
                weight: 6,
                value: 10
            }, ctx);
            await handleItemManage({
                action: 'create',
                name: 'Dagger',
                type: 'weapon',
                weight: 1,
                value: 5
            }, ctx);
        });

        it('should list all items', async () => {
            const result = await handleItemManage({
                action: 'list'
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.count).toBe(3);
        });

        it('should filter by type', async () => {
            const result = await handleItemManage({
                action: 'list',
                type: 'weapon'
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.count).toBe(2);
            expect(data.filter).toBe('weapon');
        });

        it('should accept "all" alias for list', async () => {
            const result = await handleItemManage({
                action: 'all'
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.count).toBeGreaterThanOrEqual(3);
        });
    });

    describe('search action', () => {
        beforeEach(async () => {
            await handleItemManage({
                action: 'create',
                name: 'Enchanted Sword',
                type: 'weapon',
                weight: 3,
                value: 500
            }, ctx);
            await handleItemManage({
                action: 'create',
                name: 'Rusty Sword',
                type: 'weapon',
                weight: 3,
                value: 2
            }, ctx);
            await handleItemManage({
                action: 'create',
                name: 'Healing Potion',
                type: 'consumable',
                weight: 0.5,
                value: 50
            }, ctx);
        });

        it('should search by name', async () => {
            const result = await handleItemManage({
                action: 'search',
                name: 'Sword'
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.count).toBe(2);
        });

        it('should search by value range', async () => {
            const result = await handleItemManage({
                action: 'search',
                minValue: 100
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.items.every((i: { value: number }) => i.value >= 100)).toBe(true);
        });

        it('should accept "query" alias for search', async () => {
            const result = await handleItemManage({
                action: 'query',
                type: 'consumable'
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.items[0].name).toBe('Healing Potion');
        });
    });

    describe('update action', () => {
        it('should update item properties', async () => {
            const createResult = await handleItemManage({
                action: 'create',
                name: 'Basic Sword',
                type: 'weapon',
                weight: 3,
                value: 10
            }, ctx);
            const createData = parseResult(createResult);

            const result = await handleItemManage({
                action: 'update',
                itemId: createData.item.id,
                name: 'Enhanced Sword',
                value: 100
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.item.name).toBe('Enhanced Sword');
            expect(data.item.value).toBe(100);
        });

        it('should accept "modify" alias for update', async () => {
            const createResult = await handleItemManage({
                action: 'create',
                name: 'Test Item',
                type: 'misc',
                weight: 1,
                value: 5
            }, ctx);
            const createData = parseResult(createResult);

            const result = await handleItemManage({
                action: 'modify',
                itemId: createData.item.id,
                description: 'A modified item'
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
        });

        it('should return error for non-existent item', async () => {
            const result = await handleItemManage({
                action: 'update',
                itemId: 'non-existent',
                name: 'New Name'
            }, ctx);

            const data = parseResult(result);
            expect(data.error).toBeDefined();
            expect(data.message).toContain('Item not found');
        });
    });

    describe('delete action', () => {
        it('should delete an item', async () => {
            const createResult = await handleItemManage({
                action: 'create',
                name: 'To Be Deleted',
                type: 'misc',
                weight: 1,
                value: 1
            }, ctx);
            const createData = parseResult(createResult);

            const result = await handleItemManage({
                action: 'delete',
                itemId: createData.item.id
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.deletedItem.name).toBe('To Be Deleted');

            // Verify deletion
            const getResult = await handleItemManage({
                action: 'get',
                itemId: createData.item.id
            }, ctx);
            const getData = parseResult(getResult);
            expect(getData.error).toBeDefined();
        });

        it('should accept "remove" alias for delete', async () => {
            const createResult = await handleItemManage({
                action: 'create',
                name: 'Another Item',
                type: 'misc',
                weight: 1,
                value: 1
            }, ctx);
            const createData = parseResult(createResult);

            const result = await handleItemManage({
                action: 'remove',
                itemId: createData.item.id
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
        });

        it('should return error for non-existent item', async () => {
            const result = await handleItemManage({
                action: 'delete',
                itemId: 'non-existent'
            }, ctx);

            const data = parseResult(result);
            expect(data.error).toBeDefined();
            expect(data.message).toContain('Item not found');
        });
    });

    describe('fuzzy matching', () => {
        it('should auto-correct close typos', async () => {
            // "crate" is close enough to "create" that it should auto-correct
            const result = await handleItemManage({
                action: 'crate', // typo for 'create'
                name: 'Test',
                type: 'misc',
                weight: 1,
                value: 1
            }, ctx);

            const data = parseResult(result);
            // Should auto-correct and succeed
            expect(data.success).toBe(true);
            expect(data.item.name).toBe('Test');
        });

        it('should provide helpful error for unknown action', async () => {
            const result = await handleItemManage({
                action: 'xyz'
            }, ctx);

            const data = parseResult(result);
            expect(data.error).toBe('invalid_action');
            expect(data.suggestions).toBeDefined();
            expect(data.message).toContain('Unknown action');
        });
    });

    describe('output formatting', () => {
        it('should include rich text formatting', async () => {
            const result = await handleItemManage({
                action: 'create',
                name: 'Formatted Item',
                type: 'weapon',
                weight: 2,
                value: 20
            }, ctx);

            const text = result.content[0].text;
            expect(text).toContain('📦'); // Item emoji
            expect(text).toContain('Formatted Item');
        });

        it('should embed JSON for parsing', async () => {
            const result = await handleItemManage({
                action: 'list'
            }, ctx);

            const text = result.content[0].text;
            expect(text).toContain('<!-- ITEM_MANAGE_JSON');
        });
    });
});
