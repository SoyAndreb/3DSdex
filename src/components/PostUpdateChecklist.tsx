import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import type { Dict } from '../i18n/en';
import type { FsMode } from '../lib/compatFs';
import type { CfwComponentId } from '../lib/cfwManifest';
import './PostUpdateChecklist.css';

export interface PostUpdateChecklistProps {
  /** Components just written, so only their steps are shown. */
  components: readonly CfwComponentId[];
  mode: FsMode;
  onClose: () => void;
}

const STEPS: Record<CfwComponentId, (t: Dict) => string> = {
  luma3ds: (t) => t.dex3ds.checkLuma,
  godmode9: (t) => t.dex3ds.checkGm9,
  twilight: (t) => t.dex3ds.checkTwilight,
  hbmenu: (t) => t.dex3ds.checkHbmenu,
};

/** Short, dismissible checklist shown after a verified write. */
export function PostUpdateChecklist({ components, mode, onClose }: PostUpdateChecklistProps) {
  const t = useT();
  const [done, setDone] = useState<ReadonlySet<CfwComponentId>>(new Set());
  const unique = Array.from(new Set(components));

  useEffect(() => {
    setDone(new Set());
  }, [components]);

  const toggle = (id: CfwComponentId) => {
    const next = new Set(done);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setDone(next);
  };

  const allDone = unique.length > 0 && unique.every((id) => done.has(id));

  return (
    <aside className="checklist" aria-label={t.dex3ds.checklistTitle}>
      <div className="checklist__head">
        <h3 className="checklist__title">{t.dex3ds.checklistTitle}</h3>
        <button type="button" className="checklist__close" onClick={onClose} aria-label={t.dex3ds.checklistDismiss}>
          ×
        </button>
      </div>
      <p className="checklist__intro">{t.dex3ds.checklistIntro}</p>
      {mode === 'compat' && <p className="checklist__zip">{t.dex3ds.checklistZip}</p>}
      <ul className="checklist__steps">
        {unique.map((id) => (
          <li key={id}>
            <label>
              <input type="checkbox" checked={done.has(id)} onChange={() => toggle(id)} />
              <strong>{id === 'luma3ds' ? 'Luma3DS' : id === 'godmode9' ? 'GodMode9' : id === 'twilight' ? 'TWiLight Menu++' : 'Homebrew Launcher'}</strong>
              <span>{STEPS[id](t)}</span>
            </label>
          </li>
        ))}
      </ul>
      <div className="checklist__foot">
        <span className={allDone ? 'checklist__done' : ''}>
          {allDone ? t.dex3ds.checklistAllDone : t.dex3ds.checklistPending(unique.length - done.size)}
        </span>
        <button type="button" onClick={onClose}>
          {t.dex3ds.checklistDismiss}
        </button>
      </div>
    </aside>
  );
}
