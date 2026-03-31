import * as vscode from 'vscode';
import { WebviewProvider } from './providers/WebviewProvider';
import { CollectionTreeProvider } from './providers/CollectionTreeProvider';
import { HistoryTreeProvider } from './providers/HistoryTreeProvider';
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

  // Register collection tree with drag and drop support
  const collectionTreeProvider = new CollectionTreeProvider(collectionService);
  const collectionTreeView = vscode.window.createTreeView('apiPilot.collections', {
    treeDataProvider: collectionTreeProvider,
    dragAndDropController: collectionTreeProvider,
    canSelectMany: false
  });
  context.subscriptions.push(collectionTreeView);

  // Register history tree
  const historyTreeProvider = new HistoryTreeProvider(historyService);
  context.subscriptions.push(
    vscode.window.registerTreeDataProvider('apiPilot.history', historyTreeProvider)
  );

  // Register sidebar webview provider
  const webviewProvider = new WebviewProvider(context.extensionUri, {
    collectionService,
    envService,
    historyService,
    storageService,
    onCollectionChanged: () => collectionTreeProvider.refresh(),
    onHistoryChanged: () => historyTreeProvider.refresh(),
  });
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider('apiPilot.mainView', webviewProvider)
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
    vscode.commands.registerCommand('apiPilot.openRequest', (requestData: string, collectionId?: string) => {
      const panel = WebviewProvider.createPanel(context.extensionUri);
      // Send the request data to the webview after it's ready
      setTimeout(() => {
        const parsed = JSON.parse(requestData);
        panel.webview.postMessage({
          type: 'loadRequest',
          payload: collectionId ? { ...parsed, collectionId } : parsed,
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

  // Rename folder in collection
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.renameFolder', async (item: { collectionId?: string; itemId?: string; label: string }) => {
      if (!item.collectionId || !item.itemId) return;
      const newName = await vscode.window.showInputBox({
        prompt: 'Rename folder',
        value: item.label,
        validateInput: (v) => (v.trim() ? null : 'Name is required'),
      });
      if (newName) {
        collectionService.renameFolder(item.collectionId, item.itemId, newName.trim());
        collectionTreeProvider.refresh();
      }
    })
  );

  // Delete folder from collection
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.deleteFolder', async (item: { collectionId?: string; itemId?: string; label: string }) => {
      if (!item.collectionId || !item.itemId) return;
      const confirm = await vscode.window.showWarningMessage(
        `Delete folder "${item.label}" and all its contents?`,
        { modal: true },
        'Delete'
      );
      if (confirm === 'Delete') {
        collectionService.removeItem(item.collectionId, item.itemId);
        collectionTreeProvider.refresh();
      }
    })
  );

  // Duplicate folder in collection
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.duplicateFolder', async (item: { collectionId?: string; itemId?: string; label: string }) => {
      if (!item.collectionId || !item.itemId) return;
      const success = collectionService.duplicateFolder(item.collectionId, item.itemId);
      if (success) {
        collectionTreeProvider.refresh();
        vscode.window.showInformationMessage(`Duplicated folder "${item.label}" with all its contents`);
      } else {
        vscode.window.showErrorMessage(`Failed to duplicate folder "${item.label}"`);
      }
    })
  );

  // Add subfolder to a folder
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.addSubfolder', async (item: { collectionId?: string; itemId?: string }) => {
      if (!item.collectionId || !item.itemId) return;
      const name = await vscode.window.showInputBox({
        prompt: 'Subfolder name',
        placeHolder: 'New Folder',
        validateInput: (v) => (v.trim() ? null : 'Name is required'),
      });
      if (name) {
        collectionService.addFolder(item.collectionId, name.trim(), item.itemId);
        collectionTreeProvider.refresh();
      }
    })
  );

  // Delete request from collection
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.deleteRequest', async (item: { collectionId?: string; itemId?: string; label: string }) => {
      if (!item.collectionId || !item.itemId) return;
      const confirm = await vscode.window.showWarningMessage(
        `Delete "${item.label}"?`,
        { modal: true },
        'Delete'
      );
      if (confirm === 'Delete') {
        collectionService.removeItem(item.collectionId, item.itemId);
        collectionTreeProvider.refresh();
      }
    })
  );

  // Rename request in collection
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.renameRequest', async (item: { collectionId?: string; itemId?: string; label: string }) => {
      if (!item.collectionId || !item.itemId) return;
      const newName = await vscode.window.showInputBox({
        prompt: 'Rename request',
        value: item.label,
        validateInput: (v) => (v.trim() ? null : 'Name is required'),
      });
      if (newName) {
        collectionService.renameRequest(item.collectionId, item.itemId, newName.trim());
        collectionTreeProvider.refresh();
      }
    })
  );

  // Duplicate request in collection
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.duplicateRequest', async (item: { collectionId?: string; itemId?: string; label: string }) => {
      if (!item.collectionId || !item.itemId) return;
      const success = collectionService.duplicateRequest(item.collectionId, item.itemId);
      if (success) {
        collectionTreeProvider.refresh();
        vscode.window.showInformationMessage(`Duplicated "${item.label}"`);
      } else {
        vscode.window.showErrorMessage(`Failed to duplicate "${item.label}"`);
      }
    })
  );

  // Move request to another collection/folder
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.moveRequest', async (item: { collectionId?: string; itemId?: string; label: string }) => {
      if (!item.collectionId || !item.itemId) return;

      const allCollections = collectionService.getAll();

      // Build flat list of destinations: collection root + all folders
      interface Destination { label: string; collectionId: string; folderId?: string; }
      const destinations: Destination[] = [];
      function addFolderItems(cols: typeof allCollections): void {
        for (const col of cols) {
          destinations.push({ label: `📁 ${col.name}`, collectionId: col.id });
          function walkFolders(items: import('./types').CollectionItem[], prefix: string): void {
            for (const it of items) {
              if (it.type === 'folder') {
                destinations.push({ label: `${prefix}📂 ${it.name}`, collectionId: col.id, folderId: it.name });
                walkFolders(it.items || [], prefix + '  ');
              }
            }
          }
          walkFolders(col.items, '  ');
        }
      }
      addFolderItems(allCollections);

      if (destinations.length === 0) {
        vscode.window.showWarningMessage('No collections available to move to.');
        return;
      }

      const picked = await vscode.window.showQuickPick(
        destinations.map((d) => ({ label: d.label, description: '', _dest: d })),
        { placeHolder: `Move "${item.label}" to...` }
      );
      if (!picked) return;

      const dest = picked._dest;
      const success = collectionService.moveRequest(
        item.collectionId,
        item.itemId,
        dest.collectionId,
        dest.folderId
      );
      if (success) {
        collectionTreeProvider.refresh();
        vscode.window.showInformationMessage(`"${item.label}" moved to ${picked.label.trim()}.`);
      } else {
        vscode.window.showErrorMessage('Failed to move request.');
      }
    })
  );

  // Open history entry in new tab
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.openHistoryEntry', (item: { entry?: import('./types').HistoryEntry }) => {
      if (!item.entry) return;
      const panel = WebviewProvider.createPanel(context.extensionUri);
      setTimeout(() => {
        panel.webview.postMessage({ type: 'loadRequest', payload: item.entry!.request });
      }, 500);
    })
  );

  // Delete single history entry
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.deleteHistoryEntry', async (item: { entry?: import('./types').HistoryEntry }) => {
      if (!item.entry) return;
      const confirm = await vscode.window.showWarningMessage(
        'Delete this history entry?',
        { modal: true },
        'Delete'
      );
      if (confirm === 'Delete') {
        historyService.deleteEntry(item.entry.id);
        historyTreeProvider.refresh();
      }
    })
  );

  // Delete history date group
  context.subscriptions.push(
    vscode.commands.registerCommand('apiPilot.deleteHistoryGroup', async (item: { groupDate?: string; label: string }) => {
      if (!item.groupDate) return;
      const confirm = await vscode.window.showWarningMessage(
        `Delete all history for "${item.label}"?`,
        { modal: true },
        'Delete'
      );
      if (confirm === 'Delete') {
        historyService.deleteGroup(item.groupDate);
        historyTreeProvider.refresh();
      }
    })
  );
}

export function deactivate() {
  // Cleanup
}
