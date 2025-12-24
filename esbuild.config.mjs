// esbuild.config.mjs
// Build script to bundle rpg-mcp for pkg packaging with native module support
import * as esbuild from 'esbuild';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import { createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { createWriteStream } from 'fs';
import { Readable } from 'stream';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outfile = 'dist-bundle/server.cjs';

// IMPORTANT: pkg bundles Node.js v20 (MODULE_VERSION 115)
// We must use prebuilds compiled for Node v20, NOT the local Node version
const PKG_NODE_VERSION = '115'; // Node.js v20.x ABI version
const BETTER_SQLITE3_VERSION = '12.4.6';

// Prebuild download URLs for each platform
const PREBUILD_URLS = {
    'win32-x64': `https://github.com/WiseLibs/better-sqlite3/releases/download/v${BETTER_SQLITE3_VERSION}/better-sqlite3-v${BETTER_SQLITE3_VERSION}-node-v${PKG_NODE_VERSION}-win32-x64.tar.gz`,
    'darwin-x64': `https://github.com/WiseLibs/better-sqlite3/releases/download/v${BETTER_SQLITE3_VERSION}/better-sqlite3-v${BETTER_SQLITE3_VERSION}-node-v${PKG_NODE_VERSION}-darwin-x64.tar.gz`,
    'darwin-arm64': `https://github.com/WiseLibs/better-sqlite3/releases/download/v${BETTER_SQLITE3_VERSION}/better-sqlite3-v${BETTER_SQLITE3_VERSION}-node-v${PKG_NODE_VERSION}-darwin-arm64.tar.gz`,
    'linux-x64': `https://github.com/WiseLibs/better-sqlite3/releases/download/v${BETTER_SQLITE3_VERSION}/better-sqlite3-v${BETTER_SQLITE3_VERSION}-node-v${PKG_NODE_VERSION}-linux-x64.tar.gz`,
};

// Plugin to handle better-sqlite3 with custom loader that uses nativeBinding option
const betterSqlite3Plugin = {
    name: 'better-sqlite3-loader',
    setup(build) {
        // Intercept imports of better-sqlite3
        build.onResolve({ filter: /^better-sqlite3$/ }, args => {
            return {
                path: 'better-sqlite3',
                namespace: 'better-sqlite3-shim'
            };
        });
        
        // Provide custom implementation that loads the real better-sqlite3 with nativeBinding option
        build.onLoad({ filter: /.*/, namespace: 'better-sqlite3-shim' }, () => {
            return {
                contents: `
const path = require('path');
const fs = require('fs');

// Get the directory where the executable is located
function getExeDir() {
    if (process.pkg) {
        return path.dirname(process.execPath);
    }
    return process.cwd();
}

// Find the native module
function findNativeModule() {
    const exeDir = getExeDir();
    const possiblePaths = [
        path.join(exeDir, 'better_sqlite3.node'),
        // Development fallback
        path.join(process.cwd(), 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
    ];
    
    for (const p of possiblePaths) {
        try {
            if (fs.existsSync(p)) {
                console.error('[SQLite] Found native module at:', p);
                return p;
            }
        } catch (e) {}
    }
    
    throw new Error('Could not find better_sqlite3.node. Searched in: ' + possiblePaths.join(', '));
}

// Error class for SQLite errors
class SqliteError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'SqliteError';
        this.code = code;
    }
}

// Load the native binding
const nativePath = findNativeModule();
const addon = require(nativePath);

// Initialize the addon
if (!addon.isInitialized) {
    addon.setErrorConstructor(SqliteError);
    addon.isInitialized = true;
}

// Utility to get boolean option
function getBooleanOption(options, key) {
    let value = false;
    if (key in options && typeof (value = options[key]) !== 'boolean') {
        throw new TypeError('Expected the "' + key + '" option to be a boolean');
    }
    return value;
}

// Symbol for internal cppdb reference
const cppdb = Symbol('cppdb');

// Database wrapper class
function Database(filenameGiven, options) {
    if (new.target == null) {
        return new Database(filenameGiven, options);
    }

    // Apply defaults
    let buffer = null;
    if (Buffer.isBuffer(filenameGiven)) {
        buffer = filenameGiven;
        filenameGiven = ':memory:';
    }
    if (filenameGiven == null) filenameGiven = '';
    if (options == null) options = {};

    // Validate arguments
    if (typeof filenameGiven !== 'string') {
        throw new TypeError('Expected first argument to be a string');
    }
    if (typeof options !== 'object') {
        throw new TypeError('Expected second argument to be an options object');
    }

    // Interpret options
    const filename = filenameGiven.trim();
    const anonymous = filename === '' || filename === ':memory:';
    const readonly = getBooleanOption(options, 'readonly');
    const fileMustExist = getBooleanOption(options, 'fileMustExist');
    const timeout = 'timeout' in options ? options.timeout : 5000;
    const verbose = 'verbose' in options ? options.verbose : null;

    // Validate interpreted options
    if (readonly && anonymous && !buffer) {
        throw new TypeError('In-memory/temporary databases cannot be readonly');
    }
    if (!Number.isInteger(timeout) || timeout < 0) {
        throw new TypeError('Expected the "timeout" option to be a positive integer');
    }
    if (timeout > 0x7fffffff) {
        throw new RangeError('Option "timeout" cannot be greater than 2147483647');
    }
    if (verbose != null && typeof verbose !== 'function') {
        throw new TypeError('Expected the "verbose" option to be a function');
    }

    // Make sure the specified directory exists
    if (!anonymous && !filename.startsWith('file:')) {
        const dir = path.dirname(filename);
        if (dir && dir !== '.' && !fs.existsSync(dir)) {
            throw new TypeError('Cannot open database because the directory does not exist');
        }
    }

    // Create the database - native addon expects these exact arguments
    const db = new addon.Database(
        filename,           // 1: processed filename (trimmed)
        filenameGiven,      // 2: original filename string
        anonymous,          // 3: boolean
        readonly,           // 4: boolean
        fileMustExist,      // 5: boolean
        timeout,            // 6: integer
        verbose || null,    // 7: function or null
        buffer || null      // 8: Buffer or null
    );
    
    Object.defineProperty(this, cppdb, { value: db });
}

// Methods
Database.prototype.prepare = function(sql) {
    return this[cppdb].prepare(sql, this, false);
};

Database.prototype.exec = function(sql) {
    this[cppdb].exec(sql);
    return this;
};

Database.prototype.pragma = function(source, options) {
    if (options == null) options = {};
    if (typeof source !== 'string') throw new TypeError('Expected first argument to be a string');
    if (typeof options !== 'object') throw new TypeError('Expected second argument to be an options object');
    const simple = getBooleanOption(options, 'simple');
    const stmt = this[cppdb].prepare('PRAGMA ' + source, this, true);
    return simple ? stmt.pluck().get() : stmt.all();
};

Database.prototype.close = function() {
    this[cppdb].close();
    return this;
};

Database.prototype.transaction = function(fn) {
    if (typeof fn !== 'function') throw new TypeError('Expected first argument to be a function');
    const db = this;
    const begin = db.prepare('BEGIN');
    const commit = db.prepare('COMMIT');
    const rollback = db.prepare('ROLLBACK');
    
    function transaction(...args) {
        begin.run();
        try {
            const result = fn.apply(this, args);
            commit.run();
            return result;
        } catch (err) {
            rollback.run();
            throw err;
        }
    }
    
    transaction.deferred = transaction;
    transaction.immediate = function(...args) {
        db.exec('BEGIN IMMEDIATE');
        try {
            const result = fn.apply(this, args);
            commit.run();
            return result;
        } catch (err) {
            rollback.run();
            throw err;
        }
    };
    transaction.exclusive = function(...args) {
        db.exec('BEGIN EXCLUSIVE');
        try {
            const result = fn.apply(this, args);
            commit.run();
            return result;
        } catch (err) {
            rollback.run();
            throw err;
        }
    };
    
    return transaction;
};

Database.prototype.defaultSafeIntegers = function(toggle) {
    this[cppdb].defaultSafeIntegers(toggle);
    return this;
};

Database.prototype.unsafeMode = function(toggle) {
    this[cppdb].unsafeMode(toggle);
    return this;
};

Database.prototype.loadExtension = function(...args) {
    this[cppdb].loadExtension(...args);
    return this;
};

// Getters
Object.defineProperty(Database.prototype, 'open', {
    get: function() { return this[cppdb].open; },
    enumerable: true
});
Object.defineProperty(Database.prototype, 'inTransaction', {
    get: function() { return this[cppdb].inTransaction; },
    enumerable: true
});
Object.defineProperty(Database.prototype, 'name', {
    get: function() { return this[cppdb].name; },
    enumerable: true
});
Object.defineProperty(Database.prototype, 'memory', {
    get: function() { return this[cppdb].memory; },
    enumerable: true
});
Object.defineProperty(Database.prototype, 'readonly', {
    get: function() { return this[cppdb].readonly; },
    enumerable: true
});

// Export
module.exports = Database;
module.exports.default = Database;
module.exports.Database = Database;
module.exports.SqliteError = SqliteError;
`,
                loader: 'js'
            };
        });
    }
};

/**
 * Download a file from URL, following redirects
 */
function downloadFile(url, destPath) {
    return new Promise((resolve, reject) => {
        const file = createWriteStream(destPath);
        
        const request = (url) => {
            https.get(url, (response) => {
                // Handle redirects
                if (response.statusCode === 301 || response.statusCode === 302) {
                    const redirectUrl = response.headers.location;
                    console.log(`   ↳ Following redirect to ${redirectUrl.substring(0, 60)}...`);
                    request(redirectUrl);
                    return;
                }
                
                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
                    return;
                }
                
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (err) => {
                fs.unlink(destPath, () => {}); // Delete partial file
                reject(err);
            });
        };
        
        request(url);
    });
}

/**
 * Extract .tar.gz and get the .node file
 */
async function extractTarGz(tarPath, destDir) {
    // Use tar command (available on Windows 10+, macOS, Linux)
    execSync(`tar -xzf "${tarPath}" -C "${destDir}"`, { stdio: 'pipe' });
}

/**
 * Download prebuild for a specific platform
 */
async function downloadPrebuild(platform, destDir) {
    const url = PREBUILD_URLS[platform];
    if (!url) {
        console.warn(`   ⚠️  No prebuild URL for platform: ${platform}`);
        return null;
    }
    
    const tempDir = path.join(destDir, `temp-${platform}`);
    const tarPath = path.join(tempDir, 'prebuild.tar.gz');
    
    // Create temp directory
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }
    
    console.log(`   📥 Downloading prebuild for ${platform}...`);
    await downloadFile(url, tarPath);
    
    console.log(`   📦 Extracting...`);
    await extractTarGz(tarPath, tempDir);
    
    // Find the .node file
    const nodePath = path.join(tempDir, 'build', 'Release', 'better_sqlite3.node');
    if (!fs.existsSync(nodePath)) {
        throw new Error(`Native module not found in prebuild at: ${nodePath}`);
    }
    
    return { nodePath, tempDir };
}

async function build() {
    console.log('🔨 Building rpg-mcp bundle...');
    console.log(`   Node.js ABI version for pkg: ${PKG_NODE_VERSION} (Node.js v20.x)`);
    console.log(`   better-sqlite3 version: ${BETTER_SQLITE3_VERSION}`);
    console.log('');
    
    // Ensure output directories exist
    if (!fs.existsSync('dist-bundle')) {
        fs.mkdirSync('dist-bundle', { recursive: true });
    }
    if (!fs.existsSync('bin')) {
        fs.mkdirSync('bin', { recursive: true });
    }
    
    try {
        // Bundle with esbuild
        console.log('📦 Bundling with esbuild...');
        await esbuild.build({
            entryPoints: ['dist/server/index.js'],
            bundle: true,
            platform: 'node',
            target: 'node20',
            format: 'cjs',
            outfile,
            plugins: [betterSqlite3Plugin],
            minify: false,
            sourcemap: false,
        });
        
        console.log('✅ Bundle created:', outfile);
        console.log('');
        
        // Create pkg config
        const bundlePackage = {
            "name": "rpg-mcp-bundle",
            "version": "1.0.0",
            "main": "server.cjs",
            "bin": "server.cjs",
            "pkg": {
                "scripts": [],
                "assets": [],
                "targets": ["node20-win-x64", "node20-macos-x64", "node20-macos-arm64", "node20-linux-x64"],
                "outputPath": "../bin"
            }
        };
        
        fs.writeFileSync('dist-bundle/package.json', JSON.stringify(bundlePackage, null, 2));
        
        // Run pkg
        console.log('📦 Creating executables with pkg...');
        execSync('npx pkg dist-bundle/server.cjs --targets node20-win-x64,node20-macos-x64,node20-macos-arm64,node20-linux-x64 --output bin/rpg-mcp', {
            stdio: 'inherit',
            cwd: process.cwd()
        });
        
        console.log('');
        console.log('✅ Binaries created');
        console.log('');
        
        // Download prebuilds for the CORRECT Node.js version (v20, not local version)
        console.log('📥 Downloading native modules for Node.js v20 (pkg runtime)...');
        console.log('   ⚠️  NOT using local node_modules (compiled for different Node version)');
        console.log('');
        
        const platforms = ['win32-x64', 'darwin-x64', 'darwin-arm64', 'linux-x64'];
        const platformSuffixes = {
            'win32-x64': 'win',
            'darwin-x64': 'macos',
            'darwin-arm64': 'macos-arm64',
            'linux-x64': 'linux'
        };
        
        for (const platform of platforms) {
            try {
                const result = await downloadPrebuild(platform, 'bin');
                if (result) {
                    const suffix = platformSuffixes[platform];
                    const destPath = path.join('bin', `better_sqlite3-${suffix}.node`);
                    fs.copyFileSync(result.nodePath, destPath);
                    console.log(`   ✅ ${platform} -> ${destPath}`);
                    
                    // Clean up temp directory
                    fs.rmSync(result.tempDir, { recursive: true, force: true });
                }
            } catch (err) {
                console.error(`   ❌ Failed for ${platform}: ${err.message}`);
            }
        }
        
        // Also copy Windows version as default (for development)
        const winNodePath = path.join('bin', 'better_sqlite3-win.node');
        const defaultNodePath = path.join('bin', 'better_sqlite3.node');
        if (fs.existsSync(winNodePath)) {
            fs.copyFileSync(winNodePath, defaultNodePath);
            console.log(`   ✅ Default (Windows) -> ${defaultNodePath}`);
        }
        
        console.log('');
        console.log('🎉 Build complete! Files in bin/:');
        console.log('');
        
        // List output files
        const binFiles = fs.readdirSync('bin');
        for (const file of binFiles) {
            const stat = fs.statSync(path.join('bin', file));
            const sizeMB = (stat.size / 1024 / 1024).toFixed(2);
            console.log(`   ${file.padEnd(35)} ${sizeMB} MB`);
        }
        
        console.log('');
        console.log('📦 Deployment instructions:');
        console.log('');
        console.log('   IMPORTANT: Create ../src-tauri/binaries/ directory if it doesn\'t exist:');
        console.log('     mkdir -p ../src-tauri/binaries  (macOS/Linux)');
        console.log('     md ..\\src-tauri\\binaries  (Windows, if not exists)');
        console.log('');
        console.log('   For Tauri (Windows):');
        console.log('     copy bin\\rpg-mcp-win.exe ..\\src-tauri\\binaries\\rpg-mcp-server-x86_64-pc-windows-msvc.exe');
        console.log('     copy bin\\better_sqlite3.node ..\\src-tauri\\binaries\\');
        console.log('');
        console.log('   For Tauri (macOS Intel):');
        console.log('     cp bin/rpg-mcp-macos ../src-tauri/binaries/rpg-mcp-server-x86_64-apple-darwin');
        console.log('     cp bin/better_sqlite3-macos.node ../src-tauri/binaries/better_sqlite3.node');
        console.log('');
        console.log('   For Tauri (macOS Apple Silicon):');
        console.log('     cp bin/rpg-mcp-macos-arm64 ../src-tauri/binaries/rpg-mcp-server-aarch64-apple-darwin');
        console.log('     cp bin/better_sqlite3-macos-arm64.node ../src-tauri/binaries/better_sqlite3.node');
        console.log('');
        console.log('   For Tauri (Linux):');
        console.log('     cp bin/rpg-mcp-linux ../src-tauri/binaries/rpg-mcp-server-x86_64-unknown-linux-gnu');
        console.log('     cp bin/better_sqlite3-linux.node ../src-tauri/binaries/better_sqlite3.node');
        console.log('');
        
    } catch (error) {
        console.error('❌ Build failed:', error);
        process.exit(1);
    }
}

build();
