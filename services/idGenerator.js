import { adminFirestore as db } from '../config/firebase-admin.js';

async function getNextSequence(name) {
  try {
    const counterRef = db.collection('counters').doc(name);
    const newSeq = await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let seq = counterDoc.exists ? counterDoc.data().seq + 1 : 1;
      transaction.set(counterRef, { seq }, { merge: true });
      return seq;
    });
    return newSeq;
  } catch (error) {
    console.error('Error in getNextSequence:', { 
      name, 
      error: error.message, 
      stack: error.stack 
    });
    throw new Error('Failed to generate sequence');
  }
}

export const generateCustomerId = async () => {
  try {
    const counterName = 'wyenfos_customer';
    let counter = await getNextSequence(counterName);
    let customerId = `CUST${String(counter).padStart(6, '0')}`;
    
    const snapshot = await db.collection('customers')
                          .where('customerId', '==', customerId)
                          .limit(1)
                          .get();
    
    if (!snapshot.empty) {
      console.warn('Duplicate customerId found, regenerating...');
      counter = await getNextSequence(counterName);
      customerId = `CUST${String(counter).padStart(6, '0')}`;
    }
    
    return customerId;
  } catch (error) {
    console.error('ID Generation Error:', {
      error: error.message,
      stack: error.stack
    });
    throw new Error('Failed to generate customer ID');
  }
};

export const initializeCounter = async (company) => {
  try {
    const counterName = company.replace(/\s+/g, '_').toLowerCase();
    const counterRef = db.collection('counters').doc(counterName);
    
    const lastCustomer = await db.collection('customers')
                               .where('company', 'array-contains', company)
                               .orderBy('customerId', 'desc')
                               .limit(1)
                               .get();

    const lastNumber = lastCustomer.empty ? 0 : 
      parseInt(lastCustomer.docs[0].data().customerId.replace('CUST', '')) || 0;

    await counterRef.set({ seq: lastNumber }, { merge: true });
    return lastNumber;
  } catch (error) {
    console.error(`Counter init failed for ${company}:`, error);
    throw error;
  }
};