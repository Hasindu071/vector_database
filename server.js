require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const CognitiveService = require('./CognitiveService');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = './uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        if (ext !== '.xlsx' && ext !== '.xls') {
            return cb(new Error('Only Excel files are allowed'));
        }
        cb(null, true);
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Initialize Cognitive Service
const cognitiveService = new CognitiveService();

// Routes

// Home page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload Excel file endpoint
app.post('/api/upload', upload.single('excelFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No file uploaded'
            });
        }

        console.log('Processing uploaded file:', req.file.filename);
        console.log('File path:', req.file.path);

        // Process the Excel file
        const result = await cognitiveService.processExcelFile(req.file.path);

        // Optionally delete the uploaded file after processing
        // fs.unlinkSync(req.file.path);

        res.json(result);

    } catch (error) {
        console.error('Error processing upload:', error);
        console.error('Error stack:', error.stack);
        
        let errorMessage = 'Error processing file';
        if (error.response && error.response.status === 429) {
            errorMessage = 'OpenAI rate limit exceeded. Your Excel file has too many rows to process at once. Try a smaller file or wait and try again.';
        } else if (error.response && error.response.status === 401) {
            errorMessage = 'OpenAI API key is invalid or missing.';
        }
        
        res.status(500).json({
            success: false,
            message: errorMessage,
            error: error.message,
            details: error.stack
        });
    }
});

// Semantic search endpoint
app.post('/api/search', async (req, res) => {
    try {
        const { query, limit } = req.body;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const searchLimit = parseInt(limit) || 10;
        const result = await cognitiveService.semanticSearch(query, 'document_embeddings', searchLimit);

        res.json(result);

    } catch (error) {
        console.error('Error performing search:', error);
        
        let errorMessage = 'Error performing search';
        if (error.response && error.response.status === 429) {
            errorMessage = 'OpenAI rate limit exceeded. Please wait a moment and try again.';
        } else if (error.response && error.response.status === 401) {
            errorMessage = 'OpenAI API key is invalid or missing.';
        }
        
        res.status(500).json({
            success: false,
            message: errorMessage,
            error: error.message
        });
    }
});

// Get all documents endpoint
app.get('/api/documents', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 100;
        const result = await cognitiveService.getAllDocuments('document_embeddings', limit);

        res.json(result);

    } catch (error) {
        console.error('Error fetching documents:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching documents',
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: err.message
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = app;
