/**
 * Tests for consolidated aura_manage tool
 * Validates all 7 actions: create, list, get_affecting, process, remove, remove_by_owner, expire
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { handleAuraManage, AuraManageTool } from '../../../src/server/consolidated/aura-manage.js';
import { getDb, closeDb } from '../../../src/storage/index.js';
import { CharacterRepository } from '../../../src/storage/repos/character.repo.js';
import { WorldRepository } from '../../../src/storage/repos/world.repo.js';
import { EncounterRepository } from '../../../src/storage/repos/encounter.repo.js';
import { randomUUID } from 'crypto';

process.env.NODE_ENV = 'test';

function parseResult(result: { content: Array<{ type: string; text: string }> }) {
    const text = result.content[0].text;
    const jsonMatch = text.match(/<!-- AURA_MANAGE_JSON\n([\s\S]*?)\nAURA_MANAGE_JSON -->/);
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

describe('aura_manage consolidated tool', () => {
    let testCharacterId: string;
    let testWorldId: string;
    let testEncounterId: string;
    let testAuraId: string;
    const ctx = { sessionId: 'test-session' };

    beforeEach(async () => {
        closeDb();
        const db = getDb(':memory:');
        const now = new Date().toISOString();

        // Create a test world
        const worldRepo = new WorldRepository(db);
        testWorldId = randomUUID();
        worldRepo.create({
            id: testWorldId,
            name: 'Test World',
            seed: '12345',
            width: 100,
            height: 100,
            tileData: '{}',
            createdAt: now,
            updatedAt: now
        });

        // Create test character
        const characterRepo = new CharacterRepository(db);
        testCharacterId = randomUUID();
        characterRepo.create({
            id: testCharacterId,
            name: 'Spirit Guardian Cleric',
            class: 'Cleric',
            level: 5,
            race: 'Human',
            stats: { str: 10, dex: 12, con: 14, int: 10, wis: 18, cha: 12 },
            hp: 38,
            maxHp: 38,
            ac: 18,
            worldId: testWorldId,
            createdAt: now,
            updatedAt: now
        });

        // Create a test encounter with tokens
        const encounterRepo = new EncounterRepository(db);
        testEncounterId = randomUUID();
        encounterRepo.create({
            id: testEncounterId,
            status: 'active',
            round: 1,
            activeTokenId: testCharacterId,
            tokens: [
                {
                    id: testCharacterId,
                    name: 'Spirit Guardian Cleric',
                    hp: 38,
                    maxHp: 38,
                    ac: 18,
                    initiative: 15,
                    initiativeBonus: 2,
                    position: { x: 5, y: 5 },
                    isEnemy: false,
                    size: 'medium',
                    movementSpeed: 30,
                    conditions: []
                }
            ],
            createdAt: now,
            updatedAt: now
        });

        // Create a test aura
        const createResult = await handleAuraManage({
            action: 'create',
            ownerId: testCharacterId,
            spellName: 'Spirit Guardians',
            spellLevel: 3,
            radius: 15,
            affectsEnemies: true,
            effects: [{
                trigger: 'start_of_turn',
                type: 'damage',
                dice: '3d8',
                damageType: 'radiant',
                saveType: 'wisdom',
                saveDC: 15
            }],
            currentRound: 1,
            maxDuration: 10,
            requiresConcentration: true
        }, ctx);
        testAuraId = parseResult(createResult).auraId;
    });

    describe('Tool Definition', () => {
        it('should have correct tool name', () => {
            expect(AuraManageTool.name).toBe('aura_manage');
        });

        it('should list all available actions in description', () => {
            expect(AuraManageTool.description).toContain('create');
            expect(AuraManageTool.description).toContain('list');
            expect(AuraManageTool.description).toContain('get_affecting');
            expect(AuraManageTool.description).toContain('process');
            expect(AuraManageTool.description).toContain('remove');
            expect(AuraManageTool.description).toContain('remove_by_owner');
            expect(AuraManageTool.description).toContain('expire');
        });
    });

    describe('create action', () => {
        it('should create a new aura', async () => {
            const result = await handleAuraManage({
                action: 'create',
                ownerId: testCharacterId,
                spellName: 'Aura of Protection',
                spellLevel: 1,
                radius: 10,
                affectsAllies: true,
                affectsSelf: true,
                effects: [{
                    trigger: 'start_of_turn',
                    type: 'buff',
                    bonusAmount: 3,
                    bonusType: 'saves'
                }],
                currentRound: 1
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.actionType).toBe('create');
            expect(data.spellName).toBe('Aura of Protection');
            expect(data.auraId).toBeDefined();
        });

        it('should accept "new" alias', async () => {
            const result = await handleAuraManage({
                action: 'new',
                ownerId: testCharacterId,
                spellName: 'Test Aura',
                spellLevel: 1,
                radius: 10,
                effects: [{ trigger: 'enter', type: 'custom', description: 'Test' }],
                currentRound: 1
            }, ctx);

            const data = parseResult(result);
            expect(data.actionType).toBe('create');
        });

        it('should return error for non-existent owner', async () => {
            const result = await handleAuraManage({
                action: 'create',
                ownerId: 'non-existent',
                spellName: 'Test',
                spellLevel: 1,
                radius: 10,
                effects: [{ trigger: 'enter', type: 'damage' }],
                currentRound: 1
            }, ctx);

            const data = parseResult(result);
            expect(data.error).toBe(true);
        });
    });

    describe('list action', () => {
        it('should list all active auras', async () => {
            const result = await handleAuraManage({
                action: 'list'
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.actionType).toBe('list');
            expect(data.count).toBeGreaterThanOrEqual(1);
        });

        it('should accept "active" alias', async () => {
            const result = await handleAuraManage({
                action: 'active'
            }, ctx);

            const data = parseResult(result);
            expect(data.actionType).toBe('list');
        });
    });

    describe('get_affecting action', () => {
        it('should get auras affecting a character', async () => {
            const result = await handleAuraManage({
                action: 'get_affecting',
                encounterId: testEncounterId,
                characterId: testCharacterId
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.actionType).toBe('get_affecting');
            expect(data.characterId).toBe(testCharacterId);
        });

        it('should return error for non-existent encounter', async () => {
            const result = await handleAuraManage({
                action: 'get_affecting',
                encounterId: 'non-existent',
                characterId: testCharacterId
            }, ctx);

            const data = parseResult(result);
            expect(data.error).toBe(true);
        });

        it('should accept "affecting" alias', async () => {
            const result = await handleAuraManage({
                action: 'affecting',
                encounterId: testEncounterId,
                characterId: testCharacterId
            }, ctx);

            const data = parseResult(result);
            expect(data.actionType).toBe('get_affecting');
        });
    });

    describe('process action', () => {
        it('should process aura effects', async () => {
            const result = await handleAuraManage({
                action: 'process',
                encounterId: testEncounterId,
                targetId: testCharacterId,
                trigger: 'start_of_turn'
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.actionType).toBe('process');
            expect(data.trigger).toBe('start_of_turn');
        });

        it('should accept "trigger" alias', async () => {
            const result = await handleAuraManage({
                action: 'trigger',
                encounterId: testEncounterId,
                targetId: testCharacterId,
                trigger: 'end_of_turn'
            }, ctx);

            const data = parseResult(result);
            expect(data.actionType).toBe('process');
        });
    });

    describe('remove action', () => {
        it('should remove an aura by ID', async () => {
            const result = await handleAuraManage({
                action: 'remove',
                auraId: testAuraId
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.actionType).toBe('remove');
        });

        it('should return error for non-existent aura', async () => {
            const result = await handleAuraManage({
                action: 'remove',
                auraId: 'non-existent'
            }, ctx);

            const data = parseResult(result);
            expect(data.error).toBe(true);
        });

        it('should accept "end" alias', async () => {
            // Create a new aura to remove
            const createResult = await handleAuraManage({
                action: 'create',
                ownerId: testCharacterId,
                spellName: 'Temp Aura',
                spellLevel: 1,
                radius: 5,
                effects: [{ trigger: 'enter', type: 'custom' }],
                currentRound: 1
            }, ctx);
            const newAuraId = parseResult(createResult).auraId;

            const result = await handleAuraManage({
                action: 'end',
                auraId: newAuraId
            }, ctx);

            const data = parseResult(result);
            expect(data.actionType).toBe('remove');
        });
    });

    describe('remove_by_owner action', () => {
        it('should remove all auras by owner', async () => {
            const result = await handleAuraManage({
                action: 'remove_by_owner',
                characterId: testCharacterId
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.actionType).toBe('remove_by_owner');
            expect(data.removedCount).toBeGreaterThanOrEqual(0);
        });

        it('should accept "remove_all" alias', async () => {
            const result = await handleAuraManage({
                action: 'remove_all',
                characterId: testCharacterId
            }, ctx);

            const data = parseResult(result);
            expect(data.actionType).toBe('remove_by_owner');
        });
    });

    describe('expire action', () => {
        it('should check for expired auras', async () => {
            const result = await handleAuraManage({
                action: 'expire',
                currentRound: 100  // Far in the future
            }, ctx);

            const data = parseResult(result);
            expect(data.success).toBe(true);
            expect(data.actionType).toBe('expire');
            expect(data.currentRound).toBe(100);
        });

        it('should accept "cleanup" alias', async () => {
            const result = await handleAuraManage({
                action: 'cleanup',
                currentRound: 1
            }, ctx);

            const data = parseResult(result);
            expect(data.actionType).toBe('expire');
        });
    });

    describe('fuzzy matching', () => {
        it('should auto-correct close typos', async () => {
            const result = await handleAuraManage({
                action: 'creat',  // Missing 'e'
                ownerId: testCharacterId,
                spellName: 'Typo Aura',
                spellLevel: 1,
                radius: 10,
                effects: [{ trigger: 'enter', type: 'custom' }],
                currentRound: 1
            }, ctx);

            const data = parseResult(result);
            expect(data.actionType).toBe('create');
        });

        it('should provide helpful error for unknown action', async () => {
            const result = await handleAuraManage({
                action: 'xyz'
            }, ctx);

            const data = parseResult(result);
            expect(data.error).toBe('invalid_action');
            expect(data.message).toContain('Unknown action');
        });
    });

    describe('output formatting', () => {
        it('should include rich text formatting', async () => {
            const result = await handleAuraManage({
                action: 'list'
            }, ctx);

            const text = result.content[0].text;
            expect(text).toContain('ACTIVE AURAS');
        });

        it('should embed JSON for parsing', async () => {
            const result = await handleAuraManage({
                action: 'list'
            }, ctx);

            const text = result.content[0].text;
            expect(text).toContain('<!-- AURA_MANAGE_JSON');
        });
    });
});
