/**
 * IMPROVISATION SYSTEMS SCHEMAS
 *
 * Defines Zod schemas for:
 * - Rule of Cool (Improvised Stunts)
 * - Custom Effects System (Divine Boons, Curses, Transformations)
 * - Arcane Synthesis (Dynamic Spell Creation)
 */

import { z } from 'zod';

// ============================================================================
// SHARED TYPES
// ============================================================================

export const SkillNameSchema = z.enum([
    'athletics', 'acrobatics', 'sleight_of_hand', 'stealth',
    'arcana', 'history', 'investigation', 'nature', 'religion',
    'animal_handling', 'insight', 'medicine', 'perception', 'survival',
    'deception', 'intimidation', 'performance', 'persuasion'
]);
export type SkillName = z.infer<typeof SkillNameSchema>;

export const AbilityNameSchema = z.enum([
    'strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma'
]);
export type AbilityName = z.infer<typeof AbilityNameSchema>;

export const DamageTypeSchema = z.enum([
    'slashing', 'piercing', 'bludgeoning',
    'fire', 'cold', 'lightning', 'thunder', 'acid', 'poison',
    'necrotic', 'radiant', 'force', 'psychic'
]);
export type DamageType = z.infer<typeof DamageTypeSchema>;

export const ConditionTypeSchema = z.enum([
    'blinded', 'charmed', 'deafened', 'frightened', 'grappled',
    'incapacitated', 'invisible', 'paralyzed', 'petrified', 'poisoned',
    'prone', 'restrained', 'stunned', 'unconscious', 'exhaustion'
]);
export type ConditionType = z.infer<typeof ConditionTypeSchema>;

export const SpellSchoolSchema = z.enum([
    'abjuration', 'conjuration', 'divination', 'enchantment',
    'evocation', 'illusion', 'necromancy', 'transmutation'
]);
export type SpellSchool = z.infer<typeof SpellSchoolSchema>;

export const ActorTypeSchema = z.enum(['character', 'npc']);
export type ActorType = z.infer<typeof ActorTypeSchema>;

// ============================================================================
// RULE OF COOL - IMPROVISED STUNTS
// ============================================================================

export const SkillCheckSchema = z.object({
    skill: SkillNameSchema,
    dc: z.number().int().min(5).max(30),
    advantage: z.boolean().optional(),
    disadvantage: z.boolean().optional()
});

export const SavingThrowSchema = z.object({
    ability: AbilityNameSchema,
    dc: z.number().int().min(1).max(30),
    half_damage_on_save: z.boolean().optional()
});

export const AreaOfEffectSchema = z.object({
    shape: z.enum(['line', 'cone', 'sphere', 'cube']),
    size: z.number().int().min(5).describe('Size in feet')
});

export const StuntConsequencesSchema = z.object({
    success_damage: z.string().optional().describe('Dice notation: "2d6"'),
    failure_damage: z.string().optional().describe('Self-damage on critical fail'),
    damage_type: DamageTypeSchema.optional(),
    apply_condition: ConditionTypeSchema.optional(),
    condition_duration: z.number().int().min(1).optional().describe('Duration in rounds'),
    saving_throw: SavingThrowSchema.optional(),
    area_of_effect: AreaOfEffectSchema.optional()
});

export const ResolveImprovisedStuntArgsSchema = z.object({
    encounter_id: z.number().int(),
    actor_id: z.number().int(),
    actor_type: ActorTypeSchema,
    target_ids: z.array(z.number().int()).optional(),
    target_types: z.array(ActorTypeSchema).optional(),

    narrative_intent: z.string().describe('What the player wants to do'),

    skill_check: SkillCheckSchema,
    action_cost: z.enum(['action', 'bonus_action', 'reaction', 'free']),
    consequences: StuntConsequencesSchema,

    environmental_destruction: z.boolean().optional(),
    narrative_on_success: z.string().optional(),
    narrative_on_failure: z.string().optional()
});
export type ResolveImprovisedStuntArgs = z.infer<typeof ResolveImprovisedStuntArgsSchema>;

export const StuntResultSchema = z.object({
    success: z.boolean(),
    roll: z.number().int(),
    modifier: z.number().int(),
    total: z.number().int(),
    dc: z.number().int(),
    critical_success: z.boolean(),
    critical_failure: z.boolean(),
    damage_dealt: z.number().int().optional(),
    targets_affected: z.array(z.object({
        id: z.number().int(),
        name: z.string(),
        damage_taken: z.number().int(),
        saved: z.boolean().optional(),
        condition_applied: z.string().optional()
    })).optional(),
    self_damage: z.number().int().optional(),
    narrative: z.string(),
    audit_log: z.any()
});
export type StuntResult = z.infer<typeof StuntResultSchema>;

// ============================================================================
// CUSTOM EFFECTS SYSTEM
// ============================================================================

export const SourceTypeSchema = z.enum(['divine', 'arcane', 'natural', 'cursed', 'psionic', 'unknown']);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const EffectCategorySchema = z.enum(['boon', 'curse', 'neutral', 'transformative']);
export type EffectCategory = z.infer<typeof EffectCategorySchema>;

export const PowerLevelSchema = z.number().int().min(1).max(5);
export type PowerLevel = z.infer<typeof PowerLevelSchema>;

export const MechanicTypeSchema = z.enum([
    'attack_bonus', 'damage_bonus', 'ac_bonus', 'saving_throw_bonus', 'skill_bonus',
    'advantage_on', 'disadvantage_on',
    'damage_resistance', 'damage_vulnerability', 'damage_immunity',
    'damage_over_time', 'healing_over_time',
    'extra_action', 'prevent_action', 'movement_modifier',
    'sense_granted', 'sense_removed', 'speak_language', 'cannot_speak',
    'custom_trigger'
]);
export type MechanicType = z.infer<typeof MechanicTypeSchema>;

export const EffectMechanicSchema = z.object({
    type: MechanicTypeSchema,
    value: z.union([z.number(), z.string()]),
    condition: z.string().optional().describe('e.g., "against undead"')
});
export type EffectMechanic = z.infer<typeof EffectMechanicSchema>;

export const DurationTypeSchema = z.enum(['rounds', 'minutes', 'hours', 'days', 'permanent', 'until_removed']);
export type DurationType = z.infer<typeof DurationTypeSchema>;

export const TriggerEventSchema = z.enum([
    'always_active', 'start_of_turn', 'end_of_turn',
    'on_attack', 'on_hit', 'on_miss',
    'on_damage_taken', 'on_heal', 'on_rest',
    'on_spell_cast', 'on_death'
]);
export type TriggerEvent = z.infer<typeof TriggerEventSchema>;

export const EffectTriggerSchema = z.object({
    event: TriggerEventSchema,
    condition: z.string().optional()
});
export type EffectTrigger = z.infer<typeof EffectTriggerSchema>;

export const RemovalConditionTypeSchema = z.enum([
    'duration_expires', 'dispelled', 'specific_action', 'quest_complete', 'death', 'rest'
]);

export const RemovalConditionSchema = z.object({
    type: RemovalConditionTypeSchema,
    description: z.string().optional(),
    difficulty_class: z.number().int().optional()
});
export type RemovalCondition = z.infer<typeof RemovalConditionSchema>;

export const CustomEffectSourceSchema = z.object({
    type: SourceTypeSchema,
    entity_id: z.string().optional(),
    entity_name: z.string().optional()
});

export const CustomEffectDurationSchema = z.object({
    type: DurationTypeSchema,
    value: z.number().int().optional()
});

export const ApplyCustomEffectArgsSchema = z.object({
    target_id: z.string(),
    target_type: ActorTypeSchema,
    name: z.string(),
    description: z.string(),
    source: CustomEffectSourceSchema,
    category: EffectCategorySchema,
    power_level: PowerLevelSchema,
    mechanics: z.array(EffectMechanicSchema),
    duration: CustomEffectDurationSchema,
    triggers: z.array(EffectTriggerSchema),
    removal_conditions: z.array(RemovalConditionSchema),
    stackable: z.boolean().optional().default(false),
    max_stacks: z.number().int().min(1).optional().default(1)
});
export type ApplyCustomEffectArgs = z.infer<typeof ApplyCustomEffectArgsSchema>;

export const CustomEffectSchema = z.object({
    id: z.number().int(),
    target_id: z.string(),
    target_type: ActorTypeSchema,
    name: z.string(),
    description: z.string().nullable(),
    source_type: SourceTypeSchema,
    source_entity_id: z.string().nullable(),
    source_entity_name: z.string().nullable(),
    category: EffectCategorySchema,
    power_level: PowerLevelSchema,
    mechanics: z.array(EffectMechanicSchema),
    duration_type: DurationTypeSchema,
    duration_value: z.number().int().nullable(),
    rounds_remaining: z.number().int().nullable(),
    triggers: z.array(EffectTriggerSchema),
    removal_conditions: z.array(RemovalConditionSchema),
    stackable: z.boolean(),
    max_stacks: z.number().int(),
    current_stacks: z.number().int(),
    is_active: z.boolean(),
    created_at: z.string(),
    expires_at: z.string().nullable()
});
export type CustomEffect = z.infer<typeof CustomEffectSchema>;

// ============================================================================
// ARCANE SYNTHESIS - DYNAMIC SPELL CREATION
// ============================================================================

export const SpellEffectTypeSchema = z.enum(['damage', 'healing', 'status', 'utility', 'summon', 'hybrid']);
export type SpellEffectType = z.infer<typeof SpellEffectTypeSchema>;

export const TargetingTypeSchema = z.enum(['self', 'single', 'multiple', 'area', 'line', 'cone']);
export type TargetingType = z.infer<typeof TargetingTypeSchema>;

export const SynthesisEffectSchema = z.object({
    type: SpellEffectTypeSchema,
    dice: z.string().optional().describe('Dice notation: "3d8"'),
    damage_type: DamageTypeSchema.optional(),
    condition: z.string().optional(),
    condition_duration: z.string().optional()
});

export const SynthesisTargetingSchema = z.object({
    type: TargetingTypeSchema,
    range: z.number().int().min(0).describe('Range in feet'),
    area_size: z.number().int().optional().describe('AoE size in feet'),
    max_targets: z.number().int().optional()
});

export const SynthesisSavingThrowSchema = z.object({
    ability: AbilityNameSchema,
    effect_on_save: z.enum(['none', 'half', 'negates'])
});

export const SynthesisMaterialComponentSchema = z.object({
    description: z.string(),
    consumed: z.boolean(),
    value: z.number().int().optional().describe('Value in gold pieces')
});

export const SynthesisComponentsSchema = z.object({
    verbal: z.boolean(),
    somatic: z.boolean(),
    material: SynthesisMaterialComponentSchema.optional()
});

export const AttemptArcaneSynthesisArgsSchema = z.object({
    encounter_id: z.number().int().optional().describe('+2 DC if in combat'),
    caster_id: z.string(),
    caster_type: ActorTypeSchema,

    narrative_intent: z.string().describe('What spell effect the player wants'),
    proposed_name: z.string().optional(),

    estimated_level: z.number().int().min(1).max(9),
    school: SpellSchoolSchema,

    effect_specification: SynthesisEffectSchema,
    targeting: SynthesisTargetingSchema,
    saving_throw: SynthesisSavingThrowSchema.optional(),
    components: SynthesisComponentsSchema,
    concentration: z.boolean(),
    duration: z.string(),

    circumstance_modifiers: z.array(z.string()).optional().describe('e.g., "near ley line", "blood moon"'),
    target_ids: z.array(z.string()).optional(),
    target_types: z.array(ActorTypeSchema).optional()
});
export type AttemptArcaneSynthesisArgs = z.infer<typeof AttemptArcaneSynthesisArgsSchema>;

export const SynthesisOutcomeSchema = z.enum(['mastery', 'success', 'fizzle', 'backfire', 'catastrophic']);
export type SynthesisOutcome = z.infer<typeof SynthesisOutcomeSchema>;

export const WildSurgeEffectSchema = z.object({
    roll: z.number().int().min(1).max(20),
    name: z.string(),
    effect: z.string()
});
export type WildSurgeEffect = z.infer<typeof WildSurgeEffectSchema>;

export const ArcaneSynthesisResultSchema = z.object({
    outcome: SynthesisOutcomeSchema,
    roll: z.number().int(),
    modifier: z.number().int(),
    total: z.number().int(),
    dc: z.number().int(),
    dc_breakdown: z.object({
        base: z.number().int(),
        spell_level: z.number().int(),
        in_combat: z.number().int().optional(),
        novel_effect: z.number().int().optional(),
        material_reduction: z.number().int().optional(),
        related_spell: z.number().int().optional(),
        school_specialization: z.number().int().optional(),
        ley_line: z.number().int().optional(),
        celestial_event: z.number().int().optional(),
        desperation: z.number().int().optional()
    }),
    spell_worked: z.boolean(),
    spell_mastered: z.boolean(),
    damage_dealt: z.number().int().optional(),
    healing_done: z.number().int().optional(),
    targets_affected: z.array(z.object({
        id: z.string(),
        name: z.string(),
        effect: z.string()
    })).optional(),
    backfire_damage: z.number().int().optional(),
    wild_surge: WildSurgeEffectSchema.optional(),
    spell_slot_consumed: z.boolean(),
    narrative: z.string(),
    audit_log: z.any()
});
export type ArcaneSynthesisResult = z.infer<typeof ArcaneSynthesisResultSchema>;

export const SynthesizedSpellSchema = z.object({
    id: z.number().int(),
    character_id: z.string(),
    name: z.string(),
    level: z.number().int().min(1).max(9),
    school: SpellSchoolSchema,
    effect_type: SpellEffectTypeSchema,
    effect_dice: z.string().nullable(),
    damage_type: DamageTypeSchema.nullable(),
    targeting_type: TargetingTypeSchema,
    targeting_range: z.number().int(),
    targeting_area_size: z.number().int().nullable(),
    targeting_max_targets: z.number().int().nullable(),
    saving_throw_ability: AbilityNameSchema.nullable(),
    saving_throw_effect: z.string().nullable(),
    components_verbal: z.boolean(),
    components_somatic: z.boolean(),
    components_material: SynthesisMaterialComponentSchema.nullable(),
    concentration: z.boolean(),
    duration: z.string(),
    synthesis_dc: z.number().int(),
    created_at: z.string(),
    mastered_at: z.string(),
    times_cast: z.number().int()
});
export type SynthesizedSpell = z.infer<typeof SynthesizedSpellSchema>;

// ============================================================================
// WILD SURGE TABLE
// ============================================================================

export const WILD_SURGE_TABLE: WildSurgeEffect[] = [
    { roll: 1, name: 'Inverted Intent', effect: 'Damage heals, healing damages. All effects are reversed for 1 minute.' },
    { roll: 2, name: 'Arcane Feedback', effect: '1d6 force damage per spell level to caster.' },
    { roll: 3, name: 'Spell Vampirism', effect: 'ALL spell slots of that level are drained.' },
    { roll: 4, name: 'Temporal Stutter', effect: 'Caster skips next turn, frozen in time.' },
    { roll: 5, name: 'Dimensional Hiccup', effect: 'Teleport 3d6×5 feet in a random direction.' },
    { roll: 6, name: 'Polymorphic Instability', effect: 'Transform into a small beast for 1 minute.' },
    { roll: 7, name: 'Magical Beacon', effect: '60ft bright light emanates from caster. Attacks have advantage vs caster for 1 minute.' },
    { roll: 8, name: 'Elemental Attunement', effect: 'Vulnerability to a random damage type for 1 hour.' },
    { roll: 9, name: 'Sympathetic Link', effect: 'Caster takes half of any damage they deal for 1 minute.' },
    { roll: 10, name: 'Wild Growth', effect: '30ft radius becomes difficult terrain (vines/plants) for 10 minutes.' },
    { roll: 11, name: 'Silence of the Void', effect: '20ft radius silence centered on caster for 1 minute.' },
    { roll: 12, name: 'Magical Exhaustion', effect: 'Caster gains 2 levels of exhaustion.' },
    { roll: 13, name: 'Summoned Attention', effect: 'A hostile minor elemental (CR 1/4) appears within 30ft.' },
    { roll: 14, name: 'Memory Leak', effect: 'Forget one random prepared spell until next long rest.' },
    { roll: 15, name: 'Arcane Allergy', effect: 'Cannot cast spells from this school for 24 hours.' },
    { roll: 16, name: 'Magical Magnetism', effect: 'All metal objects within 30ft fly toward caster, dealing 2d6 bludgeoning damage.' },
    { roll: 17, name: 'Prismatic Flash', effect: 'Color Spray effect hits everyone within 15ft (including caster).' },
    { roll: 18, name: 'Gravity Reversal', effect: 'Fall upward 30ft, then fall back down. Take appropriate fall damage.' },
    { roll: 19, name: 'Soul Echo', effect: 'A ghostly duplicate mirrors caster actions for 1 minute (no extra effect, just visual).' },
    { roll: 20, name: 'Complete Magical Inversion', effect: 'Dispel all magic within 60ft. Magic items suppressed for 1 hour.' }
];

// ============================================================================
// DC AND DAMAGE GUIDELINES (for LLM reference)
// ============================================================================

export const DC_GUIDELINES = {
    TRIVIAL: 5,      // Kick open unlocked door
    EASY: 10,        // Swing from rope
    MEDIUM: 15,      // Kick stuck mine cart
    HARD: 20,        // Catch thrown weapon
    VERY_HARD: 25,   // Run across crumbling bridge
    NEARLY_IMPOSSIBLE: 30  // Catch arrow mid-flight
} as const;

export const DAMAGE_GUIDELINES = {
    NUISANCE: '1d4',     // Thrown mug
    LIGHT: '1d6',        // Chair smash
    MODERATE: '2d6',     // Barrel roll
    HEAVY: '3d6',        // Mine cart
    SEVERE: '4d6',       // Chandelier drop
    MASSIVE: '6d6',      // Collapsing pillar
    CATASTROPHIC: '8d6'  // Building collapse
} as const;

export const SPELL_LEVEL_DAMAGE = {
    1: { single: '3d6', aoe: '2d6', aoe_size: 10, status_duration: '1 round' },
    2: { single: '4d6', aoe: '3d6', aoe_size: 15, status_duration: '1 round' },
    3: { single: '8d6', aoe: '6d6', aoe_size: 20, status_duration: '1 minute' },
    4: { single: '10d6', aoe: '8d6', aoe_size: 30, status_duration: '1 minute' },
    5: { single: '12d6', aoe: '10d6', aoe_size: 40, status_duration: '10 minutes' },
    6: { single: '14d6', aoe: '12d6', aoe_size: 50, status_duration: '1 hour' },
    7: { single: '16d6', aoe: '14d6', aoe_size: 60, status_duration: '8 hours' },
    8: { single: '18d6', aoe: '16d6', aoe_size: 70, status_duration: '24 hours' },
    9: { single: '20d6', aoe: '18d6', aoe_size: 80, status_duration: 'Until dispelled' }
} as const;

export const POWER_LEVEL_GUIDELINES = {
    1: { duration: 'Hours', impact: '+1/-1, minor condition', example: 'Lucky charm' },
    2: { duration: 'Days', impact: '+2/-2, advantage/disadvantage', example: 'Battle blessing' },
    3: { duration: 'Weeks', impact: '+3/-3, resistance/vulnerability', example: 'Champion\'s mantle' },
    4: { duration: 'Months', impact: '+5/-5, immunity, extra actions', example: 'Avatar\'s grace' },
    5: { duration: 'Permanent', impact: 'Reality-warping', example: 'Demigod status' }
} as const;

// Skill to ability mapping for modifier calculation
export const SKILL_TO_ABILITY: Record<SkillName, AbilityName> = {
    athletics: 'strength',
    acrobatics: 'dexterity',
    sleight_of_hand: 'dexterity',
    stealth: 'dexterity',
    arcana: 'intelligence',
    history: 'intelligence',
    investigation: 'intelligence',
    nature: 'intelligence',
    religion: 'intelligence',
    animal_handling: 'wisdom',
    insight: 'wisdom',
    medicine: 'wisdom',
    perception: 'wisdom',
    survival: 'wisdom',
    deception: 'charisma',
    intimidation: 'charisma',
    performance: 'charisma',
    persuasion: 'charisma'
};
