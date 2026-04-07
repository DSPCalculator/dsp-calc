export function hasActiveProduction(needs_list, natural_production_line) {
    return Object.keys(needs_list).length > 0 || natural_production_line.length > 0;
}

export function sortModsByInfo(modList, game_data_info_list) {
    let sorted_mods = [];
    game_data_info_list.forEach((mod_info) => {
        for (let i = 0; i < modList.length; i++) {
            if (modList[i] === mod_info.name_en + mod_info.version) {
                sorted_mods.push(modList[i]);
            }
        }
    });
    return sorted_mods;
}

export function isSameModSelection(left_mods, right_mods) {
    if (left_mods.length !== right_mods.length) {
        return false;
    }
    return left_mods.every((mod, idx) => mod === right_mods[idx]);
}

export function normalizeModSelection(current_mods, next_mods, game_data_info_list) {
    let modSet = new Set(next_mods);

    let MSGUID = game_data_info_list[1].name_en + game_data_info_list[1].version;
    let VDGUID = game_data_info_list[2].name_en + game_data_info_list[2].version;
    let GBGUID = game_data_info_list[3].name_en + game_data_info_list[3].version;
    let ORGUID = game_data_info_list[4].name_en + game_data_info_list[4].version;

    function keepLastClicked(preferred_when_unknown, left_guid, right_guid) {
        const left_old = current_mods.includes(left_guid);
        const right_old = current_mods.includes(right_guid);
        const left_new = modSet.has(left_guid);
        const right_new = modSet.has(right_guid);
        if (!(left_new && right_new)) {
            return;
        }
        if (left_old && !right_old) {
            modSet.delete(left_guid);
            return;
        }
        if (right_old && !left_old) {
            modSet.delete(right_guid);
            return;
        }
        modSet.delete(preferred_when_unknown === left_guid ? right_guid : left_guid);
    }

    if (modSet.has(VDGUID) && !modSet.has(MSGUID)) {
        if (current_mods.includes(MSGUID) && current_mods.includes(VDGUID)) {
            modSet.delete(VDGUID);
        } else {
            modSet.add(MSGUID);
        }
    }

    keepLastClicked(GBGUID, GBGUID, ORGUID);
    keepLastClicked(VDGUID, VDGUID, ORGUID);

    return sortModsByInfo(Array.from(modSet), game_data_info_list);
}
