export function calculateRawFactoryNumber(amount: number, time_tick: number, output_rate: number): number {
    return amount / time_tick / output_rate;
}
