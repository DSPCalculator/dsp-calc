import structuredClone from '@ungap/structured-clone';
import {useContext, useEffect, useRef, useState} from 'react';
import {Trash} from 'react-bootstrap-icons';
import {GameInfoContext, GlobalStateContext, SettingsSetterContext} from './contexts';
import {ItemIcon} from './icon';
import {ItemSelect} from './item_select';

function get_item_data(game_data) {
    //通过读取配方表得到配方中涉及的物品信息，item_data中的键名为物品名，键值为
    //此物品在计算器中的id与用于生产此物品的配方在配方表中的序号
    var item_data = {};
    var i = 0;
    for (var num = 0; num < game_data.recipe_data.length; num++) {
        for (var item in game_data.recipe_data[num].产物) {
            if (!(item in item_data)) {
                item_data[item] = [i];
                i++;
            }
            item_data[item].push(num);
        }
    }
    return item_data;
}

export function NeedsList({needs_list, set_needs_list}) {
    const global_state = useContext(GlobalStateContext);
    const count_ref = useRef(60);
    const set_settings = useContext(SettingsSetterContext);
    let game_data = global_state.game_data;
    let item_data = get_item_data(game_data);
    let natural_production_line = global_state.settings.natural_production_line;
    let needs_doms = Object.entries(needs_list).map(([item, count]) => {
        function edit_count(e) {
            let new_needs_list = structuredClone(needs_list);
            new_needs_list[item] = Number(e.target.value);
            set_needs_list(new_needs_list);
        }

        function remove() {
            let new_needs_list = structuredClone(needs_list);
            delete new_needs_list[item];
            set_needs_list(new_needs_list);
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
        </div>
    });

    function add_need(item) {
        if (!(item in item_data)) {
            alert("请输入或选择正确的物品名字！");
            return;
        }
        let count = Number(count_ref.current.value);
        let new_needs_list = structuredClone(needs_list);
        new_needs_list[item] = (needs_list[item] || 0) + count;
        set_needs_list(new_needs_list);
    }

    function add_npl(item) {
        let new_npl = structuredClone(natural_production_line);
        let count = Number(count_ref.current.value);
        new_npl.push({
            "目标物品": item,
            "目标产量": count,
            "建筑数量": 10, "配方id": 1, "增产点数": 0, "增产模式": 0, "建筑": 0
        });
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

export function NeedsListStorage({needs_list, set_needs_list}) {
    const global_state = useContext(GlobalStateContext);
    const game_info = useContext(GameInfoContext);
    let game_name = global_state.game_data.game_name;

    const NEEDS_LIST_STORAGE_KEY = "needs_list";

    const all_saved = JSON.parse(localStorage.getItem(NEEDS_LIST_STORAGE_KEY)) || {};
    const [all_scheme, set_all_scheme] = useState(all_saved[game_name] || {});
    // TODO implement 实时保存

    useEffect(() => {
        let all_scheme_data = JSON.parse(localStorage.getItem(NEEDS_LIST_STORAGE_KEY)) || {};
        let all_scheme_init = all_scheme_data[game_name] || {};
        console.log("Loading storage", game_name, Object.keys(all_scheme_init));
        set_all_scheme(all_scheme_init);
    }, [game_info]);

    useEffect(() => {
        let all_scheme_saved = JSON.parse(localStorage.getItem(NEEDS_LIST_STORAGE_KEY)) || {};
        all_scheme_saved[game_name] = all_scheme;
        localStorage.setItem(NEEDS_LIST_STORAGE_KEY, JSON.stringify(all_scheme_saved));
    }, [all_scheme])

    function delete_(name) {
        if (name in all_scheme) {
            if (!confirm(`即将删除名为${name}的需求列表，是否继续`)) {
                return;// 用户取消保存
            }
            let all_scheme_copy = structuredClone(all_scheme);
            delete all_scheme_copy[name];
            set_all_scheme(all_scheme_copy);
        }
    }//删除当前保存的策略

    function load(name) {
        if (all_scheme[name]) {
            set_needs_list(all_scheme[name]);
        } else {
            alert(`未找到名为${name}的需求列表`);
        }
    }//读取生产策略

    function save() {
        let name = prompt("输入需求列表名");
        if (!name) return;
        if (name in all_scheme) {
            if (!confirm(`已存在名为${name}的需求列表，继续保存将覆盖原需求列表`)) {
                return;// 用户取消保存
            }
        }
        let all_scheme_copy = structuredClone(all_scheme);
        all_scheme_copy[name] = structuredClone(needs_list);
        set_all_scheme(all_scheme_copy);
    }//保存生产策略

    let dd_load_list = Object.keys(all_scheme).map(scheme_name => (
        <li key={scheme_name}>
            <a className="dropdown-item cursor-pointer"
               onClick={() => load(scheme_name)}>{scheme_name}</a>
        </li>));

    let dd_delete_list = Object.keys(all_scheme).map(scheme_name => (
        <li key={scheme_name}>
            <a className="dropdown-item cursor-pointer"
               onClick={() => delete_(scheme_name)}>{scheme_name}</a>
        </li>));

    return <div className="d-flex gap-2 align-items-center">
        <div className="text-nowrap">需求列表</div>
        <div className="input-group input-group-sm">
            <button className="btn btn-outline-secondary" type="button" onClick={save}>保存</button>
            <button className="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown"
                    aria-expanded="false">加载
            </button>
            <ul className="dropdown-menu">{dd_load_list}</ul>
            <button className="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown"
                    aria-expanded="false">删除
            </button>
            <ul className="dropdown-menu">{dd_delete_list}</ul>
        </div>
    </div>;
}

