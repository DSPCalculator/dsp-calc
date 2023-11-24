import { useContext, useEffect, useState } from 'react';
import Select from 'react-select';
import { BatchSetting } from './batch_setting.jsx';
import { ContextProvider, GameInfoContext, GameInfoSetterContext, GlobalStateContext, SchemeDataSetterContext } from './contexts.jsx';
import { GameInfo } from './global_state.jsx';
import { NeedsList } from './needs_list.jsx';
import { Result } from './result.jsx';
import { FractionatingSetting, MiningSettings, SchemeStorage, init_scheme_data } from './scheme_data.jsx';

function GameVersion() {
  const set_game_name_and_data = useContext(GameInfoSetterContext);
  const set_scheme_data = useContext(SchemeDataSetterContext);
  const game_info = useContext(GameInfoContext);

  function set_game_version(name) {
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

  return <div className='card'>
    <span>
      游戏版本：
      <div style={{ display: "inline-flex" }}>
        <Select options={game_ver_options} defaultValue={game_ver_options[0]}
          onChange={v => set_game_version(v.value)} isSearchable={false} />
      </div>
      <nobr id="版本号">{game_info.game_data.Version}</nobr>
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
  const global_state = useContext(GlobalStateContext);
  let scheme_data = global_state.scheme_data;

  const [needs_list, set_needs_list] = useState({});

  useEffect(() => {
    set_needs_list({});
  }, [game_info]);

  return <>
    <GameVersion />
    <div className="card">
      <p>采矿参数 debug: {JSON.stringify(scheme_data.mining_rate)}</p>
      <span>
        <MiningSettings />
      </span>
      <SchemeStorage />
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
