'use client';

import { useState, useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter, useParams } from 'next/navigation';
import { uploadGroupFile } from '@/lib/actions';
import Navigation from '@/components/common/Navigation';
import UserSearchInvite from '@/components/UserSearchInvite';
import GroupEventManager from '@/components/groups/GroupEventManager';

interface Document {
  id: string;
  title: string;
  cloudStorageUrl: string;
  createdAt: Date;
}

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

interface PaginationData {
  page: number;
  limit: number;
  totalItems: number;
  totalPages: number;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  adminId: string;
  members: GroupMember[];
  documents: Document[];
  pagination?: {
    documents: PaginationData;
    members: PaginationData;
  }
}

export default function GroupDetail() {
  const router = useRouter();
  const params = useParams();
  const groupId = params.id as string;
  
  const [group, setGroup] = useState<Group | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [session, setSession] = useState<any>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [editingGroup, setEditingGroup] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [updatingGroup, setUpdatingGroup] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDeleteControls, setShowDeleteControls] = useState(false);
  const [showRemoveControls, setShowRemoveControls] = useState(false);
  const [showRoleControls, setShowRoleControls] = useState(false);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [documentsPagination, setDocumentsPagination] = useState({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 1
  });
  const [membersPagination, setMembersPagination] = useState({
    page: 1,
    limit: 10,
    totalItems: 0, 
    totalPages: 1
  });
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    checkAuth();
    fetchGroupDetails();
  }, [groupId]);

  const checkAuth = async () => {
    try {
      const session = await (authClient as any).getSession();
      if (!session.data) {
        router.push('/auth/signin');
        return;
      }
      setSession(session);
    } catch (error) {
      console.error('Auth error:', error);
      router.push('/auth/signin');
    }
  };

  const fetchGroupDetails = async () => {
    if (!groupId) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/groups/${groupId}?docPage=${documentsPagination.page}&docLimit=${documentsPagination.limit}&memberPage=${membersPagination.page}&memberLimit=${membersPagination.limit}`
      );
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('Group not found');
        } else if (response.status === 403) {
          setError('You do not have access to this group');
        } else {
          setError('Failed to load group details');
        }
        return;
      }
      
      const data = await response.json();
      setGroup(data);
      
      // Update pagination states
      if (data.pagination) {
        setDocumentsPagination(data.pagination.documents);
        setMembersPagination(data.pagination.members);
      }
      
      // Check if current user is admin - moved after session check
      const sessionData = await (authClient as any).getSession();
      if (sessionData?.data?.user?.id) {
        const isUserAdmin = data.members.some(
          (member: GroupMember) => 
            member.userId === sessionData.data.user.id && 
            member.role === 'ADMIN'
        );
        setIsAdmin(isUserAdmin);
      }
    } catch (error) {
      console.error('Error fetching group details:', error);
      setError('An error occurred while loading group details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = async () => {
    if (!selectedFile || !session?.data?.user?.id) return;

    if (selectedFile.size > 10 * 1024 * 1024) {
      alert('Failed to upload file larger than 10MB');
      return;
    }
    
    setUploadingFile(true);
    
    try {
      const result = await uploadGroupFile(selectedFile, groupId, session.data.user.id);
      
      if (result.success) {
        // Refresh group to show new file - reset to first page of documents
        setDocumentsPagination(prev => ({ ...prev, page: 1 }));
        fetchGroupWithNewParams(1, documentsPagination.limit, membersPagination.page, membersPagination.limit);
        setSelectedFile(null);
      } else {
        alert('Failed to upload file');
      }
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Error uploading file');
    } finally {
      setUploadingFile(false);
    }
  };

  const navigateToDocument = (documentId: string) => {
    router.push(`/user/documents/${documentId}`);
  };

  const handleEditGroup = () => {
    if (group) {
      setGroupName(group.name);
      setGroupDescription(group.description || '');
      setEditingGroup(true);
    }
  };

  const handleSaveGroup = async () => {
    if (!groupId) return;
    
    setUpdatingGroup(true);
    
    try {
      const response = await fetch(`/api/groups/${groupId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: groupName,
          description: groupDescription || null,
        }),
      });
      
      if (response.ok) {
        // Update local state
        setGroup(prev => {
          if (!prev) return null;
          return {
            ...prev,
            name: groupName,
            description: groupDescription || null,
          };
        });
        setEditingGroup(false);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update group');
      }
    } catch (error) {
      console.error('Error updating group:', error);
      alert('Error updating group');
    } finally {
      setUpdatingGroup(false);
    }
  };

  const handleDeleteFile = async (documentId: string) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    
    setActionLoading(documentId);
    
    try {
      const response = await fetch(`/api/documents/${documentId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // After deletion, refresh the current page
        // If there's only one document on the page and we're not on the first page,
        // go to the previous page
        if (group && group.documents.length === 1 && documentsPagination.page > 1) {
          const newPage = documentsPagination.page - 1;
          setDocumentsPagination(prev => ({ ...prev, page: newPage }));
          fetchGroupWithNewParams(newPage, documentsPagination.limit, membersPagination.page, membersPagination.limit);
        } else {
          // Otherwise, just refresh the current page
          fetchGroupWithNewParams(documentsPagination.page, documentsPagination.limit, membersPagination.page, membersPagination.limit);
        }
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete document');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Error deleting document');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (!confirm(`Are you sure you want to remove ${memberName || 'this member'} from the group?`)) return;
    
    setActionLoading(memberId);
    
    try {
      const response = await fetch(`/api/groups/${groupId}/members/${memberId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        // After removal, refresh the current page
        // If there's only one member on the page and we're not on the first page,
        // go to the previous page
        if (group && group.members.length === 1 && membersPagination.page > 1) {
          const newPage = membersPagination.page - 1;
          setMembersPagination(prev => ({ ...prev, page: newPage }));
          fetchGroupWithNewParams(documentsPagination.page, documentsPagination.limit, newPage, membersPagination.limit);
        } else {
          // Otherwise, just refresh the current page
          fetchGroupWithNewParams(documentsPagination.page, documentsPagination.limit, membersPagination.page, membersPagination.limit);
        }
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Error removing member:', error);
      alert('Error removing member');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDocumentPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= documentsPagination.totalPages) {
      setDocumentsPagination(prev => ({ ...prev, page: newPage }));
      fetchGroupWithNewParams(newPage, documentsPagination.limit, membersPagination.page, membersPagination.limit);
    }
  };

  const handleMemberPageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= membersPagination.totalPages) {
      setMembersPagination(prev => ({ ...prev, page: newPage }));
      fetchGroupWithNewParams(documentsPagination.page, documentsPagination.limit, newPage, membersPagination.limit);
    }
  };

  const fetchGroupWithNewParams = async (docPage: number, docLimit: number, memberPage: number, memberLimit: number) => {
    if (!groupId) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(
        `/api/groups/${groupId}?docPage=${docPage}&docLimit=${docLimit}&memberPage=${memberPage}&memberLimit=${memberLimit}`
      );
      
      if (!response.ok) {
        throw new Error('Failed to load group details');
      }
      
      const data = await response.json();
      setGroup(data);
      
      // Update pagination states
      if (data.pagination) {
        setDocumentsPagination(data.pagination.documents);
        setMembersPagination(data.pagination.members);
      }
    } catch (error) {
      console.error('Error fetching group details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderPagination = (paginationData: PaginationData, onPageChange: (page: number) => void) => {
    const { page, totalPages } = paginationData;
    
    if (totalPages <= 1) return null;
    
    return (
      <div className="flex justify-center mt-4 mb-2 space-x-2">
        <button
          onClick={() => onPageChange(page - 1)}
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
                onClick={() => onPageChange(pageToShow)}
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
          onClick={() => onPageChange(page + 1)}
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

  const handleChangeRole = async (memberId: string, userId: string, currentRole: string) => {
    // Skip if already changing role for this member
    if (actionLoading === memberId) return;
    
    const newRole = currentRole === 'ADMIN' ? 'MEMBER' : 'ADMIN';
    
    try {
      setActionLoading(memberId);
      
      const response = await fetch(`/api/groups/${groupId}/members/${memberId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: newRole
        }),
      });
      
      if (response.ok) {
        const updatedMember = await response.json();
        
        // Update the member in state
        setGroup(prevGroup => {
          if (!prevGroup) return null;
          
          const updatedMembers = prevGroup.members.map(member => 
            member.id === memberId ? updatedMember : member
          );
          
          return {
            ...prevGroup,
            members: updatedMembers
          };
        });
        
        // Show success message
        setActionMessage(`Changed ${updatedMember.user.name || updatedMember.user.email || 'member'}'s role to ${newRole}`);
      } else {
        const errorData = await response.json();
        setActionError(errorData.error || 'Failed to change member role');
      }
    } catch (error) {
      console.error('Error changing member role:', error);
      setActionError('Error changing member role');
    } finally {
      setActionLoading(null);
    }
  };

  if (isLoading) {
    return (
      <div>
        <Navigation />
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
        </div>
      </div>
    );
  }

  if (error || !group) {
    return (
      <div>
        <Navigation />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="bg-white shadow rounded-lg p-6">
            <div className="text-center py-8">
              <h2 className="text-2xl font-bold text-red-600">Error</h2>
              <p className="mt-2 text-gray-600">{error || 'Group not found'}</p>
              <button
                onClick={() => router.push('/user/groups')}
                className="mt-4 bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md"
              >
                Back to Groups
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navigation />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Header with back button */}
          <div className="flex items-center mb-6">
            <button
              onClick={() => router.push('/user/groups')}
              className="mr-4 text-gray-600 hover:text-gray-800"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-3xl font-bold text-gray-900">{group.name}</h1>
          </div>

          {/* Group details card */}
          <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
            <div className="p-6">
              {!editingGroup ? (
                <>
                  <div className="flex justify-between items-center mb-2">
                    <h2 className="text-xl font-semibold text-gray-900">About this group</h2>
                    {isAdmin && (
                      <button
                        onClick={handleEditGroup}
                        className="text-sm text-blue-500 hover:text-blue-700 flex items-center"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        Edit
                      </button>
                    )}
                  </div>
                  <p className="text-gray-600">{group.description || 'No description provided'}</p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Edit Group Details</h2>
                  <div className="space-y-4">
                    <div>
                      <label htmlFor="group-name" className="block text-sm font-medium text-gray-700">
                        Group Name
                      </label>
                      <input
                        type="text"
                        id="group-name"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="group-description" className="block text-sm font-medium text-gray-700">
                        Description
                      </label>
                      <textarea
                        id="group-description"
                        value={groupDescription}
                        onChange={(e) => setGroupDescription(e.target.value)}
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      />
                    </div>
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setEditingGroup(false)}
                        className="px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveGroup}
                        disabled={updatingGroup || !groupName.trim()}
                        className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300"
                      >
                        {updatingGroup ? 'Saving...' : 'Save Changes'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column - Documents */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">Documents</h2>
                    <div className="flex space-x-2">
                      {isAdmin && (
                        <button
                          onClick={() => setShowDeleteControls(!showDeleteControls)}
                          className={`flex items-center text-sm px-3 py-1 rounded ${
                            showDeleteControls ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          }`}
                        >
                          {showDeleteControls ? 'Hide Delete' : 'Delete Files'}
                        </button>
                      )}
                      <button
                        onClick={() => setShowUploadForm(!showUploadForm)}
                        className="flex items-center text-sm bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                      >
                        {showUploadForm ? 'Cancel Upload' : 'Upload Document'}
                        {!showUploadForm && (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  {/* File upload section - only shown when toggle is active */}
                  {showUploadForm && (
                    <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                      <h3 className="text-lg font-medium mb-2">Upload Document</h3>
                      <div className="flex flex-col sm:flex-row items-center gap-2">
                        <input
                          type="file"
                          onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          className="flex-grow"
                        />
                        <button
                          onClick={handleFileUpload}
                          disabled={!selectedFile || uploadingFile}
                          className="w-full sm:w-auto bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md disabled:opacity-50"
                        >
                          {uploadingFile ? 'Uploading...' : 'Upload'}
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Documents list */}
                  {group.documents.length > 0 ? (
                    <>
                      <div className="divide-y divide-gray-200">
                        {group.documents.map((doc) => (
                          <div key={doc.id} className="py-4 flex justify-between items-center">
                            <div className="flex items-center space-x-2">
                              <button 
                                onClick={() => navigateToDocument(doc.id)}
                                className="text-blue-500 hover:underline flex items-center"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                                </svg>
                                {doc.title}
                              </button>
                              <a 
                                href={doc.cloudStorageUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-gray-500 hover:text-gray-700"
                                title="Download"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                                </svg>
                              </a>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-sm text-gray-500">
                                {new Date(doc.createdAt).toLocaleDateString()}
                              </span>
                              {isAdmin && showDeleteControls && (
                                <button
                                  onClick={() => handleDeleteFile(doc.id)}
                                  disabled={actionLoading === doc.id}
                                  className="text-red-500 hover:text-red-700 p-1 flex items-center"
                                  title="Delete document"
                                >
                                  {actionLoading === doc.id ? (
                                    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                  ) : (
                                    <>
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                      Delete
                                    </>
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                      {group && group.pagination && renderPagination(group.pagination.documents, handleDocumentPageChange)}
                    </>
                  ) : (
                    <div className="text-center py-6 text-gray-500">
                      No documents have been uploaded to this group yet.
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Right column - Members and Invitation */}
            <div>
              {/* Members section */}
              <div className="bg-white shadow rounded-lg overflow-hidden mb-6">
                <div className="p-6">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">Members</h2>
                    <div className="flex space-x-2">
                      {isAdmin && (
                        <button
                          onClick={() => setShowRoleControls(!showRoleControls)}
                          className={`flex items-center text-sm px-3 py-1 rounded ${
                            showRoleControls ? 'bg-blue-500 hover:bg-blue-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          }`}
                        >
                          {showRoleControls ? 'Hide Roles' : 'Change Roles'}
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => setShowRemoveControls(!showRemoveControls)}
                          className={`flex items-center text-sm px-3 py-1 rounded ${
                            showRemoveControls ? 'bg-red-500 hover:bg-red-600 text-white' : 'bg-gray-200 hover:bg-gray-300 text-gray-700'
                          }`}
                        >
                          {showRemoveControls ? 'Hide Remove' : 'Remove Members'}
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() => setShowInviteForm(!showInviteForm)}
                          className="flex items-center text-sm bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded"
                        >
                          {showInviteForm ? 'Cancel' : 'Invite Member'}
                          {!showInviteForm && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="divide-y divide-gray-200">
                    {group.members.map((member) => (
                      <div key={member.id} className="py-3 flex justify-between items-center">
                        <div>
                          <p className="font-medium">{member.user.name || 'Unnamed User'}</p>
                          <p className="text-sm text-gray-500">{member.user.email}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                            {member.role}
                          </span>
                          
                          {isAdmin && showRoleControls && member.userId !== session?.data?.user?.id && (
                            <button
                              onClick={() => handleChangeRole(member.id, member.userId, member.role)}
                              disabled={actionLoading === member.id}
                              className="text-blue-500 hover:text-blue-700 p-1 flex items-center"
                              title={`Change role to ${member.role === 'ADMIN' ? 'MEMBER' : 'ADMIN'}`}
                            >
                              {actionLoading === member.id ? (
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                  </svg>
                                  Make {member.role === 'ADMIN' ? 'Member' : 'Admin'}
                                </>
                              )}
                            </button>
                          )}
                          
                          {isAdmin && showRemoveControls && member.userId !== session?.data?.user?.id && (
                            <button
                              onClick={() => handleRemoveMember(member.id, member.user.name || member.user.email || '')}
                              disabled={actionLoading === member.id}
                              className="text-red-500 hover:text-red-700 p-1 flex items-center"
                              title="Remove member"
                            >
                              {actionLoading === member.id ? (
                                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                              ) : (
                                <>
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7a4 4 0 11-8 0 4 4 0 018 0zM9 14a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM21 12h-6" />
                                  </svg>
                                  Remove
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {group && group.pagination && renderPagination(group.pagination.members, handleMemberPageChange)}
                </div>
              </div>

              {/* Group Events & Meetings Section */}
              {group && !isLoading && session?.data?.user?.id && (
                <div className="mt-8">
                  <GroupEventManager 
                    groupId={groupId}
                    members={group.members}
                    isAdmin={isAdmin}
                    userId={session.data.user.id}
                  />
                </div>
              )}

              {/* Invite section - Only visible to admins when toggled */}
              {isAdmin && showInviteForm && (
                <div className="bg-white shadow rounded-lg overflow-hidden">
                  <div className="p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Invite Members</h2>
                    <UserSearchInvite groupId={groupId} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 