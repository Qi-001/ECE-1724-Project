import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function POST(request: NextRequest) {
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
    const { content, documentId, pageNumber, x, y, width, height } = await request.json();

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }
    
    if (pageNumber === undefined || x === undefined || y === undefined) {
      return NextResponse.json({ error: 'Page number and position (x, y) are required' }, { status: 400 });
    }

    // Check if user has editor or owner permission
    const userPermission = await prisma.documentPermission.findUnique({
      where: {
        documentId_userId: {
          documentId,
          userId
        }
      }
    });

    // Check document owner if no explicit permission found
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

    const isOwner = document.uploaderId === userId;
    const isGroupMember = document.group?.members.some(member => member.userId === userId) || false;
    const canEdit = isOwner || 
                    userPermission?.role === 'owner' || 
                    userPermission?.role === 'editor' || 
                    (isGroupMember && !userPermission); // Group members can edit if no explicit permission set

    if (!canEdit) {
      return NextResponse.json({ error: 'You do not have permission to create annotations' }, { status: 403 });
    }

    // Create the annotation
    const annotationData: Prisma.AnnotationCreateInput = {
      content: content || '',
      document: { connect: { id: documentId } },
      user: { connect: { id: userId } },
      pageNumber,
      x,
      y,
      width: width || 200,
      height: height || 100,
      lastEditedBy: userId
    };

    const annotation = await prisma.annotation.create({
      data: annotationData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(annotation);
  } catch (error) {
    console.error('Error creating annotation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 