# API Pilot — 开发文档

---

## 环境搭建

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

### 打包为 VSIX

```bash
npx vsce package
code --install-extension api-pilot-*.vsix
```

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
│   │   ├── MessageHandler.ts     # 消息路由
│   │   ├── HandlerContext.ts     # 处理器共享上下文类型
│   │   ├── CollectionHandler.ts  # 集合操作处理器
│   │   ├── EnvironmentHandler.ts # 环境操作处理器
│   │   ├── HistoryHandler.ts     # 历史操作处理器
│   │   ├── HttpRequestHandler.ts # HTTP/协议请求处理器
│   │   └── SessionHandler.ts     # 会话管理处理器
│   ├── providers/
│   │   ├── WebviewProvider.ts    # Webview 面板管理
│   │   ├── CollectionTreeProvider.ts  # 侧边栏集合树
│   │   ├── HistoryTreeProvider.ts     # 侧边栏历史树
│   │   └── EnvStatusBarItem.ts   # 状态栏环境显示
│   ├── services/
│   │   ├── HttpClient.ts         # HTTP 请求引擎
│   │   ├── WsClient.ts           # WebSocket 客户端
│   │   ├── SseClient.ts          # SSE 客户端
│   │   ├── MqttClient.ts         # MQTT 客户端
│   │   ├── GrpcClient.ts         # gRPC 客户端
│   │   ├── BaseConnectionClient.ts # 连接客户端基类
│   │   ├── StorageService.ts     # JSON 文件持久化
│   │   ├── CollectionService.ts  # 集合增删改查
│   │   ├── EnvService.ts         # 环境管理
│   │   ├── HistoryService.ts     # 请求历史
│   │   ├── VariableResolver.ts   # 变量插值引擎
│   │   ├── ScriptRunner.ts       # 前/后置脚本执行
│   │   ├── CurlParser.ts         # cURL 解析
│   │   ├── CurlExporter.ts       # cURL 导出
│   │   ├── UniversalParser.ts    # 多格式导入解析器
│   │   └── contentTypeUtils.ts   # Content-Type 工具
│   └── types/
│       ├── index.ts              # 数据模型
│       └── messages.ts           # 消息协议
├── webview-ui/                   # React webview 源代码
│   └── src/
│       ├── App.tsx               # 根组件
│       ├── main.tsx              # React 入口
│       ├── vscode.ts             # VS Code API 桥接
│       ├── components/
│       │   ├── Layout/
│       │   │   ├── TabBar.tsx             # 多标签栏
│       │   │   ├── TabContextMenu.tsx     # 标签右键菜单
│       │   │   ├── useTabDnD.ts           # 标签拖放
│       │   │   └── useTabScroll.ts        # 标签滚动溢出
│       │   ├── RequestPanel/
│       │   │   ├── RequestPanel.tsx        # 请求编辑器主体
│       │   │   ├── RequestTitle.tsx        # 可编辑请求标题
│       │   │   ├── RequestTabs.tsx         # 参数/头部/请求体选项卡
│       │   │   ├── UrlBar.tsx             # URL 输入 + 方法选择
│       │   │   ├── ProtocolSelector.tsx   # HTTP/WS/SSE/MQTT/gRPC 切换
│       │   │   ├── HeadersEditor.tsx      # 请求头键值编辑器
│       │   │   ├── AuthEditor.tsx         # 认证配置
│       │   │   ├── BodyEditor.tsx         # 请求体编辑器
│       │   │   ├── ScriptEditor.tsx       # 前/后置脚本编辑器
│       │   │   ├── ScriptDocs.tsx         # 脚本 API 文档
│       │   │   ├── scriptExamples.ts      # 脚本示例
│       │   │   ├── SaveDialog.tsx         # 保存到集合对话框
│       │   │   ├── CodeModal.tsx          # 代码生成弹窗
│       │   │   ├── WsConversation.tsx     # WebSocket 消息视图（虚拟化）
│       │   │   ├── SseConversation.tsx    # SSE 事件流视图（虚拟化）
│       │   │   ├── MqttPanel.tsx          # MQTT 发布/订阅面板（虚拟化）
│       │   │   ├── MqttOptions.tsx        # MQTT 连接选项
│       │   │   ├── GrpcPanel.tsx          # gRPC 流式面板（虚拟化）
│       │   │   ├── GrpcOptions.tsx        # gRPC 服务/方法选择
│       │   │   ├── GrpcTemplateModal.tsx  # gRPC 请求模板
│       │   │   ├── grpcUtils.ts           # gRPC 工具函数
│       │   │   └── useProtocolHandlers.ts # 协议发送处理函数
│       │   ├── ResponsePanel/
│       │   │   ├── ResponsePanel.tsx      # 响应查看器容器
│       │   │   ├── BodyViewer/            # 响应体渲染器（JSON、HTML、XML、图片、Markdown、纯文本）
│       │   │   ├── ConsoleTab.tsx         # 脚本控制台输出
│       │   │   ├── SslTab.tsx             # TLS 证书信息
│       │   │   ├── SyntaxHighlighter.tsx  # 代码高亮
│       │   │   ├── TestResultsTab.tsx     # 测试断言结果
│       │   │   └── TimingTab.tsx          # 请求耗时分析
│       │   ├── Sidebar/
│       │   │   ├── CollectionsSidebar.tsx  # 集合树浏览器
│       │   │   ├── CollectionContextMenu.tsx # 集合右键菜单
│       │   │   ├── HistorySidebar.tsx     # 请求历史浏览器
│       │   │   └── useCollectionDnD.ts    # 集合拖放
│       │   ├── EnvManager/
│       │   │   └── EnvManager.tsx         # 环境变量编辑器
│       │   └── shared/
│       │       ├── AutoComplete.tsx       # 自动补全下拉
│       │       ├── EmptyState.tsx         # 空状态占位
│       │       ├── FormDataEditor.tsx     # 表单/multipart 编辑器
│       │       ├── KeyValueEditor.tsx     # 通用键值编辑器
│       │       ├── Modal.tsx              # 弹窗组件
│       │       ├── TruncatedText.tsx      # 可展开截断文本
│       │       ├── bulkEditUtils.ts       # 批量编辑解析
│       │       ├── useBulkEdit.ts         # 批量编辑 Hook
│       │       ├── ui.tsx                 # 旧版 UI 导出
│       │       └── ui/                    # UI 组件库（Button、Input、Select、Textarea、ToggleGroup）
│       ├── hooks/
│       │   ├── useAutoScroll.ts           # 自动滚动 Hook（旧版）
│       │   ├── useClickOutside.ts         # 点击外部检测
│       │   ├── useCopyToClipboard.ts      # 复制到剪贴板
│       │   ├── useEnvironments.ts         # 环境数据 Hook
│       │   ├── useMessageHandler.ts       # Webview 消息处理
│       │   ├── useProtocolMode.ts         # 协议模式检测
│       │   └── useVscodeMessage.ts        # VS Code 消息桥接
│       ├── stores/
│       │   ├── tabStore.ts       # 多标签状态 + useActiveTab
│       │   ├── requestStore.ts   # 请求状态类型
│       │   ├── settingsStore.ts  # 用户设置状态
│       │   └── localeStore.ts    # 语言/国际化状态
│       ├── i18n/
│       │   └── index.ts          # 国际化（en、zh-CN）
│       ├── utils/
│       │   ├── codeGenerators.ts # 代码片段生成
│       │   ├── constants.ts      # 共享常量
│       │   ├── formatters.ts     # 显示格式化工具
│       │   ├── protocolColors.ts # 协议颜色定义
│       │   └── varHighlight.tsx  # 变量语法高亮
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


---

## NPM 脚本

### 扩展开发

| 命令 | 说明 |
|------|------|
| `npm run build` | 构建扩展和 Webview（生产环境） |
| `npm run build:extension` | 仅构建扩展 (esbuild) |
| `npm run build:webview` | 仅构建 Webview (Vite) |
| `npm run watch` | 监视扩展源代码并自动重新编译 |
| `npm run dev:webview` | 启动 Webview 开发服务器 (Vite HMR) |
| `npm test` | 运行所有扩展测试 |
| `npm run test:watch` | 扩展测试监视模式 |
| `npm run test:coverage` | 生成测试覆盖率报告 |
| `npm run lint` | ESLint 代码检查 |

### Webview 开发

在 `webview-ui/` 目录下同样提供了相同的脚本命令：
```bash
cd webview-ui
npm run dev              # Vite 开发服务器
npm test                 # 运行 Webview 测试
npm run test:watch       # 测试监视模式
npm run test:coverage    # 测试覆盖率报告
npm run build            # 生产构建
```

---

## 开发工作流程

### 1. 扩展开发

```bash
# 启动扩展监视编译（一个终端）
npm run watch

# 同时启动 Webview HMR 开发服务器（另一个终端）
cd webview-ui && npm run dev

# 在 VS Code 中按 F5 启动扩展调试主机
# 修改代码后会自动热重载
```

### 2. Webview 开发

在本地开发时，Webview 会连接到 Vite 开发服务器。修改代码后会自动热重载（HMR），无需手动刷新。

### 3. 运行测试

```bash
# 持续运行测试
npm run test:watch
cd webview-ui && npm run test:watch

# 检查测试覆盖率
npm run test:coverage
```

### 4. 调试

- **扩展调试**: 在 VS Code 调试窗口中设置断点，按 F5 启动
- **Webview 调试**: 在调试窗口通过开发者工具检查和调试（在打开的 Webview 中按 Ctrl+Shift+I）

---

## 测试详情

### 测试架构

| 类别 | 框架 | 环境 |
|------|------|------|
| 扩展单元测试 | Vitest | Node.js |
| Webview 单元测试 | Vitest + React Testing Library | jsdom |
| 集成测试 | 嵌入在单元测试中 | 多环境 |

### 测试文件结构

```
src/
  services/__tests__/
    - CurlParser.test.ts           - cURL 解析逻辑
    - HttpClient.test.ts           - HTTP 请求引擎
    - CurlExporter.test.ts         - cURL 导出逻辑
    - CollectionService.test.ts    - 集合管理
    - EnvService.test.ts           - 环境管理
    - VariableResolver.test.ts     - 变量插值引擎
    - StorageService.test.ts       - JSON 持久化
    - HistoryService.test.ts       - 历史管理

  handlers/__tests__/
    - MessageHandler.test.ts       - Webview ↔ 扩展消息路由

webview-ui/src/
  stores/__tests__/
    - tabStore.test.tsx
    - requestStore.test.tsx
    - settingsStore.test.tsx
    - localeStore.test.tsx
  
  components/__tests__/
    - 各组件单元测试
    - BodyViewer.test.tsx
    - 等其他组件测试

  data/__tests__/
    - 数据相关测试
```

### 运行特定测试

```bash
# 运行特定文件的测试
npm test -- CurlParser.test.ts

# 运行包含特定模式的测试
npm test -- --grep "should parse URL"

# Webview 测试同样
cd webview-ui && npm test -- storeTests
```

---

## 常见问题 & 故障排除

### 问题：Webview 不更新

**解决方案**：
- 确保 `npm run dev:webview` 已启动
- 检查浏览器控制台是否有错误
- 重启调试主机（Ctrl+Shift+F5）

### 问题：TypeScript 错误

```bash
# 验证 TypeScript 配置
npx tsc --noEmit                 # 扩展
cd webview-ui && npx tsc --noEmit # Webview
```

### 问题：部分测试失败

- 请确保依赖已正确安装：`npm install && cd webview-ui && npm install`
- 清除缓存：`rm -rf node_modules package-lock.json && npm install`
- 某些测试可能因时序或状态共享而间歇性失败，可重新运行

### 问题：VSIX 打包失败

```bash
# 确保已安装 vsce
npm install -g @vscode/vsce

# 打包前完整构建
npm run build
npx vsce package
```

### 问题：快捷键冲突

如果 F5 被其他工具占用，可在 `.vscode/launch.json` 中自定义调试启动快捷键。

---

## 许可证

MIT
