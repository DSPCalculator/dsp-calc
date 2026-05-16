import {deflateSync, inflateSync} from 'fflate';
import type {CostWeight, GameData, NumericMap, RecipeScheme, SchemeData, Settings} from '@engine/types/domain';
import {DEFAULT_SETTINGS} from './providers/default-settings';

const URL_STATE_PREFIX = 's=';
const URL_INTEGER_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ-.';

export interface CalculatorUrlState {
    m?: string;
    n?: CompactNumericMap;
    s?: Partial<Settings>;
    d?: CompactSchemeData;
}

export interface ExpandedCalculatorUrlState {
    m?: string;
    needs_list?: NumericMap;
    settings?: Partial<Settings>;
    scheme_data?: SchemeData;
}

type CompactNumericMap = Record<string, number>;
type CompactRecipeScheme = [
    building?: number | null,
    proliferator_points?: number | null,
    proliferator_mode?: number | null,
];
type BatchProMode = 0 | 1 | 2 | 3;
type CompactBatchOperation = string;

interface CompactSchemeData {
    i?: CompactNumericMap;
    b?: CompactBatchOperation[];
    r?: Record<string, CompactRecipeScheme>;
    w?: {
        a?: number;
        e?: number;
        b?: CompactNumericMap;
        x?: CostWeight['物品额外成本'];
    };
}

function build_item_index(default_scheme_data: SchemeData): {
    item_to_index: Record<string, string>;
    index_to_item: Record<string, string>;
} {
    const item_names = Object.keys(default_scheme_data.item_recipe_choices);
    const item_to_index: Record<string, string> = {};
    const index_to_item: Record<string, string> = {};
    item_names.forEach((item_name, index) => {
        const key = encode_unsigned_integer(index);
        item_to_index[item_name] = key;
        index_to_item[key] = item_name;
    });
    return {item_to_index, index_to_item};
}

function build_factory_name_index(game_data: GameData): {
    name_to_index: Record<string, string>;
    index_to_name: Record<string, string>;
} {
    const name_to_index: Record<string, string> = {};
    const index_to_name: Record<string, string> = {};
    const names: string[] = [];
    for (const factory_list of Object.values(game_data.factory_data)) {
        for (const factory of factory_list) {
            if (!names.includes(factory["名称"])) {
                names.push(factory["名称"]);
            }
        }
    }
    names.forEach((name, index) => {
        const key = encode_unsigned_integer(index);
        name_to_index[name] = key;
        index_to_name[key] = name;
    });
    return {name_to_index, index_to_name};
}

function is_plain_object(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalize_number(value: number): number {
    return Object.is(value, -0) ? 0 : value;
}

function values_equal(left: unknown, right: unknown): boolean {
    if (typeof left === 'number' && typeof right === 'number') {
        return normalize_number(left) === normalize_number(right);
    }
    if (Array.isArray(left) && Array.isArray(right)) {
        return left.length === right.length && left.every((entry, index) => values_equal(entry, right[index]));
    }
    return left === right;
}

function compact_value<T>(value: T, default_value: unknown): unknown {
    if (values_equal(value, default_value)) {
        return undefined;
    }

    if (is_plain_object(value)) {
        const default_object = is_plain_object(default_value) ? default_value : {};
        const compact_object: Record<string, unknown> = {};
        for (const [key, entry] of Object.entries(value)) {
            const compact_entry = compact_value(entry, default_object[key]);
            if (compact_entry !== undefined) {
                compact_object[key] = compact_entry;
            }
        }
        return Object.keys(compact_object).length > 0 ? compact_object : undefined;
    }

    if (Array.isArray(value)) {
        return value.length > 0 ? value : undefined;
    }

    return value;
}

function merge_compact_value<T>(default_value: T, compact: unknown): T {
    if (compact === undefined) {
        return default_value;
    }

    if (Array.isArray(default_value)) {
        if (!Array.isArray(compact)) {
            return compact as T;
        }
        const result = default_value.map((entry, index) => merge_compact_value(entry, compact[index]));
        for (let index = default_value.length; index < compact.length; index++) {
            result[index] = compact[index];
        }
        return result as T;
    }

    if (is_plain_object(default_value) && is_plain_object(compact)) {
        const result: Record<string, unknown> = {...default_value};
        for (const [key, entry] of Object.entries(compact)) {
            result[key] = merge_compact_value(result[key], entry);
        }
        return result as T;
    }

    return compact as T;
}

function is_empty_object(value: unknown): boolean {
    return is_plain_object(value) && Object.keys(value).length === 0;
}

function compact_numeric_map(
    value: NumericMap | undefined,
    default_value: NumericMap | undefined,
    item_to_index?: Record<string, string>,
): CompactNumericMap | undefined {
    if (!value) {
        return undefined;
    }

    const result: CompactNumericMap = {};
    for (const [key, amount] of Object.entries(value)) {
        if (values_equal(amount, default_value?.[key]) || amount === 0) {
            continue;
        }
        result[item_to_index?.[key] ?? key] = amount;
    }
    return Object.keys(result).length > 0 ? result : undefined;
}

function expand_numeric_map(
    value: CompactNumericMap | undefined,
    index_to_item?: Record<string, string>,
): NumericMap {
    if (!value) {
        return {};
    }

    const result: NumericMap = {};
    for (const [key, amount] of Object.entries(value)) {
        result[index_to_item?.[key] ?? key] = amount;
    }
    return result;
}

function compact_needs_list(
    needs_list: NumericMap | undefined,
    item_to_index: Record<string, string>,
): CompactNumericMap | undefined {
    if (!needs_list) {
        return undefined;
    }

    const result: CompactNumericMap = {};
    for (const [item, amount] of Object.entries(needs_list)) {
        if (amount !== 0) {
            result[item_to_index[item] ?? item] = amount;
        }
    }
    return Object.keys(result).length > 0 ? result : undefined;
}

function compact_recipe_scheme(scheme: RecipeScheme, default_scheme: RecipeScheme | undefined): CompactRecipeScheme | undefined {
    const result: CompactRecipeScheme = [];
    if (!values_equal(scheme["建筑"], default_scheme?.["建筑"])) {
        result[0] = scheme["建筑"];
    }
    if (!values_equal(scheme["增产点数"], default_scheme?.["增产点数"])) {
        result[1] = scheme["增产点数"];
    }
    if (!values_equal(scheme["增产模式"], default_scheme?.["增产模式"])) {
        result[2] = scheme["增产模式"];
    }
    while (result.length > 0 && result[result.length - 1] == null) {
        result.pop();
    }
    return result.length > 0 ? result : undefined;
}

function recipes_equal(left: RecipeScheme, right: RecipeScheme): boolean {
    return values_equal(left["建筑"], right["建筑"])
        && values_equal(left["增产点数"], right["增产点数"])
        && values_equal(left["增产模式"], right["增产模式"]);
}

function get_batch_proliferator_mode(recipe_proliferator: number, batch_mode: BatchProMode): number {
    if (batch_mode === 0) {
        return 0;
    }
    if (batch_mode === 1) {
        return recipe_proliferator & 1 ? 1 : 0;
    }
    if (batch_mode === 2) {
        return recipe_proliferator & 2 ? 2 : 0;
    }
    if (recipe_proliferator & 2) {
        return 2;
    }
    if (recipe_proliferator & 1) {
        return 1;
    }
    return 0;
}

function get_candidate_batch_proliferator_modes(recipe_proliferator: number, proliferator_mode: number): BatchProMode[] {
    return ([0, 1, 2, 3] as BatchProMode[]).filter(batch_mode => (
        get_batch_proliferator_mode(recipe_proliferator, batch_mode) === proliferator_mode
    ));
}

function apply_batch_operation(
    scheme_for_recipe: RecipeScheme[],
    game_data: GameData,
    operation: CompactBatchOperation,
): RecipeScheme[] {
    const kind = operation[0];
    const raw_value = operation.slice(1);
    const value = decode_unsigned_integer(raw_value);

    if (!Number.isFinite(value)) {
        return scheme_for_recipe;
    }

    if (kind === 'p') {
        return scheme_for_recipe.map(recipe_scheme => ({
            ...recipe_scheme,
            "增产点数": value,
        }));
    }

    if (kind === 'm') {
        if (![0, 1, 2, 3].includes(value)) {
            return scheme_for_recipe;
        }
        return scheme_for_recipe.map((recipe_scheme, index) => {
            const recipe = game_data.recipe_data[index];
            return {
                ...recipe_scheme,
                "增产模式": get_batch_proliferator_mode(recipe["增产"], value as BatchProMode),
            };
        });
    }

    if (kind === 'f') {
        const factory_name = build_factory_name_index(game_data).index_to_name[raw_value];
        if (!factory_name) {
            return scheme_for_recipe;
        }
        return scheme_for_recipe.map((recipe_scheme, index) => {
            const facility = game_data.recipe_data[index]["设施"];
            const factory_list = game_data.factory_data[facility] || [];
            const building_index = factory_list.findIndex(factory => factory["名称"] === factory_name);
            if (building_index < 0) {
                return recipe_scheme;
            }
            return {
                ...recipe_scheme,
                "建筑": building_index,
            };
        });
    }

    return scheme_for_recipe;
}

function apply_batch_operations(
    default_scheme_data: SchemeData,
    game_data: GameData,
    operations: CompactBatchOperation[] | undefined,
): RecipeScheme[] {
    return (operations || []).reduce(
        (scheme_for_recipe, operation) => apply_batch_operation(scheme_for_recipe, game_data, operation),
        default_scheme_data.scheme_for_recipe,
    );
}

function build_batch_candidate(
    scheme_data: SchemeData,
    default_scheme_data: SchemeData,
    game_data: GameData,
    batch_operations: CompactBatchOperation[],
): {
    batch_operations?: CompactBatchOperation[];
    recipe_scheme_by_index: Record<string, CompactRecipeScheme>;
} {
    const baseline_scheme_for_recipe = apply_batch_operations(default_scheme_data, game_data, batch_operations);
    const recipe_scheme_by_index: Record<string, CompactRecipeScheme> = {};
    scheme_data.scheme_for_recipe.forEach((recipe_scheme, index) => {
        const compact_recipe = compact_recipe_scheme(recipe_scheme, baseline_scheme_for_recipe[index]);
        if (compact_recipe) {
            recipe_scheme_by_index[encode_unsigned_integer(index)] = compact_recipe;
        }
    });
    return {
        batch_operations: batch_operations.length > 0 ? batch_operations : undefined,
        recipe_scheme_by_index,
    };
}

function compact_recipe_schemes(
    scheme_data: SchemeData,
    default_scheme_data: SchemeData,
    game_data: GameData,
): {batch_operations?: CompactBatchOperation[]; recipe_scheme_by_index: Record<string, CompactRecipeScheme>} {
    const direct_recipe_scheme_by_index: Record<string, CompactRecipeScheme> = {};
    scheme_data.scheme_for_recipe.forEach((recipe_scheme, index) => {
        const compact_recipe = compact_recipe_scheme(recipe_scheme, default_scheme_data.scheme_for_recipe[index]);
        if (compact_recipe) {
            direct_recipe_scheme_by_index[encode_unsigned_integer(index)] = compact_recipe;
        }
    });

    const candidate_operations: CompactBatchOperation[] = [];
    const candidate_keys = new Set<string>();
    const {name_to_index} = build_factory_name_index(game_data);
    const add_candidate_operation = (operation: CompactBatchOperation | undefined): void => {
        if (!operation || candidate_keys.has(operation)) {
            return;
        }
        candidate_keys.add(operation);
        candidate_operations.push(operation);
    };

    scheme_data.scheme_for_recipe.forEach((recipe_scheme, index) => {
        if (!recipes_equal(recipe_scheme, default_scheme_data.scheme_for_recipe[index])) {
            add_candidate_operation(`p${encode_unsigned_integer(recipe_scheme["增产点数"])}`);
            get_candidate_batch_proliferator_modes(
                game_data.recipe_data[index]["增产"],
                recipe_scheme["增产模式"],
            ).forEach(batch_mode => {
                add_candidate_operation(`m${encode_unsigned_integer(batch_mode)}`);
            });

            const facility = game_data.recipe_data[index]["设施"];
            const factory_name = game_data.factory_data[facility]?.[recipe_scheme["建筑"]]?.["名称"];
            add_candidate_operation(factory_name ? `f${name_to_index[factory_name]}` : undefined);
        }
    });

    let best: {
        batch_operations?: CompactBatchOperation[];
        recipe_scheme_by_index: Record<string, CompactRecipeScheme>;
    } = {recipe_scheme_by_index: direct_recipe_scheme_by_index};
    let best_length = encoded_recipe_scheme_parts_length(best.batch_operations, best.recipe_scheme_by_index);

    let improved = true;
    while (improved) {
        improved = false;
        let round_best = best;
        let round_best_length = best_length;
        for (const operation of candidate_operations) {
            if (best.batch_operations?.includes(operation)) {
                continue;
            }
            const operations = [...(best.batch_operations || []), operation];
            const next = build_batch_candidate(scheme_data, default_scheme_data, game_data, operations);
            const next_length = encoded_recipe_scheme_parts_length(next.batch_operations, next.recipe_scheme_by_index);
            if (next_length < round_best_length) {
                round_best = next;
                round_best_length = next_length;
            }
        }
        if (round_best_length < best_length) {
            best = round_best;
            best_length = round_best_length;
            improved = true;
        }
    }

    return best;
}

function compact_scheme_data(scheme_data: SchemeData, default_scheme_data: SchemeData, game_data: GameData): CompactSchemeData | undefined {
    const result: CompactSchemeData = {};
    const {item_to_index} = build_item_index(default_scheme_data);
    const item_recipe_choices = compact_numeric_map(
        scheme_data.item_recipe_choices,
        default_scheme_data.item_recipe_choices,
        item_to_index,
    );
    const building_cost = compact_numeric_map(
        scheme_data.cost_weight.建筑成本,
        default_scheme_data.cost_weight.建筑成本,
        item_to_index,
    );
    const item_extra_cost = compact_value(
        scheme_data.cost_weight.物品额外成本,
        default_scheme_data.cost_weight.物品额外成本,
    ) as CostWeight['物品额外成本'] | undefined;
    const {batch_operations, recipe_scheme_by_index} = compact_recipe_schemes(scheme_data, default_scheme_data, game_data);

    if (item_recipe_choices && !is_empty_object(item_recipe_choices)) {
        result.i = item_recipe_choices;
    }
    if (batch_operations) {
        result.b = batch_operations;
    }
    if (Object.keys(recipe_scheme_by_index).length > 0) {
        result.r = recipe_scheme_by_index;
    }
    if (
        !values_equal(scheme_data.cost_weight.占地, default_scheme_data.cost_weight.占地)
        || !values_equal(scheme_data.cost_weight.电力, default_scheme_data.cost_weight.电力)
        || (building_cost && !is_empty_object(building_cost))
        || (item_extra_cost && !is_empty_object(item_extra_cost))
    ) {
        result.w = {};
        if (!values_equal(scheme_data.cost_weight.占地, default_scheme_data.cost_weight.占地)) {
            result.w.a = scheme_data.cost_weight.占地;
        }
        if (!values_equal(scheme_data.cost_weight.电力, default_scheme_data.cost_weight.电力)) {
            result.w.e = scheme_data.cost_weight.电力;
        }
        if (building_cost && !is_empty_object(building_cost)) {
            result.w.b = building_cost;
        }
        if (item_extra_cost && !is_empty_object(item_extra_cost)) {
            result.w.x = item_extra_cost;
        }
    }

    return is_empty_object(result) ? undefined : result;
}

function expand_recipe_scheme(default_recipe_scheme: RecipeScheme, compact: CompactRecipeScheme | undefined): RecipeScheme {
    if (!compact) {
        return default_recipe_scheme;
    }
    return {
        "建筑": compact[0] ?? default_recipe_scheme["建筑"],
        "增产点数": compact[1] ?? default_recipe_scheme["增产点数"],
        "增产模式": compact[2] ?? default_recipe_scheme["增产模式"],
    };
}

function expand_scheme_data(scheme_data: CompactSchemeData, default_scheme_data: SchemeData, game_data: GameData): SchemeData {
    const {index_to_item} = build_item_index(default_scheme_data);
    const baseline_scheme_for_recipe = apply_batch_operations(default_scheme_data, game_data, scheme_data.b);
    const scheme_for_recipe = baseline_scheme_for_recipe.map((recipe_scheme, index) => (
        expand_recipe_scheme(recipe_scheme, scheme_data.r?.[encode_unsigned_integer(index)])
    ));
    const item_recipe_choices = expand_numeric_map(scheme_data.i, index_to_item);
    const building_cost = expand_numeric_map(scheme_data.w?.b, index_to_item);

    return {
        item_recipe_choices: {
            ...default_scheme_data.item_recipe_choices,
            ...item_recipe_choices,
        },
        scheme_for_recipe,
        cost_weight: {
            占地: scheme_data.w?.a ?? default_scheme_data.cost_weight.占地,
            电力: scheme_data.w?.e ?? default_scheme_data.cost_weight.电力,
            建筑成本: {
                ...default_scheme_data.cost_weight.建筑成本,
                ...building_cost,
            },
            物品额外成本: merge_compact_value(
                default_scheme_data.cost_weight.物品额外成本,
                scheme_data.w?.x,
            ),
        },
    };
}

export function compactCalculatorUrlState(
    state: {
        mod_selection?: string;
        needs_list?: NumericMap;
        settings?: Partial<Settings>;
        scheme_data?: SchemeData;
    },
    default_scheme_data: SchemeData,
    game_data: GameData,
    default_settings: Settings = DEFAULT_SETTINGS,
): CalculatorUrlState | undefined {
    const next_state: CalculatorUrlState = {};
    const {item_to_index} = build_item_index(default_scheme_data);
    const compact_needs = compact_needs_list(state.needs_list, item_to_index);
    const compact_settings = compact_value(state.settings || {}, default_settings) as Partial<Settings> | undefined;
    const compact_scheme = state.scheme_data
        ? compact_scheme_data(state.scheme_data, default_scheme_data, game_data)
        : undefined;

    if (state.mod_selection) {
        next_state.m = state.mod_selection;
    }
    if (compact_needs) {
        next_state.n = compact_needs;
    }
    if (compact_settings && !is_empty_object(compact_settings)) {
        next_state.s = compact_settings;
    }
    if (compact_scheme && !is_empty_object(compact_scheme)) {
        next_state.d = compact_scheme;
    }

    return next_state.m || next_state.n || next_state.s || next_state.d ? next_state : undefined;
}

export function expandCalculatorUrlState(
    state: CalculatorUrlState | undefined,
    default_scheme_data: SchemeData,
    game_data: GameData,
): ExpandedCalculatorUrlState | undefined {
    if (!state) {
        return undefined;
    }

    return {
        m: state.m,
        needs_list: expand_numeric_map(state.n, build_item_index(default_scheme_data).index_to_item),
        settings: state.s,
        scheme_data: state.d ? expand_scheme_data(state.d, default_scheme_data, game_data) : undefined,
    };
}

function encode_number_map(value: CompactNumericMap | undefined): string | undefined {
    if (!value || Object.keys(value).length === 0) {
        return undefined;
    }
    return Object.entries(value).map(([key, amount]) => `${key}:${encode_numeric_value(amount)}`).join(',');
}

function decode_number_map(encoded: string | undefined): CompactNumericMap | undefined {
    if (!encoded) {
        return undefined;
    }
    const result: CompactNumericMap = {};
    for (const entry of encoded.split(',')) {
        if (!entry) {
            continue;
        }
        const [key, raw_amount] = entry.split(':');
        const amount = decode_numeric_value(raw_amount);
        if (key && Number.isFinite(amount)) {
            result[key] = amount;
        }
    }
    return Object.keys(result).length > 0 ? result : undefined;
}

function encode_numeric_value(value: number): string {
    if (Number.isSafeInteger(value) && value >= 0) {
        return encode_unsigned_integer(value);
    }
    return `_${value}`;
}

function decode_numeric_value(encoded: string | undefined): number {
    if (!encoded) {
        return NaN;
    }
    if (encoded.startsWith('_')) {
        return Number(encoded.slice(1));
    }
    return decode_unsigned_integer(encoded);
}

function encode_recipe_scheme(value: CompactRecipeScheme | undefined): string | undefined {
    if (!value || value.length === 0) {
        return undefined;
    }
    return value.map(entry => entry == null ? '' : encode_unsigned_integer(entry)).join(':');
}

function encode_batch_operations(value: CompactBatchOperation[] | undefined): string | undefined {
    if (!value || value.length === 0) {
        return undefined;
    }
    return value.join('+');
}

function decode_batch_operations(encoded: string | undefined): CompactBatchOperation[] | undefined {
    if (!encoded) {
        return undefined;
    }
    const operations = encoded.split('+').filter(Boolean);
    return operations.length > 0 ? operations : undefined;
}

function decode_recipe_scheme(encoded: string | undefined): CompactRecipeScheme | undefined {
    if (!encoded) {
        return undefined;
    }
    const result: CompactRecipeScheme = [];
    encoded.split(':').forEach((raw_value, index) => {
        if (raw_value !== '') {
            const value = decode_unsigned_integer(raw_value);
            if (Number.isFinite(value)) {
                result[index] = value;
            }
        }
    });
    return result.length > 0 ? result : undefined;
}

function encode_unsigned_integer(value: number): string {
    if (!Number.isSafeInteger(value) || value < 0) {
        return String(value);
    }
    if (value === 0) {
        return URL_INTEGER_ALPHABET[0];
    }

    let remaining = value;
    let result = '';
    while (remaining > 0) {
        result = URL_INTEGER_ALPHABET[remaining % URL_INTEGER_ALPHABET.length] + result;
        remaining = Math.floor(remaining / URL_INTEGER_ALPHABET.length);
    }
    return result;
}

function decode_unsigned_integer(encoded: string | undefined): number {
    if (!encoded) {
        return NaN;
    }

    let result = 0;
    for (const char of encoded) {
        const digit = URL_INTEGER_ALPHABET.indexOf(char);
        if (digit < 0) {
            return NaN;
        }
        result = result * URL_INTEGER_ALPHABET.length + digit;
    }
    return result;
}

function encode_recipe_schemes(value: Record<string, CompactRecipeScheme> | undefined): string | undefined {
    if (!value || Object.keys(value).length === 0) {
        return undefined;
    }
    const flat = Object.entries(value).map(([recipe_index, scheme]) => (
        `${recipe_index}:${encode_recipe_scheme(scheme) || ''}`
    )).join(',');
    const recipe_indices_by_scheme: Record<string, string[]> = {};
    for (const [recipe_index, scheme] of Object.entries(value)) {
        const encoded_scheme = encode_recipe_scheme(scheme);
        if (!encoded_scheme) {
            continue;
        }
        recipe_indices_by_scheme[encoded_scheme] = recipe_indices_by_scheme[encoded_scheme] || [];
        recipe_indices_by_scheme[encoded_scheme].push(recipe_index);
    }
    const grouped = Object.entries(recipe_indices_by_scheme).map(([scheme, recipe_indices]) => (
        `${scheme}@${recipe_indices.join('+')}`
    )).join(',');
    return grouped.length < flat.length ? grouped : flat;
}

function encoded_recipe_scheme_parts_length(
    batch_operations: CompactBatchOperation[] | undefined,
    recipe_schemes: Record<string, CompactRecipeScheme> | undefined,
): number {
    const segments: string[] = [];
    const baseline_segment = encode_batch_operations(batch_operations);
    const recipe_schemes_segment = encode_recipe_schemes(recipe_schemes);
    if (baseline_segment) {
        segments.push(`b${baseline_segment}`);
    }
    if (recipe_schemes_segment) {
        segments.push(`r${recipe_schemes_segment}`);
    }
    return segments.join('~').length;
}

function decode_recipe_schemes(encoded: string | undefined): Record<string, CompactRecipeScheme> | undefined {
    if (!encoded) {
        return undefined;
    }
    const result: Record<string, CompactRecipeScheme> = {};
    for (const entry of encoded.split(',')) {
        if (!entry) {
            continue;
        }
        const group_separator_index = entry.indexOf('@');
        if (group_separator_index >= 0) {
            const scheme = decode_recipe_scheme(entry.slice(0, group_separator_index));
            if (scheme) {
                entry.slice(group_separator_index + 1).split('+').forEach(recipe_index => {
                    if (recipe_index) {
                        result[recipe_index] = [...scheme];
                    }
                });
            }
            continue;
        }

        const [recipe_index, building, proliferator_points, proliferator_mode] = entry.split(':');
        if (!recipe_index) {
            continue;
        }
        const scheme: CompactRecipeScheme = [];
        [building, proliferator_points, proliferator_mode].forEach((raw_value, index) => {
            if (raw_value !== undefined && raw_value !== '') {
                const value = decode_unsigned_integer(raw_value);
                if (Number.isFinite(value)) {
                    scheme[index] = value;
                }
            }
        });
        if (scheme.length > 0) {
            result[recipe_index] = scheme;
        }
    }
    return Object.keys(result).length > 0 ? result : undefined;
}

function encode_json_segment(value: unknown): string | undefined {
    if (value === undefined || (is_plain_object(value) && Object.keys(value).length === 0)) {
        return undefined;
    }
    return encodeURIComponent(JSON.stringify(value));
}

function decode_json_segment<T>(encoded: string | undefined): T | undefined {
    if (!encoded) {
        return undefined;
    }
    try {
        return JSON.parse(decodeURIComponent(encoded)) as T;
    } catch {
        return undefined;
    }
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

function encode_semantic_url_state(state: CalculatorUrlState): string {
    const segments: string[] = [];
    if (state.m) {
        segments.push(`m${state.m}`);
    }
    const needs = encode_number_map(state.n);
    if (needs) {
        segments.push(`n${needs}`);
    }
    const settings = encode_json_segment(state.s);
    if (settings) {
        segments.push(`s${settings}`);
    }
    const item_recipe_choices = encode_number_map(state.d?.i);
    if (item_recipe_choices) {
        segments.push(`i${item_recipe_choices}`);
    }
    const recipe_baseline = encode_batch_operations(state.d?.b);
    if (recipe_baseline) {
        segments.push(`b${recipe_baseline}`);
    }
    const recipe_schemes = encode_recipe_schemes(state.d?.r);
    if (recipe_schemes) {
        segments.push(`r${recipe_schemes}`);
    }
    const cost_weight = encode_json_segment(state.d?.w);
    if (cost_weight) {
        segments.push(`w${cost_weight}`);
    }
    return segments.join('~');
}

function decode_semantic_url_state(encoded: string): CalculatorUrlState | undefined {
    const state: CalculatorUrlState = {};
    for (const segment of encoded.split('~')) {
        if (segment.length < 2) {
            continue;
        }
        const key = segment[0];
        const value = segment.slice(1);
        if (key === 'm') {
            state.m = value;
        } else if (key === 'n') {
            state.n = decode_number_map(value);
        } else if (key === 's') {
            state.s = decode_json_segment<Partial<Settings>>(value);
        } else if (key === 'i') {
            state.d = state.d || {};
            state.d.i = decode_number_map(value);
        } else if (key === 'b') {
            state.d = state.d || {};
            state.d.b = decode_batch_operations(value);
        } else if (key === 'r') {
            state.d = state.d || {};
            state.d.r = decode_recipe_schemes(value);
        } else if (key === 'w') {
            state.d = state.d || {};
            state.d.w = decode_json_segment<CompactSchemeData['w']>(value);
        }
    }
    if (!state.m && !state.n && !state.s && !state.d) {
        return undefined;
    }
    return state;
}

function encode_compressed_url_state(semantic_state: string): string {
    const bytes = new TextEncoder().encode(semantic_state);
    return `z${bytes_to_base64_url(deflateSync(bytes, {level: 9}))}`;
}

function decode_compressed_url_state(encoded: string): CalculatorUrlState | undefined {
    try {
        const compressed = base64_url_to_bytes(encoded.slice(1));
        const semantic_state = new TextDecoder().decode(inflateSync(compressed));
        return decode_semantic_url_state(semantic_state);
    } catch {
        return undefined;
    }
}

export function encodeCalculatorUrlState(state: CalculatorUrlState): string {
    const semantic = encode_semantic_url_state(state);
    const compressed = encode_compressed_url_state(semantic);
    return compressed.length < semantic.length ? compressed : semantic;
}

export function decodeCalculatorUrlState(encoded: string): CalculatorUrlState | undefined {
    if (encoded.startsWith('z')) {
        return decode_compressed_url_state(encoded);
    }
    if (encoded.startsWith('u')) {
        return decode_semantic_url_state(encoded.slice(1));
    }
    return decode_semantic_url_state(encoded);
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

export function writeCalculatorUrlState(state: CalculatorUrlState | undefined): void {
    if (typeof window === 'undefined') {
        return;
    }
    if (!state) {
        clearCalculatorUrlState();
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
