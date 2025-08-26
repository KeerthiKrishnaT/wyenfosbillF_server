import { customerService } from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';

// Function to generate sequential customer ID
const generateSequentialCustomerId = async () => {
  try {
    const customers = await customerService.getAllCustomers();
    console.log('Total customers found:', customers.length);
    
    // Find the highest customer ID number
    let maxNumber = 0;
    customers.forEach(customer => {
      console.log('Checking customer:', customer.customerId);
      if (customer.customerId && customer.customerId.startsWith('CUST-')) {
        const number = parseInt(customer.customerId.replace('CUST-', ''));
        console.log('Parsed number:', number);
        if (!isNaN(number) && number > maxNumber) {
          maxNumber = number;
        }
      }
    });
    
    console.log('Max number found:', maxNumber);
    const nextId = `CUST-${maxNumber + 1}`;
    console.log('Generated ID:', nextId);
    
    // Generate next sequential ID
    return nextId;
  } catch (error) {
    console.error('Error generating sequential customer ID:', error);
    // Fallback to timestamp-based ID
    return `CUST-${Date.now()}`;
  }
};

export const createCustomer = async (req, res) => {
  try {
    const { customerName, customerContact, company, createdBy, lastUpdatedBy } = req.body;
    
    // Validate required fields
    const missingFields = [];
    if (!customerName) missingFields.push('customerName');
    if (!company) missingFields.push('company');
    if (!createdBy) missingFields.push('createdBy');
    if (!lastUpdatedBy) missingFields.push('lastUpdatedBy');
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        message: `Missing required fields: ${missingFields.join(', ')}` 
      });
    }

    // Check for existing customer with same contact info (only if contact info is provided)
    let existingCustomer = null;
    console.log('createCustomer: Checking for existing customer with contact info:', {
      phone: customerContact?.phone || 'empty',
      email: customerContact?.email || 'empty'
    });
    
    if (customerContact?.phone || customerContact?.email) {
      const existingCustomers = await customerService.getAllCustomers();
      existingCustomer = existingCustomers.find(customer => 
        (customerContact?.phone && customer.customerContact?.phone === customerContact?.phone) ||
        (customerContact?.email && customer.customerContact?.email === customerContact?.email)
      );
      console.log('createCustomer: Existing customer found:', existingCustomer ? existingCustomer.customerName : 'none');
    } else {
      console.log('createCustomer: No contact info provided, skipping existing customer check');
    }

    if (existingCustomer) {
      // Update existing customer with new company
      const existingCompany = existingCustomer.company || '';
      const updatedCompany = existingCompany === company ? existingCompany : `${existingCompany}, ${company}`;
      const updatedCustomer = await customerService.updateCustomer(existingCustomer.id, {
        company: updatedCompany,
        lastUpdatedBy,
        updatedAt: new Date()
      });
      
      return res.status(200).json({ 
        ...existingCustomer, 
        company: updatedCompany 
      });
    }

    // Create new customer with sequential ID
    const customerId = await generateSequentialCustomerId();
    const customerData = {
      customerId,
      customerName,
      customerContact: {
        address: customerContact?.address || '',
        phone: customerContact?.phone || '',
        email: customerContact?.email || '',
        gstin: customerContact?.gstin || '',
        associatedWith: null,
      },
      company: company,
      createdBy,
      lastUpdatedBy,
      transactions: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    console.log('Creating customer with data:', customerData);
    const newCustomer = await customerService.createCustomer(customerData);
    console.log('Customer created successfully:', newCustomer);
    res.status(201).json(newCustomer);
    
  } catch (error) {
    console.error('createCustomer Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getCustomers = async (req, res) => {
  try {
    console.log('Getting all customers...');
    const customers = await customerService.getAllCustomers();
    console.log('Retrieved customers:', customers);
    console.log('Number of customers:', customers.length);
    res.status(200).json(customers);
  } catch (error) {
    console.error('getCustomers Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getCustomerById = async (req, res) => {
  try {
    const { id } = req.params;
    let customer;

    if (id.startsWith('CUST')) {
      // Search by customerId
      const customers = await customerService.getAllCustomers();
      customer = customers.find(c => c.customerId === id);
    } else {
      // Search by document ID
      customer = await customerService.getCustomerById(id);
    }

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    res.status(200).json(customer);
  } catch (error) {
    console.error('getCustomerById Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if customer exists
    const existingCustomer = await customerService.getCustomerById(id);
    if (!existingCustomer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Update customer
    const updatedCustomer = await customerService.updateCustomer(id, {
      ...updateData,
      updatedAt: new Date()
    });

    res.status(200).json(updatedCustomer);
  } catch (error) {
    console.error('updateCustomer Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const deleteCustomer = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if customer exists
    const existingCustomer = await customerService.getCustomerById(id);
    if (!existingCustomer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Delete customer
    await customerService.deleteCustomer(id);
    
    res.status(200).json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('deleteCustomer Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const findCustomer = async (req, res) => {
  try {
    const { query, company } = req.query;
    
    if (!query) {
      return res.status(400).json({ message: 'Query parameter is required' });
    }

    console.log('findCustomer: Searching for query:', query, 'company:', company);

    const customers = await customerService.getAllCustomers();
    console.log('findCustomer: Total customers found:', customers.length);
    
    let filteredCustomers = customers.filter(customer => {
      // Check if customer belongs to the specified company (if company filter is provided)
      if (company) {
        const customerCompanies = Array.isArray(customer.company) ? customer.company : [customer.company];
        const companyMatch = customerCompanies.some(c => c === company);
        if (!companyMatch) {
          return false;
        }
      }

      // Exact name match (case insensitive)
      const exactNameMatch = customer.customerName.toLowerCase() === query.toLowerCase();
      
      // Partial name match (only if query is at least 4 characters)
      const partialNameMatch = query.length >= 4 && customer.customerName.toLowerCase().includes(query.toLowerCase());
      
      // Exact phone match
      const phoneMatch = customer.customerContact?.phone === query;
      
      // Exact email match (case insensitive)
      const emailMatch = customer.customerContact?.email?.toLowerCase() === query.toLowerCase();
      
      console.log(`findCustomer: Checking customer "${customer.customerName}" - exactNameMatch: ${exactNameMatch}, partialNameMatch: ${partialNameMatch}, phoneMatch: ${phoneMatch}, emailMatch: ${emailMatch}`);
      
      return exactNameMatch || partialNameMatch || phoneMatch || emailMatch;
    });

    // If no customers found with company filter, try without company filter
    if (filteredCustomers.length === 0 && company) {
      console.log('findCustomer: No customers found with company filter, trying without company filter');
      filteredCustomers = customers.filter(customer => {
        // Exact name match (case insensitive)
        const exactNameMatch = customer.customerName.toLowerCase() === query.toLowerCase();
        
        // Partial name match (only if query is at least 4 characters)
        const partialNameMatch = query.length >= 4 && customer.customerName.toLowerCase().includes(query.toLowerCase());
        
        // Exact phone match
        const phoneMatch = customer.customerContact?.phone === query;
        
        // Exact email match (case insensitive)
        const emailMatch = customer.customerContact?.email?.toLowerCase() === query.toLowerCase();
        
        return exactNameMatch || partialNameMatch || phoneMatch || emailMatch;
      });
      
      // If customers found without company filter, update their company field
      if (filteredCustomers.length > 0) {
        console.log('findCustomer: Found customers without company filter, updating their company field');
        for (const customer of filteredCustomers) {
          try {
            const existingCompany = customer.company || '';
            const updatedCompany = existingCompany === company ? existingCompany : 
              existingCompany ? `${existingCompany}, ${company}` : company;
            
            await customerService.updateCustomer(customer.id, {
              company: updatedCompany,
              lastUpdatedBy: 'system',
              updatedAt: new Date()
            });
            
            // Update the customer object in the response
            customer.company = updatedCompany;
          } catch (updateError) {
            console.error('Error updating customer company:', updateError);
          }
        }
      }
    }

    console.log('findCustomer: Final filtered customers:', filteredCustomers.map(c => c.customerName));
    res.status(200).json(filteredCustomers);
  } catch (error) {
    console.error('findCustomer Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const updateCustomerTransaction = async (req, res) => {
  try {
    const { id } = req.params;
    const { transaction } = req.body;

    if (!transaction) {
      return res.status(400).json({ message: 'Transaction data is required' });
    }

    // Check if customer exists
    const existingCustomer = await customerService.getCustomerById(id);
    if (!existingCustomer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    // Update customer transactions
    const updatedTransactions = [...(existingCustomer.transactions || []), transaction];
    const updatedCustomer = await customerService.updateCustomer(id, {
      transactions: updatedTransactions,
      updatedAt: new Date()
    });

    res.status(200).json(updatedCustomer);
  } catch (error) {
    console.error('updateCustomerTransaction Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getTodayCustomers = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const customers = await customerService.getAllCustomers();
    const todayCustomers = customers.filter(customer => {
      const customerDate = new Date(customer.createdAt);
      return customerDate >= today;
    });

    res.status(200).json(todayCustomers);
  } catch (error) {
    console.error('getTodayCustomers Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const getCustomerBills = async (req, res) => {
  try {
    const { customerId } = req.params;
    
    // Get bills for this customer
    const bills = await customerService.getWhere('bills', 'customerId', '==', customerId);
    
    res.status(200).json(bills);
  } catch (error) {
    console.error('getCustomerBills Error:', error);
    res.status(500).json({ message: error.message });
  }
};