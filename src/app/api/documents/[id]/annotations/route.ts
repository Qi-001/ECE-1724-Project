import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const sessionToken = request.cookies.get('better-auth.session_token')?.value.split('.')[0];
    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true }
    });
  
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = session.user.id;
    const { id: documentId } = await params;

    // Check if user has access to the document
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

    // Check if user has access to document
    const isUploader = document.uploaderId === userId;
    const isGroupMember = document.group?.members.some(member => member.userId === userId) || false;
    
    if (!isUploader && !isGroupMember) {
      return NextResponse.json({ error: 'You do not have permission to access this document' }, { status: 403 });
    }

    // Get all annotations for the document
    const annotations = await prisma.annotation.findMany({
      where: { documentId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' }
    });

    return NextResponse.json(annotations);
  } catch (error) {
    console.error('Error fetching annotations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 