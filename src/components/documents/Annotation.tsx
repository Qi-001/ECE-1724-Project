import React, { useState, useEffect, useRef, useCallback } from 'react';
import { authClient } from '@/lib/auth-client';

interface User {
  id: string;
  name?: string;
  email?: string;
}

interface AnnotationProps {
  id: string;
  content: string;
  user: User;
  documentId: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  lastEditedBy: string;
  activeEditors: Record<string, any>;
  editable: boolean;
  onDelete?: (id: string) => void;
  onUpdate?: (id: string, data: { content?: string, x?: number, y?: number, width?: number, height?: number }) => void;
}

const Annotation: React.FC<AnnotationProps> = ({
  id,
  content,
  user,
  documentId,
  pageNumber,
  x,
  y,
  width,
  height,
  lastEditedBy,
  activeEditors,
  editable,
  onDelete,
  onUpdate
}) => {
  const [session, setSession] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState(content);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [dimensions, setDimensions] = useState({ width, height });
  const [position, setPosition] = useState({ x, y });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const localChangesRef = useRef(false);

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

  // Initialize edited content when content prop changes
  useEffect(() => {
    setEditedContent(content);
  }, [content]);

  // Focus management - simplified without socket functionality
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  // Auto-resize textarea based on content
  useEffect(() => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      
      // Initialize ResizeObserver to handle textarea size changes
      resizeObserverRef.current = new ResizeObserver(() => {
        // Update dimensions if textarea size changes
        const newWidth = Math.max(textarea.scrollWidth, 200);
        const newHeight = Math.max(textarea.scrollHeight, 100);
        
        if (newWidth !== dimensions.width || newHeight !== dimensions.height) {
          setDimensions({ width: newWidth, height: newHeight });
          
          // Only update dimensions in parent if they changed significantly
          if (Math.abs(newWidth - width) > 10 || Math.abs(newHeight - height) > 10) {
            onUpdate?.(id, { width: newWidth, height: newHeight });
          }
        }
      });
      
      resizeObserverRef.current.observe(textarea);
    }
    
    return () => {
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
    };
  }, [isEditing, id, width, height, dimensions.width, dimensions.height, onUpdate]);

  // Handler for content changes - debounced
  const handleContentChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setEditedContent(newContent);
    localChangesRef.current = true;
    
    // Debounce updates to the server
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    debounceTimeoutRef.current = setTimeout(() => {
      if (localChangesRef.current) {
        onUpdate?.(id, { content: newContent });
        localChangesRef.current = false;
      }
    }, 800);
  }, [id, onUpdate]);

  // Handle key presses in textarea (e.g., Escape to cancel editing)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditedContent(content); // Revert changes
    }
  }, [content]);

  // Handle deletion with confirmation
  const handleDelete = useCallback(() => {
    if (showDeleteConfirm) {
      onDelete?.(id);
    } else {
      setShowDeleteConfirm(true);
      // Auto-hide delete confirmation after 3 seconds
      setTimeout(() => setShowDeleteConfirm(false), 3000);
    }
  }, [showDeleteConfirm, id, onDelete]);

  // Determine if someone else is editing this annotation
  const isBeingEditedByOthers = Boolean(activeEditors[id]);

  // Check if current user created this annotation
  const isCurrentUserAnnotation = session?.data?.user?.id === user.id;

  // Determine background color based on state
  const getBgColor = () => {
    if (isBeingEditedByOthers) {
      return 'bg-yellow-50';
    }
    if (isEditing) {
      return 'bg-blue-50';
    }
    if (isHovered) {
      return 'bg-gray-50';
    }
    return 'bg-white';
  };

  return (
    <div
      className={`absolute border-l-4 border-blue-500 shadow-lg rounded-md p-3 transition-colors ${getBgColor()}`}
      style={{ 
        top: `${position.y}%`,
        left: `${position.x}%`,
        width: `${dimensions.width}px`,
        height: `${dimensions.height}px`,
        zIndex: isEditing || isHovered ? 10 : 5,
        cursor: editable && !isEditing && !isBeingEditedByOthers ? 'default' : 'default'
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        if (editable && !isBeingEditedByOthers && !isEditing) {
          setIsEditing(true);
          e.stopPropagation();
        }
      }}
    >
      {isEditing ? (
        <div className="flex flex-col h-full">
          <textarea
            ref={textareaRef}
            value={editedContent}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              setIsEditing(false);
            }}
            className="w-full h-full resize-none border-none bg-transparent focus:ring-0 text-sm text-gray-700"
            placeholder="Add your comment here..."
          />
          <div className="flex justify-between mt-2">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsEditing(false);
              }}
              className="px-2 py-1 bg-gray-200 hover:bg-gray-300 rounded text-gray-700"
            >
              Done
            </button>
            {(isCurrentUserAnnotation || editable) && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className={`px-2 py-1 rounded ${
                  showDeleteConfirm 
                    ? 'bg-red-500 text-white hover:bg-red-600' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                {showDeleteConfirm ? 'Confirm Delete' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="text-xs text-gray-500 mb-1 flex justify-between">
            <span>
              {user?.name || user?.email || 'Anonymous'}
            </span>
            <span className="text-xs text-gray-400">
              {lastEditedBy && lastEditedBy !== user?.id && `Edited by ${lastEditedBy}`}
            </span>
          </div>
          
          <div 
            className="text-sm text-gray-700 whitespace-pre-wrap"
            style={{ overflowWrap: 'break-word' }}
          >
            {content || <span className="text-gray-400 italic">Empty annotation</span>}
          </div>
          
          {(isCurrentUserAnnotation || editable) && isHovered && !isBeingEditedByOthers && (
            <div className="absolute top-2 right-2 flex space-x-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                className="p-1 text-gray-500 hover:text-blue-500 bg-white rounded-full shadow-sm"
              >
                <span className="sr-only">Edit</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete();
                }}
                className={`p-1 ${
                  showDeleteConfirm 
                    ? 'text-red-500' 
                    : 'text-gray-500 hover:text-red-500'
                } bg-white rounded-full shadow-sm`}
              >
                <span className="sr-only">Delete</span>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Annotation; 