import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/user/groups - Get all groups the user is a member of
export async function GET(request: NextRequest) {
  try {
    // Get the session token from cookies
    const sessionToken = request.cookies.get('better-auth.session_token')?.value.split('.')[0];
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'You must be logged in to view your groups' },
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
    const validLimit = limit > 0 && limit <= 30 ? limit : 10; // Cap at 30 items per page
    const skip = (validPage - 1) * validLimit;

    // Count total groups for pagination
    const totalItems = await prisma.group.count({
      where: {
        members: {
          some: {
            userId: userId
          }
        }
      }
    });

    // Fetch groups the user is a member of with pagination
    const groups = await prisma.group.findMany({
      where: {
        members: {
          some: {
            userId: userId
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
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
      groups,
      pagination: {
        page: validPage,
        limit: validLimit,
        totalItems,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching user groups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user groups' },
      { status: 500 }
    );
  }
} 