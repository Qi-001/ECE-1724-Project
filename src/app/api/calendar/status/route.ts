import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// GET /api/calendar/status - Check if a user has connected their Google Calendar
export async function GET(request: NextRequest) {
  try {
    // Get the session token from cookies
    //const sessionToken = request.cookies.get('session')?.value;
    const sessionToken = request.cookies.get('better-auth.session_token')?.value.split('.')[0];
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'You must be logged in to check calendar status' },
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

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId') || session.user.id;

    // Ensure users can only check their own status unless explicitly allowed to check others
    if (userId !== session.user.id) {
      // Here you could add additional checks if needed, e.g., group admin permissions
      // For simplicity, we'll just allow checking others' statuses
    }

    // Use try/catch for checking if the GoogleCalendarCredential table exists
    try {
      // Check if a credential exists for this user
      // Using a simpler approach that doesn't require the Prisma model to be available
      const connected = await checkIfCredentialExists(userId);
      
      return NextResponse.json({
        connected,
        expiryDate: null // For simplicity, not returning the expiry date
      });
    } catch (dbError) {
      console.error('Database error:', dbError);
      // If there's an error, assume the user isn't connected
      return NextResponse.json({
        connected: false,
        expiryDate: null
      });
    }
  } catch (error) {
    console.error('Error checking calendar status:', error);
    return NextResponse.json(
      { error: 'Failed to check calendar status' },
      { status: 500 }
    );
  }
}

// Helper function to check if a credential exists for a user
async function checkIfCredentialExists(userId: string): Promise<boolean> {
  try {
    // Attempt to query the database directly
    const result = await prisma.$queryRawUnsafe(
      `SELECT COUNT(*) as count FROM "GoogleCalendarCredential" WHERE "userId" = $1`,
      userId
    ) as Array<{count: string | number}>;
    
    // Handle potential different return types
    if (result && result.length > 0) {
      const count = typeof result[0].count === 'string' 
        ? parseInt(result[0].count, 10)
        : (result[0].count as number);
      
      return count > 0;
    }
    
    return false;
  } catch (error) {
    console.error('Error checking credential existence:', error);
    return false;
  }
} 