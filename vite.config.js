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
    ]
}))
