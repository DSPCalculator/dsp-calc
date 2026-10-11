import '@testing-library/jest-dom/vitest';
import {useContext, useEffect, useState} from 'react';
import {readFileSync} from 'node:fs';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CompactModeContext, ContextProvider, GlobalStateContext, SettingsSetterContext} from '../src/contexts.jsx';
import {RecipeSelect, Result} from '../src/result.jsx';
import {default_game_data} from '../src/GameData.jsx';
import {GameInfo} from '../src/global_state.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {productionSourceNode} from '../src/production_sources.js';
import {TooltipProvider} from '../src/components/ui/tooltip';

const appStyles = readFileSync('src/index.css', 'utf8');

const gameInfo = new GameInfo(default_game_data);
const forkName = (item = '重氢', choice = 2) => `使用${item}配方 ${choice}添加产线`;
let activeState;
const activeSources = () => activeState.settings.production_sources;
const savedSources = () => JSON.parse(localStorage.getItem('auto_settings')).production_sources;
const savedScheme = () => JSON.parse(localStorage.getItem('auto_scheme')).Vanilla;
const productOrder = () => Array.from(screen.getByRole('region', {name: '生产结果表，可横向滚动'})
    .querySelectorAll('tbody > tr[data-product]'), row => row.dataset.product);
const auto = (item = '重氢') => screen.getByRole('article', {name: `${item}需求产线`});
const manual = (item = '重氢', ordinal = 1) => screen.getByRole('article', {name: `${item}现有产线 ${ordinal}`});

beforeEach(() => {
    localStorage.clear();
    activeState = undefined;
    vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function UnitSwitch() {
    const {settings} = useContext(GlobalStateContext);
    const setSettings = useContext(SettingsSetterContext);
    return <button onClick={() => setSettings({is_time_unit_minute: !settings.is_time_unit_minute})}>切换时间单位</button>;
}

function StateObserver({observe}) {
    const state = useContext(GlobalStateContext);
    useEffect(() => { activeState = state; observe?.(state); }, [state, observe]);
    return null;
}

function Overview({initialNeeds = {'重氢': 300}, mode = 'full', observe}) {
    const [needs, setNeeds] = useState(initialNeeds);
    const [oreOpen, setOreOpen] = useState(false);
    const [buildingsOpen, setBuildingsOpen] = useState(false);
    return <TooltipProvider><ContextProvider><CompactModeContext.Provider value={mode}>
        <StateObserver observe={observe}/>
        <UnitSwitch/>
        <Result needs_list={needs} set_needs_list={setNeeds} show_ore_popup={oreOpen} set_show_ore_popup={setOreOpen}
            show_building_popup={buildingsOpen} set_show_building_popup={setBuildingsOpen}/>
    </CompactModeContext.Provider></ContextProvider></TooltipProvider>;
}

function Picker({onChange = vi.fn(), onFork = vi.fn(), choice = 1, item = '重氢'}) {
    return <TooltipProvider><GlobalStateContext.Provider value={{game_data: default_game_data, item_data: gameInfo.item_data}}>
        <RecipeSelect item={item} choice={choice} onChange={onChange} onFork={onFork} compact="full"/>
    </GlobalStateContext.Provider></TooltipProvider>;
}

describe('ordinary-row recipe fork shortcut', () => {
    it('keeps a tiny sibling fork only on unselected recipes and preserves recipe-click selection', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const onFork = vi.fn();
        render(<Picker onChange={onChange} onFork={onFork}/>);
        const selected = screen.getByRole('button', {name: '重氢配方 1', exact: true});
        const option = screen.getByRole('button', {name: '重氢配方 2', exact: true});
        const fork = screen.getByRole('button', {name: forkName()});
        expect(screen.queryByRole('button', {name: forkName('重氢', 1)})).not.toBeInTheDocument();
        expect(fork.parentElement).toBe(option.parentElement);
        expect(fork.closest('button')).toBe(fork);
        expect(option.querySelector('button')).toBeNull();
        expect(fork).toHaveClass('absolute', 'size-6');
        expect(fork.firstElementChild).toHaveClass('size-4', 'text-base');
        expect(fork).toHaveAttribute('aria-description', expect.stringContaining('初始产量为 0'));
        await user.hover(option);
        expect(option.parentElement).toHaveClass('dsp-recipe-option');
        expect(selected).toHaveAttribute('aria-pressed', 'true');
        expect(onFork).not.toHaveBeenCalled();
        await user.unhover(option);
        await user.click(option);
        expect(onChange).toHaveBeenCalledExactlyOnceWith(2);
        expect(onFork).not.toHaveBeenCalled();
    });

    it('reveals the overlay through hover/focus CSS and leaves it visible for touch pointers', () => {
        // jsdom does not apply pointer media queries; guard the actual browser
        // visibility contract while interaction tests exercise the native buttons.
        expect(appStyles).toMatch(/\.dsp-recipe-fork\s*\{\s*opacity:\s*0;\s*pointer-events:\s*none;/);
        expect(appStyles).toMatch(/\.dsp-recipe-option:hover\s*>\s*\.dsp-recipe-fork,\s*\.dsp-recipe-option:focus-within\s*>\s*\.dsp-recipe-fork\s*\{\s*opacity:\s*1;\s*pointer-events:\s*auto;/);
        expect(appStyles).toMatch(/@media\s*\(hover:\s*none\),\s*\(pointer:\s*coarse\)\s*\{\s*\.dsp-recipe-fork\s*\{\s*opacity:\s*1;\s*pointer-events:\s*auto;/);
    });

    it.each(['{Enter}', ' '])('supports keyboard fork activation with %s without selecting the recipe', async key => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const onFork = vi.fn();
        render(<Picker onChange={onChange} onFork={onFork}/>);
        await user.tab();
        expect(screen.getByRole('button', {name: '重氢配方 1', exact: true})).toHaveFocus();
        await user.tab();
        expect(screen.getByRole('button', {name: '重氢配方 2', exact: true})).toHaveFocus();
        await user.tab();
        expect(screen.getByRole('button', {name: forkName()})).toHaveFocus();
        await user.keyboard(key);
        expect(onFork).toHaveBeenCalledExactlyOnceWith(2);
        expect(onChange).not.toHaveBeenCalled();
    });

    it('does not bubble a fork click to enclosing selection handlers', async () => {
        const user = userEvent.setup();
        const parentClick = vi.fn();
        const onFork = vi.fn();
        render(<div onClick={parentClick}><Picker onFork={onFork}/></div>);
        await user.click(screen.getByRole('button', {name: forkName()}));
        expect(onFork).toHaveBeenCalledExactlyOnceWith(2);
        expect(parentClick).not.toHaveBeenCalled();
    });

    it('keeps the dependency position, automatic recipe/rate and totals when the zero manual source appears', async () => {
        const user = userEvent.setup();
        render(<Overview initialNeeds={{'氘核燃料棒': 30}}/>);
        const order = productOrder();
        const initialRate = screen.getByRole('textbox', {name: '重氢产能，等比例调整需求'}).value;
        const summary = screen.getByRole('complementary', {name: '生产统计'}).textContent;
        const scheme = savedScheme();
        await user.hover(screen.getByRole('button', {name: '重氢配方 2', exact: true}));
        await user.click(screen.getByRole('button', {name: forkName()}));
        expect(productOrder()).toEqual(order);
        expect(screen.getByRole('region', {name: '重氢生产来源'}).closest('tr')).toHaveAttribute('data-product', '重氢');
        expect(within(auto()).getByLabelText('重氢需求产线产量')).toHaveTextContent(initialRate);
        expect(within(auto()).getByRole('button', {name: '重氢配方 1', exact: true})).toHaveAttribute('aria-pressed', 'true');
        expect(within(manual()).getByRole('button', {name: '重氢配方 2', exact: true})).toHaveAttribute('aria-pressed', 'true');
        expect(within(manual()).getByRole('textbox', {name: /分配产量/})).toHaveValue('0.00');
        expect(activeSources()[0]).toMatchObject({target_item: '重氢', recipe_choice: 2, output_per_minute: 0, standalone: false, scope: 'plan'});
        expect(savedSources()).toEqual([]);
        expect(savedScheme()).toEqual(scheme);
        expect(screen.getByRole('complementary', {name: '生产统计'}).textContent).toBe(summary);
        expect(within(auto()).queryByRole('button', {name: forkName()})).not.toBeInTheDocument();
        expect(within(manual()).queryByRole('button', {name: forkName('重氢', 1)})).not.toBeInTheDocument();
    });

    it('still selects an ordinary recipe normally and removes the fork from the newly selected option', async () => {
        const user = userEvent.setup();
        render(<Overview/>);
        await user.click(screen.getByRole('button', {name: '重氢配方 2', exact: true}));
        expect(savedScheme().item_recipe_choices['重氢']).toBe(2);
        expect(activeSources()).toEqual([]);
        expect(screen.getByRole('button', {name: '重氢配方 2', exact: true})).toHaveAttribute('aria-pressed', 'true');
        expect(screen.queryByRole('button', {name: forkName()})).not.toBeInTheDocument();
        expect(screen.getByRole('button', {name: forkName('重氢', 1)})).toBeInTheDocument();
        expect(screen.queryByRole('region', {name: '重氢生产来源'})).not.toBeInTheDocument();
    });

    it('atomically retains rapid repeated forks with distinct identities only within the active plan', () => {
        const first = render(<Overview/>);
        const fork = screen.getByRole('button', {name: forkName()});
        // All handlers run before React commits the ordinary-row-to-group switch.
        act(() => { fork.click(); fork.click(); fork.click(); });
        const sources = activeSources();
        expect(sources).toHaveLength(3);
        expect(new Set(sources.map(source => source.id)).size).toBe(3);
        expect(sources.every(source => source.recipe_choice === 2 && source.output_per_minute === 0)).toBe(true);
        expect(within(auto()).getByLabelText('重氢需求产线产量')).toHaveTextContent('300.00');
        sources.forEach((source, index) => expect(manual('重氢', index + 1)).toHaveAttribute('data-source-id', source.id));
        expect(savedSources()).toEqual([]);
        first.unmount();
        render(<Overview/>);
        expect(activeSources()).toEqual([]);
        expect(screen.queryByRole('article', {name: '重氢现有产线 1'})).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: '重氢产能，等比例调整需求'})).toHaveValue('300.00');
    });

    it('continues keyboard focus in the new source allocation without scrolling the page', async () => {
        const user = userEvent.setup();
        render(<Overview/>);
        const fork = screen.getByRole('button', {name: forkName()});
        fork.focus();
        const focus = vi.spyOn(HTMLElement.prototype, 'focus');
        const originalScroll = HTMLElement.prototype.scrollIntoView;
        const scroll = vi.fn();
        HTMLElement.prototype.scrollIntoView = scroll;
        try {
            await user.keyboard('{Enter}');
        } finally {
            if (originalScroll) HTMLElement.prototype.scrollIntoView = originalScroll;
            else delete HTMLElement.prototype.scrollIntoView;
        }
        const input = within(manual()).getByRole('textbox', {name: '重氢现有产线 1分配产量'});
        expect(input).toHaveFocus();
        expect(focus).toHaveBeenCalledWith({preventScroll: true});
        expect(scroll).toHaveBeenCalledExactlyOnceWith({block: 'nearest', inline: 'nearest'});
        await user.clear(input);
        await user.type(input, '120');
        await user.keyboard('{Enter}');
        expect(activeSources()[0].output_per_minute).toBe(120);
        expect(within(auto()).getByLabelText('重氢需求产线产量')).toHaveTextContent('180.00');
    });

    it.each([true, false])('starts at canonical zero in minute-display=%s and preserves edited physical output across units', async minute => {
        const user = userEvent.setup();
        localStorage.setItem('auto_settings', JSON.stringify({is_time_unit_minute: minute}));
        render(<Overview initialNeeds={{'重氢': minute ? 300 : 5}}/>);
        await user.click(screen.getByRole('button', {name: forkName()}));
        expect(activeSources()[0].output_per_minute).toBe(0);
        expect(within(manual()).getByRole('textbox', {name: /分配产量/})).toHaveValue('0.00');
        const input = within(manual()).getByRole('textbox', {name: /分配产量/});
        await user.clear(input);
        await user.type(input, minute ? '150' : '2.5');
        await user.keyboard('{Enter}');
        expect(activeSources()[0].output_per_minute).toBe(150);
        await user.click(screen.getByRole('button', {name: '切换时间单位'}));
        expect(activeSources()[0].output_per_minute).toBe(150);
        expect(within(manual()).getByRole('textbox', {name: /分配产量/})).toHaveValue(minute ? '2.50' : '150.00');
    });

    it('prefills the clicked recipe\'s factory and proliferation config rather than the automatic recipe\'s', async () => {
        const user = userEvent.setup();
        const scheme = init_scheme_data(default_game_data);
        const recipeId = gameInfo.item_data['重氢'][3];
        const recipe = default_game_data.recipe_data[recipeId];
        const building = default_game_data.factory_data[recipe['设施']].length - 1;
        const mode = [1, 2, 3, 4].find(value => recipe['增产'] & (1 << (value - 1))) || 0;
        scheme.scheme_for_recipe[gameInfo.item_data['重氢'][1]] = {建筑: 0, 增产模式: 2, 增产点数: 4};
        scheme.scheme_for_recipe[recipeId] = {建筑: building, 增产模式: mode, 增产点数: 2};
        localStorage.setItem('auto_scheme', JSON.stringify({Vanilla: scheme}));
        let state;
        render(<Overview observe={value => { state = value; }}/>);
        await user.click(screen.getByRole('button', {name: forkName('重氢', 3)}));
        expect(activeSources()[0]).toMatchObject({recipe_choice: 3, building, proliferator_mode: mode, proliferator_points: 2});
        expect(() => productionSourceNode(state, activeSources()[0])).not.toThrow();
        expect(within(manual()).queryByRole('alert')).not.toBeInTheDocument();
        expect(savedScheme()).toEqual(scheme);
    });

    it('sanitizes unsupported factory, mode and points for the clicked recipe', async () => {
        const user = userEvent.setup();
        const scheme = init_scheme_data(default_game_data);
        scheme.scheme_for_recipe[gameInfo.item_data['重氢'][2]] = {建筑: 999, 增产模式: 4, 增产点数: 999};
        localStorage.setItem('auto_scheme', JSON.stringify({Vanilla: scheme}));
        let state;
        render(<Overview observe={value => { state = value; }}/>);
        await user.click(screen.getByRole('button', {name: forkName()}));
        expect(activeSources()[0]).toMatchObject({recipe_choice: 2, building: 0, proliferator_mode: 0, proliferator_points: 0});
        expect(() => productionSourceNode(state, activeSources()[0])).not.toThrow();
        expect(within(manual()).queryByRole('alert')).not.toBeInTheDocument();
    });

    it('keeps a surplus-only fork visible for calculation while its lifecycle stays plan-scoped', async () => {
        const user = userEvent.setup();
        render(<Overview initialNeeds={{'精炼油': 60}}/>);
        expect(productOrder()).not.toContain('氢');
        await user.click(screen.getByRole('button', {name: '为氢副产物添加独立产线'}));
        await user.click(within(manual('氢')).getByRole('button', {name: '氢配方 2', exact: true}));
        expect(activeSources()[0]).toMatchObject({target_item: '氢', recipe_choice: 2, output_per_minute: 0, standalone: true, scope: 'plan'});
        expect(savedSources()).toEqual([]);
        expect(screen.getByRole('region', {name: '氢生产来源'})).toBeInTheDocument();
        expect(within(manual('氢')).getByRole('textbox', {name: /分配产量/})).toHaveValue('0.00');
        expect(within(auto('氢')).getByLabelText('氢需求产线产量')).toHaveTextContent('0.00');
        expect(screen.queryByText(/已暂停.*条未被当前需求使用的来源/)).not.toBeInTheDocument();
    });
});
