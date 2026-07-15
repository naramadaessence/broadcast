export const PLAN_IDS = Object.freeze({
    UNPAID: 'unpaid',
    BROADCAST: 'broadcast',
    COMMERCE: 'commerce',
});

export const VIEW_FEATURES = Object.freeze({
    overview: 'commerce',
    contacts: 'broadcast',
    broadcast: 'broadcast',
    chat: 'commerce',
    catalogue: 'commerce',
    orders: 'commerce',
    knowledge: 'commerce',
    settings: 'always',
    admin: 'admin',
});

export const PLAN_DEFINITIONS = Object.freeze({
    [PLAN_IDS.UNPAID]: Object.freeze({
        id: PLAN_IDS.UNPAID,
        displayName: 'Unpaid',
        priceMonthly: 0,
        description: 'Choose a paid plan to start using the workspace.',
    }),
    [PLAN_IDS.BROADCAST]: Object.freeze({
        id: PLAN_IDS.BROADCAST,
        displayName: 'Broadcast plan',
        priceMonthly: 399,
        description: 'Create templates and send WhatsApp broadcasts.',
    }),
    [PLAN_IDS.COMMERCE]: Object.freeze({
        id: PLAN_IDS.COMMERCE,
        displayName: 'Commerce plan',
        priceMonthly: 449,
        description: 'Everything in Broadcast plus inbox, catalogue, orders, Smart FAQs, and Smart Automation.',
    }),
});

const LEGACY_PLAN_MAP = Object.freeze({
    trial: PLAN_IDS.UNPAID,
    basic: PLAN_IDS.BROADCAST,
    paid: PLAN_IDS.COMMERCE,
    pro: PLAN_IDS.COMMERCE,
    enterprise: PLAN_IDS.COMMERCE,
});

export function normalizePlanId(planId) {
    return PLAN_IDS.COMMERCE;
}

export function isSuperAdmin(user) {
    return user?.role === 'super_admin' || user?.is_super_admin === true;
}

export function canAccessView(viewId, planId, user) {
    if (viewId === 'admin') return isSuperAdmin(user);
    return true;
}

export function getDefaultViewForPlan(planId, user) {
    if (isSuperAdmin(user)) return 'admin';
    return 'overview';
}

export function publicPlans() {
    return [PLAN_DEFINITIONS[PLAN_IDS.BROADCAST], PLAN_DEFINITIONS[PLAN_IDS.COMMERCE]];
}

export function formatPlanPrice(plan) {
    return `INR ${plan.priceMonthly}/month`;
}
