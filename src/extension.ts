import * as vscode from 'vscode';
import { WebviewProvider } from './providers/WebviewProvider';
import { StorageService } from './services/StorageService';
import { CollectionService } from './services/CollectionService';
import { EnvService } from './services/EnvService';
import { HistoryService } from './services/HistoryService';

export function activate(context: vscode.ExtensionContext) {
  console.log('API Pilot is now active!');

  const storageService = new StorageService();
  const collectionService = new CollectionService(storageService);
  const envService = new EnvService(storageService);
  const historyService = new HistoryService(storageService);

  const webviewProvider = new WebviewProvider(context.extensionUri, {
    collectionService,
    envService,
    historyService,
    storageService,
    onCollectionChanged: () => {
      webviewProvider.notifyWebview({ type: 'collectionsChanged' });
    },
    onHistoryChanged: () => {
      webviewProvider.notifyWebview({ type: 'historyChanged' });
    },
  });

  // Status bar entry (bottom-right) — the main entry point
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    99
  );
  statusBarItem.text = '$(rocket) API Pilot';
  statusBarItem.tooltip = 'Open API Pilot';
  statusBarItem.command = 'apiPilot.openPanel';
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Open / reveal the panel
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.openPanel', () => {
      webviewProvider.revealOrCreate();
    })
  );

  // Shortcut: new request (opens panel then React creates a tab)
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.newRequest', () => {
      webviewProvider.revealOrCreate();
    })
  );

  // Open a saved request from external callers
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.openRequest', (requestData: string, collectionId?: string) => {
      webviewProvider.revealOrCreate();
      setTimeout(() => {
        const parsed = JSON.parse(requestData);
        webviewProvider.notifyWebview({
          type: 'loadRequest',
          payload: collectionId ? { ...parsed, collectionId } : parsed,
        });
      }, 500);
    })
  );

  // Create new collection (command palette)
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.newCollection', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter collection name',
        placeHolder: 'My Collection',
        validateInput: (value) => (value.trim() ? null : 'Name is required'),
      });
      if (name) {
        collectionService.create(name.trim());
        webviewProvider.notifyWebview({ type: 'collectionsChanged' });
        vscode.window.showInformationMessage(`Collection "${name}" created.`);
      }
    })
  );

  // Select environment (command palette / status bar env item)
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.selectEnvironment', async () => {
      const envs = envService.getAll();
      const items: vscode.QuickPickItem[] = [
        { label: '$(close) No Environment', description: 'Clear active environment' },
        ...envs.map((e) => ({
          label: e.name,
          description: e.id === envService.getActiveEnvId() ? '(active)' : '',
          detail: `${e.variables.length} variables`,
        })),
        { label: '$(add) Create New Environment...', description: '' },
      ];

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: 'Select an environment',
      });

      if (!selected) return;

      if (selected.label === '$(close) No Environment') {
        envService.setActiveEnvId(null);
      } else if (selected.label === '$(add) Create New Environment...') {
        const name = await vscode.window.showInputBox({
          prompt: 'Enter environment name',
          placeHolder: 'e.g. Development',
          validateInput: (v) => (v.trim() ? null : 'Name is required'),
        });
        if (name) {
          const env = envService.create(name.trim());
          envService.setActiveEnvId(env.id);
        }
      } else {
        const env = envs.find((e) => e.name === selected.label);
        if (env) {
          envService.setActiveEnvId(env.id);
        }
      }
    })
  );

  // Manage environment variables (command palette)
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.manageEnvVars', async () => {
      const activeId = envService.getActiveEnvId();
      if (!activeId) {
        vscode.window.showWarningMessage('No active environment. Select one first.');
        return;
      }
      const env = envService.getById(activeId);
      if (!env) return;

      const varsText = env.variables
        .map((v) => `${v.key}=${v.value}`)
        .join('\n');

      const input = await vscode.window.showInputBox({
        prompt: `Edit variables for "${env.name}" (KEY=VALUE, one per line)`,
        value: varsText,
        validateInput: () => null,
      });

      if (input !== undefined) {
        env.variables = input
          .split('\n')
          .filter((line) => line.includes('='))
          .map((line) => {
            const [key, ...rest] = line.split('=');
            return { key: key.trim(), value: rest.join('=').trim(), enabled: true };
          });
        envService.update(env);
        vscode.window.showInformationMessage(`Environment "${env.name}" updated with ${env.variables.length} variables.`);
      }
    })
  );

  // Import cURL (command palette)
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.importCurl', async () => {
      const curlStr = await vscode.window.showInputBox({
        prompt: 'Paste a cURL command',
        placeHolder: 'curl -X GET https://api.example.com/users -H "Authorization: Bearer xxx"',
        ignoreFocusOut: true,
      });
      if (!curlStr) return;

      try {
        const { parseCurl } = await import('./services/CurlParser');
        const request = parseCurl(curlStr);
        webviewProvider.revealOrCreate();
        setTimeout(() => {
          webviewProvider.notifyWebview({ type: 'loadRequest', payload: request });
        }, 500);
        vscode.window.showInformationMessage('cURL imported successfully!');
      } catch (e) {
        vscode.window.showErrorMessage(`Failed to parse cURL: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    })
  );

  // Clear history (command palette)
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.clearHistory', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Clear all request history?',
        { modal: true },
        'Clear'
      );
      if (confirm === 'Clear') {
        historyService.clear();
        webviewProvider.notifyWebview({ type: 'historyChanged' });
        vscode.window.showInformationMessage('History cleared.');
      }
    })
  );
}

export function deactivate() {
  // Cleanup
}
