# AGENTS.md - dsp-calc 开发指南

本文档面向在本仓库内工作的 AI 代理，目标是让后续修改遵循当前项目的真实结构、工具链与验证标准。

## 项目概览

- 这是一个基于 `Vite + React 18 + TypeScript` 的前端项目，用于戴森球计划量化计算。
- 包管理与默认脚本入口以 `npm` 为准；除非用户明确要求，否则不要切换为 Yarn 作为主流程。
- 当前源码已经按职责拆分为 `src/engine`、`src/ui`、`src/lib` 三层：
  - `src/engine`：数据装配、方案数据、计算逻辑、求解器适配、业务类型
  - `src/ui`：React 入口、Provider、页面功能、可复用组件、UI 类型
  - `src/lib`：无业务语义的小型通用工具
- 当前没有 `test` 脚本；真实质量门槛是：
  - `npm run typecheck`
  - `npm run lint`
  - `npm run build`

## 硬性规则

### 1. 双平台硬性验收

**凡是影响运行时代码、构建配置、脚本入口、依赖版本、锁文件、Vite 配置、平台原生包逻辑的改动，必须同时满足以下条件后，才允许声称“已完成”“已修复”“可运行”：**

1. Linux / WSL 下可通过：
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`
2. Windows 下可启动成功：
   - `"C:\Program Files\nodejs\npm.cmd" run dev`
3. 如果本轮任务明确涉及预览或生产产物行为，还要额外验证：
   - Linux / WSL：`npm run preview`
   - 或用户要求的等价验证方式

**没有同时满足 Win + Linux 验证证据时，禁止对外表述为“可运行”。**

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
- 当前 Vite 主线是 `5.4.x`，不要为了追版本号无脑切到更高大版本；必须优先保证 Win / Linux 双平台稳定运行。
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

- **修改 `package.json`、Vite 版本、构建脚本、原生包逻辑时，必须同步考虑 Win / Linux 两侧。**
- 只要改动涉及：
  - `package.json`
  - `package-lock.json`
  - `yarn.lock`
  - `scripts/ensure-platform-build-deps.cjs`
  - `vite.config.ts`
  - `optionalDependencies`
  就必须做双平台验证。

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

### 完成前最低门槛

对代码、数据、构建配置、脚本、依赖、锁文件的改动，至少执行：

```bash
npm run typecheck
npm run lint
npm run build
```

### Windows 运行验证

对影响运行链路或依赖链路的改动，必须额外执行：

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
- Win / Linux 哪些验证已通过
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
- 提交前必须先完成本仓库要求的验证；涉及运行时代码、构建链路、依赖、配置时，必须同时满足 Linux/WSL 与 Windows 的验证要求后才能声称完成。
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
3. 改动后必须至少通过：
   - `npm run typecheck`
   - `npm run lint`
   - `npm run build`

### 修改界面逻辑

1. 优先看：
   - `src/ui/app/*`
   - `src/ui/features/*`
   - `src/ui/components/*`
2. 若只是纯界面调整，也不要跳过 `typecheck/lint/build`
3. 若改动影响启动或构建链路，还要补 Windows `npm.cmd run dev`

### 修改依赖或构建链路

1. 优先看：
   - `package.json`
   - `package-lock.json`
   - `yarn.lock`
   - `vite.config.ts`
   - `eslint.config.js`
   - `scripts/ensure-platform-build-deps.cjs`
2. 这类改动必须执行双平台验证
3. 没有 Win / Linux 双平台证据时，禁止声称“已修复”

## 代理工作注意事项

- 先看真实脚本与配置，再决定命令，不要凭经验猜。
- 遇到平台相关报错时，先区分是：
  - 配置错误
  - 原生包缺失
  - 二进制版本不匹配
  - Windows 命令入口问题
- 若你只能在单平台完成验证，最终必须明确写“另一平台未验证”，不能暗示已经可运行。
