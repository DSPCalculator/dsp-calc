import {ItemIcon} from '../icons/ItemIcon.jsx';

export function HorizontalMultiButtonSelect({choice, options, onChange, no_gap, className}) {
    let gap_class = no_gap ? "" : "gap-1";
    let option_doms = options.map(({value, label, item_icon, className}) => {
        let selected_class = choice == value ? "bg-selected" : "bg-unselected";
        let gap_class = no_gap ? "border-between border-white" : "";
        return <div key={value}
                    className={`py-1 px-1 text-nowrap d-flex align-items-center cursor-pointer small
                ${selected_class} ${gap_class} ${className || ""}`}
                    onClick={() => onChange(value)}
        >{item_icon && <ItemIcon item={item_icon} size={40}/>}
            {label && <span className="mx-1">{label}</span>}
        </div>;
    });

    return <div className={`d-flex ${gap_class} ${className || ""}`}>{option_doms}</div>;
}
