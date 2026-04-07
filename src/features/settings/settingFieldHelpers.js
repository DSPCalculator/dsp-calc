export function normalizeIntValue(raw_value, fallback_value, min_value) {
    return Math.max(parseInt(raw_value) || fallback_value, min_value);
}

export function normalizeFloatValue(raw_value, fallback_value, min_value) {
    let value = Math.max(parseFloat(raw_value) || fallback_value, min_value);
    return Math.round(value * 10000) / 10000;
}

export function normalizePercentValue(raw_value, fallback_value, min_value) {
    return Math.max(parseInt(raw_value) || fallback_value, min_value);
}
