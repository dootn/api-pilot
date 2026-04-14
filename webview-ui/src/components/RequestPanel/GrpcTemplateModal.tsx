import { useI18n } from '../../i18n';
import { Modal } from '../shared/Modal';
import { Button } from '../shared/ui';

interface Props {
  content: string;
  copied: boolean;
  onCopy: () => void;
  onClose: () => void;
}

export function GrpcTemplateModal({ content, copied, onCopy, onClose }: Props) {
  const t = useI18n();

  return (
    <Modal onClose={onClose} width="min(600px, 80vw)" maxHeight="70vh">
      <div className="code-modal-content" style={{ padding: '16px 18px', gap: 10 }}>
        <div className="code-modal-header" style={{ padding: 0 }}>
          <span className="code-modal-title">{t('grpcTemplateTitle')}</span>
          <button onClick={onClose} className="icon-btn">×</button>
        </div>
        <div className="text-secondary">{t('grpcTemplateHint')}</div>
        <pre className="code-modal-pre" style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--input-bg, #2d2d2d)',
          border: '1px solid var(--border-color, #444)',
          borderRadius: 4,
          padding: '8px 10px',
        }}>
          {content}
        </pre>
        <div className="code-modal-footer" style={{ padding: 0 }}>
          <Button variant="primary" btnSize="sm" onClick={onCopy}>
            {copied ? t('codeSnippetCopied') : t('codeSnippetCopy')}
          </Button>
          <Button variant="secondary" btnSize="sm" onClick={onClose}>
            {t('closeBtn')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
