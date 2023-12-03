import { useContext } from 'react';
import { GameInfoContext, UiSettingsContext, UiSettingsSetterContext } from './contexts.jsx';
import { FactorySelect, ProModeSelect, ProNumSelect, RecipeSelect } from './result.jsx';
import { ItemSelect } from './item_select.jsx';
import { AutoSizedInput } from './auto_sized_input.jsx';


// { "目标物品": "氢", "建筑数量": 0, "配方id": 1, "喷涂点数": 0, "增产模式": 0, "建筑": 0 }

function NplRow({ row, set_row, remove_row }) {
    // TODO performance issue (dependency loop?)
    const game_info = useContext(GameInfoContext);

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
        row_new["配方id"] = 0;
        set_row(row_new);
    }

    console.log("NplRow", row);
    let item = row["目标物品"];
    var recipe_id = game_info.item_data[item][row["配方id"]];

    return <tr className="table-info">
        <td><a className="a-href ssmall" onClick={remove_row}>删除</a></td>
        <td colSpan={3}>
            <div className="d-flex align-items-center gap-3">
                {/* 目标物品 */}
                <ItemSelect item={item} set_item={set_item} />
                {/* 所选工厂种类 */}
                <div className="ms-auto text-nowrap">
                    <FactorySelect recipe_id={recipe_id} choice={row["建筑"]} onChange={set_row_prop("建筑", true)} no_gap={true} />
                </div>
                <span style={{ margin: "-0.5em" }}>x</span>
                {/* 建筑数量 */}
                <AutoSizedInput value={row["建筑数量"]} onChange={set_row_prop("建筑数量", true)} />
            </div>
        </td >
        {/* 所选配方 */}
        < td > <RecipeSelect item={item} choice={row["配方id"]} onChange={set_row_prop("配方id", true)} /></td >
        {/* 所选增产剂 */}
        < td > <ProNumSelect choice={row["喷涂点数"]} onChange={set_row_prop("喷涂点数", true)} /></td >
        {/* 所选增产模式 */}
        < td > <ProModeSelect recipe_id={recipe_id} choice={row["增产模式"]} onChange={set_row_prop("增产模式", true)} /></td >
        <td></td>
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
