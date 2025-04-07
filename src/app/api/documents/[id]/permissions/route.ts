import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET document permissions
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: documentId } = await params;
    
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
    
    // Check if document exists
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });
    
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    
    // Check if user is the document owner or has a permission
    const isOwner = document.uploaderId === userId;
    if (!isOwner) {
      const hasPermission = await prisma.documentPermission.findFirst({
        where: {
          documentId,
          userId
        }
      });
      
      // If user is not owner and has no permissions, check if user is in the group
      if (!hasPermission && document.groupId) {
        const isGroupMember = await prisma.groupMember.findFirst({
          where: {
            groupId: document.groupId,
            userId
          }
        });
        
        if (!isGroupMember) {
          return NextResponse.json({ error: 'You do not have permission to view this document' }, { status: 403 });
        }
      } else if (!hasPermission) {
        return NextResponse.json({ error: 'You do not have permission to view this document' }, { status: 403 });
      }
    }

    // Parse pagination parameters
    const { searchParams } = new URL(request.url);
    
    // Get and validate page and limit parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    
    // Ensure valid pagination values
    const validPage = page > 0 ? page : 1;
    const validLimit = limit > 0 && limit <= 50 ? limit : 10; // Cap at 50 items per page
    const skip = (validPage - 1) * validLimit;

    // Count total permissions for pagination (excluding owner)
    const totalItems = await prisma.documentPermission.count({
      where: { documentId }
    });

    // For document owner, get all permissions with pagination
    const permissions = await prisma.documentPermission.findMany({
      where: { documentId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        }
      },
      skip,
      take: validLimit,
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Add the owner with owner role to the list (always include owner regardless of pagination)
    const ownerPermission = {
      id: 'owner',
      userId: document.uploaderId,
      documentId,
      role: 'owner',
      user: await prisma.user.findUnique({
        where: { id: document.uploaderId },
        select: {
          id: true,
          name: true,
          email: true,
        }
      })
    };

    // Calculate total pages (adding 1 to always include owner)
    const totalPages = Math.ceil((totalItems + 1) / validLimit);

    // Put owner first in the list
    const allPermissions = [ownerPermission, ...permissions];

    return NextResponse.json({
      permissions: allPermissions,
      pagination: {
        page: validPage,
        limit: validLimit,
        totalItems: totalItems + 1, // Add 1 for owner
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching permissions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST document permission
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: documentId } = params;
    const { targetUserId, role } = await request.json();
    
    // Validate inputs
    if (!targetUserId || !role || !['viewer', 'editor', 'owner'].includes(role)) {
      return NextResponse.json({ error: 'Invalid inputs' }, { status: 400 });
    }
    
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
    
    // Check if document exists
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });
    
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    
    // Check if user is the document owner
    const isOwner = document.uploaderId === userId;
    if (!isOwner) {
      // Only document owners can manage permissions
      return NextResponse.json({ error: 'Only document owners can manage permissions' }, { status: 403 });
    }
    
    // Check if trying to change own permission
    if (targetUserId === userId) {
      return NextResponse.json({ error: 'You cannot change your own permission' }, { status: 400 });
    }
    
    // Check if target user exists
    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId }
    });
    
    if (!targetUser) {
      return NextResponse.json({ error: 'Target user not found' }, { status: 404 });
    }
    
    // Check if permission already exists
    const existingPermission = await prisma.documentPermission.findFirst({
      where: {
        documentId,
        userId: targetUserId
      }
    });
    
    let updatedPermission;
    
    if (existingPermission) {
      // Update existing permission
      updatedPermission = await prisma.documentPermission.update({
        where: { id: existingPermission.id },
        data: { 
          role: role.toUpperCase(), 
          updatedAt: new Date() 
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
    } else {
      // Create new permission
      updatedPermission = await prisma.documentPermission.create({
        data: {
          documentId,
          userId: targetUserId,
          role: role.toUpperCase()
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
    }
    
    return NextResponse.json(updatedPermission);
  } catch (error) {
    console.error('Error managing permission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE document permission
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: documentId } = params;
    const userId = request.nextUrl.searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }
    
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
    
    // Check if document exists
    const document = await prisma.document.findUnique({
      where: { id: documentId }
    });
    
    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    
    // Check if user is the document owner
    const isOwner = document.uploaderId === currentUserId;
    if (!isOwner) {
      // Only document owners can remove permissions
      return NextResponse.json({ error: 'Only document owners can remove permissions' }, { status: 403 });
    }
    
    // Check if trying to remove document owner
    if (userId === document.uploaderId) {
      return NextResponse.json({ error: 'Cannot remove document owner' }, { status: 400 });
    }
    
    // Check if permission exists
    const existingPermission = await prisma.documentPermission.findFirst({
      where: {
        documentId,
        userId
      }
    });
    
    if (!existingPermission) {
      return NextResponse.json({ error: 'Permission not found' }, { status: 404 });
    }
    
    // Delete the permission
    await prisma.documentPermission.delete({
      where: { id: existingPermission.id }
    });
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error removing permission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 