import * as vscode from 'vscode';
import { CollectionService } from '../services/CollectionService';
import { Collection, CollectionItem } from '../types';

export class CollectionTreeProvider implements vscode.TreeDataProvider<CollectionTreeItem> {
  private _onDidChangeTreeData = new vscode.EventEmitter<CollectionTreeItem | undefined | void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

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
            item.items
          );
        } else {
          const req = item.request;
          const method = req?.method || 'GET';
          const label = item.name || `${method} ${req?.url || ''}`;
          return new CollectionTreeItem(
            label,
            vscode.TreeItemCollapsibleState.None,
            'request',
            req?.id,
            undefined,
            undefined,
            req ? JSON.stringify(req) : undefined
          );
        }
      })
    );
  }
}

export class CollectionTreeItem extends vscode.TreeItem {
  public collectionData?: Collection;
  public folderItems?: CollectionItem[];

  constructor(
    public readonly label: string,
    public readonly collapsibleState: vscode.TreeItemCollapsibleState,
    public readonly itemType: 'collection' | 'folder' | 'request' | 'placeholder',
    public readonly itemId?: string,
    collectionData?: Collection,
    folderItems?: CollectionItem[],
    private requestData?: string
  ) {
    super(label, collapsibleState);
    this.collectionData = collectionData;
    this.folderItems = folderItems;
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
      case 'request':
        this.iconPath = new vscode.ThemeIcon('symbol-event');
        if (requestData) {
          this.command = {
            command: 'apiPilot.openRequest',
            title: 'Open Request',
            arguments: [requestData],
          };
        }
        break;
      case 'placeholder':
        this.iconPath = new vscode.ThemeIcon('info');
        break;
    }
  }
}
