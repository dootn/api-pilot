import { useState } from 'react';
import { vscode } from '../../vscode';

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

export interface ItemDragPath {
  collectionId: string;
  folderPath: string[];
  index: number;
  isFolderItem?: boolean;
  itemName?: string;
}

export function useCollectionDnD(
  collections: Collection[],
  setCollections: React.Dispatch<React.SetStateAction<Collection[]>>
) {
  const [draggingCollectionId, setDraggingCollectionId] = useState<string | null>(null);
  const [dragOverCollectionId, setDragOverCollectionId] = useState<string | null>(null);
  const [dragOverColPos, setDragOverColPos] = useState<'before' | 'after'>('before');
  const [draggingItem, setDraggingItem] = useState<ItemDragPath | null>(null);
  const [dragOverItem, setDragOverItem] = useState<ItemDragPath | null>(null);
  const [dragOverItemPos, setDragOverItemPos] = useState<'before' | 'after' | 'into'>('before');
  const [itemDragOverCollectionId, setItemDragOverCollectionId] = useState<string | null>(null);

  // Collection-level drag handlers
  const handleCollectionDragStart = (e: React.DragEvent, collectionId: string) => {
    setDraggingCollectionId(collectionId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', collectionId);
  };

  const handleCollectionDragOver = (e: React.DragEvent, collectionId: string) => {
    if (draggingItem) {
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

  // Item-level drag handlers
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
      const ratio = (e.clientY - rect.top) / rect.height;
      setDragOverItemPos(ratio < 0.3 ? 'before' : ratio > 0.7 ? 'after' : 'into');
    } else {
      setDragOverItemPos(e.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
    }
  };

  const handleItemDrop = (e: React.DragEvent, targetPath: ItemDragPath, setExpandedIds: React.Dispatch<React.SetStateAction<Set<string>>>) => {
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

  return {
    draggingCollectionId,
    dragOverCollectionId,
    dragOverColPos,
    draggingItem,
    dragOverItem,
    dragOverItemPos,
    itemDragOverCollectionId,
    setItemDragOverCollectionId,
    handleCollectionDragStart,
    handleCollectionDragOver,
    handleCollectionDrop,
    handleCollectionDragEnd,
    handleItemDragStart,
    handleItemDragOver,
    handleItemDrop,
    handleItemDragEnd,
  };
}
