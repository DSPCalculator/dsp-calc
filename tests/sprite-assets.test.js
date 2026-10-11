// @vitest-environment node
import {Buffer} from 'node:buffer';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import {afterEach, describe, expect, it} from 'vitest';
import {spriteAssetPaths, spriteSourceHash} from '../scripts/sprite-assets.mjs';
import {createIconStyles} from '../src/lib/icon-styles.js';
import {generateSpriteSheet} from '../vite.config.js';

const coordinate = {x: 0, y: 0, width: 2, height: 2, total_width: 2, total_height: 2};
const png = Buffer.from('encoded png');
const webp = Buffer.from('encoded webp');
const temporaryDirectories = [];
afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map(directory => rm(directory, {recursive: true, force: true})));
});

describe('content-addressed sprite assets', () => {
    it('is stable for identical image bytes and coordinates regardless of icon key order', () => {
        const before = spriteAssetPaths('Vanilla', {iron: coordinate, copper: coordinate}, png, webp);
        const after = spriteAssetPaths('Vanilla', {copper: {...coordinate}, iron: {...coordinate}}, Buffer.from(png), Buffer.from(webp));
        expect(after).toEqual(before);
        expect(before.png).toMatch(/^icon\/Vanilla\.[a-f0-9]{16}\.png$/);
        expect(before.webp).toBe(before.png.replace(/\.png$/, '.webp'));
    });

    it.each(['png', 'webp', 'coordinates'])('changes both URLs when %s changes', changed => {
        const before = spriteAssetPaths('Vanilla', {iron: coordinate}, png, webp);
        const after = spriteAssetPaths('Vanilla', {iron: {...coordinate, x: changed === 'coordinates' ? 2 : 0}},
            changed === 'png' ? Buffer.from('new png') : png, changed === 'webp' ? Buffer.from('new webp') : webp);
        expect(after.png).not.toBe(before.png);
        expect(after.webp).not.toBe(before.webp);
    });

    it('invalidates source reuse and emitted URLs when an inserted icon repacks the generated atlas', async () => {
        const directory = await mkdtemp(path.join(tmpdir(), 'dsp-sprites-'));
        temporaryDirectories.push(directory);
        const icon = await sharp({create: {width: 2, height: 2, channels: 4, background: '#ff0000'}}).png().toBuffer();
        const originalFile = path.join(directory, 'zinc.png');
        const addedFile = path.join(directory, 'DarkFogLens.png');
        await writeFile(originalFile, icon);
        const originalHash = await spriteSourceHash([originalFile]);
        expect(await spriteSourceHash([originalFile])).toBe(originalHash);
        const before = await generateSpriteSheet([originalFile]);
        const beforeWebp = await sharp(before.image).webp().toBuffer();

        // Identical pixels under a new earlier name still change packing and cache identity.
        await writeFile(addedFile, await readFile(originalFile));
        const after = await generateSpriteSheet([addedFile, originalFile]);
        const afterWebp = await sharp(after.image).webp().toBuffer();
        expect(await spriteSourceHash([addedFile, originalFile])).not.toBe(originalHash);
        expect(await spriteSourceHash([originalFile, addedFile])).toBe(await spriteSourceHash([addedFile, originalFile]));
        expect(after.coordinates[originalFile].x).not.toBe(before.coordinates[originalFile].x);
        const beforeAssets = spriteAssetPaths('Vanilla', before.coordinates, before.image, beforeWebp);
        const afterAssets = spriteAssetPaths('Vanilla', after.coordinates, after.image, afterWebp);
        expect(afterAssets.png).not.toBe(beforeAssets.png);
        expect(afterAssets.webp).not.toBe(beforeAssets.webp);

        await writeFile(originalFile, await sharp(icon).negate().png().toBuffer());
        expect(await spriteSourceHash([originalFile])).not.toBe(originalHash);
    });
});

describe('sprite styles', () => {
    it.each(['/', '/dsp-calc/', '/renamed-fork/', './'])('respects base %s and provides PNG fallback for all mods', base => {
        const mods = ['Vanilla', 'MoreMegaStructure', 'GenesisBook', 'FractionateEverything'];
        const assets = Object.fromEntries(mods.map(mod => [mod, spriteAssetPaths(mod, {icon: coordinate}, png, webp)]));
        const css = createIconStyles(assets, base);
        for (const mod of mods) {
            const {png: pngPath, webp: webpPath} = assets[mod];
            expect(css).toContain(`.icon-${mod} {`);
            expect(css).toContain(`background-image: url('${base}${pngPath}');`);
            expect(css).toContain(`image-set(url('${base}${webpPath}') type("image/webp"), url('${base}${pngPath}') type("image/png"))`);
            expect(css).not.toContain(`icon/${mod}.png`);
            expect(css).not.toContain(`icon/${mod}.webp`);
        }
    });
});
