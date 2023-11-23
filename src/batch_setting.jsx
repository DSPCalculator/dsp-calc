import Select from 'react-select';

function FactorySelect({ factory, list }) {
    const options = list.map((data, idx) => ({ value: idx, label: data["名称"] }));
    // TODO BatchChangeFactoryOf
    return <span className='ms-3'>{factory}：
        <div style={{ display: "inline-flex" }}>
            <Select defaultValue={options[0]} options={options} isSearchable={false} />
        </div>
    </span>;
}

export function BatchSetting({ game_data, set_game_data, proliferator_price }) {
    let factory_doms = [];
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
    // TODO BatchChangeProNum

    // TODO BatchChangeProMode
    const promode_options = [
        { value: 0, label: "不使用增产剂" },
        { value: 1, label: "增产" },
        { value: 2, label: "加速" }
    ];

    return <>
        <span>批量预设：{factory_doms}</span>
        <span>喷涂点数：
            <div style={{ display: "inline-flex" }}>
                <Select defaultValue={proliferate_options[0]} options={proliferate_options} isSearchable={false} />
            </div>

            增产模式：
            <div style={{ display: "inline-flex" }}>
                <Select defaultValue={promode_options[0]} options={promode_options} isSearchable={false} />
            </div>
        </span>
    </>
}
