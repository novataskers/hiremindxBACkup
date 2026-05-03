export type BillingPlanId = "basic" | "pro" | "elite";

export type BillingInterval = "month";

export type BillingPlan = {
  id: BillingPlanId;
  name: string;
  description: string;
  amountPence: number;
  currency: "GBP";
  interval: BillingInterval;
  stripeProductName: string;
};

export const BILLING_PLANS: Record<BillingPlanId, BillingPlan> = {
  basic: {
    id: "basic",
    name: "Basic",
    description: "Essential access for getting started with HireMindX.",
    amountPence: 599,
    currency: "GBP",
    interval: "month",
    stripeProductName: "HireMindX Basic",
  },
  pro: {
    id: "pro",
    name: "Pro",
    description: "Advanced AI tools and unlimited productivity for power users.",
    amountPence: 999,
    currency: "GBP",
    interval: "month",
    stripeProductName: "HireMindX Pro",
  },
  elite: {
    id: "elite",
    name: "Elite",
    description: "Maximum access, priority ranking, and first access to premium opportunities.",
    amountPence: 1999,
    currency: "GBP",
    interval: "month",
    stripeProductName: "HireMindX Elite",
  },
};

export function isBillingPlanId(value: unknown): value is BillingPlanId {
  return value === "basic" || value === "pro" || value === "elite";
}

export function getBillingPlan(planId: unknown): BillingPlan | null {
  if (!isBillingPlanId(planId)) {
    return null;
  }

  return BILLING_PLANS[planId];
}

export function isActiveSubscriptionStatus(status: string | null | undefined): boolean {
  return status === "active" || status === "trialing";
}

export function getPlanPriceGbp(plan: BillingPlan): number {
  return plan.amountPence / 100;
}

export function buildCheckoutSuccessUrl(baseUrl: string, planId: BillingPlanId): string {
  return `${normalizeBaseUrl(baseUrl)}/premium?success=1&plan=${encodeURIComponent(planId)}`;
}

export function buildCheckoutCancelUrl(baseUrl: string, planId: BillingPlanId): string {
  return `${normalizeBaseUrl(baseUrl)}/premium?canceled=1&plan=${encodeURIComponent(planId)}`;
}

export function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/+$/, "");
}
