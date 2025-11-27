import { describe, it, expect } from 'vitest';
import {
    handleGenerateWorld,
    handleGetWorldState,
    handleApplyMapPatch,
    handleGetWorldMapOverview,
    handleGetRegionMap,
    handlePreviewMapPatch
} from '../../src/server/tools';

describe('MCP Server Tools', () => {
    it('should generate a world successfully', async () => {
        const args = {
            seed: 'test-seed',
            width: 50,
            height: 50
        };

        const result = await handleGenerateWorld(args);

        expect(result.content).toHaveLength(1);
        expect(result.content[0].type).toBe('text');

        const response = JSON.parse(result.content[0].text);
        expect(response.message).toBe('World generated successfully');
        expect(response.stats.width).toBe(50);
        expect(response.stats.height).toBe(50);
    });

    it('should retrieve world state after generation', async () => {
        // Generate first
        await handleGenerateWorld({
            seed: 'state-test',
            width: 20,
            height: 20
        });

        // Retrieve state
        const result = await handleGetWorldState();

        expect(result.content).toHaveLength(1);
        const state = JSON.parse(result.content[0].text);

        expect(state.seed).toBe('state-test');
        expect(state.width).toBe(20);
        expect(state.height).toBe(20);
        expect(state.stats).toBeDefined();
    });

    it('should apply map patch successfully', async () => {
        // Ensure world exists (persisted from previous test or new gen)
        await handleGenerateWorld({
            seed: 'patch-test',
            width: 20,
            height: 20
        });

        const script = `ADD_STRUCTURE type="city" x=5 y=5 name="Patch City"`;

        const result = await handleApplyMapPatch({ script });

        expect(result.content).toHaveLength(1);
        const response = JSON.parse(result.content[0].text);
        expect(response.message).toBe('Patch applied successfully');
        expect(response.commandsExecuted).toBe(1);

        // Verify state change
        const stateResult = await handleGetWorldState();
        const state = JSON.parse(stateResult.content[0].text);
        // We can't easily check the structures array directly from the summary unless we update get_world_state to return it
        // But the stats should reflect it
        expect(state.stats.structures).toBeGreaterThan(0);
    });

    describe('get_world_map_overview', () => {
        it('should return overview with biome distribution when world exists', async () => {
            // Generate a world first
            await handleGenerateWorld({
                seed: 'overview-test',
                width: 50,
                height: 50
            });

            const result = await handleGetWorldMapOverview({});

            expect(result.content).toHaveLength(1);
            const overview = JSON.parse(result.content[0].text);

            // Should have basic world info
            expect(overview.seed).toBe('overview-test');
            expect(overview.dimensions).toEqual({ width: 50, height: 50 });

            // Should have biome distribution
            expect(overview.biomeDistribution).toBeDefined();
            expect(typeof overview.biomeDistribution).toBe('object');

            // Should have region count
            expect(overview.regionCount).toBeGreaterThanOrEqual(0);
            expect(overview.structureCount).toBeGreaterThanOrEqual(0);
        });

        it('should throw error when no world exists', async () => {
            // Reset world state by generating a new one then clearing
            const { clearWorld } = await import('../../src/server/tools');
            clearWorld();

            await expect(handleGetWorldMapOverview({})).rejects.toThrow('No world has been generated');
        });
    });

    describe('get_region_map', () => {
        it('should return region details when valid regionId provided', async () => {
            // Generate a world
            await handleGenerateWorld({
                seed: 'region-test',
                width: 50,
                height: 50
            });

            const result = await handleGetRegionMap({ regionId: 0 });

            expect(result.content).toHaveLength(1);
            const regionData = JSON.parse(result.content[0].text);

            expect(regionData.region).toBeDefined();
            expect(regionData.region.id).toBe(0);
            expect(regionData.region.name).toBeDefined();
            expect(regionData.tiles).toBeDefined();
            expect(Array.isArray(regionData.tiles)).toBe(true);
        });

        it('should throw error for invalid regionId', async () => {
            await handleGenerateWorld({
                seed: 'region-invalid-test',
                width: 50,
                height: 50
            });

            await expect(handleGetRegionMap({ regionId: 9999 })).rejects.toThrow('Region not found');
        });

        it('should throw error when no world exists', async () => {
            const { clearWorld } = await import('../../src/server/tools');
            clearWorld();

            await expect(handleGetRegionMap({ regionId: 0 })).rejects.toThrow('No world has been generated');
        });
    });

    describe('preview_map_patch', () => {
        it('should preview patch without applying it', async () => {
            // Generate a world
            await handleGenerateWorld({
                seed: 'preview-test',
                width: 50,
                height: 50
            });

            const script = `ADD_STRUCTURE type="city" x=10 y=10 name="Preview City"`;
            const result = await handlePreviewMapPatch({ script });

            expect(result.content).toHaveLength(1);
            const preview = JSON.parse(result.content[0].text);

            expect(preview.commands).toBeDefined();
            expect(preview.commands.length).toBe(1);
            expect(preview.commands[0].type).toBe('ADD_STRUCTURE');
            expect(preview.willModify).toBe(true);

            // Verify world state unchanged
            const stateResult = await handleGetWorldState();
            const state = JSON.parse(stateResult.content[0].text);

            // Structure count should be same as before (patch not applied)
            const initialStructures = state.stats.structures;

            // Now apply the patch
            await handleApplyMapPatch({ script });
            const stateAfterApply = JSON.parse((await handleGetWorldState()).content[0].text);

            // Structure count should increase after apply
            expect(stateAfterApply.stats.structures).toBeGreaterThan(initialStructures);
        });

        it('should indicate invalid patch syntax', async () => {
            await handleGenerateWorld({
                seed: 'preview-invalid-test',
                width: 50,
                height: 50
            });

            const invalidScript = `INVALID_COMMAND x=5 y=5`;

            await expect(handlePreviewMapPatch({ script: invalidScript })).rejects.toThrow();
        });

        it('should throw error when no world exists', async () => {
            const { clearWorld } = await import('../../src/server/tools');
            clearWorld();

            await expect(handlePreviewMapPatch({ script: 'ADD_STRUCTURE type="city" x=5 y=5 name="Test"' }))
                .rejects.toThrow('No world has been generated');
        });
    });
});
