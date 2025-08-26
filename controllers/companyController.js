import { companyService } from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';
import fs from 'fs';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';

const router = express.Router();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer configuration moved to routes

const buildImageUrl = (filename) => {
  if (!filename) return null;
  return `/uploads/${filename}`;
};

export const getCompanies = async (req, res) => {
  try {
    const { type, page = 1, limit = 10 } = req.query;
    
    let companies = await companyService.getAllCompanies();
    
    // Filter by type if provided
    if (type) {
      companies = companies.filter(company => company.type === type);
    }
    
    // Pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const paginatedCompanies = companies.slice(skip, skip + limitNum);
    
    const total = companies.length;

    res.json({ 
      success: true, 
      companies: paginatedCompanies, 
      page: pageNum, 
      limit: limitNum, 
      total 
    });
  } catch (error) {
    console.error('getCompanies Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch companies', 
      error: error.message 
    });
  }
};

export const getCompany = async (req, res) => {
  try {
    const { id } = req.params;
    
    const company = await companyService.getCompanyById(id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    res.json(company);
  } catch (error) {
    console.error('getCompany Error:', error);
    res.status(500).json({ message: error.message });
  }
};

export const createCompany = async (req, res) => {
  try {
    const { name, prefix, address, mobile, email, website, GSTIN, state, stateCode, type } = req.body;

    if (!prefix) {
      return res.status(400).json({ message: 'Prefix is required' });
    }

    const companyData = {
      name,
      prefix,
      address,
      mobile,
      email,
      website,
      GSTIN,
      state,
      stateCode,
      type,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Handle file uploads if present
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        if (file.fieldname === 'primaryLogo') {
          const filename = file.originalname;
          const filepath = path.join(uploadDir, filename);
          fs.writeFileSync(filepath, file.buffer);
          companyData.logoUrl = `/uploads/${filename}`;
        } else if (file.fieldname === 'secondaryLogo') {
          const filename = file.originalname;
          const filepath = path.join(uploadDir, filename);
          fs.writeFileSync(filepath, file.buffer);
          companyData.secondaryLogoUrl = `/uploads/${filename}`;
        }
      }
    }

    const newCompany = await companyService.createCompany(companyData);
    
    res.status(201).json({
      success: true,
      message: 'Company created successfully',
      company: newCompany
    });

  } catch (error) {
    console.error('createCompany Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to create company', 
      error: error.message 
    });
  }
};

export const updateCompany = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check if company exists
    const existingCompany = await companyService.getCompanyById(id);
    if (!existingCompany) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Handle file uploads if present
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        if (file.fieldname === 'primaryLogo') {
          const filename = file.originalname;
          const filepath = path.join(uploadDir, filename);
          fs.writeFileSync(filepath, file.buffer);
          updateData.logoUrl = `/uploads/${filename}`;
        } else if (file.fieldname === 'secondaryLogo') {
          const filename = file.originalname;
          const filepath = path.join(uploadDir, filename);
          fs.writeFileSync(filepath, file.buffer);
          updateData.secondaryLogoUrl = `/uploads/${filename}`;
        }
      }
    }

    updateData.updatedAt = new Date();

    const updatedCompany = await companyService.updateCompany(id, updateData);
    
    res.json({
      success: true,
      message: 'Company updated successfully',
      company: updatedCompany
    });

  } catch (error) {
    console.error('updateCompany Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to update company', 
      error: error.message 
    });
  }
};

export const deleteCompany = async (req, res) => {
  try {
    const { id } = req.params;

    // Check if company exists
    const existingCompany = await companyService.getCompanyById(id);
    if (!existingCompany) {
      return res.status(404).json({ message: 'Company not found' });
    }

    // Delete company
    await companyService.deleteCompany(id);
    
    res.json({ 
      success: true, 
      message: 'Company deleted successfully' 
    });

  } catch (error) {
    console.error('deleteCompany Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete company', 
      error: error.message 
    });
  }
};

export const getCompanyById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const company = await companyService.getCompanyById(id);
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    
    res.json({
      success: true,
      company
    });

  } catch (error) {
    console.error('getCompanyById Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch company', 
      error: error.message 
    });
  }
};

export const getCompanyNames = async (req, res) => {
  try {
    const companies = await companyService.getAllCompanies();
    
    const companyNames = companies.map(company => ({
      _id: company.id,
      name: company.name,
      prefix: company.prefix,
      logoUrl: company.logoUrl
    }));
    
    res.json({
      success: true,
      data: companyNames
    });

  } catch (error) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch company names from Firestore', 
      error: error.message
    });
  }
};

export const getCompanyByName = async (req, res) => {
  try {
    const { name } = req.params;
    
    const companies = await companyService.getAllCompanies();
    const company = companies.find(c => c.name === name);
    
    if (!company) {
      return res.status(404).json({ message: 'Company not found' });
    }
    
    res.json({
      success: true,
      company
    });

  } catch (error) {
    console.error('getCompanyByName Error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch company', 
      error: error.message 
    });
  }
};
