import {ItemIcon} from '../../shared/icons/ItemIcon';
import {FactorySelect, ProModeSelect, ProNumSelect, RecipeSelect} from './ResultRecipeSelectors';
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
    onUnmineralize,
    result_amount,
}) {
    return <tr className={row.row_class}>
        <td>
            {row.is_mineralized ?
                <button className="btn btn-sm btn-outline-primary ssmall text-nowrap mineralize-btn"
                        onClick={() => onUnmineralize(row.item_name)}>恢复</button> :
                <button className="btn btn-sm btn-outline-primary ssmall text-nowrap mineralize-btn"
                        onClick={() => onMineralize(row.item_name)}>
                    <div>视为</div>
                    <div>原矿</div>
                </button>
            }
        </td>
        <td className="text-nowrap">
            <div className="d-inline-flex align-items-center gap-1">
                <ItemIcon item={row.item_name} size={RESULT_ICON_SIZE}/>
                <ResultRatioInput fixed_num={fixed_num}
                                  needs_list={needs_list}
                                  set_needs_list={set_needs_list}
                                  value={getGrossOutput(result_amount, item_graph, row.item_name)}/>
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
        <td><RecipeSelect item={row.item_name}
                          onChange={onChangeRecipe}
                          show_effective_recipe={settings.show_effective_recipe}
                          choice={row.recipe_choice}/></td>
        <td><ProModeSelect recipe_id={row.recipe_id}
                           onChange={onChangeProMode}
                           choice={row.proliferator_mode}/></td>
        <td><ProNumSelect onChange={onChangeProNum}
                          choice={row.proliferator_points}/></td>
        <td><FactorySelect recipe_id={row.recipe_id}
                           onChange={onChangeFactory}
                           choice={row.building_choice}/></td>
    </tr>;
}
