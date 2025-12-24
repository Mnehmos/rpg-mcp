import { handleGenerateWorld, clearWorld } from '../../src/server/tools';
import { handleListWorlds, handleDeleteWorld, closeTestDb } from '../../src/server/crud-tools';

describe('World Repository Integration', () => {
    afterEach(() => {
        closeTestDb();
    });

    it('should persist generated world and allow list/delete', async () => {
        clearWorld();

        // Generate a world
        const genResult = await handleGenerateWorld({
            seed: 'integration-test',
            width: 30,
            height: 30
        }, { sessionId: 'test-session' });

        const response = JSON.parse(genResult.content[0].text);
        expect(response.worldId).toBeDefined();
        expect(response.message).toBe('World generated successfully');
        const worldId = response.worldId;

        // Verify it appears in list_worlds
        const listResult = await handleListWorlds({}, { sessionId: 'test-session' });
        const listData = JSON.parse(listResult.content[0].text);

        const foundWorld = listData.worlds.find((w: any) => w.id === worldId);
        expect(foundWorld).toBeDefined();
        expect(foundWorld.seed).toBe('integration-test');
        expect(foundWorld.width).toBe(30);
        expect(foundWorld.height).toBe(30);

        // Verify we can delete it
        const deleteResult = await handleDeleteWorld({ id: worldId }, { sessionId: 'test-session' });
        const deleteData = JSON.parse(deleteResult.content[0].text);

        expect(deleteData.message).toBe('World deleted');

        // Verify it's gone from list
        const listAfterDelete = await handleListWorlds({}, { sessionId: 'test-session' });
        const listAfterData = JSON.parse(listAfterDelete.content[0].text);
        expect(listAfterData.worlds.find((w: any) => w.id === worldId)).toBeUndefined();
    });
});
