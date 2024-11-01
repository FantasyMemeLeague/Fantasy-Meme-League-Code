// subscriptionConfig.js

const SUBSCRIPTIONS = {
    free: {
        level: "Free",
        features: ["basic_gameplay", "limited_inventory"],
        restrictions: {
            maxInventorySlots: 10,           // Example: limited to 10 inventory slots
            maxDailyActions: 20,             // Example: limit to 20 actions per day
            accessToPremiumAreas: false,     // No access to premium areas
            resourceCap: { gold: 100, gems: 10 }  // Cap on specific resources
        }
    },
    pro: {
        level: "Pro",
        price: 9.99,  // Monthly price in USD
        features: ["basic_gameplay", "unlimited_inventory", "pro_levels", "premium_support"],
        restrictions: {}  // No restrictions for Pro
    },
    vip: {
        level: "VIP",
        price: 19.99,  // Monthly price in USD
        features: ["basic_gameplay", "unlimited_inventory", "vip_levels", "exclusive_items", "priority_support"],
        restrictions: {}  // No restrictions for VIP
    }
};

export { SUBSCRIPTIONS };
