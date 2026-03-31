import { useLocaleStore } from '../stores/localeStore';

const en = {
  // TabBar
  newRequestHint: 'New Request (Ctrl+T)',
  doubleClickRename: 'Double-click to rename',
  closeTabHint: 'Close tab',
  scrollLeft: 'Scroll left',
  scrollRight: 'Scroll right',
  switchEnv: 'Switch environment',
  noEnv: 'No Env',
  renameTab: '✏ Rename Tab',
  pinTab: '📌 Pin Tab',
  unpinTab: '📌 Unpin Tab',
  closeTab: '✕ Close Tab',
  noEnvironment: 'No Environment',
  manageEnvironments: 'Manage Environments',
  pinnedHint: 'Pinned',
  // BodyEditor
  noBodyMsg: 'This request does not have a body',
  rawBodyPlaceholder: 'Enter raw body',
  jsonBodyPlaceholder: '{\n  "key": "value"\n}',
  chooseFile: '📂 Choose File',
  noFileSelected: 'No file selected',
  graphqlQueryLabel: 'Query',
  graphqlVariablesLabel: 'Variables (JSON)',
  graphqlQueryPlaceholder: 'query {\n  # GraphQL query\n}',
  graphqlVarsPlaceholder: '{"key": "value"}',
  // ScriptEditor
  preScriptLabel: 'Pre-request Script',
  postScriptLabel: 'Post-response Script',
  preScriptHelp: 'Runs before the request is sent. Available: pm.request, pm.environment, pm.variables',
  postScriptHelp: 'Runs after the response is received. Available: pm.response, pm.request, pm.test()',
  preScriptPlaceholder: '// e.g. pm.request.headers.add({ key: "X-Timestamp", value: Date.now().toString() });',
  postScriptPlaceholder: '// e.g. pm.test("Status is 200", () => pm.response.status === 200);',
  // RequestTabs
  tabParams: 'Params',
  tabHeaders: 'Headers',
  tabBody: 'Body',
  tabAuth: 'Auth',
  tabScripts: 'Scripts',
  // AuthEditor
  noAuth: 'No authentication',
  authToken: 'Token',
  authTokenPlaceholder: 'Enter bearer token',
  authUsername: 'Username',
  authUsernamePlaceholder: 'Username',
  authPassword: 'Password',
  authPasswordPlaceholder: 'Password',
  authKey: 'Key',
  authKeyPlaceholder: 'e.g. X-API-Key',
  authValue: 'Value',
  authValuePlaceholder: 'API key value',
  authAddTo: 'Add to',
  // ResponsePanel
  respBody: 'Body',
  respHeaders: 'Headers',
  respTests: 'Tests',
  respConsole: 'Console',
  sendingRequest: 'Sending request...',
  emptyResponseHint: 'Enter a URL and click Send to make a request',
  ctrlEnterHint: 'Ctrl+Enter to send',
  headerColName: 'Name',
  headerColValue: 'Value',
} as const;

const zhCN: Record<keyof typeof en, string> = {
  // TabBar
  newRequestHint: '新建请求 (Ctrl+T)',
  doubleClickRename: '双击重命名',
  closeTabHint: '关闭标签',
  scrollLeft: '向左滚动',
  scrollRight: '向右滚动',
  switchEnv: '切换环境',
  noEnv: '无环境',
  renameTab: '✏ 重命名标签',
  pinTab: '📌 固定标签',
  unpinTab: '📌 取消固定',
  closeTab: '✕ 关闭标签',
  noEnvironment: '无环境',
  manageEnvironments: '管理环境',
  pinnedHint: '已固定',
  // BodyEditor
  noBodyMsg: '此请求没有 Body',
  rawBodyPlaceholder: '输入原始 Body',
  jsonBodyPlaceholder: '{\n  "key": "value"\n}',
  chooseFile: '📂 选择文件',
  noFileSelected: '未选择文件',
  graphqlQueryLabel: '查询语句',
  graphqlVariablesLabel: '变量 (JSON)',
  graphqlQueryPlaceholder: 'query {\n  # GraphQL 查询\n}',
  graphqlVarsPlaceholder: '{"key": "value"}',
  // ScriptEditor
  preScriptLabel: '请求前脚本',
  postScriptLabel: '响应后脚本',
  preScriptHelp: '在发送请求前执行。可使用: pm.request, pm.environment, pm.variables',
  postScriptHelp: '在收到响应后执行。可使用: pm.response, pm.request, pm.test()',
  preScriptPlaceholder: '// 例如: pm.request.headers.add({ key: "X-Timestamp", value: Date.now().toString() });',
  postScriptPlaceholder: '// 例如: pm.test("状态码为200", () => pm.response.status === 200);',
  // RequestTabs
  tabParams: '参数',
  tabHeaders: '请求头',
  tabBody: '请求体',
  tabAuth: '认证',
  tabScripts: '脚本',
  // AuthEditor
  noAuth: '无认证',
  authToken: 'Token',
  authTokenPlaceholder: '输入 Bearer Token',
  authUsername: '用户名',
  authUsernamePlaceholder: '用户名',
  authPassword: '密码',
  authPasswordPlaceholder: '密码',
  authKey: '键名',
  authKeyPlaceholder: '例如 X-API-Key',
  authValue: '键值',
  authValuePlaceholder: 'API Key 值',
  authAddTo: '添加到',
  // ResponsePanel
  respBody: '响应体',
  respHeaders: '响应头',
  respTests: '测试结果',
  respConsole: '控制台',
  sendingRequest: '正在发送请求...',
  emptyResponseHint: '输入 URL 后点击发送',
  ctrlEnterHint: 'Ctrl+Enter 发送',
  headerColName: '名称',
  headerColValue: '值',
};

const translations: Record<string, Record<TranslationKey, string>> = { en, 'zh-CN': zhCN };

export type TranslationKey = keyof typeof en;

export function useI18n() {
  const locale = useLocaleStore((s) => s.locale);
  const map = translations[locale] ?? en;
  return (key: TranslationKey): string => map[key] ?? en[key];
}
