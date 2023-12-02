import Select from 'react-select';
import { useContext, useState } from 'react';
import structuredClone from '@ungap/structured-clone';
import { GlobalStateContext, SchemeDataSetterContext } from './contexts';
import { HorizontalMultiButtonSelect } from './recipe.jsx';

function FactorySelect({ factory, list }) {
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const [cur, set_cur] = useState(0);
    let game_data = global_state.game_data;

    const options = list.map((data, idx) => ({
        value: idx, item_icon: data["名称"], label: cur == idx ? data["名称"] : null
    }));

    function set_factory(building) {
        set_cur(building);
        set_scheme_data(old_scheme_data => {
            let scheme_data = structuredClone(old_scheme_data);
            for (var i = 0; i < game_data.recipe_data.length; i++) {
                if (game_data.recipe_data[i]["设施"] == factory) {
                    scheme_data.scheme_for_recipe[i]["建筑"] = building;
                }
            }
            return scheme_data;
        });
    }

    return <span className='ms-3'>
        {/* {factory}： */}
        <div style={{ display: "inline-flex" }}>
            <HorizontalMultiButtonSelect choice={cur} options={options} onChange={set_factory} />
        </div>
    </span>;
}

export function BatchSetting() {
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    let game_data = global_state.game_data;
    let proliferator_price = global_state.proliferator_price;

    let factory_doms = [];
    // TODO rename to [factory_kind]
    Object.keys(game_data.factory_data).forEach(factory => {
        let list = game_data.factory_data[factory];
        if (list.length >= 2) {
            factory_doms.push(<FactorySelect key={factory} factory={factory} list={list} />);
        }
    });

    let proliferate_options = [];
    game_data.proliferate_effect.forEach((_data, idx) => {
        if (proliferator_price[idx] != -1) {
            proliferate_options.push({ value: idx, label: idx });
        }
    });

    function change_pro_num(e) {
        let pro_num = e.value;
        set_scheme_data(old_scheme_data => {
            let scheme_data = structuredClone(old_scheme_data);
            for (var i = 0; i < game_data.recipe_data.length; i++) {
                scheme_data.scheme_for_recipe[i]["喷涂点数"] = pro_num;
            }
            return scheme_data;
        });
    }

    function change_pro_mode(e) {
        var pro_mode = e.value;
        set_scheme_data(old_scheme_data => {
            let scheme_data = structuredClone(old_scheme_data);
            for (var i = 0; i < game_data.recipe_data.length; i++) {
                if (pro_mode != 0 && !(pro_mode & game_data.recipe_data[i]["增产"])) {
                    continue;
                }
                scheme_data.scheme_for_recipe[i]["增产模式"] = Number(pro_mode);
            }
            return scheme_data;
        });
    }

    const promode_options = [
        { value: 0, label: "不使用增产剂" },
        { value: 1, label: "增产" },
        { value: 2, label: "加速" }
    ];

    return <div>
        <span>批量预设：{factory_doms}</span>
        <span className='ms-3'>喷涂点数：
            <div style={{ display: "inline-flex" }}>
                <Select defaultValue={proliferate_options[0]} options={proliferate_options} isSearchable={false} onChange={change_pro_num} />
            </div>
        </span>
        <span className='ms-3'>
            增产模式：
            <div style={{ display: "inline-flex" }}>
                <Select defaultValue={promode_options[0]} options={promode_options} isSearchable={false} onChange={change_pro_mode} />
            </div>
        </span>
    </div>
}
