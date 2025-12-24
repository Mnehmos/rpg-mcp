/**
 * PHASE-2: Social Hearing Mechanics Tests
 *
 * Tests the spatial-aware social interaction system including:
 * - Hearing range calculations based on volume and environment
 * - Stealth vs Perception opposed rolls for eavesdropping
 * - Conversation memory recording for listeners
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { CharacterRepository } from '../src/storage/repos/character.repo.js';
import { SpatialRepository } from '../src/storage/repos/spatial.repo.js';
import { NpcMemoryRepository } from '../src/storage/repos/npc-memory.repo.js';
import { handleInteractSocially } from '../src/server/npc-memory-tools.js';
import { calculateHearingRadius } from '../src/engine/social/hearing.js';
import { rollStealthVsPerception, getModifier } from '../src/engine/social/stealth-perception.js';
import { Character } from '../src/schema/character.js';
import { RoomNode } from '../src/schema/spatial.js';
import { closeDb, getDb } from '../src/storage/index.js';

const mockCtx = { sessionId: 'test-session' };

describe('PHASE-2: Social Hearing Mechanics', () => {
    let db: Database.Database;
    let charRepo: CharacterRepository;
    let spatialRepo: SpatialRepository;
    let memoryRepo: NpcMemoryRepository;

    beforeEach(() => {
        closeDb();
        db = getDb(':memory:');
        charRepo = new CharacterRepository(db);
        spatialRepo = new SpatialRepository(db);
        memoryRepo = new NpcMemoryRepository(db);
    });

    // Helper: Create a test character
    function createChar(overrides: Partial<Character> = {}): Character {
        const now = new Date().toISOString();
        const char: Character = {
            id: uuidv4(),
            name: overrides.name || 'Test Character',
            stats: overrides.stats || { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
            hp: 20,
            maxHp: 20,
            ac: 10,
            level: 1,
            characterType: 'pc',
            perceptionBonus: overrides.perceptionBonus || 0,
            stealthBonus: overrides.stealthBonus || 0,
            characterClass: 'fighter',
            knownSpells: [],
            preparedSpells: [],
            cantripsKnown: [],
            maxSpellLevel: 0,
            concentratingOn: null,
            activeSpells: [],
            conditions: overrides.conditions || [],
            currentRoomId: overrides.currentRoomId,
            createdAt: now,
            updatedAt: now,
            ...overrides
        };
        charRepo.create(char);
        return char;
    }

    // Helper: Create a test room
    function createRoom(overrides: Partial<RoomNode> = {}): RoomNode {
        const now = new Date().toISOString();
        const room: RoomNode = {
            id: uuidv4(),
            name: overrides.name || 'Test Room',
            baseDescription: overrides.baseDescription || 'A simple test room for testing purposes.',
            biomeContext: overrides.biomeContext || 'urban',
            atmospherics: overrides.atmospherics || [],
            exits: [],
            entityIds: overrides.entityIds || [],
            createdAt: now,
            updatedAt: now,
            visitedCount: 0,
            ...overrides
        };
        spatialRepo.create(room);
        return room;
    }

    describe('Category 1: Hearing Radius Calculations', () => {
        it('1.1: Whisper has short range in urban environment (5 feet)', () => {
            const radius = calculateHearingRadius({
                volume: 'WHISPER',
                biomeContext: 'urban',
                atmospherics: []
            });
            expect(radius).toBe(5);
        });

        it('1.2: Talk has moderate range in urban environment (15 feet)', () => {
            const radius = calculateHearingRadius({
                volume: 'TALK',
                biomeContext: 'urban',
                atmospherics: []
            });
            expect(radius).toBe(15);
        });

        it('1.3: Shout has long range in urban environment (40 feet)', () => {
            const radius = calculateHearingRadius({
                volume: 'SHOUT',
                biomeContext: 'urban',
                atmospherics: []
            });
            expect(radius).toBe(40);
        });

        it('1.4: Forest environment increases hearing ranges', () => {
            const whisper = calculateHearingRadius({ volume: 'WHISPER', biomeContext: 'forest', atmospherics: [] });
            const talk = calculateHearingRadius({ volume: 'TALK', biomeContext: 'forest', atmospherics: [] });
            const shout = calculateHearingRadius({ volume: 'SHOUT', biomeContext: 'forest', atmospherics: [] });

            expect(whisper).toBe(10);  // Quiet forest
            expect(talk).toBe(60);     // Sound carries well
            expect(shout).toBe(300);   // Echo through trees
        });

        it('1.5: Mountain environment has longest ranges', () => {
            const whisper = calculateHearingRadius({ volume: 'WHISPER', biomeContext: 'mountain', atmospherics: [] });
            const talk = calculateHearingRadius({ volume: 'TALK', biomeContext: 'mountain', atmospherics: [] });
            const shout = calculateHearingRadius({ volume: 'SHOUT', biomeContext: 'mountain', atmospherics: [] });

            expect(whisper).toBe(15);  // Thin air
            expect(talk).toBe(100);    // Wide open
            expect(shout).toBe(500);   // Mountain echo
        });

        it('1.6: SILENCE atmosphere reduces hearing range by 50%', () => {
            const normalTalk = calculateHearingRadius({ volume: 'TALK', biomeContext: 'urban', atmospherics: [] });
            const silencedTalk = calculateHearingRadius({ volume: 'TALK', biomeContext: 'urban', atmospherics: ['SILENCE'] });

            expect(silencedTalk).toBe(Math.floor(normalTalk * 0.5));
        });

        it('1.7: DARKNESS does not affect hearing', () => {
            const normalTalk = calculateHearingRadius({ volume: 'TALK', biomeContext: 'urban', atmospherics: [] });
            const darkTalk = calculateHearingRadius({ volume: 'TALK', biomeContext: 'urban', atmospherics: ['DARKNESS'] });

            expect(darkTalk).toBe(normalTalk);
        });
    });

    describe('Category 2: Stealth vs Perception Opposed Rolls', () => {
        it('2.1: Ability modifier calculation follows D&D 5e formula', () => {
            expect(getModifier(10)).toBe(0);   // 10 = +0
            expect(getModifier(12)).toBe(1);   // 12 = +1
            expect(getModifier(14)).toBe(2);   // 14 = +2
            expect(getModifier(8)).toBe(-1);   // 8 = -1
            expect(getModifier(20)).toBe(5);   // 20 = +5
        });

        it('2.2: Opposed roll includes ability modifiers and bonuses', () => {
            const speaker = createChar({ stats: { str: 10, dex: 16, con: 10, int: 10, wis: 10, cha: 10 }, stealthBonus: 2 });
            const listener = createChar({ stats: { str: 10, dex: 10, con: 10, int: 10, wis: 14, cha: 10 }, perceptionBonus: 3 });

            const result = rollStealthVsPerception(speaker, listener, 0);

            // Speaker: DEX 16 (+3) + stealthBonus 2 = +5
            expect(result.speakerModifier).toBe(5);
            // Listener: WIS 14 (+2) + perceptionBonus 3 = +5
            expect(result.listenerModifier).toBe(5);
        });

        it('2.3: High perception beats low stealth (statistical)', () => {
            const lowStealthSpeaker = createChar({
                name: 'Clumsy Speaker',
                stats: { str: 10, dex: 8, con: 10, int: 10, wis: 10, cha: 10 },
                stealthBonus: 0
            });
            const highPerceptionListener = createChar({
                name: 'Alert Listener',
                stats: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 },
                perceptionBonus: 5
            });

            let successCount = 0;
            const trials = 100;

            for (let i = 0; i < trials; i++) {
                const result = rollStealthVsPerception(lowStealthSpeaker, highPerceptionListener, 0);
                if (result.success) successCount++;
            }

            // High perception should overhear most of the time (>60%)
            expect(successCount).toBeGreaterThan(60);
        });

        it('2.4: Low perception fails against average stealth (statistical)', () => {
            const avgStealthSpeaker = createChar({
                name: 'Average Speaker',
                stats: { str: 10, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
                stealthBonus: 2
            });
            const lowPerceptionListener = createChar({
                name: 'Oblivious Listener',
                stats: { str: 10, dex: 10, con: 10, int: 10, wis: 8, cha: 10 },
                perceptionBonus: 0
            });

            let successCount = 0;
            const trials = 100;

            for (let i = 0; i < trials; i++) {
                const result = rollStealthVsPerception(avgStealthSpeaker, lowPerceptionListener, 0);
                if (result.success) successCount++;
            }

            // Low perception should fail to overhear most of the time (<40%)
            expect(successCount).toBeLessThan(40);
        });

        it('2.5: Environment modifier affects listener perception', () => {
            const speaker = createChar({ stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, stealthBonus: 0 });
            const listener = createChar({ stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 }, perceptionBonus: 0 });

            const normalResult = rollStealthVsPerception(speaker, listener, 0);
            const bonusResult = rollStealthVsPerception(speaker, listener, 5); // +5 from SILENCE

            expect(bonusResult.listenerModifier).toBe(normalResult.listenerModifier + 5);
        });
    });

    describe('Category 3: interact_socially Tool - Basic Functionality', () => {
        it('3.1: Target always hears full conversation', async () => {
            const room = createRoom({ name: 'Tavern', biomeContext: 'urban' });
            const speaker = createChar({ name: 'Rogue', currentRoomId: room.id });
            const target = createChar({ name: 'Wizard', currentRoomId: room.id });

            // Add characters to room
            spatialRepo.update(room.id, { entityIds: [speaker.id, target.id] });

            const result = await handleInteractSocially({
                speakerId: speaker.id,
                targetId: target.id,
                content: 'I found the secret passage',
                volume: 'WHISPER',
                intent: 'sharing information'
            }, mockCtx);

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(true);
            expect(data.target.id).toBe(target.id);
            expect(data.target.heard).toBe(true);

            // Check memory was recorded for target
            const targetMemories = memoryRepo.getConversationHistory(target.id, speaker.id);
            expect(targetMemories.length).toBe(1);
            expect(targetMemories[0].summary).toContain('I found the secret passage');
        });

        it('3.2: Eavesdropper gets partial "overheard" memory (successful perception)', async () => {
            const room = createRoom({ name: 'Tavern', biomeContext: 'urban' });
            const speaker = createChar({
                name: 'Rogue',
                currentRoomId: room.id,
                stats: { str: 10, dex: 8, con: 10, int: 10, wis: 10, cha: 10 }, // Low DEX
                stealthBonus: 0
            });
            const target = createChar({ name: 'Wizard', currentRoomId: room.id });
            const eavesdropper = createChar({
                name: 'Bard',
                currentRoomId: room.id,
                stats: { str: 10, dex: 10, con: 10, int: 10, wis: 18, cha: 10 }, // High WIS
                perceptionBonus: 5
            });

            spatialRepo.update(room.id, { entityIds: [speaker.id, target.id, eavesdropper.id] });

            // Run multiple times to ensure we get at least one successful eavesdrop
            let successfulEavesdrop = false;
            for (let i = 0; i < 20; i++) {
                const result = await handleInteractSocially({
                    speakerId: speaker.id,
                    targetId: target.id,
                    content: 'The password is swordfish',
                    volume: 'WHISPER',
                    intent: 'sharing secret'
                }, mockCtx);

                const data = JSON.parse(result.content[0].text);
                const eavesdropperResult = data.listeners.find((l: any) => l.listenerId === eavesdropper.id);

                if (eavesdropperResult?.opposedRoll?.success) {
                    successfulEavesdrop = true;

                    // Check eavesdropper memory
                    const memories = memoryRepo.getConversationHistory(eavesdropper.id, speaker.id);
                    const latestMemory = memories[memories.length - 1];
                    expect(latestMemory.summary).toContain('Overheard');
                    expect(latestMemory.summary).not.toContain('swordfish'); // Should NOT contain actual password
                    expect(latestMemory.topics).toContain('eavesdropped');
                    break;
                }

                // Clean up memories for next attempt
                db.prepare('DELETE FROM conversation_memories').run();
            }

            expect(successfulEavesdrop).toBe(true); // Should have succeeded at least once
        });

        it('3.3: Failed perception check = no memory recorded', async () => {
            const room = createRoom({ name: 'Tavern', biomeContext: 'urban' });
            const speaker = createChar({
                name: 'Rogue',
                currentRoomId: room.id,
                stats: { str: 10, dex: 18, con: 10, int: 10, wis: 10, cha: 10 }, // High DEX
                stealthBonus: 5
            });
            const target = createChar({ name: 'Wizard', currentRoomId: room.id });
            const eavesdropper = createChar({
                name: 'Barbarian',
                currentRoomId: room.id,
                stats: { str: 10, dex: 10, con: 10, int: 10, wis: 8, cha: 10 }, // Low WIS
                perceptionBonus: 0
            });

            spatialRepo.update(room.id, { entityIds: [speaker.id, target.id, eavesdropper.id] });

            // Run multiple times to check for failures
            let failedAttempts = 0;
            for (let i = 0; i < 20; i++) {
                const result = await handleInteractSocially({
                    speakerId: speaker.id,
                    targetId: target.id,
                    content: 'Secret plans',
                    volume: 'WHISPER',
                    intent: 'conspiracy'
                }, mockCtx);

                const data = JSON.parse(result.content[0].text);
                const eavesdropperResult = data.listeners.find((l: any) => l.listenerId === eavesdropper.id);

                if (!eavesdropperResult?.opposedRoll?.success) {
                    failedAttempts++;
                }
            }

            // With high stealth vs low perception, most attempts should fail
            expect(failedAttempts).toBeGreaterThan(10);

            // Check that barbarian has fewer memories than the number of whispers
            const barbarianMemories = memoryRepo.getConversationHistory(eavesdropper.id, speaker.id);
            expect(barbarianMemories.length).toBeLessThan(20);
        });

        it('3.4: Shout broadcasts to everyone in room', async () => {
            const room = createRoom({ name: 'Town Square', biomeContext: 'urban' });
            const speaker = createChar({ name: 'Herald', currentRoomId: room.id });
            const listener1 = createChar({ name: 'Citizen 1', currentRoomId: room.id });
            const listener2 = createChar({ name: 'Citizen 2', currentRoomId: room.id });
            const listener3 = createChar({ name: 'Citizen 3', currentRoomId: room.id });

            spatialRepo.update(room.id, { entityIds: [speaker.id, listener1.id, listener2.id, listener3.id] });

            const result = await handleInteractSocially({
                speakerId: speaker.id,
                content: 'Hear ye, hear ye!',
                volume: 'SHOUT'
            }, mockCtx);

            const data = JSON.parse(result.content[0].text);
            expect(data.success).toBe(true);
            expect(data.totalListeners).toBe(3); // All 3 citizens
        });

        it('3.5: Deafened character cannot hear', async () => {
            const room = createRoom({ name: 'Tavern', biomeContext: 'urban' });
            const speaker = createChar({ name: 'Bard', currentRoomId: room.id });
            const deafListener = createChar({
                name: 'Deafened Guard',
                currentRoomId: room.id,
                conditions: [{ name: 'DEAFENED' }]
            });

            spatialRepo.update(room.id, { entityIds: [speaker.id, deafListener.id] });

            const result = await handleInteractSocially({
                speakerId: speaker.id,
                content: 'Can you hear me?',
                volume: 'TALK'
            }, mockCtx);

            const data = JSON.parse(result.content[0].text);

            // Deafened character should not be in listeners list
            const deafResult = data.listeners.find((l: any) => l.listenerId === deafListener.id);
            expect(deafResult).toBeUndefined();
        });

        it('3.6: Broadcast (no target) still performs opposed rolls', async () => {
            const room = createRoom({ name: 'Marketplace', biomeContext: 'urban' });
            const speaker = createChar({
                name: 'Merchant',
                currentRoomId: room.id,
                stats: { str: 10, dex: 12, con: 10, int: 10, wis: 10, cha: 10 }
            });
            const listener = createChar({
                name: 'Customer',
                currentRoomId: room.id,
                stats: { str: 10, dex: 10, con: 10, int: 10, wis: 12, cha: 10 }
            });

            spatialRepo.update(room.id, { entityIds: [speaker.id, listener.id] });

            const result = await handleInteractSocially({
                speakerId: speaker.id,
                content: 'Fresh fish for sale!',
                volume: 'TALK'
            }, mockCtx);

            const data = JSON.parse(result.content[0].text);
            expect(data.target).toBeNull(); // No specific target
            expect(data.listeners.length).toBe(1);
            expect(data.listeners[0].opposedRoll).toBeDefined(); // Opposed roll still happened
        });

        it('3.7: SILENCE atmosphere increases perception chances', async () => {
            const silentRoom = createRoom({
                name: 'Silent Temple',
                biomeContext: 'divine',
                atmospherics: ['SILENCE']
            });
            const speaker = createChar({
                name: 'Priest',
                currentRoomId: silentRoom.id,
                stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
                stealthBonus: 0
            });
            const listener = createChar({
                name: 'Monk',
                currentRoomId: silentRoom.id,
                stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
                perceptionBonus: 0
            });

            spatialRepo.update(silentRoom.id, { entityIds: [speaker.id, listener.id] });

            let successCount = 0;
            const trials = 20;

            for (let i = 0; i < trials; i++) {
                const result = await handleInteractSocially({
                    speakerId: speaker.id,
                    content: 'Whispered prayer',
                    volume: 'WHISPER'
                }, mockCtx);

                const data = JSON.parse(result.content[0].text);
                const listenerResult = data.listeners.find((l: any) => l.listenerId === listener.id);
                if (listenerResult?.opposedRoll?.success) {
                    successCount++;
                }

                // Clean up
                db.prepare('DELETE FROM conversation_memories').run();
            }

            // SILENCE gives +5 modifier, so success rate should be higher than 50%
            expect(successCount).toBeGreaterThan(10);
        });
    });

    describe('Category 4: Error Handling', () => {
        it('4.1: Throws error if speaker not found', async () => {
            await expect(handleInteractSocially({
                speakerId: uuidv4(),
                content: 'Hello',
                volume: 'TALK'
            }, {} as any)).rejects.toThrow('Speaker with ID');
        });

        it('4.2: Throws error if speaker not in a room', async () => {
            const speaker = createChar({ name: 'Lost Soul' }); // No currentRoomId

            await expect(handleInteractSocially({
                speakerId: speaker.id,
                content: 'Hello',
                volume: 'TALK'
            }, {} as any)).rejects.toThrow('not in any room');
        });

        it('4.3: Throws error if target not found', async () => {
            const room = createRoom({ name: 'Tavern' });
            const speaker = createChar({ name: 'Bard', currentRoomId: room.id });

            await expect(handleInteractSocially({
                speakerId: speaker.id,
                targetId: uuidv4(),
                content: 'Hello',
                volume: 'TALK'
            }, {} as any)).rejects.toThrow('Target with ID');
        });

        it('4.4: Throws error if room not found (corrupted data)', async () => {
            // Create character, then manually update with invalid roomId to bypass FK constraint
            const speaker = createChar({ name: 'Glitched' });
            const fakeRoomId = uuidv4();

            // Temporarily disable foreign keys to simulate corrupted data
            db.prepare('PRAGMA foreign_keys = OFF').run();
            db.prepare('UPDATE characters SET current_room_id = ? WHERE id = ?')
                .run(fakeRoomId, speaker.id);
            db.prepare('PRAGMA foreign_keys = ON').run();

            await expect(handleInteractSocially({
                speakerId: speaker.id,
                content: 'Hello',
                volume: 'TALK'
            }, mockCtx)).rejects.toThrow('Room');
        });
    });

    describe('Category 5: Integration with Phase 1 Spatial System', () => {
        it('5.1: Uses room biome for hearing range calculation', async () => {
            const forestRoom = createRoom({
                name: 'Forest Clearing',
                biomeContext: 'forest',
                atmospherics: []
            });
            const speaker = createChar({ name: 'Ranger', currentRoomId: forestRoom.id });

            spatialRepo.update(forestRoom.id, { entityIds: [speaker.id] });

            const result = await handleInteractSocially({
                speakerId: speaker.id,
                content: 'Testing',
                volume: 'TALK'
            }, mockCtx);

            const data = JSON.parse(result.content[0].text);
            expect(data.room.biome).toBe('forest');
            expect(data.hearingRadius).toBe(60); // Forest TALK range
        });

        it('5.2: Uses room atmospherics for environment modifiers', async () => {
            const silentCavern = createRoom({
                name: 'Silent Cavern',
                biomeContext: 'cavern',
                atmospherics: ['SILENCE']
            });
            const speaker = createChar({ name: 'Explorer', currentRoomId: silentCavern.id });

            spatialRepo.update(silentCavern.id, { entityIds: [speaker.id] });

            const result = await handleInteractSocially({
                speakerId: speaker.id,
                content: 'Echo test',
                volume: 'SHOUT'
            }, mockCtx);

            const data = JSON.parse(result.content[0].text);
            expect(data.room.atmospherics).toContain('SILENCE');
            // SILENCE reduces hearing by 50%: cavern SHOUT = 400, with SILENCE = 200
            expect(data.hearingRadius).toBe(200);
        });

        it('5.3: Only processes characters in same room', async () => {
            const tavern = createRoom({ name: 'Tavern', biomeContext: 'urban' });
            const street = createRoom({ name: 'Street', biomeContext: 'urban' });

            const speaker = createChar({ name: 'Bartender', currentRoomId: tavern.id });
            const inRoom = createChar({ name: 'Patron', currentRoomId: tavern.id });
            const outsideRoom = createChar({ name: 'Passerby', currentRoomId: street.id });

            spatialRepo.update(tavern.id, { entityIds: [speaker.id, inRoom.id] });
            spatialRepo.update(street.id, { entityIds: [outsideRoom.id] });

            const result = await handleInteractSocially({
                speakerId: speaker.id,
                content: 'Last call!',
                volume: 'SHOUT'
            }, mockCtx);

            const data = JSON.parse(result.content[0].text);

            // Only the patron in the same room should be processed
            expect(data.totalListeners).toBe(1);
            expect(data.listeners[0].listenerId).toBe(inRoom.id);
        });
    });

    describe('Category 6: Memory Content Verification', () => {
        it('6.1: Target memory contains full content', async () => {
            const room = createRoom({ name: 'Library', biomeContext: 'urban' });
            const speaker = createChar({ name: 'Scholar', currentRoomId: room.id });
            const target = createChar({ name: 'Student', currentRoomId: room.id });

            spatialRepo.update(room.id, { entityIds: [speaker.id, target.id] });

            await handleInteractSocially({
                speakerId: speaker.id,
                targetId: target.id,
                content: 'The ancient text mentions a dragon',
                volume: 'TALK',
                intent: 'teaching'
            }, mockCtx);

            const memories = memoryRepo.getConversationHistory(target.id, speaker.id);
            expect(memories.length).toBe(1);
            expect(memories[0].summary).toContain('The ancient text mentions a dragon');
            expect(memories[0].summary).toContain('Scholar');
            expect(memories[0].topics).toContain('teaching');
        });

        it('6.2: Eavesdropper memory is generic (no exact content)', async () => {
            const room = createRoom({ name: 'Tavern', biomeContext: 'urban' });
            const speaker = createChar({
                name: 'Rogue',
                currentRoomId: room.id,
                stats: { str: 10, dex: 8, con: 10, int: 10, wis: 10, cha: 10 },
                stealthBonus: 0
            });
            const target = createChar({ name: 'Fence', currentRoomId: room.id });
            const eavesdropper = createChar({
                name: 'Guard',
                currentRoomId: room.id,
                stats: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
                perceptionBonus: 3
            });

            spatialRepo.update(room.id, { entityIds: [speaker.id, target.id, eavesdropper.id] });

            // Try multiple times to get a successful eavesdrop
            for (let i = 0; i < 20; i++) {
                await handleInteractSocially({
                    speakerId: speaker.id,
                    targetId: target.id,
                    content: 'I can get you the royal jewels for 500 gold',
                    volume: 'WHISPER',
                    intent: 'negotiating theft'
                }, mockCtx);
            }

            const guardMemories = memoryRepo.getConversationHistory(eavesdropper.id, speaker.id);

            if (guardMemories.length > 0) {
                const memory = guardMemories[0];
                expect(memory.summary).toContain('Overheard');
                expect(memory.summary).not.toContain('royal jewels');
                expect(memory.summary).not.toContain('500 gold');
                expect(memory.topics).toContain('eavesdropped');
            }
        });

        it('6.3: Shout creates high importance memory for target', async () => {
            const room = createRoom({ name: 'Battlefield', biomeContext: 'dungeon' });
            const speaker = createChar({ name: 'Commander', currentRoomId: room.id });
            const target = createChar({ name: 'Soldier', currentRoomId: room.id });

            spatialRepo.update(room.id, { entityIds: [speaker.id, target.id] });

            await handleInteractSocially({
                speakerId: speaker.id,
                targetId: target.id,
                content: 'Retreat immediately!',
                volume: 'SHOUT',
                intent: 'command'
            }, mockCtx);

            const memories = memoryRepo.getConversationHistory(target.id, speaker.id);
            expect(memories.length).toBe(1);
            expect(memories[0].importance).toBe('high'); // SHOUT = high importance
        });

        it('6.4: Whisper creates medium importance memory for target', async () => {
            const room = createRoom({ name: 'Palace', biomeContext: 'urban' });
            const speaker = createChar({ name: 'Spy', currentRoomId: room.id });
            const target = createChar({ name: 'Assassin', currentRoomId: room.id });

            spatialRepo.update(room.id, { entityIds: [speaker.id, target.id] });

            await handleInteractSocially({
                speakerId: speaker.id,
                targetId: target.id,
                content: 'The target sleeps at midnight',
                volume: 'WHISPER',
                intent: 'conspiracy'
            }, mockCtx);

            const memories = memoryRepo.getConversationHistory(target.id, speaker.id);
            expect(memories.length).toBe(1);
            expect(memories[0].importance).toBe('medium'); // WHISPER = medium importance
        });
    });
});
