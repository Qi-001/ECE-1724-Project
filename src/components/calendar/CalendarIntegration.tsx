'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';

interface CalendarIntegrationProps {
  userId: string;
}

export default function CalendarIntegration({ userId }: CalendarIntegrationProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<any>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    // Check if user was redirected from Google OAuth
    const calendarConnected = searchParams.get('calendarConnected');
    const oauthError = searchParams.get('error');
    
    if (oauthError) {
      let errorMessage = 'Google Calendar connection failed';
      
      // Provide more specific error messages based on the error code
      switch(oauthError) {
        case 'oauth_error':
          errorMessage = 'Google OAuth authentication failed. Please try again.';
          break;
        case 'token_exchange':
          errorMessage = 'Failed to exchange authorization code for access token.';
          break;
        case 'invalid_state':
          errorMessage = 'Invalid OAuth state parameter. Please try again.';
          break;
        case 'user_not_found':
          errorMessage = 'User account not found. Please sign in again.';
          break;
        case 'database_error':
          errorMessage = 'Error storing calendar credentials. Please try again.';
          break;
        default:
          errorMessage = `Google Calendar connection failed: ${oauthError}`;
      }
      
      setError(errorMessage);
      console.warn('OAuth error occurred:', oauthError);
      
      // Remove the error query parameter from the URL to prevent it from persisting
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('error');
      window.history.replaceState({}, '', newUrl);
    }
    
    // Check if calendar was successfully connected
    if (calendarConnected === 'true') {
      // Clean up the URL by removing the query parameter
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('calendarConnected');
      window.history.replaceState({}, '', newUrl);
    }
    
    checkConnectionStatus();
  }, [userId, searchParams, router]);

  const checkConnectionStatus = async () => {
    try {
      setIsLoading(true);
      console.log(`Checking calendar connection status for user ${userId}`);
      const response = await fetch(`/api/calendar/status?userId=${userId}`);
      const data = await response.json();
      
      console.log('Calendar status response:', data);
      setDebugInfo(data);

      if (response.ok) {
        setIsConnected(data.connected);
      } else {
        setError(data.error || 'Failed to check connection status');
      }
    } catch (error) {
      console.error('Error checking calendar connection:', error);
      setError('Failed to check connection status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectCalendar = async () => {
    try {
      setIsLoading(true);
      console.log('Requesting Google Calendar auth URL');
      const response = await fetch('/api/calendar/auth-url');
      const data = await response.json();
      
      console.log('Auth URL response:', data);
      
      if (response.ok && data.url) {
        // Redirect to Google's authorization page
        window.location.href = data.url;
      } else {
        setError(data.error || 'Failed to get authorization URL');
        setIsLoading(false);
      }
    } catch (error) {
      console.error('Error connecting calendar:', error);
      setError('Failed to connect Google Calendar');
      setIsLoading(false);
    }
  };

  const handleDisconnectCalendar = async () => {
    // Confirm before disconnecting
    if (!confirm('Are you sure you want to disconnect your Google Calendar?')) {
      return;
    }
    
    try {
      setIsLoading(true);
      console.log('Disconnecting Google Calendar');
      const response = await fetch('/api/calendar/disconnect', {
        method: 'POST',
      });
      
      const data = await response.json();
      console.log('Disconnect response:', data);
      
      if (response.ok) {
        setIsConnected(false);
      } else {
        setError(data.error || 'Failed to disconnect Google Calendar');
      }
    } catch (error) {
      console.error('Error disconnecting calendar:', error);
      setError('Failed to disconnect Google Calendar');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 border rounded-lg bg-white shadow">
        <div className="flex justify-center py-4">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
        <p className="text-center text-gray-500 mt-2">Checking Google Calendar connection...</p>
      </div>
    );
  }

  return (
    <div className="p-4 border rounded-lg bg-white shadow">
      <h2 className="text-xl font-semibold mb-4">Google Calendar Integration</h2>
      
      {error && (
        <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded">
          {error}
        </div>
      )}

      <div className="mb-4">
        {isConnected ? (
          <div className="flex items-center text-green-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Your Google Calendar is connected</span>
          </div>
        ) : (
          <div className="flex items-center text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>Google Calendar is not connected</span>
          </div>
        )}
      </div>

      <div className="mt-4">
        {isConnected ? (
          <button
            onClick={handleDisconnectCalendar}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Disconnect Google Calendar
          </button>
        ) : (
          <button
            onClick={handleConnectCalendar}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Connect Google Calendar
          </button>
        )}
      </div>
    </div>
  );
} 