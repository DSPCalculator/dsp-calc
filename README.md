# html版戴森球量化计算器

![](https://img.shields.io/github/license/DSPCalculator/dsp-calc)
![](https://img.shields.io/github/stars/DSPCalculator/dsp-calc)
![Contributors](https://img.shields.io/github/contributors/DSPCalculator/dsp-calc)
![GitHub Release](https://img.shields.io/github/v/release/DSPCalculator/dsp-calc)

## 在线使用方式

- 主站 (Netlify) https://dsp-calc.pro/ &emsp;&emsp; 分支/PR预览 https://b.dsp-calc.pro/

- Github Pages: https://dspcalculator.github.io/dsp-calc/

已经废弃的站点：~~https://shi-sang.gitee.io/dsp_calculator/~~

## 本地开发环境

- 安装 Node.js (最低支持的版本为 20.19+ 或 22.12+ 或 任意更高的偶数大版本)，可以选择以下两种方式之一：
    - 直接下载 [Node.js](https://nodejs.org/zh-cn/download) 并安装
    - 使用 nvm (Node Version Manager，长期开发推荐)
        - 如果是 Linux、macOS、WSL 等 POSIX 环境按照说明安装 [nvm](https://github.com/nvm-sh/nvm#installing-and-updating)
        - 如果是 Windows 下载 [nvm-windows](https://github.com/coreybutler/nvm-windows/releases/latest)
        - 安装后在命令行输入以下命令：`nvm install 24` (安装Node.js)，然后`nvm use 24` (使用刚才安装的Node.js)
            - 可以将 `24` 换成你要的大版本
- 确认 `npm` 指令可以运行
- `npm install`
- `npm run dev`，然后根据提示打开浏览器链接即可

## 部署

- 您可以使用本项目release分支内的静态文件直接部署
- 或使用 `npm run build` 来生成静态文件

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
