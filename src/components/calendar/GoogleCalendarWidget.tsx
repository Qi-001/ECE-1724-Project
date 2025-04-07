'use client';

import { useEffect, useState } from 'react';

interface GoogleEvent {
  id: string;
  summary: string;
  description?: string;
  location?: string;
  htmlLink: string;
  start: {
    dateTime: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    date?: string;
    timeZone?: string;
  };
  colorId?: string;
}

interface GoogleCalendarWidgetProps {
  userId: string;
}

export default function GoogleCalendarWidget({ userId }: GoogleCalendarWidgetProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [events, setEvents] = useState<GoogleEvent[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCalendarEvents() {
      try {
        setIsLoading(true);
        const statusResponse = await fetch(`/api/calendar/status?userId=${userId}`);
        const statusData = await statusResponse.json();

        if (!statusData.connected) {
          setIsConnected(false);
          return;
        }

        const now = new Date();
        const oneMonthLater = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
        
        const response = await fetch(
          `/api/calendar/events?timeMin=${now.toISOString()}&timeMax=${oneMonthLater.toISOString()}&maxResults=5`
        );

        if (!response.ok) {
          throw new Error('Failed to fetch calendar events');
        }

        const data = await response.json();
        setIsConnected(data.connected);
        setEvents(data.events || []);
      } catch (error) {
        console.error('Error fetching calendar events:', error);
        setError('Could not load calendar events');
      } finally {
        setIsLoading(false);
      }
    }

    if (userId) {
      fetchCalendarEvents();
    }
  }, [userId]);

  const formatEventTime = (event: GoogleEvent) => {
    if (event.start.date) {
      return new Date(event.start.date).toLocaleDateString();
    }

    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);

    if (start.toDateString() === end.toDateString()) {
      return `${start.toLocaleDateString()} ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }

    return `${start.toLocaleDateString()} ${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${end.toLocaleDateString()} ${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  const getEventColor = (colorId?: string) => {
    const colors: Record<string, string> = {
      '1': 'border-blue-500',
      '2': 'border-green-500',
      '3': 'border-purple-500',
      '4': 'border-red-500',
      '5': 'border-yellow-500',
      '6': 'border-orange-500',
      '7': 'border-cyan-500',
      '8': 'border-pink-500',
      '9': 'border-teal-500',
      '10': 'border-indigo-500',
      '11': 'border-amber-500',
    };
    
    return colors[colorId || ''] || 'border-gray-300';
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Your Calendar</h2>
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Your Calendar</h2>
        <div className="py-6 text-center">
          <p className="text-gray-500 mb-4">
            You haven't connected your Google Calendar yet.
          </p>
          <a 
            href="/user/profile"
            className="inline-flex items-center px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19,4H18V2H16V4H8V2H6V4H5A2,2 0 0,0 3,6V20A2,2 0 0,0 5,22H19A2,2 0 0,0 21,20V6A2,2 0 0,0 19,4M19,20H5V10H19V20M19,8H5V6H19V8Z" />
            </svg>
            Connect Calendar
          </a>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Your Calendar</h2>
        <div className="py-4 text-center">
          <p className="text-red-500">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Your Calendar</h2>
        <a 
          href="https://calendar.google.com/" 
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-500 hover:text-blue-700"
        >
          Open Google Calendar
        </a>
      </div>

      {events.length === 0 ? (
        <div className="py-8 text-center text-gray-500">
          <p>No upcoming events found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(event => (
            <a 
              key={event.id}
              href={event.htmlLink}
              target="_blank"
              rel="noopener noreferrer"
              className={`block p-3 rounded-md border-l-4 ${getEventColor(event.colorId)} hover:bg-gray-50`}
            >
              <h3 className="font-medium text-gray-900 truncate">{event.summary}</h3>
              <div className="text-sm text-gray-500">{formatEventTime(event)}</div>
              {event.location && (
                <div className="text-sm text-gray-500 flex items-center mt-1">
                  <svg className="h-3 w-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                  </svg>
                  <span className="truncate">{event.location}</span>
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </div>
  );
} 