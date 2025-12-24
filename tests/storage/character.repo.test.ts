
import * as fs from 'fs';
import { initDB } from '../../src/storage/db';
import { migrate } from '../../src/storage/migrations';
import { CharacterRepository } from '../../src/storage/repos/character.repo';
import { Character, NPC } from '../../src/schema/character';
import { FIXED_TIMESTAMP } from '../fixtures.js';

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
            characterType: 'pc',
            createdAt: FIXED_TIMESTAMP,
            updatedAt: FIXED_TIMESTAMP,
        };

        repo.create(character);

        const retrieved = repo.findById('char-1');
        // Use toMatchObject since repository adds spellcasting defaults
        expect(retrieved).toMatchObject(character);
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
            characterType: 'pc',
            factionId: 'guards',
            behavior: 'aggressive',
            createdAt: FIXED_TIMESTAMP,
            updatedAt: FIXED_TIMESTAMP,
        };

        repo.create(npc);

        const retrieved = repo.findById('npc-1') as NPC;
        // Use toMatchObject since repository adds spellcasting defaults
        expect(retrieved).toMatchObject(npc);
        expect(retrieved.factionId).toBe('guards');
    });

    it('should update a character', () => {
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

        const updated = repo.update('char-1', { hp: 15, level: 2 });
        expect(updated).not.toBeNull();
        expect(updated?.hp).toBe(15);
        expect(updated?.level).toBe(2);
        expect(updated?.updatedAt).not.toBe(FIXED_TIMESTAMP); // Should update timestamp

        const retrieved = repo.findById('char-1');
        expect(retrieved?.hp).toBe(15);
        expect(retrieved?.level).toBe(2);
    });

    it('should find all characters', () => {
        const c1: Character = {
            id: 'c1', name: 'C1', stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            hp: 10, maxHp: 10, ac: 10, level: 1, createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP
        };
        const c2: Character = {
            id: 'c2', name: 'C2', stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            hp: 10, maxHp: 10, ac: 10, level: 1, createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP
        };

        repo.create(c1);
        repo.create(c2);

        const all = repo.findAll();
        expect(all).toHaveLength(2);
        expect(all.map(c => c.id).sort()).toEqual(['c1', 'c2']);
    });

    // EDGE-003: Character name length limits
    it('EDGE-003: should reject empty character names', () => {
        const character: Character = {
            id: 'edge-empty',
            name: '',  // Empty name - should be rejected
            stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            hp: 10, maxHp: 10, ac: 10, level: 1,
            createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP
        };

        expect(() => repo.create(character)).toThrow();
    });

    it('EDGE-003: should reject excessively long character names', () => {
        const longName = 'A'.repeat(200);  // 200 chars - too long
        const character: Character = {
            id: 'edge-long',
            name: longName,
            stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            hp: 10, maxHp: 10, ac: 10, level: 1,
            createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP
        };

        expect(() => repo.create(character)).toThrow('Character name cannot exceed 100 characters');
    });

    it('EDGE-003: should accept character names up to 100 characters', () => {
        const maxName = 'A'.repeat(100);  // Exactly 100 chars - should work
        const character: Character = {
            id: 'edge-max',
            name: maxName,
            stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            hp: 10, maxHp: 10, ac: 10, level: 1,
            createdAt: FIXED_TIMESTAMP, updatedAt: FIXED_TIMESTAMP
        };

        repo.create(character);
        const retrieved = repo.findById('edge-max');
        expect(retrieved?.name).toBe(maxName);
    });
});
