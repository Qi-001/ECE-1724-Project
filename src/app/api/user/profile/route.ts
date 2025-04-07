import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/user/profile - Get current user profile
export async function GET(request: NextRequest) {
  try {
    // Get the session token from cookies
    const sessionToken = request.cookies.get('better-auth.session_token')?.value.split('.')[0];
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'You must be logged in to view your profile' },
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

    const { id, name, email, createdAt } = session.user;

    return NextResponse.json({
      id,
      name,
      email,
      createdAt
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}

// PUT /api/user/profile - Update user profile
export async function PUT(request: NextRequest) {
  try {
    // Get the session token from cookies
    const sessionToken = request.cookies.get('better-auth.session_token')?.value.split('.')[0];
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'You must be logged in to update your profile' },
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
    
    // Parse request body
    const { name } = await request.json();
    
    // Update user profile
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { 
        name: name || null
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true
      }
    });
    
    return NextResponse.json(updatedUser);
  } catch (error) {
    console.error('Error updating user profile:', error);
    return NextResponse.json(
      { error: 'Failed to update user profile' },
      { status: 500 }
    );
  }
} 