import '@testing-library/jest-dom/vitest';
import {useContext, useEffect, useRef} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CompactModeContext, ContextProvider, GlobalStateContext, NeedsListContext, NeedsListSetterContext} from '../src/contexts.jsx';
import {default_game_data} from '../src/GameData.jsx';
import {init_scheme_data} from '../src/scheme_data.jsx';
import {Result} from '../src/result.jsx';
import {TooltipProvider} from '../src/components/ui/tooltip';

let current;
beforeEach(() => { localStorage.clear(); vi.spyOn(console, 'log').mockImplementation(() => {}); HTMLElement.prototype.scrollIntoView = vi.fn(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
function Fixture({initialNeeds}) {
    const state = useContext(GlobalStateContext);
    const needs = useContext(NeedsListContext);
    const setNeeds = useContext(NeedsListSetterContext);
    const initialized = useRef(false);
    useEffect(() => { if (!initialized.current) { initialized.current = true; setNeeds(initialNeeds); } current = {state, needs, setNeeds}; }, [state, needs, setNeeds, initialNeeds]);
    return <Result needs_list={needs} set_needs_list={setNeeds} show_ore_popup={false} set_show_ore_popup={() => {}} show_building_popup={false} set_show_building_popup={() => {}}/>;
}
function mount({recipes = {石墨烯: 2}, needs = {太阳帆: 60}, mode = 'full'} = {}) {
    const scheme = init_scheme_data(default_game_data);
    Object.assign(scheme.item_recipe_choices, recipes);
    localStorage.setItem('auto_scheme', JSON.stringify({Vanilla: scheme}));
    return render(<TooltipProvider><ContextProvider><CompactModeContext.Provider value={mode}><Fixture initialNeeds={needs}/></CompactModeContext.Provider></ContextProvider></TooltipProvider>);
}
const summary = () => screen.getByRole('complementary', {name: '生产统计'}).textContent;

describe('demand-first multi-output presentation', () => {
    it.each(['full', 'compact'])('attaches unused hydrogen to the graphene process in %s view', mode => {
        mount({mode});
        expect(screen.queryByRole('region', {name: '氢生产来源'})).not.toBeInTheDocument();
        const graphene = screen.getByRole('row', {name: '石墨烯全局产线', exact: true});
        expect(within(graphene).getByLabelText('氢副产物产量')).toHaveTextContent('15.00');
        expect(within(graphene).getByText('副产物')).toBeInTheDocument();
        expect(screen.queryByText('现有产线 · 石墨烯副产')).not.toBeInTheDocument();
        expect(current.state.calculate(current.needs)[0].石墨烯).toBe(30);
    });

    it('shows a fire-ice process solved through hydrogen under demanded graphene without changing selections', async () => {
        const user = userEvent.setup();
        mount({recipes: {石墨烯: 1, 氢: 2}});
        expect(current.state.calculate(current.needs)[0].氢).toBe(15);
        expect(current.state.scheme_data.item_recipe_choices.石墨烯).toBe(1);
        expect(screen.queryByRole('row', {name: '氢全局产线', exact: true})).not.toBeInTheDocument();
        const graphene = screen.getByRole('region', {name: '石墨烯生产来源'});
        expect(within(graphene).getByLabelText('石墨烯总需求')).toHaveTextContent(/^30.00$/);
        const process = within(graphene).getByRole('article', {name: '石墨烯联产产线（氢配方）'});
        expect(within(process).getByLabelText('石墨烯联产产线（氢配方）产量')).toHaveTextContent(/^30.00$/);
        expect(within(process).getByLabelText('氢副产物产量')).toHaveTextContent(/^15.00$/);
        expect(within(process).getByRole('button', {name: '氢配方 2', exact: true})).toHaveAttribute('aria-pressed', 'true');
        const recipeId = current.state.item_data.氢[2];
        await user.click(within(process).getByRole('button', {name: '量子化工厂'}));
        expect(current.state.scheme_data.scheme_for_recipe[recipeId].建筑).toBe(1);
        expect(current.state.scheme_data.item_recipe_choices.石墨烯).toBe(1);
        const before = summary();
        await user.click(within(screen.getByRole('group', {name: '生产结果视图'})).getByRole('button', {name: '树状'}));
        expect(summary()).toBe(before);
        expect(screen.queryByRole('row', {name: '氢全局产线', exact: true})).not.toBeInTheDocument();
    });

    it('keeps demanded hydrogen visible and follows its link to the relocated physical source', async () => {
        const user = userEvent.setup();
        mount({recipes: {石墨烯: 1, 氢: 2}, needs: {太阳帆: 60, 氢: 5}});
        const hydrogen = screen.getByRole('region', {name: '氢生产来源'});
        expect(within(hydrogen).getByLabelText('氢总需求')).toHaveTextContent(/^5.00$/);
        const link = within(hydrogen).getByRole('button', {name: '查看石墨烯需求产线（氢副产来源 1）'});
        const saved = JSON.stringify(current.state.scheme_data);
        const totals = summary();
        await user.click(link);
        expect(screen.getByRole('article', {name: '石墨烯联产产线（氢配方）'})).toHaveFocus();
        expect(summary()).toBe(totals);
        expect(JSON.stringify(current.state.scheme_data)).toBe(saved);
        act(() => current.setNeeds({太阳帆: 60, 氢: 100}));
        expect(screen.queryByRole('article', {name: '石墨烯联产产线（氢配方）'})).not.toBeInTheDocument();
        expect(current.state.scheme_data.item_recipe_choices.石墨烯).toBe(1);
        expect(current.state.scheme_data.item_recipe_choices.氢).toBe(2);
        act(() => current.setNeeds({太阳帆: 60, 氢: 0}));
        expect(screen.getByRole('article', {name: '石墨烯联产产线（氢配方）'})).toBeInTheDocument();
        expect(screen.queryByRole('region', {name: '氢生产来源'})).not.toBeInTheDocument();
    });

    it('edits spray and recipe on the actual relocated source and preserves the unused selection', async () => {
        const user = userEvent.setup();
        mount({recipes: {石墨烯: 1, 氢: 2}});
        const recipeId = current.state.item_data.氢[2];
        const unusedId = current.state.item_data.石墨烯[1];
        const unused = structuredClone(current.state.scheme_data.scheme_for_recipe[unusedId]);
        await user.click(within(screen.getByRole('article', {name: '石墨烯联产产线（氢配方）'})).getByRole('button', {name: '增产', exact: true}));
        expect(current.state.scheme_data.scheme_for_recipe[recipeId].增产模式).toBe(2);
        expect(current.state.scheme_data.scheme_for_recipe[unusedId]).toEqual(unused);
        await user.click(within(screen.getByRole('article', {name: '石墨烯联产产线（氢配方）'})).getByRole('button', {name: '氢配方 1', exact: true}));
        expect(current.state.scheme_data.item_recipe_choices.氢).toBe(1);
        expect(current.state.scheme_data.item_recipe_choices.石墨烯).toBe(1);
        expect(screen.queryByRole('article', {name: '石墨烯联产产线（氢配方）'})).not.toBeInTheDocument();
    });

    it('keeps the inactive target recipe accessible without presenting it as active production', async () => {
        const user = userEvent.setup();
        mount({recipes: {石墨烯: 1, 氢: 2}});
        const route = screen.getByLabelText('石墨烯备用需求配方');
        expect(route.closest('details')).not.toHaveAttribute('open');
        await user.click(route);
        await user.click(within(route.closest('details')).getByRole('button', {name: '石墨烯配方 2', exact: true}));
        expect(current.state.scheme_data.item_recipe_choices.石墨烯).toBe(2);
        expect(current.state.scheme_data.item_recipe_choices.氢).toBe(2);
        expect(current.state.calculate(current.needs)[0].石墨烯).toBe(30);
    });

    it('applies the same orientation to plasma oil produced by the hydrogen route', () => {
        mount({recipes: {精炼油: 2, 氢: 1}, needs: {精炼油: 60}});
        expect(screen.queryByRole('row', {name: '氢全局产线', exact: true})).not.toBeInTheDocument();
        const oil = screen.getByRole('region', {name: '精炼油生产来源'});
        expect(within(oil).getByRole('article', {name: '精炼油联产产线（氢配方）'})).toBeInTheDocument();
        expect(within(oil).getByLabelText('氢副产物产量')).toHaveTextContent(/^30.00$/);
    });
});
