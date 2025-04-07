'use client';

import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Navigation from '@/components/common/Navigation';
import CalendarIntegration from '@/components/calendar/CalendarIntegration';

export default function Profile() {
  const router = useRouter();
  const [session, setSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [userName, setUserName] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

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
      console.log('Profile session data:', session);
      setSession(session);
      setUserName(session.data.user.name || '');
    } catch (error) {
      console.error('Auth error:', error);
      router.push('/auth/signin');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateLoading(true);
    setUpdateError(null);
    
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: userName.trim()
        }),
      });
      
      if (response.ok) {
        const updatedUser = await response.json();
        setSession((prev: any) => ({
          ...prev,
          data: {
            ...prev.data,
            user: {
              ...prev.data.user,
              name: updatedUser.name
            }
          }
        }));
        setIsEditing(false);
      } else {
        const error = await response.json();
        setUpdateError(error.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      setUpdateError('An unexpected error occurred');
    } finally {
      setUpdateLoading(false);
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
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Your Profile</h1>
          
          <div className="bg-white shadow rounded-lg p-6 mb-6">
            {updateError && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-md text-sm">
                {updateError}
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h2 className="text-xl font-semibold mb-4">Account Information</h2>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-500">Name</p>
                    {isEditing ? (
                      <form onSubmit={handleUpdateProfile} className="mt-1 flex items-center">
                        <input
                          type="text"
                          value={userName}
                          onChange={(e) => setUserName(e.target.value)}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Your name"
                        />
                        <div className="ml-2 flex space-x-2">
                          <button
                            type="submit"
                            disabled={updateLoading}
                            className="px-3 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center"
                          >
                            {updateLoading ? (
                              <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                            ) : 'Save'}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setIsEditing(false);
                              setUserName(session?.data?.user?.name || '');
                            }}
                            className="px-3 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
                          >
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex items-center">
                        <p className="font-medium mr-2">{session?.data?.user?.name || 'Not provided'}</p>
                        <button
                          onClick={() => setIsEditing(true)}
                          className="text-blue-500 hover:text-blue-700 focus:outline-none"
                          title="Edit name"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                      </div>
                    )}
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{session?.data?.user?.email}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Account Created</p>
                    <p className="font-medium">
                      {session?.data?.user?.createdAt 
                        ? new Date(session.data.user.createdAt).toLocaleDateString() 
                        : 'Not available'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div>
                <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
                <div className="space-y-3">
                  <button 
                    onClick={() => router.push('/user/dashboard')}
                    className="w-full flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                    Go to Dashboard
                  </button>
                  <button 
                    onClick={() => router.push('/user/groups')}
                    className="w-full flex items-center px-4 py-2 bg-blue-50 text-blue-700 rounded-md hover:bg-blue-100"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    My Groups
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          {/* Calendar Integration Section */}
          {session?.data?.user?.id && (
            
              
            <CalendarIntegration userId={session.data.user.id} />

          )}
        </div>
      </div>
    </div>
  );
} 