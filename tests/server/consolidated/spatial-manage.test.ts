/**
 * Tests for consolidated spatial_manage tool
 * Validates all 5 actions: look, generate, get_exits, move, list
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { handleSpatialManage, SpatialManageTool } from '../../../src/server/consolidated/spatial-manage.js';
import { getDb } from '../../../src/storage/index.js';
import { SpatialRepository } from '../../../src/storage/repos/spatial.repo.js';
import { CharacterRepository } from '../../../src/storage/repos/character.repo.js';
import { randomUUID } from 'crypto';

process.env.NODE_ENV = 'test';

function parseResult(result: { content: Array<{ type: string; text: string }> }) {
    const text = result.content[0].text;
    const jsonMatch = text.match(/<!-- SPATIAL_MANAGE_JSON\n([\s\S]*?)\nSPATIAL_MANAGE_JSON -->/);
    if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
    }
    try {
        const parsed = JSON.parse(text);
        if (typeof parsed === 'object' && parsed !== null) {
            return parsed;
        }
    } catch {
        // Not valid JSON
    }
    return { error: 'parse_failed', rawText: text };
}

describe('spatial_manage consolidated tool', () => {
    let ctx: { sessionId: string };
    let testRoomId: string;
    let testCharacterId: string;

    beforeEach(async () => {
        ctx = { sessionId: `test-session-${randomUUID()}` };
        const db = getDb(':memory:');
        db.exec('DELETE FROM room_nodes');
        db.exec('DELETE FROM characters');

        // Create a test room
        const spatialRepo = new SpatialRepository(db);
        testRoomId = randomUUID();
        spatialRepo.create({
            id: testRoomId,
            name: 'Test Room',
            baseDescription: 'A test room for spatial testing.',
            biomeContext: 'urban',
            atmospherics: [],
            exits: [],
            entityIds: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            visitedCount: 0
        });

        // Create a test character
        const characterRepo = new CharacterRepository(db);
        testCharacterId = randomUUID();
        characterRepo.create({
            id: testCharacterId,
            name: 'Test Character',
            level: 1,
            hp: 20,
            maxHp: 20,
            ac: 12,
            stats: {
                str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10
            },
            inventory: [],
            currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        } as any);
    });

    describe('Tool Definition', () => {
        it('should have correct tool name', () => {
            expect(SpatialManageTool.name).toBe('spatial_manage');
        });

        it('should list all available actions in description', () => {
            expect(SpatialManageTool.description).toContain('look');
            expect(SpatialManageTool.description).toContain('generate');
            expect(SpatialManageTool.description).toContain('get_exits');
            expect(SpatialManageTool.description).toContain('move');
            expect(SpatialManageTool.description).toContain('list');
        });
    });

    describe('generate action', () => {
        it('should generate a new room', async () => {
            const result = await handleSpatialManage({
                action: 'generate',
                name: 'New Room',
                baseDescription: 'A newly generated room for testing purposes.',
                biomeContext: 'dungeon',
                atmospherics: ['DARKNESS']
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.actionType).toBe('generate');
            expect(data.roomId).toBeDefined();
            expect(data.name).toBe('New Room');
        });

        it('should accept "create" alias', async () => {
            const result = await handleSpatialManage({
                action: 'create',
                name: 'Alias Room',
                baseDescription: 'A room created via alias.',
                biomeContext: 'forest'
            }, ctx);

            const data = parseResult(result);
            expect(data.actionType).toBe('generate');
        });

        it('should link to previous room when specified', async () => {
            const result = await handleSpatialManage({
                action: 'generate',
                name: 'Linked Room',
                baseDescription: 'A room linked to the test room.',
                biomeContext: 'urban',
                previousNodeId: testRoomId,
                direction: 'north'
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.linkedToPrevious).toBe(true);
        });
    });

    describe('list action', () => {
        it('should list all rooms', async () => {
            const result = await handleSpatialManage({
                action: 'list'
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.actionType).toBe('list');
            expect(data.count).toBeGreaterThanOrEqual(1);
        });

        it('should accept "rooms" alias', async () => {
            const result = await handleSpatialManage({
                action: 'rooms'
            }, ctx);

            const data = parseResult(result);
            expect(data.actionType).toBe('list');
        });

        it('should filter by biome', async () => {
            // Create rooms with different biomes
            await handleSpatialManage({
                action: 'generate',
                name: 'Forest Room',
                baseDescription: 'A forest room for testing.',
                biomeContext: 'forest'
            }, ctx);

            const result = await handleSpatialManage({
                action: 'list',
                biome: 'forest'
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.rooms.every((r: any) => r.biomeContext === 'forest')).toBe(true);
        });
    });

    describe('get_exits action', () => {
        it('should get exits from a room', async () => {
            const result = await handleSpatialManage({
                action: 'get_exits',
                roomId: testRoomId
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.actionType).toBe('get_exits');
            expect(data.exits).toBeDefined();
        });

        it('should accept "exits" alias', async () => {
            const result = await handleSpatialManage({
                action: 'exits',
                roomId: testRoomId
            }, ctx);

            const data = parseResult(result);
            expect(data.actionType).toBe('get_exits');
        });
    });

    describe('move action', () => {
        it('should move character to room', async () => {
            const result = await handleSpatialManage({
                action: 'move',
                characterId: testCharacterId,
                roomId: testRoomId
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.actionType).toBe('move');
            expect(data.newRoomId).toBe(testRoomId);
        });

        it('should accept "enter" alias', async () => {
            const result = await handleSpatialManage({
                action: 'enter',
                characterId: testCharacterId,
                roomId: testRoomId
            }, ctx);

            const data = parseResult(result);
            expect(data.actionType).toBe('move');
        });
    });

    describe('look action', () => {
        it('should require character to be in a room', async () => {
            const result = await handleSpatialManage({
                action: 'look',
                observerId: testCharacterId
            }, ctx);

            const data = parseResult(result);
            // Character not in room yet - should fail
            expect(data.success).toBe(false);
            expect(data.error).toContain('not in any room');
        });

        it('should look at surroundings after moving to room', async () => {
            // Move character to room first
            await handleSpatialManage({
                action: 'move',
                characterId: testCharacterId,
                roomId: testRoomId
            }, ctx);

            const result = await handleSpatialManage({
                action: 'look',
                observerId: testCharacterId
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.actionType).toBe('look');
            expect(data.roomName).toBe('Test Room');
        });

        it('should accept "observe" alias', async () => {
            await handleSpatialManage({
                action: 'move',
                characterId: testCharacterId,
                roomId: testRoomId
            }, ctx);

            const result = await handleSpatialManage({
                action: 'observe',
                observerId: testCharacterId
            }, ctx);

            const data = parseResult(result);
            expect(data.actionType).toBe('look');
        });
    });

    describe('fuzzy matching', () => {
        it('should auto-correct close typos', async () => {
            const result = await handleSpatialManage({
                action: 'genrate',  // Typo for 'generate'
                name: 'Fuzzy Room',
                baseDescription: 'A room created via fuzzy matching.',
                biomeContext: 'cavern'
            }, ctx);

            const data = parseResult(result);
            expect(data.actionType).toBe('generate');
        });

        it('should provide helpful error for unknown action', async () => {
            const result = await handleSpatialManage({
                action: 'xyz'
            }, ctx);

            const data = parseResult(result);
            expect(data.error).toBe('invalid_action');
            expect(data.message).toContain('Unknown action');
        });
    });

    describe('output formatting', () => {
        it('should include rich text formatting', async () => {
            const result = await handleSpatialManage({
                action: 'list'
            }, ctx);

            const text = result.content[0].text;
            expect(text).toContain('🏠');
        });

        it('should embed JSON for parsing', async () => {
            const result = await handleSpatialManage({
                action: 'generate',
                name: 'JSON Test Room',
                baseDescription: 'A room to test JSON embedding.',
                biomeContext: 'arcane'
            }, ctx);

            const text = result.content[0].text;
            expect(text).toContain('<!-- SPATIAL_MANAGE_JSON');
        });
    });
});
