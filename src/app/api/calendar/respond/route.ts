import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import prisma from '@/lib/prisma';
import { updateGoogleCalendarAttendance } from '@/lib/google-calendar';

// POST /api/calendar/respond - Respond to an event invitation
export async function POST(req: NextRequest) {
  try {
    // Get session token from cookies
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('better-auth.session_token')?.value?.split('.')[0];

    if (!sessionToken) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user from session
    const session = await prisma.session.findUnique({
      where: { token: sessionToken },
      include: { user: true },
    });

    if (!session?.user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // Parse request body
    const body = await req.json();
    const { eventId, response } = body;

    if (!eventId || !response) {
      return NextResponse.json(
        { error: 'Event ID and response are required' },
        { status: 400 }
      );
    }

    // Validate response value
    const validResponses = ['ACCEPTED', 'DECLINED', 'TENTATIVE'];
    if (!validResponses.includes(response)) {
      return NextResponse.json(
        { error: 'Invalid response status. Must be ACCEPTED, DECLINED, or TENTATIVE' },
        { status: 400 }
      );
    }

    // Find the event and the attendee record
    const event = await prisma.calendarEvent.findUnique({
      where: { id: eventId },
      include: {
        attendees: {
          where: { userId },
          include: { user: true }
        },
        creator: true
      }
    });

    if (!event) {
      return NextResponse.json(
        { error: 'Event not found' },
        { status: 404 }
      );
    }

    // Check if user is an attendee of this event
    if (event.attendees.length === 0) {
      return NextResponse.json(
        { error: 'You are not an attendee of this event' },
        { status: 403 }
      );
    }

    const attendeeId = event.attendees[0].id;

    // Update attendee response in database
    const updatedAttendee = await prisma.eventAttendee.update({
      where: { id: attendeeId },
      data: { responseStatus: response },
      include: { user: true }
    });

    // If event has a Google Calendar ID, try to update response there too
    let googleUpdateResult = null;
    if (event.googleEventId && updatedAttendee.user.email) {
      try {
        // Update the response in Google Calendar if possible
        googleUpdateResult = await updateGoogleCalendarAttendance(
          event.creatorId,
          event.googleEventId,
          updatedAttendee.user.email,
          response
        );
      } catch (error) {
        console.error('Failed to update Google Calendar attendance:', error);
        // We don't fail the request if Google Calendar update fails
      }
    }

    return NextResponse.json({
      success: true,
      attendee: {
        id: updatedAttendee.id,
        name: updatedAttendee.user.name,
        email: updatedAttendee.user.email,
        response: updatedAttendee.responseStatus
      },
      googleUpdateResult: googleUpdateResult ? 'success' : 'not_updated'
    });
  } catch (error) {
    console.error('Error updating event response:', error);
    return NextResponse.json(
      { error: 'Failed to update event response' },
      { status: 500 }
    );
  }
}

// Helper function to check if attendee exists
async function checkAttendeeExists(eventId: string, userId: string): Promise<boolean> {
  try {
    const result = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "EventAttendee" WHERE "eventId" = $1 AND "userId" = $2`,
      eventId, 
      userId
    ) as Array<{count: string | number}>;
    
    if (result && result.length > 0) {
      const count = typeof result[0].count === 'string' 
        ? parseInt(result[0].count, 10)
        : (result[0].count as number);
      
      return count > 0;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking attendee existence:', error);
    throw error; // Rethrow to be handled by the caller
  }
}

// Helper function to update attendee response
async function updateAttendeeResponse(
  eventId: string, 
  userId: string, 
  responseStatus: string
): Promise<void> {
  try {
    // Cast the response status string to the ResponseStatus enum type
    await prisma.$queryRawUnsafe(
      `UPDATE "EventAttendee" SET "responseStatus" = $1::text::"ResponseStatus", "updatedAt" = $2 
       WHERE "eventId" = $3 AND "userId" = $4`,
      responseStatus,
      new Date(),
      eventId,
      userId
    );
  } catch (error) {
    console.error('Error updating attendee response:', error);
    throw error;
  }
} 