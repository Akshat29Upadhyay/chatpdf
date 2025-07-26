import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { writeFile } from 'fs/promises';
import path from 'path';

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

    // Generate unique file ID and save to /tmp
    const fileId = `${userId}_${Date.now()}`;
    const filePath = path.join('/tmp', `${fileId}.pdf`);
    await writeFile(filePath, buffer);

    const fileInfo = {
      id: fileId,
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      userId: userId
    };

    console.log('PDF uploaded:', fileInfo);

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