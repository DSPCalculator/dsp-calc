import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {GameInfo, GlobalState} from '../src/global_state.jsx';
import {get_game_data} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {baselineSettings} from './helpers/solver-cases.js';

beforeEach(() => vi.spyOn(console, 'log').mockImplementation(() => {}));
afterEach(() => vi.restoreAllMocks());

function scenario({cracking = false, penalty = 0} = {}) {
    const game = get_game_data([]);
    const info = new GameInfo(game);
    const scheme = init_scheme_data(game);
    if (cracking) {
        const choice = info.item_data.氢.findIndex((id, index) => index > 0 &&
            game.recipe_data[id].原料.精炼油 === 1 && game.recipe_data[id].产物.高能石墨 === 1);
        expect(choice).toBeGreaterThan(0);
        scheme.item_recipe_choices.氢 = choice;
    }
    scheme.cost_weight.物品额外成本.精炼油.溢出时处理成本 = penalty;
    return new GlobalState(info, scheme, structuredClone(baselineSettings));
}

describe('upstream #78: surplus avoidance respects the selected routes', () => {
    it('cannot consume surplus oil when no oil-consuming hydrogen route is selected', () => {
        const normal = scenario().calculate({'能量矩阵': 120});
        const avoid = scenario({penalty: 5000}).calculate({'能量矩阵': 120});
        expect(normal[1].精炼油).toBeCloseTo(480, 6);
        expect(avoid[1].精炼油).toBeCloseTo(480, 6);
        expect(avoid).toEqual(normal);
    });

    it('eliminates oil surplus after selecting hydrogen cracking with oil refining', () => {
        const state = scenario({cracking: true, penalty: 5000});
        const [production, surplus] = state.calculate({'能量矩阵': 120});
        expect(surplus.精炼油 ?? 0).toBeCloseTo(0, 6);
        expect(production.能量矩阵).toBeCloseTo(120, 6);
        expect(production.原油).toBeCloseTo(160, 6);
        expect(production.精炼油).toBeCloseTo(160, 6);
        expect(production.氢).toBeCloseTo(160, 6);
        expect(production.高能石墨).toBeCloseTo(80, 6);
    });
});
