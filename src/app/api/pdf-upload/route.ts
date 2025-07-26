import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

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

    // For now, just validate and accept the file
    // In a real app, you'd save it to storage (S3, etc.) and extract text
    const fileInfo = {
      id: Date.now().toString(),
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      userId: userId
    };

    console.log('PDF uploaded:', fileInfo);

    return NextResponse.json({ 
      success: true, 
      file: fileInfo,
      message: 'PDF uploaded successfully'
    });

  } catch (error) {
    console.error('PDF upload error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 