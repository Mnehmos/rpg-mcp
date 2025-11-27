import { Server } from 'net';

import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

/**
 * A TCP transport for the MCP server.
 * This implementation uses a simple line-based JSON protocol over TCP.
 * Note: The official SDK doesn't have a built-in TCP transport yet, so we implement a basic one
 * that mimics the behavior needed for MCP.
 * 
 * However, for better compatibility with existing tools, we might want to use SSE or Stdio.
 * If we strictly need TCP, we need to define the framing.
 * 
 * For this implementation, we will use a simple newline-delimited JSON format,
 * similar to how StdioTransport works but over a socket.
 */
export class TCPServerTransport implements Transport {
    private server: Server;
    private socket: any = null;
    private _onclose?: () => void;
    private _onerror?: (error: Error) => void;
    private _onmessage?: (message: JSONRPCMessage) => void;

    constructor(private port: number = 3000) {
        this.server = new Server((socket) => {
            console.log('Client connected');
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
        return new Promise((resolve) => {
            this.server.listen(this.port, () => {
                console.log(`TCP Server listening on port ${this.port}`);
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
