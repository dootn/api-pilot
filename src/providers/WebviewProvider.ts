import * as vscode from 'vscode';
import { MessageHandler } from '../handlers/MessageHandler';
import { CollectionService } from '../services/CollectionService';
import { EnvService } from '../services/EnvService';
import { HistoryService } from '../services/HistoryService';
import { StorageService } from '../services/StorageService';

export interface WebviewServices {
  collectionService?: CollectionService;
  envService?: EnvService;
  historyService?: HistoryService;
  storageService?: StorageService;
  version?: string;
  repoUrl?: string;
  onCollectionChanged?: () => void;
  onHistoryChanged?: () => void;
}

export class WebviewProvider {
  private panel: vscode.WebviewPanel | undefined;
  private messageHandler: MessageHandler | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly services: WebviewServices = {}
  ) {}

  /** Open the panel (or reveal it) and show the modal UI. */
  revealOrCreate(): void {
    if (this.panel) {
      this.panel.reveal(vscode.ViewColumn.One);
      this.panel.webview.postMessage({ type: 'showModal' });
    } else {
      this._createPanel();
    }
  }

  /** Send an arbitrary message to the webview, if the panel is alive. */
  notifyWebview(message: { type: string; payload?: unknown }): void {
    this.panel?.webview.postMessage(message);
  }

  private _createPanel(): void {
    const panel = vscode.window.createWebviewPanel(
      'apiPilot.panel',
      'API Pilot',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'dist-webview'),
        ],
      }
    );

    this.panel = panel;

    this.messageHandler = new MessageHandler(
      panel.webview,
      this.services.collectionService,
      this.services.envService,
      this.services.historyService,
      this.services.storageService,
      this.services.onCollectionChanged,
      this.services.onHistoryChanged
    );

    panel.webview.onDidReceiveMessage((message) => {
      this.messageHandler?.handle(message);
    });

    panel.onDidDispose(() => {
      this.messageHandler?.dispose();
      this.panel = undefined;
      this.messageHandler = undefined;
    });

    panel.webview.html = this._getHtml(panel.webview);
  }

  private _getHtml(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(this.extensionUri, 'dist-webview');
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(distPath, 'index.js'));
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(distPath, 'index.css'));
    const nonce = getNonce();

    const version = this.services.version ?? '1.0.0';
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data: blob:; media-src ${webview.cspSource} data: blob:; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>API Pilot</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}">var APP_VERSION=${JSON.stringify(version)};var REPO_URL=${JSON.stringify(this.services.repoUrl ?? '')};</script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
