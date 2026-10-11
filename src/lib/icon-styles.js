export function createIconStyles(assets, base) {
    return Object.entries(assets).map(([mod, {png, webp}]) => `
.icon-${mod} {
    vertical-align: middle;
    display: inline-block;
    flex-shrink: 0;
    background-image: url('${base}${png}');
    background-image: image-set(url('${base}${webp}') type("image/webp"), url('${base}${png}') type("image/png"));
}`).join('\n');
}
