import { useState } from 'react';

export function useTabDnD(reorderTabs: (fromId: string, toId: string) => void) {
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);

  function handleDragStart(e: React.DragEvent, tabId: string) {
    setDraggingTabId(tabId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', tabId);
  }

  function handleDragOver(e: React.DragEvent, tabId: string) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (tabId !== draggingTabId) setDragOverTabId(tabId);
  }

  function handleDrop(e: React.DragEvent, tabId: string) {
    e.preventDefault();
    if (draggingTabId && draggingTabId !== tabId) {
      reorderTabs(draggingTabId, tabId);
    }
    setDraggingTabId(null);
    setDragOverTabId(null);
  }

  function handleDragEnd() {
    setDraggingTabId(null);
    setDragOverTabId(null);
  }

  return { draggingTabId, dragOverTabId, handleDragStart, handleDragOver, handleDrop, handleDragEnd };
}
