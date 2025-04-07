import { NextResponse, NextRequest } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Log all cookies to see what is being sent
    console.log('All cookies:', request.cookies.getAll());

    // Get the session token from cookies
    const sessionToken = request.cookies.get('better-auth.session_token')?.value.split('.')[0];

    console.log(sessionToken);
    
    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch the session using the token
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true }
    });

    console.log(session);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Get pagination parameters
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    
    // Validate pagination parameters
    const validPage = page > 0 ? page : 1;
    const validLimit = limit > 0 && limit <= 50 ? limit : 10;
    const skip = (validPage - 1) * validLimit;

    // Count total number of groups
    const totalGroups = await prisma.group.count({
      where: {
        members: {
          some: {
            userId: session.user.id
          }
        }
      }
    });

    // Fetch groups the user is a member of with pagination
    const groups = await prisma.group.findMany({
      where: {
        members: {
          some: {
            userId: session.user.id
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        documents: true
      },
      skip,
      take: validLimit,
      orderBy: {
        name: 'asc'
      }
    });

    return NextResponse.json({
      groups,
      pagination: {
        page: validPage,
        limit: validLimit,
        totalItems: totalGroups,
        totalPages: Math.ceil(totalGroups / validLimit)
      }
    });
  } catch (error) {
    console.error('Error fetching groups:', error);
    return NextResponse.json({ error: 'Failed to fetch groups' }, { status: 500 });
  }
} 