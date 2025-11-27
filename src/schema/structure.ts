import { z } from 'zod';

export enum StructureType {
  CITY = 'city',
  TOWN = 'town',
  VILLAGE = 'village',
  CASTLE = 'castle',
  RUINS = 'ruins',
  DUNGEON = 'dungeon',
  TEMPLE = 'temple'
}

export const StructureSchema = z.object({
  id: z.string(),
  worldId: z.string(),
  regionId: z.string().optional(),
  name: z.string(),
  type: z.nativeEnum(StructureType),
  x: z.number(),
  y: z.number(),
  population: z.number().nonnegative(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Structure = z.infer<typeof StructureSchema>;
