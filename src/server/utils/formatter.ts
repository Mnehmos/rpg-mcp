/**
 * RichFormatter - Human-centric output formatting for RPG-MCP tools
 * Provides consistent markdown and ASCII formatting while preserving JSON for frontends.
 */

export class RichFormatter {
    // ============================================================
    // HEADERS & SECTIONS
    // ============================================================

    static header(title: string, icon: string = '🔧'): string {
        const line = '━'.repeat(40);
        return `\n${line}\n${icon}  **${title.toUpperCase()}**\n${line}\n`;
    }

    static section(title: string): string {
        return `\n### ${title}\n`;
    }

    static subSection(title: string): string {
        return `\n#### ${title}\n`;
    }

    // ============================================================
    // DATA FORMATTING
    // ============================================================

    static keyValue(data: Record<string, unknown>): string {
        let output = '';
        for (const [key, value] of Object.entries(data)) {
            if (value === undefined || value === null) continue;
            const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
            output += `- **${key}:** ${displayValue}\n`;
        }
        return output;
    }

    static table(headers: string[], rows: (string | number)[][]): string {
        if (rows.length === 0) {
            return '\n*No data*\n';
        }
        const headerRow = `| ${headers.join(' | ')} |`;
        const separatorRow = `| ${headers.map(() => '---').join(' | ')} |`;
        const dataRows = rows.map(row => `| ${row.join(' | ')} |`).join('\n');
        return `\n${headerRow}\n${separatorRow}\n${dataRows}\n`;
    }

    static list(items: string[], ordered: boolean = false): string {
        if (items.length === 0) return '\n*None*\n';
        return '\n' + items.map((item, i) => ordered ? `${i + 1}. ${item}` : `- ${item}`).join('\n') + '\n';
    }

    // ============================================================
    // ALERTS & STATUS
    // ============================================================

    static alert(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info'): string {
        const icons: Record<string, string> = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
        return `\n> ${icons[type]} **${type.toUpperCase()}**: ${message}\n`;
    }

    static success(message: string): string {
        return this.alert(message, 'success');
    }

    static error(message: string): string {
        return this.alert(message, 'error');
    }

    // ============================================================
    // RPG-SPECIFIC FORMATTERS
    // ============================================================

    static character(char: {
        id: string;
        name: string;
        class?: string;
        race?: string;
        level?: number;
        hp?: number;
        maxHp?: number;
        ac?: number;
        characterType?: string;
    }): string {
        const typeIcon = char.characterType === 'enemy' ? '👹' : char.characterType === 'npc' ? '🧑' : '🧙';
        let output = this.header(`${char.name}`, typeIcon);
        output += this.keyValue({
            'ID': `\`${char.id}\``,
            'Class': char.class || 'Unknown',
            'Race': char.race || 'Unknown',
            'Level': char.level || 1,
            'HP': char.hp !== undefined && char.maxHp !== undefined ? `${char.hp}/${char.maxHp}` : 'N/A',
            'AC': char.ac ?? 'N/A',
            'Type': char.characterType || 'pc',
        });
        return output;
    }

    static characterList(characters: Array<{ id: string; name: string; class?: string; race?: string; level?: number; hp?: number; maxHp?: number; characterType?: string }>): string {
        if (characters.length === 0) {
            return this.alert('No characters found.', 'info');
        }
        const rows = characters.map(c => {
            const typeIcon = c.characterType === 'enemy' ? '👹' : c.characterType === 'npc' ? '🧑' : '🧙';
            return [
                typeIcon,
                c.name,
                c.class || '-',
                c.race || '-',
                String(c.level || 1),
                c.hp !== undefined && c.maxHp !== undefined ? `${c.hp}/${c.maxHp}` : '-',
            ];
        });
        return this.table(['', 'Name', 'Class', 'Race', 'Lvl', 'HP'], rows);
    }

    static inventory(items: Array<{ name: string; quantity?: number; equipped?: boolean; slot?: string }>): string {
        if (items.length === 0) {
            return this.alert('Inventory is empty.', 'info');
        }
        const rows = items.map(item => [
            item.equipped ? '⚔️' : '',
            item.name,
            String(item.quantity ?? 1),
            item.slot || '-',
        ]);
        return this.table(['', 'Item', 'Qty', 'Slot'], rows);
    }

    static quest(quest: { id: string; name: string; description?: string; status?: string; objectives?: Array<{ description: string; completed?: boolean }> }): string {
        const statusIcon = quest.status === 'completed' ? '✅' : quest.status === 'failed' ? '❌' : '📜';
        let output = this.header(quest.name, statusIcon);
        output += this.keyValue({
            'ID': `\`${quest.id}\``,
            'Status': quest.status || 'active',
        });
        if (quest.description) {
            output += `\n${quest.description}\n`;
        }
        if (quest.objectives && quest.objectives.length > 0) {
            output += this.section('Objectives');
            quest.objectives.forEach(obj => {
                const check = obj.completed ? '☑' : '☐';
                output += `${check} ${obj.description}\n`;
            });
        }
        return output;
    }

    static party(party: { id: string; name: string; description?: string; members?: Array<{ name: string; role?: string }> }): string {
        let output = this.header(party.name, '⚔️');
        output += this.keyValue({
            'ID': `\`${party.id}\``,
            'Description': party.description || '-',
        });
        if (party.members && party.members.length > 0) {
            output += this.section('Members');
            const rows = party.members.map(m => [m.name, m.role || 'member']);
            output += this.table(['Name', 'Role'], rows);
        }
        return output;
    }

    static corpse(corpse: { id: string; characterName: string; decayState?: string; position?: { x: number; y: number } }): string {
        const decayIcon = corpse.decayState === 'gone' ? '💀' : corpse.decayState === 'skeletal' ? '🦴' : '☠️';
        let output = this.header(`Corpse: ${corpse.characterName}`, decayIcon);
        output += this.keyValue({
            'ID': `\`${corpse.id}\``,
            'Decay State': corpse.decayState || 'fresh',
            'Position': corpse.position ? `(${corpse.position.x}, ${corpse.position.y})` : 'Unknown',
        });
        return output;
    }

    static world(world: { id: string; name: string; description?: string; environment?: Record<string, unknown> }): string {
        let output = this.header(world.name, '🌍');
        output += this.keyValue({
            'ID': `\`${world.id}\``,
            'Description': world.description || '-',
        });
        if (world.environment) {
            output += this.section('Environment');
            output += this.keyValue(world.environment);
        }
        return output;
    }

    // ============================================================
    // JSON EMBEDDING (for frontend parsing)
    // ============================================================

    static embedJson(data: unknown, tag: string = 'DATA'): string {
        return `\n<!-- ${tag}_JSON\n${JSON.stringify(data)}\n${tag}_JSON -->\n`;
    }

    static code(content: string, language: string = ''): string {
        return `\n\`\`\`${language}\n${content}\n\`\`\`\n`;
    }
}
