import { EncounterSchema, TokenSchema } from '../../src/schema/encounter';
import { FIXED_TIMESTAMP } from '../fixtures';

describe('TokenSchema', () => {
    it('should validate a valid token', () => {
        const validToken = {
            id: 'token-1',
            name: 'Hero',
            initiativeBonus: 2,
            hp: 20,
            maxHp: 20,
            conditions: [{
                id: 'cond-1',
                type: 'prone',
                durationType: 'save_ends'
            }],
        };

        const result = TokenSchema.safeParse(validToken);
        expect(result.success).toBe(true);
    });
});

describe('EncounterSchema', () => {
    it('should validate a complete encounter', () => {
        const validEncounter = {
            id: 'enc-1',
            regionId: 'region-1',
            tokens: [
                {
                    id: 'token-1',
                    name: 'Hero',
                    initiativeBonus: 2,
                    hp: 20,
                    maxHp: 20,
                    conditions: [],
                },
            ],
            round: 1,
            activeTokenId: 'token-1',
            status: 'active',
            createdAt: FIXED_TIMESTAMP,
            updatedAt: FIXED_TIMESTAMP,
        };

        const result = EncounterSchema.safeParse(validEncounter);
        expect(result.success).toBe(true);
    });
});
