/**
 * Combat Grid System Tests
 *
 * Tests for the 5-phase spatial combat system:
 * - Phase 1: Position Persistence
 * - Phase 2: Boundary Validation (BUG-001 fix)
 * - Phase 3: Collision Enforcement
 * - Phase 4: Movement Economy
 * - Phase 5: AoE Integration
 */

import {
    // Phase 2: Boundary Validation
    isPositionInBounds,
    validatePosition,

    // Phase 3: Collision Enforcement
    getOccupiedTiles,
    buildObstacleSet,
    isDestinationBlocked,

    // Phase 4: Movement Economy
    calculatePathCost,
    feetToSquares,
    squaresToFeet,
    initializeMovement,
    applyDash,
    validateMovement,
    FEET_PER_SQUARE,
    DEFAULT_MOVEMENT_SPEED,
    DIAGONAL_COST,
    DIFFICULT_TERRAIN_COST,

    // Phase 5: AoE Integration
    getParticipantsInCircle,
    getParticipantsInCone,
    getParticipantsInLine,
    hasLineOfSight,

    // Manager
    CombatGridManager,
    SpatialCombatState,
    SpatialParticipant
} from '../../../src/engine/spatial/combat-grid.js';

import { DEFAULT_GRID_BOUNDS, GridBounds } from '../../../src/schema/encounter.js';

// ============================================================
// TEST FIXTURES
// ============================================================

function createTestParticipant(overrides: Partial<SpatialParticipant> = {}): SpatialParticipant {
    return {
        id: 'test-1',
        name: 'Test Hero',
        initiativeBonus: 2,
        hp: 30,
        maxHp: 30,
        conditions: [],
        position: { x: 0, y: 0 },
        movementSpeed: 30,
        size: 'medium',
        ...overrides
    };
}

function createTestState(overrides: Partial<SpatialCombatState> = {}): SpatialCombatState {
    return {
        participants: [],
        turnOrder: [],
        currentTurnIndex: 0,
        round: 1,
        gridBounds: { ...DEFAULT_GRID_BOUNDS },
        ...overrides
    };
}

// ============================================================
// PHASE 2: BOUNDARY VALIDATION TESTS (BUG-001 FIX)
// ============================================================

describe('Phase 2: Boundary Validation (BUG-001)', () => {
    const bounds: GridBounds = { minX: 0, maxX: 100, minY: 0, maxY: 100 };

    describe('isPositionInBounds', () => {
        it('returns true for position within bounds', () => {
            expect(isPositionInBounds({ x: 50, y: 50 }, bounds)).toBe(true);
            expect(isPositionInBounds({ x: 0, y: 0 }, bounds)).toBe(true);
            expect(isPositionInBounds({ x: 100, y: 100 }, bounds)).toBe(true);
        });

        it('returns false for position below minimum X', () => {
            expect(isPositionInBounds({ x: -1, y: 50 }, bounds)).toBe(false);
        });

        it('returns false for position above maximum X', () => {
            expect(isPositionInBounds({ x: 101, y: 50 }, bounds)).toBe(false);
        });

        it('returns false for position below minimum Y', () => {
            expect(isPositionInBounds({ x: 50, y: -1 }, bounds)).toBe(false);
        });

        it('returns false for position above maximum Y', () => {
            expect(isPositionInBounds({ x: 50, y: 101 }, bounds)).toBe(false);
        });

        it('handles Z coordinate bounds when specified', () => {
            const bounds3D: GridBounds = { minX: 0, maxX: 100, minY: 0, maxY: 100, minZ: 0, maxZ: 10 };
            expect(isPositionInBounds({ x: 50, y: 50, z: 5 }, bounds3D)).toBe(true);
            expect(isPositionInBounds({ x: 50, y: 50, z: -1 }, bounds3D)).toBe(false);
            expect(isPositionInBounds({ x: 50, y: 50, z: 11 }, bounds3D)).toBe(false);
        });
    });

    describe('validatePosition', () => {
        it('returns null for valid position', () => {
            expect(validatePosition({ x: 50, y: 50 }, bounds)).toBeNull();
        });

        it('returns error message for invalid X', () => {
            const error = validatePosition({ x: -1, y: 50 }, bounds);
            expect(error).toContain('x=-1');
            expect(error).toContain('below minimum');
        });

        it('returns error message for invalid Y', () => {
            const error = validatePosition({ x: 50, y: 101 }, bounds);
            expect(error).toContain('y=101');
            expect(error).toContain('exceeds maximum');
        });

        it('returns error for non-finite coordinates', () => {
            expect(validatePosition({ x: NaN, y: 50 }, bounds)).toContain('finite numbers');
            expect(validatePosition({ x: Infinity, y: 50 }, bounds)).toContain('finite numbers');
        });

        it('includes custom context in error message', () => {
            const error = validatePosition({ x: -1, y: 50 }, bounds, 'move destination');
            expect(error).toContain('move destination');
        });
    });
});

// ============================================================
// PHASE 3: COLLISION ENFORCEMENT TESTS
// ============================================================

describe('Phase 3: Collision Enforcement', () => {
    describe('getOccupiedTiles', () => {
        it('returns single tile for medium creature', () => {
            const tiles = getOccupiedTiles({ x: 5, y: 5 }, 'medium');
            expect(tiles).toEqual(['5,5']);
        });

        it('returns single tile for small creature', () => {
            const tiles = getOccupiedTiles({ x: 5, y: 5 }, 'small');
            expect(tiles).toEqual(['5,5']);
        });

        it('returns 2x2 tiles for large creature', () => {
            const tiles = getOccupiedTiles({ x: 5, y: 5 }, 'large');
            expect(tiles).toHaveLength(4);
            expect(tiles).toContain('5,5');
            expect(tiles).toContain('6,5');
            expect(tiles).toContain('5,6');
            expect(tiles).toContain('6,6');
        });

        it('returns 3x3 tiles for huge creature', () => {
            const tiles = getOccupiedTiles({ x: 5, y: 5 }, 'huge');
            expect(tiles).toHaveLength(9);
        });

        it('returns 4x4 tiles for gargantuan creature', () => {
            const tiles = getOccupiedTiles({ x: 5, y: 5 }, 'gargantuan');
            expect(tiles).toHaveLength(16);
        });
    });

    describe('buildObstacleSet', () => {
        it('includes participant positions', () => {
            const state = createTestState({
                participants: [
                    createTestParticipant({ id: 'hero-1', position: { x: 5, y: 5 } }),
                    createTestParticipant({ id: 'goblin-1', position: { x: 10, y: 10 } })
                ]
            });

            const obstacles = buildObstacleSet(state);
            expect(obstacles.has('5,5')).toBe(true);
            expect(obstacles.has('10,10')).toBe(true);
        });

        it('excludes specified participant', () => {
            const state = createTestState({
                participants: [
                    createTestParticipant({ id: 'hero-1', position: { x: 5, y: 5 } }),
                    createTestParticipant({ id: 'goblin-1', position: { x: 10, y: 10 } })
                ]
            });

            const obstacles = buildObstacleSet(state, 'hero-1');
            expect(obstacles.has('5,5')).toBe(false);
            expect(obstacles.has('10,10')).toBe(true);
        });

        it('excludes defeated participants (hp <= 0)', () => {
            const state = createTestState({
                participants: [
                    createTestParticipant({ id: 'hero-1', position: { x: 5, y: 5 }, hp: 0 })
                ]
            });

            const obstacles = buildObstacleSet(state);
            expect(obstacles.has('5,5')).toBe(false);
        });

        it('includes terrain obstacles', () => {
            const state = createTestState({
                participants: [],
                terrain: { obstacles: ['7,7', '8,8'] }
            });

            const obstacles = buildObstacleSet(state);
            expect(obstacles.has('7,7')).toBe(true);
            expect(obstacles.has('8,8')).toBe(true);
        });

        it('handles large creatures (multiple tiles)', () => {
            const state = createTestState({
                participants: [
                    createTestParticipant({ id: 'dragon-1', position: { x: 5, y: 5 }, size: 'large' })
                ]
            });

            const obstacles = buildObstacleSet(state);
            expect(obstacles.has('5,5')).toBe(true);
            expect(obstacles.has('6,5')).toBe(true);
            expect(obstacles.has('5,6')).toBe(true);
            expect(obstacles.has('6,6')).toBe(true);
        });
    });

    describe('isDestinationBlocked', () => {
        it('returns false for unoccupied destination', () => {
            const obstacles = new Set(['5,5', '6,6']);
            expect(isDestinationBlocked({ x: 10, y: 10 }, 'medium', obstacles)).toBe(false);
        });

        it('returns true for occupied destination', () => {
            const obstacles = new Set(['5,5']);
            expect(isDestinationBlocked({ x: 5, y: 5 }, 'medium', obstacles)).toBe(true);
        });

        it('checks all tiles for large creature', () => {
            const obstacles = new Set(['6,6']);
            // Large creature at 5,5 needs 5,5, 6,5, 5,6, 6,6
            // 6,6 is blocked, so should return true
            expect(isDestinationBlocked({ x: 5, y: 5 }, 'large', obstacles)).toBe(true);
        });
    });
});

// ============================================================
// PHASE 4: MOVEMENT ECONOMY TESTS
// ============================================================

describe('Phase 4: Movement Economy', () => {
    describe('Unit Conversions', () => {
        it('converts feet to squares correctly', () => {
            expect(feetToSquares(30)).toBe(6);
            expect(feetToSquares(25)).toBe(5); // Rounds down
            expect(feetToSquares(5)).toBe(1);
        });

        it('converts squares to feet correctly', () => {
            expect(squaresToFeet(6)).toBe(30);
            expect(squaresToFeet(1)).toBe(5);
        });
    });

    describe('calculatePathCost', () => {
        it('returns 0 for empty or single-point path', () => {
            expect(calculatePathCost([], new Set())).toBe(0);
            expect(calculatePathCost([{ x: 0, y: 0 }], new Set())).toBe(0);
        });

        it('calculates orthogonal movement correctly', () => {
            // 3 squares straight = 15 feet
            const path = [
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                { x: 2, y: 0 },
                { x: 3, y: 0 }
            ];
            expect(calculatePathCost(path, new Set())).toBe(15);
        });

        it('calculates diagonal movement with 1.5x cost', () => {
            // 1 diagonal = 7.5 feet
            const path = [
                { x: 0, y: 0 },
                { x: 1, y: 1 }
            ];
            expect(calculatePathCost(path, new Set())).toBe(7.5);
        });

        it('applies difficult terrain cost', () => {
            const difficultTerrain = new Set(['1,0']);
            // 1 square into difficult terrain = 10 feet (2x)
            const path = [
                { x: 0, y: 0 },
                { x: 1, y: 0 }
            ];
            expect(calculatePathCost(path, difficultTerrain)).toBe(10);
        });

        it('combines diagonal and difficult terrain costs', () => {
            const difficultTerrain = new Set(['1,1']);
            // 1 diagonal into difficult terrain = 1.5 * 2 * 5 = 15 feet
            const path = [
                { x: 0, y: 0 },
                { x: 1, y: 1 }
            ];
            expect(calculatePathCost(path, difficultTerrain)).toBe(15);
        });
    });

    describe('initializeMovement', () => {
        it('sets movementRemaining to movementSpeed', () => {
            const participant = createTestParticipant({ movementSpeed: 30 });
            const result = initializeMovement(participant);
            expect(result.movementRemaining).toBe(30);
        });

        it('uses default speed if not specified', () => {
            const participant = createTestParticipant({ movementSpeed: undefined });
            const result = initializeMovement(participant as SpatialParticipant);
            expect(result.movementRemaining).toBe(DEFAULT_MOVEMENT_SPEED);
        });

        it('resets hasDashed flag', () => {
            const participant = createTestParticipant({ hasDashed: true });
            const result = initializeMovement(participant);
            expect(result.hasDashed).toBe(false);
        });
    });

    describe('applyDash', () => {
        it('adds base speed to remaining movement', () => {
            const participant = createTestParticipant({
                movementSpeed: 30,
                movementRemaining: 30
            });
            const result = applyDash(participant);
            expect(result.movementRemaining).toBe(60);
        });

        it('sets hasDashed flag', () => {
            const participant = createTestParticipant();
            const result = applyDash(participant);
            expect(result.hasDashed).toBe(true);
        });

        it('works with partial movement remaining', () => {
            const participant = createTestParticipant({
                movementSpeed: 30,
                movementRemaining: 15
            });
            const result = applyDash(participant);
            expect(result.movementRemaining).toBe(45);
        });
    });

    describe('validateMovement', () => {
        it('rejects out-of-bounds destination', () => {
            const state = createTestState({
                participants: [createTestParticipant({ position: { x: 50, y: 50 } })]
            });

            const result = validateMovement(state, 'test-1', { x: -1, y: 50 });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('below minimum');
        });

        it('allows setting initial position without current position', () => {
            const state = createTestState({
                participants: [createTestParticipant({ position: undefined })]
            });

            const result = validateMovement(state, 'test-1', { x: 5, y: 5 });
            expect(result.valid).toBe(true);
            expect(result.pathCost).toBe(0);
        });

        it('rejects blocked destination', () => {
            const state = createTestState({
                participants: [
                    createTestParticipant({ id: 'hero-1', position: { x: 0, y: 0 } }),
                    createTestParticipant({ id: 'goblin-1', position: { x: 5, y: 0 } })
                ]
            });

            const result = validateMovement(state, 'hero-1', { x: 5, y: 0 });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('blocked');
        });

        it('rejects movement when no path exists', () => {
            // Create a complete wall blocking the path
            const state = createTestState({
                participants: [createTestParticipant({ position: { x: 0, y: 0 }, movementRemaining: 1000 })],
                terrain: {
                    obstacles: [
                        // Complete wall surrounding (0,0)
                        '1,0', '1,1', '1,-1',
                        '0,1', '0,-1',
                        '-1,0', '-1,1', '-1,-1'
                    ]
                }
            });

            const result = validateMovement(state, 'test-1', { x: 5, y: 5 });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('No valid path');
        });

        it('rejects movement exceeding remaining distance', () => {
            const state = createTestState({
                participants: [createTestParticipant({
                    position: { x: 0, y: 0 },
                    movementRemaining: 10 // Only 2 squares
                })]
            });

            // Try to move 10 squares (50 feet)
            const result = validateMovement(state, 'test-1', { x: 10, y: 0 });
            expect(result.valid).toBe(false);
            expect(result.error).toContain('Insufficient movement');
        });

        it('returns valid path and cost for valid movement', () => {
            const state = createTestState({
                participants: [createTestParticipant({
                    position: { x: 0, y: 0 },
                    movementRemaining: 30
                })]
            });

            const result = validateMovement(state, 'test-1', { x: 3, y: 0 });
            expect(result.valid).toBe(true);
            expect(result.path).toBeDefined();
            expect(result.path!.length).toBeGreaterThan(1);
            expect(result.pathCost).toBe(15); // 3 squares = 15 feet
        });
    });
});

// ============================================================
// PHASE 5: AOE INTEGRATION TESTS
// ============================================================

describe('Phase 5: AoE Integration', () => {
    describe('getParticipantsInCircle', () => {
        it('returns participants within radius', () => {
            const state = createTestState({
                participants: [
                    createTestParticipant({ id: 'hero-1', position: { x: 10, y: 10 } }),
                    createTestParticipant({ id: 'goblin-1', position: { x: 12, y: 10 } }), // 2 squares away
                    createTestParticipant({ id: 'goblin-2', position: { x: 20, y: 10 } })  // 10 squares away
                ]
            });

            // 20ft radius = 4 squares
            const result = getParticipantsInCircle(state, { x: 10, y: 10 }, 20);
            expect(result.affectedParticipants.map(p => p.id)).toContain('hero-1');
            expect(result.affectedParticipants.map(p => p.id)).toContain('goblin-1');
            expect(result.affectedParticipants.map(p => p.id)).not.toContain('goblin-2');
        });

        it('excludes specified IDs', () => {
            const state = createTestState({
                participants: [
                    createTestParticipant({ id: 'caster', position: { x: 10, y: 10 } }),
                    createTestParticipant({ id: 'ally', position: { x: 11, y: 10 } })
                ]
            });

            const result = getParticipantsInCircle(state, { x: 10, y: 10 }, 20, ['caster']);
            expect(result.affectedParticipants.map(p => p.id)).not.toContain('caster');
            expect(result.affectedParticipants.map(p => p.id)).toContain('ally');
        });

        it('returns affected tiles', () => {
            const state = createTestState({ participants: [] });
            const result = getParticipantsInCircle(state, { x: 5, y: 5 }, 10); // 2 square radius
            expect(result.affectedTiles.length).toBeGreaterThan(1);
        });
    });

    describe('getParticipantsInCone', () => {
        it('returns participants in cone direction', () => {
            const state = createTestState({
                participants: [
                    createTestParticipant({ id: 'target-1', position: { x: 2, y: 0 } }), // In cone (East), within 15ft/3 squares
                    createTestParticipant({ id: 'target-2', position: { x: 0, y: 5 } })  // Not in cone (South)
                ]
            });

            // 15ft cone facing East (direction {1, 0}) = 3 squares
            const result = getParticipantsInCone(
                state,
                { x: 0, y: 0 },
                { x: 1, y: 0 },
                15,
                90
            );

            // target-1 should be in cone, target-2 should not
            const ids = result.affectedParticipants.map(p => p.id);
            expect(ids).toContain('target-1');
            expect(ids).not.toContain('target-2');
        });
    });

    describe('getParticipantsInLine', () => {
        it('returns participants along the line', () => {
            const state = createTestState({
                participants: [
                    createTestParticipant({ id: 'target-1', position: { x: 5, y: 0 } }),  // On line
                    createTestParticipant({ id: 'target-2', position: { x: 10, y: 0 } }), // On line
                    createTestParticipant({ id: 'safe', position: { x: 5, y: 5 } })       // Off line
                ]
            });

            const result = getParticipantsInLine(state, { x: 0, y: 0 }, { x: 20, y: 0 });
            const ids = result.affectedParticipants.map(p => p.id);
            expect(ids).toContain('target-1');
            expect(ids).toContain('target-2');
            expect(ids).not.toContain('safe');
        });
    });

    describe('hasLineOfSight', () => {
        it('returns true for clear line of sight', () => {
            const state = createTestState({ participants: [] });
            expect(hasLineOfSight(state, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(true);
        });

        it('returns false when terrain blocks', () => {
            const state = createTestState({
                participants: [],
                terrain: { obstacles: ['5,0'] }
            });
            expect(hasLineOfSight(state, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(false);
        });

        it('creatures do not block line of sight', () => {
            const state = createTestState({
                participants: [
                    createTestParticipant({ id: 'blocker', position: { x: 5, y: 0 } })
                ]
            });
            // Creatures don't block LOS in this implementation
            expect(hasLineOfSight(state, { x: 0, y: 0 }, { x: 10, y: 0 })).toBe(true);
        });
    });
});

// ============================================================
// COMBAT GRID MANAGER TESTS
// ============================================================

describe('CombatGridManager', () => {
    describe('startTurn', () => {
        it('initializes movement for participant', () => {
            const state = createTestState({
                participants: [createTestParticipant({ movementSpeed: 30, movementRemaining: 0 })]
            });
            const manager = new CombatGridManager(state);

            manager.startTurn('test-1');

            expect(manager.getRemainingMovement('test-1')).toBe(30);
        });
    });

    describe('validateMove', () => {
        it('validates movement correctly', () => {
            const state = createTestState({
                participants: [createTestParticipant({
                    position: { x: 0, y: 0 },
                    movementRemaining: 30
                })]
            });
            const manager = new CombatGridManager(state);

            const result = manager.validateMove('test-1', { x: 3, y: 0 });
            expect(result.valid).toBe(true);
        });
    });

    describe('executeMove', () => {
        it('updates position and deducts movement', () => {
            const state = createTestState({
                participants: [createTestParticipant({
                    position: { x: 0, y: 0 },
                    movementRemaining: 30
                })]
            });
            const manager = new CombatGridManager(state);

            manager.executeMove('test-1', { x: 3, y: 0 }, 15);

            const updatedState = manager.getState();
            expect(updatedState.participants[0].position).toEqual({ x: 3, y: 0 });
            expect(updatedState.participants[0].movementRemaining).toBe(15);
        });
    });

    describe('dash', () => {
        it('doubles movement', () => {
            const state = createTestState({
                participants: [createTestParticipant({
                    movementSpeed: 30,
                    movementRemaining: 30
                })]
            });
            const manager = new CombatGridManager(state);

            expect(manager.dash('test-1')).toBe(true);
            expect(manager.getRemainingMovement('test-1')).toBe(60);
        });

        it('returns false if already dashed', () => {
            const state = createTestState({
                participants: [createTestParticipant({ hasDashed: true })]
            });
            const manager = new CombatGridManager(state);

            expect(manager.dash('test-1')).toBe(false);
        });
    });

    describe('setPosition', () => {
        it('sets initial position', () => {
            const state = createTestState({
                participants: [createTestParticipant({ position: undefined })]
            });
            const manager = new CombatGridManager(state);

            const error = manager.setPosition('test-1', { x: 5, y: 5 });
            expect(error).toBeNull();

            const updatedState = manager.getState();
            expect(updatedState.participants[0].position).toEqual({ x: 5, y: 5 });
        });

        it('returns error for out of bounds position', () => {
            const state = createTestState({
                participants: [createTestParticipant({ position: undefined })]
            });
            const manager = new CombatGridManager(state);

            const error = manager.setPosition('test-1', { x: -1, y: 0 });
            expect(error).not.toBeNull();
            expect(error).toContain('below minimum');
        });

        it('returns error for blocked position', () => {
            const state = createTestState({
                participants: [
                    createTestParticipant({ id: 'hero-1', position: undefined }),
                    createTestParticipant({ id: 'goblin-1', position: { x: 5, y: 5 } })
                ]
            });
            const manager = new CombatGridManager(state);

            const error = manager.setPosition('hero-1', { x: 5, y: 5 });
            expect(error).not.toBeNull();
            expect(error).toContain('blocked');
        });
    });

    describe('AoE methods', () => {
        it('getCircleTargets delegates correctly', () => {
            const state = createTestState({
                participants: [createTestParticipant({ position: { x: 10, y: 10 } })]
            });
            const manager = new CombatGridManager(state);

            const result = manager.getCircleTargets({ x: 10, y: 10 }, 20);
            expect(result.affectedParticipants).toHaveLength(1);
        });

        it('getConeTargets delegates correctly', () => {
            const state = createTestState({
                participants: [createTestParticipant({ position: { x: 5, y: 0 } })]
            });
            const manager = new CombatGridManager(state);

            const result = manager.getConeTargets({ x: 0, y: 0 }, { x: 1, y: 0 }, 30, 90);
            expect(result.affectedParticipants).toHaveLength(1);
        });

        it('getLineTargets delegates correctly', () => {
            const state = createTestState({
                participants: [createTestParticipant({ position: { x: 5, y: 0 } })]
            });
            const manager = new CombatGridManager(state);

            const result = manager.getLineTargets({ x: 0, y: 0 }, { x: 20, y: 0 });
            expect(result.affectedParticipants).toHaveLength(1);
        });
    });
});
