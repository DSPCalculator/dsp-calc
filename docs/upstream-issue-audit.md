# Upstream issue review · 2026-10-04

Reviewed all **13 open issues** and all **5 closed issues** in [DSPCalculator/dsp-calc](https://github.com/DSPCalculator/dsp-calc/issues), including their comments. GitHub repository metadata confirms this is the parent/source of `idkwhodatis/dsp-calc`. The reviewed fork starts at `d67f0ee5cd31a4a480aabb5fa900dd1f4e000e52`.

This is a bug-reproduction pass against the fork's existing features and shipped data, not a promise to implement every upstream request or update every mod/game version. Closed pull requests are not included in these issue counts. No upstream issue was commented on or closed.

## Open issue dispositions

| Issue | Classification | Evidence / outcome in this fork |
| --- | --- | --- |
| [#10 Data source tool](https://github.com/DSPCalculator/dsp-calc/issues/10) | Resource suggestion | Offers an alternative game-data exporter. The maintainer explains the need for mod-specific exports; no broken behavior is reported. |
| [#16 Store states on the URL](https://github.com/DSPCalculator/dsp-calc/issues/16) | Feature request | URL sharing is separate from the existing local presets. No change in this pass. |
| [#17 拆分产线](https://github.com/DSPCalculator/dsp-calc/issues/17) | Feature request | The fork already supports independently configured sources in a product group. The request's exact separate-plan/blueprint shortcut is broader and was not added. |
| [#22 产线计算错误](https://github.com/DSPCalculator/dsp-calc/issues/22) | Reproducible calculation defect | See the numerical regression analysis below. |
| [#23 列表可以移动](https://github.com/DSPCalculator/dsp-calc/issues/23) | Feature request | Drag-and-drop ordering is not implemented by this pass. Existing dependency order and the optional tree address finding upstream ingredients, but are not manual reordering. |
| [#27 树状排列物品层级](https://github.com/DSPCalculator/dsp-calc/issues/27) | Already available | The fork's read-only dependency tree preserves a single global calculation; branch demand is distinct from global supply. Covered by the dependency-view and dependency-integration tests. |
| [#28 采矿参数对现有产线无效](https://github.com/DSPCalculator/dsp-calc/issues/28) | Historical UI bug; residual legacy-engine defect | Modern source rows already use the shared building multipliers. Legacy engine compatibility and mod-specific settings were checked separately; see below. |
| [#36 原矿总需求与数量增减](https://github.com/DSPCalculator/dsp-calc/issues/36) | Already available | The summary already includes raw/mineralized inputs and quantity differences, alongside building and power totals. No new feature work. |
| [#49 按设备数量添加需求 / 非等比例调整](https://github.com/DSPCalculator/dsp-calc/issues/49) | Feature request | The overview already has proportional building/rate edits; target amounts can be edited individually. The exact requested add-by-machine shortcut remains a separate enhancement. |
| [#50 采矿等级配置](https://github.com/DSPCalculator/dsp-calc/issues/50) | Feature request | A technology-level-to-efficiency control is distinct from the existing explicit mining multiplier. No change. |
| [#52 加载生产策略失败](https://github.com/DSPCalculator/dsp-calc/issues/52) | Current load paths verified | The issue has no save file or reproduction steps. Dedicated current/legacy/mod strategy-load regressions supplement existing storage tests. Invalid data is reported without replacing the working plan. |
| [#78 避免溢出按钮无反应](https://github.com/DSPCalculator/dsp-calc/issues/78) | Intended recipe-selection behavior | [Maintainer clarification](https://github.com/DSPCalculator/dsp-calc/issues/78#issuecomment-4269497534): the optimizer does not introduce unselected recipes. Reproduced 120 energy matrices/min → 480 refined oil/min surplus with the default choices. After selecting hydrogen cracking and oil refining, the surplus penalty produces zero surplus oil. Both cases have regression tests. |
| [#84 缺少全息信标](https://github.com/DSPCalculator/dsp-calc/issues/84) | Already fixed in this fork | The prior verified Vanilla-only Holo Beacon addition remains intact. See [data provenance](game-data-provenance.md); this does not establish complete 0.10.35 support. |

## Closed issue dispositions

| Issue | Classification | Evidence / outcome |
| --- | --- | --- |
| [#2 轨道采集可燃冰](https://github.com/DSPCalculator/dsp-calc/issues/2) | Already fixed | The orbital fire-ice route exists in shipped data. Checked with the collection regressions. |
| [#3 电力相关功能](https://github.com/DSPCalculator/dsp-calc/issues/3) | Feature discussion | Automatic fuel/power-supply planning is broader than the existing consumption estimate. Not a bug fix. |
| [#20 塑料产线中的氢](https://github.com/DSPCalculator/dsp-calc/issues/20) | Expected byproduct behavior | The maintainer explains that direct hydrogen production is zero because oil refining supplies it as a byproduct. Material-balance coverage verifies this distinction. |
| [#21 产物流向可视化](https://github.com/DSPCalculator/dsp-calc/issues/21) | Feature discussion | The current read-only tree provides dependency inspection, not a new Sankey/flow graph. No new feature work. |
| [#63 现有产线不受采矿参数影响](https://github.com/DSPCalculator/dsp-calc/issues/63) | Same area as #28 | Covered together across miners, collectors, extraction and fractionation, with modern sources distinguished from the legacy engine entry point. |

## Corrected hydrogen balance (#22)

The report's screenshots show **60 antimatter fuel rods (反物质燃料棒)/min**, grade-III extra-product proliferation, no self-spray, fire-ice graphene, and direct collection of hydrogen, silicon and sulfuric acid. Its label “黑棒” should not be mistaken for strange annihilation fuel rods.

Before the fix, the fork reported **51.10995595 hydrogen/min** surplus. The independently reconstructed recipe balance is **35.154977975/min**, matching the report's expected 35.15:

- 360 hydrogen/min from antimatter production cancels the 360 hydrogen/min consumed by the fuel rods
- Total graphene production, including the proliferator chain, is 70.30995595/min
- Fire ice supplies one hydrogen per two graphene: 70.30995595 / 2 = 35.154977975

The LP's expanded material costs already record nested byproducts as negative demand. A second addition of those same nested byproducts falsely increased available supply. Removing only that duplicate term corrects both surplus reporting and missing direct production when an added hydrogen demand consumes the real coproducts.

Tests: `tests/upstream-surplus.test.js`. Six of the eight new tests failed before the correction and all eight pass afterward. They cover the exact report, extra demand, external supply, self-spray, strange annihilation rods, refinery supply, unsprayed recipes, and #20's expected plastic byproduct behavior. The original 28 numerical baseline scenarios remain unchanged.

## Collection / existing-line corrections (#28, #63)

The modern UI stores fixed **output allocations**, so a mining-setting change adjusts the required building count rather than changing the allocated output. It already uses the common multipliers, and ordinary old fixed-building saves are migrated to this format. The old bug should therefore not be described as still affecting every current source row.

The retained legacy/mixed-settings engine path had two residual defects:

- Fixed building counts bypassed the common mining, gas-panel, extraction and belt-speed multipliers
- FractionateEverything's proliferation-fractionator mode 4 had no execution branch, so these explicit legacy lines made nothing

The legacy path now uses the shared multipliers and executes mode 4 with the same spray-point/belt-speed semantics as current source normalization. The initial “buildings → output” save migration remains intact; current fixed output allocations do not silently change identity or units.

Testing the same mapping also exposed a current GenesisBook bug: **CO₂ and SO₂ panels were swapped** in the common multiplier. Each resource now uses its own panel, for both automatic and independent sources. With mining speed 2×, the 10× atmosphere collector and panel rates CO₂=0.3/s, SO₂=0.7/s, the expected outputs are respectively **6/s** and **14/s**, rather than the reverse.

Tests: `tests/upstream-mining.test.js`. Of its 58 tests, 31 failed before the correction and all pass afterward. Coverage includes all 12 shipped orbital fire-ice routes, all six Genesis atmosphere profiles, all six FractionateEverything mode-4 profiles, small/large miners, oil wells, pumps, beam collectors, gases and fractionators. The original numerical baseline remains unchanged.

## Strategy loading (#52)

`tests/upstream-presets.test.jsx` adds 21 passing menu/provider integration tests without a production change. It tests all 12 shipped game/mod profiles, saving and keyboard loading, repeated selection, remounting, old Vanilla 238-recipe strategies, scope isolation, cross-tab updates and invalid-entry recovery. The upstream issue contains no attached save or detailed reproduction, so its historical root cause is not established by these tests.

## Surplus avoidance example (#78)

With the selected cracking/refining routes, 120 energy matrices/min requires 240 hydrogen and 240 energetic graphite/min. Refining 160 crude oil/min makes 160 refined oil + 80 hydrogen; cracking consumes that oil and nets 160 hydrogen + 160 graphite. The remaining graphite demand is 80/min. No extra refined oil needs disposal. Merely increasing the oil disposal cost with an oil-consuming route absent cannot create that route.

Tests: `tests/upstream-avoid-surplus.test.js`.

## Verification

- `npm run lint` and `npm run typecheck`: passed
- `npm test`: **561 tests passed in 25 files**, including 89 new regressions
- Original `tests/fixtures/solver-baseline.json`: unchanged
- `VITE_BASE_PATH=/dsp-calc/ npm run build`: passed
- `node scripts/verify-pages-build.mjs /dsp-calc/`: passed for HTML, manifest, service worker and sprites

The production changes are confined to the shared building multiplier and legacy LP/existing-line calculations. Existing source ownership, whole-plan saves, flat/tree view selection, compact pickers and verified Holo Beacon data are preserved by their regression suites.
