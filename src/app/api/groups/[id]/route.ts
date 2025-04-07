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

    // Get pagination parameters
    const url = new URL(request.url);
    const docPage = parseInt(url.searchParams.get('docPage') || '1');
    const docLimit = parseInt(url.searchParams.get('docLimit') || '10');
    const memberPage = parseInt(url.searchParams.get('memberPage') || '1');
    const memberLimit = parseInt(url.searchParams.get('memberLimit') || '10');
    
    // Validate pagination parameters
    const validDocPage = docPage > 0 ? docPage : 1;
    const validDocLimit = docLimit > 0 && docLimit <= 50 ? docLimit : 10;
    const docSkip = (validDocPage - 1) * validDocLimit;
    
    const validMemberPage = memberPage > 0 ? memberPage : 1;
    const validMemberLimit = memberLimit > 0 && memberLimit <= 50 ? memberLimit : 10;
    const memberSkip = (validMemberPage - 1) * validMemberLimit;

    // First, check if group exists and user is a member
    const groupExists = await prisma.group.findFirst({
      where: {
        id: groupId,
        members: {
          some: {
            userId
          }
        }
      }
    });

    if (!groupExists) {
      return NextResponse.json({ error: 'Group not found or you are not a member' }, { status: 404 });
    }

    // Count total documents and members
    const [totalDocuments, totalMembers] = await Promise.all([
      prisma.document.count({
        where: { groupId }
      }),
      prisma.groupMember.count({
        where: { groupId }
      })
    ]);

    // Get basic group info
    const group = await prisma.group.findUnique({
      where: { id: groupId }
    });

    // Get documents with pagination
    const documents = await prisma.document.findMany({
      where: { groupId },
      orderBy: { createdAt: 'desc' },
      skip: docSkip,
      take: validDocLimit
    });

    // Get members with pagination
    const members = await prisma.groupMember.findMany({
      where: { groupId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [
        { role: 'desc' }, // ADMIN first, then MEMBER
        { 
          user: {
            name: 'asc'
          }
        }
      ],
      skip: memberSkip,
      take: validMemberLimit
    });

    return NextResponse.json({
      ...group,
      documents,
      members,
      pagination: {
        documents: {
          page: validDocPage,
          limit: validDocLimit,
          totalItems: totalDocuments,
          totalPages: Math.ceil(totalDocuments / validDocLimit)
        },
        members: {
          page: validMemberPage,
          limit: validMemberLimit,
          totalItems: totalMembers,
          totalPages: Math.ceil(totalMembers / validMemberLimit)
        }
      }
    });
  } catch (error) {
    console.error('Error fetching group details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
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
    const groupId = params.id;

    // Check if user is an admin of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId: groupId,
        userId: userId,
        role: 'ADMIN'
      }
    });

    if (!membership) {
      return NextResponse.json({ error: 'Only administrators can update group details' }, { status: 403 });
    }

    // Get request body
    const body = await request.json();
    const { name, description } = body;

    // Validate request
    if (!name || name.trim() === '') {
      return NextResponse.json({ error: 'Group name cannot be empty' }, { status: 400 });
    }

    // Update group
    const updatedGroup = await prisma.group.update({
      where: { id: groupId },
      data: {
        name: name.trim(),
        description: description
      }
    });

    return NextResponse.json(updatedGroup);
  } catch (error) {
    console.error('Error updating group:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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
    const groupId = params.id;

    // Check if user is an admin of the group
    const membership = await prisma.groupMember.findFirst({
      where: {
        groupId,
        userId,
        role: 'ADMIN'
      }
    });

    if (!membership) {
      return NextResponse.json({ error: 'Only administrators can delete groups' }, { status: 403 });
    }

    // Get all documents in this group
    const groupDocuments = await prisma.document.findMany({
      where: { groupId },
      select: { id: true }
    });

    // Get document IDs
    const documentIds = groupDocuments.map(doc => doc.id);

    // Delete all annotations for documents in this group
    if (documentIds.length > 0) {
      await prisma.annotation.deleteMany({
        where: {
          documentId: { in: documentIds }
        }
      });

      // Delete all comments for documents in this group
      await prisma.comment.deleteMany({
        where: {
          documentId: { in: documentIds }
        }
      });

      // Delete all document permissions for documents in this group
      await prisma.documentPermission.deleteMany({
        where: {
          documentId: { in: documentIds }
        }
      });
    }

    // Delete all documents of the group
    await prisma.document.deleteMany({
      where: { groupId }
    });

    // Delete all group invitations
    await prisma.groupInvitation.deleteMany({
      where: { groupId }
    });

    // Delete all members of the group
    await prisma.groupMember.deleteMany({
      where: { groupId }
    });

    // Finally delete the group
    await prisma.group.delete({
      where: { id: groupId }
    });

    return NextResponse.json({ success: true, message: 'Group successfully deleted' });
  } catch (error) {
    console.error('Error deleting group:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 