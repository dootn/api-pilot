import { useState, useRef, useEffect, useCallback, memo } from 'react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { useTabStore } from '../../stores/tabStore';
import { useEnvironments } from '../../hooks/useEnvironments';
import { EnvManager } from '../EnvManager/EnvManager';
import { useI18n } from '../../i18n';
import { METHOD_COLORS } from '../../utils/protocolColors';
import { useTabScroll } from './useTabScroll';
import { useTabDnD } from './useTabDnD';
import { TabContextMenu } from './TabContextMenu';

interface ContextMenu {
  tabId: string;
  x: number;
  y: number;
}

interface TabItemProps {
  id: string;
  method: string;
  name: string;
  url: string;
  isCustomNamed: boolean;
  isPinned: boolean;
  isDirty: boolean;
  isActive: boolean;
  canClose: boolean;
  isDragOver: boolean;
  isDragging: boolean;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onContextMenu: (e: React.MouseEvent, id: string) => void;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onDragOver: (e: React.DragEvent, id: string) => void;
  onDrop: (e: React.DragEvent, id: string) => void;
  onDragEnd: () => void;
}

const TabItem = memo(function TabItem({
  id, method, name, url, isCustomNamed, isPinned, isDirty,
  isActive, canClose, isDragOver, isDragging,
  onSelect, onRemove, onContextMenu,
  onDragStart, onDragOver, onDrop, onDragEnd,
}: TabItemProps) {
  const t = useI18n();

  return (
    <div
      data-tab-id={id}
      className={`tabbar-tab${isActive ? ' active' : ''}`}
      onClick={(e) => {
        onSelect(id);
        (e.currentTarget as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' });
      }}
      onContextMenu={(e) => onContextMenu(e, id)}
      draggable={!isPinned}
      onDragStart={(e) => !isPinned && onDragStart(e, id)}
      onDragOver={(e) => onDragOver(e, id)}
      onDrop={(e) => onDrop(e, id)}
      onDragEnd={onDragEnd}
      style={{
        borderLeft: isDragOver && !isDragging ? '2px solid var(--button-bg)' : undefined,
        opacity: isDragging ? 0.4 : 1,
      }}
    >
      <span style={{ fontWeight: 600, fontSize: 10, color: METHOD_COLORS[method] || '#888' }}>
        {method}
      </span>
      {isPinned && (
        <span style={{ fontSize: 9, opacity: 0.7, lineHeight: 1 }} title={t('pinnedHint')}>📌</span>
      )}
      <span className="tabbar-tab-label">
        {isCustomNamed ? name : (url || name)}
      </span>
      {isDirty && (
        <span style={{ color: 'var(--warning-fg)', fontSize: 8 }}>●</span>
      )}
      {canClose && !isPinned && (
        <span
          className="tabbar-tab-close"
          onClick={(e) => { e.stopPropagation(); onRemove(id); }}
          title={t('closeTabHint')}
        >
          ×
        </span>
      )}
    </div>
  );
});

export function TabBar() {
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActiveTabId = useTabStore((s) => s.setActiveTabId);
  const addTab = useTabStore((s) => s.addTab);
  const removeTab = useTabStore((s) => s.removeTab);
  const reorderTabs = useTabStore((s) => s.reorderTabs);
  const pinTab = useTabStore((s) => s.pinTab);
  const duplicateTab = useTabStore((s) => s.duplicateTab);
  const setCompareTabId = useTabStore((s) => s.setCompareTabId);
  const { environments, activeEnvId, switchEnv } = useEnvironments();
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [showEnvDropdown, setShowEnvDropdown] = useState(false);
  const [showEnvManager, setShowEnvManager] = useState(false);
  const [envDropdownPos, setEnvDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const envDropdownRef = useRef<HTMLDivElement>(null);

  const { canScrollLeft, canScrollRight, scrollRef, scrollLeft, scrollRight } = useTabScroll(tabs, activeTabId);
  const { draggingTabId, dragOverTabId, handleDragStart, handleDragOver, handleDrop, handleDragEnd } = useTabDnD(reorderTabs);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);
  const t = useI18n();

  useEffect(() => {
    if (!contextMenu) return;
    window.addEventListener('click', closeContextMenu);
    window.addEventListener('contextmenu', closeContextMenu);
    return () => {
      window.removeEventListener('click', closeContextMenu);
      window.removeEventListener('contextmenu', closeContextMenu);
    };
  }, [contextMenu, closeContextMenu]);

  useClickOutside(envDropdownRef, useCallback(() => { setShowEnvDropdown(false); setEnvDropdownPos(null); }, []), showEnvDropdown);

  const openContextMenu = useCallback((e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ tabId, x: e.clientX, y: e.clientY });
  }, []);

  const contextMenuTab = contextMenu ? tabs.find((t) => t.id === contextMenu.tabId) : null;

  return (
    <>
    <div
      className="border-b"
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--tab-inactive-bg)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', flex: 1, minWidth: 0, alignItems: 'center' }}>
        {canScrollLeft && (
          <button
            onClick={scrollLeft}
            className="icon-btn"
            style={{ padding: '0 5px', flexShrink: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}
            title={t('scrollLeft')}
          >‹</button>
        )}
        <div ref={scrollRef} style={{ display: 'flex', flex: 1, overflow: 'auto', scrollbarWidth: 'none' }}>
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            id={tab.id}
            method={tab.method}
            name={tab.name}
            url={tab.url}
            isCustomNamed={tab.isCustomNamed}
            isPinned={tab.isPinned}
            isDirty={tab.isDirty}
            isActive={tab.id === activeTabId}
            canClose={tabs.length > 1}
            isDragOver={tab.id === dragOverTabId}
            isDragging={tab.id === draggingTabId}
            onSelect={setActiveTabId}
            onRemove={removeTab}
            onContextMenu={openContextMenu}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
        ))}
        </div>
        {canScrollRight && (
          <button
            onClick={scrollRight}
            className="icon-btn"
            style={{ padding: '0 5px', flexShrink: 0, alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}
            title={t('scrollRight')}
          >›</button>
        )}
      </div>


      <button
        onClick={addTab}
        className="icon-btn"
        style={{ padding: '6px 10px', opacity: 0.6, flexShrink: 0 }}
        title="New Request (Ctrl+T)"
      >
        +
      </button>

      {/* Environment selector — top-right, global */}
      <div
        style={{ position: 'relative', flexShrink: 0, borderLeft: '1px solid var(--border-color)' }}
      >
        <button
          className={`env-switcher-btn ${activeEnvId ? 'active' : ''}`}
          onClick={(e) => {
            if (showEnvDropdown) {
              setShowEnvDropdown(false);
              setEnvDropdownPos(null);
            } else {
              const rect = e.currentTarget.getBoundingClientRect();
              setEnvDropdownPos({ top: rect.bottom + 2, right: window.innerWidth - rect.right });
              setShowEnvDropdown(true);
            }
          }}
          title={t('switchEnv')}
          style={{ padding: '5px 10px', borderRadius: 0, border: 'none', maxWidth: 180 }}
        >
          <span className="env-switcher-dot">{activeEnvId ? '●' : '○'}</span>
          <span className="env-switcher-name" style={{ maxWidth: 110 }}>
            {environments.find((e) => e.id === activeEnvId)?.name ?? t('noEnv')}
          </span>
          <span className="env-switcher-caret">▾</span>
        </button>
      </div>

      {contextMenu && contextMenuTab && (
        <TabContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          tab={{ ...contextMenuTab, hasResponse: !!contextMenuTab.response }}
          canClose={tabs.length > 1 && !contextMenuTab.isPinned}
          onPin={() => { pinTab(contextMenuTab.id, !contextMenuTab.isPinned); closeContextMenu(); }}
          onDuplicate={() => { duplicateTab(contextMenuTab.id); closeContextMenu(); }}
          onClose={() => { closeContextMenu(); removeTab(contextMenuTab.id); }}
          onCompare={() => { setCompareTabId(contextMenuTab.id); closeContextMenu(); }}
        />
      )}
    </div>

    {/* Env dropdown rendered outside overflow:hidden as fixed overlay */}
    {showEnvDropdown && envDropdownPos && (
      <div
        ref={envDropdownRef}
        className="env-dropdown"
        style={{ position: 'fixed', top: envDropdownPos.top, right: envDropdownPos.right, left: 'auto' }}
      >
        {environments.map((env) => (
          <div
            key={env.id}
            className={`env-dropdown-item ${env.id === activeEnvId ? 'selected' : ''}`}
            onClick={() => { switchEnv(env.id); setShowEnvDropdown(false); setEnvDropdownPos(null); }}
          >
            <span className={`env-dropdown-dot ${env.id === activeEnvId ? 'active' : ''}`}>
              {env.id === activeEnvId ? '●' : '○'}
            </span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {env.name}
            </span>
            <span style={{ fontSize: 10, opacity: 0.45, marginLeft: 6 }}>
              {env.variables.filter((v) => v.enabled).length}v
            </span>
          </div>
        ))}
        <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
        <div
          className="env-dropdown-item"
          onClick={() => { setShowEnvDropdown(false); setEnvDropdownPos(null); setShowEnvManager(true); }}
        >
          <span style={{ opacity: 0.6 }}>⚙</span>
          {t('manageEnvironments')}
        </div>
      </div>
    )}

    {showEnvManager && <EnvManager onClose={() => setShowEnvManager(false)} />}
    </>
  );
}
