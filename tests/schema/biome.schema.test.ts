import { BiomeSchema } from '../../src/schema/biome';

describe('BiomeSchema', () => {
  it('should validate a complete biome object', () => {
    const validBiome = {
      id: 'temperate_forest',
      name: 'Temperate Forest',
      color: '#228B22',
      temperatureMin: 10,
      temperatureMax: 25,
      moistureMin: 0.5,
      moistureMax: 0.9,
      elevationMin: 0,
      elevationMax: 1000,
    };

    const result = BiomeSchema.safeParse(validBiome);
    expect(result.success).toBe(true);
  });

  it('should reject biome without required fields', () => {
    const invalidBiome = {
      id: 'desert',
      name: 'Desert',
    };

    const result = BiomeSchema.safeParse(invalidBiome);
    expect(result.success).toBe(false);
  });

  it('should validate temperature ranges', () => {
    const biome = {
      id: 'tundra',
      name: 'Tundra',
      color: '#E0E0E0',
      temperatureMin: -30,
      temperatureMax: 5,
      moistureMin: 0.1,
      moistureMax: 0.4,
      elevationMin: 0,
      elevationMax: 500,
    };

    const result = BiomeSchema.safeParse(biome);
    expect(result.success).toBe(true);
  });

  it('should reject invalid moisture range', () => {
    const biome = {
      id: 'swamp',
      name: 'Swamp',
      color: '#2F4F2F',
      temperatureMin: 15,
      temperatureMax: 30,
      moistureMin: 0.9,
      moistureMax: 1.5, // Invalid: > 1
      elevationMin: 0,
      elevationMax: 100,
    };

    const result = BiomeSchema.safeParse(biome);
    expect(result.success).toBe(false);
  });

  it('should validate JSON round-trip', () => {
    const biome = {
      id: 'savanna',
      name: 'Savanna',
      color: '#F4A460',
      temperatureMin: 20,
      temperatureMax: 35,
      moistureMin: 0.2,
      moistureMax: 0.5,
      elevationMin: 0,
      elevationMax: 800,
    };

    const parsed = BiomeSchema.parse(biome);
    const json = JSON.stringify(parsed);
    const reparsed = BiomeSchema.parse(JSON.parse(json));

    expect(reparsed).toEqual(parsed);
  });
});
