import { NextRequest, NextResponse } from 'next/server';
import { authClient } from '@/lib/auth-client';
import prisma from '@/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    // Check authentication

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

    // Get search parameters
    const searchParams = request.nextUrl.searchParams;
    const email = searchParams.get('email');

    if (!email) {
      return NextResponse.json({ error: 'Email parameter is required' }, { status: 400 });
    }

    // Search for users with exact email match
    const users = await prisma.user.findMany({
      where: {
        email: {
          equals: email,
          mode: 'insensitive' // Case insensitive search
        }
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Error searching users:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 