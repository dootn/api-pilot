// Mock for vscode module used in tests
export const workspace = {
  workspaceFolders: [
    {
      uri: { fsPath: '/tmp/test-workspace' },
      name: 'test',
      index: 0,
    },
  ],
};

export const window = {
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  showInputBox: vi.fn(),
  showQuickPick: vi.fn(),
  createWebviewPanel: vi.fn(),
  registerWebviewViewProvider: vi.fn(),
  registerTreeDataProvider: vi.fn(),
  createStatusBarItem: vi.fn(() => ({
    text: '',
    tooltip: '',
    command: '',
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  })),
  createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(),
    show: vi.fn(),
    dispose: vi.fn(),
  })),
};

export const commands = {
  registerCommand: vi.fn(),
  executeCommand: vi.fn(),
};

export const Uri = {
  joinPath: vi.fn((...args: unknown[]) => ({
    fsPath: (args as { fsPath?: string }[]).map((a) => a.fsPath || String(a)).join('/'),
  })),
  file: vi.fn((path: string) => ({ fsPath: path })),
};

export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class TreeItem {
  label: string;
  collapsibleState?: TreeItemCollapsibleState;
  constructor(label: string, collapsibleState?: TreeItemCollapsibleState) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export class EventEmitter {
  private listeners: Function[] = [];
  event = (listener: Function) => {
    this.listeners.push(listener);
    return { dispose: () => {} };
  };
  fire(data: unknown) {
    this.listeners.forEach((l) => l(data));
  }
  dispose() {
    this.listeners = [];
  }
}

export enum ViewColumn {
  One = 1,
  Two = 2,
  Three = 3,
}
