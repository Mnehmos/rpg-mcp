import { WorldSchema } from '../../src/schema/world';
import { FIXED_TIMESTAMP } from '../fixtures';

describe('WorldSchema', () => {
  it('should validate a complete world object', () => {
    const validWorld = {
      id: 'world-123',
      name: 'Test World',
      seed: 'test-seed-42',
      width: 1024,
      height: 768,
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };

    const result = WorldSchema.safeParse(validWorld);
    expect(result.success).toBe(true);
  });

  it('should reject world without required fields', () => {
    const invalidWorld = {
      name: 'Test World',
      seed: 'test-seed',
    };

    const result = WorldSchema.safeParse(invalidWorld);
    expect(result.success).toBe(false);
  });

  it('should reject world with invalid types', () => {
    const invalidWorld = {
      id: 123, // should be string
      name: 'Test World',
      seed: 'test-seed',
      width: '1024', // should be number
      height: 768,
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };

    const result = WorldSchema.safeParse(invalidWorld);
    expect(result.success).toBe(false);
  });

  it('should validate JSON round-trip', () => {
    const world = {
      id: 'world-456',
      name: 'JSON Test',
      seed: 'json-seed',
      width: 512,
      height: 512,
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };

    const parsed = WorldSchema.parse(world);
    const json = JSON.stringify(parsed);
    const reparsed = WorldSchema.parse(JSON.parse(json));

    expect(reparsed).toEqual(parsed);
  });

  it('should enforce positive dimensions', () => {
    const worldWithNegative = {
      id: 'world-789',
      name: 'Negative Test',
      seed: 'neg-seed',
      width: -100,
      height: 768,
      createdAt: FIXED_TIMESTAMP,
      updatedAt: FIXED_TIMESTAMP,
    };

    const result = WorldSchema.safeParse(worldWithNegative);
    expect(result.success).toBe(false);
  });
});
