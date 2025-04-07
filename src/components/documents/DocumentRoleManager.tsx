'use client';

import React, { useState, useEffect } from 'react';
import { authClient } from '@/lib/auth-client';

interface User {
  id: string;
  name?: string;
  email?: string;
}

interface Permission {
  id: string;
  userId: string;
  documentId: string;
  role: 'owner' | 'editor' | 'viewer';
  user: User;
}

interface PaginationData {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

interface DocumentRoleManagerProps {
  documentId: string;
  onPermissionsChange?: (permissions: Permission[]) => void;
}

const DocumentRoleManager: React.FC<DocumentRoleManagerProps> = ({ 
  documentId,
  onPermissionsChange
}) => {
  const [session, setSession] = useState<any>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchEmail, setSearchEmail] = useState('');
  const [showUserSearch, setShowUserSearch] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [roleUpdateLoading, setRoleUpdateLoading] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [pendingChanges, setPendingChanges] = useState<Record<string, 'owner' | 'editor' | 'viewer'>>({});
  const [document, setDocument] = useState<any>(null);
  const [permissionsPagination, setPermissionsPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 1
  });

  // Get session data
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const sessionData = await authClient.getSession();
        setSession(sessionData);
      } catch (error) {
        console.error('Error fetching session:', error);
      }
    };
    
    fetchSession();
  }, []);

  // Fetch document permissions
  useEffect(() => {
    fetchPermissions(1);
  }, [documentId, session?.data?.user?.id]);

  const fetchPermissions = async (page: number = 1, limit: number = 10) => {
    if (!documentId || !session?.data?.user?.id) return;
    
    try {
      setLoading(true);
      
      // Fetch permissions with pagination
      const permissionsResponse = await fetch(`/api/documents/${documentId}/permissions?page=${page}&limit=${limit}`);
      
      if (permissionsResponse.ok) {
        const permissionsData = await permissionsResponse.json();
        const permissionsList = permissionsData.permissions || permissionsData;
        setPermissions(permissionsList);
        
        // If API returns pagination data, use it
        if (permissionsData.pagination) {
          setPermissionsPagination(permissionsData.pagination);
        } else if (Array.isArray(permissionsData)) {
          // Legacy API returns just an array
          setPermissionsPagination({
            page: 1,
            limit: permissionsData.length,
            totalItems: permissionsData.length,
            totalPages: 1
          });
        }
        
        // Check if current user is owner
        const isCurrentUserOwner = permissionsList.some(
          (p: Permission) => p.userId === session.data?.user?.id && (p.role === 'owner' || p.id === 'owner')
        );
        setIsOwner(isCurrentUserOwner);
      } else {
        const errorData = await permissionsResponse.json();
        setError(errorData.error || 'Failed to load permissions');
      }
      
      // Fetch document info
      const docResponse = await fetch(`/api/documents/${documentId}`);
      if (docResponse.ok) {
        const docData = await docResponse.json();
        setDocument(docData);
      }
    } catch (err) {
      setError('Error loading data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= permissionsPagination.totalPages) {
      fetchPermissions(newPage, permissionsPagination.limit);
    }
  };

  const renderPagination = () => {
    const { page, totalPages } = permissionsPagination;
    
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

  // Search for users to add
  const handleSearchUsers = async () => {
    if (!searchEmail.trim()) return;
    
    try {
      setSearching(true);
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchEmail)}`);
      
      if (response.ok) {
        const data = await response.json();
        // Filter out users that already have permissions
        const existingUserIds = permissions.map(p => p.userId);
        const filteredResults = data.filter((user: User) => !existingUserIds.includes(user.id));
        setSearchResults(filteredResults);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to search users');
      }
    } catch (err) {
      setError('Error searching users');
      console.error(err);
    } finally {
      setSearching(false);
    }
  };

  // Add a user with viewer role
  const handleAddUser = async (userId: string) => {
    try {
      setRoleUpdateLoading(userId);
      const response = await fetch(`/api/documents/${documentId}/permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetUserId: userId,
          role: 'viewer'
        })
      });
      
      if (response.ok) {
        const newPermission = await response.json();
        const updatedPermissions = [...permissions, newPermission];
        setPermissions(updatedPermissions);
        setSearchResults(prev => prev.filter(user => user.id !== userId));
        onPermissionsChange?.(updatedPermissions);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to add user');
      }
    } catch (err) {
      setError('Error adding user');
      console.error(err);
    } finally {
      setRoleUpdateLoading(null);
    }
  };

  // Handle role change in edit mode
  const handleRoleChange = (userId: string, newRole: 'owner' | 'editor' | 'viewer') => {
    setPendingChanges(prev => ({
      ...prev,
      [userId]: newRole
    }));
  };

  // Update a user's role
  const handleUpdateRole = async (userId: string, newRole: 'owner' | 'editor' | 'viewer') => {
    try {
      setRoleUpdateLoading(userId);
      console.log(`Updating role for user ${userId} to ${newRole}`);
      
      const response = await fetch(`/api/documents/${documentId}/permissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          targetUserId: userId,
          role: newRole
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        const errorMessage = errorData.error || `Failed to update role to ${newRole}`;
        console.error('Role update error:', errorMessage);
        throw new Error(errorMessage);
      }
      
      const updatedPermission = await response.json();
      console.log('Permission updated successfully:', updatedPermission);
      
      // Update permissions in state
      const updatedPermissions = permissions.map(p => 
        p.userId === userId ? updatedPermission : p
      );
      setPermissions(updatedPermissions);
      onPermissionsChange?.(updatedPermissions);
      
      return updatedPermission;
    } catch (err) {
      setError(`Error updating role for user: ${err instanceof Error ? err.message : 'Unknown error'}`);
      console.error('Error updating role:', err);
      throw err;
    } finally {
      setRoleUpdateLoading(null);
    }
  };

  // Remove a user's permission
  const handleRemoveUser = async (userId: string) => {
    try {
      setRoleUpdateLoading(userId);
      const response = await fetch(`/api/documents/${documentId}/permissions?userId=${userId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        const updatedPermissions = permissions.filter(p => p.userId !== userId);
        setPermissions(updatedPermissions);
        setPendingChanges(prev => {
          const updated = { ...prev };
          delete updated[userId];
          return updated;
        });
        onPermissionsChange?.(updatedPermissions);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to remove user');
      }
    } catch (err) {
      setError('Error removing user');
      console.error(err);
    } finally {
      setRoleUpdateLoading(null);
    }
  };

  // Save all pending changes
  const handleSaveChanges = async () => {
    try {
      setError(null);
      console.log('Saving pending changes:', pendingChanges);
      
      // Create an array of promises for all permission updates
      const updatePromises = Object.entries(pendingChanges).map(
        async ([userId, role]) => {
          console.log(`Updating user ${userId} to role ${role}`);
          try {
            return await handleUpdateRole(userId, role);
          } catch (err) {
            console.error(`Error updating permission for user ${userId}:`, err);
            throw err;
          }
        }
      );
      
      // Wait for all permission updates to complete
      const results = await Promise.all(updatePromises);
      console.log('All permission updates completed successfully:', results);
      
      // Only set edit mode to false and clear changes if successful
      setEditMode(false);
      setPendingChanges({});
    } catch (err) {
      setError('Failed to save some permission changes. Please try again.');
      console.error('Permission update error:', err);
    }
  };

  if (loading && permissionsPagination.page === 1) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse flex space-x-4">
          <div className="flex-1 space-y-4 py-1">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="text-lg font-medium">Permissions</h3>
        {isOwner && (
          editMode ? (
            <div className="space-x-2">
              <button
                onClick={handleSaveChanges}
                disabled={Object.keys(pendingChanges).length === 0}
                className={`px-3 py-1 text-sm rounded-md ${
                  Object.keys(pendingChanges).length === 0
                    ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                    : 'bg-blue-500 text-white hover:bg-blue-600'
                }`}
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditMode(false);
                  setPendingChanges({});
                }}
                className="px-3 py-1 text-sm rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="px-3 py-1 text-sm rounded-md bg-blue-500 text-white hover:bg-blue-600"
            >
              Edit Permissions
            </button>
          )
        )}
      </div>
      
      <div className="p-4">
        <h4 className="text-md font-medium mb-2">User Access</h4>
        {permissions.length === 0 ? (
          <p className="text-gray-500 text-sm">No users have been granted access yet.</p>
        ) : (
          <>
            <ul className="space-y-3">
              {permissions.map(permission => (
                <li key={permission.id} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      {permission.user.name ? permission.user.name.charAt(0).toUpperCase() : 
                       permission.user.email ? permission.user.email.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                      <div className="font-medium">{permission.user.name || permission.user.email}</div>
                      <div className="text-xs text-gray-500">{permission.user.email}</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {isOwner && permission.userId !== session?.data?.user?.id ? (
                      editMode ? (
                        <>
                          <select
                            className="text-sm border rounded-md px-2 py-1"
                            value={pendingChanges[permission.userId] || permission.role}
                            onChange={(e) => handleRoleChange(permission.userId, e.target.value as any)}
                          >
                            <option value="viewer">Viewer</option>
                            <option value="editor">Editor</option>
                            <option value="owner">Owner</option>
                          </select>
                          
                          <button
                            className="text-sm text-red-500 hover:text-red-700"
                            onClick={() => handleRemoveUser(permission.userId)}
                            disabled={roleUpdateLoading === permission.userId}
                          >
                            Remove
                          </button>
                        </>
                      ) : (
                        <>
                          <span className="px-2 py-1 text-sm rounded-md bg-gray-100">
                            {permission.role.charAt(0).toUpperCase() + permission.role.slice(1)}
                          </span>
                          
                          {roleUpdateLoading === permission.userId && (
                            <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
                          )}
                        </>
                      )
                    ) : (
                      <span className="px-2 py-1 text-sm rounded-md bg-gray-100">
                        {permission.role.charAt(0).toUpperCase() + permission.role.slice(1)}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {renderPagination()}
            {loading && permissionsPagination.page > 1 && (
              <div className="flex justify-center py-3">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 rounded-full border-t-transparent"></div>
              </div>
            )}
          </>
        )}
        
        {isOwner && (
          <div className="mt-4">
            {!showUserSearch ? (
              <button
                className="px-3 py-2 text-sm rounded-md bg-blue-500 text-white hover:bg-blue-600"
                onClick={() => setShowUserSearch(true)}
              >
                Add User
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="flex-1 px-3 py-2 text-sm border rounded-md"
                    placeholder="Search by email or name"
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearchUsers()}
                  />
                  
                  <button
                    className="px-3 py-2 text-sm rounded-md bg-blue-500 text-white hover:bg-blue-600"
                    onClick={handleSearchUsers}
                    disabled={searching}
                  >
                    {searching ? 'Searching...' : 'Search'}
                  </button>
                  
                  <button
                    className="px-3 py-2 text-sm rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300"
                    onClick={() => {
                      setShowUserSearch(false);
                      setSearchEmail('');
                      setSearchResults([]);
                    }}
                  >
                    Cancel
                  </button>
                </div>
                
                {searchResults.length > 0 ? (
                  <ul className="space-y-2 border rounded-md p-2">
                    {searchResults.map(user => (
                      <li 
                        key={user.id} 
                        className="flex items-center justify-between p-2 hover:bg-gray-50 rounded-md"
                      >
                        <div>
                          <div className="font-medium">{user.name || user.email}</div>
                          <div className="text-xs text-gray-500">{user.email}</div>
                        </div>
                        
                        <button
                          className="px-2 py-1 text-xs rounded-md bg-blue-500 text-white hover:bg-blue-600"
                          onClick={() => handleAddUser(user.id)}
                          disabled={roleUpdateLoading === user.id}
                        >
                          {roleUpdateLoading === user.id ? 'Adding...' : 'Add'}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  searching ? (
                    <p className="text-sm text-gray-500">Searching...</p>
                  ) : searchEmail.trim() ? (
                    <p className="text-sm text-gray-500">No users found</p>
                  ) : null
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentRoleManager; 