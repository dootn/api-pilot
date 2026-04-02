import { useCallback, useEffect, useRef, useState } from 'react';
import { vscode } from '../../vscode';
import { useVscodeMessage } from '../../hooks/useVscodeMessage';
import { useTabStore } from '../../stores/tabStore';
import { useI18n } from '../../i18n';

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

const METHOD_COLORS: Record<string, string> = {
  GET: '#4ec9b0',
  POST: '#cca700',
  PUT: '#3794ff',
  DELETE: '#f14c4c',
  PATCH: '#c586c0',
  OPTIONS: '#888',
  HEAD: '#888',
};

export function CollectionsSidebar() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: ContextMenuTarget } | null>(null);
  const [draggingCollectionId, setDraggingCollectionId] = useState<string | null>(null);
  const [dragOverCollectionId, setDragOverCollectionId] = useState<string | null>(null);
  const addTabWithData = useTabStore((s) => s.addTabWithData);
  const tabs = useTabStore((s) => s.tabs);
  const setActiveTabId = useTabStore((s) => s.setActiveTabId);
  const menuRef = useRef<HTMLDivElement>(null);
  const t = useI18n();

  // Load collections on mount
  useEffect(() => {
    vscode.postMessage({ type: 'getCollections' });
  }, []);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [contextMenu]);

  const handleMessage = useCallback(
    (msg: { type: string; payload?: unknown }) => {
      if (msg.type === 'collections' || msg.type === 'collectionsChanged') {
        if (msg.type === 'collectionsChanged') {
          vscode.postMessage({ type: 'getCollections' });
        } else {
          setCollections(msg.payload as Collection[]);
        }
      }
    },
    []
  );

  useVscodeMessage(handleMessage);

  const toggleExpanded = (key: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const openRequest = (item: CollectionItem, collectionId: string, forceNewTab = false) => {
    if (item.request) {
      // If a tab for this request is already open and not forcing new tab, switch to it
      const existingTab = tabs.find((t) => t.id === item.request!.id);
      if (existingTab && !forceNewTab) {
        setActiveTabId(existingTab.id);
      } else {
        // Create a new tab (with new id if forceNewTab)
        const requestData = { ...item.request };
        if (forceNewTab) {
          // Create independent copy with new id
          const { id, ...dataWithoutId } = requestData;
          addTabWithData({ ...dataWithoutId });
        } else {
          addTabWithData({ ...(requestData as Parameters<typeof addTabWithData>[0]), collectionId });
        }
      }
    }
  };

  const showContextMenu = (e: React.MouseEvent, target: ContextMenuTarget) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, target });
  };

  const runCmd = (action: () => void) => {
    setContextMenu(null);
    action();
  };

  // Drag and drop handlers for collections
  const handleCollectionDragStart = (e: React.DragEvent, collectionId: string) => {
    setDraggingCollectionId(collectionId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', collectionId);
  };

  const handleCollectionDragOver = (e: React.DragEvent, collectionId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (collectionId !== draggingCollectionId) {
      setDragOverCollectionId(collectionId);
    }
  };

  const handleCollectionDrop = (e: React.DragEvent, targetCollectionId: string) => {
    e.preventDefault();
    if (draggingCollectionId && draggingCollectionId !== targetCollectionId) {
      // Reorder collections
      const fromIdx = collections.findIndex((c) => c.id === draggingCollectionId);
      const toIdx = collections.findIndex((c) => c.id === targetCollectionId);
      if (fromIdx !== -1 && toIdx !== -1) {
        const reordered = [...collections];
        const [moved] = reordered.splice(fromIdx, 1);
        reordered.splice(toIdx, 0, moved);
        setCollections(reordered);
        // Send to backend
        vscode.postMessage({
          type: 'reorderCollections',
          payload: { orderedIds: reordered.map((c) => c.id) },
        });
      }
    }
    setDraggingCollectionId(null);
    setDragOverCollectionId(null);
  };

  const handleCollectionDragEnd = () => {
    setDraggingCollectionId(null);
    setDragOverCollectionId(null);
  };

  const renderItems = (items: CollectionItem[], collectionId: string, depth: number): React.ReactNode => {
    return items.map((item, idx) => {
      const key = `${collectionId}-${depth}-${idx}-${item.name}`;
      if (item.type === 'folder') {
        const expanded = expandedIds.has(key);
        return (
          <div key={key}>
            <div
              className="sidebar-tree-item sidebar-folder"
              style={{ paddingLeft: 8 + depth * 14 }}
              onClick={() => toggleExpanded(key)}
              onContextMenu={(e) =>
                showContextMenu(e, { kind: 'folder', collectionId, folderName: item.name, label: item.name })
              }
            >
              <span className="sidebar-arrow">{expanded ? '▼' : '▶'}</span>
              <span className="sidebar-folder-icon">📂</span>
              <span className="sidebar-item-label">{item.name}</span>
            </div>
            {expanded && item.items && item.items.length > 0 && (
              <div>{renderItems(item.items, collectionId, depth + 1)}</div>
            )}
          </div>
        );
      } else if (item.type === 'request' && item.request) {
        const method = item.request.method || 'GET';
        return (
          <div
            key={key}
            className="sidebar-tree-item sidebar-request"
            style={{ paddingLeft: 8 + depth * 14 }}
            onClick={(e) => {
              const forceNewTab = e.ctrlKey || e.metaKey;
              openRequest(item, collectionId, forceNewTab);
            }}
            title={item.request!.description || item.request!.url || ''}
            onContextMenu={(e) =>
              showContextMenu(e, {
                kind: 'request',
                collectionId,
                requestId: item.request!.id,
                name: item.name,
                method,
              })
            }
          >
            <span className="sidebar-method" style={{ color: METHOD_COLORS[method] || '#888' }}>
              {method}
            </span>
            <span className="sidebar-item-label">{item.name}</span>
          </div>
        );
      }
      return null;
    });
  };

  return (
    <div className="collections-sidebar">
      {/* Header actions */}
      <div className="sidebar-actions">
        <button
          className="sidebar-action-btn"
          title={t('colNewCollectionTitle')}
          onClick={() => vscode.postMessage({ type: 'createCollection' })}
        >
          {t('colNewCollection')}
        </button>
      </div>

      {/* Tree */}
      <div className="sidebar-tree">
        {collections.length === 0 ? (
          <div className="sidebar-empty">{t('colEmpty')}</div>
        ) : (
          collections.map((col) => {
            const expanded = expandedIds.has(col.id);
            return (
              <div key={col.id}>
                <div
                  className="sidebar-tree-item sidebar-collection"
                  onClick={() => toggleExpanded(col.id)}
                  onContextMenu={(e) =>
                    showContextMenu(e, { kind: 'collection', id: col.id, name: col.name })
                  }
                >
                  <span className="sidebar-arrow">{expanded ? '▼' : '▶'}</span>
                  <span className="sidebar-folder-icon">📁</span>
                  <span className="sidebar-item-label">{col.name}</span>
                </div>
                {expanded && <div>{renderItems(col.items, col.id, 1)}</div>}
              </div>
            );
          })
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          className="sidebar-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          {contextMenu.target.kind === 'collection' && (() => {
            const target = contextMenu.target as { kind: 'collection'; id: string; name: string };
            return (
            <>
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
            return (
              <>
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
            // Find the actual request item
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
      )}
    </div>
  );
}
