require('dotenv').config();
const MySQLService = require('./db/MySQLService');

async function checkData() {
    const db = new MySQLService();
    
    try {
        console.log('Checking database for existing data...\n');
        
        // Count records
        const countResult = await db.runquery('SELECT COUNT(*) as total FROM document_embeddings');
        console.log(`Total records: ${countResult[0].total}`);
        
        if (countResult[0].total > 0) {
            // Show sample records
            const sampleRecords = await db.runquery('SELECT id, LEFT(content, 100) as content, sentiment_score, created_at FROM document_embeddings LIMIT 5');
            console.log('\nSample records:');
            console.table(sampleRecords);
        } else {
            console.log('\nNo data found in database.');
        }
        
    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await db.close();
    }
}

checkData();
