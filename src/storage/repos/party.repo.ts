import Database from 'better-sqlite3';
import { 
    Party, PartySchema, 
    PartyMember, PartyMemberSchema,
    PartyWithMembers,
    PartyMemberWithCharacter,
    MemberRole,
    PartyStatus
} from '../../schema/party.js';

interface PartyRow {
    id: string;
    name: string;
    description: string | null;
    world_id: string | null;
    status: string;
    current_location: string | null;
    current_quest_id: string | null;
    formation: string;
    created_at: string;
    updated_at: string;
    last_played_at: string | null;
    position_x: number | null;
    position_y: number | null;
    current_poi: string | null;
}

interface PartyMemberRow {
    id: string;
    party_id: string;
    character_id: string;
    role: string;
    is_active: number;
    position: number | null;
    share_percentage: number;
    joined_at: string;
    notes: string | null;
}

// Row returned from the join query with character data
interface PartyMemberWithCharacterRow extends PartyMemberRow {
    char_id: string;
    char_name: string;
    stats: string;
    hp: number;
    max_hp: number;
    ac: number;
    level: number;
    behavior: string | null;
    character_type: string | null;
    race: string | null;
    character_class: string | null;
}

export class PartyRepository {
    constructor(private db: Database.Database) {}

    // ========== Party CRUD ==========

    create(party: Party): Party {
        const validated = PartySchema.parse(party);
        
        const stmt = this.db.prepare(`
            INSERT INTO parties (id, name, description, world_id, status, current_location, 
                current_quest_id, formation, position_x, position_y, current_poi, created_at, updated_at, last_played_at)
            VALUES (@id, @name, @description, @worldId, @status, @currentLocation, 
                @currentQuestId, @formation, @positionX, @positionY, @currentPOI, @createdAt, @updatedAt, @lastPlayedAt)
        `);

        stmt.run({
            id: validated.id,
            name: validated.name,
            description: validated.description || null,
            worldId: validated.worldId || null,
            status: validated.status,
            currentLocation: validated.currentLocation || null,
            currentQuestId: validated.currentQuestId || null,
            formation: validated.formation,
            positionX: validated.positionX ?? null,
            positionY: validated.positionY ?? null,
            currentPOI: validated.currentPOI || null,
            createdAt: validated.createdAt,
            updatedAt: validated.updatedAt,
            lastPlayedAt: validated.lastPlayedAt || null,
        });

        return validated;
    }

    findById(id: string): Party | null {
        const stmt = this.db.prepare('SELECT * FROM parties WHERE id = ?');
        const row = stmt.get(id) as PartyRow | undefined;
        
        if (!row) return null;
        return this.rowToParty(row);
    }

    findAll(filters?: { status?: PartyStatus; worldId?: string }): Party[] {
        let query = 'SELECT * FROM parties WHERE 1=1';
        const params: any[] = [];

        if (filters?.status) {
            query += ' AND status = ?';
            params.push(filters.status);
        }
        if (filters?.worldId) {
            query += ' AND world_id = ?';
            params.push(filters.worldId);
        }

        query += ' ORDER BY last_played_at DESC NULLS LAST, updated_at DESC';

        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params) as PartyRow[];
        return rows.map(row => this.rowToParty(row));
    }

    update(id: string, updates: Partial<Party>): Party | null {
        const existing = this.findById(id);
        if (!existing) return null;

        const updated = {
            ...existing,
            ...updates,
            updatedAt: new Date().toISOString()
        };

        const validated = PartySchema.parse(updated);

        const stmt = this.db.prepare(`
            UPDATE parties SET 
                name = ?, description = ?, world_id = ?, status = ?, 
                current_location = ?, current_quest_id = ?, formation = ?,
                position_x = ?, position_y = ?, current_poi = ?,
                updated_at = ?, last_played_at = ?
            WHERE id = ?
        `);

        stmt.run(
            validated.name,
            validated.description || null,
            validated.worldId || null,
            validated.status,
            validated.currentLocation || null,
            validated.currentQuestId || null,
            validated.formation,
            validated.positionX ?? null,
            validated.positionY ?? null,
            validated.currentPOI || null,
            validated.updatedAt,
            validated.lastPlayedAt || null,
            id
        );

        return validated;
    }

    delete(id: string): boolean {
        const stmt = this.db.prepare('DELETE FROM parties WHERE id = ?');
        const result = stmt.run(id);
        return result.changes > 0;
    }

    // ========== Party Members ==========

    addMember(member: PartyMember): PartyMember {
        const validated = PartyMemberSchema.parse(member);

        const stmt = this.db.prepare(`
            INSERT INTO party_members (id, party_id, character_id, role, is_active, 
                position, share_percentage, joined_at, notes)
            VALUES (@id, @partyId, @characterId, @role, @isActive, 
                @position, @sharePercentage, @joinedAt, @notes)
        `);

        stmt.run({
            id: validated.id,
            partyId: validated.partyId,
            characterId: validated.characterId,
            role: validated.role,
            isActive: validated.isActive ? 1 : 0,
            position: validated.position ?? null,
            sharePercentage: validated.sharePercentage,
            joinedAt: validated.joinedAt,
            notes: validated.notes || null,
        });

        return validated;
    }

    removeMember(partyId: string, characterId: string): boolean {
        const stmt = this.db.prepare(
            'DELETE FROM party_members WHERE party_id = ? AND character_id = ?'
        );
        const result = stmt.run(partyId, characterId);
        return result.changes > 0;
    }

    updateMember(partyId: string, characterId: string, updates: Partial<PartyMember>): PartyMember | null {
        const existing = this.findMember(partyId, characterId);
        if (!existing) return null;

        const updated = {
            ...existing,
            ...updates,
        };

        const stmt = this.db.prepare(`
            UPDATE party_members SET 
                role = ?, is_active = ?, position = ?, 
                share_percentage = ?, notes = ?
            WHERE party_id = ? AND character_id = ?
        `);

        stmt.run(
            updated.role,
            updated.isActive ? 1 : 0,
            updated.position ?? null,
            updated.sharePercentage,
            updated.notes || null,
            partyId,
            characterId
        );

        return updated;
    }

    findMember(partyId: string, characterId: string): PartyMember | null {
        const stmt = this.db.prepare(
            'SELECT * FROM party_members WHERE party_id = ? AND character_id = ?'
        );
        const row = stmt.get(partyId, characterId) as PartyMemberRow | undefined;
        
        if (!row) return null;
        return this.rowToMember(row);
    }

    findMembersByParty(partyId: string): PartyMember[] {
        const stmt = this.db.prepare(
            'SELECT * FROM party_members WHERE party_id = ? ORDER BY position ASC NULLS LAST, joined_at ASC'
        );
        const rows = stmt.all(partyId) as PartyMemberRow[];
        return rows.map(row => this.rowToMember(row));
    }

    findPartiesByCharacter(characterId: string): Party[] {
        const stmt = this.db.prepare(`
            SELECT p.* FROM parties p
            INNER JOIN party_members pm ON p.id = pm.party_id
            WHERE pm.character_id = ?
            ORDER BY p.last_played_at DESC NULLS LAST
        `);
        const rows = stmt.all(characterId) as PartyRow[];
        return rows.map(row => this.rowToParty(row));
    }

    // ========== Complex Queries ==========

    setLeader(partyId: string, characterId: string): boolean {
        // First, demote any existing leader to member
        this.db.prepare(`
            UPDATE party_members SET role = 'member' 
            WHERE party_id = ? AND role = 'leader'
        `).run(partyId);

        // Promote new leader
        const stmt = this.db.prepare(`
            UPDATE party_members SET role = 'leader' 
            WHERE party_id = ? AND character_id = ?
        `);
        const result = stmt.run(partyId, characterId);
        return result.changes > 0;
    }

    setActiveCharacter(partyId: string, characterId: string): boolean {
        // First, clear any existing active character
        this.db.prepare(`
            UPDATE party_members SET is_active = 0 
            WHERE party_id = ? AND is_active = 1
        `).run(partyId);

        // Set new active character
        const stmt = this.db.prepare(`
            UPDATE party_members SET is_active = 1 
            WHERE party_id = ? AND character_id = ?
        `);
        const result = stmt.run(partyId, characterId);
        return result.changes > 0;
    }

    getPartyWithMembers(partyId: string): PartyWithMembers | null {
        const party = this.findById(partyId);
        if (!party) return null;

        // Get all members with their character data
        const stmt = this.db.prepare(`
            SELECT 
                pm.id, pm.party_id, pm.character_id, pm.role, pm.is_active, 
                pm.position, pm.share_percentage, pm.joined_at, pm.notes,
                c.id as char_id, c.name as char_name, c.stats, c.hp, c.max_hp, 
                c.ac, c.level, c.behavior, c.character_type, c.race, c.character_class
            FROM party_members pm
            INNER JOIN characters c ON pm.character_id = c.id
            WHERE pm.party_id = ?
            ORDER BY 
                CASE pm.role WHEN 'leader' THEN 0 ELSE 1 END,
                pm.position ASC NULLS LAST,
                pm.joined_at ASC
        `);

        const rows = stmt.all(partyId) as PartyMemberWithCharacterRow[];
        
        const members: PartyMemberWithCharacter[] = rows.map(row => ({
            id: row.id,
            partyId: row.party_id,
            characterId: row.character_id,
            role: row.role as MemberRole,
            isActive: row.is_active === 1,
            position: row.position ?? undefined,
            sharePercentage: row.share_percentage,
            joinedAt: row.joined_at,
            notes: row.notes ?? undefined,
            character: {
                id: row.char_id,
                name: row.char_name,
                hp: row.hp,
                maxHp: row.max_hp,
                ac: row.ac,
                level: row.level,
                stats: JSON.parse(row.stats),
                behavior: row.behavior ?? undefined,
                characterType: (row.character_type as any) ?? undefined,
                race: row.race ?? undefined,
                class: row.character_class ?? undefined,
            }
        }));

        const leader = members.find(m => m.role === 'leader');
        const activeCharacter = members.find(m => m.isActive);

        return {
            ...party,
            members,
            leader,
            activeCharacter,
            memberCount: members.length,
        };
    }

    getUnassignedCharacters(excludeTypes?: string[]): { id: string; name: string; level: number; characterType: string | null; race: string | null; class: string | null }[] {
        let query = `
            SELECT c.id, c.name, c.level, c.character_type as characterType, c.race, c.character_class as class
            FROM characters c
            LEFT JOIN party_members pm ON c.id = pm.character_id
            WHERE pm.id IS NULL
        `;
        
        const params: any[] = [];
        
        if (excludeTypes && excludeTypes.length > 0) {
            query += ` AND (c.character_type IS NULL OR c.character_type NOT IN (${excludeTypes.map(() => '?').join(', ')}))`;
            params.push(...excludeTypes);
        }
        
        query += ' ORDER BY c.name ASC';

        const stmt = this.db.prepare(query);
        return stmt.all(...params) as { id: string; name: string; level: number; characterType: string | null; race: string | null; class: string | null }[];
    }

    // ========== Touch for activity tracking ==========

    touchParty(partyId: string): void {
        const now = new Date().toISOString();
        this.db.prepare(`
            UPDATE parties SET last_played_at = ?, updated_at = ? WHERE id = ?
        `).run(now, now, partyId);
    }

    // ========== Party Position Management ==========

    updatePartyPosition(
        partyId: string,
        x: number,
        y: number,
        locationName: string,
        poiId?: string
    ): Party | null {
        const stmt = this.db.prepare(`
            UPDATE parties 
            SET position_x = ?, position_y = ?, current_location = ?, 
                current_poi = ?, updated_at = ?
            WHERE id = ?
            RETURNING *
        `);

        const result = stmt.get(x, y, locationName, poiId || null, new Date().toISOString(), partyId) as PartyRow | undefined;
        
        if (!result) {
            throw new Error(`Party not found: ${partyId}`);
        }

        return this.rowToParty(result);
    }

    getPartyPosition(partyId: string): { x: number; y: number; locationName: string; poiId?: string } | null {
        const stmt = this.db.prepare(`
            SELECT position_x, position_y, current_location, current_poi
            FROM parties
            WHERE id = ?
        `);

        const result = stmt.get(partyId) as any;
        if (!result || result.position_x === null) {
            return null;
        }

        return {
            x: result.position_x,
            y: result.position_y,
            locationName: result.current_location || 'Unknown Location',
            poiId: result.current_poi || undefined,
        };
    }

    getPartiesWithPositions(worldId: string): Array<Party & { position: { x: number; y: number; locationName: string; poiId?: string } }> {
        const stmt = this.db.prepare(`
            SELECT * FROM parties
            WHERE world_id = ? AND position_x IS NOT NULL
            ORDER BY updated_at DESC
        `);

        const results = stmt.all(worldId) as PartyRow[];

        return results.map((row) => ({
            ...this.rowToParty(row),
            position: {
                x: row.position_x || 0,
                y: row.position_y || 0,
                locationName: row.current_location || 'Unknown Location',
                poiId: row.current_poi || undefined,
            },
        }));
    }

    getPartiesNearPosition(
        worldId: string,
        x: number,
        y: number,
        radiusSquares: number = 3
    ): Party[] {
        const stmt = this.db.prepare(`
            SELECT * FROM parties
            WHERE world_id = ?
                AND position_x IS NOT NULL
                AND ABS(position_x - ?) <= ?
                AND ABS(position_y - ?) <= ?
            ORDER BY (position_x - ?) * (position_x - ?) +
                     (position_y - ?) * (position_y - ?)
        `);

        const results = stmt.all(worldId, x, radiusSquares, y, radiusSquares, x, x, y, y) as PartyRow[];

        return results.map(row => this.rowToParty(row));
    }

    // ========== Row converters ==========

    private rowToParty(row: PartyRow): Party {
        return PartySchema.parse({
            id: row.id,
            name: row.name,
            description: row.description ?? undefined,
            worldId: row.world_id ?? undefined,
            status: row.status,
            currentLocation: row.current_location ?? undefined,
            currentQuestId: row.current_quest_id ?? undefined,
            formation: row.formation,
            positionX: (row as any).position_x ?? undefined,
            positionY: (row as any).position_y ?? undefined,
            currentPOI: (row as any).current_poi ?? undefined,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            lastPlayedAt: row.last_played_at ?? undefined,
        });
    }

    private rowToMember(row: PartyMemberRow): PartyMember {
        return PartyMemberSchema.parse({
            id: row.id,
            partyId: row.party_id,
            characterId: row.character_id,
            role: row.role,
            isActive: row.is_active === 1,
            position: row.position ?? undefined,
            sharePercentage: row.share_percentage,
            joinedAt: row.joined_at,
            notes: row.notes ?? undefined,
        });
    }
}
