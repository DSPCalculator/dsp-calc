import {useEffect, useSyncExternalStore} from 'react';

export interface IconSpriteEntry {
    x: number;
    y: number;
    width: number;
    height: number;
    total_width: number;
    total_height: number;
}

export interface IconSpriteReference {
    modName: string;
    entry: IconSpriteEntry;
}

type IconRegistry = Record<string, IconSpriteEntry>;
type RegistryLoader = () => Promise<{default?: IconRegistry}>;

const registryLoaders: Record<string, RegistryLoader> = {
    Vanilla: () => import('./sprites/Vanilla.json'),
    MoreMegaStructure: () => import('./sprites/MoreMegaStructure.json'),
    TheyComeFromVoid: () => import('./sprites/TheyComeFromVoid.json'),
    GenesisBook: () => import('./sprites/GenesisBook.json'),
    OrbitalRing: () => import('./sprites/OrbitalRing.json'),
    FractionateEverything: () => import('./sprites/FractionateEverything.json'),
};

const loadedRegistries: Record<string, IconRegistry> = {};
const loadingRegistries: Partial<Record<string, Promise<IconRegistry>>> = {};
const failedRegistries: Record<string, boolean> = {};
const listeners = new Set<() => void>();
let registryVersion = 0;

function notifyRegistryChange() {
    registryVersion += 1;
    listeners.forEach(listener => listener());
}

function subscribeRegistry(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getRegistrySnapshot() {
    return registryVersion;
}

function normalizeMods(mods: string[]): string[] {
    if (!mods.includes('Vanilla')) {
        return ['Vanilla', ...mods];
    }
    return mods;
}

function ensureRegistryLoaded(modName: string): Promise<IconRegistry> {
    if (loadedRegistries[modName]) {
        return Promise.resolve(loadedRegistries[modName]);
    }
    if (loadingRegistries[modName]) {
        return loadingRegistries[modName];
    }

    const loadRegistry = registryLoaders[modName];
    if (!loadRegistry) {
        loadedRegistries[modName] = {};
        return Promise.resolve(loadedRegistries[modName]);
    }

    loadingRegistries[modName] = loadRegistry().then((module) => {
        loadedRegistries[modName] = module.default || {};
        delete loadingRegistries[modName];
        notifyRegistryChange();
        return loadedRegistries[modName];
    }).catch(() => {
        failedRegistries[modName] = true;
        loadedRegistries[modName] = {};
        delete loadingRegistries[modName];
        notifyRegistryChange();
        return loadedRegistries[modName];
    });

    return loadingRegistries[modName];
}

export function preloadIconRegistries(mods: string[]): Promise<IconRegistry[]> {
    return Promise.all(normalizeMods(mods).map(ensureRegistryLoaded));
}

export function areIconRegistriesReady(mods: string[]): boolean {
    return normalizeMods(mods).every(modName => modName in loadedRegistries || modName in failedRegistries);
}

export function areIconRegistriesLoading(mods: string[]): boolean {
    return normalizeMods(mods).some(modName => !(modName in loadedRegistries) && !(modName in failedRegistries));
}

export function getLoadedIconSprite(icon: string | undefined, mods: string[]): IconSpriteReference | null {
    if (!icon) {
        return null;
    }
    const normalizedMods = normalizeMods(mods);
    for (let i = normalizedMods.length - 1; i >= 0; i--) {
        const modName = normalizedMods[i];
        const entry = loadedRegistries[modName]?.[icon];
        if (entry) {
            return {modName, entry};
        }
    }
    return null;
}

export function useIconRegistries(mods: string[]): void {
    useSyncExternalStore(subscribeRegistry, getRegistrySnapshot, getRegistrySnapshot);
    const normalizedModsKey = normalizeMods(mods).join('|');

    useEffect(() => {
        preloadIconRegistries(normalizedModsKey ? normalizedModsKey.split('|') : []);
    }, [normalizedModsKey]);
}
