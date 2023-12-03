import { useContext, useEffect, useId, useState } from 'react';
import { BatchSetting } from './batch_setting.jsx';
import { ContextProvider, GameInfoContext, GameInfoSetterContext, SchemeDataSetterContext } from './contexts.jsx';
import { NeedsList, NeedsListStorage } from './needs_list.jsx';
import { Result } from './result.jsx';
import { FractionatingSetting, MiningSettings, SchemeStorage, init_scheme_data } from './scheme_data.jsx';
import { UiSettings } from './ui_settings.jsx';
import { GameData } from '../data/GameData.jsx';

function GameVersion() {
  const set_game_name_and_data = useContext(GameInfoSetterContext);
  const set_scheme_data = useContext(SchemeDataSetterContext);
  const game_info = useContext(GameInfoContext);

  function set_game_version(name) {
    if (name == game_info.name) return;
    console.log("name", name);
    if (name in GameData) {
      let game_data = GameData[name];
      set_game_name_and_data(name, game_data);
      set_scheme_data(init_scheme_data(game_data));
    } else {
      alert(`未知的游戏版本${name}`);
    }
  }

  // TODO move to GameData
  let game_ver_options =
    [{ value: "vanilla", label: "原版游戏" },
    { value: "GenesisBook", label: "创世之书" },
    { value: "TheyComeFromVoid", label: "深空来敌" }].map(({ value, label }) => (
      <option key={value} value={value}>{label}</option>
    ));

  return <div className="d-flex gap-2 align-items-center">
    <select className="form-select form-select-sm"
      onChange={e => set_game_version(e.target.value)} defaultValue="vanilla">
      {game_ver_options}
    </select>
    <div className="text-nowrap">{game_info.game_data.Version}</div>
  </div>;
}

function MiscCollapse({ show }) {
  let class_show = show ? "" : "d-none";
  return <div className={`d-flex gap-3 ${class_show}`}>
    <fieldset>
      <legend><small>采矿参数</small></legend>
      <MiningSettings />
    </fieldset>
    <fieldset>
      <legend><small>其他设置</small></legend>
      <UiSettings />
      <FractionatingSetting />
    </fieldset>
  </div>;
}

function App() {
  return <ContextProvider>
    <AppWithContexts />
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
    <div className="d-flex column-gap-4 row-gap-2 flex-wrap">
      <GameVersion />
      <SchemeStorage />
      <NeedsListStorage needs_list={needs_list} set_needs_list={set_needs_list} />
      <button className="btn btn-outline-danger btn-sm" onClick={clearData}>清空数据缓存</button>

      <button className="btn btn-outline-primary btn-sm" onClick={() => set_misc_show(s => !s)}>
        采矿参数 & 其他设置
      </button>
    </div>
    <MiscCollapse show={misc_show} />
    <div>
      <BatchSetting />

      <NeedsList needs_list={needs_list} set_needs_list={set_needs_list} />
      <Result needs_list={needs_list} />
    </div>
  </>;
}

export default App
