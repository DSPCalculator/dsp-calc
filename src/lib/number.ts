export function roundToFixed(value: number, digits: number): number {
    const factor = 10 ** digits;
    return Math.round((value + Number.EPSILON) * factor) / factor;
}

export function ceilFromDisplayed(value: number, digits: number): number {
    return Math.ceil(roundToFixed(value, digits));
}
