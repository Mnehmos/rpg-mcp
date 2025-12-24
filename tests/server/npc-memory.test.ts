import { closeDb, getDb } from '../../src/storage/index.js';

const mockCtx = { sessionId: 'test-session' };

/**
 * HIGH-004: NPC Has No Memory
 *
 * Tests for NPC relationship and conversation memory system:
 * - Track familiarity and disposition between PCs and NPCs
 * - Store important conversation memories
 * - Retrieve relationship context for LLM injection
 */
describe('HIGH-004: NPC Memory System', () => {
    beforeEach(() => {
        closeDb();
        getDb(':memory:');
    });

    describe('Relationship Tracking', () => {
        it('should create a relationship between PC and NPC', async () => {
            const { handleGetNpcRelationship, handleUpdateNpcRelationship } = await import('../../src/server/npc-memory-tools.js');
            const { CharacterRepository } = await import('../../src/storage/repos/character.repo.js');
            const db = getDb(':memory:');
            const charRepo = new CharacterRepository(db);

            // Create PC and NPC
            charRepo.create({
                id: 'pc-hero',
                name: 'Hero',
                stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
                hp: 20,
                maxHp: 20,
                ac: 10,
                level: 1,
                characterType: 'pc',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            charRepo.create({
                id: 'npc-blacksmith',
                name: 'Grimm the Blacksmith',
                stats: { str: 14, dex: 10, con: 12, int: 10, wis: 10, cha: 8 },
                hp: 15,
                maxHp: 15,
                ac: 10,
                level: 1,
                characterType: 'npc',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            // Create relationship
            await handleUpdateNpcRelationship({
                characterId: 'pc-hero',
                npcId: 'npc-blacksmith',
                familiarity: 'acquaintance',
                disposition: 'friendly',
                notes: 'Met at the tavern, discussed weapon repair'
            }, mockCtx);

            // Get relationship
            const result = await handleGetNpcRelationship({
                characterId: 'pc-hero',
                npcId: 'npc-blacksmith'
            }, mockCtx);

            expect(result.content[0].text).toContain('acquaintance');
            expect(result.content[0].text).toContain('friendly');
        });

        it('should return default values for unknown NPCs', async () => {
            const { handleGetNpcRelationship } = await import('../../src/server/npc-memory-tools.js');
            const { CharacterRepository } = await import('../../src/storage/repos/character.repo.js');
            const db = getDb(':memory:');
            const charRepo = new CharacterRepository(db);

            // Create PC only
            charRepo.create({
                id: 'pc-hero',
                name: 'Hero',
                stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
                hp: 20,
                maxHp: 20,
                ac: 10,
                level: 1,
                characterType: 'pc',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            // Get relationship with unknown NPC
            const result = await handleGetNpcRelationship({
                characterId: 'pc-hero',
                npcId: 'npc-unknown'
            }, mockCtx);

            expect(result.content[0].text).toContain('stranger');
            expect(result.content[0].text).toContain('neutral');
        });

        it('should update existing relationship', async () => {
            const { handleGetNpcRelationship, handleUpdateNpcRelationship } = await import('../../src/server/npc-memory-tools.js');
            const { CharacterRepository } = await import('../../src/storage/repos/character.repo.js');
            const db = getDb(':memory:');
            const charRepo = new CharacterRepository(db);

            charRepo.create({
                id: 'pc-hero',
                name: 'Hero',
                stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
                hp: 20,
                maxHp: 20,
                ac: 10,
                level: 1,
                characterType: 'pc',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            // First interaction - stranger
            await handleUpdateNpcRelationship({
                characterId: 'pc-hero',
                npcId: 'npc-merchant',
                familiarity: 'stranger',
                disposition: 'neutral'
            }, mockCtx);

            // Second interaction - now acquaintance
            await handleUpdateNpcRelationship({
                characterId: 'pc-hero',
                npcId: 'npc-merchant',
                familiarity: 'acquaintance',
                disposition: 'friendly',
                notes: 'Helped find lost shipment'
            }, mockCtx);

            const result = await handleGetNpcRelationship({
                characterId: 'pc-hero',
                npcId: 'npc-merchant'
            }, mockCtx);

            expect(result.content[0].text).toContain('acquaintance');
            expect(result.content[0].text).toContain('friendly');
            expect(result.content[0].text).toContain('lost shipment');
        });
    });

    describe('Conversation Memory', () => {
        it('should record conversation memory', async () => {
            const { handleRecordConversationMemory, handleGetConversationHistory } = await import('../../src/server/npc-memory-tools.js');

            // Record a conversation
            await handleRecordConversationMemory({
                characterId: 'pc-hero',
                npcId: 'npc-blacksmith',
                summary: 'Discussed the blacksmith\'s missing daughter, Clara. She went missing near the old mine.',
                importance: 'high',
                topics: ['missing daughter', 'old mine', 'Clara']
            }, mockCtx);

            // Get conversation history
            const result = await handleGetConversationHistory({
                characterId: 'pc-hero',
                npcId: 'npc-blacksmith'
            }, mockCtx);

            expect(result.content[0].text).toContain('missing daughter');
            expect(result.content[0].text).toContain('Clara');
            expect(result.content[0].text).toContain('old mine');
        });

        it('should filter conversation history by importance', async () => {
            const { handleRecordConversationMemory, handleGetConversationHistory } = await import('../../src/server/npc-memory-tools.js');

            // Record low importance conversation
            await handleRecordConversationMemory({
                characterId: 'pc-hero',
                npcId: 'npc-tavern-keeper',
                summary: 'Discussed the weather and local gossip.',
                importance: 'low',
                topics: ['weather', 'gossip']
            }, mockCtx);

            // Record high importance conversation
            await handleRecordConversationMemory({
                characterId: 'pc-hero',
                npcId: 'npc-tavern-keeper',
                summary: 'Revealed the location of a secret dungeon entrance.',
                importance: 'high',
                topics: ['dungeon', 'secret entrance']
            }, mockCtx);

            // Get only high importance memories
            const result = await handleGetConversationHistory({
                characterId: 'pc-hero',
                npcId: 'npc-tavern-keeper',
                minImportance: 'high'
            }, mockCtx);

            expect(result.content[0].text).toContain('secret dungeon');
            expect(result.content[0].text).not.toContain('weather');
        });

        it('should get recent conversations across all NPCs', async () => {
            const { handleRecordConversationMemory, handleGetRecentInteractions } = await import('../../src/server/npc-memory-tools.js');

            // Record conversations with multiple NPCs
            await handleRecordConversationMemory({
                characterId: 'pc-hero',
                npcId: 'npc-blacksmith',
                summary: 'Ordered a new sword.',
                importance: 'medium',
                topics: ['sword', 'order']
            }, mockCtx);

            await handleRecordConversationMemory({
                characterId: 'pc-hero',
                npcId: 'npc-merchant',
                summary: 'Bought healing potions.',
                importance: 'low',
                topics: ['potions', 'purchase']
            }, mockCtx);

            // Get recent interactions
            const result = await handleGetRecentInteractions({
                characterId: 'pc-hero',
                limit: 10
            }, mockCtx);

            expect(result.content[0].text).toContain('sword');
            expect(result.content[0].text).toContain('potions');
        });
    });

    describe('Context for LLM Injection', () => {
        it('should get full NPC context for LLM prompt injection', async () => {
            const { handleUpdateNpcRelationship, handleRecordConversationMemory, handleGetNpcContext } = await import('../../src/server/npc-memory-tools.js');

            // Set up relationship
            await handleUpdateNpcRelationship({
                characterId: 'pc-hero',
                npcId: 'npc-blacksmith',
                familiarity: 'friend',
                disposition: 'friendly',
                notes: 'Has helped multiple times, trusts the hero'
            }, mockCtx);

            // Record conversation
            await handleRecordConversationMemory({
                characterId: 'pc-hero',
                npcId: 'npc-blacksmith',
                summary: 'Hero found evidence about Clara\'s kidnapper.',
                importance: 'high',
                topics: ['Clara', 'kidnapper', 'evidence']
            }, mockCtx);

            // Get full context for LLM
            const result = await handleGetNpcContext({
                characterId: 'pc-hero',
                npcId: 'npc-blacksmith'
            }, mockCtx);

            // Should include relationship info AND conversation history
            const text = result.content[0].text;
            expect(text).toContain('friend');
            expect(text).toContain('friendly');
            expect(text).toContain('Clara');
            expect(text).toContain('kidnapper');
        });
    });
});
