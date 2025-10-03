import { firebaseService } from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';

/**
 * Sales Migration Controller
 * Consolidates all sales data (cashbills, creditbills, manual entries) into soldProducts collection
 */

export const migrateAllSalesToSoldProducts = async (req, res) => {
  try {
    console.log('=== STARTING SALES MIGRATION ===');
    
    const migratedItems = [];
    let totalMigrated = 0;
    
    // 1. Migrate Cash Bills to Sold Products
    console.log('1. Migrating Cash Bills...');
    const cashBills = await firebaseService.getAll('cashbills');
    console.log(`Found ${cashBills.length} cash bills`);
    
    for (const bill of cashBills) {
      if (bill.items && Array.isArray(bill.items)) {
        for (const item of bill.items) {
          const soldProduct = {
            id: generateUniqueId(),
            itemCode: item.code || item.itemCode || item.productCode || '',
            itemName: item.itemname || item.itemName || item.description || item.productName || '',
            hsn: item.hsnSac || item.hsn || item.sac || '',
            gst: item.taxRate || item.gstRate || item.gst || 0,
            unitPrice: item.rate || item.unitPrice || item.unitRate || 0,
            quantity: item.quantity || item.qty || 1,
            totalAmount: (item.quantity || 1) * (item.rate || 0),
            source: 'CashBill',
            invoiceNumber: bill.invoiceNumber || bill.invoice || bill.billNumber || 'N/A',
            customerName: bill.customerName || bill.customer || 'N/A',
            billDate: bill.billDate || bill.date || bill.createdAt,
            soldDate: bill.billDate || bill.date || bill.createdAt || new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            isManualEntry: false,
            entrySource: 'CashBill',
            addedBy: 'System Migration'
          };
          
          await firebaseService.create('soldProducts', soldProduct);
          migratedItems.push(soldProduct);
          totalMigrated++;
        }
      }
    }
    console.log(`Migrated ${totalMigrated} items from cash bills`);
    
    // 2. Migrate Credit Bills to Sold Products
    console.log('2. Migrating Credit Bills...');
    const creditBills = await firebaseService.getAll('creditbills');
    console.log(`Found ${creditBills.length} credit bills`);
    
    for (const bill of creditBills) {
      if (bill.items && Array.isArray(bill.items)) {
        for (const item of bill.items) {
          const soldProduct = {
            id: generateUniqueId(),
            itemCode: item.code || item.itemCode || item.productCode || '',
            itemName: item.description || item.itemName || item.itemname || item.productName || '',
            hsn: item.hsnSac || item.hsn || item.sac || '',
            gst: item.taxRate || item.gstRate || item.gst || 0,
            unitPrice: item.rate || item.unitPrice || item.unitRate || 0,
            quantity: item.quantity || item.qty || 1,
            totalAmount: (item.quantity || 1) * (item.rate || 0),
            source: 'CreditBill',
            invoiceNumber: bill.invoiceNumber || bill.invoice || bill.billNumber || 'N/A',
            customerName: bill.customerName || bill.customer || 'N/A',
            billDate: bill.billDate || bill.date || bill.createdAt,
            soldDate: bill.billDate || bill.date || bill.createdAt || new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            isManualEntry: false,
            entrySource: 'CreditBill',
            addedBy: 'System Migration'
          };
          
          await firebaseService.create('soldProducts', soldProduct);
          migratedItems.push(soldProduct);
          totalMigrated++;
        }
      }
    }
    console.log(`Migrated ${totalMigrated} items from credit bills`);
    
    // 3. Check for existing manual entries in soldProducts
    console.log('3. Checking existing manual entries...');
    const existingSoldProducts = await firebaseService.getAll('soldProducts');
    const manualEntries = existingSoldProducts.filter(item => 
      item.isManualEntry === true || 
      item.source === 'Manual Entry' || 
      item.entrySource === 'Manual Entry'
    );
    console.log(`Found ${manualEntries.length} existing manual entries`);
    
    // 4. Generate migration summary
    const summary = {
      totalMigrated,
      cashBillsProcessed: cashBills.length,
      creditBillsProcessed: creditBills.length,
      manualEntriesFound: manualEntries.length,
      totalSoldProducts: existingSoldProducts.length + totalMigrated,
      migrationDate: new Date(),
      status: 'completed'
    };
    
    console.log('=== MIGRATION SUMMARY ===');
    console.log('Total items migrated:', totalMigrated);
    console.log('Cash bills processed:', cashBills.length);
    console.log('Credit bills processed:', creditBills.length);
    console.log('Manual entries found:', manualEntries.length);
    console.log('=== MIGRATION COMPLETED ===');
    
    res.status(200).json({
      success: true,
      message: 'Sales migration completed successfully',
      data: {
        summary,
        migratedItems: migratedItems.slice(0, 10), // Show first 10 items as sample
        totalMigrated
      }
    });
    
  } catch (error) {
    console.error('Sales migration error:', error);
    res.status(500).json({
      success: false,
      message: 'Sales migration failed',
      error: error.message
    });
  }
};

export const getUnifiedSalesData = async (req, res) => {
  try {
    console.log('Fetching unified sales data...');
    
    // Get all sold products (unified sales data)
    const soldProducts = await firebaseService.getAll('soldProducts', 'soldDate', 'desc');
    
    // Group by source for summary
    const sourceSummary = {
      cashBills: soldProducts.filter(item => item.source === 'CashBill').length,
      creditBills: soldProducts.filter(item => item.source === 'CreditBill').length,
      manualEntries: soldProducts.filter(item => item.isManualEntry === true).length,
      total: soldProducts.length
    };
    
    // Calculate total sales value
    const totalSalesValue = soldProducts.reduce((sum, item) => {
      return sum + (item.totalAmount || (item.quantity * item.unitPrice) || 0);
    }, 0);
    
    console.log('Unified sales data summary:', sourceSummary);
    console.log('Total sales value:', totalSalesValue);
    
    res.status(200).json({
      success: true,
      data: {
        soldProducts,
        summary: {
          ...sourceSummary,
          totalSalesValue,
          lastUpdated: new Date()
        }
      }
    });
    
  } catch (error) {
    console.error('Error fetching unified sales data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch unified sales data',
      error: error.message
    });
  }
};

export const clearSoldProductsCollection = async (req, res) => {
  try {
    console.log('Clearing soldProducts collection...');
    
    // Get all sold products
    const soldProducts = await firebaseService.getAll('soldProducts');
    console.log(`Found ${soldProducts.length} sold products to clear`);
    
    // Delete all sold products
    for (const product of soldProducts) {
      await firebaseService.delete('soldProducts', product.id);
    }
    
    console.log('SoldProducts collection cleared successfully');
    
    res.status(200).json({
      success: true,
      message: 'SoldProducts collection cleared successfully',
      deletedCount: soldProducts.length
    });
    
  } catch (error) {
    console.error('Error clearing soldProducts collection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear soldProducts collection',
      error: error.message
    });
  }
};
