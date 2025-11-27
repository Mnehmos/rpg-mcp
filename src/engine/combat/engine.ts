import { CombatRNG } from './rng';
import { Condition, ConditionType, DurationType, Ability, CONDITION_EFFECTS } from './conditions';

/**
 * Character interface for combat participants
 */
export interface CombatParticipant {
    id: string;
    name: string;
    initiativeBonus: number;
    hp: number;
    maxHp: number;
    conditions: Condition[];
    abilityScores?: {
        strength: number;
        dexterity: number;
        constitution: number;
        intelligence: number;
        wisdom: number;
        charisma: number;
    };
}

/**
 * Combat state tracking
 */
export interface CombatState {
    participants: CombatParticipant[];
    turnOrder: string[]; // IDs in initiative order
    currentTurnIndex: number;
    round: number;
}

export interface EventEmitter {
    publish(topic: string, payload: any): void;
}

/**
 * Combat Engine for managing RPG combat encounters
 * Handles initiative, turn order, and combat flow
 */
export class CombatEngine {
    private rng: CombatRNG;
    private state: CombatState | null = null;
    private emitter?: EventEmitter;

    constructor(seed: string, emitter?: EventEmitter) {
        this.rng = new CombatRNG(seed);
        this.emitter = emitter;
    }

    /**
     * Start a new combat encounter
     * Rolls initiative for all participants and establishes turn order
     */
    startEncounter(participants: CombatParticipant[]): CombatState {
        // Roll initiative for each participant
        const initiativeRolls = participants.map(p => ({
            id: p.id,
            initiative: this.rng.d20(p.initiativeBonus)
        }));

        // Sort by initiative (highest first), use ID as tiebreaker for determinism
        initiativeRolls.sort((a, b) => {
            if (b.initiative !== a.initiative) {
                return b.initiative - a.initiative;
            }
            return a.id.localeCompare(b.id);
        });

        this.state = {
            participants: [...participants],
            turnOrder: initiativeRolls.map(r => r.id),
            currentTurnIndex: 0,
            round: 1
        };

        this.emitter?.publish('combat', {
            type: 'encounter_started',
            state: this.state
        });

        return this.state;
    }

    /**
     * Get the current state
     */
    getState(): CombatState | null {
        return this.state;
    }

    /**
     * Get the participant whose turn it currently is
     */
    getCurrentParticipant(): CombatParticipant | null {
        if (!this.state) return null;

        const currentId = this.state.turnOrder[this.state.currentTurnIndex];
        return this.state.participants.find(p => p.id === currentId) || null;
    }

    /**
     * Advance to the next turn
     * Returns the participant whose turn it now is
     */
    nextTurn(): CombatParticipant | null {
        if (!this.state) return null;

        this.state.currentTurnIndex++;

        // If we've gone through everyone, start a new round
        if (this.state.currentTurnIndex >= this.state.turnOrder.length) {
            this.state.currentTurnIndex = 0;
            this.state.round++;
        }

        return this.getCurrentParticipant();
    }

    /**
     * Pathfinder 2e: Make a check and return degree of success
     */
    makeCheck(
        modifier: number,
        dc: number
    ): 'critical-failure' | 'failure' | 'success' | 'critical-success' {
        return this.rng.checkDegree(modifier, dc);
    }

    /**
     * Apply damage to a participant
     */
    applyDamage(participantId: string, damage: number): void {
        if (!this.state) return;

        const participant = this.state.participants.find(p => p.id === participantId);
        if (participant) {
            participant.hp = Math.max(0, participant.hp - damage);
            this.emitter?.publish('combat', {
                type: 'damage_applied',
                participantId,
                amount: damage,
                newHp: participant.hp
            });
        }
    }

    /**
     * Heal a participant
     */
    heal(participantId: string, amount: number): void {
        if (!this.state) return;

        const participant = this.state.participants.find(p => p.id === participantId);
        if (participant) {
            participant.hp = Math.min(participant.maxHp, participant.hp + amount);
            this.emitter?.publish('combat', {
                type: 'healed',
                participantId,
                amount,
                newHp: participant.hp
            });
        }
    }

    /**
     * Check if a participant is still conscious (hp > 0)
     */
    isConscious(participantId: string): boolean {
        if (!this.state) return false;

        const participant = this.state.participants.find(p => p.id === participantId);
        return participant ? participant.hp > 0 : false;
    }

    /**
     * Get count of conscious participants
     */
    getConsciousCount(): number {
        if (!this.state) return 0;

        return this.state.participants.filter(p => p.hp > 0).length;
    }

    /**
     * Apply a condition to a participant
     */
    applyCondition(participantId: string, condition: Omit<Condition, 'id'>): Condition {
        if (!this.state) throw new Error('No active combat');

        const participant = this.state.participants.find(p => p.id === participantId);
        if (!participant) throw new Error(`Participant ${participantId} not found`);

        // Generate unique ID for condition instance
        const fullCondition: Condition = {
            ...condition,
            id: `${participantId}-${condition.type}-${Date.now()}-${Math.random()}`
        };

        participant.conditions.push(fullCondition);
        return fullCondition;
    }

    /**
     * Remove a specific condition instance by ID
     */
    removeCondition(participantId: string, conditionId: string): boolean {
        if (!this.state) return false;

        const participant = this.state.participants.find(p => p.id === participantId);
        if (!participant) return false;

        const initialLength = participant.conditions.length;
        participant.conditions = participant.conditions.filter(c => c.id !== conditionId);
        return participant.conditions.length < initialLength;
    }

    /**
     * Remove all conditions of a specific type from a participant
     */
    removeConditionsByType(participantId: string, type: ConditionType): number {
        if (!this.state) return 0;

        const participant = this.state.participants.find(p => p.id === participantId);
        if (!participant) return 0;

        const initialLength = participant.conditions.length;
        participant.conditions = participant.conditions.filter(c => c.type !== type);
        return initialLength - participant.conditions.length;
    }

    /**
     * Check if a participant has a specific condition type
     */
    hasCondition(participantId: string, type: ConditionType): boolean {
        if (!this.state) return false;

        const participant = this.state.participants.find(p => p.id === participantId);
        return participant ? participant.conditions.some(c => c.type === type) : false;
    }

    /**
     * Get all conditions on a participant
     */
    getConditions(participantId: string): Condition[] {
        if (!this.state) return [];

        const participant = this.state.participants.find(p => p.id === participantId);
        return participant ? [...participant.conditions] : [];
    }

    /**
     * Process start-of-turn condition effects
     */
    private processStartOfTurnConditions(participant: CombatParticipant): void {
        for (const condition of [...participant.conditions]) {
            // Process ongoing effects
            if (condition.ongoingEffects) {
                for (const effect of condition.ongoingEffects) {
                    if (effect.trigger === 'start_of_turn') {
                        if (effect.type === 'damage' && effect.amount) {
                            this.applyDamage(participant.id, effect.amount);
                        } else if (effect.type === 'healing' && effect.amount) {
                            this.heal(participant.id, effect.amount);
                        } else if (effect.type === 'damage' && effect.dice) {
                            const damage = this.rng.roll(effect.dice);
                            this.applyDamage(participant.id, damage);
                        }
                    }
                }
            }

            // Handle duration for START_OF_TURN conditions
            if (condition.durationType === DurationType.START_OF_TURN) {
                this.removeCondition(participant.id, condition.id);
            } else if (condition.durationType === DurationType.ROUNDS && condition.duration !== undefined) {
                // Decrement round-based durations at start of turn
                condition.duration--;
                if (condition.duration <= 0) {
                    this.removeCondition(participant.id, condition.id);
                }
            }
        }
    }

    /**
     * Process end-of-turn condition effects
     */
    private processEndOfTurnConditions(participant: CombatParticipant): void {
        for (const condition of [...participant.conditions]) {
            // Process ongoing effects
            if (condition.ongoingEffects) {
                for (const effect of condition.ongoingEffects) {
                    if (effect.trigger === 'end_of_turn') {
                        if (effect.type === 'damage' && effect.amount) {
                            this.applyDamage(participant.id, effect.amount);
                        } else if (effect.type === 'healing' && effect.amount) {
                            this.heal(participant.id, effect.amount);
                        } else if (effect.type === 'damage' && effect.dice) {
                            const damage = this.rng.roll(effect.dice);
                            this.applyDamage(participant.id, damage);
                        }
                    }
                }
            }

            // Handle duration for END_OF_TURN conditions
            if (condition.durationType === DurationType.END_OF_TURN) {
                this.removeCondition(participant.id, condition.id);
            }

            // Handle save-ends conditions
            if (condition.durationType === DurationType.SAVE_ENDS && condition.saveDC && condition.saveAbility) {
                const saveBonus = this.getSaveBonus(participant, condition.saveAbility);
                const degree = this.rng.checkDegree(saveBonus, condition.saveDC);

                if (degree === 'success' || degree === 'critical-success') {
                    this.removeCondition(participant.id, condition.id);
                }
            }
        }
    }

    /**
     * Get saving throw bonus for a participant
     */
    private getSaveBonus(participant: CombatParticipant, ability: Ability): number {
        if (!participant.abilityScores) return 0;

        const score = participant.abilityScores[ability];
        // D&D 5e modifier calculation: (score - 10) / 2
        return Math.floor((score - 10) / 2);
    }

    /**
     * Enhanced nextTurn with condition processing
     */
    nextTurnWithConditions(): CombatParticipant | null {
        if (!this.state) return null;

        // Process end-of-turn conditions for current participant
        const currentParticipant = this.getCurrentParticipant();
        if (currentParticipant) {
            this.processEndOfTurnConditions(currentParticipant);
        }

        // Advance turn
        this.state.currentTurnIndex++;

        if (this.state.currentTurnIndex >= this.state.turnOrder.length) {
            this.state.currentTurnIndex = 0;
            this.state.round++;
        }

        // Process start-of-turn conditions for new current participant
        const newParticipant = this.getCurrentParticipant();
        if (newParticipant) {
            this.processStartOfTurnConditions(newParticipant);
        }

        this.emitter?.publish('combat', {
            type: 'turn_changed',
            round: this.state.round,
            activeParticipantId: newParticipant?.id
        });

        return newParticipant;
    }

    /**
     * Check if a participant can take actions (not incapacitated)
     */
    canTakeActions(participantId: string): boolean {
        if (!this.state) return false;

        const participant = this.state.participants.find(p => p.id === participantId);
        if (!participant || participant.hp <= 0) return false;

        // Check for incapacitating conditions
        return !participant.conditions.some(c => {
            const effects = CONDITION_EFFECTS[c.type];
            return effects.canTakeActions === false;
        });
    }

    /**
     * Check if a participant can take reactions
     */
    canTakeReactions(participantId: string): boolean {
        if (!this.state) return false;

        const participant = this.state.participants.find(p => p.id === participantId);
        if (!participant || participant.hp <= 0) return false;

        return !participant.conditions.some(c => {
            const effects = CONDITION_EFFECTS[c.type];
            return effects.canTakeReactions === false;
        });
    }

    /**
     * Check if attacks against a participant have advantage
     */
    attacksAgainstHaveAdvantage(participantId: string): boolean {
        if (!this.state) return false;

        const participant = this.state.participants.find(p => p.id === participantId);
        if (!participant) return false;

        return participant.conditions.some(c => {
            const effects = CONDITION_EFFECTS[c.type];
            return effects.attacksAgainstAdvantage === true;
        });
    }

    /**
     * Check if a participant's attacks have disadvantage
     */
    attacksHaveDisadvantage(participantId: string): boolean {
        if (!this.state) return false;

        const participant = this.state.participants.find(p => p.id === participantId);
        if (!participant) return false;

        return participant.conditions.some(c => {
            const effects = CONDITION_EFFECTS[c.type];
            return effects.attackDisadvantage === true;
        });
    }
}
