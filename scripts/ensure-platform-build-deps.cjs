const fs = require('fs');
const os = require('os');
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

function copyDirectoryContents(sourceDir, targetDir) {
    fs.mkdirSync(targetDir, {recursive: true});
    for (const entry of fs.readdirSync(sourceDir, {withFileTypes: true})) {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);
        if (entry.isDirectory()) {
            copyDirectoryContents(sourcePath, targetPath);
        } else {
            fs.copyFileSync(sourcePath, targetPath);
        }
    }
}

function replaceDirectoryAtomically(sourceDir, targetDir) {
    const parentDir = path.dirname(targetDir);
    const tempTargetDir = path.join(parentDir, `.${path.basename(targetDir)}-staging-${process.pid}`);
    fs.rmSync(tempTargetDir, {recursive: true, force: true});
    copyDirectoryContents(sourceDir, tempTargetDir);
    fs.rmSync(targetDir, {recursive: true, force: true});
    fs.renameSync(tempTargetDir, targetDir);
}

function installPackageIntoTemp(spec) {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dsp-calc-build-deps-'));
    try {
        if (process.env.npm_execpath) {
            run(process.execPath, [
                process.env.npm_execpath,
                'install',
                '--ignore-scripts',
                '--no-save',
                '--prefix',
                tempDir,
                spec,
            ]);
        } else {
            const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
            run(npmCommand, [
                'install',
                '--ignore-scripts',
                '--no-save',
                '--prefix',
                tempDir,
                spec,
            ]);
        }
        return tempDir;
    } catch (error) {
        fs.rmSync(tempDir, {recursive: true, force: true});
        throw error;
    }
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

function ensurePackageBinary(packageName, version, scopeName) {
    const targetDir = path.join(process.cwd(), 'node_modules', ...packageName.split('/'));
    if (fs.existsSync(path.join(targetDir, 'package.json'))) {
        return;
    }

    ensureScopeDir(scopeName);
    console.warn(`[ensure-platform-build-deps] Missing ${packageName}, installing ${packageName}@${version}`);
    const tempDir = installPackageIntoTemp(`${packageName}@${version}`);
    try {
        const sourceDir = path.join(tempDir, 'node_modules', ...packageName.split('/'));
        replaceDirectoryAtomically(sourceDir, targetDir);
    } finally {
        fs.rmSync(tempDir, {recursive: true, force: true});
    }
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

ensureEsbuildBinary();
ensureRollupBinary();
