import { useState, useRef, useEffect, useCallback } from 'react';
import { useTabStore } from '../../stores/tabStore';
import { useEnvironments } from '../../hooks/useEnvironments';
import { EnvManager } from '../EnvManager/EnvManager';
import { useI18n } from '../../i18n';

const METHOD_COLORS: Record<string, string> = {
  GET: '#4ec9b0',
  POST: '#cca700',
  PUT: '#3794ff',
  DELETE: '#f14c4c',
  PATCH: '#c586c0',
  OPTIONS: '#888',
  HEAD: '#888',
};

interface ContextMenu {
  tabId: string;
  x: number;
  y: number;
}

export function TabBar() {
  const { tabs, activeTabId, setActiveTabId, addTab, removeTab, reorderTabs, pinTab, duplicateTab, updateTab } = useTabStore();
  const { environments, activeEnvId, switchEnv } = useEnvironments();
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [showEnvDropdown, setShowEnvDropdown] = useState(false);
  const [showEnvManager, setShowEnvManager] = useState(false);
  const [envDropdownPos, setEnvDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const envDropdownRef = useRef<HTMLDivElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const updateScrollState = useCallback(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    el.addEventListener('scroll', updateScrollState);
    const ro = new ResizeObserver(updateScrollState);
    ro.observe(el);
    updateScrollState();
    return () => {
      el.removeEventListener('scroll', updateScrollState);
      ro.disconnect();
    };
  }, [updateScrollState]);


  useEffect(() => { updateScrollState(); }, [tabs, updateScrollState]);

  // Scroll the active tab into the visible area of the tab bar
  useEffect(() => {
    const container = tabsScrollRef.current;
    if (!container) return;
    const activeEl = container.querySelector<HTMLElement>(`[data-tab-id="${activeTabId}"]`);
    if (!activeEl) return;
    // scrollIntoView with inline:'nearest' avoids over-scrolling
    activeEl.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeTabId]);

  useEffect(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (e.deltaY !== 0) {
        e.preventDefault();
        el.scrollLeft += e.deltaY;
      }
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);


  useEffect(() => {
    if (!contextMenu) return;
    window.addEventListener('click', closeContextMenu);
    window.addEventListener('contextmenu', closeContextMenu);
    return () => {
      window.removeEventListener('click', closeContextMenu);
      window.removeEventListener('contextmenu', closeContextMenu);
    };
  }, [contextMenu, closeContextMenu]);

  // Close env dropdown when clicking outside
  useEffect(() => {
    if (!showEnvDropdown) return;
    const close = (e: MouseEvent) => {
      if (envDropdownRef.current && !envDropdownRef.current.contains(e.target as Node)) {
        setShowEnvDropdown(false);
        setEnvDropdownPos(null);
      }
    };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [showEnvDropdown]);

  function openContextMenu(e: React.MouseEvent, tabId: string) {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ tabId, x: e.clientX, y: e.clientY });
  }

  const contextMenuTab = contextMenu ? tabs.find((t) => t.id === contextMenu.tabId) : null;

  const t = useI18n();

  function handleDragStart(e: React.DragEvent, tabId: string) {
    setDraggingTabId(tabId);
    e.dataTransfer.effectAllowed = 'move';
    // Required for Firefox
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

  return (
    <>
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-color)',
        background: 'var(--tab-inactive-bg)',
        overflow: 'hidden',
      }}
    >
      <div style={{ display: 'flex', flex: 1, minWidth: 0, alignItems: 'center' }}>
        {canScrollLeft && (
          <button
            onClick={() => {
              const el = tabsScrollRef.current;
              if (el) el.scrollBy({ left: -el.clientWidth, behavior: 'smooth' });
            }}
            style={{ background: 'transparent', border: 'none', color: 'var(--panel-fg)', cursor: 'pointer', padding: '0 5px', fontSize: 16, flexShrink: 0, opacity: 0.7, alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}
            title={t('scrollLeft')}
          >‹</button>
        )}
        <div ref={tabsScrollRef} style={{ display: 'flex', flex: 1, overflow: 'auto', scrollbarWidth: 'none' }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            data-tab-id={tab.id}
            className={`tabbar-tab${tab.id === activeTabId ? ' active' : ''}`}
            onClick={(e) => {
              setActiveTabId(tab.id);
              // Force scroll even if this tab was already active (e.g. half-visible)
              (e.currentTarget as HTMLElement).scrollIntoView({ block: 'nearest', inline: 'nearest' });
            }}
            onContextMenu={(e) => openContextMenu(e, tab.id)}
            draggable={!tab.isPinned}
            onDragStart={(e) => !tab.isPinned && handleDragStart(e, tab.id)}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDrop={(e) => handleDrop(e, tab.id)}
            onDragEnd={handleDragEnd}
            style={{
              borderLeft: tab.id === dragOverTabId && tab.id !== draggingTabId
                ? '2px solid var(--button-bg)'
                : undefined,
              opacity: tab.id === draggingTabId ? 0.4 : 1,
            }}
          >
            <span
              style={{
                fontWeight: 600,
                fontSize: 10,
                color: METHOD_COLORS[tab.method] || '#888',
              }}
            >
              {tab.method}
            </span>

            {tab.isPinned && (
              <span style={{ fontSize: 9, opacity: 0.7, lineHeight: 1 }} title={t('pinnedHint')}>📌</span>
            )}

            <span className="tabbar-tab-label">
                {tab.isCustomNamed ? tab.name : (tab.url || tab.name)}
              </span>

            {tab.isDirty && (
              <span style={{ color: 'var(--warning-fg)', fontSize: 8 }}>●</span>
            )}
            {tabs.length > 1 && !tab.isPinned && (
              <span
                className="tabbar-tab-close"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.id);
                }}
                title={t('closeTabHint')}
              >
                ×
              </span>
            )}
          </div>
        ))}
        </div>
        {canScrollRight && (
          <button
            onClick={() => {
              const el = tabsScrollRef.current;
              if (el) el.scrollBy({ left: el.clientWidth, behavior: 'smooth' });
            }}
            style={{ background: 'transparent', border: 'none', color: 'var(--panel-fg)', cursor: 'pointer', padding: '0 5px', fontSize: 16, flexShrink: 0, opacity: 0.7, alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}
            title={t('scrollRight')}
          >›</button>
        )}
      </div>


      <button
        onClick={addTab}
        style={{
          background: 'transparent',
          border: 'none',
          color: 'var(--panel-fg)',
          cursor: 'pointer',
          padding: '6px 10px',
          fontSize: 16,
          lineHeight: 1,
          opacity: 0.6,
          flexShrink: 0,
        }}
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
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: contextMenu.y,
            left: contextMenu.x,
            zIndex: 9999,
            background: 'var(--vscode-menu-background, #252526)',
            border: '1px solid var(--border-color)',
            borderRadius: 4,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            minWidth: 140,
            padding: '4px 0',
          }}
        >
          <div
            onClick={() => {
              pinTab(contextMenuTab.id, !contextMenuTab.isPinned);
              closeContextMenu();
            }}
            style={{
              padding: '6px 14px',
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--panel-fg)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--vscode-list-hoverBackground, #2a2d2e)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            {contextMenuTab.isPinned ? t('unpinTab') : t('pinTab')}
          </div>
          <div
            onClick={() => {
              duplicateTab(contextMenuTab.id);
              closeContextMenu();
            }}
            style={{
              padding: '6px 14px',
              cursor: 'pointer',
              fontSize: 12,
              color: 'var(--panel-fg)',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--vscode-list-hoverBackground, #2a2d2e)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Duplicate Tab
          </div>
          {tabs.length > 1 && !contextMenuTab.isPinned && (
            <div
              onClick={() => {
                closeContextMenu();
                removeTab(contextMenuTab.id);
              }}
              style={{
                padding: '6px 14px',
                cursor: 'pointer',
                fontSize: 12,
                color: '#f14c4c',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--vscode-list-hoverBackground, #2a2d2e)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {t('closeTab')}
            </div>
          )}
        </div>
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
