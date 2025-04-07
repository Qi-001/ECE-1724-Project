import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string, documentId: string } }
) {
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

    const userId = session.user.id;
    const { id: groupId, documentId } = await params;

    // Verify the document exists and belongs to the group
    const document = await prisma.document.findUnique({
      where: { 
        id: documentId,
        groupId: groupId
      }
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found in this group' }, { status: 404 });
    }

    // Check if user is document owner or group admin
    const isDocumentOwner = document.uploaderId === userId;
    
    // Also check if user is group admin
    const groupMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId
        }
      }
    });
    
    const isGroupAdmin = groupMember?.role === 'ADMIN';

    if (!isDocumentOwner && !isGroupAdmin) {
      return NextResponse.json({ error: 'Not authorized to view permissions' }, { status: 403 });
    }

    // Get group permission for this document
    const groupPermission = await prisma.groupDocumentPermission.findUnique({
      where: {
        groupId_documentId: {
          groupId,
          documentId
        }
      }
    });

    return NextResponse.json(groupPermission || { role: null });
  } catch (error) {
    console.error('Error fetching group document permission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string, documentId: string } }
) {
  try {
    const sessionToken = request.cookies.get('better-auth.session_token')?.value.split('.')[0];
    if (!sessionToken) {
      console.error('Authentication error: No session token');
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true }
    });
  
    if (!session?.user?.id) {
      console.error('Authentication error: Invalid session');
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = session.user.id;
    const { id: groupId, documentId } = params;
    const body = await request.json();
    const { role } = body;
    
    console.log('Processing group permission update:', { 
      groupId, 
      documentId, 
      userId, 
      role,
      requestBody: body 
    });

    // Validate role
    if (role !== null && role !== 'viewer' && role !== 'editor') {
      console.error('Invalid role:', role);
      return NextResponse.json({ error: 'Invalid role. Must be null, viewer, or editor' }, { status: 400 });
    }

    // Verify the document exists and belongs to the group
    const document = await prisma.document.findUnique({
      where: { 
        id: documentId,
        groupId: groupId
      }
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found in this group' }, { status: 404 });
    }

    // Check if user is document owner or group admin
    const isDocumentOwner = document.uploaderId === userId;
    
    // Also check if user is group admin
    const groupMember = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId
        }
      }
    });
    
    const isGroupAdmin = groupMember?.role === 'ADMIN';

    if (!isDocumentOwner && !isGroupAdmin) {
      return NextResponse.json({ error: 'Not authorized to manage permissions' }, { status: 403 });
    }

    // Upsert or delete the group permission
    if (role === null) {
      // Delete the permission if role is null
      await prisma.groupDocumentPermission.deleteMany({
        where: {
          groupId,
          documentId
        }
      });
      
      return NextResponse.json({ success: true, role: null });
    } else {
      // Upsert the permission
      const permission = await prisma.groupDocumentPermission.upsert({
        where: {
          groupId_documentId: {
            groupId,
            documentId
          }
        },
        update: { role },
        create: {
          groupId,
          documentId,
          role
        }
      });
      
      return NextResponse.json(permission);
    }
  } catch (error) {
    console.error('Error updating group document permission:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 