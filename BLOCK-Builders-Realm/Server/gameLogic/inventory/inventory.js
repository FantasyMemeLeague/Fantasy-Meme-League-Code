// server/gameLogic/inventory/inventory.js

const { getItem } = require('./items');
const firebaseAdmin = require('firebase-admin'); // Assume Firebase SDK is already initialized

// Example function to add an item to a player's inventory
async function addItemToInventory(playerId, itemId) {
    const item = getItem(itemId);
    if (!item) {
        throw new Error('Item not found');
    }
    // Add the item to player's inventory in Firebase
    await firebaseAdmin.firestore().collection('players').doc(playerId)
        .update({
            inventory: firebaseAdmin.firestore.FieldValue.arrayUnion(itemId)
        });
}

// Function to use an item and apply its effect
async function useItem(playerId, itemId) {
    const item = getItem(itemId);
    if (!item || !item.usable) {
        throw new Error('Item cannot be used');
    }

    // Example: Update player stats based on item effect
    const playerRef = firebaseAdmin.firestore().collection('players').doc(playerId);
    const playerData = (await playerRef.get()).data();

    // Apply item effect to player stats
    const updatedStats = { ...playerData.stats };
    Object.keys(item.effect).forEach((key) => {
        updatedStats[key] = (updatedStats[key] || 0) + item.effect[key];
    });

    // Update player stats and remove the item from inventory
    await playerRef.update({
        stats: updatedStats,
        inventory: firebaseAdmin.firestore.FieldValue.arrayRemove(itemId)
    });
}

module.exports = { addItemToInventory, useItem };
    