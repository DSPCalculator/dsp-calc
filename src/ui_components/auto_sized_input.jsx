import {useState} from 'react';
import {Input} from '../components/ui/input';
import {cn} from '../lib/utils';

/** Delayed values are validated and committed on blur or Enter. */
export const AutoSizedInput = ({value, onChange, className, delayed, 'aria-label': ariaLabel = '数值', ...props}) => {
    const [draft, setDraft] = useState(null);
    const displayedValue = delayed && draft !== null ? draft : value;
    const valid = candidate => String(candidate).trim() !== '' && Number.isFinite(Number(candidate)) && Number(candidate) >= 0;
    const invalid = delayed && draft !== null && !valid(draft);

    function commit(newValue) {
        // Merely focusing a derived, rounded value must not change its owner or
        // replace the stored precision. Invalid drafts leave the value intact.
        if (draft !== null && valid(newValue)) onChange(newValue);
        setDraft(null);
    }

    return <Input {...props}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        className={cn('dsp-number-input h-8 min-w-14 rounded-md px-1 text-right text-base md:text-base tabular-nums shadow-none', invalid && 'border-destructive focus-visible:ring-destructive/30', className)}
        style={{width: `${Math.max(String(displayedValue ?? '').length + 2, 6)}ch`, ...props.style}}
        type="text" inputMode="decimal"
        value={displayedValue}
        onChange={delayed ? e => setDraft(e.target.value) : onChange}
        onBlur={delayed ? e => commit(e.target.value) : undefined}
        onKeyDown={delayed ? e => {
            if (e.key === 'Enter') e.currentTarget.blur();
            if (e.key === 'Escape') {
                setDraft(null);
                e.preventDefault();
            }
        } : undefined}
    />;
};
