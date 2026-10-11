import '@testing-library/jest-dom/vitest';
import {useContext, useEffect, useRef, useState} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {ContextProvider, GlobalStateContext, NeedsListContext, NeedsListSetterContext, PlanLoaderContext, SettingsSetterContext} from '../src/contexts.jsx';
import {Result} from '../src/result.jsx';
import {ProductionSourceCard} from '../src/natural_production_line.jsx';
import {createNeedsPlanSnapshot} from '../src/lib/plan-state.js';
import {TooltipProvider} from '../src/components/ui/tooltip';

let current;
beforeEach(() => {
    localStorage.clear();
    current = undefined;
    vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const source = (patch = {}) => ({id: 'iron-a', target_item: '铁块', recipe_choice: 1, building: 0,
    proliferator_mode: 0, proliferator_points: 0, output_per_minute: 0, scope: 'plan', ...patch});
function Fixture({sources, initialNeeds}) {
    const state = useContext(GlobalStateContext);
    const needs = useContext(NeedsListContext);
    const setNeeds = useContext(NeedsListSetterContext);
    const setSettings = useContext(SettingsSetterContext);
    const loadPlan = useContext(PlanLoaderContext);
    const [oreOpen, setOreOpen] = useState(false);
    const [buildingOpen, setBuildingOpen] = useState(false);
    const initialized = useRef(false);
    useEffect(() => {
        if (!initialized.current) {
            initialized.current = true;
            setNeeds(initialNeeds);
            if (sources) setSettings({production_sources: sources});
        }
        current = {state, needs, setNeeds, setSettings, loadPlan};
    }, [initialNeeds, sources, state, needs, setNeeds, setSettings, loadPlan]);
    return <Result needs_list={needs} set_needs_list={setNeeds} show_ore_popup={oreOpen} set_show_ore_popup={setOreOpen}
        show_building_popup={buildingOpen} set_show_building_popup={setBuildingOpen}/>;
}
function mount(sources = [source()], initialNeeds = {'铁块': 300}) {
    return render(<TooltipProvider><ContextProvider><Fixture sources={sources} initialNeeds={initialNeeds}/></ContextProvider></TooltipProvider>);
}
const manual = (item = '铁块') => screen.getByRole('article', {name: `${item}现有产线 1`});
const input = (field, item = '铁块') => within(manual(item)).getByRole('textbox', {name: `${item}现有产线 1${field}`});
const stored = () => current.state.settings.production_sources[0];
async function edit(user, field, value, item) {
    const control = input(field, item);
    await user.clear(control);
    if (value !== '') await user.type(control, String(value));
    await user.keyboard('{Enter}');
}

describe('bidirectional existing-source quantity controls', () => {
    it('binds count to output and automatic remainder, then lets output become the controlling field', async () => {
        const user = userEvent.setup();
        mount();
        await edit(user, '工厂数量', 2.5);
        expect(stored()).toMatchObject({quantity_mode: 'buildings', building_quantity: 2.5, output_per_minute: 150});
        expect(input('分配产量')).toHaveValue('150.00');
        expect(screen.getByLabelText('铁块需求产线产量')).toHaveTextContent('150.00');
        expect(manual()).toHaveAttribute('data-quantity-mode', 'buildings');
        expect(manual()).toHaveAccessibleDescription(/固定工厂数量/);
        await user.click(within(manual()).getByRole('button', {name: '位面熔炉'}));
        expect(input('工厂数量')).toHaveValue('2.50');
        expect(input('分配产量')).toHaveValue('300.00');
        expect(stored().output_per_minute).toBe(300);
        await user.click(within(manual()).getByRole('button', {name: '增产', exact: true}));
        expect(input('分配产量')).toHaveValue('375.00');
        await user.click(within(manual()).getByRole('button', {name: /增产剂\s+Mk\.II$/}));
        expect(input('分配产量')).toHaveValue('360.00');
        await edit(user, '分配产量', 90);
        expect(stored()).toMatchObject({quantity_mode: 'rate', output_per_minute: 90});
        expect(input('工厂数量')).toHaveValue('0.63');
        expect(manual()).toHaveAccessibleDescription(/固定分配产量/);
        await user.click(within(manual()).getByRole('button', {name: '电弧熔炉'}));
        expect(input('分配产量')).toHaveValue('90.00');
        expect(input('工厂数量')).toHaveValue('1.25');
        await user.click(within(manual()).getByRole('button', {name: '铁块配方 2', exact: true}));
        expect(input('分配产量')).toHaveValue('90.00');
        expect(stored().quantity_mode).toBe('rate');
    });

    it('switches fixed-count receivers to the Dark Fog alternative, sprays them and restores the saved plan', async () => {
        const user = userEvent.setup();
        const item = '临界光子';
        mount([source({target_item: item, recipe_choice: 2, quantity_mode: 'buildings', building_quantity: 2.5})], {[item]: 144});
        expect(input('分配产量', item)).toHaveValue('30.00');
        await user.click(within(manual(item)).getByRole('button', {name: '临界光子配方 3', exact: true}));
        expect(input('分配产量', item)).toHaveValue('60.00');
        await user.click(within(manual(item)).getByRole('button', {name: '接收站透镜喷涂', exact: true}));
        expect(input('分配产量', item)).toHaveValue('120.00');
        for (const [tier, rate] of [['II', '90.00'], ['I', '75.00'], ['III', '120.00']]) {
            await user.click(within(manual(item)).getByRole('button', {name: new RegExp(`增产剂\\s+Mk\\.${tier}$`)}));
            expect(input('分配产量', item)).toHaveValue(rate);
            expect(input('工厂数量', item)).toHaveValue('2.50');
        }
        expect(stored()).toMatchObject({recipe_choice: 3, quantity_mode: 'buildings', building_quantity: 2.5,
            output_per_minute: 120, proliferator_mode: 3, proliferator_points: 4});
        expect(current.state.scheme_data.item_recipe_choices[item]).toBe(1);
        const saved = structuredClone(createNeedsPlanSnapshot(current.needs, current.state.scheme_data,
            current.state.settings, current.state.game_data.game_name));
        act(() => current.setNeeds({'铁块': 60}));
        act(() => current.loadPlan(saved, 'needs'));
        expect(stored()).toEqual(saved.settings.production_sources[0]);
        expect(input('工厂数量', item)).toHaveValue('2.50');
        expect(input('分配产量', item)).toHaveValue('120.00');
        expect(within(manual(item)).getByRole('button', {name: '临界光子配方 3', exact: true})).toHaveAttribute('aria-pressed', 'true');
        expect(current.state.calculate({[item]: 144})[2].sources[0].inputs['黑雾引力透镜']).toBeCloseTo(0.25, 10);
    });

    it('preserves exact count and ownership when a rounded derived field is only focused, blurred, or rejected', async () => {
        const user = userEvent.setup();
        mount([source({quantity_mode: 'buildings', building_quantity: 1.23456789})]);
        const expected = {...stored()};
        await user.click(input('分配产量'));
        await user.tab();
        expect(stored()).toEqual(expected);
        await user.click(input('工厂数量'));
        await user.tab();
        expect(stored()).toEqual(expected);
        for (const value of ['-1', 'Infinity', '1e309', '']) {
            for (const field of ['工厂数量', '分配产量']) {
                await edit(user, field, value);
                expect(stored()).toEqual(expected);
            }
        }
        await user.clear(input('工厂数量'));
        await user.type(input('工厂数量'), '7');
        await user.keyboard('{Escape}');
        await user.tab();
        expect(stored()).toEqual(expected);
    });

    it('keeps the same factory count in second units, and converts output edits back to canonical minutes', async () => {
        const user = userEvent.setup();
        mount();
        await edit(user, '工厂数量', 2.5);
        act(() => current.setSettings({is_time_unit_minute: false}));
        expect(input('分配产量')).toHaveValue('2.50');
        expect(input('工厂数量')).toHaveValue('2.50');
        expect(stored()).toMatchObject({quantity_mode: 'buildings', building_quantity: 2.5, output_per_minute: 150});
        await edit(user, '分配产量', 2);
        expect(stored()).toMatchObject({quantity_mode: 'rate', output_per_minute: 120});
        expect(input('工厂数量')).toHaveValue('2.00');
        await edit(user, '工厂数量', 0);
        expect(input('分配产量')).toHaveValue('0.00');
        expect(stored()).toMatchObject({quantity_mode: 'buildings', building_quantity: 0, output_per_minute: 0});
    });

    it('refreshes saved per-minute output when global mining capacity changes', () => {
        mount([source({target_item: '铁矿', building: 1, quantity_mode: 'buildings', building_quantity: 1.5})], {'铁矿': 6000});
        expect(stored().output_per_minute).toBe(4320);
        act(() => current.setSettings({mining_efficiency_large: 1}));
        expect(stored()).toMatchObject({building_quantity: 1.5, output_per_minute: 1440});
        expect(input('工厂数量', '铁矿')).toHaveValue('1.50');
        expect(input('分配产量', '铁矿')).toHaveValue('1440.00');
    });

    it('preserves mode and exact count in complete plans while plan forks stay transient', async () => {
        const user = userEvent.setup();
        mount();
        await edit(user, '工厂数量', 1.23456789);
        const saved = structuredClone(createNeedsPlanSnapshot(current.needs, current.state.scheme_data,
            current.state.settings, current.state.game_data.game_name));
        expect(saved.settings.production_sources[0]).toMatchObject({quantity_mode: 'buildings', building_quantity: 1.23456789});
        expect(JSON.parse(localStorage.getItem('auto_settings')).production_sources).toEqual([]);
        act(() => current.setNeeds({'铜块': 60}));
        expect(current.state.settings.production_sources).toEqual([]);
        act(() => current.loadPlan(saved, 'needs'));
        expect(stored()).toEqual(saved.settings.production_sources[0]);
        expect(input('工厂数量')).toHaveValue('1.23');
        expect(manual()).toHaveAttribute('data-quantity-mode', 'buildings');
        expect(JSON.parse(localStorage.getItem('auto_settings')).production_sources).toEqual([]);
    });

    it('restores the exact fixed count for standalone sources from autosave', async () => {
        const user = userEvent.setup();
        const first = mount([source({standalone: true, scope: 'global'})]);
        await edit(user, '工厂数量', 2.125);
        const saved = JSON.parse(localStorage.getItem('auto_settings')).production_sources[0];
        expect(saved).toMatchObject({quantity_mode: 'buildings', building_quantity: 2.125, output_per_minute: 127.5});
        first.unmount();
        render(<TooltipProvider><ContextProvider><Fixture initialNeeds={{'铁块': 300}}/></ContextProvider></TooltipProvider>);
        expect(stored()).toEqual(saved);
        expect(manual()).toHaveAttribute('data-quantity-mode', 'buildings');
        expect(input('分配产量')).toHaveValue('127.50');
    });

    it.each([{building: 999}, {recipe_choice: 999}])('disables count editing with an explanation when the actual source configuration is invalid: %j', invalid => {
        mount([source(invalid)]);
        expect(input('工厂数量')).toBeDisabled();
        expect(input('工厂数量')).toHaveAccessibleDescription('请先选择有效的配方与工厂类型');
        expect(within(manual()).getByRole('alert')).toHaveTextContent(/来源(建筑|配方)已失效/);
    });

    it('keeps a real existing source editable when the automatic remainder is external supply', async () => {
        const user = userEvent.setup();
        mount();
        act(() => current.setSettings({mineralize_list: {'铁块': true}}));
        const automatic = screen.getByRole('article', {name: '铁块需求产线'});
        expect(within(automatic).getByText('外部供给')).toBeVisible();
        expect(within(automatic).queryByRole('textbox', {name: /工厂数量/})).not.toBeInTheDocument();
        expect(input('工厂数量')).toBeEnabled();
        await edit(user, '工厂数量', 2.5);
        expect(stored()).toMatchObject({quantity_mode: 'buildings', output_per_minute: 150});
        expect(screen.getByLabelText('铁块需求产线产量')).toHaveTextContent('150.00');
    });

    it('disables external-supply count editing without manufacturing a fake factory count', () => {
        render(<TooltipProvider><ContextProvider><ProductionSourceCard item="铁块" source={source()} ordinal={1}
            recipe_choice={1} building={0} output={60} buildings={0} is_mineralized/></ContextProvider></TooltipProvider>);
        expect(input('工厂数量')).toBeDisabled();
        expect(input('工厂数量')).toHaveValue('—');
        expect(input('工厂数量')).toHaveAccessibleDescription('外部供给，无需工厂');
    });
});
