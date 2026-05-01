import type {NumericMap, SchemeData, Settings} from '@engine/types/domain';

const URL_STATE_PREFIX = 'state=';

export interface CalculatorUrlState {
    version: 1;
    needs_list?: NumericMap;
    settings?: Partial<Settings>;
    scheme_data?: SchemeData;
}

function bytes_to_base64_url(bytes: Uint8Array): string {
    let binary = '';
    const chunk_size = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk_size) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunk_size));
    }
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64_url_to_bytes(encoded: string): Uint8Array {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

export function encodeCalculatorUrlState(state: CalculatorUrlState): string {
    const json = JSON.stringify(state);
    return bytes_to_base64_url(new TextEncoder().encode(json));
}

export function decodeCalculatorUrlState(encoded: string): CalculatorUrlState | undefined {
    try {
        const json = new TextDecoder().decode(base64_url_to_bytes(encoded));
        const state = JSON.parse(json) as Partial<CalculatorUrlState>;
        if (state.version !== 1) {
            return undefined;
        }
        return state as CalculatorUrlState;
    } catch {
        return undefined;
    }
}

export function readCalculatorUrlState(): CalculatorUrlState | undefined {
    if (typeof window === 'undefined') {
        return undefined;
    }
    const hash = window.location.hash.startsWith('#')
        ? window.location.hash.slice(1)
        : window.location.hash;
    if (!hash.startsWith(URL_STATE_PREFIX)) {
        return undefined;
    }
    return decodeCalculatorUrlState(hash.slice(URL_STATE_PREFIX.length));
}

export function writeCalculatorUrlState(state: CalculatorUrlState): void {
    if (typeof window === 'undefined') {
        return;
    }
    const next_hash = `#${URL_STATE_PREFIX}${encodeCalculatorUrlState(state)}`;
    if (window.location.hash === next_hash) {
        return;
    }
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}${next_hash}`);
}

export function clearCalculatorUrlState(): void {
    if (typeof window === 'undefined') {
        return;
    }
    window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
}
