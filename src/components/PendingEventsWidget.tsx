'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';

interface Attendee {
  id: string;
  name: string;
  email: string;
  response: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE' | 'PENDING';
}

interface Group {
  id: string;
  name: string;
}

interface Creator {
  id: string;
  name: string;
  email: string;
}

interface PendingEvent {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  location: string | null;
  creator: Creator;
  attendees: Attendee[];
  group: Group | null;
  googleEventId: string | null;
  googleCalendarLink: string | null;
}

interface PaginationData {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

export default function PendingEventsWidget({ userId }: { userId: string }) {
  const [isLoading, setIsLoading] = useState(true);
  const [pendingEvents, setPendingEvents] = useState<PendingEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isAuthError, setIsAuthError] = useState(false);
  const [respondingToId, setRespondingToId] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 5,
    totalItems: 0,
    totalPages: 1
  });

  useEffect(() => {
    if (userId) {
      fetchPendingEvents(1);
    }
  }, [userId]);

  const fetchPendingEvents = async (page: number = 1, limit: number = 5) => {
    try {
      setIsLoading(true);
      setError(null);
      setIsAuthError(false);
      
      const response = await fetch(`/api/calendar/pending-events?page=${page}&limit=${limit}`, {
        credentials: 'include' // Include cookies with the request
      });
      
      if (response.status === 401) {
        setIsAuthError(true);
        throw new Error('Authentication required. Please sign in again.');
      }
      
      if (!response.ok) {
        throw new Error('Failed to fetch pending events');
      }
      
      const data = await response.json();
      
      // Handle both paginated and non-paginated responses
      if (data.events && data.pagination) {
        setPendingEvents(data.events);
        setPagination(data.pagination);
      } else {
        // Legacy API returns just events array
        setPendingEvents(data.events || []);
        setPagination({
          page: 1,
          limit: (data.events || []).length,
          totalItems: (data.events || []).length,
          totalPages: 1
        });
      }
    } catch (error) {
      console.error('Error fetching pending events:', error);
      setError(error instanceof Error ? error.message : 'Failed to load pending events. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchPendingEvents(newPage, pagination.limit);
    }
  };

  const renderPagination = () => {
    const { page, totalPages } = pagination;
    
    if (totalPages <= 1) return null;
    
    return (
      <div className="flex justify-center mt-4 space-x-2">
        <button
          onClick={() => handlePageChange(page - 1)}
          disabled={page === 1}
          className={`px-2 py-1 text-xs rounded-md ${
            page === 1 
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          Previous
        </button>
        
        <div className="flex items-center space-x-1">
          {Array.from({ length: Math.min(3, totalPages) }).map((_, i) => {
            // Show pages around the current page
            let pageToShow;
            if (totalPages <= 3) {
              pageToShow = i + 1;
            } else if (page <= 2) {
              pageToShow = i + 1;
            } else if (page >= totalPages - 1) {
              pageToShow = totalPages - 2 + i;
            } else {
              pageToShow = page - 1 + i;
            }
            
            return (
              <button
                key={pageToShow}
                onClick={() => handlePageChange(pageToShow)}
                className={`px-2 py-1 text-xs rounded-md ${
                  pageToShow === page 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {pageToShow}
              </button>
            );
          })}
        </div>
        
        <button
          onClick={() => handlePageChange(page + 1)}
          disabled={page === totalPages}
          className={`px-2 py-1 text-xs rounded-md ${
            page === totalPages 
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          Next
        </button>
      </div>
    );
  };

  const formatEventTime = (event: PendingEvent) => {
    const start = new Date(event.startTime);
    const startDisplay = start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const end = new Date(event.endTime);
    const endDisplay = end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    const dayDisplay = start.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    
    return `${dayDisplay}, ${startDisplay} - ${endDisplay}`;
  };

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    return formatDistanceToNow(date, { addSuffix: true });
  };

  // Count attendees who have accepted or are tentative
  const getAttendeeCount = (event: PendingEvent) => {
    if (!event.attendees) return 0;
    return event.attendees.filter(a => a.response === 'ACCEPTED' || a.response === 'TENTATIVE').length;
  };

  // Count total attendees
  const getTotalAttendeeCount = (event: PendingEvent) => {
    return event.attendees?.length || 0;
  };

  const respondToEvent = async (eventId: string, response: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE') => {
    try {
      setRespondingToId(eventId);
      const res = await fetch('/api/calendar/respond', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies with the request
        body: JSON.stringify({
          eventId,
          response,
        }),
      });

      if (res.status === 401) {
        setIsAuthError(true);
        throw new Error('Authentication required. Please sign in again.');
      }

      if (!res.ok) {
        throw new Error('Failed to update response');
      }

      // Refresh the current page after successful response
      await fetchPendingEvents(pagination.page, pagination.limit);
    } catch (error) {
      console.error('Error responding to event:', error);
      setError(error instanceof Error ? error.message : 'Failed to update your response. Please try again.');
    } finally {
      setRespondingToId(null);
    }
  };

  if (isLoading && pagination.page === 1) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Pending Invitations</h2>
        <div className="flex justify-center py-6">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (isAuthError) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Pending Invitations</h2>
        <div className="p-4 rounded-md bg-yellow-50 text-yellow-800">
          <p className="mb-3">You need to sign in to view pending invitations.</p>
          <div className="flex space-x-3">
            <Link 
              href="/auth/signin" 
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              Sign In
            </Link>
            <button
              onClick={() => fetchPendingEvents(1)}
              className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Pending Invitations</h2>
        <div className="p-4 rounded-md bg-red-50 text-red-800">
          <p className="mb-3">{error}</p>
          <button
            onClick={() => fetchPendingEvents(1)}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h2 className="text-xl font-semibold mb-4">Pending Invitations</h2>
      
      {pendingEvents.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <p>You have no pending invitations.</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {pendingEvents.map((event) => (
              <div key={event.id} className="border rounded-lg p-4 hover:bg-gray-50">
                <div className="flex justify-between">
                  <h3 className="font-medium text-lg">{event.title}</h3>
                  {event.googleCalendarLink && (
                    <a 
                      href={event.googleCalendarLink} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      View in Google Calendar
                    </a>
                  )}
                </div>
                
                <p className="text-gray-600 text-sm mt-1">{formatEventTime(event)}</p>
                
                {event.location && (
                  <p className="text-gray-600 text-sm mt-1">
                    <span className="font-medium">Location:</span> {event.location}
                  </p>
                )}
                
                <p className="text-gray-600 text-sm mt-1">
                  <span className="font-medium">Organizer:</span> {event.creator.name || event.creator.email}
                </p>
                
                {event.group && (
                  <p className="text-gray-600 text-sm mt-1">
                    <span className="font-medium">Group:</span> {event.group.name}
                  </p>
                )}

                <p className="text-gray-600 text-sm mt-1">
                  <span className="font-medium">Attendees:</span> {getAttendeeCount(event)} confirmed of {getTotalAttendeeCount(event)} invited
                </p>
                
                {event.description && (
                  <div className="mt-2 text-sm text-gray-700">
                    <div className="line-clamp-2">{event.description}</div>
                  </div>
                )}
                
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    onClick={() => respondToEvent(event.id, 'ACCEPTED')}
                    disabled={respondingToId === event.id}
                    className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 disabled:opacity-50"
                  >
                    {respondingToId === event.id ? 'Updating...' : 'Accept'}
                  </button>
                  
                  <button
                    onClick={() => respondToEvent(event.id, 'TENTATIVE')}
                    disabled={respondingToId === event.id}
                    className="px-3 py-1 bg-yellow-500 text-white text-sm rounded-md hover:bg-yellow-600 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-opacity-50 disabled:opacity-50"
                  >
                    {respondingToId === event.id ? 'Updating...' : 'Maybe'}
                  </button>
                  
                  <button
                    onClick={() => respondToEvent(event.id, 'DECLINED')}
                    disabled={respondingToId === event.id}
                    className="px-3 py-1 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 disabled:opacity-50"
                  >
                    {respondingToId === event.id ? 'Updating...' : 'Decline'}
                  </button>
                </div>
              </div>
            ))}
          </div>
          
          {renderPagination()}
          
          {isLoading && pagination.page > 1 && (
            <div className="flex justify-center py-4 mt-4">
              <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}
        </>
      )}
    </div>
  );
} 