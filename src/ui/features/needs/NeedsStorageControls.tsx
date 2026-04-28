import {useContext, useEffect, useState} from 'react';
import {FaFolderOpen, FaSave, FaTrashAlt} from 'react-icons/fa';
import {GlobalStateContext} from '@ui/app/providers/app-contexts';

const NEEDS_LIST_STORAGE_KEY = "needs_list";

function read_needs_storage(game_name) {
    const all_saved = JSON.parse(localStorage.getItem(NEEDS_LIST_STORAGE_KEY)) || {};
    return all_saved[game_name] || {};
}

export function NeedsListStorage({needs_list, set_needs_list}) {
    const global_state = useContext(GlobalStateContext);
    const game_name = global_state.game_data.game_name;
    return <NeedsListStorageForGame key={game_name}
                                    game_name={game_name}
                                    needs_list={needs_list}
                                    set_needs_list={set_needs_list}/>;
}

function NeedsListStorageForGame({game_name, needs_list, set_needs_list}) {
    const [all_scheme, set_all_scheme] = useState(() => read_needs_storage(game_name));

    useEffect(() => {
        const all_scheme_saved = JSON.parse(localStorage.getItem(NEEDS_LIST_STORAGE_KEY)) || {};
        all_scheme_saved[game_name] = all_scheme;
        localStorage.setItem(NEEDS_LIST_STORAGE_KEY, JSON.stringify(all_scheme_saved));
    }, [all_scheme, game_name]);

    function delete_(name) {
        if (name in all_scheme) {
            if (!confirm(`即将删除名为${name}的需求列表，是否继续`)) {
                return;
            }
            const rest_scheme = {...all_scheme};
            delete rest_scheme[name];
            set_all_scheme(rest_scheme);
        }
    }

    function load(name) {
        if (all_scheme[name]) {
            set_needs_list({...all_scheme[name]});
        } else {
            alert(`未找到名为${name}的需求列表`);
        }
    }

    function save() {
        const name = prompt("输入需求列表名");
        if (!name) return;
        if (name in all_scheme) {
            if (!confirm(`已存在名为${name}的需求列表，继续保存将覆盖原需求列表`)) {
                return;
            }
        }
        set_all_scheme({
            ...all_scheme,
            [name]: {...needs_list},
        });
    }

    const dd_load_list = Object.keys(all_scheme).map(scheme_name => (
        <li key={scheme_name}>
            <a className="dropdown-item cursor-pointer"
               onClick={() => load(scheme_name)}>{scheme_name}</a>
        </li>));

    const dd_delete_list = Object.keys(all_scheme).map(scheme_name => (
        <li key={scheme_name}>
            <a className="dropdown-item cursor-pointer"
               onClick={() => delete_(scheme_name)}>{scheme_name}</a>
        </li>));

    return <div className="d-flex gap-2 align-items-center toolbar-storage-group">
        <div className="text-nowrap toolbar-storage-title">需求列表</div>
        <div className="input-group input-group-sm toolbar-storage-input-group">
            <button className="btn btn-outline-secondary toolbar-icon-button" type="button" onClick={save} title="保存需求列表" aria-label="保存需求列表">
                <FaSave/>
                <span className="toolbar-icon-button-label">保存</span>
            </button>
            <button className="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown"
                    aria-expanded="false" title="加载需求列表" aria-label="加载需求列表">
                <FaFolderOpen/>
                <span className="toolbar-icon-button-label">加载</span>
            </button>
            <ul className="dropdown-menu">{dd_load_list}</ul>
            <button className="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown"
                    aria-expanded="false" title="删除需求列表" aria-label="删除需求列表">
                <FaTrashAlt/>
                <span className="toolbar-icon-button-label">删除</span>
            </button>
            <ul className="dropdown-menu">{dd_delete_list}</ul>
        </div>
    </div>;
}
