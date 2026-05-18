import {useContext, useEffect, useState} from 'react';
import {FaFolderOpen, FaSave, FaTrashAlt} from 'react-icons/fa';
import {Modal} from 'react-bootstrap';
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
    const [modal_show, set_modal_show] = useState(false);
    const [new_name, set_new_name] = useState('');

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
            set_modal_show(false);
        } else {
            alert(`未找到名为${name}的需求列表`);
        }
    }

    function save() {
        const name = new_name.trim();
        if (!name) {
            alert('请输入需求列表名');
            return;
        }
        if (name in all_scheme) {
            if (!confirm(`已存在名为${name}的需求列表，继续保存将覆盖原需求列表`)) {
                return;
            }
        }
        set_all_scheme({
            ...all_scheme,
            [name]: {...needs_list},
        });
        set_new_name('');
    }

    const saved_names = Object.keys(all_scheme);

    return <>
        <button type="button"
                className="btn btn-outline-secondary btn-sm d-inline-flex align-items-center gap-1 mobile-icon-button"
                title="需求列表"
                aria-label="需求列表"
                onClick={() => set_modal_show(true)}>
            <FaFolderOpen/>
            <span className="mobile-icon-button-label">需求列表</span>
        </button>
        <Modal show={modal_show} onHide={() => set_modal_show(false)} centered dialogClassName="storage-modal">
            <Modal.Header closeButton>
                <Modal.Title>需求列表</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="d-flex gap-2 align-items-center mb-3">
                    <input className="form-control form-control-sm"
                           placeholder="需求列表名"
                           value={new_name}
                           onChange={e => set_new_name(e.target.value)}
                           onKeyDown={e => {if (e.key === 'Enter') {e.preventDefault(); save();}}}/>
                    <button className="btn btn-primary btn-sm d-inline-flex align-items-center gap-1 text-nowrap"
                            onClick={save}>
                        <FaSave/>保存当前需求
                    </button>
                </div>
                {saved_names.length === 0 ?
                    <div className="text-muted small">暂无已保存的需求列表</div> :
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
