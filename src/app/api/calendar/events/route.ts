import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import prisma from '@/lib/prisma';

// Initialize OAuth client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// GET /api/calendar/events - Get events from user's Google Calendar
export async function GET(request: NextRequest) {
  try {
    // Get the session token from cookies
    const sessionToken = request.cookies.get('better-auth.session_token')?.value.split('.')[0];
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'You must be logged in to view calendar events' },
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const timeMin = searchParams.get('timeMin') || new Date().toISOString();
    const timeMax = searchParams.get('timeMax') || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // Default to 30 days
    const maxResults = parseInt(searchParams.get('maxResults') || '10', 10);

    // Get Google Calendar credentials
    const credentials = await getCalendarCredentials(userId);
    
    if (!credentials) {
      return NextResponse.json(
        { error: 'Google Calendar not connected', connected: false },
        { status: 404 }
      );
    }
    
    // Set up OAuth client with user's credentials
    oauth2Client.setCredentials({
      access_token: credentials.accessToken,
      refresh_token: credentials.refreshToken,
      expiry_date: credentials.expiryDate.getTime()
    });
    
    // If token is expired, refresh it
    if (credentials.expiryDate.getTime() < Date.now()) {
      try {
        const { credentials: newCredentials } = await oauth2Client.refreshAccessToken();
        
        // Update credentials in database
        await updateCredentials(userId, {
          accessToken: newCredentials.access_token || credentials.accessToken,
          refreshToken: newCredentials.refresh_token || credentials.refreshToken,
          expiryDate: new Date(newCredentials.expiry_date || (Date.now() + 3600 * 1000))
        });
        
        // Update client credentials
        oauth2Client.setCredentials({
          access_token: newCredentials.access_token,
          refresh_token: newCredentials.refresh_token || credentials.refreshToken,
          expiry_date: newCredentials.expiry_date
        });
      } catch (refreshError) {
        console.error('Error refreshing token:', refreshError);
        return NextResponse.json(
          { error: 'Failed to refresh Google Calendar token', connected: false },
          { status: 401 }
        );
      }
    }
    
    // Create Calendar client
    const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
    
    // Get calendar events
    try {
      const response = await calendar.events.list({
        calendarId: 'primary',
        timeMin,
        timeMax,
        maxResults,
        singleEvents: true,
        orderBy: 'startTime',
      });
      
      return NextResponse.json({
        connected: true,
        events: response.data.items
      });
    } catch (apiError) {
      console.error('Error fetching Google Calendar events:', apiError);
      return NextResponse.json(
        { error: 'Failed to fetch Google Calendar events', connected: true, events: [] },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar events' },
      { status: 500 }
    );
  }
}

// Helper function to get calendar credentials
async function getCalendarCredentials(userId: string) {
  try {
    const result = await prisma.$queryRawUnsafe(
      `SELECT * FROM "GoogleCalendarCredential" WHERE "userId" = $1`,
      userId
    ) as Array<{
      id: string;
      userId: string;
      accessToken: string;
      refreshToken: string;
      expiryDate: Date;
      createdAt: Date;
      updatedAt: Date;
    }>;
    
    if (result && result.length > 0) {
      return result[0];
    }
    
    return null;
  } catch (error) {
    console.error('Error getting calendar credentials:', error);
    return null;
  }
}

// Helper function to update credentials
async function updateCredentials(
  userId: string, 
  credentials: { accessToken: string; refreshToken: string; expiryDate: Date }
) {
  try {
    await prisma.$queryRawUnsafe(
      `UPDATE "GoogleCalendarCredential" 
       SET "accessToken" = $1, "refreshToken" = $2, "expiryDate" = $3, "updatedAt" = $4
       WHERE "userId" = $5`,
      credentials.accessToken,
      credentials.refreshToken,
      credentials.expiryDate,
      new Date(),
      userId
    );
  } catch (error) {
    console.error('Error updating credentials:', error);
    throw error;
  }
} 