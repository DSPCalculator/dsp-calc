import {useEffect, useSyncExternalStore} from 'react';

const registryLoaders = {
    Vanilla: () => import('./registries/Vanilla.js'),
    MoreMegaStructure: () => import('./registries/MoreMegaStructure.js'),
    TheyComeFromVoid: () => import('./registries/TheyComeFromVoid.js'),
    GenesisBook: () => import('./registries/GenesisBook.js'),
    OrbitalRing: () => import('./registries/OrbitalRing.js'),
    FractionateEverything: () => import('./registries/FractionateEverything.js'),
};

const loadedRegistries = {};
const loadingRegistries = {};
const failedRegistries = {};
const listeners = new Set();
let registryVersion = 0;

function notifyRegistryChange() {
    registryVersion += 1;
    listeners.forEach(listener => listener());
}

function subscribeRegistry(listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

function getRegistrySnapshot() {
    return registryVersion;
}

function normalizeMods(mods) {
    if (!mods.includes('Vanilla')) {
        return ['Vanilla', ...mods];
    }
    return mods;
}

function ensureRegistryLoaded(modName) {
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

export function preloadIconRegistries(mods) {
    return Promise.all(normalizeMods(mods).map(ensureRegistryLoaded));
}

export function areIconRegistriesReady(mods) {
    return normalizeMods(mods).every(modName => modName in loadedRegistries || modName in failedRegistries);
}

export function areIconRegistriesLoading(mods) {
    return normalizeMods(mods).some(modName => !(modName in loadedRegistries) && !(modName in failedRegistries));
}

export function getLoadedIconUrl(icon, mods) {
    const normalizedMods = normalizeMods(mods);
    for (let i = normalizedMods.length - 1; i >= 0; i--) {
        const url = loadedRegistries[normalizedMods[i]]?.[icon];
        if (url) {
            return url;
        }
    }
    return null;
}

export function useIconRegistries(mods) {
    useSyncExternalStore(subscribeRegistry, getRegistrySnapshot, getRegistrySnapshot);
    const normalizedModsKey = normalizeMods(mods).join('|');

    useEffect(() => {
        preloadIconRegistries(normalizedModsKey ? normalizedModsKey.split('|') : []);
    }, [normalizedModsKey]);
}
