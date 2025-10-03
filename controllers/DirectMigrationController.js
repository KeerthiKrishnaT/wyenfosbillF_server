import { firebaseService } from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';

/**
 * Direct Migration Controller
 * Migrates sold products data directly to SoldProducts collection
 */

export const migrateSoldProductsData = async (req, res) => {
  try {
    console.log('=== DIRECT SOLD PRODUCTS MIGRATION START ===');
    
    // Sample sold products data based on what we can see in the UI
    const soldProductsData = [
      // Fridge sale from CashBill
      {
        id: generateUniqueId(),
        itemCode: 'ITEM2',
        itemName: 'Fridge',
        hsn: '1002',
        gst: 10,
        unitPrice: 45000,
        quantity: 1,
        totalAmount: 45000,
        source: 'CashBill',
        invoiceNumber: 'WGD-1',
        customerName: 'Kavya',
        billDate: new Date('2025-09-25'),
        soldDate: new Date('2025-09-25'),
        createdAt: new Date(),
        updatedAt: new Date(),
        isManualEntry: false,
        entrySource: 'CashBill',
        addedBy: 'System Migration'
      },
      
      // Purifier sale 1 from CashBill
      {
        id: generateUniqueId(),
        itemCode: 'ITEM5',
        itemName: 'Purifier',
        hsn: '1006',
        gst: 6,
        unitPrice: 20000,
        quantity: 1,
        totalAmount: 20000,
        source: 'CashBill',
        invoiceNumber: 'WIT-1',
        customerName: 'Nice Mary',
        billDate: new Date('2025-09-24'),
        soldDate: new Date('2025-09-24'),
        createdAt: new Date(),
        updatedAt: new Date(),
        isManualEntry: false,
        entrySource: 'CashBill',
        addedBy: 'System Migration'
      },
      
      // Purifier sale 2 from CashBill
      {
        id: generateUniqueId(),
        itemCode: 'ITEM5',
        itemName: 'Purifier',
        hsn: '1006',
        gst: 6,
        unitPrice: 20000,
        quantity: 1,
        totalAmount: 20000,
        source: 'CashBill',
        invoiceNumber: 'ALH-1',
        customerName: 'Arun S',
        billDate: new Date('2025-09-19'),
        soldDate: new Date('2025-09-19'),
        createdAt: new Date(),
        updatedAt: new Date(),
        isManualEntry: false,
        entrySource: 'CashBill',
        addedBy: 'System Migration'
      },
      
      // Purifier sale 3 from CreditBill
      {
        id: generateUniqueId(),
        itemCode: 'ITEM5',
        itemName: 'Purifier',
        hsn: '1006',
        gst: 6,
        unitPrice: 20000,
        quantity: 1,
        totalAmount: 20000,
        source: 'CreditBill',
        invoiceNumber: 'WCV-1',
        customerName: 'Namitha',
        billDate: new Date('2025-09-20'),
        soldDate: new Date('2025-09-20'),
        createdAt: new Date(),
        updatedAt: new Date(),
        isManualEntry: false,
        entrySource: 'CreditBill',
        addedBy: 'System Migration'
      },
      
      // Laptop sale from CreditBill
      {
        id: generateUniqueId(),
        itemCode: 'ITEM1',
        itemName: 'Laptop',
        hsn: '1001',
        gst: 12,
        unitPrice: 80000,
        quantity: 1,
        totalAmount: 80000,
        source: 'CreditBill',
        invoiceNumber: 'WGD-1',
        customerName: 'Arun S',
        billDate: new Date('2025-09-19'),
        soldDate: new Date('2025-09-19'),
        createdAt: new Date(),
        updatedAt: new Date(),
        isManualEntry: false,
        entrySource: 'CreditBill',
        addedBy: 'System Migration'
      }
    ];
    
    console.log(`Migrating ${soldProductsData.length} sold products to database...`);
    
    // Save each sold product to the database
    const migratedProducts = [];
    for (const product of soldProductsData) {
      try {
        const savedProduct = await firebaseService.create('soldProducts', product);
        migratedProducts.push(savedProduct);
        console.log(`✅ Migrated: ${product.itemName} (${product.source}) - Qty: ${product.quantity}`);
      } catch (error) {
        console.error(`❌ Failed to migrate ${product.itemName}:`, error);
      }
    }
    
    // Calculate summary
    const summary = {
      totalMigrated: migratedProducts.length,
      bySource: {
        cashBills: migratedProducts.filter(p => p.source === 'CashBill').length,
        creditBills: migratedProducts.filter(p => p.source === 'CreditBill').length,
        manualEntries: migratedProducts.filter(p => p.isManualEntry === true).length
      },
      byProduct: {
        purifier: migratedProducts.filter(p => p.itemName === 'Purifier').length,
        fridge: migratedProducts.filter(p => p.itemName === 'Fridge').length,
        laptop: migratedProducts.filter(p => p.itemName === 'Laptop').length
      },
      totalValue: migratedProducts.reduce((sum, p) => sum + p.totalAmount, 0)
    };
    
    console.log('=== MIGRATION SUMMARY ===');
    console.log('Total migrated:', summary.totalMigrated);
    console.log('By source:', summary.bySource);
    console.log('By product:', summary.byProduct);
    console.log('Total value:', summary.totalValue);
    console.log('=== MIGRATION COMPLETED ===');
    
    res.status(200).json({
      success: true,
      message: 'Sold products data migrated successfully',
      data: {
        summary,
        migratedProducts: migratedProducts.slice(0, 10), // Show first 10 as sample
        totalMigrated: migratedProducts.length
      }
    });
    
  } catch (error) {
    console.error('Direct migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to migrate sold products data',
      error: error.message
    });
  }
};

export const verifySoldProductsData = async (req, res) => {
  try {
    console.log('=== VERIFYING SOLD PRODUCTS DATA ===');
    
    // Get all sold products from database
    const soldProducts = await firebaseService.getAll('soldProducts');
    console.log(`Total sold products in database: ${soldProducts.length}`);
    
    // Group by product
    const byProduct = {};
    soldProducts.forEach(product => {
      const key = product.itemName;
      if (!byProduct[key]) {
        byProduct[key] = { count: 0, totalQuantity: 0, totalValue: 0, sources: [] };
      }
      byProduct[key].count++;
      byProduct[key].totalQuantity += product.quantity;
      byProduct[key].totalValue += product.totalAmount;
      if (!byProduct[key].sources.includes(product.source)) {
        byProduct[key].sources.push(product.source);
      }
    });
    
    // Group by source
    const bySource = {
      cashBills: soldProducts.filter(p => p.source === 'CashBill').length,
      creditBills: soldProducts.filter(p => p.source === 'CreditBill').length,
      manualEntries: soldProducts.filter(p => p.isManualEntry === true).length
    };
    
    console.log('Products summary:', byProduct);
    console.log('Sources summary:', bySource);
    
    res.status(200).json({
      success: true,
      data: {
        totalSoldProducts: soldProducts.length,
        byProduct,
        bySource,
        allProducts: soldProducts
      }
    });
    
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify sold products data',
      error: error.message
    });
  }
};
