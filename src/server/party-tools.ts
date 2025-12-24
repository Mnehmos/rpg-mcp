import { randomUUID } from 'crypto';
import { z } from 'zod';
import { PartyRepository } from '../storage/repos/party.repo.js';
import { CharacterRepository } from '../storage/repos/character.repo.js';
import { QuestRepository } from '../storage/repos/quest.repo.js';
import {
    Party,
    PartyMember,
    MemberRoleSchema,
    PartyStatusSchema,
    PartyContext
} from '../schema/party.js';
import { getDb } from '../storage/index.js';
import { SessionContext } from './types.js';
import { RichFormatter } from './utils/formatter.js';

function ensureDb() {
    const dbPath = process.env.NODE_ENV === 'test'
        ? ':memory:'
        : process.env.RPG_DATA_DIR
            ? `${process.env.RPG_DATA_DIR}/rpg.db`
            : 'rpg.db';
    const db = getDb(dbPath);
    const partyRepo = new PartyRepository(db);
    const charRepo = new CharacterRepository(db);
    const questRepo = new QuestRepository(db);
    return { db, partyRepo, charRepo, questRepo };
}

// Tool definitions
export const PartyTools = {
    // Party CRUD
    CREATE_PARTY: {
        name: 'create_party',
        description: `Create a new party (adventuring group).

Example:
{
  "name": "The Fellowship",
  "description": "Nine companions on a quest to destroy the One Ring",
  "worldId": "middle-earth-id",
  "initialMembers": [
    { "characterId": "gandalf-id", "role": "leader" },
    { "characterId": "frodo-id", "role": "member" }
  ]
}`,
        inputSchema: z.object({
            name: z.string().min(1),
            description: z.string().optional(),
            worldId: z.string().optional(),
            initialMembers: z.array(z.object({
                characterId: z.string(),
                role: MemberRoleSchema.optional().default('member'),
            })).optional(),
        }),
    },

    GET_PARTY: {
        name: 'get_party',
        description: 'Get a party with all member details, leader, and active character info.',
        inputSchema: z.object({
            partyId: z.string(),
        }),
    },

    LIST_PARTIES: {
        name: 'list_parties',
        description: 'List all parties, optionally filtered by status or world.',
        inputSchema: z.object({
            status: PartyStatusSchema.optional(),
            worldId: z.string().optional(),
        }),
    },

    UPDATE_PARTY: {
        name: 'update_party',
        description: 'Update party properties (name, description, location, formation, status).',
        inputSchema: z.object({
            partyId: z.string(),
            name: z.string().min(1).optional(),
            description: z.string().optional(),
            currentLocation: z.string().optional(),
            formation: z.string().optional(),
            status: PartyStatusSchema.optional(),
        }),
    },

    DELETE_PARTY: {
        name: 'delete_party',
        description: 'Delete a party. Members become unassigned (not deleted).',
        inputSchema: z.object({
            partyId: z.string(),
        }),
    },

    // Member management
    ADD_PARTY_MEMBER: {
        name: 'add_party_member',
        description: 'Add a character to a party with role (leader, member, companion, hireling, prisoner, mount).',
        inputSchema: z.object({
            partyId: z.string(),
            characterId: z.string(),
            role: MemberRoleSchema.optional().default('member'),
            position: z.number().int().optional(),
            notes: z.string().optional(),
        }),
    },

    REMOVE_PARTY_MEMBER: {
        name: 'remove_party_member',
        description: 'Remove a character from a party.',
        inputSchema: z.object({
            partyId: z.string(),
            characterId: z.string(),
        }),
    },

    UPDATE_PARTY_MEMBER: {
        name: 'update_party_member',
        description: 'Update a party member\'s role, position, or notes.',
        inputSchema: z.object({
            partyId: z.string(),
            characterId: z.string(),
            role: MemberRoleSchema.optional(),
            position: z.number().int().optional(),
            sharePercentage: z.number().int().min(0).max(100).optional(),
            notes: z.string().optional(),
        }),
    },

    SET_PARTY_LEADER: {
        name: 'set_party_leader',
        description: 'Set the party leader. The character must already be a member.',
        inputSchema: z.object({
            partyId: z.string(),
            characterId: z.string(),
        }),
    },

    SET_ACTIVE_CHARACTER: {
        name: 'set_active_character',
        description: 'Set the active character (player\'s POV). The character must already be a member.',
        inputSchema: z.object({
            partyId: z.string(),
            characterId: z.string(),
        }),
    },

    GET_PARTY_MEMBERS: {
        name: 'get_party_members',
        description: 'Get all members of a party with their character details.',
        inputSchema: z.object({
            partyId: z.string(),
        }),
    },

    // Context for LLM
    GET_PARTY_CONTEXT: {
        name: 'get_party_context',
        description: 'Get party context for LLM prompts. Verbosity: minimal (~150 tokens), standard (~400), or detailed (~800).',
        inputSchema: z.object({
            partyId: z.string(),
            verbosity: z.enum(['minimal', 'standard', 'detailed']).optional().default('standard'),
        }),
    },

    // Utility
    GET_UNASSIGNED_CHARACTERS: {
        name: 'get_unassigned_characters',
        description: 'Get characters not assigned to any party. Useful for adding members.',
        inputSchema: z.object({
            excludeEnemies: z.boolean().optional().default(true),
        }),
    },

    // Party Position & Movement
    MOVE_PARTY: {
        name: 'move_party',
        description: 'Move a party to world map coordinates or POI. Updates location name and optional POI reference.',
        inputSchema: z.object({
            partyId: z.string(),
            targetX: z.number().int().nonnegative(),
            targetY: z.number().int().nonnegative(),
            locationName: z.string().min(1),
            poiId: z.string().optional(),
        }),
    },

    GET_PARTY_POSITION: {
        name: 'get_party_position',
        description: 'Get the current position of a party on the world map.',
        inputSchema: z.object({
            partyId: z.string(),
        }),
    },

    GET_PARTIES_IN_REGION: {
        name: 'get_parties_in_region',
        description: 'Get all parties within a certain distance of a coordinate (useful for finding nearby groups).',
        inputSchema: z.object({
            worldId: z.string(),
            x: z.number().int(),
            y: z.number().int(),
            radiusSquares: z.number().int().optional().default(3),
        }),
    },
} as const;

// ========== Handlers ==========

export async function handleCreateParty(args: unknown, _ctx: SessionContext) {
    const { partyRepo, charRepo } = ensureDb();
    const parsed = PartyTools.CREATE_PARTY.inputSchema.parse(args);

    const now = new Date().toISOString();
    const party: Party = {
        id: randomUUID(),
        name: parsed.name,
        description: parsed.description,
        worldId: parsed.worldId,
        status: 'active',
        formation: 'standard',
        createdAt: now,
        updatedAt: now,
        lastPlayedAt: now,
    };

    partyRepo.create(party);

    // Add initial members if provided
    const addedMembers: { characterId: string; name: string; role: string }[] = [];
    let leaderId: string | null = null;

    if (parsed.initialMembers && parsed.initialMembers.length > 0) {
        for (let i = 0; i < parsed.initialMembers.length; i++) {
            const memberInput = parsed.initialMembers[i];
            const character = charRepo.findById(memberInput.characterId);

            if (!character) {
                continue; // Skip invalid character IDs
            }

            const member: PartyMember = {
                id: randomUUID(),
                partyId: party.id,
                characterId: memberInput.characterId,
                role: memberInput.role || 'member',
                isActive: i === 0, // First member is active by default
                position: i + 1,
                sharePercentage: 100,
                joinedAt: now,
            };

            partyRepo.addMember(member);
            addedMembers.push({
                characterId: character.id,
                name: character.name,
                role: member.role,
            });

            if (member.role === 'leader') {
                leaderId = character.id;
            }
        }
    }

    let output = RichFormatter.header('Party Created', '⚔️');
    output += RichFormatter.keyValue({
        'ID': `\`${party.id}\``,
        'Name': party.name,
        'Status': party.status,
    });
    if (party.description) {
        output += `\n${party.description}\n`;
    }
    if (addedMembers.length > 0) {
        output += RichFormatter.section('Members');
        const rows = addedMembers.map(m => [m.name, m.role]);
        output += RichFormatter.table(['Name', 'Role'], rows);
    }
    output += RichFormatter.success('Party created!');
    output += RichFormatter.embedJson({ party, members: addedMembers, memberCount: addedMembers.length, leaderId }, 'PARTY');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleGetParty(args: unknown, _ctx: SessionContext) {
    const { partyRepo } = ensureDb();
    const parsed = PartyTools.GET_PARTY.inputSchema.parse(args);

    const party = partyRepo.getPartyWithMembers(parsed.partyId);
    if (!party) {
        throw new Error(`Party not found: ${parsed.partyId}`);
    }

    // Touch the party to update last_played_at
    partyRepo.touchParty(parsed.partyId);

    let output = RichFormatter.party(party as any);
    if (party.members && party.members.length > 0) {
        output += RichFormatter.section('Members');
        const rows = party.members.map((m: any) => [m.character?.name || m.characterId, m.role, m.isActive ? '⭐' : '']);
        output += RichFormatter.table(['Name', 'Role', 'Active'], rows);
    }
    output += RichFormatter.embedJson(party, 'PARTY');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleListParties(args: unknown, _ctx: SessionContext) {
    const { partyRepo } = ensureDb();
    const parsed = PartyTools.LIST_PARTIES.inputSchema.parse(args);

    const parties = partyRepo.findAll({
        status: parsed.status,
        worldId: parsed.worldId,
    });

    // Get member counts for each party
    const partiesWithCounts = parties.map(party => {
        const members = partyRepo.findMembersByParty(party.id);
        return {
            ...party,
            memberCount: members.length,
        };
    });

    let output = RichFormatter.header('Parties', '⚔️');
    if (partiesWithCounts.length === 0) {
        output += RichFormatter.alert('No parties found.', 'info');
    } else {
        const rows = partiesWithCounts.map(p => [p.name, p.status, String(p.memberCount)]);
        output += RichFormatter.table(['Name', 'Status', 'Members'], rows);
        output += `\n*${partiesWithCounts.length} party(ies) total*\n`;
    }
    output += RichFormatter.embedJson({ parties: partiesWithCounts, count: partiesWithCounts.length }, 'PARTIES');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleUpdateParty(args: unknown, _ctx: SessionContext) {
    const { partyRepo } = ensureDb();
    const parsed = PartyTools.UPDATE_PARTY.inputSchema.parse(args);

    const { partyId, ...updates } = parsed;
    const updated = partyRepo.update(partyId, updates);

    if (!updated) {
        throw new Error(`Party not found: ${partyId}`);
    }

    let output = RichFormatter.header('Party Updated', '✏️');
    output += RichFormatter.party(updated as any);
    output += RichFormatter.success('Party updated successfully.');
    output += RichFormatter.embedJson(updated, 'PARTY');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleDeleteParty(args: unknown, _ctx: SessionContext) {
    const { partyRepo } = ensureDb();
    const parsed = PartyTools.DELETE_PARTY.inputSchema.parse(args);

    const deleted = partyRepo.delete(parsed.partyId);
    if (!deleted) {
        throw new Error(`Party not found: ${parsed.partyId}`);
    }

    let output = RichFormatter.header('Party Deleted', '🗑️');
    output += RichFormatter.keyValue({ 'ID': `\`${parsed.partyId}\`` });
    output += RichFormatter.success('Party deleted. Members are now unassigned.');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleAddPartyMember(args: unknown, _ctx: SessionContext) {
    const { partyRepo, charRepo } = ensureDb();
    const parsed = PartyTools.ADD_PARTY_MEMBER.inputSchema.parse(args);

    // Verify party exists
    const party = partyRepo.findById(parsed.partyId);
    if (!party) {
        throw new Error(`Party not found: ${parsed.partyId}`);
    }

    // Verify character exists
    const character = charRepo.findById(parsed.characterId);
    if (!character) {
        throw new Error(`Character not found: ${parsed.characterId}`);
    }

    // Check if already a member
    const existing = partyRepo.findMember(parsed.partyId, parsed.characterId);
    if (existing) {
        throw new Error(`Character ${character.name} is already in party ${party.name}`);
    }

    // If adding as leader, demote existing leader
    if (parsed.role === 'leader') {
        partyRepo.setLeader(parsed.partyId, parsed.characterId);
    }

    const now = new Date().toISOString();
    const member: PartyMember = {
        id: randomUUID(),
        partyId: parsed.partyId,
        characterId: parsed.characterId,
        role: parsed.role || 'member',
        isActive: false,
        position: parsed.position,
        sharePercentage: 100,
        joinedAt: now,
        notes: parsed.notes,
    };

    partyRepo.addMember(member);
    partyRepo.touchParty(parsed.partyId);

    let output = RichFormatter.header('Member Added', '➕');
    output += RichFormatter.keyValue({
        'Character': character.name,
        'Party': party.name,
        'Role': member.role,
    });
    output += RichFormatter.success(`${character.name} joined the party!`);

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleRemovePartyMember(args: unknown, _ctx: SessionContext) {
    const { partyRepo, charRepo } = ensureDb();
    const parsed = PartyTools.REMOVE_PARTY_MEMBER.inputSchema.parse(args);

    const character = charRepo.findById(parsed.characterId);
    const removed = partyRepo.removeMember(parsed.partyId, parsed.characterId);

    if (!removed) {
        throw new Error(`Member not found in party`);
    }

    let output = RichFormatter.header('Member Removed', '➖');
    output += RichFormatter.keyValue({
        'Character': character?.name || parsed.characterId,
    });
    output += RichFormatter.success('Member removed from party.');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleUpdatePartyMember(args: unknown, _ctx: SessionContext) {
    const { partyRepo } = ensureDb();
    const parsed = PartyTools.UPDATE_PARTY_MEMBER.inputSchema.parse(args);

    const { partyId, characterId, ...updates } = parsed;
    const updated = partyRepo.updateMember(partyId, characterId, updates);

    if (!updated) {
        throw new Error(`Member not found in party`);
    }

    let output = RichFormatter.header('Member Updated', '✏️');
    output += RichFormatter.keyValue((updated as any));
    output += RichFormatter.success('Member updated successfully.');
    output += RichFormatter.embedJson(updated, 'MEMBER');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleSetPartyLeader(args: unknown, _ctx: SessionContext) {
    const { partyRepo, charRepo } = ensureDb();
    const parsed = PartyTools.SET_PARTY_LEADER.inputSchema.parse(args);

    // Verify member exists
    const member = partyRepo.findMember(parsed.partyId, parsed.characterId);
    if (!member) {
        throw new Error(`Character is not a member of this party`);
    }

    const character = charRepo.findById(parsed.characterId);
    partyRepo.setLeader(parsed.partyId, parsed.characterId);
    partyRepo.touchParty(parsed.partyId);

    let output = RichFormatter.header('Leader Set', '👑');
    output += RichFormatter.keyValue({
        'New Leader': character?.name || parsed.characterId,
    });
    output += RichFormatter.success('Party leader updated!');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleSetActiveCharacter(args: unknown, _ctx: SessionContext) {
    const { partyRepo, charRepo } = ensureDb();
    const parsed = PartyTools.SET_ACTIVE_CHARACTER.inputSchema.parse(args);

    // Verify member exists
    const member = partyRepo.findMember(parsed.partyId, parsed.characterId);
    if (!member) {
        throw new Error(`Character is not a member of this party`);
    }

    const character = charRepo.findById(parsed.characterId);
    partyRepo.setActiveCharacter(parsed.partyId, parsed.characterId);
    partyRepo.touchParty(parsed.partyId);

    let output = RichFormatter.header('Active Character Set', '⭐');
    output += RichFormatter.keyValue({
        'Active Character': character?.name || parsed.characterId,
    });
    output += RichFormatter.success('Active character updated!');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleGetPartyMembers(args: unknown, _ctx: SessionContext) {
    const { partyRepo } = ensureDb();
    const parsed = PartyTools.GET_PARTY_MEMBERS.inputSchema.parse(args);

    const party = partyRepo.getPartyWithMembers(parsed.partyId);
    if (!party) {
        throw new Error(`Party not found: ${parsed.partyId}`);
    }

    let output = RichFormatter.header(`${party.name} - Members`, '👥');
    if (party.leader) {
        output += RichFormatter.keyValue({ 'Leader': (party.leader as any).character?.name || 'Unknown' });
    }
    if (party.members && party.members.length > 0) {
        const rows = party.members.map((m: any) => [
            m.character?.name || m.characterId,
            m.role,
            m.isActive ? '⭐' : '',
        ]);
        output += RichFormatter.table(['Name', 'Role', 'Active'], rows);
    }
    output += `\n*${party.memberCount} member(s)*\n`;
    output += RichFormatter.embedJson({ partyId: party.id, partyName: party.name, members: party.members }, 'MEMBERS');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleGetPartyContext(args: unknown, _ctx: SessionContext) {
    const { partyRepo, questRepo } = ensureDb();
    const parsed = PartyTools.GET_PARTY_CONTEXT.inputSchema.parse(args);

    const party = partyRepo.getPartyWithMembers(parsed.partyId);
    if (!party) {
        throw new Error(`Party not found: ${parsed.partyId}`);
    }

    // Build context based on verbosity
    const context: PartyContext = {
        party: {
            id: party.id,
            name: party.name,
            status: party.status,
            location: party.currentLocation,
            formation: party.formation,
        },
        members: party.members.map(m => ({
            name: m.character.name,
            role: m.role,
            hp: `${m.character.hp}/${m.character.maxHp}`,
            status: m.character.hp < m.character.maxHp * 0.25 ? 'critical' :
                m.character.hp < m.character.maxHp * 0.5 ? 'wounded' :
                    m.character.hp < m.character.maxHp ? 'hurt' : 'healthy',
        })),
    };

    if (party.leader) {
        context.leader = {
            id: party.leader.character.id,
            name: party.leader.character.name,
            hp: party.leader.character.hp,
            maxHp: party.leader.character.maxHp,
            level: party.leader.character.level,
        };
    }

    if (party.activeCharacter) {
        context.activeCharacter = {
            id: party.activeCharacter.character.id,
            name: party.activeCharacter.character.name,
            hp: party.activeCharacter.character.hp,
            maxHp: party.activeCharacter.character.maxHp,
            level: party.activeCharacter.character.level,
            conditions: party.activeCharacter.character.hp < party.activeCharacter.character.maxHp * 0.5
                ? ['wounded'] : undefined,
        };
    }

    // Add quest info if available
    if (party.currentQuestId) {
        try {
            const quest = questRepo.findById(party.currentQuestId);
            if (quest) {
                const completedCount = quest.objectives.filter((o: any) => o.completed).length;
                context.activeQuest = {
                    name: quest.name,
                    currentObjective: quest.objectives.find((o: any) => !o.completed)?.description,
                    progress: `${Math.round((completedCount / quest.objectives.length) * 100)}%`,
                };
            }
        } catch (e) {
            // Quest not found, skip
        }
    }

    partyRepo.touchParty(parsed.partyId);

    let output = RichFormatter.header(`${context.party.name} - Context`, '📋');
    output += RichFormatter.keyValue({
        'Status': context.party.status,
        'Location': context.party.location || 'Unknown',
        'Formation': context.party.formation || 'Standard',
    });
    if (context.leader) {
        output += RichFormatter.section('Leader');
        output += RichFormatter.keyValue({
            'Name': context.leader.name,
            'HP': `${context.leader.hp}/${context.leader.maxHp}`,
            'Level': context.leader.level,
        });
    }
    if (context.members && context.members.length > 0) {
        output += RichFormatter.section('Party Members');
        const rows = context.members.map((m: any) => [m.name, m.role, m.hp, m.status]);
        output += RichFormatter.table(['Name', 'Role', 'HP', 'Status'], rows);
    }
    if (context.activeQuest) {
        output += RichFormatter.section('Active Quest');
        output += RichFormatter.keyValue({
            'Quest': context.activeQuest.name,
            'Objective': context.activeQuest.currentObjective || '-',
            'Progress': context.activeQuest.progress,
        });
    }
    output += RichFormatter.embedJson(context, 'CONTEXT');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

export async function handleGetUnassignedCharacters(args: unknown, _ctx: SessionContext) {
    const { partyRepo } = ensureDb();
    const parsed = PartyTools.GET_UNASSIGNED_CHARACTERS.inputSchema.parse(args);

    const excludeTypes = parsed.excludeEnemies ? ['enemy'] : undefined;
    const characters = partyRepo.getUnassignedCharacters(excludeTypes);

    let output = RichFormatter.header('Unassigned Characters', '👤');
    output += RichFormatter.characterList(characters as any);
    output += `\n*${characters.length} unassigned character(s)*\n`;
    output += RichFormatter.embedJson({ characters, count: characters.length }, 'CHARACTERS');

    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

// ========== Party Position & Movement Handlers ==========

export async function handleMoveParty(args: unknown, _ctx: SessionContext) {
    const { partyRepo } = ensureDb();
    const parsed = PartyTools.MOVE_PARTY.inputSchema.parse(args);

    try {
        // Validate party exists
        const party = partyRepo.findById(parsed.partyId);
        if (!party) {
            throw new Error(`Party not found: ${parsed.partyId}`);
        }

        // Update party position
        const updatedParty = partyRepo.updatePartyPosition(
            parsed.partyId,
            parsed.targetX,
            parsed.targetY,
            parsed.locationName,
            parsed.poiId
        );

        if (!updatedParty) {
            throw new Error(`Failed to update party position: ${parsed.partyId}`);
        }

        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify({
                    success: true,
                    party: updatedParty,
                    newPosition: {
                        x: parsed.targetX,
                        y: parsed.targetY,
                        location: parsed.locationName,
                        poiId: parsed.poiId || null,
                    },
                    message: `Party "${updatedParty.name}" moved to ${parsed.locationName} (${parsed.targetX}, ${parsed.targetY})`,
                }, null, 2)
            }]
        };
    } catch (error: any) {
        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify({
                    success: false,
                    error: error.message || 'Failed to move party',
                }, null, 2)
            }]
        };
    }
}

export async function handleGetPartyPosition(args: unknown, _ctx: SessionContext) {
    const { partyRepo } = ensureDb();
    const parsed = PartyTools.GET_PARTY_POSITION.inputSchema.parse(args);

    try {
        const party = partyRepo.findById(parsed.partyId);
        if (!party) {
            throw new Error(`Party not found: ${parsed.partyId}`);
        }

        const position = partyRepo.getPartyPosition(parsed.partyId);

        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify({
                    success: true,
                    party: {
                        id: party.id,
                        name: party.name,
                    },
                    position: position || {
                        x: null,
                        y: null,
                        locationName: 'Unknown',
                        poiId: null,
                    },
                }, null, 2)
            }]
        };
    } catch (error: any) {
        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify({
                    success: false,
                    error: error.message || 'Failed to get party position',
                }, null, 2)
            }]
        };
    }
}

export async function handleGetPartiesInRegion(args: unknown, _ctx: SessionContext) {
    const { partyRepo } = ensureDb();
    const parsed = PartyTools.GET_PARTIES_IN_REGION.inputSchema.parse(args);

    try {
        const parties = partyRepo.getPartiesNearPosition(
            parsed.worldId,
            parsed.x,
            parsed.y,
            parsed.radiusSquares
        );

        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify({
                    success: true,
                    count: parties.length,
                    parties,
                    message: `Found ${parties.length} parties within ${parsed.radiusSquares} squares of (${parsed.x}, ${parsed.y})`,
                }, null, 2)
            }]
        };
    } catch (error: any) {
        return {
            content: [{
                type: 'text' as const,
                text: JSON.stringify({
                    success: false,
                    error: error.message || 'Failed to get parties in region',
                }, null, 2)
            }]
        };
    }
}
