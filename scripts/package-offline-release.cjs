#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const distDir = path.join(projectRoot, 'dist');
const outputDir = path.join(projectRoot, 'offline-release');
const packageJsonPath = path.join(projectRoot, 'package.json');

function readPackageInfo() {
    return JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
}

function assertDistReady() {
    if (!fs.existsSync(distDir)) {
        throw new Error('未找到 dist 目录，请先执行 npm run build');
    }

    if (!fs.existsSync(path.join(distDir, 'index.html'))) {
        throw new Error('未找到 dist/index.html，请先执行 npm run build');
    }
}

function collectFiles(rootDir, currentDir = rootDir) {
    const entries = fs.readdirSync(currentDir, {withFileTypes: true});
    const files = [];

    for (const entry of entries) {
        const absolutePath = path.join(currentDir, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFiles(rootDir, absolutePath));
            continue;
        }
        if (!entry.isFile()) {
            continue;
        }
        files.push({
            absolutePath,
            relativePath: path.relative(rootDir, absolutePath).split(path.sep).join('/'),
            stat: fs.statSync(absolutePath),
            data: fs.readFileSync(absolutePath),
        });
    }

    return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath, 'en'));
}

function createCrc32Table() {
    const table = new Uint32Array(256);
    for (let index = 0; index < 256; index += 1) {
        let value = index;
        for (let bit = 0; bit < 8; bit += 1) {
            value = (value & 1) ? (0xEDB88320 ^ (value >>> 1)) : (value >>> 1);
        }
        table[index] = value >>> 0;
    }
    return table;
}

const crc32Table = createCrc32Table();

function crc32(buffer) {
    let value = 0xFFFFFFFF;
    for (const byte of buffer) {
        value = crc32Table[(value ^ byte) & 0xFF] ^ (value >>> 8);
    }
    return (value ^ 0xFFFFFFFF) >>> 0;
}

function toDosDateTime(date) {
    const year = Math.max(date.getFullYear(), 1980);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const hour = date.getHours();
    const minute = date.getMinutes();
    const second = Math.floor(date.getSeconds() / 2);

    return {
        dosTime: (hour << 11) | (minute << 5) | second,
        dosDate: ((year - 1980) << 9) | (month << 5) | day,
    };
}

function buildZip(files) {
    const localParts = [];
    const centralParts = [];
    let localOffset = 0;

    for (const file of files) {
        const fileName = Buffer.from(file.relativePath, 'utf8');
        const checksum = crc32(file.data);
        const {dosDate, dosTime} = toDosDateTime(file.stat.mtime);

        // ZIP store 模式不压缩，但可避免引入额外依赖或依赖系统 zip 命令。
        const localHeader = Buffer.alloc(30);
        localHeader.writeUInt32LE(0x04034B50, 0);
        localHeader.writeUInt16LE(20, 4);
        localHeader.writeUInt16LE(0x0800, 6);
        localHeader.writeUInt16LE(0, 8);
        localHeader.writeUInt16LE(dosTime, 10);
        localHeader.writeUInt16LE(dosDate, 12);
        localHeader.writeUInt32LE(checksum, 14);
        localHeader.writeUInt32LE(file.data.length, 18);
        localHeader.writeUInt32LE(file.data.length, 22);
        localHeader.writeUInt16LE(fileName.length, 26);
        localHeader.writeUInt16LE(0, 28);

        localParts.push(localHeader, fileName, file.data);

        const centralHeader = Buffer.alloc(46);
        centralHeader.writeUInt32LE(0x02014B50, 0);
        centralHeader.writeUInt16LE(20, 4);
        centralHeader.writeUInt16LE(20, 6);
        centralHeader.writeUInt16LE(0x0800, 8);
        centralHeader.writeUInt16LE(0, 10);
        centralHeader.writeUInt16LE(dosTime, 12);
        centralHeader.writeUInt16LE(dosDate, 14);
        centralHeader.writeUInt32LE(checksum, 16);
        centralHeader.writeUInt32LE(file.data.length, 20);
        centralHeader.writeUInt32LE(file.data.length, 24);
        centralHeader.writeUInt16LE(fileName.length, 28);
        centralHeader.writeUInt16LE(0, 30);
        centralHeader.writeUInt16LE(0, 32);
        centralHeader.writeUInt16LE(0, 34);
        centralHeader.writeUInt16LE(0, 36);
        centralHeader.writeUInt32LE(0, 38);
        centralHeader.writeUInt32LE(localOffset, 42);

        centralParts.push(centralHeader, fileName);
        localOffset += localHeader.length + fileName.length + file.data.length;
    }

    const centralDirectory = Buffer.concat(centralParts);
    const endOfCentralDirectory = Buffer.alloc(22);
    endOfCentralDirectory.writeUInt32LE(0x06054B50, 0);
    endOfCentralDirectory.writeUInt16LE(0, 4);
    endOfCentralDirectory.writeUInt16LE(0, 6);
    endOfCentralDirectory.writeUInt16LE(files.length, 8);
    endOfCentralDirectory.writeUInt16LE(files.length, 10);
    endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
    endOfCentralDirectory.writeUInt32LE(localOffset, 16);
    endOfCentralDirectory.writeUInt16LE(0, 20);

    return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
}

function formatBytes(size) {
    if (size < 1024) return `${size} B`;
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(2)} KiB`;
    return `${(size / (1024 * 1024)).toFixed(2)} MiB`;
}

function removeOldReleaseZips(packageName) {
    if (!fs.existsSync(outputDir)) {
        return;
    }

    const releaseZipPattern = new RegExp(`^${packageName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}-offline-v.+\\.zip$`);
    for (const entry of fs.readdirSync(outputDir, {withFileTypes: true})) {
        if (entry.isFile() && releaseZipPattern.test(entry.name)) {
            fs.rmSync(path.join(outputDir, entry.name));
        }
    }
}

function main() {
    assertDistReady();

    const packageInfo = readPackageInfo();
    const files = collectFiles(distDir);
    if (files.length === 0) {
        throw new Error('dist 目录为空，无法生成离线包');
    }

    fs.mkdirSync(outputDir, {recursive: true});
    removeOldReleaseZips(packageInfo.name);

    const zipBuffer = buildZip(files);
    const outputName = `${packageInfo.name}-offline-v${packageInfo.version}.zip`;
    const outputPath = path.join(outputDir, outputName);
    fs.writeFileSync(outputPath, zipBuffer);

    const totalInputSize = files.reduce((sum, file) => sum + file.data.length, 0);

    console.log('离线包已生成');
    console.log(`输出目录: ${outputDir}`);
    console.log(`输出文件: ${outputPath}`);
    console.log(`文件数量: ${files.length}`);
    console.log(`源文件总大小: ${formatBytes(totalInputSize)}`);
    console.log(`zip 大小: ${formatBytes(zipBuffer.length)}`);
}

try {
    main();
} catch (error) {
    console.error(`离线包生成失败: ${error.message}`);
    process.exitCode = 1;
}
