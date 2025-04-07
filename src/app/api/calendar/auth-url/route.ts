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

// GET /api/calendar/auth-url - Get Google OAuth URL
export async function GET(request: NextRequest) {
  try {
    console.log('Environment variables check:');
    console.log('GOOGLE_CLIENT_ID set:', !!process.env.GOOGLE_CLIENT_ID);
    console.log('GOOGLE_CLIENT_SECRET set:', !!process.env.GOOGLE_CLIENT_SECRET);
    console.log('GOOGLE_REDIRECT_URI set:', !!process.env.GOOGLE_REDIRECT_URI);
    
    // Verify required environment variables are set
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
      console.error('Missing Google OAuth configuration. Check environment variables.');
      return NextResponse.json(
        { error: 'Google OAuth not properly configured' },
        { status: 500 }
      );
    }
    
    // Get the session token from cookies
    const sessionToken = request.cookies.get('better-auth.session_token')?.value?.split('.')?.[0];
    
    if (!sessionToken) {
      return NextResponse.json(
        { error: 'You must be logged in to connect Google Calendar' },
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

    console.log(`Generating auth URL for user ${session.user.id}`);
    
    // Generate a secure state parameter with the user ID
    const stateObj = {
      userId: session.user.id,
      timestamp: Date.now(),
      nonce: crypto.randomBytes(16).toString('hex') // Add random nonce for security
    };
    
    const state = Buffer.from(JSON.stringify(stateObj)).toString('base64');
    
    // Generate auth URL with the state parameter
    const scopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];
    
    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      state: state,
      prompt: 'consent' // Force to get refresh token
    });
    
    console.log(`Auth URL generated successfully: ${authUrl}`);
    return NextResponse.json({ url: authUrl });
  } catch (error) {
    console.error('Error generating auth URL:', error);
    return NextResponse.json(
      { error: 'Failed to generate authentication URL' },
      { status: 500 }
    );
  }
} 