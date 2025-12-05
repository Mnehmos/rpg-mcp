import { z } from 'zod';

export const ConditionSchema = z.object({
    id: z.string(),
    type: z.string(),
    durationType: z.string(),
    duration: z.number().optional(),
    sourceId: z.string().optional(),
    saveDC: z.number().optional(),
    saveAbility: z.string().optional(),
    ongoingEffects: z.array(z.any()).optional(),
    metadata: z.record(z.any()).optional()
});

export const TokenSchema = z.object({
    id: z.string(),
    name: z.string(),
    initiativeBonus: z.number(),
    initiative: z.number().optional(),  // Rolled initiative value
    isEnemy: z.boolean().optional(),    // Whether this is an enemy
    hp: z.number(),
    maxHp: z.number(),
    conditions: z.array(ConditionSchema),
    abilityScores: z.object({
        strength: z.number(),
        dexterity: z.number(),
        constitution: z.number(),
        intelligence: z.number(),
        wisdom: z.number(),
        charisma: z.number()
    }).optional()
});

export type Token = z.infer<typeof TokenSchema>;

export const EncounterSchema = z.object({
    id: z.string(),
    regionId: z.string().optional(), // Made optional as it might not always be linked to a region
    tokens: z.array(TokenSchema),
    round: z.number().int().min(0),
    activeTokenId: z.string().optional(),
    status: z.enum(['active', 'completed', 'paused']),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
});

export type Encounter = z.infer<typeof EncounterSchema>;
