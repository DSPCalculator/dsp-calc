import { ArrowUpRight, Atom, Code2, Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeContext.jsx';
import { Button } from './components/ui/button';
import { Badge } from './components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from './components/ui/tooltip';

export function Header() {
    const {theme, toggleTheme} = useTheme();
    return <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-[1800px] items-center justify-between gap-3 px-4 sm:px-8">
            <a href="#main" className="group flex min-w-0 items-center gap-3 no-underline" aria-label="DSP Calc 首页">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Atom className="size-5" strokeWidth={1.7}/></span>
                <span className="text-lg font-semibold tracking-tight">DSP<span className="ml-1.5 font-normal text-muted-foreground">Calc</span></span>
                <span className="mx-1 hidden h-5 border-l sm:block"/>
                <span className="hidden text-sm text-muted-foreground sm:block">戴森球计划量化计算器</span>
                <Badge variant="outline" className="hidden font-mono text-[10px] lg:inline-flex">v{import.meta.env.VITE_APP_VERSION}</Badge>
            </a>
            <nav aria-label="主要导航" className="flex items-center gap-1">
                <Button variant="ghost" size="sm" asChild className="hidden sm:inline-flex"><a href="https://www.bilibili.com/read/readlist/rl630834" target="_blank" rel="noreferrer">计算原理<ArrowUpRight className="size-3.5"/></a></Button>
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" asChild><a href="https://github.com/idkwhodatis/dsp-calc" target="_blank" rel="noreferrer" aria-label="打开 GitHub 仓库"><Code2 className="size-4"/></a></Button></TooltipTrigger><TooltipContent>开源仓库</TooltipContent></Tooltip>
                <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon" onClick={toggleTheme} aria-label={theme === 'light' ? '切换到深色主题' : '切换到浅色主题'}>{theme === 'light' ? <Moon className="size-4"/> : <Sun className="size-4"/>}</Button></TooltipTrigger><TooltipContent>{theme === 'light' ? '深色主题' : '浅色主题'}</TooltipContent></Tooltip>
            </nav>
        </div>
    </header>;
}
