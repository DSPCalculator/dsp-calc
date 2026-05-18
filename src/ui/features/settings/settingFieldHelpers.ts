export function normalizeIntValue(raw_value: string | number, fallback_value: number, min_value: number, max_value = Infinity): number {
    return Math.min(Math.max(parseInt(String(raw_value), 10) || fallback_value, min_value), max_value);
}

export function normalizeFloatValue(raw_value: string | number, fallback_value: number, min_value: number, max_value = Infinity): number {
    const value = Math.min(Math.max(parseFloat(String(raw_value)) || fallback_value, min_value), max_value);
    return Math.round(value * 10000) / 10000;
}

export function normalizePercentValue(raw_value: string | number, fallback_value: number, min_value: number, max_value = Infinity): number {
    return Math.min(Math.max(parseInt(String(raw_value), 10) || fallback_value, min_value), max_value);
}
