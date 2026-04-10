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
  DELETE: '#f44747',
  PATCH: '#c586c0',
  OPTIONS: '#888',
  HEAD: '#888',
  WS:   'var(--vscode-terminal-ansiCyan, #4ec9b0)',
  SSE:  'var(--vscode-terminal-ansiYellow, #dcdcaa)',
  MQTT: 'var(--vscode-terminal-ansiMagenta, #c586c0)',
  gRPC: 'var(--vscode-terminal-ansiBlue, #569cd6)',
};

export function CollectionsSidebar() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: ContextMenuTarget } | null>(null);
  const [draggingCollectionId, setDraggingCollectionId] = useState<string | null>(null);
  const [dragOverCollectionId, setDragOverCollectionId] = useState<string | null>(null);
  const [dragOverColPos, setDragOverColPos] = useState<'before' | 'after'>('before');
  interface ItemDragPath { collectionId: string; folderPath: string[]; index: number; isFolderItem?: boolean; itemName?: string; }
  const [draggingItem, setDraggingItem] = useState<ItemDragPath | null>(null);
  const [dragOverItem, setDragOverItem] = useState<ItemDragPath | null>(null);
  const [dragOverItemPos, setDragOverItemPos] = useState<'before' | 'after' | 'into'>('before');
  const [itemDragOverCollectionId, setItemDragOverCollectionId] = useState<string | null>(null);
  const addTabWithData = useTabStore((s) => s.addTabWithData);
  const tabs = useTabStore((s) => s.tabs);
  const setActiveTabId = useTabStore((s) => s.setActiveTabId);
  const menuRef = useRef<HTMLDivElement>(null);
  const t = useI18n();
  const [filterText, setFilterText] = useState('');

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
    if (draggingItem) {
      // An item is being dragged — allow dropping onto collection header
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = 'move';
      setItemDragOverCollectionId(collectionId);
      return;
    }
    if (!draggingCollectionId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (collectionId !== draggingCollectionId) {
      setDragOverCollectionId(collectionId);
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      setDragOverColPos(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
    }
  };

  const handleCollectionDrop = (e: React.DragEvent, targetCollectionId: string) => {
    e.preventDefault();
    // Item drag onto collection header — append to end of collection
    if (draggingItem) {
      const source = { ...draggingItem };
      setCollections((prev) => {
        const next = JSON.parse(JSON.stringify(prev)) as Collection[];
        const sourceCol = next.find((c) => c.id === source.collectionId);
        if (!sourceCol) return prev;
        let sourceItems = sourceCol.items;
        for (const fn of source.folderPath) {
          const f = sourceItems.find((it) => it.type === 'folder' && it.name === fn);
          if (!f || !f.items) return prev;
          sourceItems = f.items;
        }
        if (source.index < 0 || source.index >= sourceItems.length) return prev;
        const [moved] = sourceItems.splice(source.index, 1);
        const targetCol = next.find((c) => c.id === targetCollectionId);
        if (!targetCol) return prev;
        targetCol.items.push(moved);
        return next;
      });
      vscode.postMessage({
        type: 'reorderCollectionItems',
        payload: {
          sourceCollectionId: source.collectionId,
          sourceFolderPath: source.folderPath,
          sourceIndex: source.index,
          targetCollectionId,
          targetFolderPath: [],
          targetIndex: 999,
        },
      });
      setDraggingItem(null);
      setDragOverItem(null);
      setItemDragOverCollectionId(null);
      return;
    }
    if (draggingCollectionId && draggingCollectionId !== targetCollectionId) {
      const fromIdx = collections.findIndex((c) => c.id === draggingCollectionId);
      const toIdx = collections.findIndex((c) => c.id === targetCollectionId);
      if (fromIdx !== -1 && toIdx !== -1) {
        const rawInsert = dragOverColPos === 'before' ? toIdx : toIdx + 1;
        const adjustedIdx = fromIdx < rawInsert ? rawInsert - 1 : rawInsert;
        if (fromIdx !== adjustedIdx) {
          const reordered = [...collections];
          const [moved] = reordered.splice(fromIdx, 1);
          reordered.splice(adjustedIdx, 0, moved);
          setCollections(reordered);
          vscode.postMessage({
            type: 'reorderCollections',
            payload: { orderedIds: reordered.map((c) => c.id) },
          });
        }
      }
    }
    setDraggingCollectionId(null);
    setDragOverCollectionId(null);
  };

  const handleCollectionDragEnd = () => {
    setDraggingCollectionId(null);
    setDragOverCollectionId(null);
    setItemDragOverCollectionId(null);
  };

  // Drag and drop handlers for items within collections
  const handleItemDragStart = (e: React.DragEvent, itemPath: ItemDragPath) => {
    e.stopPropagation();
    setDraggingItem(itemPath);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleItemDragOver = (e: React.DragEvent, itemPath: ItemDragPath) => {
    if (!draggingItem) return;
    const isSelf =
      itemPath.collectionId === draggingItem.collectionId &&
      JSON.stringify(itemPath.folderPath) === JSON.stringify(draggingItem.folderPath) &&
      itemPath.index === draggingItem.index;
    if (isSelf) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    setDragOverItem(itemPath);
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (itemPath.isFolderItem) {
      // 3-zone: top 30% = before, middle 40% = into, bottom 30% = after
      const ratio = (e.clientY - rect.top) / rect.height;
      setDragOverItemPos(ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'into');
    } else {
      setDragOverItemPos(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
    }
  };

  const handleItemDrop = (e: React.DragEvent, targetPath: ItemDragPath) => {
    e.preventDefault();
    e.stopPropagation();
    if (!draggingItem) return;

    const isSelf =
      targetPath.collectionId === draggingItem.collectionId &&
      JSON.stringify(targetPath.folderPath) === JSON.stringify(draggingItem.folderPath) &&
      targetPath.index === draggingItem.index;
    if (isSelf) {
      setDraggingItem(null);
      setDragOverItem(null);
      return;
    }

    const isSameParent =
      targetPath.collectionId === draggingItem.collectionId &&
      JSON.stringify(targetPath.folderPath) === JSON.stringify(draggingItem.folderPath);

    const sourceIndex = draggingItem.index;

    // 'into' means append inside the target folder
    if (dragOverItemPos === 'into' && targetPath.isFolderItem && targetPath.itemName) {
      const targetFolderPath = [...targetPath.folderPath, targetPath.itemName];
      setCollections((prev) => {
        const next = JSON.parse(JSON.stringify(prev)) as Collection[];
        const sourceCol = next.find((c) => c.id === draggingItem.collectionId);
        if (!sourceCol) return prev;
        let sourceItems = sourceCol.items;
        for (const fn of draggingItem.folderPath) {
          const f = sourceItems.find((it) => it.type === 'folder' && it.name === fn);
          if (!f || !f.items) return prev;
          sourceItems = f.items;
        }
        if (sourceIndex < 0 || sourceIndex >= sourceItems.length) return prev;
        const [moved] = sourceItems.splice(sourceIndex, 1);
        const targetCol = next.find((c) => c.id === targetPath.collectionId);
        if (!targetCol) return prev;
        let targetItems = targetCol.items;
        for (const fn of targetFolderPath) {
          const f = targetItems.find((it) => it.type === 'folder' && it.name === fn);
          if (!f || !f.items) { f && (f.items = []); if (f) targetItems = f.items!; else return prev; }
          else targetItems = f.items;
        }
        targetItems.push(moved);
        return next;
      });
      // Auto-expand the target folder
      const depthOfFolder = targetPath.folderPath.length + 1;
      const folderKey = `${targetPath.collectionId}-${depthOfFolder}-${targetPath.index}-${targetPath.itemName}`;
      setExpandedIds((prev) => { const next = new Set(prev); next.add(folderKey); return next; });
      vscode.postMessage({
        type: 'reorderCollectionItems',
        payload: {
          sourceCollectionId: draggingItem.collectionId,
          sourceFolderPath: draggingItem.folderPath,
          sourceIndex,
          targetCollectionId: targetPath.collectionId,
          targetFolderPath,
          targetIndex: 999,
        },
      });
      setDraggingItem(null);
      setDragOverItem(null);
      return;
    }

    const rawInsert = dragOverItemPos === 'before' ? targetPath.index : targetPath.index + 1;
    const targetIndex = isSameParent && sourceIndex < rawInsert ? rawInsert - 1 : rawInsert;

    if (isSameParent && sourceIndex === targetIndex) {
      setDraggingItem(null);
      setDragOverItem(null);
      return;
    }

    const source = { ...draggingItem };
    const target = { collectionId: targetPath.collectionId, folderPath: targetPath.folderPath, index: targetIndex };

    setCollections((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as Collection[];

      // Navigate to source items
      const sourceCol = next.find((c) => c.id === source.collectionId);
      if (!sourceCol) return prev;
      let sourceItems = sourceCol.items;
      for (const fn of source.folderPath) {
        const f = sourceItems.find((it) => it.type === 'folder' && it.name === fn);
        if (!f || !f.items) return prev;
        sourceItems = f.items;
      }
      if (source.index < 0 || source.index >= sourceItems.length) return prev;

      const [moved] = sourceItems.splice(source.index, 1);

      // Navigate to target items
      const targetCol = next.find((c) => c.id === target.collectionId);
      if (!targetCol) return prev;
      let targetItems = targetCol.items;
      for (const fn of target.folderPath) {
        const f = targetItems.find((it) => it.type === 'folder' && it.name === fn);
        if (!f || !f.items) return prev;
        targetItems = f.items;
      }

      const insertIdx = Math.min(target.index, targetItems.length);
      targetItems.splice(insertIdx, 0, moved);
      return next;
    });

    vscode.postMessage({
      type: 'reorderCollectionItems',
      payload: {
        sourceCollectionId: source.collectionId,
        sourceFolderPath: source.folderPath,
        sourceIndex: source.index,
        targetCollectionId: target.collectionId,
        targetFolderPath: target.folderPath,
        targetIndex: target.index,
      },
    });

    setDraggingItem(null);
    setDragOverItem(null);
  };

  const handleItemDragEnd = () => {
    setDraggingItem(null);
    setDragOverItem(null);
    setItemDragOverCollectionId(null);
  };

  const lowerFilter = filterText.toLowerCase().trim();

  function filterItems(items: CollectionItem[]): CollectionItem[] {
    return items.flatMap((item) => {
      if (item.type === 'request') {
        const matches =
          item.name.toLowerCase().includes(lowerFilter) ||
          (item.request?.url ?? '').toLowerCase().includes(lowerFilter);
        return matches ? [item] : [];
      }
      if (item.type === 'folder') {
        const filteredChildren = filterItems(item.items ?? []);
        const nameMatches = item.name.toLowerCase().includes(lowerFilter);
        if (filteredChildren.length > 0 || nameMatches) {
          return [{ ...item, items: filteredChildren }];
        }
        return [];
      }
      return [];
    });
  }

  const visibleCollections = lowerFilter
    ? collections.flatMap((col) => {
        const filteredItems = filterItems(col.items);
        const nameMatches = col.name.toLowerCase().includes(lowerFilter);
        if (nameMatches || filteredItems.length > 0) {
          return [{ ...col, items: filteredItems }];
        }
        return [];
      })
    : collections;

  const renderItems = (items: CollectionItem[], collectionId: string, depth: number, folderPath: string[] = []): React.ReactNode => {
    return items.map((item, idx) => {
      const key = `${collectionId}-${depth}-${idx}-${item.name}`;
      const itemPath: ItemDragPath = { collectionId, folderPath, index: idx, isFolderItem: item.type === 'folder', itemName: item.name };
      const folderPathKey = JSON.stringify(folderPath);
      const dragOverFolderKey = JSON.stringify(dragOverItem?.folderPath);
      const draggingFolderKey = JSON.stringify(draggingItem?.folderPath);
      const isBeforeIndicator =
        dragOverItem?.collectionId === collectionId &&
        dragOverFolderKey === folderPathKey &&
        dragOverItem?.index === idx &&
        dragOverItemPos === 'before';
      const isAfterIndicator =
        dragOverItem?.collectionId === collectionId &&
        dragOverFolderKey === folderPathKey &&
        dragOverItem?.index === idx &&
        dragOverItemPos === 'after';
      const isIntoIndicator =
        dragOverItem?.collectionId === collectionId &&
        dragOverFolderKey === folderPathKey &&
        dragOverItem?.index === idx &&
        dragOverItemPos === 'into';
      const isDraggingThis =
        draggingItem?.collectionId === collectionId &&
        draggingFolderKey === folderPathKey &&
        draggingItem?.index === idx;
      if (item.type === 'folder') {
        const expanded = lowerFilter ? true : expandedIds.has(key);
        const folderClass = [
          'sidebar-tree-item sidebar-folder',
          isDraggingThis ? 'dragging' : '',
          isBeforeIndicator ? 'drag-indicator-before' : '',
          isAfterIndicator ? 'drag-indicator-after' : '',
          isIntoIndicator ? 'drag-indicator-into' : '',
        ].filter(Boolean).join(' ');
        return (
          <div key={key}>
            <div
              className={folderClass}
              style={{ paddingLeft: 8 + depth * 14 }}
              draggable
              onClick={() => toggleExpanded(key)}
              onContextMenu={(e) =>
                showContextMenu(e, { kind: 'folder', collectionId, folderName: item.name, label: item.name })
              }
              onDragStart={(e) => handleItemDragStart(e, itemPath)}
              onDragOver={(e) => handleItemDragOver(e, itemPath)}
              onDrop={(e) => handleItemDrop(e, itemPath)}
              onDragEnd={handleItemDragEnd}
            >
              <span className="sidebar-arrow">{expanded ? '▼' : '▶'}</span>
              <span className="sidebar-folder-icon">📂</span>
              <span className="sidebar-item-label">{item.name}</span>
            </div>
            {expanded && item.items && item.items.length > 0 && (
              <div>{renderItems(item.items, collectionId, depth + 1, [...folderPath, item.name])}</div>
            )}
          </div>
        );
      } else if (item.type === 'request' && item.request) {
        const protocol = item.request.protocol as string | undefined;
        const rawMethod = item.request.method || 'GET';
        const method = protocol === 'websocket' ? 'WS'
          : protocol === 'sse' ? 'SSE'
          : protocol === 'mqtt' ? 'MQTT'
          : protocol === 'grpc' ? 'gRPC'
          : rawMethod;
        const requestClass = [
          'sidebar-tree-item sidebar-request',
          isDraggingThis ? 'dragging' : '',
          isBeforeIndicator ? 'drag-indicator-before' : '',
          isAfterIndicator ? 'drag-indicator-after' : '',
        ].filter(Boolean).join(' ');
        return (
          <div
            key={key}
            className={requestClass}
            style={{ paddingLeft: 8 + depth * 14 }}
            draggable
            onDragStart={(e) => handleItemDragStart(e, itemPath)}
            onDragOver={(e) => handleItemDragOver(e, itemPath)}
            onDrop={(e) => handleItemDrop(e, itemPath)}
            onDragEnd={handleItemDragEnd}
            onClick={(e) => {
              if (draggingItem) return;
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

      {/* Filter input */}
      <div style={{ padding: '4px 8px', borderBottom: '1px solid var(--border-color)' }}>
        <input
          type="text"
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder={t('sidebarFilter')}
          style={{
            width: '100%',
            padding: '4px 8px',
            fontSize: 11,
            background: 'var(--input-bg)',
            color: 'var(--input-fg)',
            border: '1px solid var(--input-border)',
            borderRadius: 4,
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Tree */}
      <div className="sidebar-tree">
        {visibleCollections.length === 0 ? (
          <div className="sidebar-empty">{t('colEmpty')}</div>
        ) : (
          visibleCollections.map((col) => {
            const expanded = lowerFilter ? true : expandedIds.has(col.id);
            const colClass = [
              'sidebar-tree-item sidebar-collection',
              draggingCollectionId === col.id ? 'dragging' : '',
              dragOverCollectionId === col.id && dragOverColPos === 'before' ? 'drag-indicator-before' : '',
              dragOverCollectionId === col.id && dragOverColPos === 'after' ? 'drag-indicator-after' : '',
              itemDragOverCollectionId === col.id ? 'drag-indicator-into' : '',
            ].filter(Boolean).join(' ');
            return (
              <div key={col.id}>
                <div
                  className={colClass}
                  draggable={!lowerFilter}
                  onClick={() => toggleExpanded(col.id)}
                  onContextMenu={(e) =>
                    showContextMenu(e, { kind: 'collection', id: col.id, name: col.name })
                  }
                  onDragStart={(e) => handleCollectionDragStart(e, col.id)}
                  onDragOver={(e) => handleCollectionDragOver(e, col.id)}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      setItemDragOverCollectionId(null);
                    }
                  }}
                  onDrop={(e) => handleCollectionDrop(e, col.id)}
                  onDragEnd={handleCollectionDragEnd}
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
