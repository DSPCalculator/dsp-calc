import { useContext, useEffect, useState } from 'react';
import Select from 'react-select';
import { BatchSetting } from './batch_setting.jsx';
import { ContextProvider, GameInfoContext, GameInfoSetterContext, SchemeDataSetterContext } from './contexts.jsx';
import { NaturalProductionLine } from './natural_production_line.jsx';
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
    { value: "TheyComeFromVoid", label: "深空来敌" }];

  return <div>
    <span>
      游戏版本：
      <div style={{ display: "inline-flex" }}>
        <Select options={game_ver_options} defaultValue={game_ver_options[0]}
          onChange={v => set_game_version(v.value)} isSearchable={false} />
      </div>
      <span>版本号：{game_info.game_data.Version}</span>
    </span>
  </div>;
}

function App() {
  return <ContextProvider>
    <AppWithContexts />
  </ContextProvider>;
}

function AppWithContexts() {
  const game_info = useContext(GameInfoContext);

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
    <GameVersion />
    <div>
      <UiSettings />
      <div>采矿参数</div>
      <MiningSettings />
      <SchemeStorage />
      <NeedsListStorage needs_list={needs_list} set_needs_list={set_needs_list} />
      <NaturalProductionLine />
      <div><button onClick={clearData}>清空数据缓存</button></div>
      <FractionatingSetting />
      <BatchSetting />

      <NeedsList needs_list={needs_list} set_needs_list={set_needs_list} />
      <Result needs_list={needs_list} />

    </div>
    <div id="result_debug"></div>
    <div className='m-4'>===============</div>
  </>;
}

export default App
