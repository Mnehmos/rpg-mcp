import { z } from 'zod';
import { StructureType } from '../../schema/structure';
import { BiomeType } from '../../schema/biome';

/**
 * Command Types
 */
export enum CommandType {
    ADD_STRUCTURE = 'ADD_STRUCTURE',
    SET_BIOME = 'SET_BIOME',
    EDIT_TILE = 'EDIT_TILE',
    ADD_ROAD = 'ADD_ROAD',
    MOVE_STRUCTURE = 'MOVE_STRUCTURE',
    ADD_ANNOTATION = 'ADD_ANNOTATION'
}

/**
 * Command Schemas
 */

/**
 * Shared validation schemas
 */
const CoordinateSchema = z.coerce.number().int().min(0, 'Coordinates must be non-negative');

export const AddStructureSchema = z.object({
    command: z.literal(CommandType.ADD_STRUCTURE),
    args: z.object({
        type: z.nativeEnum(StructureType),
        x: CoordinateSchema,
        y: CoordinateSchema,
        name: z.string().min(1, 'Name cannot be empty')
    })
});

export const SetBiomeSchema = z.object({
    command: z.literal(CommandType.SET_BIOME),
    args: z.object({
        x: CoordinateSchema,
        y: CoordinateSchema,
        type: z.nativeEnum(BiomeType)
    })
});

export const EditTileSchema = z.object({
    command: z.literal(CommandType.EDIT_TILE),
    args: z.object({
        x: CoordinateSchema,
        y: CoordinateSchema,
        elevation: z.coerce.number().int().min(0).max(255).optional(),
        moisture: z.coerce.number().int().min(0).max(255).optional(),
        temperature: z.coerce.number().int().min(-128).max(127).optional()
    })
});

export const AddRoadSchema = z.object({
    command: z.literal(CommandType.ADD_ROAD),
    args: z.object({
        from_x: CoordinateSchema,
        from_y: CoordinateSchema,
        to_x: CoordinateSchema,
        to_y: CoordinateSchema
    })
});

export const MoveStructureSchema = z.object({
    command: z.literal(CommandType.MOVE_STRUCTURE),
    args: z.object({
        id: z.string().min(1, 'Structure ID cannot be empty'),
        x: CoordinateSchema,
        y: CoordinateSchema
    })
});

export const AddAnnotationSchema = z.object({
    command: z.literal(CommandType.ADD_ANNOTATION),
    args: z.object({
        x: CoordinateSchema,
        y: CoordinateSchema,
        text: z.string().min(1, 'Annotation text cannot be empty')
    })
});

/**
 * Union of all command schemas
 */
export const PatchCommandSchema = z.discriminatedUnion('command', [
    AddStructureSchema,
    SetBiomeSchema,
    EditTileSchema,
    AddRoadSchema,
    MoveStructureSchema,
    AddAnnotationSchema
]);

export type PatchCommand = z.infer<typeof PatchCommandSchema>;
