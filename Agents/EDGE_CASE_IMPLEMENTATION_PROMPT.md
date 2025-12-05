# RPG-MCP Edge Case Implementation Prompt
## For: Coding Team / Claude Code Agent
## Date: December 5, 2025
## Priority: P0-P2 Implementation Queue

---

## CRITICAL CONTEXT: READ FIRST

Before implementing ANY features in this document:

1. **Review the Agents/ folder** for existing patterns and resolved issues
2. **Check EMERGENT_DISCOVERY_LOG.md** for related bugs/fixes
3. **Follow TDD workflow** from `/mnt/project/_QUEST_KEEPER_AI_-_COMPREHENSIVE_AUDIT___TDD_FRAMEWORK`
4. **Use the Git Pulse pattern**: Commit after each working test (RED → GREEN → COMMIT)

### Architecture Principle: "LLM Describes, Engine Validates"
The LLM acts as a **Logic Adapter** translating creative player intent into hard mathematical inputs. The engine NEVER trusts raw LLM output—all game state changes flow through validated MCP tool calls.

---

## PART 1: THE "RULE OF COOL" SYSTEM (P0 - CRITICAL)

### 1.1 Improvised Stunt Resolution Tool

**Problem**: Players do creative things not covered by standard rules (kick mine cart, swing chandelier, collapse ceiling). Without this tool, the AI either:
- Refuses creative actions (bad UX)
- Hallucinates damage/effects (breaks trust)

**Solution**: A single flexible tool that lets the AI construct mini-mechanics JIT.

```typescript
// File: src/server/stunt-tools.ts

import { z } from 'zod';

export const StuntTools = {
    RESOLVE_IMPROVISED_STUNT: {
        name: 'resolve_improvised_stunt',
        description: `Resolves creative player actions not covered by standard combat rules.
        
The AI DM uses this to translate narrative creativity into mechanical outcomes.
Examples:
- Kicking a mine cart into enemies
- Swinging from a chandelier
- Collapsing a bookshelf onto foes
- Using a chair as an improvised weapon
- Tripping an enemy with a rope

The AI MUST set appropriate DC and damage based on:
- Object mass/danger level
- Environmental plausibility
- Dramatic appropriateness

Guidelines:
- Tiny objects (bottle, rock): 1d4 damage, DC 10
- Small objects (chair, torch): 1d6 damage, DC 12
- Medium objects (table, barrel): 2d6 damage, DC 14
- Large objects (cart, statue): 3d6-4d6 damage, DC 15-16
- Massive objects (boulder, collapse): 6d6-8d6 damage, DC 17-20
- Explosive/magical amplification: +2d6 to +4d6

CRITICAL: This tool exists to VALIDATE creative play, not to enable cheating.
The AI should set DCs that are challenging but fair.`,
        inputSchema: z.object({
            encounterId: z.string().describe('The encounter this stunt occurs in'),
            actorId: z.string().describe('The character attempting the stunt'),
            targetIds: z.array(z.string()).optional()
                .describe('IDs of creatures affected by the stunt'),
            narrativeIntent: z.string()
                .describe('What is the player trying to do? Be specific.'),
            skillCheck: z.object({
                skill: z.enum([
                    'athletics', 'acrobatics', 'sleight_of_hand',
                    'stealth', 'arcana', 'history', 'investigation',
                    'nature', 'religion', 'animal_handling', 'insight',
                    'medicine', 'perception', 'survival', 'deception',
                    'intimidation', 'performance', 'persuasion',
                    'strength', 'dexterity', 'constitution',
                    'intelligence', 'wisdom', 'charisma'
                ]).describe('The skill or ability check required'),
                dc: z.number().int().min(5).max(30)
                    .describe('Difficulty Class (5=trivial, 15=medium, 20=hard, 25=heroic, 30=legendary)'),
                advantage: z.boolean().optional()
                    .describe('Does the actor have advantage on this check?'),
                disadvantage: z.boolean().optional()
                    .describe('Does the actor have disadvantage on this check?')
            }),
            consequences: z.object({
                successDamage: z.string().optional()
                    .describe('Dice notation for damage on success (e.g., "3d6")'),
                failureDamage: z.string().optional()
                    .describe('Dice notation for self-damage on critical failure'),
                damageType: z.enum([
                    'bludgeoning', 'piercing', 'slashing', 'fire', 'cold',
                    'lightning', 'thunder', 'poison', 'acid', 'necrotic',
                    'radiant', 'force', 'psychic'
                ]).default('bludgeoning'),
                applyCondition: z.enum([
                    'prone', 'restrained', 'stunned', 'blinded',
                    'deafened', 'frightened', 'grappled', 'none'
                ]).optional().default('none'),
                conditionDuration: z.number().int().min(1).max(10).optional()
                    .describe('Rounds the condition lasts'),
                conditionSaveDC: z.number().int().optional()
                    .describe('DC to end the condition early (save at end of turn)'),
                moveTarget: z.boolean().optional()
                    .describe('Does this physically displace targets?'),
                moveDistance: z.number().int().optional()
                    .describe('Tiles to move targets (if moveTarget is true)'),
                areaOfEffect: z.object({
                    shape: z.enum(['line', 'cone', 'sphere', 'cube']),
                    size: z.number().int().min(1).max(60)
                        .describe('Size in feet')
                }).optional().describe('For stunts affecting an area'),
                savingThrow: z.object({
                    ability: z.enum(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']),
                    dc: z.number().int().min(1).max(30),
                    halfDamageOnSave: z.boolean().default(true)
                }).optional().describe('If targets get a save to reduce effect')
            }),
            environmentalDestruction: z.boolean().optional()
                .describe('Does this destroy/modify the environment permanently?'),
            narrativeOnSuccess: z.string().optional()
                .describe('Flavor text for successful stunt'),
            narrativeOnFailure: z.string().optional()
                .describe('Flavor text for failed stunt')
        })
    }
} as const;
```

### 1.2 Implementation Handler

```typescript
// File: src/server/stunt-tools.ts (continued)

export async function handleResolveImprovisedStunt(args: unknown, ctx: SessionContext) {
    const parsed = StuntTools.RESOLVE_IMPROVISED_STUNT.inputSchema.parse(args);
    
    const engine = getCombatManager().get(`${ctx.sessionId}:${parsed.encounterId}`);
    if (!engine) {
        throw new Error(`No active encounter with ID ${parsed.encounterId}`);
    }
    
    const state = engine.getState();
    if (!state) {
        throw new Error('Encounter has no active state');
    }
    
    const actor = state.participants.find(p => p.id === parsed.actorId);
    if (!actor) {
        throw new Error(`Actor ${parsed.actorId} not found`);
    }
    
    // Get actor's skill/ability modifier
    const modifier = getSkillModifier(actor, parsed.skillCheck.skill);
    
    // Roll the skill check
    let roll1 = Math.floor(Math.random() * 20) + 1;
    let roll2 = Math.floor(Math.random() * 20) + 1;
    let finalRoll = roll1;
    
    if (parsed.skillCheck.advantage && !parsed.skillCheck.disadvantage) {
        finalRoll = Math.max(roll1, roll2);
    } else if (parsed.skillCheck.disadvantage && !parsed.skillCheck.advantage) {
        finalRoll = Math.min(roll1, roll2);
    }
    
    const total = finalRoll + modifier;
    const isNat20 = finalRoll === 20;
    const isNat1 = finalRoll === 1;
    const success = isNat20 || (total >= parsed.skillCheck.dc && !isNat1);
    const critSuccess = isNat20 || total >= parsed.skillCheck.dc + 10;
    const critFailure = isNat1 || total <= parsed.skillCheck.dc - 10;
    
    // Build output
    let output = `\n┌─────────────────────────────────────────┐\n`;
    output += `│ 🎭 IMPROVISED STUNT\n`;
    output += `└─────────────────────────────────────────┘\n\n`;
    output += `${actor.name} attempts: "${parsed.narrativeIntent}"\n\n`;
    
    // Show roll
    output += `🎲 ${parsed.skillCheck.skill.toUpperCase()} Check: `;
    if (parsed.skillCheck.advantage) output += `(Advantage) `;
    if (parsed.skillCheck.disadvantage) output += `(Disadvantage) `;
    output += `d20(${finalRoll}) + ${modifier} = ${total} vs DC ${parsed.skillCheck.dc}\n`;
    
    if (isNat20) output += `   ⭐ NATURAL 20!\n`;
    if (isNat1) output += `   💀 NATURAL 1!\n`;
    output += `   ${success ? '✅ SUCCESS' : '❌ FAILURE'}`;
    if (critSuccess) output += ` (CRITICAL!)`;
    if (critFailure) output += ` (CRITICAL FAILURE!)`;
    output += `\n\n`;
    
    const results: StuntResult[] = [];
    
    if (success) {
        // Apply success effects
        if (parsed.narrativeOnSuccess) {
            output += `📖 ${parsed.narrativeOnSuccess}\n\n`;
        }
        
        // Damage targets
        if (parsed.consequences.successDamage && parsed.targetIds?.length) {
            const baseDamage = rollDice(parsed.consequences.successDamage);
            const actualDamage = critSuccess ? baseDamage * 2 : baseDamage;
            
            output += `💥 Damage: ${parsed.consequences.successDamage} = ${actualDamage}`;
            if (critSuccess) output += ` (DOUBLED!)`;
            output += ` ${parsed.consequences.damageType}\n\n`;
            
            for (const targetId of parsed.targetIds) {
                const target = state.participants.find(p => p.id === targetId);
                if (!target) continue;
                
                let finalDamage = actualDamage;
                
                // Allow saving throw
                if (parsed.consequences.savingThrow) {
                    const saveMod = getSaveModifier(target, parsed.consequences.savingThrow.ability);
                    const saveRoll = Math.floor(Math.random() * 20) + 1;
                    const saveTotal = saveRoll + saveMod;
                    const saved = saveTotal >= parsed.consequences.savingThrow.dc;
                    
                    output += `   ${target.name} ${parsed.consequences.savingThrow.ability.toUpperCase()} Save: `;
                    output += `d20(${saveRoll}) + ${saveMod} = ${saveTotal} vs DC ${parsed.consequences.savingThrow.dc} `;
                    output += saved ? '✓ SAVED' : '✗ FAILED';
                    output += `\n`;
                    
                    if (saved && parsed.consequences.savingThrow.halfDamageOnSave) {
                        finalDamage = Math.floor(actualDamage / 2);
                    } else if (saved) {
                        finalDamage = 0;
                    }
                }
                
                // Apply damage
                const hpBefore = target.hp;
                engine.applyDamage(targetId, finalDamage);
                const targetAfter = state.participants.find(p => p.id === targetId)!;
                
                output += `   ${target.name}: ${hpBefore} → ${targetAfter.hp}/${target.maxHp} HP`;
                if (targetAfter.hp <= 0) output += ' 💀 DEFEATED';
                output += `\n`;
                
                // Apply condition
                if (parsed.consequences.applyCondition && parsed.consequences.applyCondition !== 'none') {
                    engine.applyCondition(targetId, {
                        type: parsed.consequences.applyCondition as any,
                        durationType: 'rounds' as any,
                        duration: parsed.consequences.conditionDuration || 1,
                        saveDC: parsed.consequences.conditionSaveDC,
                        saveAbility: 'constitution'
                    });
                    output += `   ⚡ ${target.name} is ${parsed.consequences.applyCondition.toUpperCase()}!\n`;
                }
                
                results.push({
                    targetId,
                    targetName: target.name,
                    damage: finalDamage,
                    condition: parsed.consequences.applyCondition,
                    defeated: targetAfter.hp <= 0
                });
            }
        }
    } else {
        // Apply failure effects
        if (parsed.narrativeOnFailure) {
            output += `📖 ${parsed.narrativeOnFailure}\n\n`;
        }
        
        // Critical failure self-damage
        if (critFailure && parsed.consequences.failureDamage) {
            const selfDamage = rollDice(parsed.consequences.failureDamage);
            const hpBefore = actor.hp;
            engine.applyDamage(parsed.actorId, selfDamage);
            const actorAfter = state.participants.find(p => p.id === parsed.actorId)!;
            
            output += `💥 ${actor.name} takes ${selfDamage} damage from the failed stunt!\n`;
            output += `   ${actor.name}: ${hpBefore} → ${actorAfter.hp}/${actor.maxHp} HP\n`;
        }
    }
    
    // Create audit log entry
    const auditEntry = {
        type: 'improvised_stunt',
        actorId: parsed.actorId,
        actorName: actor.name,
        intent: parsed.narrativeIntent,
        skill: parsed.skillCheck.skill,
        dc: parsed.skillCheck.dc,
        roll: finalRoll,
        total,
        success,
        critSuccess,
        critFailure,
        results,
        timestamp: new Date().toISOString()
    };
    
    output += `\n[STUNT_LOG: ${JSON.stringify(auditEntry)}]\n`;
    output += `\n→ Call advance_turn to proceed`;
    
    // Save state
    const db = getDb(process.env.NODE_ENV === 'test' ? ':memory:' : 'rpg.db');
    const repo = new EncounterRepository(db);
    repo.saveState(parsed.encounterId, engine.getState()!);
    
    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

interface StuntResult {
    targetId: string;
    targetName: string;
    damage?: number;
    condition?: string;
    defeated: boolean;
}
```

---

## PART 2: ACTION ECONOMY ENFORCEMENT (P0 - CRITICAL)

### 2.1 The Problem

From playtest (T2.1): Players can use multiple bonus actions per turn. The system doesn't track action economy.

### 2.2 Schema Addition

```typescript
// Add to CombatParticipant interface in src/engine/combat/engine.ts

export interface CombatParticipant {
    // ... existing fields ...
    
    // ACTION ECONOMY (per turn)
    actionUsed: boolean;
    bonusActionUsed: boolean;
    reactionUsed: boolean;  // Already exists for opportunity attacks
    movementUsed: number;   // Feet of movement used this turn
    maxMovement: number;    // Base movement speed (default 30)
    
    // Free object interaction
    freeInteractionUsed: boolean;
}
```

### 2.3 Action Validator Tool

```typescript
// File: src/server/action-economy-tools.ts

export const ActionEconomyTools = {
    VALIDATE_ACTION: {
        name: 'validate_action',
        description: `Check if a character can take a specific action type this turn.
        
Returns whether the action is valid and why/why not.
Use BEFORE executing actions to prevent invalid states.`,
        inputSchema: z.object({
            encounterId: z.string(),
            actorId: z.string(),
            actionType: z.enum(['action', 'bonus_action', 'reaction', 'movement', 'free_interaction'])
        })
    },
    
    USE_ACTION: {
        name: 'use_action',
        description: `Mark an action type as used for this turn.
        
Call this AFTER executing any action that consumes action economy.
The combat system will track and reset these at turn boundaries.`,
        inputSchema: z.object({
            encounterId: z.string(),
            actorId: z.string(),
            actionType: z.enum(['action', 'bonus_action', 'reaction', 'free_interaction']),
            movementUsed: z.number().optional().describe('Feet of movement consumed')
        })
    },
    
    GET_ACTION_ECONOMY: {
        name: 'get_action_economy',
        description: 'Get remaining actions for a character this turn.',
        inputSchema: z.object({
            encounterId: z.string(),
            actorId: z.string()
        })
    }
} as const;
```

### 2.4 Integration with Combat Engine

```typescript
// Add to CombatEngine class

/**
 * Reset action economy at start of turn
 */
private resetActionEconomy(participant: CombatParticipant): void {
    participant.actionUsed = false;
    participant.bonusActionUsed = false;
    // Reaction resets at START of YOUR turn, not end
    participant.reactionUsed = false;
    participant.movementUsed = 0;
    participant.freeInteractionUsed = false;
    participant.hasDisengaged = false;
}

/**
 * Validate if an action can be taken
 */
canTakeActionType(participantId: string, actionType: ActionType): { valid: boolean; reason?: string } {
    if (!this.state) return { valid: false, reason: 'No active combat' };
    
    const participant = this.state.participants.find(p => p.id === participantId);
    if (!participant) return { valid: false, reason: 'Participant not found' };
    
    // Check if it's their turn (except for reactions)
    const currentId = this.state.turnOrder[this.state.currentTurnIndex];
    if (actionType !== 'reaction' && currentId !== participantId) {
        return { valid: false, reason: 'Not your turn' };
    }
    
    switch (actionType) {
        case 'action':
            if (participant.actionUsed) {
                return { valid: false, reason: 'Action already used this turn' };
            }
            break;
        case 'bonus_action':
            if (participant.bonusActionUsed) {
                return { valid: false, reason: 'Bonus action already used this turn' };
            }
            break;
        case 'reaction':
            if (participant.reactionUsed) {
                return { valid: false, reason: 'Reaction already used this round' };
            }
            break;
        case 'movement':
            const remaining = (participant.maxMovement || 30) - (participant.movementUsed || 0);
            if (remaining <= 0) {
                return { valid: false, reason: 'No movement remaining' };
            }
            break;
        case 'free_interaction':
            if (participant.freeInteractionUsed) {
                return { valid: false, reason: 'Free object interaction already used' };
            }
            break;
    }
    
    // Check incapacitating conditions
    if (!this.canTakeActions(participantId) && actionType !== 'reaction') {
        return { valid: false, reason: 'Incapacitated - cannot take actions' };
    }
    
    return { valid: true };
}
```

---

## PART 3: ENVIRONMENTAL DAMAGE SYSTEM (P1 - HIGH)

### 3.1 The Problem

From playtest: Environmental effects (falling beams, traps, explosions) bypass the combat engine. HP changes happen in narrative only.

### 3.2 Tool Definition

```typescript
// File: src/server/environment-tools.ts

export const EnvironmentTools = {
    APPLY_ENVIRONMENTAL_DAMAGE: {
        name: 'apply_environmental_damage',
        description: `Apply damage from environmental sources to one or more targets.
        
Use for: falling objects, traps, hazardous terrain, explosions, cave-ins, lava, etc.
        
The engine validates all damage and updates HP correctly.
Targets can make saving throws to reduce/avoid damage.`,
        inputSchema: z.object({
            encounterId: z.string(),
            source: z.string().describe('What caused the damage (e.g., "collapsing ceiling", "pit trap")'),
            targetIds: z.array(z.string()),
            damage: z.string().describe('Dice notation (e.g., "3d6", "2d10+5")'),
            damageType: z.enum([
                'bludgeoning', 'piercing', 'slashing', 'fire', 'cold',
                'lightning', 'thunder', 'poison', 'acid', 'necrotic',
                'radiant', 'force', 'psychic'
            ]),
            savingThrow: z.object({
                ability: z.enum(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']),
                dc: z.number().int().min(1).max(30),
                effectOnSave: z.enum(['none', 'half', 'quarter']).default('half')
            }).optional(),
            applyCondition: z.object({
                type: z.enum(['prone', 'restrained', 'stunned', 'blinded', 'deafened', 'frightened', 'grappled']),
                duration: z.number().int().min(1).max(10),
                saveEnds: z.boolean().default(true)
            }).optional(),
            destroyTerrain: z.boolean().optional()
                .describe('Does this modify the battlefield terrain?'),
            newObstacles: z.array(z.string()).optional()
                .describe('New blocked tiles created (e.g., ["5,5", "5,6", "6,5"])')
        })
    },
    
    TRIGGER_TRAP: {
        name: 'trigger_trap',
        description: `Trigger a trap that affects creatures in an area.
        
Traps are environmental hazards that activate on certain conditions.
This tool handles the mechanical resolution.`,
        inputSchema: z.object({
            encounterId: z.string(),
            trapName: z.string(),
            trapType: z.enum(['pit', 'dart', 'blade', 'poison_gas', 'alarm', 'magical', 'custom']),
            triggerLocation: z.object({ x: z.number(), y: z.number() }),
            areaOfEffect: z.object({
                shape: z.enum(['single', 'line', 'cone', 'sphere', 'cube']),
                size: z.number().int().min(5).max(60)
            }).optional(),
            damage: z.string().optional(),
            damageType: z.string().optional(),
            savingThrow: z.object({
                ability: z.enum(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']),
                dc: z.number().int()
            }).optional(),
            specialEffect: z.string().optional()
                .describe('Non-damage effect (e.g., "alerts guards", "teleports to cell")')
        })
    }
} as const;
```

---

## PART 4: AREA OF EFFECT SYSTEM (P1 - HIGH)

### 4.1 The Problem

Spells like Fireball, Breath Weapons, and lair actions affect multiple targets in an area. Currently no spatial AoE calculation exists.

### 4.2 Tool Definition

```typescript
// File: src/server/aoe-tools.ts

export const AoETools = {
    RESOLVE_AREA_EFFECT: {
        name: 'resolve_area_effect',
        description: `Apply an effect to all creatures in an area.
        
Calculates which creatures are affected based on position and shape.
Handles saving throws, damage, and conditions for each target.
        
Shapes:
- sphere: All creatures within radius of center point
- cube: All creatures within a cube from origin point
- cone: All creatures in a cone from origin in a direction
- line: All creatures along a line from origin
- cylinder: Like sphere but only horizontal (for ground effects)`,
        inputSchema: z.object({
            encounterId: z.string(),
            source: z.object({
                type: z.enum(['spell', 'breath_weapon', 'lair_action', 'item', 'environmental']),
                name: z.string(),
                casterId: z.string().optional()
            }),
            origin: z.object({
                x: z.number(),
                y: z.number()
            }),
            shape: z.enum(['sphere', 'cube', 'cone', 'line', 'cylinder']),
            size: z.number().int().min(5).max(120)
                .describe('Radius for sphere/cylinder, side length for cube, length for line/cone'),
            direction: z.object({
                x: z.number(),
                y: z.number()
            }).optional().describe('Required for cone and line shapes'),
            damage: z.string().optional().describe('Dice notation'),
            damageType: z.string().optional(),
            savingThrow: z.object({
                ability: z.enum(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']),
                dc: z.number().int(),
                effectOnSave: z.enum(['none', 'half']).default('half')
            }).optional(),
            applyCondition: z.object({
                type: z.string(),
                duration: z.number().int(),
                saveDC: z.number().int().optional()
            }).optional(),
            excludeAllies: z.boolean().optional()
                .describe('Exclude caster\'s allies from effect'),
            excludeSelf: z.boolean().optional().default(true)
        })
    }
} as const;

// Spatial calculation helpers
export function getCreaturesInSphere(
    center: { x: number; y: number },
    radiusFeet: number,
    participants: Array<{ id: string; position?: { x: number; y: number } }>
): string[] {
    const radiusTiles = radiusFeet / 5; // 5 feet per tile
    return participants
        .filter(p => {
            if (!p.position) return false;
            const dx = p.position.x - center.x;
            const dy = p.position.y - center.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            return distance <= radiusTiles;
        })
        .map(p => p.id);
}

export function getCreaturesInCone(
    origin: { x: number; y: number },
    direction: { x: number; y: number },
    lengthFeet: number,
    participants: Array<{ id: string; position?: { x: number; y: number } }>
): string[] {
    const lengthTiles = lengthFeet / 5;
    const halfAngle = Math.PI / 6; // 60 degree cone = 30 degrees each side
    
    // Normalize direction
    const dirLen = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    const normDir = { x: direction.x / dirLen, y: direction.y / dirLen };
    
    return participants
        .filter(p => {
            if (!p.position) return false;
            const dx = p.position.x - origin.x;
            const dy = p.position.y - origin.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > lengthTiles || distance === 0) return false;
            
            // Check angle
            const dot = (dx * normDir.x + dy * normDir.y) / distance;
            const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
            
            return angle <= halfAngle;
        })
        .map(p => p.id);
}

export function getCreaturesInLine(
    origin: { x: number; y: number },
    direction: { x: number; y: number },
    lengthFeet: number,
    widthFeet: number = 5,
    participants: Array<{ id: string; position?: { x: number; y: number } }>
): string[] {
    const lengthTiles = lengthFeet / 5;
    const widthTiles = widthFeet / 5;
    
    // Normalize direction
    const dirLen = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
    const normDir = { x: direction.x / dirLen, y: direction.y / dirLen };
    const perpDir = { x: -normDir.y, y: normDir.x };
    
    return participants
        .filter(p => {
            if (!p.position) return false;
            const dx = p.position.x - origin.x;
            const dy = p.position.y - origin.y;
            
            // Project onto line direction
            const alongLine = dx * normDir.x + dy * normDir.y;
            if (alongLine < 0 || alongLine > lengthTiles) return false;
            
            // Check perpendicular distance
            const perpDist = Math.abs(dx * perpDir.x + dy * perpDir.y);
            return perpDist <= widthTiles / 2;
        })
        .map(p => p.id);
}
```

---

## PART 5: GRAPPLING & SHOVING (P1 - HIGH)

### 5.1 Tool Definition

```typescript
// File: src/server/grapple-tools.ts

export const GrappleTools = {
    ATTEMPT_GRAPPLE: {
        name: 'attempt_grapple',
        description: `Attempt to grapple a target creature.
        
D&D 5e Grappling Rules:
- Uses your ACTION
- Contest: Your Athletics vs target's Athletics OR Acrobatics (target chooses)
- On success: Target gains GRAPPLED condition
- Grappled creature: Speed becomes 0, can escape using action
- Grappler: Can drag/carry target at half speed
- Ends if: Grappler incapacitated, target forced out of reach, or escaped`,
        inputSchema: z.object({
            encounterId: z.string(),
            grappledId: z.string(),
            targetId: z.string()
        })
    },
    
    ESCAPE_GRAPPLE: {
        name: 'escape_grapple',
        description: `Attempt to escape from a grapple.
        
Uses your ACTION.
Contest: Your Athletics OR Acrobatics vs grappler's Athletics.
On success: You are no longer grappled.`,
        inputSchema: z.object({
            encounterId: z.string(),
            escapeeId: z.string()
        })
    },
    
    ATTEMPT_SHOVE: {
        name: 'attempt_shove',
        description: `Attempt to shove a creature.
        
D&D 5e Shoving Rules:
- Uses your ACTION (or replaces one attack if you have Extra Attack)
- Contest: Your Athletics vs target's Athletics OR Acrobatics
- On success, choose one:
  - Push target 5 feet away
  - Knock target PRONE`,
        inputSchema: z.object({
            encounterId: z.string(),
            shoverId: z.string(),
            targetId: z.string(),
            effect: z.enum(['push', 'prone']),
            pushDirection: z.object({
                x: z.number().int().min(-1).max(1),
                y: z.number().int().min(-1).max(1)
            }).optional().describe('Direction to push (required if effect is "push")')
        })
    }
} as const;
```

---

## PART 6: MISSING SYSTEMS FROM PLAYTEST AUDIT

### 6.1 Cover System (MED-002)

```typescript
export const CoverTools = {
    CALCULATE_COVER: {
        name: 'calculate_cover',
        description: `Calculate cover bonus between attacker and target.
        
D&D 5e Cover Rules:
- Half Cover (+2 AC, +2 Dex saves): Obstacle blocks half the target
- Three-Quarters Cover (+5 AC, +5 Dex saves): Obstacle blocks 3/4 of target
- Total Cover: Cannot be targeted directly

Uses line-of-sight calculation from attacker to target.`,
        inputSchema: z.object({
            encounterId: z.string(),
            attackerId: z.string(),
            targetId: z.string()
        })
    }
} as const;
```

### 6.2 Stolen Item Tracking (HIGH-008)

```typescript
// File: src/schema/theft.ts - ALREADY EXISTS but needs enhancement

// Add to existing schema:
export const StolenItemSchema = z.object({
    itemId: z.string(),
    originalOwnerId: z.string(),
    originalOwnerName: z.string(),
    stolenById: z.string(),
    stolenByName: z.string(),
    stolenAt: z.string().datetime(),
    location: z.string().optional().describe('Where the theft occurred'),
    witnessed: z.boolean().default(false),
    witnesses: z.array(z.string()).optional(),
    heatLevel: z.number().int().min(0).max(100).default(0)
        .describe('How "hot" the item is (0=cold, 100=guards actively searching)'),
    fencedTo: z.string().optional().describe('Who bought the stolen goods'),
    fencedAt: z.string().datetime().optional(),
    fencePrice: z.number().optional()
});

// Theft-related tools needed:
// - mark_item_stolen
// - check_item_provenance  
// - fence_stolen_item
// - report_theft (increases heat)
// - clear_item_heat (time decay or fence)
```

### 6.3 Advantage/Disadvantage in Combat (Missing from execute_combat_action)

```typescript
// Update execute_combat_action schema to include:
advantage: z.boolean().optional()
    .describe('Roll with advantage (take higher of 2d20)'),
disadvantage: z.boolean().optional()
    .describe('Roll with disadvantage (take lower of 2d20)'),
```

### 6.4 Corpse Looting (MED-001)

```typescript
// File: src/server/corpse-tools.ts - EXISTS but needs exposure via MCP

// Tools needed:
// - create_corpse (on creature death)
// - loot_corpse (transfer items to character)
// - search_corpse (reveal hidden items)
// - destroy_corpse (for necromancy prevention, etc.)
```

---

## PART 7: DIALOGUE SYSTEM (MED-007 / FAILED-002)

### 7.1 The Problem

NPC dialogue is pure narrative. No mechanical tracking of:
- What topics have been discussed
- Persuasion/Intimidation/Deception outcomes
- Information revealed
- Relationship changes

### 7.2 Tool Definition

```typescript
// File: src/server/dialogue-tools.ts

export const DialogueTools = {
    START_CONVERSATION: {
        name: 'start_conversation',
        description: 'Begin a tracked conversation with an NPC.',
        inputSchema: z.object({
            characterId: z.string().describe('Player character initiating'),
            npcId: z.string().describe('NPC being spoken to'),
            context: z.string().optional().describe('Where/why the conversation is happening')
        })
    },
    
    MAKE_SOCIAL_CHECK: {
        name: 'make_social_check',
        description: `Make a social skill check during conversation.
        
Use for persuasion, deception, intimidation, insight, etc.
Outcome affects NPC disposition and information revealed.`,
        inputSchema: z.object({
            conversationId: z.string(),
            characterId: z.string(),
            npcId: z.string(),
            skill: z.enum(['persuasion', 'deception', 'intimidation', 'insight', 'performance']),
            dc: z.number().int().min(5).max(30),
            intent: z.string().describe('What the character is trying to achieve'),
            stakes: z.enum(['low', 'medium', 'high', 'critical']).default('medium')
                .describe('How much this matters to the NPC')
        })
    },
    
    REVEAL_INFORMATION: {
        name: 'reveal_information',
        description: 'Track that an NPC has revealed specific information.',
        inputSchema: z.object({
            conversationId: z.string(),
            npcId: z.string(),
            topic: z.string(),
            information: z.string(),
            importance: z.enum(['trivial', 'useful', 'important', 'critical']),
            linkedSecretId: z.string().optional()
                .describe('If this reveals part of a tracked secret')
        })
    },
    
    END_CONVERSATION: {
        name: 'end_conversation',
        description: 'End the conversation and record final disposition.',
        inputSchema: z.object({
            conversationId: z.string(),
            characterId: z.string(),
            npcId: z.string(),
            dispositionChange: z.number().int().min(-50).max(50).optional()
                .describe('How much the NPC\'s opinion changed'),
            summary: z.string().describe('Brief summary of what was discussed')
        })
    }
} as const;
```

---

## PART 8: READIED ACTIONS (P2 - MEDIUM)

### 8.1 Tool Definition

```typescript
export const ReadiedActionTools = {
    READY_ACTION: {
        name: 'ready_action',
        description: `Ready an action to trigger on a specific condition.
        
D&D 5e Ready Rules:
- Uses your ACTION to ready
- Specify a trigger and an action
- When trigger occurs, use your REACTION to execute
- Concentration required (for spells)
- If trigger doesn't occur, action is wasted`,
        inputSchema: z.object({
            encounterId: z.string(),
            actorId: z.string(),
            trigger: z.string().describe('When does this activate? (e.g., "enemy moves within 5 feet")'),
            readiedAction: z.enum(['attack', 'cast_spell', 'dash', 'disengage', 'dodge', 'help', 'hide', 'use_object']),
            targetId: z.string().optional(),
            spellName: z.string().optional().describe('If readied action is cast_spell')
        })
    },
    
    CHECK_TRIGGERS: {
        name: 'check_readied_triggers',
        description: 'Check if any readied actions should trigger based on current game state.',
        inputSchema: z.object({
            encounterId: z.string(),
            eventType: z.enum(['movement', 'attack', 'spell_cast', 'turn_start', 'turn_end', 'damage_taken']),
            eventActorId: z.string(),
            eventDetails: z.any().optional()
        })
    }
} as const;
```

---

## PART 9: LEGENDARY CREATURE FIXES (HIGH-006, HIGH-007)

### 9.1 The Problem

- Lair actions exist but never trigger automatically
- Legendary actions/resistances not persisted to character table

### 9.2 Required Changes

```typescript
// 1. Update CharacterRepository.create() to accept legendary fields
// Already in schema, but verify DB migration exists

// 2. Add automatic lair action injection to initiative
// In CombatEngine.startEncounter():
// - Check if any participant has hasLairActions = true
// - If so, add 'LAIR' entry to turn order at initiative 20
// DONE: This exists in engine.ts but needs testing

// 3. Add tool to execute legendary actions between turns
export const LegendaryTools = {
    USE_LEGENDARY_ACTION: {
        name: 'use_legendary_action',
        description: `Use a legendary action at the end of another creature's turn.
        
Legendary creatures can take special actions outside their turn:
- Can only use at END of another creature's turn
- Cannot use on their own turn
- Actions have different costs (1-3 legendary actions)
- All legendary actions restore at the start of the creature's turn`,
        inputSchema: z.object({
            encounterId: z.string(),
            creatureId: z.string().describe('The legendary creature using the action'),
            actionName: z.string().describe('Name of the legendary action'),
            cost: z.number().int().min(1).max(3).default(1),
            targetId: z.string().optional(),
            damage: z.string().optional(),
            damageType: z.string().optional(),
            effect: z.string().optional()
        })
    },
    
    USE_LEGENDARY_RESISTANCE: {
        name: 'use_legendary_resistance',
        description: `Use legendary resistance to automatically succeed on a failed save.
        
When a legendary creature fails a saving throw, it can choose to succeed instead.
Limited uses per day (usually 3).
Does NOT restore between rounds - only on long rest.`,
        inputSchema: z.object({
            encounterId: z.string(),
            creatureId: z.string(),
            failedSaveType: z.string().describe('What save was failed (e.g., "Wisdom save vs Hold Monster")')
        })
    }
} as const;
```

---

## PART 10: TESTING REQUIREMENTS

### 10.1 Required Test Files

Create these test files following TDD:

```
tests/
├── combat/
│   ├── action-economy.test.ts       # T2.1 - Bonus action enforcement
│   ├── improvised-stunts.test.ts    # Rule of Cool system
│   ├── grapple-shove.test.ts        # Contested checks
│   └── legendary-creatures.test.ts  # Lair/legendary actions
├── environmental/
│   ├── environmental-damage.test.ts # Traps, hazards
│   ├── area-of-effect.test.ts       # Spatial AoE calculations
│   └── cover.test.ts                # Cover bonus calculations
├── social/
│   ├── dialogue-system.test.ts      # Conversation tracking
│   └── npc-memory.test.ts           # Relationship persistence
└── economy/
    └── theft-system.test.ts         # Stolen item tracking
```

### 10.2 Test Template

```typescript
// Example: tests/combat/improvised-stunts.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { handleResolveImprovisedStunt } from '../../src/server/stunt-tools.js';
import { CombatEngine } from '../../src/engine/combat/engine.js';

describe('Improvised Stunt System', () => {
    let engine: CombatEngine;
    let encounterId: string;
    
    beforeEach(() => {
        // Setup test encounter
        engine = new CombatEngine('test-seed');
        // ... setup participants
    });
    
    describe('Mine Cart Gambit (from playtest)', () => {
        it('should resolve athletics check for kicking cart', async () => {
            const result = await handleResolveImprovisedStunt({
                encounterId,
                actorId: 'theron',
                targetIds: ['zombie-1'],
                narrativeIntent: 'Kick the rusty mine cart to bowl over the zombie',
                skillCheck: {
                    skill: 'athletics',
                    dc: 15
                },
                consequences: {
                    successDamage: '4d6',
                    damageType: 'bludgeoning',
                    applyCondition: 'prone',
                    moveTarget: true
                }
            }, { sessionId: 'test' });
            
            // Verify output contains roll information
            expect(result.content[0].text).toContain('ATHLETICS Check');
            expect(result.content[0].text).toContain('vs DC 15');
            
            // Verify audit log created
            expect(result.content[0].text).toContain('STUNT_LOG');
        });
        
        it('should apply doubled damage on critical success', async () => {
            // Force nat 20 via seeded RNG
            // ... test implementation
        });
        
        it('should apply self-damage on critical failure', async () => {
            // Force nat 1 via seeded RNG
            // ... test implementation
        });
    });
    
    describe('Action Economy Integration', () => {
        it('should consume an action when performing stunt', async () => {
            // Verify action economy is tracked
        });
        
        it('should reject stunt if action already used', async () => {
            // Verify action economy enforcement
        });
    });
});
```

---

## PART 11: IMPLEMENTATION PRIORITY

### Sprint 1 (P0 - This Week)
1. ✅ `resolve_improvised_stunt` - The Rule of Cool tool
2. ✅ Action Economy enforcement (T2.1 bug fix)
3. ✅ Advantage/Disadvantage in combat

### Sprint 2 (P1 - Next Week)  
4. Environmental damage system
5. Area of Effect calculations
6. Grappling & Shoving
7. Legendary creature fixes

### Sprint 3 (P2 - Following Week)
8. Cover system
9. Dialogue system
10. Readied actions
11. Stolen item enhancements

---

## APPENDIX: DM GUIDANCE FOR RULE OF COOL

Include this in system prompt for AI DM:

```markdown
## Improvised Stunt Guidelines

When a player attempts something creative not covered by standard rules, use `resolve_improvised_stunt`.

### Setting DCs
| Difficulty | DC | Example |
|------------|-----|---------|
| Trivial | 5 | Kick open an unlocked door |
| Easy | 10 | Swing from a rope |
| Medium | 15 | Kick a stuck mine cart loose |
| Hard | 20 | Leap across a 20-foot chasm |
| Very Hard | 25 | Catch an arrow mid-flight |
| Nearly Impossible | 30 | Dodge lightning |

### Setting Damage
| Impact | Damage | Example |
|--------|--------|---------|
| Minimal | 1d4 | Thrown mug |
| Light | 1d6 | Chair smash |
| Moderate | 2d6 | Barrel roll |
| Heavy | 3d6-4d6 | Mine cart |
| Massive | 6d6 | Chandelier drop |
| Catastrophic | 8d6+ | Building collapse |

### Conditions
- **Prone**: Target is knocked down (heavy impacts, sweeps)
- **Restrained**: Target is trapped (nets, rubble, grapple)
- **Stunned**: Target is dazed (head trauma, explosions)
- **Blinded**: Target can't see (sand, smoke, flash)

### The Golden Rule
If it's dramatically appropriate and the player rolls well, let it work spectacularly.
If they roll poorly, make the failure interesting, not just "nothing happens."
```

---

## COMMIT CHECKLIST

Before merging any implementation:

- [ ] TDD test written and passing
- [ ] Tool registered in server/index.ts
- [ ] Schema added/updated if needed
- [ ] Database migration if schema changed
- [ ] Handler exported and imported
- [ ] Documentation updated
- [ ] Playtest scenario validated
- [ ] Git commit with descriptive message

---

**END OF IMPLEMENTATION PROMPT**

*Generated from 5-hour playtest session + codebase audit*
*Date: December 5, 2025*
