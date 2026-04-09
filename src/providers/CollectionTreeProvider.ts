import * as vscode from 'vscode';
import { CollectionService } from '../services/CollectionService';
import { Collection, CollectionItem } from '../types';

const DRAG_MIME_TYPE = 'application/vnd.code.tree.apiPilotCollection';

export class CollectionTreeProvider 
  implements 
    vscode.TreeDataProvider<CollectionTreeItem>,
    vscode.TreeDragAndDropController<CollectionTreeItem> {
  
  private _onDidChangeTreeData = new vscode.EventEmitter<CollectionTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  // Drag and drop configuration
  readonly dragMimeTypes = [DRAG_MIME_TYPE];
  readonly dropMimeTypes = [DRAG_MIME_TYPE];

  constructor(private collectionService: CollectionService) {}

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: CollectionTreeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: CollectionTreeItem): Thenable<CollectionTreeItem[]> {
    if (!element) {
      // Root level — show collections
      const collections = this.collectionService.getAll();
      if (collections.length === 0) {
        return Promise.resolve([
          new CollectionTreeItem(
            'No collections yet. Click + to create one.',
            vscode.TreeItemCollapsibleState.None,
            'placeholder'
          ),
        ]);
      }
      return Promise.resolve(
        collections.map(
          (col) =>
            new CollectionTreeItem(
              col.name,
              col.items.length > 0
                ? vscode.TreeItemCollapsibleState.Expanded
                : vscode.TreeItemCollapsibleState.Collapsed,
              'collection',
              col.id,
              col
            )
        )
      );
    }

    // Children of a collection or folder
    const items = element.collectionData?.items || element.folderItems || [];
    const parentCollectionId = element.itemType === 'collection'
      ? element.itemId
      : element.collectionId;

    return Promise.resolve(
      items.map((item) => {
        if (item.type === 'folder') {
          return new CollectionTreeItem(
            item.name,
            (item.items?.length ?? 0) > 0
              ? vscode.TreeItemCollapsibleState.Expanded
              : vscode.TreeItemCollapsibleState.Collapsed,
            'folder',
            item.name,
            undefined,
            item.items,
            undefined,
            parentCollectionId
          );
        } else {
          const req = item.request;
          const protocol = req?.protocol as string | undefined;
          const rawMethod = req?.method || 'GET';
          const method = protocol === 'websocket' ? 'WS'
            : protocol === 'sse' ? 'SSE'
            : protocol === 'mqtt' ? 'MQTT'
            : rawMethod;
          // Strip HTTP method prefix from auto-generated names for clean display
          const rawName = item.name || req?.url || 'Unnamed Request';
          const methodPrefix = `${method} `;
          const displayName = rawName.startsWith(methodPrefix)
            ? rawName.slice(methodPrefix.length) || rawName
            : rawName;
          // Display method name with label
          const displayLabel = `${method} ${displayName}`;
          return new CollectionTreeItem(
            displayLabel,
            vscode.TreeItemCollapsibleState.None,
            'request',
            req?.id,
            undefined,
            undefined,
            req ? JSON.stringify(req) : undefined,
            parentCollectionId,
            method
          );
        }
      })
    );
  }

  // Handle drag operation - store dragged item info
  async handleDrag(
    source: readonly CollectionTreeItem[],
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken
  ): Promise<void> {
    // Only support single-item drag for now
    if (source.length !== 1) return;
    
    const item = source[0];
    
    // Don't allow dragging collections or placeholder items
    if (item.itemType === 'collection' || item.itemType === 'placeholder') {
      return;
    }

    // Store drag data
    const dragData = {
      itemType: item.itemType,
      itemId: item.itemId,
      collectionId: item.collectionId,
      label: item.label
    };

    dataTransfer.set(DRAG_MIME_TYPE, new vscode.DataTransferItem(dragData));
  }

  // Handle drop operation - move item to new location
  async handleDrop(
    target: CollectionTreeItem | undefined,
    dataTransfer: vscode.DataTransfer,
    _token: vscode.CancellationToken
  ): Promise<void> {
    const transferItem = dataTransfer.get(DRAG_MIME_TYPE);
    if (!transferItem) return;

    const dragData = transferItem.value as {
      itemType: 'request' | 'folder';
      itemId: string | undefined;
      collectionId: string | undefined;
      label: string;
    };

    if (!dragData.itemId || !dragData.collectionId) return;

    // Determine target collection and folder
    let targetCollectionId: string | undefined;
    let targetFolderId: string | undefined;

    if (!target) {
      // Dropped on root - not allowed
      vscode.window.showWarningMessage('Please drop on a collection or folder');
      return;
    }

    if (target.itemType === 'collection') {
      targetCollectionId = target.itemId;
      targetFolderId = undefined;
    } else if (target.itemType === 'folder') {
      targetCollectionId = target.collectionId;
      targetFolderId = target.itemId;
    } else if (target.itemType === 'request') {
      // Drop on a request means drop in the same container as that request
      targetCollectionId = target.collectionId;
      targetFolderId = undefined; // TODO: Could detect the parent folder
    } else {
      return;
    }

    if (!targetCollectionId) return;

    // Prevent dropping a folder into itself or its descendants
    if (dragData.itemType === 'folder' && targetFolderId === dragData.itemId) {
      vscode.window.showWarningMessage('Cannot move a folder into itself');
      return;
    }

    // Perform the move
    const success = this.collectionService.moveItem(
      dragData.collectionId,
      dragData.itemId,
      dragData.itemType,
      targetCollectionId,
      targetFolderId
    );

    if (success) {
      this.refresh();
      vscode.window.showInformationMessage(
        `Moved ${dragData.itemType} "${dragData.label}" successfully`
      );
    } else {
      vscode.window.showErrorMessage(`Failed to move ${dragData.itemType}`);
    }
  }
}

export class CollectionTreeItem extends vscode.TreeItem {
  public collectionData?: Collection;
  public folderItems?: CollectionItem[];
  public collectionId?: string;

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: 'collection' | 'folder' | 'request' | 'placeholder',
    public readonly itemId?: string,
    collectionData?: Collection,
    folderItems?: CollectionItem[],
    private requestData?: string,
    collectionId?: string,
    method?: string
  ) {
    super(label, collapsibleState);
    this.collectionData = collectionData;
    this.folderItems = folderItems;
    this.collectionId = collectionId;
    this.contextValue = itemType;

    switch (itemType) {
      case 'collection':
        this.iconPath = new vscode.ThemeIcon('folder-library');
        this.description = collectionData
          ? `${collectionData.items.length} items`
          : '';
        break;
      case 'folder':
        this.iconPath = new vscode.ThemeIcon('folder');
        break;
      case 'request': {
        const resolvedMethod = method || 'GET';
        // Remove icon, method name is now part of the label
        // this.iconPath = new vscode.ThemeIcon(
        //   'circle-filled',
        //   new vscode.ThemeColor(methodColor(resolvedMethod))
        // );
        // this.description = resolvedMethod;
        if (requestData) {
          this.command = {
            command: 'apiPilot.openRequest',
            title: 'Open Request',
            arguments: [requestData, collectionId],
          };
        }
        break;
      }
      case 'placeholder':
        this.iconPath = new vscode.ThemeIcon('info');
        break;
    }
  }
}

/** Map HTTP method to a VS Code ThemeColor id (Postman-style palette) */
function methodColor(method: string): string {
  switch (method.toUpperCase()) {
    case 'GET':     return 'charts.green';
    case 'POST':    return 'charts.orange';
    case 'PUT':     return 'charts.blue';
    case 'DELETE':  return 'charts.red';
    case 'PATCH':   return 'charts.purple';
    case 'OPTIONS': return 'charts.yellow';
    default:        return 'charts.foreground';
  }
}
