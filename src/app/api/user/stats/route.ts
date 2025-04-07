import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/user/stats - Get user statistics for dashboard
export async function GET(request: NextRequest) {
  try {
    // Get the session token from cookies
    const sessionToken = request.cookies.get('better-auth.session_token')?.value.split('.')[0];
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'You must be logged in to view your statistics' },
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

    // Fetch all statistics in parallel
    const [
      groupCount,
      documentCount,
      annotationCount,
      upcomingEvents
    ] = await Promise.all([
      // Count of groups user is in
      fetchGroupCount(userId),
      
      // Count of documents user has uploaded
      fetchDocumentCount(userId),
      
      // Count of annotations user has created
      fetchAnnotationCount(userId),
      
      // Count of upcoming events
      fetchUpcomingEventCount(userId)
    ]);

    return NextResponse.json({
      groups: groupCount,
      documents: documentCount,
      annotations: annotationCount,
      events: upcomingEvents
    });
  } catch (error) {
    console.error('Error fetching user statistics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user statistics' },
      { status: 500 }
    );
  }
}

// Helper function to get group count
async function fetchGroupCount(userId: string): Promise<number> {
  try {
    const result = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "GroupMember" WHERE "userId" = $1`,
      userId
    ) as Array<{count: string | number}>;
    
    return parseInt(String(result[0]?.count || '0'), 10);
  } catch (error) {
    console.error('Error counting groups:', error);
    return 0;
  }
}

// Helper function to get document count
async function fetchDocumentCount(userId: string): Promise<number> {
  try {
    const result = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "Document" WHERE "uploaderId" = $1`,
      userId
    ) as Array<{count: string | number}>;
    
    return parseInt(String(result[0]?.count || '0'), 10);
  } catch (error) {
    console.error('Error counting documents:', error);
    return 0;
  }
}

// Helper function to get annotation count
async function fetchAnnotationCount(userId: string): Promise<number> {
  try {
    const result = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "Annotation" WHERE "userId" = $1`,
      userId
    ) as Array<{count: string | number}>;
    
    return parseInt(String(result[0]?.count || '0'), 10);
  } catch (error) {
    console.error('Error counting annotations:', error);
    return 0;
  }
}

// Helper function to get upcoming event count
async function fetchUpcomingEventCount(userId: string): Promise<number> {
  try {
    // First check if calendar table exists
    try {
      // Count upcoming events from group calendar
      const now = new Date();
      const result = await prisma.$queryRawUnsafe(
        `SELECT COUNT(*) as count 
         FROM "EventAttendee" ea
         JOIN "CalendarEvent" ce ON ea."eventId" = ce.id
         WHERE ea."userId" = $1 
         AND ce."startTime" > $2`,
        userId,
        now
      ) as Array<{count: string | number}>;
      
      return parseInt(String(result[0]?.count || '0'), 10);
    } catch (error) {
      // If calendar tables don't exist yet, return 0
      return 0;
    }
  } catch (error) {
    console.error('Error counting upcoming events:', error);
    return 0;
  }
} 