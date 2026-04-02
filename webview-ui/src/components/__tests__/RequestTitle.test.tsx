import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RequestTitle } from '../RequestPanel/RequestTitle';
import { useTabStore } from '../../stores/tabStore';

const mockPostMessage = vi.hoisted(() => vi.fn());

vi.mock('../../vscode', () => ({
  vscode: { postMessage: mockPostMessage },
}));

const defaultTab = {
  id: 'tab-1',
  name: 'New Request',
  isCustomNamed: false,
  method: 'GET' as const,
  url: '',
  params: [{ key: '', value: '', enabled: true }],
  headers: [{ key: '', value: '', enabled: true }],
  body: { type: 'none' as const },
  auth: { type: 'none' as const },
  activeTab: 'params' as const,
  response: null,
  responseError: null,
  loading: false,
  isDirty: false,
  isPinned: false,
};

function setup() {
  useTabStore.setState({ tabs: [defaultTab], activeTabId: 'tab-1' });
  mockPostMessage.mockClear();
  render(<RequestTitle />);
}

function openImportModal() {
  const btn = screen.getByTitle('Quick Import');
  fireEvent.click(btn);
}

describe('RequestTitle — Quick Import modal', () => {
  beforeEach(setup);

  it('opens the import modal when Quick Import is clicked', () => {
    openImportModal();
    expect(screen.getByRole('textbox', { name: '' })).toBeDefined();
    expect(screen.getByText('Import to Current Tab')).toBeDefined();
  });

  it('shows two action buttons and a cancel button', () => {
    openImportModal();
    expect(screen.getByText('Import to Current Tab')).toBeDefined();
    expect(screen.getByText('Open in New Tab')).toBeDefined();
    expect(screen.getByText('Cancel')).toBeDefined();
  });

  it('both confirm buttons are disabled when textarea is empty', () => {
    openImportModal();
    const currentTabBtn = screen.getByText('Import to Current Tab').closest('button')!;
    const newTabBtn = screen.getByText('Open in New Tab').closest('button')!;
    expect(currentTabBtn).toBeDisabled();
    expect(newTabBtn).toBeDisabled();
  });

  it('both confirm buttons are enabled after typing input', () => {
    openImportModal();
    const textarea = screen.getByRole('textbox', { name: '' });
    fireEvent.change(textarea, { target: { value: 'curl https://example.com' } });
    const currentTabBtn = screen.getByText('Import to Current Tab').closest('button')!;
    const newTabBtn = screen.getByText('Open in New Tab').closest('button')!;
    expect(currentTabBtn).not.toBeDisabled();
    expect(newTabBtn).not.toBeDisabled();
  });

  it('"Import to Current Tab" sends importRequest with newTab: false', () => {
    openImportModal();
    const textarea = screen.getByRole('textbox', { name: '' });
    fireEvent.change(textarea, { target: { value: 'curl https://example.com' } });
    fireEvent.click(screen.getByText('Import to Current Tab'));
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'importRequest',
      payload: { input: 'curl https://example.com', newTab: false },
    });
  });

  it('"Open in New Tab" sends importRequest with newTab: true', () => {
    openImportModal();
    const textarea = screen.getByRole('textbox', { name: '' });
    fireEvent.change(textarea, { target: { value: 'curl https://example.com' } });
    fireEvent.click(screen.getByText('Open in New Tab'));
    expect(mockPostMessage).toHaveBeenCalledWith({
      type: 'importRequest',
      payload: { input: 'curl https://example.com', newTab: true },
    });
  });

  it('modal closes after clicking "Import to Current Tab"', () => {
    openImportModal();
    const textarea = screen.getByRole('textbox', { name: '' });
    fireEvent.change(textarea, { target: { value: 'curl https://example.com' } });
    fireEvent.click(screen.getByText('Import to Current Tab'));
    expect(screen.queryByText('Import to Current Tab')).toBeNull();
  });

  it('modal closes after clicking "Open in New Tab"', () => {
    openImportModal();
    const textarea = screen.getByRole('textbox', { name: '' });
    fireEvent.change(textarea, { target: { value: 'curl https://example.com' } });
    fireEvent.click(screen.getByText('Open in New Tab'));
    expect(screen.queryByText('Open in New Tab')).toBeNull();
  });

  it('does not call postMessage when textarea is empty and confirm is clicked', () => {
    openImportModal();
    // buttons are disabled, but test the guard logic by direct logic check
    const currentTabBtn = screen.getByText('Import to Current Tab').closest('button')!;
    expect(currentTabBtn).toBeDisabled();
    // Disabled buttons won't fire events, so postMessage should not be called
    fireEvent.click(currentTabBtn);
    expect(mockPostMessage).not.toHaveBeenCalled();
  });

  it('modal closes when Cancel is clicked', () => {
    openImportModal();
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByText('Import to Current Tab')).toBeNull();
  });

  it('modal closes when overlay is clicked', () => {
    openImportModal();
    const overlay = document.querySelector('.import-modal-overlay')!;
    fireEvent.click(overlay);
    expect(screen.queryByText('Import to Current Tab')).toBeNull();
  });

  it('Escape key closes the modal', () => {
    openImportModal();
    const textarea = screen.getByRole('textbox', { name: '' });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(screen.queryByText('Import to Current Tab')).toBeNull();
  });
});
