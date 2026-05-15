# AGENTS.md - dsp-calc 开发指南

本文档面向在本仓库内工作的 AI 代理，目标是让后续修改遵循当前项目的真实结构、工具链与验证标准。

## 项目概览

- 这是一个基于 `Vite + React 18 + TypeScript` 的前端项目，用于戴森球计划量化计算。
- 包管理与默认脚本入口以 `npm` 为准；除非用户明确要求，否则不要切换为 Yarn 作为主流程。
- 当前源码已经按职责拆分为 `src/engine`、`src/ui`、`src/lib` 三层：
  - `src/engine`：数据装配、方案数据、计算逻辑、求解器适配、业务类型
  - `src/ui`：React 入口、Provider、页面功能、可复用组件、UI 类型
  - `src/lib`：无业务语义的小型通用工具
- 当前没有 `test` 脚本；常用质量命令是：
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

## 硬性规则

### 1. 分级验证与 Windows 本机优先

**本仓库是 Vite 热重载前端项目，不要把 `build` 当作每次代码修改后的默认验证。**

1. 普通 UI、样式、文案、轻交互、计算逻辑、数据逻辑改动：
   - 优先复用用户常驻的 `5173` 开发服务器，通过热重载和页面行为验证。
   - 按改动风险补充 Windows 本机 `typecheck` / `lint`，但不默认执行 `build`。
2. 涉及以下内容时，才必须执行 Windows 本机 `build`：
   - `package.json`、`package-lock.json`、依赖版本、锁文件。
   - `vite.config.ts`、`tsconfig*`、`eslint.config.js`、构建脚本、启动脚本。
   - `scripts/ensure-platform-build-deps.cjs`、平台原生包逻辑。
   - 图标资产、图标 sprite、`public/icon/*`、`icons:generate` 产物。
   - 发布、预览、生产产物、分包、动态导入、`BASE_URL` 等只在构建产物中体现的行为。
3. 如需启动链路验证，优先复用用户已在 `5173` 运行的实例；不要额外启动 `npm run dev`，除非用户明确要求。

**没有 Windows 本机验证证据时，禁止对外表述为“已构建”“生产产物可用”“启动链路已通过”。**

### 2. 禁止凭经验假设

- 不要假设某个原生包、构建器、Vite 子依赖、Windows `.cmd` shim、Linux 可选依赖一定存在。
- 涉及平台原生包时，必须先看真实脚本与 `package.json`，再决定如何修。

### 3. 只按当前仓库真实结构工作

- 当前仓库不是旧版 `src/App.jsx` / `src/GameData.jsx` 结构。
- 任何说明、修改建议、路径引用都必须基于当前真实路径：
  - `src/engine/*`
  - `src/ui/*`
  - `src/lib/*`

## 构建与运行规则

### 工具链规则

- 默认使用 `npm`。
- **编译、构建、图标生成、预览和启动链路验证必须优先使用 Windows 本机 Node/npm 环境执行**，不要在 WSL 里运行这类命令作为主要验证依据。
- WSL 只用于 `rg`、`git diff`、读取文件、轻量脚本分析等不依赖平台原生包的操作；涉及 `sharp`、`esbuild`、`rollup`、Vite 构建产物时，必须切回 Windows 本机环境。
- 从 WSL 调用 Windows npm 时使用：
  ```bat
  "C:\Program Files\nodejs\npm.cmd" run typecheck
  "C:\Program Files\nodejs\npm.cmd" run lint
  "C:\Program Files\nodejs\npm.cmd" run build
  ```
- 当前 Vite 主线是 `5.4.x`，不要为了追版本号无脑切到更高大版本；必须优先保证 Windows 本机运行稳定，跨平台改动再按任务需要补充额外验证。
- 当前 ESLint 使用 `flat config`，配置文件是 `eslint.config.js`，不要再新增 `.eslintrc.*`。
- 当前 `dev/build/preview` 入口都依赖 `scripts/ensure-platform-build-deps.cjs` 先补齐平台原生包，再启动 Vite。

### 标准命令

```bash
# 安装依赖
npm install

# 类型检查
npm run typecheck

# 静态检查
npm run lint

# 本地开发服务器
npm run dev

# 生产构建
npm run build

# 预览 dist 产物
npm run preview
```

### 命令含义

- `npm run typecheck`
  - 执行 TypeScript 类型检查
- `npm run lint`
  - 执行 ESLint；warning 也会失败
- `npm run dev`
  - 先补平台原生依赖，再启动 Vite 开发服务器
- `npm run build`
  - 先补平台原生依赖，再执行生产构建
- `npm run preview`
  - 先补平台原生依赖，再基于构建产物启动预览服务

## 平台原生包规则

### 当前现状

- 由于 `esbuild`、`rollup` 以及部分 Vite 生态包会依赖平台原生二进制，当前仓库内存在跨平台运行要求。
- `scripts/ensure-platform-build-deps.cjs` 负责在运行 `dev/build/preview` 前补齐当前平台需要的原生包。

### 处理原则

- **修改 `package.json`、Vite 版本、构建脚本、原生包逻辑时，必须同步考虑 Windows 本机环境。**
- 只要改动涉及：
  - `package.json`
  - `package-lock.json`
  - `yarn.lock`
  - `scripts/ensure-platform-build-deps.cjs`
  - `vite.config.ts`
  - `optionalDependencies`
  就必须做 Windows 本机验证。

### 锁文件规则

- 默认主流程以 `package-lock.json` 为准。
- 如果本轮依赖调整真实影响了 `yarn.lock`，且用户要求同步或仓库当前确实维护该锁文件，则应单独提交，不要混在大改动里。

## 结构说明

### 当前目录职责

```text
src/
├── engine/
│   ├── calculation/   # 计算主链路
│   ├── data/          # 游戏/模组数据装配
│   ├── scheme/        # 方案与配方策略数据
│   ├── solver/        # 求解器适配层
│   └── types/         # 业务类型
├── ui/
│   ├── app/           # React 入口与 Provider
│   ├── components/    # 通用 UI 组件
│   ├── features/      # 页面功能模块
│   └── types/         # UI 类型
└── lib/
    └── number.ts      # 纯工具函数
```

### 导入规则

- 跨层导入优先使用别名：
  - `@engine/*`
  - `@ui/*`
  - `@lib/*`
- 不要继续引入一长串 `../../../` 去跨层引用。
- 同层或近层相对导入可以保留，但要保证清晰。

## 关键文件

| 路径 | 作用 |
|---|---|
| `package.json` | 脚本入口、依赖声明、平台原生包约束 |
| `package-lock.json` | `npm` 主锁文件 |
| `yarn.lock` | 非默认主流程锁文件，仅在必要时同步 |
| `vite.config.ts` | Vite 配置与手动分包规则 |
| `eslint.config.js` | ESLint flat config |
| `scripts/ensure-platform-build-deps.cjs` | 平台原生包补齐脚本 |
| `src/ui/app/bootstrap.tsx` | 前端入口 |
| `src/ui/app/AppShell.tsx` | 页面主装配 |
| `src/ui/app/providers/AppProviders.tsx` | Context 与全局状态装配 |
| `src/engine/data/gameData.ts` | 游戏数据装配入口 |
| `src/engine/scheme/schemeData.ts` | 方案数据入口 |
| `src/engine/calculation/globalState.ts` | 计算总入口 |
| `src/engine/solver/javascriptLpSolverBrowser.ts` | 求解器浏览器适配层 |
| `src/engine/types/domain.ts` | 业务类型总表 |

## 代码风格与修改约束

- 当前代码以 `TS/TSX + ES Module` 为主，不要退回 JS。
- 保持 4 空格缩进、分号、与当前文件一致的 import 风格。
- 核心流程、复杂分支、数据转换逻辑保留简体中文注释。
- 不要引入与当前仓库无关的状态管理库、路由层、后端框架或脚手架。
- 任何数字常量如果不是业务值，必须命名或封装；不要再引入类似 `0.49994` 这类魔法数补丁。

## 验证规则

### 完成前验证分级

不要固定套用 `typecheck` / `lint` / `build` 三连。按改动性质选择最低充分验证：

1. 纯 UI / 样式 / 文案 / 轻交互：
   - 默认通过已有 `5173` 开发服务器热重载验证页面行为。
   - 只有改动触碰类型复杂逻辑或公共组件契约时，才补 Windows 本机 `typecheck`。
2. 计算逻辑 / 数据装配 / 状态流转：
   - 至少执行 Windows 本机 `typecheck`。
   - 如改动涉及 lint 敏感结构、公共工具或大范围重构，再补 Windows 本机 `lint`。
3. 依赖版本 / 锁文件 / 构建配置 / 启动脚本 / Vite 配置 / 平台原生包：
   - 必须执行 Windows 本机 `typecheck`、`lint`、`build`。
4. 图标资产 / 图标 sprite / `icons:generate` / `public/icon/*`：
   - 必须执行 Windows 本机 `npm run icons:generate` 或 `npm run build`。
   - 验证输出中不得出现新增 `missing icon asset`。
5. 发布、预览或生产产物行为：
   - 必须执行 Windows 本机 `build`。
   - 如本轮明确涉及预览行为，再执行 Windows 本机 `preview` 或用户要求的等价验证。

### 热重载与本地运行约定

- 修改完成后，必须先判断本轮改动是否真的需要编译；不要把 `typecheck` / `lint` / `build` 当成默认第一反应。
- 大多数纯 UI / 样式 / 布局 / 文案 / 轻交互改动都属于热重载场景，默认采用 `save -> inspect -> adjust`，无需额外编译。
- 只有当改动影响类型系统、Lint 规则、构建产物、依赖、平台原生包、构建配置、启动链路、图标 sprite，或热重载不足以证明结果时，才执行对应验证命令。
- 用户默认已经在 `5173` 持有开发服务器；除非用户明确要求，否则代理**不要额外执行** `npm run dev`、`"C:\Program Files\nodejs\npm.cmd" run dev` 或其他 `run` 类启动命令。

### Windows 运行验证

对影响运行链路或依赖链路的改动，如需补 Windows 侧启动验证，优先复用用户已在 `5173` 运行的现有实例；不要为了验证再额外新起一个 `npm.cmd run dev`。

只有在以下情况同时成立时，才允许代理自己执行：

- 用户明确要求代理亲自拉起新的 Windows dev 进程
- 现有 `5173` 实例不足以覆盖本轮问题
- 本轮确实需要验证 Windows 启动链路

此时使用：

```bat
"C:\Program Files\nodejs\npm.cmd" run dev
```

预期结果：

- 不出现原生绑定缺失错误
- 不出现 host/binary version mismatch
- Vite 成功启动并输出本地地址

### 汇报要求

最终汇报必须明确区分：

- 改了哪些文件
- 实际执行了哪些验证命令
- Windows 本机哪些验证已通过
- 哪些内容未验证

## Git 提交规则

- 一个逻辑单元一个 commit。
- 提交信息使用中文，保持当前仓库风格。
- 平台修复、锁文件同步、结构重构应拆分提交，不要混成一个大杂烩 commit。
- 未经用户明确批准，禁止 `git push`。
- 提交前必须确认 Git 作者身份可用：
  - `git var GIT_AUTHOR_IDENT`
  - `git var GIT_COMMITTER_IDENT`
- 当前仓库可能处于脏工作树状态，禁止回滚用户已有未提交改动；只提交本次任务相关文件。

### 原子提交定义

- **原子提交不是 `git add -A` 或 `git add -a` 的同义词。**
- 原子提交指：**按最小、可独立验证、可被他人直接 `cherry-pick` 的逻辑单元进行提交**。
- 如果本轮工作同时包含两个或以上相互独立的功能、修复或重构，即使用户口头说“全部提交”，也应主动拆分为多个 commit，而不是把所有改动压成一个 commit。
- 只有当多个文件共同构成同一个不可再拆的逻辑单元时，才允许放进同一个 commit。

### Commit Policy For Agents

**核心原则：严禁积压未提交改动。** 任何代码改动都应在验证通过后按逻辑单元写入 Git 历史，不能以“改了一批文件但零 commit”的状态结束任务。

**提交流程：**
- 先检查 `git status --short`，明确本轮改动边界。
- 先判断当前工作区里的改动是否属于同一个最小逻辑单元；如果不是，必须先拆分提交计划，再执行 `git add`。
- 提交前必须先完成本仓库要求的分级验证；涉及构建链路、依赖、配置、图标 sprite 时，必须具备 Windows 本机验证证据后才能声称完成。
- 提交后再次执行 `git status --short`，确认工作区状态符合预期。

**职责要求：**
- 主代理必须主动说明本轮 commit 策略，不能把“代码先改完、提交以后再说”当成默认流程。
- 当多个独立改动同时存在时，主代理必须先说明会拆成几个 commit、每个 commit 的边界是什么。

**并行场景：**
- 多个子代理并行执行时，子代理不得各自提交；应由主代理收齐结果、审查通过后统一提交。
- **所有 Git 操作都必须串行执行**，禁止并发执行 `git add`、`git commit`、`git rebase`、`git stash`、`git checkout`、`git merge` 等命令。
- 每次 Git 操作前都必须确认前一个 Git 命令已经完成且 `.git/index.lock` 已释放。

**禁止事项：**
- 禁止把“工作区所有内容”默认理解成“适合做成一个 commit”。
- 禁止为了省事直接使用 `git add -A`、`git add -a` 抹平逻辑边界，除非当前工作区全部改动已经明确确认属于同一个最小逻辑单元。
- 禁止把无关改动、顺手修复、格式化噪声、锁文件顺带变化混进本次 commit。

## 常见任务规则

### 修改计算逻辑

1. 优先看：
   - `src/engine/calculation/*`
   - `src/engine/scheme/schemeData.ts`
   - `src/engine/data/gameData.ts`
2. 任何计算结果变化都应联动检查：
   - `src/ui/features/result/*`
3. 改动后按风险执行分级验证：
   - 至少执行 Windows 本机 `typecheck`
   - 如触碰公共工具、大范围重构或 lint 敏感结构，再执行 Windows 本机 `lint`
   - 不默认执行 `build`，除非计算改动同时影响生产产物、构建配置或发布行为

### 修改界面逻辑

1. 优先看：
   - `src/ui/app/*`
   - `src/ui/features/*`
   - `src/ui/components/*`
2. 若只是纯界面 / 样式 / 布局调整，先判断是否必须编译；默认走热重载，不主动执行 `typecheck` / `lint` / `build`
3. 只有当改动影响类型、构建、依赖、平台原生包、启动链路，或用户明确要求时，才补对应验证命令
4. 默认不替用户额外启动 `npm run dev` / Windows `npm.cmd run dev`；用户已说明自己常驻使用 `5173`

### 修改依赖或构建链路

1. 优先看：
   - `package.json`
   - `package-lock.json`
   - `yarn.lock`
   - `vite.config.ts`
   - `eslint.config.js`
   - `scripts/ensure-platform-build-deps.cjs`
2. 这类改动必须执行 Windows 本机 `typecheck`、`lint`、`build`
3. 没有 Windows 本机验证证据时，禁止声称“已修复”

## 代理工作注意事项

- 先看真实脚本与配置，再决定命令，不要凭经验猜。
- 遇到平台相关报错时，先区分是：
  - 配置错误
  - 原生包缺失
  - 二进制版本不匹配
  - Windows 命令入口问题
- 若你只能在单平台完成验证，最终必须明确写“另一平台未验证”，不能暗示已经可运行。
