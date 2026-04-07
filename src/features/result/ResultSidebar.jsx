import {ItemIcon} from '../../shared/icons/ItemIcon.jsx';

export function ResultSidebar({
    RESULT_ICON_SIZE,
    building_list,
    clear_mineralize_list,
    energy_cost,
    fixed_num,
    IncreaseCostWhenSurplus,
    mineralize_list,
    miner_energy_cost,
    surplus_list,
    unmineralize,
}) {
    let mineralize_doms = Object.keys(mineralize_list).map(item => (
        <a key={item} className="m-1 cursor-pointer" onClick={() => unmineralize(item)}>
            <ItemIcon item={item} size={RESULT_ICON_SIZE}/>
        </a>
    ));

    let building_rows = Object.entries(building_list).map(([building, count]) => (
        <tr key={building}>
            <td className="d-flex align-items-center text-nowrap">
                <span className="ms-auto me-1">{building}</span>
                <ItemIcon item={building} size={RESULT_ICON_SIZE} tooltip={false}/>
            </td>
            <td className="ps-2 text-nowrap">x {count}</td>
        </tr>
    ));

    let surplus_doms = Object.entries(surplus_list).map(([item, quant]) =>
        <div key={item} className="text-nowrap"><ItemIcon item={item}
                                                          size={RESULT_ICON_SIZE}/> x{quant.toFixed(fixed_num)}
            <button className="ms-2 btn btn-outline-primary ssmall text-nowrap mineralize-btn"
                    onClick={() => IncreaseCostWhenSurplus(item)}>
                <div>避免</div>
                <div>溢出</div>
            </button>
        </div>
    );

    return <div className="sticky-top mt-3 align-self-start d-flex flex-column gap-2">
        {mineralize_doms.length > 0 &&
            <fieldset className="w-fit">
                <legend><small>原矿化列表</small></legend>
                <div className="d-flex flex-wrap align-items-center">
                    {mineralize_doms}
                    <button className="ms-2 btn btn-sm btn-outline-danger text-nowrap"
                            onClick={clear_mineralize_list}>清空
                    </button>
                </div>
            </fieldset>
        }

        {surplus_doms.length > 0 &&
            <fieldset className="w-fit">
                <legend><small>多余产物</small></legend>
                {surplus_doms}
            </fieldset>}

        {building_rows.length > 0 &&
            <>
                <fieldset className="w-fit">
                    <legend><small>建筑统计</small></legend>
                    <table>
                        <tbody>{building_rows}</tbody>
                    </table>
                </fieldset>
                <span className="d-inline-flex gap-1 text-nowrap">
                    <span className="me-1">预估电力</span>
                    <span className="fast-tooltip" data-tooltip="不包含采集设备">
                        {energy_cost.toFixed(fixed_num)}
                    </span>/
                    <span className="fast-tooltip" data-tooltip="包含采集设备">
                        {(energy_cost + miner_energy_cost).toFixed(fixed_num)}
                    </span>
                    MW
                </span>
            </>}
    </div>;
}
