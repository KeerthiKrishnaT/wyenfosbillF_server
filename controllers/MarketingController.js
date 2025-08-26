import { 
  firebaseService 
} from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';

// Add a new staff member
export const addStaff = async (req, res) => {
  try {
    const { name, email, role } = req.body;
    if (!name || !email || !role) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if email already exists - use getAll and filter in memory to avoid index issues
    const allStaff = await firebaseService.getAll('marketingStaff');
    const existingStaff = allStaff.find(staff => staff.email === email);
    if (existingStaff) {
      return res.status(400).json({ error: 'Email already exists' });
    }

    const staffData = {
      customId: generateUniqueId(),
      name,
      email,
      role,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const staff = await firebaseService.create('marketingStaff', staffData);
    res.status(201).json({ staff });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch all staff members
export const getStaffs = async (req, res) => {
  try {
    const staffs = await firebaseService.getAll('marketingStaff');
    res.json({ staffs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Delete a staff member
export const deleteStaff = async (req, res) => {
  try {
    const staff = await firebaseService.delete('marketingStaff', req.params.id);
    if (!staff) {
      return res.status(404).json({ error: 'Staff not found' });
    }
    res.json({ message: 'Staff deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add a new client
export const addClient = async (req, res) => {
  try {
    const { name, contact, address } = req.body;
    if (!name || !contact || !address) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if client already exists - use getAll and filter in memory to avoid index issues
    const allClients = await firebaseService.getAll('marketingClients');
    const existingClient = allClients.find(client => client.name === name);
    if (existingClient) {
      return res.status(400).json({ error: 'Client already exists' });
    }

    const clientData = {
      customId: generateUniqueId(),
      name,
      contact,
      address,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const client = await firebaseService.create('marketingClients', clientData);
    res.status(201).json({ client });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch all clients
export const getClients = async (req, res) => {
  try {
    const clients = await firebaseService.getAll('marketingClients');
    res.json({ clients });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Add a new shop
export const addShop = async (req, res) => {
  try {
    const { name, address, gstNumber } = req.body;
    if (!name || !address || !gstNumber) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if shop already exists - use getAll and filter in memory to avoid index issues
    const allShops = await firebaseService.getAll('marketingShops');
    const existingShop = allShops.find(shop => shop.name === name);
    if (existingShop) {
      return res.status(400).json({ error: 'Shop already exists' });
    }

    const shopData = {
      customId: generateUniqueId(),
      name,
      address,
      gstNumber,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const shop = await firebaseService.create('marketingShops', shopData);
    res.status(201).json({ shop });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Fetch all shops
export const getShops = async (req, res) => {
  try {
    const shops = await firebaseService.getAll('marketingShops');
    res.json({ shops });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// Send message to selected staff (stubbed)
export const sendMessage = async (req, res) => {
  try {
    const { staffIds, message } = req.body;
    if (!staffIds || !message) {
      return res.status(400).json({ error: 'Staff IDs and message are required' });
    }
    // In a real application, you'd implement message sending logic here (e.g., email, notification)
    res.json({ message: 'Message sent successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};