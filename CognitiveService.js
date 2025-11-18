"use strict";
const config = require('./config.json');
const MySQLService = require('./db/MySQLService.js');
const { AzureOpenAI } = require("openai");
const {
  PORT,
  NODE_ENV,
  OWNER,
  DOMAIN,
  zj,
  PW,
  DBuser,
  DBPW
} = require('./config');
const sentiment = require('sentiment');
const xlsx = require('xlsx');


class CognitiveService {

    constructor() {
       
        this.client = new AzureOpenAI({
            apiKey: process.env.AZURE_OPENAI_API_KEY,
            endpoint: process.env.AZURE_OPENAI_ENDPOINT,
            apiVersion: "2024-08-01-preview"
        });
        this.deploymentName = process.env.AZURE_DEPLOYMENT_NAME || 'text-embedding-ada-002';
        this.DB = new MySQLService();
    }

    async  embedText(text) {
        const maxRetries = 3;
        let retryCount = 0;
        
        while (retryCount < maxRetries) {
            try {
                const response = await this.client.embeddings.create({
                    model: this.deploymentName,
                    input: text,
                });
                
                return response.data[0].embedding;
            } catch (error) {
                if (error.status === 429) {
                    retryCount++;
                    if (retryCount < maxRetries) {
                        // Wait before retrying (exponential backoff)
                        const waitTime = Math.pow(2, retryCount) * 1000;
                        console.log(`Rate limit hit. Waiting ${waitTime}ms before retry ${retryCount}/${maxRetries}...`);
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                        continue;
                    }
                }
                throw error;
            }
        }
    }


    async  analyzeSentiment(text) {
            
        try {
         
            // Use a sentiment analysis library or service
            const sentimentAnalyzer = new sentiment();
            const result = sentimentAnalyzer.analyze(text);

            return result;
            
        } catch (error) {
            console.error('Error analyzing sentiment:', error);
            throw error;
        }
    }
    
    async clusterSimilarSentiments(json, limit = 5000) {
        // Step 1: Get a random seed vector
        let seedSql = `
            SELECT respondentid, response_vector
            FROM text_survey_responses
            WHERE eventid = ? AND pollid = ?
            ORDER BY RAND()
            LIMIT 1;
        `;
        let seedResult;
        try {
            seedResult = await this.DB.runquery(seedSql, [json.eventid, json.pollid]);
        } catch (error) {
            console.error('Error selecting seed vector:', error);
            throw error;
        }
    
        if (seedResult.length === 0) {
            return { success: false };
        }
    
        const seedVector = seedResult[0].response_vector;

        
    
        // Step 2: Find similar vectors
        let clusterSql = `
            SELECT 
                respondentid, response_vector, response_text,
                vec_cosine_distance(response_vector, ?) AS similarity
            FROM text_survey_responses
            WHERE eventid = ? AND pollid = ?
            ORDER BY similarity ASC
            LIMIT ${limit};
        `;

        console.log(seedVector,clusterSql);
        
        try {
            let results = await this.DB.runquery(clusterSql, [seedVector, json.eventid, json.pollid]);
            return {
                success: true,
                clusters: results
            };
        } catch (error) {
            console.error('Error clustering sentiments:', error);
            throw error;
        }
    }
    

    async searchSimilarResponses(json, limit = 5000) {
        // Step 1: Get the vector for the selected response
        let sql = `
            SELECT 
                response_vector, response_text
            FROM text_survey_responses
            WHERE eventid = ? AND pollid = ? AND respondentid = ?;
        `;
        
        let seedResult = await this.DB.runquery(sql, [json.eventid, json.pollid, json.respondentid]);
        const seedVector = seedResult[0].response_vector;
        const selectedResponseText = seedResult[0].response_text;
    
        // Step 2: Find similar vectors excluding the selected response
        let clusterSql = `
            SELECT 
                respondentid, response_vector, response_text,
                vec_cosine_distance(response_vector, ?) AS similarity
            FROM text_survey_responses
            WHERE eventid = ? AND pollid = ? AND respondentid != ?
            ORDER BY similarity ASC
            LIMIT ${limit};
        `;
        
        try {
            let results = await this.DB.runquery(clusterSql, [seedVector, json.eventid, json.pollid, json.respondentid]);
            
            return {
                success: true,
                clusters: results,
                selectedResponse: selectedResponseText
            };
        } catch (error) {
            console.error('Error clustering sentiments:', error);
            throw error;
        }
    }
    
    
  
        async analyzeResponses(json, limit = 5000) {
            
            let seedSql = `
                SELECT 
                    response_vector, response_text, sentiment_score
                FROM text_survey_responses
                WHERE eventid = ? AND pollid = ? AND respondentid = ?;
            `;
        
            console.log(json);
        
            let seedResult = await this.DB.runquery(seedSql, [json.eventid, json.pollid, json.respondentid]);
            let seedVector = seedResult[0].response_vector;
            const isPositive = seedResult[0].sentiment_score > 0;
        
            console.log(isPositive);
        
            let query;
        
            switch (json.criteria) {
                case 'similarity':
                    query = `
                        SELECT respondentid, response_vector, response_text, sentiment_score,
                               vec_cosine_distance(response_vector, ?) AS similarity
                        FROM text_survey_responses
                        WHERE eventid = ? AND pollid = ?
                        AND respondentid != ?
                        ORDER BY similarity ASC
                        LIMIT ${limit};
                    `;
                    break;
        
                case 'sentiment_similarity':
                    if (isPositive) {
                        query = `
                            SELECT respondentid, response_vector, response_text, sentiment_score,
                                   vec_cosine_distance(response_vector, ?) AS similarity
                            FROM text_survey_responses
                            WHERE eventid = ? AND pollid = ?
                            AND respondentid != ?
                            ORDER BY sentiment_score DESC, similarity ASC
                            LIMIT ${limit};
                        `;
                    } else {
                        query = `
                            SELECT respondentid, response_vector, response_text, sentiment_score,
                                   vec_cosine_distance(response_vector, ?) AS similarity
                            FROM text_survey_responses
                            WHERE eventid = ? AND pollid = ?
                            AND respondentid != ?
                            ORDER BY sentiment_score ASC, similarity ASC
                            LIMIT ${limit};
                        `;
                    }
                    break;
        
                case 'thematic_clustering':
                    query = `
                        SELECT respondentid, response_vector, response_text,sentiment_score,
                               vec_cosine_distance(response_vector, ?) AS similarity
                        FROM text_survey_responses
                        WHERE eventid = ? AND pollid = ?
                        ORDER BY similarity ASC
                        LIMIT ${limit};
                    `;
                    break;
        
                default:
                    throw new Error('Invalid analysis criteria provided');
            }
        
            try {
               
                let results;
                if(json.criteria == 'thematic_clustering'){
                    if(json.searchcluster){
                    const vector = await this.embedText(json.searchcluster);
                    seedVector = JSON.stringify(vector);
                    console.log(json.criteria,seedVector);
                    }
                    results = await this.DB.runquery(query, [seedVector, json.eventid, json.pollid]);
                }else{
                    results = await this.DB.runquery(query, [seedVector, json.eventid, json.pollid, json.respondentid]);
                }
        
                // Add sentiment color and text
                results = results.map(result => {
                    const sentiment = this.sentimentToColor(result.sentiment_score);
                    return {
                        ...result,
                        sentimentColor: sentiment.color,
                        sentimentText: sentiment.text
                    };
                });
        
                return {
                    success: true,
                    analysisType: json.criteria,
                    clusters: results,
                    selectedresponse: seedResult[0].response_text
                };
            } catch (error) {
                console.error('Error analyzing responses:', error);
                throw error;
            }
        }
    
    async analyzeOverallSentiment(json) {

        let sql = `
            SELECT 
                SUM(sentiment_score) / COUNT(1) AS overallSentiment,
                COUNT(1) AS totalResponses
            FROM text_survey_responses 
            WHERE eventid = ? AND pollid = ?;
        `;
    
        try {
            let results = await this.DB.runquery(sql, [json.eventid, json.pollid]);
    
            if (results.length === 0 || results[0].totalResponses === 0) {
                return { success: false };
            }
    
            const overallSentiment = results[0].overallSentiment;
            const sentimentPercentage = this.sentimentToPercentage(overallSentiment).toFixed(2);
            const sentimentColor = this.sentimentToColor(overallSentiment);
    
            return {
                success: true,
                overallSentiment: overallSentiment,
                sentimentPercentage: sentimentPercentage,
                sentimentColor: sentimentColor,
                dataset: await this.getRespondentScores(json, 5000)
            };
    
        } catch (error) {
            console.error('Error analyzing overall sentiment:', error);
            throw error;
        }
    }
    
    async getRespondentScores(json, limit = 5000) {

        console.log('limit',limit);
        let sql = `
            SELECT respondentid, sentiment_score
            FROM text_survey_responses 
            WHERE eventid = ? AND pollid = ?
            LIMIT ${limit};
        `;
    
        try {
            let results = await this.DB.runquery(sql, [json.eventid, json.pollid]);
    
            if (results.length === 0) {
                return { success: false };
            }
    
            return {
                success: true,
                respondentScores: results
            };
    
        } catch (error) {
            console.error('Error fetching respondent scores:', error);
            throw error;
        }
    }
    

     sentimentToPercentage(score) {
        const maxPossibleScore = 5;
        const minPossibleScore = -5;
        const normalizedScore = (score - minPossibleScore) / (maxPossibleScore - minPossibleScore);
        return normalizedScore * 100; // Percentage
    }

    sentimentToColor(score) {
        if (score > 1) {
            return {color: 'rgba(43, 182, 76, 1)', text: 'Good'};
        } else if (score >= -1 && score <= 1) {
            return {color: 'rgba(233, 194, 68, 1)', text: 'Average'} ;
        } else {
            return {color: 'rgba(233, 70, 68, 1)', text: 'Poor'} ;
        }
    }

    async processExcelFile(filePath, tableName = 'document_embeddings') {
        try {
            // Read the Excel file
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const data = xlsx.utils.sheet_to_json(worksheet);

            console.log(`Processing ${data.length} rows from Excel file...`);

            const results = [];
            
            // Process each row with delay to avoid rate limits
            for (let i = 0; i < data.length; i++) {
                const row = data[i];
                
                // Combine all columns into a single text for embedding
                const textContent = Object.values(row).join(' ');
                
                if (!textContent || textContent.trim().length === 0) {
                    console.log(`Skipping empty row ${i + 1}`);
                    continue;
                }

                console.log(`Processing row ${i + 1}/${data.length}: ${textContent.substring(0, 100)}...`);

                try {
                    // Generate embedding
                    const embedding = await this.embedText(textContent);
                    
                    // Analyze sentiment
                    const sentimentResult = await this.analyzeSentiment(textContent);

                    // Store in TiDB - storing embedding as JSON string
                    const insertSql = `
                        INSERT INTO ${tableName} 
                        (content, embedding_vector, sentiment_score, row_data, created_at)
                        VALUES (?, ?, ?, ?, NOW())
                    `;

                    await this.DB.runquery(insertSql, [
                        textContent,
                        JSON.stringify(embedding),
                        sentimentResult.score,
                        JSON.stringify(row)
                    ]);

                    results.push({
                        rowNumber: i + 1,
                        content: textContent.substring(0, 100),
                        sentimentScore: sentimentResult.score,
                        success: true
                    });
                    
                    // Add delay between requests to avoid rate limiting (500ms)
                    if (i < data.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    
                } catch (rowError) {
                    console.error(`Error processing row ${i + 1}:`, rowError.message);
                    results.push({
                        rowNumber: i + 1,
                        content: textContent.substring(0, 100),
                        error: rowError.message,
                        success: false
                    });
                    
                    // If it's a rate limit error, stop processing
                    if (rowError.response && rowError.response.status === 429) {
                        console.log('Rate limit exceeded. Stopping processing.');
                        break;
                    }
                }
            }

            return {
                success: true,
                totalRows: data.length,
                processedRows: results.filter(r => r.success).length,
                failedRows: results.filter(r => !r.success).length,
                results: results
            };

        } catch (error) {
            console.error('Error processing Excel file:', error);
            throw error;
        }
    }

    async semanticSearch(searchText, tableName = 'document_embeddings', limit = 10) {
        try {
            // Generate embedding for search query
            const queryEmbedding = await this.embedText(searchText);

            // Guard: ensure we received a valid embedding array
            if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
                throw new Error('Invalid embedding returned for query');
            }
            // Get all documents with embeddings
            const getAllSql = `
                SELECT 
                    id,
                    content,
                    embedding_vector,
                    sentiment_score,
                    row_data,
                    created_at
                FROM ${tableName}
                LIMIT 1000
            `;

            const allDocs = await this.DB.runquery(getAllSql);

            // Calculate cosine similarity in JavaScript
            const results = [];
            for (const doc of allDocs) {
                let docEmbedding;
                try {
                    // embedding_vector should be a JSON string of an array
                    if (typeof doc.embedding_vector === 'string') {
                        docEmbedding = JSON.parse(doc.embedding_vector);
                    } else {
                        docEmbedding = doc.embedding_vector;
                    }
                } catch (parseErr) {
                    console.error(`Skipping doc id=${doc.id} due to invalid embedding JSON:`, parseErr.message);
                    console.error('Embedding preview:', String(doc.embedding_vector).substring(0, 200));
                    continue;
                }

                // Validate embeddings shapes
                if (!Array.isArray(docEmbedding) || docEmbedding.length === 0) {
                    console.error(`Skipping doc id=${doc.id} due to empty or invalid embedding`);
                    continue;
                }

                const similarity = this.cosineSimilarity(queryEmbedding, docEmbedding);
                results.push({
                    ...doc,
                    similarity: similarity
                });
            }

            // Sort by similarity (highest first) and limit results
            results.sort((a, b) => b.similarity - a.similarity);
            const topResults = results.slice(0, limit);

            // Add sentiment color and text
            const enrichedResults = topResults.map(result => {
                const sentiment = this.sentimentToColor(result.sentiment_score);
                return {
                    id: result.id,
                    content: result.content,
                    sentiment_score: result.sentiment_score,
                    row_data: result.row_data,
                    created_at: result.created_at,
                    sentimentColor: sentiment.color,
                    sentimentText: sentiment.text,
                    similarity: result.similarity.toFixed(4)
                };
            });

            return {
                success: true,
                query: searchText,
                totalResults: enrichedResults.length,
                results: enrichedResults
            };

        } catch (error) {
            console.error('Error performing semantic search:', error);
            throw error;
        }
    }

    // Cosine similarity calculation
    cosineSimilarity(vecA, vecB) {
        let dotProduct = 0;
        let normA = 0;
        let normB = 0;
        
        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        
        return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
    }

    async getAllDocuments(tableName = 'document_embeddings', limit = 100) {
        try {
            const sql = `
                SELECT 
                    id,
                    content,
                    sentiment_score,
                    row_data,
                    created_at
                FROM ${tableName}
                ORDER BY created_at DESC
                LIMIT ?
            `;

            const results = await this.DB.runquery(sql, [limit]);

            // Add sentiment color and text
            const enrichedResults = results.map(result => {
                const sentiment = this.sentimentToColor(result.sentiment_score);
                return {
                    ...result,
                    sentimentColor: sentiment.color,
                    sentimentText: sentiment.text
                };
            });

            return {
                success: true,
                totalResults: enrichedResults.length,
                results: enrichedResults
            };

        } catch (error) {
            console.error('Error fetching documents:', error);
            throw error;
        }
    }

    
    

}
module.exports = CognitiveService;