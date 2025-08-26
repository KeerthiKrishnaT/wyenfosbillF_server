import { firebaseService } from '../services/firebaseService.js';

// Get all product returns
export const getAllProductReturns = async (req, res) => {
  try {
    console.log('Getting all product returns for user:', req.user);
    
    const returns = await firebaseService.getAll('productReturns', 'returnDate', 'desc');
    
    // Add additional information to each return
    const enhancedReturns = returns.map(ret => ({
      ...ret,
      totalAmount: (ret.quantity || 0) * (ret.unitPrice || 0),
      gstAmount: ((ret.quantity || 0) * (ret.unitPrice || 0) * (ret.gst || 0)) / 100,
      formattedReturnDate: ret.returnDate ? new Date(ret.returnDate).toLocaleDateString() : 'N/A'
    }));
    
    console.log('Product returns fetched successfully, count:', enhancedReturns.length);
    
    res.status(200).json({
      success: true,
      data: enhancedReturns
    });
  } catch (error) {
    console.error('Error fetching product returns:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch product returns',
      error: error.message
    });
  }
};

// Get returns by item code
export const getReturnsByItemCode = async (req, res) => {
  try {
    const { itemCode } = req.params;
    
    const returns = await firebaseService.getWhere('productReturns', 'itemCode', '==', itemCode);
    
    const enhancedReturns = returns.map(ret => ({
      ...ret,
      totalAmount: (ret.quantity || 0) * (ret.unitPrice || 0),
      gstAmount: ((ret.quantity || 0) * (ret.unitPrice || 0) * (ret.gst || 0)) / 100,
      formattedReturnDate: ret.returnDate ? new Date(ret.returnDate).toLocaleDateString() : 'N/A'
    }));
    
    res.status(200).json({
      success: true,
      data: enhancedReturns
    });
  } catch (error) {
    console.error('Error fetching returns by item code:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch returns',
      error: error.message
    });
  }
};

// Get returns summary statistics
export const getReturnsSummary = async (req, res) => {
  try {
    const returns = await firebaseService.getAll('productReturns', 'returnDate', 'desc');
    
    const summary = {
      totalReturns: returns.length,
      totalQuantity: returns.reduce((sum, ret) => sum + (ret.quantity || 0), 0),
      totalValue: returns.reduce((sum, ret) => sum + ((ret.quantity || 0) * (ret.unitPrice || 0)), 0),
      returnsByType: {},
      recentReturns: returns.slice(0, 10) // Last 10 returns
    };
    
    // Group by return type
    returns.forEach(ret => {
      const type = ret.returnType || 'unknown';
      if (!summary.returnsByType[type]) {
        summary.returnsByType[type] = {
          count: 0,
          quantity: 0,
          value: 0
        };
      }
      summary.returnsByType[type].count++;
      summary.returnsByType[type].quantity += ret.quantity || 0;
      summary.returnsByType[type].value += (ret.quantity || 0) * (ret.unitPrice || 0);
    });
    
    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    console.error('Error fetching returns summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch returns summary',
      error: error.message
    });
  }
};
