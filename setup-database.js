require('dotenv').config();
const MySQLService = require('./db/MySQLService');

async function setupDatabase() {
    const db = new MySQLService();
    
    try {
        console.log('Testing database connection...');
        
        // Test connection
        const testQuery = 'SELECT 1 as test';
        const result = await db.runquery(testQuery);
        console.log('✅ Database connection successful!');
        
        // Check if table exists
        console.log('\nChecking if document_embeddings table exists...');
        const checkTable = `
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_schema = ? 
            AND table_name = 'document_embeddings'
        `;
        const tableCheck = await db.runquery(checkTable, [process.env.DB_NAME]);
        
        if (tableCheck[0].count === 0) {
            console.log('❌ Table does not exist. Creating table...');
            
            // Create table
            const createTableSQL = `
                CREATE TABLE document_embeddings (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    content TEXT NOT NULL,
                    embedding_vector JSON NOT NULL COMMENT 'Stored as JSON, will be converted for vector operations',
                    sentiment_score DECIMAL(10, 4) DEFAULT 0,
                    row_data JSON COMMENT 'Original Excel row data in JSON format',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
            `;
            
            await db.runquery(createTableSQL);
            console.log('✅ Table created successfully!');
            
            // Create indexes
            console.log('Creating indexes...');
            await db.runquery('CREATE INDEX idx_created_at ON document_embeddings(created_at DESC)');
            await db.runquery('CREATE INDEX idx_sentiment_score ON document_embeddings(sentiment_score)');
            console.log('✅ Indexes created successfully!');
            
        } else {
            console.log('✅ Table already exists!');
            
            // Show table structure
            const descTable = 'DESCRIBE document_embeddings';
            const structure = await db.runquery(descTable);
            console.log('\nTable structure:');
            console.table(structure);
        }
        
        // Count existing records
        const countRecords = 'SELECT COUNT(*) as total FROM document_embeddings';
        const count = await db.runquery(countRecords);
        console.log(`\n📊 Total records in database: ${count[0].total}`);
        
        console.log('\n✅ Database setup complete!');
        
    } catch (error) {
        console.error('❌ Error setting up database:', error);
        console.error('Error details:', error.message);
        console.error('Error stack:', error.stack);
    } finally {
        await db.close();
    }
}

setupDatabase();
