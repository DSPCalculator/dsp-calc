import structuredClone from '@ungap/structured-clone';
import { useContext } from 'react';
import { GameInfoContext, GlobalStateContext, UiSettingsContext, UiSettingsSetterContext } from './contexts.jsx';
import { ItemIcon } from './icon';
import { ItemSelect } from './item_select.jsx';
import { FactorySelect, ProModeSelect, ProNumSelect, RecipeSelect } from './result.jsx';
import { AutoSizedInput } from './ui_components/auto_sized_input.jsx';

// { "目标物品": "氢", "建筑数量": 0, "配方id": 1, "喷涂点数": 0, "增产模式": 0, "建筑": 0 }

function NplRow({ row, set_row, remove_row }) {
    // TODO performance issue (dependency loop?)
    const ui_settings = useContext(UiSettingsContext);
    const game_info = useContext(GameInfoContext);
    const global_state = useContext(GlobalStateContext);
    let game_data = global_state.game_data;
    function set_row_prop(prop, is_number) {
        return function (e_or_value) {
            // Either an event [e] or a raw [value] is supported
            let value = e_or_value.target ? e_or_value.target.value : e_or_value;
            let row_new = structuredClone(row);
            if (is_number) {
                row_new[prop] = Number(value) || 0;
            } else {
                row_new[prop] = value;
            }
            set_row(row_new);
        }
    }

    function set_item(item) {
        let row_new = structuredClone(row);
        row_new["目标物品"] = item;
        row_new["配方id"] = 1;
        set_row(row_new);
    }

    function get_output_num(item, recipe, building_scale, pro_mode, pro_num) {
        let output_num = recipe["产物"][item];
        output_num *= building_scale;
        output_num *= (ui_settings.is_time_unit_minute ? 60 : 1) / recipe["时间"];
        let proliferator_data = game_data.proliferate_effect[Number(pro_num)];
        if (pro_mode == 2) {
            output_num *= proliferator_data["增产效果"];
        }
        else if (pro_mode == 1 || pro_mode == 3) {
            output_num *= proliferator_data["加速效果"];
        }
        return output_num;
    }

    console.log("NplRow", row);
    let item = row["目标物品"];
    let recipe_id = game_info.item_data[item][row["配方id"]];
    let recipe = game_data.recipe_data[recipe_id];
    let selected_building = game_data.factory_data[recipe["设施"]][row["建筑"]];
    let output_num = get_output_num(item, recipe, row["建筑数量"] * selected_building["倍率"], row["增产模式"], row["喷涂点数"]);
    return <tr className="table-info">
        <td><a className="btn btn-sm btn-outline-primary ssmall text-nowrap mineralize-btn" onClick={remove_row}>删除</a></td>
        <td>
            {/* 目标物品 */}
            <ItemSelect item={item} set_item={set_item} />
        </td>
        <td className="text-center">
            <span style={{ lineHeight: "30px" }}>{output_num}</span>
        </td>
        <td>
            <div className="d-flex align-items-center gap-3">
                {/* 所选工厂种类 */}
                <div className="ms-auto text-nowrap">
                    <ItemIcon item={selected_building["名称"]} size={30} />
                </div>
                <span style={{ margin: "-0.5em" }}>x</span>
                {/* 建筑数量 */}
                <AutoSizedInput value={row["建筑数量"]} onChange={set_row_prop("建筑数量", true)} />
            </div>
        </td>
        {/* 所选配方 */}
        <td><RecipeSelect item={item} choice={row["配方id"]} onChange={set_row_prop("配方id", true)} /></td>
        {/* 所选增产模式 */}
        <td><ProModeSelect recipe_id={recipe_id} choice={row["增产模式"]} onChange={set_row_prop("增产模式", true)} /></td>
        {/* 所选增产剂 */}
        <td><ProNumSelect choice={row["喷涂点数"]} onChange={set_row_prop("喷涂点数", true)} /></td>
        <td>
            {/* 所选工厂种类 */}
            <FactorySelect recipe_id={recipe_id} choice={row["建筑"]} onChange={set_row_prop("建筑", true)} />
        </td>
    </tr >;
}

export function NplRows() {
    const ui_settings = useContext(UiSettingsContext);
    const set_ui_settings = useContext(UiSettingsSetterContext);

    const npl = ui_settings.natural_production_line;

    function set_npl(new_npl) {
        set_ui_settings("natural_production_line", new_npl);
        console.log("set_npl", new_npl);
    }

    let rows = npl.map((npl_row, idx_row) => {
        function set_row(row) {
            let new_npl = structuredClone(npl);
            new_npl[idx_row] = row;
            set_npl(new_npl);
        }
        function remove_row() {
            let new_npl = structuredClone(npl);
            delete new_npl[idx_row];
            set_npl(new_npl);
        }
        return <NplRow key={idx_row} row={npl_row} set_row={set_row} remove_row={remove_row} />;
    });

    return <>{rows}</>;
}
