import {
    ENCOUNTER_PRESETS,
    getEncounterPreset,
    listEncounterPresets,
    getEncountersByDifficulty,
    getEncountersByTag,
    getEncountersForLevel,
    scaleEncounter,
    getRandomEncounter,
} from '../../src/data/encounter-presets';
import { getCreaturePreset, expandCreatureTemplate } from '../../src/data/creature-presets';

describe('encounter-presets', () => {
    describe('ENCOUNTER_PRESETS', () => {
        it('should have multiple presets defined', () => {
            const presetCount = Object.keys(ENCOUNTER_PRESETS).length;
            expect(presetCount).toBeGreaterThan(15);
        });

        it('all presets should have required fields', () => {
            for (const [id, preset] of Object.entries(ENCOUNTER_PRESETS)) {
                expect(preset.id).toBe(id);
                expect(preset.name).toBeTruthy();
                expect(preset.description).toBeTruthy();
                expect(['easy', 'medium', 'hard', 'deadly']).toContain(preset.difficulty);
                expect(preset.recommendedLevel.min).toBeGreaterThanOrEqual(1);
                expect(preset.recommendedLevel.max).toBeLessThanOrEqual(20);
                expect(preset.recommendedLevel.min).toBeLessThanOrEqual(preset.recommendedLevel.max);
                expect(preset.participants.length).toBeGreaterThan(0);
                expect(preset.tags.length).toBeGreaterThan(0);
            }
        });

        it('all participant templates should reference valid creature presets', () => {
            for (const preset of Object.values(ENCOUNTER_PRESETS)) {
                for (const participant of preset.participants) {
                    const expanded = expandCreatureTemplate(participant.template);
                    expect(expanded, `Invalid template: ${participant.template} in ${preset.id}`).not.toBeNull();
                }
            }
        });

        it('all participant positions should be valid format', () => {
            const positionRegex = /^\d+,\d+$/;
            for (const preset of Object.values(ENCOUNTER_PRESETS)) {
                for (const participant of preset.participants) {
                    expect(
                        participant.position,
                        `Invalid position format in ${preset.id}`
                    ).toMatch(positionRegex);
                }
            }
        });

        it('party positions should be valid format when present', () => {
            const positionRegex = /^\d+,\d+$/;
            for (const preset of Object.values(ENCOUNTER_PRESETS)) {
                if (preset.partyPositions) {
                    for (const pos of preset.partyPositions) {
                        expect(pos, `Invalid party position in ${preset.id}`).toMatch(positionRegex);
                    }
                }
            }
        });
    });

    describe('getEncounterPreset', () => {
        it('should return preset by exact ID', () => {
            const preset = getEncounterPreset('goblin_ambush');
            expect(preset).not.toBeNull();
            expect(preset?.name).toBe('Goblin Ambush');
        });

        it('should normalize spaces and hyphens', () => {
            const preset1 = getEncounterPreset('goblin-ambush');
            const preset2 = getEncounterPreset('goblin ambush');
            expect(preset1).not.toBeNull();
            expect(preset2).not.toBeNull();
            expect(preset1?.id).toBe(preset2?.id);
        });

        it('should return null for unknown preset', () => {
            const preset = getEncounterPreset('nonexistent_encounter');
            expect(preset).toBeNull();
        });
    });

    describe('listEncounterPresets', () => {
        it('should return array of preset IDs', () => {
            const presets = listEncounterPresets();
            expect(presets).toContain('goblin_ambush');
            expect(presets).toContain('tavern_brawl');
            expect(presets).toContain('dragon_wyrmling_lair');
        });
    });

    describe('getEncountersByDifficulty', () => {
        it('should filter by easy difficulty', () => {
            const easy = getEncountersByDifficulty('easy');
            expect(easy.length).toBeGreaterThan(0);
            expect(easy.every(e => e.difficulty === 'easy')).toBe(true);
        });

        it('should filter by deadly difficulty', () => {
            const deadly = getEncountersByDifficulty('deadly');
            expect(deadly.length).toBeGreaterThan(0);
            expect(deadly.every(e => e.difficulty === 'deadly')).toBe(true);
        });
    });

    describe('getEncountersByTag', () => {
        it('should filter by goblin tag', () => {
            const goblin = getEncountersByTag('goblin');
            expect(goblin.length).toBeGreaterThan(0);
            expect(goblin.every(e => e.tags.includes('goblin'))).toBe(true);
        });

        it('should filter by undead tag', () => {
            const undead = getEncountersByTag('undead');
            expect(undead.length).toBeGreaterThan(0);
        });

        it('should be case insensitive', () => {
            const upper = getEncountersByTag('GOBLIN');
            const lower = getEncountersByTag('goblin');
            expect(upper.length).toBe(lower.length);
        });
    });

    describe('getEncountersForLevel', () => {
        it('should return encounters for level 1', () => {
            const level1 = getEncountersForLevel(1);
            expect(level1.length).toBeGreaterThan(0);
            expect(level1.every(e => e.recommendedLevel.min <= 1 && e.recommendedLevel.max >= 1)).toBe(true);
        });

        it('should return encounters for level 5', () => {
            const level5 = getEncountersForLevel(5);
            expect(level5.length).toBeGreaterThan(0);
        });

        it('should return fewer encounters for very high levels', () => {
            const level15 = getEncountersForLevel(15);
            const level1 = getEncountersForLevel(1);
            // Most presets are for lower levels
            expect(level15.length).toBeLessThanOrEqual(level1.length);
        });
    });

    describe('scaleEncounter', () => {
        it('should not modify original preset', () => {
            const original = getEncounterPreset('goblin_ambush')!;
            const originalCount = original.participants.length;

            const scaled = scaleEncounter(original, 3, 6);

            expect(original.participants.length).toBe(originalCount);
            expect(scaled).not.toBe(original);
        });

        it('should add minions for larger parties', () => {
            const preset = getEncounterPreset('goblin_ambush')!;
            const scaled = scaleEncounter(preset, 3, 6); // 6 players instead of 4

            expect(scaled.participants.length).toBeGreaterThan(preset.participants.length);
        });

        it('should not add minions for 4-player party', () => {
            const preset = getEncounterPreset('goblin_ambush')!;
            const scaled = scaleEncounter(preset, 3, 4);

            expect(scaled.participants.length).toBe(preset.participants.length);
        });

        it('should not scale boss creatures', () => {
            const preset = getEncounterPreset('goblin_lair')!;
            const bossCount = preset.participants.filter(p => p.template.includes('boss')).length;

            const scaled = scaleEncounter(preset, 3, 8);
            const scaledBossCount = scaled.participants.filter(p => p.template.includes('boss')).length;

            expect(scaledBossCount).toBe(bossCount);
        });
    });

    describe('getRandomEncounter', () => {
        it('should return a preset when no options provided', () => {
            const encounter = getRandomEncounter();
            expect(encounter).not.toBeNull();
        });

        it('should filter by difficulty', () => {
            const encounter = getRandomEncounter({ difficulty: 'easy' });
            expect(encounter).not.toBeNull();
            expect(encounter?.difficulty).toBe('easy');
        });

        it('should filter by level', () => {
            const encounter = getRandomEncounter({ level: 1 });
            expect(encounter).not.toBeNull();
            if (encounter) {
                expect(encounter.recommendedLevel.min).toBeLessThanOrEqual(1);
                expect(encounter.recommendedLevel.max).toBeGreaterThanOrEqual(1);
            }
        });

        it('should filter by tag', () => {
            const encounter = getRandomEncounter({ tags: ['undead'] });
            expect(encounter).not.toBeNull();
            expect(encounter?.tags.some(t => t.toLowerCase() === 'undead')).toBe(true);
        });

        it('should return null when no matches', () => {
            const encounter = getRandomEncounter({
                difficulty: 'deadly',
                level: 20,
                tags: ['nonexistent-tag-12345']
            });
            expect(encounter).toBeNull();
        });
    });

    describe('specific encounters', () => {
        it('goblin_ambush should have archers in back', () => {
            const preset = getEncounterPreset('goblin_ambush')!;
            const archers = preset.participants.filter(p => p.template.includes('archer'));
            const warriors = preset.participants.filter(p => p.template.includes('warrior'));

            expect(archers.length).toBeGreaterThan(0);
            expect(warriors.length).toBeGreaterThan(0);

            // Archers should have lower Y (further back)
            const archerY = archers.map(a => parseInt(a.position.split(',')[1]));
            const warriorY = warriors.map(w => parseInt(w.position.split(',')[1]));

            expect(Math.min(...archerY)).toBeLessThan(Math.max(...warriorY));
        });

        it('tavern_brawl should have tables as obstacles', () => {
            const preset = getEncounterPreset('tavern_brawl')!;
            expect(preset.terrain?.obstacles?.length).toBeGreaterThan(0);
            expect(preset.tags).toContain('tavern');
        });

        it('troll_bridge should have water terrain', () => {
            const preset = getEncounterPreset('troll_bridge')!;
            expect(preset.terrain?.water?.length).toBeGreaterThan(0);
            expect(preset.participants.length).toBe(1); // Solo troll
        });

        it('dragon_wyrmling_lair should be deadly difficulty', () => {
            const preset = getEncounterPreset('dragon_wyrmling_lair')!;
            expect(preset.difficulty).toBe('deadly');
            expect(preset.tags).toContain('dragon');
        });
    });
});
