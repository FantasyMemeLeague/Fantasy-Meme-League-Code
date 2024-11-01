import { SUBSCRIPTIONS } from './subscriptionConfig.js';
import { getSubscriptionLevel } from './subscriptionService.js';

// Track daily actions for users (in a real game, store in a database)
const userActionCount = {};  

async function checkActionLimit(userId) {
    const level = await getSubscriptionLevel(userId);
    const subscription = SUBSCRIPTIONS[level] || SUBSCRIPTIONS.free;

    if (level === "free" && subscription.restrictions.maxDailyActions) {
        const today = new Date().toDateString();
        userActionCount[userId] = userActionCount[userId] || {};
        userActionCount[userId][today] = userActionCount[userId][today] || 0;

        if (userActionCount[userId][today] >= subscription.restrictions.maxDailyActions) {
            return false;  // Action limit reached
        }

        // Increment action count
        userActionCount[userId][today] += 1;
    }

    return true;  // Action allowed
}

async function hasFeatureAccess(userId, feature) {
    const level = await getSubscriptionLevel(userId);
    const subscription = SUBSCRIPTIONS[level] || SUBSCRIPTIONS.free;
    return subscription.features.includes(feature);
}

export { checkActionLimit, hasFeatureAccess };
