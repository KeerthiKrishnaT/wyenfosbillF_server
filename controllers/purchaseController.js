import { 
  firebaseService, 
  inventoryService 
} from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';
import path from 'path';
import fs from 'fs/promises';

export const getAllPurchases = async (req, res) => {
  try {
    const purchases = await firebaseService.getAll('purchases');
    res.json({ success: true, data: purchases });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message,
    });
  }
};

export const createPurchase = async (req, res) => {
  try {
    const {
      itemCode,
      itemName,
      quantity,
      unitPrice,
      gst,
      purchaseDate,
      vendor,
      invoiceNumber,
      notes
    } = req.body;

    // Log incoming request data for debugging
    console.log('Received request body:', req.body);
    console.log('Received file:', req.file);

    // Validate required fields
    if (!itemCode || !itemName || !quantity || !unitPrice || !gst || !purchaseDate) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields',
        missing: { itemCode, itemName, quantity, unitPrice, gst, purchaseDate }
      });
    }

    let billUrl = null;
    if (req.file) {
      billUrl = `/uploads/${req.file.filename}`;
    }

    const purchaseData = {
      id: generateUniqueId(),
      itemCode,
      itemName,
      quantity: parseInt(quantity),
      unitPrice: parseFloat(unitPrice),
      gst: parseFloat(gst),
      purchaseDate,
      vendor,
      invoiceNumber,
      notes,
      billUrl,
      createdBy: req.user?.id,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newPurchase = await firebaseService.create('purchases', purchaseData);

    // Update inventory
    const allInventory = await inventoryService.getAllInventoryItems();
    const existingItem = allInventory.find(item => item.itemCode === itemCode);

    if (existingItem) {
      existingItem.quantity += parseInt(quantity);
      existingItem.unitPrice = parseFloat(unitPrice);
      existingItem.gst = parseFloat(gst);
      existingItem.lastUpdated = new Date();
      await inventoryService.updateInventoryItem(existingItem.id, existingItem);
    } else {
      const newInventoryData = {
        itemCode,
        itemName,
        quantity: parseInt(quantity),
        unitPrice: parseFloat(unitPrice),
        gst: parseFloat(gst),
        lastUpdated: new Date(),
        createdAt: new Date()
      };
      await inventoryService.createInventoryItem(newInventoryData);
    }

    res.status(201).json({ success: true, data: newPurchase });
  } catch (err) {
    console.error('Error creating purchase:', err.stack); 
    res.status(500).json({ 
      success: false, 
      message: 'Error creating purchase', 
      error: err.message,
      stack: err.stack 
    });
  }
};

export const updatePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = {
      ...req.body,
      updatedAt: new Date()
    };
    
    const updatedPurchase = await firebaseService.update('purchases', id, updateData);
    
    if (!updatedPurchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }
    res.status(200).json({ success: true, data: updatedPurchase });
  } catch (error) {
    console.error('Error updating purchase:', error);
    res.status(500).json({ success: false, message: 'Failed to update purchase', error: error.message });
  }
};

export const deletePurchase = async (req, res) => {
  try {
    const { id } = req.params;
    const deletedPurchase = await firebaseService.delete('purchases', id);
    if (!deletedPurchase) {
      return res.status(404).json({ success: false, message: 'Purchase not found' });
    }
    res.status(200).json({ success: true, message: 'Purchase deleted' });
  } catch (error) {
    console.error('Error deleting purchase:', error);
    res.status(500).json({ success: false, message: 'Failed to delete purchase', error: error.message });
  }
};
