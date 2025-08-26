import { db } from '../config/firebase.js';
import { collection, addDoc, getDocs, query, where, updateDoc, doc, deleteDoc, orderBy } from 'firebase/firestore';

class ReminderService {
  constructor() {
    this.collection = 'reminders';
  }

  // Create a new reminder
  async createReminder(reminderData) {
    try {
      const docRef = await addDoc(collection(db, this.collection), {
        ...reminderData,
        createdAt: new Date(),
        updatedAt: new Date(),
        isActive: true
      });
      return { id: docRef.id, ...reminderData };
    } catch (error) {
      console.error('Error creating reminder:', error);
      throw error;
    }
  }

  // Get all reminders
  async getAllReminders() {
    try {
      const querySnapshot = await getDocs(collection(db, this.collection));
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting reminders:', error);
      throw error;
    }
  }

  // Get reminders by company
  async getRemindersByCompany(company) {
    try {
      const q = query(
        collection(db, this.collection),
        where('company', '==', company),
        where('isActive', '==', true),
        orderBy('reminderDate', 'asc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting reminders by company:', error);
      throw error;
    }
  }

  // Get upcoming reminders (within next 7 days)
  async getUpcomingReminders(company) {
    try {
      const today = new Date();
      const nextWeek = new Date();
      nextWeek.setDate(today.getDate() + 7);

      const q = query(
        collection(db, this.collection),
        where('company', '==', company),
        where('isActive', '==', true),
        where('reminderDate', '>=', today),
        where('reminderDate', '<=', nextWeek),
        orderBy('reminderDate', 'asc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting upcoming reminders:', error);
      throw error;
    }
  }

  // Update reminder
  async updateReminder(id, updateData) {
    try {
      const docRef = doc(db, this.collection, id);
      await updateDoc(docRef, {
        ...updateData,
        updatedAt: new Date()
      });
      return { id, ...updateData };
    } catch (error) {
      console.error('Error updating reminder:', error);
      throw error;
    }
  }

  // Delete reminder
  async deleteReminder(id) {
    try {
      await deleteDoc(doc(db, this.collection, id));
      return { id };
    } catch (error) {
      console.error('Error deleting reminder:', error);
      throw error;
    }
  }

  // Mark reminder as sent
  async markReminderSent(id) {
    try {
      const docRef = doc(db, this.collection, id);
      await updateDoc(docRef, {
        isSent: true,
        sentAt: new Date(),
        updatedAt: new Date()
      });
      return { id };
    } catch (error) {
      console.error('Error marking reminder as sent:', error);
      throw error;
    }
  }

  // Get overdue reminders
  async getOverdueReminders(company) {
    try {
      const today = new Date();
      const q = query(
        collection(db, this.collection),
        where('company', '==', company),
        where('isActive', '==', true),
        where('reminderDate', '<', today),
        orderBy('reminderDate', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting overdue reminders:', error);
      throw error;
    }
  }
}

export const reminderService = new ReminderService();
