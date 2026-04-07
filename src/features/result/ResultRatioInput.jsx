import {AutoSizedInput} from '../../shared/ui/AutoSizedInput.jsx';

export function ResultRatioInput({fixed_num, needs_list, set_needs_list, value}) {
    let disp_value = value.toFixed(fixed_num);
    let base_value = +disp_value;

    function set_needs_in_row() {
        return function (e_or_value) {
            if (base_value != 0) {
                let new_value = e_or_value.target ? e_or_value.target.value : e_or_value;
                let new_needs_list = {};
                for (let item in needs_list) {
                    new_needs_list[item] = needs_list[item] * new_value / base_value;
                }
                set_needs_list(new_needs_list);
            }
        };
    }

    return <span data-tooltip="等比例调整需求" className="fast-tooltip">
        <AutoSizedInput
            delayed={true}
            value={disp_value}
            onChange={set_needs_in_row()}/>
    </span>;
}
