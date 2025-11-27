import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serverPath = path.resolve(__dirname, '../../src/server/index.ts');
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

// Helper to run stdio test
async function runStdioTest() {
    console.log('Running Stdio Transport Test...');
    return new Promise<void>((resolve, reject) => {
        const serverProcess = spawn(npx, ['tsx', `"${serverPath}"`], {
            stdio: ['pipe', 'pipe', 'inherit'],
            shell: true
        });

        const initRequest = {
            jsonrpc: '2.0',
            id: 0,
            method: 'initialize',
            params: {
                protocolVersion: '2024-11-05',
                capabilities: {},
                clientInfo: { name: 'test-client', version: '1.0.0' }
            }
        };

        let initialized = false;

        serverProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n').filter((l: string) => l.trim());
            for (const line of lines) {
                console.log('Received line:', line); // DEBUG LOG
                try {
                    const response = JSON.parse(line);
                    if (response.id === 0 && !initialized) {
                        initialized = true;
                        // Send initialized notification
                        serverProcess.stdin.write(JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'notifications/initialized'
                        }) + '\n');

                        // Send generate_world tool call
                        serverProcess.stdin.write(JSON.stringify({
                            jsonrpc: '2.0',
                            id: 1,
                            method: 'tools/call',
                            params: {
                                name: 'generate_world',
                                arguments: { seed: 'test-seed', width: 20, height: 20 }
                            }
                        }) + '\n');
                    } else if (response.id === 1) {
                        const content = JSON.parse(response.result.content[0].text);
                        if (content.message === 'World generated successfully') {
                            console.log('Stdio Test Passed ✅');
                            serverProcess.kill();
                            resolve();
                        } else {
                            reject(new Error('Unexpected response content'));
                        }
                    }
                } catch (e) {
                    // Ignore parse errors from non-JSON output
                }
            }
        });

        serverProcess.stdin.write(JSON.stringify(initRequest) + '\n');

        setTimeout(() => {
            serverProcess.kill();
            reject(new Error('Stdio Test Timeout'));
        }, 10000);
    });
}

// Helper to run TCP test
async function runTcpTest() {
    console.log('Running TCP Transport Test...');
    const port = 3001;

    // Start server
    const serverProcess = spawn(npx, ['tsx', `"${serverPath}"`, '--tcp', '--port', port.toString()], {
        stdio: 'inherit',
        shell: true
    });

    // Give server time to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    return new Promise<void>((resolve, reject) => {
        const client = new net.Socket();

        client.connect(port, '127.0.0.1', () => {
            // Send initialize
            client.write(JSON.stringify({
                jsonrpc: '2.0',
                id: 0,
                method: 'initialize',
                params: {
                    protocolVersion: '2024-11-05',
                    capabilities: {},
                    clientInfo: { name: 'test-client', version: '1.0.0' }
                }
            }) + '\n');
        });

        let buffer = '';
        client.on('data', (data) => {
            buffer += data.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const response = JSON.parse(line);
                    if (response.id === 0) {
                        // Send initialized
                        client.write(JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'notifications/initialized'
                        }) + '\n');

                        // Send generate_world tool call
                        client.write(JSON.stringify({
                            jsonrpc: '2.0',
                            id: 1,
                            method: 'tools/call',
                            params: {
                                name: 'generate_world',
                                arguments: { seed: 'tcp-seed', width: 20, height: 20 }
                            }
                        }) + '\n');
                    } else if (response.id === 1) {
                        const content = JSON.parse(response.result.content[0].text);
                        if (content.message === 'World generated successfully') {
                            console.log('TCP Test Passed ✅');
                            client.end();
                            serverProcess.kill();
                            resolve();
                        } else {
                            reject(new Error('Unexpected response content'));
                        }
                    }
                } catch (e) {
                    console.error('JSON Parse Error:', e);
                }
            }
        });

        client.on('error', (err) => {
            serverProcess.kill();
            reject(err);
        });

        setTimeout(() => {
            client.destroy();
            serverProcess.kill();
            reject(new Error('TCP Test Timeout'));
        }, 10000);
    });
}

async function main() {
    try {
        await runStdioTest();
        await runTcpTest();
        console.log('All Integration Tests Passed! 🎉');
        process.exit(0);
    } catch (error) {
        console.error('Test Failed:', error);
        process.exit(1);
    }
}

main();
