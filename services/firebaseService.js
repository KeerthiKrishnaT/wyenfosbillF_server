import { adminFirestore as db, adminStorage as storage } from '../config/firebase-admin.js';

// Generic CRUD operations for Firestore using Admin SDK
export const firebaseService = {
  // Create a new document
  async create(collectionName, data) {
    try {
      const docRef = await db.collection(collectionName).add({
        ...data,
        createdAt: new Date(),
        updatedAt: new Date()
      });
      return { id: docRef.id, ...data };
    } catch (error) {
      console.error('Error creating document:', error);
      throw error;
    }
  },

  // Get a single document by ID
  async getById(collectionName, id) {
    try {
      const docRef = db.collection(collectionName).doc(id);
      const docSnap = await docRef.get();
      
      if (docSnap.exists) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        return null;
      }
    } catch (error) {
      console.error('Error getting document:', error);
      throw error;
    }
  },

  // Get all documents from a collection
  async getAll(collectionName, orderByField = 'createdAt', orderDirection = 'desc') {
    try {
      console.log(`firebaseService.getAll: Fetching all documents from collection ${collectionName}`);
      let querySnapshot;
      
      try {
        // Try with ordering first
        querySnapshot = await db.collection(collectionName)
          .orderBy(orderByField, orderDirection)
          .get();
      } catch (orderError) {
        console.log(`firebaseService.getAll: OrderBy failed for field ${orderByField}, trying without ordering:`, orderError.message);
        // If orderBy fails, try without ordering
        querySnapshot = await db.collection(collectionName).get();
      }
      
      const documents = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      console.log(`firebaseService.getAll: Found ${documents.length} documents in collection ${collectionName}`);
      console.log(`firebaseService.getAll: Document IDs:`, documents.map(doc => doc.id));
      
      return documents;
    } catch (error) {
      console.error(`Error getting documents from ${collectionName}:`, error.message);
      // If the collection doesn't exist or has no documents, return empty array
      if (error.code === 'not-found' || error.message.includes('not found')) {
        console.log(`Collection ${collectionName} not found, returning empty array`);
        return [];
      }
      throw error;
    }
  },

  // Get documents with filters
  async getWhere(collectionName, field, operator, value, orderByField = 'createdAt', orderDirection = 'desc') {
    try {
      let query = db.collection(collectionName).where(field, operator, value);
      
      // Only add orderBy if both orderByField and orderDirection are provided
      if (orderByField && orderDirection) {
        query = query.orderBy(orderByField, orderDirection);
      }
      
      const querySnapshot = await query.get();
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error(`Error getting filtered documents from ${collectionName} where ${field} ${operator} ${value}:`, error.message);
      // If the collection doesn't exist or has no documents, return empty array
      if (error.code === 'not-found' || error.message.includes('not found')) {
        console.log(`Collection ${collectionName} not found, returning empty array`);
        return [];
      }
      // If the field doesn't exist, return empty array
      if (error.code === 'failed-precondition' || error.message.includes('field')) {
        console.log(`Field ${field} not found in collection ${collectionName}, returning empty array`);
        return [];
      }
      throw error;
    }
  },

  // Update a document
  async update(collectionName, id, data) {
    try {
      console.log(`firebaseService.update: Attempting to update document ${id} in collection ${collectionName}`);
      const docRef = db.collection(collectionName).doc(id);
      
      // Check if document exists before updating
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        console.log(`firebaseService.update: Document ${id} does not exist in collection ${collectionName}`);
        throw new Error(`Document ${id} not found in collection ${collectionName}`);
      }
      
      console.log(`firebaseService.update: Document ${id} exists, proceeding with update`);
      await docRef.update({
        ...data,
        updatedAt: new Date()
      });
      console.log(`firebaseService.update: Successfully updated document ${id} in collection ${collectionName}`);
      
      // Get the updated document to return all fields including customerId
      const updatedDoc = await docRef.get();
      return { id, ...updatedDoc.data() };
    } catch (error) {
      console.error('Error updating document:', error);
      // If it's a "not found" error, provide a clearer message
      if (error.code === 5 || error.message.includes('not found') || error.message.includes('No document to update')) {
        throw new Error(`Document ${id} not found in collection ${collectionName}`);
      }
      throw error;
    }
  },

  // Delete a document
  async delete(collectionName, id) {
    try {
      console.log(`firebaseService.delete: Attempting to delete document ${id} from collection ${collectionName}`);
      const docRef = db.collection(collectionName).doc(id);
      
      // Check if document exists before deleting
      const docSnap = await docRef.get();
      if (!docSnap.exists) {
        console.log(`firebaseService.delete: Document ${id} does not exist in collection ${collectionName}`);
        // Return true instead of throwing error for idempotent delete
        return true;
      }
      
      console.log(`firebaseService.delete: Document ${id} exists, proceeding with deletion`);
      await docRef.delete();
      console.log(`firebaseService.delete: Successfully deleted document ${id} from collection ${collectionName}`);
      return true;
    } catch (error) {
      console.error('Error deleting document:', error);
      // If it's a "not found" error, return true (idempotent delete)
      if (error.code === 5 || error.message.includes('not found') || error.message.includes('No document to delete')) {
        console.log(`firebaseService.delete: Document ${id} not found, treating as successful delete`);
        return true;
      }
      throw error;
    }
  },

  // Batch operations
  async batchCreate(collectionName, documents) {
    try {
      const batch = db.batch();
      
      documents.forEach(docData => {
        const docRef = db.collection(collectionName).doc();
        batch.set(docRef, {
          ...docData,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      });
      
      await batch.commit();
      return true;
    } catch (error) {
      console.error('Error in batch create:', error);
      throw error;
    }
  }
};

// File upload service using Admin SDK
export const fileUploadService = {
  // Upload a file to Firebase Storage
  async uploadFile(file, path) {
    try {
      const bucket = storage.bucket();
      const fileRef = bucket.file(path);
      
      await fileRef.save(file.buffer, {
        metadata: {
          contentType: file.mimetype
        }
      });
      
      const [url] = await fileRef.getSignedUrl({
        action: 'read',
        expires: '03-01-2500'
      });
      
      return url;
    } catch (error) {
      console.error('Error uploading file:', error);
      throw error;
    }
  },

  // Delete a file from Firebase Storage
  async deleteFile(path) {
    try {
      const bucket = storage.bucket();
      await bucket.file(path).delete();
      return true;
    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }
};

// Specific services for different entities
export const userService = {
  async createUser(userData) {
    return await firebaseService.create('users', userData);
  },

  async getUserById(userId) {
    return await firebaseService.getById('users', userId);
  },

  async updateUser(userId, userData) {
    return await firebaseService.update('users', userId, userData);
  },

  async deleteUser(userId) {
    return await firebaseService.delete('users', userId);
  },

  async getAllUsers() {
    return await firebaseService.getAll('users', 'name', 'asc');
  },

  async getUsersByRole(role) {
    try {
      console.log(`userService.getUsersByRole: Fetching users with role: ${role}`);
      // Use getAll and filter instead of getWhere to avoid index requirements
      const allUsers = await firebaseService.getAll('users');
      const filteredUsers = allUsers.filter(user => user.role === role);
      console.log(`userService.getUsersByRole: Found ${filteredUsers.length} users with role ${role}`);
      return filteredUsers;
    } catch (error) {
      console.error(`userService.getUsersByRole error for role ${role}:`, error);
      return [];
    }
  },

  async getUsersByDepartment(department) {
    try {
      console.log(`userService.getUsersByDepartment: Fetching users in department: ${department}`);
      // Use getAll and filter instead of getWhere to avoid index requirements
      const allUsers = await firebaseService.getAll('users');
      const filteredUsers = allUsers.filter(user => user.department === department);
      console.log(`userService.getUsersByDepartment: Found ${filteredUsers.length} users in department ${department}`);
      return filteredUsers;
    } catch (error) {
      console.error(`userService.getUsersByDepartment error for department ${department}:`, error);
      return [];
    }
  },

  async getUserByEmail(email) {
    try {
      console.log(`userService.getUserByEmail: Looking for user with email: ${email}`);
      // Use getAll and filter instead of getWhere to avoid index requirements
      const allUsers = await firebaseService.getAll('users');
      const user = allUsers.find(user => user.email === email);
      console.log(`userService.getUserByEmail: ${user ? 'Found' : 'Not found'} user with email ${email}`);
      return user || null;
    } catch (error) {
      console.error(`userService.getUserByEmail error for email ${email}:`, error);
      return null;
    }
  }
};

export const productService = {
  async createProduct(productData) {
    return await firebaseService.create('products', productData);
  },

  async getProductById(productId) {
    return await firebaseService.getById('products', productId);
  },

  async updateProduct(productId, productData) {
    return await firebaseService.update('products', productId, productData);
  },

  async deleteProduct(productId) {
    return await firebaseService.delete('products', productId);
  },

  async getAllProducts() {
    return await firebaseService.getAll('products', 'itemName', 'asc');
  },

  async getProductsByDepartment(department) {
    return await firebaseService.getWhere('products', 'department', '==', department);
  },

  async getProductByItemCode(itemCode) {
    const products = await firebaseService.getWhere('products', 'itemCode', '==', itemCode);
    return products.length > 0 ? products[0] : null;
  }
};

export const billService = {
  async createBill(billData) {
    // Determine the correct collection based on bill type
    let collectionName = 'bills'; // fallback
    
    if (billData.billType === 'cash') {
      collectionName = 'cashbills';
    } else if (billData.billType === 'credit') {
      collectionName = 'creditbills';
    } else if (billData.billType === 'creditnote') {
      collectionName = 'creditnotes';
    } else if (billData.billType === 'debitnote') {
      collectionName = 'debitnotes';
    }
    
    return await firebaseService.create(collectionName, billData);
  },

  async getBillById(billId, billType = 'cash') {
    // Determine the correct collection based on bill type
    let collectionName = 'cashbills'; // default
    
    if (billType === 'credit') {
      collectionName = 'creditbills';
    } else if (billType === 'creditnote') {
      collectionName = 'creditnotes';
    } else if (billType === 'debitnote') {
      collectionName = 'debitnotes';
    }
    
    return await firebaseService.getById(collectionName, billId);
  },

  async updateBill(billId, billData, billType = 'cash') {
    // Determine the correct collection based on bill type
    let collectionName = 'cashbills'; // default
    
    if (billType === 'credit') {
      collectionName = 'creditbills';
    } else if (billType === 'creditnote') {
      collectionName = 'creditnotes';
    } else if (billType === 'debitnote') {
      collectionName = 'debitnotes';
    }
    
    return await firebaseService.update(collectionName, billId, billData);
  },

  async deleteBill(billId, billType = 'cash') {
    // Determine the correct collection based on bill type
    let collectionName = 'cashbills'; // default
    
    if (billType === 'credit') {
      collectionName = 'creditbills';
    } else if (billType === 'creditnote') {
      collectionName = 'creditnotes';
    } else if (billType === 'debitnote') {
      collectionName = 'debitnotes';
    }
    
    return await firebaseService.delete(collectionName, billId);
  },

  async getBillsByUser(userId) {
    return await firebaseService.getWhere('bills', 'createdBy', '==', userId);
  },

  async getBillsByDateRange(startDate, endDate) {
    return await firebaseService.getWhere('bills', 'createdAt', '>=', startDate);
  },

  async getCashBills() {
    try {
      // Use the correct collection name 'cashbills'
      return await firebaseService.getAll('cashbills', 'createdAt', 'desc');
    } catch (error) {
      console.error('Error in getCashBills:', error.message);
      return [];
    }
  },

  async getCreditBills() {
    try {
      // Use the correct collection name 'creditbills'
      return await firebaseService.getAll('creditbills', 'createdAt', 'desc');
    } catch (error) {
      console.error('Error in getCreditBills:', error.message);
      return [];
    }
  },

  async getCreditNotes() {
    try {
      // Use the correct collection name 'creditnotes'
      return await firebaseService.getAll('creditnotes', 'createdAt', 'desc');
    } catch (error) {
      console.error('Error in getCreditNotes:', error.message);
      return [];
    }
  },

  async getDebitNotes() {
    try {
      // Use the correct collection name 'debitnotes'
      return await firebaseService.getAll('debitnotes', 'createdAt', 'desc');
    } catch (error) {
      console.error('Error in getDebitNotes:', error.message);
      return [];
    }
  },

  async getAllBills() {
    return await firebaseService.getAll('bills', 'createdAt', 'desc');
  },

  async getBillsByType(type) {
    return await firebaseService.getWhere('bills', 'type', '==', type);
  }
};

export const customerService = {
  async createCustomer(customerData) {
    return await firebaseService.create('customers', customerData);
  },

  async getCustomerById(customerId) {
    return await firebaseService.getById('customers', customerId);
  },

  async updateCustomer(customerId, customerData) {
    return await firebaseService.update('customers', customerId, customerData);
  },

  async deleteCustomer(customerId) {
    return await firebaseService.delete('customers', customerId);
  },

  async getAllCustomers() {
    return await firebaseService.getAll('customers', 'customerName', 'asc');
  },

  async searchCustomers(searchTerm) {
    // Note: Firestore doesn't support full-text search natively
    // You might want to use Algolia or similar for better search
    return await firebaseService.getAll('customers', 'name', 'asc');
  }
};

export const companyService = {
  async createCompany(companyData) {
    return await firebaseService.create('companies', companyData);
  },

  async getCompanyById(companyId) {
    return await firebaseService.getById('companies', companyId);
  },

  async updateCompany(companyId, companyData) {
    return await firebaseService.update('companies', companyId, companyData);
  },

  async deleteCompany(companyId) {
    return await firebaseService.delete('companies', companyId);
  },

  async getAllCompanies() {
    try {
      console.log('companyService.getAllCompanies: Starting to fetch companies from Firestore...');
      const companies = await firebaseService.getAll('companies', 'name', 'asc');
      console.log('companyService.getAllCompanies: Successfully fetched companies:', companies.length);
      return companies;
    } catch (error) {
      console.error('companyService.getAllCompanies Error:', error);
      console.error('companyService.getAllCompanies Error Stack:', error.stack);
      
      // If Firestore fails, return a fallback list of companies
      console.log('companyService.getAllCompanies: Returning fallback companies due to Firestore error');
      return [
        {
          id: '1',
          name: 'WYENFOS INFOTECH',
          prefix: 'WIT',
          logoUrl: '/uploads/wyenfos_infotech.png'
        },
        {
          id: '2',
          name: 'WYENFOS GOLD & DIAMONDS',
          prefix: 'WGD',
          logoUrl: '/uploads/wyenfos_gold.png'
        },
        {
          id: '3',
          name: 'WYENFOS ADS',
          prefix: 'WAD',
          logoUrl: '/uploads/wyenfos_ads.png'
        },
        {
          id: '4',
          name: 'WYENFOS CASH VAPASE',
          prefix: 'WCV',
          logoUrl: '/uploads/wyenfos_cash.png'
        },
        {
          id: '5',
          name: 'AYUR FOR HERBALS INDIA',
          prefix: 'ALH',
          logoUrl: '/uploads/Ayur4life_logo.png'
        },
        {
          id: '6',
          name: 'WYENFOS',
          prefix: 'WNF',
          logoUrl: '/uploads/wyenfos.png'
        },
        {
          id: '7',
          name: 'WYENFOS PURE DROPS',
          prefix: 'WPD',
          logoUrl: '/uploads/wyenfos pure drops.png'
        }
      ];
    }
  }
};

export const departmentService = {
  async createDepartment(departmentData) {
    return await firebaseService.create('departments', departmentData);
  },

  async getDepartmentById(departmentId) {
    return await firebaseService.getById('departments', departmentId);
  },

  async updateDepartment(departmentId, departmentData) {
    return await firebaseService.update('departments', departmentId, departmentData);
  },

  async deleteDepartment(departmentId) {
    return await firebaseService.delete('departments', departmentId);
  },

  async getAllDepartments() {
    return await firebaseService.getAll('departments', 'name', 'asc');
  }
};

export const inventoryService = {
  async createInventoryItem(inventoryData) {
    return await firebaseService.create('inventory', inventoryData);
  },

  async getInventoryItemById(itemId) {
    return await firebaseService.getById('inventory', itemId);
  },

  async updateInventoryItem(itemId, inventoryData) {
    return await firebaseService.update('inventory', itemId, inventoryData);
  },

  async deleteInventoryItem(itemId) {
    return await firebaseService.delete('inventory', itemId);
  },

  async getAllInventoryItems() {
    try {
      console.log('Attempting to fetch inventory collection...');
      
      // First try without ordering to see if collection exists
      let querySnapshot;
      try {
        querySnapshot = await db.collection('inventory')
          .orderBy('itemName', 'asc')
          .get();
      } catch (orderError) {
        console.log('OrderBy failed, trying without ordering:', orderError.message);
        // If orderBy fails, try without ordering
        querySnapshot = await db.collection('inventory').get();
      }
      
      console.log('Inventory query successful, found', querySnapshot.docs.length, 'documents');
      
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting inventory items:', error);
      
      // If the collection doesn't exist or is empty, return empty array
      if (error.code === 'not-found' || error.message.includes('not found') || error.message.includes('no documents')) {
        console.log('Inventory collection not found or empty, returning empty array');
        return [];
      }
      
      throw error;
    }
  },

  async getInventoryByDepartment(department) {
    return await firebaseService.getWhere('inventory', 'department', '==', department);
  },

  // Update inventory when products are sold through bills
  async updateInventoryFromBill(billItems, billType, billId) {
    try {
      console.log('Updating inventory from bill:', billId, 'Type:', billType);
      console.log('Bill items:', billItems);
      
      for (const item of billItems) {
        // Handle different possible field names for item code
        const itemCode = item.itemCode || item.code || item.productCode || item.id;
        const itemName = item.itemName || item.name || item.description || item.productName;
        const quantity = item.quantity || item.qty || 0;
        const unitPrice = item.unitPrice || item.price || item.rate || 0;
        const gst = item.gst || item.gstRate || 0;
        
        console.log('Processing item:', { itemCode, itemName, quantity, unitPrice, gst });
        
        // Skip if itemCode is undefined or null
        if (!itemCode) {
          console.warn('Skipping item with undefined itemCode:', item);
          continue;
        }
        
        // Check if item exists in inventory
        const existingItems = await firebaseService.getWhere('inventory', 'itemCode', '==', itemCode);
        let inventoryItem;
        
        if (existingItems.length > 0) {
          // Update existing inventory
          inventoryItem = existingItems[0];
          inventoryItem.quantity = Math.max(0, (inventoryItem.quantity || 0) - quantity);
          inventoryItem.lastUpdated = new Date();
          inventoryItem.lastSoldDate = new Date();
          inventoryItem.totalSold = (inventoryItem.totalSold || 0) + quantity;
          
          await firebaseService.update('inventory', inventoryItem.id, inventoryItem);
        } else {
          // Create new inventory item with 0 quantity (sold out)
          const newInventoryItem = {
            itemCode,
            itemName,
            quantity: 0,
            unitPrice: unitPrice || 0,
            gst: gst || 0,
            lastUpdated: new Date(),
            lastSoldDate: new Date(),
            totalSold: quantity,
            createdAt: new Date(),
            createdBy: 'bill-system'
          };
          
          await firebaseService.create('inventory', newInventoryItem);
        }
        
        // Record sold product
        const soldProductData = {
          itemCode,
          itemName,
          quantity,
          unitPrice: unitPrice || 0,
          gst: gst || 0,
          billType,
          billId,
          soldDate: new Date(),
          createdAt: new Date()
        };
        
        await firebaseService.create('soldProducts', soldProductData);
      }
      
      console.log('Inventory updated successfully from bill:', billId);
    } catch (error) {
      console.error('Error updating inventory from bill:', error);
      throw error;
    }
  },

  // Get inventory with sold products data
  async getInventoryWithSales() {
    try {
      const inventory = await this.getAllInventoryItems();
      const soldProducts = await firebaseService.getAll('soldProducts', 'soldDate', 'desc');
      const productReturns = await firebaseService.getAll('productReturns', 'returnDate', 'desc');
      
      // Calculate sales and return data for each inventory item
      const inventoryWithSales = inventory.map(item => {
        const itemSales = soldProducts.filter(sale => sale.itemCode === item.itemCode);
        const itemReturns = productReturns.filter(ret => ret.itemCode === item.itemCode);
        
        const totalSold = itemSales.reduce((sum, sale) => sum + (sale.quantity || 0), 0);
        const totalReturns = itemReturns.reduce((sum, ret) => sum + (ret.quantity || 0), 0);
        const lastSold = itemSales.length > 0 ? itemSales[0].soldDate : null;
        const lastReturn = itemReturns.length > 0 ? itemReturns[0].returnDate : null;
        
        return {
          ...item,
          totalSold,
          totalReturns,
          netSold: totalSold - totalReturns, // Net sales after returns
          lastSold,
          lastReturn,
          salesCount: itemSales.length,
          returnsCount: itemReturns.length
        };
      });
      
      return inventoryWithSales;
    } catch (error) {
      console.error('Error getting inventory with sales:', error);
      throw error;
    }
  }
};

export const staffService = {
  async createStaff(staffData) {
    return await firebaseService.create('staff', staffData);
  },

  async getStaffById(staffId) {
    return await firebaseService.getById('staff', staffId);
  },

  async updateStaff(staffId, staffData) {
    return await firebaseService.update('staff', staffId, staffData);
  },

  async deleteStaff(staffId) {
    return await firebaseService.delete('staff', staffId);
  },

  async getAllStaff() {
    return await firebaseService.getAll('staff', 'name', 'asc');
  },

  async getStaffByDepartment(department) {
    return await firebaseService.getWhere('staff', 'department', '==', department);
  }
};

export const orderService = {
  async createOrder(orderData) {
    return await firebaseService.create('orders', orderData);
  },

  async getOrderById(orderId) {
    return await firebaseService.getById('orders', orderId);
  },

  async updateOrder(orderId, orderData) {
    return await firebaseService.update('orders', orderId, orderData);
  },

  async deleteOrder(orderId) {
    return await firebaseService.delete('orders', orderId);
  },

  async getAllOrders() {
    return await firebaseService.getAll('orders', 'createdAt', 'desc');
  },

  async getOrdersByCustomer(customerId) {
    return await firebaseService.getWhere('orders', 'customer', '==', customerId);
  }
};

export const paymentService = {
  async createPayment(paymentData) {
    return await firebaseService.create('payments', paymentData);
  },

  async getPaymentById(paymentId) {
    return await firebaseService.getById('payments', paymentId);
  },

  async updatePayment(paymentId, paymentData) {
    return await firebaseService.update('payments', paymentId, paymentData);
  },

  async deletePayment(paymentId) {
    return await firebaseService.delete('payments', paymentId);
  },

  async getAllPayments() {
    return await firebaseService.getAll('payments', 'createdAt', 'desc');
  },

  async getPaymentsByMethod(method) {
    return await firebaseService.getWhere('payments', 'method', '==', method);
  }
};

export const profitService = {
  async createProfit(profitData) {
    return await firebaseService.create('profits', profitData);
  },

  async getProfitById(profitId) {
    return await firebaseService.getById('profits', profitId);
  },

  async updateProfit(profitId, profitData) {
    return await firebaseService.update('profits', profitId, profitData);
  },

  async deleteProfit(profitId) {
    return await firebaseService.delete('profits', profitId);
  },

  async getAllProfits() {
    return await firebaseService.getAll('profits', 'year', 'asc');
  },

  async getProfitsByYear(year) {
    return await firebaseService.getWhere('profits', 'year', '==', year);
  },

  async getProfitsByMonth(month, year) {
    const profits = await firebaseService.getWhere('profits', 'month', '==', month);
    return profits.filter(profit => profit.year === year);
  }
};

export const billDistributionService = {
  async createBillDistribution(distributionData) {
    return await firebaseService.create('billDistributions', distributionData);
  },

  async getBillDistributionById(distributionId) {
    return await firebaseService.getById('billDistributions', distributionId);
  },

  async updateBillDistribution(distributionId, distributionData) {
    return await firebaseService.update('billDistributions', distributionId, distributionData);
  },

  async deleteBillDistribution(distributionId) {
    return await firebaseService.delete('billDistributions', distributionId);
  },

  async getAllBillDistributions() {
    return await firebaseService.getAll('billDistributions', 'createdAt', 'desc');
  }
};

export const permissionService = {
  async createPermission(permissionData) {
    return await firebaseService.create('permissions', permissionData);
  },

  async getPermissionById(permissionId) {
    return await firebaseService.getById('permissions', permissionId);
  },

  async updatePermission(permissionId, permissionData) {
    return await firebaseService.update('permissions', permissionId, permissionData);
  },

  async deletePermission(permissionId) {
    return await firebaseService.delete('permissions', permissionId);
  },

  async getAllPermissions() {
    return await firebaseService.getAll('permissions', 'createdAt', 'desc');
  },

  async getPermissionsByStatus(status) {
    return await firebaseService.getWhere('permissions', 'status', '==', status);
  }
};

export const messageService = {
  async createMessage(messageData) {
    return await firebaseService.create('messages', messageData);
  },

  async getMessageById(messageId) {
    return await firebaseService.getById('messages', messageId);
  },

  async updateMessage(messageId, messageData) {
    return await firebaseService.update('messages', messageId, messageData);
  },

  async deleteMessage(messageId) {
    return await firebaseService.delete('messages', messageId);
  },

  async getAllMessages() {
    return await firebaseService.getAll('messages', 'sentAt', 'desc');
  },

  async getMessagesByStaffId(staffId) {
    const messages = await firebaseService.getAll('messages');
    return messages.filter(message => 
      message.staffIds && message.staffIds.includes(staffId)
    );
  }
};

// Utility functions
export const formatFirebaseTimestamp = (timestamp) => {
  if (!timestamp) return '';
  
  if (timestamp.toDate) {
    return timestamp.toDate().toLocaleString();
  }
  
  if (timestamp instanceof Date) {
    return timestamp.toLocaleString();
  }
  
  return new Date(timestamp).toLocaleString();
};

export const generateUniqueId = () => {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
};

export const sanitizeFileName = (fileName) => {
  return fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
};
