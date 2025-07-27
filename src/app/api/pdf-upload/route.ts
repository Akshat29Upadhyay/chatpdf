import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { storePDFChunks } from '@/lib/pinecone';

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Only PDF files are allowed' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      return NextResponse.json({ error: 'File size too large' }, { status: 400 });
    }

    // Read file buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Uploadcare
    const uploadcareKey = process.env.UPLOADCARE_PUBLIC_KEY;
    if (!uploadcareKey) {
      return NextResponse.json({ error: 'Uploadcare public key not set' }, { status: 500 });
    }

    const uploadForm = new FormData();
    uploadForm.append('UPLOADCARE_STORE', '1');
    uploadForm.append('UPLOADCARE_PUB_KEY', uploadcareKey);
    uploadForm.append('file', new Blob([buffer]), file.name);

    const uploadRes = await fetch('https://upload.uploadcare.com/base/', {
      method: 'POST',
      body: uploadForm,
    });
    if (!uploadRes.ok) {
      const error = await uploadRes.text();
      return NextResponse.json({ error: 'Uploadcare upload failed: ' + error }, { status: 500 });
    }
    const uploadData = await uploadRes.json();
    const fileId = uploadData.file;
    const fileUrl = `https://ucarecdn.com/${fileId}/${encodeURIComponent(file.name)}`;

    const fileInfo = {
      id: fileId,
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      userId: userId,
      fileUrl: fileUrl
    };

    console.log('PDF uploaded to Uploadcare:', fileInfo);

    // Store PDF chunks in Pinecone (if Pinecone is configured)
    console.log('Checking Pinecone configuration...');
    console.log('PINECONE_API_KEY exists:', !!process.env.PINECONE_API_KEY);
    console.log('PINECONE_INDEX_NAME:', process.env.PINECONE_INDEX_NAME);
    
    if (process.env.PINECONE_API_KEY) {
      try {
        console.log('Starting Pinecone storage...');
        await storePDFChunks(fileId, userId, file.name, buffer);
        console.log('PDF chunks stored in Pinecone successfully');
      } catch (pineconeError) {
        console.error('Pinecone storage failed:', pineconeError);
        // Don't fail the upload if Pinecone fails
      }
    } else {
      console.log('Pinecone API key not found, skipping Pinecone storage');
    }

    return NextResponse.json({ 
      success: true, 
      file: fileInfo,
      fileUrl: fileUrl, // Return fileUrl for future chat
      message: 'PDF uploaded successfully'
    });

  } catch (error) {
    console.error('PDF upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 