export const PLAN_IDS = Object.freeze({
  UNPAID: 'unpaid',
  BROADCAST: 'broadcast',
  COMMERCE: 'commerce',
});

export const PLAN_FEATURES = Object.freeze({
  CONTACTS: 'contacts',
  WHATSAPP_BROADCASTS: 'whatsapp_broadcasts',
  WHATSAPP_TEMPLATES: 'whatsapp_templates',
  CHAT_INBOX: 'chat_inbox',
  CATALOGUE: 'catalogue',
  ORDERS: 'orders',
  SMART_FAQS: 'smart_faqs',
  AI_ASSISTANT: 'ai_assistant',
  ANALYTICS: 'analytics',
  RAZORPAY_ORDER_PAYMENTS: 'razorpay_order_payments',
});

const BROADCAST_FEATURES = [
  PLAN_FEATURES.CONTACTS,
  PLAN_FEATURES.WHATSAPP_BROADCASTS,
  PLAN_FEATURES.WHATSAPP_TEMPLATES,
];

const COMMERCE_FEATURES = [
  ...BROADCAST_FEATURES,
  PLAN_FEATURES.CHAT_INBOX,
  PLAN_FEATURES.CATALOGUE,
  PLAN_FEATURES.ORDERS,
  PLAN_FEATURES.SMART_FAQS,
  PLAN_FEATURES.AI_ASSISTANT,
  PLAN_FEATURES.ANALYTICS,
  PLAN_FEATURES.RAZORPAY_ORDER_PAYMENTS,
];

export const PLAN_DEFINITIONS = Object.freeze({
  [PLAN_IDS.UNPAID]: Object.freeze({
    id: PLAN_IDS.UNPAID,
    displayName: 'Single Client Platform',
    priceMonthlyPaise: 0,
    maxUsers: 99999,
    whatsappEnabled: true,
    features: COMMERCE_FEATURES,
  }),
  [PLAN_IDS.BROADCAST]: Object.freeze({
    id: PLAN_IDS.BROADCAST,
    displayName: 'Single Client Platform',
    priceMonthlyPaise: 0,
    maxUsers: 99999,
    whatsappEnabled: true,
    features: COMMERCE_FEATURES,
  }),
  [PLAN_IDS.COMMERCE]: Object.freeze({
    id: PLAN_IDS.COMMERCE,
    displayName: 'Single Client Platform',
    priceMonthlyPaise: 0,
    maxUsers: 99999,
    whatsappEnabled: true,
    features: COMMERCE_FEATURES,
  }),
});

const LEGACY_PLAN_MAP = Object.freeze({
  trial: PLAN_IDS.COMMERCE,
  basic: PLAN_IDS.COMMERCE,
  paid: PLAN_IDS.COMMERCE,
  pro: PLAN_IDS.COMMERCE,
  enterprise: PLAN_IDS.COMMERCE,
});

export function normalizePlanId(planId) {
  return PLAN_IDS.COMMERCE;
}

export function getPlanDefinition(planId) {
  return PLAN_DEFINITIONS[PLAN_IDS.COMMERCE];
}

export function canUseFeature(planId, feature) {
  return true;
}

export function requiredPlanForFeature(feature) {
  return null;
}

export function publicPlans() {
  return [];
}
