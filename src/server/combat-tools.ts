import { z } from 'zod';
import { CombatEngine, CombatParticipant } from '../engine/combat/engine';

import { PubSub } from '../engine/pubsub';

// Global combat state (in-memory for MVP)
let currentEncounter: { engine: CombatEngine; id: string } | null = null;
let pubsub: PubSub | null = null;

export function setCombatPubSub(instance: PubSub) {
    pubsub = instance;
}

// Tool definitions
export const CombatTools = {
    CREATE_ENCOUNTER: {
        name: 'create_encounter',
        description: `Create a new combat encounter with the specified participants.

Example:
{
  "seed": "battle-1",
  "participants": [
    {
      "id": "hero-1",
      "name": "Valeros",
      "initiativeBonus": 2,
      "hp": 20,
      "maxHp": 20
    },
    {
      "id": "goblin-1",
      "name": "Goblin",
      "initiativeBonus": 1,
      "hp": 7,
      "maxHp": 7
    }
  ]
}`,
        inputSchema: z.object({
            seed: z.string().describe('Seed for deterministic combat resolution'),
            participants: z.array(z.object({
                id: z.string(),
                name: z.string(),
                initiativeBonus: z.number().int(),
                hp: z.number().int().positive(),
                maxHp: z.number().int().positive(),
                conditions: z.array(z.any()).default([])
            })).min(1)
        })
    },
    GET_ENCOUNTER_STATE: {
        name: 'get_encounter_state',
        description: 'Get the current state of the active combat encounter.',
        inputSchema: z.object({})
    },
    EXECUTE_COMBAT_ACTION: {
        name: 'execute_combat_action',
        description: `Execute a combat action (attack, heal, etc.).

Examples:
{
  "action": "attack",
  "actorId": "hero-1",
  "targetId": "goblin-1",
  "attackBonus": 5,
  "dc": 12,
  "damage": 6
}

{
  "action": "heal",
  "actorId": "cleric-1",
  "targetId": "hero-1",
  "amount": 8
}`,
        inputSchema: z.object({
            action: z.enum(['attack', 'heal']),
            actorId: z.string(),
            targetId: z.string(),
            attackBonus: z.number().int().optional(),
            dc: z.number().int().optional(),
            damage: z.number().int().optional(),
            amount: z.number().int().optional()
        })
    },
    ADVANCE_TURN: {
        name: 'advance_turn',
        description: 'Advance to the next combatant\'s turn.',
        inputSchema: z.object({})
    },
    END_ENCOUNTER: {
        name: 'end_encounter',
        description: 'End the current combat encounter.',
        inputSchema: z.object({})
    }
} as const;

// Tool handlers
export async function handleCreateEncounter(args: unknown) {
    if (currentEncounter) {
        throw new Error('An encounter is already in progress. End it first.');
    }

    const parsed = CombatTools.CREATE_ENCOUNTER.inputSchema.parse(args);

    // Create combat engine
    const engine = new CombatEngine(parsed.seed, pubsub || undefined);

    // Convert participants to proper format
    const participants: CombatParticipant[] = parsed.participants.map(p => ({
        ...p,
        conditions: []
    }));

    // Start encounter
    const state = engine.startEncounter(participants);

    // Generate encounter ID
    const encounterId = `encounter-${parsed.seed}-${Date.now()}`;
    currentEncounter = { engine, id: encounterId };

    const currentParticipant = engine.getCurrentParticipant();

    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify({
                    encounterId,
                    message: 'Combat encounter started',
                    turnOrder: state.turnOrder,
                    round: state.round,
                    currentTurn: currentParticipant?.name || null
                }, null, 2)
            }
        ]
    };
}

export async function handleGetEncounterState(args: unknown) {
    if (!currentEncounter) {
        throw new Error('No active encounter. Create one first.');
    }

    CombatTools.GET_ENCOUNTER_STATE.inputSchema.parse(args);

    const state = currentEncounter.engine.getState();
    if (!state) {
        throw new Error('No active encounter');
    }

    const currentParticipant = currentEncounter.engine.getCurrentParticipant();

    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify({
                    encounterId: currentEncounter.id,
                    round: state.round,
                    currentTurn: {
                        participantId: currentParticipant?.id,
                        participantName: currentParticipant?.name
                    },
                    participants: state.participants.map(p => ({
                        id: p.id,
                        name: p.name,
                        hp: p.hp,
                        maxHp: p.maxHp,
                        conditions: p.conditions
                    })),
                    turnOrder: state.turnOrder
                }, null, 2)
            }
        ]
    };
}

export async function handleExecuteCombatAction(args: unknown) {
    if (!currentEncounter) {
        throw new Error('No active encounter. Create one first.');
    }

    const parsed = CombatTools.EXECUTE_COMBAT_ACTION.inputSchema.parse(args);
    const { engine } = currentEncounter;

    let result: any = {
        action: parsed.action,
        actorId: parsed.actorId,
        targetId: parsed.targetId
    };

    if (parsed.action === 'attack') {
        if (parsed.attackBonus === undefined || parsed.dc === undefined) {
            throw new Error('Attack action requires attackBonus and dc');
        }

        // Make attack check
        const degree = engine.makeCheck(parsed.attackBonus, parsed.dc);
        const success = degree === 'success' || degree === 'critical-success';

        result.success = success;
        result.degree = degree;

        if (success && parsed.damage) {
            engine.applyDamage(parsed.targetId, parsed.damage);
            result.damageDealt = parsed.damage;
        } else {
            result.damageDealt = 0;
        }
    } else if (parsed.action === 'heal') {
        if (parsed.amount === undefined) {
            throw new Error('Heal action requires amount');
        }

        engine.heal(parsed.targetId, parsed.amount);
        result.amountHealed = parsed.amount;
    }

    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify(result, null, 2)
            }
        ]
    };
}

export async function handleAdvanceTurn(args: unknown) {
    if (!currentEncounter) {
        throw new Error('No active encounter. Create one first.');
    }

    CombatTools.ADVANCE_TURN.inputSchema.parse(args);

    const previousParticipant = currentEncounter.engine.getCurrentParticipant();
    const newParticipant = currentEncounter.engine.nextTurnWithConditions();
    const state = currentEncounter.engine.getState();

    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify({
                    previousTurn: previousParticipant?.name || null,
                    currentTurn: newParticipant?.name || null,
                    round: state?.round || 0
                }, null, 2)
            }
        ]
    };
}

export async function handleEndEncounter(args: unknown) {
    if (!currentEncounter) {
        throw new Error('No active encounter.');
    }

    CombatTools.END_ENCOUNTER.inputSchema.parse(args);

    const encounterId = currentEncounter.id;
    currentEncounter = null;

    return {
        content: [
            {
                type: 'text' as const,
                text: JSON.stringify({
                    message: 'Encounter ended',
                    encounterId
                }, null, 2)
            }
        ]
    };
}

// Helper for tests
export function clearCombatState() {
    currentEncounter = null;
}
