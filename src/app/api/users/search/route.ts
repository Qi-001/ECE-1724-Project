import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
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

    // Get the search query and pagination parameters
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q') || searchParams.get('email');
    
    // Get and validate page and limit parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    
    // Ensure valid pagination values
    const validPage = page > 0 ? page : 1;
    const validLimit = limit > 0 && limit <= 50 ? limit : 10; // Cap at 50 items per page
    const skip = (validPage - 1) * validLimit;
    
    if (!query || query.trim().length === 0) {
      return NextResponse.json({ error: 'Search query cannot be empty' }, { status: 400 });
    }

    // Count total matching users for pagination
    const totalItems = await prisma.user.count({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } }
        ],
        NOT: {
          id: session.user.id
        }
      }
    });

    // Search for users by name or email, excluding the current user
    const users = await prisma.user.findMany({
      where: {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { email: { contains: query, mode: 'insensitive' } }
        ],
        NOT: {
          id: session.user.id
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        image: true
      },
      skip,
      take: validLimit,
      orderBy: [
        { name: 'asc' },
        { email: 'asc' }
      ]
    });

    // Calculate total pages
    const totalPages = Math.ceil(totalItems / validLimit);

    return NextResponse.json({
      users,
      pagination: {
        page: validPage,
        limit: validLimit,
        totalItems,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 