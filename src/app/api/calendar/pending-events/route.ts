import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';

// GET /api/calendar/pending-events - Get events that need a response
export async function GET(req: NextRequest) {
  try {
    // Get session token from cookies
    const cookieStore = await cookies();
    
    // Try different possible cookie names since we're getting 401
    const sessionToken = cookieStore.get('better-auth.session_token')?.value?.split('.')[0];

    if (!sessionToken) {
      console.log('No session token found in cookies');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user from session
    let userId: string;
    try {
      // Try to find by token directly
      const session = await prisma.session.findUnique({
        where: { token: sessionToken },
      });
      
      if (!session) {
        throw new Error('Session not found');
      }
      
      userId = session.userId;
    } catch (error) {
      console.error('Error finding session by token:', error);
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    if (!userId) {
      console.log('No valid user session found');
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    console.log('User authenticated:', userId);

    // Parse pagination parameters
    const { searchParams } = new URL(req.url);
    
    // Get and validate page and limit parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    
    // Ensure valid pagination values
    const validPage = page > 0 ? page : 1;
    const validLimit = limit > 0 && limit <= 20 ? limit : 5; // Cap at 20 items per page
    const skip = (validPage - 1) * validLimit;

    // Get current date
    const now = new Date();

    // Count total pending events for pagination
    const totalItems = await prisma.calendarEvent.count({
      where: {
        attendees: {
          some: {
            userId: userId,
            responseStatus: 'PENDING',
          },
        },
        endTime: {
          gte: now,
        },
      },
    });

    // Get all events where the user is an attendee with PENDING status
    // and the event hasn't ended yet, with pagination
    const pendingEvents = await prisma.calendarEvent.findMany({
      where: {
        attendees: {
          some: {
            userId: userId,
            responseStatus: 'PENDING',
          },
        },
        endTime: {
          gte: now,
        },
      },
      include: {
        creator: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        attendees: {
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
        group: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        startTime: 'asc',
      },
      skip,
      take: validLimit,
    });

    console.log(`Found ${pendingEvents.length} pending events for user ${userId} (page ${validPage}, limit ${validLimit})`);

    // Transform the data for the frontend
    const formattedEvents = pendingEvents.map((event: any) => {
      // Format attendees
      const formattedAttendees = event.attendees.map((attendee: any) => ({
        id: attendee.id,
        name: attendee.user.name || '',
        email: attendee.user.email || '',
        response: attendee.responseStatus,
      }));

      // Create Google Calendar link if googleEventId exists
      let googleCalendarLink = null;
      if (event.googleEventId) {
        googleCalendarLink = `https://calendar.google.com/calendar/event?eid=${event.googleEventId}`;
      }

      return {
        id: event.id,
        title: event.title,
        description: event.description,
        startTime: event.startTime.toISOString(),
        endTime: event.endTime.toISOString(),
        location: event.location,
        creator: {
          id: event.creator.id,
          name: event.creator.name || '',
          email: event.creator.email || '',
        },
        group: event.group,
        attendees: formattedAttendees,
        googleEventId: event.googleEventId,
        googleCalendarLink: googleCalendarLink,
      };
    });

    // Calculate total pages for pagination
    const totalPages = Math.ceil(totalItems / validLimit);

    return NextResponse.json({ 
      events: formattedEvents,
      pagination: {
        page: validPage,
        limit: validLimit,
        totalItems,
        totalPages
      }
    });
  } catch (error) {
    console.error('Error fetching pending events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pending events' },
      { status: 500 }
    );
  }
} 