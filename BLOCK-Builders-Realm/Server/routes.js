// server/routes.js

const express = require('express');
const router = express.Router();
const { addItemToInventory, useItem } = require('./gameLogic/inventory/inventory');

router.post('/add-item', async (req, res) => {
    const { playerId, itemId } = req.body;
    try {
        await addItemToInventory(playerId, itemId);
        res.status(200).send({ message: 'Item added to inventory' });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

router.post('/use-item', async (req, res) => {
    const { playerId, itemId } = req.body;
    try {
        await useItem(playerId, itemId);
        res.status(200).send({ message: 'Item used successfully' });
    } catch (error) {
        res.status(500).send({ error: error.message });
    }
});

module.exports = router;
