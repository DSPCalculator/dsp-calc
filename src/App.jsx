import {useContext, useEffect, useState} from 'react';
import {BatchSetting} from './batch_setting.jsx';
import {ContextProvider, GameInfoContext, GameInfoSetterContext, SchemeDataSetterContext} from './contexts.jsx';
import {NeedsList, NeedsListStorage} from './needs_list.jsx';
import {Result} from './result.jsx';
import {init_scheme_data, MiningSettings, SchemeStorage} from './scheme_data.jsx';
import {UiSettings} from './ui_settings.jsx';
import {
    default_game_data,
    game_data_info_list,
    get_game_data,
    get_mod_options,
    MoreMegaStructureGUID,
    TheyComeFromVoidGUID,
    vanilla_game_version
} from "./GameData.jsx";
import {Select} from "antd";

function GameVersion({set_needs_list}) {
    const mod_options = get_mod_options();
    const set_game_data = useContext(GameInfoSetterContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const [mods, set_mods] = useState([]);

    async function mods_change(modList) {
        //判断modList是否合理，并调整顺序
        //巨构是深空的前置依赖
        let b1 = false;
        let b2 = false;
        for (let i = 0; i < mods.length; i++) {
            if (mods[i] === MoreMegaStructureGUID) {
                b1 = true;
            }
            if (mods[i] === TheyComeFromVoidGUID) {
                b2 = true;
            }
        }
        let b3 = false;
        let b4 = false;
        for (let i = 0; i < modList.length; i++) {
            if (modList[i] === MoreMegaStructureGUID) {
                b3 = true;
            }
            if (modList[i] === TheyComeFromVoidGUID) {
                b4 = true;
            }
        }
        if (!b1 && !b2 && !b3 && b4) {
            modList.push(MoreMegaStructureGUID);
        }
        if (b1 && b2 && !b3 && b4) {
            modList = modList.filter((mod) => mod !== TheyComeFromVoidGUID);
        }
        //按照规定的顺序排序mods
        let modList2 = [];
        game_data_info_list.forEach((mod_info) => {
            for (let i = 0; i < modList.length; i++) {
                if (modList[i] === mod_info.GUID) {
                    modList2.push(mod_info.GUID);
                }
            }
        })
        //避免递归
        if (JSON.stringify(modList2) === JSON.stringify(mods)) {
            console.log("有递归，取消执行，当前list", modList2)
            return;
        }
        console.log("无递归，继续执行，原list", mods)
        console.log("无递归，继续执行，新list", modList2)
        set_mods(modList2);
        let game_data = modList.length === 0 ? default_game_data : get_game_data(modList);
        set_needs_list({});
        set_game_data(game_data);
        set_scheme_data(init_scheme_data(game_data));
    }

    return <div className="d-flex gap-2 align-items-center">
        <div className="text-nowrap">游戏版本 v{vanilla_game_version}</div>
        <div className="text-nowrap">模组选择</div>
        <Select style={{minWidth: 250}} mode={"multiple"} options={mod_options} value={mods} onChange={mods_change}/>
    </div>;
}

function MiscCollapse({show}) {
    let class_show = show ? "" : "d-none";
    return <div className={`d-flex gap-3 ${class_show}`}>
        <fieldset>
            <legend><small>采矿参数</small></legend>
            <MiningSettings/>
        </fieldset>
        <fieldset>
            <legend><small>其他设置</small></legend>
            <UiSettings/>
        </fieldset>
    </div>;
}

function App() {
    return <ContextProvider>
        <AppWithContexts/>
    </ContextProvider>;
}

function AppWithContexts() {
    const game_info = useContext(GameInfoContext);
    const [misc_show, set_misc_show] = useState(false);
    const [needs_list, set_needs_list] = useState({});
    useEffect(() => {
        set_needs_list({});
    }, [game_info]);

    function clearData() {
        if (!confirm(`即将清空所有保存的生产策略、需求列表等数据，初始化整个计算器，是否继续`)) {
            return;// 用户取消保存
        }
        localStorage.clear();
        window.location.reload();
    }

    return <>
        {/*游戏版本、模组选择*/}
        <div className="d-flex column-gap-4 row-gap-2 flex-wrap">
            <GameVersion set_needs_list={set_needs_list}/>
        </div>
        {/*生产策略、需求列表、清空数据缓存按钮、采矿参数&其他设置是否显示按钮*/}
        <div className="d-flex column-gap-4 row-gap-2 flex-wrap">
            <SchemeStorage/>
            <NeedsListStorage needs_list={needs_list} set_needs_list={set_needs_list}/>
            <button className="btn btn-outline-danger btn-sm" onClick={clearData}>清空数据缓存</button>
            <button className="btn btn-outline-primary btn-sm" onClick={() => set_misc_show(s => !s)}>
                采矿参数 & 其他设置
            </button>
        </div>
        {/*采矿参数&其他设置*/}
        <MiscCollapse show={misc_show}/>
        {/*添加需求、批量预设、计算结果*/}
        <div>
            <NeedsList needs_list={needs_list} set_needs_list={set_needs_list}/>
            <BatchSetting/>
            <Result needs_list={needs_list} set_needs_list={set_needs_list}/>
        </div>
    </>;
}

export default App
