// Rebuild a numerical fixture from the original, unmodified solver commit.
// This deliberately does not evaluate the working tree's implementation.
import console from 'node:console';
import {execFileSync} from 'node:child_process';
import {writeFileSync} from 'node:fs';
import {Buffer} from 'node:buffer';
import {fileURLToPath} from 'node:url';
import {calculateScenario, solverCases} from '../tests/helpers/solver-cases.js';

const repository = fileURLToPath(new URL('..', import.meta.url));
const sourceCommit = 'd53123399a7ab6278d3d1b704e111bef728b727e';
const readOriginal = path => execFileSync('git', ['show', `${sourceCommit}:${path}`], {cwd: repository, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024});
const loadModule = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const dataFiles = execFileSync('git', ['ls-tree', '--name-only', sourceCommit, 'data/'], {cwd: repository, encoding: 'utf8'}).trim().split('\n').filter(path => path.endsWith('.json'));
const dataIndices = Object.fromEntries(dataFiles.map(path => [`../${path}`, JSON.parse(readOriginal(path).replace(/^\uFEFF/, ''))]));
const dataSource = readOriginal('src/GameData.jsx').replace(/const data_index_modules = import\.meta\.glob\([\s\S]*?\);/, `const data_index_modules = ${JSON.stringify(dataIndices)};`);
const engineSource = readOriginal('src/global_state.jsx').replace('"javascript-lp-solver"', JSON.stringify(import.meta.resolve('javascript-lp-solver')));
const schemeSource = readOriginal('src/scheme_data.jsx').slice(0, readOriginal('src/scheme_data.jsx').indexOf('export function SchemeStorage')).replace(/^import .*;\n/gm, '');
// The existing GameInfo constructor uses the browser's `self` global.
globalThis.self = globalThis;
const api = {...await loadModule(dataSource), ...await loadModule(engineSource), ...await loadModule(schemeSource)};
const cases = {};
for (const scenario of solverCases) {
    cases[scenario.name] = calculateScenario(api, scenario);
    for (const section of Object.values(cases[scenario.name])) {
        for (const number of Object.values(section)) {
            if (!Number.isFinite(number)) throw new Error(`Non-finite baseline in ${scenario.name}`);
        }
    }
}
writeFileSync(new URL('../tests/fixtures/solver-baseline.json', import.meta.url), `${JSON.stringify({sourceCommit, cases}, null, 2)}\n`);
console.log(`Captured ${solverCases.length} scenarios from ${sourceCommit}`);
