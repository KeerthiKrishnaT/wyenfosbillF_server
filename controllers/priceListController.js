import { 
  firebaseService 
} from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';

export const createPriceList = async (req, res) => {
  try {
    const { validFrom, products } = req.body;
    if (!validFrom || !products || !Array.isArray(products)) {
      return res.status(400).json({ message: 'Invalid data format' });
    }

    const priceListData = {
      id: generateUniqueId(),
      validFrom,
      products,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const newList = await firebaseService.create('priceLists', priceListData);

    res.status(201).json({ message: 'Price List created successfully', data: newList });
  } catch (err) {
    console.error('Create Price List Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};

export const getAllPriceLists = async (req, res) => {
  try {
    const lists = await firebaseService.getAll('priceLists');
    // Sort by validFrom date (newest first)
    lists.sort((a, b) => new Date(b.validFrom) - new Date(a.validFrom));
    res.status(200).json({ data: lists });
  } catch (err) {
    console.error('Get Price Lists Error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
};
