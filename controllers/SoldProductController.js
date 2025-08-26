import { billService, firebaseService, inventoryService } from '../services/firebaseService.js';
import { sendNotificationEmail } from '../services/emailService.js';
import { generateUniqueId } from '../services/firebaseService.js';

export const getAllSoldItems = async (req, res) => {
  try {
    console.log('Getting all sold items for user:', req.user);
    
    // Fetch sold products from Firebase with detailed information
    const soldProducts = await firebaseService.getAll('soldProducts', 'soldDate', 'desc');
    
    // Add additional information to each sold product
    const enhancedSoldProducts = soldProducts.map(product => ({
      ...product,
      totalAmount: (product.quantity || 0) * (product.unitPrice || 0),
      gstAmount: ((product.quantity || 0) * (product.unitPrice || 0) * (product.gst || 0)) / 100,
      formattedSoldDate: product.soldDate ? new Date(product.soldDate).toLocaleDateString() : 'N/A'
    }));
    
    console.log('Sold products fetched successfully, count:', enhancedSoldProducts.length);
    
    res.status(200).json({
      success: true,
      data: enhancedSoldProducts
    });
  } catch (error) {
    console.error('Error fetching sold items:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sold items',
      error: error.message
    });
  }
};

export const createSoldItem = async (req, res) => {
  try {
    const soldProductData = {
      id: generateUniqueId(),
      ...req.body,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const newItem = await firebaseService.create('soldProducts', soldProductData);

    // Update inventory stock
    const allInventory = await inventoryService.getAllInventoryItems();
    const updatedInventory = allInventory.find(item => item.itemCode === req.body.itemCode);
    if (updatedInventory) {
      updatedInventory.quantity -= Number(req.body.quantity);
      await inventoryService.updateInventoryItem(updatedInventory.id, updatedInventory);
      // Trigger alert if inventory goes below threshold
      if (updatedInventory.quantity <= 5) {
        await sendNotificationEmail({
          type: 'low_stock',
          recipient: process.env.SUPER_ADMIN_EMAIL,
          invoiceNo: updatedInventory.itemCode,
          requester: 'Auto Inventory Watch',
          notificationId: updatedInventory.id
        });
      }
    }
    res.status(201).json({ success: true, data: newItem });
  } catch (error) {
    console.error('Create sold item error:', error);
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        details: error.errors,
      });
    }
    res.status(400).json({ success: false, message: error.message });
  }
};

export const updateSoldItem = async (req, res) => {
  try {
    const updated = await firebaseService.update('soldProducts', req.params.id, req.body);
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Sold item not found' });
    }
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
