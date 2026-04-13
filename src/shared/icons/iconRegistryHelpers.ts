export type IconRegistryGroups = Record<string, Record<string, string>>;

export function groupIconUrls(icon_modules: Record<string, unknown>): IconRegistryGroups {
    return Object.entries(icon_modules).reduce<IconRegistryGroups>((groups, [modulePath, url]) => {
        const match = modulePath.match(/icon\/([^/]+)\/(.+)\.png$/);
        if (!match) {
            return groups;
        }

        const [, modName, iconName] = match;
        if (!(modName in groups)) {
            groups[modName] = {};
        }
        groups[modName][iconName] = String(url);
        return groups;
    }, {});
}
