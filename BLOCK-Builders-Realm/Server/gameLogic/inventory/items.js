// server/gameLogic/inventory/items.js

const items = {
    healthPotion: {
        id: 'healthPotion',
        name: 'Health Potion',
        effect: { health: +50 },
        description: 'Restores 50 health points.',
        usable: true
    },
    sword: {
        id: 'sword',
        name: 'Steel Sword',
        effect: { attack: +10 },
        description: 'Increases attack by 10 points.',
        usable: false  // Equipment rather than consumable
    },
    nftBoost: {
        id: 'nftBoost',
        name: 'NFT Power Boost',
        effect: { strength: +5, speed: +3 },
        description: 'Temporary stat boost provided by NFT.',
        usable: true
    }
};

// Function to retrieve item details
function getItem(itemId) {
    return items[itemId] || null;
}

module.exports = { getItem };
