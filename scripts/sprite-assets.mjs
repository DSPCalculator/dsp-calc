import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import path from 'node:path';

function hashParts(parts) {
    const hash = createHash('sha256');
    for (const part of parts) {
        hash.update(`${Buffer.byteLength(part)}:`);
        hash.update(part);
    }
    return hash.digest('hex');
}

// Names matter as well as pixels: adding or renaming an icon can move every
// subsequent coordinate, even when the underlying image bytes are identical.
export async function spriteSourceHash(files) {
    const parts = await Promise.all([...files].sort().map(async file =>
        [path.basename(file), await readFile(file)]));
    return hashParts(parts.flat());
}

export function spriteAssetPaths(mod, coordinates, png, webp) {
    const sortedCoordinates = Object.fromEntries(Object.entries(coordinates).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    const revision = hashParts([JSON.stringify(sortedCoordinates), png, webp]).slice(0, 16);
    return {
        png: `icon/${mod}.${revision}.png`,
        webp: `icon/${mod}.${revision}.webp`,
    };
}
