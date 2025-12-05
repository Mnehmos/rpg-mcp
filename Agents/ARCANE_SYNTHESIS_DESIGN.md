# Arcane Synthesis: Dynamic Spell Creation System

## Design Document for Quest Keeper AI
## Date: December 5, 2025
## Status: Ready for Implementation

---

## EXECUTIVE SUMMARY

**Arcane Synthesis** transforms spellcasting from menu-reading into magical engineering. Wizards can invent spells on the fly, but at a cost: the magic is unstable, requires skill checks, and can backfire spectacularly.

This system embodies Quest Keeper AI's core philosophy: **"LLM Describes, Engine Validates"**

- The AI DM adjudicates the creative intent
- The engine validates the balance and executes the mechanics
- The database crystallizes successful creations for future use

---

## PART 1: THE GAMEPLAY LOOP

### Phase 1: Declaration
Player describes desired effect in natural language:
> "I want to weave the shadows in the room to wrap around the goblin leader's head and blind only him."

### Phase 2: Adjudication (AI DM Analysis)
The AI:
1. Parses the intent (Target: Single, Effect: Blindness, Duration: Short)
2. Compares to existing spells (Similar to *Blindness/Deafness* - Level 2)
3. Calculates the **Synthesis DC** based on complexity
4. Determines **Spell Slot Cost** based on power level

### Phase 3: The Wager
- Player must commit the spell slot BEFORE the roll
- This creates meaningful risk/reward tension
- No "I'll try to invent it, and if it fails, I'll cast something else"

### Phase 4: The Roll
**Arcana Check vs. Synthesis DC**

| Roll Result | Outcome |
|-------------|---------|
| Natural 20 | **Mastery**: Spell works AND permanently added to spellbook |
| Success (≥ DC) | **Success**: Spell works this one time |
| Failure (< DC) | **Fizzle**: Slot wasted, no effect |
| Natural 1 | **Catastrophic Backfire**: Slot wasted + Wild Surge |
| Failure by 5+ | **Backfire**: Slot wasted + Minor Mishap |

### Phase 5: Crystallization
On success, the spell becomes a real game object:
- Stored in database with creator attribution
- Can be taught, copied, or discovered
- NPCs who witnessed it may attempt to recreate it

---

## PART 2: THE BALANCE MATRIX

### Spell Level Determination

The AI uses this rubric to assign spell levels:

| Level | Damage (Single) | Damage (AoE) | Status Effect | Utility |
|-------|-----------------|--------------|---------------|---------|
| **1** | 2d10 / 3d6 | 2d6 (10ft) | Minor (Prone, Push 10ft) | Minor detection/illusion |
| **2** | 3d10 / 4d6 | 3d6 (15ft) | Moderate (Blind, Restrain) 1 round | Invisibility (self), Levitate |
| **3** | 5d10 / 8d6 | 6d6 (20ft) | Hard (Paralyze, Fear) 1 min | Flight, Major Illusion |
| **4** | 7d10 / 10d6 | 8d6 (30ft) | Severe (Banish, Polymorph) | Dimension Door, Wall spells |
| **5** | 8d10 / 12d6 | 10d6 (40ft) | Deadly (Dominate, Petrify) | Teleportation Circle |
| **6** | 10d10 | 12d6 (60ft) | Near-death (Disintegrate) | True Seeing, Major Creation |
| **7** | 12d10 | 14d6 (80ft) | Death (Finger of Death) | Teleport, Plane Shift |
| **8** | 14d10 | 14d6 (100ft) | Instant Kill (PWK) | Demiplane, Clone |
| **9** | 20d6+ | 20d6+ | Reality Warp | Wish-adjacent |

### Level Modifiers

| Factor | Modifier |
|--------|----------|
| **Targeting** | |
| Self-only | -1 level |
| Single target | Base level |
| Selective (allies excluded) | +1 level |
| Area of Effect | +1 level |
| Multiple targets (discrete) | +1 per 2 additional |
| **Duration** | |
| Instantaneous | Base |
| Concentration, 1 minute | +0 |
| Concentration, 10 minutes | +1 level |
| 1 hour+ | +1 level |
| Permanent | +2 levels |
| **Damage Type** | |
| Common (Fire, Cold, Lightning) | Base |
| Uncommon (Thunder, Acid, Poison) | +0 |
| Rare (Radiant, Necrotic) | +0 |
| Very Rare (Force, Psychic) | +1 level |
| **Saving Throw** | |
| Common save (DEX, CON) | Base |
| Mental save (WIS, INT, CHA) | +0 |
| No save (auto-hit) | +1 level |
| **Range** | |
| Touch | -1 level |
| 30 feet | Base |
| 60-120 feet | +0 |
| Sight | +1 level |
| Unlimited (same plane) | +2 levels |

### Synthesis DC Calculation

**Base DC = 10 + (Spell Level × 2)**

| Spell Level | Base DC |
|-------------|---------|
| 1 | 12 |
| 2 | 14 |
| 3 | 16 |
| 4 | 18 |
| 5 | 20 |
| 6 | 22 |
| 7 | 24 |
| 8 | 26 |
| 9 | 28 |

### DC Modifiers

| Factor | DC Modifier |
|--------|-------------|
| Caster has related spell in spellbook | -2 |
| Effect is a variation of known spell | -2 |
| Caster's school specialization matches | -2 |
| Under combat stress | +2 |
| Time pressure (no preparation) | +2 |
| Using expensive material component | -1 per 100gp |
| Attempting in antimagic/wild magic zone | +5 |
| Creating a completely novel effect | +3 |

---

## PART 3: TOOL DEFINITIONS

### 3.1 Primary Tool: `attempt_arcane_synthesis`

```typescript
// File: src/server/synthesis-tools.ts

import { z } from 'zod';

export const SynthesisTools = {
    ATTEMPT_ARCANE_SYNTHESIS: {
        name: 'attempt_arcane_synthesis',
        description: `Attempt to invent and cast a new spell on the fly.

ARCANE SYNTHESIS RULES:
1. The caster describes their desired magical effect
2. The AI DM analyzes and assigns level/DC based on the Balance Matrix
3. The caster must commit a spell slot of the calculated level
4. The caster makes an Arcana check vs. the Synthesis DC
5. On success, the spell takes effect
6. On critical success (nat 20), the spell is permanently learned
7. On failure, the slot is wasted
8. On critical failure (nat 1), a magical mishap occurs

BALANCE MATRIX QUICK REFERENCE:
- Level 1: Single target ~3d6, or minor status
- Level 2: Small AoE ~3d6, or blind/restrain 1 round
- Level 3: Large AoE ~6d6 (Fireball equivalent), or flight
- Level 4: Banishment-tier, ~8d8 single target
- Level 5+: Reality-warping effects

DC = 10 + (Spell Level × 2), modified by circumstances.

This tool embodies the "Rule of Cool" for spellcasters - letting them be magical engineers rather than menu readers.`,

        inputSchema: z.object({
            encounterId: z.string().optional()
                .describe('If in combat, the encounter ID'),
            casterId: z.string()
                .describe('The character attempting synthesis'),
            narrativeIntent: z.string()
                .describe('What the player wants the spell to do, in their own words'),
            proposedName: z.string().optional()
                .describe('Player-suggested name (e.g., "Elara\'s Shadow Bind")'),
            
            // AI-determined fields based on Balance Matrix
            estimatedLevel: z.number().int().min(1).max(9)
                .describe('Spell slot level required, determined by AI using Balance Matrix'),
            school: z.enum([
                'abjuration', 'conjuration', 'divination', 'enchantment',
                'evocation', 'illusion', 'necromancy', 'transmutation'
            ]).describe('Magical school that best fits the effect'),
            synthesisDC: z.number().int().min(10).max(35)
                .describe('Arcana check DC = 10 + (level × 2) ± modifiers'),
            
            // Effect specification
            effect: z.object({
                type: z.enum(['damage', 'healing', 'status', 'utility', 'summon', 'hybrid']),
                damage: z.string().optional()
                    .describe('Dice notation if damage (e.g., "3d6")'),
                damageType: z.string().optional(),
                healing: z.string().optional()
                    .describe('Dice notation if healing'),
                condition: z.string().optional()
                    .describe('Status effect applied (blinded, frightened, etc.)'),
                conditionDuration: z.number().int().optional()
                    .describe('Rounds the condition lasts'),
                utilityEffect: z.string().optional()
                    .describe('Non-damage/status effect description')
            }),
            
            targeting: z.object({
                type: z.enum(['self', 'single', 'multiple', 'area', 'line', 'cone']),
                range: z.number().int().min(0).max(1000)
                    .describe('Range in feet (0 = self/touch)'),
                areaSize: z.number().int().optional()
                    .describe('Radius/length in feet if area effect'),
                maxTargets: z.number().int().optional()
                    .describe('Max targets if multiple')
            }),
            
            savingThrow: z.object({
                ability: z.enum(['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom', 'charisma']),
                effectOnSave: z.enum(['none', 'half', 'negates'])
            }).optional(),
            
            components: z.object({
                verbal: z.boolean().default(true),
                somatic: z.boolean().default(true),
                material: z.string().optional()
                    .describe('Material component description'),
                materialConsumed: z.boolean().default(false),
                materialValue: z.number().optional()
                    .describe('GP value if expensive component')
            }).optional(),
            
            concentration: z.boolean().default(false),
            duration: z.string().default('Instantaneous')
                .describe('e.g., "1 round", "1 minute", "Concentration, 1 hour"'),
            
            // Circumstance modifiers
            dcModifiers: z.array(z.object({
                reason: z.string(),
                modifier: z.number().int()
            })).optional().describe('Explanations for DC adjustments'),
            
            advantage: z.boolean().optional()
                .describe('Does the caster have advantage on the Arcana check?'),
            disadvantage: z.boolean().optional()
                .describe('Does the caster have disadvantage?')
        })
    },

    REGISTER_NEW_SPELL: {
        name: 'register_new_spell',
        description: `Crystallize a successfully synthesized spell into the game's spell database.

Called automatically when Arcane Synthesis succeeds with a critical (nat 20).
Can also be called during downtime when a caster scribes a spell they've successfully cast.

The spell becomes:
- Permanently available to the creating caster
- Learnable by other spellcasters who witness it
- Discoverable in grimoires and spell research`,

        inputSchema: z.object({
            name: z.string()
                .describe('Official spell name'),
            level: z.number().int().min(0).max(9),
            school: z.enum([
                'abjuration', 'conjuration', 'divination', 'enchantment',
                'evocation', 'illusion', 'necromancy', 'transmutation'
            ]),
            castingTime: z.string().default('1 action'),
            range: z.string(),
            components: z.string()
                .describe('e.g., "V, S, M (a pinch of shadow dust)"'),
            duration: z.string(),
            concentration: z.boolean().default(false),
            description: z.string()
                .describe('Full spell description text'),
            
            // Mechanical effects for engine
            mechanicalEffect: z.object({
                damage: z.string().optional(),
                damageType: z.string().optional(),
                healing: z.string().optional(),
                condition: z.string().optional(),
                conditionDuration: z.number().int().optional(),
                savingThrow: z.object({
                    ability: z.string(),
                    effectOnSave: z.string()
                }).optional(),
                areaOfEffect: z.object({
                    shape: z.string(),
                    size: z.number()
                }).optional()
            }),
            
            // Provenance
            originCasterId: z.string(),
            originCasterName: z.string(),
            discoveryContext: z.string()
                .describe('Where/when the spell was created'),
            witnessIds: z.array(z.string()).optional()
                .describe('Characters who saw the spell cast'),
            
            // Stability rating
            stability: z.enum(['stable', 'volatile', 'unstable']).default('volatile')
                .describe('How refined the spell is'),
            
            // Class restrictions
            availableTo: z.array(z.string()).optional()
                .describe('Class list that can learn this spell')
        })
    },

    LEARN_WITNESSED_SPELL: {
        name: 'learn_witnessed_spell',
        description: `Attempt to learn a spell you witnessed being cast.

Requirements:
- Must have witnessed the spell (be in observer_ids)
- Must have Arcana proficiency
- Must spend downtime researching
- Must succeed on Arcana check (DC = 10 + spell level × 3)
- Must pay scribing costs if successful`,

        inputSchema: z.object({
            characterId: z.string(),
            spellId: z.string(),
            downtimeDays: z.number().int().min(1).max(30)
                .describe('Days spent researching'),
            goldSpent: z.number().int().min(0)
                .describe('Gold spent on materials')
        })
    }
} as const;
```

### 3.2 Handler Implementation

```typescript
// File: src/server/synthesis-tools.ts (continued)

export async function handleArcaneSynthesis(args: unknown, ctx: SessionContext) {
    const parsed = SynthesisTools.ATTEMPT_ARCANE_SYNTHESIS.inputSchema.parse(args);
    
    // Get caster from database or encounter
    const caster = await getCharacter(parsed.casterId);
    if (!caster) {
        throw new Error(`Caster ${parsed.casterId} not found`);
    }
    
    // Verify caster is a spellcaster
    const spellcastingClasses = ['wizard', 'sorcerer', 'warlock', 'bard', 'cleric', 'druid', 'paladin', 'ranger', 'artificer', 'eldritch_knight', 'arcane_trickster'];
    if (!spellcastingClasses.includes(caster.characterClass || '') && !spellcastingClasses.includes(caster.subclass || '')) {
        return {
            content: [{
                type: 'text' as const,
                text: `❌ ${caster.name} is not a spellcaster and cannot attempt Arcane Synthesis.`
            }]
        };
    }
    
    // Check spell slot availability
    const slotKey = `level${parsed.estimatedLevel}` as keyof typeof caster.spellSlots;
    const slots = caster.spellSlots?.[slotKey];
    if (!slots || slots.current <= 0) {
        return {
            content: [{
                type: 'text' as const,
                text: `❌ ${caster.name} has no Level ${parsed.estimatedLevel} spell slots remaining.\n\nThe spell would require a Level ${parsed.estimatedLevel} slot to attempt.`
            }]
        };
    }
    
    // Build output
    let output = `\n┌─────────────────────────────────────────────────────────┐\n`;
    output += `│ ✨ ARCANE SYNTHESIS\n`;
    output += `└─────────────────────────────────────────────────────────┘\n\n`;
    
    // Display the intent
    output += `🧙 ${caster.name} reaches into the raw weave of magic...\n\n`;
    output += `📜 Intent: "${parsed.narrativeIntent}"\n`;
    output += `🏷️ Proposed Name: ${parsed.proposedName || '(unnamed)'}\n`;
    output += `🎓 School: ${parsed.school.charAt(0).toUpperCase() + parsed.school.slice(1)}\n\n`;
    
    // Display the analysis
    output += `⚖️ BALANCE ANALYSIS:\n`;
    output += `   Spell Level: ${parsed.estimatedLevel}\n`;
    output += `   Effect Type: ${parsed.effect.type}\n`;
    if (parsed.effect.damage) {
        output += `   Damage: ${parsed.effect.damage} ${parsed.effect.damageType || ''}\n`;
    }
    if (parsed.effect.condition) {
        output += `   Condition: ${parsed.effect.condition} (${parsed.effect.conditionDuration || 1} rounds)\n`;
    }
    output += `   Targeting: ${parsed.targeting.type}, ${parsed.targeting.range} ft range\n`;
    if (parsed.savingThrow) {
        output += `   Save: ${parsed.savingThrow.ability.toUpperCase()}, ${parsed.savingThrow.effectOnSave} on save\n`;
    }
    output += `\n`;
    
    // Display the DC calculation
    output += `🎯 SYNTHESIS DC CALCULATION:\n`;
    output += `   Base DC: 10 + (${parsed.estimatedLevel} × 2) = ${10 + parsed.estimatedLevel * 2}\n`;
    if (parsed.dcModifiers) {
        for (const mod of parsed.dcModifiers) {
            output += `   ${mod.modifier >= 0 ? '+' : ''}${mod.modifier}: ${mod.reason}\n`;
        }
    }
    output += `   Final DC: ${parsed.synthesisDC}\n\n`;
    
    // COMMIT THE SLOT (The Wager)
    output += `💫 COMMITTING SPELL SLOT...\n`;
    output += `   Level ${parsed.estimatedLevel} slot: ${slots.current}/${slots.max} → ${slots.current - 1}/${slots.max}\n\n`;
    
    // Consume the slot
    await consumeSpellSlot(parsed.casterId, parsed.estimatedLevel);
    
    // Get Arcana modifier
    const intMod = Math.floor((caster.stats.int - 10) / 2);
    const profBonus = Math.ceil(caster.level / 4) + 1;
    const hasArcanaProficiency = true; // Assume wizards have it
    const arcanaMod = intMod + (hasArcanaProficiency ? profBonus : 0);
    
    // Roll the Arcana check
    let roll1 = Math.floor(Math.random() * 20) + 1;
    let roll2 = Math.floor(Math.random() * 20) + 1;
    let finalRoll = roll1;
    
    if (parsed.advantage && !parsed.disadvantage) {
        finalRoll = Math.max(roll1, roll2);
        output += `🎲 Arcana Check (Advantage): d20(${roll1}, ${roll2}) → ${finalRoll}`;
    } else if (parsed.disadvantage && !parsed.advantage) {
        finalRoll = Math.min(roll1, roll2);
        output += `🎲 Arcana Check (Disadvantage): d20(${roll1}, ${roll2}) → ${finalRoll}`;
    } else {
        output += `🎲 Arcana Check: d20(${finalRoll})`;
    }
    output += ` + ${arcanaMod} = ${finalRoll + arcanaMod} vs DC ${parsed.synthesisDC}\n\n`;
    
    const total = finalRoll + arcanaMod;
    const isNat20 = finalRoll === 20;
    const isNat1 = finalRoll === 1;
    const success = isNat20 || (total >= parsed.synthesisDC && !isNat1);
    const critSuccess = isNat20;
    const critFailure = isNat1;
    const failureBy5 = !success && (parsed.synthesisDC - total >= 5);
    
    // DETERMINE OUTCOME
    if (critSuccess) {
        // MASTERY - Spell works AND is permanently learned
        output += `✨✨✨ NATURAL 20 - MASTERY! ✨✨✨\n\n`;
        output += `The magic flows through ${caster.name} with perfect clarity!\n`;
        output += `Not only does the spell succeed, but the arcane formula is permanently etched into their mind.\n\n`;
        
        // Spell effect resolution
        output += await resolveSpellEffect(parsed, caster);
        
        // Crystallization
        const spellName = parsed.proposedName || `${caster.name}'s ${parsed.school} Spell`;
        output += `\n📖 CRYSTALLIZATION:\n`;
        output += `   "${spellName}" has been added to ${caster.name}'s spellbook!\n`;
        output += `   This spell can now be prepared and cast normally.\n`;
        
        // Create spell record
        const spellId = await registerSpell(parsed, caster, 'stable');
        output += `   [Spell ID: ${spellId}]\n`;
        
    } else if (success) {
        // SUCCESS - Spell works this one time
        output += `✅ SUCCESS!\n\n`;
        output += `The magic coalesces into the desired form—this time.\n`;
        output += `${caster.name} successfully improvises the spell!\n\n`;
        
        // Spell effect resolution
        output += await resolveSpellEffect(parsed, caster);
        
        output += `\n📝 NOTE: This spell was cast successfully but not mastered.\n`;
        output += `   To permanently learn it, ${caster.name} must:\n`;
        output += `   - Cast it successfully again with a Natural 20, OR\n`;
        output += `   - Spend downtime scribing it (${parsed.estimatedLevel * 2} days, ${parsed.estimatedLevel * 50}gp)\n`;
        
        // Create volatile spell record
        const spellId = await registerSpell(parsed, caster, 'volatile');
        output += `   [Volatile Spell ID: ${spellId}]\n`;
        
    } else if (critFailure) {
        // CATASTROPHIC BACKFIRE - Wild Surge
        output += `💀💀💀 NATURAL 1 - CATASTROPHIC BACKFIRE! 💀💀💀\n\n`;
        output += `The raw magic spirals out of control!\n\n`;
        
        // Roll on the Wild Surge table
        const surgeRoll = Math.floor(Math.random() * 20) + 1;
        const surge = WILD_SURGE_TABLE[surgeRoll - 1];
        
        output += `🌀 WILD SURGE (d20 = ${surgeRoll}):\n`;
        output += `   "${surge.name}"\n`;
        output += `   ${surge.description}\n\n`;
        
        // Apply surge effect
        output += await applySurgeEffect(surge, parsed, caster, ctx);
        
    } else if (failureBy5) {
        // MINOR BACKFIRE - Spell fizzles with side effect
        output += `❌ FAILURE BY 5+ - MINOR BACKFIRE!\n\n`;
        output += `The magic fizzles, but not cleanly...\n\n`;
        
        // Roll on minor mishap table (rolls 1-10 of surge table)
        const mishapRoll = Math.floor(Math.random() * 10) + 1;
        const mishap = MINOR_MISHAP_TABLE[mishapRoll - 1];
        
        output += `⚡ MISHAP (d10 = ${mishapRoll}):\n`;
        output += `   "${mishap.name}"\n`;
        output += `   ${mishap.description}\n\n`;
        
        output += await applySurgeEffect(mishap, parsed, caster, ctx);
        
    } else {
        // SIMPLE FAILURE - Slot wasted, no effect
        output += `❌ FAILURE\n\n`;
        output += `The magic refuses to take the desired shape.\n`;
        output += `The spell slot is expended, but nothing happens.\n\n`;
        output += `Perhaps the formula was slightly off, or the intent wasn't clear enough.\n`;
        output += `${caster.name} may try again with a new slot.\n`;
    }
    
    // Encounter observers
    if (parsed.encounterId) {
        const engine = getCombatManager().get(`${ctx.sessionId}:${parsed.encounterId}`);
        if (engine) {
            const state = engine.getState();
            const observers = state?.participants.map(p => p.id) || [];
            output += `\n👁️ WITNESSES: ${observers.length} creatures observed this magical working.\n`;
        }
    }
    
    output += `\n→ Synthesis attempt complete.`;
    
    return {
        content: [{
            type: 'text' as const,
            text: output
        }]
    };
}

async function resolveSpellEffect(
    spell: z.infer<typeof SynthesisTools.ATTEMPT_ARCANE_SYNTHESIS.inputSchema>,
    caster: Character
): Promise<string> {
    let output = `⚡ SPELL EFFECT:\n`;
    
    // For now, return descriptive text
    // In full implementation, this would call combat engine tools
    
    if (spell.effect.damage) {
        const damageRoll = rollDice(spell.effect.damage);
        output += `   Damage: ${spell.effect.damage} = ${damageRoll} ${spell.effect.damageType || 'magical'}\n`;
    }
    
    if (spell.effect.healing) {
        const healRoll = rollDice(spell.effect.healing);
        output += `   Healing: ${spell.effect.healing} = ${healRoll}\n`;
    }
    
    if (spell.effect.condition) {
        output += `   Condition Applied: ${spell.effect.condition.toUpperCase()}`;
        if (spell.effect.conditionDuration) {
            output += ` for ${spell.effect.conditionDuration} rounds`;
        }
        output += `\n`;
    }
    
    if (spell.savingThrow) {
        output += `   Save: ${spell.savingThrow.ability.toUpperCase()}, DC ${8 + Math.ceil(caster.level / 4) + 1 + Math.floor((caster.stats.int - 10) / 2)}\n`;
        output += `   On Save: ${spell.savingThrow.effectOnSave}\n`;
    }
    
    return output;
}
```

---

## PART 4: THE MAGICAL MISHAP TABLES

### Wild Surge Table (d20) - Catastrophic Backfires

```typescript
const WILD_SURGE_TABLE: MagicalMishap[] = [
    {
        id: 1,
        name: "Inverted Intent",
        description: "The spell's effect is reversed. Damage heals, healing damages. Buffs become debuffs.",
        effect: "invert",
        severity: "major"
    },
    {
        id: 2,
        name: "Arcane Feedback",
        description: "Raw magic slams back into the caster. Take 1d6 force damage per spell level.",
        effect: { damage: "1d6_per_level", type: "force", target: "caster" },
        severity: "major"
    },
    {
        id: 3,
        name: "Spell Vampirism",
        description: "The failed spell drains ALL remaining spell slots of that level.",
        effect: "drain_slots",
        severity: "major"
    },
    {
        id: 4,
        name: "Temporal Stutter",
        description: "The caster is removed from the initiative order for 1 round (frozen in time).",
        effect: { condition: "stunned", duration: 1 },
        severity: "major"
    },
    {
        id: 5,
        name: "Dimensional Hiccup",
        description: "The caster teleports 3d6 × 5 feet in a random direction. If solid object, take 1d6 bludgeoning.",
        effect: { teleport: "random", distance: "3d6*5" },
        severity: "moderate"
    },
    {
        id: 6,
        name: "Polymorphic Instability",
        description: "The caster polymorphs into a random small beast for 1 minute (CON save DC 15 ends).",
        effect: { polymorph: "small_beast", duration: 10, saveDC: 15 },
        severity: "major"
    },
    {
        id: 7,
        name: "Magical Beacon",
        description: "A 60-foot radius of bright light emanates from the caster for 1 minute. All attacks against them have advantage.",
        effect: { condition: "illuminated", duration: 10 },
        severity: "moderate"
    },
    {
        id: 8,
        name: "Elemental Attunement",
        description: "The caster gains vulnerability to a random damage type for 1 hour.",
        effect: { vulnerability: "random", duration: 600 },
        severity: "moderate"
    },
    {
        id: 9,
        name: "Sympathetic Link",
        description: "For the next minute, any damage the caster deals is also dealt to themselves.",
        effect: { link: "damage_reflection", duration: 10 },
        severity: "major"
    },
    {
        id: 10,
        name: "Wild Growth",
        description: "Plants erupt in a 30-foot radius. Area becomes difficult terrain for 10 minutes.",
        effect: { terrain: "difficult", radius: 30, duration: 100 },
        severity: "moderate"
    },
    {
        id: 11,
        name: "Silence of the Void",
        description: "A 20-foot radius of magical silence centers on the caster for 1 minute.",
        effect: { zone: "silence", radius: 20, duration: 10 },
        severity: "moderate"
    },
    {
        id: 12,
        name: "Magical Exhaustion",
        description: "The caster gains 2 levels of exhaustion.",
        effect: { exhaustion: 2 },
        severity: "major"
    },
    {
        id: 13,
        name: "Summoned Attention",
        description: "A hostile minor elemental (appropriate to the spell's school) appears and attacks the caster.",
        effect: { summon: "hostile_elemental", cr: "1" },
        severity: "major"
    },
    {
        id: 14,
        name: "Memory Leak",
        description: "The caster forgets one randomly selected prepared spell until their next long rest.",
        effect: { forget_spell: "random" },
        severity: "moderate"
    },
    {
        id: 15,
        name: "Arcane Allergy",
        description: "The caster cannot cast spells of this school for 24 hours.",
        effect: { school_lock: "attempted_school", duration: 1440 },
        severity: "major"
    },
    {
        id: 16,
        name: "Magical Magnetism",
        description: "All metal objects within 30 feet fly toward the caster. 2d6 bludgeoning if in combat.",
        effect: { pull: "metal", damage: "2d6" },
        severity: "moderate"
    },
    {
        id: 17,
        name: "Prismatic Flash",
        description: "A random color spray effect hits everyone within 15 feet (including allies).",
        effect: { spell: "color_spray", radius: 15, friendly_fire: true },
        severity: "major"
    },
    {
        id: 18,
        name: "Gravity Reversal",
        description: "Gravity reverses for the caster for 1 round. They 'fall' 30 feet up, then back down.",
        effect: { gravity: "reverse", duration: 1, fall_damage: "3d6" },
        severity: "major"
    },
    {
        id: 19,
        name: "Soul Echo",
        description: "A ghostly duplicate of the caster appears and takes a copy of their turn (but cannot cast spells).",
        effect: { duplicate: true, duration: 1, no_spells: true },
        severity: "wild"
    },
    {
        id: 20,
        name: "Complete Magical Inversion",
        description: "Every magical effect within 60 feet is dispelled. Magic items are suppressed for 1 hour.",
        effect: { dispel: "all", radius: 60, suppress_items: 60 },
        severity: "catastrophic"
    }
];

interface MagicalMishap {
    id: number;
    name: string;
    description: string;
    effect: any;
    severity: 'minor' | 'moderate' | 'major' | 'catastrophic' | 'wild';
}
```

### Minor Mishap Table (d10) - For failure by 5+

```typescript
const MINOR_MISHAP_TABLE: MagicalMishap[] = [
    {
        id: 1,
        name: "Arcane Hiccups",
        description: "The caster hiccups glowing runes for 1 minute. Disadvantage on Stealth.",
        effect: { condition: "loud", duration: 10 },
        severity: "minor"
    },
    {
        id: 2,
        name: "Hair Trigger",
        description: "The caster's hair stands on end and crackles with static for 1 hour.",
        effect: { cosmetic: true, duration: 60 },
        severity: "minor"
    },
    {
        id: 3,
        name: "Chromatic Shift",
        description: "The caster's skin turns a random color for 1 hour.",
        effect: { cosmetic: true, duration: 60 },
        severity: "minor"
    },
    {
        id: 4,
        name: "Minor Feedback",
        description: "The caster takes 1d4 force damage.",
        effect: { damage: "1d4", type: "force", target: "caster" },
        severity: "minor"
    },
    {
        id: 5,
        name: "Spell Echo",
        description: "The caster's voice echoes for 1 minute. Can be heard from 60 feet away.",
        effect: { cosmetic: true, duration: 10 },
        severity: "minor"
    },
    {
        id: 6,
        name: "Mana Chill",
        description: "The caster feels freezing cold for 1 hour (no mechanical effect).",
        effect: { cosmetic: true, duration: 60 },
        severity: "minor"
    },
    {
        id: 7,
        name: "Spark Show",
        description: "Harmless sparks fly from the caster's fingertips for 1 minute.",
        effect: { cosmetic: true, duration: 10 },
        severity: "minor"
    },
    {
        id: 8,
        name: "Muffled Speech",
        description: "The caster can only whisper for 10 minutes.",
        effect: { condition: "whisper", duration: 100 },
        severity: "minor"
    },
    {
        id: 9,
        name: "Magical Odor",
        description: "The caster smells strongly of brimstone/flowers/ozone for 1 hour.",
        effect: { cosmetic: true, duration: 60 },
        severity: "minor"
    },
    {
        id: 10,
        name: "Component Consumption",
        description: "A random non-magical item on the caster's person is consumed by the misfire.",
        effect: { destroy_item: "random_mundane" },
        severity: "minor"
    }
];
```

---

## PART 5: THE "WITNESS" MECHANIC

### How Spells Spread Through the World

When a spell is successfully synthesized, it becomes discoverable:

```typescript
interface SpellWitness {
    spellId: string;
    witnessId: string;        // Character who saw it
    witnessName: string;
    witnessType: 'pc' | 'npc' | 'enemy';
    comprehension: 'none' | 'partial' | 'full';  // Based on their Arcana
    timestamp: string;
    encounterId?: string;
}

// Comprehension calculation:
// - Arcana proficiency + INT mod >= Spell Level × 3 = Full
// - Arcana proficiency + INT mod >= Spell Level × 2 = Partial
// - Otherwise = None

// Full comprehension: Can attempt to learn with downtime
// Partial comprehension: Can describe it to others, giving them -2 DC to learn
// None: "I saw them do something magical, not sure what"
```

### NPC Learning

NPCs who witness spells can potentially learn them:

```typescript
interface NPCSpellResearch {
    npcId: string;
    spellId: string;
    researchProgress: number;  // 0-100
    researchStarted: string;
    estimatedCompletion: string;
}

// Enemy wizards might research spells used against them
// Friendly NPCs might offer to teach spells back for a price
// Spells can appear in loot (grimoires with synthesized spells)
```

---

## PART 6: INTEGRATION WITH EXISTING SYSTEMS

### Spell Slot Consumption

The synthesis system uses the existing spell slot tracking in `character.spellSlots`:

```typescript
// In character schema:
spellSlots: {
    level1: { current: number, max: number },
    level2: { current: number, max: number },
    // ... through level 9
}

// Consume slot:
async function consumeSpellSlot(characterId: string, level: number): Promise<void> {
    const char = await getCharacter(characterId);
    const slotKey = `level${level}`;
    if (char.spellSlots[slotKey].current > 0) {
        char.spellSlots[slotKey].current -= 1;
        await updateCharacter(characterId, { spellSlots: char.spellSlots });
    }
}
```

### Combat Integration

In encounters, synthesized spells affect participants through existing combat engine:

```typescript
// After successful synthesis with damage:
await handleExecuteCombatAction({
    encounterId: spell.encounterId,
    action: 'custom_spell',
    actorId: spell.casterId,
    targetId: targetId,
    damage: rollDice(spell.effect.damage),
    damageType: spell.effect.damageType
}, ctx);
```

---

## PART 7: EXAMPLE SYNTHESIS SCENARIOS

### Scenario 1: Elara's Shadow Bind

**Player**: "I want to weave the shadows to blind just the goblin leader, not his friends."

**AI Analysis**:
- Effect: Blindness (Level 2 baseline)
- Targeting: Single target (no modifier)
- Range: 60 feet (standard)
- Duration: 1 round (standard)
- Selective targeting: Already single target
- School: Illusion (shadow manipulation)

**Result**:
```json
{
    "estimatedLevel": 2,
    "synthesisDC": 14,
    "school": "illusion",
    "effect": {
        "type": "status",
        "condition": "blinded",
        "conditionDuration": 1
    },
    "savingThrow": {
        "ability": "constitution",
        "effectOnSave": "negates"
    }
}
```

### Scenario 2: Theron's Kinetic Repulse

**Player**: "Can I channel divine energy to blast everyone away from me? Like a shockwave?"

**AI Analysis**:
- Effect: Push 15 feet (Level 1 baseline)
- Targeting: AoE centered on self (+1 level)
- Damage: 2d6 thunder (Level 1 baseline)
- Total: Level 2 spell
- School: Evocation

**Result**:
```json
{
    "estimatedLevel": 2,
    "synthesisDC": 14,
    "school": "evocation",
    "effect": {
        "type": "hybrid",
        "damage": "2d6",
        "damageType": "thunder",
        "condition": "none"
    },
    "targeting": {
        "type": "area",
        "range": 0,
        "areaSize": 15
    },
    "dcModifiers": [
        { "reason": "Cleric (divine) casting arcane-style spell", "modifier": 2 }
    ]
}
```

### Scenario 3: Grimnar's Flame Blade Extension

**Player**: "My sword is enchanted with fire. Can I swing it and make the flames extend outward as a wave?"

**AI Analysis**:
- Effect: Fire damage in a line (requires Level 2+ for AoE)
- Targeting: Line, 30 feet (+0)
- Damage: 4d6 fire (Level 2 territory)
- Requires: Concentration (if he wants it to persist)
- Prerequisite: Has fire enchanted weapon (-2 DC)
- School: Evocation

**Result**:
```json
{
    "estimatedLevel": 2,
    "synthesisDC": 12,
    "school": "evocation",
    "effect": {
        "type": "damage",
        "damage": "4d6",
        "damageType": "fire"
    },
    "targeting": {
        "type": "line",
        "range": 0,
        "areaSize": 30
    },
    "savingThrow": {
        "ability": "dexterity",
        "effectOnSave": "half"
    },
    "dcModifiers": [
        { "reason": "Building on existing fire enchantment", "modifier": -2 }
    ]
}
```

---

## PART 8: DOWNTIME SPELL RESEARCH

### Scribing a Volatile Spell

When a caster successfully uses Arcane Synthesis but doesn't get a nat 20:

```typescript
interface SpellResearchDowntime {
    characterId: string;
    spellId: string;           // The volatile spell ID
    daysRequired: number;      // Spell level × 2
    goldRequired: number;      // Spell level × 50gp
    daysCompleted: number;
    goldSpent: number;
    finalArcanaCheck?: {
        dc: number;            // 10 + spell level
        roll: number;
        success: boolean;
    };
}

// On completion:
// - Success: Spell becomes "stable" and is added to spellbook
// - Failure: Gold is wasted, can try again
// - Critical Failure: Spell is lost forever
```

### Researching from Description

If a character heard about a spell (partial comprehension witness):

```typescript
interface SpellDiscoveryResearch {
    characterId: string;
    spellName: string;
    sourceType: 'witnessed' | 'described' | 'grimoire' | 'rumor';
    sourceId?: string;          // If witnessed/grimoire
    dcModifier: number;         // Based on source quality
    researchWeeks: number;      // 1 week per spell level
    goldPerWeek: number;        // 25gp per spell level
}

// Source quality:
// - Witnessed (full): -0 DC
// - Witnessed (partial): -2 DC
// - Described by witness: +2 DC
// - Grimoire (incomplete): +0 DC
// - Rumor: +5 DC
```

---

## PART 9: TESTING REQUIREMENTS

### Test File: `tests/magic/arcane-synthesis.test.ts`

```typescript
describe('Arcane Synthesis System', () => {
    describe('Balance Matrix Validation', () => {
        it('should calculate correct DC for Level 1 spell', () => {
            const dc = calculateSynthesisDC(1, []);
            expect(dc).toBe(12);
        });
        
        it('should apply modifiers correctly', () => {
            const dc = calculateSynthesisDC(3, [
                { reason: 'Related spell known', modifier: -2 },
                { reason: 'Under stress', modifier: 2 }
            ]);
            expect(dc).toBe(16); // 10 + 6 + 0
        });
    });
    
    describe('Spell Slot Consumption', () => {
        it('should consume slot before rolling', async () => {
            const wizard = createTestWizard({ level: 5 });
            expect(wizard.spellSlots.level2.current).toBe(3);
            
            await handleArcaneSynthesis({
                casterId: wizard.id,
                narrativeIntent: 'Test spell',
                estimatedLevel: 2,
                synthesisDC: 14,
                // ... other required fields
            }, testContext);
            
            const updated = await getCharacter(wizard.id);
            expect(updated.spellSlots.level2.current).toBe(2);
        });
        
        it('should reject if no slots available', async () => {
            const wizard = createTestWizard({ level: 1 });
            wizard.spellSlots.level1.current = 0;
            await updateCharacter(wizard.id, { spellSlots: wizard.spellSlots });
            
            const result = await handleArcaneSynthesis({
                casterId: wizard.id,
                narrativeIntent: 'Test spell',
                estimatedLevel: 1,
                synthesisDC: 12,
                // ...
            }, testContext);
            
            expect(result.content[0].text).toContain('no Level 1 spell slots');
        });
    });
    
    describe('Roll Outcomes', () => {
        it('should grant mastery on natural 20', async () => {
            // Mock dice to return 20
            jest.spyOn(Math, 'random').mockReturnValue(0.999);
            
            const result = await handleArcaneSynthesis({
                // ...
            }, testContext);
            
            expect(result.content[0].text).toContain('MASTERY');
            expect(result.content[0].text).toContain('added to');
        });
        
        it('should trigger wild surge on natural 1', async () => {
            // Mock dice to return 1
            jest.spyOn(Math, 'random').mockReturnValue(0.001);
            
            const result = await handleArcaneSynthesis({
                // ...
            }, testContext);
            
            expect(result.content[0].text).toContain('CATASTROPHIC BACKFIRE');
            expect(result.content[0].text).toContain('WILD SURGE');
        });
    });
    
    describe('Spell Registration', () => {
        it('should create valid spell record on success', async () => {
            // Force success
            jest.spyOn(Math, 'random').mockReturnValue(0.999);
            
            await handleArcaneSynthesis({
                casterId: 'wizard-1',
                narrativeIntent: 'Blind with shadows',
                proposedName: "Elara's Shadow Bind",
                estimatedLevel: 2,
                // ...
            }, testContext);
            
            const spell = await getSpellByName("Elara's Shadow Bind");
            expect(spell).toBeDefined();
            expect(spell.level).toBe(2);
            expect(spell.originCasterName).toBe('Elara');
        });
    });
});
```

---

## PART 10: DM GUIDANCE FOR ADJUDICATION

### Quick Reference Card

```markdown
## Arcane Synthesis Quick Guide

### Step 1: Hear the Intent
What does the player want to do? Get specifics:
- Target(s)?
- Range?
- Effect type?
- Duration?

### Step 2: Find the Closest Existing Spell
- Fireball (3rd) = 8d6 damage, 20ft AoE
- Blindness (2nd) = Single target blind
- Hold Person (2nd) = Paralyzed humanoid
- Fly (3rd) = Flight for 10 minutes
- Banishment (4th) = Remove from plane

### Step 3: Adjust Level
Start from closest spell, then:
- More targets? +1 level
- Longer duration? +1 level
- No save? +1 level
- Self-only? -1 level
- Limited circumstances? -1 level

### Step 4: Set DC
DC = 10 + (Level × 2)
± Circumstance modifiers

### Step 5: Resolve
- They commit the slot
- They roll Arcana
- Apply outcome
```

---

## CONCLUSION

Arcane Synthesis transforms spellcasting from **menu selection** into **magical engineering**. It:

1. ✅ **Rewards Creativity**: Players who think creatively get unique spells
2. ✅ **Maintains Balance**: The Balance Matrix prevents abuse
3. ✅ **Creates Risk**: Failure has real consequences
4. ✅ **Builds Lore**: Player-created spells become world canon
5. ✅ **Enables Emergence**: NPCs can learn, spells can spread

This is the kind of system that makes Quest Keeper AI fundamentally different from traditional RPG video games. It's the **"Just-In-Time Player's Handbook"**.

---

**Next Steps**:
1. Implement `attempt_arcane_synthesis` tool
2. Implement `register_new_spell` tool
3. Add wild surge effect handlers
4. Create downtime research system
5. Add witness/comprehension tracking

**Ready for implementation.**
