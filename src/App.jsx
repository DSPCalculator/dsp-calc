import {useContext, useState} from 'react';
import {Box, ChevronDown, CircleHelp, Cpu, Layers3, RotateCcw, Settings2, SlidersHorizontal} from 'lucide-react';
import {BatchSetting} from './batch_setting.jsx';
import {ContextProvider, GameInfoContext, GameInfoSetterContext, NeedsListContext, NeedsListSetterContext, SettingsContext, SettingsSetterContext, StorageWarningContext} from './contexts.jsx';
import {NeedsList, NeedsListStorage} from './needs_list.jsx';
import {Result} from './result.jsx';
import {SchemeStorage} from './scheme_data.jsx';
import {Settings} from './settings.jsx';
import {get_game_data, get_mod_options, normalize_mod_list, DarkFogSynthesisGUID, dark_fog_synthesis_description, MoreMegaStructureGUID, TheyComeFromVoidGUID, vanilla_data_description} from './GameData.jsx';
import {Button} from './components/ui/button';
import {Badge} from './components/ui/badge';
import {Card, CardContent, CardDescription, CardHeader, CardTitle} from './components/ui/card';
import {Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger} from './components/ui/dialog';
import {Checkbox} from './components/ui/checkbox';
import {Tabs, TabsList, TabsTrigger} from './components/ui/tabs';

function GameVersion() {
    const game_info = useContext(GameInfoContext);
    const set_game_data = useContext(GameInfoSetterContext);
    const set_settings = useContext(SettingsSetterContext);
    const [open, setOpen] = useState(false);
    const [mods, setMods] = useState(() => {
        try { const saved = JSON.parse(localStorage.getItem('auto_mods')); return normalize_mod_list(saved); } catch { return []; }
    });
    const [draft, setDraft] = useState(mods);
    const options = get_mod_options();
    const changeOpen = value => { if (value) setDraft(mods); setOpen(value); };
    const toggle = (mod, checked) => {
        let selected = checked ? [...draft, mod] : draft.filter(value => value !== mod);
        if (checked && mod === TheyComeFromVoidGUID && !selected.includes(MoreMegaStructureGUID)) selected.push(MoreMegaStructureGUID);
        if (!checked && mod === MoreMegaStructureGUID) selected = selected.filter(value => value !== TheyComeFromVoidGUID);
        setDraft(options.map(option => option.value).filter(value => selected.includes(value)));
    };
    const incompatible = mod => mod === DarkFogSynthesisGUID
        ? draft.some(value => value !== DarkFogSynthesisGUID)
        : draft.includes(DarkFogSynthesisGUID);
    const apply = () => {
        const data = get_game_data(draft);
        setMods(draft);
        try { localStorage.setItem('auto_mods', JSON.stringify(draft)); } catch { /* The selected dataset remains usable without persistence. */ }
        // Change the game and its saved strategy as one state transition.
        set_game_data(data);
        // Existing recipe ids and mineralizations belong to the previous dataset.
        set_settings({
            natural_production_line: [], production_sources: [], mineralize_list: {},
            mining_speed_oil: 3, mining_speed_hydrogen: 1,
            mining_speed_deuterium: data.GenesisBookEnable ? 0.05 : 0.2,
            mining_speed_gas_hydrate: data.GenesisBookEnable ? 0.8 : 0.5,
            ...(data.GenesisBookEnable ? {mining_speed_helium: 0.02, mining_speed_ammonia: 0.3, mining_speed_nitrogen: 1.2, mining_speed_oxygen: 0.6, mining_speed_carbon_dioxide: 0.4, mining_speed_sulfur_dioxide: 0.6} : {}),
        });
        setOpen(false);
    };
    return <Dialog open={open} onOpenChange={changeOpen}>
        <DialogTrigger asChild><Button variant="outline" size="sm"><Box className="size-4"/><span>{game_info.game_data.mods.length ? `${game_info.game_data.mods.length} 个模组` : '原版游戏'}</span><ChevronDown className="size-3 text-muted-foreground"/></Button></DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
            <DialogHeader><DialogTitle>游戏与模组</DialogTitle><DialogDescription>{vanilla_data_description}</DialogDescription></DialogHeader>
            <div className="space-y-2 py-2">{options.map(option => <label key={option.value} className={`flex items-center gap-3 rounded-lg border p-3 ${incompatible(option.value) ? 'cursor-not-allowed opacity-50' : 'cursor-default hover:bg-accent'}`}><Checkbox disabled={incompatible(option.value)} checked={draft.includes(option.value)} onCheckedChange={checked => toggle(option.value, checked)}/><span className="text-sm font-medium">{option.label}</span></label>)}</div>
            <p className="text-xs leading-relaxed text-muted-foreground">{dark_fog_synthesis_description} 请先取消其它模组，再启用黑雾合成。</p>
            {<p className="rounded-lg bg-muted p-3 text-xs leading-relaxed text-muted-foreground">切换模组会清空当前需求、现有产线与原矿化列表，并重置对应采集参数。已保存的需求列表和生产策略会按游戏版本保留。深空来敌会自动启用更多巨构。</p>}
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>取消</Button><Button onClick={apply} disabled={JSON.stringify(mods) === JSON.stringify(draft)}>应用模组</Button></DialogFooter>
        </DialogContent>
    </Dialog>;
}

function AppWithContexts() {
    const needs_list = useContext(NeedsListContext);
    const set_needs_list = useContext(NeedsListSetterContext);
    const [show_ore_popup, set_show_ore_popup] = useState(false);
    const [show_building_popup, set_show_building_popup] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);
    const [productionFocusRequest, setProductionFocusRequest] = useState(null);
    const settings = useContext(SettingsContext);
    const storageWarning = useContext(StorageWarningContext);
    const set_settings = useContext(SettingsSetterContext);
    const game_info = useContext(GameInfoContext);
    const clearData = () => {
        ['auto_mods', 'auto_scheme', 'auto_settings', 'scheme_data', 'needs_list', 'game_data_migration_backups'].forEach(key => localStorage.removeItem(key));
        window.location.reload();
    };
    return <main id="main" className="mx-auto min-h-[calc(100dvh-4rem)] max-w-[1800px] space-y-6 px-4 py-6 sm:px-8 sm:py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="space-y-2">
                <div className="flex items-center gap-2 text-[11px] font-medium tracking-[0.16em] text-muted-foreground"><span className="size-1.5 rounded-full bg-emerald-500"/>PRODUCTION PLANNER</div>
                <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">从一颗矿石，到整个宇宙</h1>
                <p className="text-sm text-muted-foreground">设定目标产量，规划每一条生产线</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <GameVersion/>
                <Dialog><DialogTrigger asChild><Button variant="outline" size="sm"><Settings2 className="size-4"/>参数设置</Button></DialogTrigger>
                    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl"><DialogHeader><DialogTitle>采矿参数与计算设置</DialogTitle><DialogDescription>更改会立即应用，自动保存在当前浏览器</DialogDescription></DialogHeader><Settings/></DialogContent>
                </Dialog>
            </div>
        </div>
        {storageWarning && <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">{storageWarning}</p>}
        <Card className="gap-0 overflow-hidden py-0 shadow-none">
            <CardHeader className="gap-3 border-b px-4 py-4 sm:px-6">
                <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-md bg-muted"><Layers3 className="size-4"/></span><CardTitle className="text-base">生产目标</CardTitle><Badge variant="secondary" className="font-mono text-xs">{Object.keys(needs_list).length}</Badge></div>
                    <Tabs value={settings.is_time_unit_minute ? 'minute' : 'second'} onValueChange={value => set_settings({is_time_unit_minute: value === 'minute'})} aria-label="产量时间单位"><TabsList className="h-8"><TabsTrigger className="px-3 text-xs" value="minute">每分钟</TabsTrigger><TabsTrigger className="px-3 text-xs" value="second">每秒</TabsTrigger></TabsList></Tabs>
                </div>
                <CardDescription className="text-xs">添加需要生产的物品，计算原料、建筑与电力需求。配方分叉仅用于当前目标，保存需求列表可保留完整方案。</CardDescription>
            </CardHeader>
            <CardContent className="p-4 sm:p-6"><NeedsList onShowProductionSource={item => setProductionFocusRequest({item})} needs_list={needs_list} set_needs_list={set_needs_list} set_show_ore_popup={set_show_ore_popup} set_show_building_popup={set_show_building_popup}/></CardContent>
            <div className="flex flex-wrap items-center gap-4 border-t bg-muted/25 px-4 py-3 sm:px-6"><NeedsListStorage/><span className="hidden h-5 border-l sm:block"/><SchemeStorage/><span className="ml-auto hidden items-center gap-1.5 text-[11px] text-muted-foreground xl:flex"><span className={`size-1.5 rounded-full ${storageWarning ? 'bg-amber-500' : 'bg-emerald-500'}`}/>{storageWarning ? '自动保存不可用' : '策略与参数自动保存，分叉需命名保存'}</span></div>
        </Card>
        <Card className="gap-0 py-0 shadow-none">
            <details className="group" open>
                <summary className="flex cursor-default list-none items-center gap-2 px-4 py-4 text-sm font-medium sm:px-6"><SlidersHorizontal className="size-4 text-muted-foreground"/>批量生产预设<span className="ml-1 hidden text-xs font-normal text-muted-foreground sm:inline">统一设置建筑与增产策略</span><ChevronDown className="ml-auto size-4 text-muted-foreground transition-transform group-open:rotate-180"/></summary>
                <div className="border-t px-4 py-4 sm:px-6"><BatchSetting/></div>
            </details>
        </Card>
        <Result focus_request={productionFocusRequest} needs_list={needs_list} set_needs_list={set_needs_list} show_ore_popup={show_ore_popup} set_show_ore_popup={set_show_ore_popup} show_building_popup={show_building_popup} set_show_building_popup={set_show_building_popup}/>
        <footer className="flex flex-wrap items-center justify-between gap-4 border-t pt-5 pb-2 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-2"><Cpu className="size-3.5"/><span>{Object.keys(game_info.item_data).length} 种物品 · {game_info.game_data.recipe_data.length} 条配方</span><span className="mx-1">·</span><a href="https://github.com/DSPCalculator/dsp-calc" target="_blank" rel="noreferrer" className="hover:text-foreground">基于 DSPCalculator · MulanPSL-2.0</a></div>
            <div className="flex items-center gap-3"><Dialog><DialogTrigger asChild><Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground"><CircleHelp className="size-3.5"/>关于</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>关于 DSP Calc</DialogTitle><DialogDescription>戴森球计划量化计算器</DialogDescription></DialogHeader><p className="text-sm leading-relaxed">基于 DSPCalculator/dsp-calc 的开源生产规划工具。游戏数据与计算模型遵循上游项目，本分支使用 React 与 shadcn/ui 构建界面。</p><p className="text-sm text-muted-foreground">原作者 QQ：653524123<br/>反馈群：816367922</p><Button variant="outline" asChild><a href="https://space.bilibili.com/16051534" target="_blank" rel="noreferrer">联系原作者</a></Button></DialogContent></Dialog>
                <Dialog open={resetOpen} onOpenChange={setResetOpen}><DialogTrigger asChild><Button variant="ghost" size="sm" className="h-7 px-2 text-xs text-muted-foreground"><RotateCcw className="size-3.5"/>重置数据</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>重置计算器数据？</DialogTitle><DialogDescription>将删除此浏览器中所有保存的生产策略、需求列表、模组选择与计算设置。此操作无法撤销。</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={() => setResetOpen(false)}>取消</Button><Button variant="destructive" onClick={clearData}>确认重置</Button></DialogFooter></DialogContent></Dialog>
            </div>
        </footer>
    </main>;
}

export default function App() {
    return <ContextProvider><AppWithContexts/></ContextProvider>;
}
