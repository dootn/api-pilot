import { describe, it, expect, beforeEach } from 'vitest';
import { useTabStore } from '../../stores/tabStore';

describe('tabStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    const state = useTabStore.getState();
    // Remove all tabs except one and reset
    useTabStore.setState({
      tabs: [
        {
          id: 'initial',
          name: 'New Request',
          method: 'GET',
          url: '',
          params: [{ key: '', value: '', enabled: true }],
          headers: [{ key: '', value: '', enabled: true }],
          body: { type: 'none' },
          auth: { type: 'none' },
          activeTab: 'params',
          response: null,
          responseError: null,
          loading: false,
          isDirty: false,
        },
      ],
      activeTabId: 'initial',
    });
  });

  describe('addTab', () => {
    it('should add a new tab and set it active', () => {
      useTabStore.getState().addTab();
      const state = useTabStore.getState();
      expect(state.tabs).toHaveLength(2);
      expect(state.activeTabId).toBe(state.tabs[1].id);
    });

    it('should create tabs with unique ids', () => {
      useTabStore.getState().addTab();
      useTabStore.getState().addTab();
      const ids = useTabStore.getState().tabs.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('addTabWithData', () => {
    it('should add a tab with pre-filled data', () => {
      useTabStore.getState().addTabWithData({
        method: 'POST',
        url: 'https://api.example.com/users',
        headers: [{ key: 'Content-Type', value: 'application/json', enabled: true }],
      });
      const state = useTabStore.getState();
      expect(state.tabs).toHaveLength(2);
      const newTab = state.tabs[1];
      expect(newTab.method).toBe('POST');
      expect(newTab.url).toBe('https://api.example.com/users');
      expect(newTab.headers[0].key).toBe('Content-Type');
    });

    it('should generate name from URL', () => {
      useTabStore.getState().addTabWithData({
        method: 'GET',
        url: 'https://api.example.com/users',
      });
      const newTab = useTabStore.getState().tabs[1];
      expect(newTab.name).toContain('GET');
      expect(newTab.name).toContain('/users');
    });
  });

  describe('removeTab', () => {
    it('should remove a tab', () => {
      useTabStore.getState().addTab();
      const id = useTabStore.getState().tabs[1].id;
      useTabStore.getState().removeTab(id);
      expect(useTabStore.getState().tabs).toHaveLength(1);
    });

    it('should not remove the last tab', () => {
      const id = useTabStore.getState().tabs[0].id;
      useTabStore.getState().removeTab(id);
      expect(useTabStore.getState().tabs).toHaveLength(1);
    });

    it('should switch to adjacent tab when active tab is removed', () => {
      useTabStore.getState().addTab();
      useTabStore.getState().addTab();
      const state = useTabStore.getState();
      const middleId = state.tabs[1].id;
      useTabStore.getState().setActiveTabId(middleId);
      useTabStore.getState().removeTab(middleId);
      expect(useTabStore.getState().activeTabId).not.toBe(middleId);
    });
  });

  describe('updateTab', () => {
    it('should update tab fields', () => {
      const id = useTabStore.getState().tabs[0].id;
      useTabStore.getState().updateTab(id, { url: 'https://newurl.com', method: 'POST' });
      const tab = useTabStore.getState().tabs[0];
      expect(tab.url).toBe('https://newurl.com');
      expect(tab.method).toBe('POST');
    });

    it('should mark tab as dirty', () => {
      const id = useTabStore.getState().tabs[0].id;
      expect(useTabStore.getState().tabs[0].isDirty).toBe(false);
      useTabStore.getState().updateTab(id, { url: 'changed' });
      expect(useTabStore.getState().tabs[0].isDirty).toBe(true);
    });
  });

  describe('setActiveTabId', () => {
    it('should change the active tab', () => {
      useTabStore.getState().addTab();
      const secondId = useTabStore.getState().tabs[1].id;
      useTabStore.getState().setActiveTabId(useTabStore.getState().tabs[0].id);
      expect(useTabStore.getState().activeTabId).toBe(useTabStore.getState().tabs[0].id);
      useTabStore.getState().setActiveTabId(secondId);
      expect(useTabStore.getState().activeTabId).toBe(secondId);
    });
  });

  describe('getActiveTab', () => {
    it('should return the current active tab', () => {
      const tab = useTabStore.getState().getActiveTab();
      expect(tab).toBeDefined();
      expect(tab?.id).toBe(useTabStore.getState().activeTabId);
    });
  });
});
