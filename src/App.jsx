import { useEffect, useState, useRef } from 'react'
import Select from 'react-select';
import { MiningSettings, FractionatingSetting, SchemeStorage, init_scheme_data } from './scheme_data.jsx'
import { NeedsList } from './needs_list.jsx';
import { GameInfo, GlobalState } from './global_state.jsx'

function App() {
  const [game_data, _set_game_data] = useState({ data: GameData.vanilla, name: "vanilla" });
  const [scheme_data, set_scheme_data] = useState(init_scheme_data(GameData.vanilla));
  const UI_SETTINGS = {
    proliferate_itself: false, time_tick: 60, mineralize_list: [], stackable_buildings: []
  };
  const NATURAL_PRODUCTION_LINE = [];
  const game_info = useRef(new GameInfo(game_data.data));
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
    game_info.current = new GameInfo(game_data.data);
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
        游戏版本：
        <Select options={game_ver_options} defaultValue={game_ver_options[0]}
          onChange={v => set_game_version(v.value)} />
        <nobr id="版本号">{game_data.data.Version}</nobr>
      </div>
      <div className="card">
        <p>采矿参数</p>
        <p>debug: {JSON.stringify(scheme_data.mining_rate)}</p>
        <MiningSettings scheme_data={scheme_data} set_scheme_data={set_scheme_data} />
        <SchemeStorage scheme_data={scheme_data} set_scheme_data={set_scheme_data} game_name={game_data.name} />
        <FractionatingSetting scheme_data={scheme_data} set_scheme_data={set_scheme_data} />
        <NeedsList needs_list={needs_list} set_needs_list={set_needs_list} game_data={game_data.data} />

      </div>
      <div id="result_debug"></div>
      <div className='m-4'>===============</div>

    </>
  )
}

export default App
