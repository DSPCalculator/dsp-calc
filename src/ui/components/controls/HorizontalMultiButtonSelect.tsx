import {ItemIcon} from '../icons/ItemIcon';
import type {HorizontalOption} from '@ui/types/ui';

export function HorizontalMultiButtonSelect<TValue extends string | number>({
    choice,
    options,
    onChange,
    no_gap = false,
    className,
}: {
    choice: TValue;
    options: HorizontalOption<TValue>[];
    onChange: (value: TValue) => void;
    no_gap?: boolean;
    className?: string;
}) {
    const gap_class = no_gap ? "" : "gap-1";
    const option_doms = options.map(({value, label, item_icon, className: optionClassName}) => {
        const is_selected = choice == value;
        const selected_class = is_selected ? "bg-selected horizontal-multi-button-option-selected" : "bg-unselected horizontal-multi-button-option-unselected";
        const gap_class = no_gap ? "border-between border-white" : "";
        const option_padding_class = item_icon ? (label ? "py-0 px-1" : "p-0") : "py-1 px-1";
        return <div key={value}
                    className={`${option_padding_class} text-nowrap d-flex align-items-center cursor-pointer small horizontal-multi-button-option
                ${selected_class} ${gap_class} ${optionClassName || ""}`}
                    onClick={() => onChange(value)}
        >{item_icon && <ItemIcon item={item_icon}/>}
            {label && <span className="mx-1 horizontal-multi-button-option-label">{label}</span>}
        </div>;
    });

    return <div className={`d-flex flex-wrap horizontal-multi-button-select ${gap_class} ${className || ""}`}>{option_doms}</div>;
}
