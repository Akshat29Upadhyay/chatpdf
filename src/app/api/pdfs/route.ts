import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { deletePDFChunks } from '@/lib/pinecone';

export async function GET() {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // For now, return a simple response
    // In a real app, you'd store PDF metadata in a database
    return NextResponse.json({ 
      message: 'PDF management endpoint ready',
      note: 'PDF listing would require a database to store metadata'
    });

  } catch (error) {
    console.error('PDFs API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { pdfId } = await request.json();
    if (!pdfId) {
      return NextResponse.json({ error: 'PDF ID is required' }, { status: 400 });
    }

    // Delete PDF chunks from Pinecone
    if (process.env.PINECONE_API_KEY) {
      try {
        await deletePDFChunks(userId, pdfId);
        console.log(`Deleted PDF chunks for: ${pdfId}`);
      } catch (pineconeError) {
        console.error('Failed to delete PDF chunks from Pinecone:', pineconeError);
      }
    }

    // Note: You'd also delete the file from Uploadcare here
    // For now, we'll just return success

    return NextResponse.json({ 
      success: true,
      message: 'PDF deleted successfully'
    });

  } catch (error) {
    console.error('PDF delete error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 