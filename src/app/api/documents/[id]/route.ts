import { NextRequest, NextResponse } from 'next/server';
import { authClient } from '@/lib/auth-client';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the session token from cookies
    const sessionToken = request.cookies.get('better-auth.session_token')?.value.split('.')[0];
    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch the session using the token
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true }
    });
  
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = session.user.id;
    // Access params.id after ensuring it exists
    const { id: documentId } = await params;

    // Get document with annotations and check if user has access
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        annotations: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
        },
        group: {
          include: {
            members: {
              select: {
                userId: true,
              },
            },
          },
        },
      },
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if user has access to the document
    const isUploader = document.uploaderId === userId;
    const isGroupMember = document.group?.members.some(member => member.userId === userId) || false;
    
    if (!isUploader && !isGroupMember) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    return NextResponse.json(document);
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the session token from cookies
    const sessionToken = request.cookies.get('better-auth.session_token')?.value.split('.')[0];
    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch the session using the token
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true }
    });
  
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = session.user.id;
    const documentId = params.id;

    // Fetch the document with its group information
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
        group: {
          include: {
            members: true
          }
        }
      }
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if user is the uploader or an admin of the group
    const isUploader = document.uploaderId === userId;
    const isGroupAdmin = document.group?.members.some(
      member => member.userId === userId && member.role === 'ADMIN'
    ) || false;

    if (!isUploader && !isGroupAdmin) {
      return NextResponse.json({ error: 'Only document uploaders or group administrators can delete documents' }, { status: 403 });
    }

    // Delete the document
    await prisma.document.delete({
      where: { id: documentId }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting document:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 