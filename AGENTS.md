# AGENTS.md - dsp-calc 开发指南

本文档面向在本仓库内工作的 AI 代理，目标是让后续修改遵循项目已有工具链、提交习惯和验证方式。

## 项目概览

- 这是一个基于 `Vite + React 18` 的前端项目，用于戴森球计划量化计算。
- 包管理与脚本入口以 `npm` 为准；`README.md` 和 GitHub Actions 都使用 `npm install`、`npm run build`。
- 主要运行时代码位于 `src/`，游戏与模组数据位于 `data/`，图标资源与精灵图源文件位于 `icon/`，样式位于 `css/`。
- 当前没有单元测试脚本，真实质量门槛是 `npm run lint` 与 `npm run build`。

## 构建与运行规则

**工具链规则：**

- 在当前仓库中，默认使用 `npm`，不要把其他项目里的 `MSBuild`、`dotnet`、`wt.exe`、`AfterBuildEvent.exe` 规则照搬过来。
- 参考 CI，Node 版本以 `20` 为基准；本地若出现版本差异问题，优先切换到 Node 20 复现。
- 即使仓库里存在 `yarn.lock`，默认仍按 `npm` 流程执行，除非用户明确要求改用 Yarn。

**标准命令：**

```bash
# 安装依赖
npm install

# 本地开发服务器
npm run dev

# 生产构建
npm run build

# 预览 dist 产物
npm run preview

# 静态检查
npm run lint
```

**命令含义：**

- `npm run dev`：启动 Vite 开发服务器，供本地交互调试使用。
- `npm run build`：执行生产构建，输出静态资源到 `dist/`。
- `npm run preview`：基于构建产物启动本地预览服务。
- `npm run lint`：执行 ESLint；由于脚本里带 `--max-warnings 0`，warning 也会导致失败。

**构建副作用规则：**

- `vite.config.js` 中的 `get_sprite_plugins()` 在非 development 模式下会遍历 `icon/` 下的子目录，生成或更新：
  - `icon/<目录名>.png`
  - `icon/<目录名>.json`
  - `public/icon/` 下的压缩 PNG / WebP 资源
- 这意味着 `npm run build` 不只是“产出 dist”，还可能改写图标相关资源文件。修改 `icon/`、`public/icon/`、`vite.config.js` 时必须预期到这些变更。

**构建范围建议：**

- 修改 `src/`、`css/`、`data/`、`icon/`、`public/`、`vite.config.js`、`package.json`、`.eslintrc.cjs`、`.github/workflows/` 后，至少执行 `npm run build`。
- 修改前端逻辑、状态管理、数据装配、样式或构建配置后，提交前执行 `npm run lint` 和 `npm run build`。
- 纯文档变更（如 `README.md`、`AGENTS.md`）可以不跑构建，但最终汇报时必须明确写“未验证”。

**Web 热重载规则：**

- 本项目是 Web 前端项目，开发期默认依赖 `npm run dev` 的热重载观察修改效果。
- 除非用户明确要求执行 `npm run build`、需要验证生产构建、或当前任务本身涉及构建/发布链路，否则不要主动运行 `npm run build`。
- 如果只是为了查看界面改动或迭代样式，优先使用现有开发态而不是额外触发一次生产构建。

## 验证规则

**无测试脚本规则：**

- 当前 `package.json` 没有 `test` 脚本，也未发现 `vitest`、`jest`、`cypress`、`playwright` 等测试配置。
- 因此，不要声称“测试通过”；应准确表述为“已通过 lint/build 验证”或“未验证”。

**完成前验证门槛：**

- 代码、数据、构建配置改动：
  - 先跑 `npm run lint`
  - 再跑 `npm run build`
- 需要人工确认构建产物时，再补 `npm run preview`
- 如果只运行了其中一部分命令，必须在结论里明确缺失项。

## 关键文件与目录

| 路径 | 作用 |
|---|---|
| `package.json` | 脚本入口与依赖声明 |
| `vite.config.js` | Vite 配置；生产构建时会生成图标精灵图与压缩资源 |
| `src/main.jsx` | 前端入口，挂载 `icon-styles`、`header`、`root` 三个 React 根节点 |
| `src/App.jsx` | 主应用装配，负责上下文、模组切换、需求列表、批量设置、结果区 |
| `src/GameData.jsx` | 从 `data/*.json` 读取并组合原版/模组数据，是核心数据入口 |
| `src/ui_components/` | 可复用 UI 组件 |
| `css/` | 全局样式与页面样式 |
| `data/` | 原版与模组 JSON 数据源 |
| `icon/` | 图标源文件、精灵图生成输入及部分生成产物 |
| `public/` | 静态资源目录 |
| `.github/workflows/` | CI / 预览站 / 发布流程，真实反映线上构建方式 |

## 项目结构速览

```text
src/
├── main.jsx                  # React 入口
├── App.jsx                   # 应用装配与页面主结构
├── GameData.jsx              # 游戏/模组数据组合
├── scheme_data.jsx           # 方案数据
├── global_state.jsx          # 全局状态
├── result.jsx                # 计算结果展示
├── needs_list.jsx            # 需求输入与存储
├── settings.jsx              # 设置面板
└── ui_components/            # 可复用组件

data/                         # 游戏与模组 JSON 数据
icon/                         # 图标源文件和 sprite 元数据
css/                          # 样式文件
public/                       # 静态资源
```

## 代码风格与修改约束

- 现有代码以 `JS/JSX + ES Module` 为主，不要无故引入 TypeScript、类组件或额外状态库。
- 优先沿用函数组件、React Hooks、就近定义辅助函数的写法。
- 保持 4 空格缩进、语句分号、与当前文件一致的 import 风格。
- 核心流程、复杂分支、数据转换逻辑应写简体中文注释，不要只留下抽象命名。
- 修改模组版本、数据文件映射或图标资源时，要同步检查 `GameData.jsx`、`data/`、`icon/` 是否一致，避免出现 UI 可选项与数据文件不匹配。
- `dist/` 是构建产物目录，除非任务明确要求处理部署产物，否则不要手工编辑其中内容。

## 常见任务规则

### 修改前端逻辑

1. 优先从 `App.jsx`、`contexts.jsx`、`global_state.jsx`、相关功能组件定位入口。
2. 涉及计算结果、需求列表、配方展示时，确认是否影响 `result.jsx`、`needs_list.jsx`、`recipe.jsx`、`scheme_data.jsx`。
3. 修改完成后至少执行 `npm run lint` 和 `npm run build`。

### 修改数据或模组兼容

1. 先检查 `GameData.jsx` 中的版本号、GUID 组合顺序和启用逻辑。
2. 再检查 `data/` 下对应 JSON 是否存在、命名是否匹配。
3. 涉及图标时，检查 `icon/` 与 `public/icon/` 是否需要通过构建重新生成。
4. 修改完成后执行 `npm run build`，必要时再跑 `npm run preview` 做人工确认。

### 修改构建或发布流程

1. 优先检查 `package.json`、`vite.config.js`、`.github/workflows/`。
2. 这类改动必须执行 `npm run build`。
3. 如变更 ESLint 规则或脚本定义，还应额外执行 `npm run lint`。

## Git 提交规则

**核心原则：不要积压大批未提交逻辑改动。**

- 提交信息使用中文，保持和现有历史一致。
- 仓库现有历史以中文短句为主，例如：
  - `更新配方数据`
  - `添加分馏的物流交互站图片`
  - `星环矿井可设定采集速率`
- 不要求强制使用 `feat:` / `fix:` 这类英文 Conventional Commit。
- 如果需要分类前缀，优先使用中文前缀：
  - `功能：`
  - `修复：`
  - `重构：`
  - `杂项：`

**提交要求：**

- 一个逻辑单元一个 commit，不要把不相关修改塞进同一次提交。
- 涉及 `commit`、`amend`、`rebase`、`squash`、`cherry-pick`、拆分提交等 Git 历史操作时，优先按 `git-master` 的方式处理；开始执行前应先明确本轮提交策略，避免“先随手提交，之后再整理”。
- 未经用户明确批准，禁止 `git push`。
- 所有 Git 操作都必须串行执行，禁止并发 `git add`、`git commit`、`git rebase`、`git stash`、`git checkout`、`git merge` 等命令；即使作用文件完全不重叠，也必须等待前一个 Git 命令完成并确认仓库锁已释放后，才能开始下一个 Git 命令。
- 提交前必须先验证作者身份可用：优先使用本机已配置身份的 Git 执行 `git var GIT_AUTHOR_IDENT` 与 `git var GIT_COMMITTER_IDENT`；在当前 WSL 环境下，如本机 Windows Git 已配置身份，应优先使用 `/mnt/c/Program Files/Git/cmd/git.exe` 完成提交。
- 如果当前 shell 的 Git 没有读取到有效 `user.name` / `user.email`，禁止用 `git -c user.name=... -c user.email=...` 临时覆盖提交身份；应改用已配置身份的本机 Git，或先向用户确认后再处理。
- 提交前不要回滚用户已有的未提交改动；当前仓库可能处于脏工作树状态，必须只处理本次任务相关文件。
- 对代码、数据、构建配置的改动，应在 `npm run lint` 和 `npm run build` 成功后再提交。
- 对纯文档改动，如果没有运行验证命令，提交说明或最终汇报中必须明确标记“未验证”。

## 代理工作注意事项

- 先看真实脚本与配置，再决定命令，不要凭经验假设仓库有测试、后端服务或额外构建步骤。
- 发现 `npm run build` 生成了额外的 sprite 资源时，不要误判为“脏数据”；先判断是否由本次改动触发。
- 如果任务要求启动浏览器验收，应优先走 `npm run dev` 或 `npm run preview` 后再验证页面，而不是直接猜测 UI 行为。
- 汇报时必须区分：
  - 已修改哪些文件
  - 实际执行了哪些验证命令
  - 哪些内容未验证
