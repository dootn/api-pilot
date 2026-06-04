import React from 'react';
import { vscode } from '../../vscode';
import { useI18n } from '../../i18n';
import { useRunnerStore } from '../../stores/runnerStore';

interface CollectionItem {
  type: 'request' | 'folder';
  name: string;
  request?: {
    id: string;
    name: string;
    description?: string;
    method: string;
    url: string;
    [key: string]: unknown;
  };
  items?: CollectionItem[];
}

interface Collection {
  id: string;
  name: string;
  items: CollectionItem[];
}

type ContextMenuTarget =
  | { kind: 'collection'; id: string; name: string }
  | { kind: 'folder'; collectionId: string; folderName: string; label: string }
  | { kind: 'request'; collectionId: string; requestId: string; name: string; method: string };

interface CollectionContextMenuProps {
  contextMenu: { x: number; y: number; target: ContextMenuTarget };
  menuRef: React.RefObject<HTMLDivElement>;
  collections: Collection[];
  openRequest: (item: CollectionItem, collectionId: string, forceNewTab?: boolean) => void;
  onClose: () => void;
}

export function CollectionContextMenu({ contextMenu, menuRef, collections, openRequest, onClose }: CollectionContextMenuProps) {
  const t = useI18n();

  const runCmd = (action: () => void) => {
    onClose();
    action();
  };

  return (
    <div
      ref={menuRef}
      className="sidebar-context-menu"
      style={{ top: contextMenu.y, left: contextMenu.x }}
    >
      {contextMenu.target.kind === 'collection' && (() => {
        const target = contextMenu.target as { kind: 'collection'; id: string; name: string };
        const collection = collections.find((c) => c.id === target.id);

        const flattenRequests = (items: CollectionItem[], folderPath: string[] = []): Array<{ id: string; name: string; method: string; url: string; folderPath?: string }> => {
          const result: Array<{ id: string; name: string; method: string; url: string; folderPath?: string }> = [];
          for (const item of items) {
            if (item.type === 'request' && item.request) {
              result.push({ id: item.request.id, name: item.request.name, method: item.request.method, url: item.request.url, folderPath: folderPath.length ? folderPath.join(' / ') : undefined });
            } else if (item.type === 'folder' && item.items) {
              result.push(...flattenRequests(item.items, [...folderPath, item.name]));
            }
          }
          return result;
        };

        return (
          <>
            <div
              className="ctx-item"
              onClick={() =>
                runCmd(() => {
                  if (collection) {
                    useRunnerStore.getState().openRunner({
                      id: collection.id,
                      name: collection.name,
                      requests: flattenRequests(collection.items),
                    });
                  }
                })
              }
            >
              {t('ctxRunCollection')}
            </div>
            <div className="ctx-separator" />
            <div
              className="ctx-item"
              onClick={() =>
                runCmd(() =>
                  vscode.postMessage({ type: 'renameCollection', payload: { id: target.id, currentName: target.name } })
                )
              }
            >
              {t('ctxRename')}
            </div>
            <div
              className="ctx-item"
              onClick={() =>
                runCmd(() =>
                  vscode.postMessage({ type: 'addFolder', payload: { collectionId: target.id } })
                )
              }
            >
              {t('ctxAddFolder')}
            </div>
            <div className="ctx-separator" />
            <div
              className="ctx-item ctx-danger"
              onClick={() =>
                runCmd(() =>
                  vscode.postMessage({ type: 'deleteCollection', payload: { id: target.id, name: target.name } })
                )
              }
            >
              {t('ctxDelete')}
            </div>
          </>
        );
      })()}
      {contextMenu.target.kind === 'folder' && (() => {
        const target = contextMenu.target as { collectionId: string; folderName: string; label: string };
        const collection = collections.find((c) => c.id === target.collectionId);

        const findFolderItems = (items: CollectionItem[], folderName: string): CollectionItem[] | null => {
          for (const item of items) {
            if (item.type === 'folder' && item.name === folderName) return item.items ?? [];
            if (item.type === 'folder' && item.items) {
              const found = findFolderItems(item.items, folderName);
              if (found) return found;
            }
          }
          return null;
        };

        const flattenFolderRequests = (items: CollectionItem[], folderPath: string[] = []): Array<{ id: string; name: string; method: string; url: string; folderPath?: string }> => {
          const result: Array<{ id: string; name: string; method: string; url: string; folderPath?: string }> = [];
          for (const item of items) {
            if (item.type === 'request' && item.request) {
              result.push({ id: item.request.id, name: item.request.name, method: item.request.method, url: item.request.url, folderPath: folderPath.length ? folderPath.join(' / ') : undefined });
            } else if (item.type === 'folder' && item.items) {
              result.push(...flattenFolderRequests(item.items, [...folderPath, item.name]));
            }
          }
          return result;
        };

        return (
          <>
            <div className="ctx-item" onClick={() => runCmd(() => {
              if (collection) {
                const folderItems = findFolderItems(collection.items, target.folderName) ?? [];
                const requests = flattenFolderRequests(folderItems, [target.folderName]);
                if (requests.length > 0) {
                  useRunnerStore.getState().openRunner({
                    id: collection.id,
                    name: `${collection.name} / ${target.label}`,
                    requests,
                  });
                }
              }
            })}>
              {t('ctxRunFolder')}
            </div>
            <div className="ctx-separator" />
            <div className="ctx-item" onClick={() => runCmd(() => vscode.postMessage({ type: 'addSubfolder', payload: { collectionId: target.collectionId, parentFolderName: target.folderName } }))}>
              {t('ctxAddSubfolder')}
            </div>
            <div className="ctx-item" onClick={() => runCmd(() => vscode.postMessage({ type: 'renameFolder', payload: { collectionId: target.collectionId, folderName: target.folderName } }))}>
              {t('ctxRename')}
            </div>
            <div className="ctx-item" onClick={() => runCmd(() => vscode.postMessage({ type: 'duplicateFolder', payload: { collectionId: target.collectionId, folderName: target.folderName } }))}>
              {t('ctxDuplicate')}
            </div>
            <div className="ctx-separator" />
            <div className="ctx-item ctx-danger" onClick={() => runCmd(() => vscode.postMessage({ type: 'deleteFolder', payload: { collectionId: target.collectionId, folderName: target.folderName, label: target.label } }))}>
              {t('ctxDelete')}
            </div>
          </>
        );
      })()}
      {contextMenu.target.kind === 'request' && (() => {
        const target = contextMenu.target as { collectionId: string; requestId: string; name: string };
        const findRequest = (items: CollectionItem[]): CollectionItem | null => {
          for (const item of items) {
            if (item.type === 'request' && item.request?.id === target.requestId) return item;
            if (item.type === 'folder' && item.items) {
              const found = findRequest(item.items);
              if (found) return found;
            }
          }
          return null;
        };
        const collection = collections.find((c) => c.id === target.collectionId);
        const requestItem = collection ? findRequest(collection.items) : null;

        return (
          <>
            <div className="ctx-item" onClick={() => runCmd(() => {
              if (requestItem) openRequest(requestItem, target.collectionId, true);
            })}>
              {t('ctxOpenNewTab')}
            </div>
            <div className="ctx-separator" />
            <div className="ctx-item" onClick={() => runCmd(() => vscode.postMessage({ type: 'renameRequest', payload: { collectionId: target.collectionId, requestId: target.requestId, currentName: target.name } }))}>
              {t('ctxRename')}
            </div>
            <div className="ctx-item" onClick={() => runCmd(() => vscode.postMessage({ type: 'duplicateRequest', payload: { collectionId: target.collectionId, requestId: target.requestId } }))}>
              {t('ctxDuplicate')}
            </div>
            <div className="ctx-item" onClick={() => runCmd(() => vscode.postMessage({ type: 'moveRequest', payload: { collectionId: target.collectionId, requestId: target.requestId, name: target.name } }))}>
              {t('ctxMoveTo')}
            </div>
            <div className="ctx-separator" />
            <div className="ctx-item ctx-danger" onClick={() => runCmd(() => vscode.postMessage({ type: 'deleteRequest', payload: { collectionId: target.collectionId, requestId: target.requestId, name: target.name } }))}>
              {t('ctxDelete')}
            </div>
          </>
        );
      })()}
    </div>
  );
}
