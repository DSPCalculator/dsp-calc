import react from '@vitejs/plugin-react';
import {lstatSync, readdirSync} from 'fs';
import fsp from 'fs/promises';
import {createRequire} from 'module';
import glob from 'glob';
import imagemin from 'imagemin';
import imageminPngquant from 'imagemin-pngquant';
import imageminWebp from 'imagemin-webp';
import path from 'path';
import {fileURLToPath} from 'url';
import Spritesmith from 'spritesmith';
import {defineConfig} from 'vite';
import legacy from '@vitejs/plugin-legacy';
import {VitePWA} from 'vite-plugin-pwa';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** This generates one sprite image per game name when `mode == "development"` (`npm run dev`) */
function get_sprite_plugins(mode) {
    if (mode == "development") return [];

    return readdirSync('./icon').map(dir => {
        if (lstatSync(`./icon/${dir}`).isDirectory()) {
            const output_icon = `./icon/${dir}.png`;

            return {
                // convert `output_icon` to webp and compressed png
                name: "spritesmith_and_postprocess_image",
                async buildStart() {
                    let {image, coord} = await new Promise((resolve, reject) => {
                        Spritesmith.run({src: glob.sync(`./icon/${dir}/*.png`)}, function (err, result) {
                            if (err) {
                                reject(err);
                            }

                            let {width, height} = result.properties;
                            let coord_entries = Object.entries(result.coordinates).map(([img, coord]) =>
                                [path.basename(img, ".png"), {...coord, total_width: width, total_height: height}]);
                            let coord = Object.fromEntries(coord_entries);

                            resolve({image: result.image, coord: coord});
                        });
                    });

                    // write the sprite png and json coord
                    await fsp.writeFile(output_icon, image);
                    await fsp.writeFile(`./icon/${dir}.json`, JSON.stringify(coord, null, 2));

                    // compress the png to png and webp, and report the size diff
                    function filesize_mb(filename) {
                        return (lstatSync(filename).size / 1024 / 1024).toFixed(2);
                    }

                    let size_before = filesize_mb(output_icon);

                    const plugin_options = [
                        imageminPngquant({quality: [0.1, 0.5], strip: true, speed: 5}),
                        imageminWebp({quality: 75})
                    ];
                    for (let plugin of plugin_options) {
                        await imagemin([output_icon],
                            {destination: './public/icon', plugins: [plugin]});
                    }

                    let output_png = output_icon.replace("/icon/", "/public/icon/");

                    let size_after_png = filesize_mb(output_png);
                    let size_after_webp = filesize_mb(output_png.replace(".png", ".webp"));
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
                        if (id.includes('/react-icons/') || id.includes('/react-bootstrap-icons/')) {
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
            targets: ['ie>=11'],
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
