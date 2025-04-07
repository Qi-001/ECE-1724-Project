'use client';
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import prisma from '@/lib/prisma';
import EventForm from '@/components/EventForm';
import CalendarIntegration from '@/components/calendar/CalendarIntegration';
import { auth } from '@/lib/auth';

// This is a server component that handles creating calendar events
export default async function CreateEventPage() {
  // In this case, we're handling authentication client-side
  // The EventForm and CalendarIntegration components will handle checking authentication
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Create Calendar Event</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2">
          <Suspense fallback={<div className="p-6 bg-white rounded-lg shadow animate-pulse h-96"></div>}>
            <ClientEventForm />
          </Suspense>
        </div>
        
        <div>
          <ClientCalendarIntegration />
          
          <div className="mt-6 p-4 bg-white rounded-lg shadow">
            <h2 className="text-lg font-semibold mb-3">Calendar Integration Help</h2>
            <div className="text-sm text-gray-600 space-y-2">
              <p>
                Connecting your Google Calendar allows your events to automatically appear in your calendar.
              </p>
              <p>
                For group events, all attendees with connected calendars will receive the event on their Google Calendar.
              </p>
              <p>
                You can connect or disconnect your calendar at any time without losing event data.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Client components with authentication handling


import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

function ClientEventForm() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const sessionData = await authClient.getSession();
        if (!sessionData?.data) {
          router.push('/login?callbackUrl=/calendar/create');
          return;
        }
        setSession(sessionData);
      } catch (error) {
        console.error('Auth error:', error);
        router.push('/login?callbackUrl=/calendar/create');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, [router]);

  if (isLoading) {
    return <div className="p-6 bg-white rounded-lg shadow animate-pulse h-96"></div>;
  }

  return session?.data?.user ? <EventForm userId={session.data.user.id} /> : null;
}

function ClientCalendarIntegration() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const sessionData = await authClient.getSession();
        if (!sessionData?.data) {
          return;
        }
        setSession(sessionData);
      } catch (error) {
        console.error('Auth error:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkAuth();
  }, []);

  if (isLoading) {
    return <div className="p-4 border rounded-lg bg-white shadow animate-pulse h-40"></div>;
  }

  return session?.data?.user ? <CalendarIntegration userId={session.data.user.id} /> : null;
} 