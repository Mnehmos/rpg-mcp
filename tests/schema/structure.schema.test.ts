import { StructureSchema } from '../../src/schema/structure';
import { FIXED_TIMESTAMP } from '../fixtures';

describe('StructureSchema', () => {
  it('should validate a complete structure object', () => {
    const validStructure = {
      id: 'structure-123',
      worldId: 'world-456',
      regionId: 'region-789',
      name: 'Castle Stronghold',
      type: 'castle',
      x: 100,
      y: 200,
      population: 5000,
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };

    const result = StructureSchema.safeParse(validStructure);
    expect(result.success).toBe(true);
  });

  it('should reject structure without required fields', () => {
    const invalidStructure = {
      name: 'Village',
      type: 'village',
    };

    const result = StructureSchema.safeParse(invalidStructure);
    expect(result.success).toBe(false);
  });

  it('should validate structure types', () => {
    const validTypes = ['city', 'town', 'village', 'castle', 'ruins', 'dungeon', 'temple'];

    validTypes.forEach((type) => {
      const structure = {
        id: 'structure-123',
        worldId: 'world-456',
        regionId: 'region-789',
        name: `Test ${type}`,
        type,
        x: 100,
        y: 200,
        population: 1000,
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP,
      };

      const result = StructureSchema.safeParse(structure);
      expect(result.success).toBe(true);
    });
  });

  it('should reject negative population', () => {
    const structure = {
      id: 'structure-123',
      worldId: 'world-456',
      regionId: 'region-789',
      name: 'Ghost Town',
      type: 'ruins',
      x: 100,
      y: 200,
      population: -100,
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };

    const result = StructureSchema.safeParse(structure);
    expect(result.success).toBe(false);
  });

  it('should allow optional regionId', () => {
    const structure = {
      id: 'structure-456',
      worldId: 'world-789',
      regionId: undefined,
      name: 'Lonely Ruins',
      type: 'ruins',
      x: 300,
      y: 400,
      population: 0,
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };

    const result = StructureSchema.safeParse(structure);
    expect(result.success).toBe(true);
  });

  it('should validate JSON round-trip', () => {
    const structure = {
      id: 'structure-999',
      worldId: 'world-111',
      regionId: 'region-222',
      name: 'Trading Post',
      type: 'town',
      x: 500,
      y: 600,
      population: 2500,
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };

    const parsed = StructureSchema.parse(structure);
    const json = JSON.stringify(parsed);
    const reparsed = StructureSchema.parse(JSON.parse(json));

    expect(reparsed).toEqual(parsed);
  });
});
