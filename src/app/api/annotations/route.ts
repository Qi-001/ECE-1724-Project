import { NextRequest, NextResponse } from 'next/server';
import { authClient } from '@/lib/auth-client';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function POST(request: NextRequest) {
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
    const { content, documentId, pageNumber, positionX, positionY } = await request.json();

    if (!content || !documentId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if user has access to the document
    const document = await prisma.document.findUnique({
      where: { id: documentId },
      include: {
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

    const isUploader = document.uploaderId === userId;
    const isGroupMember = document.group?.members.some(member => member.userId === userId) || false;
    
    if (!isUploader && !isGroupMember) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Create the annotation
    const annotationData: Prisma.AnnotationCreateInput = {
      content,
      document: { connect: { id: documentId } },
      user: { connect: { id: userId } },
      ...(pageNumber !== undefined ? { pageNumber } : {}),
      ...(positionX !== undefined ? { positionX } : {}),
      ...(positionY !== undefined ? { positionY } : {})
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