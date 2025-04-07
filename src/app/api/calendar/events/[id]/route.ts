import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/calendar/events/[id] - Get a specific calendar event
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get the session token from cookies
    const sessionToken = request.cookies.get('better-auth.session_token')?.value.split('.')[0];
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'You must be logged in to view event details' },
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
    const eventId = params.id;
    
    // Get the event with related data
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        group: {
          select: {
            id: true,
            name: true
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
    
    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }
    
    // Check if user has access (creator, attendee, or group member)
    const isCreator = event.creatorId === userId;
    const isAttendee = event.attendees.some(attendee => attendee.userId === userId);
    
    // Check if user is group member (if event belongs to a group)
    let isGroupMember = false;
    if (event.groupId) {
      const groupMembership = await prisma.groupMember.findUnique({
        where: {
          groupId_userId: {
            groupId: event.groupId,
            userId
          }
        }
      });
      isGroupMember = !!groupMembership;
    }
    
    if (!isCreator && !isAttendee && !isGroupMember) {
      return NextResponse.json(
        { error: 'You do not have permission to view this event' },
        { status: 403 }
      );
    }
    
    // Create Google Calendar link if available
    let htmlLink = null;
    if (event.googleEventId) {
      htmlLink = `https://calendar.google.com/calendar/event?eid=${encodeURIComponent(event.googleEventId)}`;
    }
    
    // Return event with additional Google Calendar link
    return NextResponse.json({
      ...event,
      htmlLink
    });
  } catch (error) {
    console.error('Error fetching event details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch event details' },
      { status: 500 }
    );
  }
} 