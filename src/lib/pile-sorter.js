/** -1 = ordinary sorters; 0 = unlocked pile sorter; 1–6 = researched upgrades. */
export const PILE_SORTER_LEVELS = Object.freeze([-1, 0, 1, 2, 3, 4, 5, 6]);
export function isPileSorterLevel(value) {
    return Number.isInteger(value) && PILE_SORTER_LEVELS.includes(value);
}
export function pileSorterLevel(scheme) {
    if (Object.hasOwn(scheme, 'pile_sorter_level')) return isPileSorterLevel(scheme.pile_sorter_level) ? scheme.pile_sorter_level : -1;
    return scheme.use_pile_sorter === true ? 6 : -1;
}
export function migratePileSorter(scheme) {
    if (!scheme || typeof scheme !== 'object' || Array.isArray(scheme)) return scheme;
    return Object.hasOwn(scheme, 'pile_sorter_level') ? scheme : {...scheme, pile_sorter_level: pileSorterLevel(scheme)};
}
export function pileSorterLabel(level) {
    if (level === -1) return '无集装';
    if (level === 0) return '集装分拣器（基础）';
    return `集装改良 ${level}${level === 6 ? '（满级）' : ' 级'}`;
}

// Research alternates output stack height and carrying capacity.
// https://wikiwiki.jp/dsp/性能強化#Pile-Sorter-Upgrade
export const PILE_SORTER_RESEARCH = Object.freeze([
    [2, 1], [2, 2], [3, 2], [3, 3], [4, 3], [4, 4], [4, 4],
].map(([carryingCapacity, stackHeight], level) => Object.freeze({level, carryingCapacity, stackHeight,
    simultaneous: level === 6,
})));
