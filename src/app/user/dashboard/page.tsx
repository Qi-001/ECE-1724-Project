'use client';

import { authClient } from '@/lib/auth-client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navigation from '@/components/common/Navigation';
import GoogleCalendarWidget from '@/components/calendar/GoogleCalendarWidget';
import PendingEventsWidget from '@/components/PendingEventsWidget';

interface UserStats {
  groups: number;
  documents: number;
  annotations: number;
  events: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState<UserStats>({
    groups: 0,
    documents: 0,
    annotations: 0,
    events: 0
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const session = await (authClient as any).getSession();
      if (!session.data) {
        router.push('/auth/signin');
        return;
      }
      console.log('Session data:', session);
      setSession(session);
      
      // Set auth cookies for API requests
      document.cookie = `next-auth.session-token=${session.data.sessionToken}; path=/; max-age=2592000; SameSite=Lax`;
      
      // Fetch user statistics after auth
      fetchUserStats();
    } catch (error) {
      console.error('Auth error:', error);
      router.push('/auth/signin');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserStats = async () => {
    try {
      const response = await fetch('/api/user/stats', {
        credentials: 'include' // Include cookies with the request
      });
      if (!response.ok) {
        throw new Error('Failed to fetch user statistics');
      }
      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">
            Welcome, {session?.data?.user?.name || session?.data?.user?.email || 'User'}!
          </h1>
          
          <div className="grid grid-cols-1 gap-6 mb-8">
            {/* Calendar Widgets - Only shown if user is authenticated */}
            {session?.data?.user?.id && (
              <>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <GoogleCalendarWidget userId={session.data.user.id} />
                  <PendingEventsWidget userId={session.data.user.id} />
                </div>
              </>
            )}
            
            {/* User Stats */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Your Activity</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-blue-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">{stats.groups}</div>
                  <div className="text-sm text-gray-600">Active Groups</div>
                </div>
                <div className="bg-green-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">{stats.documents}</div>
                  <div className="text-sm text-gray-600">Documents</div>
                </div>
                <div className="bg-purple-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-purple-600">{stats.annotations}</div>
                  <div className="text-sm text-gray-600">Annotations</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-amber-600">{stats.events}</div>
                  <div className="text-sm text-gray-600">Upcoming Events</div>
                </div>
              </div>
            </div>
          </div>
          
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">Quick Access</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Link
              href="/user/groups"
              className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Study Groups</h2>
              <p className="text-gray-600">Create and manage your study groups</p>
            </Link>

            <Link
              href="/user/documents"
              className="block p-6 bg-white rounded-lg shadow hover:shadow-md transition-shadow"
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-2">Documents</h2>
              <p className="text-gray-600">Upload and share study materials</p>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
} 