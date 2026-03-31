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
  const { tabs, activeTabId, setActiveTabId, addTab, removeTab, renameTab, reorderTabs, pinTab, duplicateTab } = useTabStore();
  const { environments, activeEnvId, switchEnv } = useEnvironments();
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [showEnvDropdown, setShowEnvDropdown] = useState(false);
  const [showEnvManager, setShowEnvManager] = useState(false);
  const [envDropdownPos, setEnvDropdownPos] = useState<{ top: number; right: number } | null>(null);
  const [draggingTabId, setDraggingTabId] = useState<string | null>(null);
  const [dragOverTabId, setDragOverTabId] = useState<string | null>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const envDropdownRef = useRef<HTMLDivElement>(null);
  const tabsScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editingTabId && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingTabId]);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  const updateScrollState = useCallback(() => {
    const el = tabsScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 0);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
    
    // Calculate pagination
    const scrollWidth = el.scrollWidth;
    const clientWidth = el.clientWidth;
    const scrollLeft = el.scrollLeft;
    
    if (scrollWidth > clientWidth) {
      // Calculate total pages (approximate, treating each viewport as a page)
      const pages = Math.ceil(scrollWidth / clientWidth);
      setTotalPages(pages);
      
      // Calculate current page based on scroll position
      const page = Math.min(pages, Math.floor(scrollLeft / clientWidth) + 1);
      setCurrentPage(page);
    } else {
      setTotalPages(1);
      setCurrentPage(1);
    }
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


  function scrollToPage(pageNum: number) {
    const el = tabsScrollRef.current;
    if (!el) return;
    const targetScroll = (pageNum - 1) * el.clientWidth;
    el.scrollTo({ left: targetScroll, behavior: 'smooth' });
  }

  function nextPage() {
    if (currentPage < totalPages) {
      scrollToPage(currentPage + 1);
    }
  }

  function prevPage() {
    if (currentPage > 1) {
      scrollToPage(currentPage - 1);
    }
  }
  useEffect(() => { updateScrollState(); }, [tabs, updateScrollState]);

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

  function scrollTabs(delta: number) {
    tabsScrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  }

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

  function startRename(tabId: string, tab: { name: string; url: string; isCustomNamed: boolean }) {
    setEditingTabId(tabId);
    setEditingName(tab.isCustomNamed ? tab.name : (tab.url || tab.name));
  }

  function commitRename() {
    if (editingTabId) {
      const trimmed = editingName.trim();
      if (trimmed) renameTab(editingTabId, trimmed);
    }
    setEditingTabId(null);
  }

  function cancelRename() {
    setEditingTabId(null);
  }

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
            onClick={() => scrollTabs(-120)}
            style={{ background: 'transparent', border: 'none', color: 'var(--panel-fg)', cursor: 'pointer', padding: '0 5px', fontSize: 16, flexShrink: 0, opacity: 0.7, alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}
            title={t('scrollLeft')}
          >‹</button>
        )}
        <div ref={tabsScrollRef} style={{ display: 'flex', flex: 1, overflow: 'auto', scrollbarWidth: 'none' }}>
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTabId(tab.id)}
            onContextMenu={(e) => openContextMenu(e, tab.id)}
            draggable={!tab.isPinned}
            onDragStart={(e) => !tab.isPinned && handleDragStart(e, tab.id)}
            onDragOver={(e) => handleDragOver(e, tab.id)}
            onDrop={(e) => handleDrop(e, tab.id)}
            onDragEnd={handleDragEnd}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 12,
              whiteSpace: 'nowrap',
              background:
                tab.id === activeTabId
                  ? 'var(--tab-active-bg)'
                  : 'transparent',
              borderBottom:
                tab.id === activeTabId
                  ? '2px solid var(--button-bg)'
                  : '2px solid transparent',
              borderLeft: tab.id === dragOverTabId && tab.id !== draggingTabId
                ? '2px solid var(--button-bg)'
                : '2px solid transparent',
              color:
                tab.id === activeTabId
                  ? 'var(--vscode-tab-activeForeground, #fff)'
                  : 'var(--vscode-tab-inactiveForeground, #999)',
              opacity: tab.id === draggingTabId ? 0.4 : 1,
              minWidth: 80,
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

            {editingTabId === tab.id ? (
              <input
                ref={inputRef}
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitRename();
                  else if (e.key === 'Escape') cancelRename();
                  e.stopPropagation();
                }}
                onClick={(e) => e.stopPropagation()}
                style={{
                  width: 100,
                  fontSize: 12,
                  background: 'var(--input-bg, var(--vscode-input-background))',
                  color: 'var(--panel-fg)',
                  border: '1px solid var(--button-bg)',
                  borderRadius: 3,
                  padding: '1px 4px',
                  outline: 'none',
                }}
              />
            ) : (
              <span
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  startRename(tab.id, tab);
                }}
                title={t('doubleClickRename')}
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 120,
                }}
              >
                {tab.isCustomNamed ? tab.name : (tab.url || tab.name)}
              </span>
            )}

            {tab.isDirty && (
              <span style={{ color: 'var(--warning-fg)', fontSize: 8 }}>●</span>
            )}
            {tabs.length > 1 && !tab.isPinned && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  removeTab(tab.id);
                }}
                style={{
                  marginLeft: 4,
                  opacity: 0.5,
                  cursor: 'pointer',
                  fontSize: 14,
                  lineHeight: 1,
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
            onClick={() => scrollTabs(120)}
            style={{ background: 'transparent', border: 'none', color: 'var(--panel-fg)', cursor: 'pointer', padding: '0 5px', fontSize: 16, flexShrink: 0, opacity: 0.7, alignSelf: 'stretch', display: 'flex', alignItems: 'center' }}
            title={t('scrollRight')}
          >›</button>
        )}
      </div>

      {/* Pagination indicator */}
      {totalPages > 1 && (
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 4, 
          padding: '0 8px',
          borderLeft: '1px solid var(--border-color)',
          fontSize: 11,
          color: 'var(--panel-fg)',
          opacity: 0.7,
          flexShrink: 0,
        }}>
          <button
            onClick={prevPage}
            disabled={currentPage === 1}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--panel-fg)',
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              padding: '2px 4px',
              fontSize: 14,
              opacity: currentPage === 1 ? 0.3 : 0.7,
            }}
            title="上一页"
          >◀</button>
          <span style={{ minWidth: 35, textAlign: 'center' }}>
            {currentPage}/{totalPages}
          </span>
          <button
            onClick={nextPage}
            disabled={currentPage === totalPages}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--panel-fg)',
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              padding: '2px 4px',
              fontSize: 14,
              opacity: currentPage === totalPages ? 0.3 : 0.7,
            }}
            title="下一页"
          >▶</button>
        </div>
      )}

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
              closeContextMenu();
              startRename(contextMenuTab.id, contextMenuTab);
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
            {t('renameTab')}
          </div>
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
        <div
          className={`env-dropdown-item ${!activeEnvId ? 'selected' : ''}`}
          onClick={() => { switchEnv(null); setShowEnvDropdown(false); setEnvDropdownPos(null); }}
        >
          <span className="env-dropdown-dot">○</span>
          {t('noEnvironment')}
        </div>
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
