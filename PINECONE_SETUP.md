# Pinecone Integration Setup Guide

This guide will help you set up Pinecone vector database integration for enhanced PDF chat functionality.

## 🚀 What Pinecone Adds

- **Vector Search**: Find similar content across multiple PDFs
- **Conversation Memory**: Remember past chats and context
- **Multi-PDF Support**: Chat across multiple uploaded documents
- **Semantic Search**: Find relevant information even with different wording

## 📋 Prerequisites

1. **Pinecone Account**: Sign up at [pinecone.io](https://pinecone.io)
2. **OpenAI API Key**: For generating embeddings (text-embedding-3-small)
3. **Existing Setup**: Your current PDF chat app should be working

## 🔧 Setup Steps

### 1. Get Pinecone API Key

1. Go to [Pinecone Console](https://app.pinecone.io/)
2. Create a new project or use existing one
3. Copy your API key from the API Keys section

### 2. Add Environment Variables

Add these to your `.env.local` file:

```bash
# Existing variables
OPENAI_API_KEY=your_openai_api_key
GEMINI_API_KEY=your_gemini_api_key
UPLOADCARE_PUBLIC_KEY=your_uploadcare_key

# New Pinecone variables
PINECONE_API_KEY=your_pinecone_api_key
PINECONE_INDEX_NAME=pdf-chat-index
```

### 3. Create Pinecone Index

Run the setup script:

```bash
node scripts/setup-pinecone.js
```

This will:
- Create a Pinecone index named `pdf-chat-index`
- Configure it for 1536-dimensional vectors (OpenAI embeddings)
- Use cosine similarity metric
- Set up serverless infrastructure

### 4. Deploy to Vercel

Add the environment variables to your Vercel project:

1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add:
   - `PINECONE_API_KEY`
   - `PINECONE_INDEX_NAME`

## 🔄 How It Works

### PDF Upload Flow
1. User uploads PDF → Uploadcare storage
2. PDF text extraction → Chunking (1000 chars with 200 overlap)
3. Generate embeddings → Store in Pinecone
4. Return success to user

### Chat Flow
1. User asks question → Generate query embedding
2. Search Pinecone → Find relevant chunks
3. Include context in AI prompt → Generate response
4. Return enhanced answer

## 📊 Database Schema

Each vector in Pinecone contains:

```json
{
  "id": "user_123_pdf_456_chunk_789",
  "values": [0.1, 0.2, ...], // 1536-dimensional embedding
  "metadata": {
    "userId": "user_123",
    "pdfId": "pdf_456",
    "pdfName": "resume.pdf",
    "chunkIndex": 789,
    "text": "actual chunk content...",
    "timestamp": "2025-07-26T..."
  }
}
```

## 🧪 Testing

1. **Upload a PDF**: Should see "PDF chunks stored in Pinecone" in logs
2. **Ask questions**: AI should reference content from your PDFs
3. **Multi-PDF**: Upload multiple PDFs and ask cross-document questions

## 🔍 Troubleshooting

### Common Issues

1. **"Pinecone API key not set"**
   - Check `.env.local` and Vercel environment variables

2. **"Index not found"**
   - Run `node scripts/setup-pinecone.js`

3. **"Embedding generation failed"**
   - Verify OpenAI API key and quota

4. **"No relevant chunks found"**
   - Check if PDFs were properly processed
   - Verify Pinecone index has data

### Logs to Check

- PDF upload: "PDF chunks stored in Pinecone successfully"
- Chat: "Found relevant context from Pinecone"
- Errors: "Pinecone search failed" or "Pinecone storage failed"

## 🚀 Next Steps

- **Database Integration**: Store PDF metadata in a real database
- **Conversation History**: Track chat sessions with document references
- **Advanced Search**: Add filters for date, document type, etc.
- **Analytics**: Track search patterns and popular queries

## 💰 Costs

- **Pinecone**: Free tier includes 1 index, 100K vectors
- **OpenAI**: ~$0.0001 per 1K tokens for embeddings
- **Uploadcare**: Free tier includes 5GB storage

## 📚 Resources

- [Pinecone Documentation](https://docs.pinecone.io/)
- [OpenAI Embeddings API](https://platform.openai.com/docs/guides/embeddings)
- [Vector Search Best Practices](https://www.pinecone.io/learn/vector-search-best-practices/) 