import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/user/documents - Get all documents uploaded by the user
export async function GET(request: NextRequest) {
  try {
    // Get the session token from cookies
    const sessionToken = request.cookies.get('better-auth.session_token')?.value.split('.')[0];
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'You must be logged in to view your documents' },
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

    // Parse pagination parameters
    const { searchParams } = new URL(request.url);
    
    // Get and validate page and limit parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    
    // Ensure valid pagination values
    const validPage = page > 0 ? page : 1;
    const validLimit = limit > 0 && limit <= 50 ? limit : 10; // Cap at 50 items per page
    const skip = (validPage - 1) * validLimit;

    // Count total documents for pagination
    const totalItems = await prisma.document.count({
      where: {
        uploaderId: userId
      }
    });

    // Fetch documents uploaded by the user with pagination
    const documents = await prisma.document.findMany({
      where: {
        uploaderId: userId
      },
      include: {
        group: {
          select: {
            name: true,
            id: true
          }
        },
        uploader: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      skip,
      take: validLimit
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalItems / validLimit);

    return NextResponse.json({
      documents,
      pagination: {
        page: validPage,
        limit: validLimit,
        totalItems,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching user documents:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user documents' },
      { status: 500 }
    );
  }
} 