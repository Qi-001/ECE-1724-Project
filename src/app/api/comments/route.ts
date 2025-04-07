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
    const { content, documentId, pageNumber, positionX, positionY } = await request.json();

    if (!documentId) {
      return NextResponse.json({ error: 'Document ID is required' }, { status: 400 });
    }

    // Create the comment
    const commentData: Prisma.CommentCreateInput = {
      content,
      document: { connect: { id: documentId } },
      user: { connect: { id: userId } },
      ...(pageNumber !== undefined ? { pageNumber } : {}),
      ...(positionX !== undefined ? { positionX } : {}),
      ...(positionY !== undefined ? { positionY } : {})
    };

    const comment = await prisma.comment.create({
      data: commentData,
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

    return NextResponse.json(comment);
  } catch (error) {
    console.error('Error creating comment:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 