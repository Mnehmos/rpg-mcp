import { RiverPathSchema } from '../../src/schema/river';

describe('RiverPathSchema', () => {
  it('should validate a complete river path object', () => {
    const validRiver = {
      id: 'river-123',
      worldId: 'world-456',
      name: 'Silverstream',
      points: [
        { x: 100, y: 200 },
        { x: 105, y: 210 },
        { x: 110, y: 225 },
      ],
      width: 3,
      sourceElevation: 500,
      mouthElevation: 10,
    };

    const result = RiverPathSchema.safeParse(validRiver);
    expect(result.success).toBe(true);
  });

  it('should reject river without required fields', () => {
    const invalidRiver = {
      id: 'river-123',
      name: 'Test River',
    };

    const result = RiverPathSchema.safeParse(invalidRiver);
    expect(result.success).toBe(false);
  });

  it('should validate river flows downhill', () => {
    const validRiver = {
      id: 'river-456',
      worldId: 'world-789',
      name: 'Mountain Creek',
      points: [
        { x: 50, y: 50 },
        { x: 55, y: 60 },
      ],
      width: 2,
      sourceElevation: 1000,
      mouthElevation: 100,
    };

    const result = RiverPathSchema.safeParse(validRiver);
    expect(result.success).toBe(true);
  });

  it('should reject river flowing uphill', () => {
    const invalidRiver = {
      id: 'river-789',
      worldId: 'world-012',
      name: 'Impossible River',
      points: [
        { x: 50, y: 50 },
        { x: 55, y: 60 },
      ],
      width: 2,
      sourceElevation: 100,
      mouthElevation: 1000, // Higher than source
    };

    const result = RiverPathSchema.safeParse(invalidRiver);
    expect(result.success).toBe(false);
  });

  it('should require at least 2 points', () => {
    const invalidRiver = {
      id: 'river-999',
      worldId: 'world-111',
      name: 'Point River',
      points: [{ x: 100, y: 100 }], // Only 1 point
      width: 1,
      sourceElevation: 200,
      mouthElevation: 50,
    };

    const result = RiverPathSchema.safeParse(invalidRiver);
    expect(result.success).toBe(false);
  });

  it('should validate positive width', () => {
    const invalidRiver = {
      id: 'river-222',
      worldId: 'world-333',
      name: 'Zero Width River',
      points: [
        { x: 10, y: 10 },
        { x: 20, y: 20 },
      ],
      width: 0,
      sourceElevation: 300,
      mouthElevation: 50,
    };

    const result = RiverPathSchema.safeParse(invalidRiver);
    expect(result.success).toBe(false);
  });

  it('should validate JSON round-trip', () => {
    const river = {
      id: 'river-444',
      worldId: 'world-555',
      name: 'Great River',
      points: [
        { x: 200, y: 300 },
        { x: 210, y: 320 },
        { x: 220, y: 350 },
        { x: 230, y: 380 },
      ],
      width: 5,
      sourceElevation: 800,
      mouthElevation: 0,
    };

    const parsed = RiverPathSchema.parse(river);
    const json = JSON.stringify(parsed);
    const reparsed = RiverPathSchema.parse(JSON.parse(json));

    expect(reparsed).toEqual(parsed);
  });
});
