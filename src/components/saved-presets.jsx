import {useId, useMemo, useState, useSyncExternalStore} from 'react';
import {ChevronDown, FolderOpen, Save, Trash2} from 'lucide-react';
import {Button} from './ui/button';
import {Input} from './ui/input';
import {Label} from './ui/label';
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle} from './ui/dialog';
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger} from './ui/dropdown-menu';
import {getStorageSnapshot, isStorageRecord, readStorageObject, subscribeStorage, updateScopedStorage} from '../lib/storage.js';

/** A shared, game-scoped preset manager for both legacy save formats. */
export function SavedPresets({storageKey, scope, label, noun, value, onLoad, saveDescription}) {
    const id = useId();
    const raw = useSyncExternalStore(subscribeStorage, () => getStorageSnapshot(storageKey), () => null);
    const presets = useMemo(() => {
        try {
            const all = raw ? JSON.parse(raw) : {};
            return isStorageRecord(all) && isStorageRecord(all[scope]) ? all[scope] : {};
        } catch {
            return {};
        }
    }, [raw, scope]);
    const [dialog, setDialog] = useState(null);
    const [name, setName] = useState('');
    const [error, setError] = useState('');
    const [status, setStatus] = useState('');
    const names = Object.keys(presets);
    const trimmedName = name.trim();
    const willReplace = Object.hasOwn(presets, trimmedName);

    function openDialog(mode, presetName = '') {
        setName(presetName);
        setError('');
        setStatus('');
        setDialog(mode);
    }

    function reportError(cause) {
        setError(cause instanceof Error ? cause.message : '操作失败，请检查浏览器是否允许保存本地数据。');
    }

    function load(presetName) {
        try {
            const all = readStorageObject(storageKey);
            if (!isStorageRecord(all[scope]) || !Object.hasOwn(all[scope], presetName)) {
                throw new Error(`未找到${noun}「${presetName}」，它可能已在另一窗口被删除。`);
            }
            onLoad(structuredClone(all[scope][presetName]));
            setError('');
            setStatus(`已加载「${presetName}」`);
        } catch (cause) {
            reportError(cause);
        }
    }

    function save(event) {
        event.preventDefault();
        if (!trimmedName) {
            setError(`请输入${noun}名称。`);
            return;
        }
        try {
            updateScopedStorage(storageKey, scope, current => ({...current, [trimmedName]: structuredClone(value)}));
            setDialog(null);
            setStatus(`已保存「${trimmedName}」`);
            setError('');
        } catch (cause) {
            reportError(cause);
        }
    }

    function remove() {
        try {
            updateScopedStorage(storageKey, scope, current => {
                delete current[name];
                return current;
            });
            setDialog(null);
            setStatus(`已删除「${name}」`);
            setError('');
        } catch (cause) {
            reportError(cause);
        }
    }

    return <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="flex items-center gap-1">
            <Button variant="outline" size="sm" onClick={() => openDialog('save')} title={`保存${label}`}>
                <Save className="size-3.5" aria-hidden="true"/>保存
            </Button>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" disabled={!names.length} title={`加载${label}`}>
                        <FolderOpen className="size-3.5" aria-hidden="true"/>加载<ChevronDown className="size-3" aria-hidden="true"/>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="max-h-72 min-w-48 overflow-y-auto">
                    <DropdownMenuLabel>已保存的{noun}</DropdownMenuLabel>
                    <DropdownMenuSeparator/>
                    {names.map(presetName => <DropdownMenuItem key={presetName} onSelect={() => load(presetName)}>
                        <FolderOpen className="size-4" aria-hidden="true"/><span className="max-w-64 truncate">{presetName}</span>
                    </DropdownMenuItem>)}
                </DropdownMenuContent>
            </DropdownMenu>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="size-8 text-muted-foreground" disabled={!names.length}
                            aria-label={`删除已保存的${label}`} title={`删除已保存的${label}`}>
                        <Trash2 className="size-3.5" aria-hidden="true"/>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-72 min-w-48 overflow-y-auto">
                    <DropdownMenuLabel>删除已保存的{noun}</DropdownMenuLabel>
                    <DropdownMenuSeparator/>
                    {names.map(presetName => <DropdownMenuItem key={presetName} className="text-destructive focus:text-destructive"
                                                              onSelect={() => openDialog('delete', presetName)}>
                        <Trash2 className="size-4" aria-hidden="true"/><span className="max-w-64 truncate">{presetName}</span>
                    </DropdownMenuItem>)}
                </DropdownMenuContent>
            </DropdownMenu>
        </div>
        {status && <span role="status" className="max-w-52 truncate text-xs text-muted-foreground" title={status}>{status}</span>}
        {error && !dialog && <span role="alert" className="text-xs text-destructive">{error}</span>}
        <Dialog open={dialog !== null} onOpenChange={open => { if (!open) setDialog(null); }}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>{dialog === 'delete' ? `删除${noun}` : `保存${noun}`}</DialogTitle>
                    <DialogDescription>
                        {dialog === 'delete' ? `删除「${name}」后无法恢复，当前计算内容不会改变。` : saveDescription || `保存在此浏览器中，仅用于当前游戏版本。`}
                    </DialogDescription>
                </DialogHeader>
                {dialog === 'save' ? <form onSubmit={save} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor={id}>{noun}名称</Label>
                        <Input id={id} value={name} autoFocus maxLength={120} placeholder={`例如：戴森球量产${noun}`}
                               onChange={event => { setName(event.target.value); setError(''); }}/>
                        {willReplace && <p className="text-sm text-amber-600 dark:text-amber-400">已存在同名{noun}，保存将覆盖原内容。</p>}
                        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                    </div>
                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={() => setDialog(null)}>取消</Button>
                        <Button type="submit" disabled={!trimmedName}>{willReplace ? '覆盖保存' : '保存'}</Button>
                    </DialogFooter>
                </form> : <>
                    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDialog(null)}>取消</Button>
                        <Button variant="destructive" onClick={remove}>确认删除</Button>
                    </DialogFooter>
                </>}
            </DialogContent>
        </Dialog>
    </div>;
}
