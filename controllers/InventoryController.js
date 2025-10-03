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

// New comprehensive inventory analysis with alerts
export const getInventoryAnalysis = async (req, res) => {
  try {
    console.log('=== CAREFUL INVENTORY ANALYSIS START ===');
    
    // Get all products from products collection
    const allProducts = await firebaseService.getAll('products');
    console.log('Total products in system:', allProducts.length);
    console.log('Products list:', allProducts.map(p => ({ name: p.itemName, code: p.itemCode, quantity: p.quantity })));
    
    // Get all sold products from multiple sources
    const [soldProducts, cashBills, creditBills] = await Promise.allSettled([
      firebaseService.getAll('soldProducts'),
      firebaseService.getAll('cashbills'),
      firebaseService.getAll('creditbills')
    ]);
    
    // Additional fallback: Try to get sold products from different possible collections
    let fallbackSoldProducts = null;
    try {
      // Try alternative collection names
      const alternativeCollections = ['sold-products', 'sold_products', 'solditems'];
      for (const collectionName of alternativeCollections) {
        try {
          const altData = await firebaseService.getAll(collectionName);
          if (altData && altData.length > 0) {
            console.log(`Found sold products in alternative collection: ${collectionName}`);
            fallbackSoldProducts = altData;
            break;
          }
        } catch (err) {
          console.log(`Collection ${collectionName} not found or empty`);
        }
      }
    } catch (error) {
      console.log('No alternative sold products collections found');
    }
    
    // If no sold products found in dedicated collections, extract from bills
    if ((!soldProducts.status === 'fulfilled' || !soldProducts.value || soldProducts.value.length === 0) && 
        (!fallbackSoldProducts || fallbackSoldProducts.length === 0)) {
      console.log('=== EXTRACTING SOLD PRODUCTS FROM BILLS ===');
      console.log('No dedicated sold products collection found, extracting from cash and credit bills...');
      
      // This will be handled in the cash bills and credit bills processing below
      // The sold products will be extracted from the bills and added to allSoldItems
    }
    
    console.log('=== DATA SOURCES ===');
    console.log('Sold products count:', soldProducts.status === 'fulfilled' ? soldProducts.value.length : 0);
    console.log('Cash bills count:', cashBills.status === 'fulfilled' ? cashBills.value.length : 0);
    console.log('Credit bills count:', creditBills.status === 'fulfilled' ? creditBills.value.length : 0);
    
    // Process sold products from all sources with careful tracking
    let allSoldItems = [];
    let salesSummary = {
      manualEntries: { count: 0, totalQuantity: 0 },
      cashBills: { count: 0, totalQuantity: 0 },
      creditBills: { count: 0, totalQuantity: 0 }
    };
    
    // From soldProducts collection (Manual Entries)
    if (soldProducts.status === 'fulfilled' && soldProducts.value) {
      console.log('=== MANUAL ENTRIES PROCESSING ===');
      console.log('Raw soldProducts data:', soldProducts.value);
      console.log('SoldProducts data type:', typeof soldProducts.value);
      console.log('SoldProducts is array:', Array.isArray(soldProducts.value));
      
      // Handle both array and object responses
      let soldProductsData = Array.isArray(soldProducts.value) ? soldProducts.value : 
                              (soldProducts.value.data ? soldProducts.value.data : []);
      
      // Use fallback data if main collection is empty
      if (soldProductsData.length === 0 && fallbackSoldProducts) {
        console.log('Using fallback sold products data');
        soldProductsData = fallbackSoldProducts;
      }
      
      console.log('Processed soldProducts data:', soldProductsData);
      console.log('Processed soldProducts length:', soldProductsData.length);
      
      // If still no data, try to get from alternative sources
      if (soldProductsData.length === 0) {
        console.log('No sold products found in main collection, checking alternative sources...');
        try {
          // Try to get from sold-products collection (with hyphen)
          const altSoldProducts = await firebaseService.getAll('sold-products');
          if (altSoldProducts && altSoldProducts.length > 0) {
            console.log('Found sold products in sold-products collection');
            soldProductsData = altSoldProducts;
          }
        } catch (err) {
          console.log('sold-products collection not found');
        }
      }
      
      soldProductsData.forEach((product, index) => {
        console.log(`Manual Entry ${index + 1}:`, {
          id: product.id,
          itemCode: product.itemCode,
          itemName: product.itemName,
          quantity: product.quantity,
          source: product.source || product.entrySource || 'Manual Entry',
          addedBy: product.addedBy,
          soldDate: product.soldDate || product.date
        });
        
        const soldItem = {
          id: product.id || `manual-${index}`,
          itemCode: product.itemCode || '',
          itemName: product.itemName || '',
          quantity: Number(product.quantity) || 0,
          soldDate: product.soldDate || product.date || product.createdAt || new Date(),
          source: product.source || product.entrySource || 'Manual Entry',
          invoice: product.invoice || `MAN-${product.id?.slice(-6) || 'N/A'}`,
          addedBy: product.addedBy || 'Purchase Admin'
        };
        
        allSoldItems.push(soldItem);
        salesSummary.manualEntries.count++;
        salesSummary.manualEntries.totalQuantity += soldItem.quantity;
      });
      
      console.log('Manual entries processed:', soldProductsData.length);
      console.log('Manual entries summary:', salesSummary.manualEntries);
      console.log('=== END MANUAL ENTRIES PROCESSING ===');
    } else if (fallbackSoldProducts && fallbackSoldProducts.length > 0) {
      // Process fallback sold products if main collection failed
      console.log('=== FALLBACK MANUAL ENTRIES PROCESSING ===');
      console.log('Using fallback sold products data:', fallbackSoldProducts);
      
      fallbackSoldProducts.forEach((product, index) => {
        console.log(`Fallback Manual Entry ${index + 1}:`, {
          id: product.id,
          itemCode: product.itemCode,
          itemName: product.itemName,
          quantity: product.quantity,
          source: product.source || product.entrySource || 'Manual Entry',
          addedBy: product.addedBy,
          soldDate: product.soldDate || product.date
        });
        
        const soldItem = {
          id: product.id || `fallback-manual-${index}`,
          itemCode: product.itemCode || '',
          itemName: product.itemName || '',
          quantity: Number(product.quantity) || 0,
          soldDate: product.soldDate || product.date || product.createdAt || new Date(),
          source: product.source || product.entrySource || 'Manual Entry',
          invoice: product.invoice || `FALLBACK-MAN-${product.id?.slice(-6) || 'N/A'}`,
          addedBy: product.addedBy || 'Purchase Admin'
        };
        
        allSoldItems.push(soldItem);
        salesSummary.manualEntries.count++;
        salesSummary.manualEntries.totalQuantity += soldItem.quantity;
      });
      
      console.log('Fallback manual entries processed:', fallbackSoldProducts.length);
      console.log('Fallback manual entries summary:', salesSummary.manualEntries);
      console.log('=== END FALLBACK MANUAL ENTRIES PROCESSING ===');
    }
    
    // From cashbills
    if (cashBills.status === 'fulfilled' && cashBills.value) {
      console.log('=== CASH BILLS PROCESSING ===');
      console.log('Total cash bills to process:', cashBills.value.length);
      
      cashBills.value.forEach((bill, billIndex) => {
        console.log(`Cash Bill ${billIndex + 1}:`, {
          id: bill.id || bill._id,
          invoiceNumber: bill.invoiceNumber || bill.invoice,
          customerName: bill.customerName,
          itemsCount: bill.items ? bill.items.length : 0,
          createdAt: bill.createdAt || bill.date
        });
        
        if (bill.items && Array.isArray(bill.items)) {
          bill.items.forEach((item, itemIndex) => {
            const soldItem = {
              id: `${bill.id || bill._id}-cash-${itemIndex}`,
              itemCode: item.code || item.itemCode || '',
              itemName: item.itemname || item.itemName || item.description || '',
              quantity: item.quantity || 0,
              soldDate: bill.createdAt || bill.date || new Date(),
              source: 'CashBill',
              invoice: bill.invoiceNumber || bill.invoice || 'N/A',
              customerName: bill.customerName || 'N/A'
            };
            
            console.log(`  Item ${itemIndex + 1}:`, {
              itemCode: soldItem.itemCode,
              itemName: soldItem.itemName,
              quantity: soldItem.quantity,
              rate: item.rate || item.unitPrice || 0
            });
            
            allSoldItems.push(soldItem);
            salesSummary.cashBills.count++;
            salesSummary.cashBills.totalQuantity += soldItem.quantity;
          });
        }
      });
      
      console.log('Cash bills summary:', salesSummary.cashBills);
      console.log('=== END CASH BILLS PROCESSING ===');
    }
    
    // From creditbills
    if (creditBills.status === 'fulfilled' && creditBills.value) {
      console.log('=== CREDIT BILLS PROCESSING ===');
      console.log('Total credit bills to process:', creditBills.value.length);
      
      creditBills.value.forEach((bill, billIndex) => {
        console.log(`Credit Bill ${billIndex + 1}:`, {
          id: bill.id || bill._id,
          invoiceNumber: bill.invoiceNumber || bill.invoice,
          customerName: bill.customerName,
          itemsCount: bill.items ? bill.items.length : 0,
          createdAt: bill.createdAt || bill.date
        });
        
        if (bill.items && Array.isArray(bill.items)) {
          bill.items.forEach((item, itemIndex) => {
            const soldItem = {
              id: `${bill.id || bill._id}-credit-${itemIndex}`,
              itemCode: item.code || item.itemCode || '',
              itemName: item.description || item.itemName || item.itemname || '',
              quantity: item.quantity || 0,
              soldDate: bill.createdAt || bill.date || new Date(),
              source: 'CreditBill',
              invoice: bill.invoiceNumber || bill.invoice || 'N/A',
              customerName: bill.customerName || 'N/A'
            };
            
            console.log(`  Item ${itemIndex + 1}:`, {
              itemCode: soldItem.itemCode,
              itemName: soldItem.itemName,
              quantity: soldItem.quantity,
              rate: item.rate || item.unitPrice || 0
            });
            
            allSoldItems.push(soldItem);
            salesSummary.creditBills.count++;
            salesSummary.creditBills.totalQuantity += soldItem.quantity;
          });
        }
      });
      
      console.log('Credit bills summary:', salesSummary.creditBills);
      console.log('=== END CREDIT BILLS PROCESSING ===');
    }
    
    console.log('=== COMPREHENSIVE SALES SUMMARY ===');
    console.log('Total sold items processed:', allSoldItems.length);
    console.log('Sales summary by source:', salesSummary);
    console.log('Sample sold items:', allSoldItems.slice(0, 5));
    
    // Debug: Show all sold items with their details
    console.log('=== ALL SOLD ITEMS DEBUG ===');
    allSoldItems.forEach((item, index) => {
      console.log(`Sold Item ${index + 1}:`, {
        itemCode: item.itemCode,
        itemName: item.itemName,
        quantity: item.quantity,
        source: item.source
      });
    });
    console.log('=== END ALL SOLD ITEMS DEBUG ===');
    
    // Debug: Show all products with their details
    console.log('=== ALL PRODUCTS DEBUG ===');
    allProducts.forEach((product, index) => {
      console.log(`Product ${index + 1}:`, {
        itemCode: product.itemCode,
        itemName: product.itemName,
        quantity: product.quantity
      });
    });
    console.log('=== END ALL PRODUCTS DEBUG ===');
    
    // Debug: Show breakdown by source
    const sourceBreakdown = allSoldItems.reduce((acc, item) => {
      acc[item.source] = (acc[item.source] || 0) + 1;
      return acc;
    }, {});
    console.log('Sold items by source (count):', sourceBreakdown);
    
    const quantityBreakdown = allSoldItems.reduce((acc, item) => {
      acc[item.source] = (acc[item.source] || 0) + (item.quantity || 0);
      return acc;
    }, {});
    console.log('Sold items by source (quantities):', quantityBreakdown);
    
    // Product-by-product sales calculation
    console.log('=== PRODUCT-BY-PRODUCT SALES CALCULATION ===');
    const productSalesMap = {};
    
    allSoldItems.forEach((sale, index) => {
      const key = sale.itemCode || sale.itemName || 'unknown';
      if (!productSalesMap[key]) {
        productSalesMap[key] = {
          itemCode: sale.itemCode,
          itemName: sale.itemName,
          totalQuantity: 0,
          sales: [],
          sources: { manual: 0, cash: 0, credit: 0 }
        };
      }
      
      productSalesMap[key].totalQuantity += sale.quantity || 0;
      productSalesMap[key].sales.push({
        index: index + 1,
        source: sale.source,
        quantity: sale.quantity,
        invoice: sale.invoice,
        customer: sale.customerName || sale.addedBy || 'N/A'
      });
      
      if (sale.source === 'Manual Entry') productSalesMap[key].sources.manual += sale.quantity || 0;
      if (sale.source === 'CashBill') productSalesMap[key].sources.cash += sale.quantity || 0;
      if (sale.source === 'CreditBill') productSalesMap[key].sources.credit += sale.quantity || 0;
    });
    
    console.log('Product sales breakdown:');
    Object.keys(productSalesMap).forEach(key => {
      const product = productSalesMap[key];
      console.log(`${product.itemName} (${product.itemCode}):`, {
        totalSold: product.totalQuantity,
        manualEntries: product.sources.manual,
        cashBills: product.sources.cash,
        creditBills: product.sources.credit,
        salesCount: product.sales.length
      });
    });
    
    // Debug: Show unique item codes and names
    const uniqueItemCodes = [...new Set(allSoldItems.map(item => item.itemCode).filter(Boolean))];
    const uniqueItemNames = [...new Set(allSoldItems.map(item => item.itemName).filter(Boolean))];
    console.log('Unique Item Codes in sold items:', uniqueItemCodes);
    console.log('Unique Item Names in sold items:', uniqueItemNames);
    
    // Debug: Show sales by item code
    const salesByItemCode = allSoldItems.reduce((acc, item) => {
      const key = item.itemCode || item.itemName || 'unknown';
      if (!acc[key]) {
        acc[key] = { total: 0, sources: {} };
      }
      acc[key].total += item.quantity || 0;
      acc[key].sources[item.source] = (acc[key].sources[item.source] || 0) + (item.quantity || 0);
      return acc;
    }, {});
    
    console.log('Sales by Item Code:', salesByItemCode);
    
    // Debug: Specifically check Fridge sales
    const fridgeSales = allSoldItems.filter(item => 
      item.itemName && item.itemName.toLowerCase().includes('fridge')
    );
    console.log('=== FRIDGE SALES DEBUG ===');
    console.log('All Fridge-related sales found:', fridgeSales.length);
    console.log('Fridge sales details:', fridgeSales);
    console.log('Total Fridge quantity sold:', fridgeSales.reduce((sum, item) => sum + (item.quantity || 0), 0));
    console.log('=== END FRIDGE DEBUG ===');
    
    // Debug: Check all specific products mentioned
    const productChecks = ['Fridge', 'Purifier', 'AC', 'Laptop'];
    productChecks.forEach(productName => {
      const productSales = allSoldItems.filter(item => 
        item.itemName && item.itemName.toLowerCase().includes(productName.toLowerCase())
      );
      console.log(`=== ${productName.toUpperCase()} SALES DEBUG ===`);
      console.log(`${productName} sales found:`, productSales.length);
      console.log(`${productName} sales details:`, productSales);
      console.log(`Total ${productName} quantity sold:`, productSales.reduce((sum, item) => sum + (item.quantity || 0), 0));
      console.log(`=== END ${productName.toUpperCase()} DEBUG ===`);
    });
    
    // Remove duplicates based on itemCode, itemName, source, and invoice
    const uniqueSoldItems = allSoldItems.filter((item, index, self) => 
      index === self.findIndex(t => 
        t.itemCode === item.itemCode && 
        t.itemName === item.itemName && 
        t.source === item.source &&
        t.quantity === item.quantity &&
        t.invoice === item.invoice
      )
    );
    
    console.log('After deduplication - Total sold items:', uniqueSoldItems.length);
    console.log('Deduplication removed:', allSoldItems.length - uniqueSoldItems.length, 'duplicate entries');
    
    // Calculate inventory analysis for each product
    const inventoryAnalysis = allProducts.map(product => {
      // Get all sales for this product - improved matching logic
      const productSales = uniqueSoldItems.filter(sale => {
        // Skip sales with empty or null data
        if (!sale.itemCode && !sale.itemName) {
          return false;
        }
        
        // Skip sales with empty strings
        if (sale.itemCode === '' && sale.itemName === '') {
          return false;
        }
        
        // Primary match: itemCode (exact match)
        if (sale.itemCode && product.itemCode && sale.itemCode.trim() === product.itemCode.trim()) {
          return true;
        }
        
        // Secondary match: itemName (exact match)
        if (sale.itemName && product.itemName && sale.itemName.trim() === product.itemName.trim()) {
          return true;
        }
        
        // Tertiary match: itemName (case insensitive exact match)
        if (sale.itemName && product.itemName && 
            sale.itemName.toLowerCase().trim() === product.itemName.toLowerCase().trim()) {
          return true;
        }
        
        // Quaternary match: partial name matches (case insensitive) - improved logic
        if (sale.itemName && product.itemName) {
          const saleName = sale.itemName.toLowerCase().trim();
          const productName = product.itemName.toLowerCase().trim();
          
          // Check if either name contains the other (bidirectional partial matching)
          if ((saleName.includes(productName) || productName.includes(saleName)) &&
              saleName !== '' && productName !== '') {
            return true;
          }
        }
        
        // Quinary match: itemCode partial match (for cases where codes have variations)
        if (sale.itemCode && product.itemCode) {
          const saleCode = sale.itemCode.toLowerCase().trim();
          const productCode = product.itemCode.toLowerCase().trim();
          
          if ((saleCode.includes(productCode) || productCode.includes(saleCode)) &&
              saleCode !== '' && productCode !== '') {
            return true;
          }
        }
        
        return false;
      });
      
      console.log(`=== PRODUCT ANALYSIS: ${product.itemName} (${product.itemCode}) ===`);
      console.log('Product Sales Found:', productSales.length);
      console.log('Product Sales Details:', productSales);
      
      // Special debugging for problematic products
      if (product.itemName && (
          product.itemName.toLowerCase().includes('purifier') ||
          product.itemName.toLowerCase().includes('laptop') ||
          product.itemName.toLowerCase().includes('fridge')
        )) {
        console.log(`🔍 SPECIAL DEBUG FOR ${product.itemName.toUpperCase()}:`);
        console.log('Product details:', {
          itemCode: product.itemCode,
          itemName: product.itemName,
          originalQuantity: product.quantity
        });
        
        console.log('All sold items that might match:');
        uniqueSoldItems.forEach((sale, index) => {
          const matches = (
            (sale.itemCode && product.itemCode && sale.itemCode.trim() === product.itemCode.trim()) ||
            (sale.itemName && product.itemName && sale.itemName.trim() === product.itemName.trim()) ||
            (sale.itemName && product.itemName && sale.itemName.toLowerCase().trim() === product.itemName.toLowerCase().trim()) ||
            (sale.itemName && product.itemName && (
              sale.itemName.toLowerCase().trim().includes(product.itemName.toLowerCase().trim()) ||
              product.itemName.toLowerCase().trim().includes(sale.itemName.toLowerCase().trim())
            ))
          );
          
          console.log(`  Sale ${index + 1}:`, {
            itemCode: sale.itemCode,
            itemName: sale.itemName,
            quantity: sale.quantity,
            source: sale.source,
            matches: matches
          });
        });
      }
      
      // Debug: Show matching attempts for this product
      console.log('=== MATCHING ATTEMPTS FOR THIS PRODUCT ===');
      console.log('Looking for product:', {
        itemCode: product.itemCode,
        itemName: product.itemName
      });
      
      // Show all sold items and why they match or don't match
      uniqueSoldItems.forEach((sale, saleIndex) => {
        const itemCodeMatch = sale.itemCode && product.itemCode && sale.itemCode.trim() === product.itemCode.trim();
        const itemNameMatch = sale.itemName && product.itemName && sale.itemName.trim() === product.itemName.trim();
        const caseInsensitiveMatch = sale.itemName && product.itemName && 
            sale.itemName.toLowerCase().trim() === product.itemName.toLowerCase().trim();
        
        console.log(`Sale ${saleIndex + 1} matching check:`, {
          saleItemCode: sale.itemCode,
          saleItemName: sale.itemName,
          itemCodeMatch,
          itemNameMatch,
          caseInsensitiveMatch,
          willMatch: itemCodeMatch || itemNameMatch || caseInsensitiveMatch
        });
      });
      console.log('=== END MATCHING ATTEMPTS ===');
      
      // Debug: Show what's being matched
      console.log('Matching criteria:');
      console.log('- Looking for itemCode:', product.itemCode);
      console.log('- Looking for itemName:', product.itemName);
      console.log('- Found sales with itemCode match:', productSales.filter(s => s.itemCode === product.itemCode).length);
      console.log('- Found sales with itemName match:', productSales.filter(s => s.itemName === product.itemName).length);
      
      const totalSold = productSales.reduce((sum, sale) => sum + (sale.quantity || 0), 0);
      const originalQuantity = product.quantity || 0; // This is the original stock quantity
      const currentStock = originalQuantity - totalSold; // Subtract sold from original
      
      console.log('Original Quantity (from product list):', originalQuantity);
      console.log('Total Sold:', totalSold);
      console.log('Current Stock (Original - Sold):', currentStock);
      
      // Validation: If no sales found but totalSold > 0, something is wrong
      if (productSales.length === 0 && totalSold > 0) {
        console.log(`⚠️ WARNING: No sales found for ${product.itemName} but totalSold = ${totalSold}`);
      }
      
      // Validation: If sales found but totalSold = 0, check quantities
      if (productSales.length > 0 && totalSold === 0) {
        console.log(`⚠️ WARNING: Sales found for ${product.itemName} but totalSold = 0`);
        console.log('Sales details:', productSales.map(s => ({ quantity: s.quantity, source: s.source })));
      }
      
      // Debug: Show sales breakdown by source
      const salesBySource = productSales.reduce((acc, sale) => {
        acc[sale.source] = (acc[sale.source] || 0) + (sale.quantity || 0);
        return acc;
      }, {});
      console.log('Sales by Source:', salesBySource);
      
      // Debug: Show detailed breakdown for Fridge specifically
      if (product.itemName && product.itemName.toLowerCase().includes('fridge')) {
        console.log('=== FRIDGE DETAILED BREAKDOWN ===');
        console.log('All Fridge sales found:', productSales);
        console.log('Fridge sales by source:', salesBySource);
        console.log('Fridge total sold calculation:', totalSold);
        console.log('Fridge current stock calculation:', currentStock);
        console.log('=== END FRIDGE DETAILED BREAKDOWN ===');
      }
      
      // Debug: Show detailed breakdown for iPhone specifically
      if (product.itemName && product.itemName.toLowerCase().includes('phone')) {
        console.log('=== IPHONE DETAILED BREAKDOWN ===');
        console.log('All iPhone sales found:', productSales);
        console.log('iPhone sales by source:', salesBySource);
        console.log('iPhone total sold calculation:', totalSold);
        console.log('iPhone current stock calculation:', currentStock);
        
        // Special validation for iPhone - should be 0 sold
        if (totalSold > 0) {
          console.log('🚨 ERROR: iPhone shows sold but should be 0!');
          console.log('iPhone sales details:', productSales.map(s => ({
            itemCode: s.itemCode,
            itemName: s.itemName,
            quantity: s.quantity,
            source: s.source,
            invoice: s.invoice
          })));
        } else {
          console.log('✅ iPhone correctly shows 0 sold');
        }
        console.log('=== END IPHONE DETAILED BREAKDOWN ===');
      }
      
      // Debug: Show detailed breakdown for AC specifically
      if (product.itemName && product.itemName.toLowerCase().includes('ac')) {
        console.log('=== AC DETAILED BREAKDOWN ===');
        console.log('All AC sales found:', productSales);
        console.log('AC sales by source:', salesBySource);
        console.log('AC total sold calculation:', totalSold);
        console.log('AC current stock calculation:', currentStock);
        console.log('=== END AC DETAILED BREAKDOWN ===');
      }
      
      console.log('=== END PRODUCT ANALYSIS ===');
      const stockStatus = currentStock <= 0 ? 'OUT_OF_STOCK' : 
                         currentStock <= 5 ? 'LOW_STOCK' : 
                         currentStock <= 10 ? 'MEDIUM_STOCK' : 'GOOD_STOCK';
      
      // Calculate sales velocity (sales per day over last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const recentSales = productSales.filter(sale => 
        new Date(sale.soldDate) >= thirtyDaysAgo
      );
      
      const salesVelocity = recentSales.length > 0 ? 
        recentSales.reduce((sum, sale) => sum + (sale.quantity || 0), 0) / 30 : 0;
      
      // Calculate days of stock remaining
      const daysOfStock = salesVelocity > 0 ? Math.floor(currentStock / salesVelocity) : 999;
      
      // Generate alerts
      const alerts = [];
      if (currentStock <= 0) {
        alerts.push({
          type: 'CRITICAL',
          message: `🚨 OUT OF STOCK: ${product.itemName} (${product.itemCode})`,
          severity: 'HIGH'
        });
      } else if (currentStock <= 5) {
        alerts.push({
          type: 'LOW_STOCK',
          message: `⚠️ LOW STOCK: ${product.itemName} (${product.itemCode}) - Only ${currentStock} units left`,
          severity: 'MEDIUM'
        });
      } else if (daysOfStock <= 7 && salesVelocity > 0) {
        alerts.push({
          type: 'RAPID_DEPLETION',
          message: `⚡ RAPID DEPLETION: ${product.itemName} (${product.itemCode}) - Will run out in ${daysOfStock} days`,
          severity: 'MEDIUM'
        });
      }
      
      return {
        productId: product.id,
        itemCode: product.itemCode,
        itemName: product.itemName,
        hsn: product.hsn,
        gst: product.gst,
        unitPrice: product.unitPrice,
        availableQuantity: originalQuantity, // Show original quantity from product list
        totalSold,
        currentStock,
        stockStatus,
        salesVelocity: Math.round(salesVelocity * 100) / 100,
        daysOfStock,
        totalSalesCount: productSales.length,
        lastSaleDate: productSales.length > 0 ? 
          Math.max(...productSales.map(sale => new Date(sale.soldDate).getTime())) : null,
        alerts,
        salesBreakdown: {
          cashBills: productSales.filter(s => s.source === 'CashBill').reduce((sum, s) => sum + (s.quantity || 0), 0),
          creditBills: productSales.filter(s => s.source === 'CreditBill').reduce((sum, s) => sum + (s.quantity || 0), 0),
          manualEntries: productSales.filter(s => s.source === 'Manual Entry').reduce((sum, s) => sum + (s.quantity || 0), 0)
        }
      };
    });
    
    // Generate summary alerts
    const criticalAlerts = inventoryAnalysis.filter(item => item.stockStatus === 'OUT_OF_STOCK');
    const lowStockAlerts = inventoryAnalysis.filter(item => item.stockStatus === 'LOW_STOCK');
    const rapidDepletionAlerts = inventoryAnalysis.filter(item => 
      item.alerts.some(alert => alert.type === 'RAPID_DEPLETION')
    );
    
    const summary = {
      totalProducts: allProducts.length,
      outOfStock: criticalAlerts.length,
      lowStock: lowStockAlerts.length,
      rapidDepletion: rapidDepletionAlerts.length,
      totalAlerts: criticalAlerts.length + lowStockAlerts.length + rapidDepletionAlerts.length,
      totalValueAtRisk: inventoryAnalysis
        .filter(item => item.stockStatus === 'OUT_OF_STOCK' || item.stockStatus === 'LOW_STOCK')
        .reduce((sum, item) => sum + (item.currentStock * item.unitPrice), 0)
    };
    
    console.log('=== INVENTORY ANALYSIS COMPLETE ===');
    console.log('Summary:', summary);
    
    res.status(200).json({
      success: true,
      data: {
        inventoryAnalysis,
        summary,
        criticalAlerts: criticalAlerts.map(item => item.alerts).flat(),
        lowStockAlerts: lowStockAlerts.map(item => item.alerts).flat(),
        rapidDepletionAlerts: rapidDepletionAlerts.map(item => item.alerts).flat()
      }
    });
    
  } catch (error) {
    console.error('Error in inventory analysis:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze inventory',
      error: error.message
    });
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

// Test endpoint to check sold products data
export const testSpecificProducts = async (req, res) => {
  try {
    console.log('=== TESTING SPECIFIC PRODUCTS (PURIFIER, LAPTOP, FRIDGE) ===');
    
    // Get all products
    const allProducts = await firebaseService.getAll('products');
    const targetProducts = allProducts.filter(product => 
      product.itemName && (
        product.itemName.toLowerCase().includes('purifier') ||
        product.itemName.toLowerCase().includes('laptop') ||
        product.itemName.toLowerCase().includes('fridge')
      )
    );
    
    console.log('Target products found:', targetProducts.length);
    targetProducts.forEach(product => {
      console.log(`Product: ${product.itemName} (${product.itemCode}) - Original Qty: ${product.quantity}`);
    });
    
    // Get all sold products
    const soldProducts = await firebaseService.getAll('soldProducts');
    const cashBills = await firebaseService.getAll('cashbills');
    const creditBills = await firebaseService.getAll('creditbills');
    
    console.log('Sold products count:', soldProducts ? soldProducts.length : 0);
    console.log('Cash bills count:', cashBills ? cashBills.length : 0);
    console.log('Credit bills count:', creditBills ? creditBills.length : 0);
    
    // Debug: Show ALL sold products to see what's available
    console.log('=== ALL SOLD PRODUCTS DEBUG ===');
    if (soldProducts && soldProducts.length > 0) {
      soldProducts.forEach((sale, index) => {
        console.log(`Sold Product ${index + 1}:`, {
          itemCode: sale.itemCode,
          itemName: sale.itemName,
          quantity: sale.quantity,
          source: sale.source || 'soldProducts'
        });
      });
    } else {
      console.log('No sold products found in soldProducts collection');
    }
    
    // Debug: Show ALL cash bill items
    console.log('=== ALL CASH BILL ITEMS DEBUG ===');
    if (cashBills && cashBills.length > 0) {
      cashBills.forEach((bill, billIndex) => {
        if (bill.items && bill.items.length > 0) {
          console.log(`Cash Bill ${billIndex + 1} (${bill.invoiceNumber || 'N/A'}):`);
          bill.items.forEach((item, itemIndex) => {
            console.log(`  Item ${itemIndex + 1}:`, {
              code: item.code,
              itemname: item.itemname,
              quantity: item.quantity
            });
          });
        }
      });
    } else {
      console.log('No cash bills found');
    }
    
    // Debug: Show ALL credit bill items
    console.log('=== ALL CREDIT BILL ITEMS DEBUG ===');
    if (creditBills && creditBills.length > 0) {
      creditBills.forEach((bill, billIndex) => {
        if (bill.items && bill.items.length > 0) {
          console.log(`Credit Bill ${billIndex + 1} (${bill.invoiceNumber || 'N/A'}):`);
          bill.items.forEach((item, itemIndex) => {
            console.log(`  Item ${itemIndex + 1}:`, {
              code: item.code,
              itemname: item.itemname,
              quantity: item.quantity
            });
          });
        }
      });
    } else {
      console.log('No credit bills found');
    }
    
    // Find sales for each target product
    const results = targetProducts.map(product => {
      const productSales = [];
      
      // Check sold products
      if (soldProducts) {
        soldProducts.forEach(sale => {
          if ((sale.itemCode && product.itemCode && sale.itemCode.trim() === product.itemCode.trim()) ||
              (sale.itemName && product.itemName && sale.itemName.toLowerCase().trim() === product.itemName.toLowerCase().trim()) ||
              (sale.itemName && product.itemName && (
                sale.itemName.toLowerCase().trim().includes(product.itemName.toLowerCase().trim()) ||
                product.itemName.toLowerCase().trim().includes(sale.itemName.toLowerCase().trim())
              ))) {
            productSales.push({
              source: 'soldProducts',
              itemCode: sale.itemCode,
              itemName: sale.itemName,
              quantity: sale.quantity,
              invoice: sale.invoice || 'N/A'
            });
          }
        });
      }
      
      // Check cash bills
      if (cashBills) {
        cashBills.forEach(bill => {
          if (bill.items) {
            bill.items.forEach(item => {
              if ((item.code && product.itemCode && item.code.trim() === product.itemCode.trim()) ||
                  (item.itemname && product.itemName && item.itemname.toLowerCase().trim() === product.itemName.toLowerCase().trim()) ||
                  (item.itemname && product.itemName && (
                    item.itemname.toLowerCase().trim().includes(product.itemName.toLowerCase().trim()) ||
                    product.itemName.toLowerCase().trim().includes(item.itemname.toLowerCase().trim())
                  ))) {
                productSales.push({
                  source: 'cashBill',
                  itemCode: item.code,
                  itemName: item.itemname,
                  quantity: item.quantity,
                  invoice: bill.invoiceNumber || 'N/A'
                });
              }
            });
          }
        });
      }
      
      // Check credit bills
      if (creditBills) {
        creditBills.forEach(bill => {
          if (bill.items) {
            bill.items.forEach(item => {
              if ((item.code && product.itemCode && item.code.trim() === product.itemCode.trim()) ||
                  (item.itemname && product.itemName && item.itemname.toLowerCase().trim() === product.itemName.toLowerCase().trim()) ||
                  (item.itemname && product.itemName && (
                    item.itemname.toLowerCase().trim().includes(product.itemName.toLowerCase().trim()) ||
                    product.itemName.toLowerCase().trim().includes(item.itemname.toLowerCase().trim())
                  ))) {
                productSales.push({
                  source: 'creditBill',
                  itemCode: item.code,
                  itemName: item.itemname,
                  quantity: item.quantity,
                  invoice: bill.invoiceNumber || 'N/A'
                });
              }
            });
          }
        });
      }
      
      const totalSold = productSales.reduce((sum, sale) => sum + (sale.quantity || 0), 0);
      
      return {
        product: {
          itemCode: product.itemCode,
          itemName: product.itemName,
          originalQuantity: product.quantity
        },
        sales: productSales,
        totalSold: totalSold,
        currentStock: product.quantity - totalSold
      };
    });
    
    res.json({
      success: true,
      results: results
    });
    
  } catch (error) {
    console.error('Error testing specific products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test specific products',
      error: error.message
    });
  }
};

export const checkAllSalesData = async (req, res) => {
  try {
    console.log('=== CHECKING ALL SALES DATA ===');
    
    // Get all possible sales sources
    const [soldProducts, cashBills, creditBills] = await Promise.allSettled([
      firebaseService.getAll('soldProducts'),
      firebaseService.getAll('cashbills'),
      firebaseService.getAll('creditbills')
    ]);
    
    const results = {
      soldProducts: {
        status: soldProducts.status,
        count: soldProducts.status === 'fulfilled' ? soldProducts.value.length : 0,
        data: soldProducts.status === 'fulfilled' ? soldProducts.value : []
      },
      cashBills: {
        status: cashBills.status,
        count: cashBills.status === 'fulfilled' ? cashBills.value.length : 0,
        data: cashBills.status === 'fulfilled' ? cashBills.value : []
      },
      creditBills: {
        status: creditBills.status,
        count: creditBills.status === 'fulfilled' ? creditBills.value.length : 0,
        data: creditBills.status === 'fulfilled' ? creditBills.value : []
      }
    };
    
    // Show sample data from each source
    if (results.soldProducts.data.length > 0) {
      console.log('Sample sold products:', results.soldProducts.data.slice(0, 3));
    }
    
    if (results.cashBills.data.length > 0) {
      console.log('Sample cash bills:', results.cashBills.data.slice(0, 2));
    }
    
    if (results.creditBills.data.length > 0) {
      console.log('Sample credit bills:', results.creditBills.data.slice(0, 2));
    }
    
    res.json({
      success: true,
      message: 'All sales data checked',
      results: results
    });
    
  } catch (error) {
    console.error('Error checking sales data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check sales data',
      error: error.message
    });
  }
};

export const testSoldProductsData = async (req, res) => {
  try {
    console.log('=== TESTING SOLD PRODUCTS DATA ===');
    
    // Test sold products collection
    const soldProducts = await firebaseService.getAll('soldProducts');
    console.log('Sold Products from main collection:', soldProducts);
    console.log('Sold Products count:', soldProducts ? soldProducts.length : 0);
    
    // Debug: Show detailed structure of sold products
    if (soldProducts && soldProducts.length > 0) {
      console.log('=== SOLD PRODUCTS DETAILED STRUCTURE ===');
      soldProducts.forEach((product, index) => {
        console.log(`Sold Product ${index + 1} structure:`, {
          id: product.id,
          itemCode: product.itemCode,
          itemName: product.itemName,
          quantity: product.quantity,
          source: product.source,
          entrySource: product.entrySource,
          isManualEntry: product.isManualEntry,
          addedBy: product.addedBy,
          createdAt: product.createdAt,
          allKeys: Object.keys(product)
        });
      });
      console.log('=== END SOLD PRODUCTS STRUCTURE ===');
    }
    
    // Test alternative collections
    const alternativeCollections = ['sold-products', 'sold_products', 'solditems'];
    const alternativeData = {};
    
    for (const collectionName of alternativeCollections) {
      try {
        const altData = await firebaseService.getAll(collectionName);
        alternativeData[collectionName] = altData;
        console.log(`${collectionName} count:`, altData ? altData.length : 0);
      } catch (err) {
        console.log(`${collectionName} not found or empty`);
        alternativeData[collectionName] = [];
      }
    }
    
    // Test cash bills and credit bills
    const [cashBills, creditBills] = await Promise.allSettled([
      firebaseService.getAll('cashbills'),
      firebaseService.getAll('creditbills')
    ]);
    
    const cashBillsData = cashBills.status === 'fulfilled' ? cashBills.value : [];
    const creditBillsData = creditBills.status === 'fulfilled' ? creditBills.value : [];
    
    console.log('Cash Bills count:', cashBillsData.length);
    console.log('Credit Bills count:', creditBillsData.length);
    
    res.json({
      success: true,
      message: 'Sold products data test completed',
      data: {
        soldProducts: {
          main: soldProducts,
          count: soldProducts ? soldProducts.length : 0
        },
        alternativeCollections: alternativeData,
        cashBills: {
          data: cashBillsData,
          count: cashBillsData.length
        },
        creditBills: {
          data: creditBillsData,
          count: creditBillsData.length
        },
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Sold products data test failed:', error);
    res.status(500).json({
      success: false,
      message: 'Sold products data test failed',
      error: error.message,
      stack: error.stack
    });
  }
};