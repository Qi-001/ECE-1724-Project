import { NextRequest, NextResponse } from 'next/server';
import { authClient } from '@/lib/auth-client';
import prisma from '@/lib/prisma';

export async function POST(request: NextRequest) {
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

    const currentUserId = session.user.id;
    const { userId, groupId } = await request.json();

    if (!userId || !groupId) {
      return NextResponse.json({ error: 'User ID and Group ID are required' }, { status: 400 });
    }

    // Check if the current user is an admin of the group
    const isAdmin = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId: currentUserId,
        role: 'ADMIN'
      }
    });

    if (!isAdmin) {
      return NextResponse.json({ error: 'Only group admins can add members' }, { status: 403 });
    }

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is already a member
    const existingMember = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId
      }
    });

    if (existingMember) {
      return NextResponse.json({ error: 'User is already a member of this group' }, { status: 400 });
    }

    // Add user to the group
    const member = await prisma.groupMember.create({
      data: {
        groupId,
        userId,
        role: 'MEMBER'
      }
    });

    return NextResponse.json({ 
      message: 'User successfully added to the group',
      member
    });
  } catch (error) {
    console.error('Error adding group member:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 