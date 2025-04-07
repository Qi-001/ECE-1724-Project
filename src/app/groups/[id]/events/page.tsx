'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
import Link from 'next/link';
import EventForm from '@/components/EventForm';

export default function GroupEvents({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createdEventLink, setCreatedEventLink] = useState<string | null>(null);
  
  const groupId = params.id;
  
  // Get session data
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const sessionData = await authClient.getSession();
        setSession(sessionData);
      } catch (error) {
        console.error('Error fetching session:', error);
        router.push('/login');
      }
    };
    
    fetchSession();
  }, [router]);

  // Fetch group events when session is available
  useEffect(() => {
    if (session?.data?.user?.id) {
      fetchEvents();
    }
  }, [session, groupId]);
  
  const fetchEvents = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/groups/${groupId}/events`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch events');
      }
      
      const data = await response.json();
      setEvents(data);
    } catch (error) {
      console.error('Error fetching events:', error);
      setError('Failed to load events. Please try again later.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCreateEvent = async (eventId: string) => {
    setShowCreateForm(false);
    fetchEvents();
    
    try {
      // Fetch the created event details to get the Google Calendar link
      const response = await fetch(`/api/calendar/events/${eventId}`);
      
      if (response.ok) {
        const data = await response.json();
        if (data.htmlLink) {
          setCreatedEventLink(data.htmlLink);
        }
      }
    } catch (error) {
      console.error('Error fetching event details:', error);
    }
  };
  
  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };
  
  if (loading && !events.length) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold mb-6">Group Events</h1>
        <div className="flex justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Group Events</h1>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors"
        >
          {showCreateForm ? 'Cancel' : 'Create Event'}
        </button>
      </div>
      
      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md mb-6">
          {error}
        </div>
      )}
      
      {createdEventLink && (
        <div className="bg-green-50 text-green-700 p-4 rounded-md mb-6 flex justify-between items-center">
          <div>
            Event created successfully! View it in Google Calendar.
          </div>
          <div className="flex space-x-3">
            <a 
              href={createdEventLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              Open in Google Calendar
            </a>
            <button 
              onClick={() => setCreatedEventLink(null)}
              className="text-gray-600 hover:text-gray-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
      
      {showCreateForm && session?.data?.user?.id && (
        <div className="mb-8">
          <EventForm 
            groupId={groupId} 
            userId={session.data.user.id} 
            onSuccess={handleCreateEvent}
          />
        </div>
      )}
      
      {events.length === 0 ? (
        <div className="bg-white p-6 rounded-lg shadow text-center">
          <p className="text-gray-600">No events have been scheduled for this group yet.</p>
          {!showCreateForm && (
            <button
              onClick={() => setShowCreateForm(true)}
              className="mt-4 text-blue-600 hover:text-blue-800"
            >
              Create the first event
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <div key={event.id} className="bg-white p-4 rounded-lg shadow">
              <h2 className="text-xl font-semibold">{event.title}</h2>
              
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                <div>
                  <p className="text-sm text-gray-600">Start: {formatDateTime(event.startTime)}</p>
                  <p className="text-sm text-gray-600">End: {formatDateTime(event.endTime)}</p>
                </div>
                
                <div>
                  {event.location && (
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Location:</span> {event.location}
                    </p>
                  )}
                  
                  <p className="text-sm text-gray-600">
                    <span className="font-medium">Created by:</span> {event.creator.name || event.creator.email}
                  </p>
                </div>
              </div>
              
              {event.description && (
                <div className="mt-3 text-gray-700">
                  <p>{event.description}</p>
                </div>
              )}
              
              {event.googleEventId && (
                <div className="mt-3">
                  <a 
                    href={`https://calendar.google.com/calendar/event?eid=${encodeURIComponent(event.googleEventId)}`} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm"
                  >
                    View in Google Calendar
                  </a>
                </div>
              )}
              
              <div className="mt-3 border-t pt-3">
                <p className="text-sm font-medium">Attendees ({event.attendees.length}):</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {event.attendees.map((attendee: any) => (
                    <div 
                      key={attendee.userId} 
                      className={`text-xs px-2 py-1 rounded ${
                        attendee.responseStatus === 'ACCEPTED' 
                          ? 'bg-green-100 text-green-800' 
                          : attendee.responseStatus === 'DECLINED'
                          ? 'bg-red-100 text-red-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {attendee.user.name || attendee.user.email}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <div className="mt-8">
        <Link 
          href={`/groups/${groupId}`}
          className="text-blue-600 hover:text-blue-800"
        >
          Back to Group
        </Link>
      </div>
    </div>
  );
} 