import { useSd } from '../state/SdContext';
import { useT } from '../i18n';

export function CfwOverviewView() {
  const { card3dsInfo } = useSd();
  const t = useT();

  if (!card3dsInfo) {
    return null;
  }

  return (
    <section className="card" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <h2 style={{ margin: 0, fontSize: '1.35rem' }}>{t.dex3ds.cfwPreviewTitle}</h2>
      <p style={{ margin: 0, color: 'var(--text-dim)' }}>{t.dex3ds.cfwPreviewBody}</p>
      <ul style={{ margin: 0, paddingLeft: '1.1rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
        <li>
          <code>/boot.firm</code>: {card3dsInfo.hasBootFirm ? '✓' : '✗'}
          {card3dsInfo.bootFirmSize !== null ? ` (${card3dsInfo.bootFirmSize.toLocaleString()} B)` : ''}
        </li>
        <li>
          <code>/boot.3dsx</code>: {card3dsInfo.hasBoot3dsx ? '✓' : '✗'}
        </li>
        <li>
          <code>/luma/</code>: {card3dsInfo.hasLumaDir ? '✓' : '✗'}
        </li>
        <li>
          <code>/luma/payloads/GodMode9.firm</code>: {card3dsInfo.hasGodMode9Payload ? '✓' : '✗'}
        </li>
        <li>
          <code>/luma/screenshots/</code>: {card3dsInfo.hasLumaScreenshots ? '✓' : '✗'}
        </li>
        <li>
          <code>/Nintendo 3DS/</code>: {card3dsInfo.hasNintendo3dsDir ? '✓ (protected)' : '✗'}
        </li>
        <li>
          <code>/gm9/</code>: {card3dsInfo.hasGm9Dir ? '✓' : '✗'}
        </li>
        <li>
          <code>/3ds/</code>: {card3dsInfo.has3dsDir ? '✓' : '✗'} · <code>/cias/</code>:{' '}
          {card3dsInfo.hasCiasDir ? '✓' : '✗'}
        </li>
      </ul>
    </section>
  );
}
