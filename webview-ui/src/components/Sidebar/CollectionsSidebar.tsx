import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { vscode } from '../../vscode';
import { useVscodeMessage } from '../../hooks/useVscodeMessage';
import { useTabStore } from '../../stores/tabStore';
import { useI18n } from '../../i18n';
import { METHOD_COLORS } from '../../utils/protocolColors';
import { useCollectionDnD, ItemDragPath } from './useCollectionDnD';
import { CollectionContextMenu } from './CollectionContextMenu';
import { Input } from '../shared/ui';

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

export function CollectionsSidebar() {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; target: ContextMenuTarget } | null>(null);
  const addTabWithData = useTabStore((s) => s.addTabWithData);
  const tabs = useTabStore((s) => s.tabs);
  const setActiveTabId = useTabStore((s) => s.setActiveTabId);
  const menuRef = useRef<HTMLDivElement>(null);
  const t = useI18n();
  const [filterText, setFilterText] = useState('');

  const dnd = useCollectionDnD(collections, setCollections);

  // Load collections on mount
  useEffect(() => {
    vscode.postMessage({ type: 'getCollections' });
  }, []);

  useClickOutside(menuRef, useCallback(() => setContextMenu(null), []), !!contextMenu);

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
          addTabWithData({ ...dataWithoutId } as Parameters<typeof addTabWithData>[0]);
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

  const lowerFilter = filterText.toLowerCase().trim();

  const visibleCollections = useMemo(() => {
    if (!lowerFilter) return collections;

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

    return collections.flatMap((col) => {
      const filteredItems = filterItems(col.items);
      const nameMatches = col.name.toLowerCase().includes(lowerFilter);
      if (nameMatches || filteredItems.length > 0) {
        return [{ ...col, items: filteredItems }];
      }
      return [];
    });
  }, [collections, lowerFilter]);

  const renderItems = (items: CollectionItem[], collectionId: string, depth: number, folderPath: string[] = []): React.ReactNode => {
    const folderPathKey = folderPath.join('/');
    const dragOverFolderKey = dnd.dragOverItem?.folderPath?.join('/') ?? '';
    const draggingFolderKey = dnd.draggingItem?.folderPath?.join('/') ?? '';
    return items.map((item, idx) => {
      const key = `${collectionId}-${depth}-${idx}-${item.name}`;
      const itemPath: ItemDragPath = { collectionId, folderPath, index: idx, isFolderItem: item.type === 'folder', itemName: item.name };
      const isBeforeIndicator =
        dnd.dragOverItem?.collectionId === collectionId &&
        dragOverFolderKey === folderPathKey &&
        dnd.dragOverItem?.index === idx &&
        dnd.dragOverItemPos === 'before';
      const isAfterIndicator =
        dnd.dragOverItem?.collectionId === collectionId &&
        dragOverFolderKey === folderPathKey &&
        dnd.dragOverItem?.index === idx &&
        dnd.dragOverItemPos === 'after';
      const isIntoIndicator =
        dnd.dragOverItem?.collectionId === collectionId &&
        dragOverFolderKey === folderPathKey &&
        dnd.dragOverItem?.index === idx &&
        dnd.dragOverItemPos === 'into';
      const isDraggingThis =
        dnd.draggingItem?.collectionId === collectionId &&
        draggingFolderKey === folderPathKey &&
        dnd.draggingItem?.index === idx;
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
              onDragStart={(e) => dnd.handleItemDragStart(e, itemPath)}
              onDragOver={(e) => dnd.handleItemDragOver(e, itemPath)}
              onDrop={(e) => dnd.handleItemDrop(e, itemPath, setExpandedIds)}
              onDragEnd={dnd.handleItemDragEnd}
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
            onDragStart={(e) => dnd.handleItemDragStart(e, itemPath)}
            onDragOver={(e) => dnd.handleItemDragOver(e, itemPath)}
            onDrop={(e) => dnd.handleItemDrop(e, itemPath, setExpandedIds)}
            onDragEnd={dnd.handleItemDragEnd}
            onClick={(e) => {
              if (dnd.draggingItem) return;
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
      <div className="border-b" style={{ padding: '4px 8px' }}>
        <Input
          inputSize="sm"
          fullWidth
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder={t('sidebarFilter')}
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
              dnd.draggingCollectionId === col.id ? 'dragging' : '',
              dnd.dragOverCollectionId === col.id && dnd.dragOverColPos === 'before' ? 'drag-indicator-before' : '',
              dnd.dragOverCollectionId === col.id && dnd.dragOverColPos === 'after' ? 'drag-indicator-after' : '',
              dnd.itemDragOverCollectionId === col.id ? 'drag-indicator-into' : '',
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
                  onDragStart={(e) => dnd.handleCollectionDragStart(e, col.id)}
                  onDragOver={(e) => dnd.handleCollectionDragOver(e, col.id)}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      dnd.setItemDragOverCollectionId(null);
                    }
                  }}
                  onDrop={(e) => dnd.handleCollectionDrop(e, col.id)}
                  onDragEnd={dnd.handleCollectionDragEnd}
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
        <CollectionContextMenu
          contextMenu={contextMenu}
          menuRef={menuRef as React.RefObject<HTMLDivElement>}
          collections={collections}
          openRequest={openRequest}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
