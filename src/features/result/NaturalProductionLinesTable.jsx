import {useContext} from 'react';
import {
    GameInfoContext,
    GlobalStateContext,
    SettingsContext,
    SettingsSetterContext
} from '../../app/providers/app-contexts.js';
import {get_factory_speed_multiplier} from '../../core/calculation/equivalentRecipe.js';
import {ItemIcon} from '../../shared/icons/ItemIcon.jsx';
import {ItemSelect} from '../../shared/selectors/ItemPickerButton.jsx';
import {FactorySelect, ProModeSelect, ProNumSelect, RecipeSelect} from './ResultRecipeSelectors.jsx';
import {AutoSizedInput} from '../../shared/ui/AutoSizedInput.jsx';

// { "目标物品": "氢", "建筑数量": 0, "配方id": 1, "增产点数": 0, "增产模式": 0, "建筑": 0 }

function NplRow({row, set_row, remove_row}) {
    const RESULT_ICON_SIZE = 40;

    // TODO performance issue (dependency loop?)
    const settings = useContext(SettingsContext);
    const game_info = useContext(GameInfoContext);
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;

    function set_row_prop(prop, is_number) {
        return function (e_or_value) {
            // Either an event [e] or a raw [value] is supported
            let value = e_or_value.target ? e_or_value.target.value : e_or_value;
            let row_new = {...row};
            if (is_number) {
                row_new[prop] = Number(value) || 0;
            } else {
                row_new[prop] = value;
            }
            set_row(row_new);
        }
    }

    function set_item(item) {
        let row_new = {...row};
        row_new["目标物品"] = item;
        row_new["配方id"] = 1;
        set_row(row_new);
    }

    let item = row["目标物品"];
    let recipe_id = game_info.item_data[item][row["配方id"]];
    let recipe = game_data.recipe_data[recipe_id];
    let selected_building = game_data.factory_data[recipe["设施"]][row["建筑"]];
    let equivalent_recipe = global_state.get_equivalent_recipe_for_natural_line(row);
    let output_num = equivalent_recipe["产物"][item] * row["建筑数量"] * selected_building["倍率"]
        * get_factory_speed_multiplier(selected_building["名称"], item, settings)
        * (settings.is_time_unit_minute ? 60 : 1) / equivalent_recipe["时间"];
    return <tr className="table-info">
        <td><a className="btn btn-sm btn-outline-primary ssmall text-nowrap mineralize-btn"
               onClick={remove_row}>删除</a></td>
        <td>
            <div className="d-inline-flex align-items-center gap-2 text-nowrap">
                {/* 目标物品 */}
                <ItemSelect item={item} set_item={set_item} icon_size={RESULT_ICON_SIZE} icon_only={true} text="选择"/>
                <span style={{lineHeight: "30px"}}>{output_num}</span>
            </div>
        </td>
        <td>
            <div className="d-flex align-items-center gap-3">
                {/* 所选工厂种类 */}
                <div className="ms-auto text-nowrap">
                    <ItemIcon item={selected_building["名称"]} size={RESULT_ICON_SIZE}/>
                </div>
                <span style={{margin: "-0.5em"}}>x</span>
                {/* 建筑数量 */}
                <AutoSizedInput value={row["建筑数量"]} onChange={set_row_prop("建筑数量", true)}/>
            </div>
        </td>
        {/* 所选配方 */}
        <td><RecipeSelect item={item}
                          choice={row["配方id"]}
                          onChange={set_row_prop("配方id", true)}
                          show_effective_recipe={settings.show_effective_recipe}
                          scheme_override={{
                              "建筑": row["建筑"],
                              "增产点数": row["增产点数"],
                              "增产模式": row["增产模式"]
                          }}/></td>
        {/* 所选增产模式 */}
        <td><ProModeSelect recipe_id={recipe_id} choice={row["增产模式"]} onChange={set_row_prop("增产模式", true)}/>
        </td>
        {/* 所选增产剂 */}
        <td><ProNumSelect choice={row["增产点数"]} onChange={set_row_prop("增产点数", true)}/></td>
        <td>
            {/* 所选工厂种类 */}
            <FactorySelect recipe_id={recipe_id} choice={row["建筑"]} onChange={set_row_prop("建筑", true)}/>
        </td>
    </tr>;
}

export function NplRows() {
    const settings = useContext(SettingsContext);
    const set_settings = useContext(SettingsSetterContext);

    const npl = settings.natural_production_line;

    function set_npl(new_npl) {
        set_settings({"natural_production_line": new_npl});
    }

    let rows = npl.map((npl_row, idx_row) => {
        function set_row(row) {
            set_npl(npl.map((current_row, current_idx) => current_idx === idx_row ? row : current_row));
        }

        function remove_row() {
            set_npl(npl.filter((_, current_idx) => current_idx !== idx_row));
        }

        return <NplRow key={idx_row} row={npl_row} set_row={set_row} remove_row={remove_row}/>;
    });

    return <>{rows}</>;
}
