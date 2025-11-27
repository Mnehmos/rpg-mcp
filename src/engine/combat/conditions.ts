/**
 * Status Condition Types
 * Based on D&D 5e with extensions for other systems
 */
export enum ConditionType {
    // D&D 5e Core Conditions
    BLINDED = 'blinded',
    CHARMED = 'charmed',
    DEAFENED = 'deafened',
    FRIGHTENED = 'frightened',
    GRAPPLED = 'grappled',
    INCAPACITATED = 'incapacitated',
    INVISIBLE = 'invisible',
    PARALYZED = 'paralyzed',
    PETRIFIED = 'petrified',
    POISONED = 'poisoned',
    PRONE = 'prone',
    RESTRAINED = 'restrained',
    STUNNED = 'stunned',
    UNCONSCIOUS = 'unconscious',

    // Extended Conditions
    BLEEDING = 'bleeding',
    BURNING = 'burning',
    CONCENTRATING = 'concentrating',
    EXHAUSTED = 'exhausted',
    HASTED = 'hasted',
    SLOWED = 'slowed',
    BLESSED = 'blessed',
    CURSED = 'cursed',
    MARKED = 'marked',
    HIDDEN = 'hidden'
}

/**
 * How a condition's duration is tracked
 */
export enum DurationType {
    /** Lasts until end of target's next turn */
    END_OF_TURN = 'end_of_turn',
    /** Lasts until start of target's next turn */
    START_OF_TURN = 'start_of_turn',
    /** Lasts for a specific number of rounds */
    ROUNDS = 'rounds',
    /** Lasts until a save is made */
    SAVE_ENDS = 'save_ends',
    /** Lasts indefinitely until removed */
    PERMANENT = 'permanent',
    /** Lasts until concentration is broken */
    CONCENTRATION = 'concentration'
}

/**
 * Ability scores for saving throws
 */
export enum Ability {
    STRENGTH = 'strength',
    DEXTERITY = 'dexterity',
    CONSTITUTION = 'constitution',
    INTELLIGENCE = 'intelligence',
    WISDOM = 'wisdom',
    CHARISMA = 'charisma'
}

/**
 * Ongoing effect that occurs each turn
 */
export interface OngoingEffect {
    /** Type of effect */
    type: 'damage' | 'healing' | 'custom';
    /** Amount (for damage/healing) */
    amount?: number;
    /** Dice notation (alternative to amount) */
    dice?: string;
    /** When the effect triggers */
    trigger: 'start_of_turn' | 'end_of_turn';
}

/**
 * Complete condition data
 */
export interface Condition {
    /** Unique ID for this condition instance */
    id: string;
    /** Type of condition */
    type: ConditionType;
    /** How long the condition lasts */
    durationType: DurationType;
    /** Remaining duration (rounds or turns) */
    duration?: number;
    /** Source participant ID (who applied it) */
    sourceId?: string;
    /** Save DC (if save_ends) */
    saveDC?: number;
    /** Ability for saving throw */
    saveAbility?: Ability;
    /** Ongoing effects */
    ongoingEffects?: OngoingEffect[];
    /** Custom metadata */
    metadata?: Record<string, any>;
}

/**
 * Condition effect modifiers
 * Defines mechanical effects of each condition type
 */
export const CONDITION_EFFECTS: Record<ConditionType, {
    description: string;
    attackDisadvantage?: boolean;
    attacksAgainstAdvantage?: boolean;
    abilityCheckDisadvantage?: boolean;
    savingThrowDisadvantage?: boolean;
    speed?: number; // 0 means no movement
    autoFail?: Ability[];
    canTakeActions?: boolean;
    canTakeReactions?: boolean;
}> = {
    [ConditionType.BLINDED]: {
        description: 'Cannot see, fails checks requiring sight',
        attackDisadvantage: true,
        attacksAgainstAdvantage: true,
        autoFail: [Ability.STRENGTH, Ability.DEXTERITY] // Auto-fail checks requiring sight
    },
    [ConditionType.CHARMED]: {
        description: 'Cannot attack charmer, charmer has advantage on social checks',
        attackDisadvantage: false
    },
    [ConditionType.DEAFENED]: {
        description: 'Cannot hear, fails checks requiring hearing',
        autoFail: [] // Auto-fail hearing checks
    },
    [ConditionType.FRIGHTENED]: {
        description: 'Disadvantage on checks while source is in sight, cannot move closer',
        attackDisadvantage: true,
        abilityCheckDisadvantage: true
    },
    [ConditionType.GRAPPLED]: {
        description: 'Speed becomes 0',
        speed: 0
    },
    [ConditionType.INCAPACITATED]: {
        description: 'Cannot take actions or reactions',
        canTakeActions: false,
        canTakeReactions: false
    },
    [ConditionType.INVISIBLE]: {
        description: 'Attacks have advantage, attacks against have disadvantage',
        attacksAgainstAdvantage: false // Actually disadvantage for attackers
    },
    [ConditionType.PARALYZED]: {
        description: 'Incapacitated, auto-fail STR/DEX saves, attacks against have advantage, crits within 5ft',
        canTakeActions: false,
        canTakeReactions: false,
        speed: 0,
        autoFail: [Ability.STRENGTH, Ability.DEXTERITY],
        attacksAgainstAdvantage: true
    },
    [ConditionType.PETRIFIED]: {
        description: 'Transformed to stone, incapacitated, resistance to all damage',
        canTakeActions: false,
        canTakeReactions: false,
        speed: 0,
        autoFail: [Ability.STRENGTH, Ability.DEXTERITY]
    },
    [ConditionType.POISONED]: {
        description: 'Disadvantage on attack rolls and ability checks',
        attackDisadvantage: true,
        abilityCheckDisadvantage: true
    },
    [ConditionType.PRONE]: {
        description: 'Disadvantage on attacks, attacks against have advantage (if within 5ft)',
        attackDisadvantage: true,
        speed: 0 // Half speed to stand up
    },
    [ConditionType.RESTRAINED]: {
        description: 'Speed 0, disadvantage on attacks and DEX saves, attacks against have advantage',
        speed: 0,
        attackDisadvantage: true,
        savingThrowDisadvantage: true,
        attacksAgainstAdvantage: true
    },
    [ConditionType.STUNNED]: {
        description: 'Incapacitated, auto-fail STR/DEX saves, attacks against have advantage',
        canTakeActions: false,
        canTakeReactions: false,
        autoFail: [Ability.STRENGTH, Ability.DEXTERITY],
        attacksAgainstAdvantage: true
    },
    [ConditionType.UNCONSCIOUS]: {
        description: 'Incapacitated, prone, auto-fail STR/DEX saves, attacks against have advantage, crits within 5ft',
        canTakeActions: false,
        canTakeReactions: false,
        speed: 0,
        autoFail: [Ability.STRENGTH, Ability.DEXTERITY],
        attacksAgainstAdvantage: true
    },
    [ConditionType.BLEEDING]: {
        description: 'Takes ongoing damage at start of turn',
        attackDisadvantage: false
    },
    [ConditionType.BURNING]: {
        description: 'Takes ongoing fire damage at start of turn',
        attackDisadvantage: false
    },
    [ConditionType.CONCENTRATING]: {
        description: 'Maintaining concentration on a spell or effect',
        attackDisadvantage: false
    },
    [ConditionType.EXHAUSTED]: {
        description: 'Disadvantage on checks, reduced speed',
        abilityCheckDisadvantage: true,
        attackDisadvantage: true
    },
    [ConditionType.HASTED]: {
        description: 'Increased speed and extra actions',
        attackDisadvantage: false
    },
    [ConditionType.SLOWED]: {
        description: 'Reduced speed and disadvantage on DEX saves',
        savingThrowDisadvantage: true
    },
    [ConditionType.BLESSED]: {
        description: 'Bonus to attack rolls and saving throws',
        attackDisadvantage: false
    },
    [ConditionType.CURSED]: {
        description: 'Penalty to attack rolls and saving throws',
        attackDisadvantage: true
    },
    [ConditionType.MARKED]: {
        description: 'Attacks against this target have advantage',
        attacksAgainstAdvantage: true
    },
    [ConditionType.HIDDEN]: {
        description: 'Cannot be seen by enemies',
        attacksAgainstAdvantage: false
    }
};
