import '@testing-library/jest-dom/vitest';
import {useContext} from 'react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {cleanup, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {CompactModeContext, ContextProvider, GlobalStateContext} from '../src/contexts.jsx';
import {ByproductSourceCard, ProductionSourceCard, ProductionSourceGroup} from '../src/natural_production_line.jsx';
import {describeRecipe} from '../src/recipe.jsx';
import {TooltipProvider} from '../src/components/ui/tooltip';

beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const noop = () => {};
const source = {id: 'iron-a', target_item: '铁块', output_per_minute: 150};
const defaults = {
    item: '铁块', source, ordinal: 1, output: 150, buildings: 2.5,
    factory_name: '电弧熔炉', recipe_choice: 1, building: 0,
    proliferator_mode: 0, proliferator_points: 0,
    onOutputChange: noop, onRecipeChange: noop, onFactoryChange: noop,
    onModeChange: noop, onPointsChange: noop, onRemove: noop,
};

function Provider({children, mode = 'full'}) {
    return <TooltipProvider><ContextProvider><CompactModeContext.Provider value={mode}>
        {children}
    </CompactModeContext.Provider></ContextProvider></TooltipProvider>;
}
function Source(props) { return <ProductionSourceCard {...defaults} {...props}/>; }
function Group({children}) {
    return <ProductionSourceGroup item="铁块" group={{automatic: 0, allocated: 350, surplus: 50}}
        totalControl={<output aria-label="铁块总需求">300.00</output>} onAdd={noop}>
        {children}
    </ProductionSourceGroup>;
}

const fieldNames = ['identity', 'output', 'buildings', 'recipe', 'mode', 'proliferator', 'factory', 'remove'];

describe('horizontal production source strips', () => {
    it.each(['full', 'compact', 'narrow', 'mobile'])('puts all source fields in the same horizontal strip in %s mode', mode => {
        render(<Provider mode={mode}><Group><Source automatic/><Source/></Group></Provider>);
        const strip = screen.getByRole('article', {name: '铁块现有产线 1'});
        expect(strip).toHaveClass('grid', 'grid-cols-[repeat(8,max-content)]', 'w-max', 'shrink-0', 'text-base', 'py-4');
        expect(strip).not.toHaveClass('flex-col', 'w-96');
        // Every control occupies its own column, rather than a nested vertical card body.
        expect(Array.from(strip.children, field => field.dataset.sourceField)).toEqual(fieldNames);
        for (const field of strip.children) expect(field).toHaveClass('space-y-1.5');
        expect(strip).toHaveAttribute('data-source-id', 'iron-a');
        expect(strip).toHaveAttribute('data-source-kind', 'manual');
        const automatic = screen.getByRole('article', {name: '铁块需求产线'});
        expect(automatic).toHaveAttribute('data-source-id', 'auto:铁块');
        expect(within(automatic).queryByRole('button', {name: /删除/})).not.toBeInTheDocument();
        expect(within(automatic).getByLabelText('铁块需求产线产量')).toHaveTextContent('150.00');
        expect(within(strip).getByRole('textbox', {name: /分配产量/})).toHaveClass('text-base');
        const count = within(strip).getByLabelText('铁块现有产线 1工厂数量');
        expect(count.parentElement.querySelector('[role="img"]')).toHaveStyle({width: '30px', height: '30px'});
        for (const button of [within(strip).getByRole('button', {name: '位面熔炉'}), within(strip).getByRole('button', {name: /增产剂\s+Mk\.II$/})]) {
            expect(button.querySelector('[role="img"]')).toHaveStyle({width: '32px', height: '32px'});
        }
        for (const icon of strip.querySelectorAll('.dsp-full-recipe .dsp-recipe-ingredient [role="img"]')) {
            expect(icon).toHaveStyle({width: '28px', height: '28px'});
        }
        expect(screen.getByRole('region', {name: '铁块生产来源'}).querySelector('[role="img"]')).toHaveStyle({width: '40px', height: '40px'});
    });

    it('keeps every source control reachable and passes the original callback values', async () => {
        const user = userEvent.setup();
        const handlers = Object.fromEntries(['onOutputChange', 'onRecipeChange', 'onFactoryChange', 'onModeChange', 'onPointsChange', 'onRemove'].map(name => [name, vi.fn()]));
        render(<Provider><Source {...handlers}/></Provider>);
        const strip = screen.getByRole('article', {name: '铁块现有产线 1'});
        const input = within(strip).getByRole('textbox', {name: '铁块现有产线 1分配产量'});
        await user.clear(input);
        await user.type(input, '180');
        await user.keyboard('{Enter}');
        expect(handlers.onOutputChange).toHaveBeenCalledWith('180');
        await user.click(within(strip).getByRole('button', {name: '铁块配方 2', exact: true}));
        expect(handlers.onRecipeChange).toHaveBeenCalledWith(2);
        await user.click(within(strip).getByRole('button', {name: '位面熔炉'}));
        expect(handlers.onFactoryChange).toHaveBeenCalledWith(1);
        await user.click(within(strip).getByRole('button', {name: '增产', exact: true}));
        expect(handlers.onModeChange).toHaveBeenCalledWith('2');
        await user.click(within(strip).getByRole('button', {name: /增产剂\s+Mk\.II$/}));
        expect(handlers.onPointsChange).toHaveBeenCalledWith(2);
        await user.click(within(strip).getByRole('button', {name: '删除铁块现有产线 1'}));
        expect(handlers.onRemove).toHaveBeenCalledOnce();
    });

    it('stacks multiple source strips vertically with separate group totals and narrow-screen access', () => {
        render(<Provider><Group><Source automatic output={0}/><Source/><Source ordinal={2} source={{...source, id: 'iron-b'}}/></Group></Provider>);
        const group = screen.getByRole('region', {name: '铁块生产来源'});
        expect(group).toHaveClass('w-max', 'min-w-0', 'max-w-[calc(100vw-3rem)]');
        const scroller = within(group).getByRole('region', {name: '铁块产线，可横向滚动'});
        expect(scroller).toHaveClass('flex', 'flex-col', 'min-w-0', 'max-w-full', 'overflow-x-auto', 'overscroll-x-contain', 'focus-visible:outline-2');
        expect(scroller).toHaveAttribute('tabindex', '0');
        expect(scroller).not.toHaveClass('flex-nowrap');
        expect(within(scroller).getAllByRole('article').map(strip => strip.dataset.sourceId)).toEqual(['auto:铁块', 'iron-a', 'iron-b']);
        expect(within(scroller).queryByLabelText('铁块总需求')).not.toBeInTheDocument();
        expect(within(group).getByLabelText('铁块总需求')).toHaveTextContent('300.00');
        expect(within(group).getByLabelText('铁块合计生产')).toHaveTextContent('350.00 / min');
        const surplus = within(group).getByText(/超额分配/);
        expect(surplus).toHaveAttribute('role', 'status');
        expect(surplus).toHaveTextContent('超额分配 / 多余产物 50.00 / min，需求产线已降至 0');
        scroller.focus();
        expect(scroller).toHaveFocus();
    });

    it('keeps long recipe details complete and an invalid-source error readable without stacking control columns', () => {
        const longRecipe = {原料: {'铁块': 2, '铜块': 3, '硅石': 4, '电路板': 5}, 产物: {'铁块': 6, '石材': 7}, 时间: 6.25};
        function LongRecipeSource() {
            const state = useContext(GlobalStateContext);
            const recipeId = state.item_data['铁块'][1];
            const recipes = state.game_data.recipe_data.map((recipe, index) => index === recipeId ? {...recipe, ...longRecipe} : recipe);
            return <GlobalStateContext.Provider value={{...state, game_data: {...state.game_data, recipe_data: recipes}}}>
                <Source source={{...source, error: '来源配方已失效，请重新选择完整的生产配方'}}/>
            </GlobalStateContext.Provider>;
        }
        render(<Provider><LongRecipeSource/></Provider>);
        const strip = screen.getByRole('article', {name: '铁块现有产线 1'});
        const description = describeRecipe(longRecipe);
        const recipe = within(strip).getByTitle(description);
        expect(recipe).toHaveAccessibleName(description);
        expect(recipe).toHaveClass('flex-wrap', 'max-w-72');
        for (const count of ['2', '3', '4', '5', '6', '7']) {
            expect(within(recipe).getByText(count, {exact: true})).toBeVisible();
        }
        expect(within(recipe).getByText('6.25s')).toBeVisible();
        expect(within(strip).getByRole('button', {name: '铁块配方 1', exact: true})).toHaveAttribute('aria-description', description);
        const alert = within(strip).getByRole('alert');
        expect(alert).toHaveTextContent('来源配方已失效，请重新选择完整的生产配方');
        expect(alert).toHaveClass('col-span-full', 'whitespace-normal', 'break-words', 'text-base');
        expect(strip.lastElementChild).toBe(alert);
        expect(Array.from(strip.querySelectorAll(':scope > [data-source-field]'), field => field.dataset.sourceField)).toEqual(fieldNames);
        expect(within(strip).getByRole('button', {name: '删除铁块现有产线 1'})).toBeVisible();
    });
});


describe('read-only coproduct navigation', () => {
    it('does not offer a no-op jump when the physical parent has no visible row', () => {
        render(<Provider><ByproductSourceCard item="氢" ordinal={1} source={{parentItem: '石墨烯', parentKind: 'legacy',
            parentSourceId: 'legacy-hidden', output: 60}}/></Provider>);
        const card = screen.getByRole('article', {name: '氢副产来源 1'});
        expect(within(card).getByText('来源产线未显示')).toBeInTheDocument();
        expect(within(card).queryByRole('button')).not.toBeInTheDocument();
        expect(within(card).getByLabelText('氢副产来源 1产量')).toHaveTextContent('60.00');
    });
});
