# F-key crafting-panel layout

The Vanilla and standalone Dark Fog Synthesis target pickers use the **F-key replicator/crafting panel** layout. They retain two 14-column × 8-row pages, including all blank cells and alternate-recipe cells. Other mod profiles retain their own exported **item/filter-selector** coordinates; there is no claim that those exports describe their crafting panels.

This change is presentation-only. Choosing a cell selects its target item and does not select the depicted recipe, change a production strategy, change proliferation, rewrite item GridIndex values, or add manufacturing support.

## Pinned visual source and identity mapping

- [BWIKI 合成面板, revision 13637](https://wiki.biligame.com/dsp/index.php?title=%E5%90%88%E6%88%90%E9%9D%A2%E6%9D%BF&oldid=13637), retrieved **2026-10-05**, page last-edited time **2026-09-25 09:47** as displayed by the wiki
- The checked-in fixture is [`data/layouts/vanilla-replicator.json`](../data/layouts/vanilla-replicator.json): **224 explicit cells**, **163 occupied cells**, **61 blank cells**. It includes all **162 core recipe IDs** and one non-recipe visual entry
- Item IDs, recipe IDs, canonical names (including nonbreaking spaces in Mk names), and existing artwork keys are mapped explicitly from this repository's [`data/Vanilla.json`](../data/Vanilla.json). `sourceTitle` retains the original wiki cell title for independent review
- The historical [Martin-Pitt/dsp-parser recipe export](https://github.com/Martin-Pitt/dsp-parser/blob/main/dist/data/recipes.json), game **0.10.29.22015**, dated **2024-03-23**, corroborates recipe identities and the distinction between item and recipe coordinates. Its older coordinates are **not** imported wholesale. The fixture records SHA-256 hashes of both retrieved reference files
- The [independent extractor](https://github.com/d0sboots/dyson-sphere-program/blob/main/dyson_wiki.py) distinguishes the filter grid from the replicator grid. A shared coordinate encoding does not make them the same panel

The BWIKI page is a **community-maintained visual reference**, not an original current-build RecipeProto export or a capture verified against the running game. This fixture does not establish complete support for any newer game build, current unlock visibility, or handcraftability. Existing [game-data and receiver-model limits](game-data-provenance.md) remain applicable.

## Coordinates and noteworthy cells

Coordinates are one-based: `page × 1000 + row × 100 + column`. Every hole is kept explicitly, including the three completely empty bottom rows on the building page. Selectable resources that also have a crafting entry, such as **硅石** at **1403** (recipe 34), remain in their crafting position. **高纯硅块** is at **1103** (recipe 59).

Relative to the historical recipe export, the current visual reference places:

| Recipe ID | Cell | Old → current |
| --- | --- | --- |
| 24 | 硫酸 | 1406 → 1508 |
| 28 / 29 | 卡西米尔晶体 / 高效 | 1505 / 1605 → 1405 / 1505 |
| 35 | 碳纳米管（高效） | 1508 → 1409 |
| 99 / 100 | 粒子容器 / 高效 | 1506 / 1606 → 1406 / 1506 |
| 101 | 引力透镜 | 1405 → 1605 |
| 104 | 奇异物质 | 1409 → 1706 |
| 78 / 79 | 空间翘曲器 / 高级 | 1706 / 1707 → 1707 / 1708 |
| 74 | 质能储存 | 1708 → 1709 |
| 71 / 82 | 电磁轨道弹射器 / 垂直发射井 | 2410 / 2411 → 2411 / 2412 |
| 161 | 全息信标 | Newer recipe at 2410 |
| 162 | 黑雾引力透镜 | Newer recipe at 1606 |

The proliferators are horizontal at **1110 / 1111 / 1112**. Their exported item-selector positions **1406 / 1506 / 1606** are a different layout and are left unchanged.

### Multi-output recipes select an explicit target

A recipe picture is not sufficient to infer the calculator target from the first output. The fixture pins these choices:

| Recipe ID | Depicted recipe | Selected item ID / target |
| --- | --- | --- |
| 16 | 等离子精炼 | 1114 / 精炼油, even though hydrogen is first in the exported output array |
| 32 | 石墨烯（高效） | 1123 / 石墨烯 |
| 58 | X射线裂解 | 1120 / 氢 |
| 74 | 质能储存 | 1122 / 反物质 |

These are explicit target-picker mappings, not claims that the game gives multi-output recipes a unique primary product. Other products remain reachable through the picker. Alternate recipe cells retain their recipe artwork and label but select the same item. Search names are unique even when that item has several native cells.

### Full accumulator is a visual item entry

The visual reference includes **蓄电器（满）**, item **2207**, at **2114**, with a blank **2113** before it. It has **no ordinary crafting RecipeProto entry**. The fixture marks it `placementKind: "visual-item"`, with `recipeId: null`, and uses its existing item icon. This mirrors the chosen visual reference without inventing a crafting recipe or using a calculator-only charging recipe as a native recipe ID. Its existing charging calculations are unchanged.

## Extra rows and mod compatibility

Raw ores, raw fluids, critical photons, Dark Fog drops, and any other selectable target without a represented native cell remain available in **separate rows below the fixed native grid**. They do not fill crafting holes or become fake building cells. An item with a native crafting slot appears there even if the calculator can also obtain it from a raw source.

`get_game_data` exposes `mods: []` for Vanilla and `mods: ["DarkFogSynthesis"]` for its standalone synthesis profile. Only those profiles use this overlay. The six synthesis targets therefore remain in the extra rows rather than receiving invented vanilla recipe positions. All other profiles and legacy consumers without an explicit `mods` array retain the exported item grid, its additional pages, and its neutral **其它** tab for invalid/missing/colliding positions.

The layout helper returns unique search names covering every selectable target, repeated native recipe entries, fixed-size native cells, and a separate extras array. It only reads input state and never changes a selected recipe or any game-data object.
