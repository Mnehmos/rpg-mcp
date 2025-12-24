import { TileSchema } from '../../src/schema/tile';

describe('TileSchema', () => {
  it('should validate a complete tile object', () => {
    const validTile = {
      id: 'tile-123',
      worldId: 'world-456',
      x: 10,
      y: 20,
      elevation: 150,
      temperature: 18.5,
      moisture: 0.65,
      biome: 'temperate_forest',
    };

    const result = TileSchema.safeParse(validTile);
    expect(result.success).toBe(true);
  });

  it('should reject tile without required fields', () => {
    const invalidTile = {
      x: 10,
      y: 20,
    };

    const result = TileSchema.safeParse(invalidTile);
    expect(result.success).toBe(false);
  });

  it('should validate elevation ranges', () => {
    const tileUnderwater = {
      id: 'tile-123',
      worldId: 'world-456',
      x: 10,
      y: 20,
      elevation: -100,
      temperature: 10,
      moisture: 1.0,
      biome: 'ocean',
    };

    const tileHigh = {
      id: 'tile-124',
      worldId: 'world-456',
      x: 11,
      y: 21,
      elevation: 3000,
      temperature: -5,
      moisture: 0.2,
      biome: 'mountain',
    };

    expect(TileSchema.safeParse(tileUnderwater).success).toBe(true);
    expect(TileSchema.safeParse(tileHigh).success).toBe(true);
  });

  it('should validate moisture range 0-1', () => {
    const tileInvalidMoisture = {
      id: 'tile-125',
      worldId: 'world-456',
      x: 12,
      y: 22,
      elevation: 100,
      temperature: 15,
      moisture: 1.5, // Invalid: > 1
      biome: 'grassland',
    };

    const result = TileSchema.safeParse(tileInvalidMoisture);
    expect(result.success).toBe(false);
  });

  it('should validate JSON round-trip', () => {
    const tile = {
      id: 'tile-789',
      worldId: 'world-012',
      x: 50,
      y: 75,
      elevation: 200,
      temperature: 22.3,
      moisture: 0.45,
      biome: 'desert',
    };

    const parsed = TileSchema.parse(tile);
    const json = JSON.stringify(parsed);
    const reparsed = TileSchema.parse(JSON.parse(json));

    expect(reparsed).toEqual(parsed);
  });
});
