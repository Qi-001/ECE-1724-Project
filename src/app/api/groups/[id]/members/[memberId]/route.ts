import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// PUT /api/groups/[id]/members/[memberId] - Update member role
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string, memberId: string } }
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
    const { id: groupId, memberId } = await params;
    const { role } = await request.json();
    
    // Validate role
    if (role !== 'ADMIN' && role !== 'MEMBER') {
      return NextResponse.json({ error: 'Invalid role. Must be ADMIN or MEMBER' }, { status: 400 });
    }

    // Check if the member exists
    const memberToUpdate = await prisma.groupMember.findUnique({
      where: {
        id: memberId
      },
      include: {
        user: true
      }
    });

    if (!memberToUpdate) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Verify that the memberId belongs to the specified group
    if (memberToUpdate.groupId !== groupId) {
      return NextResponse.json({ error: 'Member not found in this group' }, { status: 404 });
    }

    // Check if current user is an admin of the group
    const currentUserMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        role: 'ADMIN'
      }
    });

    if (!currentUserMembership) {
      return NextResponse.json({ error: 'Only group administrators can change member roles' }, { status: 403 });
    }

    // Update the member role
    const updatedMember = await prisma.groupMember.update({
      where: {
        id: memberId
      },
      data: {
        role
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    return NextResponse.json(updatedMember);
  } catch (error) {
    console.error('Error updating group member role:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string, memberId: string } }
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
    const { id: groupId, memberId } = params;

    // Check if the member to be removed exists
    const memberToRemove = await prisma.groupMember.findUnique({
      where: {
        id: memberId
      },
      include: {
        user: true
      }
    });

    if (!memberToRemove) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 });
    }

    // Verify that the memberId belongs to the specified group
    if (memberToRemove.groupId !== groupId) {
      return NextResponse.json({ error: 'Member not found in this group' }, { status: 404 });
    }

    // Check if current user is an admin of the group
    const currentUserMembership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        role: 'ADMIN'
      }
    });

    if (!currentUserMembership) {
      return NextResponse.json({ error: 'Only group administrators can remove members' }, { status: 403 });
    }

    // Don't allow admins to remove themselves
    if (memberToRemove.userId === userId) {
      return NextResponse.json({ error: 'Admins cannot remove themselves from the group' }, { status: 400 });
    }

    // Remove the member
    await prisma.groupMember.delete({
      where: {
        id: memberId
      }
    });

    return NextResponse.json({ 
      success: true,
      message: `Successfully removed ${memberToRemove.user.name || memberToRemove.user.email || 'member'} from the group`
    });
  } catch (error) {
    console.error('Error removing group member:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 