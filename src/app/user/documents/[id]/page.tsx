'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navigation from '@/components/Navigation';
import { authClient } from '@/lib/auth-client';
import { io, Socket } from 'socket.io-client';

interface Annotation {
  id: string;
  content: string;
  documentId: string;
  userId: string;
  pageNumber?: number;
  positionX?: number;
  positionY?: number;
  createdAt: Date;
  user: {
    id: string;
    name: string | null;
    email: string;
  };
  isBeingEdited?: boolean;
}

interface Document {
  id: string;
  title: string;
  cloudStorageUrl: string;
  description: string | null;
  groupId: string | null;
  annotations: Annotation[];
  group: {
    id: string;
    name: string;
    members: {
      userId: string;
    }[];
  } | null;
}

interface TypingUser {
  id: string;
  name: string | null;
  email: string;
  content: string;
  lastTyped: number;
}

export default function DocumentViewer() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [newAnnotation, setNewAnnotation] = useState('');
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<Map<string, TypingUser>>(new Map());
  
  // Location state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [selectedPosition, setSelectedPosition] = useState<{ x: number, y: number } | null>(null);
  const [locationSelectMode, setLocationSelectMode] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  // Socket reference
  const socketRef = useRef<Socket | null>(null);
  
  // Typing debounce timer
  const typingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Add a state for the selected annotation
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<string | null>(null);

  // Add a state for the annotation input
  const [showAnnotationInput, setShowAnnotationInput] = useState(false);
  const [currentAnnotationId, setCurrentAnnotationId] = useState<string | null>(null);
  const annotationInputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    checkAuth();
    fetchDocument();
    
    // Set up Socket.io for real-time annotations
    socketRef.current = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:3001');
    
    socketRef.current.on('connect', () => {
      console.log('Connected to socket server');
      socketRef.current?.emit('joinDocument', documentId);
    });
    
    socketRef.current.on('newAnnotation', (annotation: Annotation) => {
      setAnnotations(prev => [...prev, annotation]);
    });
    
    // Handle users typing in an annotation
    socketRef.current.on('userTyping', (data: { 
      user: { id: string, name: string | null, email: string }, 
      content: string,
      annotationId?: string
    }) => {
      if (data.annotationId) {
        // User is editing an existing annotation
        setAnnotations(prev => 
          prev.map(a => 
            a.id === data.annotationId 
              ? { ...a, content: data.content, isBeingEdited: true } 
              : a
          )
        );
      } else {
        // User is typing a new annotation
        setTypingUsers(prev => {
          const newMap = new Map(prev);
          newMap.set(data.user.id, {
            id: data.user.id,
            name: data.user.name,
            email: data.user.email,
            content: data.content,
            lastTyped: Date.now()
          });
          return newMap;
        });
      }
    });
    
    // Handle annotation updates
    socketRef.current.on('updateAnnotation', (updatedAnnotation: Annotation) => {
      setAnnotations(prev => 
        prev.map(a => a.id === updatedAnnotation.id ? updatedAnnotation : a)
      );
    });
    
    // Clean up typing users
    const typingCleanupInterval = setInterval(() => {
      setTypingUsers(prev => {
        const now = Date.now();
        const newMap = new Map(prev);
        
        for (const [userId, user] of newMap.entries()) {
          if (now - user.lastTyped > 3000) { // 3 seconds
            newMap.delete(userId);
          }
        }
        
        return newMap;
      });
    }, 1000);
    
    return () => {
      socketRef.current?.disconnect();
      clearInterval(typingCleanupInterval);
    };
  }, [documentId]);

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

  const fetchDocument = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/documents/${documentId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch document');
      }
      const data = await response.json();
      setDocument(data);
      setAnnotations(data.annotations || []);
    } catch (error) {
      console.error('Error fetching document:', error);
      setError('Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleAnnotationChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    setNewAnnotation(content);
    
    // Clear any existing timer
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    
    // Send typing notification immediately for real-time collaboration
    if (session?.data?.user && content.trim()) {
      socketRef.current?.emit('userTyping', {
        documentId,
        user: {
          id: session.data.user.id,
          name: session.data.user.name,
          email: session.data.user.email
        },
        content
      });
    }
    
    // Debounced auto-save
    typingTimerRef.current = setTimeout(async () => {
      if (!session?.data?.user?.id || !content.trim()) return;
      
      try {
        const isEditing = !!currentAnnotationId;
        const endpoint = isEditing 
          ? `/api/annotations/${currentAnnotationId}` 
          : '/api/annotations';
        
        const method = isEditing ? 'PUT' : 'POST';
        
        const payload = isEditing 
          ? { content } 
          : {
              content,
              documentId,
              userId: session.data.user.id,
              pageNumber: currentPage,
              positionX: selectedPosition?.x,
              positionY: selectedPosition?.y
            };
        
        const response = await fetch(endpoint, {
          method,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(payload),
        });
        
        if (!response.ok) {
          throw new Error(`Failed to ${isEditing ? 'update' : 'create'} annotation`);
        }
        
        const data = await response.json();
        
        // Update annotations list
        if (isEditing) {
          setAnnotations(prev => prev.map(a => a.id === currentAnnotationId ? data : a));
          socketRef.current?.emit('updateAnnotation', data);
        } else {
          // For new annotations, store the ID for future updates
          setCurrentAnnotationId(data.id);
          setAnnotations(prev => [data, ...prev]);
          socketRef.current?.emit('addAnnotation', data);
        }
        
        console.log(`Annotation ${isEditing ? 'updated' : 'created'} successfully`);
      } catch (error) {
        console.error('Error saving annotation:', error);
      }
    }, 1000); // Auto-save after 1 second of inactivity
  };

  const addAnnotation = async () => {
    if (!newAnnotation.trim() || !session?.data?.user?.id) return;

    try {
      const response = await fetch('/api/annotations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: newAnnotation,
          documentId,
          userId: session.data.user.id,
          pageNumber: currentPage,
          positionX: selectedPosition?.x,
          positionY: selectedPosition?.y
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to add annotation');
      }

      const data = await response.json();
      
      // The socket server will broadcast this to all users
      socketRef.current?.emit('addAnnotation', data);
      
      // Clear the input and location selection
      setNewAnnotation('');
      setLocationSelectMode(false);
      setSelectedPosition(null);
    } catch (error) {
      console.error('Error adding annotation:', error);
    }
  };

  const handleDocumentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!locationSelectMode) return;
    
    // Get the scrollable container
    const container = document.getElementById('scrollable-container');
    if (!container) return;
    
    // Get container position and dimensions
    const rect = container.getBoundingClientRect();
    
    // Calculate position with scroll offset
    const scrollTop = container.scrollTop;
    const scrollLeft = container.scrollLeft;
    
    // Calculate position relative to the visible portion of the document
    const x = (e.clientX - rect.left + scrollLeft) / container.scrollWidth;
    const y = (e.clientY - rect.top + scrollTop) / container.scrollHeight;
    
    console.log('Position selected:', { x, y, page: currentPage });
    
    setSelectedPosition({ x, y });
    
    // Show annotation input at the clicked position
    setCurrentAnnotationId(null); // New annotation, not editing
    setNewAnnotation(''); // Clear any previous text
    setShowAnnotationInput(true);
    
    // Focus the input
    setTimeout(() => {
      if (annotationInputRef.current) {
        annotationInputRef.current.focus();
      }
    }, 50);
  };

  const toggleLocationSelect = () => {
    setLocationSelectMode(!locationSelectMode);
    if (!locationSelectMode) {
      setSelectedPosition(null);
    }
  };

  const formatLocationInfo = (annotation: Annotation) => {
    if (annotation.pageNumber && (annotation.positionX !== undefined || annotation.positionY !== undefined)) {
      return `Page ${annotation.pageNumber}${annotation.positionX !== undefined ? `, position: ${Math.round(annotation.positionX * 100)}%` : ''}`;
    }
    return null;
  };

  const renderAnnotationMarkers = () => {
    if (!annotations || annotations.length === 0) return null;
    
    return annotations
      .filter(annotation => 
        annotation.pageNumber === currentPage && 
        annotation.positionX !== undefined && 
        annotation.positionY !== undefined
      )
      .map(annotation => (
        <div 
          key={annotation.id}
          className={`absolute w-5 h-5 rounded-full -ml-2.5 -mt-2.5 z-10 hover:z-20 hover:scale-110 transition-transform cursor-pointer ${
            selectedAnnotationId === annotation.id ? 'bg-yellow-500 ring-2 ring-yellow-300' : 'bg-blue-500'
          }`}
          style={{ 
            left: `${annotation.positionX! * 100}%`, 
            top: `${annotation.positionY! * 100}%`,
            position: 'absolute'
          }}
          title={`${annotation.user.name || annotation.user.email}: ${annotation.content}`}
          onClick={(e) => {
            e.stopPropagation();
            
            if (annotation.user.id === session?.data?.user?.id) {
              setSelectedAnnotationId(annotation.id);
              setSelectedPosition({ x: annotation.positionX!, y: annotation.positionY! });
              setNewAnnotation(annotation.content);
              setCurrentAnnotationId(annotation.id);
              setShowAnnotationInput(true);
            } else {
              setSelectedAnnotationId(annotation.id);
              const annotationElement = window.document.getElementById(`annotation-${annotation.id}`);
              if (annotationElement) {
                annotationElement.scrollIntoView({ behavior: 'smooth' });
              }
            }
          }}
        >
          <span className="sr-only">Annotation by {annotation.user.name || annotation.user.email}</span>
        </div>
      ));
  };

  // Add a function to handle page navigation and update the UI for page controls
  const handlePageChange = (newPage: number) => {
    // Validate page number to ensure it's positive
    const pageToSet = Math.max(1, newPage);
    setCurrentPage(pageToSet);
    
    // Clear any selected annotation and position
    setSelectedAnnotationId(null);
    if (locationSelectMode) {
      setSelectedPosition(null);
    }
  };

  // Helper function to style annotations being edited
  const isBeingEditedByOthers = (annotation: Annotation) => {
    // Check if this annotation has the isBeingEdited flag and it's not by the current user
    return annotation.isBeingEdited === true && 
      annotation.user.id !== session?.data?.user?.id;
  };

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
            <h1 className="text-2xl font-bold text-gray-900">{document.title}</h1>
            {document.group && (
              <div className="text-sm text-gray-600">
                Group: {document.group.name}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="md:col-span-2 relative">
              <div 
                className="bg-white rounded-lg shadow overflow-hidden relative"
                onClick={handleDocumentClick}
              >
                <iframe 
                  ref={iframeRef}
                  src={document.cloudStorageUrl} 
                  className="w-full h-[80vh]" 
                  title={document.title}
                  allow="fullscreen"
                ></iframe>
                
                {/* Annotation position markers */}
                {renderAnnotationMarkers()}
                
                {/* Transparent overlay - change opacity to almost invisible */}
                {locationSelectMode && (
                  <div className="absolute inset-0 bg-blue-500 bg-opacity-5 pointer-events-none">
                    <div className="absolute top-2 left-2 bg-white py-1 px-3 rounded-full text-sm shadow-md">
                      Click to add annotation
                    </div>
                  </div>
                )}
                
                {/* Annotation input box */}
                {locationSelectMode && selectedPosition && (
                  <div 
                    className="absolute bg-white border-l-4 border-blue-500 shadow-lg rounded-md p-3 z-30"
                    style={{ 
                      left: `${selectedPosition.x * 100}%`, 
                      top: `${selectedPosition.y * 100}%`,
                      transform: 'translate(20px, -50%)',
                      width: '300px',
                      maxWidth: '80%'
                    }}
                    onClick={e => e.stopPropagation()}
                  >
                    <textarea
                      autoFocus
                      value={newAnnotation}
                      onChange={handleAnnotationChange}
                      className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500"
                      rows={3}
                      placeholder="Type your annotation here..."
                    ></textarea>
                    
                    <div className="flex justify-between mt-2">
                      <button
                        onClick={() => {
                          setLocationSelectMode(false);
                          setSelectedPosition(null);
                        }}
                        className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded"
                      >
                        Cancel
                      </button>
                      
                      <button
                        onClick={addAnnotation}
                        disabled={!newAnnotation.trim()}
                        className="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded disabled:opacity-50"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                )}
                
                {selectedPosition && !locationSelectMode && (
                  <div 
                    className="absolute w-6 h-6 bg-blue-500 rounded-full -ml-3 -mt-3 z-10"
                    style={{ 
                      left: `${selectedPosition.x * 100}%`, 
                      top: `${selectedPosition.y * 100}%` 
                    }}
                  ></div>
                )}
              </div>
              
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center">
                  <button 
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="p-1 rounded-md text-gray-500 hover:text-gray-700 disabled:opacity-50"
                    title="Previous page"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                  
                  <div className="flex items-center mx-2">
                    <span className="text-sm text-gray-600 mr-2">Page:</span>
                    <input 
                      type="number" 
                      min="1"
                      value={currentPage}
                      onChange={(e) => handlePageChange(parseInt(e.target.value) || 1)}
                      className="w-16 border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-center"
                    />
                  </div>
                  
                  <button 
                    onClick={() => handlePageChange(currentPage + 1)}
                    className="p-1 rounded-md text-gray-500 hover:text-gray-700"
                    title="Next page"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                
                <div>
                  <button
                    onClick={toggleLocationSelect}
                    className={`text-xs px-3 py-1 rounded-full ${locationSelectMode ? 'bg-blue-500 text-white' : 'bg-gray-200 text-gray-800'}`}
                  >
                    {locationSelectMode ? 'Cancel Location' : 'Add Location Marker'}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4">
              <h2 className="text-lg font-medium mb-4">Annotations</h2>
              
              <div className="mb-4">
                <button
                  onClick={() => {
                    setLocationSelectMode(true);
                    setCurrentAnnotationId(null);
                    setNewAnnotation('');
                  }}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md flex items-center justify-center"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-11a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V7z" clipRule="evenodd" />
                  </svg>
                  Add Annotation
                </button>
              </div>
              
              {/* Real-time typing indicators */}
              {Array.from(typingUsers.values()).length > 0 && (
                <div className="mb-4 border rounded-md overflow-hidden">
                  <div className="bg-gray-50 px-3 py-2 border-b">
                    <h3 className="text-sm font-medium text-gray-700">Real-time activity</h3>
                  </div>
                  <div className="divide-y divide-gray-100">
                    {Array.from(typingUsers.values()).map((user) => (
                      user.id !== session?.data?.user?.id && (
                        <div key={user.id} className="px-3 py-2 flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-medium">
                              {(user.name || user.email).charAt(0).toUpperCase()}
                            </div>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-gray-900 flex items-center">
                              {user.name || user.email}
                              <span className="ml-2 flex">
                                <span className="animate-bounce mx-0.5 bg-gray-500 rounded-full h-1 w-1"></span>
                                <span className="animate-bounce mx-0.5 bg-gray-500 rounded-full h-1 w-1" style={{animationDelay: '0.2s'}}></span>
                                <span className="animate-bounce mx-0.5 bg-gray-500 rounded-full h-1 w-1" style={{animationDelay: '0.4s'}}></span>
                              </span>
                            </div>
                            <div className="mt-1 text-sm text-gray-600 italic">
                              {user.content}
                            </div>
                          </div>
                        </div>
                      )
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4 max-h-[60vh] overflow-y-auto">
                {annotations.length > 0 ? (
                  annotations.map((annotation) => (
                    <div 
                      key={annotation.id} 
                      id={`annotation-${annotation.id}`}
                      className={`border-l-4 pl-3 py-2 bg-gray-50 ${
                        selectedAnnotationId === annotation.id 
                          ? 'border-yellow-500' 
                          : isBeingEditedByOthers(annotation) 
                            ? 'border-purple-500 animate-pulse' 
                            : 'border-blue-500'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div className="text-sm font-medium text-gray-900">
                          {annotation.user.name || annotation.user.email}
                        </div>
                        
                        <div className="flex space-x-2 items-center">
                          {formatLocationInfo(annotation) && (
                            <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                              {formatLocationInfo(annotation)}
                            </span>
                          )}
                          
                          {/* Edit button for the user's own annotations */}
                          {annotation.user.id === session?.data?.user?.id && (
                            <button 
                              onClick={() => {
                                // Toggle edit mode for this annotation
                                if (selectedAnnotationId === annotation.id) {
                                  setSelectedAnnotationId(null);
                                } else {
                                  setSelectedAnnotationId(annotation.id);
                                  setNewAnnotation(annotation.content);
                                }
                              }}
                              className="text-xs text-blue-500 hover:text-blue-700"
                            >
                              {selectedAnnotationId === annotation.id ? 'Cancel' : 'Edit'}
                            </button>
                          )}
                        </div>
                      </div>
                      
                      {/* Show either the content or an edit box */}
                      {selectedAnnotationId === annotation.id && annotation.user.id === session?.data?.user?.id ? (
                        <div className="mt-2">
                          <textarea
                            value={newAnnotation}
                            onChange={(e) => {
                              setNewAnnotation(e.target.value);
                              
                              // Emit typing event for real-time collaboration
                              socketRef.current?.emit('userTyping', {
                                documentId,
                                annotationId: annotation.id,
                                user: {
                                  id: session.data.user.id,
                                  name: session.data.user.name,
                                  email: session.data.user.email
                                },
                                content: e.target.value
                              });
                            }}
                            className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
                            rows={2}
                          />
                          <div className="mt-1 flex justify-end">
                            <button
                              onClick={async () => {
                                // Update the annotation
                                try {
                                  const response = await fetch(`/api/annotations/${annotation.id}`, {
                                    method: 'PUT',
                                    headers: {
                                      'Content-Type': 'application/json',
                                    },
                                    body: JSON.stringify({
                                      content: newAnnotation,
                                    }),
                                  });
                                  
                                  if (response.ok) {
                                    const updated = await response.json();
                                    
                                    // Update in local state
                                    setAnnotations(annotations.map(a => 
                                      a.id === annotation.id ? updated : a
                                    ));
                                    
                                    // Broadcast to other users
                                    socketRef.current?.emit('updateAnnotation', updated);
                                    
                                    // Exit edit mode
                                    setSelectedAnnotationId(null);
                                  }
                                } catch (error) {
                                  console.error('Error updating annotation:', error);
                                }
                              }}
                              className="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="mt-1 text-sm text-gray-600">
                            {annotation.content}
                          </div>
                          <div className="mt-1 text-xs text-gray-500">
                            {new Date(annotation.createdAt).toLocaleString()}
                          </div>
                        </>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 text-center py-4">
                    No annotations yet
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating annotation input */}
      {showAnnotationInput && selectedPosition && (
        <div 
          className="absolute bg-white border-l-4 border-blue-500 shadow-lg rounded-md p-3 w-80 z-20"
          style={{ 
            left: `${selectedPosition.x * 100}%`, 
            top: `${selectedPosition.y * 100}%`,
            transform: 'translate(10px, 10px)',
            maxWidth: '80%'
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="text-sm font-medium text-gray-900 mb-1">
            {currentAnnotationId ? 'Edit annotation' : 'New annotation'}
          </div>
          
          <textarea
            ref={annotationInputRef}
            value={newAnnotation}
            onChange={handleAnnotationChange}
            className="w-full border-gray-300 rounded-md shadow-sm focus:border-blue-500 focus:ring-blue-500 mt-1 text-sm text-gray-600"
            rows={3}
            placeholder="Type your annotation here..."
            autoFocus
          ></textarea>
          
          <div className="flex justify-between mt-2">
            <button
              onClick={() => {
                setShowAnnotationInput(false);
                setLocationSelectMode(false);
                setSelectedPosition(null);
              }}
              className="text-xs px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700"
            >
              Cancel
            </button>
            
            <div className="text-xs text-gray-500 flex items-center">
              <span className="animate-pulse mr-1">●</span>
              Auto-saving
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 