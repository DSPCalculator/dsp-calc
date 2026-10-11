import {useContext, useEffect, useId, useState} from 'react';
import {FlaskConical, Gauge, Info, Orbit, Pickaxe, Sparkles} from 'lucide-react';
import {DefaultSettingsContext, GlobalStateContext, SettingsContext, SettingsSetterContext} from './contexts.jsx';
import {Input} from './components/ui/input';
import {Label} from './components/ui/label';
import {Switch} from './components/ui/switch';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from './components/ui/select';
import {Tooltip, TooltipContent, TooltipTrigger} from './components/ui/tooltip';

function SettingGroup({title, description, icon: Icon, children}) {
    return <section className="space-y-4 rounded-xl border bg-card p-4 sm:p-5">
        <div className="flex items-start gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <Icon className="size-4" aria-hidden="true"/>
            </span>
            <div>
                <h3 className="text-sm font-semibold">{title}</h3>
                {description && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>}
            </div>
        </div>
        <div className="space-y-4">{children}</div>
    </section>;
}

function NumberSetting({label, value, onChange, min = 0, max, step = 1, unit, fallback = value, integer = false}) {
    const id = useId();
    const [draft, setDraft] = useState(String(value));
    useEffect(() => setDraft(String(value)), [value]);
    const numeric = Number(draft);
    const invalid = draft.trim() === '' || !Number.isFinite(numeric) || numeric < min || (max !== undefined && numeric > max);

    function normalize(number) {
        const bounded = Math.min(max ?? Infinity, Math.max(min, number));
        return integer ? Math.floor(bounded) : Math.round(bounded * 10000) / 10000;
    }

    function update(next) {
        setDraft(next);
        const number = Number(next);
        if (next.trim() !== '' && Number.isFinite(number) && number >= min && (max === undefined || number <= max)) {
            onChange(normalize(number));
        }
    }

    function finish() {
        const next = normalize(draft.trim() !== '' && Number.isFinite(numeric) ? numeric : fallback);
        setDraft(String(next));
        onChange(next);
    }

    return <div className="grid grid-cols-[minmax(0,1fr)_7rem] items-center gap-x-3 gap-y-1">
        <Label htmlFor={id} className="text-xs leading-relaxed sm:text-sm">{label}</Label>
        <Input id={id} type="number" inputMode="decimal" min={min} max={max} step={step} value={draft}
               aria-invalid={invalid} aria-describedby={unit ? `${id}-unit` : undefined}
               onChange={event => update(event.target.value)} onBlur={finish}
               className="h-9 text-right tabular-nums"/>
        {unit && <span id={`${id}-unit`} className="col-span-2 text-right text-[11px] text-muted-foreground">{unit}</span>}
    </div>;
}

function ToggleSetting({label, checked, onChange, description}) {
    const id = useId();
    return <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
            <Label htmlFor={id} className="text-xs leading-relaxed sm:text-sm">{label}</Label>
            {description && <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>}
        </div>
        <Switch id={id} checked={checked} onCheckedChange={onChange}/>
    </div>;
}

export function Settings() {
    const settings = useContext(SettingsContext);
    const set_settings = useContext(SettingsSetterContext);
    const defaults = useContext(DefaultSettingsContext);
    const global_state = useContext(GlobalStateContext);
    const minute = settings.is_time_unit_minute;

    function number(name, label, options = {}) {
        return <NumberSetting key={name} label={label} value={settings[name]} fallback={defaults[name]}
                              onChange={value => set_settings({[name]: value})} {...options}/>;
    }

    function percent(name, label, step = 5, min = 100, unit = '%') {
        return <NumberSetting key={name} label={label} value={Math.round(settings[name] * 100)}
                              fallback={Math.round(defaults[name] * 100)} min={min} step={step} integer unit={unit}
                              onChange={value => set_settings({[name]: value / 100})}/>;
    }

    function toggle(name, label, description) {
        return <ToggleSetting key={name} label={label} description={description} checked={settings[name]}
                              onChange={checked => set_settings({[name]: checked})}/>;
    }

    const resources = [
        ['mining_speed_oil', '原油面板', '/s · 单个油井'],
        ['mining_speed_hydrogen', '巨星氢面板'],
        ['mining_speed_deuterium', '巨星重氢面板'],
        ['mining_speed_gas_hydrate', '巨星可燃冰面板'],
    ];
    const genesisResources = [
        ['mining_speed_helium', '巨星氦面板'],
        ['mining_speed_ammonia', '巨星氨面板'],
        ['mining_speed_nitrogen', '行星氮面板'],
        ['mining_speed_oxygen', '行星氧面板'],
        ['mining_speed_carbon_dioxide', '行星二氧化碳面板'],
        ['mining_speed_sulfur_dioxide', '行星二氧化硫面板'],
    ];

    return <div className="grid gap-4 md:grid-cols-2">
        <SettingGroup title="资源面板" description="填写游戏中的资源采集面板数值" icon={Orbit}>
            {global_state.game_data.mods?.every(mod => mod === 'DarkFogSynthesis') && <p className="text-xs text-muted-foreground">氢与重氢面板按同一气态巨星共享采集；可燃冰采集单独计算</p>}
            {resources.map(([name, label, unit]) => number(name, label, {min: 0.01, step: 0.1, unit: unit || '/s · 星球资源详情'}))}
            {global_state.game_data.GenesisBookEnable && genesisResources.map(([name, label]) =>
                number(name, label, {min: 0.01, step: 0.1, unit: '/s · 星球资源详情'}))}
        </SettingGroup>
        <SettingGroup title="采矿与制造" description="配置矿脉覆盖、科技加成与运输能力" icon={Pickaxe}>
            {number('covered_veins_small', '小矿机覆盖矿脉数', {min: 1, integer: true})}
            {number('covered_veins_large', '大矿机覆盖矿脉数', {min: 1, integer: true})}
            {percent('mining_efficiency_large', '大矿机开采速度', 100)}
            {percent('mining_speed_multiple', '采矿速度', 10, 100, '% · 科技面板右上')}
            {percent('enemy_drop_multiple', '残骸产出倍率', 4, 100, '% · 科技面板右上')}
            {percent('icarus_manufacturing_speed', '手动制造速度', 50)}
            <NumberSetting label="分馏带速" value={settings.fractionating_speed * (minute ? 60 : 1)}
                           fallback={defaults.fractionating_speed * (minute ? 60 : 1)} min={0.01} step="any"
                           unit={minute ? '个 / min' : '个 / sec'}
                           onChange={value => set_settings({fractionating_speed: value / (minute ? 60 : 1)})}/>
        </SettingGroup>
        <SettingGroup title="计算与显示" description="统一产量单位与结果的显示方式" icon={Gauge}>
            <div className="flex items-center justify-between gap-4">
                <Label htmlFor="settings-time-unit" className="text-xs sm:text-sm">速率单位</Label>
                <Select value={minute ? 'minute' : 'second'} onValueChange={value => set_settings({is_time_unit_minute: value === 'minute'})}>
                    <SelectTrigger id="settings-time-unit" className="w-36"><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="minute">个 / min（分钟）</SelectItem>
                        <SelectItem value="second">个 / sec（秒）</SelectItem>
                    </SelectContent>
                </Select>
            </div>
            {number('fixed_num', '精度位数', {min: 0, max: 100, integer: true})}
            {number('stack_research_lab', '研究站层数', {min: 1, integer: true})}
            {toggle('hide_mines', '隐藏原矿', '在生产需求表中隐藏原矿项目')}
        </SettingGroup>
        <SettingGroup title="增产剂" description="设置自喷涂及增产效果修正" icon={FlaskConical}>
            {toggle('proliferate_itself', '增产剂自喷涂')}
            {percent('acc_rate', '增产剂加速效率修正', 5, 1)}
            {percent('inc_rate', '增产剂增产效率修正', 5, 1)}
        </SettingGroup>
        {global_state.game_data.TheyComeFromVoidEnable && <SettingGroup title="深空来敌 · 元驱动" icon={Sparkles}
                                                                               description="更改元驱动后，请重新选择 MOD 以应用效果。">
            <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">{toggle('blue_buff', '蓝 Buff')}</div>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <button type="button" className="rounded-sm text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="查看蓝 Buff 效果">
                            <Info className="size-4"/>
                        </button>
                    </TooltipTrigger>
                    <TooltipContent className="max-w-72 leading-relaxed">
                        制造厂在制造原材料至少 2 种的配方时，每产出 1 个产物，会返还 1 个第 1 位置的原材料。
                    </TooltipContent>
                </Tooltip>
            </div>
        </SettingGroup>}
    </div>;
}
