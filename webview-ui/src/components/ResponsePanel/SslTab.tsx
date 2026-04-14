import type { SSLInfo } from '../../stores/requestStore';
import { useI18n } from '../../i18n';

/** Compact SSL summary shown on request error. */
export function SslErrorSummary({ sslInfo }: { sslInfo: SSLInfo }) {
  const t = useI18n();
  return (
    <div className="border-t" style={{ padding: '10px 16px', fontSize: 12 }}>
      <div className="section-header">{t('sslCertDetails')}</div>
      <div className={`ssl-alert ${sslInfo.authorized ? 'ssl-alert-success' : 'ssl-alert-error'}`}
        style={{ marginBottom: 8 }}
      >
        <div style={{ fontWeight: 600, marginBottom: sslInfo.authorizationError ? 4 : 0 }}>
          {sslInfo.authorized ? t('sslCertValid') : t('sslCertInvalid')}
        </div>
        {sslInfo.authorizationError && (
          <div className="text-secondary" style={{ opacity: 0.8 }}>{sslInfo.authorizationError}</div>
        )}
      </div>
      {sslInfo.certificate && (
        <table className="ssl-table">
          <tbody>
            <tr>
              <td className="ssl-label" style={{ padding: '5px 0' }}>{t('sslSubject')}</td>
              <td style={{ padding: '5px 0' }}>{sslInfo.certificate.subject.CN || 'N/A'}</td>
            </tr>
            <tr>
              <td className="ssl-label" style={{ padding: '5px 0' }}>{t('sslIssuer')}</td>
              <td style={{ padding: '5px 0' }}>{sslInfo.certificate.issuer.CN || 'N/A'}</td>
            </tr>
            <tr>
              <td className="ssl-label" style={{ padding: '5px 0' }}>{t('sslValidTo')}</td>
              <td style={{ padding: '5px 0' }}>{new Date(sslInfo.certificate.validTo).toLocaleString()}</td>
            </tr>
            <tr>
              <td className="ssl-label" style={{ padding: '5px 0' }}>{t('sslProtocolCipher')}</td>
              <td className="ssl-value-mono" style={{ padding: '5px 0' }}>
                {sslInfo.protocol} / {sslInfo.cipher.name}
              </td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}

/** Full SSL details tab. */
export function SslTab({ sslInfo }: { sslInfo: SSLInfo }) {
  const t = useI18n();
  return (
    <div style={{ padding: '12px 16px', fontSize: 12 }}>
      {/* Connection Status */}
      <div className={`ssl-alert ${sslInfo.authorized ? 'ssl-alert-success' : 'ssl-alert-warning'}`}>
        <div style={{ fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
          {sslInfo.authorized ? t('sslSecureConn') : t('sslNotTrusted')}
        </div>
        {sslInfo.authorizationError && (
          <div className="text-secondary" style={{ opacity: 0.8 }}>
            {sslInfo.authorizationError}
          </div>
        )}
      </div>

      {/* Protocol & Cipher */}
      <div style={{ marginBottom: 16 }}>
        <h4 className="section-header">
          {t('sslConnDetails')}
        </h4>
        <table className="ssl-table">
          <tbody>
            <tr>
              <td className="ssl-label">{t('sslProtocol')}</td>
              <td className="ssl-value-mono">
                {sslInfo.protocol}
              </td>
            </tr>
            <tr>
              <td className="ssl-label">{t('sslCipher')}</td>
              <td className="ssl-value-mono">
                {sslInfo.cipher.name} ({sslInfo.cipher.version})
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Certificate Details */}
      {sslInfo.certificate && (
        <div style={{ marginBottom: 16 }}>
          <h4 className="section-header">
            {t('sslCertSection')}
          </h4>
          <table className="ssl-table">
            <tbody>
              <tr>
                <td className="ssl-label">{t('sslSubject')}</td>
                <td className="ssl-value-mono">
                  {sslInfo.certificate.subject.CN || 'N/A'}
                </td>
              </tr>
              <tr>
                <td className="ssl-label">{t('sslIssuer')}</td>
                <td className="ssl-value-mono">
                  {sslInfo.certificate.issuer.CN || 'N/A'}
                </td>
              </tr>
              <tr>
                <td className="ssl-label">{t('sslValidFrom')}</td>
                <td>
                  {new Date(sslInfo.certificate.validFrom).toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="ssl-label">{t('sslValidTo')}</td>
                <td>
                  {new Date(sslInfo.certificate.validTo).toLocaleString()}
                </td>
              </tr>
              <tr>
                <td className="ssl-label">{t('sslSerial')}</td>
                <td className="ssl-value-mono" style={{ fontSize: 10 }}>
                  {sslInfo.certificate.serialNumber}
                </td>
              </tr>
              <tr>
                <td className="ssl-label">{t('sslFingerprint')}</td>
                <td className="ssl-value-mono" style={{ fontSize: 10, wordBreak: 'break-all' }}>
                  {sslInfo.certificate.fingerprint}
                </td>
              </tr>
              <tr>
                <td className="ssl-label">{t('sslSignatureAlg')}</td>
                <td className="ssl-value-mono">
                  {sslInfo.certificate.signatureAlgorithm}
                </td>
              </tr>
              {sslInfo.certificate.subjectAltNames && sslInfo.certificate.subjectAltNames.length > 0 && (
                <tr>
                  <td className="ssl-label" style={{ verticalAlign: 'top' }}>{t('sslSubjectAltNames')}</td>
                  <td style={{ fontSize: 10 }}>
                    {sslInfo.certificate.subjectAltNames.join(', ')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Certificate Chain */}
      {sslInfo.certificateChain && sslInfo.certificateChain.length > 1 && (
        <div>
          <h4 className="section-header">
            {t('sslCertChain')} ({sslInfo.certificateChain.length} certificates)
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sslInfo.certificateChain.map((cert, idx) => (
              <div
                key={idx}
                style={{
                  padding: '8px 10px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 4,
                  fontSize: 11,
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: 4 }}>
                  #{idx + 1} {cert.subject.CN || 'Unknown'}
                </div>
                <div style={{ opacity: 0.6, fontSize: 10 }}>
                  Issued by: {cert.issuer.CN || 'Unknown'}
                </div>
                <div style={{ opacity: 0.6, fontSize: 10 }}>
                  Valid: {new Date(cert.validFrom).toLocaleDateString()} - {new Date(cert.validTo).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
