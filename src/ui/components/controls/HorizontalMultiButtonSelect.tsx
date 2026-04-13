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
        const selected_class = choice == value ? "bg-selected" : "bg-unselected";
        const gap_class = no_gap ? "border-between border-white" : "";
        return <div key={value}
                    className={`py-1 px-1 text-nowrap d-flex align-items-center cursor-pointer small
                ${selected_class} ${gap_class} ${optionClassName || ""}`}
                    onClick={() => onChange(value)}
        >{item_icon && <ItemIcon item={item_icon} size={40}/>}
            {label && <span className="mx-1">{label}</span>}
        </div>;
    });

    return <div className={`d-flex ${gap_class} ${className || ""}`}>{option_doms}</div>;
}
