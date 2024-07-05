import react from '@vitejs/plugin-react';
import {lstatSync, readdirSync} from 'fs';
import fsp from 'fs/promises';
import glob from 'glob';
import imagemin from 'imagemin';
import imageminPngquant from 'imagemin-pngquant';
import imageminWebp from 'imagemin-webp';
import path from 'path';
import Spritesmith from 'spritesmith';
import {defineConfig} from 'vite';

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

// https://vitejs.dev/config/
export default defineConfig(({mode}) => ({
    base: "",
    define: {
        'import.meta.env.VITE_APP_VERSION': JSON.stringify(require('./package.json').version),
    },
    resolve: {
        alias: {
            '~bootstrap': path.resolve(__dirname, 'node_modules/bootstrap'),
        }
    },
    plugins: [
        react(),
        ...get_sprite_plugins(mode)
    ]
}))
