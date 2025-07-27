const { Pinecone } = require('@pinecone-database/pinecone');
require('dotenv').config({ path: '.env.local' });

async function setupPinecone() {
  try {
    const pinecone = new Pinecone({
      apiKey: process.env.PINECONE_API_KEY,
    });

    const indexName = process.env.PINECONE_INDEX_NAME || 'pdf-chat-index';

    console.log('Setting up Pinecone index...');
    console.log('Index name:', indexName);

    // Check if index exists
    const indexes = await pinecone.listIndexes();
    const indexExists = indexes.some(index => index.name === indexName);

    if (indexExists) {
      console.log('✅ Index already exists:', indexName);
      return;
    }

    // Create index
    await pinecone.createIndex({
      name: indexName,
      dimension: 1536, // OpenAI text-embedding-3-small dimension
      metric: 'cosine',
      spec: {
        serverless: {
          cloud: 'aws',
          region: 'us-east-1'
        }
      }
    });

    console.log('✅ Index created successfully:', indexName);
    console.log('Waiting for index to be ready...');

    // Wait for index to be ready
    let ready = false;
    while (!ready) {
      const index = pinecone.index(indexName);
      try {
        await index.describeIndexStats();
        ready = true;
      } catch (error) {
        console.log('Index not ready yet, waiting...');
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    console.log('✅ Index is ready to use!');

  } catch (error) {
    console.error('❌ Error setting up Pinecone:', error);
    process.exit(1);
  }
}

setupPinecone(); 