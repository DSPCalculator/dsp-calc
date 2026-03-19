import structuredClone from '@ungap/structured-clone';
import {useCallback, useContext} from 'react';
import {SchemeDataSetterContext} from '../contexts.jsx';

/**
 * Custom hook that returns a memoized updater for scheme_data.
 * Usage: const update_scheme = useSchemeUpdater();
 *        update_scheme(scheme => { scheme.some_field = value; });
 */
export function useSchemeUpdater() {
    const set_scheme_data = useContext(SchemeDataSetterContext);
    return useCallback((updater) => {
        set_scheme_data(old => {
            const cloned = structuredClone(old);
            updater(cloned);
            return cloned;
        });
    }, [set_scheme_data]);
}
