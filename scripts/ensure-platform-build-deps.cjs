const fs = require('fs');
const path = require('path');
const {spawnSync} = require('child_process');

function run(command, args) {
    const result = spawnSync(command, args, {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
    });
    if (result.status !== 0) {
        throw new Error(`Command failed: ${command} ${args.join(' ')}`);
    }
}

function ensureScopeDir(scopeName) {
    fs.mkdirSync(path.join(process.cwd(), 'node_modules', scopeName), {recursive: true});
}

function installPackageIntoProject(spec) {
    if (process.env.npm_execpath) {
        run(process.execPath, [
            process.env.npm_execpath,
            'install',
            '--ignore-scripts',
            '--no-save',
            '--package-lock=false',
            spec,
        ]);
        return;
    }

    const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    run(npmCommand, [
        'install',
        '--ignore-scripts',
        '--no-save',
        '--package-lock=false',
        spec,
    ]);
}

function getInstalledPackageVersion(packageName) {
    let current = path.dirname(require.resolve(packageName));
    while (true) {
        const packageJsonPath = path.join(current, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')).version;
        }

        const parent = path.dirname(current);
        if (parent === current) {
            throw new Error(`Unable to locate package.json for ${packageName}`);
        }
        current = parent;
    }
}

function getCurrentRollupPackage() {
    if (process.platform === 'win32') {
        if (process.arch === 'x64') return '@rollup/rollup-win32-x64-msvc';
        if (process.arch === 'arm64') return '@rollup/rollup-win32-arm64-msvc';
        if (process.arch === 'ia32') return '@rollup/rollup-win32-ia32-msvc';
        return null;
    }

    if (process.platform === 'linux') {
        const report = process.report?.getReport?.();
        const isGlibc = Boolean(report?.header?.glibcVersionRuntime);
        if (process.arch === 'x64') {
            return isGlibc ? '@rollup/rollup-linux-x64-gnu' : '@rollup/rollup-linux-x64-musl';
        }
        if (process.arch === 'arm64') {
            return isGlibc ? '@rollup/rollup-linux-arm64-gnu' : '@rollup/rollup-linux-arm64-musl';
        }
        if (process.arch === 'arm') return '@rollup/rollup-linux-arm-gnueabihf';
        return null;
    }

    return null;
}

function getCurrentEsbuildPackage() {
    if (process.platform === 'win32') {
        if (process.arch === 'x64') return '@esbuild/win32-x64';
        if (process.arch === 'arm64') return '@esbuild/win32-arm64';
        if (process.arch === 'ia32') return '@esbuild/win32-ia32';
        return null;
    }

    if (process.platform === 'linux') {
        if (process.arch === 'x64') return '@esbuild/linux-x64';
        if (process.arch === 'arm64') return '@esbuild/linux-arm64';
        if (process.arch === 'arm') return '@esbuild/linux-arm';
        return null;
    }

    if (process.platform === 'darwin') {
        if (process.arch === 'x64') return '@esbuild/darwin-x64';
        if (process.arch === 'arm64') return '@esbuild/darwin-arm64';
        return null;
    }

    return null;
}

function getCurrentRolldownPackage() {
    if (process.platform === 'win32') {
        if (process.arch === 'x64') return '@rolldown/binding-win32-x64-msvc';
        if (process.arch === 'arm64') return '@rolldown/binding-win32-arm64-msvc';
        return null;
    }

    if (process.platform === 'linux') {
        const report = process.report?.getReport?.();
        const isGlibc = Boolean(report?.header?.glibcVersionRuntime);
        if (process.arch === 'x64') {
            return isGlibc ? '@rolldown/binding-linux-x64-gnu' : '@rolldown/binding-linux-x64-musl';
        }
        if (process.arch === 'arm64') {
            return isGlibc ? '@rolldown/binding-linux-arm64-gnu' : '@rolldown/binding-linux-arm64-musl';
        }
        if (process.arch === 'arm') return '@rolldown/binding-linux-arm-gnueabihf';
        return null;
    }

    if (process.platform === 'darwin') {
        if (process.arch === 'x64') return '@rolldown/binding-darwin-x64';
        if (process.arch === 'arm64') return '@rolldown/binding-darwin-arm64';
        return null;
    }

    return null;
}

function ensurePackageBinary(packageName, version, scopeName) {
    const targetDir = path.join(process.cwd(), 'node_modules', ...packageName.split('/'));
    if (fs.existsSync(path.join(targetDir, 'package.json'))) {
        return;
    }

    ensureScopeDir(scopeName);
    console.warn(`[ensure-platform-build-deps] Missing ${packageName}, installing ${packageName}@${version}`);
    installPackageIntoProject(`${packageName}@${version}`);
}

function ensureRollupBinary() {
    const rollupPackage = getCurrentRollupPackage();
    if (!rollupPackage) return;
    ensurePackageBinary(rollupPackage, getInstalledPackageVersion('rollup'), '@rollup');
}

function ensureEsbuildBinary() {
    const esbuildPackage = getCurrentEsbuildPackage();
    if (!esbuildPackage) return;
    ensurePackageBinary(esbuildPackage, getInstalledPackageVersion('esbuild'), '@esbuild');
}

function ensureRolldownBinary() {
    let rolldownVersion;
    try {
        rolldownVersion = getInstalledPackageVersion('rolldown');
    } catch {
        return;
    }

    const rolldownPackage = getCurrentRolldownPackage();
    if (!rolldownPackage) return;
    ensurePackageBinary(rolldownPackage, rolldownVersion, '@rolldown');
}

ensureEsbuildBinary();
ensureRollupBinary();
ensureRolldownBinary();
