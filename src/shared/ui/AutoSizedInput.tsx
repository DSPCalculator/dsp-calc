import {useState} from "react";
import type {ChangeEvent} from 'react';
import type {AutoSizedInputProps} from '../../types/ui';

/** When `delayed` is `true`, validation (number) is also enabled. */
export const AutoSizedInput = ({value, onChange, className, delayed = false}: AutoSizedInputProps) => {
    const [disp_value, set_disp_value] = useState<string | null>(null);

    let valid_class = "";
    if (disp_value) {
        valid_class = Number.isNaN(Number(disp_value)) ? "invalid" : "valid";
    }

    function commit(new_value: string): void {
        const normalized_value = Number.isNaN(Number(new_value)) ? String(value) : new_value;
        (onChange as (value: string) => void)(normalized_value);
    }

    return (
        <label className={`auto-sized-input ${className || ""}`}>
            <span>{disp_value || value}</span>
            {delayed
                ? <input
                    className={(className || "") + " " + valid_class}
                    type="text"
                    value={disp_value || value}
                    onBlur={(e: ChangeEvent<HTMLInputElement>) => {
                        commit(e.target.value);
                        set_disp_value(null);
                    }}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => set_disp_value(e.target.value)}
                    onKeyDown={e => {
                        if (e.key == "Enter") commit(e.currentTarget.value);
                    }}
                />
                : <input type="text" value={value} onChange={onChange as (event: ChangeEvent<HTMLInputElement>) => void}/>
            }
        </label>
    )
}
