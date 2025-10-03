import { 
  inventoryService, 
  productService, 
  firebaseService 
} from '../services/firebaseService.js';
import { sendNotificationEmail } from '../services/emailService.js';

/**
 * Unified Inventory Controller
 * Uses only the soldProducts collection for all sales data
 */

export const getUnifiedInventoryAnalysis = async (req, res) => {
  try {
    console.log('=== UNIFIED INVENTORY ANALYSIS START ===');
    
    // Get all products from products collection
    const allProducts = await firebaseService.getAll('products');
    console.log('Total products in system:', allProducts.length);
    console.log('Products list:', allProducts.map(p => ({ name: p.itemName, code: p.itemCode, quantity: p.quantity })));
    
    // Get sales data from multiple sources: soldProducts, cashbills, and creditbills
    const [soldProducts, cashBills, creditBills] = await Promise.allSettled([
      firebaseService.getAll('soldProducts'),
      firebaseService.getAll('cashbills'),
      firebaseService.getAll('creditbills')
    ]);
    
    console.log('=== UNIFIED SALES DATA ===');
    console.log('Sold Products:', soldProducts.status === 'fulfilled' ? soldProducts.value.length : 0);
    console.log('Cash Bills:', cashBills.status === 'fulfilled' ? cashBills.value.length : 0);
    console.log('Credit Bills:', creditBills.status === 'fulfilled' ? creditBills.value.length : 0);
    
    // Extract all sales items from different sources
    let allSalesItems = [];
    
    // Add manual sold products
    if (soldProducts.status === 'fulfilled' && soldProducts.value) {
      allSalesItems = [...allSalesItems, ...soldProducts.value];
    }
    
    // Extract sales from cash bills
    if (cashBills.status === 'fulfilled' && cashBills.value) {
      cashBills.value.forEach(bill => {
        if (bill.items && Array.isArray(bill.items)) {
          bill.items.forEach(item => {
            allSalesItems.push({
              itemCode: item.code || item.itemCode || '',
              itemName: item.itemname || item.itemName || '',
              quantity: item.quantity || 0,
              unitPrice: item.rate || item.unitPrice || 0,
              source: 'CashBill',
              invoiceNumber: bill.invoiceNumber || bill.invoice || 'N/A',
              billId: bill.id || bill._id
            });
          });
        }
      });
    }
    
    // Extract sales from credit bills
    if (creditBills.status === 'fulfilled' && creditBills.value) {
      creditBills.value.forEach(bill => {
        if (bill.items && Array.isArray(bill.items)) {
          bill.items.forEach(item => {
            allSalesItems.push({
              itemCode: item.code || item.itemCode || '',
              itemName: item.itemname || item.itemName || '',
              quantity: item.quantity || 0,
              unitPrice: item.rate || item.unitPrice || 0,
              source: 'CreditBill',
              invoiceNumber: bill.invoiceNumber || bill.invoice || 'N/A',
              billId: bill.id || bill._id
            });
          });
        }
      });
    }
    
    console.log('Total sales items from all sources:', allSalesItems.length);
    
    // Group sales by source
    const salesBySource = {
      cashBills: allSalesItems.filter(s => s.source === 'CashBill'),
      creditBills: allSalesItems.filter(s => s.source === 'CreditBill'),
      manualEntries: allSalesItems.filter(s => s.isManualEntry === true || s.source === 'Manual Entry')
    };
    
    console.log('Sales by source:', {
      cashBills: salesBySource.cashBills.length,
      creditBills: salesBySource.creditBills.length,
      manualEntries: salesBySource.manualEntries.length
    });
    
    // Process inventory analysis for each product
    const inventoryAnalysis = allProducts.map(product => {
      console.log(`\n=== PROCESSING ${product.itemName} ===`);
      console.log('Product details:', {
        itemCode: product.itemCode,
        itemName: product.itemName,
        originalQuantity: product.quantity
      });
      
      // Find all sales for this product with improved matching
      const productSales = allSalesItems.filter(sale => {
        if (!sale.itemCode && !sale.itemName) { return false; }
        if (sale.itemCode === '' && sale.itemName === '') { return false; }
        
        // Primary match: itemCode (exact match)
        if (sale.itemCode && product.itemCode && sale.itemCode.trim() === product.itemCode.trim()) {
          console.log(`✅ Exact itemCode match: ${product.itemName} (${product.itemCode})`);
          return true;
        }
        
        // Secondary match: itemName (exact match)
        if (sale.itemName && product.itemName && sale.itemName.trim() === product.itemName.trim()) {
          console.log(`✅ Exact itemName match: ${product.itemName}`);
          return true;
        }
        
        // Tertiary match: itemName (case insensitive exact match)
        if (sale.itemName && product.itemName && 
            sale.itemName.toLowerCase().trim() === product.itemName.toLowerCase().trim()) {
          console.log(`✅ Case insensitive itemName match: ${product.itemName}`);
          return true;
        }
        
        // Quaternary match: partial name matches (case insensitive) - for purifier matching
        if (sale.itemName && product.itemName) {
          const saleName = sale.itemName.toLowerCase().trim();
          const productName = product.itemName.toLowerCase().trim();
          if ((saleName.includes(productName) || productName.includes(saleName)) &&
              saleName !== '' && productName !== '') {
            console.log(`✅ Partial itemName match: ${product.itemName} (${sale.itemName})`);
            return true;
          }
        }
        
        // Quinary match: itemCode partial match (for cases where codes have variations)
        if (sale.itemCode && product.itemCode) {
          const saleCode = sale.itemCode.toLowerCase().trim();
          const productCode = product.itemCode.toLowerCase().trim();
          if ((saleCode.includes(productCode) || productCode.includes(saleCode)) &&
              saleCode !== '' && productCode !== '') {
            console.log(`✅ Partial itemCode match: ${product.itemName} (${sale.itemCode})`);
            return true;
          }
        }
        
        return false;
      });
      
      console.log(`Found ${productSales.length} sales for ${product.itemName}`);
      
      // Special debugging for Purifier
      if (product.itemName && product.itemName.toLowerCase().includes('purifier')) {
        console.log('🔍 PURIFIER DEBUG:');
        console.log('Product:', { itemCode: product.itemCode, itemName: product.itemName, quantity: product.quantity });
        console.log('Matching sales:', productSales.map(s => ({
          itemCode: s.itemCode,
          itemName: s.itemName,
          quantity: s.quantity,
          source: s.source,
          invoice: s.invoiceNumber
        })));
      }
      
      // Deduplicate sales to prevent counting the same sale multiple times
      const uniqueSales = [];
      const seenSales = new Set();
      
      productSales.forEach(sale => {
        const saleKey = `${sale.itemCode}-${sale.itemName}-${sale.quantity}-${sale.source}-${sale.invoiceNumber}`;
        if (!seenSales.has(saleKey)) {
          seenSales.add(saleKey);
          uniqueSales.push(sale);
        } else {
          console.log(`⚠️ Duplicate sale detected and skipped: ${sale.itemName} (${sale.source})`);
        }
      });
      
      console.log(`After deduplication: ${uniqueSales.length} unique sales (was ${productSales.length})`);
      
      // Calculate total sold quantity from unique sales only
      const totalSold = uniqueSales.reduce((sum, sale) => {
        const quantity = parseInt(sale.quantity) || 0;
        console.log(`Sale: ${sale.itemName} - Quantity: ${quantity}, Source: ${sale.source}`);
        return sum + quantity;
      }, 0);
      
      // Special validation for Purifier
      if (product.itemName && product.itemName.toLowerCase().includes('purifier')) {
        console.log(`🔍 PURIFIER CALCULATION: Original=${product.quantity}, Sold=${totalSold}, Remaining=${product.quantity - totalSold}`);
        if (totalSold > 3) {
          console.log('🚨 ERROR: Purifier shows more than 3 sold! This is wrong!');
        }
      }
      
      // Calculate sales breakdown by source using deduplicated sales
      const salesBreakdown = {
        cashBills: uniqueSales.filter(s => s.source === 'CashBill').reduce((sum, s) => sum + (parseInt(s.quantity) || 0), 0),
        creditBills: uniqueSales.filter(s => s.source === 'CreditBill').reduce((sum, s) => sum + (parseInt(s.quantity) || 0), 0),
        manualEntries: uniqueSales.filter(s => s.isManualEntry === true).reduce((sum, s) => sum + (parseInt(s.quantity) || 0), 0)
      };
      
      // Calculate current stock
      const currentStock = Math.max(0, (parseInt(product.quantity) || 0) - totalSold);
      
      // Determine stock status
      let stockStatus = 'GOOD_STOCK';
      if (currentStock === 0) {
        stockStatus = 'OUT_OF_STOCK';
      } else if (currentStock <= 2) {
        stockStatus = 'LOW_STOCK';
      } else if (currentStock <= 5) {
        stockStatus = 'MEDIUM_STOCK';
      }
      
      // Calculate sales velocity (sales per day)
      const salesVelocity = productSales.length > 0 ? 
        productSales.length / Math.max(1, Math.ceil((Date.now() - new Date(product.createdAt || Date.now()).getTime()) / (1000 * 60 * 60 * 24))) : 0;
      
      // Calculate days of stock remaining
      const daysOfStock = salesVelocity > 0 ? Math.floor(currentStock / salesVelocity) : 999;
      
      // Generate alerts
      const alerts = [];
      if (currentStock === 0) {
        alerts.push({ severity: 'HIGH', message: 'Out of stock - immediate restock required' });
      } else if (currentStock <= 2) {
        alerts.push({ severity: 'HIGH', message: 'Critical low stock - restock immediately' });
      } else if (currentStock <= 5) {
        alerts.push({ severity: 'MEDIUM', message: 'Low stock - consider restocking' });
      }
      
      if (salesVelocity > 2) {
        alerts.push({ severity: 'MEDIUM', message: 'High sales velocity - monitor closely' });
      }
      
      const result = {
        productId: product.id,
        itemCode: product.itemCode,
        itemName: product.itemName,
        availableQuantity: parseInt(product.quantity) || 0,
        currentStock,
        totalSold,
        stockStatus,
        salesVelocity: Math.round(salesVelocity * 100) / 100,
        daysOfStock: daysOfStock === 999 ? 999 : Math.max(0, daysOfStock),
        unitPrice: parseFloat(product.unitPrice) || 0,
        gst: parseFloat(product.gst) || 0,
        alerts,
        salesBreakdown,
        lastUpdated: new Date()
      };
      
      console.log(`Result for ${product.itemName}:`, {
        originalQty: result.availableQuantity,
        totalSold: result.totalSold,
        currentStock: result.currentStock,
        stockStatus: result.stockStatus,
        salesBreakdown: result.salesBreakdown
      });
      
      return result;
    });
    
    // Calculate summary statistics
    const summary = {
      totalProducts: allProducts.length,
      outOfStock: inventoryAnalysis.filter(item => item.stockStatus === 'OUT_OF_STOCK').length,
      lowStock: inventoryAnalysis.filter(item => item.stockStatus === 'LOW_STOCK').length,
      mediumStock: inventoryAnalysis.filter(item => item.stockStatus === 'MEDIUM_STOCK').length,
      goodStock: inventoryAnalysis.filter(item => item.stockStatus === 'GOOD_STOCK').length,
      totalAlerts: inventoryAnalysis.reduce((sum, item) => sum + item.alerts.length, 0),
      totalValueAtRisk: inventoryAnalysis
        .filter(item => item.stockStatus === 'OUT_OF_STOCK' || item.stockStatus === 'LOW_STOCK')
        .reduce((sum, item) => sum + (item.currentStock * item.unitPrice), 0),
      rapidDepletion: inventoryAnalysis.filter(item => item.salesVelocity > 2).length
    };
    
    // Generate critical alerts
    const criticalAlerts = [];
    inventoryAnalysis.forEach(item => {
      if (item.stockStatus === 'OUT_OF_STOCK') {
        criticalAlerts.push({
          message: `${item.itemName} (${item.itemCode}) is out of stock`,
          severity: 'HIGH',
          productId: item.productId
        });
      } else if (item.stockStatus === 'LOW_STOCK') {
        criticalAlerts.push({
          message: `${item.itemName} (${item.itemCode}) has only ${item.currentStock} units left`,
          severity: 'MEDIUM',
          productId: item.productId
        });
      }
    });
    
    console.log('=== UNIFIED INVENTORY ANALYSIS COMPLETE ===');
    console.log('Summary:', summary);
    console.log('Critical alerts:', criticalAlerts.length);
    
    res.status(200).json({
      success: true,
      data: {
        inventoryAnalysis,
        summary,
        criticalAlerts,
        lastUpdated: new Date()
      }
    });
    
  } catch (error) {
    console.error('Unified inventory analysis error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze inventory',
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
