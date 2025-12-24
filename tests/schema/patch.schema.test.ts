import { MapPatchSchema, AnnotationSchema } from '../../src/schema/patch';
import { FIXED_TIMESTAMP } from '../fixtures';

describe('MapPatchSchema', () => {
    it('should validate an add operation', () => {
        const patch = {
            op: 'add',
            path: '/structures/1',
            value: { id: 'struct-1', type: 'tower' },
            timestamp: FIXED_TIMESTAMP,
        };

        const result = MapPatchSchema.safeParse(patch);
        expect(result.success).toBe(true);
    });

    it('should validate a remove operation', () => {
        const patch = {
            op: 'remove',
            path: '/structures/1',
            timestamp: FIXED_TIMESTAMP,
        };

        const result = MapPatchSchema.safeParse(patch);
        expect(result.success).toBe(true);
    });
});

describe('AnnotationSchema', () => {
    it('should validate an annotation', () => {
        const annotation = {
            id: 'note-1',
            x: 100,
            y: 200,
            text: 'Here be dragons',
            authorId: 'user-1',
            createdAt: FIXED_TIMESTAMP,
        };

        const result = AnnotationSchema.safeParse(annotation);
        expect(result.success).toBe(true);
    });
});
