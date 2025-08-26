import { 
  firebaseService, 
  companyService 
} from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';

export const getAppointments = async (req, res) => {
  try {
    const appointments = await firebaseService.getAll('appointments');
    
    // Populate company data for each appointment
    const populatedAppointments = await Promise.all(
      appointments.map(async (appointment) => {
        if (appointment.company) {
          const company = await companyService.getCompanyById(appointment.company);
          return {
            ...appointment,
            company: company ? { companyName: company.companyName } : null
          };
        }
        return appointment;
      })
    );
    
    console.log('Fetched appointments with company:', populatedAppointments);
    res.json(populatedAppointments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createAppointment = async (req, res) => {
  try {
    const { name, role, date, status, company, email, phone } = req.body;
    if (!name || !role || !date) {
      return res.status(400).json({ error: 'Name, Role, and Date are required.' });
    }
    
    // Validate company ID if provided
    if (company) {
      const companyExists = await companyService.getCompanyById(company);
      if (!companyExists) {
        return res.status(400).json({ error: 'Invalid company ID.' });
      }
    }
    
    const appointmentData = {
      id: generateUniqueId(),
      name,
      role,
      date,
      status,
      company: company || req.company?.id || null,
      createdBy: req.user?.id || null,
      email,
      phone,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const appointment = await firebaseService.create('appointments', appointmentData);
    res.status(201).json(appointment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const updateAppointment = async (req, res) => {
  try {
    const { name, role, date, status, company, phone, email } = req.body;
    const { id } = req.params;
    
    const updateData = {
      name,
      role,
      date,
      status,
      company,
      phone,
      email,
      updatedAt: new Date()
    };
    
    const appointment = await firebaseService.update('appointments', id, updateData);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    res.json(appointment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deleteAppointment = async (req, res) => {
  try {
    const { id } = req.params;
    const appointment = await firebaseService.delete('appointments', id);
    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ message: 'Appointment deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};