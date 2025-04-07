import { google } from 'googleapis';
import prisma from '@/lib/prisma';
import { CalendarEvent, EventAttendee, User } from '@prisma/client';

// Define interfaces for types
interface AttendeeWithUser extends EventAttendee {
  user: User;
}

interface CalendarEventWithRelations extends CalendarEvent {
  attendees: AttendeeWithUser[];
  group?: {
    id: string;
    name: string;
  };
  creator: {
    id: string;
    name: string | null;
    email: string | null;
  };
}

// OAuth2 configuration
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Function to get an authorized Google Calendar client for a user
export async function getCalendarClient(userId: string) {
  try {
    // Find user credentials
    const credentials = await prisma.googleCalendarCredential.findUnique({
      where: { userId }
    });

    if (!credentials) {
      console.error(`No Google Calendar credentials found for user ${userId}`);
      throw new Error('User has not authorized Google Calendar access');
    }

    console.log(`Found credentials for user ${userId}, expiry: ${credentials.expiryDate}`);
    
    // Set credentials in OAuth client
    oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiryDate.getTime()
    });

    // Check if token needs refresh
    if (credentials.expiryDate.getTime() < Date.now()) {
      console.log(`Refreshing token for user ${userId}`);
      const { credentials: refreshedCredentials } = await oauth2Client.refreshAccessToken();
      
      // Update stored credentials
      await prisma.googleCalendarCredential.update({
        where: { userId },
        data: {
          accessToken: refreshedCredentials.access_token!,
          expiryDate: new Date(refreshedCredentials.expiry_date!)
        }
      });
      
      console.log(`Token refreshed for user ${userId}`);
    }

    // Create and return calendar client
    return google.calendar({ version: 'v3', auth: oauth2Client });
  } catch (error) {
    console.error('Error getting calendar client:', error);
    throw error;
  }
}

// Function to save OAuth credentials
export async function saveOAuthCredentials(
  userId: string, 
  tokens: {
    access_token: string;
    refresh_token: string;
    expiry_date: number;
  }
) {
  try {
    // Upsert to handle both creation and updates
    await prisma.googleCalendarCredential.upsert({
      where: { userId },
      update: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: new Date(tokens.expiry_date)
      },
      create: {
        userId,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiryDate: new Date(tokens.expiry_date)
      }
    });
    
    return true;
  } catch (error) {
    console.error('Error saving OAuth credentials:', error);
    throw error;
  }
}

// Function to create a calendar event and sync with Google Calendar
export async function createCalendarEvent(
  creatorId: string,
  eventData: {
    title: string;
    description?: string;
    location?: string;
    startTime: Date;
    endTime: Date;
    groupId?: string;
    attendeeIds: string[];
    recurrence?: string[]; // Add support for recurrence
    reminders?: {
      useDefault: boolean;
      overrides?: Array<{
        method: string;
        minutes: number;
      }>;
    };
  }
) {
  try {
    console.log(`Creating calendar event for creator: ${creatorId}`, eventData);
    
    // First create the event in our database
    const newEvent = await prisma.calendarEvent.create({
      data: {
        title: eventData.title,
        description: eventData.description,
        location: eventData.location,
        startTime: eventData.startTime,
        endTime: eventData.endTime,
        creatorId,
        groupId: eventData.groupId,
        attendees: {
          create: eventData.attendeeIds.map(userId => ({
            userId,
            responseStatus: 'PENDING'
          }))
        }
      },
      include: {
        attendees: {
          include: {
            user: true
          }
        },
        group: true,
        creator: true
      }
    });

    console.log(`Database event created with ID: ${newEvent.id}`);

    try {
      // Check if creator has connected Google Calendar
      const creatorCredentials = await prisma.googleCalendarCredential.findUnique({
        where: { userId: creatorId }
      });
      
      if (!creatorCredentials) {
        console.log(`Creator ${creatorId} has not connected Google Calendar, skipping sync`);
        return newEvent;
      }
      
      // Then sync with Google Calendar if the creator has connected their account
      console.log(`Getting calendar client for creator ${creatorId}`);
      const calendar = await getCalendarClient(creatorId);
      
      // Get attendee emails
      const attendeeEmails = newEvent.attendees
        .filter((attendee: AttendeeWithUser) => attendee.user.email !== null)
        .map((attendee: AttendeeWithUser) => ({
          email: attendee.user.email,
          responseStatus: 'needsAction'
        }));
      
      console.log(`Found ${attendeeEmails.length} attendees with emails`);
      
      // Create request body following Google Calendar API format
      const requestBody = {
        summary: newEvent.title,
        description: newEvent.description || '',
        location: newEvent.location || '',
        start: {
          dateTime: newEvent.startTime.toISOString(),
          timeZone: 'UTC'
        },
        end: {
          dateTime: newEvent.endTime.toISOString(),
          timeZone: 'UTC'
        },
        attendees: attendeeEmails.filter((a: { email: string | null }) => a.email) as any[],
        // Add recurrence if provided
        recurrence: eventData.recurrence || undefined,
        // Configure reminders
        reminders: eventData.reminders || {
          useDefault: true
        },
        guestsCanSeeOtherGuests: true
      };
      
      // Create event in Google Calendar
      console.log('Inserting event into Google Calendar with request:', JSON.stringify(requestBody));
      const googleEventResponse = await calendar.events.insert({
        calendarId: 'primary',
        sendUpdates: 'all',
        conferenceDataVersion: 1,
        requestBody
      });

      console.log('Google Calendar API response received');
      const googleEvent = googleEventResponse.data;
      console.log(`Google Event created with ID: ${googleEvent.id}`);

      // Update our record with the Google Event ID
      if (googleEvent.id) {
        await prisma.calendarEvent.update({
          where: { id: newEvent.id },
          data: {
            googleEventId: googleEvent.id
          }
        });
        console.log(`Updated our event record with Google Event ID: ${googleEvent.id}`);
      }

      // Now sync the event to each attendee's calendar if they have Google Calendar connected
      console.log(`Syncing event to ${newEvent.attendees.length} attendees' calendars`);
      for (const attendee of newEvent.attendees) {
        try {
          // Skip creator as they already have the event
          if (attendee.userId === creatorId) {
            console.log(`Skipping creator ${creatorId} for event sync`);
            continue;
          }
          
          console.log(`Checking if attendee ${attendee.userId} has Google Calendar connected`);
          // Check if this attendee has Google Calendar connected
          const hasCalendarConnected = await prisma.googleCalendarCredential.findUnique({
            where: { userId: attendee.userId }
          });
          
          if (hasCalendarConnected && googleEvent.iCalUID) {
            console.log(`Syncing event to attendee ${attendee.userId}'s calendar`);
            // Add the event to this attendee's calendar too
            const attendeeCalendar = await getCalendarClient(attendee.userId);
            
            // Create importable requestBody
            const importRequestBody = {
              iCalUID: googleEvent.iCalUID,
              summary: newEvent.title,
              description: newEvent.description || '',
              location: newEvent.location || '',
              start: {
                dateTime: newEvent.startTime.toISOString(),
                timeZone: 'UTC'
              },
              end: {
                dateTime: newEvent.endTime.toISOString(),
                timeZone: 'UTC'
              },
              attendees: attendeeEmails.filter((a: { email: string | null }) => a.email) as any[],
              recurrence: eventData.recurrence || undefined,
              reminders: eventData.reminders || {
                useDefault: true
              },
              status: 'confirmed'
            };
            
            // Import the event to their calendar to ensure it shows up
            await attendeeCalendar.events.import({
              calendarId: 'primary',
              requestBody: importRequestBody
            });
            console.log(`Successfully synced event to attendee ${attendee.userId}'s calendar`);
          } else {
            console.log(`Attendee ${attendee.userId} has not connected Google Calendar or event has no iCalUID`);
          }
        } catch (attendeeError) {
          console.error(`Error adding event to attendee ${attendee.userId}'s calendar:`, attendeeError);
          // Continue with other attendees even if one fails
        }
      }
    } catch (error) {
      // If Google Calendar sync fails, we still have the event in our database
      console.error('Error syncing with Google Calendar:', error);
      // We can handle this silently since the event is already in our database
    }

    return newEvent;
  } catch (error) {
    console.error('Error creating calendar event:', error);
    throw error;
  }
}

// Function to get all events for a user
export async function getUserEvents(userId: string) {
  try {
    // Get events where user is creator or attendee
    const events = await prisma.calendarEvent.findMany({
      where: {
        OR: [
          { creatorId: userId },
          { attendees: { some: { userId } } }
        ]
      },
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
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    return events;
  } catch (error) {
    console.error('Error fetching user events:', error);
    throw error;
  }
}

// Function to get all events for a group
export async function getGroupEvents(groupId: string) {
  try {
    const events = await prisma.calendarEvent.findMany({
      where: { groupId },
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
      },
      orderBy: {
        startTime: 'asc'
      }
    });

    return events;
  } catch (error) {
    console.error('Error fetching group events:', error);
    throw error;
  }
}

// Exchange code for tokens
export async function exchangeCodeForTokens(code: string) {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    return tokens;
  } catch (error) {
    console.error('Error exchanging code for tokens:', error);
    throw error;
  }
}

// Update event response status
export async function updateEventResponse(
  eventId: string,
  userId: string,
  responseStatus: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE'
) {
  try {
    // Update in our database
    const updatedAttendee = await prisma.eventAttendee.update({
      where: {
        eventId_userId: {
          eventId,
          userId
        }
      },
      data: {
        responseStatus
      },
      include: {
        event: true
      }
    });

    // Sync with Google Calendar if the event has a Google ID
    if (updatedAttendee.event.googleEventId) {
      try {
        // Get the event creator's calendar client
        const calendar = await getCalendarClient(updatedAttendee.event.creatorId);
        
        // First get the event to see all attendees
        const googleEvent = await calendar.events.get({
          calendarId: 'primary',
          eventId: updatedAttendee.event.googleEventId
        });
        
        // Find the user's email
        const userEmail = (await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true }
        }))?.email;
        
        if (!userEmail) {
          throw new Error('User email not found');
        }
        
        // Map the response status
        const googleResponseStatus = {
          'ACCEPTED': 'accepted',
          'DECLINED': 'declined',
          'TENTATIVE': 'tentative'
        }[responseStatus];
        
        // Update the attendee status
        const attendees = googleEvent.data.attendees || [];
        const updatedAttendees = attendees.map(attendee => {
          if (attendee.email === userEmail) {
            return { ...attendee, responseStatus: googleResponseStatus };
          }
          return attendee;
        });
        
        // Update the event
        await calendar.events.patch({
          calendarId: 'primary',
          eventId: updatedAttendee.event.googleEventId,
          requestBody: {
            attendees: updatedAttendees
          }
        });
      } catch (error) {
        console.error('Error syncing response status with Google Calendar:', error);
      }
    }

    return updatedAttendee;
  } catch (error) {
    console.error('Error updating event response:', error);
    throw error;
  }
}

/**
 * Updates an attendee's response status in Google Calendar
 */
export async function updateGoogleCalendarAttendance(
  creatorId: string,
  googleEventId: string,
  attendeeEmail: string,
  responseStatus: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE'
) {
  try {
    // Get the calendar client for the event creator
    const calendar = await getCalendarClient(creatorId);
    if (!calendar) {
      console.error('Could not get calendar client for user', creatorId);
      return null;
    }

    // First, get the event to retrieve all attendees
    const eventResponse = await calendar.events.get({
      calendarId: 'primary',
      eventId: googleEventId,
    });

    const event = eventResponse.data;
    if (!event || !event.attendees) {
      console.error('Event not found or has no attendees');
      return null;
    }

    // Map responseStatus to Google Calendar format
    const googleResponseStatus = 
      responseStatus === 'ACCEPTED' ? 'accepted' :
      responseStatus === 'DECLINED' ? 'declined' :
      responseStatus === 'TENTATIVE' ? 'tentative' : 'needsAction';

    // Update the response status for the specific attendee
    const updatedAttendees = event.attendees.map(attendee => {
      if (attendee.email === attendeeEmail) {
        return {
          ...attendee,
          responseStatus: googleResponseStatus
        };
      }
      return attendee;
    });

    // Update the event with the new attendee response
    const updateResponse = await calendar.events.patch({
      calendarId: 'primary',
      eventId: googleEventId,
      requestBody: {
        attendees: updatedAttendees,
      },
    });

    return updateResponse.data;
  } catch (error) {
    console.error('Error updating Google Calendar attendance:', error);
    throw error;
  }
} 