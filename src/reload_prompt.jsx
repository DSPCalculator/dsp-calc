import {useRegisterSW} from 'virtual:pwa-register/react';
import {CheckCircle2, RefreshCw, X} from 'lucide-react';
import {Button} from './components/ui/button';

export function ReloadPrompt() {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({onRegisterError: error => console.warn('PWA registration unavailable:', error)});
    if (!offlineReady && !needRefresh) return null;
    const dismiss = () => {setOfflineReady(false); setNeedRefresh(false);};
    return <div className="fixed right-4 bottom-4 z-50 flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-xl border bg-card p-4 text-sm shadow-lg" role="status">
        <CheckCircle2 className="size-4 shrink-0 text-emerald-600"/>
        <span>{needRefresh ? '发现新版本，刷新以更新' : '应用已可离线使用'}</span>
        {needRefresh && <Button size="sm" onClick={() => updateServiceWorker(true)}><RefreshCw className="size-3"/>刷新</Button>}
        <Button variant="ghost" size="icon" onClick={dismiss} aria-label="关闭更新提示"><X className="size-4"/></Button>
    </div>;
}
