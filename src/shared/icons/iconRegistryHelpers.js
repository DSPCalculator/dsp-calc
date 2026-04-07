export function groupIconUrls(icon_modules) {
    return Object.entries(icon_modules).reduce((groups, [modulePath, url]) => {
        const match = modulePath.match(/icon\/([^/]+)\/(.+)\.png$/);
        if (!match) {
            return groups;
        }

        const [, modName, iconName] = match;
        if (!(modName in groups)) {
            groups[modName] = {};
        }
        groups[modName][iconName] = url;
        return groups;
    }, {});
}
