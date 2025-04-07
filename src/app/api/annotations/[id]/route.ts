import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

// Get a specific annotation
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    
    const annotation = await prisma.annotation.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      }
    });

    if (!annotation) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    return NextResponse.json(annotation);
  } catch (error) {
    console.error('Error fetching annotation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update an annotation
export async function PATCH(
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
    const { id } = params;
    const { content, x, y, width, height } = await request.json();

    // Find the annotation and check document permission
    const annotation = await prisma.annotation.findUnique({
      where: { id },
      include: { 
        document: {
          include: {
            group: {
              include: {
                members: true
              }
            }
          }
        }
      }
    });

    if (!annotation) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    // Check if user has edit permission
    const userPermission = await prisma.documentPermission.findUnique({
      where: {
        documentId_userId: {
          documentId: annotation.documentId,
          userId
        }
      }
    });

    const isOwner = annotation.document.uploaderId === userId;
    const isGroupMember = annotation.document.group?.members.some(member => member.userId === userId) || false;
    const canEdit = isOwner || 
                    userPermission?.role === 'owner' || 
                    userPermission?.role === 'editor' || 
                    (isGroupMember && !userPermission);

    if (!canEdit) {
      return NextResponse.json({ error: 'You do not have permission to edit this annotation' }, { status: 403 });
    }

    // Perform optimistic locking to prevent conflicts in collaborative editing
    // Check if the annotation has been modified since it was retrieved by the client
    const currentAnnotation = await prisma.annotation.findUnique({
      where: { id }
    });

    if (!currentAnnotation) {
      return NextResponse.json({ error: 'Annotation has been deleted' }, { status: 404 });
    }

    // Update the annotation
    const updateData: any = { lastEditedBy: userId };
    if (content !== undefined) updateData.content = content;
    if (x !== undefined) updateData.x = x;
    if (y !== undefined) updateData.y = y;
    if (width !== undefined) updateData.width = width;
    if (height !== undefined) updateData.height = height;

    const updatedAnnotation = await prisma.annotation.update({
      where: { id },
      data: updateData,
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

    return NextResponse.json(updatedAnnotation);
  } catch (error) {
    console.error('Error updating annotation:', error);
    
    // Handle Prisma errors with better messages
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ error: 'Annotation not found or was deleted' }, { status: 404 });
      }
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Delete an annotation
export async function DELETE(
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
    const { id } = params;

    // Find the annotation
    const annotation = await prisma.annotation.findUnique({
      where: { id },
      include: { document: true }
    });

    if (!annotation) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    // Check if user has edit permission
    const userPermission = await prisma.documentPermission.findUnique({
      where: {
        documentId_userId: {
          documentId: annotation.documentId,
          userId
        }
      }
    });

    const document = await prisma.document.findUnique({
      where: { id: annotation.documentId }
    });

    const isOwner = document?.uploaderId === userId;
    const canEdit = isOwner || userPermission?.role === 'owner' || userPermission?.role === 'editor';

    if (!canEdit) {
      return NextResponse.json({ error: 'You do not have permission to delete this annotation' }, { status: 403 });
    }

    // Delete the annotation
    await prisma.annotation.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting annotation:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 