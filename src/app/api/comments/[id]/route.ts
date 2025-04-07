import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// PUT /api/comments/[id] - Update a comment
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the session token from cookies
    const sessionToken = request.cookies.get('better-auth.session_token')?.value.split('.')[0];
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'You must be logged in to edit comments' },
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
    const param = await params;
    const commentId = param.id;
    
    // Get the comment to verify ownership
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        document: {
          include: {
            group: {
              include: {
                members: {
                  where: { 
                    userId,
                    role: 'ADMIN'
                  }
                }
              }
            }
          }
        }
      }
    });
    
    if (!comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }
    
    // Check if user is comment owner or document owner/group admin
    const isCommentOwner = comment.userId === userId;
    const isDocumentOwner = comment.document.uploaderId === userId;
    const isGroupAdmin = comment.document.group?.members?.length > 0;
    
    if (!isCommentOwner && !isDocumentOwner && !isGroupAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to edit this comment' },
        { status: 403 }
      );
    }
    
    // Parse request body
    const { content } = await request.json();
    
    if (!content || content.trim() === '') {
      return NextResponse.json(
        { error: 'Comment content cannot be empty' },
        { status: 400 }
      );
    }
    
    // Update the comment
    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { 
        content,
        updatedAt: new Date()
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });
    
    return NextResponse.json(updatedComment);
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json(
      { error: 'Failed to update comment' },
      { status: 500 }
    );
  }
}

// DELETE /api/comments/[id] - Delete a comment
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the session token from cookies
    const sessionToken = request.cookies.get('better-auth.session_token')?.value.split('.')[0];
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'You must be logged in to delete comments' },
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
    const commentId = params.id;
    
    // Get the comment to verify ownership
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      include: {
        document: {
          include: {
            group: {
              include: {
                members: {
                  where: { 
                    userId,
                    role: 'ADMIN'
                  }
                }
              }
            }
          }
        }
      }
    });
    
    if (!comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }
    
    // Check if user is comment owner or document owner/group admin
    const isCommentOwner = comment.userId === userId;
    const isDocumentOwner = comment.document.uploaderId === userId;
    const isGroupAdmin = comment.document.group?.members?.length > 0;
    
    if (!isCommentOwner && !isDocumentOwner && !isGroupAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this comment' },
        { status: 403 }
      );
    }
    
    // Delete the comment
    await prisma.comment.delete({
      where: { id: commentId }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
} 