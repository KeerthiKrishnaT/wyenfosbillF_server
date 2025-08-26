import { 
  firebaseService, 
  userService 
} from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';

export const getPunchingTimes = async (req, res) => {
  try {
    const punchingTimes = await firebaseService.getAll('punchingTimes', 'createdAt', 'desc');
    
    // Calculate duration for records that have both punch in and out
    const enhancedPunchingTimes = punchingTimes.map(record => {
      const enhanced = { ...record };
      if (record.punchIn && record.punchOut) {
        const duration = Math.floor((new Date(record.punchOut) - new Date(record.punchIn)) / (1000 * 60));
        enhanced.duration = duration;
      }
      return enhanced;
    });
    
    res.json(enhancedPunchingTimes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const createPunchingTime = async (req, res) => {
  try {
    const { staffId, punchIn, punchOut } = req.body;
    if (!staffId || !punchIn) {
      return res.status(400).json({ error: 'Staff ID and Punch In Time are required.' });
    }

    const punchingTimeData = {
      id: generateUniqueId(),
      staffId,
      punchIn,
      punchOut,
      company: req.user?.company || null,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (punchOut) {
      punchingTimeData.duration = Math.floor((new Date(punchOut) - new Date(punchIn)) / (1000 * 60));
    }

    const punchingTime = await firebaseService.create('punchingTimes', punchingTimeData);
    res.status(201).json(punchingTime);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const updatePunchingTime = async (req, res) => {
  try {
    const { punchIn, punchOut } = req.body;
    const updateData = { 
      punchIn, 
      punchOut,
      updatedAt: new Date()
    };

    if (punchOut) {
      updateData.duration = Math.floor((new Date(punchOut) - new Date(punchIn)) / (1000 * 60));
    }

    const punchingTime = await firebaseService.update('punchingTimes', req.params.id, updateData);

    if (!punchingTime) return res.status(404).json({ error: 'Punching time not found' });
    res.json(punchingTime);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const deletePunchingTime = async (req, res) => {
  try {
    const punchingTime = await firebaseService.delete('punchingTimes', req.params.id);
    if (!punchingTime) return res.status(404).json({ error: 'Punching time not found' });
    res.json({ message: 'Punching time deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const recordLogin = async (req, res) => {
  try {
    const { email, role, name } = req.body;
    
    if (!email || !role) {
      return res.status(400).json({ 
        error: 'Email and role are required' 
      });
    }

    // Use server time for accurate timestamp
    const serverTime = new Date();
    const punchIn = serverTime.toISOString();
    
    // Check if user already has an active session
    const allPunchingTimes = await firebaseService.getAll('punchingTimes');
    const activeSession = allPunchingTimes.find(pt => 
      pt.email === email && !pt.punchOut
    );
    
    if (activeSession) {
      return res.status(400).json({ 
        error: 'User already has an active punching session',
        suggestion: 'Please punch out first before punching in again'
      });
    }

    const punchingTimeData = {
      id: generateUniqueId(),
      email,
      role,
      name: name || 'Unknown User',
      punchIn,
      date: serverTime.toISOString().split('T')[0],
      createdAt: serverTime,
      updatedAt: serverTime
    };

    const punchingTime = await firebaseService.create('punchingTimes', punchingTimeData);
    res.status(201).json(punchingTime);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const recordLogout = async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        error: 'Email is required' 
      });
    }

    // Find the most recent punching time for this user without punchOut
    const allPunchingTimes = await firebaseService.getAll('punchingTimes');
    const punchingTime = allPunchingTimes
      .filter(pt => pt.email === email && !pt.punchOut)
      .sort((a, b) => new Date(b.punchIn) - new Date(a.punchIn))[0];

    if (!punchingTime) {
      return res.status(404).json({ 
        error: 'No active punching session found for this user',
        suggestion: 'User may have already logged out or session expired'
      });
    }

    // Use server time for accurate timestamp
    const serverTime = new Date();
    const punchOut = serverTime.toISOString();
    
    const updateData = {
      punchOut,
      duration: Math.floor((serverTime - new Date(punchingTime.punchIn)) / (1000 * 60)),
      updatedAt: serverTime
    };

    const updatedPunchingTime = await firebaseService.update('punchingTimes', punchingTime.id, updateData);

    res.json(updatedPunchingTime);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

export const getUserSessions = async (req, res) => {
  try {
    const allSessions = await firebaseService.getAll('userSessions');
    const sessions = allSessions
      .filter(session => session.userId === req.params.userId)
      .sort((a, b) => new Date(b.loginTime) - new Date(a.loginTime));

    // Populate user data
    const populatedSessions = await Promise.all(
      sessions.map(async (session) => {
        const user = await userService.getUserById(session.userId);
        return {
          ...session,
          user: user ? { name: user.name, role: user.role } : null
        };
      })
    );

    res.json(populatedSessions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const getCurrentPunchingTime = async (req, res) => {
  try {
    const user = req.user;
    if (!user || !user.email) {
      return res.json(null);
    }

    const allPunchingTimes = await firebaseService.getAll('punchingTimes');
    const currentPunch = allPunchingTimes
      .filter(pt => pt.email === user.email && !pt.punchOut)
      .sort((a, b) => new Date(b.punchIn) - new Date(a.punchIn))[0];

    if (!currentPunch) {
      return res.json(null);
    }

    res.json(currentPunch);
  } catch (err) {
    console.error('getCurrentPunchingTime error:', err);
    res.json(null);
  }
};