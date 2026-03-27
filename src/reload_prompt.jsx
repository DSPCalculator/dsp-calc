import {useRegisterSW} from 'virtual:pwa-register/react';

const TOAST_STYLE = {
    position: 'fixed',
    bottom: '1rem',
    right: '1rem',
    zIndex: 9999,
    maxWidth: '360px',
};

export function ReloadPrompt() {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('SW registered:', r);
        },
        onRegisterError(error) {
            console.error('SW registration error:', error);
        },
    });

    const dismiss = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    if (!offlineReady && !needRefresh) return null;

    return (
        <div className="alert alert-info shadow d-flex align-items-center gap-2 mb-0" style={TOAST_STYLE} role="alert">
            <span className="flex-grow-1">
                {offlineReady
                    ? '应用已可离线使用'
                    : '发现新版本，点击刷新以更新'}
            </span>
            {needRefresh && (
                <button
                    className="btn btn-primary btn-sm"
                    onClick={() => updateServiceWorker(true)}
                >
                    刷新
                </button>
            )}
            <button
                className="btn btn-outline-secondary btn-sm"
                onClick={dismiss}
            >
                关闭
            </button>
        </div>
    );
}
