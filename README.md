# API Pilot

> 🚀 A powerful API debugging tool for VS Code — like Postman, built right into your editor.
>
> 🚀 强大的 VS Code API 调试工具 —— 编辑器内的 Postman。

![VS Code](https://img.shields.io/badge/VS%20Code-1.85+-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3+-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

**[English](./README_en.md) | [中文](./README_zh.md)**

---

## Features / 功能特性

### Core / 核心功能

- **HTTP Request Editor** — Support for GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD methods with full request configuration.
  **HTTP 请求编辑器** — 支持 GET、POST、PUT、DELETE、PATCH、OPTIONS、HEAD 方法，完整的请求配置。

- **Response Viewer** — Pretty-printed JSON, raw text, headers view, status/time/size metadata.
  **响应查看器** — JSON 格式化显示、原始文本、响应头查看、状态码/耗时/大小元数据。

- **Multi-Tab Interface** — Work on multiple requests simultaneously with a tabbed interface.
  **多标签页** — 支持同时编辑多个请求，标签页式界面。

- **Collection Management** — Organize requests into collections with nested folders, persisted as JSON files.
  **集合管理** — 将请求组织到集合中，支持嵌套文件夹，以 JSON 文件持久化存储。

- **Environment Variables** — Define `{{variable}}` placeholders resolved at request time. Switch between environments via status bar.
  **环境变量** — 支持 `{{variable}}` 占位符，在请求发送时自动解析。通过状态栏切换环境。

- **Request History** — Automatically records sent requests grouped by date, with quick replay.
  **请求历史** — 自动记录已发送的请求，按日期分组，支持快速重放。

- **cURL Import/Export** — Paste a cURL command to import, or export any request as cURL.
  **cURL 导入/导出** — 粘贴 cURL 命令导入请求，或将任何请求导出为 cURL。

### Editor Features / 编辑器特性

- **Header Auto-Complete** — Intelligent autocomplete for 58+ common HTTP header names and their common values.
  **请求头自动补全** — 智能提示 58+ 个常见 HTTP 请求头名称及其常用值。

- **Auth Configuration** — Support for Bearer Token, Basic Auth, and API Key authentication.
  **认证配置** — 支持 Bearer Token、Basic Auth 和 API Key 认证方式。

- **Body Editor** — JSON, form-urlencoded, raw text body types with syntax indication.
  **请求体编辑器** — 支持 JSON、form-urlencoded、原始文本等请求体类型。

- **Query Parameters** — Dedicated key-value editor for URL query parameters with enable/disable toggles.
  **查询参数** — 独立的键值对编辑器，支持启用/禁用开关。

---

## Installation / 安装

### From Source / 从源码安装

```bash
# Clone the repository / 克隆仓库
git clone https://github.com/dootn/api-pilot
cd api-pilot

# Install dependencies / 安装依赖
npm install
cd webview-ui && npm install && cd ..

# Build / 构建
npm run build

# Press F5 in VS Code to launch Extension Development Host
# 在 VS Code 中按 F5 启动扩展开发主机
```

### From VSIX / 从 VSIX 安装

```bash
# Package the extension / 打包扩展
npx vsce package

# Install the .vsix file / 安装 .vsix 文件
code --install-extension api-pilot-0.1.0.vsix
```

---

## Usage / 使用方法

### Quick Start / 快速开始

1. Click the **API Pilot** icon in the Activity Bar (left sidebar).
   点击左侧活动栏中的 **API Pilot** 图标。

2. Click the `+` button or run `API Pilot: New Request` from the command palette.
   点击 `+` 按钮或从命令面板运行 `API Pilot: New Request`。

3. Enter the URL, select the HTTP method, and click **Send**.
   输入 URL，选择 HTTP 方法，点击 **Send**。

4. View the response in the bottom panel with status, time, and formatted body.
   在下方面板查看响应，包括状态码、耗时和格式化的响应体。

### Collections / 集合管理

- **Create**: Click the folder icon in the Collections tree header.
  **创建**: 点击集合树顶部的文件夹图标。
- **Add Folder**: Right-click a collection → "Add Folder".
  **添加文件夹**: 右键集合 → "Add Folder"。
- **Rename/Delete**: Right-click a collection to manage.
  **重命名/删除**: 右键集合进行管理。

### Environment Variables / 环境变量

1. Run `API Pilot: Select Environment` from the command palette or click the status bar item.
   从命令面板运行 `API Pilot: Select Environment` 或点击状态栏。

2. Create a new environment or select an existing one.
   创建新环境或选择已有环境。

3. Use `{{variable_name}}` in URLs, headers, and body. They'll be resolved at send time.
   在 URL、请求头、请求体中使用 `{{variable_name}}`，发送时自动解析。

### cURL Import / cURL 导入

1. Click the import icon in the History view, or run `API Pilot: Import cURL`.
   点击历史视图中的导入图标，或运行 `API Pilot: Import cURL`。

2. Paste a cURL command — the request will be parsed and opened in a new tab.
   粘贴 cURL 命令 —— 请求将被解析并在新标签页中打开。

### Keyboard Shortcuts / 键盘快捷键

| Action | Shortcut |
|--------|----------|
| Open Command Palette / 打开命令面板 | `Ctrl+Shift+P` |
| New Request / 新建请求 | Command Palette → `API Pilot: New Request` |

---

## Configuration / 配置

Data is stored in the workspace `.api-pilot/` directory:

数据存储在工作区的 `.api-pilot/` 目录中：

```
.api-pilot/
├── collections/     # Collection JSON files / 集合 JSON 文件
├── environments/    # Environment JSON files / 环境 JSON 文件
└── history/         # History entries by date / 按日期的历史记录
```

> **Tip**: Add `.api-pilot/history/` to `.gitignore` if you don't want to track request history.
> **提示**: 如果不想追踪请求历史，可将 `.api-pilot/history/` 添加到 `.gitignore`。

---

## Commands / 命令

| Command | Description |
|---------|-------------|
| `API Pilot: New Request` | Open a new request tab / 打开新请求标签 |
| `API Pilot: Open API Pilot` | Open the main panel / 打开主面板 |
| `API Pilot: New Collection` | Create a new collection / 创建新集合 |
| `API Pilot: Select Environment` | Select active environment / 选择活跃环境 |
| `API Pilot: Manage Environment Variables` | Edit environment variables / 编辑环境变量 |
| `API Pilot: Import cURL` | Import a cURL command / 导入 cURL 命令 |
| `API Pilot: Clear History` | Clear all request history / 清空请求历史 |

---

## Tech Stack / 技术栈

| Layer | Technology |
|-------|-----------|
| Extension Host | TypeScript + VS Code Extension API |
| HTTP Client | [undici](https://github.com/nodejs/undici) |
| Webview UI | React 18 + TypeScript + Vite |
| State Management | [Zustand](https://github.com/pmndrs/zustand) |
| Build (Extension) | esbuild |
| Build (Webview) | Vite 5 |
| Testing | Vitest + React Testing Library |

---

## Project Structure / 项目结构

```
api-pilot/
├── src/                          # Extension source (Node.js)
│   ├── extension.ts              # Entry point / 入口
│   ├── handlers/
│   │   └── MessageHandler.ts     # Webview ↔ Extension message router / 消息路由
│   ├── providers/
│   │   ├── WebviewProvider.ts    # Webview panel management / Webview 面板管理
│   │   ├── CollectionTreeProvider.ts  # Sidebar collection tree / 侧边栏集合树
│   │   ├── HistoryTreeProvider.ts     # Sidebar history tree / 侧边栏历史树
│   │   └── EnvStatusBarItem.ts   # Status bar environment display / 状态栏环境显示
│   ├── services/
│   │   ├── HttpClient.ts         # HTTP request engine / HTTP 请求引擎
│   │   ├── StorageService.ts     # JSON file persistence / JSON 文件持久化
│   │   ├── CollectionService.ts  # Collection CRUD / 集合增删改查
│   │   ├── EnvService.ts         # Environment management / 环境管理
│   │   ├── HistoryService.ts     # Request history / 请求历史
│   │   ├── VariableResolver.ts   # {{var}} interpolation / 变量插值引擎
│   │   ├── CurlParser.ts         # cURL → ApiRequest / cURL 解析
│   │   └── CurlExporter.ts       # ApiRequest → cURL / cURL 导出
│   └── types/
│       ├── index.ts              # Data models / 数据模型
│       └── messages.ts           # Message protocol / 消息协议
├── webview-ui/                   # React webview source
│   └── src/
│       ├── App.tsx               # Root component / 根组件
│       ├── components/
│       │   ├── Layout/TabBar.tsx           # Multi-tab bar / 多标签栏
│       │   ├── RequestPanel/              # Request editing / 请求编辑
│       │   ├── ResponsePanel/             # Response display / 响应展示
│       │   └── shared/                    # Reusable components / 通用组件
│       ├── stores/
│       │   ├── tabStore.ts       # Multi-tab state / 多标签状态
│       │   └── requestStore.ts   # Request state types / 请求状态类型
│       └── data/
│           └── httpHeaders.ts    # Header autocomplete data / 请求头自动补全数据
├── dist/                         # Built extension / 构建产物
├── dist-webview/                 # Built webview / Webview 构建产物
└── .api-pilot/                   # Workspace data / 工作区数据 (runtime)
```

---

## Testing / 测试

```bash
# Run all extension tests / 运行所有扩展测试
npm test

# Run webview tests / 运行 Webview 测试
cd webview-ui && npm test

# Watch mode / 监视模式
npm run test:watch
cd webview-ui && npm run test:watch
```

**Test Coverage / 测试覆盖**:
- Extension: 9 test suites, 139 tests (services, handlers, parsers)
- Webview: 5 test suites, 50 tests (stores, components, data)
- Total: **189 tests**

---

## License / 许可证

MIT
