import '@testing-library/jest-dom/vitest';
import {useContext, useEffect} from 'react';
import {act, cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {
    ContextProvider, GameInfoSetterContext, GlobalStateContext, NeedsListContext,
    NeedsListSetterContext, SchemeDataSetterContext,
} from '../src/contexts.jsx';
import {
    default_game_data, get_game_data, MoreMegaStructureGUID, TheyComeFromVoidGUID,
    GenesisBookGUID, FractionateEverythingGUID,
} from '../src/GameData.jsx';
import {GameInfo} from '../src/global_state.jsx';
import {init_scheme_data, SchemeStorage} from '../src/scheme_data.jsx';

// https://github.com/DSPCalculator/dsp-calc/issues/52 reports that strategy
// names appear but selecting one does nothing. Exercise the actual menu,
// provider and solver state rather than calling the loader directly.
const profiles = [
    [], [MoreMegaStructureGUID], [GenesisBookGUID], [FractionateEverythingGUID],
    [MoreMegaStructureGUID, TheyComeFromVoidGUID],
    [MoreMegaStructureGUID, GenesisBookGUID],
    [MoreMegaStructureGUID, FractionateEverythingGUID],
    [GenesisBookGUID, FractionateEverythingGUID],
    [MoreMegaStructureGUID, TheyComeFromVoidGUID, GenesisBookGUID],
    [MoreMegaStructureGUID, TheyComeFromVoidGUID, FractionateEverythingGUID],
    [MoreMegaStructureGUID, GenesisBookGUID, FractionateEverythingGUID],
    [MoreMegaStructureGUID, TheyComeFromVoidGUID, GenesisBookGUID, FractionateEverythingGUID],
].map(mods => ({mods, game: get_game_data(mods)}));

beforeAll(() => {
    HTMLElement.prototype.scrollIntoView = vi.fn();
    HTMLElement.prototype.hasPointerCapture = vi.fn(() => false);
    HTMLElement.prototype.setPointerCapture = vi.fn();
    HTMLElement.prototype.releasePointerCapture = vi.fn();
});
beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Probe({observe}) {
    const state = useContext(GlobalStateContext);
    const needs = useContext(NeedsListContext);
    const setNeeds = useContext(NeedsListSetterContext);
    const setScheme = useContext(SchemeDataSetterContext);
    const setGame = useContext(GameInfoSetterContext);
    useEffect(() => observe({state, needs, setNeeds, setScheme, setGame}),
        [observe, state, needs, setNeeds, setScheme, setGame]);
    return null;
}

function mount() {
    let current;
    const observe = value => { current = value; };
    return {
        ...render(<ContextProvider><SchemeStorage/><Probe observe={observe}/></ContextProvider>),
        current: () => current,
        user: userEvent.setup(),
    };
}

const readStore = key => JSON.parse(localStorage.getItem(key));

function customizedStrategy(game = default_game_data) {
    const saved = init_scheme_data(game);
    const info = new GameInfo(game);
    const recipe = info.item_data['电路板'][1];
    saved.scheme_for_recipe[recipe] = {
        建筑: game.factory_data[game.recipe_data[recipe].设施].length - 1,
        增产模式: 2,
        增产点数: 4,
    };
    saved.cost_weight['电力'] = 13;
    saved.cost_weight['物品额外成本']['铁块'] = {成本: 7, 启用: 1, 与其它成本累计: 1, 溢出时处理成本: 11};
    const alternate = Object.keys(info.item_data).find(item => info.item_data[item].length > 2);
    saved.item_recipe_choices[alternate] = 2;
    return saved;
}

async function load(user, name = '保存的策略') {
    await user.click(screen.getByTitle('加载生产策略'));
    await user.click(screen.getByRole('menuitem', {name, exact: true}));
}

describe('upstream #52 strategy menu loading', () => {
    it.each(profiles)('applies an older strategy without source fields in $game.game_name and reloads it after remount', async ({mods, game}) => {
        const saved = customizedStrategy(game);
        const raw = JSON.stringify({[game.game_name]: {'保存的策略': saved}, AnotherGame: {untouched: true}});
        localStorage.setItem('auto_mods', JSON.stringify(mods));
        localStorage.setItem('scheme_data', raw);
        let app = mount();
        act(() => app.current().setNeeds({'电路板': 120}));
        const originalRate = app.current().state.item_graph['电路板'].产出倍率;
        await load(app.user);

        expect(screen.getByRole('status')).toHaveTextContent('已加载「保存的策略」');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(readStore('auto_scheme')[game.game_name]).toEqual(saved);
        expect(app.current().state.scheme_data.cost_weight).toEqual(saved.cost_weight);
        expect(app.current().state.scheme_data.item_recipe_choices).toEqual(saved.item_recipe_choices);
        expect(app.current().state.item_graph['电路板'].产出倍率).toBeGreaterThan(originalRate);
        expect(app.current().needs).toEqual({'电路板': 120});
        expect(localStorage.getItem('scheme_data')).toBe(raw);

        // Loading copies the named save; later strategy changes cannot replace
        // it, and selecting the same name again must actually restore it.
        act(() => app.current().setScheme(init_scheme_data(game)));
        await load(app.user);
        expect(readStore('auto_scheme')[game.game_name]).toEqual(saved);
        expect(localStorage.getItem('scheme_data')).toBe(raw);
        app.unmount();
        app = mount();
        expect(readStore('auto_scheme')[game.game_name]).toEqual(saved);
        await load(app.user);
        expect(readStore('auto_scheme')[game.game_name]).toEqual(saved);
        expect(localStorage.getItem('scheme_data')).toBe(raw);
    });

    it('saves a new strategy through the dialog and restores it through keyboard menu selection', async () => {
        const saved = customizedStrategy();
        const app = mount();
        act(() => app.current().setScheme(saved));
        await app.user.click(screen.getByTitle('保存生产策略'));
        const dialog = screen.getByRole('dialog', {name: '保存方案'});
        await app.user.type(within(dialog).getByRole('textbox', {name: '方案名称'}), '键盘方案');
        await app.user.click(within(dialog).getByRole('button', {name: '保存', exact: true}));
        const raw = localStorage.getItem('scheme_data');
        expect(readStore('scheme_data').Vanilla['键盘方案']).toEqual({...saved, production_sources: []});
        act(() => app.current().setScheme(init_scheme_data(default_game_data)));

        screen.getByTitle('加载生产策略').focus();
        await app.user.keyboard('{Enter}{ArrowDown}{Enter}');
        expect(screen.queryByRole('menu')).not.toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('已加载「键盘方案」');
        expect(readStore('auto_scheme').Vanilla).toEqual(saved);
        expect(localStorage.getItem('scheme_data')).toBe(raw);
    });

    it('loads the 238-recipe legacy Vanilla format without overwriting its original bytes', async () => {
        const legacy = {...default_game_data, recipe_data: default_game_data.recipe_data.slice(0, 238),
            recipe_ids: default_game_data.recipe_ids.slice(0, 238)};
        const saved = customizedStrategy(legacy);
        const raw = JSON.stringify({Vanilla: {'保存的策略': saved}}, null, 2);
        localStorage.setItem('scheme_data', raw);
        const app = mount();
        await load(app.user);
        const restored = readStore('auto_scheme').Vanilla;
        expect(restored.scheme_for_recipe).toHaveLength(241);
        expect(restored.scheme_for_recipe.slice(0, 238)).toEqual(saved.scheme_for_recipe);
        expect(restored.item_recipe_choices).toEqual({...saved.item_recipe_choices, 全息信标: 1, 黑雾引力透镜: 1});
        expect(restored.cost_weight['电力']).toBe(13);
        expect(localStorage.getItem('scheme_data')).toBe(raw);
        expect(localStorage.getItem('game_data_migration_backups')).toBeNull();
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('selects the current game scope when the same preset name exists in two profiles', async () => {
        const vanilla = customizedStrategy();
        const game = get_game_data([GenesisBookGUID]);
        const genesis = customizedStrategy(game);
        genesis.cost_weight['电力'] = 29;
        const raw = JSON.stringify({Vanilla: {'保存的策略': vanilla}, [game.game_name]: {'保存的策略': genesis}});
        localStorage.setItem('scheme_data', raw);
        const app = mount();
        await load(app.user);
        expect(readStore('auto_scheme').Vanilla).toEqual(vanilla);
        act(() => app.current().setGame(game));
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
        await load(app.user);
        expect(readStore('auto_scheme')[game.game_name]).toEqual(genesis);
        act(() => app.current().setGame(default_game_data));
        await load(app.user);
        expect(readStore('auto_scheme').Vanilla).toEqual(vanilla);
        expect(localStorage.getItem('scheme_data')).toBe(raw);
    });

    it('loads a newer cross-tab value at action time rather than the rendered snapshot', async () => {
        const saved = customizedStrategy();
        localStorage.setItem('scheme_data', JSON.stringify({Vanilla: {'保存的策略': saved}}));
        const app = mount();
        await app.user.click(screen.getByTitle('加载生产策略'));
        const newer = structuredClone(saved);
        newer.cost_weight['电力'] = 29;
        // Model a remote save whose storage event has not reached this tab yet.
        localStorage.setItem('scheme_data', JSON.stringify({Vanilla: {'保存的策略': newer}}));
        await app.user.click(screen.getByRole('menuitem', {name: '保存的策略'}));
        expect(readStore('auto_scheme').Vanilla).toEqual(newer);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('reports an entry deleted in another tab instead of silently ignoring selection', async () => {
        localStorage.setItem('scheme_data', JSON.stringify({Vanilla: {'保存的策略': customizedStrategy()}}));
        const app = mount();
        const before = localStorage.getItem('auto_scheme');
        await app.user.click(screen.getByTitle('加载生产策略'));
        localStorage.setItem('scheme_data', JSON.stringify({Vanilla: {}}));
        await app.user.click(screen.getByRole('menuitem', {name: '保存的策略'}));
        expect(screen.getByRole('alert')).toHaveTextContent('未找到方案「保存的策略」');
        expect(localStorage.getItem('auto_scheme')).toBe(before);
        expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });

    it.each([
        ['null entry', () => null],
        ['invalid recipe choice', () => {
            const saved = customizedStrategy();
            saved.item_recipe_choices['电路板'] = 999;
            return saved;
        }],
        ['unrecognized recipe revision', () => {
            const saved = customizedStrategy();
            saved.scheme_for_recipe.pop();
            saved.scheme_for_recipe.pop();
            return saved;
        }],
        ['modded data under Vanilla scope', () => customizedStrategy(get_game_data([GenesisBookGUID]))],
    ])('reports %s without partially applying it and can then load a valid entry', async (_, invalid) => {
        const valid = customizedStrategy();
        const raw = JSON.stringify({Vanilla: {'损坏策略': invalid(), '保存的策略': valid}});
        localStorage.setItem('scheme_data', raw);
        const app = mount();
        act(() => app.current().setNeeds({'电路板': 120}));
        const before = localStorage.getItem('auto_scheme');
        const beforeSettings = localStorage.getItem('auto_settings');
        await load(app.user, '损坏策略');
        expect(screen.getByRole('alert')).toHaveTextContent('当前计算未被修改');
        expect(localStorage.getItem('auto_scheme')).toBe(before);
        expect(localStorage.getItem('auto_settings')).toBe(beforeSettings);
        expect(app.current().needs).toEqual({'电路板': 120});
        expect(localStorage.getItem('scheme_data')).toBe(raw);
        await load(app.user);
        expect(readStore('auto_scheme').Vanilla).toEqual(valid);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        expect(localStorage.getItem('scheme_data')).toBe(raw);
    });
});
