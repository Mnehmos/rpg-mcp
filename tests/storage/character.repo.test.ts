
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import { initDB } from '../../src/storage/db';
import { migrate } from '../../src/storage/migrations';
import { CharacterRepository } from '../../src/storage/repos/character.repo';
import { Character, NPC } from '../../src/schema/character';
import { FIXED_TIMESTAMP } from '../fixtures';

const TEST_DB_PATH = 'test-character-repo.db';

describe('CharacterRepository', () => {
    let db: ReturnType<typeof initDB>;
    let repo: CharacterRepository;

    beforeEach(() => {
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        db = initDB(TEST_DB_PATH);
        migrate(db);
        repo = new CharacterRepository(db);
    });

    afterEach(() => {
        db.close();
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
    });

    it('should create and retrieve a character', () => {
        const character: Character = {
            id: 'char-1',
            name: 'Hero',
            stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            hp: 20,
            maxHp: 20,
            ac: 15,
            level: 1,
            createdAt: FIXED_TIMESTAMP,
            updatedAt: FIXED_TIMESTAMP,
        };

        repo.create(character);

        const retrieved = repo.findById('char-1');
        expect(retrieved).toEqual(character);
    });

    it('should create and retrieve an NPC', () => {
        const npc: NPC = {
            id: 'npc-1',
            name: 'Guard',
            stats: { str: 12, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
            hp: 15,
            maxHp: 15,
            ac: 16,
            level: 2,
            factionId: 'guards',
            behavior: 'aggressive',
            createdAt: FIXED_TIMESTAMP,
            updatedAt: FIXED_TIMESTAMP,
        };

        repo.create(npc);

        const retrieved = repo.findById('npc-1') as NPC;
        expect(retrieved).toEqual(npc);
        expect(retrieved.factionId).toBe('guards');
    });
});
