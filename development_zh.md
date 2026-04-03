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
