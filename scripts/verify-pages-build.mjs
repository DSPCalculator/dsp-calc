// Validate emitted URLs for either a project subpath or a root/custom domain.
import assert from 'node:assert/strict';
import console from 'node:console';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import {spriteAssetPaths} from './sprite-assets.mjs';

const base = `/${(process.argv[2] || '').replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\//, '/');
const output = path.resolve(process.argv[3] || 'dist');
const html = readFileSync(path.join(output, 'index.html'), 'utf8');
const manifest = JSON.parse(readFileSync(path.join(output, 'manifest.webmanifest'), 'utf8'));
assert.equal(manifest.start_url, base, 'PWA start URL must use the configured Pages path');
assert.equal(manifest.scope, base, 'PWA scope must stay inside this site');
assert.ok(existsSync(path.join(output, 'sw.js')), 'Service worker is emitted');
const bundledJavaScript = readdirSync(path.join(output, 'assets')).filter(file => file.endsWith('.js'))
    .map(file => readFileSync(path.join(output, 'assets', file), 'utf8')).join('\n');
for (const game of ['Vanilla', 'MoreMegaStructure', 'GenesisBook', 'FractionateEverything']) {
    const assets = JSON.parse(readFileSync(`icon/${game}.assets.json`, 'utf8'));
    const coordinates = JSON.parse(readFileSync(`icon/${game}.json`, 'utf8'));
    for (const extension of ['png', 'webp']) {
        assert.match(assets[extension], new RegExp(`^icon/${game}\\.[a-f0-9]{16}\\.${extension}$`), 'Sprite URL is content-versioned');
        assertLocalAsset(`${base}${assets[extension]}`);
        assert.ok(bundledJavaScript.includes(assets[extension]), `${game} ${extension} sprite is referenced by the app`);
        assert.ok(!existsSync(path.join(output, `icon/${game}.${extension}`)), 'Unversioned sprites are no longer deployed');
    }
    assert.deepEqual({png: assets.png, webp: assets.webp}, spriteAssetPaths(game, coordinates,
        readFileSync(path.join(output, assets.png)), readFileSync(path.join(output, assets.webp))),
    `${game} sprite revision matches the deployed image bytes and bundled coordinates`);
    const sourceNames = readdirSync(`icon/${game}`).filter(file => file.endsWith('.png')).map(file => path.basename(file, '.png')).sort();
    assert.deepEqual(Object.keys(coordinates).sort(), sourceNames, `${game} atlas includes every source icon`);
}

function assertLocalAsset(reference) {
    const origin = 'https://pages.example';
    const url = new URL(reference, `${origin}${base}`);
    if (url.origin !== origin || url.protocol === 'data:') return;
    assert.ok(url.pathname.startsWith(base), `Asset escapes Pages base: ${reference}`);
    const relativePath = decodeURIComponent(url.pathname.slice(base.length));
    assert.ok(existsSync(path.join(output, relativePath)), `Missing asset: ${reference}`);
}

for (const [, reference] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    assertLocalAsset(reference);
}
for (const icon of manifest.icons) assertLocalAsset(icon.src);
const serviceWorker = readFileSync(path.join(output, 'sw.js'), 'utf8');
assert.ok(serviceWorker.includes('index.html'), 'Offline navigation fallback is precached');
console.log(`Verified HTML, manifest, service worker and sprites for ${base}`);
