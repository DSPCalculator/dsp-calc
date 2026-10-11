# Dark Fog Synthesis 数据支持 / data support

Verified on 2026-10-05 against the author's frozen V1 definitions at
[`8aeb354826c1996db230a011e9473cee329116d0`](https://github.com/idkwhodatis/DarkFogSynthesis/tree/8aeb354826c1996db230a011e9473cee329116d0).
This is calculator data support for experimental mod **0.1.0**, GUID
`idkwhodatis.darkfogsynthesis`. It is not certification that the mod runs safely
in a particular DSP version or alongside another mod.

## 使用方式

在「游戏与模组」中先取消其它模组，勾选 **黑雾合成 · Dark Fog Synthesis
v0.1.0**，然后「应用模组」。开启后六种物品默认使用合成，原来的黑雾掉落仍是
第一个配方选项，可以混用独立来源。黑雾引力透镜的黑雾矩阵投入会自动展开为
制造链；例如每分钟 10 个透镜需要 120 个黑雾矩阵，由 8 座普通矩阵研究站合成
（不喷涂、1×速度）。核心素每个准确消耗 **2 个反物质**。硅基神经元每个
消耗 **2 个微晶元件、2 个钛合金、2 个晶格硅**，不再消耗粒子宽带。

切换配置会按既有行为清空当前目标、现有产线及原矿化列表；已命名保存的需求
完整计划和生产策略分配置保存。刷新恢复模组和策略，但不会自动恢复临时目标
或分叉；需要恢复全部内容时，加载已保存的需求完整计划。

## Exact source contract

The dataset is `data/mods/DarkFogSynthesis.json`. All times below use 60 game
ticks per second. Counts are per recipe execution, before machine speed and
proliferation. No byproducts are added. Compared with the previous calculator pin
(`3849f7ca80fcfd5b2aca714259fcb12dcf6bf361`), recipe 48103 replaces 1 Particle
Broadband (1402) with 2 Titanium Alloy (1107); the other five recipe contracts are
unchanged.

| Recipe ID | Output | Inputs | Time | Machine family |
| --- | --- | --- | --- | --- |
| 48101 | 2 能量碎片 / Energy Shard (5206) | 1 燃烧单元 (1128), 1 高能石墨 (1109), 1 玻璃 (1110) | 120 ticks / 2 s | Smelter |
| 48102 | 1 黑雾矩阵 / Dark Fog Matrix (5201) | 2 晶格硅 (1113), 1 光子合并器 (1404), 1 电浆激发器 (1401), 1 钛化玻璃 (1119) | 240 ticks / 4 s | Matrix lab |
| 48103 | 1 硅基神经元 / Silicon-based Neuron (5202) | 2 微晶元件 (1302), 2 钛合金 (1107), 2 晶格硅 (1113) | 240 ticks / 4 s | Assembler |
| 48104 | 1 物质重组器 / Matter Recombinator (5203) | 1 位面过滤器 (1304), 2 超级磁场环 (1205), 2 氢 (1120), 2 晶格硅 (1113) | 360 ticks / 6 s | Assembler |
| 48105 | 1 负熵奇点 / Negentropy Singularity (5204) | 1 奇异物质 (1127), 2 卡西米尔晶体 (1126), 1 氘核燃料棒 (1802), 2 晶格硅 (1113) | 480 ticks / 8 s | Assembler |
| 48106 | 1 核心素 / Core Element (5205) | 2 反物质 (1122), 2 框架材料 (1125), 2 超级磁场环 (1205), 4 晶格硅 (1113) | 600 ticks / 10 s | Assembler |

Primary source links:

- [Frozen recipe quantities, times and machine families](https://github.com/idkwhodatis/DarkFogSynthesis/blob/8aeb354826c1996db230a011e9473cee329116d0/src/DarkFogSynthesis.Core/Definitions/FrozenContent.cs#L8-L28)
- [Recipe prototype IDs](https://github.com/idkwhodatis/DarkFogSynthesis/blob/8aeb354826c1996db230a011e9473cee329116d0/src/DarkFogSynthesis.Core/Definitions/ProtoIds.cs#L42-L54)
- [Vanilla item ID mapping](https://github.com/idkwhodatis/DarkFogSynthesis/blob/8aeb354826c1996db230a011e9473cee329116d0/src/DarkFogSynthesis.Core/Definitions/VanillaIds.cs#L13-L40)
- [60-tick conversion, handcraft and proliferation capabilities](https://github.com/idkwhodatis/DarkFogSynthesis/blob/8aeb354826c1996db230a011e9473cee329116d0/src/DarkFogSynthesis.Core/Definitions/ContentDefinitions.cs#L49-L60)
- [Registration of recipe types, handcraft and productivity](https://github.com/idkwhodatis/DarkFogSynthesis/blob/8aeb354826c1996db230a011e9473cee329116d0/src/DarkFogSynthesis/Registration/ContentRegistry.cs)

All six allow acceleration **or** extra products, represented by the existing
calculator `Proliferator: 3` bit mask. Standard Mk.I/II/III spray uses the existing
engine, including spray consumption and power. Ideal one-machine base rates at
1× speed are 60 / 15 / 15 / 10 / 7.5 / 6 units per minute respectively. Assembler
Mk.I runs at 0.75×; it must not be mistaken for a 1× machine.

Existing machine data is reused from [calculator baseline
cf34a5b](https://github.com/idkwhodatis/dsp-calc/blob/cf34a5ba9038959c76b83a017cbec534d85a9e7f/data/Vanilla.json):
smelters `[2302,2315,2319]` run at 1/2/3×; labs `[2901,2902]` at 1/3×;
assemblers `[2303,2304,2305,2318]` at 0.75/1/1.5/3×. The mod adds no buildings or
items. Existing Chinese names, item slots and source icons are reused; English
recipe names are supplied as dataset metadata.

`Handcraft: true` records the game's capability. As with ordinary calculator
recipes, this profile models automated machinery, not Icarus handcraft throughput.
The old synthetic Icarus source has a special speed and is intentionally not added
to these manufacturing families.

## Compatibility and persistence boundaries

- New game scope: `DarkFogSynthesis`; base data is the calculator's current
  selectively updated Vanilla profile, not a claim of complete current-DSP data.
- All 241 existing recipe values/indices are unchanged. Six new recipes append at
  indices 241–246. Each item retains its original drop choice at ordinal 1; new
  synthesis is ordinal 2, chosen only for a fresh DarkFogSynthesis strategy.
- No Vanilla strategy is silently migrated into this new profile. Existing Vanilla
  migrations and saves remain unchanged. Named full plans keep game identity,
  recipes, building counts, spray, calculation settings, pile-sorter technology level and
  independent source IDs. Loading a full plan in the wrong profile is rejected.
- This calculator exposes only standalone DarkFogSynthesis. Combinations with
  MoreMegaStructure, TheyComeFromVoid, GenesisBook and FractionateEverything have
  not been exported/verified. Picker options prevent such mixes; direct dataset
  construction rejects them. Stale or manually edited mixed `auto_mods` values
  containing DarkFogSynthesis normalize to its standalone profile, consistently
  for the picker and engine; named saves in other scopes are retained.
- This restriction is a calculator-data boundary, not an assertion of in-game
  incompatibility. In particular, the mod's MoreMegaStructure restriction concerns
  removal-candidate cleanup, not general gameplay. LabOpt is explicitly blocked
  by the mod. [Runtime compatibility remains unvalidated](https://github.com/idkwhodatis/DarkFogSynthesis/blob/8aeb354826c1996db230a011e9473cee329116d0/docs/compatibility/runtime-baseline.json).
- Both Peace and non-Peace use these same six recipes. Only combat prerequisite
  edges depend on the non-Peace option; this calculator does not simulate research
  unlocking. Black Fog Matrix (5201) is not added to ordinary research matrix IDs
  6001–6006. [Mode semantics](https://github.com/idkwhodatis/DarkFogSynthesis/blob/8aeb354826c1996db230a011e9473cee329116d0/README.md#L75-L82)
- Belts/sorters and manufacturing behavior are unchanged by this recipe-only
  profile, so existing vanilla logistics estimates (including explicit full-tech
  pile sorters) remain available with the same assumptions. Unknown mod flags or
  mixed profiles still disable unverified capacity recommendations.

## Verification

`tests/dark-fog-synthesis.test.js` pins every recipe against an independent
transcription, verifies all 21 machine choices in normal/acceleration/extra-product
modes against both solver and independent-source engine, and checks lens/core
chains, fixed-building + drop mixes, JSON full-plan round trips, tree read-only
behavior, logistics and immutable vanilla prefixes. The neuron regression checks
titanium-alloy consumption and absence of particle broadband in both production
and the dependency view. UI tests cover selection/cancellation,
mutual exclusion, calculation and profile-scoped persistence. The original 28-case
numerical solver fixture is unchanged. No DSP/Unity runtime test is implied.
