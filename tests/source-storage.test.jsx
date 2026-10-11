import '@testing-library/jest-dom/vitest';
import {afterEach, beforeAll, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '../src/App.jsx';
import {TooltipProvider} from '../src/components/ui/tooltip';
import {default_game_data, get_game_data, GenesisBookGUID} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';

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

afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
});

function renderApp() {
    return {user: userEvent.setup(), ...render(<TooltipProvider delayDuration={0}><App/></TooltipProvider>)};
}

function readStore(key) {
    return JSON.parse(localStorage.getItem(key));
}

function source(id, overrides = {}) {
    // These storage fixtures intentionally model independent plants with no targets.
    return {id, target_item: '铁块', standalone: true, output_per_minute: 30, recipe_choice: 1, building: 0,
        proliferator_mode: 0, proliferator_points: 0, ...overrides};
}

function sourceInput(item = '铁块', ordinal = 1) {
    return screen.getByRole('textbox', {name: `${item}现有产线 ${ordinal}分配产量`});
}

async function editOutput(user, value, item = '铁块', ordinal = 1) {
    const input = sourceInput(item, ordinal);
    await user.clear(input);
    await user.type(input, String(value));
    await user.keyboard('{Enter}');
}

async function addSource(user, item = '铁块') {
    await user.click(screen.getByRole('button', {name: '添加现有产线'}));
    const dialog = screen.getByRole('dialog', {name: '选择物品'});
    await user.type(within(dialog).getByRole('searchbox'), item);
    await user.click(within(dialog).getAllByRole('button', {name: `选择${item}`, exact: true})[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', {name: '选择物品'})).not.toBeInTheDocument());
}

async function addTarget(user, item) {
    await user.click(screen.getByRole('button', {name: '添加需求物品'}));
    const dialog = screen.getByRole('dialog', {name: '选择物品'});
    await user.type(within(dialog).getByRole('searchbox'), item);
    await user.click(within(dialog).getAllByRole('button', {name: `选择${item}`, exact: true})[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', {name: '选择物品'})).not.toBeInTheDocument());
}

function productRows() {
    return screen.getByRole('region', {name: '生产结果表，可横向滚动'}).querySelectorAll('tbody > tr[data-product]');
}

async function saveStrategy(user, name) {
    await user.click(screen.getByTitle('保存生产策略'));
    const dialog = screen.getByRole('dialog', {name: '保存方案'});
    await user.type(within(dialog).getByRole('textbox', {name: '方案名称'}), name);
    await user.click(within(dialog).getByRole('button', {name: '保存', exact: true}));
}

async function loadStrategy(user, name) {
    await user.click(screen.getByTitle('加载生产策略'));
    await user.click(screen.getByRole('menuitem', {name, exact: true}));
}

describe('production source settings and storage', () => {
    it('adds separate zero-allocation sources even when the target quantity is empty, zero or negative', async () => {
        const {user} = renderApp();
        const quantity = screen.getByRole('spinbutton', {name: '目标产量', exact: true});
        for (const invalid of ['', '0', '-1']) {
            await user.clear(quantity);
            if (invalid) await user.type(quantity, invalid);
            expect(screen.getByRole('button', {name: '添加需求物品'})).toBeDisabled();
            expect(screen.getByRole('button', {name: '添加现有产线'})).toBeEnabled();
            await addSource(user);
        }
        const sources = readStore('auto_settings').production_sources;
        expect(sources).toHaveLength(3);
        expect(new Set(sources.map(entry => entry.id)).size).toBe(3);
        sources.forEach((entry, index) => {
            expect(entry.id).toEqual(expect.any(String));
            expect(entry.id).not.toBe('');
            expect(entry).toMatchObject({target_item: '铁块', output_per_minute: 0, standalone: true});
            expect(sourceInput('铁块', index + 1)).toHaveValue('0.00');
        });
        expect(screen.queryByRole('spinbutton', {name: '铁块目标产量'})).not.toBeInTheDocument();
        expect(readStore('auto_settings').natural_production_line).toEqual([]);
    });

    it('keeps a deliberately added unrelated source independent when targets are removed and the app reopens', async () => {
        let {user, unmount} = renderApp();
        await addTarget(user, '铁块');
        await addSource(user, '重氢');
        await editOutput(user, 150, '重氢');
        const saved = readStore('auto_settings').production_sources;
        expect(saved[0]).toMatchObject({target_item: '重氢', output_per_minute: 150, standalone: true});
        await user.click(screen.getByRole('button', {name: '移除铁块需求'}));
        expect(sourceInput('重氢')).toHaveValue('150.00');
        expect(screen.queryByText('已暂停1条未被当前需求使用的来源')).not.toBeInTheDocument();
        unmount();
        ({user} = renderApp());
        expect(sourceInput('重氢')).toHaveValue('150.00');
        expect(screen.getByRole('article', {name: '重氢现有产线 1'})).toHaveAttribute('data-source-id', saved[0].id);
        expect(readStore('auto_settings').production_sources).toEqual(saved);
        await editOutput(user, 0, '重氢');
        expect(readStore('auto_settings').production_sources[0]).toEqual({...saved[0], quantity_mode: 'rate', output_per_minute: 0});
    });

    it('autosaves independent same-item source edits and preserves zero allocations and identities across settings changes and remounts', async () => {
        let {user, unmount} = renderApp();
        await addSource(user);
        await addSource(user);
        const [first, second] = readStore('auto_settings').production_sources;
        await editOutput(user, 45, '铁块', 2);
        const secondCard = screen.getByRole('article', {name: '铁块现有产线 2'});
        await user.click(within(secondCard).getByRole('button', {name: '位面熔炉'}));
        await user.click(within(secondCard).getByRole('button', {name: '增产', exact: true}));
        await user.click(within(secondCard).getByRole('button', {name: /增产剂\s+Mk\.II$/}));
        const sources = readStore('auto_settings').production_sources;
        expect(sources[0]).toEqual(first);
        expect(sources[1]).toMatchObject({id: second.id, output_per_minute: 45, building: 1, proliferator_mode: 2, proliferator_points: 2});
        await user.click(screen.getByRole('button', {name: '参数设置'}));
        const oil = within(screen.getByRole('dialog', {name: '采矿参数与计算设置'})).getByRole('spinbutton', {name: '原油面板'});
        await user.clear(oil);
        await user.type(oil, '5');
        await user.tab();
        await user.keyboard('{Escape}');
        expect(readStore('auto_settings').mining_speed_oil).toBe(5);
        expect(readStore('auto_settings').production_sources).toEqual(sources);
        unmount();
        ({user} = renderApp());
        expect(sourceInput()).toHaveValue('0.00');
        expect(sourceInput('铁块', 2)).toHaveValue('45.00');
        expect(screen.getByRole('article', {name: '铁块现有产线 1'})).toHaveAttribute('data-source-id', first.id);
        expect(screen.getByRole('article', {name: '铁块现有产线 2'})).toHaveAttribute('data-source-id', second.id);
        expect(readStore('auto_settings').production_sources).toEqual(sources);
        await user.click(screen.getByRole('button', {name: '删除铁块现有产线 1'}));
        expect(readStore('auto_settings').production_sources).toEqual([sources[1]]);
        expect(screen.getByRole('article', {name: '铁块现有产线 1'})).toHaveAttribute('data-source-id', second.id);
    });

    it('saves and restores source definitions with the scoped strategy without polluting the recipe scheme', async () => {
        const sources = [source('iron-zero', {output_per_minute: 0}), source('iron-fast', {output_per_minute: 75, building: 1}),
            source('graphene-alternate', {target_item: '石墨烯', output_per_minute: 20, recipe_choice: 2, proliferator_mode: 2, proliferator_points: 4})];
        localStorage.setItem('auto_settings', JSON.stringify({production_sources: sources}));
        localStorage.setItem('scheme_data', JSON.stringify({AnotherGame: {'保留方案': {untouched: true}}}));
        let {user, unmount} = renderApp();
        await saveStrategy(user, '混合来源');
        const saved = readStore('scheme_data').Vanilla['混合来源'];
        expect(saved.production_sources).toEqual(sources);
        expect(saved.scheme_for_recipe).toHaveLength(default_game_data.recipe_data.length);
        expect(readStore('scheme_data').AnotherGame).toEqual({'保留方案': {untouched: true}});
        await editOutput(user, 90, '铁块', 2);
        await user.click(screen.getByRole('button', {name: '删除石墨烯现有产线 1'}));
        expect(readStore('auto_settings').production_sources).toHaveLength(2);
        expect(readStore('scheme_data').Vanilla['混合来源']).toEqual(saved);
        await loadStrategy(user, '混合来源');
        expect(readStore('auto_settings').production_sources).toEqual(sources);
        expect(readStore('auto_scheme').Vanilla).not.toHaveProperty('production_sources');
        expect(sourceInput('石墨烯')).toHaveValue('20.00');
        expect(within(screen.getByRole('article', {name: '石墨烯现有产线 1'})).getByRole('button', {name: '石墨烯配方 2'})).toHaveAttribute('aria-pressed', 'true');
        unmount();
        ({user} = renderApp());
        expect(readStore('auto_settings').production_sources).toEqual(sources);
        expect(sourceInput('铁块', 2)).toHaveValue('75.00');
        await loadStrategy(user, '混合来源');
        expect(readStore('auto_settings').production_sources.map(entry => entry.id)).toEqual(sources.map(entry => entry.id));
    });

    it('loads an older strategy without source fields as an empty source list', async () => {
        const old = init_scheme_data(default_game_data);
        old.cost_weight['电力'] = 13;
        localStorage.setItem('scheme_data', JSON.stringify({Vanilla: {'旧方案': old}}));
        localStorage.setItem('auto_settings', JSON.stringify({production_sources: [source('current-source')]}));
        const {user, unmount} = renderApp();
        expect(sourceInput()).toHaveValue('30.00');
        await loadStrategy(user, '旧方案');
        expect(readStore('auto_settings').production_sources).toEqual([]);
        expect(readStore('auto_settings').natural_production_line).toEqual([]);
        expect(readStore('auto_scheme').Vanilla).toEqual(old);
        expect(screen.queryByRole('article', {name: '铁块现有产线 1'})).not.toBeInTheDocument();
        unmount();
        renderApp();
        expect(readStore('auto_settings').production_sources).toEqual([]);
    });

    it('rejects a malformed source list without partially loading its strategy', async () => {
        const invalid = {...init_scheme_data(default_game_data), production_sources: {invalid: true}};
        invalid.cost_weight['电力'] = 99;
        localStorage.setItem('scheme_data', JSON.stringify({Vanilla: {'损坏方案': invalid}}));
        localStorage.setItem('auto_settings', JSON.stringify({production_sources: [source('keep-current')]}));
        const {user} = renderApp();
        const beforeSettings = readStore('auto_settings');
        const beforeScheme = readStore('auto_scheme');
        await loadStrategy(user, '损坏方案');
        expect(screen.getByRole('alert')).toHaveTextContent('产线来源格式不正确');
        expect(readStore('auto_settings')).toEqual(beforeSettings);
        expect(readStore('auto_scheme')).toEqual(beforeScheme);
    });

    it.each(['autosave', 'preset'])('repairs duplicate and missing source ids from %s without coupling same-item edits', async origin => {
        const records = [source('keep-id', {output_per_minute: 10}), source('keep-id', {output_per_minute: 20}),
            source('', {output_per_minute: 0})];
        if (origin === 'autosave') localStorage.setItem('auto_settings', JSON.stringify({production_sources: records}));
        else localStorage.setItem('scheme_data', JSON.stringify({Vanilla: {'恢复来源': {
            ...init_scheme_data(default_game_data), production_sources: records,
        }}}));
        let {user, unmount} = renderApp();
        if (origin === 'preset') await loadStrategy(user, '恢复来源');
        const repaired = readStore('auto_settings').production_sources;
        expect(repaired).toHaveLength(3);
        expect(repaired[0]).toEqual(records[0]);
        expect(new Set(repaired.map(entry => entry.id)).size).toBe(3);
        repaired.forEach((entry, index) => {
            expect(entry.id).toEqual(expect.any(String));
            expect(entry.id).not.toBe('');
            expect(entry).toEqual({...records[index], id: entry.id});
        });
        await editOutput(user, 25, '铁块', 2);
        expect(readStore('auto_settings').production_sources).toEqual([
            repaired[0], {...repaired[1], quantity_mode: 'rate', output_per_minute: 25}, repaired[2],
        ]);
        unmount();
        ({user} = renderApp());
        expect(readStore('auto_settings').production_sources.map(entry => entry.id)).toEqual(repaired.map(entry => entry.id));
        await user.click(screen.getByRole('button', {name: '删除铁块现有产线 2'}));
        expect(readStore('auto_settings').production_sources).toEqual([repaired[0], repaired[2]]);
        expect(sourceInput('铁块', 2)).toHaveValue('0.00');
    });

    it('preserves a malformed autosaved source list in a backup across repeated restores', () => {
        const original = {unexpected: ['recover', 'this', 'data']};
        localStorage.setItem('auto_settings', JSON.stringify({production_sources: original}));
        const {unmount} = renderApp();
        const saved = readStore('auto_settings');
        expect(saved.production_sources_backup).toEqual(original);
        expect(saved.production_sources).toHaveLength(1);
        expect(saved.production_sources[0]).toMatchObject({output_per_minute: 0, migration_error: expect.any(String)});
        expect(saved.production_sources[0].id).toEqual(expect.any(String));
        unmount();
        renderApp();
        expect(readStore('auto_settings').production_sources_backup).toEqual(original);
        expect(readStore('auto_settings').production_sources).toEqual(saved.production_sources);
    });

    it('migrates legacy building counts once, retaining the backup and existing stable source ids through remounts', () => {
        const legacy = [{目标物品: '铁块', 建筑数量: 10, 配方id: 1, 增产点数: 0, 增产模式: 0, 建筑: 0, standalone: true},
            {目标物品: '铁块', 建筑数量: 0, 配方id: 1, 增产点数: 0, 增产模式: 0, 建筑: 0, standalone: true}];
        const existing = source('existing-canonical', {output_per_minute: 15});
        // Old sparse arrays must not cause a phantom source. Displaying seconds
        // must not divide the canonical migrated allocation by 60.
        localStorage.setItem('auto_settings', JSON.stringify({is_time_unit_minute: false,
            production_sources: [existing], natural_production_line: [legacy[0], null, legacy[1]]}));
        let rendered = renderApp();
        const first = readStore('auto_settings');
        expect(first.natural_production_line).toEqual([]);
        expect(first.natural_production_line_backup).toEqual(legacy);
        expect(first.production_sources).toHaveLength(3);
        expect(first.production_sources[0]).toEqual(existing);
        expect(first.production_sources[1]).toMatchObject({target_item: '铁块', output_per_minute: 600, recipe_choice: 1, building: 0, standalone: true});
        expect(first.production_sources[2]).toMatchObject({target_item: '铁块', output_per_minute: 0});
        expect(new Set(first.production_sources.map(entry => entry.id)).size).toBe(3);
        expect(sourceInput('铁块', 2)).toHaveValue('10.00');
        for (let repeat = 0; repeat < 2; repeat++) {
            rendered.unmount();
            rendered = renderApp();
            expect(readStore('auto_settings').production_sources).toEqual(first.production_sources);
            expect(readStore('auto_settings').natural_production_line_backup).toEqual(legacy);
            expect(readStore('auto_settings').natural_production_line).toEqual([]);
        }
    });

    it('archives untagged legacy building-count sources without reviving them for a later matching target', async () => {
        const legacy = [{目标物品: '铁块', 建筑数量: 10, 配方id: 1, 增产点数: 0, 增产模式: 0, 建筑: 0}];
        localStorage.setItem('auto_settings', JSON.stringify({natural_production_line: legacy}));
        let {user, unmount} = renderApp();
        const saved = readStore('auto_settings');
        expect(saved.natural_production_line_backup).toEqual(legacy);
        expect(saved.natural_production_line).toEqual([]);
        expect(saved.production_sources).toEqual([]);
        expect(saved.production_sources_plan_backup).toHaveLength(1);
        expect(saved.production_sources_plan_backup[0]).toMatchObject({target_item: '铁块', standalone: false, output_per_minute: 600});
        expect(productRows()).toHaveLength(0);
        expect(screen.queryByText(/已暂停.*条未被当前需求使用的来源/)).not.toBeInTheDocument();
        unmount();
        ({user} = renderApp());
        expect(productRows()).toHaveLength(0);
        expect(readStore('auto_settings').production_sources_plan_backup).toEqual(saved.production_sources_plan_backup);
        expect(readStore('auto_settings').natural_production_line_backup).toEqual(legacy);
        await addTarget(user, '铁块');
        expect(screen.queryByRole('textbox', {name: '铁块现有产线 1分配产量'})).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: '铁块产能，等比例调整需求'})).toHaveValue('60.00');
        expect(readStore('auto_settings').production_sources).toEqual([]);
    });

    it.each(['explicitly bound', 'untagged older'])('archives an %s old gravity allocation and loads raw needs/strategy saves without reviving its fork', async mode => {
        const bound = source('old-gravity-deuterium', {target_item: '重氢', output_per_minute: 150, standalone: false});
        if (mode === 'untagged older') delete bound.standalone;
        const oldScheme = {...init_scheme_data(default_game_data), production_sources: [bound]};
        oldScheme.cost_weight['电力'] = 13;
        localStorage.setItem('auto_settings', JSON.stringify({production_sources: [bound]}));
        localStorage.setItem('scheme_data', JSON.stringify({Vanilla: {'旧重氢策略': oldScheme}}));
        localStorage.setItem('needs_list', JSON.stringify({Vanilla: {'旧引力目标': {'引力矩阵': 60}}}));
        let {user, unmount} = renderApp();
        const archived = readStore('auto_settings').production_sources_plan_backup;
        expect(archived).toHaveLength(1);
        expect(archived[0]).toMatchObject({id: bound.id, output_per_minute: 150});
        expect(readStore('auto_settings').production_sources).toEqual([]);
        expect(productRows()).toHaveLength(0);
        expect(screen.queryByText(/已暂停.*条未被当前需求使用的来源/)).not.toBeInTheDocument();
        unmount();
        ({user} = renderApp());
        expect(readStore('auto_settings').production_sources_plan_backup).toEqual(archived);
        await addTarget(user, '铁块');
        expect([...productRows()].map(row => row.dataset.product)).not.toContain('重氢');
        expect([...productRows()].map(row => row.dataset.product)).not.toContain('氢');
        await user.click(screen.getByTitle('加载需求列表'));
        await user.click(screen.getByRole('menuitem', {name: '旧引力目标'}));
        expect(screen.getByRole('spinbutton', {name: '引力矩阵目标产量'})).toHaveValue(60);
        expect(screen.queryByRole('spinbutton', {name: '铁块目标产量'})).not.toBeInTheDocument();
        expect(screen.queryByRole('region', {name: '重氢生产来源'})).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: '重氢产能，等比例调整需求'})).toHaveValue('300.00');
        await loadStrategy(user, '旧重氢策略');
        expect(screen.getByRole('spinbutton', {name: '引力矩阵目标产量'})).toHaveValue(60);
        expect(screen.queryByRole('region', {name: '重氢生产来源'})).not.toBeInTheDocument();
        expect(screen.getByRole('textbox', {name: '重氢产能，等比例调整需求'})).toHaveValue('300.00');
        expect(readStore('auto_settings').production_sources).toEqual([]);
        expect(readStore('auto_scheme').Vanilla.cost_weight['电力']).toBe(13);
        expect(readStore('scheme_data').Vanilla['旧重氢策略']).toEqual(oldScheme);
        expect(readStore('needs_list').Vanilla['旧引力目标']).toEqual({'引力矩阵': 60});
    }, 15000);

    it('keeps canonical source rates and building counts unchanged when switching display units, and converts edits back to per minute', async () => {
        const sources = [source('canonical-rate', {output_per_minute: 90}), source('zero-rate', {output_per_minute: 0})];
        localStorage.setItem('auto_settings', JSON.stringify({production_sources: sources}));
        const {user} = renderApp();
        expect(sourceInput()).toHaveValue('90.00');
        const buildings = screen.getByLabelText('铁块现有产线 1工厂数量').value;
        await user.click(screen.getByRole('tab', {name: '每秒'}));
        expect(sourceInput()).toHaveValue('1.50');
        expect(sourceInput('铁块', 2)).toHaveValue('0.00');
        expect(screen.getByLabelText('铁块现有产线 1工厂数量')).toHaveValue(buildings);
        expect(readStore('auto_settings').production_sources).toEqual(sources);
        await editOutput(user, 2);
        expect(readStore('auto_settings').production_sources[0]).toEqual({...sources[0], quantity_mode: 'rate', output_per_minute: 120});
        expect(readStore('auto_settings').production_sources[1]).toEqual(sources[1]);
        await user.click(screen.getByRole('tab', {name: '每分钟'}));
        expect(sourceInput()).toHaveValue('120.00');
        expect(readStore('auto_settings').production_sources[0].output_per_minute).toBe(120);
    });

    it('clears live sources on mod changes and loads only the selected game’s saved source definitions', async () => {
        const genesis = get_game_data([GenesisBookGUID]);
        const vanillaSource = source('vanilla-only');
        const modSource = source('genesis-only', {output_per_minute: 10});
        localStorage.setItem('auto_settings', JSON.stringify({production_sources: [vanillaSource]}));
        localStorage.setItem('scheme_data', JSON.stringify({
            Vanilla: {'原版来源': {...init_scheme_data(default_game_data), production_sources: [vanillaSource]}},
            [genesis.game_name]: {'创世来源': {...init_scheme_data(genesis), production_sources: [modSource]}},
        }));
        const {user, unmount} = renderApp();
        await user.click(screen.getByRole('button', {name: '原版游戏'}));
        let dialog = screen.getByRole('dialog', {name: '游戏与模组'});
        await user.click(within(dialog).getByRole('checkbox', {name: /创世之书/}));
        await user.click(within(dialog).getByRole('button', {name: '取消'}));
        expect(readStore('auto_settings').production_sources).toEqual([vanillaSource]);
        await user.click(screen.getByRole('button', {name: '原版游戏'}));
        dialog = screen.getByRole('dialog', {name: '游戏与模组'});
        await user.click(within(dialog).getByRole('checkbox', {name: /创世之书/}));
        await user.click(within(dialog).getByRole('button', {name: '应用模组'}));
        expect(readStore('auto_settings').production_sources).toEqual([]);
        expect(screen.queryByRole('article', {name: '铁块现有产线 1'})).not.toBeInTheDocument();
        await user.click(screen.getByTitle('加载生产策略'));
        expect(screen.queryByRole('menuitem', {name: '原版来源'})).not.toBeInTheDocument();
        await user.click(screen.getByRole('menuitem', {name: '创世来源'}));
        expect(readStore('auto_settings').production_sources).toEqual([modSource]);
        expect(readStore('auto_scheme')[genesis.game_name].scheme_for_recipe).toHaveLength(genesis.recipe_data.length);
        await user.click(screen.getByRole('button', {name: '1 个模组'}));
        dialog = screen.getByRole('dialog', {name: '游戏与模组'});
        await user.click(within(dialog).getByRole('checkbox', {name: /创世之书/}));
        await user.click(within(dialog).getByRole('button', {name: '应用模组'}));
        expect(readStore('auto_settings').production_sources).toEqual([]);
        expect(readStore('auto_scheme').Vanilla.scheme_for_recipe).toHaveLength(default_game_data.recipe_data.length);
        await user.click(screen.getByTitle('加载生产策略'));
        expect(screen.queryByRole('menuitem', {name: '创世来源'})).not.toBeInTheDocument();
        await user.click(screen.getByRole('menuitem', {name: '原版来源'}));
        expect(readStore('auto_settings').production_sources).toEqual([vanillaSource]);
        expect(readStore('scheme_data')[genesis.game_name]['创世来源'].production_sources).toEqual([modSource]);
        unmount();
        renderApp();
        expect(readStore('auto_settings').production_sources).toEqual([vanillaSource]);
        expect(screen.getByRole('article', {name: '铁块现有产线 1'})).toHaveAttribute('data-source-id', vanillaSource.id);
    });
});
