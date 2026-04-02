# API Pilot

> 🚀 强大的 VS Code API 调试工具 —— 编辑器内的 Postman。

![VS Code](https://img.shields.io/badge/VS%20Code-1.85+-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

---

## 功能特性

### 核心功能

- **HTTP 请求编辑器** — 支持 GET、POST、PUT、DELETE、PATCH、OPTIONS、HEAD 方法，完整的请求配置。

- **响应查看器** — JSON 格式化显示、原始文本、响应头查看、状态码/耗时/大小元数据。

- **多标签页** — 支持同时编辑多个请求，标签页式界面。

- **集合管理** — 将请求组织到集合中，支持嵌套文件夹，以 JSON 文件持久化存储。

- **环境变量** — 支持 `{{variable}}` 占位符，在请求发送时自动解析。通过标签栏切换环境。悬停在任意 `{{var}}` 令牌上可预览当前值。激活环境重启后自动恢复，且始终保证至少有一个 `Default` 环境。

- **请求历史** — 自动记录已发送的请求，按日期分组，支持快速重放。

- **cURL 导入/导出** — 粘贴 cURL 命令导入请求，或将任何请求导出为 cURL。导出时自动解析变量。

### 编辑器特性

- **请求头自动补全** — 智能提示 58+ 个常见 HTTP 请求头名称及其常用值。

- **认证配置** — 支持 Bearer Token、Basic Auth 和 API Key 认证方式。

- **请求体编辑器** — 支持 JSON、form-urlencoded、原始文本等请求体类型。

- **查询参数** — 独立的键值对编辑器，支持启用/禁用开关。

---

## 安装

### 从源码安装

```bash
# 克隆仓库
git clone https://github.com/dootn/api-pilot
cd api-pilot

# 安装依赖
npm install
cd webview-ui && npm install && cd ..

# 构建
npm run build

# 在 VS Code 中按 F5 启动扩展开发主机
```

### 从 VSIX 安装

```bash
# 打包扩展
npx vsce package

# 安装 .vsix 文件
code --install-extension api-pilot-0.1.0.vsix
```

---

## 使用方法

### 快速开始

1. 点击左侧活动栏中的 **API Pilot** 图标。

2. 点击 `+` 按钮或从命令面板运行 `API Pilot: New Request`。

3. 输入 URL，选择 HTTP 方法，点击 **Send**。

4. 在下方面板查看响应，包括状态码、耗时和格式化的响应体。

### 集合管理

- **创建**: 点击集合树顶部的文件夹图标。
- **添加文件夹**: 右键集合 → "Add Folder"。
- **重命名/删除**: 右键集合进行管理。

### 环境变量

1. 点击标签栏右下角的环境名称（或从命令面板运行 `API Pilot: Select Environment`）。

2. 选择环境，或打开 **Manage Environments** 创建/编辑变量。

3. 在 URL、请求头、查询参数、请求体中使用 `{{variable_name}}`，发送时及导出 cURL / 代码片段时均自动解析。

4. 在任意输入框中悬停在 `{{variable_name}}` 上，可通过 tooltip 预览该变量的当前解析值。

### cURL 导入

1. 点击历史视图中的导入图标，或运行 `API Pilot: Import cURL`。

2. 粘贴 cURL 命令 —— 请求将被解析并在新标签页中打开。

### 键盘快捷键

| 操作 | 快捷键 |
|------|--------|
| 打开命令面板 | `Ctrl+Shift+P` |
| 新建请求 | 命令面板 → `API Pilot: New Request` |

---

## 配置

数据存储在工作区的 `.api-pilot/` 目录中：

```
.api-pilot/
├── collections/     # 集合 JSON 文件
├── environments/    # 环境 JSON 文件
└── history/         # 按日期的历史记录
```

> **提示**: 如果不想追踪请求历史，可将 `.api-pilot/history/` 添加到 `.gitignore`。

---

## 命令

| 命令 | 说明 |
|------|------|
| `API Pilot: New Request` | 打开新请求标签 |
| `API Pilot: Open API Pilot` | 打开主面板 |
| `API Pilot: New Collection` | 创建新集合 |
| `API Pilot: Select Environment` | 选择活跃环境 |
| `API Pilot: Manage Environment Variables` | 编辑环境变量 |
| `API Pilot: Import cURL` | 导入 cURL 命令 |
| `API Pilot: Clear History` | 清空请求历史 |

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 扩展主机 | TypeScript + VS Code Extension API |
| HTTP 客户端 | [undici](https://github.com/nodejs/undici) |
| Webview UI | React 18 + TypeScript + Vite |
| 状态管理 | [Zustand](https://github.com/pmndrs/zustand) |
| 构建（扩展） | esbuild |
| 构建（Webview） | Vite 5 |
| 测试 | Vitest + React Testing Library |

---

## 项目结构

```
api-pilot/
├── src/                          # 扩展源代码 (Node.js)
│   ├── extension.ts              # 入口
│   ├── handlers/
│   │   └── MessageHandler.ts     # 消息路由
│   ├── providers/
│   │   ├── WebviewProvider.ts    # Webview 面板管理
│   │   ├── CollectionTreeProvider.ts  # 侧边栏集合树
│   │   ├── HistoryTreeProvider.ts     # 侧边栏历史树
│   │   └── EnvStatusBarItem.ts   # 状态栏环境显示
│   ├── services/
│   │   ├── HttpClient.ts         # HTTP 请求引擎
│   │   ├── StorageService.ts     # JSON 文件持久化
│   │   ├── CollectionService.ts  # 集合增删改查
│   │   ├── EnvService.ts         # 环境管理
│   │   ├── HistoryService.ts     # 请求历史
│   │   ├── VariableResolver.ts   # 变量插值引擎
│   │   ├── CurlParser.ts         # cURL 解析
│   │   └── CurlExporter.ts       # cURL 导出
│   └── types/
│       ├── index.ts              # 数据模型
│       └── messages.ts           # 消息协议
├── webview-ui/                   # React webview 源代码
│   └── src/
│       ├── App.tsx               # 根组件
│       ├── components/
│       │   ├── Layout/TabBar.tsx           # 多标签栏
│       │   ├── RequestPanel/              # 请求编辑
│       │   ├── ResponsePanel/             # 响应展示
│       │   └── shared/                    # 通用组件
│       ├── stores/
│       │   ├── tabStore.ts       # 多标签状态
│       │   └── requestStore.ts   # 请求状态类型
│       └── data/
│           └── httpHeaders.ts    # 请求头自动补全数据
├── dist/                         # 构建产物
├── dist-webview/                 # Webview 构建产物
└── .api-pilot/                   # 工作区数据 (运行时)
```

---

## 测试

```bash
# 运行所有扩展测试
npm test

# 运行 Webview 测试
cd webview-ui && npm test

# 监视模式
npm run test:watch
cd webview-ui && npm run test:watch
```

**测试覆盖**:
- 扩展: 9 个测试套件，139 个测试（服务、处理器、解析器）
- Webview: 5 个测试套件，50 个测试（存储、组件、数据）
- 合计: **189 个测试**

---

## 许可证

MIT
