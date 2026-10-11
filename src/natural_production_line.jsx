import {useContext} from 'react';
import {GlobalStateContext} from './contexts.jsx';
import {ItemIcon} from './icon';
import {FactorySelect, ProModeSelect, ProNumSelect, RecipeSelect} from './result.jsx';
import {AutoSizedInput} from './ui_components/auto_sized_input.jsx';
import {Button} from './components/ui/button';
import {Badge} from './components/ui/badge';
import {cn} from './lib/utils';
import {Recipe} from './recipe.jsx';
import {ProductionRowInstanceContext} from './production_result_row.jsx';
import {toDisplayRate} from './production_sources.js';

/** Saved demand-bound allocations remain available without creating phantom rows. */
export function PausedProductionSources({sources, onEnable, onRemove}) {
    const {settings} = useContext(GlobalStateContext);
    if (!sources?.length) return null;
    const unit = settings.is_time_unit_minute ? 'min' : 's';
    return <details className="dsp-paused-sources rounded-lg border bg-muted/20 px-3 py-2 text-base">
        <summary className="cursor-default rounded-sm text-muted-foreground focus-visible:outline-2 focus-visible:outline-ring">
            已暂停{sources.length}条未被当前需求使用的来源
        </summary>
        <div className="mt-3 space-y-2">
            <p className="text-base text-muted-foreground">配方与分配产量已保留；再次需要该物品时自动恢复，也可作为独立产线启用</p>
            <ul className="space-y-2">
                {sources.map((source, index) => <li key={source.id} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-md border bg-background px-2 py-2"
                    aria-label={`已暂停来源 ${index + 1} ${source.target_item}`}>
                    <span className="inline-flex items-center gap-2"><ItemIcon item={source.target_item} size={24}/>
                        <span>{source.target_item} · {toDisplayRate(source.output_per_minute, settings).toFixed(settings.fixed_num)} / {unit}</span>
                    </span>
                    <span className="inline-flex flex-wrap items-center gap-2">
                        <Button type="button" variant="outline" size="sm" className="text-base" onClick={() => onEnable(source.id)}>作为独立产线启用</Button>
                        <Button type="button" variant="ghost" size="sm" className="text-base text-muted-foreground hover:text-destructive"
                            aria-label={`删除已暂停来源 ${index + 1} ${source.target_item}`} onClick={() => onRemove(source.id)}>删除</Button>
                    </span>
                </li>)}
            </ul>
        </div>
    </details>;
}

/** A production source owns its own recipe and equipment, but stays in its product group. */
export function ProductionSourceCard({item, source, automatic, ordinal, output, buildings, factory_name,
    recipe_choice, recipe_id, building, proliferator_mode, proliferator_points,
    onOutputChange, onBuildingsChange, onRecipeChange, onRecipeFork, onFactoryChange, onModeChange, onPointsChange, onRemove,
    is_mineralized = false, sharedGroup, controlItem = item, physicalSourceId, outputByproducts, onAddByproductSource}) {
    const {settings, game_data, item_data} = useContext(GlobalStateContext);
    const knownItem = Object.hasOwn(item_data, controlItem);
    const displayRecipeId = recipe_id ?? (knownItem ? item_data[controlItem]?.[recipe_choice] ?? item_data[controlItem]?.[1] : undefined);
    const validRecipe = Boolean(knownItem && game_data.recipe_data[displayRecipeId]);
    const fixed = settings.fixed_num;
    const unit = settings.is_time_unit_minute ? 'min' : 's';
    const label = automatic ? controlItem === item ? '需求产线' : `联产产线（${controlItem}配方）` : `现有产线 ${ordinal}`;
    const name = `${item}${label}`;
    const quantityMode = source?.quantity_mode === 'buildings' ? 'buildings' : 'rate';
    const actualRecipeId = knownItem && Number.isInteger(Number(recipe_choice)) && Number(recipe_choice) >= 1
        ? item_data[controlItem]?.[recipe_choice] : undefined;
    const actualRecipe = game_data.recipe_data[actualRecipeId];
    const factory = actualRecipe && game_data.factory_data[actualRecipe.设施]?.[building];
    const countUnavailable = is_mineralized ? '外部供给，无需工厂'
        : !factory || !Number.isFinite(Number(factory.倍率)) || Number(factory.倍率) <= 0 ? '请先选择有效的配方与工厂类型' : null;
    const quantityHint = quantityMode === 'buildings' ? '固定工厂数量，产量随配方、工厂与增产设置计算；编辑产量可改为固定产量'
        : '固定分配产量，工厂数量随配方、工厂与增产设置计算；编辑工厂数量可改为固定数量';
    const selectedCount = quantityMode === 'buildings' && Number.isFinite(Number(source?.building_quantity))
        ? Number(source.building_quantity) : buildings || 0;

    // Each field is a column in one source strip. Only recipes and error text may
    // wrap within their own field; additional sources stack beneath this one.
    return <article className={cn('dsp-source-card dsp-source-strip grid w-max shrink-0 grid-cols-[repeat(8,max-content)] items-start gap-x-5 gap-y-3 rounded-lg border bg-background px-3 py-4 text-base', automatic && 'bg-muted/20')}
        tabIndex={-1} aria-label={name} data-source-id={physicalSourceId || (automatic ? `auto:${item}` : source.id)} data-source-kind={automatic ? 'automatic' : 'manual'}
        data-quantity-mode={automatic ? undefined : quantityMode} aria-description={automatic ? undefined : quantityHint}>
        <div data-source-field="identity" className="space-y-1.5 whitespace-nowrap">
            <h3 className="font-medium">{label}</h3>
            <div className="flex min-h-12 items-center">
                <Badge variant={automatic ? 'secondary' : 'outline'} className="px-1.5 py-0.5 text-base font-normal">{sharedGroup ? '共享采集' : automatic ? '补足剩余' : '独立分配'}</Badge>
                {sharedGroup && <span className="text-xs text-muted-foreground">同组共 {sharedGroup.building_count} 台</span>}
            </div>
        </div>
        <div data-source-field="output" className="space-y-1.5 whitespace-nowrap">
            <p className="text-base text-muted-foreground" title={automatic ? undefined : quantityHint}>{automatic ? '自动承担' : '分配产量'}
                {!automatic && quantityMode === 'rate' && <span className="text-xs"> · 固定</span>}</p>
            <div className="flex min-h-12 items-center gap-1.5 tabular-nums">
                {automatic ? <output aria-label={`${name}产量`} className="text-base font-semibold">{(output || 0).toFixed(fixed)}</output>
                    : <AutoSizedInput delayed value={(output || 0).toFixed(fixed)} onChange={onOutputChange} aria-label={`${name}分配产量`}/>}
                <span className="text-base text-muted-foreground">/ {unit}</span>
            </div>
        </div>
        <div data-source-field="buildings" className="space-y-1.5 whitespace-nowrap">
            <p className="text-base text-muted-foreground" title={automatic ? undefined : quantityHint}>{sharedGroup ? '采集需求折算' : '工厂数量'}
                {!automatic && quantityMode === 'buildings' && <span className="text-xs"> · 固定</span>}</p>
            <div className="flex min-h-12 items-center gap-1.5 tabular-nums">
                {automatic && is_mineralized ? <span className="text-muted-foreground" title={countUnavailable}>外部供给</span> : <>
                    {factory_name && <ItemIcon item={factory_name} size={30}/>}
                    {automatic ? <output aria-label={`${name}工厂数量`} className="text-base">{(buildings || 0).toFixed(fixed)}</output>
                        : <AutoSizedInput delayed value={countUnavailable ? '—' : selectedCount.toFixed(fixed)} onChange={onBuildingsChange}
                            disabled={Boolean(countUnavailable)} aria-label={`${name}工厂数量`}
                            aria-description={countUnavailable || (sharedGroup ? `${quantityHint}；氢与重氢共享同一组采集器，数量不相加` : quantityHint)} title={countUnavailable || (sharedGroup ? `${quantityHint}；氢与重氢共享同一组采集器，数量不相加` : quantityHint)}/>}
                </>}
            </div>
        </div>
        {validRecipe && <><div data-source-field="recipe" className="space-y-1.5"><p className="text-base text-muted-foreground">配方选取</p>
            {controlItem !== item && <p className="max-w-80 whitespace-normal text-sm text-muted-foreground">此联产来源沿用{controlItem}的配方设置；修改会更新实际来源产线。</p>}
            <RecipeSelect item={controlItem} choice={recipe_choice} onChange={onRecipeChange} onFork={onRecipeFork} compact="full"/>
        </div>
        <div data-source-field="mode" className="space-y-1.5"><p className="text-base text-muted-foreground">增产模式</p>
            <ProModeSelect recipe_id={displayRecipeId} choice={proliferator_mode} onChange={onModeChange}/>
        </div>
        <div data-source-field="proliferator" className="space-y-1.5"><p className="text-base text-muted-foreground">增产剂</p>
            <ProNumSelect icon_size={32} choice={proliferator_points} onChange={onPointsChange}/>
        </div>
        <div data-source-field="factory" className="space-y-1.5"><p className="text-base text-muted-foreground">工厂类型</p>
            <FactorySelect icon_size={32} recipe_id={displayRecipeId} choice={building} onChange={onFactoryChange}/>
        </div></>}
        {!automatic && <div data-source-field="remove" className="space-y-1.5">
            <p className="text-base text-muted-foreground">操作</p>
            <div className="flex min-h-12 items-center"><Button type="button" variant="ghost" size="sm" className="h-8 px-1.5 text-base text-muted-foreground hover:text-destructive"
                aria-label={`删除${name}`} onClick={onRemove}>删除</Button></div>
        </div>}
        {source?.error && <p role="alert" className="col-span-full max-w-5xl whitespace-normal break-words text-base text-destructive">{source.error}</p>}
        {outputByproducts && <div className="col-span-full"><ProductionByproducts products={outputByproducts} onAddSource={onAddByproductSource}/></div>}
    </article>;
}

/** Outputs belong to their physical source, including entirely unused surplus. */
export function ProductionByproducts({products, onAddSource}) {
    const rowInstance = useContext(ProductionRowInstanceContext);
    const {settings} = useContext(GlobalStateContext);
    const entries = Object.entries(products || {}).filter(([, amount]) => amount > 1e-8);
    if (!entries.length) return null;
    return <div className="dsp-production-byproducts mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
        <span>{rowInstance ? '全局副产物' : '副产物'}</span>{entries.map(([item, amount]) => <span key={item} className="inline-flex items-center gap-1 whitespace-nowrap">
            <ItemIcon item={item} size={20} tooltip={false}/><span>{item}</span>
            <output aria-label={`${item}副产物产量`} className="tabular-nums">{amount.toFixed(settings.fixed_num)}</output>
            <span>/ {settings.is_time_unit_minute ? 'min' : 's'}</span>
            {onAddSource && <Button type="button" variant="ghost" size="sm" className="h-6 px-1 text-xs" aria-label={`为${item}副产物添加独立产线`} onClick={() => onAddSource(item)}>＋ 产线</Button>}
        </span>)}
    </div>;
}

/** A read-only reference to output already credited by the calculation. */
export function ByproductSourceCard({item, source, ordinal, onShowParent}) {
    const {settings, game_data} = useContext(GlobalStateContext);
    const unit = settings.is_time_unit_minute ? 'min' : 's';
    const parentLabel = source.parentKind === 'automatic' ? '需求产线'
        : source.parentKind === 'legacy' ? '原有产线' : `现有产线 ${source.ordinal}`;
    const recipe = game_data.recipe_data[source.recipeId];
    return <article aria-label={`${item}副产来源 ${ordinal}`} data-source-kind="byproduct"
        data-parent-source-id={source.parentSourceId}
        className="dsp-byproduct-source flex w-max max-w-5xl flex-wrap items-center gap-x-6 gap-y-3 rounded-lg border border-dashed bg-muted/20 px-3 py-3 text-base">
        <div className="space-y-1">
            <h3 className="flex items-center gap-2 font-medium"><ItemIcon item={item} size={28} tooltip={false}/>
                {source.sharedCollector ? '同组轨道采集' : <>{item}副产物 · 来自{source.parentItem}产线</>}</h3>
            <p className="text-sm text-muted-foreground">{source.sharedCollector ? '氢与重氢联合产出，已计入供给' : `${parentLabel} · 已计入供给，随来源产线更新`}</p>
        </div>
        <div className="flex items-center gap-1.5 tabular-nums"><ItemIcon item={item} size={24} tooltip={false}/>
            <output aria-label={`${item}副产来源 ${ordinal}产量`} className="font-semibold">{source.output.toFixed(settings.fixed_num)}</output>
            <span className="text-muted-foreground">/ {unit}</span>
        </div>
        {recipe && !source.sharedCollector && <div className="max-w-96" aria-label={`${item}副产来源 ${ordinal}原配方`}><Recipe recipe={recipe} compact="full"/></div>}
        <div className="space-y-1">
            {onShowParent ? <Button type="button" variant="outline" size="sm" className="h-9 gap-1.5 text-base"
                aria-label={`查看${source.parentItem}${parentLabel}（${item}副产来源 ${ordinal}）`} onClick={onShowParent}>
                {source.factoryName && <ItemIcon item={source.factoryName} size={24} tooltip={false}/>}
                查看来源产线
            </Button> : <span className="text-sm text-muted-foreground">来源产线未显示</span>}
            <p className="text-xs text-muted-foreground">{source.sharedCollector ? '共享采集器在合计中只计一次' : '工厂与耗电只在来源处计数'}</p>
        </div>
    </article>;
}

export function ProductionSourceGroup({item, group, totalControl, onAdd, mineralizeControl, linkedByproductSupply, children}) {
    const rowInstance = useContext(ProductionRowInstanceContext);
    const {settings} = useContext(GlobalStateContext);
    const fixed = settings.fixed_num;
    const unit = settings.is_time_unit_minute ? 'min' : 's';
    const produced = group.automatic + group.allocated + (group.byproduct_supply || 0);
    const byproductSupply = linkedByproductSupply ?? (group.byproduct_supply || 0);
    const externalSupply = Math.max(0, (group.byproduct_supply || 0) - byproductSupply);

    return <section id={`${rowInstance ? `${rowInstance}-` : ''}production-sources-${item}`} tabIndex={-1} aria-label={`${item}生产来源`} className="dsp-source-group w-max min-w-0 max-w-[calc(100vw-3rem)] scroll-mt-20 space-y-3 py-1 text-base">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                <div className="flex items-center gap-2"><ItemIcon item={item} size={40} tooltip={false}/><h3 className="text-base font-semibold">{item}</h3></div>
                <div className="flex flex-wrap items-center gap-1.5"><span className="text-base text-muted-foreground">总需求</span>{totalControl}<span className="text-base text-muted-foreground">/ {unit}</span></div>
            </div>
            <div className="flex items-center gap-2">{mineralizeControl}<Button type="button" variant="outline" size="sm" className="h-9 px-2 text-base"
                aria-label={`添加${item}产线`} onClick={onAdd}>＋ 添加产线</Button></div>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-base text-muted-foreground">
            <span aria-label={`${item}合计生产`}>合计生产 {produced.toFixed(fixed)} / {unit}</span>
            {byproductSupply > 1e-6 && <span>含副产物供给 {byproductSupply.toFixed(fixed)} / {unit}</span>}
            {externalSupply > 1e-6 && <span>含外部供给 {externalSupply.toFixed(fixed)} / {unit}</span>}
            {group.surplus > 1e-6 && <span role="status" className="font-medium text-amber-700 dark:text-amber-400">超额分配 / 多余产物 {group.surplus.toFixed(fixed)} / {unit}{group.automatic < 1e-6 ? '，需求产线已降至 0' : ''}</span>}
        </div>
        <div role="region" aria-label={`${item}产线，可横向滚动`} tabIndex={0}
            className="dsp-source-cards flex flex-col min-w-0 max-w-full items-start gap-3 overflow-x-auto overscroll-x-contain pb-2 focus-visible:outline-2 focus-visible:outline-ring">
            {children}
        </div>
    </section>;
}

export function SharedCollectorsSummary({groups}) {
    const {settings} = useContext(GlobalStateContext);
    if (!groups?.some(group => group.buildings > 1e-8)) return null;
    const unit = settings.is_time_unit_minute ? 'min' : 's';
    return <section aria-label="共享轨道采集" className="space-y-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
        {groups.filter(group => group.buildings > 1e-8).map(group => <div key={group.id} data-shared-collector-id={group.id} className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="inline-flex items-center gap-1.5 font-medium"><ItemIcon item={group.factory_name} size={24} tooltip={false}/>气态巨星共享采集</span>
            <span>合计配置 <output aria-label="共享轨道采集数量" className="font-semibold tabular-nums">{group.building_count}</output> 台（需求折算 {group.buildings.toFixed(settings.fixed_num)} 台）</span>
            {group.items.map(item => <span key={item} className="inline-flex items-center gap-1.5"><ItemIcon item={item} size={20} tooltip={false}/>{item}
                <output aria-label={`共享采集${item}产量`} className="tabular-nums">{(group.outputs[item] || 0).toFixed(settings.fixed_num)}</output> / {unit}</span>)}
            <span className="text-muted-foreground">按同一气态巨星面板共同采集，氢与重氢数量不相加</span>
        </div>)}
    </section>;
}
