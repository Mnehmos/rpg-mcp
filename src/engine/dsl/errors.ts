/**
 * Custom error class for DSL parsing errors
 */
export class DSLParseError extends Error {
    constructor(
        message: string,
        public line?: number,
        public column?: number,
        public token?: string
    ) {
        super(message);
        this.name = 'DSLParseError';
    }

    toString(): string {
        let msg = this.message;
        if (this.line !== undefined) {
            msg = `Line ${this.line}: ${msg}`;
        }
        if (this.token) {
            msg += ` (token: '${this.token}')`;
        }
        return msg;
    }
}
