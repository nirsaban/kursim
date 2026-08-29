'use client';

import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/Icon';
import { he } from '@/lib/he';

export interface PaywallInfo {
  error: 'plan_required' | 'plan_limit';
  cap?: number;
  current?: number;
  /** What the user was trying to do — tunes the headline. */
  context?: 'students' | 'publish';
}

/** Reads the school slug out of /t/{slug}/... so callers don't have to thread it. */
function planHref(): string {
  if (typeof window === 'undefined') return '#';
  const m = window.location.pathname.match(/^\/t\/([^/]+)/);
  return m ? `/t/${m[1]}/admin/plan` : '#';
}

/**
 * The paywall moment: a 402 from the API lands here. One clear message,
 * one clear way forward — the packages page.
 */
export default function PaywallModal({
  info,
  onClose,
}: {
  info: PaywallInfo | null;
  onClose: () => void;
}) {
  const isLimit = info?.error === 'plan_limit';
  const title = isLimit
    ? he.paywallLimitTitle
    : info?.context === 'publish'
      ? he.paywallPublishTitle
      : he.paywallTitle;
  const body = isLimit
    ? he.paywallLimitBody
        .replace('{current}', String(info?.current ?? ''))
        .replace('{cap}', String(info?.cap ?? ''))
    : he.paywallBody;

  return (
    <Modal open={info !== null} onClose={onClose} title={title}>
      <div className="space-y-5">
        <p className="text-sm text-muted leading-relaxed">{body}</p>
        <a
          href={planHref()}
          className="w-full inline-flex items-center justify-center gap-2 bg-copper-500 hover:bg-copper-600 text-card font-bold rounded-xl min-h-[48px] transition-[background-color,transform] duration-150 active:scale-[0.98]"
        >
          <Icon name="award" size={16} />
          {he.paywallCta}
        </a>
        <p className="text-xs text-muted leading-relaxed">{he.planActivationNote}</p>
      </div>
    </Modal>
  );
}
