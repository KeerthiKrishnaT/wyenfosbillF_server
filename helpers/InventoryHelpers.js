import Inventory from '../models/InventoryModel.js';

export const updateInventoryOnSale = async (item) => {
  const { itemCode, itemName, quantity, rate: unitPrice, gst } = item;

  try {
    const existing = await Inventory.findOne({ itemCode });

    if (existing) {
      existing.quantity = Math.max(0, existing.quantity - quantity);
      existing.unitPrice = unitPrice;
      existing.gst = gst;
      existing.lastUpdated = new Date();
      await existing.save();
    } else {
      await Inventory.create({
        itemCode,
        itemName,
        quantity: Math.max(0, 0 - quantity),
        unitPrice,
        gst,
      });
    }
  } catch (err) {
    console.error(`Inventory update failed for itemCode ${itemCode}:`, err.message);
  }
};
