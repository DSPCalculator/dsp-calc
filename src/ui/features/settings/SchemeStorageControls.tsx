import structuredClone from '@ungap/structured-clone';
import {useContext, useEffect, useState} from 'react';
import {FaFolderOpen, FaSave, FaTrashAlt} from 'react-icons/fa';
import {Modal} from 'react-bootstrap';
import {init_scheme_data} from '@engine/scheme/schemeData';
import type {GameData, SchemeData} from '@engine/types/domain';
import {GlobalStateContext, SchemeDataSetterContext} from '@ui/app/providers/app-contexts';

const SCHEME_STORAGE_KEY = "scheme_data";

function read_scheme_storage(game_name) {
    const all_saved = JSON.parse(localStorage.getItem(SCHEME_STORAGE_KEY)) || {};
    return all_saved[game_name] || {};
}

function normalize_saved_scheme_data(saved_scheme: Partial<SchemeData>, game_data: GameData): SchemeData {
    const default_scheme = init_scheme_data(game_data);
    const saved_cost_weight = saved_scheme.cost_weight || default_scheme.cost_weight;

    return {
        item_recipe_choices: {
            ...default_scheme.item_recipe_choices,
            ...(saved_scheme.item_recipe_choices || {}),
        },
        scheme_for_recipe: default_scheme.scheme_for_recipe.map((default_recipe_scheme, idx) => ({
            ...default_recipe_scheme,
            ...(saved_scheme.scheme_for_recipe?.[idx] || {}),
        })),
        cost_weight: {
            占地: saved_cost_weight.占地 ?? default_scheme.cost_weight.占地,
            电力: saved_cost_weight.电力 ?? default_scheme.cost_weight.电力,
            建筑成本: {
                ...default_scheme.cost_weight.建筑成本,
                ...(saved_cost_weight.建筑成本 || {}),
            },
            物品额外成本: Object.fromEntries(
                Object.entries(default_scheme.cost_weight.物品额外成本).map(([item, default_extra_cost]) => [
                    item,
                    {
                        ...default_extra_cost,
                        ...(saved_cost_weight.物品额外成本?.[item] || {}),
                    },
                ])
            ),
        },
    };
}

export function SchemeStorage() {
    const global_state = useContext(GlobalStateContext);
    const set_scheme_data = useContext(SchemeDataSetterContext);
    const scheme_data = global_state.raw_scheme_data;
    const game_data = global_state.game_data;
    const game_name = global_state.game_data.game_name;
    return <SchemeStorageForGame key={game_name}
                                 game_name={game_name}
                                 game_data={game_data}
                                 scheme_data={scheme_data}
                                 set_scheme_data={set_scheme_data}/>;
}

function SchemeStorageForGame({game_name, game_data, scheme_data, set_scheme_data}) {
    const [all_scheme, set_all_scheme] = useState(() => read_scheme_storage(game_name));
    const [modal_show, set_modal_show] = useState(false);
    const [new_name, set_new_name] = useState('');

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
            set_scheme_data(normalize_saved_scheme_data(structuredClone(all_scheme[name]), game_data));
            set_modal_show(false);
        } else {
            alert(`未找到名为${name}的方案`);
        }
    }

    function save() {
        const name = new_name.trim();
        if (!name) {
            alert('请输入方案名');
            return;
        }
        if (name in all_scheme) {
            if (!confirm(`已存在名为${name}的方案，继续保存将覆盖原方案`)) {
                return;
            }
        }
        set_all_scheme({
            ...all_scheme,
            [name]: structuredClone(scheme_data),
        });
        set_new_name('');
    }

    const saved_names = Object.keys(all_scheme);

    return <>
        <button type="button"
                className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1 mobile-icon-button"
                title="生产策略"
                aria-label="生产策略"
                onClick={() => set_modal_show(true)}>
            <FaFolderOpen/>
            <span className="mobile-icon-button-label">生产策略</span>
        </button>
        <Modal show={modal_show} onHide={() => set_modal_show(false)} centered dialogClassName="storage-modal">
            <Modal.Header closeButton>
                <Modal.Title>生产策略</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="d-flex gap-2 align-items-center mb-3">
                    <input className="form-control form-control-sm"
                           placeholder="方案名"
                           value={new_name}
                           onChange={e => set_new_name(e.target.value)}
                           onKeyDown={e => {if (e.key === 'Enter') {e.preventDefault(); save();}}}/>
                    <button className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1 text-nowrap"
                            onClick={save}>
                        <FaSave/>保存当前方案
                    </button>
                </div>
                {saved_names.length === 0 ?
                    <div className="text-muted small">暂无已保存的方案</div> :
                    <div className="list-group list-group-flush">
                        {saved_names.map(name => (
                            <div key={name} className="list-group-item d-flex align-items-center gap-2 py-2 px-0">
                                <span className="flex-grow-1 text-truncate">{name}</span>
                                <button className="btn btn-outline-primary btn-sm d-inline-flex align-items-center gap-1"
                                        onClick={() => load(name)}>
                                    <FaFolderOpen/>加载
                                </button>
                                <button className="btn btn-outline-danger btn-sm d-inline-flex align-items-center gap-1"
                                        onClick={() => delete_(name)}>
                                    <FaTrashAlt/>删除
                                </button>
                            </div>
                        ))}
                    </div>
                }
            </Modal.Body>
        </Modal>
    </>;
}
