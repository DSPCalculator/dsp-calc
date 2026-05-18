export function calculateLowFootprintModeCost({
                                                  material_cost,
                                                  facility_cost,
                                                  spray_cost,
                                                  output_multiplier,
                                                  speed_multiplier,
                                                  mode,
                                              }: {
    material_cost: number;
    facility_cost: number;
    spray_cost: number;
    output_multiplier: number;
    speed_multiplier: number;
    mode: 1 | 2;
}): number {
    if (mode === 1) {
        return material_cost + facility_cost / speed_multiplier + spray_cost;
    }
    return (material_cost + facility_cost + spray_cost) / output_multiplier;
}
