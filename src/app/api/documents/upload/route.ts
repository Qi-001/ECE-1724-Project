import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/documents/upload - Upload a new document
export async function POST(request: NextRequest) {
  try {
    // Get the session token from cookies
    const sessionToken = request.cookies.get('better-auth.session_token')?.value.split('.')[0];
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'You must be logged in to upload documents' },
        { status: 401 }
      );
    }

    // Fetch the session and user information
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true }
    });
    
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    
    // Parse the multipart form data
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const groupId = formData.get('groupId') as string;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    if (!title) {
      return NextResponse.json(
        { error: 'Title is required' },
        { status: 400 }
      );
    }

    // Generate a unique file URL
    // In a real application, you would upload to S3 or similar storage
    // For this demo, we'll create a placeholder URL
    const timestamp = Date.now();
    const cloudStorageUrl = `/uploads/${userId}/${timestamp}_${file.name.replace(/\s+/g, '_')}`;
    const fileType = file.type;

    // Create document in database
    const document = await prisma.document.create({
      data: {
        title,
        description,
        cloudStorageUrl,
        uploader: { connect: { id: userId } },
        ...(groupId ? { group: { connect: { id: groupId } } } : {})
      }
    });

    return NextResponse.json({
      success: true,
      document
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Failed to upload document' },
      { status: 500 }
    );
  }
} 