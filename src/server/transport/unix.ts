import { Server } from 'net';
import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import fs from 'fs';

/**
 * A Unix Socket (or Named Pipe) transport for the MCP server.
 * Uses newline-delimited JSON, similar to TCP and Stdio.
 */
export class UnixServerTransport implements Transport {
    private server: Server;
    private socket: any = null;
    private _onclose?: () => void;
    private _onerror?: (error: Error) => void;
    private _onmessage?: (message: JSONRPCMessage) => void;

    constructor(private path: string) {
        this.server = new Server((socket) => {
            console.log('Client connected to socket');
            this.socket = socket;

            let buffer = '';
            socket.on('data', (data) => {
                buffer += data.toString();
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (line.trim()) {
                        try {
                            const message = JSON.parse(line);
                            this._onmessage?.(message);
                        } catch (error) {
                            console.error('Failed to parse message:', error);
                            this._onerror?.(error as Error);
                        }
                    }
                }
            });

            socket.on('error', (err) => {
                console.error('Socket error:', err);
                this._onerror?.(err);
            });

            socket.on('close', () => {
                console.log('Client disconnected');
                this._onclose?.();
            });
        });
    }

    async start(): Promise<void> {
        // Cleanup existing socket file if it exists (and is not a named pipe on Windows)
        if (process.platform !== 'win32' && fs.existsSync(this.path)) {
            fs.unlinkSync(this.path);
        }

        return new Promise((resolve) => {
            this.server.listen(this.path, () => {
                console.log(`Unix Server listening on ${this.path}`);
                resolve();
            });
        });
    }

    async close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server.close((err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async send(message: JSONRPCMessage): Promise<void> {
        if (!this.socket) {
            throw new Error('No client connected');
        }
        this.socket.write(JSON.stringify(message) + '\n');
    }

    set onclose(handler: () => void) {
        this._onclose = handler;
    }

    set onerror(handler: (error: Error) => void) {
        this._onerror = handler;
    }

    set onmessage(handler: (message: JSONRPCMessage) => void) {
        this._onmessage = handler;
    }
}
