/**
 * Tests for creature preset system
 */
import {
    getCreaturePreset,
    expandCreatureTemplate,
    parseCreatureTemplate,
    listCreaturePresets,
    listCreatureVariants,
    listAllTemplates,
    CREATURE_PRESETS
} from '../../src/data/creature-presets.js';

describe('Creature Presets', () => {
    describe('getCreaturePreset', () => {
        it('retrieves goblin preset', () => {
            const goblin = getCreaturePreset('goblin');
            expect(goblin).not.toBeNull();
            expect(goblin?.name).toBe('Goblin');
            expect(goblin?.hp).toBe(7);
            expect(goblin?.ac).toBe(15);
            expect(goblin?.characterType).toBe('enemy');
        });

        it('handles case insensitivity', () => {
            expect(getCreaturePreset('GOBLIN')).not.toBeNull();
            expect(getCreaturePreset('Goblin')).not.toBeNull();
        });

        it('handles spaces and dashes', () => {
            expect(getCreaturePreset('dire wolf')).not.toBeNull();
            expect(getCreaturePreset('dire-wolf')).not.toBeNull();
            expect(getCreaturePreset('dire_wolf')).not.toBeNull();
        });

        it('returns null for unknown creatures', () => {
            expect(getCreaturePreset('beholder')).toBeNull();
        });
    });

    describe('parseCreatureTemplate', () => {
        it('parses simple template', () => {
            const { base, variant } = parseCreatureTemplate('goblin');
            expect(base).toBe('goblin');
            expect(variant).toBeUndefined();
        });

        it('parses variant template', () => {
            const { base, variant } = parseCreatureTemplate('goblin:archer');
            expect(base).toBe('goblin');
            expect(variant).toBe('archer');
        });

        it('normalizes input', () => {
            const { base, variant } = parseCreatureTemplate('Dire Wolf:Alpha');
            expect(base).toBe('dire_wolf');
            expect(variant).toBe('alpha');
        });
    });

    describe('expandCreatureTemplate', () => {
        it('expands base creature', () => {
            const goblin = expandCreatureTemplate('goblin');
            expect(goblin).not.toBeNull();
            expect(goblin?.name).toBe('Goblin');
        });

        it('expands creature with variant', () => {
            const archer = expandCreatureTemplate('goblin:archer');
            expect(archer).not.toBeNull();
            expect(archer?.name).toBe('Goblin Archer');
            expect(archer?.defaultAttack?.name).toBe('Shortbow');
        });

        it('applies HP modifier from variant', () => {
            const warrior = expandCreatureTemplate('goblin:warrior');
            const base = getCreaturePreset('goblin');
            expect(warrior).not.toBeNull();
            expect(warrior!.hp).toBe(base!.hp + 3); // warrior has +3 HP
        });

        it('applies AC modifier from variant', () => {
            const archer = expandCreatureTemplate('goblin:archer');
            const base = getCreaturePreset('goblin');
            expect(archer).not.toBeNull();
            expect(archer!.ac).toBe(base!.ac - 2); // archer has -2 AC (no shield)
        });

        it('allows name override', () => {
            const named = expandCreatureTemplate('goblin:warrior', 'Grak the Bold');
            expect(named?.name).toBe('Grak the Bold');
        });

        it('returns base for unknown variant', () => {
            const unknown = expandCreatureTemplate('goblin:unknown_variant');
            expect(unknown).not.toBeNull();
            expect(unknown?.name).toBe('Goblin');
        });

        it('returns null for unknown creature', () => {
            expect(expandCreatureTemplate('beholder')).toBeNull();
        });
    });

    describe('listCreaturePresets', () => {
        it('lists all available creatures', () => {
            const creatures = listCreaturePresets();
            expect(creatures.length).toBeGreaterThan(30);
            expect(creatures).toContain('goblin');
            expect(creatures).toContain('skeleton');
            expect(creatures).toContain('wolf');
        });
    });

    describe('listCreatureVariants', () => {
        it('lists variants for goblin', () => {
            const variants = listCreatureVariants('goblin');
            expect(variants).toContain('warrior');
            expect(variants).toContain('archer');
            expect(variants).toContain('boss');
            expect(variants).toContain('shaman');
        });

        it('returns empty array for creature without variants', () => {
            const variants = listCreatureVariants('ogre');
            expect(variants).toEqual([]);
        });
    });

    describe('listAllTemplates', () => {
        it('lists all base and variant templates', () => {
            const templates = listAllTemplates();
            expect(templates).toContain('goblin');
            expect(templates).toContain('goblin:warrior');
            expect(templates).toContain('goblin:archer');
            expect(templates.length).toBeGreaterThan(40);
        });
    });

    describe('CREATURE_PRESETS structure', () => {
        it('all creatures have required fields', () => {
            for (const [key, preset] of Object.entries(CREATURE_PRESETS)) {
                expect(preset.name, `${key} missing name`).toBeTruthy();
                expect(preset.stats, `${key} missing stats`).toBeDefined();
                expect(preset.hp, `${key} missing hp`).toBeGreaterThan(0);
                expect(preset.maxHp, `${key} missing maxHp`).toBeGreaterThan(0);
                expect(preset.ac, `${key} missing ac`).toBeGreaterThan(0);
                expect(preset.level, `${key} missing level`).toBeGreaterThan(0);
                expect(preset.characterType, `${key} missing characterType`).toBe('enemy');
            }
        });

        it('all creatures have valid stats', () => {
            for (const [key, preset] of Object.entries(CREATURE_PRESETS)) {
                expect(preset.stats.str, `${key} str invalid`).toBeGreaterThanOrEqual(1);
                expect(preset.stats.dex, `${key} dex invalid`).toBeGreaterThanOrEqual(1);
                expect(preset.stats.con, `${key} con invalid`).toBeGreaterThanOrEqual(1);
                expect(preset.stats.int, `${key} int invalid`).toBeGreaterThanOrEqual(1);
                expect(preset.stats.wis, `${key} wis invalid`).toBeGreaterThanOrEqual(1);
                expect(preset.stats.cha, `${key} cha invalid`).toBeGreaterThanOrEqual(1);
            }
        });
    });
});
