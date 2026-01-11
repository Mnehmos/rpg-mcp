import { describe, it, expect, beforeEach } from 'vitest';
import { handleConcentrationManage, ConcentrationManageTool } from '../../../src/server/consolidated/concentration-manage.js';
import { getDb, closeDb } from '../../../src/storage/index.js';
import { CharacterRepository } from '../../../src/storage/repos/character.repo.js';
import { ConcentrationRepository } from '../../../src/storage/repos/concentration.repo.js';
import { randomUUID } from 'crypto';

describe('concentration_manage consolidated tool', () => {
    let characterId: string;
    let db: ReturnType<typeof getDb>;
    let characterRepo: CharacterRepository;
    let concentrationRepo: ConcentrationRepository;

    beforeEach(() => {
        closeDb();
        db = getDb(':memory:');
        characterRepo = new CharacterRepository(db);
        concentrationRepo = new ConcentrationRepository(db);

        // Create a test character (wizard with good CON)
        characterId = randomUUID();
        const now = new Date().toISOString();
        characterRepo.create({
            id: characterId,
            name: 'Test Wizard',
            characterType: 'pc',
            level: 5,
            hp: 30,
            maxHp: 30,
            ac: 12,
            stats: { str: 8, dex: 14, con: 14, int: 18, wis: 12, cha: 10 },
            createdAt: now,
            updatedAt: now
        });
    });

    const ctx = { worldId: '', partyId: '', encounterContext: null };

    describe('tool definition', () => {
        it('should have correct name and description', () => {
            expect(ConcentrationManageTool.name).toBe('concentration_manage');
            expect(ConcentrationManageTool.description).toContain('concentration');
        });

        it('should list all actions in description', () => {
            expect(ConcentrationManageTool.description).toContain('check_save');
            expect(ConcentrationManageTool.description).toContain('break');
            expect(ConcentrationManageTool.description).toContain('get');
        });
    });

    describe('action: get (no concentration)', () => {
        it('should return not concentrating when no active spell', async () => {
            const result = await handleConcentrationManage({
                action: 'get',
                characterId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.concentrating).toBe(false);
            expect(parsed.message).toContain('not concentrating');
        });

        it('should accept alias "status"', async () => {
            const result = await handleConcentrationManage({
                action: 'status',
                characterId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.concentrating).toBe(false);
            expect(parsed._fuzzyMatch).toBeDefined();
        });

        it('should accept alias "state"', async () => {
            const result = await handleConcentrationManage({
                action: 'state',
                characterId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.concentrating).toBe(false);
        });
    });

    describe('action: get (with concentration)', () => {
        beforeEach(() => {
            // Set up concentration on a spell
            concentrationRepo.create({
                characterId,
                activeSpell: 'Hold Person',
                spellLevel: 2,
                startedAt: 1,
                maxDuration: 10,
                targetIds: ['target-1']
            });
        });

        it('should return concentration details', async () => {
            const result = await handleConcentrationManage({
                action: 'get',
                characterId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.concentrating).toBe(true);
            expect(parsed.spell).toBe('Hold Person');
            expect(parsed.spellLevel).toBe(2);
            expect(parsed.maxDuration).toBe(10);
        });
    });

    describe('action: check_save', () => {
        beforeEach(() => {
            concentrationRepo.create({
                characterId,
                activeSpell: 'Bless',
                spellLevel: 1,
                startedAt: 1,
                maxDuration: 10
            });
        });

        it('should check concentration save after damage', async () => {
            const result = await handleConcentrationManage({
                action: 'check_save',
                characterId,
                damageAmount: 10
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.spell).toBe('Bless');
            expect(parsed.saveDC).toBe(10); // max(10, 10/2)
            expect(parsed.damageAmount).toBe(10);
            expect(typeof parsed.saveRoll).toBe('number');
            expect(typeof parsed.maintained).toBe('boolean');
        });

        it('should calculate DC correctly for high damage', async () => {
            const result = await handleConcentrationManage({
                action: 'check_save',
                characterId,
                damageAmount: 30
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.saveDC).toBe(15); // max(10, 30/2)
        });

        it('should accept alias "save"', async () => {
            const result = await handleConcentrationManage({
                action: 'save',
                characterId,
                damageAmount: 5
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed._fuzzyMatch).toBeDefined();
            expect(parsed.spell).toBe('Bless');
        });

        it('should accept alias "damage"', async () => {
            const result = await handleConcentrationManage({
                action: 'damage',
                characterId,
                damageAmount: 5
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.spell).toBe('Bless');
        });

        it('should return message when not concentrating', async () => {
            // Clear concentration
            concentrationRepo.delete(characterId);

            const result = await handleConcentrationManage({
                action: 'check_save',
                characterId,
                damageAmount: 10
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.spell).toBe('none');
            expect(parsed.message).toContain('not concentrating');
        });

        it('should return error for non-existent character', async () => {
            const result = await handleConcentrationManage({
                action: 'check_save',
                characterId: randomUUID(),
                damageAmount: 10
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.error).toBe(true);
            expect(parsed.message).toContain('not found');
        });
    });

    describe('action: break', () => {
        beforeEach(() => {
            concentrationRepo.create({
                characterId,
                activeSpell: 'Fly',
                spellLevel: 3,
                startedAt: 1,
                maxDuration: 10
            });
        });

        it('should break concentration voluntarily', async () => {
            const result = await handleConcentrationManage({
                action: 'break',
                characterId,
                reason: 'voluntary'
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.spell).toBe('Fly');
            expect(parsed.reason).toBe('voluntary');
            expect(parsed.message).toContain('ended');

            // Verify concentration is gone
            const checkResult = await handleConcentrationManage({
                action: 'get',
                characterId
            }, ctx);
            const checkParsed = JSON.parse(checkResult.content[0].text);
            expect(checkParsed.concentrating).toBe(false);
        });

        it('should break due to damage', async () => {
            const result = await handleConcentrationManage({
                action: 'break',
                characterId,
                reason: 'damage',
                damageAmount: 15
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.reason).toBe('damage');
            expect(parsed.message).toContain('failed concentration save');
        });

        it('should break due to incapacitated', async () => {
            const result = await handleConcentrationManage({
                action: 'break',
                characterId,
                reason: 'incapacitated'
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.message).toContain('incapacitated');
        });

        it('should accept alias "end"', async () => {
            const result = await handleConcentrationManage({
                action: 'end',
                characterId,
                reason: 'voluntary'
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed._fuzzyMatch).toBeDefined();
            expect(parsed.spell).toBe('Fly');
        });

        it('should accept alias "stop"', async () => {
            const result = await handleConcentrationManage({
                action: 'stop',
                characterId,
                reason: 'new_spell'
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.message).toContain('new concentration spell');
        });

        it('should handle when not concentrating', async () => {
            concentrationRepo.delete(characterId);

            const result = await handleConcentrationManage({
                action: 'break',
                characterId,
                reason: 'voluntary'
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.spell).toBe('none');
            expect(parsed.message).toContain('was not concentrating');
        });
    });

    describe('action: check_duration', () => {
        beforeEach(() => {
            concentrationRepo.create({
                characterId,
                activeSpell: 'Invisibility',
                spellLevel: 2,
                startedAt: 1,
                maxDuration: 5 // 5 rounds
            });
        });

        it('should report when concentration is within duration', async () => {
            const result = await handleConcentrationManage({
                action: 'check_duration',
                characterId,
                currentRound: 3
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.expired).toBe(false);
            expect(parsed.message).toContain('within duration');
        });

        it('should report when concentration has expired', async () => {
            const result = await handleConcentrationManage({
                action: 'check_duration',
                characterId,
                currentRound: 7 // past maxDuration of 5
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.expired).toBe(true);
            expect(parsed.spell).toBe('Invisibility');
            expect(parsed.message).toContain('exceeded');
        });

        it('should accept alias "duration"', async () => {
            const result = await handleConcentrationManage({
                action: 'duration',
                characterId,
                currentRound: 2
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed._fuzzyMatch).toBeDefined();
        });
    });

    describe('action: check_auto', () => {
        it('should report no auto break when healthy', async () => {
            const result = await handleConcentrationManage({
                action: 'check_auto',
                characterId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.broken).toBe(false);
            expect(parsed.message).toContain('No automatic');
        });

        it('should detect dead character', async () => {
            // Set HP to 0
            characterRepo.update(characterId, { hp: 0 });

            // Add concentration
            concentrationRepo.create({
                characterId,
                activeSpell: 'Shield of Faith',
                spellLevel: 1,
                startedAt: 1,
                maxDuration: 10
            });

            const result = await handleConcentrationManage({
                action: 'check_auto',
                characterId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.broken).toBe(true);
            expect(parsed.reason).toContain('death');
        });

        it('should accept alias "auto"', async () => {
            const result = await handleConcentrationManage({
                action: 'auto',
                characterId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed._fuzzyMatch).toBeDefined();
        });

        it('should accept alias "conditions"', async () => {
            const result = await handleConcentrationManage({
                action: 'conditions',
                characterId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.broken).toBe(false);
        });

        it('should return error for non-existent character', async () => {
            const result = await handleConcentrationManage({
                action: 'check_auto',
                characterId: randomUUID()
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.error).toBe(true);
            expect(parsed.message).toContain('not found');
        });
    });

    describe('fuzzy matching', () => {
        it('should match typo "chck_save" to "check_save"', async () => {
            concentrationRepo.create({
                characterId,
                activeSpell: 'Haste',
                spellLevel: 3,
                startedAt: 1,
                maxDuration: 10
            });

            const result = await handleConcentrationManage({
                action: 'chck_save',
                characterId,
                damageAmount: 5
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.spell).toBe('Haste');
            expect(parsed._fuzzyMatch).toBeDefined();
        });

        it('should match typo "brk" to "break"', async () => {
            concentrationRepo.create({
                characterId,
                activeSpell: 'Haste',
                spellLevel: 3,
                startedAt: 1,
                maxDuration: 10
            });

            const result = await handleConcentrationManage({
                action: 'brk',
                characterId,
                reason: 'voluntary'
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.spell).toBe('Haste');
        });
    });

    describe('error handling', () => {
        it('should return guiding error for invalid action', async () => {
            const result = await handleConcentrationManage({
                action: 'xyz',
                characterId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.error).toBe('invalid_action');
            expect(parsed.suggestions).toBeDefined();
            expect(parsed.message).toContain('Did you mean');
        });

        it('should return error for missing action', async () => {
            const result = await handleConcentrationManage({
                characterId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.error).toBe(true);
            expect(parsed.message).toContain('action');
        });

        it('should return validation error for missing characterId', async () => {
            const result = await handleConcentrationManage({
                action: 'get'
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.error).toBe('validation_error');
            expect(parsed.issues).toBeDefined();
        });

        it('should return validation error for missing damageAmount on check_save', async () => {
            const result = await handleConcentrationManage({
                action: 'check_save',
                characterId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.error).toBe('validation_error');
            expect(parsed.issues).toBeDefined();
        });

        it('should return validation error for missing reason on break', async () => {
            const result = await handleConcentrationManage({
                action: 'break',
                characterId
            }, ctx);

            const parsed = JSON.parse(result.content[0].text);
            expect(parsed.error).toBe('validation_error');
        });
    });
});
