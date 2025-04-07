import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/groups/[id]/events/[eventId]/cancel - Cancel a group event
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string, eventId: string } }
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
    const { id: groupId, eventId } = params;

    // Check if the event exists and belongs to the group
    const event = await prisma.calendarEvent.findFirst({
      where: {
        id: eventId,
        groupId
      },
      include: {
        group: {
          include: {
            members: true
          }
        }
      }
    });

    if (!event) {
      return NextResponse.json({ error: 'Event not found' }, { status: 404 });
    }

    if (!event.group) {
      return NextResponse.json({ error: 'Event is not associated with a group' }, { status: 400 });
    }

    // Check if user is admin or event creator
    const isAdmin = event.group.members.some(
      member => member.userId === userId && member.role === 'ADMIN'
    );
    
    const isCreator = event.creatorId === userId;

    if (!isAdmin && !isCreator) {
      return NextResponse.json({ 
        error: 'Only group administrators or event creators can cancel events' 
      }, { status: 403 });
    }

    // Update the event status to CANCELLED
    const cancelledEvent = await prisma.calendarEvent.update({
      where: { id: eventId },
      data: {
        status: 'CANCELLED'
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        attendees: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            }
          }
        }
      }
    });

    return NextResponse.json(cancelledEvent);
  } catch (error) {
    console.error('Error cancelling event:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 