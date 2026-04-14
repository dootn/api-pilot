import { useI18n } from '../../i18n';

interface TabInfo {
  id: string;
  isPinned: boolean;
}

interface Props {
  x: number;
  y: number;
  tab: TabInfo;
  canClose: boolean;
  onPin: () => void;
  onDuplicate: () => void;
  onClose: () => void;
}

const MENU_STYLE: React.CSSProperties = {
  position: 'fixed',
  zIndex: 9999,
  background: 'var(--vscode-menu-background, #252526)',
  border: '1px solid var(--border-color)',
  borderRadius: 4,
  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
  minWidth: 140,
  padding: '4px 0',
};

const ITEM_STYLE: React.CSSProperties = {
  padding: '6px 14px',
  cursor: 'pointer',
  fontSize: 12,
  color: 'var(--panel-fg)',
};

const hoverIn = (e: React.MouseEvent) => {
  (e.currentTarget as HTMLElement).style.background = 'var(--vscode-list-hoverBackground, #2a2d2e)';
};
const hoverOut = (e: React.MouseEvent) => {
  (e.currentTarget as HTMLElement).style.background = 'transparent';
};

export function TabContextMenu({ x, y, tab, canClose, onPin, onDuplicate, onClose }: Props) {
  const t = useI18n();

  return (
    <div onClick={(e) => e.stopPropagation()} style={{ ...MENU_STYLE, top: y, left: x }}>
      <div onClick={onPin} style={ITEM_STYLE} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
        {tab.isPinned ? t('unpinTab') : t('pinTab')}
      </div>
      <div onClick={onDuplicate} style={ITEM_STYLE} onMouseEnter={hoverIn} onMouseLeave={hoverOut}>
        Duplicate Tab
      </div>
      {canClose && (
        <div
          onClick={onClose}
          style={{ ...ITEM_STYLE, color: '#f14c4c' }}
          onMouseEnter={hoverIn}
          onMouseLeave={hoverOut}
        >
          {t('closeTab')}
        </div>
      )}
    </div>
  );
}
