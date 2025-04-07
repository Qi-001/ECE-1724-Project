'use client';

import { useState, useEffect } from 'react';
import { authClient } from '@/lib/auth-client';

interface GroupMember {
  id: string;
  userId: string;
  role: 'ADMIN' | 'MEMBER';
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface Event {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  status: 'CONFIRMED' | 'CANCELLED' | 'TENTATIVE';
  creator: {
    id: string;
    name: string | null;
    email: string | null;
  };
  attendees: {
    id: string;
    userId: string;
    responseStatus: 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'TENTATIVE';
    user: {
      id: string;
      name: string | null;
      email: string | null;
    };
  }[];
}

interface PaginationData {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

interface GroupEventManagerProps {
  groupId: string;
  members: GroupMember[];
  isAdmin: boolean;
  userId: string;
}

export default function GroupEventManager({ groupId, members, isAdmin, userId }: GroupEventManagerProps) {
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showCancelControls, setShowCancelControls] = useState(false);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 5,
    totalItems: 0,
    totalPages: 1
  });
  
  // Form fields
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endDate, setEndDate] = useState('');
  const [endTime, setEndTime] = useState('');
  const [selectedAttendees, setSelectedAttendees] = useState<Record<string, boolean>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch group events with pagination
  useEffect(() => {
    fetchEvents(1);
  }, [groupId]);

  async function fetchEvents(page: number = 1, limit: number = 5) {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/groups/${groupId}/events?page=${page}&limit=${limit}`);
      
      if (response.ok) {
        const data = await response.json();
        
        // Handle both paginated and non-paginated responses
        if (data.events && data.pagination) {
          setEvents(data.events);
          setPagination(data.pagination);
        } else {
          // Legacy API returns just an array
          setEvents(data);
          setPagination({
            page: 1,
            limit: data.length,
            totalItems: data.length,
            totalPages: 1
          });
        }
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch events');
      }
    } catch (error) {
      setError('Error fetching group events');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchEvents(newPage, pagination.limit);
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

  // Handle creating a new event
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title || !startDate || !startTime || !endDate || !endTime) {
      setError('Please fill out all required fields');
      return;
    }
    
    // Convert form values to dates
    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);
    
    // Validate dates
    if (endDateTime <= startDateTime) {
      setError('End time must be after start time');
      return;
    }
    
    // Get selected attendee IDs
    const attendeeIds = Object.entries(selectedAttendees)
      .filter(([_, isSelected]) => isSelected)
      .map(([userId]) => userId);
    
    // Include the creator if not already included
    if (!attendeeIds.includes(userId)) {
      attendeeIds.push(userId);
    }
    
    try {
      setIsSubmitting(true);
      
      const response = await fetch(`/api/groups/${groupId}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title,
          description: description || undefined,
          location: location || undefined,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString(),
          attendeeIds
        }),
      });
      
      if (response.ok) {
        // Reset form and refresh events
        const newEvent = await response.json();
        setEvents(prev => [newEvent, ...prev]);
        
        // Reset form
        setTitle('');
        setDescription('');
        setLocation('');
        setStartDate('');
        setStartTime('');
        setEndDate('');
        setEndTime('');
        setSelectedAttendees({});
        setShowCreateForm(false);
        
        // Refresh the first page to ensure proper order
        fetchEvents(1);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to create event');
      }
    } catch (error) {
      setError('Error creating group event');
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle responding to an event
  const handleEventResponse = async (eventId: string, response: 'ACCEPTED' | 'DECLINED' | 'TENTATIVE') => {
    try {
      const responseObj = await fetch(`/api/calendar/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventId,
          response
        }),
      });
      
      if (responseObj.ok) {
        // Update the local events state to reflect the response change
        setEvents(prevEvents => prevEvents.map(event => {
          if (event.id === eventId) {
            // Find the current user's attendee record and update it
            const updatedAttendees = event.attendees.map(attendee => {
              if (attendee.userId === userId) {
                return { ...attendee, responseStatus: response };
              }
              return attendee;
            });
            
            return { ...event, attendees: updatedAttendees };
          }
          return event;
        }));
      } else {
        const errorData = await responseObj.json();
        setError(errorData.error || 'Failed to update response status');
      }
    } catch (error) {
      setError('Error updating response status');
      console.error(error);
    }
  };

  // Format date for display
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get user's response status for an event
  const getUserResponseStatus = (event: Event) => {
    if (!event.attendees) return 'PENDING';
    const attendee = event.attendees.find(a => a.userId === userId);
    return attendee?.responseStatus || 'PENDING';
  };

  // Count attendees who have accepted or are tentative
  const getConfirmedAttendeeCount = (event: Event) => {
    if (!event.attendees) return 0;
    return event.attendees.filter(a => 
      a.responseStatus === 'ACCEPTED' || a.responseStatus === 'TENTATIVE'
    ).length;
  };

  // Count total attendees
  const getTotalAttendeeCount = (event: Event) => {
    return event.attendees?.length || 0;
  };

  // Initialize form with current date values
  const initializeCreateForm = () => {
    const now = new Date();
    
    // Set default start to next hour
    const startHour = new Date(now.getTime() + 60 * 60 * 1000);
    startHour.setMinutes(0); // Round to the hour
    
    // Set default end to 1 hour after start
    const endHour = new Date(startHour.getTime() + 60 * 60 * 1000);
    
    // Format dates and times
    const formatDate = (date: Date) => date.toISOString().split('T')[0];
    const formatTime = (date: Date) => date.toTimeString().split(' ')[0].substring(0, 5);
    
    setStartDate(formatDate(startHour));
    setStartTime(formatTime(startHour));
    setEndDate(formatDate(endHour));
    setEndTime(formatTime(endHour));
    
    // Initialize all members as selected
    const initialAttendees: Record<string, boolean> = {};
    members.forEach(member => {
      initialAttendees[member.userId] = true;
    });
    setSelectedAttendees(initialAttendees);
    
    setShowCreateForm(true);
  };

  // Add this function with the other event-related functions
  const handleCancelEvent = async (eventId: string) => {
    try {
      const response = await fetch(`/api/groups/${groupId}/events/${eventId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        // Update event status in UI
        setEvents(prevEvents => prevEvents.map(event => 
          event.id === eventId 
            ? { ...event, status: 'CANCELLED' as 'CANCELLED' | 'CONFIRMED' | 'TENTATIVE' } 
            : event
        ));
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to cancel event');
      }
    } catch (error) {
      setError('Error cancelling event');
      console.error(error);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-200">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Group Meetings</h2>
          <div className="flex space-x-2">
            {isAdmin && (
              <button
                onClick={() => setShowCancelControls(!showCancelControls)}
                className={`px-4 py-2 rounded-md ${
                  showCancelControls 
                    ? 'bg-red-500 hover:bg-red-600 text-white' 
                    : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                }`}
              >
                {showCancelControls ? 'Hide Cancel' : 'Cancel Meetings'}
              </button>
            )}
            <button
              onClick={() => showCreateForm ? setShowCreateForm(false) : initializeCreateForm()}
              className={`px-4 py-2 rounded-md ${
                showCreateForm 
                  ? 'bg-gray-200 text-gray-700 hover:bg-gray-300' 
                  : 'bg-blue-500 text-white hover:bg-blue-600'
              }`}
            >
              {showCreateForm ? 'Cancel' : 'Schedule Meeting'}
            </button>
          </div>
        </div>
      </div>
      
      <div className="p-4">
        {error && (
          <div className="bg-red-50 text-red-700 p-3 rounded-md mb-4 text-sm">
            {error}
          </div>
        )}
        
        {showCreateForm && (
          <div className="mb-6 border rounded-md p-4 bg-gray-50">
            <h3 className="text-lg font-medium mb-4">Schedule a Meeting</h3>
            <form onSubmit={handleCreateEvent}>
              <div className="mb-4">
                <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                  Title*
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  required
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                  Location (optional)
                </label>
                <input
                  type="text"
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              
              <div className="mb-4">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description (optional)
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                    Start Date*
                  </label>
                  <input
                    type="date"
                    id="startDate"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="startTime" className="block text-sm font-medium text-gray-700 mb-1">
                    Start Time*
                  </label>
                  <input
                    type="time"
                    id="startTime"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                    End Date*
                  </label>
                  <input
                    type="date"
                    id="endDate"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="endTime" className="block text-sm font-medium text-gray-700 mb-1">
                    End Time*
                  </label>
                  <input
                    type="time"
                    id="endTime"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                    required
                  />
                </div>
              </div>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Attendees
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                  {members.map((member) => (
                    <div key={member.userId} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`attendee-${member.userId}`}
                        checked={selectedAttendees[member.userId] || false}
                        onChange={(e) => setSelectedAttendees({
                          ...selectedAttendees,
                          [member.userId]: e.target.checked
                        })}
                        className="mr-2"
                      />
                      <label htmlFor={`attendee-${member.userId}`} className="text-sm">
                        {member.user.name || member.user.email} {member.userId === userId && '(You)'}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
                >
                  {isSubmitting ? 'Scheduling...' : 'Schedule Meeting'}
                </button>
              </div>
            </form>
          </div>
        )}

        {isLoading && pagination.page === 1 ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No meetings scheduled for this group yet.</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {events.map(event => (
                <div key={event.id} className={`p-3 rounded-md ${
                  event.status === 'CANCELLED' ? 'bg-gray-100 opacity-75' : 'bg-blue-50'
                }`}>
                  <div className="flex justify-between">
                    <h3 className="font-semibold mb-1">
                      {event.title}
                      {event.status === 'CANCELLED' && (
                        <span className="ml-2 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          Cancelled
                        </span>
                      )}
                    </h3>
                    {isAdmin && showCancelControls && event.status !== 'CANCELLED' && (
                      <button
                        onClick={() => handleCancelEvent(event.id)}
                        className="text-red-500 hover:text-red-700 text-xs flex items-center"
                        title="Cancel event"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Cancel
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                      </svg>
                      {formatDate(event.startTime)} - {formatDate(event.endTime)}
                    </span>
                    
                    {event.location && (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                        </svg>
                        {event.location}
                      </span>
                    )}
                    
                    <span className="inline-flex items-center px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                      </svg>
                      {getConfirmedAttendeeCount(event)} confirmed of {getTotalAttendeeCount(event)} invited
                    </span>
                  </div>
                  
                  {event.description && (
                    <p className="text-gray-600 text-sm mb-3">{event.description}</p>
                  )}
                  
                  {/* Response options - only if event is not cancelled */}
                  {event.status !== 'CANCELLED' && (
                    <div className="mt-3 flex items-center">
                      <span className="text-sm mr-3">Your response:</span>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEventResponse(event.id, 'ACCEPTED')}
                          className={`px-3 py-1 text-xs rounded ${
                            getUserResponseStatus(event) === 'ACCEPTED' 
                              ? 'bg-green-500 text-white' 
                              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          }`}
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => handleEventResponse(event.id, 'TENTATIVE')}
                          className={`px-3 py-1 text-xs rounded ${
                            getUserResponseStatus(event) === 'TENTATIVE' 
                              ? 'bg-yellow-500 text-white' 
                              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          }`}
                        >
                          Maybe
                        </button>
                        <button
                          onClick={() => handleEventResponse(event.id, 'DECLINED')}
                          className={`px-3 py-1 text-xs rounded ${
                            getUserResponseStatus(event) === 'DECLINED' 
                              ? 'bg-red-500 text-white' 
                              : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          }`}
                        >
                          Decline
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {renderPagination()}
            {isLoading && pagination.page > 1 && (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 