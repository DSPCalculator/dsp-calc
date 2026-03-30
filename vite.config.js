import react from '@vitejs/plugin-react';
import {existsSync, lstatSync, readdirSync} from 'fs';
import fsp from 'fs/promises';
import {createRequire} from 'module';
import sharp from 'sharp';
import path from 'path';
import {fileURLToPath} from 'url';
import {defineConfig} from 'vite';
import legacy from '@vitejs/plugin-legacy';
import {VitePWA} from 'vite-plugin-pwa';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Generate a sprite sheet from an array of PNG files using sharp.
 *  Returns {image: Buffer, coordinates: {[file]: {x, y, width, height}}, properties: {width, height}} */
async function generateSpriteSheet(pngFiles) {
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

/** Generate one sprite image per game sub-directory under `icon/`.
 *  In development mode, skip generation if sprite files already exist (so the
 *  dev server starts fast on subsequent runs while still working on first run). */
function get_sprite_plugins(mode) {
    return readdirSync('./icon').map(dir => {
        if (lstatSync(`./icon/${dir}`).isDirectory()) {
            const output_icon = `./icon/${dir}.png`;

            return {
                // generate sprite sheet, then compress to png and webp
                name: `spritesmith_${dir}`,
                async buildStart() {
                    // In dev mode, skip if sprite files already exist
                    if (mode === "development") {
                        const jsonExists = existsSync(`./icon/${dir}.json`);
                        const pngExists = existsSync(`./public/icon/${dir}.png`);
                        if (jsonExists && pngExists) return;
                        console.log(`[sprite] Generating missing icon atlas for "${dir}"...`);
                    }

                    const pngFiles = readdirSync(`./icon/${dir}`)
                        .filter(f => f.endsWith('.png'))
                        .sort()
                        .map(f => `./icon/${dir}/${f}`);

                    const result = await generateSpriteSheet(pngFiles);
                    const {width, height} = result.properties;

                    const coord_entries = Object.entries(result.coordinates).map(([img, coord]) =>
                        [path.basename(img, ".png"), {...coord, total_width: width, total_height: height}]);
                    const coord = Object.fromEntries(coord_entries);

                    // write the sprite png and json coord
                    await fsp.writeFile(output_icon, result.image);
                    await fsp.writeFile(`./icon/${dir}.json`, JSON.stringify(coord, null, 2));

                    // compress the png to png and webp, and report the size diff
                    function filesize_mb(filename) {
                        return (lstatSync(filename).size / 1024 / 1024).toFixed(2);
                    }

                    let size_before = filesize_mb(output_icon);

                    // Ensure destination directory exists
                    await fsp.mkdir('./public/icon', {recursive: true});

                    const iconBasename = path.basename(output_icon, path.extname(output_icon));
                    const output_png = path.join('./public/icon', path.basename(output_icon));
                    const output_webp = path.join('./public/icon', `${iconBasename}.webp`);

                    // Compress PNG
                    await sharp(output_icon)
                        .png({
                            palette: true,
                            quality: 50,
                            effort: 6,
                            dither: 1.0,
                            compressionLevel: 9,
                        })
                        .toFile(output_png);

                    // Convert to WebP
                    await sharp(output_icon)
                        .webp({quality: 75})
                        .toFile(output_webp);

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

// https://vitejs.dev/config/
export default defineConfig(({mode}) => ({
    base: "./",
    define: {
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(require('./package.json').version),
    },
    resolve: {
        alias: {
            '~bootstrap': path.resolve(__dirname, 'node_modules/bootstrap'),
        }
    },
    css: {
        preprocessorOptions: {
            scss: {
                silenceDeprecations: [
                    'import',
                    'global-builtin',
                    'color-functions',
                    'if-function',
                ],
                quietDeps: true,
            },
        },
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
                        if (id.includes('/antd/') || id.includes('/@ant-design/') || id.includes('/rc-')) {
                            return 'vendor-antd';
                        }
                        if (id.includes('/bootstrap/') || id.includes('/react-bootstrap/') || id.includes('/@popperjs/')) {
                            return 'vendor-bootstrap';
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
        ...get_sprite_plugins(mode),
        ...(!is_tauri_build ? [legacy({
            targets: ['edge>=79', 'firefox>=67', 'chrome>=64', 'safari>=12'],
            additionalLegacyPolyfills:['regenerator-runtime/runtime'],
        })] : []),
        ...(is_tauri_build ? [pwaStubPlugin()] : []),
        ...(!is_tauri_build ? [VitePWA({
            registerType: 'prompt',
            injectRegister: false,
            manifest: {
                name: '戴森球计划量化计算器',
                short_name: 'DSP计算器',
                description: '戴森球计划生产线量化计算工具',
                theme_color: '#212529',
                background_color: '#212529',
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
                            cacheName: 'game-data-cache',
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
                            cacheName: 'sprite-cache',
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
