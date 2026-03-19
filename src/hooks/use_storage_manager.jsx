import structuredClone from '@ungap/structured-clone';
import {useEffect, useState} from 'react';

/**
 * Custom hook for managing localStorage-backed storage partitioned by game name.
 * @param {string} storage_key - localStorage key
 * @param {string} game_name - Current game name for partitioning
 * @returns {{ all_items: object, save: function, load: function, delete_: function }}
 */
export function useStorageManager(storage_key, game_name) {
    function safe_load() {
        try {
            return JSON.parse(localStorage.getItem(storage_key)) || {};
        } catch {
            return {};
        }
    }

    const [all_items, set_all_items] = useState(() => {
        return safe_load()[game_name] || {};
    });

    // Reload when game changes
    useEffect(() => {
        set_all_items(safe_load()[game_name] || {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [game_name]);

    // Persist on change
    useEffect(() => {
        try {
            let all_saved = safe_load();
            all_saved[game_name] = all_items;
            localStorage.setItem(storage_key, JSON.stringify(all_saved));
        } catch {
            console.warn(`Failed to save ${storage_key} to localStorage`);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [all_items, game_name]);

    function save(data, item_label) {
        let name = prompt(`输入${item_label}名`);
        if (!name) return;
        if (name in all_items) {
            if (!confirm(`已存在名为${name}的${item_label}，继续保存将覆盖原${item_label}`)) {
                return;
            }
        }
        let copy = structuredClone(all_items);
        copy[name] = structuredClone(data);
        set_all_items(copy);
    }

    function load(name, on_load, item_label) {
        if (all_items[name]) {
            on_load(all_items[name]);
        } else {
            alert(`未找到名为${name}的${item_label}`);
        }
    }

    function delete_(name, item_label) {
        if (name in all_items) {
            if (!confirm(`即将删除名为${name}的${item_label}，是否继续`)) {
                return;
            }
            let copy = structuredClone(all_items);
            delete copy[name];
            set_all_items(copy);
        }
    }

    return {all_items, save, load, delete_};
}
