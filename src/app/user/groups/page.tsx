'use client';

import { useState, useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createGroup } from '@/lib/actions';
import Navigation from '@/components/Navigation';

interface Group {
  id: string;
  name: string;
  description: string | null;
  adminId: string;
  members: {
    id: string;
    userId: string;
    role: 'ADMIN' | 'MEMBER';
    user: {
      id: string;
    };
  }[];
}

export default function Groups() {
  const router = useRouter();
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<any>(null);

  useEffect(() => {
    checkAuth();
    fetchGroups();
  }, []);

  const checkAuth = async () => {
    try {
      const session = await (authClient as any).getSession();
      if (!session.data) {
        router.push('/auth/signin');
      }
      setSession(session);
    } catch (error) {
      console.error('Auth error:', error);
      router.push('/auth/signin');
    }
  };

  const fetchGroups = async () => {
    try {
      const response = await fetch('/api/groups');
      if (!response.ok) {
        throw new Error('Failed to fetch groups');
      }
      const data = await response.json();
      setGroups(data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreatingGroup(true);

    try {
      if (!session?.data?.user?.id) {
        throw new Error('Not authenticated');
      }
      const result = await createGroup(newGroupName, newGroupDescription, session.data.user.id);
      if (result.success && result.data) {
        setGroups([...groups, result.data as Group]);
        setNewGroupName('');
        setNewGroupDescription('');
        setIsCreatingGroup(false);
      }
    } catch (error) {
      console.error('Error creating group:', error);
      setIsCreatingGroup(false);
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
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900">Study Groups</h1>
            <button
              onClick={() => setIsCreatingGroup(true)}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
            >
              Create Group
            </button>
          </div>

          {isCreatingGroup && (
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
              <div className="bg-white p-6 rounded-lg max-w-md w-full">
                <h2 className="text-xl font-semibold mb-4">Create New Group</h2>
                <form onSubmit={handleCreateGroup}>
                  <div className="mb-4">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                      Group Name
                    </label>
                    <input
                      type="text"
                      id="name"
                      value={newGroupName}
                      onChange={(e) => setNewGroupName(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      required
                    />
                  </div>
                  <div className="mb-4">
                    <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      id="description"
                      value={newGroupDescription}
                      onChange={(e) => setNewGroupDescription(e.target.value)}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      rows={3}
                    />
                  </div>
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={() => setIsCreatingGroup(false)}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600"
                    >
                      Create
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => (
              <div key={group.id} className="p-6 bg-white rounded-lg shadow">
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{group.name}</h3>
                <p className="text-gray-600 mb-4">{group.description || 'No description'}</p>
                <div className="flex justify-between items-center">
                  <div className="flex flex-col space-y-1">
                    <span className="text-sm text-gray-500">
                      {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
                    </span>
                    {session?.data?.user?.id && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 inline-block">
                        {group.members.find(m => m.userId === session.data.user.id)?.role === 'ADMIN' ? 'Admin' : 'Member'}
                      </span>
                    )}
                  </div>
                  <button
                    onClick={() => router.push(`/user/groups/${group.id}`)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm"
                  >
                    View Group
                  </button>
                </div>
              </div>
            ))}
            {groups.length === 0 && (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500">You haven't joined any groups yet.</p>
                <p className="text-gray-500 mt-2">Create a group to get started!</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 