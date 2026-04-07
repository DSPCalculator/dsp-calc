import {useContext, useRef} from 'react';
import {Trash} from 'react-bootstrap-icons';
import {GlobalStateContext, SettingsSetterContext} from '../../app/providers/app-contexts.js';
import {ItemIcon} from '../../shared/icons/ItemIcon.jsx';
import {ItemSelect} from '../../shared/selectors/ItemPickerButton.jsx';

export function NeedsList({needs_list, set_needs_list}) {
    const global_state = useContext(GlobalStateContext);
    const count_ref = useRef(60);
    const set_settings = useContext(SettingsSetterContext);
    let item_data = global_state.item_data;
    let natural_production_line = global_state.settings.natural_production_line;
    let needs_doms = Object.entries(needs_list).map(([item, count]) => {
        function edit_count(e) {
            set_needs_list({
                ...needs_list,
                [item]: Number(e.target.value),
            });
        }

        function remove() {
            const rest_needs_list = {...needs_list};
            delete rest_needs_list[item];
            set_needs_list(rest_needs_list);
        }

        return <div key={item} className="d-inline-flex align-items-center">
            <ItemIcon item={item}/>
            <span className="ms-1 me-2">x</span>
            <div key={item} className="input-group input-group-sm w-fit d-inline-flex">
                <input type="text" className="form-control" style={{width: "6em"}} value={count} onChange={edit_count}/>
                <button className="btn btn-outline-danger d-inline-flex align-items-center" onClick={remove}>
                    <Trash/>
                </button>
            </div>
        </div>;
    });

    function add_need(item) {
        if (!(item in item_data)) {
            alert("请输入或选择正确的物品名字！");
            return;
        }
        let count = Number(count_ref.current.value);
        set_needs_list({
            ...needs_list,
            [item]: (needs_list[item] || 0) + count,
        });
    }

    function add_npl(item) {
        let count = Number(count_ref.current.value);
        let new_npl = [...natural_production_line, {
            "目标物品": item,
            "目标产量": count,
            "建筑数量": 10, "配方id": 1, "增产点数": 0, "增产模式": 0, "建筑": 0
        }];
        set_settings({"natural_production_line": new_npl});
    }

    const is_min = global_state.settings.is_time_unit_minute;

    return <>
        <div className="w-fit mt-3 d-flex align-items-center row-gap-1 flex-wrap">
            <small className="me-3 fw-bold text-nowrap">添加需求</small>
            <div className="input-group input-group-sm w-fit d-inline-flex me-5">
                <input type="text" className="form-control" style={{width: "6em"}} ref={count_ref} defaultValue={60}/>
                <span className="input-group-text">/{is_min ? "min" : "sec"}</span>
                <button className="btn btn-sm btn-outline-danger text-nowrap"
                        onClick={() => set_needs_list({})}>清空需求
                </button>
                <ItemSelect text="添加需求物品" set_item={add_need}/>
                <ItemSelect text="添加现有产线" set_item={add_npl}
                            btn_class="btn btn-sm btn-outline-success text-nowrap"/>
            </div>

            {Object.keys(needs_list).length == 0 ||
                <div className="d-inline-flex flex-wrap gap-4 row-gap-0 align-items-center flex-grow-1">
                    {needs_doms}
                </div>
            }
        </div>
    </>;
}
