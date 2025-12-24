/**
 * Tests for the modular item preset system
 */
import {
    getItemPreset,
    getWeaponPreset,
    getArmorPreset,
    getGearPreset,
    getMagicItemPreset,
    searchItems,
    listItemsByType,
    listItemsByTag,
    listAllItemKeys,
    listAllTags,
    getRegistryStats,
    normalizeKey
} from '../../src/data/items/index.js';

describe('Item Preset Registry', () => {
    describe('normalizeKey', () => {
        it('normalizes item names correctly', () => {
            expect(normalizeKey('Longsword')).toBe('longsword');
            expect(normalizeKey('Studded Leather')).toBe('studded_leather');
            expect(normalizeKey('+1 Longsword')).toBe('+1_longsword');
            expect(normalizeKey("Thieves' Tools")).toBe('thieves_tools');
        });
    });

    describe('getItemPreset', () => {
        it('retrieves weapons by name', () => {
            const longsword = getItemPreset('longsword');
            expect(longsword).not.toBeNull();
            expect(longsword?.name).toBe('Longsword');
            expect(longsword?.type).toBe('weapon');
        });

        it('retrieves armor by name', () => {
            const chainmail = getItemPreset('chain_mail');
            expect(chainmail).not.toBeNull();
            expect(chainmail?.name).toBe('Chain Mail');
            expect(chainmail?.type).toBe('armor');
        });

        it('retrieves gear by name', () => {
            const rope = getItemPreset('rope_hempen_50_feet');
            expect(rope).not.toBeNull();
            expect(rope?.type).toBe('gear');
        });

        it('retrieves magic items by name', () => {
            const bag = getItemPreset('bag_of_holding');
            expect(bag).not.toBeNull();
            expect(bag?.type).toBe('magic');
        });

        it('handles case-insensitive lookups', () => {
            expect(getItemPreset('LONGSWORD')).not.toBeNull();
            expect(getItemPreset('LongSword')).not.toBeNull();
        });

        it('handles spaces and underscores interchangeably', () => {
            expect(getItemPreset('studded leather')).not.toBeNull();
            expect(getItemPreset('studded_leather')).not.toBeNull();
        });

        it('returns null for unknown items', () => {
            expect(getItemPreset('nonexistent_item')).toBeNull();
        });
    });

    describe('typed getters', () => {
        it('getWeaponPreset returns only weapons', () => {
            const weapon = getWeaponPreset('longsword');
            expect(weapon).not.toBeNull();
            expect(weapon?.type).toBe('weapon');
            expect(weapon?.damage).toBe('1d8');
            expect(weapon?.damageType).toBe('slashing');
        });

        it('getArmorPreset returns only armor', () => {
            const armor = getArmorPreset('plate');
            expect(armor).not.toBeNull();
            expect(armor?.type).toBe('armor');
            expect(armor?.ac).toBe(18);
        });

        it('getMagicItemPreset returns only magic items', () => {
            const magic = getMagicItemPreset('bag_of_holding');
            expect(magic).not.toBeNull();
            expect(magic?.type).toBe('magic');
            expect(magic?.rarity).toBe('uncommon');
        });

        it('typed getters return null for wrong types', () => {
            expect(getWeaponPreset('chain_mail')).toBeNull();
            expect(getArmorPreset('longsword')).toBeNull();
        });
    });

    describe('searchItems', () => {
        it('searches by type', () => {
            const weapons = searchItems({ type: 'weapon' });
            expect(weapons.length).toBeGreaterThan(30);
            expect(weapons.every(r => r.preset.type === 'weapon')).toBe(true);
        });

        it('searches by tags', () => {
            const finesseWeapons = searchItems({ type: 'weapon', tags: ['finesse'] });
            expect(finesseWeapons.length).toBeGreaterThan(0);
            expect(finesseWeapons.some(r => r.preset.name === 'Rapier')).toBe(true);
        });

        it('searches by text query', () => {
            const results = searchItems({ query: 'sword' });
            expect(results.length).toBeGreaterThan(0);
            expect(results.some(r => r.preset.name.toLowerCase().includes('sword'))).toBe(true);
        });

        it('filters by value range', () => {
            const expensive = searchItems({ type: 'armor', minValue: 500 });
            expect(expensive.length).toBeGreaterThan(0);
            expect(expensive.every(r => (r.preset as any).value >= 500)).toBe(true);
        });
    });

    describe('listItemsByType', () => {
        it('lists all weapons', () => {
            const weapons = listItemsByType('weapon');
            expect(weapons.length).toBeGreaterThan(30);
        });

        it('lists all armor', () => {
            const armor = listItemsByType('armor');
            expect(armor.length).toBeGreaterThanOrEqual(13); // 12 armor types + shield
        });

        it('lists all magic items', () => {
            const magic = listItemsByType('magic');
            expect(magic.length).toBeGreaterThan(0);
        });
    });

    describe('listItemsByTag', () => {
        it('lists items by tag', () => {
            const martialWeapons = listItemsByTag('martial');
            expect(martialWeapons.length).toBeGreaterThan(10);
        });
    });

    describe('registry statistics', () => {
        it('reports total items and breakdown', () => {
            const stats = getRegistryStats();
            expect(stats.totalItems).toBeGreaterThan(100);
            expect(stats.byType.weapon).toBeGreaterThan(30);
            expect(stats.byType.armor).toBeGreaterThanOrEqual(13);
            expect(stats.sources.length).toBe(4);
        });

        it('lists all available keys', () => {
            const keys = listAllItemKeys();
            expect(keys.length).toBeGreaterThan(100);
            expect(keys).toContain('longsword');
        });

        it('lists all available tags', () => {
            const tags = listAllTags();
            expect(tags.length).toBeGreaterThan(20);
            expect(tags).toContain('finesse');
            expect(tags).toContain('martial');
        });
    });
});
