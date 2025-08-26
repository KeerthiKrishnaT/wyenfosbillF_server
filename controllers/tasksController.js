import { firebaseService } from '../services/firebaseService.js';

// Get all tasks
export const getAllTasks = async (req, res) => {
  try {
    const tasks = await firebaseService.getAll('tasks');
    
    // Sort by creation date (newest first)
    const sortedTasks = tasks.sort((a, b) => 
      new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0)
    );
    
    res.json(sortedTasks);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching tasks',
      error: error.message 
    });
  }
};

// Get task by ID
export const getTaskById = async (req, res) => {
  try {
    const { id } = req.params;
    const task = await firebaseService.getById('tasks', id);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    res.json(task);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching task',
      error: error.message 
    });
  }
};

// Create new task
export const createTask = async (req, res) => {
  try {
    const { title, description, priority, dueDate, status } = req.body;
    
    if (!title || !description || !dueDate) {
      return res.status(400).json({ 
        message: 'Title, description, and due date are required' 
      });
    }
    
    const taskData = {
      title,
      description,
      priority: priority || 'medium',
      dueDate,
      status: status || 'pending',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: req.user?.uid || 'temp-user'
    };
    
    const newTask = await firebaseService.create('tasks', taskData);
    res.status(201).json(newTask);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error creating task',
      error: error.message 
    });
  }
};

// Update task
export const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // Add updated timestamp
    updateData.updatedAt = new Date().toISOString();
    
    const updatedTask = await firebaseService.update('tasks', id, updateData);
    res.json(updatedTask);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error updating task',
      error: error.message 
    });
  }
};

// Delete task
export const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    await firebaseService.delete('tasks', id);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ 
      message: 'Error deleting task',
      error: error.message 
    });
  }
};

// Get tasks by user
export const getTasksByUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const tasks = await firebaseService.getAll('tasks');
    
    const userTasks = tasks.filter(task => task.createdBy === userId);
    const sortedTasks = userTasks.sort((a, b) => 
      new Date(b.createdAt || b.created_at || 0) - new Date(a.createdAt || a.created_at || 0)
    );
    
    res.json(sortedTasks);
  } catch (error) {
    res.status(500).json({ 
      message: 'Error fetching user tasks',
      error: error.message 
    });
  }
};
