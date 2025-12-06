import { z } from 'zod';

/**
 * Travel terrain types for navigation and movement
 */
export const TravelTerrainSchema = z.enum([
    'paved',       // Roads, city streets - fast travel
    'dirt',        // Dirt roads, well-worn paths - normal travel
    'wilderness',  // Overgrown trails, rough terrain - slow travel
    'indoor'       // Inside buildings - instant/minimal travel
]);
export type TravelTerrain = z.infer<typeof TravelTerrainSchema>;

/**
 * Exit represents a connection between two rooms
 */
export const ExitSchema = z.object({
    direction: z.enum([
        'north',
        'south',
        'east',
        'west',
        'up',
        'down',
        'northeast',
        'northwest',
        'southeast',
        'southwest'
    ]),
    targetNodeId: z.string().uuid(),
    type: z.enum(['OPEN', 'LOCKED', 'HIDDEN']),
    dc: z.number().int().min(5).max(30).optional()
        .describe('DC for Perception to detect HIDDEN exits or Lockpicking for LOCKED'),
    description: z.string().optional()
        .describe('Narrative description of the exit (e.g., "A heavy oak door leads north")'),

    // Travel metadata
    travelTime: z.number().int().min(0).optional()
        .describe('Time to traverse in minutes (0 for instant, e.g., doorways)'),
    terrain: TravelTerrainSchema.optional()
        .describe('Type of terrain affecting travel speed and difficulty'),
    difficulty: z.number().int().min(5).max(30).optional()
        .describe('DC for Navigation or Survival checks if terrain is challenging'),
});

export type Exit = z.infer<typeof ExitSchema>;

// PHASE-2: Export BiomeType and Atmospheric for social hearing mechanics
export const BiomeTypeSchema = z.enum([
    'forest',
    'mountain',
    'urban',
    'dungeon',
    'coastal',
    'cavern',
    'divine',
    'arcane'
]);
export type BiomeType = z.infer<typeof BiomeTypeSchema>;

export const AtmosphericSchema = z.enum([
    'DARKNESS',
    'FOG',
    'ANTIMAGIC',
    'SILENCE',
    'BRIGHT',
    'MAGICAL'
]);
export type Atmospheric = z.infer<typeof AtmosphericSchema>;

/**
 * RoomNode represents a persistent location in the world
 * Rooms are semantic locations (tavern, forest clearing, dungeon chamber)
 * distinct from physical grid tiles in the worldgen system
 */
export const RoomNodeSchema = z.object({
    id: z.string().uuid(),

    // Narrative identity
    name: z.string()
        .min(1, 'Room name cannot be empty')
        .max(100, 'Room name too long')
        .refine((s) => s.trim().length > 0, 'Room name cannot be whitespace only'),
    baseDescription: z.string()
        .min(10, 'Description must be detailed')
        .max(2000, 'Description too long')
        .refine((s) => s.trim().length >= 10, 'Description must have at least 10 non-whitespace characters'),

    // World context
    biomeContext: BiomeTypeSchema
        .describe('Linked to src/engine/worldgen biome definitions'),

    // Atmospheric effects
    atmospherics: z.array(AtmosphericSchema).default([])
        .describe('Environmental effects that modify perception and abilities'),

    // Spatial coordinates (optional - some rooms are abstract/non-physical)
    worldX: z.number().int().min(0).optional()
        .describe('X coordinate on world map grid'),
    worldY: z.number().int().min(0).optional()
        .describe('Y coordinate on world map grid'),
    networkId: z.string().uuid().optional()
        .describe('ID of node network this room belongs to (town, road, dungeon)'),

    // Connections
    exits: z.array(ExitSchema)
        .default([]),

    // Entities present
    entityIds: z.array(z.string().uuid())
        .default([])
        .describe('Foreign keys to characters/NPCs/items in this room'),

    // Metadata
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    visitedCount: z.number().int().min(0).default(0),
    lastVisitedAt: z.string().datetime().optional(),
});

export type RoomNode = z.infer<typeof RoomNodeSchema>;

/**
 * NodeNetwork represents a collection of connected rooms forming a location
 * Examples: towns (cluster), roads (linear), dungeons (cluster)
 */
export const NodeNetworkSchema = z.object({
    id: z.string().uuid(),
    name: z.string()
        .min(1, 'Network name cannot be empty')
        .max(100, 'Network name too long'),
    type: z.enum(['cluster', 'linear'])
        .describe('cluster = town/dungeon, linear = road/path'),
    worldId: z.string()
        .describe('ID of the world this network belongs to'),

    // Primary location on world map
    centerX: z.number().int().min(0)
        .describe('Center X coordinate on world map'),
    centerY: z.number().int().min(0)
        .describe('Center Y coordinate on world map'),

    // Optional bounding box for large networks
    boundingBox: z.object({
        minX: z.number().int().min(0),
        maxX: z.number().int().min(0),
        minY: z.number().int().min(0),
        maxY: z.number().int().min(0),
    }).optional()
        .describe('Bounding box for networks spanning multiple tiles'),

    // Metadata
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export type NodeNetwork = z.infer<typeof NodeNetworkSchema>;
