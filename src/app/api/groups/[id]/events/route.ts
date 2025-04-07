import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createCalendarEvent } from '@/lib/google-calendar';

// GET /api/groups/[id]/events - Get all events for a group
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: groupId } = await params;

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

    // Check if user is a member of the group
    const userMembership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId
        }
      }
    });

    if (!userMembership) {
      return NextResponse.json(
        { error: 'You are not a member of this group' },
        { status: 403 }
      );
    }

    // Parse pagination parameters
    const { searchParams } = new URL(request.url);
    
    // Get and validate page and limit parameters
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '5', 10);
    
    // Ensure valid pagination values
    const validPage = page > 0 ? page : 1;
    const validLimit = limit > 0 && limit <= 20 ? limit : 5; // Cap at 20 items per page
    const skip = (validPage - 1) * validLimit;

    // Count total events for pagination
    const totalItems = await prisma.calendarEvent.count({
      where: {
        groupId: groupId,
      }
    });

    // Get all events for this group with pagination
    try {
      const events = await prisma.calendarEvent.findMany({
        where: {
          groupId: groupId,
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
        },
        orderBy: {
          startTime: 'asc',
        },
        skip,
        take: validLimit
      });

      // Calculate total pages
      const totalPages = Math.ceil(totalItems / validLimit);

      return NextResponse.json({
        events,
        pagination: {
          page: validPage,
          limit: validLimit,
          totalItems,
          totalPages
        }
      });
    } catch (dbError) {
      console.error('Database error fetching events:', dbError);
      // If table doesn't exist yet, return empty array with pagination
      return NextResponse.json({
        events: [],
        pagination: {
          page: 1,
          limit: validLimit,
          totalItems: 0,
          totalPages: 0
        }
      });
    }
  } catch (error) {
    console.error('Error fetching group events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch group events' },
      { status: 500 }
    );
  }
}

// POST /api/groups/[id]/events - Create a new event for a group
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id: groupId } = await params;
    const {
      title,
      description,
      location,
      startTime,
      endTime,
      attendeeIds,
    } = await request.json();

    // Basic validation
    if (!title || !startTime || !endTime || !attendeeIds || !Array.isArray(attendeeIds)) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
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

    // Check if user is a member of the group
    const userMembership = await prisma.groupMember.findUnique({
      where: {
        groupId_userId: {
          groupId,
          userId
        }
      }
    });

    if (!userMembership) {
      return NextResponse.json(
        { error: 'You are not a member of this group' },
        { status: 403 }
      );
    }

    // Check if attendeeIds are all members of the group
    const groupMembers = await prisma.groupMember.findMany({
      where: {
        groupId
      },
      select: {
        userId: true
      }
    });

    const groupMemberIds = groupMembers.map(member => member.userId);

    // Validate that all attendees are group members
    const invalidAttendees = attendeeIds.filter(id => !groupMemberIds.includes(id));

    if (invalidAttendees.length > 0) {
      return NextResponse.json(
        { error: 'Some attendees are not members of this group' },
        { status: 400 }
      );
    }

    try {
      // Convert date strings to Date objects
      const startDateTime = new Date(startTime);
      const endDateTime = new Date(endTime);

      // Create event
      const newEvent = await createCalendarEvent(userId, {
        title,
        description,
        location,
        startTime: startDateTime,
        endTime: endDateTime,
        groupId,
        attendeeIds,
      });

      return NextResponse.json(newEvent);
    } catch (createError) {
      console.error('Error creating event:', createError);
      return NextResponse.json(
        { error: 'Failed to create event' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing event creation:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 