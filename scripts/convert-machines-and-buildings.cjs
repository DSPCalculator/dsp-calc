const fs = require('fs');
const path = require('path');

const DEFAULT_WINDOWS_INPUT = 'D:\\Downloads\\machines_and_buildings(建筑及配方数据).json';
const DEFAULT_WSL_INPUT = '/mnt/d/Downloads/machines_and_buildings(建筑及配方数据).json';
const DEFAULT_OUTPUT = 'src/engine/data/raw/MachinesAndBuildings0.8.2.0.json';
const PRODUCT_ID_START = 100000;
const FACTORY_ID_START = 200000;
const ICON_GRID_COLUMNS = 14;
const ICON_GRID_ROWS_PER_PAGE = 8;

function readJson(filePath) {
    return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function normalizePathForCurrentPlatform(filePath) {
    if (process.platform !== 'win32') {
        const drivePathMatch = /^([a-zA-Z]):[\\/](.*)$/.exec(filePath);
        if (drivePathMatch) {
            const [, drive, rest] = drivePathMatch;
            return `/mnt/${drive.toLowerCase()}/${rest.replace(/\\/g, '/')}`;
        }
    }

    if (process.platform === 'win32') {
        const wslPathMatch = /^\/mnt\/([a-zA-Z])\/(.*)$/.exec(filePath);
        if (wslPathMatch) {
            const [, drive, rest] = wslPathMatch;
            return `${drive.toUpperCase()}:\\${rest.replace(/\//g, '\\')}`;
        }
    }

    return filePath;
}

function resolveInputPath(filePath) {
    return path.resolve(normalizePathForCurrentPlatform(filePath));
}

function writeJson(filePath, data) {
    fs.mkdirSync(path.dirname(filePath), {recursive: true});
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
}

function requireArray(value, label) {
    if (!Array.isArray(value)) {
        throw new Error(`${label} must be an array`);
    }
    return value;
}

function requireFiniteNumber(value, label) {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
        throw new Error(`${label} must be a finite number`);
    }
    return value;
}

function requireString(value, label) {
    if (typeof value !== 'string' || value.length === 0) {
        throw new Error(`${label} must be a non-empty string`);
    }
    return value;
}

function slugifyIconName(name) {
    const slug = name
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    return slug || 'unknown';
}

function getGridIndex(index) {
    const col = index % ICON_GRID_COLUMNS + 1;
    const row = Math.floor(index / ICON_GRID_COLUMNS) % ICON_GRID_ROWS_PER_PAGE + 1;
    const page = Math.floor(index / (ICON_GRID_COLUMNS * ICON_GRID_ROWS_PER_PAGE)) + 1;
    return page * 1000 + row * 100 + col;
}

function addUniqueName(names, seen, name) {
    if (!seen.has(name)) {
        seen.add(name);
        names.push(name);
    }
}

function addProductNamesFromAmounts(names, seen, amounts, label) {
    requireArray(amounts, label).forEach((amount, amountIndex) => {
        const name = requireString(amount.name ?? amount.product, `${label}[${amountIndex}].name`);
        requireFiniteNumber(amount.quantity, `${label}[${amountIndex}].quantity`);
        addUniqueName(names, seen, name);
    });
}

function collectProductNames(machines) {
    const productNames = [];
    const seen = new Set();
    machines.forEach((machine, machineIndex) => {
        addProductNamesFromAmounts(productNames, seen, machine.build_costs, `machines_and_buildings[${machineIndex}].build_costs`);
        requireArray(machine.recipes, `machines_and_buildings[${machineIndex}].recipes`).forEach((recipe, recipeIndex) => {
            addProductNamesFromAmounts(productNames, seen, recipe.inputs, `machines_and_buildings[${machineIndex}].recipes[${recipeIndex}].inputs`);
            addProductNamesFromAmounts(productNames, seen, recipe.outputs, `machines_and_buildings[${machineIndex}].recipes[${recipeIndex}].outputs`);
        });
    });
    return productNames;
}

function getWorkEnergyPerTick(machine) {
    const electricityConsumed = requireFiniteNumber(machine.electricity_consumed, `${machine.id}.electricity_consumed`);
    return electricityConsumed / 0.00006;
}

function buildItems(productNames, machines) {
    const productItems = productNames.map((name, index) => ({
        ID: PRODUCT_ID_START + index,
        Type: 1,
        Name: name,
        GridIndex: getGridIndex(index),
        IconName: slugifyIconName(name),
        EnemyDropLevel: 0,
        EnemyDropRange: [0, 0],
        EnemyDropCount: 0
    }));

    const factoryItems = machines.map((machine, index) => ({
        ID: FACTORY_ID_START + index,
        Type: 1,
        Name: machine.name,
        // 工厂本身只用于配方设施引用，不放进物品选择器。
        GridIndex: 0,
        IconName: slugifyIconName(machine.name),
        WorkEnergyPerTick: getWorkEnergyPerTick(machine),
        Speed: 1,
        MultipleOutput: 1,
        Space: 0,
        EnemyDropLevel: 0,
        EnemyDropRange: [0, 0],
        EnemyDropCount: 0
    }));

    return [...productItems, ...factoryItems];
}

function toNameCountArrays(amounts, nameToId, label) {
    const ids = [];
    const counts = [];
    requireArray(amounts, label).forEach((amount, amountIndex) => {
        const name = requireString(amount.name, `${label}[${amountIndex}].name`);
        if (!nameToId.has(name)) {
            throw new Error(`Missing item ID for ${name}`);
        }
        ids.push(nameToId.get(name));
        counts.push(requireFiniteNumber(amount.quantity, `${label}[${amountIndex}].quantity`));
    });
    return {ids, counts};
}

function buildRecipes(machines, nameToId, machineNameToId) {
    const recipes = [];
    machines.forEach((machine, machineIndex) => {
        requireArray(machine.recipes, `machines_and_buildings[${machineIndex}].recipes`).forEach((recipe, recipeIndex) => {
            const inputs = toNameCountArrays(
                recipe.inputs,
                nameToId,
                `machines_and_buildings[${machineIndex}].recipes[${recipeIndex}].inputs`
            );
            const outputs = toNameCountArrays(
                recipe.outputs,
                nameToId,
                `machines_and_buildings[${machineIndex}].recipes[${recipeIndex}].outputs`
            );
            const machineId = machineNameToId.get(machine.name);
            if (!machineId) {
                throw new Error(`Missing factory ID for ${machine.name}`);
            }
            recipes.push({
                Name: requireString(recipe.name, `machines_and_buildings[${machineIndex}].recipes[${recipeIndex}].name`),
                Items: inputs.ids,
                ItemCounts: inputs.counts,
                Results: outputs.ids,
                ResultCounts: outputs.counts,
                Factories: [machineId],
                TimeSpend: requireFiniteNumber(recipe.duration, `machines_and_buildings[${machineIndex}].recipes[${recipeIndex}].duration`) * 60,
                Proliferator: 0
            });
        });
    });
    return recipes;
}

function validateUniqueNames(values, label) {
    const duplicates = values.filter((value, index) => values.indexOf(value) !== index);
    if (duplicates.length > 0) {
        throw new Error(`${label} contains duplicate names: ${Array.from(new Set(duplicates)).join(', ')}`);
    }
}

function validateOutput(rawData) {
    const itemIds = new Set(rawData.items.map(item => item.ID));
    const missingReferences = [];
    rawData.recipes.forEach((recipe, recipeIndex) => {
        ['Items', 'Results', 'Factories'].forEach((field) => {
            recipe[field].forEach((id) => {
                if (!itemIds.has(id)) {
                    missingReferences.push(`${recipeIndex}.${field}.${id}`);
                }
            });
        });
    });
    if (missingReferences.length > 0) {
        throw new Error(`Converted data has missing item references: ${missingReferences.slice(0, 20).join(', ')}`);
    }
}

function convert(source) {
    const machines = requireArray(source.machines_and_buildings, 'machines_and_buildings');
    validateUniqueNames(machines.map(machine => requireString(machine.name, 'machine.name')), 'machines_and_buildings');

    const productNames = collectProductNames(machines);
    validateUniqueNames(productNames, 'products');

    const items = buildItems(productNames, machines);
    const nameToId = new Map(items.map(item => [item.Name, item.ID]));
    const machineNameToId = new Map(machines.map((machine, index) => [machine.name, FACTORY_ID_START + index]));
    const recipes = buildRecipes(machines, nameToId, machineNameToId);

    const rawData = {recipes, items, techs: []};
    validateOutput(rawData);
    return {
        rawData,
        summary: {
            gameVersion: source.game_version ?? '',
            machines: machines.length,
            products: productNames.length,
            factoryItems: machines.length,
            recipes: recipes.length,
            recipesWithoutOutputs: recipes.filter(recipe => recipe.Results.length === 0).length
        }
    };
}

function main() {
    const defaultInput = process.platform === 'win32' ? DEFAULT_WINDOWS_INPUT : DEFAULT_WSL_INPUT;
    const inputPath = resolveInputPath(process.argv[2] || defaultInput);
    const outputPath = path.resolve(process.argv[3] || DEFAULT_OUTPUT);
    const source = readJson(inputPath);
    const {rawData, summary} = convert(source);
    writeJson(outputPath, rawData);
    console.log(`Converted ${inputPath}`);
    console.log(`Wrote ${outputPath}`);
    console.log(JSON.stringify(summary, null, 2));
}

if (require.main === module) {
    main();
}
