import { CharacterSchema, NPCSchema } from '../../src/schema/character';
import { FIXED_TIMESTAMP } from '../fixtures';

describe('CharacterSchema', () => {
  it('should validate a complete character', () => {
    const validChar = {
      id: 'char-123',
      name: 'Hero',
      stats: {
        str: 10,
        dex: 12,
        con: 14,
        int: 16,
        wis: 13,
        cha: 8,
      },
      hp: 20,
      maxHp: 20,
      ac: 15,
      level: 1,
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };

    const result = CharacterSchema.safeParse(validChar);
    expect(result.success).toBe(true);
  });

  it('should reject invalid stats', () => {
    const invalidChar = {
      id: 'char-456',
      name: 'Weakling',
      stats: {
        str: -1, // Invalid
        dex: 10,
        con: 10,
        int: 10,
        wis: 10,
        cha: 10,
      },
      hp: 10,
      maxHp: 10,
      ac: 10,
      level: 1,
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };

    const result = CharacterSchema.safeParse(invalidChar);
    expect(result.success).toBe(false);
  });
});

describe('NPCSchema', () => {
  it('should validate an NPC with faction', () => {
    const validNPC = {
      id: 'npc-123',
      name: 'Guard',
      stats: {
        str: 12,
        dex: 10,
        con: 12,
        int: 10,
        wis: 10,
        cha: 10,
      },
      hp: 15,
      maxHp: 15,
      ac: 16,
      level: 2,
      factionId: 'faction-guards',
      behavior: 'aggressive',
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };

    const result = NPCSchema.safeParse(validNPC);
    expect(result.success).toBe(true);
  });
});
