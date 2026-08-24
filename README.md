# 禅

赛博修行，片刻清净。

九种禅趣、静心、创作与记录体验，愿每次相逢都带来一点轻松自在。

“禅”是一款原生桌面优先的轻量互动应用，也可以作为 fnOS 应用运行。首页按应用内的四个分区组织入口，打开后即可在不同的片刻里选择适合自己的互动。

## 功能

首页按四个分区组织功能，支持滚动浏览，在 `200×200` 的小窗口中也可以访问全部入口。

### 禅趣

一念一动，随喜自在。

- **赛博木鱼**：一敲一念，功德随喜。点击木鱼，或按空格键敲击。
- **赛博烧香**：点燃三炷香，静心三分钟；燃烧中再次点击可以换上新的三炷香。
- **1000万以内最好玩的竹知了**：按住画圈，找回童年的“哇哇”声；也可以自动甩动，或在支持动作传感器的手机浏览器中直接晃动手机。
- **赛博念珠**：二十七珠，四轮百八念；点击或拖动逐颗拨动。

### 静心

一息一坐，回到此刻。

- **莲花呼吸**：四秒吸气，六秒呼气；提供 1、3、5 分钟选择。
- **入定计时**：留一段安静给自己；提供 5、15、25、45 分钟选择和可选棕噪音。

### 创作

无求无定，自在成景。

- **数字枯山水**：耙沙置石，心随纹静；支持撤销、清空、保存、恢复最近作品和导出 PNG。
- **电子颂钵**：轻敲绕行，听见余音；点击敲击或沿钵缘拖动，切换页面即停止声音。

### 记录

只记相逢，不催赶路。

- **修行簿**：今日、七日、累计与成就；不设置排行榜、断签惩罚或强制目标。

成就会随着互动逐步解锁，部分成就会在完成前保持神秘；已解锁的成就会出现在修行簿中。

所有声音均通过 Web Audio API 实时合成，不依赖版权来源不明的音频素材。

## 运行环境

- Node.js 22（fnOS 使用 `nodejs_v22` 依赖）
- npm
- Windows、Linux 或 macOS 桌面环境需要 Electron 运行时；开发依赖会由 npm 安装

## 本地开发

```powershell
npm ci
npm run dev
```

如果只需要启动 HTTP 服务：

```powershell
npm run serve
```

默认服务地址为 `http://127.0.0.1:3001/`。可以通过环境变量修改监听配置：

```powershell
$env:PORT = "3001"
$env:HOST = "127.0.0.1"
npm run serve
```

运行测试：

```powershell
npm test
```

## 桌面打包

应用默认以桌面窗口启动，不以外部浏览器作为主要入口。窗口最小尺寸为 `200×200`。

```powershell
# 生成当前平台的解包目录
npm run pack

# 生成安装包
npm run dist
```

也可以显式指定目标平台：

```powershell
npx electron-builder --win --x64 --publish never
npx electron-builder --linux --x64 --publish never
npx electron-builder --mac --x64 --publish never
npx electron-builder --mac --arm64 --publish never
```

构建产物位于 `dist/`。Windows 生成 NSIS 安装包，Linux 生成 AppImage，macOS 生成 DMG。

## fnOS 打包

`fnos_app/` 是 fnOS 包的配置和启动脚本，页面源码唯一来源仍是根目录的 `public/`。不要手工维护两份页面；打包脚本会先同步 `server.js` 和 `public/`，再上传到远程服务器执行 `fnpack build`。

在运行脚本前，编辑 [`scripts/build.ps1`](scripts/build.ps1) 顶部的 SSH 主机、端口、用户名、密码和远程目录配置：

```powershell
./scripts/build.ps1
```

脚本会输出远程 FPK 产物路径。安装 fnOS 应用时，向导会要求填写服务端口，范围为 `1024–65535`，并在安装前检查端口是否已被占用。

## 数据持久化

应用不会清理或迁移已有的历史数据。现有数据文件继续保留：

- `counts.json`：木鱼
- `incense.json`：烧香
- `cicada.json`：竹知了
- `practice.json`：念珠、呼吸、入定、枯山水保存次数、颂钵记录和正在进行的计时
- `garden.json`：最近一次数字枯山水场景

桌面端默认保存到 Electron 的应用数据目录下的 `data/`；独立运行服务时默认使用项目根目录的 `data/`；fnOS 使用应用配置的数据共享目录。计时使用服务端保存的绝对结束时间，应用关闭后重新打开会自动恢复或结算到期练习。

## HTTP API

前端与服务端使用原生 JSON 接口，主要接口如下：

| 接口 | 用途 |
| --- | --- |
| `GET/POST /api/mala` | 读取或幂等保存当日念珠数 |
| `GET/POST/DELETE /api/timer` | 读取、开始或取消呼吸/入定计时 |
| `POST /api/timer/complete` | 幂等登记已完成计时 |
| `GET/PUT /api/garden` | 读取或保存数字枯山水 |
| `POST /api/activity` | 记录颂钵敲击或沙庭保存，并支持请求 ID 去重 |
| `GET /api/stats` | 聚合今日、最近 7 天和累计数据 |

服务端会限制字段、数值范围和请求体大小，重复请求不会重复累计。

## 项目结构

```text
├─ desktop/              Electron 主进程
├─ public/               唯一的前端源码
│  ├─ index.html         页面外壳与功能页面
│  ├─ styles.css         共享样式
│  └─ js/                导航、经典功能和新增功能模块
├─ server.js             原生 Node.js HTTP 服务与 API
├─ fnos_app/             fnOS manifest、启动脚本和 UI 配置
├─ scripts/build.ps1     远程 SSH + fnpack 打包脚本
├─ tests/                服务端 API 测试
└─ releases/             版本发布记录
```

## CI / Release

GitHub Actions 位于 [`.github/workflows/release.yml`](.github/workflows/release.yml)：

- 推送 `v*` 标签时自动构建 Windows、Linux、macOS 和 fnOS 产物。
- 也可以在 Actions 页面手动运行，并填写发布标签。
- 构建前会执行 `npm ci` 和 `npm test`。
- 发布资产会上传到 GitHub Release。

例如：

```powershell
git tag v1.0.1
git push origin v1.0.1
```

## 许可

当前项目处于测试阶段。具体开源许可和再分发规则以后续仓库声明为准。
