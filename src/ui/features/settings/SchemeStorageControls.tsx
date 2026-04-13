import structuredClone from '@ungap/structured-clone';
import {useContext, useEffect, useState} from 'react';
import {GlobalStateContext, SchemeDataSetterContext} from '@ui/app/providers/app-contexts';

const SCHEME_STORAGE_KEY = "scheme_data";

function read_scheme_storage(game_name) {
    const all_saved = JSON.parse(localStorage.getItem(SCHEME_STORAGE_KEY)) || {};
    return all_saved[game_name] || {};
}

export function SchemeStorage() {
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const scheme_data = global_state.scheme_data;
    const game_name = global_state.game_data.game_name;

    const [all_scheme, set_all_scheme] = useState(() => read_scheme_storage(game_name));

    useEffect(() => {
        set_all_scheme(read_scheme_storage(game_name));
    }, [game_name]);

    useEffect(() => {
        const all_scheme_saved = JSON.parse(localStorage.getItem(SCHEME_STORAGE_KEY)) || {};
        all_scheme_saved[game_name] = all_scheme;
        localStorage.setItem(SCHEME_STORAGE_KEY, JSON.stringify(all_scheme_saved));
    }, [all_scheme, game_name]);

    function delete_(name) {
        if (name in all_scheme) {
            if (!confirm(`即将删除名为${name}的方案，是否继续`)) {
                return;
            }
            const rest_scheme = {...all_scheme};
            delete rest_scheme[name];
            set_all_scheme(rest_scheme);
        }
    }

    function load(name) {
        if (all_scheme[name]) {
            set_scheme_data(all_scheme[name]);
        } else {
            alert(`未找到名为${name}的方案`);
        }
    }

    function save() {
        const name = prompt("输入方案名");
        if (!name) return;
        if (name in all_scheme) {
            if (!confirm(`已存在名为${name}的方案，继续保存将覆盖原方案`)) {
                return;
            }
        }
        set_all_scheme({
            ...all_scheme,
            [name]: structuredClone(scheme_data),
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

    return <div className="d-flex gap-2 align-items-center">
        <div className="text-nowrap">生产策略</div>
        <div className="input-group input-group-sm">
            <button className="btn btn-outline-secondary" type="button" onClick={save}>保存</button>
            <button className="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown"
                    aria-expanded="false">加载
            </button>
            <ul className="dropdown-menu">{dd_load_list}</ul>
            <button className="btn btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown"
                    aria-expanded="false">删除
            </button>
            <ul className="dropdown-menu">{dd_delete_list}</ul>
        </div>
    </div>;
}
