# Vector Database with Excel Upload & Semantic Search

A complete solution for uploading Excel files, generating embeddings using OpenAI, storing them in TiDB vector database, and performing semantic searches.

## Features

✅ **Excel File Upload** - Upload .xlsx or .xls files via drag-and-drop or file picker
✅ **Automatic Embedding Generation** - Uses OpenAI's text-embedding-ada-002 model
✅ **Sentiment Analysis** - Analyzes sentiment of each row
✅ **TiDB Vector Storage** - Stores embeddings in TiDB with vector indexing
✅ **Semantic Search** - Find similar documents using cosine similarity
✅ **Beautiful UI** - Modern, responsive frontend with real-time results

## Prerequisites

- Node.js (v14 or higher)
- TiDB database with vector support
- OpenAI API key

## Installation

1. Install dependencies:
```bash
npm install
```

2. Set up your environment variables:
Create a `.env` file or set the following:
```bash
CGPT_APIKEY=your_openai_api_key_here
```

3. Configure database connection:
Update the database configuration in `config.json` or your configuration file.

4. Create the database table:
Run the SQL schema from `schema.sql` in your TiDB database:
```bash
mysql -h your_tidb_host -u your_username -p your_database < schema.sql
```

## Database Schema

The application uses a `document_embeddings` table with the following structure:
- `id` - Primary key
- `content` - Text content from Excel
- `embedding_vector` - Vector(1536) for embeddings
- `sentiment_score` - Sentiment analysis score
- `row_data` - Original Excel row data (JSON)
- `created_at` - Timestamp

## Usage

1. Start the server:
```bash
npm start
```

For development with auto-reload:
```bash
npm run dev
```

2. Open your browser:
```
http://localhost:3000
```

3. Upload an Excel file:
   - Click "Choose Excel File" or drag & drop
   - Click "Upload & Process"
   - Wait for processing to complete

4. Perform semantic search:
   - Enter your search query
   - Select number of results
   - Click "Search"
   - View results with similarity scores and sentiment

## API Endpoints

### POST /api/upload
Upload and process an Excel file.
- **Body**: multipart/form-data with `excelFile`
- **Response**: Processing results with row counts

### POST /api/search
Perform semantic search.
- **Body**: `{ "query": "search text", "limit": 10 }`
- **Response**: Array of similar documents with scores

### GET /api/documents
Get all documents.
- **Query**: `?limit=100`
- **Response**: Array of all documents

### GET /api/health
Health check endpoint.

## How It Works

1. **Upload**: Excel file is uploaded to the server
2. **Process**: Each row is read and combined into text
3. **Embed**: OpenAI generates a 1536-dimensional vector embedding
4. **Analyze**: Sentiment analysis is performed on the text
5. **Store**: Embeddings are stored in TiDB with vector indexing
6. **Search**: User queries are converted to embeddings and compared using cosine similarity
7. **Display**: Results are ranked by similarity and displayed with sentiment

## File Structure

```
vector/
├── server.js                 # Express server with API endpoints
├── CognitiveService.js       # Core service for embeddings & search
├── public/
│   └── index.html           # Frontend interface
├── package.json             # Dependencies
├── schema.sql               # Database schema
├── uploads/                 # Uploaded files (created automatically)
└── README.md               # This file
```

## Configuration

Make sure your `CognitiveService.js` has access to:
- `MySQLService` for database operations
- OpenAI API configuration
- Proper config.json or environment variables

## Troubleshooting

**Error: "Only Excel files are allowed"**
- Make sure you're uploading .xlsx or .xls files

**Error: "No file uploaded"**
- Select a file before clicking upload

**Database connection errors**
- Verify TiDB connection settings
- Ensure vector extension is enabled

**OpenAI API errors**
- Check your API key is set correctly
- Verify you have sufficient API credits

## Performance Tips

- For large Excel files, processing may take time
- Vector indexing improves search performance significantly
- Adjust the search limit based on your needs
- Consider batch processing for very large datasets

## License

ISC

## Support

For issues or questions, please check the logs in the browser console and server terminal.
