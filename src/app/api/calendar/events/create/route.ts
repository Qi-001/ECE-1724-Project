import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createCalendarEvent } from '@/lib/google-calendar';

// POST /api/calendar/events/create - Create a new calendar event
export async function POST(request: NextRequest) {
  try {
    // Get the session token from cookies
    const sessionToken = request.cookies.get('better-auth.session_token')?.value.split('.')[0];
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'You must be logged in to create calendar events' },
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
    
    // Parse request body
    const eventData = await request.json();
    const { 
      title, 
      description, 
      location, 
      startTime, 
      endTime, 
      groupId, 
      attendeeIds,
      recurrence,
      reminders,
      timeZone = 'America/New_York' // Default time zone
    } = eventData;
    
    // Validate required fields
    if (!title || !startTime || !endTime) {
      return NextResponse.json(
        { error: 'Title, start time, and end time are required' },
        { status: 400 }
      );
    }
    
    // Ensure attendeeIds is an array
    const validAttendeeIds = Array.isArray(attendeeIds) ? attendeeIds : [];
    
    // Add creator to attendees if not already included
    if (!validAttendeeIds.includes(userId)) {
      validAttendeeIds.push(userId);
    }
    
    console.log('Creating calendar event with data:', {
      creatorId: userId,
      title,
      description,
      location,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      groupId,
      attendeeIds: validAttendeeIds,
      recurrence,
      reminders,
      timeZone
    });
    
    // Create event
    const newEvent = await createCalendarEvent(userId, {
      title,
      description,
      location,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      groupId,
      attendeeIds: validAttendeeIds,
      recurrence, // Pass recurrence rules if provided
      reminders: reminders || {
        useDefault: true // Default to using default reminders if not specified
      }
    });
    
    console.log('Event created successfully with ID:', newEvent.id);
    
    return NextResponse.json({
      success: true,
      event: newEvent
    });
  } catch (error) {
    console.error('Error creating calendar event:', error);
    return NextResponse.json(
      { error: 'Failed to create calendar event', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 