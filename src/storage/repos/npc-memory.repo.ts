import Database from 'better-sqlite3';

/**
 * HIGH-004: NPC Memory Repository
 * Tracks relationships and conversation history between PCs and NPCs
 */

export type Familiarity = 'stranger' | 'acquaintance' | 'friend' | 'close_friend' | 'rival' | 'enemy';
export type Disposition = 'hostile' | 'unfriendly' | 'neutral' | 'friendly' | 'helpful';
export type Importance = 'low' | 'medium' | 'high' | 'critical';

export interface NpcRelationship {
    characterId: string;
    npcId: string;
    familiarity: Familiarity;
    disposition: Disposition;
    notes: string | null;
    firstMetAt: string;
    lastInteractionAt: string;
    interactionCount: number;
}

export interface ConversationMemory {
    id: number;
    characterId: string;
    npcId: string;
    summary: string;
    importance: Importance;
    topics: string[];
    createdAt: string;
}

interface RelationshipRow {
    character_id: string;
    npc_id: string;
    familiarity: string;
    disposition: string;
    notes: string | null;
    first_met_at: string;
    last_interaction_at: string;
    interaction_count: number;
}

interface MemoryRow {
    id: number;
    character_id: string;
    npc_id: string;
    summary: string;
    importance: string;
    topics: string;
    created_at: string;
}

export class NpcMemoryRepository {
    constructor(private db: Database.Database) {}

    // ============================================================
    // RELATIONSHIP METHODS
    // ============================================================

    /**
     * Get relationship between PC and NPC
     * Returns null if no relationship exists (they're strangers)
     */
    getRelationship(characterId: string, npcId: string): NpcRelationship | null {
        const stmt = this.db.prepare(`
            SELECT * FROM npc_relationships
            WHERE character_id = ? AND npc_id = ?
        `);
        const row = stmt.get(characterId, npcId) as RelationshipRow | undefined;

        if (!row) return null;
        return this.rowToRelationship(row);
    }

    /**
     * Create or update relationship between PC and NPC
     */
    upsertRelationship(relationship: Omit<NpcRelationship, 'firstMetAt' | 'lastInteractionAt' | 'interactionCount'> & {
        firstMetAt?: string;
        lastInteractionAt?: string;
        interactionCount?: number;
    }): NpcRelationship {
        const now = new Date().toISOString();
        const existing = this.getRelationship(relationship.characterId, relationship.npcId);

        if (existing) {
            // Update existing
            const stmt = this.db.prepare(`
                UPDATE npc_relationships
                SET familiarity = ?,
                    disposition = ?,
                    notes = ?,
                    last_interaction_at = ?,
                    interaction_count = interaction_count + 1
                WHERE character_id = ? AND npc_id = ?
            `);
            stmt.run(
                relationship.familiarity,
                relationship.disposition,
                relationship.notes ?? existing.notes,
                now,
                relationship.characterId,
                relationship.npcId
            );
        } else {
            // Create new
            const stmt = this.db.prepare(`
                INSERT INTO npc_relationships (character_id, npc_id, familiarity, disposition, notes, first_met_at, last_interaction_at, interaction_count)
                VALUES (?, ?, ?, ?, ?, ?, ?, 1)
            `);
            stmt.run(
                relationship.characterId,
                relationship.npcId,
                relationship.familiarity,
                relationship.disposition,
                relationship.notes ?? null,
                now,
                now
            );
        }

        return this.getRelationship(relationship.characterId, relationship.npcId)!;
    }

    /**
     * Get all NPCs a character has interacted with
     */
    getCharacterRelationships(characterId: string): NpcRelationship[] {
        const stmt = this.db.prepare(`
            SELECT * FROM npc_relationships
            WHERE character_id = ?
            ORDER BY last_interaction_at DESC
        `);
        const rows = stmt.all(characterId) as RelationshipRow[];
        return rows.map(row => this.rowToRelationship(row));
    }

    /**
     * Get all characters who have interacted with an NPC
     */
    getNpcRelationships(npcId: string): NpcRelationship[] {
        const stmt = this.db.prepare(`
            SELECT * FROM npc_relationships
            WHERE npc_id = ?
            ORDER BY last_interaction_at DESC
        `);
        const rows = stmt.all(npcId) as RelationshipRow[];
        return rows.map(row => this.rowToRelationship(row));
    }

    // ============================================================
    // CONVERSATION MEMORY METHODS
    // ============================================================

    /**
     * Record a conversation memory
     */
    recordMemory(memory: Omit<ConversationMemory, 'id' | 'createdAt'>): ConversationMemory {
        const now = new Date().toISOString();
        const stmt = this.db.prepare(`
            INSERT INTO conversation_memories (character_id, npc_id, summary, importance, topics, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        const result = stmt.run(
            memory.characterId,
            memory.npcId,
            memory.summary,
            memory.importance,
            JSON.stringify(memory.topics),
            now
        );

        return {
            ...memory,
            id: result.lastInsertRowid as number,
            createdAt: now
        };
    }

    /**
     * Get conversation history between PC and NPC
     */
    getConversationHistory(
        characterId: string,
        npcId: string,
        options?: {
            minImportance?: Importance;
            limit?: number;
        }
    ): ConversationMemory[] {
        let query = `
            SELECT * FROM conversation_memories
            WHERE character_id = ? AND npc_id = ?
        `;
        const params: (string | number)[] = [characterId, npcId];

        if (options?.minImportance) {
            const importanceOrder: Record<Importance, number> = {
                'low': 1,
                'medium': 2,
                'high': 3,
                'critical': 4
            };
            const minLevel = importanceOrder[options.minImportance];
            // Filter by importance level using CASE
            query += ` AND CASE importance
                WHEN 'low' THEN 1
                WHEN 'medium' THEN 2
                WHEN 'high' THEN 3
                WHEN 'critical' THEN 4
            END >= ?`;
            params.push(minLevel);
        }

        query += ` ORDER BY id DESC`;

        if (options?.limit) {
            query += ` LIMIT ?`;
            params.push(options.limit);
        }

        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params) as MemoryRow[];
        return rows.map(row => this.rowToMemory(row));
    }

    /**
     * Get recent interactions across all NPCs for a character
     */
    getRecentInteractions(characterId: string, limit: number = 10): ConversationMemory[] {
        const stmt = this.db.prepare(`
            SELECT * FROM conversation_memories
            WHERE character_id = ?
            ORDER BY id DESC
            LIMIT ?
        `);
        const rows = stmt.all(characterId, limit) as MemoryRow[];
        return rows.map(row => this.rowToMemory(row));
    }

    /**
     * Search memories by topic
     */
    searchByTopic(characterId: string, topic: string): ConversationMemory[] {
        // SQLite JSON search - topics is stored as JSON array
        const stmt = this.db.prepare(`
            SELECT * FROM conversation_memories
            WHERE character_id = ?
            AND topics LIKE ?
            ORDER BY id DESC
        `);
        const rows = stmt.all(characterId, `%"${topic}"%`) as MemoryRow[];
        return rows.map(row => this.rowToMemory(row));
    }

    // ============================================================
    // HELPER METHODS
    // ============================================================

    private rowToRelationship(row: RelationshipRow): NpcRelationship {
        return {
            characterId: row.character_id,
            npcId: row.npc_id,
            familiarity: row.familiarity as Familiarity,
            disposition: row.disposition as Disposition,
            notes: row.notes,
            firstMetAt: row.first_met_at,
            lastInteractionAt: row.last_interaction_at,
            interactionCount: row.interaction_count
        };
    }

    private rowToMemory(row: MemoryRow): ConversationMemory {
        return {
            id: row.id,
            characterId: row.character_id,
            npcId: row.npc_id,
            summary: row.summary,
            importance: row.importance as Importance,
            topics: JSON.parse(row.topics),
            createdAt: row.created_at
        };
    }
}
