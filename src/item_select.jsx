import {useContext, useMemo, useRef, useState} from 'react';
import {Check, ChevronDown, PackageSearch, Search, X} from 'lucide-react';
import fuzzysort from 'fuzzysort';
import {pinyin} from 'pinyin-pro';
import {CompactModeContext, GameInfoContext} from './contexts.jsx';
import {GameIcon, ItemIcon} from './icon.jsx';
import {Button} from './components/ui/button';
import {Input} from './components/ui/input';
import {Badge} from './components/ui/badge';
import {Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger} from './components/ui/dialog';
import {Tooltip, TooltipContent, TooltipTrigger} from './components/ui/tooltip';
import {Tabs, TabsContent, TabsList, TabsTrigger} from './components/ui/tabs';
import {buildGamePickerLayout} from './lib/game-picker-layout.js';
import {cn} from './lib/utils.js';

function CompactItemTile({entry, selected, iconSize, onSelect, searchPrimary = false}) {
    return <Tooltip>
        <TooltipTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label={`选择${entry.item}`} aria-pressed={selected}
                    className={cn('relative size-[var(--picker-tile-size)] rounded-md border border-transparent bg-muted/40 p-0 hover:border-border hover:bg-accent focus-visible:z-10',
                        selected && 'border-primary/60 bg-primary/10', searchPrimary && 'ring-1 ring-primary/60')}
                    data-search-primary={searchPrimary || undefined}
                    style={entry.col ? {gridColumn: entry.col, gridRow: entry.row} : undefined}
                    onClick={() => onSelect(entry.item)}>
                {entry.iconName ? <GameIcon icon={entry.iconName} size={iconSize}/> : <ItemIcon item={entry.item} size={iconSize} tooltip={false}/>}
                {entry.label && <span className="sr-only">{entry.label}</span>}
                {selected && <Check className="absolute right-0.5 top-0.5 size-2.5 rounded-full bg-background text-primary" aria-hidden="true"/>}
            </Button>
        </TooltipTrigger>
        <TooltipContent side="top" sideOffset={4}>{entry.label || entry.item}</TooltipContent>
    </Tooltip>;
}

function GamePageGrid({page, selected, iconSize, onSelect, matches, enterTarget}) {
    if (page.id === 'other') return <div className="space-y-2">
        <p className="text-[11px] text-muted-foreground">这些物品没有可用的游戏格位</p>
        <div className="grid w-max gap-[3px]" style={{gridTemplateColumns: `repeat(${page.columns}, var(--picker-tile-size))`}}
             role="group" aria-label="其它可选物品">
            {page.entries.map(entry => <CompactItemTile key={entry.item} entry={entry} selected={entry.item === selected}
                iconSize={iconSize} onSelect={onSelect}/>)}
        </div>
    </div>;
    if (!page.rows) return <p className="py-8 text-center text-sm text-muted-foreground">此分页暂无可选物品</p>;
    const rowStyle = {gridTemplateRows: `repeat(${page.rows}, var(--picker-tile-size))`};
    return <div className="flex w-max gap-2">
        <div className="grid w-5 shrink-0 gap-[3px] text-center text-[11px] tabular-nums text-muted-foreground"
             style={rowStyle} aria-label="游戏网格行号">
            {Array.from({length: page.rows}, (_, index) => <span key={index} className="flex items-center justify-center"
                aria-label={`第 ${index + 1} 行`}>{index + 1}</span>)}
        </div>
        <div className="grid w-max gap-[3px]" role="group" aria-label={`${page.label}固定位置网格`}
             style={{...rowStyle, gridTemplateColumns: `repeat(${page.columns}, var(--picker-tile-size))`}}>
            {page.cells.map(({row, col, entry}) => entry && (!matches || matches.has(entry.item))
                ? <CompactItemTile key={`${row}:${col}`} entry={entry} selected={entry.item === selected} iconSize={iconSize} onSelect={onSelect} searchPrimary={entry.item === enterTarget}/>
                : <span key={`${row}:${col}`} data-slot="picker-empty-slot" aria-hidden="true"
                        className="size-[var(--picker-tile-size)] rounded-md border border-border/30 bg-muted/15"
                        style={{gridColumn: col, gridRow: row}}/>) }
        </div>
    </div>;
}

export function ItemSelect({item, set_item, text = '选择物品', icon, disabled = false, variant, className}) {
    const game_info = useContext(GameInfoContext);
    const compactMode = useContext(CompactModeContext);
    const iconSize = compactMode === 'mobile' ? 28 : 40;
    const tileSize = iconSize + 4;
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [pageId, setPageId] = useState('1');
    const inputRef = useRef(null);
    const composing = useRef(false);
    const layout = useMemo(() => buildGamePickerLayout(game_info), [game_info]);
    const activePage = layout.pages.find(page => page.id === pageId) ?? layout.pages[0];
    const targets = useMemo(() => layout.names.map(name => ({
        item: name,
        py_first: pinyin(name, {pattern: 'first', type: 'array'}).join(''),
        py_full: pinyin(name, {toneType: 'none'}),
        py_joined: pinyin(name, {toneType: 'none', type: 'array'}).join(''),
    })), [layout]);
    const results = useMemo(() => {
        const search = query.trim();
        return search
            ? fuzzysort.go(search, targets, {keys: ['item', 'py_first', 'py_full', 'py_joined']}).map(result => result.obj.item)
            : layout.names;
    }, [query, targets, layout]);
    const searching = Boolean(query.trim());
    const crafting = layout.layoutKind === 'replicator';
    const matches = searching ? new Set(results) : undefined;
    const extras = layout.extras ?? [];
    const extraPage = {id: 'extras', label: '补充物品', rows: Math.ceil(extras.length / layout.columns), columns: layout.columns,
        cells: extras.map((entry, index) => ({row: Math.floor(index / layout.columns) + 1, col: index % layout.columns + 1,
            entry: {...entry, row: Math.floor(index / layout.columns) + 1, col: index % layout.columns + 1}}))};

    function select(target) {
        const result = set_item(target);
        if (result !== false) setOpen(false);
    }

    function changeOpen(next) {
        if (next) {
            setQuery('');
            const selectedPage = layout.pages.find(page => page.entries.some(entry => entry.item === item));
            if (selectedPage) setPageId(selectedPage.id);
            else if (!layout.pages.some(page => page.id === pageId && page.entries.length)) {
                setPageId(layout.pages.find(page => page.entries.length)?.id ?? '1');
            }
        }
        composing.current = false;
        setOpen(next);
    }

    function clearSearch() {
        setQuery('');
        inputRef.current?.focus();
    }

    return <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild>
            <Button type="button" variant={variant || (item ? 'outline' : 'default')} disabled={disabled}
                    className={cn('gap-2', className)} title={text} aria-label={item ? `${text}：${item}` : text}>
                {item && <ItemIcon item={item} size={24} tooltip={false}/>}
                {!item && icon}
                <span className="max-w-48 truncate">{item || text}</span>
                {item && <ChevronDown className="size-3.5 text-muted-foreground" aria-hidden="true"/>}
            </Button>
        </DialogTrigger>
        <DialogContent className="flex max-h-[90dvh] max-w-[calc(100vw-1rem)] flex-col gap-3 overflow-hidden p-3 sm:max-w-[calc(100vw-2rem)] sm:p-4"
                       style={{'--picker-tile-size': `${tileSize}px`, width: `${Math.max(360, layout.columns * (tileSize + 3) - 3 + (crafting ? 88 : 68))}px`}}>
            <DialogHeader className="shrink-0 gap-1 pr-6 text-left">
                <DialogTitle className="text-base">选择物品</DialogTitle>
                <DialogDescription className="text-xs">{crafting ? '按游戏合成面板排列；原矿、掉落等补充物品列在下方。搜索保留格位。' : '保留模组物品分页、行列与空位，支持名称、拼音与首字母搜索。'}</DialogDescription>
            </DialogHeader>
            <div className="relative shrink-0">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true"/>
                <Input ref={inputRef} autoFocus type="search" value={query} placeholder="搜索所有分页，例如：铁块 / tiekuai / tk"
                       aria-label="搜索物品，支持中文和拼音" className="h-9 pl-9 pr-10 text-sm [&::-webkit-search-cancel-button]:hidden"
                       onChange={event => setQuery(event.target.value)}
                       onCompositionStart={() => { composing.current = true; }}
                       onCompositionEnd={() => { composing.current = false; }}
                       onKeyDown={event => {
                           if (event.key === 'Enter' && !composing.current && !event.nativeEvent.isComposing && event.keyCode !== 229 && query.trim() && results.length) {
                               event.preventDefault();
                               select(results[0]);
                           }
                       }}/>
                {query && <Button type="button" variant="ghost" size="icon" className="absolute right-1 top-1/2 size-7 -translate-y-1/2"
                                  aria-label="清除搜索" onClick={clearSearch}><X className="size-3.5"/></Button>}
            </div>
            <Tabs value={activePage.id} onValueChange={value => { setPageId(value); setQuery(''); }} className="min-h-0 gap-3">
                <div className="shrink-0 overflow-x-auto overflow-y-hidden">
                    <TabsList aria-label="游戏物品分页" className="h-8">
                        {layout.pages.map(page => <TabsTrigger key={page.id} value={page.id} className="px-3 text-xs">{page.label}</TabsTrigger>)}
                    </TabsList>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-2 text-[11px] text-muted-foreground">
                    <span>{searching ? (crafting && results.length ? `所有分页 · Enter 选择：${results[0]}` : '所有分页 · Enter 选择首项') : `${activePage.label} · 悬停查看名称`}</span>
                    <Badge variant="secondary" className="px-1.5 py-0 text-[10px]" aria-live="polite">{searching ? results.length : activePage.entries.length} {crafting && !searching ? '格' : '项'}</Badge>
                </div>
                <div className="min-h-0 overflow-auto overscroll-contain rounded-md p-0.5" aria-label={searching ? '物品搜索结果' : '游戏物品布局'}>
                {searching && crafting ? <TabsContent value={activePage.id} aria-labelledby={undefined} aria-label="所有分页搜索结果">
                    {results.length ? <div className="space-y-4">{layout.pages.filter(page => page.entries.some(entry => matches.has(entry.item))).map(page => <section key={page.id} className="space-y-2">
                        <h3 className="text-xs font-medium">{page.label}</h3>
                        <GamePageGrid page={page} selected={item} iconSize={iconSize} onSelect={select} matches={matches} enterTarget={searching ? results[0] : undefined}/>
                    </section>)}</div> : <p className="py-5 text-sm text-muted-foreground">没有找到相关物品</p>}
                </TabsContent> : searching ? <TabsContent value={activePage.id} aria-labelledby={undefined} aria-label="所有分页搜索结果">{results.length ? <div className="grid gap-1 sm:grid-cols-2">
                    {results.map((target, index) => <Button key={target} type="button" variant="ghost"
                        aria-label={`选择${target}`} aria-pressed={target === item}
                        className={cn('h-9 min-w-0 justify-start gap-2 rounded-md border border-transparent px-2 text-xs font-normal',
                            target === item && 'border-primary/60 bg-primary/10',
                            index === 0 && 'border-border bg-accent')}
                        onClick={() => select(target)}>
                        <ItemIcon item={target} size={24} tooltip={false}/>
                        <span className="truncate">{target}</span>
                        {target === item && <Check className="ml-auto size-3 shrink-0 text-primary" aria-hidden="true"/>}
                    </Button>)}
                </div> : <div className="flex min-h-36 flex-col items-center justify-center gap-2 px-3 text-center">
                    <PackageSearch className="size-7 text-muted-foreground/60" aria-hidden="true"/>
                    <p className="text-sm font-medium">没有找到相关物品</p>
                    <p className="text-xs text-muted-foreground">试试更短的名称、拼音首字母，或检查已启用的模组。</p>
                    <Button variant="outline" size="sm" onClick={clearSearch}>返回游戏布局</Button>
                </div>}</TabsContent> : layout.pages.map(page => <TabsContent key={page.id} value={page.id}>
                    <GamePageGrid page={page} selected={item} iconSize={iconSize} onSelect={select}/>
                </TabsContent>)}
                {crafting && extras.length > 0 && (!searching || extras.some(entry => matches.has(entry.item))) && <section className="mt-4 space-y-2 border-t pt-3" aria-label="合成面板外的补充物品">
                    <h3 className="text-xs font-medium">补充物品 · 原矿、掉落与其它产物</h3>
                    <GamePageGrid page={extraPage} selected={item} iconSize={iconSize} onSelect={select} matches={matches} enterTarget={searching ? results[0] : undefined}/>
                </section>}
                </div>
            </Tabs>
            {!searching && <p className="shrink-0 text-[10px] text-muted-foreground md:hidden">可横向滚动查看完整布局，也可直接搜索物品</p>}
        </DialogContent>
    </Dialog>;
}
