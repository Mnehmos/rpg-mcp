import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = path.resolve(__dirname, '../../');
const serverPath = 'src/server/index.ts';
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

console.log('Running Stdio Transport Test...');
console.log('Project Root:', projectRoot);
console.log('Server Path:', serverPath);

const serverProcess = spawn(npx, ['tsx', serverPath], {
    cwd: projectRoot,
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

let step = 0;

serverProcess.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter((l: string) => l.trim());
    for (const line of lines) {
        console.log('Received:', line);
        try {
            const response = JSON.parse(line);
            console.log('Parsed response:', JSON.stringify(response, null, 2));

            if (step === 0 && response.id === 0) {
                console.log('✅ Initialize successful');
                step++;

                // Send initialized notification
                serverProcess.stdin.write(JSON.stringify({
                    jsonrpc: '2.0',
                    method: 'notifications/initialized'
                }) + '\n');

                // Send generate_world tool call
                console.log('Calling generate_world...');
                serverProcess.stdin.write(JSON.stringify({
                    jsonrpc: '2.0',
                    id: 1,
                    method: 'tools/call',
                    params: {
                        name: 'generate_world',
                        arguments: { seed: 'test-seed', width: 20, height: 20 }
                    }
                }) + '\n');
            } else if (step === 1 && response.id === 1) {
                console.log('✅ Tool call successful');
                const content = JSON.parse(response.result.content[0].text);
                if (content.message === 'World generated successfully') {
                    console.log('✅ STDIO TEST PASSED!');
                    serverProcess.kill();
                    process.exit(0);
                } else {
                    console.error('❌ Unexpected response content');
                    serverProcess.kill();
                    process.exit(1);
                }
            }
        } catch (e) {
            // Ignore non-JSON lines
        }
    }
});

serverProcess.on('error', (err) => {
    console.error('Server process error:', err);
    process.exit(1);
});

serverProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
        console.error('Server exited with code:', code);
        process.exit(1);
    }
});

console.log('Sending initialize...');
serverProcess.stdin.write(JSON.stringify(initRequest) + '\n');

setTimeout(() => {
    console.error('❌ Test timeout');
    serverProcess.kill();
    process.exit(1);
}, 30000);
