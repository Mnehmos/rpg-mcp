import { z } from 'zod';

export const WorldSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  seed: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type World = z.infer<typeof WorldSchema>;
