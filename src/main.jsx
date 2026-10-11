import React, {Suspense, lazy} from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import {Header} from './header.jsx';
import {IconStyles} from './icon.jsx';
import {ThemeProvider} from './ThemeContext.jsx';
import {TooltipProvider} from './components/ui/tooltip';
import './index.css';

const ReloadPrompt = lazy(() => import('./reload_prompt.jsx').then(module => ({default: module.ReloadPrompt})));

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <ThemeProvider>
            <TooltipProvider delayDuration={300}>
                <a className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-primary focus:p-3 focus:text-primary-foreground" href="#main">跳转到计算器</a>
                <IconStyles/>
                <Header/>
                <App/>
                {'serviceWorker' in navigator && <Suspense fallback={null}><ReloadPrompt/></Suspense>}
            </TooltipProvider>
        </ThemeProvider>
    </React.StrictMode>,
);
