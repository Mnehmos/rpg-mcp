/**
 * Position Persistence Tests (Phase 1)
 *
 * Tests to verify that positions, terrain, and grid bounds survive
 * the save/load cycle through the EncounterRepository.
 *
 * This addresses the critical gap identified in the EMERGENT_DISCOVERY_LOG:
 * "Positions not persisted - In-memory only, not serialized to database"
 */

import * as fs from 'fs';
import { initDB } from '../../src/storage/db.js';
import { migrate } from '../../src/storage/migrations.js';
import { EncounterRepository } from '../../src/storage/repos/encounter.repo.js';
import { Encounter, GridBounds, DEFAULT_GRID_BOUNDS } from '../../src/schema/encounter.js';

const TEST_DB_PATH = 'test-position-persistence.db';

describe('Phase 1: Position Persistence', () => {
    let db: ReturnType<typeof initDB>;
    let repo: EncounterRepository;

    beforeEach(() => {
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
        db = initDB(TEST_DB_PATH);
        migrate(db);
        repo = new EncounterRepository(db);
    });

    afterEach(() => {
        db.close();
        if (fs.existsSync(TEST_DB_PATH)) {
            fs.unlinkSync(TEST_DB_PATH);
        }
    });

    describe('Token Position Persistence', () => {
        it('persists positions through save/load cycle via saveState/loadState', () => {
            // Create encounter
            const encounter: Encounter = {
                id: 'enc-pos-1',
                tokens: [{
                    id: 'hero-1',
                    name: 'Hero',
                    initiativeBonus: 2,
                    hp: 30,
                    maxHp: 30,
                    conditions: [],
                    position: { x: 5, y: 10 },
                    movementSpeed: 30,
                    size: 'medium'
                }],
                round: 1,
                activeTokenId: 'hero-1',
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            repo.create(encounter);

            // Simulate combat state with position
            const combatState = {
                participants: [{
                    id: 'hero-1',
                    name: 'Hero',
                    initiativeBonus: 2,
                    initiative: 15,
                    hp: 25, // Took some damage
                    maxHp: 30,
                    conditions: [],
                    position: { x: 8, y: 12 }, // Moved from (5,10) to (8,12)
                    movementSpeed: 30,
                    size: 'medium'
                }],
                turnOrder: ['hero-1'],
                currentTurnIndex: 0,
                round: 2
            };

            // Save state
            repo.saveState('enc-pos-1', combatState);

            // Load state
            const loaded = repo.loadState('enc-pos-1');

            // Verify position persisted
            expect(loaded).not.toBeNull();
            expect(loaded.participants[0].position).toEqual({ x: 8, y: 12 });
            expect(loaded.participants[0].hp).toBe(25);
            expect(loaded.round).toBe(2);
        });

        it('persists multiple participant positions', () => {
            const encounter: Encounter = {
                id: 'enc-multi-pos',
                tokens: [
                    { id: 'hero-1', name: 'Hero', initiativeBonus: 2, hp: 30, maxHp: 30, conditions: [], movementSpeed: 30, size: 'medium' },
                    { id: 'goblin-1', name: 'Goblin', initiativeBonus: 1, hp: 7, maxHp: 7, conditions: [], movementSpeed: 30, size: 'small' }
                ],
                round: 1,
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            repo.create(encounter);

            const combatState = {
                participants: [
                    { id: 'hero-1', name: 'Hero', initiativeBonus: 2, initiative: 18, hp: 30, maxHp: 30, conditions: [], position: { x: 0, y: 0 }, movementSpeed: 30, size: 'medium' },
                    { id: 'goblin-1', name: 'Goblin', initiativeBonus: 1, initiative: 12, hp: 7, maxHp: 7, conditions: [], position: { x: 10, y: 5 }, movementSpeed: 30, size: 'small' }
                ],
                turnOrder: ['hero-1', 'goblin-1'],
                currentTurnIndex: 0,
                round: 1
            };

            repo.saveState('enc-multi-pos', combatState);
            const loaded = repo.loadState('enc-multi-pos');

            expect(loaded.participants.find((p: any) => p.id === 'hero-1').position).toEqual({ x: 0, y: 0 });
            expect(loaded.participants.find((p: any) => p.id === 'goblin-1').position).toEqual({ x: 10, y: 5 });
        });

        it('handles participants without positions', () => {
            const encounter: Encounter = {
                id: 'enc-no-pos',
                tokens: [{
                    id: 'hero-1',
                    name: 'Hero',
                    initiativeBonus: 2,
                    hp: 30,
                    maxHp: 30,
                    conditions: [],
                    movementSpeed: 30,
                    size: 'medium'
                    // No position
                }],
                round: 1,
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            repo.create(encounter);

            const combatState = {
                participants: [{
                    id: 'hero-1',
                    name: 'Hero',
                    initiativeBonus: 2,
                    initiative: 15,
                    hp: 30,
                    maxHp: 30,
                    conditions: []
                    // Still no position
                }],
                turnOrder: ['hero-1'],
                currentTurnIndex: 0,
                round: 1
            };

            repo.saveState('enc-no-pos', combatState);
            const loaded = repo.loadState('enc-no-pos');

            expect(loaded.participants[0].position).toBeUndefined();
        });

        it('persists 3D positions (z coordinate)', () => {
            const encounter: Encounter = {
                id: 'enc-3d',
                tokens: [{
                    id: 'flying-hero',
                    name: 'Flying Hero',
                    initiativeBonus: 2,
                    hp: 30,
                    maxHp: 30,
                    conditions: [],
                    position: { x: 5, y: 5, z: 10 }, // 10 squares up
                    movementSpeed: 30,
                    size: 'medium'
                }],
                round: 1,
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            repo.create(encounter);

            const combatState = {
                participants: [{
                    id: 'flying-hero',
                    name: 'Flying Hero',
                    initiativeBonus: 2,
                    initiative: 15,
                    hp: 30,
                    maxHp: 30,
                    conditions: [],
                    position: { x: 5, y: 5, z: 15 } // Flew higher
                }],
                turnOrder: ['flying-hero'],
                currentTurnIndex: 0,
                round: 1
            };

            repo.saveState('enc-3d', combatState);
            const loaded = repo.loadState('enc-3d');

            expect(loaded.participants[0].position).toEqual({ x: 5, y: 5, z: 15 });
        });
    });

    describe('Terrain Persistence', () => {
        it('persists terrain obstacles through save/load', () => {
            const encounter: Encounter = {
                id: 'enc-terrain',
                tokens: [{
                    id: 'hero-1',
                    name: 'Hero',
                    initiativeBonus: 2,
                    hp: 30,
                    maxHp: 30,
                    conditions: [],
                    movementSpeed: 30,
                    size: 'medium'
                }],
                round: 1,
                status: 'active',
                terrain: {
                    obstacles: ['5,5', '5,6', '5,7'] // Wall
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            repo.create(encounter);

            const combatState = {
                participants: [{
                    id: 'hero-1',
                    name: 'Hero',
                    initiativeBonus: 2,
                    initiative: 15,
                    hp: 30,
                    maxHp: 30,
                    conditions: [],
                    position: { x: 0, y: 0 }
                }],
                turnOrder: ['hero-1'],
                currentTurnIndex: 0,
                round: 1,
                terrain: {
                    obstacles: ['5,5', '5,6', '5,7']
                }
            };

            repo.saveState('enc-terrain', combatState);
            const loaded = repo.loadState('enc-terrain');

            expect(loaded.terrain).toBeDefined();
            expect(loaded.terrain.obstacles).toEqual(['5,5', '5,6', '5,7']);
        });

        it('persists difficult terrain', () => {
            const encounter: Encounter = {
                id: 'enc-difficult',
                tokens: [{
                    id: 'hero-1',
                    name: 'Hero',
                    initiativeBonus: 2,
                    hp: 30,
                    maxHp: 30,
                    conditions: [],
                    movementSpeed: 30,
                    size: 'medium'
                }],
                round: 1,
                status: 'active',
                terrain: {
                    obstacles: ['10,10'],
                    difficultTerrain: ['3,3', '3,4', '4,3', '4,4'] // Swamp area
                },
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            repo.create(encounter);

            const combatState = {
                participants: [{
                    id: 'hero-1',
                    name: 'Hero',
                    initiativeBonus: 2,
                    initiative: 15,
                    hp: 30,
                    maxHp: 30,
                    conditions: [],
                    position: { x: 0, y: 0 }
                }],
                turnOrder: ['hero-1'],
                currentTurnIndex: 0,
                round: 1,
                terrain: {
                    obstacles: ['10,10'],
                    difficultTerrain: ['3,3', '3,4', '4,3', '4,4']
                }
            };

            repo.saveState('enc-difficult', combatState);
            const loaded = repo.loadState('enc-difficult');

            expect(loaded.terrain.difficultTerrain).toEqual(['3,3', '3,4', '4,3', '4,4']);
        });
    });

    describe('Grid Bounds Persistence (Phase 2)', () => {
        it('persists custom grid bounds', () => {
            const customBounds: GridBounds = {
                minX: -50,
                maxX: 50,
                minY: -50,
                maxY: 50
            };

            const encounter: Encounter = {
                id: 'enc-bounds',
                tokens: [{
                    id: 'hero-1',
                    name: 'Hero',
                    initiativeBonus: 2,
                    hp: 30,
                    maxHp: 30,
                    conditions: [],
                    movementSpeed: 30,
                    size: 'medium'
                }],
                round: 1,
                status: 'active',
                gridBounds: customBounds,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            repo.create(encounter);

            const combatState = {
                participants: [{
                    id: 'hero-1',
                    name: 'Hero',
                    initiativeBonus: 2,
                    initiative: 15,
                    hp: 30,
                    maxHp: 30,
                    conditions: [],
                    position: { x: 0, y: 0 }
                }],
                turnOrder: ['hero-1'],
                currentTurnIndex: 0,
                round: 1,
                gridBounds: customBounds
            };

            repo.saveState('enc-bounds', combatState);
            const loaded = repo.loadState('enc-bounds');

            expect(loaded.gridBounds).toEqual(customBounds);
        });

        it('uses default bounds when none specified', () => {
            const encounter: Encounter = {
                id: 'enc-default-bounds',
                tokens: [{
                    id: 'hero-1',
                    name: 'Hero',
                    initiativeBonus: 2,
                    hp: 30,
                    maxHp: 30,
                    conditions: [],
                    movementSpeed: 30,
                    size: 'medium'
                }],
                round: 1,
                status: 'active',
                // No gridBounds specified
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            repo.create(encounter);

            const combatState = {
                participants: [{
                    id: 'hero-1',
                    name: 'Hero',
                    initiativeBonus: 2,
                    initiative: 15,
                    hp: 30,
                    maxHp: 30,
                    conditions: [],
                    position: { x: 0, y: 0 }
                }],
                turnOrder: ['hero-1'],
                currentTurnIndex: 0,
                round: 1
            };

            repo.saveState('enc-default-bounds', combatState);
            const loaded = repo.loadState('enc-default-bounds');

            expect(loaded.gridBounds).toEqual(DEFAULT_GRID_BOUNDS);
        });
    });

    describe('Movement Properties Persistence (Phase 4)', () => {
        it('persists movement speed and remaining movement', () => {
            const encounter: Encounter = {
                id: 'enc-movement',
                tokens: [{
                    id: 'fast-hero',
                    name: 'Fast Hero',
                    initiativeBonus: 2,
                    hp: 30,
                    maxHp: 30,
                    conditions: [],
                    movementSpeed: 40, // Custom speed
                    size: 'medium'
                }],
                round: 1,
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            repo.create(encounter);

            const combatState = {
                participants: [{
                    id: 'fast-hero',
                    name: 'Fast Hero',
                    initiativeBonus: 2,
                    initiative: 15,
                    hp: 30,
                    maxHp: 30,
                    conditions: [],
                    position: { x: 5, y: 5 },
                    movementSpeed: 40,
                    movementRemaining: 15, // Used 25ft of movement
                    hasDashed: false
                }],
                turnOrder: ['fast-hero'],
                currentTurnIndex: 0,
                round: 1
            };

            repo.saveState('enc-movement', combatState);
            const loaded = repo.loadState('enc-movement');

            expect(loaded.participants[0].movementSpeed).toBe(40);
            expect(loaded.participants[0].movementRemaining).toBe(15);
            expect(loaded.participants[0].hasDashed).toBe(false);
        });

        it('persists size category', () => {
            const encounter: Encounter = {
                id: 'enc-size',
                tokens: [{
                    id: 'dragon-1',
                    name: 'Adult Dragon',
                    initiativeBonus: 2,
                    hp: 200,
                    maxHp: 200,
                    conditions: [],
                    movementSpeed: 40,
                    size: 'huge'
                }],
                round: 1,
                status: 'active',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            repo.create(encounter);

            const combatState = {
                participants: [{
                    id: 'dragon-1',
                    name: 'Adult Dragon',
                    initiativeBonus: 2,
                    initiative: 20,
                    hp: 200,
                    maxHp: 200,
                    conditions: [],
                    position: { x: 10, y: 10 },
                    movementSpeed: 40,
                    size: 'huge'
                }],
                turnOrder: ['dragon-1'],
                currentTurnIndex: 0,
                round: 1
            };

            repo.saveState('enc-size', combatState);
            const loaded = repo.loadState('enc-size');

            expect(loaded.participants[0].size).toBe('huge');
        });
    });
});
