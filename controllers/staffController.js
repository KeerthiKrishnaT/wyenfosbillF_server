import { staffService, companyService, userService } from '../services/firebaseService.js';

export const getAllStaff = async (req, res) => {
  try {
    const staff = await staffService.getAllStaff();
    // Remove sensitive data and format response
    const formattedStaff = staff.map(staffMember => ({
      id: staffMember.id,
      name: staffMember.name,
      address: staffMember.address,
      email: staffMember.email,
      mobile: staffMember.mobile,
      role: staffMember.role,
      department: staffMember.department,
      company: staffMember.company,
      status: staffMember.status
    }));
    res.json(formattedStaff);
  } catch (err) {
    console.error('getAllStaff Error:', err);
    res.status(500).json({
      message: 'Failed to fetch staff data',
      error: err.message
    });
  }
};

export const getAllCompanies = async (req, res) => {
  try {
    const companies = await companyService.getAllCompanies();
    const companyList = companies.map(company => ({
      id: company.id,
      name: company.name
    }));
    res.json(companyList);
  } catch (err) {
    console.error('getAllCompanies Error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const createStaff = async (req, res) => {
  try {
    const { name, address, email, mobile, role, department } = req.body;
    if (!name || !email || !mobile || !role) {
      return res.status(400).json({ message: 'Name, Email, Mobile, and Role are required.' });
    }
    if (role === 'admin' && !department) {
      return res.status(400).json({ message: 'Department is required for admin role.' });
    }
    const staffData = {
      name,
      address,
      email,
      mobile,
      role,
      department: role === 'admin' ? department : null,
      company: req.user?.company || null,
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date()
    };
    const newStaff = await staffService.createStaff(staffData);
    res.status(201).json(newStaff);
  } catch (err) {
    console.error('createStaff Error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const updateStaff = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, email, mobile, role, department } = req.body;
    if (role === 'admin' && !department) {
      return res.status(400).json({ message: 'Department is required for admin role.' });
    }
    // Check if staff exists
    const existingStaff = await staffService.getStaffById(id);
    if (!existingStaff) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    const updateData = {
      name,
      address,
      email,
      mobile,
      role,
      company: req.body.company,
      department: role === 'admin' ? department : null,
      updatedAt: new Date()
    };
    const updatedStaff = await staffService.updateStaff(id, updateData);
    res.json(updatedStaff);
  } catch (err) {
    console.error('updateStaff Error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const deleteStaff = async (req, res) => {
  try {
    const { id } = req.params;
    // Check if staff exists
    const existingStaff = await staffService.getStaffById(id);
    if (!existingStaff) {
      return res.status(404).json({ message: 'Staff not found' });
    }
    await staffService.deleteStaff(id);
    res.json({ message: 'Staff deleted successfully' });
  } catch (err) {
    console.error('deleteStaff Error:', err);
    res.status(500).json({ message: err.message });
  }
};

export const getActiveStaffMinimal = async (req, res) => {
  try {
    const allStaff = await staffService.getAllStaff();
    const activeStaff = allStaff
      .filter(staff => staff.status === 'active' && staff.company === req.user?.company)
      .map(staff => ({
        _id: staff.id,
        name: staff.name,
        role: staff.role,
        department: staff.department
      }));
    res.json(activeStaff);
  } catch (error) {
    console.error('getActiveStaffMinimal Error:', error);
    res.status(500).json({ message: 'Failed to fetch active staff' });
  }
};