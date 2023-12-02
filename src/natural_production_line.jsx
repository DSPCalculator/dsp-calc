import { useContext } from 'react';
import { GameInfoContext, UiSettingsContext, UiSettingsSetterContext } from './contexts.jsx';
import { FactorySelect, ProModeSelect, ProNumSelect, RecipeSelect } from './result.jsx';


// { "目标物品": "氢", "建筑数量": 0, "配方id": 1, "喷涂点数": 0, "增产模式": 0, "建筑": 0 }

function NplRow({ row, set_row, remove_row }) {
    // TODO performance issue (dependency loop?)
    const game_info = useContext(GameInfoContext);

    function set_row_prop(prop, is_number) {
        return function (e_or_value) {
            // Both an event [e] or a raw [value] are supported
            let value = e_or_value.target ? e_or_value.target.value : e_or_value;
            let row_new = structuredClone(row);
            row_new[prop] = is_number ? (Number(value) || 1) : value;
            set_row(row_new);
        }
    }

    console.log("NplRow", row);
    let item = row["目标物品"];
    var recipe_id = game_info.item_data[item][row["配方id"]];

    return <tr>
        {/* 目标物品 */}
        <td><input list="item_list" value={item} onChange={set_row_prop("目标物品")} /></td>
        {/* 建筑数量 */}
        <td><input size={4} value={row["建筑数量"]} onChange={set_row_prop("建筑数量", true)} /></td>
        {/* 所选配方 */}
        <td><RecipeSelect item={item} choice={row["配方id"]} onChange={set_row_prop("配方id", true)} /></td>
        {/* 所选增产剂 */}
        <td><ProNumSelect choice={row["喷涂点数"]} onChange={set_row_prop("喷涂点数", true)} /></td>
        {/* 所选增产模式 */}
        <td><ProModeSelect recipe_id={recipe_id} choice={row["增产模式"]} onChange={set_row_prop("增产模式", true)} /></td>
        {/* 所选工厂种类 */}
        <td><FactorySelect recipe_id={recipe_id} choice={row["建筑"]} onChange={set_row_prop("建筑", true)} /></td>
        <td><button onClick={remove_row}>删除</button></td>
    </tr>;
}

export function NaturalProductionLine() {
    const ui_settings = useContext(UiSettingsContext);
    const set_ui_settings = useContext(UiSettingsSetterContext);

    const npl = ui_settings.natural_production_line;

    function set_npl(new_npl) {
        set_ui_settings("natural_production_line", new_npl);
        console.log("set_npl", new_npl);
    }

    function add() {
        let new_npl = structuredClone(npl);
        new_npl.push({
            "目标物品": "氢", "建筑数量": 0,
            "配方id": 1, "喷涂点数": 0, "增产模式": 0, "建筑": 0
        });
        set_npl(new_npl);
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

    return <span>固有产线：<button onClick={add}>添加固有产线</button>
        <table>
            <thead>
                <tr>
                    <th>目标物品</th>
                    <th>建筑数量</th>
                    <th>配方选取</th>
                    <th>喷涂点数</th>
                    <th>增产模式选择</th>
                    <th>工厂类型选择</th>
                    <th></th>
                </tr>
            </thead>
            <tbody>{rows}</tbody>
        </table></span>;
}
