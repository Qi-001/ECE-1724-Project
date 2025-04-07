'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/common/Navigation';
import { authClient } from '@/lib/auth-client';
import Link from 'next/link';

interface Document {
  id: string;
  title: string;
  description: string | null;
  cloudStorageUrl: string;
  uploaderId: string;
  groupId: string | null;
  group: {
    id: string;
    name: string;
    members: {
      userId: string;
    }[];
  } | null;
}

interface Comment {
  id: string;
  content: string;
  documentId: string;
  userId: string;
  pageNumber: number | null;
  createdAt: string;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface DocumentPermission {
  userId: string;
  documentId: string;
  role: string;
}

export default function DocumentViewer() {
  const router = useRouter();
  const [documentId, setDocumentId] = useState<string>('');
  const documentContainerRef = useRef<HTMLDivElement>(null);
  
  // Document state
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  
  // User permissions
  const [userPermission, setUserPermission] = useState<DocumentPermission | null>(null);

  // Sidebar state
  const [showPermissions, setShowPermissions] = useState(false);
  
  // Comments state
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [submittingComment, setSubmittingComment] = useState(false);
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editedCommentContent, setEditedCommentContent] = useState('');
  const [showMenuForComment, setShowMenuForComment] = useState<string | null>(null);
  
  // Get document ID from URL safely
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const id = window.location.pathname.split('/').pop() || '';
      if (id) {
        setDocumentId(id);
      }
    }
  }, []);
  
  // Initialize auth and document data
  useEffect(() => {
    const initialize = async () => {
      await checkAuth();
      if (documentId) {
        await fetchDocument();
        await fetchPermissions();
        await fetchComments();
      }
    };
    
    initialize();
  }, [documentId]);

  // Authentication check
  const checkAuth = async () => {
    try {
      const sessionData = await (authClient as any).getSession();
      if (!sessionData?.data) {
        router.push('/auth/signin');
        return;
      }
      setSession(sessionData);
    } catch (error) {
      console.error('Auth error:', error);
      router.push('/auth/signin');
    }
  };

  // Fetch document data
  const fetchDocument = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/documents/${documentId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }
      const data = await response.json();
      setDocument(data);
    } catch (error) {
      console.error('Error fetching document:', error);
      setError('Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  // Fetch user permissions
  const fetchPermissions = async () => {
    if (!session?.data?.user?.id) return;
    
    try {
      const response = await fetch(`/api/documents/${documentId}/permissions`);
      if (response.ok) {
        const data = await response.json();
        // Extract permissions array from the response
        const permissions = data.permissions || [];
        
        // Find current user's permission
        const userPerm = permissions.find(
          (p: DocumentPermission) => p.userId === session.data?.user?.id
        );
        
        if (userPerm) {
          setUserPermission(userPerm);
        } else {
          // If no explicit permission, check if document owner
          if (document?.uploaderId === session.data?.user?.id) {
            setUserPermission({
              userId: session.data?.user?.id,
              documentId,
              role: 'owner'
            });
          } else if (document?.group?.members.some(m => m.userId === session.data?.user?.id)) {
            setUserPermission({
              userId: session.data?.user?.id,
              documentId,
              role: 'viewer'
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching permissions:', error);
    }
  };
  
  // Fetch comments for the document
  const fetchComments = async () => {
    if (!documentId) return;
    
    try {
      const response = await fetch(`/api/documents/${documentId}/comments`);
      if (response.ok) {
        const data = await response.json();
        // Handle both direct array and paginated response formats
        const commentsData = Array.isArray(data) ? data : (data.comments || []);
        setComments(commentsData);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };
  
  // Handle adding new comment
  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim() || !documentId || submittingComment) return;
    
    try {
      setSubmittingComment(true);
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: newComment,
          documentId,
          pageNumber: currentPage
        }),
      });
      
      if (response.ok) {
        const comment = await response.json();
        setComments(prevComments => [comment, ...prevComments]);
        setNewComment('');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
    } finally {
      setSubmittingComment(false);
    }
  };
  
  // Start editing a comment
  const startEditingComment = (comment: Comment) => {
    setEditingCommentId(comment.id);
    setEditedCommentContent(comment.content);
    setShowMenuForComment(null);
  };

  // Cancel editing a comment
  const cancelEditingComment = () => {
    setEditingCommentId(null);
    setEditedCommentContent('');
  };

  // Save edited comment
  const saveEditedComment = async () => {
    if (!editingCommentId || !editedCommentContent.trim()) return;
    
    try {
      const response = await fetch(`/api/comments/${editingCommentId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: editedCommentContent
        }),
      });
      
      if (response.ok) {
        setComments(prevComments => 
          prevComments.map(comment => 
            comment.id === editingCommentId 
              ? { ...comment, content: editedCommentContent } 
              : comment
          )
        );
        setEditingCommentId(null);
        setEditedCommentContent('');
      }
    } catch (error) {
      console.error('Error updating comment:', error);
    }
  };

  // Delete a comment
  const deleteComment = async (commentId: string) => {
    if (!commentId) return;
    
    try {
      const response = await fetch(`/api/comments/${commentId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setComments(prevComments => 
          prevComments.filter(comment => comment.id !== commentId)
        );
        setShowMenuForComment(null);
      }
    } catch (error) {
      console.error('Error deleting comment:', error);
    }
  };

  // Toggle comment menu
  const toggleCommentMenu = (commentId: string) => {
    setShowMenuForComment(prev => prev === commentId ? null : commentId);
  };

  // Check if user can edit/delete comment
  const canManageComment = (comment: Comment) => {
    if (!session?.data?.user?.id) return false;
    return comment.userId === session.data.user.id || userPermission?.role === 'owner';
  };
  
  // Handle page navigation
  const handlePageChange = (newPage: number) => {
    const pageToSet = Math.max(1, newPage);
    setCurrentPage(pageToSet);
  };
  
  // Loading state
  if (loading) {
    return (
      <div>
        <Navigation />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="flex justify-center">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !document) {
    return (
      <div>
        <Navigation />
        <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <div className="text-red-500 text-center">
              {error || 'Document not found'}
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
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              {document.groupId && (
                <Link 
                  href={`/user/groups/${document.groupId}`}
                  className="inline-flex items-center text-gray-600 hover:text-gray-900 mr-3"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
                  </svg>
                  <span className="ml-1">Back to Group</span>
                </Link>
              )}
              <h1 className="text-2xl font-bold text-gray-900">{document.title}</h1>
            </div>
            
            <div className="flex items-center gap-4">
              {document.group && (
                <div className="text-sm text-gray-600">
                  Group: {document.group.name}
                </div>
              )}
                
              <button 
                onClick={() => setShowPermissions(!showPermissions)}
                className="text-sm bg-gray-100 hover:bg-gray-200 px-3 py-1 rounded-md flex items-center gap-1"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                Permissions
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 bg-white rounded-lg shadow overflow-hidden">
              <div className="relative">
                <iframe 
                  src={document.cloudStorageUrl} 
                  className="w-full h-[80vh]" 
                  title={document.title}
                  allow="fullscreen"
                />
                
                {/* Document overlay for collaboration */}
                <div 
                  ref={documentContainerRef}
                  className="absolute inset-0 pointer-events-none"
                >
                  {/* Placeholder for collaboration indicators if needed */}
                </div>
              </div>
              
              {/* Document controls */}
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-t border-gray-200">
                <div>
                  {/* Page navigation removed */}
                </div>
                
                <div>
                  <a 
                    href={document.cloudStorageUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    Download
                  </a>
                </div>
              </div>
            </div>
            
            {/* Side panel for permissions and comments */}
            <div className="space-y-4">
              {showPermissions && (
                <div className="bg-white rounded-lg shadow p-4">
                  <h2 className="text-lg font-medium text-gray-900 mb-4">Permissions</h2>
                  <div className="text-sm text-gray-500">
                    {userPermission ? (
                      <p>Your role: <span className="font-medium">{userPermission.role}</span></p>
                    ) : (
                      <p>Loading permissions...</p>
                    )}
                  </div>
                </div>
              )}
              
              {/* Comments Section */}
              <div className="bg-white rounded-lg shadow p-4">
                <h2 className="text-lg font-medium text-gray-900 mb-4">Comments</h2>
                
                {/* Comment input form */}
                <form onSubmit={handleAddComment} className="mb-6">
                  <div className="relative">
                    <textarea
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Add a comment..."
                      rows={3}
                    />
                    <button 
                      type="submit"
                      disabled={!newComment.trim() || submittingComment}
                      className={`mt-2 px-4 py-2 text-sm font-medium rounded-md text-white ${
                        !newComment.trim() || submittingComment 
                          ? 'bg-blue-300' 
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {submittingComment ? 'Posting...' : 'Post Comment'}
                    </button>
                  </div>
                </form>
                
                {/* Comments list */}
                <div className="space-y-4 max-h-[40vh] overflow-y-auto">
                  {comments.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No comments yet</p>
                  ) : (
                    comments.map((comment) => (
                      <div key={comment.id} className="border-b border-gray-200 pb-4">
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                              {comment.user?.name?.charAt(0) || comment.user?.email?.charAt(0) || '?'}
                            </div>
                          </div>
                          <div className="ml-3 flex-1">
                            <div className="flex justify-between items-start">
                              <p className="text-sm font-medium text-gray-900">
                                {comment.user?.name || comment.user?.email || 'Anonymous'}
                              </p>
                              {canManageComment(comment) && (
                                <div className="relative">
                                  <button 
                                    onClick={() => toggleCommentMenu(comment.id)}
                                    className="text-gray-400 hover:text-gray-600 p-1"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM16 12a2 2 0 100-4 2 2 0 000 4z" />
                                    </svg>
                                  </button>
                                  {showMenuForComment === comment.id && (
                                    <div className="absolute right-0 mt-1 w-40 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                                      <div className="py-1">
                                        <button
                                          onClick={() => startEditingComment(comment)}
                                          className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                        >
                                          Edit
                                        </button>
                                        <button
                                          onClick={() => deleteComment(comment.id)}
                                          className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                                        >
                                          Delete
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            
                            {editingCommentId === comment.id ? (
                              <div className="mt-1">
                                <textarea
                                  value={editedCommentContent}
                                  onChange={(e) => setEditedCommentContent(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                  rows={3}
                                />
                                <div className="flex space-x-2 mt-2">
                                  <button
                                    onClick={saveEditedComment}
                                    disabled={!editedCommentContent.trim()}
                                    className="px-3 py-1 bg-blue-600 text-white text-xs rounded-md hover:bg-blue-700 disabled:bg-blue-300"
                                  >
                                    Save
                                  </button>
                                  <button
                                    onClick={cancelEditingComment}
                                    className="px-3 py-1 border border-gray-300 text-gray-700 text-xs rounded-md hover:bg-gray-50"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(comment.createdAt).toLocaleString()}
                                </p>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}