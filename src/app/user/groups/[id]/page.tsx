'use client';

import { useState, useEffect } from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter, useParams } from 'next/navigation';
import { uploadGroupFile } from '@/lib/actions';
import Navigation from '@/components/Navigation';
import UserSearchInvite from '@/components/UserSearchInvite';

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

interface Group {
  id: string;
  name: string;
  description: string | null;
  adminId: string;
  members: GroupMember[];
  documents: Document[];
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
      const response = await fetch(`/api/groups/${groupId}`);
      
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
    
    setUploadingFile(true);
    
    try {
      const result = await uploadGroupFile(selectedFile, groupId, session.data.user.id);
      
      if (result.success) {
        // Refresh group to show new file
        fetchGroupDetails();
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
              <h2 className="text-xl font-semibold text-gray-900 mb-2">About this group</h2>
              <p className="text-gray-600">{group.description || 'No description provided'}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left column - Documents */}
            <div className="lg:col-span-2">
              <div className="bg-white shadow rounded-lg overflow-hidden">
                <div className="p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Documents</h2>
                  
                  {/* File upload section */}
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
                  
                  {/* Documents list */}
                  {group.documents.length > 0 ? (
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
                          <span className="text-sm text-gray-500">
                            {new Date(doc.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                    </div>
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
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Members</h2>
                  <div className="divide-y divide-gray-200">
                    {group.members.map((member) => (
                      <div key={member.id} className="py-3 flex justify-between items-center">
                        <div>
                          <p className="font-medium">{member.user.name || 'Unnamed User'}</p>
                          <p className="text-sm text-gray-500">{member.user.email}</p>
                        </div>
                        <span className="px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-800">
                          {member.role}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Invite section - Only visible to admins */}
              {isAdmin && (
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