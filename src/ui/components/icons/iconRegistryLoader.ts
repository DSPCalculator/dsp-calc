import {useEffect, useSyncExternalStore} from 'react';

type IconRegistry = Record<string, string>;
type RegistryLoader = () => Promise<{default?: IconRegistry}>;

const registryLoaders: Record<string, RegistryLoader> = {
    Vanilla: () => import('./registries/Vanilla'),
    MoreMegaStructure: () => import('./registries/MoreMegaStructure'),
    TheyComeFromVoid: () => import('./registries/TheyComeFromVoid'),
    GenesisBook: () => import('./registries/GenesisBook'),
    OrbitalRing: () => import('./registries/OrbitalRing'),
    FractionateEverything: () => import('./registries/FractionateEverything'),
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

export function getLoadedIconUrl(icon: string | undefined, mods: string[]): string | null {
    if (!icon) {
        return null;
    }
    const normalizedMods = normalizeMods(mods);
    for (let i = normalizedMods.length - 1; i >= 0; i--) {
        const url = loadedRegistries[normalizedMods[i]]?.[icon];
        if (url) {
            return url;
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
