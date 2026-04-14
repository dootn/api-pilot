import { useEffect } from 'react';

interface Props {
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
  maxHeight?: string;
}

export function Modal({ onClose, children, width, maxHeight }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="modal-panel" style={{ width, maxHeight }}>
        {children}
      </div>
    </div>
  );
}
