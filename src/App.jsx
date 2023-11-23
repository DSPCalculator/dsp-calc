import { useEffect, useState, useRef } from 'react'
import Select from 'react-select';
import { MiningSettings, FractionatingSetting, SchemeStorage, init_scheme_data } from './scheme_data.jsx'
import { NeedsList } from './needs_list.jsx';
import { GameInfo, GlobalState } from './global_state.jsx'
import { BatchSetting } from './batch_setting.jsx';
import { Result } from './result.jsx';

function App() {
  const [game_data, _set_game_data] = useState({ data: GameData.vanilla, name: "vanilla" });
  const [scheme_data, set_scheme_data] = useState(init_scheme_data(GameData.vanilla));
  const UI_SETTINGS = {
    proliferate_itself: false, time_tick: 60, mineralize_list: [], stackable_buildings: []
  };
  const NATURAL_PRODUCTION_LINE = [];
  const game_info = useRef(new GameInfo("vanilla", game_data.data));
  const global_state = useRef(new GlobalState(game_info.current, scheme_data, NATURAL_PRODUCTION_LINE, UI_SETTINGS));
  const [needs_list, set_needs_list] = useState({});

  function set_game_version(name) {
    console.log("name", name);
    if (name in GameData) {
      let game_data = GameData[name];
      _set_game_data({ data: game_data, name: name });
      set_scheme_data(init_scheme_data(game_data));
    } else {
      alert(`未知的游戏版本${name}`);
    }
  }

  let game_ver_options =
    [{ value: "vanilla", label: "原版游戏" },
    { value: "GenesisBook", label: "创世之书" },
    { value: "TheyComeFromVoid", label: "深空来敌" }];

  useEffect(() => {
    game_info.current = new GameInfo(game_data.name, game_data.data);
    set_needs_list({});
  }, [game_data])

  useEffect(() => {
    global_state.current = new GlobalState(
      game_info.current, scheme_data, NATURAL_PRODUCTION_LINE, UI_SETTINGS);
  }, [game_data, scheme_data])

  useEffect(() => {
    global_state.current.calculate(needs_list);
  }, [global_state, needs_list])

  return (
    <>
      <h1>Root node...</h1>

      <div className='card'>
        <span>
          游戏版本：
          <div style={{ display: "inline-flex" }}>
            <Select options={game_ver_options} defaultValue={game_ver_options[0]}
              onChange={v => set_game_version(v.value)} isSearchable={false} />
          </div>
          <nobr id="版本号">{game_data.data.Version}</nobr>
        </span>
      </div>
      <div className="card">
        <p>采矿参数 debug: {JSON.stringify(scheme_data.mining_rate)}</p>
        <span>
          <MiningSettings scheme_data={scheme_data} set_scheme_data={set_scheme_data} />
        </span>
        <SchemeStorage scheme_data={scheme_data} set_scheme_data={set_scheme_data} game_name={game_data.name} />
        <FractionatingSetting scheme_data={scheme_data} set_scheme_data={set_scheme_data} />
        <BatchSetting game_data={game_data.data} set_game_data={_set_game_data} proliferator_price={global_state.current.proliferator_price} />

        <NeedsList needs_list={needs_list} set_needs_list={set_needs_list} game_data={game_data.data} />

        <Result global_state={global_state.current} needs_list={needs_list} />

      </div>
      <div id="result_debug"></div>
      <div className='m-4'>===============</div>

    </>
  )
}

export default App
