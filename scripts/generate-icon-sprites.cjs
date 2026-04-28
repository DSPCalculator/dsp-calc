const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ICON_SIZE = 80;
const DEFAULT_SOURCE_DIR = path.join('src', 'ui', 'components', 'icons', 'assets');
const DEFAULT_PUBLIC_DIR = path.join('public', 'icon');
const DEFAULT_SPRITE_DATA_DIR = path.join('src', 'ui', 'components', 'icons', 'sprites');
const DEFAULT_GAME_DATA_DIR = path.join('src', 'engine', 'data', 'raw');
const MOD_PRIORITY_ORDER = [
    'Vanilla',
    'MoreMegaStructure',
    'TheyComeFromVoid',
    'GenesisBook',
    'OrbitalRing',
    'FractionateEverything',
];

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c >>> 0;
}

function crc32(buffer) {
    let c = 0xffffffff;
    for (const value of buffer) {
        c = crcTable[(c ^ value) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
    const typeBuffer = Buffer.from(type, 'ascii');
    const lengthBuffer = Buffer.alloc(4);
    const crcBuffer = Buffer.alloc(4);
    lengthBuffer.writeUInt32BE(data.length, 0);
    crcBuffer.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
    return Buffer.concat([lengthBuffer, typeBuffer, data, crcBuffer]);
}

function getChunks(buffer) {
    if (!buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
        throw new Error('not a png file');
    }

    const chunks = [];
    let offset = PNG_SIGNATURE.length;
    while (offset < buffer.length) {
        const length = buffer.readUInt32BE(offset);
        const type = buffer.toString('ascii', offset + 4, offset + 8);
        const dataStart = offset + 8;
        const dataEnd = dataStart + length;
        chunks.push({
            type,
            data: buffer.subarray(dataStart, dataEnd),
        });
        offset = dataEnd + 4;
        if (type === 'IEND') {
            break;
        }
    }
    return chunks;
}

function paethPredictor(a, b, c) {
    const p = a + b - c;
    const pa = Math.abs(p - a);
    const pb = Math.abs(p - b);
    const pc = Math.abs(p - c);
    if (pa <= pb && pa <= pc) {
        return a;
    }
    return pb <= pc ? b : c;
}

function decodeRgbaPng(filePath) {
    const buffer = fs.readFileSync(filePath);
    const chunks = getChunks(buffer);
    const ihdr = chunks.find(chunk => chunk.type === 'IHDR');
    if (!ihdr) {
        throw new Error(`${filePath}: missing IHDR`);
    }

    const width = ihdr.data.readUInt32BE(0);
    const height = ihdr.data.readUInt32BE(4);
    const bitDepth = ihdr.data[8];
    const colorType = ihdr.data[9];
    const interlace = ihdr.data[12];
    if (width > ICON_SIZE || height > ICON_SIZE || bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
        throw new Error(`${filePath}: only up to ${ICON_SIZE}x${ICON_SIZE} 8-bit RGBA png icons are supported`);
    }

    const idat = Buffer.concat(chunks.filter(chunk => chunk.type === 'IDAT').map(chunk => chunk.data));
    const inflated = zlib.inflateSync(idat);
    const rowBytes = width * 4;
    const rows = [];
    let offset = 0;

    for (let y = 0; y < height; y++) {
        const filterType = inflated[offset];
        const source = inflated.subarray(offset + 1, offset + 1 + rowBytes);
        const row = Buffer.alloc(rowBytes);
        const previous = rows[y - 1];

        for (let x = 0; x < rowBytes; x++) {
            const left = x >= 4 ? row[x - 4] : 0;
            const up = previous ? previous[x] : 0;
            const upLeft = previous && x >= 4 ? previous[x - 4] : 0;
            const value = source[x];

            switch (filterType) {
                case 0:
                    row[x] = value;
                    break;
                case 1:
                    row[x] = (value + left) & 0xff;
                    break;
                case 2:
                    row[x] = (value + up) & 0xff;
                    break;
                case 3:
                    row[x] = (value + Math.floor((left + up) / 2)) & 0xff;
                    break;
                case 4:
                    row[x] = (value + paethPredictor(left, up, upLeft)) & 0xff;
                    break;
                default:
                    throw new Error(`${filePath}: unsupported png filter ${filterType}`);
            }
        }

        rows.push(row);
        offset += rowBytes + 1;
    }

    return {
        width,
        height,
        rgba: Buffer.concat(rows),
    };
}

function filterRow(row, previous, filterType) {
    const output = Buffer.alloc(row.length + 1);
    output[0] = filterType;

    for (let x = 0; x < row.length; x++) {
        const left = x >= 4 ? row[x - 4] : 0;
        const up = previous ? previous[x] : 0;
        const upLeft = previous && x >= 4 ? previous[x - 4] : 0;

        switch (filterType) {
            case 0:
                output[x + 1] = row[x];
                break;
            case 1:
                output[x + 1] = (row[x] - left) & 0xff;
                break;
            case 2:
                output[x + 1] = (row[x] - up) & 0xff;
                break;
            case 3:
                output[x + 1] = (row[x] - Math.floor((left + up) / 2)) & 0xff;
                break;
            case 4:
                output[x + 1] = (row[x] - paethPredictor(left, up, upLeft)) & 0xff;
                break;
            default:
                throw new Error(`unsupported png filter ${filterType}`);
        }
    }

    return output;
}

function scoreFilterRow(row) {
    let score = 0;
    for (let i = 1; i < row.length; i++) {
        const value = row[i];
        score += value < 128 ? value : 256 - value;
    }
    return score;
}

function encodeRgbaPng(width, height, rgba) {
    const rowBytes = width * 4;
    const filteredRows = [];
    let previous = null;

    for (let y = 0; y < height; y++) {
        const row = rgba.subarray(y * rowBytes, (y + 1) * rowBytes);
        let best = null;
        let bestScore = Number.POSITIVE_INFINITY;
        for (let filterType = 0; filterType <= 4; filterType++) {
            const candidate = filterRow(row, previous, filterType);
            const score = scoreFilterRow(candidate);
            if (score < bestScore) {
                best = candidate;
                bestScore = score;
            }
        }
        filteredRows.push(best);
        previous = row;
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 6;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const idat = zlib.deflateSync(Buffer.concat(filteredRows), {
        level: 9,
        memLevel: 9,
    });

    return Buffer.concat([
        PNG_SIGNATURE,
        makeChunk('IHDR', ihdr),
        makeChunk('IDAT', idat),
        makeChunk('IEND', Buffer.alloc(0)),
    ]);
}

function createQuantizedPalette(rgba) {
    const transparent = {r: 0, g: 0, b: 0, a: 0, count: 0, rSum: 0, gSum: 0, bSum: 0, aSum: 0};
    const histogram = new Map();

    for (let offset = 0; offset < rgba.length; offset += 4) {
        const alpha = rgba[offset + 3];
        if (alpha === 0) {
            transparent.count += 1;
            continue;
        }

        const r = rgba[offset];
        const g = rgba[offset + 1];
        const b = rgba[offset + 2];
        const key = `${r >> 3},${g >> 3},${b >> 3},${alpha >> 3}`;
        let point = histogram.get(key);
        if (!point) {
            point = {r: 0, g: 0, b: 0, a: 0, count: 0, rSum: 0, gSum: 0, bSum: 0, aSum: 0};
            histogram.set(key, point);
        }
        point.count += 1;
        point.rSum += r;
        point.gSum += g;
        point.bSum += b;
        point.aSum += alpha;
    }

    const points = [...histogram.values()].map(point => ({
        ...point,
        r: point.rSum / point.count,
        g: point.gSum / point.count,
        b: point.bSum / point.count,
        a: point.aSum / point.count,
    }));

    const maxPaletteSize = transparent.count > 0 ? 255 : 256;
    const boxes = [{points}];

    while (boxes.length < maxPaletteSize) {
        let splitIndex = -1;
        let splitScore = -1;

        for (let i = 0; i < boxes.length; i++) {
            const box = boxes[i];
            if (box.points.length < 2) {
                continue;
            }
            const bounds = getBoxBounds(box.points);
            const score = Math.max(
                bounds.rMax - bounds.rMin,
                bounds.gMax - bounds.gMin,
                bounds.bMax - bounds.bMin,
                bounds.aMax - bounds.aMin,
            ) * getBoxWeight(box.points);
            if (score > splitScore) {
                splitIndex = i;
                splitScore = score;
            }
        }

        if (splitIndex < 0) {
            break;
        }

        const box = boxes.splice(splitIndex, 1)[0];
        const bounds = getBoxBounds(box.points);
        const channel = getWidestChannel(bounds);
        box.points.sort((a, b) => a[channel] - b[channel]);

        const halfWeight = getBoxWeight(box.points) / 2;
        let weight = 0;
        let splitPoint = 1;
        for (; splitPoint < box.points.length - 1; splitPoint++) {
            weight += box.points[splitPoint].count;
            if (weight >= halfWeight) {
                break;
            }
        }

        boxes.push({points: box.points.slice(0, splitPoint + 1)});
        boxes.push({points: box.points.slice(splitPoint + 1)});
    }

    const palette = [];
    if (transparent.count > 0) {
        palette.push(transparent);
    }
    for (const box of boxes) {
        const weight = getBoxWeight(box.points);
        const color = box.points.reduce((sum, point) => {
            sum.r += point.rSum;
            sum.g += point.gSum;
            sum.b += point.bSum;
            sum.a += point.aSum;
            return sum;
        }, {r: 0, g: 0, b: 0, a: 0});
        palette.push({
            r: Math.round(color.r / weight),
            g: Math.round(color.g / weight),
            b: Math.round(color.b / weight),
            a: Math.round(color.a / weight),
        });
    }

    return palette.slice(0, 256);
}

function getBoxBounds(points) {
    return points.reduce((bounds, point) => ({
        rMin: Math.min(bounds.rMin, point.r),
        rMax: Math.max(bounds.rMax, point.r),
        gMin: Math.min(bounds.gMin, point.g),
        gMax: Math.max(bounds.gMax, point.g),
        bMin: Math.min(bounds.bMin, point.b),
        bMax: Math.max(bounds.bMax, point.b),
        aMin: Math.min(bounds.aMin, point.a),
        aMax: Math.max(bounds.aMax, point.a),
    }), {
        rMin: 255,
        rMax: 0,
        gMin: 255,
        gMax: 0,
        bMin: 255,
        bMax: 0,
        aMin: 255,
        aMax: 0,
    });
}

function getBoxWeight(points) {
    return points.reduce((sum, point) => sum + point.count, 0);
}

function getWidestChannel(bounds) {
    const ranges = [
        ['r', bounds.rMax - bounds.rMin],
        ['g', bounds.gMax - bounds.gMin],
        ['b', bounds.bMax - bounds.bMin],
        ['a', bounds.aMax - bounds.aMin],
    ];
    ranges.sort((a, b) => b[1] - a[1]);
    return ranges[0][0];
}

function findNearestPaletteIndex(color, palette) {
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < palette.length; i++) {
        const candidate = palette[i];
        const alphaDelta = color.a - candidate.a;
        const rDelta = color.r - candidate.r;
        const gDelta = color.g - candidate.g;
        const bDelta = color.b - candidate.b;
        const distance = alphaDelta * alphaDelta * 2
            + rDelta * rDelta
            + gDelta * gDelta
            + bDelta * bDelta;
        if (distance < bestDistance) {
            bestDistance = distance;
            bestIndex = i;
        }
    }

    return bestIndex;
}

function encodeIndexedPng(width, height, rgba) {
    const palette = createQuantizedPalette(rgba);
    const indexCache = new Map();
    const indexedRows = [];

    for (let y = 0; y < height; y++) {
        const row = Buffer.alloc(width + 1);
        row[0] = 0;
        for (let x = 0; x < width; x++) {
            const offset = (y * width + x) * 4;
            const alpha = rgba[offset + 3];
            if (alpha === 0 && palette[0]?.a === 0) {
                row[x + 1] = 0;
                continue;
            }

            const r = rgba[offset];
            const g = rgba[offset + 1];
            const b = rgba[offset + 2];
            const key = `${r >> 3},${g >> 3},${b >> 3},${alpha >> 3}`;
            let paletteIndex = indexCache.get(key);
            if (paletteIndex === undefined) {
                paletteIndex = findNearestPaletteIndex({r, g, b, a: alpha}, palette);
                indexCache.set(key, paletteIndex);
            }
            row[x + 1] = paletteIndex;
        }
        indexedRows.push(row);
    }

    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(width, 0);
    ihdr.writeUInt32BE(height, 4);
    ihdr[8] = 8;
    ihdr[9] = 3;
    ihdr[10] = 0;
    ihdr[11] = 0;
    ihdr[12] = 0;

    const plte = Buffer.alloc(palette.length * 3);
    const trns = Buffer.alloc(palette.length);
    palette.forEach((color, index) => {
        plte[index * 3] = color.r;
        plte[index * 3 + 1] = color.g;
        plte[index * 3 + 2] = color.b;
        trns[index] = color.a;
    });

    const idat = zlib.deflateSync(Buffer.concat(indexedRows), {
        level: 9,
        memLevel: 9,
    });

    return Buffer.concat([
        PNG_SIGNATURE,
        makeChunk('IHDR', ihdr),
        makeChunk('PLTE', plte),
        makeChunk('tRNS', trns),
        makeChunk('IDAT', idat),
        makeChunk('IEND', Buffer.alloc(0)),
    ]);
}

function readIconFiles(modDir) {
    return fs.readdirSync(modDir)
        .filter(name => name.toLowerCase().endsWith('.png'))
        .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
        .map(name => ({
            fileName: name,
            iconName: path.basename(name, '.png'),
            fullPath: path.join(modDir, name),
        }));
}

function readJsonFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, '');
    return JSON.parse(content);
}

function getEnabledModsFromGameDataFile(fileName) {
    if (fileName === 'Vanilla.json') {
        return [];
    }

    return MOD_PRIORITY_ORDER
        .filter(modName => modName !== 'Vanilla')
        .filter(modName => fileName.includes(modName));
}

function collectIconAssetIndex(sourceDir) {
    const iconAssetIndex = {};

    for (const modName of MOD_PRIORITY_ORDER) {
        const modDir = path.join(sourceDir, modName);
        if (!fs.existsSync(modDir) || !fs.statSync(modDir).isDirectory()) {
            iconAssetIndex[modName] = new Map();
            continue;
        }

        iconAssetIndex[modName] = new Map(readIconFiles(modDir).map(iconFile => [iconFile.iconName, iconFile]));
    }

    return iconAssetIndex;
}

function collectRequiredIcons(sourceDir, gameDataDir) {
    const iconAssetIndex = collectIconAssetIndex(sourceDir);
    const requiredIcons = Object.fromEntries(MOD_PRIORITY_ORDER.map(modName => [modName, new Set()]));
    const missingIcons = new Map();
    const jsonFiles = fs.readdirSync(gameDataDir)
        .filter(name => name.endsWith('.json'))
        .sort((a, b) => a.localeCompare(b, 'en-US'));

    for (const fileName of jsonFiles) {
        const jsonData = readJsonFile(path.join(gameDataDir, fileName));
        const enabledMods = getEnabledModsFromGameDataFile(fileName);
        const lookupOrder = [...enabledMods].reverse();
        lookupOrder.push('Vanilla');

        for (const item of jsonData.items || []) {
            const iconName = item.IconName;
            if (!iconName) {
                continue;
            }

            const resolvedMod = lookupOrder.find(modName => iconAssetIndex[modName]?.has(iconName));
            if (resolvedMod) {
                requiredIcons[resolvedMod].add(iconName);
            } else {
                const missingIcon = missingIcons.get(iconName) || {
                    iconName,
                    examples: [],
                    dataFileCount: new Set(),
                };
                missingIcon.dataFileCount.add(fileName);
                if (missingIcon.examples.length < 3) {
                    missingIcon.examples.push(`${fileName}: ${item.Name || item.ID}`);
                }
                missingIcons.set(iconName, missingIcon);
            }
        }
    }

    return {
        iconAssetIndex,
        requiredIcons,
        missingIcons,
        jsonFileCount: jsonFiles.length,
    };
}

function composeSprite(iconFiles) {
    const columns = Math.ceil(Math.sqrt(iconFiles.length));
    const rows = Math.ceil(iconFiles.length / columns);
    const width = columns * ICON_SIZE;
    const height = rows * ICON_SIZE;
    const rgba = Buffer.alloc(width * height * 4);
    const coordinates = {};

    iconFiles.forEach((iconFile, index) => {
        const source = decodeRgbaPng(iconFile.fullPath);
        const column = index % columns;
        const row = Math.floor(index / columns);
        const x = column * ICON_SIZE;
        const y = row * ICON_SIZE;

        for (let sourceY = 0; sourceY < source.height; sourceY++) {
            const sourceOffset = sourceY * source.width * 4;
            const targetOffset = ((y + sourceY) * width + x) * 4;
            source.rgba.copy(rgba, targetOffset, sourceOffset, sourceOffset + source.width * 4);
        }

        coordinates[iconFile.iconName] = {
            x,
            y,
            width: source.width,
            height: source.height,
            total_width: width,
            total_height: height,
        };
    });

    const rgbaPng = encodeRgbaPng(width, height, rgba);
    const indexedPng = encodeIndexedPng(width, height, rgba);

    return {
        image: indexedPng.length < rgbaPng.length ? indexedPng : rgbaPng,
        coordinates,
        width,
        height,
    };
}

function writeFileIfChanged(filePath, content) {
    if (fs.existsSync(filePath)) {
        const current = fs.readFileSync(filePath);
        if (Buffer.isBuffer(content) && current.equals(content)) {
            return false;
        }
        if (!Buffer.isBuffer(content) && current.toString('utf8') === content) {
            return false;
        }
    }
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    fs.writeFileSync(filePath, content);
    return true;
}

function generateIconSprites(options = {}) {
    const sourceDir = options.sourceDir || DEFAULT_SOURCE_DIR;
    const publicDir = options.publicDir || DEFAULT_PUBLIC_DIR;
    const spriteDataDir = options.spriteDataDir || DEFAULT_SPRITE_DATA_DIR;
    const gameDataDir = options.gameDataDir || DEFAULT_GAME_DATA_DIR;
    const {iconAssetIndex, requiredIcons, missingIcons, jsonFileCount} = collectRequiredIcons(sourceDir, gameDataDir);
    const modNames = MOD_PRIORITY_ORDER.filter(modName => iconAssetIndex[modName]?.size > 0);

    let totalInputBytes = 0;
    let totalSpriteBytes = 0;
    let totalRequiredIcons = 0;

    for (const modName of modNames) {
        const iconFiles = [...requiredIcons[modName]]
            .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'))
            .map(iconName => iconAssetIndex[modName].get(iconName))
            .filter(Boolean);
        if (iconFiles.length === 0) {
            continue;
        }

        totalRequiredIcons += iconFiles.length;
        totalInputBytes += iconFiles.reduce((sum, iconFile) => sum + fs.statSync(iconFile.fullPath).size, 0);

        const sprite = composeSprite(iconFiles);
        const spritePath = path.join(publicDir, `${modName}.png`);
        const dataPath = path.join(spriteDataDir, `${modName}.json`);
        const json = `${JSON.stringify(sprite.coordinates)}\n`;
        writeFileIfChanged(spritePath, sprite.image);
        writeFileIfChanged(dataPath, json);

        totalSpriteBytes += sprite.image.length;
        console.log(`icon sprite: ${modName} ${iconFiles.length} icons ${sprite.width}x${sprite.height} ${sprite.image.length} bytes`);
    }

    for (const missingIcon of missingIcons.values()) {
        console.warn(
            `missing icon asset: ${missingIcon.iconName} `
            + `(${missingIcon.dataFileCount.size} data files; ${missingIcon.examples.join('; ')})`
        );
    }
    const saved = totalInputBytes - totalSpriteBytes;
    const percent = totalInputBytes === 0 ? 0 : (saved / totalInputBytes) * 100;
    console.log(`icon sprite data files: ${jsonFileCount}, required icons: ${totalRequiredIcons}, missing icons: ${missingIcons.size}`);
    console.log(`icon sprite total: ${totalInputBytes} -> ${totalSpriteBytes} bytes, saved ${saved} (${percent.toFixed(2)}%)`);
}

if (require.main === module) {
    generateIconSprites();
}

module.exports = {
    generateIconSprites,
};
