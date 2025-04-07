import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// POST /api/calendar/disconnect - Disconnect a user's Google Calendar
export async function POST(request: NextRequest) {
  try {
    // Get the session token from cookies
    //const sessionToken = request.cookies.get('session')?.value;
    const sessionToken = request.cookies.get('better-auth.session_token')?.value.split('.')[0];
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'You must be logged in to disconnect your calendar' },
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

    // Use raw SQL to avoid Prisma model issues
    try {
      // First check if the table exists
      try {
        await prisma.$executeRawUnsafe('SELECT COUNT(*) FROM "GoogleCalendarCredential"');
      } catch (tableError) {
        return NextResponse.json(
          { error: 'Calendar functionality is not yet available' },
          { status: 503 }
        );
      }
      
      // Check if user has calendar credentials using a safer approach
      const result = await prisma.$queryRawUnsafe(
        'SELECT COUNT(*) as count FROM "GoogleCalendarCredential" WHERE "userId" = $1',
        userId
      ) as Array<{count: string | number}>;
      
      // Handle different return types safely
      const count = result && result.length > 0 
        ? (typeof result[0].count === 'string' 
            ? parseInt(result[0].count, 10) 
            : (result[0].count as number))
        : 0;
      
      if (count === 0) {
        return NextResponse.json(
          { error: 'No Google Calendar connection found' },
          { status: 404 }
        );
      }
      
      // Delete the credentials with raw SQL
      await prisma.$executeRawUnsafe(
        'DELETE FROM "GoogleCalendarCredential" WHERE "userId" = $1',
        userId
      );

      return NextResponse.json({ success: true });
    } catch (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json(
        { error: 'Database error disconnecting Google Calendar' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error disconnecting Google Calendar:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect Google Calendar' },
      { status: 500 }
    );
  }
} 