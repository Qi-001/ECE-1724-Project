import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import prisma from '@/lib/prisma';
import crypto from 'crypto';

// Initialize OAuth client
const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// GET /api/calendar/callback - Handle OAuth callback from Google
export async function GET(request: NextRequest) {
  try {
    // Get the code and state from the URL
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle error from Google OAuth
    if (error) {
      console.error('Error returned from Google OAuth:', error);
      return NextResponse.redirect(new URL(`/user/profile?error=${error}`, request.url));
    }
    
    // Handle missing parameters
    if (!code) {
      console.error('Missing code parameter in callback');
      return NextResponse.redirect(new URL('/user/profile?error=missing_code', request.url));
    }
    
    if (!state) {
      console.error('Missing state parameter in callback');
      return NextResponse.redirect(new URL('/user/profile?error=missing_state', request.url));
    }

    // Decode and validate state to get user ID
    let userId: string;
    try {
      const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
      userId = stateData.userId;
      
      if (!userId) {
        throw new Error('No userId in state');
      }
      
      // Check if state is expired (optional, 15-minute window)
      const timestamp = stateData.timestamp;
      if (!timestamp || Date.now() - timestamp > 15 * 60 * 1000) {
        throw new Error('State parameter expired');
      }
    } catch (error) {
      console.error('Invalid state parameter:', error);
      return NextResponse.redirect(new URL('/user/profile?error=invalid_state', request.url));
    }

    // Exchange code for tokens
    let tokens;
    try {
      const response = await oauth2Client.getToken(code);
      tokens = response.tokens;
      
      if (!tokens.access_token) {
        throw new Error('No access token received');
      }
    } catch (error) {
      console.error('Error exchanging code for tokens:', error);
      return NextResponse.redirect(new URL('/user/profile?error=token_exchange', request.url));
    }

    // Check if the user exists
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId }
      });
      
      if (!user) {
        throw new Error('User not found');
      }
    } catch (error) {
      console.error('Error finding user:', error);
      return NextResponse.redirect(new URL('/user/profile?error=user_not_found', request.url));
    }

    // Try to save the credentials to the database - handle case where table doesn't exist
    try {
      await saveCredentials(userId, tokens);
      return NextResponse.redirect(new URL('/user/profile?calendarConnected=true', request.url));
    } catch (dbError: any) {
      console.error('Database error:', dbError);
      
      // If table doesn't exist, try to create it and then save again
      if (dbError.message?.includes('relation "GoogleCalendarCredential" does not exist')) {
        try {
          // Create the table and then try saving again
          await createCredentialTable();
          await saveCredentials(userId, tokens);
          return NextResponse.redirect(new URL('/user/profile?calendarConnected=true', request.url));
        } catch (createError) {
          console.error('Error creating table or saving credentials:', createError);
          return NextResponse.redirect(new URL('/user/profile?error=database_setup', request.url));
        }
      }
      
      return NextResponse.redirect(new URL('/user/profile?error=database_error', request.url));
    }
  } catch (error) {
    console.error('Unhandled error in OAuth callback:', error);
    return NextResponse.redirect(new URL('/user/profile?error=unknown_error', request.url));
  }
}

// Helper function to save credentials
async function saveCredentials(userId: string, tokens: any): Promise<void> {
  const credentialId = crypto.randomUUID();
  const refreshToken = tokens.refresh_token || '';
  const expiryDate = tokens.expiry_date 
    ? new Date(tokens.expiry_date) 
    : new Date(Date.now() + 3600 * 1000);
  const now = new Date();
  
  try {
    // First try to delete any existing credentials
    try {
      await prisma.$executeRawUnsafe(
        'DELETE FROM "GoogleCalendarCredential" WHERE "userId" = $1',
        userId
      );
    } catch (error: any) {
      // Ignore error if table doesn't exist yet
      if (!error.message?.includes('relation "GoogleCalendarCredential" does not exist')) {
        throw error;
      }
    }
    
    // Then insert new credentials
    await prisma.$executeRawUnsafe(
      `INSERT INTO "GoogleCalendarCredential" 
       ("id", "userId", "accessToken", "refreshToken", "expiryDate", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      credentialId,
      userId,
      tokens.access_token,
      refreshToken,
      expiryDate,
      now,
      now
    );
  } catch (error) {
    console.error('Error saving credentials:', error);
    throw error;
  }
}

// Helper function to create the credential table if it doesn't exist
async function createCredentialTable(): Promise<void> {
  try {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS "GoogleCalendarCredential" (
        "id" TEXT NOT NULL,
        "userId" TEXT NOT NULL,
        "accessToken" TEXT NOT NULL,
        "refreshToken" TEXT NOT NULL,
        "expiryDate" TIMESTAMP(3) NOT NULL,
        "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" TIMESTAMP(3) NOT NULL,
        
        CONSTRAINT "GoogleCalendarCredential_pkey" PRIMARY KEY ("id"),
        CONSTRAINT "GoogleCalendarCredential_userId_key" UNIQUE ("userId"),
        CONSTRAINT "GoogleCalendarCredential_userId_fkey" FOREIGN KEY ("userId") 
          REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE
      );
    `);
  } catch (error) {
    console.error('Error creating credential table:', error);
    throw error;
  }
} 