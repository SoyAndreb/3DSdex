import { useEffect, useState } from 'react';
import { useT } from '../i18n';
import type { FsMode } from '../lib/compatFs';
import {
  summarizePlan,
  type ChangePlan,
  type PlannedChange,
} from '../lib/changePlan';
import './ChangePreview.css';

export interface ChangePreviewProps {
  plan: ChangePlan;
  mode: FsMode;
  busy?: boolean;
  /** Label of the first (review) button, e.g. "Delete selected". */
  actionLabel: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const LIMIT = 8;

function ChangeLine({ change }: { change: PlannedChange }) {
  return (
    <li className="preview__line">
      <span className={`preview__kind preview__kind--${change.kind}`}>{change.kind}</span>
      <code>
        {change.from !== undefined && change.kind === 'move'
          ? `/${change.from} → /${change.to ?? change.path}`
          : change.kind === 'backup'
            ? `/${change.from ?? change.path} → /${change.path}`
            : `/${change.path}`}
      </code>
      {change.size !== undefined && change.size > 0 && (
        <span className="preview__size">{formatSize(change.size)}</span>
      )}
    </li>
  );
}

/**
 * Mandatory dry-run shown before any mutating action. The first click only
 * reveals the details; the second, explicit click executes the plan. In
 * compatible mode the same plan becomes the `.zip` manifest.
 */
export function ChangePreview({
  plan,
  mode,
  busy = false,
  actionLabel,
  onConfirm,
  onCancel,
}: ChangePreviewProps) {
  const t = useT();
  const [confirming, setConfirming] = useState(false);
  const summary = summarizePlan(plan);

  useEffect(() => {
    setConfirming(false);
  }, [plan]);

  const cancel = () => {
    setConfirming(false);
    onCancel();
  };

  return (
    <div className="preview" role="group" aria-label={t.dex3ds.previewTitle}>
      <h4 className="preview__title">{t.dex3ds.previewTitle}</h4>
      <p className="preview__intro">
        {mode === 'direct' ? t.dex3ds.previewDirect : t.dex3ds.previewCompat}
      </p>
      {summary.blocked > 0 && (
        <p className="preview__blocked">{t.dex3ds.previewBlocked(summary.blocked)}</p>
      )}
      {plan.changes.length === 0 ? (
        <p className="preview__empty">{t.dex3ds.previewEmpty}</p>
      ) : (
        <>
          <ul className="preview__lines">
            {plan.changes.slice(0, LIMIT).map((change, index) => (
              <ChangeLine change={change} key={`${change.kind}-${change.path}-${index}`} />
            ))}
            {plan.changes.length > LIMIT && (
              <li className="preview__more">
                {t.dex3ds.previewMore(plan.changes.length - LIMIT)}
              </li>
            )}
          </ul>
          <p className="preview__summary">
            {t.dex3ds.previewCounts(
              summary.create,
              summary.backup,
              summary.move,
              summary.delete,
              formatSize(summary.totalBytes),
            )}
          </p>
        </>
      )}
      {!confirming ? (
        <div className="preview__actions">
          <button type="button" disabled={plan.changes.length === 0} onClick={() => setConfirming(true)}>
            {actionLabel}
          </button>
          <button type="button" onClick={onCancel}>
            {t.dex3ds.previewCancel}
          </button>
        </div>
      ) : (
        <div className="preview__confirm" role="alert">
          <span>{t.dex3ds.previewConfirm}</span>
          <button
            type="button"
            className="health3ds__danger"
            disabled={busy || plan.changes.length === 0}
            onClick={() => void onConfirm()}
          >
            {busy ? t.dex3ds.previewApplying : t.dex3ds.previewYes}
          </button>
          <button type="button" disabled={busy} onClick={cancel}>
            {t.dex3ds.previewCancel}
          </button>
        </div>
      )}
    </div>
  );
}
