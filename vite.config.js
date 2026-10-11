import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {existsSync, lstatSync, readdirSync} from 'fs';
import fsp from 'fs/promises';
import {createRequire} from 'module';
import sharp from 'sharp';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';
import legacy from '@vitejs/plugin-legacy';
import {VitePWA} from 'vite-plugin-pwa';
import {spriteAssetPaths, spriteSourceHash} from './scripts/sprite-assets.mjs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Generate a sprite sheet from an array of PNG files using sharp.
 *  Returns {image: Buffer, coordinates: {[file]: {x, y, width, height}}, properties: {width, height}} */
export async function generateSpriteSheet(pngFiles) {
    // Read all images and get their dimensions
    const imageInfos = await Promise.all(pngFiles.map(async (file) => {
        const meta = await sharp(file).metadata();
        return {file, width: meta.width, height: meta.height};
    }));

    if (imageInfos.length === 0) {
        throw new Error('No images to process for sprite sheet');
    }

    // Row-based packing: place images left-to-right, wrap to next row
    // For uniform-sized game icons this produces a compact grid layout
    const maxRowWidth = Math.ceil(Math.sqrt(imageInfos.length)) *
        Math.max(...imageInfos.map(i => i.width));

    let x = 0, y = 0, rowHeight = 0, totalWidth = 0;
    const placements = [];

    for (const info of imageInfos) {
        if (x + info.width > maxRowWidth && x > 0) {
            y += rowHeight;
            x = 0;
            rowHeight = 0;
        }
        placements.push({...info, x, y});
        x += info.width;
        rowHeight = Math.max(rowHeight, info.height);
        totalWidth = Math.max(totalWidth, x);
    }
    const totalHeight = y + rowHeight;

    // Composite all images onto a transparent canvas
    const composites = placements.map(p => ({
        input: p.file,
        left: p.x,
        top: p.y,
    }));

    const image = await sharp({
        create: {
            width: totalWidth,
            height: totalHeight,
            channels: 4,
            background: {r: 0, g: 0, b: 0, alpha: 0},
        }
    })
        .composite(composites)
        .png()
        .toBuffer();

    const coordinates = {};
    for (const p of placements) {
        coordinates[p.file] = {x: p.x, y: p.y, width: p.width, height: p.height};
    }

    return {image, coordinates, properties: {width: totalWidth, height: totalHeight}};
}

/** Generate one content-addressed sprite pair per game directory under `icon/`.
 *  Development reuses existing sprites only while their source icons match. */
function get_sprite_plugins(mode) {
    return readdirSync('./icon').map(dir => {
        if (lstatSync(`./icon/${dir}`).isDirectory()) {
            const output_icon = `./icon/${dir}.png`;

            return {
                // generate sprite sheet, then compress to png and webp
                name: `spritesmith_${dir}`,
                async buildStart() {
                    const pngFiles = readdirSync(`./icon/${dir}`)
                        .filter(f => f.endsWith('.png'))
                        .sort()
                        .map(f => `./icon/${dir}/${f}`);
                    const sourceHash = await spriteSourceHash(pngFiles);
                    const manifestPath = `./icon/${dir}.assets.json`;

                    if (mode === "development") {
                        try {
                            const assets = JSON.parse(await fsp.readFile(manifestPath, 'utf8'));
                            if (assets.sourceHash === sourceHash && existsSync(`./icon/${dir}.json`) &&
                                existsSync(`./public/${assets.png}`) && existsSync(`./public/${assets.webp}`)) return;
                        } catch {
                            // Missing or older generated assets must be regenerated together.
                        }
                        console.log(`[sprite] Generating changed or missing icon atlas for "${dir}"...`);
                    }

                    const result = await generateSpriteSheet(pngFiles);
                    const {width, height} = result.properties;

                    const coord_entries = Object.entries(result.coordinates).map(([img, coord]) =>
                        [path.basename(img, ".png"), {...coord, total_width: width, total_height: height}]);
                    const coord = Object.fromEntries(coord_entries);

                    // write the sprite png and json coord
                    await fsp.writeFile(output_icon, result.image);

                    // compress the png to png and webp, and report the size diff
                    function filesize_mb(filename) {
                        return (lstatSync(filename).size / 1024 / 1024).toFixed(2);
                    }

                    let size_before = filesize_mb(output_icon);

                    // Ensure destination directory exists
                    await fsp.mkdir('./public/icon', {recursive: true});

                    // Compress PNG
                    const png = await sharp(result.image)
                        .png({
                            palette: true,
                            quality: 50,
                            effort: 6,
                            dither: 1.0,
                            compressionLevel: 9,
                        })
                        .toBuffer();

                    // Convert to WebP
                    const webp = await sharp(result.image)
                        .webp({quality: 75})
                        .toBuffer();

                    // Version both formats together with their coordinates. Previously cached
                    // atlases cannot satisfy a new URL after packing or artwork changes.
                    const assets = spriteAssetPaths(dir, coord, png, webp);
                    const output_png = `./public/${assets.png}`;
                    const output_webp = `./public/${assets.webp}`;
                    await Promise.all([
                        fsp.writeFile(output_png, png),
                        fsp.writeFile(output_webp, webp),
                        fsp.writeFile(`./icon/${dir}.json`, JSON.stringify(coord, null, 2)),
                        fsp.writeFile(manifestPath, JSON.stringify({...assets, sourceHash}, null, 2)),
                    ]);

                    // public/ is copied verbatim: exclude superseded generated atlases from
                    // the next deploy, while existing clients retain their own cached copies.
                    const currentFiles = new Set([path.basename(assets.png), path.basename(assets.webp)]);
                    await Promise.all(readdirSync('./public/icon')
                        .filter(file => file.startsWith(`${dir}.`) && /\.(png|webp)$/.test(file) && !currentFiles.has(file))
                        .map(file => fsp.unlink(path.join('./public/icon', file))));

                    let size_after_png = filesize_mb(output_png);
                    let size_after_webp = filesize_mb(output_webp);
                    console.log("icon sprite:", dir, size_before, "->",
                        size_after_png, "MB", "(png)",
                        size_after_webp, "MB", "(webp)");
                },
            }
        } else {
            return [];
        }
    });
}

// When building inside Tauri, TAURI_ENV_PLATFORM is set by the Tauri CLI.
// WebView2 (Chromium-based) does not need the IE11 legacy polyfill bundle.
const is_tauri_build = !!process.env.TAURI_ENV_PLATFORM;

/** Stub for `virtual:pwa-register/react` when VitePWA plugin is not loaded (Tauri builds). */
function pwaStubPlugin() {
    const virtualId = 'virtual:pwa-register/react';
    const resolvedId = '\0' + virtualId;
    return {
        name: 'pwa-stub',
        resolveId(id) {
            if (id === virtualId) return resolvedId;
        },
        load(id) {
            if (id === resolvedId) {
                return `export function useRegisterSW() {
                    return {
                        offlineReady: [false, () => {}],
                        needRefresh: [false, () => {}],
                        updateServiceWorker: () => {},
                    };
                }`;
            }
        },
    };
}

// configure-pages returns either "/repository" or "" (root/custom domain).
// Keep one trailing slash for assets, the manifest and service-worker scope.
export function normalizeBase(value = '/') {
    if (value === '.' || value === './') return './';
    return `/${value.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\//, '/');
}
const base = is_tauri_build ? './' : normalizeBase(process.env.VITE_BASE_PATH);
const cacheSuffix = base.replace(/[^a-zA-Z0-9_-]/g, '_');

// https://vite.dev/config/
export default defineConfig(({mode}) => ({
    base,
    define: {
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(require('./package.json').version),
    },
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        }
    },
    test: {
        environment: 'jsdom',
        // Dense full-plan UI tests render hundreds of controls and exercise
        // multiple layouts. Hosted runners need a consistent integration budget.
        testTimeout: 15000,
        setupFiles: ['./tests/setup.js'],
        include: ['tests/**/*.test.{js,jsx,ts,tsx}'],
        clearMocks: true,
    },
    build: {
        chunkSizeWarningLimit: 1800,
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (id.includes('node_modules')) {
                        if (id.includes('react-dom') || id.includes('/react/') || id.includes('/scheduler/')) {
                            return 'vendor-react';
                        }
                        if (id.includes('/pinyin-pro/')) {
                            return 'vendor-pinyin';
                        }
                        if (id.includes('/react-icons/')) {
                            return 'vendor-icons';
                        }
                        if (id.includes('/javascript-lp-solver/')) {
                            return 'vendor-solver';
                        }
                    }
                    // 将游戏数据 JSON 文件分割到单独的 chunk
                    if (id.includes('/data/') && id.endsWith('.json')) {
                        return 'game-data';
                    }
                },
            },
        },
    },
    plugins: [
        react(),
        tailwindcss(),
        ...(mode === 'test' ? [] : get_sprite_plugins(mode)),
        ...(!is_tauri_build && mode !== 'test' ? [legacy({
            targets: ['edge>=79', 'firefox>=67', 'chrome>=64', 'safari>=12'],
            additionalLegacyPolyfills:['regenerator-runtime/runtime'],
        })] : []),
        ...(is_tauri_build || mode === 'test' ? [pwaStubPlugin()] : []),
        ...(!is_tauri_build && mode !== 'test' ? [VitePWA({
            scope: base,
            registerType: 'prompt',
            injectRegister: false,
            manifest: {
                id: base,
                start_url: base,
                scope: base,
                name: '戴森球计划量化计算器',
                short_name: 'DSP计算器',
                description: '戴森球计划生产线量化计算工具',
                theme_color: '#09090b',
                background_color: '#09090b',
                display: 'standalone',
                orientation: 'any',
                categories: ['utilities', 'games'],
                icons: [
                    {
                        src: 'pwa-icon.svg',
                        sizes: 'any',
                        type: 'image/svg+xml',
                        purpose: 'any',
                    },
                    {
                        src: 'pwa-icon-maskable.svg',
                        sizes: 'any',
                        type: 'image/svg+xml',
                        purpose: 'maskable',
                    },
                    {
                        src: 'favicon.ico',
                        sizes: '64x64 32x32 16x16',
                        type: 'image/x-icon',
                    },
                ],
            },
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,svg,woff2}'],
                maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
                navigateFallback: 'index.html',
                cleanupOutdatedCaches: true,
                runtimeCaching: [
                    {
                        urlPattern: /\.json$/i,
                        handler: 'StaleWhileRevalidate',
                        options: {
                            cacheName: `dsp-game-data${cacheSuffix}`,
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 60 * 24 * 30,
                            },
                            cacheableResponse: {statuses: [0, 200]},
                        },
                    },
                    {
                        urlPattern: /\/icon\/.*\.(png|webp)$/i,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: `dsp-sprites${cacheSuffix}`,
                            expiration: {
                                maxEntries: 30,
                                maxAgeSeconds: 60 * 60 * 24 * 365,
                            },
                            cacheableResponse: {statuses: [0, 200]},
                        },
                    },
                ],
            },
            devOptions: {
                enabled: false,
            },
        })] : []),
    ]
}))
