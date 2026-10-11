# DSP Calculator · React + shadcn/ui

A production-chain calculator for Dyson Sphere Program (戴森球计划量化计算器), with a React 19 interface built from checked-in shadcn/ui components, Radix primitives and Tailwind CSS.

The refactor preserves the existing game data, recipe choices, proliferation settings and mod combinations. Plans without independent sources retain the original calculation path; multi-source plans use explicit material balances with the same game recipes. The interface provides searchable item selection, responsive results, light/dark themes, settings, grouped production sources, and named demand/production presets.

## 同一物品的多来源产线

1. 添加生产目标，例如 **引力矩阵 60 / min**。
2. 选择 **添加现有产线 → 重氢**。新来源从 **0** 开始，保留原来的需求产线；重氢组仍位于原来的中间产物位置。
3. 组标题显示 **总需求 300 / min**。组内的需求产线与现有产线纵向排列，每条来源内部的产量、配方、建筑和增产设置仍排成一条紧凑横向控制带；增加来源不会横向拉长整组，较窄屏幕仍可滚动查看单条来源的完整控件。
4. 在新来源中选择轨道采集器、分馏或粒子对撞配方，再填写 **150 / min**。需求产线承担剩余 **150 / min**，原料、建筑与电力会一起重新计算。
5. 用组内 **添加产线** 继续拆分来源。超过需求时会显示多余产物；不会生成负的自动产量，也不会擅自平均分配各条产线。副产物供给单独列出。

分配数值表示可用于满足需求的**净产量**，循环配方内部重复使用的物品不会重复计入。每条现有产线有独立身份和设置；删除后由需求产线重新平衡。更多来源会依次排在组内下方。

现有产线的**分配产量**与**工厂数量**可以双向编辑，最后实际编辑的字段会标为「固定」。固定产量时，修改配方、工厂类型或增产设置会重算工厂数量；固定工厂数量时则重算产量，需求产线继续补足剩余需求。支持小数工厂数量，切换每分钟 / 每秒只换算产量显示；没有有效生产设施的来源不能填写工厂数量。旧保存默认保持固定产量，新完整计划会同时保留固定方式和精确数量。

只有一条来源时，也可以悬停在未选中的配方上，点击出现的小 **＋**，直接添加使用该配方的 **0** 产量来源。键盘聚焦同样会显示按钮，触屏上则直接显示；原来的需求配方保持不变。

分叉属于**当前生产计划的临时状态**，不再写入全局自动保存。只调整同一批目标的数量时会保留；新增、移除或替换目标、清空计划、切换模组或刷新页面时清除，回到之前的目标也不会自行恢复。固定分配以每分钟储存，切换显示单位只换算其显示数值；现有目标产量输入的单位行为保持不变。

显式保存完整计划时，目标、生产策略、计算参数和来源分配一起保存，加载时一起恢复。旧的纯需求列表仍可加载；单独加载旧生产策略不会复活缺少目标上下文的分叉。旧全局自动保存中的关联来源保留在备份中，不会自动套用到新计划。通过“添加现有产线”明确添加的独立产线仍可保留；配方旁 **＋** 创建的分叉始终属于当前计划。

## 已有产线的副产物来源

可燃冰产石墨烯时产生的氢，会在氢的生产组中自动显示为 **现有产线 · 石墨烯副产**。组标题的 **总需求** 是抵扣前的实际目标及下游投入需求；例如氢总需求 300/min，石墨烯副产 60/min，需求产线只补足 240/min。全部满足时需求产线为 0；副产过量时仍显示实际需求，并单列多余产物，不把供给量冒充需求。

副产来源是只读关联，显示完整副产量及原配方；点击 **查看来源产线** 可返回原产线修改产量、建筑或增产设置。多个来源分别显示，修改或删除原产线后同步更新；原料、工厂和耗电只在实际产线计数一次。无需再次添加一条相同配方的氢产线，也不会重复抵扣。**添加产线** 仍表示新增真正的独立生产设施。

关联由当前计算结果生成，无需保存额外副本；完整计划加载后会重新生成，旧计划仍可使用。树状视图显示同一批全局副产来源及跳转入口，不擅自把共享供给分配给某条支路。

普通多产物配方（例如可燃冰制石墨烯、精炼、裂解与质能储存）通用地抵扣副产物需求，并按真实来源统计工厂。独立产线不因产物相同而合并；具体核验案例、模组范围和采集来源边界见[副产物计数说明](docs/coproduct-accounting.md)。

## 氢与重氢共享轨道采集

原版及单独启用黑雾合成时，氢与重氢的轨道采集按同一组气态巨星面板联合计算。已有产线分配先计入，共同采出的另一种产物自动抵扣需求，剩余量继续使用所选配方。建筑合计只统计一次共享采集器；每条来源的「采集需求折算」不再相加。可燃冰和其它模组的采集仍独立计算。具体范围与分配规则见[共享轨道采集模型](docs/shared-orbital-collectors.md)。

## 游戏物品选择布局

原版及单独启用黑雾合成时，选择器按 **F 键合成面板** 分成 **物品 / 建筑** 两页，每页保留 14 列 × 8 行和空位。增产剂 Mk.I / II / III 横排在物品页第 1 行第 10–12 列；替代配方保留各自图标和位置，点击只选择目标物品，不修改生产配方。原矿、掉落等补充物品单独放在下方。搜索覆盖两页及补充物品，保留固定格位，并标明 Enter 将选择的物品。其它模组保留各自导出的物品布局；左侧行号不代表科技等级。界面参考与版本范围见[合成面板布局来源](docs/picker-layout.md)。

## 平铺 / 树状视图

生产总览默认使用 **平铺**。切换到 **树状** 可按目标逐层展开上游原料；缩进每层仅 4px，最多 24px。视图切换和展开不会改变目标、来源分配或计算结果，刷新后仍默认平铺。

树状视图的 **本支需求、本支产能、本支工厂数量** 均表示当前节点所属支路，数量只读。普通单来源支路按实际配方、工厂倍率与增产设置折算；产能包含配方内部回流的毛产出，工厂保留小数需求。配方、增产模式、增产剂、工厂类型及原矿化仍可直接操作，修改会同步同一份全局计划。需要等比例调整整个计划时，请使用目标输入或平铺视图的数量编辑器。

共享原料可在不同支路分别出现。例如电磁矩阵 60/min 的电路板与磁线圈支路各需要铜块 30/min，各显示产能 30/min、熔炉 0.50 台；平铺铜块仍为 60/min、熔炉 1.00 台。不会在每个节点重复显示全局工厂数量。全局建筑、电力、原料统计只计算一次；物流列明确标为 **全局物流估算**。

多来源、副产物或外部供给没有指定支路分配时，本支需求仍显示准确用量，产能与工厂显示 **— / 来源未分配**，不会将共享全局供给冒充本支生产。可展开 **全局来源设置** 使用原来的独立产线、固定产量/工厂数量、副产关联与添加/删除功能；其中数值明确标为全局。原矿化的本支工厂为 0；共享采集显示需求折算而非独立机组。循环引用不重复计入工厂。

树状中仍保留独立标注的 **全局供给与投入**；循环和深度/数量上限会明确标记。未出现在依赖投影中的平铺产线（例如纯溢出的副产物）仍显示在 **其余全局产线** 中。较长的树分页显示，完整控制带可横向滚动。

## 出料物流参考

批量生产预设的 **分拣器** 下拉框与工厂选择器排在同一条可换行控制带，可选择 **无集装、集装分拣器（基础）、集装改良 1–6**，默认无集装。基础至满级的每次搬运容量依次为 **2/2/3/3/4/4/4 件**，理想卸货高度为 **1/2/2/3/3/4/4 层**。只对已确认的制造出料应用所选层数；直连、采集、外部及来源不明的流量保持 1 层，混合产品组按各来源货物占位合并。

基础至改良 5 的分拣器采用 **1 格社区吞吐近似参考：13.3/17.1/18/22.5/21.8/26.7 件/s**。原始记录的测试接口条件未完整记载，这些数字不是官方精确公式，也不是已核实的建筑→蓝带容量；界面会显示限制说明。满级仍按理想 4 层、1–3 格、单条满速蓝带接口 **120 件/s** 估算，黄/绿/蓝带理想运力为 **24/48/120 件/s**。具体来源与不确定性见[物流模型](docs/logistics-model.md#集装分拣器)。

等级会随策略和完整方案保存：`-1` 为无集装、`0` 为基础、`1–6` 为改良等级。旧开关 `true` 迁移为满级 `6`，`false` 或缺失迁移为 `-1`；选择不会改变生产产量、建筑数量或电力。

生产总览最右侧的窄列显示基础传送带和分拣器档位，悬停或点击可查看各档并行数量。原版传送带按未叠堆的 **6 / 12 / 30 个物品/秒**计算，普通分拣器按 **1 格、单件搬运的 1.5 / 3 / 6 个物品/秒**计算。超过一条最高基础档的流量时会显示并行路数，而不是暗示一条就足够。

默认传送带估算使用合并净出料流量；分拣器使用单台设施满负荷的目标物品毛产出。分拣器数量是每台设施的并行容量参考，不是整条产线的建筑总数，也不保证具体布局的最少数量。默认模式不含内部回流；集装模式保留已追溯目标产物的毛出料。进料、其他副产物、接口布局、欠电及玩家实际科技仍需另行核对。采集/直连接口不会套用普通制造机的分拣器推荐；研究站堆叠和集装分拣器会明确提示条件。未核实运力的模组组合不显示貌似精确的推荐。详见[物流模型与来源](docs/logistics-model.md)。

## 游戏数据版本

基础数据仍为 **0.10.31.24710**，原版配置补入两条经来源核对的制造配方，均支持增产与加速：

- **全息信标（v0.10.34）**：3 铁块 + 4 棱镜 + 2 电浆激发器 + 2 电路板，4 秒生产 1 个
- **黑雾引力透镜（v0.10.35）**：1 引力透镜 + 12 黑雾矩阵，6 秒生产 1 个

另追加**黑雾透镜稳态光子接收**：默认倍率、满连续接收（至少 20 分钟）、戴森供能与接收条件充足时，每站 **24 个临界光子/分钟**；喷涂 Mk.I / II / III 为 **30 / 36 / 48 个/分钟**，透镜均为 **0.1 个/分钟**。这是基于已标明来源的稳态规划模型，启动、断续接收、停机消耗、戴森功率需求与损耗未模拟。

原有 240 条配方及序号完整保留；新接收方式作为临界光子的第 3 个选项，不替换原有选择。238 / 239 / 240 条配方版本的旧策略与完整计划会迁移至 241 条，保留产线来源与固定工厂数量，覆盖旧保存前保留原始备份。

这不是完整的 0.10.35 适配。物品选择器按已记录的游戏合成面板排列，黑雾引力透镜位于物品页第 6 行第 6 列；原矿、掉落等没有合成格位的物品单独列在下方。合成面板参考不等同于完整游戏数据更新。黑雾矩阵沿用原有黑雾掉落来源，已有模组组合保持各自原有数据；新增黑雾合成配置见下节。来源、图标、槽位与保存兼容说明见[数据来源与版本范围](docs/game-data-provenance.md)。

## Dark Fog Synthesis · 黑雾合成

「游戏与模组」新增可选的 **黑雾合成 · Dark Fog Synthesis v0.1.0（实验性）** 配置。在当前原版数据上追加六条合成配方：能量碎片用熔炉、黑雾矩阵用研究站，其余四种用制造台；全部支持普通加速或额外产出。核心素每个消耗 **2 个反物质**；硅基神经元按更新后的模组源码使用 **2 个微晶元件 + 2 个钛合金 + 2 个晶格硅**，不再使用粒子宽带。

启用后默认使用合成，仍可选原有黑雾掉落或混合独立来源。黑雾引力透镜会自动展开矩阵制造链，例如 10 个/分钟透镜需要 120 个/分钟矩阵和 8 座普通研究站（不喷涂）。支持现有平铺/树状视图、固定工厂数量、集装分拣器和按配置保存的完整计划。

目前只提供单独启用的数据配置；请先取消其它模组。未核验组合不代表游戏内不兼容。和平/非和平配方相同，计算器不模拟科技解锁或手搓产能；这也不代表 MOD 的游戏运行验证已完成。原版及其它已有模组数据、旧配方序号与保存保持不变。详见[六条配方、固定源码版本与兼容范围](docs/dark-fog-synthesis.md)。

## Local development

Use **Node.js 24** (the same version as CI) and npm. The npm lockfile is the CI source of truth.

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. On development startup when source icons change, and on every production build, the Vite sprite plugin generates icon coordinates and PNG/WebP atlases from `icon/`. Content-hashed sprite URLs keep new coordinates paired with the correct images even when an older PWA has cached its atlases. Generated files are ignored by Git; do not remove the source icons.

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run preview
```

`npm test` runs Vitest once. Use `npm run test:watch` while editing. The production output is `dist/`; `npm run preview` serves it locally. `npm run typecheck` checks the TypeScript shadcn/ui primitives; the existing calculator remains JavaScript/JSX.

### Regression coverage

`tests/solver.test.js` compares production, surplus, production rates and building counts with fixtures captured from the pre-refactor commit `d53123399a7ab6278d3d1b704e111bef728b727e`. The 28 scenarios cover every supported mod-data combination, basic iron/circuits, universe matrices, alternate recipes, factory selection, proliferation, mining rates, external supply, mineralization, existing production lines and the Void mod’s blue buff. Additional assertions cover default scheme isolation and building multipliers.

The fixture is deliberately independent of the current UI and solver. If an intentional calculation/data change needs a new baseline, review it explicitly. `node scripts/capture-solver-baseline.mjs` reproduces the original fixture from that Git commit (requires the commit in local history); do not regenerate fixtures merely to make a failing test pass.

The [upstream issue audit](docs/upstream-issue-audit.md) records every open and closed upstream issue reviewed on 2026-10-04, with reproducible bugs distinguished from already-fixed behavior and feature requests. Dedicated regressions cover nested hydrogen byproduct conservation, collection multipliers, strategy loading across all supported mod profiles, and the selected-recipe semantics of surplus avoidance.

### Verification notes

The refactor has numerical and DOM interaction tests, lint/typechecking, and verified production builds for both `/` and `/dsp-calc/`. The public deployment has been smoke-tested in a desktop browser for item search, production calculations, bulk building selection, themes and the PWA update flow. The item picker uses the original compact icon-grid placement; the overview uses content-sized columns, readable original-scale type/icons, comfortable row spacing and a desktop summary sidebar. Mobile styles have regression coverage, but a real mobile viewport visual check is still recommended; DOM tests do not replace visual review.

Multi-source regressions cover the gravity-matrix/deuterium example, independent source configuration, zero/full/excess allocations, removal, physical rate units, coproducts and self-recycling, numerical conservation, grouped DOM ordering, source identities and saved-data migration. The original numerical fixture remains unchanged.

For independent sources, fixed material flows are applied to the original planner first and the resulting balance is checked. A full balance solve is used when that plan cannot satisfy the actual flows, or when explicit surplus-avoidance costs require a complete objective. Ordinary splits therefore retain the existing automatic plan rather than opportunistically changing unrelated recipes. Shared power accounting also keeps hidden mines in totals and excludes mineralized external supply; blue-buff recipe changes are isolated from the saved game data.

Before release, open the preview on desktop and mobile widths; check item search, recipe/factory/proliferation controls, keyboard navigation and dialog focus, cancel/confirm flows, saved presets after reload, mod switching, light/dark themes, and the installed PWA update prompt.

## Deploy this fork to GitHub Pages

1. In your GitHub repository, open **Settings → Pages**.
2. Under **Build and deployment → Source**, select **GitHub Actions**. Do this before the first deployment; the workflow does not silently change repository settings.
3. Push this code to the **default branch** (currently `master`), or open **Actions → Validate and deploy GitHub Pages → Run workflow**, selecting the default branch.
4. After the workflow succeeds, open the deployment URL shown by the `github-pages` environment / Settings → Pages. A typical project URL is `https://<owner>.github.io/<repository>/`.

The workflow in `.github/workflows/pages.yml`:

- Installs locked dependencies with `npm ci` on Node.js 24, then runs lint, typechecking, tests and the production build
- Uses the official `configure-pages`, `upload-pages-artifact` and `deploy-pages` actions, without publishing a generated branch or needing a personal access token
- Takes its base path from `configure-pages`, so repository sites, account sites and configured custom domains receive the correct asset, manifest and service-worker paths
- Builds and validates pull requests without deploying them or granting them Pages write permissions
- Deploys only the current repository default branch, with `pages: write` and `id-token: write` scoped to the deploy job; builds have read-only repository permissions
- Keeps production deployments serial; pull-request checks cannot cancel them

If a GitHub environment approval is required by your repository, approve the waiting deployment in Actions. Set a custom domain in **Settings → Pages**; do not hard-code a repository name into Vite.

To check the production build under a subdirectory before deploying (POSIX shell):

```sh
VITE_BASE_PATH=/dsp-calc/ npm run build
node scripts/verify-pages-build.mjs /dsp-calc/
npm run preview -- --base=/dsp-calc/
```

For root/custom-domain hosting, use `VITE_BASE_PATH=/` and pass `/` to the verification script. The normal local build defaults to `/`. Tauri builds retain the relative `./` base and omit service workers and the browser legacy bundle.

The verification script checks the emitted HTML asset links, PWA start URL/scope, manifest icons, service worker and game sprite files. It also runs in the Pages workflow. See [GitHub's custom Pages workflow documentation](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages) and [Vite's GitHub Pages guide](https://vite.dev/guide/static-deploy#github-pages).

### Selectively restored workflows

The inherited **PR-only preview** and **two tag-only release workflows** are active alongside Pages. PRs get a validated downloadable preview without external publication. Tag pushes build a web artifact and an unsigned Windows/Tauri package with a **draft** GitHub release; Netlify publication retains its strict upstream-repository guard and is skipped on this fork. None of these restored workflows runs on ordinary branch pushes.

The every-push branch preview and old `main` → `release` Pages deploy remain under `.github/disabled-workflows/`, outside the directory GitHub executes. Their manual/push triggers are disabled, preventing competing deployment paths. See the [complete trigger and permission inventory](docs/github-actions.md), including artifact access and release review instructions.

The Pages workflow listens for branch pushes and checks the repository's current default branch at job time, so a rename from `main` to `master` does not silently stop deployment. Pull requests targeting the default branch still run validation without deployment. Manual runs deploy only when the selected ref is the default branch.

## UI and saved-data compatibility

- Shared shadcn/ui components live in `src/components/ui/`; `components.json` records their configuration. App styling uses semantic Tailwind theme tokens rather than Bootstrap or Ant Design.
- Original calculation logic remains in `src/global_state.jsx`; independent-source balances and per-source quantities live in `src/production_sources.js`. Data conversion remains in `src/GameData.jsx` and recipe initialization in `src/scheme_data.jsx`.
- Existing local-storage keys and game-scoped save formats are preserved: `scheme_data`, `needs_list`, `auto_scheme`, `auto_settings`, `auto_mods` and `theme`.
- Saves remain local to the current browser and origin. A fork's Pages URL has a different origin from the upstream domain, so it cannot automatically read saves stored on the upstream site. Save compatibility does not transfer browser storage between domains.
- Mod changes remain explicit because they can reset the current demand/production setup. PWA updates remain user-prompted.

## Upstream project

[Original repository](https://github.com/DSPCalculator/dsp-calc) · [Upstream live calculator](https://dsp-calc.pro/) · [Upstream Pages](https://dspcalculator.github.io/dsp-calc/)

The original algorithm notes and roadmap are retained below.

## 简介

对于以戴森球计划为例的生产类游戏，通过提取循环关键物品（以下简称关键物品）简化生产关系图，
仅对其中不得不参与线性规划的物品进行线性规划，绝大部分只有一条生产路径的物品直接通过递归获得上游产线数据。减少了不必要的耗时和单纯形法潜在的指数时间复杂度的隐患
并且通过这种方式获得了由上游低级材料到下游高级材料的物品列表，利用这个物品列表进行动态规划可以用于自动计算最优增产决策

同时，在代码中以item_graph记录了一个物品的上下生产关系，之后可以通过这个来追踪物品的用途，
与其他量化计算器不同的另一点是这边的喷涂不是按增产剂等级而是按增产点数层数计算的，这是为了后期方便计算摇匀混喷的情况

还有许多铺好了路但是还没完善的功能，在此就不一一细说了

具体思路可见：https://www.bilibili.com/read/readlist/rl630834 中涉及量化计算器的部分

## 开发路线图：

### 功能完善

- [ ] 界面优化和UI交互(希望大家广泛提意见)
- [ ] 限制/不限制物品获取来源时自动计算最优增产策略
- [ ] 自定义增产剂成本(其实已经可以实现了，但是不知道UI放哪比较好)
- [ ] 自定义矿物成本(同上)
- [ ] 自定义新配方(按自己的想法创造配方，不知道有没有用不过这边可以加)
- [ ] 自带mod或其它游戏的数据(按game_data的格式导入即可)

### 部署平台

- [x] PWA
- [x] 桌面端应用
- [x] 移动端UI适配 (基本完成，但可能还需要根据用户体验调整布局)
- [ ] 游戏内插件
