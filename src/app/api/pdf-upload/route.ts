import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

// In-memory PDF store (global for serverless)
declare global {
  // eslint-disable-next-line no-var
  var pdfStore: Record<string, string>;
}
if (!globalThis.pdfStore) {
  globalThis.pdfStore = {};
}

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

    // Read file buffer and store as base64 in memory
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    // Generate unique file ID
    const fileId = `${userId}_${Date.now()}`;
    globalThis.pdfStore[fileId] = base64;

    const fileInfo = {
      id: fileId,
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      userId: userId
    };

    console.log('PDF uploaded (in-memory):', fileInfo);

    return NextResponse.json({ 
      success: true, 
      file: fileInfo,
      fileId: fileId, // Return fileId for future chat
      message: 'PDF uploaded successfully'
    });

  } catch (error) {
    console.error('PDF upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 