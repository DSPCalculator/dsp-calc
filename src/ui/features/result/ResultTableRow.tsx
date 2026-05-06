import {ItemIcon} from '@ui/components/icons/ItemIcon';
import {FactorySelect, ProModeSelect, ProNumSelect, RecipeSelect} from './ResultRecipeSelectors';
import {Recipe} from './RecipeDisplay';
import {ResultRatioInput} from './ResultRatioInput';
import {getGrossOutput} from './resultGraphHelpers';

export function ResultTableRow({
    RESULT_ICON_SIZE,
    fixed_num,
    item_graph,
    needs_list,
    row,
    set_needs_list,
    settings,
    onChangeFactory,
    onChangeProMode,
    onChangeProNum,
    onChangeRecipe,
    onMineralize,
    onSplitProductionLine,
    onUnmineralize,
    result_amount,
}) {
    const gross_output = getGrossOutput(result_amount, item_graph, row.item_name);
    const mineralized_recipe = {
        名称: `${row.item_name}原矿化补充`,
        原料: {},
        产物: {[row.item_name]: 1},
        时间: 1,
    };

    return <tr className={row.row_class}>
        <td>
            <div className="d-inline-flex flex-column gap-1">
                {row.is_mineralized ?
                    <button className="btn btn-sm btn-outline-primary ssmall text-nowrap mineralize-btn"
                            onClick={() => onUnmineralize(row.item_name)}>恢复</button> :
                    <button className="btn btn-sm btn-outline-primary ssmall text-nowrap mineralize-btn"
                            onClick={() => onMineralize(row.item_name)}>
                        <div>视为</div>
                        <div>原矿</div>
                    </button>
                }
                <button className="btn btn-sm btn-outline-success ssmall text-nowrap mineralize-btn"
                        title="清空当前需求，并把此项作为新的生产目标"
                        onClick={() => onSplitProductionLine(row.item_name, gross_output)}>
                    <div>拆分</div>
                    <div>产线</div>
                </button>
            </div>
        </td>
        <td className="text-nowrap">
            <div className="d-inline-flex align-items-center gap-1">
                <ItemIcon item={row.item_name} size={RESULT_ICON_SIZE}/>
                <ResultRatioInput fixed_num={fixed_num}
                                  needs_list={needs_list}
                                  set_needs_list={set_needs_list}
                                  value={gross_output}/>
            </div>
            {row.from_side_products.map(({from, amount_text}) => (
                <div key={from} className="text-nowrap">
                    <ItemIcon item={from} size={RESULT_ICON_SIZE}/> +{amount_text}
                </div>
            ))}
        </td>
        <td className="text-nowrap">
            {row.is_mineralized ||
                <div className="d-inline-flex align-items-center gap-1">
                    <ItemIcon item={row.factory_name} size={RESULT_ICON_SIZE}/>
                    <ResultRatioInput fixed_num={fixed_num}
                                      needs_list={needs_list}
                                      set_needs_list={set_needs_list}
                                      value={row.factory_number}/>
                </div>
            }
        </td>
        <td>
            {row.is_mineralized ? <div className="px-2 py-0"><Recipe recipe={mineralized_recipe}/></div> :
                <RecipeSelect item={row.item_name}
                              onChange={onChangeRecipe}
                              show_effective_recipe={settings.show_effective_recipe}
                              choice={row.recipe_choice}/>}
        </td>
        <td>{row.is_mineralized ||
            <ProModeSelect recipe_id={row.recipe_id}
                           onChange={onChangeProMode}
                           choice={row.proliferator_mode}/>}</td>
        <td><ProNumSelect includeNone={row.is_mineralized}
                          onChange={onChangeProNum}
                          choice={row.proliferator_points}/></td>
        <td>{row.is_mineralized ||
            <FactorySelect recipe_id={row.recipe_id}
                           onChange={onChangeFactory}
                           choice={row.building_choice}/>}</td>
    </tr>;
}
