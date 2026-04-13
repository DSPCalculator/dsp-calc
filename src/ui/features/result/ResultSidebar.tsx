import {ItemIcon} from '@ui/components/icons/ItemIcon';

function ValueWithDifference({
    currentValue,
    previousValue,
    digits = 0,
}: {
    currentValue: number;
    previousValue?: number;
    digits?: number;
}) {
    if (previousValue === undefined || Math.abs(currentValue - previousValue) < 1e-6) {
        return <>{currentValue.toFixed(digits)}</>;
    }

    const diff = currentValue - previousValue;
    const diffSign = diff > 0 ? '+' : '';
    const diffColor = diff > 0 ? 'red' : 'green';

    return <>
        {currentValue.toFixed(digits)}
        <span style={{
            fontSize: '0.7em',
            verticalAlign: 'sub',
            color: diffColor,
            opacity: 0.6,
            marginLeft: 2,
            marginRight: 2,
        }}>
            {diffSign}{diff.toFixed(digits)}
        </span>
    </>;
}

export function ResultSidebar({
    RESULT_ICON_SIZE,
    building_list,
    clear_mineralize_list,
    energy_cost,
    fixed_num,
    IncreaseCostWhenSurplus,
    mineralize_list,
    miner_energy_cost,
    previous_sidebar_metrics,
    raw_material_list,
    surplus_list,
    unmineralize,
}) {
    const mineralize_doms = Object.keys(mineralize_list).map(item => (
        <a key={item} className="m-1 cursor-pointer" onClick={() => unmineralize(item)}>
            <ItemIcon item={item} size={RESULT_ICON_SIZE}/>
        </a>
    ));

    const building_rows = (Object.entries(building_list) as Array<[string, number]>).map(([building, count]) => (
        <tr key={building}>
            <td className="d-flex align-items-center text-nowrap">
                <span className="ms-auto me-1">{building}</span>
                <ItemIcon item={building} size={RESULT_ICON_SIZE} tooltip={false}/>
            </td>
            <td className="ps-2 text-nowrap">x <ValueWithDifference
                currentValue={count}
                previousValue={previous_sidebar_metrics?.buildingCounts?.[building]}
            /></td>
        </tr>
    ));

    const raw_material_rows = (Object.entries(raw_material_list) as Array<[string, number]>).map(([item, amount]) => (
        <tr key={item}>
            <td className="d-flex align-items-center text-nowrap">
                <ItemIcon item={item} size={RESULT_ICON_SIZE} tooltip={false}/>
                <span className="ms-1">{item}</span>
            </td>
            <td className="ps-2 text-nowrap">
                <ValueWithDifference
                    currentValue={amount}
                    previousValue={previous_sidebar_metrics?.rawMaterials?.[item]}
                    digits={fixed_num}
                />
            </td>
        </tr>
    ));

    const surplus_doms = (Object.entries(surplus_list) as Array<[string, number]>).map(([item, quant]) =>
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

        {raw_material_rows.length > 0 &&
            <fieldset className="w-fit">
                <legend><small>原矿输入总需求</small></legend>
                <table>
                    <tbody>{raw_material_rows}</tbody>
                </table>
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
                        <ValueWithDifference
                            currentValue={energy_cost}
                            previousValue={previous_sidebar_metrics?.energyCost}
                            digits={fixed_num}
                        />
                    </span>/
                    <span className="fast-tooltip" data-tooltip="包含采集设备">
                        <ValueWithDifference
                            currentValue={energy_cost + miner_energy_cost}
                            previousValue={previous_sidebar_metrics?.totalEnergyCost}
                            digits={fixed_num}
                        />
                    </span>
                    MW
                </span>
            </>}
    </div>;
}
