import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {
    getStorageSnapshot,
    isStorageRecord,
    readStorageObject,
    subscribeStorage,
    updateScopedStorage,
} from '../src/lib/storage.js';

const cleanups = [];

beforeEach(() => {
    localStorage.clear();
});

afterEach(() => {
    cleanups.splice(0).forEach(cleanup => cleanup());
    vi.restoreAllMocks();
});

function watchStorage(listener) {
    const unsubscribe = subscribeStorage(listener);
    cleanups.push(unsubscribe);
    return unsubscribe;
}

describe.each(['scheme_data', 'needs_list'])('%s legacy preset storage', key => {
    it('creates, overwrites and deletes a preset while preserving other games and names', () => {
        const first = {'铁块': 60};
        const replacement = {'铁块': 120, '电路板': 30};
        const other = {'宇宙矩阵': 6};
        const modded = {'氦': 240};

        updateScopedStorage(key, 'Vanilla', current => ({...current, '主要产线': first}));
        updateScopedStorage(key, 'GenesisBook', current => ({...current, '模组产线': modded}));
        updateScopedStorage(key, 'Vanilla', current => ({...current, '研究产线': other}));
        updateScopedStorage(key, 'Vanilla', current => ({...current, '主要产线': replacement}));

        expect(readStorageObject(key)).toEqual({
            Vanilla: {'主要产线': replacement, '研究产线': other},
            GenesisBook: {'模组产线': modded},
        });
        expect(localStorage.length).toBe(1);

        updateScopedStorage(key, 'Vanilla', current => {
            delete current['主要产线'];
            return current;
        });
        expect(readStorageObject(key)).toEqual({
            Vanilla: {'研究产线': other},
            GenesisBook: {'模组产线': modded},
        });
    });

    it('does not write or erase saved scopes when reading different game snapshots', () => {
        const raw = JSON.stringify({Vanilla: {a: {'铁块': 60}}, GenesisBook: {b: {'氦': 240}}});
        localStorage.setItem(key, raw);
        const write = vi.spyOn(Storage.prototype, 'setItem');

        expect(readStorageObject(key).Vanilla).toEqual({a: {'铁块': 60}});
        expect(readStorageObject(key).GenesisBook).toEqual({b: {'氦': 240}});
        expect(getStorageSnapshot(key)).toBe(raw);
        expect(getStorageSnapshot(key)).toBe(raw);
        expect(write).not.toHaveBeenCalled();
    });

    it('rereads the latest complete map instead of writing a stale render snapshot', () => {
        localStorage.setItem(key, JSON.stringify({Vanilla: {local: {'铁块': 60}}}));
        const staleSnapshot = readStorageObject(key);
        // Another tab saves both a new preset and another mod before this action.
        localStorage.setItem(key, JSON.stringify({
            Vanilla: {...staleSnapshot.Vanilla, remote: {'铜块': 90}},
            GenesisBook: {remoteMod: {'氦': 240}},
        }));
        const updater = vi.fn(current => ({...current, local: {'铁块': 120}}));
        updateScopedStorage(key, 'Vanilla', updater);

        expect(updater).toHaveBeenCalledWith({local: {'铁块': 60}, remote: {'铜块': 90}});
        expect(readStorageObject(key)).toEqual({
            Vanilla: {local: {'铁块': 120}, remote: {'铜块': 90}},
            GenesisBook: {remoteMod: {'氦': 240}},
        });
        expect(staleSnapshot).toEqual({Vanilla: {local: {'铁块': 60}}});
    });

    it.each(['{invalid', '', '[', '{"Vanilla":'])('leaves malformed JSON %j untouched', raw => {
        localStorage.setItem(key, raw);
        const write = vi.spyOn(Storage.prototype, 'setItem');
        const updater = vi.fn(() => ({new: {'铁块': 60}}));
        const listener = vi.fn();
        watchStorage(listener);

        expect(() => readStorageObject(key)).toThrow();
        expect(() => updateScopedStorage(key, 'Vanilla', updater)).toThrow();
        expect(localStorage.getItem(key)).toBe(raw);
        expect(updater).not.toHaveBeenCalled();
        expect(write).not.toHaveBeenCalled();
        expect(listener).not.toHaveBeenCalled();
    });

    it.each([[], 123, 'wrong format', true])('refuses non-record root data %j without replacement', invalid => {
        const raw = JSON.stringify(invalid);
        localStorage.setItem(key, raw);

        expect(() => updateScopedStorage(key, 'Vanilla', () => ({new: 1}))).toThrow();
        expect(localStorage.getItem(key)).toBe(raw);
    });

    it.each([[], null, 123, 'wrong format'])('preserves an unreadable game scope %j', invalid => {
        const raw = JSON.stringify({Vanilla: invalid, GenesisBook: {keep: {'氦': 240}}});
        localStorage.setItem(key, raw);

        expect(() => updateScopedStorage(key, 'Vanilla', () => ({new: 1}))).toThrow();
        expect(localStorage.getItem(key)).toBe(raw);
    });

    it('accepts legacy null and missing collections as an empty save', () => {
        expect(readStorageObject(key)).toEqual({});
        expect(getStorageSnapshot(key)).toBeNull();
        localStorage.setItem(key, 'null');
        expect(readStorageObject(key)).toEqual({});

        updateScopedStorage(key, 'Vanilla', current => ({...current, restored: {'铁块': 60}}));
        expect(readStorageObject(key)).toEqual({Vanilla: {restored: {'铁块': 60}}});
    });

    it.each(['__proto__', 'constructor', 'toString', 'hasOwnProperty'])('stores and removes prototype-like preset name %s safely', name => {
        const value = {'铁块': 60};
        updateScopedStorage(key, 'Vanilla', current => ({...current, [name]: value}));
        updateScopedStorage(key, 'GenesisBook', current => ({...current, keep: {'氦': 240}}));

        const saved = readStorageObject(key);
        expect(Object.hasOwn(saved.Vanilla, name)).toBe(true);
        expect(saved.Vanilla[name]).toEqual(value);
        expect(Object.getPrototypeOf(saved.Vanilla)).toBe(Object.prototype);
        expect(Object.hasOwn(Object.prototype, '铁块')).toBe(false);

        updateScopedStorage(key, 'Vanilla', current => {
            delete current[name];
            return current;
        });
        expect(readStorageObject(key)).toEqual({Vanilla: {}, GenesisBook: {keep: {'氦': 240}}});
    });

    it('supports a prototype-like scope without modifying object prototypes', () => {
        updateScopedStorage(key, '__proto__', current => ({...current, custom: {'铁块': 60}}));
        const saved = readStorageObject(key);

        expect(Object.hasOwn(saved, '__proto__')).toBe(true);
        expect(saved['__proto__']).toEqual({custom: {'铁块': 60}});
        expect(Object.getPrototypeOf(saved)).toBe(Object.prototype);
        expect(Object.hasOwn(Object.prototype, 'custom')).toBe(false);
    });
});

describe('storage subscriptions and browser failures', () => {
    it('notifies same-tab subscribers once after the updated value has been persisted', () => {
        const listener = vi.fn(() => {
            expect(readStorageObject('scheme_data')).toEqual({Vanilla: {saved: {'铁块': 60}}});
        });
        watchStorage(listener);

        updateScopedStorage('scheme_data', 'Vanilla', current => ({...current, saved: {'铁块': 60}}));

        expect(listener).toHaveBeenCalledTimes(1);
        expect(listener.mock.calls[0][0].type).toBe('dsp-calc:storage');
    });

    it('listens for cross-tab storage changes and unsubscribes from both event types', () => {
        const listener = vi.fn();
        const unsubscribe = watchStorage(listener);
        window.dispatchEvent(new StorageEvent('storage', {key: 'scheme_data'}));
        window.dispatchEvent(new Event('dsp-calc:storage'));
        expect(listener).toHaveBeenCalledTimes(2);

        unsubscribe();
        window.dispatchEvent(new StorageEvent('storage', {key: 'scheme_data'}));
        window.dispatchEvent(new Event('dsp-calc:storage'));
        expect(listener).toHaveBeenCalledTimes(2);
    });

    it('uses a stable raw string snapshot and handles unavailable browser storage', () => {
        const raw = JSON.stringify({Vanilla: {saved: {'铁块': 60}}});
        localStorage.setItem('scheme_data', raw);
        expect(getStorageSnapshot('scheme_data')).toBe(raw);
        expect(getStorageSnapshot('scheme_data')).toBe(getStorageSnapshot('scheme_data'));
        vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
            throw new DOMException('Storage is blocked', 'SecurityError');
        });

        expect(getStorageSnapshot('scheme_data')).toBeNull();
        expect(() => readStorageObject('scheme_data')).toThrow('Storage is blocked');
        expect(() => updateScopedStorage('scheme_data', 'Vanilla', () => ({}))).toThrow('Storage is blocked');
    });

    it('reports a failed write without clearing saved data or emitting a success event', () => {
        const raw = JSON.stringify({Vanilla: {keep: {'铁块': 60}}});
        localStorage.setItem('scheme_data', raw);
        const listener = vi.fn();
        watchStorage(listener);
        vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
            throw new DOMException('Storage is full', 'QuotaExceededError');
        });

        expect(() => updateScopedStorage('scheme_data', 'Vanilla', current => ({...current, new: 120}))).toThrow('Storage is full');
        expect(localStorage.getItem('scheme_data')).toBe(raw);
        expect(listener).not.toHaveBeenCalled();
    });

    it.each([
        [null, false], [[], false], ['text', false], [1, false], [undefined, false],
        [{}, true], [{Vanilla: {}}, true],
    ])('recognizes storage records: %j', (value, expected) => {
        expect(isStorageRecord(value)).toBe(expected);
    });
});
