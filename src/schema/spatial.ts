import { z } from 'zod';

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
        .describe('DC for Perception to detect HIDDEN exits'),
    description: z.string().optional()
        .describe('Narrative description of the exit (e.g., "A heavy oak door leads north")'),
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
