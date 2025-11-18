-- TiDB Vector Database Schema
-- This file contains the SQL schema for storing document embeddings

-- Create the document_embeddings table
CREATE TABLE IF NOT EXISTS document_embeddings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    content TEXT NOT NULL,
    embedding_vector VECTOR(1536) NOT NULL COMMENT 'OpenAI ada-002 embedding dimension is 1536',
    sentiment_score DECIMAL(10, 4) DEFAULT 0,
    row_data JSON COMMENT 'Original Excel row data in JSON format',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    -- Create a vector index for fast similarity search
    VECTOR INDEX idx_embedding_vector (embedding_vector)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create an index on created_at for faster sorting
CREATE INDEX idx_created_at ON document_embeddings(created_at DESC);

-- Create an index on sentiment_score
CREATE INDEX idx_sentiment_score ON document_embeddings(sentiment_score);

-- Example query: Semantic search using cosine distance
-- SELECT 
--     id,
--     content,
--     sentiment_score,
--     row_data,
--     vec_cosine_distance(embedding_vector, '[0.1, 0.2, ...]') AS similarity,
--     created_at
-- FROM document_embeddings
-- ORDER BY similarity ASC
-- LIMIT 10;

-- Example query: Get all documents with positive sentiment
-- SELECT * FROM document_embeddings 
-- WHERE sentiment_score > 0 
-- ORDER BY created_at DESC 
-- LIMIT 100;

-- Example query: Delete all embeddings (use with caution)
-- TRUNCATE TABLE document_embeddings;
