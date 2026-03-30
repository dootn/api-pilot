import * as vscode from 'vscode';
import { WebviewProvider } from './providers/WebviewProvider';
import { CollectionTreeProvider } from './providers/CollectionTreeProvider';
import { HistoryTreeProvider } from './providers/HistoryTreeProvider';
import { EnvStatusBarItem } from './providers/EnvStatusBarItem';
import { StorageService } from './services/StorageService';
import { CollectionService } from './services/CollectionService';
import { EnvService } from './services/EnvService';
import { HistoryService } from './services/HistoryService';
import { parseCurl } from './services/CurlParser';
import { exportCurl } from './services/CurlExporter';

export function activate(context: vscode.ExtensionContext) {
  console.log('API Pilot is now active!');

  const storageService = new StorageService();
  const collectionService = new CollectionService(storageService);
  const envService = new EnvService(storageService);
  const historyService = new HistoryService(storageService);

  // Register sidebar webview provider
  const webviewProvider = new WebviewProvider(context.extensionUri, {
    collectionService,
    envService,
    historyService,
  });
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('apiPilot.mainView', webviewProvider)
  );

  // Register collection tree
  const collectionTreeProvider = new CollectionTreeProvider(collectionService);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('apiPilot.collections', collectionTreeProvider)
  );

  // Register history tree
  const historyTreeProvider = new HistoryTreeProvider(historyService);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('apiPilot.history', historyTreeProvider)
  );

  // Open a new request panel
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.newRequest', () => {
      WebviewProvider.createPanel(context.extensionUri);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.openPanel', () => {
      WebviewProvider.createPanel(context.extensionUri);
    })
  );

  // Open a saved request
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.openRequest', (requestData: string) => {
      const panel = WebviewProvider.createPanel(context.extensionUri);
      // Send the request data to the webview after it's ready
      setTimeout(() => {
        panel.webview.postMessage({
          type: 'loadRequest',
          payload: JSON.parse(requestData),
        });
      }, 500);
    })
  );

  // Create new collection
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.newCollection', async () => {
      const name = await vscode.window.showInputBox({
        prompt: 'Enter collection name',
        placeHolder: 'My Collection',
        validateInput: (value) => (value.trim() ? null : 'Name is required'),
      });
      if (name) {
        collectionService.create(name.trim());
        collectionTreeProvider.refresh();
        vscode.window.showInformationMessage(`Collection "${name}" created.`);
      }
    })
  );

  // Rename collection
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.renameCollection', async (item: { itemId?: string; label: string }) => {
      if (!item.itemId) return;
      const newName = await vscode.window.showInputBox({
        prompt: 'Enter new name',
        value: item.label,
        validateInput: (value) => (value.trim() ? null : 'Name is required'),
      });
      if (newName) {
        collectionService.rename(item.itemId, newName.trim());
        collectionTreeProvider.refresh();
      }
    })
  );

  // Delete collection
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.deleteCollection', async (item: { itemId?: string; label: string }) => {
      if (!item.itemId) return;
      const confirm = await vscode.window.showWarningMessage(
        `Delete collection "${item.label}"?`,
        { modal: true },
        'Delete'
      );
      if (confirm === 'Delete') {
        collectionService.delete(item.itemId);
        collectionTreeProvider.refresh();
      }
    })
  );

  // Add folder to collection
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.addFolder', async (item: { itemId?: string }) => {
      if (!item.itemId) return;
      const name = await vscode.window.showInputBox({
        prompt: 'Enter folder name',
        placeHolder: 'New Folder',
        validateInput: (value) => (value.trim() ? null : 'Name is required'),
      });
      if (name) {
        collectionService.addFolder(item.itemId, name.trim());
        collectionTreeProvider.refresh();
      }
    })
  );

  // Refresh collections
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.refreshCollections', () => {
      collectionTreeProvider.refresh();
    })
  );

  // Environment status bar
  const envStatusBar = new EnvStatusBarItem(envService);
  context.subscriptions.push({ dispose: () => envStatusBar.dispose() });

  // Select environment
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
      envStatusBar.update();
    })
  );

  // Manage environment variables
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

  // Import cURL
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.importCurl', async () => {
      const curlStr = await vscode.window.showInputBox({
        prompt: 'Paste a cURL command',
        placeHolder: 'curl -X GET https://api.example.com/users -H "Authorization: Bearer xxx"',
        ignoreFocusOut: true,
      });
      if (!curlStr) return;

      try {
        const request = parseCurl(curlStr);
        const panel = WebviewProvider.createPanel(context.extensionUri);
        setTimeout(() => {
          panel.webview.postMessage({
            type: 'loadRequest',
            payload: request,
          });
        }, 500);
        vscode.window.showInformationMessage('cURL imported successfully!');
      } catch (e) {
        vscode.window.showErrorMessage(`Failed to parse cURL: ${e instanceof Error ? e.message : 'Unknown error'}`);
      }
    })
  );

  // Clear history
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.clearHistory', async () => {
      const confirm = await vscode.window.showWarningMessage(
        'Clear all request history?',
        { modal: true },
        'Clear'
      );
      if (confirm === 'Clear') {
        historyService.clear();
        historyTreeProvider.refresh();
        vscode.window.showInformationMessage('History cleared.');
      }
    })
  );

  // Refresh history
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.refreshHistory', () => {
      historyTreeProvider.refresh();
    })
  );
}

export function deactivate() {
  // Cleanup
}
