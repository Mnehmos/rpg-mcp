import { RegionSchema } from '../../src/schema/region';
import { FIXED_TIMESTAMP } from '../fixtures';

describe('RegionSchema', () => {
  it('should validate a complete region object', () => {
    const validRegion = {
      id: 'region-123',
      worldId: 'world-456',
      name: 'Northern Territory',
      type: 'kingdom',
      centerX: 512,
      centerY: 384,
      color: '#FF5733',
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };

    const result = RegionSchema.safeParse(validRegion);
    expect(result.success).toBe(true);
  });

  it('should reject region without required fields', () => {
    const invalidRegion = {
      id: 'region-123',
      name: 'Northern Territory',
    };

    const result = RegionSchema.safeParse(invalidRegion);
    expect(result.success).toBe(false);
  });

  it('should validate region types', () => {
    const validTypes = ['kingdom', 'duchy', 'county', 'wilderness', 'water'];

    validTypes.forEach((type) => {
      const region = {
        id: 'region-123',
        worldId: 'world-456',
        name: 'Test Region',
        type,
        centerX: 100,
        centerY: 100,
        color: '#FF5733',
        createdAt: FIXED_TIMESTAMP,
        updatedAt: FIXED_TIMESTAMP,
      };

      const result = RegionSchema.safeParse(region);
      expect(result.success).toBe(true);
    });
  });

  it('should reject invalid region type', () => {
    const region = {
      id: 'region-123',
      worldId: 'world-456',
      name: 'Test Region',
      type: 'invalid-type',
      centerX: 100,
      centerY: 100,
      color: '#FF5733',
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };

    const result = RegionSchema.safeParse(region);
    expect(result.success).toBe(false);
  });

  it('should validate JSON round-trip', () => {
    const region = {
      id: 'region-789',
      worldId: 'world-012',
      name: 'Eastern Wastes',
      type: 'wilderness',
      centerX: 800,
      centerY: 600,
      color: '#00FF00',
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };

    const parsed = RegionSchema.parse(region);
    const json = JSON.stringify(parsed);
    const reparsed = RegionSchema.parse(JSON.parse(json));

    expect(reparsed).toEqual(parsed);
  });
});
