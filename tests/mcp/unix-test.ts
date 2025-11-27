import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import net from 'net';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');
const serverPath = 'src/server/index.ts';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
const socketPath = process.platform === 'win32' ? '\\\\.\\pipe\\rpg-mcp-test' : '/tmp/rpg-mcp-test.sock';

console.log('Running Unix Socket Transport Test...');
console.log('Socket Path:', socketPath);

const serverProcess = spawn(npx, ['tsx', serverPath, '--unix', socketPath], {
    cwd: projectRoot,
    stdio: 'inherit',
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

let client: net.Socket;

// Wait for server to start
setTimeout(() => {
    console.log('Connecting to socket...');
    client = net.createConnection(socketPath, () => {
        console.log('Connected to socket');
        client.write(JSON.stringify(initRequest) + '\n');
    });

    let buffer = '';
    client.on('data', (data) => {
        buffer += data.toString();
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
            if (line.trim()) {
                console.log('Received:', line);
                try {
                    const response = JSON.parse(line);
                    if (response.id === 0) {
                        console.log('✅ Initialize successful');
                        console.log('✅ UNIX SOCKET TEST PASSED!');
                        client.end();
                        serverProcess.kill();
                        process.exit(0);
                    }
                } catch (e) {
                    // Ignore
                }
            }
        }
    });

    client.on('error', (err) => {
        console.error('Client socket error:', err);
        serverProcess.kill();
        process.exit(1);
    });

}, 5000); // Give server 5s to start

// Timeout
setTimeout(() => {
    console.error('❌ Test timeout');
    if (client) client.end();
    serverProcess.kill();
    process.exit(1);
}, 15000);
