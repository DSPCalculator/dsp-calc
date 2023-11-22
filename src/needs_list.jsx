import structuredClone from '@ungap/structured-clone';
import { createContext, useContext, useState, useEffect, useRef } from 'react';
import Select from 'react-select';

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

export function NeedsList({ needs_list, set_needs_list, game_data }) {
    const item_ref = useRef(null);
    const count_ref = useRef(60);

    let item_data = get_item_data(game_data);
    let item_options = Object.keys(item_data).map(item =>
        <option key={item} value={item} />
    );

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
        return <div key={item}>{item}:
            <input value={count} onChange={edit_count} /><span>/min</span>
            <button onClick={remove}>删除需求</button>
        </div>;
    });

    function add_need() {
        let item = item_ref.current.value;
        if (!(item in item_data)) {
            alert("请输入或选择正确的物品名字！");
            return;
        }
        let count = Number(count_ref.current.value);
        let new_needs_list = structuredClone(needs_list);
        new_needs_list[item] = (needs_list[item] || 0) + count;
        set_needs_list(new_needs_list);
    }

    return <>
        物品: <datalist id="needs_list_item_datalist">{item_options}</datalist>
        <input list="needs_list_item_datalist" size="5" ref={item_ref} placeholder="请输入搜索需要的物品"></input>
        产能: <input ref={count_ref} defaultValue={60} />
        <button onClick={add_need}>添加需求</button>
        {Object.keys(needs_list).length == 0 ||
            <button onClick={() => set_needs_list({})}>清空所有需求</button>}
        <div>{needs_doms}</div>
    </>;
}
