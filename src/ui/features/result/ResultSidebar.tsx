import {ItemIcon} from '@ui/components/icons/ItemIcon';
import {FaTrashAlt} from 'react-icons/fa';
import {ProNumSelect} from './ResultRecipeSelectors';

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
    external_supply_entries,
    fixed_num,
    IncreaseCostWhenSurplus,
    is_time_unit_minute,
    mineralize_list,
    miner_energy_cost,
    onChangeExternalSupplyProliferatorPoints,
    previous_sidebar_metrics,
    raw_material_list,
    show_item_names,
    surplus_list,
    unmineralize,
}) {
    const mineralize_doms = Object.keys(mineralize_list).map(item => (
        <a key={item} className="m-1 cursor-pointer" onClick={() => unmineralize(item)}>
            <ItemIcon item={item} size={RESULT_ICON_SIZE}/>
        </a>
    ));

    const unit_text = is_time_unit_minute ? '/min' : '/sec';

    function renderMetricValue(currentValue: number, previousValue: number | undefined, suffix = '', digits = fixed_num) {
        return <>
            x
            <ValueWithDifference
                currentValue={currentValue}
                previousValue={previousValue}
                digits={digits}
            />
            {suffix}
        </>;
    }

    const building_entries = (Object.entries(building_list) as Array<[string, number]>).map(([building, count]) => ({
        key: building,
        item: building,
        value: count,
        previousValue: previous_sidebar_metrics?.buildingCounts?.[building],
    }));

    const external_supply_rows = external_supply_entries.map(entry => ({
        ...entry,
        value: entry.amount,
        previousValue: previous_sidebar_metrics?.externalSupplies?.[entry.key],
    }));
    const raw_material_entries = (Object.entries(raw_material_list) as Array<[string, number]>).map(([item, amount]) => ({
        key: item,
        item,
        value: amount,
        previousValue: previous_sidebar_metrics?.rawMaterials?.[item],
    }));
    const surplus_entries = (Object.entries(surplus_list) as Array<[string, number]>).map(([item, quant]) => ({
        key: item,
        item,
        value: quant,
    }));

    function renderNamedRows(
        entries: Array<{key: string; item: string; value: number; previousValue?: number}>,
        digits: number,
        suffix = ''
    ) {
        return entries.map(({key, item, value, previousValue}) => (
            <tr key={key}>
                <td className="text-end text-nowrap">
                        <span className="d-inline-flex align-items-center">
                            <span className="me-1">{item}</span>
                            <ItemIcon item={item} size={RESULT_ICON_SIZE}/>
                    </span>
                </td>
                <td className="ps-2 text-nowrap">
                    {renderMetricValue(value, previousValue, suffix, digits)}
                </td>
            </tr>
        ));
    }

    function renderExternalSupplyNamedRows(
        entries: Array<{
            key: string;
            item: string;
            sourceLabel: string;
            value: number;
            previousValue?: number;
            proliferatorPoints: number;
            editablePoints: boolean;
        }>
    ) {
        return entries.map(({key, item, sourceLabel, value, previousValue, proliferatorPoints, editablePoints}) => (
            <tr key={key}>
                <td className="text-end text-nowrap">
                    <span className="d-inline-flex align-items-center">
                        <span className="me-1">{item}</span>
                        <ItemIcon item={item} size={RESULT_ICON_SIZE}/>
                    </span>
                </td>
                <td className="ps-2 text-nowrap">
                    {renderMetricValue(value, previousValue, '', fixed_num)}
                </td>
                <td className="ps-2 text-nowrap">
                    <small className="text-secondary">{sourceLabel}</small>
                </td>
                <td className="ps-2">
                    {editablePoints
                        ? <ProNumSelect
                            choice={proliferatorPoints}
                            includeNone={true}
                            onChange={(points) => onChangeExternalSupplyProliferatorPoints(item, points)}
                        />
                        : <span className="small text-secondary">点数 {proliferatorPoints}</span>}
                </td>
            </tr>
        ));
    }

    function renderCompactRows(
        entries: Array<{key: string; item: string; value: number; previousValue?: number}>,
        digits: number,
        suffix = ''
    ) {
        const rows: Array<Array<{key: string; item: string; value: number; previousValue?: number}>> = [];
        for (let i = 0; i < entries.length; i += 2) {
            const current = entries[i];
            const next = entries[i + 1];
            if (next) {
                rows.push([current, next]);
            } else {
                rows.push([current]);
            }
        }

        return <table>
            <tbody>
            {rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                    {row.map(({key, item, value, previousValue}) => (
                        <td key={key} className="text-nowrap pe-3">
                            <span className="d-inline-flex align-items-center">
                                <ItemIcon item={item} size={RESULT_ICON_SIZE}/>
                                <span className="ms-1">
                                    {renderMetricValue(value, previousValue, suffix, digits)}
                                </span>
                            </span>
                        </td>
                    ))}
                    {row.length === 1 && <td></td>}
                </tr>
            ))}
            </tbody>
        </table>;
    }

    function renderExternalSupplyCompactRows(
        entries: Array<{
            key: string;
            item: string;
            sourceLabel: string;
            value: number;
            previousValue?: number;
            proliferatorPoints: number;
            editablePoints: boolean;
        }>
    ) {
        return <table>
            <tbody>
            {entries.map(({key, item, sourceLabel, value, previousValue, proliferatorPoints, editablePoints}) => (
                <tr key={key}>
                    <td className="text-nowrap pe-2">
                        <span className="d-inline-flex align-items-center">
                            <ItemIcon item={item} size={RESULT_ICON_SIZE}/>
                            <span className="ms-1">
                                {renderMetricValue(value, previousValue, '', fixed_num)}
                            </span>
                        </span>
                        <small className="ms-1 text-secondary">{sourceLabel}</small>
                    </td>
                    <td>
                        {editablePoints
                            ? <ProNumSelect
                                choice={proliferatorPoints}
                                includeNone={true}
                                onChange={(points) => onChangeExternalSupplyProliferatorPoints(item, points)}
                            />
                            : <span className="small text-secondary">点数 {proliferatorPoints}</span>}
                    </td>
                </tr>
            ))}
            </tbody>
        </table>;
    }

    const building_display = show_item_names
        ? <table><tbody>{renderNamedRows(building_entries, 0)}</tbody></table>
        : renderCompactRows(building_entries, 0);

    const external_supply_display = show_item_names
        ? <table><tbody>{renderExternalSupplyNamedRows(external_supply_rows)}</tbody></table>
        : renderExternalSupplyCompactRows(external_supply_rows);

    const raw_material_display = show_item_names
        ? <table><tbody>{renderNamedRows(raw_material_entries, fixed_num)}</tbody></table>
        : renderCompactRows(raw_material_entries, fixed_num);

    function renderSurplusNamedRows(entries: Array<{key: string; item: string; value: number}>) {
        return entries.map(({key, item, value}) => (
            <tr key={key}>
                <td className="text-end text-nowrap">
                    <span className="d-inline-flex align-items-center">
                        <span className="me-1">{item}</span>
                        <ItemIcon item={item} size={RESULT_ICON_SIZE}/>
                    </span>
                </td>
                <td className="ps-2 text-nowrap">
                    x{value.toFixed(fixed_num)}
                </td>
                <td className="ps-2 text-nowrap">
                    <button className="btn btn-outline-primary ssmall text-nowrap mineralize-btn"
                            onClick={() => IncreaseCostWhenSurplus(item)}>
                        <div>避免</div>
                        <div>溢出</div>
                    </button>
                </td>
            </tr>
        ));
    }

    function renderSurplusCompactRows(entries: Array<{key: string; item: string; value: number}>) {
        const rows: Array<Array<{key: string; item: string; value: number}>> = [];
        for (let i = 0; i < entries.length; i += 2) {
            const current = entries[i];
            const next = entries[i + 1];
            if (next) {
                rows.push([current, next]);
            } else {
                rows.push([current]);
            }
        }

        return <table>
            <tbody>
            {rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                    {row.map(({key, item, value}) => (
                        <td key={key} className="text-nowrap pe-3">
                            <span className="d-inline-flex align-items-center">
                                <ItemIcon item={item} size={RESULT_ICON_SIZE}/>
                                <span className="ms-1">x{value.toFixed(fixed_num)}</span>
                                <button className="ms-2 btn btn-outline-primary ssmall text-nowrap mineralize-btn"
                                        onClick={() => IncreaseCostWhenSurplus(item)}>
                                    <div>避免</div>
                                    <div>溢出</div>
                                </button>
                            </span>
                        </td>
                    ))}
                    {row.length === 1 && <td></td>}
                </tr>
            ))}
            </tbody>
        </table>;
    }

    const surplus_display = show_item_names
        ? <table><tbody>{renderSurplusNamedRows(surplus_entries)}</tbody></table>
        : renderSurplusCompactRows(surplus_entries);

    return <div className="result-sidebar sticky-top mt-3 align-self-start d-flex flex-column gap-2">
        {mineralize_doms.length > 0 &&
            <fieldset className="result-sidebar-card">
                <legend><small>原矿化列表</small></legend>
                <div className="d-flex flex-wrap align-items-center">
                    {mineralize_doms}
                    <button className="ms-2 btn btn-sm btn-outline-danger text-nowrap d-inline-flex align-items-center gap-1 mobile-icon-button"
                            title="清空原矿化列表"
                            aria-label="清空原矿化列表"
                            onClick={clear_mineralize_list}>
                        <FaTrashAlt/>
                        <span className="mobile-icon-button-label">清空</span>
                    </button>
                </div>
            </fieldset>
        }

        {surplus_entries.length > 0 &&
            <fieldset className="result-sidebar-card">
                <legend><small>多余产物</small></legend>
                {surplus_display}
            </fieldset>}

        {external_supply_rows.length > 0 &&
            <fieldset className="result-sidebar-card">
                <legend><small>外部补充需求{unit_text}</small></legend>
                {external_supply_display}
            </fieldset>}

        {raw_material_entries.length > 0 &&
            <fieldset className="result-sidebar-card">
                <legend><small>原矿输入总需求{unit_text}</small></legend>
                {raw_material_display}
            </fieldset>}

        {building_entries.length > 0 &&
            <>
                <fieldset className="result-sidebar-card">
                    <legend><small>建筑统计</small></legend>
                    {building_display}
                </fieldset>
                <span className="d-inline-flex gap-1 text-nowrap result-sidebar-power">
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
