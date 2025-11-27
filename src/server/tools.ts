import { z } from 'zod';
import { generateWorld, GeneratedWorld } from '../engine/worldgen/index';

import { PubSub } from '../engine/pubsub';

// Global state for the server (in-memory for MVP)
let currentWorld: GeneratedWorld | null = null;
let pubsub: PubSub | null = null;

export function setWorldPubSub(instance: PubSub) {
    pubsub = instance;
}

export const Tools = {
    GENERATE_WORLD: {
        name: 'generate_world',
        description: `Generates a new RPG world with the specified parameters.
        
Examples:
{
  "seed": "campaign-2024",
  "width": 50,
  "height": 50
}`,
        inputSchema: z.object({
            seed: z.string().describe('Seed for random number generation'),
            width: z.number().int().min(10).max(1000).describe('Width of the world grid'),
            height: z.number().int().min(10).max(1000).describe('Height of the world grid')
        })
    },
    GET_WORLD_STATE: {
        name: 'get_world_state',
        description: 'Retrieves the current state of the generated world.',
        inputSchema: z.object({})
    },
    APPLY_MAP_PATCH: {
        name: 'apply_map_patch',
        description: `Applies a DSL patch script to the current world.

Supported Commands:
- ADD_STRUCTURE type x y (e.g., "ADD_STRUCTURE town 12 15")
- SET_BIOME type x y (e.g., "SET_BIOME forest 10 10")
- EDIT_TILE x y elevation (e.g., "EDIT_TILE 5 5 0.8")

Example Script:
ADD_STRUCTURE city 25 25
SET_BIOME mountain 26 25`,
        inputSchema: z.object({
            script: z.string().describe('The DSL script containing patch commands.')
        })
    },
    GET_WORLD_MAP_OVERVIEW: {
        name: 'get_world_map_overview',
        description: 'Returns a high-level overview of the world including biome distribution and statistics.',
        inputSchema: z.object({})
    },
    GET_REGION_MAP: {
        name: 'get_region_map',
        description: 'Returns detailed information about a specific region including its tiles and structures.',
        inputSchema: z.object({
            regionId: z.number().int().min(0).describe('The ID of the region to retrieve')
        })
    },
    PREVIEW_MAP_PATCH: {
        name: 'preview_map_patch',
        description: 'Previews what a DSL patch script would do without applying it to the world.',
        inputSchema: z.object({
            script: z.string().describe('The DSL script to preview')
        })
    }
} as const;

export async function handleGenerateWorld(args: unknown) {
    const parsed = Tools.GENERATE_WORLD.inputSchema.parse(args);
    currentWorld = generateWorld({
        seed: parsed.seed,
        width: parsed.width,
        height: parsed.height
    });

    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify({
                    message: 'World generated successfully',
                    stats: {
                        width: currentWorld.width,
                        height: currentWorld.height,
                        regions: currentWorld.regions.length,
                        structures: currentWorld.structures.length,
                        rivers: currentWorld.rivers.filter(r => r > 0).length
                    }
                }, null, 2)
            }
        ]
    };
}

export async function handleGetWorldState() {
    if (!currentWorld) {
        throw new Error('No world has been generated yet. Use generate_world first.');
    }

    // Return a summary to avoid overwhelming the context window
    // In a real app, we might return specific chunks or a compressed representation
    console.log('Current World State:', JSON.stringify(currentWorld, null, 2));
    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify({
                    seed: currentWorld.seed,
                    width: currentWorld.width,
                    height: currentWorld.height,
                    stats: {
                        regions: currentWorld.regions.length,
                        structures: currentWorld.structures.length
                    }
                }, null, 2)
            }
        ]
    };
}

import { parseDSL } from '../engine/dsl/parser';
import { applyPatch } from '../engine/dsl/engine';

export async function handleApplyMapPatch(args: unknown) {
    if (!currentWorld) {
        throw new Error('No world has been generated yet. Use generate_world first.');
    }

    const parsed = Tools.APPLY_MAP_PATCH.inputSchema.parse(args);

    try {
        const commands = parseDSL(parsed.script);
        applyPatch(currentWorld, commands);

        pubsub?.publish('world', {
            type: 'patch_applied',
            commandsExecuted: commands.length,
            timestamp: Date.now()
        });

        return {
            content: [
                {
                    type: 'text' as const,
                    text: JSON.stringify({
                        message: 'Patch applied successfully',
                        commandsExecuted: commands.length
                    }, null, 2)
                }
            ]
        };
    } catch (error: any) {
        return {
            isError: true,
            content: [
                {
                    type: 'text' as const,
                    text: `Failed to apply patch: ${error.message}`
                }
            ]
        };
    }
}

export async function handleGetWorldMapOverview(args: unknown) {
    if (!currentWorld) {
        throw new Error('No world has been generated yet. Use generate_world first.');
    }

    Tools.GET_WORLD_MAP_OVERVIEW.inputSchema.parse(args);

    // Calculate biome distribution
    const biomeDistribution: Record<string, number> = {};
    for (let y = 0; y < currentWorld.height; y++) {
        for (let x = 0; x < currentWorld.width; x++) {
            const biome = currentWorld.biomes[y][x];
            biomeDistribution[biome] = (biomeDistribution[biome] || 0) + 1;
        }
    }

    // Convert counts to percentages
    const totalTiles = currentWorld.width * currentWorld.height;
    const biomePercentages: Record<string, number> = {};
    for (const [biome, count] of Object.entries(biomeDistribution)) {
        biomePercentages[biome] = Math.round((count / totalTiles) * 100 * 10) / 10;
    }

    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify({
                    seed: currentWorld.seed,
                    dimensions: {
                        width: currentWorld.width,
                        height: currentWorld.height
                    },
                    biomeDistribution: biomePercentages,
                    regionCount: currentWorld.regions.length,
                    structureCount: currentWorld.structures.length,
                    riverTileCount: currentWorld.rivers.filter(r => r > 0).length
                }, null, 2)
            }
        ]
    };
}

export async function handleGetRegionMap(args: unknown) {
    if (!currentWorld) {
        throw new Error('No world has been generated yet. Use generate_world first.');
    }

    const parsed = Tools.GET_REGION_MAP.inputSchema.parse(args);
    const regionId = parsed.regionId;

    // Find the region
    const region = currentWorld.regions.find(r => r.id === regionId);
    if (!region) {
        throw new Error(`Region not found: ${regionId}`);
    }

    // Collect all tiles belonging to this region
    const tiles: Array<{ x: number; y: number; biome: string; elevation: number }> = [];
    for (let y = 0; y < currentWorld.height; y++) {
        for (let x = 0; x < currentWorld.width; x++) {
            const idx = y * currentWorld.width + x;
            if (currentWorld.regionMap[idx] === regionId) {
                tiles.push({
                    x,
                    y,
                    biome: currentWorld.biomes[y][x],
                    elevation: currentWorld.elevation[idx]
                });
            }
        }
    }

    // Find structures in this region
    const world = currentWorld;
    const structures = world.structures.filter(s => {
        const idx = s.location.y * world.width + s.location.x;
        return world.regionMap[idx] === regionId;
    });

    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify({
                    region: {
                        id: region.id,
                        name: region.name,
                        capitalX: region.capital.x,
                        capitalY: region.capital.y,
                        dominantBiome: region.biome
                    },
                    tiles,
                    structures,
                    tileCount: tiles.length
                }, null, 2)
            }
        ]
    };
}

export async function handlePreviewMapPatch(args: unknown) {
    if (!currentWorld) {
        throw new Error('No world has been generated yet. Use generate_world first.');
    }

    const parsed = Tools.PREVIEW_MAP_PATCH.inputSchema.parse(args);

    try {
        // Parse the DSL to validate it
        const commands = parseDSL(parsed.script);

        // Return preview information without applying
        return {
            content: [
                {
                    type: 'text' as const,
                    text: JSON.stringify({
                        commands: commands.map(cmd => {
                            // Build a preview object based on command type
                            const preview: any = {
                                type: cmd.command
                            };

                            // Add specific args based on command type
                            if ('x' in cmd.args && 'y' in cmd.args) {
                                preview.x = cmd.args.x;
                                preview.y = cmd.args.y;
                            }
                            if ('type' in cmd.args) {
                                preview.structureType = cmd.args.type;
                            }
                            if ('name' in cmd.args) {
                                preview.name = cmd.args.name;
                            }

                            return preview;
                        }),
                        commandCount: commands.length,
                        willModify: commands.length > 0
                    }, null, 2)
                }
            ]
        };
    } catch (error: any) {
        throw new Error(`Invalid patch script: ${error.message}`);
    }
}

// Helper function for tests to clear world state
export function clearWorld() {
    currentWorld = null;
}
