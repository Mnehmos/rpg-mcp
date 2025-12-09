import { z } from 'zod';
import { SessionContext } from './types.js';
import { getDb } from '../storage/index.js';
import { CharacterRepository } from '../storage/repos/character.repo.js';

const XP_TABLE: Record<number, number> = {
    1: 0,
    2: 300,
    3: 900,
    4: 2700,
    5: 6500,
    6: 14000,
    7: 23000,
    8: 34000,
    9: 48000,
    10: 64000,
    11: 85000,
    12: 100000,
    13: 120000,
    14: 140000,
    15: 165000,
    16: 195000,
    17: 225000,
    18: 265000,
    19: 305000,
    20: 355000
};

export const ProgressionTools = {
    ADD_XP: {
        name: 'add_xp',
        description: 'Add experience points to a character. Checks for level-up thresholds.',
        inputSchema: z.object({
            characterId: z.string().describe('ID of the character'),
            amount: z.number().int().min(1).describe('Amount of XP to add')
        })
    },
    GET_LEVEL_PROGRESSION: {
        name: 'get_level_progression',
        description: 'Get level progression details including XP needed for next level.',
        inputSchema: z.object({
            level: z.number().int().min(1).max(20).describe('Current level to check progression for')
        })
    },
    LEVEL_UP: {
        name: 'level_up',
        description: 'Increment character level and optionally update stats like HP.',
        inputSchema: z.object({
            characterId: z.string().describe('ID of the character'),
            hpIncrease: z.number().int().min(0).optional().describe('Amount to increase Max HP by (if any)'),
            targetLevel: z.number().int().min(2).max(20).optional().describe('Explicit target level (default: current + 1)')
        })
    }
} as const;

export async function handleAddXp(args: unknown, _ctx: SessionContext) {
    const parsed = ProgressionTools.ADD_XP.inputSchema.parse(args);
    const db = getDb();
    const repo = new CharacterRepository(db);
    
    const char = repo.findById(parsed.characterId);
    if (!char) {
        throw new Error(`Character ${parsed.characterId} not found`);
    }

    // Initialize XP if undefined (migration might not have filled existing rows logic in repo, but SQL adds default 0)
    const currentXp = char.xp || 0;
    const newXp = currentXp + parsed.amount;
    
    // Check level threshold
    const currentLevel = char.level;
    const nextLevelXp = XP_TABLE[currentLevel + 1];
    let message = `Added ${parsed.amount} XP. Total: ${newXp}.`;
    let canLevelUp = false;

    if (nextLevelXp && newXp >= nextLevelXp) {
        canLevelUp = true;
        message += ` 🌟 LEVEL UP AVAILABLE! Reached threshold for Level ${currentLevel + 1}.`;
    }

    // Update DB
    repo.update(char.id, { xp: newXp });

    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify({
                    characterId: char.id,
                    name: char.name,
                    oldXp: currentXp,
                    newXp: newXp,
                    level: currentLevel,
                    canLevelUp,
                    nextLevelXp,
                    message
                }, null, 2)
            }
        ]
    };
}

export async function handleGetLevelProgression(args: unknown, _ctx: SessionContext) {
    const parsed = ProgressionTools.GET_LEVEL_PROGRESSION.inputSchema.parse(args);
    const level = parsed.level;
    
    if (level >= 20) {
        return {
            content: [{ type: 'text' as const, text: JSON.stringify({ level: 20, maxLevel: true, xpForCurrent: XP_TABLE[20] }) }]
        };
    }

    const currentXpBase = XP_TABLE[level];
    const nextLevelXp = XP_TABLE[level + 1];
    
    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify({
                    level,
                    xpRequiredForLevel: currentXpBase,
                    xpForNextLevel: nextLevelXp,
                    xpToNext: nextLevelXp - currentXpBase
                }, null, 2)
            }
        ]
    };
}

export async function handleLevelUp(args: unknown, _ctx: SessionContext) {
    const parsed = ProgressionTools.LEVEL_UP.inputSchema.parse(args);
    const db = getDb();
    const repo = new CharacterRepository(db);

    const char = repo.findById(parsed.characterId);
    if (!char) {
        throw new Error(`Character ${parsed.characterId} not found`);
    }

    const currentLevel = char.level;
    const targetLevel = parsed.targetLevel || (currentLevel + 1);

    if (targetLevel <= currentLevel) {
        throw new Error(`Target level ${targetLevel} must be greater than current level ${currentLevel}`);
    }

    const updates: any = {
        level: targetLevel
    };

    if (parsed.hpIncrease) {
        updates.maxHp = (char.maxHp || 0) + parsed.hpIncrease;
        updates.hp = (char.hp || 0) + parsed.hpIncrease; // Heal the amount increased?? Or just max? Usually max.
        // Let's assume we increase current HP by the same amount or just max.
        // Standard rule: Current HP increases by the same amount as Max HP.
        updates.hp = (char.hp || 0) + parsed.hpIncrease;
    }

    repo.update(char.id, updates);

    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify({
                    characterId: char.id,
                    name: char.name,
                    oldLevel: currentLevel,
                    newLevel: targetLevel,
                    hpIncrease: parsed.hpIncrease || 0,
                    newMaxHp: updates.maxHp || char.maxHp,
                    message: `Leveled up to ${targetLevel}!`
                }, null, 2)
            }
        ]
    };
}
