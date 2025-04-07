'use client';

import { useState, useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createGroup } from '@/lib/actions';
import Navigation from '@/components/common/Navigation';

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

interface PaginationData {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

interface GroupsResponse {
  groups: Group[];
  pagination: PaginationData;
}

export default function Groups() {
  const router = useRouter();
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupDescription, setNewGroupDescription] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 9,
    totalItems: 0,
    totalPages: 1
  });
  const [deletingGroup, setDeletingGroup] = useState<string | null>(null);
  const [showDeleteButtons, setShowDeleteButtons] = useState(false);

  useEffect(() => {
    checkAuth();
    fetchGroups(1);
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

  const fetchGroups = async (page: number = 1, limit: number = 9) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/groups?page=${page}&limit=${limit}`);
      if (!response.ok) {
        throw new Error('Failed to fetch groups');
      }
      const data = await response.json() as GroupsResponse;
      setGroups(data.groups);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching groups:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchGroups(newPage, pagination.limit);
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
        // After creating a group, refresh the first page
        fetchGroups(1, pagination.limit);
        setNewGroupName('');
        setNewGroupDescription('');
        setIsCreatingGroup(false);
      }
    } catch (error) {
      console.error('Error creating group:', error);
      setIsCreatingGroup(false);
    }
  };

  const toggleDeleteButtons = () => {
    setShowDeleteButtons(!showDeleteButtons);
  };

  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`Are you sure you want to delete the group "${groupName}"? This action cannot be undone and will delete all documents and members associated with this group.`)) {
      return;
    }

    setDeletingGroup(groupId);

    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        // Refresh the groups list after deletion
        fetchGroups(
          // If we're on a page with only one group and not the first page,
          // go to the previous page after deletion
          groups.length === 1 && pagination.page > 1 
            ? pagination.page - 1 
            : pagination.page
        );
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete group');
      }
    } catch (error) {
      console.error('Error deleting group:', error);
      alert('Error deleting group');
    } finally {
      setDeletingGroup(null);
    }
  };

  const renderPagination = () => {
    const { page, totalPages } = pagination;
    
    if (totalPages <= 1) return null;
    
    return (
      <div className="flex justify-center mt-6 space-x-2">
        <button
          onClick={() => handlePageChange(page - 1)}
          disabled={page === 1}
          className={`px-3 py-1 rounded-md ${
            page === 1 
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          Previous
        </button>
        
        <div className="flex items-center space-x-1">
          {Array.from({ length: Math.min(5, totalPages) }).map((_, i) => {
            // Show pages around the current page
            let pageToShow;
            if (totalPages <= 5) {
              pageToShow = i + 1;
            } else if (page <= 3) {
              pageToShow = i + 1;
            } else if (page >= totalPages - 2) {
              pageToShow = totalPages - 4 + i;
            } else {
              pageToShow = page - 2 + i;
            }
            
            return (
              <button
                key={pageToShow}
                onClick={() => handlePageChange(pageToShow)}
                className={`px-3 py-1 rounded-md ${
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
          className={`px-3 py-1 rounded-md ${
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

  if (isLoading && pagination.page === 1) {
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
            <div className="flex space-x-3">
              <button
                onClick={toggleDeleteButtons}
                className={`${
                  showDeleteButtons 
                    ? 'bg-gray-600 hover:bg-gray-700' 
                    : 'bg-red-500 hover:bg-red-600'
                } text-white px-4 py-2 rounded-md`}
              >
                {showDeleteButtons ? 'Cancel Delete' : 'Delete Groups'}
              </button>
              <button
                onClick={() => setIsCreatingGroup(true)}
                className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
              >
                Create Group
              </button>
            </div>
          </div>

          {isCreatingGroup && (
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50">
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

          {isLoading && pagination.page > 1 && (
            <div className="flex justify-center my-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group) => {
              const isAdmin = session?.data?.user?.id && 
                group.members.find(m => m.userId === session.data.user.id)?.role === 'ADMIN';
              
              return (
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
                          {isAdmin ? 'Admin' : 'Member'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      {isAdmin && showDeleteButtons && (
                        <button
                          onClick={() => handleDeleteGroup(group.id, group.name)}
                          disabled={deletingGroup === group.id}
                          className="bg-red-500 hover:bg-red-600 text-white px-3 py-2 rounded-md text-sm"
                        >
                          {deletingGroup === group.id ? (
                            <span className="flex items-center">
                              <svg className="animate-spin h-4 w-4 mr-1" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              Deleting
                            </span>
                          ) : (
                            'Delete'
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => router.push(`/user/groups/${group.id}`)}
                        className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md text-sm"
                      >
                        View Group
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
            {groups.length === 0 && !isLoading && (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500">You haven't joined any groups yet.</p>
                <p className="text-gray-500 mt-2">Create a group to get started!</p>
              </div>
            )}
          </div>
          
          {renderPagination()}
        </div>
      </div>
    </div>
  );
} 