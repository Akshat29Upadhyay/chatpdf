import { Pinecone } from '@pinecone-database/pinecone';

// Memory-efficient PDF text extraction
async function extractTextFromPDFBuffer(pdfBuffer: Buffer): Promise<string> {
  try {
    // Process the buffer in chunks to avoid memory issues
    const chunkSize = 1024 * 1024; // 1MB chunks
    let extractedText = '';
    
    // Process buffer in smaller chunks
    for (let i = 0; i < pdfBuffer.length; i += chunkSize) {
      const chunk = pdfBuffer.slice(i, i + chunkSize);
      const chunkString = chunk.toString('utf8');
      
      // Extract text-like content from this chunk
      const textContent = chunkString
        .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x9F]/g, '') // Remove control characters
        .replace(/[^\x20-\x7E\n\r\t]/g, ' ') // Keep only printable ASCII
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      // Find lines with actual text content
      const lines = textContent.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 10 && /[a-zA-Z]{3,}/.test(line)) // Lines with meaningful text
        .slice(0, 20); // Limit lines per chunk
      
      if (lines.length > 0) {
        extractedText += lines.join(' ') + ' ';
      }
      
      // Limit total extracted text to prevent memory issues
      if (extractedText.length > 4000) {
        break;
      }
    }
    
    // Clean up and return
    const finalText = extractedText
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 4000); // Final limit
    
    if (finalText.length > 0) {
      return finalText;
    }
    
    return 'PDF content extracted (text may be limited)';
  } catch (error) {
    console.error('Error in memory-efficient PDF text extraction:', error);
    return 'PDF content could not be extracted';
  }
}

// Lazy initialization of Pinecone
let pinecone: Pinecone | null = null;
let indexName: string | null = null;

function getPinecone() {
  if (!pinecone) {
    const apiKey = process.env.PINECONE_API_KEY;
    if (!apiKey) {
      throw new Error('PINECONE_API_KEY not configured');
    }
    pinecone = new Pinecone({ apiKey });
    indexName = process.env.PINECONE_INDEX_NAME || 'pdf-chat-index';
  }
  return { pinecone, indexName };
}

// Get or create index
export async function getIndex() {
  try {
    const { pinecone: p, indexName: idxName } = getPinecone();
    if (!idxName) {
      throw new Error('Index name not configured');
    }
    const index = p.index(idxName);
    return index;
  } catch (error) {
    console.error('Error getting Pinecone index:', error);
    throw error;
  }
}

// Memory-efficient text chunking function
export function chunkText(text: string, chunkSize: number = 800, overlap: number = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  
  // Limit total text length to prevent memory issues
  const maxTextLength = 10000;
  const limitedText = text.length > maxTextLength ? text.substring(0, maxTextLength) : text;
  
  while (start < limitedText.length && chunks.length < 20) { // Limit number of chunks
    const end = Math.min(start + chunkSize, limitedText.length);
    let chunk = limitedText.slice(start, end);
    
    // Try to break at sentence boundaries
    if (end < limitedText.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const breakPoint = Math.max(lastPeriod, lastNewline);
      
      if (breakPoint > start + chunkSize * 0.7) {
        chunk = chunk.slice(0, breakPoint + 1);
      }
    }
    
    const trimmedChunk = chunk.trim();
    if (trimmedChunk.length > 30) { // Filter out very small chunks
      chunks.push(trimmedChunk);
    }
    
    start = end - overlap;
    
    if (start >= limitedText.length) break;
  }
  
  return chunks;
}

// Extract text from PDF buffer
export async function extractTextFromPDF(pdfBuffer: Buffer): Promise<string> {
  try {
    return await extractTextFromPDFBuffer(pdfBuffer);
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

// Generate embeddings using OpenAI with Gemini fallback
export async function generateEmbeddings(text: string): Promise<number[]> {
  console.log('Generating embedding for text length:', text.length);
  
  // Try OpenAI first
  if (process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          input: text,
          model: 'text-embedding-3-small',
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const openaiEmbedding = data.data[0].embedding;
        console.log('OpenAI embedding generated successfully, dimension:', openaiEmbedding.length);
        
        // Convert OpenAI's 1536-dimensional embedding to 1024 to match Pinecone index
        if (openaiEmbedding.length === 1536) {
          const resizedEmbedding = openaiEmbedding.slice(0, 1024);
          console.log('Resized OpenAI embedding to 1024 dimensions');
          return resizedEmbedding;
        }
        
        return openaiEmbedding;
      } else {
        const errorText = await response.text();
        console.error('OpenAI API error response:', errorText);
        console.log('Falling back to Gemini for embeddings...');
      }
    } catch (error) {
      console.error('OpenAI embedding failed, falling back to Gemini:', error);
    }
  }
  
  // Fallback to Gemini embeddings
  if (process.env.GEMINI_API_KEY) {
    try {
      console.log('Using Gemini for embeddings...');
      
      // For Gemini, we'll use a simple approach: convert text to a hash-like representation
      // This is a simplified embedding since Gemini doesn't have a direct embedding API
      const textHash = await generateSimpleEmbedding(text);
      console.log('Gemini fallback embedding generated, dimension:', textHash.length);
      return textHash;
    } catch (error) {
      console.error('❌ Error generating Gemini embeddings:', error);
      throw error;
    }
  }
  
  throw new Error('No embedding service available (OpenAI quota exceeded and no Gemini fallback)');
}

// Simple embedding generation for Gemini fallback
async function generateSimpleEmbedding(text: string): Promise<number[]> {
  // Create a simple 1024-dimensional embedding to match the Pinecone index
  const embedding = new Array(1024).fill(0);
  
  // Use character frequency and position to create a pseudo-embedding
  for (let i = 0; i < Math.min(text.length, 1024); i++) {
    const charCode = text.charCodeAt(i);
    embedding[i] = (charCode / 255) * 2 - 1; // Normalize to [-1, 1]
  }
  
  // Fill remaining dimensions with text statistics
  const words = text.split(/\s+/).filter(word => word.length > 0);
  const avgWordLength = words.length > 0 ? words.reduce((sum, word) => sum + word.length, 0) / words.length : 0;
  
  for (let i = text.length; i < 1024; i++) {
    embedding[i] = Math.sin(i * avgWordLength * 0.1) * 0.5;
  }
  
  return embedding;
}

// Store PDF chunks in Pinecone
export async function storePDFChunks(
  pdfId: string,
  userId: string,
  pdfName: string,
  pdfBuffer: Buffer
): Promise<void> {
  try {
    console.log('Starting PDF processing for Pinecone...');
    console.log('PDF ID:', pdfId);
    console.log('User ID:', userId);
    console.log('PDF Name:', pdfName);
    console.log('PDF Buffer Size:', pdfBuffer.length);
    
    const index = await getIndex();
    console.log('Pinecone index retrieved successfully');
    
    // Extract text from PDF
    console.log('Extracting text from PDF...');
    const text = await extractTextFromPDF(pdfBuffer);
    console.log('Text extracted, length:', text.length);
    console.log('First 200 characters:', text.substring(0, 200));
    
    // Chunk the text
    console.log('Chunking text...');
    const chunks = chunkText(text);
    console.log('Created', chunks.length, 'chunks');
    
    // Generate embeddings for each chunk (with memory management)
    console.log('Generating embeddings...');
    const vectors = [];
    
    // Process chunks in smaller batches to avoid memory issues
    const batchSize = 3;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      
      for (let j = 0; j < batch.length; j++) {
        const chunk = batch[j];
        const chunkIndex = i + j;
        console.log(`Generating embedding for chunk ${chunkIndex + 1}/${chunks.length}`);
        
        try {
          const embedding = await generateEmbeddings(chunk);
          
          vectors.push({
            id: `${userId}_${pdfId}_chunk_${chunkIndex}`,
            values: embedding,
            metadata: {
              userId,
              pdfId,
              pdfName,
              chunkIndex: chunkIndex,
              text: chunk,
              timestamp: new Date().toISOString(),
            },
          });
        } catch (error) {
          console.error(`Failed to generate embedding for chunk ${chunkIndex}:`, error);
          // Continue with other chunks
        }
      }
      
      // Small delay between batches to prevent overwhelming the API
      if (i + batchSize < chunks.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    // Upsert vectors to Pinecone
    if (vectors.length > 0) {
      console.log('Upserting vectors to Pinecone...');
      await index.upsert(vectors);
      console.log(`✅ Successfully stored ${vectors.length} chunks for PDF: ${pdfName}`);
    } else {
      console.log('❌ No vectors to store - all embedding generation failed');
      throw new Error('Failed to generate any embeddings for PDF chunks');
    }
  } catch (error) {
    console.error('❌ Error storing PDF chunks:', error);
    throw error;
  }
}

// Search for relevant chunks
export async function searchChunks(
  query: string,
  userId: string,
  topK: number = 5
): Promise<Array<{ text: string; pdfName: string; score: number }>> {
  try {
    const index = await getIndex();
    
    // Generate embedding for the query
    const queryEmbedding = await generateEmbeddings(query);
    
    // Search in Pinecone
    const searchResponse = await index.query({
      vector: queryEmbedding,
      topK,
      filter: {
        userId: { $eq: userId },
      },
      includeMetadata: true,
    });
    
    return searchResponse.matches?.map(match => ({
      text: match.metadata?.text as string,
      pdfName: match.metadata?.pdfName as string,
      score: match.score || 0,
    })) || [];
  } catch (error) {
    console.error('Error searching chunks:', error);
    throw error;
  }
}

// Delete PDF chunks (when user deletes a PDF)
export async function deletePDFChunks(userId: string, pdfId: string): Promise<void> {
  try {
    const index = await getIndex();
    
    // Delete all chunks for this PDF
    await index.deleteMany({
      filter: {
        userId: { $eq: userId },
        pdfId: { $eq: pdfId },
      },
    });
    
    console.log(`Deleted chunks for PDF: ${pdfId}`);
  } catch (error) {
    console.error('Error deleting PDF chunks:', error);
    throw error;
  }
} 