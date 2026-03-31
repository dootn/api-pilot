import * as vscode from 'vscode';
import { MessageHandler } from '../handlers/MessageHandler';
import { CollectionService } from '../services/CollectionService';
import { EnvService } from '../services/EnvService';
import { HistoryService } from '../services/HistoryService';

export interface WebviewServices {
  collectionService?: CollectionService;
  envService?: EnvService;
  historyService?: HistoryService;
  storageService?: import('../services/StorageService').StorageService;
  onCollectionChanged?: () => void;
  onHistoryChanged?: () => void;
}

export class WebviewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'apiPilot.mainPanel';

  private static services: WebviewServices = {};
  private view?: vscode.WebviewView;
  private messageHandler?: MessageHandler;

  constructor(private readonly extensionUri: vscode.Uri, services?: WebviewServices) {
    if (services) {
      WebviewProvider.services = services;
    }
  }

  resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist-webview'),
        vscode.Uri.joinPath(this.extensionUri, 'webview-ui'),
      ],
    };

    this.messageHandler = new MessageHandler(
      webviewView.webview,
      WebviewProvider.services.collectionService,
      WebviewProvider.services.envService,
      WebviewProvider.services.historyService,
      WebviewProvider.services.storageService,
      WebviewProvider.services.onCollectionChanged,
      WebviewProvider.services.onHistoryChanged
    );

    webviewView.webview.onDidReceiveMessage((message) => {
      this.messageHandler?.handle(message);
    });

    webviewView.webview.html = this.getHtmlForWebview(webviewView.webview);

    webviewView.onDidDispose(() => {
      this.messageHandler?.dispose();
    });
  }

  private getHtmlForWebview(webview: vscode.Webview): string {
    const distPath = vscode.Uri.joinPath(this.extensionUri, 'dist-webview');

    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, 'index.js')
    );
    const styleUri = webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, 'index.css')
    );

    const nonce = getNonce();

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
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  public static createPanel(extensionUri: vscode.Uri): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      'apiPilot.panel',
      'API Pilot',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist-webview'),
          vscode.Uri.joinPath(extensionUri, 'webview-ui'),
        ],
      }
    );

    const messageHandler = new MessageHandler(
      panel.webview,
      WebviewProvider.services.collectionService,
      WebviewProvider.services.envService,
      WebviewProvider.services.historyService,
      WebviewProvider.services.storageService,
      WebviewProvider.services.onCollectionChanged,
      WebviewProvider.services.onHistoryChanged
    );

    panel.webview.onDidReceiveMessage((message) => {
      messageHandler.handle(message);
    });

    panel.onDidDispose(() => {
      messageHandler.dispose();
    });

    const distPath = vscode.Uri.joinPath(extensionUri, 'dist-webview');
    const scriptUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, 'index.js')
    );
    const styleUri = panel.webview.asWebviewUri(
      vscode.Uri.joinPath(distPath, 'index.css')
    );
    const nonce = getNonce();

    panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${panel.webview.cspSource} data: blob:; media-src ${panel.webview.cspSource} data: blob:; style-src ${panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${panel.webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>API Pilot</title>
</head>
<body>
  <div id="root"></div>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;

    return panel;
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
