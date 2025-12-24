import {
    handleCreateWorld,
    handleGetWorld,
    handleListWorlds,
    handleDeleteWorld,
    handleCreateCharacter,
    handleGetCharacter,
    handleUpdateCharacter,
    handleListCharacters,
    handleDeleteCharacter,
    closeTestDb
} from '../../src/server/crud-tools';

const mockCtx = { sessionId: 'test-session' };

// Helper to extract embedded JSON from formatted responses
function extractEmbeddedJson(responseText: string, tag: string = 'DATA'): any {
    const regex = new RegExp(`<!-- ${tag}_JSON\\n([\\s\\S]*?)\\n${tag}_JSON -->`);
    const match = responseText.match(regex);
    if (match) {
        return JSON.parse(match[1]);
    }
    throw new Error(`Could not extract ${tag}_JSON from response`);
}

describe('World CRUD Tools', () => {
    afterEach(() => {
        closeTestDb();
    });

    describe('create_world', () => {
        it('should create a new world', async () => {
            const result = await handleCreateWorld({
                name: 'Test World',
                seed: 'test-seed',
                width: 100,
                height: 100
            }, mockCtx);

            expect(result.content).toHaveLength(1);
            const response = extractEmbeddedJson(result.content[0].text, "WORLD");
            expect(response.id).toBeDefined();
            expect(response.name).toBe('Test World');
        });

        it('should validate world data', async () => {
            await expect(handleCreateWorld({
                name: '',  // Invalid: empty name
                seed: 'test',
                width: 100,
                height: 100
            }, mockCtx)).rejects.toThrow();
        });
    });

    describe('get_world', () => {
        let worldId: string;

        beforeEach(async () => {
            const result = await handleCreateWorld({
                name: 'Get World',
                seed: 'seed-get',
                width: 50,
                height: 50
            }, mockCtx);
            const world = extractEmbeddedJson(result.content[0].text, "WORLD");
            worldId = world.id;
        });

        it('should retrieve an existing world', async () => {
            const result = await handleGetWorld({ id: worldId }, mockCtx);

            const world = extractEmbeddedJson(result.content[0].text, "WORLD");
            expect(world.id).toBe(worldId);
            expect(world.name).toBe('Get World');
        });

        it('should throw error for non-existent world', async () => {
            await expect(handleGetWorld({ id: 'non-existent' }, mockCtx))
                .rejects.toThrow('World not found');
        });
    });

    describe('list_worlds', () => {
        let worldId1: string;
        let worldId2: string;

        beforeEach(async () => {
            const result1 = await handleCreateWorld({
                name: 'World 1',
                seed: 'seed1',
                width: 50,
                height: 50
            }, mockCtx);
            worldId1 = extractEmbeddedJson(result1.content[0].text, "WORLD").id;

            const result2 = await handleCreateWorld({
                name: 'World 2',
                seed: 'seed2',
                width: 60,
                height: 60
            }, mockCtx);
            worldId2 = extractEmbeddedJson(result2.content[0].text, "WORLD").id;
        });

        it('should list all worlds', async () => {
            const result = await handleListWorlds({}, mockCtx);

            const response = extractEmbeddedJson(result.content[0].text, "WORLDS");
            expect(response.worlds.length).toBeGreaterThanOrEqual(2);
            expect(response.worlds.some((w: any) => w.id === worldId1)).toBe(true);
            expect(response.worlds.some((w: any) => w.id === worldId2)).toBe(true);
        });
    });

    describe('delete_world', () => {
        let worldId: string;

        beforeEach(async () => {
            const result = await handleCreateWorld({
                name: 'Delete World',
                seed: 'seed-delete',
                width: 50,
                height: 50
            }, mockCtx);
            worldId = extractEmbeddedJson(result.content[0].text, "WORLD").id;
        });

        it('should delete a world', async () => {
            const result = await handleDeleteWorld({ id: worldId }, mockCtx);

            // Delete returns formatted text, just check it succeeded
            expect(result.content[0].text).toContain('deleted');

            // Verify it's gone
            await expect(handleGetWorld({ id: worldId }, mockCtx))
                .rejects.toThrow('World not found');
        });
    });
});

describe('Character CRUD Tools', () => {
    afterEach(() => {
        closeTestDb();
    });

    describe('create_character', () => {
        it('should create a new character', async () => {
            const result = await handleCreateCharacter({
                name: 'Hero',
                stats: {
                    str: 16,
                    dex: 14,
                    con: 15,
                    int: 10,
                    wis: 12,
                    cha: 8
                },
                hp: 30,
                maxHp: 30,
                ac: 16,
                level: 3
            }, mockCtx);

            expect(result.content).toHaveLength(1);
            const response = extractEmbeddedJson(result.content[0].text, "CHARACTER");
            expect(response.id).toBeDefined();
            expect(response.name).toBe('Hero');
        });

        it('should create an NPC with faction', async () => {
            const result = await handleCreateCharacter({
                name: 'Goblin',
                stats: { str: 8, dex: 14, con: 10, int: 8, wis: 8, cha: 6 },
                hp: 10,
                maxHp: 10,
                ac: 13,
                level: 1,
                factionId: 'goblins',
                behavior: 'hostile'
            }, mockCtx);

            const response = extractEmbeddedJson(result.content[0].text, "CHARACTER");
            expect(response.factionId).toBe('goblins');
            expect(response.behavior).toBe('hostile');
        });
    });

    describe('get_character', () => {
        let charId: string;

        beforeEach(async () => {
            const result = await handleCreateCharacter({
                name: 'Fighter',
                stats: { str: 16, dex: 12, con: 14, int: 10, wis: 12, cha: 8 },
                hp: 25,
                maxHp: 25,
                ac: 17,
                level: 2
            }, mockCtx);
            charId = extractEmbeddedJson(result.content[0].text, "CHARACTER").id;
        });

        it('should retrieve an existing character', async () => {
            const result = await handleGetCharacter({ id: charId }, mockCtx);

            const char = extractEmbeddedJson(result.content[0].text, "CHARACTER");
            expect(char.id).toBe(charId);
            expect(char.name).toBe('Fighter');
        });

        it('should throw error for non-existent character', async () => {
            await expect(handleGetCharacter({ id: 'non-existent' }, mockCtx))
                .rejects.toThrow('Character not found');
        });
    });

    describe('update_character', () => {
        let charId: string;

        beforeEach(async () => {
            const result = await handleCreateCharacter({
                name: 'Wizard',
                stats: { str: 8, dex: 14, con: 12, int: 16, wis: 13, cha: 10 },
                hp: 20,
                maxHp: 20,
                ac: 12,
                level: 2
            }, mockCtx);
            charId = extractEmbeddedJson(result.content[0].text, "CHARACTER").id;
        });

        it('should update character HP', async () => {
            const result = await handleUpdateCharacter({
                id: charId,
                hp: 15
            }, mockCtx);

            const response = extractEmbeddedJson(result.content[0].text, "CHARACTER");
            expect(response.hp).toBe(15);
        });

        it('should update multiple fields', async () => {
            const result = await handleUpdateCharacter({
                id: charId,
                hp: 18,
                level: 3
            }, mockCtx);

            const response = extractEmbeddedJson(result.content[0].text, "CHARACTER");
            expect(response.hp).toBe(18);
            expect(response.level).toBe(3);
        });
    });

    describe('list_characters', () => {
        beforeEach(async () => {
            await handleCreateCharacter({
                name: 'Rogue',
                stats: { str: 10, dex: 16, con: 12, int: 14, wis: 10, cha: 12 },
                hp: 22,
                maxHp: 22,
                ac: 15,
                level: 2
            }, mockCtx);
            await handleCreateCharacter({
                name: 'Cleric',
                stats: { str: 14, dex: 10, con: 14, int: 10, wis: 16, cha: 12 },
                hp: 24,
                maxHp: 24,
                ac: 16,
                level: 2
            }, mockCtx);
        });

        it('should list all characters', async () => {
            const result = await handleListCharacters({}, mockCtx);

            const response = extractEmbeddedJson(result.content[0].text, "CHARACTERS");
            expect(response.characters.length).toBeGreaterThanOrEqual(2);
        });
    });

    describe('delete_character', () => {
        let charId: string;

        beforeEach(async () => {
            const result = await handleCreateCharacter({
                name: 'Temp Character',
                stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
                hp: 20,
                maxHp: 20,
                ac: 12,
                level: 1
            }, mockCtx);
            charId = extractEmbeddedJson(result.content[0].text, "CHARACTER").id;
        });

        it('should delete a character', async () => {
            const result = await handleDeleteCharacter({ id: charId }, mockCtx);

            // Delete returns formatted text, just check it succeeded
            expect(result.content[0].text).toContain('deleted');

            // Verify it's gone
            await expect(handleGetCharacter({ id: charId }, mockCtx))
                .rejects.toThrow('Character not found');
        });
    });
});
