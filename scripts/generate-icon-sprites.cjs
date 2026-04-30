const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const sharp = require('sharp');

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
const SPRITE_PNG_OPTIONS = {
    palette: true,
    quality: 50,
    effort: 6,
    dither: 1.0,
    compressionLevel: 9,
};
const SPRITE_WEBP_OPTIONS = {
    quality: 75,
};

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

function normalizeTransparentPixels(rgba) {
    for (let offset = 0; offset < rgba.length; offset += 4) {
        if (rgba[offset + 3] !== 0) {
            continue;
        }

        // 透明像素的 RGB 不参与显示，清零后能提升无损压缩率。
        rgba[offset] = 0;
        rgba[offset + 1] = 0;
        rgba[offset + 2] = 0;
    }
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

async function composeSprite(iconFiles) {
    const columns = Math.ceil(Math.sqrt(iconFiles.length));
    const rows = Math.ceil(iconFiles.length / columns);
    const width = columns * ICON_SIZE;
    const height = rows * ICON_SIZE;
    const rgba = Buffer.alloc(width * height * 4);
    const coordinates = {};

    iconFiles.forEach((iconFile, index) => {
        const source = decodeRgbaPng(iconFile.fullPath);
        normalizeTransparentPixels(source.rgba);
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

    const image = sharp(rgba, {
        raw: {
            width,
            height,
            channels: 4,
        },
    });
    const png = await image.clone().png(SPRITE_PNG_OPTIONS).toBuffer();
    const webp = await image.clone().webp(SPRITE_WEBP_OPTIONS).toBuffer();

    return {
        png,
        webp,
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

async function generateIconSprites(options = {}) {
    const sourceDir = options.sourceDir || DEFAULT_SOURCE_DIR;
    const publicDir = options.publicDir || DEFAULT_PUBLIC_DIR;
    const spriteDataDir = options.spriteDataDir || DEFAULT_SPRITE_DATA_DIR;
    const gameDataDir = options.gameDataDir || DEFAULT_GAME_DATA_DIR;
    const {iconAssetIndex, requiredIcons, missingIcons, jsonFileCount} = collectRequiredIcons(sourceDir, gameDataDir);
    const modNames = MOD_PRIORITY_ORDER.filter(modName => iconAssetIndex[modName]?.size > 0);

    let totalInputBytes = 0;
    let totalPngBytes = 0;
    let totalWebpBytes = 0;
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

        const sprite = await composeSprite(iconFiles);
        const spritePath = path.join(publicDir, `${modName}.png`);
        const webpPath = path.join(publicDir, `${modName}.webp`);
        const dataPath = path.join(spriteDataDir, `${modName}.json`);
        const json = `${JSON.stringify(sprite.coordinates)}\n`;
        writeFileIfChanged(spritePath, sprite.png);
        writeFileIfChanged(webpPath, sprite.webp);
        writeFileIfChanged(dataPath, json);

        totalPngBytes += sprite.png.length;
        totalWebpBytes += sprite.webp.length;
        console.log(
            `icon sprite: ${modName} ${iconFiles.length} icons ${sprite.width}x${sprite.height} `
            + `png ${sprite.png.length} bytes webp ${sprite.webp.length} bytes`
        );
    }

    for (const missingIcon of missingIcons.values()) {
        console.warn(
            `missing icon asset: ${missingIcon.iconName} `
            + `(${missingIcon.dataFileCount.size} data files; ${missingIcon.examples.join('; ')})`
        );
    }
    const savedPng = totalInputBytes - totalPngBytes;
    const savedWebp = totalInputBytes - totalWebpBytes;
    const pngPercent = totalInputBytes === 0 ? 0 : (savedPng / totalInputBytes) * 100;
    const webpPercent = totalInputBytes === 0 ? 0 : (savedWebp / totalInputBytes) * 100;
    console.log(`icon sprite data files: ${jsonFileCount}, required icons: ${totalRequiredIcons}, missing icons: ${missingIcons.size}`);
    console.log(
        `icon sprite total png: ${totalInputBytes} -> ${totalPngBytes} bytes, `
        + `saved ${savedPng} (${pngPercent.toFixed(2)}%)`
    );
    console.log(
        `icon sprite total webp: ${totalInputBytes} -> ${totalWebpBytes} bytes, `
        + `saved ${savedWebp} (${webpPercent.toFixed(2)}%)`
    );
}

if (require.main === module) {
    generateIconSprites().catch(error => {
        console.error(error);
        process.exitCode = 1;
    });
}

module.exports = {
    generateIconSprites,
};
