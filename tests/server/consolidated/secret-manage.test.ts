import { describe, it, expect, beforeEach } from 'vitest';
import { handleSecretManage, SecretManageTool } from '../../../src/server/consolidated/secret-manage.js';
import { getDb, closeDb } from '../../../src/storage/index.js';
import { WorldRepository } from '../../../src/storage/repos/world.repo.js';
import { SecretRepository } from '../../../src/storage/repos/secret.repo.js';
import { randomUUID } from 'crypto';

describe('secret_manage consolidated tool', () => {
    let worldId: string;
    let db: ReturnType<typeof getDb>;
    let secretRepo: SecretRepository;

    beforeEach(() => {
        closeDb();
        db = getDb(':memory:');
        const worldRepo = new WorldRepository(db);
        secretRepo = new SecretRepository(db);

        // Create a test world
        worldId = randomUUID();
        const now = new Date().toISOString();
        worldRepo.create({
            id: worldId,
            name: 'Test World',
            seed: '12345',
            width: 100,
            height: 100,
            tileData: '{}',
            createdAt: now,
            updatedAt: now
        });
    });

    const ctx = { worldId: '', partyId: '', encounterContext: null };

    describe('tool definition', () => {
        it('should have correct name and description', () => {
            expect(SecretManageTool.name).toBe('secret_manage');
            expect(SecretManageTool.description).toContain('DM secrets');
        });

        it('should list all actions in description', () => {
            const actions = ['create', 'get', 'list', 'update', 'delete', 'reveal', 'check_conditions', 'get_context', 'check_leaks'];
            for (const action of actions) {
                expect(SecretManageTool.description).toContain(action);
            }
        });
    });

    describe('action: create', () => {
        it('should create a secret', async () => {
            const result = await handleSecretManage({
                action: 'create',
                worldId,
                type: 'npc',
                category: 'motivation',
                name: 'Innkeeper Secret',
                publicDescription: 'A friendly innkeeper',
                secretDescription: 'Is actually a spy for the enemy'
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.message).toContain('Created secret');
            expect(parsed.secret.name).toBe('Innkeeper Secret');
            expect(parsed.secret.revealed).toBe(false);
        });

        it('should accept alias "new"', async () => {
            const result = await handleSecretManage({
                action: 'new',
                worldId,
                type: 'location',
                category: 'trap',
                name: 'Hidden Trap',
                publicDescription: 'An old hallway',
                secretDescription: 'Contains a pit trap'
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.message).toContain('Created secret');
            expect(parsed._fuzzyMatch).toBeDefined();
        });

        it('should fuzzy match "creat" to "create"', async () => {
            const result = await handleSecretManage({
                action: 'creat',
                worldId,
                type: 'item',
                category: 'curse',
                name: 'Cursed Ring',
                publicDescription: 'A golden ring',
                secretDescription: 'Slowly drains life force'
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.message).toContain('Created secret');
        });
    });

    describe('action: get', () => {
        it('should get a secret by ID', async () => {
            // Create a secret first
            const createResult = await handleSecretManage({
                action: 'create',
                worldId,
                type: 'plot',
                category: 'twist',
                name: 'Plot Twist',
                publicDescription: 'The king seems wise',
                secretDescription: 'The king is possessed'
            }, ctx);

            const secretId = JSON.parse(createResult.content[0].text).secret.id;

            const result = await handleSecretManage({
                action: 'get',
                secretId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.name).toBe('Plot Twist');
            expect(parsed.secretDescription).toBe('The king is possessed');
        });

        it('should return error for non-existent secret', async () => {
            const result = await handleSecretManage({
                action: 'get',
                secretId: randomUUID()
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.error).toBe(true);
            expect(parsed.message).toContain('not found');
        });
    });

    describe('action: list', () => {
        beforeEach(async () => {
            // Create multiple secrets
            await handleSecretManage({
                action: 'create',
                worldId,
                type: 'npc',
                category: 'identity',
                name: 'NPC Secret 1',
                publicDescription: 'A guard',
                secretDescription: 'Is a shapeshifter'
            }, ctx);

            await handleSecretManage({
                action: 'create',
                worldId,
                type: 'location',
                category: 'hidden',
                name: 'Location Secret',
                publicDescription: 'A wall',
                secretDescription: 'Has a secret door'
            }, ctx);
        });

        it('should list all secrets for a world', async () => {
            const result = await handleSecretManage({
                action: 'list',
                worldId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.count).toBe(2);
            expect(parsed.secrets).toHaveLength(2);
        });

        it('should filter by type', async () => {
            const result = await handleSecretManage({
                action: 'list',
                worldId,
                type: 'npc'
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.count).toBe(1);
            expect(parsed.secrets[0].type).toBe('npc');
        });

        it('should accept alias "all"', async () => {
            const result = await handleSecretManage({
                action: 'all',
                worldId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.count).toBe(2);
        });
    });

    describe('action: update', () => {
        it('should update secret properties', async () => {
            const createResult = await handleSecretManage({
                action: 'create',
                worldId,
                type: 'item',
                category: 'power',
                name: 'Magic Sword',
                publicDescription: 'A rusty sword',
                secretDescription: 'Is a legendary blade'
            }, ctx);

            const secretId = JSON.parse(createResult.content[0].text).secret.id;

            const result = await handleSecretManage({
                action: 'update',
                secretId,
                sensitivity: 'critical',
                notes: 'Reveal at climax'
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.message).toContain('Updated');
            expect(parsed.secret.sensitivity).toBe('critical');
            expect(parsed.secret.notes).toBe('Reveal at climax');
        });
    });

    describe('action: delete', () => {
        it('should delete a secret', async () => {
            const createResult = await handleSecretManage({
                action: 'create',
                worldId,
                type: 'mechanic',
                category: 'weakness',
                name: 'Boss Weakness',
                publicDescription: 'A tough boss',
                secretDescription: 'Weak to fire'
            }, ctx);

            const secretId = JSON.parse(createResult.content[0].text).secret.id;

            const result = await handleSecretManage({
                action: 'delete',
                secretId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.message).toContain('Deleted');

            // Verify deleted
            const verifyResult = await handleSecretManage({
                action: 'get',
                secretId
            }, ctx);
            const verifyParsed = JSON.parse(verifyResult.content[0].text);
            expect(verifyParsed.error).toBe(true);
            expect(verifyParsed.message).toContain('not found');
        });

        it('should accept alias "remove"', async () => {
            const createResult = await handleSecretManage({
                action: 'create',
                worldId,
                type: 'quest',
                category: 'hidden',
                name: 'Hidden Quest',
                publicDescription: 'Rumors of treasure',
                secretDescription: 'Leads to dragon hoard'
            }, ctx);

            const secretId = JSON.parse(createResult.content[0].text).secret.id;

            const result = await handleSecretManage({
                action: 'remove',
                secretId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.message).toContain('Deleted');
        });
    });

    describe('action: reveal', () => {
        it('should reveal a secret fully', async () => {
            const createResult = await handleSecretManage({
                action: 'create',
                worldId,
                type: 'npc',
                category: 'identity',
                name: 'Villain Identity',
                publicDescription: 'The trusted advisor',
                secretDescription: 'Is the main villain'
            }, ctx);

            const secretId = JSON.parse(createResult.content[0].text).secret.id;

            const result = await handleSecretManage({
                action: 'reveal',
                secretId,
                triggeredBy: 'Insight check DC 20'
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.message).toContain('revealed');
            expect(parsed.spoilerMarkdown).toContain('Click to Reveal');
            expect(parsed.secret.revealed).toBe(true);
        });

        it('should partially reveal with hint', async () => {
            const createResult = await handleSecretManage({
                action: 'create',
                worldId,
                type: 'location',
                category: 'hidden',
                name: 'Secret Door',
                publicDescription: 'A stone wall',
                secretDescription: 'Conceals a passage'
            }, ctx);

            const secretId = JSON.parse(createResult.content[0].text).secret.id;

            const result = await handleSecretManage({
                action: 'reveal',
                secretId,
                triggeredBy: 'Investigation check',
                partial: true
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.message).toContain('Hint');
            expect(parsed.partial).toBe(true);
            expect(parsed.secret.revealed).toBe(false);
        });
    });

    describe('action: check_conditions', () => {
        it('should check if event triggers reveals', async () => {
            const result = await handleSecretManage({
                action: 'check_conditions',
                worldId,
                event: {
                    type: 'skill_check',
                    skill: 'perception',
                    result: 18
                }
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.message).toBeDefined();
        });

        it('should accept alias "check"', async () => {
            const result = await handleSecretManage({
                action: 'check',
                worldId,
                event: {
                    type: 'dialogue',
                    target: 'innkeeper'
                }
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed._fuzzyMatch).toBeDefined();
        });
    });

    describe('action: get_context', () => {
        it('should return empty context for world with no secrets', async () => {
            const emptyWorldRepo = new WorldRepository(db);
            const emptyWorldId = randomUUID();
            const now = new Date().toISOString();
            emptyWorldRepo.create({
                id: emptyWorldId,
                name: 'Empty World',
                seed: '99999',
                width: 100,
                height: 100,
                tileData: '{}',
                createdAt: now,
                updatedAt: now
            });

            const result = await handleSecretManage({
                action: 'get_context',
                worldId: emptyWorldId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.message).toContain('No active secrets');
        });

        it('should format secrets for LLM context', async () => {
            await handleSecretManage({
                action: 'create',
                worldId,
                type: 'npc',
                category: 'motivation',
                name: 'Test Secret',
                publicDescription: 'Public info',
                secretDescription: 'Secret info',
                leakPatterns: ['forbidden', 'word']
            }, ctx);

            const result = await handleSecretManage({
                action: 'get_context',
                worldId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.secretCount).toBe(1);
            expect(parsed.context).toBeDefined();
        });

        it('should accept alias "context"', async () => {
            const result = await handleSecretManage({
                action: 'context',
                worldId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed._fuzzyMatch).toBeDefined();
        });
    });

    describe('action: check_leaks', () => {
        it('should detect no leaks in clean text', async () => {
            await handleSecretManage({
                action: 'create',
                worldId,
                type: 'npc',
                category: 'identity',
                name: 'Vampire Lord',
                publicDescription: 'A pale noble',
                secretDescription: 'Is a vampire',
                leakPatterns: ['vampire', 'undead', 'blood-drinker']
            }, ctx);

            const result = await handleSecretManage({
                action: 'check_leaks',
                worldId,
                text: 'The noble greets you with a cold smile.'
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.clean).toBe(true);
        });

        it('should detect potential leaks', async () => {
            await handleSecretManage({
                action: 'create',
                worldId,
                type: 'npc',
                category: 'identity',
                name: 'Vampire Lord',
                publicDescription: 'A pale noble',
                secretDescription: 'Is a vampire',
                leakPatterns: ['vampire', 'undead']
            }, ctx);

            const result = await handleSecretManage({
                action: 'check_leaks',
                worldId,
                text: 'Something about him seems... undead.'
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.clean).toBe(false);
            expect(parsed.leaks.length).toBeGreaterThan(0);
        });

        it('should accept alias "leaks"', async () => {
            const result = await handleSecretManage({
                action: 'leaks',
                worldId,
                text: 'Test text'
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed._fuzzyMatch).toBeDefined();
        });
    });

    describe('error handling', () => {
        it('should return guiding error for invalid action', async () => {
            const result = await handleSecretManage({
                action: 'xyz',
                worldId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.error).toBe('invalid_action');
            expect(parsed.suggestions).toBeDefined();
            expect(parsed.message).toContain('Did you mean');
        });

        it('should return validation error for missing required params', async () => {
            const result = await handleSecretManage({
                action: 'create',
                worldId
                // Missing required: type, category, name, publicDescription, secretDescription
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.error).toBe('validation_error');
            expect(parsed.issues).toBeDefined();
        });

        it('should return error for missing action', async () => {
            const result = await handleSecretManage({
                worldId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.error).toBe(true);
            expect(parsed.message).toContain('action');
        });
    });
});
