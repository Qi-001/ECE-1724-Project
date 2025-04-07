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

    // Parse pagination parameters
    const { searchParams } = new URL(request.url);
    
    // Get and validate page and limit parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    
    // Ensure valid pagination values
    const validPage = page > 0 ? page : 1;
    const validLimit = limit > 0 && limit <= 50 ? limit : 20; // Cap at 50 items per page
    const skip = (validPage - 1) * validLimit;

    // Count total comments for pagination
    const totalItems = await prisma.comment.count({
      where: { documentId }
    });

    // Get all comments for the document with pagination
    const comments = await prisma.comment.findMany({
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
      orderBy: { createdAt: 'desc' },
      skip,
      take: validLimit
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalItems / validLimit);

    return NextResponse.json({
      comments,
      pagination: {
        page: validPage,
        limit: validLimit,
        totalItems,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 