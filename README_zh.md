# API Pilot

**强大的 HTTP API 调试工具，直接内嵌在 VS Code 中 —— 无需浏览器，无需额外应用。**

![VS Code](https://img.shields.io/badge/VS%20Code-1.85+-blue.svg)
![License](https://img.shields.io/badge/License-MIT-green.svg)

---

## 功能特性

### HTTP 请求

- **请求方法**: GET、POST、PUT、DELETE、PATCH、OPTIONS、HEAD
- **自定义请求头**: 以键值对形式添加任意请求头；可单独启用/禁用每一行，无需删除
- **查询参数**: 独立的键值对编辑器，每行支持启用/禁用开关
- **请求体**: 支持多种 Body 类型：
  - **JSON** — 带语法高亮的编辑器
  - **Form Data**（multipart）— 键值字段，支持文件上传
  - **URL Encoded**（x-www-form-urlencoded）
  - **Raw** — 自由文本，可自定义 Content-Type
  - **Binary** — 直接上传本地文件作为请求体
  - **GraphQL** — query + variables 编辑器
- **认证**: Bearer Token、Basic Auth、API Key（请求头或查询参数）
- **SSL 验证**: 可按请求开关 SSL 证书校验
- **脚本**: 使用兼容 Postman 的 `pm` API 编写 JavaScript 预请求脚本和后响应脚本 —— 修改请求、设置变量或断言响应结果

### 响应查看器

- **状态与耗时**: HTTP 状态码、状态文本、响应时间（ms）、响应体大小
- **响应体渲染**:
  - JSON — 格式化展示，支持折叠树
  - XML、Markdown、HTML — 渲染视图
  - 图片 — 内联预览
  - 原始文本 — 纯文本输出
- **响应头**: 独立标签页显示完整响应头列表
- **响应体搜索**: 在响应内容中搜索关键词
- **SSL 信息**: HTTPS 请求显示 TLS 协议版本、加密套件、证书主体/颁发者、有效期、指纹及完整证书链
- **测试结果**: 后响应脚本中 `pm.test()` 断言的通过/失败结果 —— 显示测试名称、状态（通过/失败）及失败时的错误信息
- **脚本控制台**: 捕获预/后脚本中的 `console.log / warn / error` 输出，标注来源（pre/post）和日志级别

### 集合管理

- 将请求组织到集合中，支持**嵌套文件夹**
- 完整增删改查：创建、重命名、删除集合和文件夹
- 将当前请求直接保存到任意集合

### 环境变量

- 创建多个环境（如开发、测试、生产），每个环境独立维护键值变量
- 在任意位置使用 `{{variable_name}}`：URL、请求头、参数、请求体、认证字段
- 变量支持递归解析（最多 5 层），发送请求及导出 cURL / 代码片段时自动解析
- 通过状态栏切换激活环境，激活环境重启后自动恢复
- 始终保证至少存在一个 `Default` 环境

### 请求历史

- 每个已发送的请求自动记录，按日期分组（最多保留 1000 条），一键回放
- 在历史侧边栏一键回放

### cURL / Fetch 导入 & 导出

- 粘贴 **cURL** 命令（bash）或 **fetch()** 代码片段（Chrome DevTools / Node.js）即可导入为请求
- 将请求导出为 cURL，导出时自动解析环境变量

### 代码片段

- 一键生成当前请求的代码片段（变量已解析）

### 编辑器便利功能

- **请求头自动补全**: 智能提示 58+ 个常见 HTTP 请求头名称及常用值
- **多标签页**: 同时编辑多个请求，未保存的更改显示脏状态标记
- **国际化**: 完整的中英文 UI 支持
- **主题适配**: 自动集成 VS Code 颜色主题

---

## 快速开始

1. 打开 VS Code，点击活动栏中的 **API Pilot** 图标。
2. 点击 `+` 新建请求。
3. 输入 URL，选择 HTTP 方法，点击 **Send**。
4. 在下方查看格式化的响应结果。

---


## 脚本

预请求脚本和后响应脚本在沙箱化的 Node.js VM 中运行，提供兼容 Postman 的 `pm` 对象：

```js
// 预请求脚本：修改请求头或设置变量
pm.request.headers.add({ key: 'X-Timestamp', value: Date.now().toString() });
pm.environment.set('token', 'my-value');

// 后响应脚本：运行断言
pm.test('状态码为 200', () => pm.response.to.have.status(200));
pm.test('响应包含 id', () => pm.expect(pm.response.json().id).to.exist);

// 控制台输出会被捕获并显示在脚本控制台标签页中
console.log('响应时间:', pm.response.responseTime);
console.warn('响应体过大');
```

测试结果按条目显示 通过 ✓ / 失败 ✗ 及错误详情。所有 `console.log/warn/error` 调用均被捕获，在脚本控制台标签页中展示，并标注来源（pre/post）和日志级别。

---

## 数据存储

所有数据存储在工作区的 `.api-pilot/` 目录中：

```
.api-pilot/
├── collections/     # 已保存的请求和文件夹
├── environments/    # 环境变量配置
└── history/         # 按日期分组的请求历史
```

> 可将 `.api-pilot/history/` 添加到 `.gitignore`，避免历史记录提交到版本控制。

---

## 许可证

MIT
