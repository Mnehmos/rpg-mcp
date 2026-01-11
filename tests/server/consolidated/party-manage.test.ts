/**
 * Tests for consolidated party_manage tool
 *
 * Covers 16 actions: create, get, list, update, delete,
 * add_member, remove_member, update_member, set_leader, set_active, get_members,
 * get_context, get_unassigned, move, get_position, get_in_region
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { handlePartyManage, PartyManageTool } from '../../../src/server/consolidated/party-manage.js';
import { closeDb, getDb } from '../../../src/storage/index.js';
import { CharacterRepository } from '../../../src/storage/repos/character.repo.js';
import { SessionContext } from '../../../src/server/types.js';
import { randomUUID } from 'crypto';

/**
 * Extract JSON from ASCII-formatted response
 * Handles both embedded JSON (new format) and direct JSON (old format)
 */
function extractJson(text: string): unknown {
    // Try embedded JSON first (new format with RichFormatter.embedJson)
    const jsonMatch = text.match(/<!-- \w+_JSON\n([\s\S]*?)\n\w+_JSON -->/);
    if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
    }
    // Fall back to direct JSON parse (old format)
    return JSON.parse(text);
}

describe('party_manage consolidated tool', () => {
    let ctx: SessionContext;
    let charId1: string;
    let charId2: string;

    beforeEach(() => {
        closeDb();
        process.env.NODE_ENV = 'test';
        ctx = { sessionId: 'test-session' } as SessionContext;

        // Create test characters
        const db = getDb(':memory:');
        const charRepo = new CharacterRepository(db);

        charId1 = randomUUID();
        charId2 = randomUUID();

        charRepo.create({
            id: charId1,
            name: 'Gandalf',
            stats: { str: 10, dex: 12, con: 14, int: 18, wis: 16, cha: 15 },
            hp: 50,
            maxHp: 50,
            ac: 12,
            level: 10,
            characterType: 'pc',
            characterClass: 'Wizard',
            race: 'Human',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        } as any);

        charRepo.create({
            id: charId2,
            name: 'Frodo',
            stats: { str: 8, dex: 14, con: 12, int: 12, wis: 10, cha: 14 },
            hp: 20,
            maxHp: 20,
            ac: 11,
            level: 3,
            characterType: 'pc',
            characterClass: 'Rogue',
            race: 'Halfling',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        } as any);
    });

    afterEach(() => {
        closeDb();
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // TOOL DEFINITION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    describe('tool definition', () => {
        it('should have correct name and description', () => {
            expect(PartyManageTool.name).toBe('party_manage');
            expect(PartyManageTool.description).toContain('Manage adventuring parties');
        });

        it('should list all actions in description', () => {
            const desc = PartyManageTool.description;
            expect(desc).toContain('create');
            expect(desc).toContain('get');
            expect(desc).toContain('list');
            expect(desc).toContain('add_member');
            expect(desc).toContain('set_leader');
            expect(desc).toContain('get_context');
            expect(desc).toContain('move');
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // CREATE ACTION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    describe('action: create', () => {
        it('should create a party with minimal params', async () => {
            const result = await handlePartyManage({
                action: 'create',
                name: 'The Fellowship'
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
            expect(parsed.party.name).toBe('The Fellowship');
            expect(parsed.party.status).toBe('active');
        });

        it('should create party with initial members', async () => {
            const result = await handlePartyManage({
                action: 'create',
                name: 'The Fellowship',
                description: 'Nine companions',
                initialMembers: [
                    { characterId: charId1, role: 'leader' },
                    { characterId: charId2, role: 'member' }
                ]
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
            expect(parsed.memberCount).toBe(2);
            expect(parsed.leaderId).toBe(charId1);
        });

        it('should accept alias "new"', async () => {
            const result = await handlePartyManage({
                action: 'new',
                name: 'Test Party'
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
        });

        it('should accept alias "form"', async () => {
            const result = await handlePartyManage({
                action: 'form',
                name: 'Test Party'
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // GET ACTION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    describe('action: get', () => {
        it('should get party by ID', async () => {
            // Create first
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party'
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            // Then get
            const result = await handlePartyManage({
                action: 'get',
                partyId: created.party.id
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.id).toBe(created.party.id);
            expect(parsed.name).toBe('Test Party');
        });

        it('should return error for non-existent party', async () => {
            const result = await handlePartyManage({
                action: 'get',
                partyId: 'non-existent-id'
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.error).toBe(true);
            expect(parsed.message).toContain('not found');
        });

        it('should accept alias "fetch"', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party'
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'fetch',
                partyId: created.party.id
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.name).toBe('Test Party');
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // LIST ACTION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    describe('action: list', () => {
        it('should list all parties', async () => {
            await handlePartyManage({ action: 'create', name: 'Party 1' }, ctx);
            await handlePartyManage({ action: 'create', name: 'Party 2' }, ctx);

            const result = await handlePartyManage({ action: 'list' }, ctx);
            const parsed = extractJson(result.content[0].text);

            expect(parsed.count).toBe(2);
            expect(parsed.parties.length).toBe(2);
        });

        it('should filter by status', async () => {
            const result = await handlePartyManage({
                action: 'list',
                status: 'active'
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.filter.status).toBe('active');
        });

        it('should accept alias "all"', async () => {
            const result = await handlePartyManage({ action: 'all' }, ctx);
            const parsed = extractJson(result.content[0].text);
            expect(parsed.parties).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // UPDATE ACTION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    describe('action: update', () => {
        it('should update party properties', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Original Name'
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'update',
                partyId: created.party.id,
                name: 'Updated Name',
                formation: 'defensive'
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
            expect(parsed.name).toBe('Updated Name');
            expect(parsed.formation).toBe('defensive');
        });

        it('should accept alias "modify"', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party'
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'modify',
                partyId: created.party.id,
                description: 'New description'
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // DELETE ACTION TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    describe('action: delete', () => {
        it('should delete a party', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'To Be Deleted'
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'delete',
                partyId: created.party.id
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
            expect(parsed.message).toContain('deleted');
        });

        it('should accept alias "disband"', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'To Be Disbanded'
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'disband',
                partyId: created.party.id
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // MEMBER MANAGEMENT TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    describe('action: add_member', () => {
        it('should add a member to party', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party'
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'add_member',
                partyId: created.party.id,
                characterId: charId1,
                role: 'member'
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
            expect(parsed.characterName).toBe('Gandalf');
        });

        it('should accept alias "join"', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party'
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'join',
                partyId: created.party.id,
                characterId: charId1
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
        });
    });

    describe('action: remove_member', () => {
        it('should remove a member from party', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party',
                initialMembers: [{ characterId: charId1 }]
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'remove_member',
                partyId: created.party.id,
                characterId: charId1
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
        });

        it('should accept alias "kick"', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party',
                initialMembers: [{ characterId: charId1 }]
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'kick',
                partyId: created.party.id,
                characterId: charId1
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
        });
    });

    describe('action: set_leader', () => {
        it('should set party leader', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party',
                initialMembers: [
                    { characterId: charId1, role: 'member' },
                    { characterId: charId2, role: 'member' }
                ]
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'set_leader',
                partyId: created.party.id,
                characterId: charId1
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
            expect(parsed.newLeaderId).toBe(charId1);
        });

        it('should accept alias "leader"', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party',
                initialMembers: [{ characterId: charId1 }]
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'leader',
                partyId: created.party.id,
                characterId: charId1
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
        });
    });

    describe('action: set_active', () => {
        it('should set active character', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party',
                initialMembers: [{ characterId: charId1 }]
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'set_active',
                partyId: created.party.id,
                characterId: charId1
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
            expect(parsed.activeCharacterId).toBe(charId1);
        });

        it('should accept alias "pov"', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party',
                initialMembers: [{ characterId: charId1 }]
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'pov',
                partyId: created.party.id,
                characterId: charId1
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
        });
    });

    describe('action: get_members', () => {
        it('should get party members', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party',
                initialMembers: [
                    { characterId: charId1, role: 'leader' },
                    { characterId: charId2, role: 'member' }
                ]
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'get_members',
                partyId: created.party.id
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.memberCount).toBe(2);
            expect(parsed.members).toBeDefined();
        });

        it('should accept alias "roster"', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party',
                initialMembers: [{ characterId: charId1 }]
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'roster',
                partyId: created.party.id
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.members).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // CONTEXT TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    describe('action: get_context', () => {
        it('should get party context', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party',
                initialMembers: [{ characterId: charId1, role: 'leader' }]
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'get_context',
                partyId: created.party.id,
                verbosity: 'standard'
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.party).toBeDefined();
            expect(parsed.members).toBeDefined();
            expect(parsed.verbosity).toBe('standard');
        });

        it('should accept alias "summary"', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party',
                initialMembers: [{ characterId: charId1 }]
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'summary',
                partyId: created.party.id
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.party).toBeDefined();
        });
    });

    describe('action: get_unassigned', () => {
        it('should get unassigned characters', async () => {
            const result = await handlePartyManage({
                action: 'get_unassigned'
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.characters).toBeDefined();
            expect(parsed.count).toBeGreaterThanOrEqual(0);
        });

        it('should accept alias "available"', async () => {
            const result = await handlePartyManage({
                action: 'available'
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.characters).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // POSITION/MOVEMENT TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    describe('action: move', () => {
        it('should move party to location', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party'
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'move',
                partyId: created.party.id,
                targetX: 10,
                targetY: 20,
                locationName: 'The Shire'
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
            expect(parsed.newPosition.x).toBe(10);
            expect(parsed.newPosition.y).toBe(20);
            expect(parsed.newPosition.location).toBe('The Shire');
        });

        it('should accept alias "travel"', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party'
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'travel',
                partyId: created.party.id,
                targetX: 5,
                targetY: 5,
                locationName: 'Rivendell'
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
        });
    });

    describe('action: get_position', () => {
        it('should get party position', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party'
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'get_position',
                partyId: created.party.id
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.partyId).toBe(created.party.id);
            expect(parsed.position).toBeDefined();
        });

        it('should accept alias "where"', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party'
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'where',
                partyId: created.party.id
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.position).toBeDefined();
        });
    });

    describe('action: get_in_region', () => {
        it('should get parties in region', async () => {
            const result = await handlePartyManage({
                action: 'get_in_region',
                worldId: 'test-world',
                x: 0,
                y: 0,
                radiusSquares: 10
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.parties).toBeDefined();
            expect(parsed.searchArea).toBeDefined();
        });

        it('should accept alias "nearby"', async () => {
            const result = await handlePartyManage({
                action: 'nearby',
                worldId: 'test-world',
                x: 0,
                y: 0
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.parties).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // FUZZY MATCHING TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    describe('fuzzy matching', () => {
        it('should match "creat" to "create"', async () => {
            const result = await handlePartyManage({
                action: 'creat',
                name: 'Fuzzy Party'
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.success).toBe(true);
            expect(parsed._fuzzyMatch).toBeDefined();
            expect(parsed._fuzzyMatch.resolved).toBe('create');
        });

        it('should match "members" alias to "get_members"', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party',
                initialMembers: [{ characterId: charId1 }]
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'members',
                partyId: created.party.id
            }, ctx);

            // Should match "members" alias which resolves to "get_members"
            const parsed = extractJson(result.content[0].text);
            expect(parsed.members).toBeDefined();
        });

        it('should return guiding error for completely invalid action', async () => {
            const result = await handlePartyManage({
                action: 'xyz123'
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.error).toBe('invalid_action');
            expect(parsed.suggestions).toBeDefined();
        });
    });

    // ═══════════════════════════════════════════════════════════════════════════
    // ERROR HANDLING TESTS
    // ═══════════════════════════════════════════════════════════════════════════

    describe('error handling', () => {
        it('should return error for missing action', async () => {
            const result = await handlePartyManage({
                name: 'Test'
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.error).toBe(true);
            expect(parsed.message).toContain('action');
        });

        it('should return error for non-existent party on get', async () => {
            const result = await handlePartyManage({
                action: 'get',
                partyId: 'non-existent'
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.error).toBe(true);
            expect(parsed.message).toContain('not found');
        });

        it('should return error for non-existent character on add_member', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party'
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'add_member',
                partyId: created.party.id,
                characterId: 'non-existent'
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.error).toBe(true);
            expect(parsed.message).toContain('not found');
        });

        it('should return error when character not in party for set_leader', async () => {
            const createResult = await handlePartyManage({
                action: 'create',
                name: 'Test Party'
            }, ctx);
            const created = extractJson(createResult.content[0].text);

            const result = await handlePartyManage({
                action: 'set_leader',
                partyId: created.party.id,
                characterId: charId1
            }, ctx);

            const parsed = extractJson(result.content[0].text);
            expect(parsed.error).toBe(true);
            expect(parsed.message).toContain('not a member');
        });
    });
});
