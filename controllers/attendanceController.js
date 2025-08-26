import { 
  firebaseService, 
  userService 
} from '../services/firebaseService.js';
import { generateUniqueId } from '../services/firebaseService.js';

// Working hours configuration
const WORKING_HOURS = {
  start: 9, // 9 AM
  end: 9.5, // 9:30 AM (9.5 hours from midnight)
  gracePeriod: 30 // 30 minutes grace period
};

// Check if time is within working hours
const isWithinWorkingHours = (date) => {
  const hour = date.getHours();
  const minutes = date.getMinutes();
  const timeInHours = hour + (minutes / 60);
  
  return timeInHours >= WORKING_HOURS.start && timeInHours <= (WORKING_HOURS.start + (WORKING_HOURS.gracePeriod / 60));
};

// Get all users and their attendance for a specific date
export const getDailyAttendance = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    // Get all users from Firestore
    const allUsers = await userService.getAllUsers();
    
    // Get punching times for the target date
    const allPunchingTimes = await firebaseService.getAll('punchingTimes');
    const dayPunchingTimes = allPunchingTimes.filter(pt => pt.date === targetDate);
    
    // Create attendance records for all users
    const attendanceRecords = allUsers.map(user => {
      const userPunch = dayPunchingTimes.find(pt => pt.email === user.email);
      
      if (userPunch) {
        // User logged in
        const punchInTime = new Date(userPunch.punchIn);
        const isOnTime = isWithinWorkingHours(punchInTime);
        
        return {
          id: userPunch.id,
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          date: targetDate,
          punchIn: userPunch.punchIn,
          punchOut: userPunch.punchOut,
          duration: userPunch.duration,
          status: isOnTime ? 'present' : 'late',
          loginType: userPunch.loginType || 'manual',
          isOnTime,
          createdAt: userPunch.createdAt,
          updatedAt: userPunch.updatedAt
        };
      } else {
        // User didn't log in - mark as absent/leave
        return {
          id: generateUniqueId(),
          userId: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          department: user.department,
          date: targetDate,
          punchIn: null,
          punchOut: null,
          duration: null,
          status: 'absent',
          loginType: 'none',
          isOnTime: false,
          createdAt: new Date(),
          updatedAt: new Date()
        };
      }
    });
    
    // Sort by role and name
    attendanceRecords.sort((a, b) => {
      if (a.role !== b.role) {
        const roleOrder = { 'super_admin': 1, 'admin': 2, 'staff': 3 };
        return (roleOrder[a.role] || 4) - (roleOrder[b.role] || 4);
      }
      return a.name.localeCompare(b.name);
    });
    
    res.json({
      date: targetDate,
      totalUsers: allUsers.length,
      present: attendanceRecords.filter(r => r.status === 'present').length,
      late: attendanceRecords.filter(r => r.status === 'late').length,
      absent: attendanceRecords.filter(r => r.status === 'absent').length,
      records: attendanceRecords
    });
  } catch (err) {
    console.error('getDailyAttendance error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get attendance summary for a date range
export const getAttendanceSummary = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate || new Date().toISOString().split('T')[0];
    const end = endDate || start;
    
    // Get all users
    const allUsers = await userService.getAllUsers();
    
    // Get punching times for the date range
    const allPunchingTimes = await firebaseService.getAll('punchingTimes');
    const rangePunchingTimes = allPunchingTimes.filter(pt => 
      pt.date >= start && pt.date <= end
    );
    
    // Group by date
    const dailyStats = {};
    const dateRange = [];
    let currentDate = new Date(start);
    const endDateObj = new Date(end);
    
    while (currentDate <= endDateObj) {
      const dateStr = currentDate.toISOString().split('T')[0];
      dateRange.push(dateStr);
      dailyStats[dateStr] = {
        date: dateStr,
        total: allUsers.length,
        present: 0,
        late: 0,
        absent: 0
      };
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Calculate stats for each date
    dateRange.forEach(date => {
      const dayPunches = rangePunchingTimes.filter(pt => pt.date === date);
      
      allUsers.forEach(user => {
        const userPunch = dayPunches.find(pt => pt.email === user.email);
        
        if (userPunch) {
          const punchInTime = new Date(userPunch.punchIn);
          const isOnTime = isWithinWorkingHours(punchInTime);
          
          if (isOnTime) {
            dailyStats[date].present++;
          } else {
            dailyStats[date].late++;
          }
        } else {
          dailyStats[date].absent++;
        }
      });
    });
    
    res.json({
      startDate: start,
      endDate: end,
      totalUsers: allUsers.length,
      dailyStats: Object.values(dailyStats)
    });
  } catch (err) {
    console.error('getAttendanceSummary error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Mark user as present manually (for HR admin)
export const markUserPresent = async (req, res) => {
  try {
    const { email, date, punchInTime } = req.body;
    
    if (!email || !date) {
      return res.status(400).json({ error: 'Email and date are required' });
    }
    
    // Get user details
    const user = await userService.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if already has attendance record for this date
    const allPunchingTimes = await firebaseService.getAll('punchingTimes');
    const existingRecord = allPunchingTimes.find(pt => 
      pt.email === email && pt.date === date
    );
    
    if (existingRecord) {
      return res.status(400).json({ 
        error: 'Attendance record already exists for this date',
        record: existingRecord
      });
    }
    
    // Create attendance record
    const currentTime = new Date();
    const punchIn = punchInTime || currentTime.toISOString();
    
    const attendanceData = {
      id: generateUniqueId(),
      email: user.email,
      role: user.role,
      name: user.name,
      punchIn,
      date,
      loginType: 'manual',
      createdAt: currentTime,
      updatedAt: currentTime
    };
    
    const newRecord = await firebaseService.create('punchingTimes', attendanceData);
    res.status(201).json(newRecord);
  } catch (err) {
    console.error('markUserPresent error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Mark user as absent/leave manually
export const markUserAbsent = async (req, res) => {
  try {
    const { email, date, reason } = req.body;
    
    if (!email || !date) {
      return res.status(400).json({ error: 'Email and date are required' });
    }
    
    // Get user details
    const user = await userService.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Check if already has attendance record
    const allPunchingTimes = await firebaseService.getAll('punchingTimes');
    const existingRecord = allPunchingTimes.find(pt => 
      pt.email === email && pt.date === date
    );
    
    if (existingRecord) {
      return res.status(400).json({ 
        error: 'Attendance record already exists for this date',
        record: existingRecord
      });
    }
    
    // Create absence record
    const currentTime = new Date();
    const absenceData = {
      id: generateUniqueId(),
      email: user.email,
      role: user.role,
      name: user.name,
      date,
      status: 'absent',
      reason: reason || 'Not logged in',
      loginType: 'none',
      createdAt: currentTime,
      updatedAt: currentTime
    };
    
    const newRecord = await firebaseService.create('punchingTimes', absenceData);
    res.status(201).json(newRecord);
  } catch (err) {
    console.error('markUserAbsent error:', err);
    res.status(500).json({ error: err.message });
  }
};

// Get working hours configuration
export const getWorkingHours = async (req, res) => {
  res.json({
    workingHours: WORKING_HOURS,
    description: 'Working hours: 9:00 AM - 9:30 AM (30 minutes grace period)'
  });
};

// Update working hours configuration
export const updateWorkingHours = async (req, res) => {
  try {
    const { start, end, gracePeriod } = req.body;
    
    // Validate input
    if (start < 0 || start > 23 || end < 0 || end > 23) {
      return res.status(400).json({ error: 'Invalid time format' });
    }
    
    if (gracePeriod < 0 || gracePeriod > 120) {
      return res.status(400).json({ error: 'Grace period must be between 0 and 120 minutes' });
    }
    
    // Update working hours (in a real app, you'd store this in database)
    WORKING_HOURS.start = start;
    WORKING_HOURS.end = end;
    WORKING_HOURS.gracePeriod = gracePeriod;
    
    res.json({
      message: 'Working hours updated successfully',
      workingHours: WORKING_HOURS
    });
  } catch (err) {
    console.error('updateWorkingHours error:', err);
    res.status(500).json({ error: err.message });
  }
};