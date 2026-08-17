/**
 * Platform billing: the three sellable packages, plus the FREE tier every
 * self-served school starts on.
 *
 * FREE schools can build everything — courses, lessons, landing drafts — but
 * hit the paywall at the two moments the school starts making money: inviting
 * students in and publishing a landing page. Payment happens on Grow payment
 * links (separate from tenants' own Hyp/Grow course sales, which this module
 * never touches); activation is done by the super-admin, who can also grant
 * any package for free.
 */

export type Plan = 'FREE' | 'STARTER' | 'GROWTH' | 'UNLIMITED';

export const PLANS: Plan[] = ['FREE', 'STARTER', 'GROWTH', 'UNLIMITED'];

/** Student caps per plan. FREE builds but doesn't enroll; Infinity = no cap. */
export const PLAN_STUDENT_CAP: Record<Plan, number> = {
  FREE: 0,
  STARTER: 50,
  GROWTH: 500,
  UNLIMITED: Infinity,
};

export interface PackageOffer {
  plan: Exclude<Plan, 'FREE'>;
  /** Display price, e.g. '₪49' — the charged amount lives in the Grow link. */
  priceMonthly: string;
  cap: number;
  /** Grow payment link; empty string means "contact us" until configured. */
  growLink: string;
}

/** The three packages, in display order. Links come from env (see .env.example). */
export function getPackages(): PackageOffer[] {
  return [
    {
      plan: 'STARTER',
      priceMonthly: '₪49',
      cap: PLAN_STUDENT_CAP.STARTER,
      growLink: process.env.GROW_PLAN_LINK_STARTER ?? '',
    },
    {
      plan: 'GROWTH',
      priceMonthly: '₪99',
      cap: PLAN_STUDENT_CAP.GROWTH,
      growLink: process.env.GROW_PLAN_LINK_GROWTH ?? '',
    },
    {
      plan: 'UNLIMITED',
      priceMonthly: '₪179',
      cap: PLAN_STUDENT_CAP.UNLIMITED,
      growLink: process.env.GROW_PLAN_LINK_UNLIMITED ?? '',
    },
  ];
}

export function normalizePlan(raw: string | null | undefined): Plan {
  return PLANS.includes(raw as Plan) ? (raw as Plan) : 'FREE';
}

export type SeatVerdict =
  | { ok: true }
  | { ok: false; error: 'plan_required' | 'plan_limit'; cap: number };

/**
 * May this school hold `current + adding` students? FREE fails with
 * plan_required (the paywall moment); a paid plan fails with plan_limit
 * only when the cap is actually exceeded.
 */
export function checkStudentSeats(plan: Plan, current: number, adding = 1): SeatVerdict {
  const cap = PLAN_STUDENT_CAP[plan];
  if (plan === 'FREE') return { ok: false, error: 'plan_required', cap: 0 };
  if (current + adding > cap) return { ok: false, error: 'plan_limit', cap };
  return { ok: true };
}

/** Publishing a landing page is the second paywall moment. */
export function canPublishLanding(plan: Plan): boolean {
  return plan !== 'FREE';
}

/** The WhatsApp AI mentor is a GROWTH-and-up feature — the Skale-style upsell. */
export function planHasMentor(plan: Plan): boolean {
  return plan === 'GROWTH' || plan === 'UNLIMITED';
}
