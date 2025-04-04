import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
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

    const userId = session.user.id;
    // Access params.id after ensuring it exists
    const { id: groupId } = await params;

    // Find the group with all its details
    const group = await prisma.group.findUnique({
      where: { id: groupId },
      include: {
        documents: {
          orderBy: {
            createdAt: 'desc',
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!group) {
      return NextResponse.json({ error: 'Group not found' }, { status: 404 });
    }

    // Check if user is a member of the group
    const isMember = group.members.some(member => member.userId === userId);
    
    if (!isMember) {
      return NextResponse.json({ error: 'You are not a member of this group' }, { status: 403 });
    }

    return NextResponse.json(group);
  } catch (error) {
    console.error('Error fetching group details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 