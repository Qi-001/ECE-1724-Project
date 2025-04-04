import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { Prisma } from '@prisma/client';

export async function PUT(
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
    const { id: annotationId } = await params;
    const { content } = await request.json();

    // Verify the annotation exists and belongs to the user
    const existingAnnotation = await prisma.annotation.findUnique({
      where: { id: annotationId },
      include: { document: true }
    });

    if (!existingAnnotation) {
      return NextResponse.json({ error: 'Annotation not found' }, { status: 404 });
    }

    if (existingAnnotation.userId !== userId) {
      return NextResponse.json({ error: 'Not authorized to edit this annotation' }, { status: 403 });
    }

    // Update the annotation
    const updatedAnnotation = await prisma.annotation.update({
      where: { id: annotationId },
      data: { content },
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 