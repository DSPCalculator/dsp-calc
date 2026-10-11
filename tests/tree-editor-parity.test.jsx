import '@testing-library/jest-dom/vitest';
import {useContext, useEffect, useRef, useState} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CompactModeContext, ContextProvider, GlobalStateContext, NeedsListContext, NeedsListSetterContext,
    PlanLoaderContext, SettingsSetterContext} from '../src/contexts.jsx';
import {default_game_data} from '../src/GameData.jsx';
import {GameInfo} from '../src/global_state.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {Result} from '../src/result.jsx';
import {createNeedsPlanSnapshot} from '../src/lib/plan-state.js';
import {TooltipProvider} from '../src/components/ui/tooltip';

let current;
beforeEach(() => {
    localStorage.clear();
    current = undefined;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    HTMLElement.prototype.scrollIntoView = vi.fn();
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

function Fixture({sources, initialNeeds}) {
    const state = useContext(GlobalStateContext);
    const needs = useContext(NeedsListContext);
    const setNeeds = useContext(NeedsListSetterContext);
    const setSettings = useContext(SettingsSetterContext);
    const loadPlan = useContext(PlanLoaderContext);
    const initialized = useRef(false);
    const [oreOpen, setOreOpen] = useState(false);
    const [buildingsOpen, setBuildingsOpen] = useState(false);
    useEffect(() => {
        if (!initialized.current) {
            initialized.current = true;
            setNeeds(initialNeeds);
            setSettings({production_sources: sources});
        }
        current = {state, needs, setNeeds, setSettings, loadPlan};
    }, [state, needs, setNeeds, setSettings, loadPlan, initialNeeds, sources]);
    return <Result needs_list={needs} set_needs_list={setNeeds} show_ore_popup={oreOpen} set_show_ore_popup={setOreOpen}
        show_building_popup={buildingsOpen} set_show_building_popup={setBuildingsOpen}/>;
}
function mount({needs = {'铁块': 300}, sources = [], mode = 'full'} = {}) {
    return {user: userEvent.setup(), ...render(<TooltipProvider><ContextProvider><CompactModeContext.Provider value={mode}>
        <Fixture initialNeeds={needs} sources={sources}/>
    </CompactModeContext.Provider></ContextProvider></TooltipProvider>)};
}
const viewButton = name => within(screen.getByRole('group', {name: '生产结果视图'})).getByRole('button', {name, exact: true});
const tree = () => screen.getByRole('region', {name: '依赖树生产视图'});
const summary = () => screen.getByRole('complementary', {name: '生产统计'}).textContent;
const flatRow = item => screen.getByRole('row', {name: `${item}全局产线`, exact: true});
const occurrences = item => Array.from(tree().querySelectorAll('tr[data-product]')).filter(row => row.dataset.product === item && row.dataset.scope === 'branch');
async function openGlobalSettings(user, row, item) {
    const toggle = within(row).getByLabelText(`${item}全局来源设置`);
    if (!toggle.closest('details').open) await user.click(toggle);
}
function globalFields(row) {
    return Array.from(row.querySelector('.dsp-branch-global-settings table > tbody > tr').children, fieldSnapshot);
}
const sources = () => current.state.settings.production_sources;
const scheme = () => current.state.scheme_data;
const source = (id, item = '铜块', output = 0, patch = {}) => ({id, target_item: item, output_per_minute: output,
    recipe_choice: 1, building: 0, proliferator_mode: 0, proliferator_points: 0, scope: 'plan', ...patch});
async function edit(user, input, value) {
    await user.clear(input);
    await user.type(input, String(value));
    await user.keyboard('{Enter}');
}
async function sharedCopper(user) {
    await user.click(viewButton('树状'));
    await user.click(screen.getByRole('button', {name: '展开电路板的上游原料'}));
    await user.click(screen.getByRole('button', {name: '展开磁线圈的上游原料'}));
    expect(occurrences('铜块').length).toBeGreaterThanOrEqual(2);
}
function fieldSnapshot(cell) {
    return {
        text: cell.textContent,
        buttons: Array.from(cell.querySelectorAll('button'), button => ({name: button.getAttribute('aria-label'),
            pressed: button.getAttribute('aria-pressed'), disabled: button.disabled})),
        inputs: Array.from(cell.querySelectorAll('input'), input => ({name: input.getAttribute('aria-label'), value: input.value,
            disabled: input.disabled})),
        recipes: Array.from(cell.querySelectorAll('[role="img"][title]'), recipe => recipe.getAttribute('title')),
    };
}
function expectUniqueIds() {
    const ids = Array.from(document.querySelectorAll('[id]'), element => element.id);
    expect(new Set(ids).size).toBe(ids.length);
    const instances = Array.from(tree().querySelectorAll('[data-row-instance]'), row => row.dataset.rowInstance);
    expect(instances.every(Boolean)).toBe(true);
    expect(new Set(instances).size).toBe(instances.length);
}

function configureGraphene() {
    const value = init_scheme_data(default_game_data);
    const info = new GameInfo(default_game_data);
    value.item_recipe_choices['石墨烯'] = 2;
    value.item_recipe_choices['氢'] = info.item_data['氢'].findIndex((id, index) => index > 0
        && Object.keys(default_game_data.recipe_data[id].原料).length === 0);
    localStorage.setItem('auto_scheme', JSON.stringify({Vanilla: value}));
    localStorage.setItem('auto_settings', JSON.stringify({mineralize_list: {'硫酸': true, '高能石墨': true}}));
}

describe('editable dependency tree parity with the canonical production rows', () => {
    it.each(['full', 'compact', 'narrow', 'mobile'])('retains flat actions and settings beside read-only branch quantities in %s mode', async mode => {
        const {user} = mount({mode});
        const flatCells = Array.from(flatRow('铁块').children, fieldSnapshot);
        expect(flatCells).toHaveLength(9);
        const before = summary();
        await user.click(viewButton('树状'));
        const row = occurrences('铁块')[0];
        const cells = Array.from(row.children);
        expect(cells).toHaveLength(10);
        expect(cells.slice(1).filter((_, index) => index !== 2 && index !== 3).map(fieldSnapshot))
            .toEqual(flatCells.filter((_, index) => index !== 2 && index !== 3));
        expect(within(row).getByLabelText('铁块本支产能')).toHaveTextContent(/^300.00$/);
        expect(within(row).getByLabelText('铁块本支工厂数量')).toHaveTextContent(/^5.00$/);
        expect(within(row).queryByRole('textbox')).not.toBeInTheDocument();
        expect(row.querySelector('.dsp-item-name')).not.toHaveClass('sr-only');
        expect(within(cells[0]).getByLabelText('铁块本支需求')).toHaveTextContent(/^300.00$/);
        expect(cells[0].querySelectorAll('input, select, textarea')).toHaveLength(0);
        const headers = within(row.closest('table')).getAllByRole('columnheader').map(header => header.textContent);
        expect(headers).toEqual(['依赖 / 本支需求', '操作', '物品', '本支产能 / min', '本支工厂数量',
            '配方选取', '增产模式', '增产剂', '工厂类型', '全局物流估算']);
        expect(within(row).queryAllByRole('textbox')).toHaveLength(0);
        for (const button of within(cells.at(-1)).getAllByRole('button')) expect(button).toBeVisible();
        expect(tree()).toHaveTextContent('每行产能和工厂数量只表示本支');
        expect(summary()).toBe(before);
    });

    it('synchronizes factory, proliferation and recipe edits across every shared occurrence and the flat editor', async () => {
        const {user} = mount({needs: {'电磁矩阵': 60}});
        await sharedCopper(user);
        const first = () => occurrences('铜块')[0];
        const initialInstances = occurrences('铜块').map(row => row.dataset.rowInstance);
        await user.click(within(first()).getByRole('button', {name: '位面熔炉', exact: true}));
        await user.click(within(first()).getByRole('button', {name: '增产', exact: true}));
        await user.click(within(first()).getByRole('button', {name: /增产剂\s+Mk\.II$/}));
        const recipeId = current.state.item_data['铜块'][1];
        expect(scheme().scheme_for_recipe[recipeId]).toMatchObject({建筑: 1, 增产模式: '2', 增产点数: 2});
        expect(occurrences('铜块').map(row => row.dataset.rowInstance)).toEqual(initialInstances);
        for (const row of occurrences('铜块')) {
            expect(within(row).getByRole('button', {name: '位面熔炉'})).toHaveAttribute('aria-pressed', 'true');
            expect(within(row).getByRole('button', {name: '增产', exact: true})).toHaveAttribute('aria-pressed', 'true');
            expect(within(row).getByRole('button', {name: /增产剂\s+Mk\.II$/})).toHaveAttribute('aria-pressed', 'true');
            expect(within(row).getByLabelText('铜块本支产能')).toHaveTextContent(/^30.00$/);
        }
        await user.click(within(occurrences('铜块')[1]).getByRole('button', {name: '铜块配方 2', exact: true}));
        expect(scheme().item_recipe_choices['铜块']).toBe(2);
        for (const row of occurrences('铜块')) expect(within(row).getByRole('button', {name: '铜块配方 2', exact: true})).toHaveAttribute('aria-pressed', 'true');
        const saved = JSON.parse(localStorage.getItem('auto_scheme')).Vanilla;
        expect(saved).toEqual(scheme());
        const before = summary();
        await user.click(viewButton('平铺'));
        expect(within(flatRow('铜块')).getByRole('button', {name: '铜块配方 2', exact: true})).toHaveAttribute('aria-pressed', 'true');
        expect(summary()).toBe(before);
        expect(JSON.parse(localStorage.getItem('auto_scheme')).Vanilla).toEqual(saved);
        await user.click(within(flatRow('铜块')).getByRole('button', {name: '铜块配方 1', exact: true}));
        expect(within(flatRow('铜块')).getByRole('button', {name: '位面熔炉'})).toHaveAttribute('aria-pressed', 'true');
        expect(within(flatRow('铜块')).getByRole('button', {name: '增产', exact: true})).toHaveAttribute('aria-pressed', 'true');
        expect(within(flatRow('铜块')).getByRole('button', {name: /增产剂\s+Mk\.II$/})).toHaveAttribute('aria-pressed', 'true');
    });

    it('keeps branch quantities read-only while flat capacity and factory inputs still scale all targets', async () => {
        const {user} = mount({needs: {'铁块': 120, '铜块': 60}});
        await user.click(viewButton('树状'));
        expect(within(occurrences('铁块')[0]).queryByRole('textbox')).not.toBeInTheDocument();
        expect(screen.getByLabelText('铁块本支产能')).toHaveTextContent(/^120.00$/);
        expect(screen.getByLabelText('铁块本支工厂数量')).toHaveTextContent(/^2.00$/);
        await user.click(viewButton('平铺'));
        await edit(user, within(flatRow('铁块')).getByRole('textbox', {name: '铁块产能，等比例调整需求'}), 240);
        expect(current.needs).toEqual({'铁块': 240, '铜块': 120});
        const count = within(flatRow('铁块')).getByRole('textbox', {name: '铁块工厂数量，等比例调整需求'});
        await edit(user, count, Number(count.value) * 2);
        expect(current.needs).toEqual({'铁块': 480, '铜块': 240});
        const before = summary();
        await user.click(viewButton('树状'));
        expect(screen.getByLabelText('铁块本支产能')).toHaveTextContent(/^480.00$/);
        expect(screen.getByLabelText('铁块本支工厂数量')).toHaveTextContent(/^8.00$/);
        expect(screen.getByLabelText('铜块本支产能')).toHaveTextContent(/^240.00$/);
        expect(summary()).toBe(before);
    });

    it('shows unequal shared copper capacities and factories instead of repeating the global total', async () => {
        const {user} = mount({needs: {'电磁矩阵': 60, '电路板': 120}});
        await user.click(viewButton('树状'));
        await user.click(screen.getByRole('button', {name: '展开电路板的上游原料'}));
        await user.click(screen.getByRole('button', {name: '展开磁线圈的上游原料'}));
        const copper = occurrences('铜块');
        expect(copper).toHaveLength(3);
        expect(copper.map(row => within(row).getByLabelText('铜块本支产能').textContent).sort()).toEqual(['30.00', '30.00', '60.00']);
        expect(copper.map(row => within(row).getByLabelText('铜块本支工厂数量').textContent).sort()).toEqual(['0.50', '0.50', '1.00']);
        expect(copper.every(row => !row.querySelector('input'))).toBe(true);
        await user.click(viewButton('平铺'));
        expect(within(flatRow('铜块')).getByRole('textbox', {name: '铜块产能，等比例调整需求'})).toHaveValue('120.00');
        expect(within(flatRow('铜块')).getByRole('textbox', {name: '铜块工厂数量，等比例调整需求'})).toHaveValue('2.00');
    });

    it.each(['click', 'keyboard'])('forks from the second shared occurrence with %s and keeps focus in that occurrence', async activation => {
        const {user} = mount({needs: {'电磁矩阵': 60}});
        await sharedCopper(user);
        const row = occurrences('铜块')[1];
        const instance = row.dataset.rowInstance;
        const before = summary();
        const fork = within(row).getByRole('button', {name: '使用铜块配方 2添加产线'});
        if (activation === 'click') await user.click(fork);
        else { fork.focus(); await user.keyboard('{Enter}'); }
        expect(viewButton('树状')).toHaveAttribute('aria-pressed', 'true');
        expect(sources()).toHaveLength(1);
        expect(sources()[0]).toMatchObject({target_item: '铜块', recipe_choice: 2, output_per_minute: 0, scope: 'plan'});
        const sameOccurrence = occurrences('铜块').find(element => element.dataset.rowInstance === instance);
        expect(sameOccurrence).toBeDefined();
        expect(within(sameOccurrence).getByRole('textbox', {name: '铜块现有产线 1分配产量'})).toHaveFocus();
        expect(sameOccurrence.querySelector('.dsp-branch-global-settings')).toHaveAttribute('open');
        for (const copy of occurrences('铜块')) {
            expect(within(copy).getByLabelText('铜块本支产能')).toHaveTextContent(/^30.00$/);
            expect(within(copy).getByLabelText('铜块本支工厂数量')).toHaveTextContent(/^0.50$/);
            await openGlobalSettings(user, copy, '铜块');
            expect(within(copy).getByRole('article', {name: '铜块现有产线 1'})).toHaveAttribute('data-source-id', sources()[0].id);
            expect(within(copy).getByRole('textbox', {name: '铜块现有产线 1分配产量'})).toHaveValue('0.00');
            expect(within(copy).getByLabelText('铜块需求产线产量')).toHaveTextContent(/^60.00$/);
        }
        expectUniqueIds();
        expect(summary()).toBe(before);
        expect(JSON.parse(localStorage.getItem('auto_settings')).production_sources).toEqual([]);
        expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalledWith({block: 'nearest', inline: 'nearest'});
    });

    it('edits source rates and fixed building counts globally, keeps zero automatic output, and deletes shared sources only once', async () => {
        const {user} = mount({needs: {'电磁矩阵': 60}, sources: [source('copper-a', '铜块', 10), source('copper-b', '铜块', 20)]});
        const flatFields = Array.from(flatRow('铜块').children, fieldSnapshot);
        await sharedCopper(user);
        for (const copy of occurrences('铜块')) {
            expect(within(copy).getByLabelText('铜块本支产能')).toHaveTextContent('—');
            expect(within(copy).getByLabelText('铜块本支工厂数量')).toHaveTextContent('—');
            expect(copy.querySelector('.dsp-branch-global-settings')).not.toHaveAttribute('open');
            await openGlobalSettings(user, copy, '铜块');
            expect(globalFields(copy)).toEqual(flatFields);
            for (const input of within(copy).getAllByRole('textbox')) expect(input).toBeVisible();
            expect(within(copy).getByRole('button', {name: '添加铜块产线'})).toBeVisible();
            expect(within(copy).getByRole('button', {name: '删除铜块现有产线 1'})).toBeVisible();
        }
        const manual = (ordinal = 1) => within(occurrences('铜块')[1]).getByRole('article', {name: `铜块现有产线 ${ordinal}`});
        await user.click(within(occurrences('铜块')[1]).getByRole('button', {name: '添加铜块产线'}));
        expect(sources()).toHaveLength(3);
        for (const copy of occurrences('铜块')) expect(within(copy).getByRole('textbox', {name: '铜块现有产线 3分配产量'})).toHaveValue('0.00');
        await user.click(within(manual(3)).getByRole('button', {name: '删除铜块现有产线 3'}));
        expect(sources()).toHaveLength(2);
        await edit(user, within(manual()).getByRole('textbox', {name: '铜块现有产线 1分配产量'}), 25);
        expect(sources()[0]).toMatchObject({quantity_mode: 'rate', output_per_minute: 25});
        for (const copy of occurrences('铜块')) expect(within(copy).getByLabelText('铜块需求产线产量')).toHaveTextContent(/^15.00$/);
        await edit(user, within(manual()).getByRole('textbox', {name: '铜块现有产线 1工厂数量'}), 2);
        expect(sources()[0]).toMatchObject({quantity_mode: 'buildings', building_quantity: 2, output_per_minute: 120});
        for (const copy of occurrences('铜块')) {
            expect(within(copy).getByLabelText('铜块总需求')).toHaveTextContent(/^60.00$/);
            expect(within(copy).getByLabelText('铜块需求产线产量')).toHaveTextContent(/^0.00$/);
            expect(within(copy).getByLabelText('铜块合计生产')).toHaveTextContent('140.00 / min');
            expect(within(copy).getByRole('textbox', {name: '铜块现有产线 1工厂数量'})).toHaveValue('2.00');
            expect(within(copy).getByRole('textbox', {name: '铜块现有产线 1分配产量'})).toHaveValue('120.00');
        }
        expectUniqueIds();
        await user.click(within(manual()).getByRole('button', {name: '删除铜块现有产线 1'}));
        expect(sources().map(value => value.id)).toEqual(['copper-b']);
        for (const copy of occurrences('铜块')) expect(within(copy).getByRole('article', {name: '铜块现有产线 1'})).toHaveAttribute('data-source-id', 'copper-b');
        await user.click(within(manual()).getByRole('button', {name: '删除铜块现有产线 1'}));
        expect(sources()).toEqual([]);
        expect(screen.queryByRole('region', {name: '铜块生产来源'})).not.toBeInTheDocument();
        for (const copy of occurrences('铜块')) {
            expect(within(copy).getByLabelText('铜块本支产能')).toHaveTextContent(/^30.00$/);
            expect(within(copy).getByLabelText('铜块本支工厂数量')).toHaveTextContent(/^0.50$/);
            expect(within(copy).queryByRole('textbox')).not.toBeInTheDocument();
        }
    });

    it('keeps summaries and saved calculations unchanged when expanding or collapsing repeated global editors', async () => {
        const {user} = mount({needs: {'电磁矩阵': 60}, sources: [source('copper-a', '铜块', 15)]});
        const before = summary();
        const calculation = structuredClone(current.state.calculate(current.needs));
        const settings = localStorage.getItem('auto_settings');
        const savedScheme = localStorage.getItem('auto_scheme');
        await sharedCopper(user);
        for (let index = 0; index < 2; index++) {
            await user.click(screen.getByRole('button', {name: '收起电路板的上游原料'}));
            expect(summary()).toBe(before);
            await user.click(screen.getByRole('button', {name: '展开电路板的上游原料'}));
            expect(summary()).toBe(before);
        }
        expect(current.state.calculate(current.needs)).toEqual(calculation);
        expect(localStorage.getItem('auto_settings')).toBe(settings);
        expect(localStorage.getItem('auto_scheme')).toBe(savedScheme);
        expect(sources()).toHaveLength(1);
    });

    it('keeps true gross demand and read-only byproduct links when a coproduct completely covers the automatic line', async () => {
        configureGraphene();
        const {user} = mount({needs: {'石墨烯': 120, '氢': 30}});
        const flatFields = Array.from(flatRow('氢').children, fieldSnapshot);
        const before = summary();
        await user.click(viewButton('树状'));
        const row = occurrences('氢')[0];
        expect(within(row).getByLabelText('氢本支需求')).toHaveTextContent(/^30.00$/);
        expect(within(row).getByLabelText('氢本支产能')).toHaveTextContent('—');
        expect(within(row).getByLabelText('氢本支工厂数量')).toHaveTextContent('—');
        for (const copy of occurrences('氢')) {
            await openGlobalSettings(user, copy, '氢');
            expect(globalFields(copy)).toEqual(flatFields);
            expect(within(copy).getByLabelText('氢总需求')).toHaveTextContent(/^30.00$/);
            expect(within(copy).getByLabelText('氢需求产线产量')).toHaveTextContent(/^0.00$/);
            expect(within(copy).getByLabelText('氢副产来源 1产量')).toHaveTextContent(/^60.00$/);
            expect(within(copy).getByLabelText('氢合计生产')).toHaveTextContent('60.00 / min');
            const linked = within(copy).getByRole('article', {name: '氢副产来源 1'});
            expect(linked.querySelectorAll('input, select, textarea')).toHaveLength(0);
        }
        expectUniqueIds();
        expect(sources()).toEqual([]);
        expect(summary()).toBe(before);
        await user.click(within(row).getByRole('button', {name: '查看石墨烯需求产线（氢副产来源 1）'}));
        expect(viewButton('平铺')).toHaveAttribute('aria-pressed', 'true');
        expect(flatRow('石墨烯')).toHaveFocus();
        expect(summary()).toBe(before);
    });

    it('supports hover, pinned-click and keyboard logistics popovers directly inside the tree', async () => {
        const {user} = mount({needs: {'铁块': 600}});
        await user.click(viewButton('树状'));
        const before = summary();
        const trigger = within(occurrences('铁块')[0]).getByRole('button', {name: /^铁块物流估算/});
        viewButton('树状').focus();
        await user.hover(trigger);
        let panel = await screen.findByRole('dialog', {name: '铁块物流估算'});
        const belt = within(panel).getByRole('region', {name: '合并出料流量，未叠堆'});
        expect(within(belt).getByText('流量 600.00 / min')).toBeVisible();
        expect(within(panel).getByRole('listitem', {name: /合并出料流量，未叠堆 高速传送带 1 条/})).toBeVisible();
        await user.unhover(trigger);
        await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
        await user.click(trigger);
        await user.unhover(trigger);
        panel = screen.getByRole('dialog', {name: '铁块物流估算'});
        expect(panel).toBeVisible();
        await user.click(within(panel).getByRole('button', {name: '关闭铁块物流估算'}));
        trigger.focus();
        await user.keyboard('{Enter}');
        expect(screen.getByRole('dialog', {name: '铁块物流估算'})).toBeVisible();
        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
        expect(trigger).toHaveFocus();
        expect(summary()).toBe(before);
        expect(viewButton('树状')).toHaveAttribute('aria-pressed', 'true');
    });

    it('restores a saved tree-edited plan with the exact source identity and count, then shows the same flat controls', async () => {
        const {user} = mount({sources: [source('iron-fixed', '铁块')]});
        await user.click(viewButton('树状'));
        await openGlobalSettings(user, occurrences('铁块')[0], '铁块');
        const manual = () => within(occurrences('铁块')[0]).getByRole('article', {name: '铁块现有产线 1'});
        await edit(user, within(manual()).getByRole('textbox', {name: '铁块现有产线 1工厂数量'}), 1.23456789);
        await user.click(within(manual()).getByRole('button', {name: '位面熔炉'}));
        await user.click(within(manual()).getByRole('button', {name: '增产', exact: true}));
        const saved = structuredClone(createNeedsPlanSnapshot(current.needs, scheme(), current.state.settings, current.state.game_data.game_name));
        expect(saved.settings.production_sources[0]).toMatchObject({id: 'iron-fixed', quantity_mode: 'buildings', building_quantity: 1.23456789,
            building: 1, proliferator_mode: 2});
        const output = within(manual()).getByRole('textbox', {name: '铁块现有产线 1分配产量'}).value;
        act(() => current.setNeeds({'铜块': 60}));
        expect(sources()).toEqual([]);
        act(() => current.loadPlan(saved, 'needs'));
        expect(viewButton('树状')).toHaveAttribute('aria-pressed', 'true');
        expect(sources()).toEqual(saved.settings.production_sources);
        await openGlobalSettings(user, occurrences('铁块')[0], '铁块');
        expect(within(manual()).getByRole('textbox', {name: '铁块现有产线 1工厂数量'})).toHaveValue('1.23');
        expect(within(manual()).getByRole('textbox', {name: '铁块现有产线 1分配产量'})).toHaveValue(output);
        expectUniqueIds();
        await user.click(viewButton('平铺'));
        expect(screen.getByRole('region', {name: '铁块生产来源'})).toHaveAttribute('id', 'production-sources-铁块');
        expect(screen.getByRole('textbox', {name: '铁块现有产线 1分配产量'})).toHaveValue(output);
        expect(screen.getByRole('textbox', {name: '铁块现有产线 1工厂数量'})).toHaveValue('1.23');
        expect(JSON.parse(localStorage.getItem('auto_settings')).production_sources).toEqual([]);
    });

    it('mineralizes and restores a production row from its tree action without changing targets', async () => {
        const {user} = mount();
        await user.click(viewButton('树状'));
        await user.click(within(occurrences('铁块')[0]).getByRole('button', {name: '将铁块视为原矿'}));
        expect(current.state.settings.mineralize_list).toHaveProperty('铁块');
        expect(current.needs).toEqual({'铁块': 300});
        expect(within(occurrences('铁块')[0]).getByLabelText('铁块本支工厂数量')).toHaveTextContent(/^0.00$/);
        expect(within(occurrences('铁块')[0]).getByText('外部供给，无需工厂')).toBeVisible();
        await user.click(within(occurrences('铁块')[0]).getByRole('button', {name: '恢复铁块生产'}));
        expect(current.state.settings.mineralize_list).not.toHaveProperty('铁块');
        expect(within(occurrences('铁块')[0]).getByLabelText('铁块本支工厂数量')).toHaveTextContent(/^5.00$/);
        expect(current.needs).toEqual({'铁块': 300});
    });
});
