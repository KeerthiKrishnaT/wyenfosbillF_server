import { 
  inventoryService, 
  productService, 
  firebaseService 
} from '../services/firebaseService.js';
import { sendNotificationEmail } from '../services/emailService.js';
import PDFDocument from 'pdfkit';

export const restockInventory = async (req, res) => {
  try {
    const { itemCode, itemName, quantity, unitPrice, gst } = req.body;

    // Check if inventory item exists
    const inventoryItems = await inventoryService.getAllInventoryItems();
    let inventory = inventoryItems.find(item => item.itemCode === itemCode);

    if (inventory) {
      // Update existing inventory
      inventory.quantity += Number(quantity);
      inventory.unitPrice = unitPrice;
      inventory.gst = gst;
      inventory.lastUpdated = new Date();
      
      await inventoryService.updateInventoryItem(inventory.id, inventory);
    } else {
      // Create new inventory item
      const inventoryData = {
        itemCode,
        itemName,
        quantity: Number(quantity),
        unitPrice,
        gst,
        lastUpdated: new Date(),
        createdAt: new Date()
      };
      
      inventory = await inventoryService.createInventoryItem(inventoryData);
    }

    res.status(200).json({ success: true, message: 'Inventory updated', data: inventory });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to restock', error: error.message });
  }
};

export const getLowStockAlerts = async (req, res) => {
  try {
    const threshold = parseInt(req.query.threshold || 5);
    const allItems = await inventoryService.getAllInventoryItems();

    const levelOne = allItems.filter(item => item.quantity > 2 && item.quantity <= threshold);
    const levelTwo = allItems.filter(item => item.quantity <= 2);
    const noStock = allItems.filter(item => item.quantity <= 0);

    // Send notifications for level two alerts
    for (const item of levelTwo) {
      await sendNotificationEmail({
        type: 'low_stock',
        recipient: process.env.SUPER_ADMIN_EMAIL,
        invoiceNo: item.itemCode,
        requester: 'Inventory System',
        notificationId: item.id
      });
    }

    return res.json({ levelOne, levelTwo, noStock });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getAllInventory = async (req, res) => {
  try {
    
    // Get inventory with sales data
    const data = await inventoryService.getInventoryWithSales();
    
    // If no data, return empty array instead of error
    if (!data || data.length === 0) {
      return res.status(200).json({ success: true, data: [] });
    }
    
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('Error in getAllInventory:', error);
    console.error('Error stack:', error.stack);
    
    // If it's a collection not found error, return empty array
    if (error.code === 'not-found' || error.message.includes('not found')) {
      return res.status(200).json({ success: true, data: [] });
    }
    
    res.status(500).json({ success: false, message: 'Failed to fetch inventory', error: error.message });
  }
};

export const calculateStockBalance = async () => {
  try {
    const inventoryItems = await inventoryService.getAllInventoryItems();

    for (const item of inventoryItems) {
      let previousBalance = item.quantity;

      // Get sold products data
      const soldProducts = await firebaseService.getAll('soldProducts');
      const salesData = soldProducts.filter(product => product.itemCode === item.itemCode);
      const soldQuantity = salesData.reduce((total, product) => total + (product.quantity || 0), 0);

      const balance = item.quantity - soldQuantity;

      // Update inventory with new balance
      await inventoryService.updateInventoryItem(item.id, { quantity: balance });

      const avgStock = await calculateAverageStock(item.itemCode);
      
      if (avgStock < 5) {
        await triggerRestockAlert(item, avgStock);
      }
    }

    return { success: true, message: 'Inventory balance and average calculated successfully.' };
  } catch (error) {
    console.error('Error calculating stock balance:', error);
    return { success: false, message: error.message };
  }
};

export const calculateAverageStock = async (itemCode) => {
  try {
    const soldProducts = await firebaseService.getAll('soldProducts');
    const salesData = soldProducts.filter(product => product.itemCode === itemCode);
    
    if (salesData.length === 0) return 0;

    const totalSold = salesData.reduce((total, product) => total + (product.quantity || 0), 0);
    const totalMonths = salesData.length;
    const avgStock = totalSold / totalMonths;

    return avgStock;
  } catch (error) {
    console.error('Error calculating average stock:', error);
    return 0;
  }
};

export const triggerRestockAlert = async (item, avgStock) => {
  console.log(`ALERT: Stock of ${item.itemName} is below the threshold. Current stock: ${item.quantity}, Average stock: ${avgStock}`);
  
  // Emit socket event if io is available
  if (global.io) {
    global.io.emit('stock-alert', {
      message: `Low stock alert for ${item.itemName}: ${item.quantity} units left. Average stock: ${avgStock}`,
      itemCode: item.itemCode,
      itemName: item.itemName
    });
  }
};

export const getInventoryAlerts = async (req, res) => {
  try {
    const allInventory = await inventoryService.getAllInventoryItems();
    const allProducts = await productService.getAllProducts();

    const productIdsInInventory = allInventory.map(item => item.productId);
    const productsWithoutInventory = allProducts.filter(
      product => !productIdsInInventory.includes(product.id)
    );

    const levelOne = allInventory.filter(item => item.quantity < 5 && item.quantity >= 2);
    const levelTwo = allInventory.filter(item => item.quantity < 2);

    res.status(200).json({
      success: true,
      levelOne,
      levelTwo,
      noStock: productsWithoutInventory
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch inventory alerts',
      error: error.message,
    });
  }
};

export const exportLowStockPdf = async (req, res) => {
  try {
    const threshold = 5;
    const allInventory = await inventoryService.getAllInventoryItems();
    const items = allInventory.filter(item => item.quantity <= threshold);

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename=low_stock_report.pdf');
    doc.pipe(res);

    doc.fontSize(20).text('📦 Low/No Stock Report', { align: 'center' });
    doc.moveDown();

    items.forEach(item => {
      doc.fontSize(12).text(
        `Item: ${item.itemName} (${item.itemCode}) - Quantity: ${item.quantity}`,
        { lineGap: 6 }
      );
    });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate PDF' });
  }
};

// Test endpoint to check if server and Firebase are working
export const testInventoryConnection = async (req, res) => {
  try {
    
    // Test basic Firebase connection
    const testData = await inventoryService.getAllInventoryItems();
    
    res.json({
      success: true,
      message: 'Inventory connection test successful',
      data: {
        itemCount: testData.length,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Inventory connection test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Inventory connection test failed',
      error: error.message,
      stack: error.stack
    });
  }
};