import { adminFirestore as db } from '../config/firebase-admin.js';

const migrateBills = async () => {
  try {
    console.log('Starting bill migration...');
    
    // Get all bills from the generic 'bills' collection
    const billsSnapshot = await db.collection('bills').get();
    console.log(`Found ${billsSnapshot.size} bills to migrate`);
    
    let migratedCount = 0;
    let errorCount = 0;
    
    for (const doc of billsSnapshot.docs) {
      const billData = doc.data();
      const billId = doc.id;
      
      try {
        // Determine the target collection based on bill type
        let targetCollection = 'cashbills'; // default
        
        if (billData.billType === 'credit') {
          targetCollection = 'creditbills';
        } else if (billData.billType === 'creditnote') {
          targetCollection = 'creditnotes';
        } else if (billData.billType === 'debitnote') {
          targetCollection = 'debitnotes';
        }
        
        // Check if bill already exists in target collection
        const existingDoc = await db.collection(targetCollection).doc(billId).get();
        if (existingDoc.exists) {
          console.log(`Bill ${billId} already exists in ${targetCollection}, skipping...`);
          continue;
        }
        
        // Copy bill to target collection
        await db.collection(targetCollection).doc(billId).set(billData);
        console.log(`Migrated bill ${billId} to ${targetCollection}`);
        migratedCount++;
        
      } catch (error) {
        console.error(`Error migrating bill ${billId}:`, error.message);
        errorCount++;
      }
    }
    
    console.log(`Migration completed! Migrated: ${migratedCount}, Errors: ${errorCount}`);
    
  } catch (error) {
    console.error('Migration failed:', error);
  }
};

// Run migration if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  migrateBills();
}

export { migrateBills };
