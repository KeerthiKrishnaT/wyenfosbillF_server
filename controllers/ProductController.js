import { productService, inventoryService } from '../services/firebaseService.js';
import { userService } from '../services/firebaseService.js';

export const getAllProducts = async (req, res) => {
  try {
    const products = await productService.getAllProducts();
    res.json(products.map(product => ({
      ...product,
      gst: product.gst || 0,
      unitPrice: product.unitPrice || 0,
      quantity: product.quantity || 0,
    })));
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Server error while fetching products' });
  }
};

export const createBulkProducts = async (req, res) => {
  try {
    console.log('Entering createBulkProducts');
    console.log('User:', req.user);
    console.log('Payload:', JSON.stringify(req.body, null, 2));

    // Authorization check
    console.log('Checking authorization');
    if (req.user.role !== 'super_admin' && 
        !(req.user.role === 'admin' && 
          req.user.department.toLowerCase() === 'purchase')) {
      console.log('Authorization failed:', {
        role: req.user.role,
        department: req.user.department,
      });
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    const { products } = req.body;

    // Validate products array
    console.log('Validating products array');
    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ error: 'Products must be a non-empty array' });
    }

    // Valid departments
    const validDepartments = ['General', 'Purchase', 'Sales', 'Storage', 'Electronics', 'Clothing'];

    // Validate each product
    console.log('Validating individual products');
    for (const [index, product] of products.entries()) {
      console.log(`Validating product at index ${index}:`, product);
      if (!product.itemCode || typeof product.itemCode !== 'string' || !product.itemCode.trim()) {
        return res.status(400).json({ error: `Invalid or missing itemCode in product at index ${index}` });
      }
      if (!product.itemName || typeof product.itemName !== 'string' || !product.itemName.trim()) {
        return res.status(400).json({ error: `Invalid or missing itemName in product at index ${index}` });
      }
      if (!product.unitPrice || typeof product.unitPrice !== 'number' || product.unitPrice <= 0) {
        return res.status(400).json({ error: `Invalid or missing unitPrice (must be a positive number) in product at index ${index}` });
      }
      if (product.gst !== undefined && (typeof product.gst !== 'number' || product.gst < 0)) {
        return res.status(400).json({ error: `Invalid gst (must be a non-negative number) in product at index ${index}` });
      }
      if (product.quantity !== undefined && (typeof product.quantity !== 'number' || product.quantity < 0 || !Number.isInteger(product.quantity))) {
        return res.status(400).json({ error: `Invalid quantity (must be a non-negative integer) in product at index ${index}` });
      }
      if (product.department && (!validDepartments.includes(product.department) || typeof product.department !== 'string')) {
        return res.status(400).json({ error: `Invalid department in product at index ${index}` });
      }
      if (product.hsn && typeof product.hsn !== 'string') {
        return res.status(400).json({ error: `Invalid hsn (must be a string) in product at index ${index}` });
      }
    }

    // Create products in Firebase
    console.log('Creating products in Firebase');
    const createdProducts = [];
    
    for (const product of products) {
      const productData = {
        itemCode: product.itemCode.trim(),
        itemName: product.itemName.trim(),
        hsn: product.hsn ? product.hsn.trim() : undefined,
        gst: product.gst !== undefined ? product.gst : 0,
        unitPrice: product.unitPrice,
        quantity: product.quantity !== undefined ? product.quantity : 0,
        department: product.department || 'General',
        createdBy: req.user.id,
      };
      
      const createdProduct = await productService.createProduct(productData);
      createdProducts.push(createdProduct);
    }

    console.log('Products created successfully:', createdProducts.length);
    res.status(201).json({
      message: `${createdProducts.length} products created successfully`,
      products: createdProducts
    });

  } catch (error) {
    console.error('Create bulk products error:', error);
    res.status(500).json({ 
      error: 'Server error while creating products',
      details: error.message 
    });
  }
};

export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if product exists
    const existingProduct = await productService.getProductById(id);
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Authorization check
    if (req.user.role !== 'super_admin' && 
        !(req.user.role === 'admin' && 
          req.user.department.toLowerCase() === 'purchase')) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Update product
    const updatedProduct = await productService.updateProduct(id, updateData);
    
    res.json(updatedProduct);

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Server error while updating product' });
  }
};

export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if product exists
    const existingProduct = await productService.getProductById(id);
    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Authorization check
    if (req.user.role !== 'super_admin' && 
        !(req.user.role === 'admin' && 
          req.user.department.toLowerCase() === 'purchase')) {
      return res.status(403).json({ error: 'Unauthorized access' });
    }

    // Delete product
    await productService.deleteProduct(id);
    
    res.json({ message: 'Product deleted successfully' });

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({ error: 'Server error while deleting product' });
  }
};

export const getProductsByCreator = async (req, res) => {
  try {
    const { userId } = req.params;
    const products = await productService.getWhere('products', 'createdBy', '==', userId);
    res.json(products);
  } catch (error) {
    console.error('Get products by creator error:', error);
    res.status(500).json({ error: 'Server error while fetching products' });
  }
};

export const getAllSoldProducts = async (req, res) => {
  try {
    const soldProducts = await productService.getAll('soldProducts', 'date', 'desc');
    res.json(soldProducts);
  } catch (error) {
    console.error('Get sold products error:', error);
    res.status(500).json({ error: 'Server error while fetching sold products' });
  }
};

export const recordSoldProduct = async (req, res) => {
  try {
    const { itemCode, itemName, hsn, gst, unitRate, quantity, source } = req.body;

    // Validate required fields
    if (!itemCode || !itemName || !hsn || !unitRate || !quantity) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const soldProductData = {
      itemCode,
      itemName,
      hsn,
      gst: gst || 0,
      unitRate,
      quantity,
      source: source || 'SoldProduct',
      date: new Date(),
      createdBy: req.user.id
    };

    const createdSoldProduct = await productService.create('soldProducts', soldProductData);
    
    res.status(201).json({
      message: 'Sold product recorded successfully',
      soldProduct: createdSoldProduct
    });

  } catch (error) {
    console.error('Record sold product error:', error);
    res.status(500).json({ error: 'Server error while recording sold product' });
  }
};

export const getInventory = async (req, res) => {
  try {
    const inventory = await inventoryService.getAllInventoryItems();
    res.json({ success: true, data: inventory });
  } catch (error) {
    console.error('Get inventory error:', error);
    res.status(500).json({ error: 'Server error while fetching inventory' });
  }
};

export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;
    const product = await productService.getProductById(id);
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    res.json(product);
  } catch (error) {
    console.error('Get product by ID error:', error);
    res.status(500).json({ error: 'Server error while fetching product' });
  }
};
