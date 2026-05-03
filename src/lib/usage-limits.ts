import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { userUsageLimits, subscriptions } from '@/db/schema';
import { isActiveSubscriptionStatus, getBillingPlan } from '@/lib/billing';

// Map specific feature strings used in the codebase to their corresponding limit bucket
const featureGroupMap: Record<string, 'deep' | 'outreach' | 'attachment' | 'chat' | 'community' | 'match' | 'premium_only'> = {
  // Deep Features (Limit 2, Lifetime)
  market_analysis: 'deep',
  ai_prediction: 'deep',
  deep_research: 'deep',
  live_coding: 'deep',
  
  // Outreach / Other special features (Limit 2, Lifetime)
  email_outreach: 'outreach',
  exam_questions: 'outreach',
  
  // Match / Bulk CV & Interviews (Limit 1, Lifetime)
  bulk_cv_analysis: 'match',
  interview_questions: 'match',

  // Community AI Agent (Limit 1, Lifetime)
  community_ai_agent: 'community',

  // Premium Only Community Features (Limit 0, Lifetime)
  community_messaging: 'premium_only',
  community_post: 'premium_only',
  
  // Attachments (Limit 3, Daily)
  file_uploads: 'attachment',
  
  // Chat Messages (Limit 30, Daily)
  chat_messages: 'chat',
};

const LIMITS = {
  deep: 2,
  outreach: 2,
  attachment: 3,
  chat: 30,
  community: 1,
  match: 1,
  premium_only: 0,
};

const IS_LIFETIME = {
  deep: true,
  outreach: true,
  attachment: false,
  chat: false,
  community: true,
  match: true,
  premium_only: true,
};

export type UsageResult = {
  allowed: boolean;
  upgradeMessage: string;
  currentUsage: number;
  limit: number;
  remaining: number;
  plan: string;
};

export async function useFeature(userId: string, feature: string): Promise<UsageResult> {
  const group = featureGroupMap[feature];

  // Fail closed: if the feature is unknown, do not apply any default bucket.
  if (!group) {
    return {
      allowed: false,
      upgradeMessage: "We couldn't verify this action. Please try again in a moment.",
      currentUsage: 0,
      limit: 0,
      remaining: 0,
      plan: "Free",
    };
  }

  const limit = LIMITS[group];
  const isLifetime = IS_LIFETIME[group];

  const resultTemplate = {
    allowed: true,
    upgradeMessage: "",
    currentUsage: 0,
    limit: limit,
    remaining: limit,
    plan: "Free",
  };

  try {
    const subscriptionRows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    const subscription = subscriptionRows[0];
    const isPremium = subscription && isActiveSubscriptionStatus(subscription.status) && !subscription.cancelAtPeriodEnd;

    if (isPremium) {
      const planInfo = getBillingPlan(subscription.planId);
      return {
        ...resultTemplate,
        plan: planInfo?.name || "Premium",
        limit: Infinity,
        remaining: Infinity,
      };
    }

    const now = new Date();

    let usageRowRows = await db
      .select()
      .from(userUsageLimits)
      .where(eq(userUsageLimits.userId, userId))
      .limit(1);

    let usageRow = usageRowRows[0];

    if (!usageRow) {
      // Avoid relying on SQLite `RETURNING` support here.
      // If INSERT fails, we want to fail closed below (not allow unlimited usage).
      await db.insert(userUsageLimits).values({
        userId,
        updatedAt: now.toISOString()
      });
      
      // Re-fetch the row we just created.
      usageRowRows = await db
        .select()
        .from(userUsageLimits)
        .where(eq(userUsageLimits.userId, userId))
        .limit(1);
      
      usageRow = usageRowRows[0];
    }

    let count = 0;
    let resetAtStr: string | null = null;
    
    if (group === 'premium_only') {
      count = 0;
    } else if (group === 'deep') {
      count = usageRow.deepFeaturesCount;
      resetAtStr = usageRow.deepFeaturesResetAt;
    } else if (group === 'outreach') {
      count = usageRow.outreachFeaturesCount;
      resetAtStr = usageRow.outreachFeaturesResetAt;
    } else if (group === 'attachment') {
      count = usageRow.attachmentCount;
      resetAtStr = usageRow.attachmentResetAt;
    } else if (group === 'chat') {
      count = usageRow.chatMessageCount;
      resetAtStr = usageRow.chatMessageResetAt;
    } else if (group === 'community') {
      count = usageRow.communityCount;
    } else if (group === 'match') {
      count = usageRow.matchCount;
    }

    let resetAt = resetAtStr ? new Date(resetAtStr) : null;
    let isReset = false;

    // Only apply 24h reset if it's NOT a lifetime limit
    if (!isLifetime && resetAt && now > resetAt) {
      count = 0;
      isReset = true;
    }

    const remaining = Math.max(0, limit - count);
    const allowed = remaining > 0;

    if (!allowed) {
      const resetMessage = isLifetime 
        ? "Upgrade to a Premium plan to get unlimited access."
        : "Upgrade to a Premium plan to get unlimited access, or wait 24 hours for it to reset.";

      return {
        allowed: false,
        upgradeMessage: `You've reached your free limit for this feature. ${resetMessage}`,
        currentUsage: count,
        limit,
        remaining: 0,
        plan: "Free"
      };
    }

    const newCount = count + 1;
    let newResetAtStr = resetAtStr;

    if (!isLifetime) {
      if (count === 0 || !resetAt || isReset) {
        newResetAtStr = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString();
      }
    }

    const updateData: any = { updatedAt: now.toISOString() };
    
    if (group === 'premium_only') {
      // Do nothing, do not track usage
    } else if (group === 'deep') {
      updateData.deepFeaturesCount = newCount;
    } else if (group === 'outreach') {
      updateData.outreachFeaturesCount = newCount;
    } else if (group === 'attachment') {
      updateData.attachmentCount = newCount;
      updateData.attachmentResetAt = newResetAtStr;
    } else if (group === 'chat') {
      updateData.chatMessageCount = newCount;
      updateData.chatMessageResetAt = newResetAtStr;
    } else if (group === 'community') {
      updateData.communityCount = newCount;
    } else if (group === 'match') {
      updateData.matchCount = newCount;
    }

    await db
      .update(userUsageLimits)
      .set(updateData)
      .where(eq(userUsageLimits.userId, userId));

    return {
      allowed: true,
      upgradeMessage: "",
      currentUsage: newCount,
      limit,
      remaining: limit - newCount,
      plan: "Free"
    };
  } catch (error) {
    console.error(`Error in useFeature for ${feature}:`, error);
    // Fail closed: free users must not get unlimited access if the usage-limit check breaks.
    return {
      ...resultTemplate,
      allowed: false,
      upgradeMessage: "We couldn't verify your usage limit right now. Please try again in a moment.",
      currentUsage: 0,
      remaining: 0,
      plan: "Free",
    };
  }
}

export async function getUsageSummary(userId: string) {
  try {
    const subscriptionRows = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);

    const subscription = subscriptionRows[0];
    const isPremium = subscription && isActiveSubscriptionStatus(subscription.status) && !subscription.cancelAtPeriodEnd;
    const planName = isPremium ? (getBillingPlan(subscription.planId)?.name || "Premium") : "Free";

    let usageRowRows = await db
      .select()
      .from(userUsageLimits)
      .where(eq(userUsageLimits.userId, userId))
      .limit(1);

    let usageRow = usageRowRows[0];
    const now = new Date();

    const getGroupData = (group: keyof typeof LIMITS, count: number, resetAtStr: string | null) => {
      const isLifetime = IS_LIFETIME[group as keyof typeof IS_LIFETIME];
      const limit = LIMITS[group];
      const resetAt = resetAtStr ? new Date(resetAtStr) : null;
      
      let effectiveCount = count;
      if (!isLifetime && resetAt && now > resetAt) {
        effectiveCount = 0;
      }

      return {
        count: isPremium ? 0 : effectiveCount,
        limit: isPremium ? Infinity : limit,
        remaining: isPremium ? Infinity : Math.max(0, limit - effectiveCount),
        resetAt: isLifetime ? null : resetAt,
        isLifetime
      };
    };

    if (!usageRow) {
      return {
        plan: planName,
        deep: getGroupData('deep', 0, null),
        outreach: getGroupData('outreach', 0, null),
        attachment: getGroupData('attachment', 0, null),
        chat: getGroupData('chat', 0, null),
        community: getGroupData('community', 0, null),
        match: getGroupData('match', 0, null),
      };
    }

    return {
      plan: planName,
      deep: getGroupData('deep', usageRow.deepFeaturesCount, usageRow.deepFeaturesResetAt),
      outreach: getGroupData('outreach', usageRow.outreachFeaturesCount, usageRow.outreachFeaturesResetAt),
      attachment: getGroupData('attachment', usageRow.attachmentCount, usageRow.attachmentResetAt),
      chat: getGroupData('chat', usageRow.chatMessageCount, usageRow.chatMessageResetAt),
      community: getGroupData('community', usageRow.communityCount, null),
      match: getGroupData('match', usageRow.matchCount, null),
    };
  } catch (error) {
    console.error("Error in getUsageSummary:", error);
    return { plan: "Free", error: "Failed to load usage summary" };
  }
}
