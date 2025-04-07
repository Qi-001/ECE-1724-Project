'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/common/Navigation';
import Link from 'next/link';
import { authClient } from '@/lib/auth-client';

interface Document {
  id: string;
  title: string;
  description: string | null;
  cloudStorageUrl: string;
  fileType?: string;
  createdAt: string;
  group: {
    id: string;
    name: string;
  } | null;
  uploader: {
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

export default function DocumentsPage() {
  const router = useRouter();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationData>({
    page: 1,
    limit: 10,
    totalItems: 0,
    totalPages: 1
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
      
      fetchUserDocuments(1);
    } catch (error) {
      console.error('Auth error:', error);
      router.push('/auth/signin');
    }
  };

  const fetchUserDocuments = async (page: number = 1, limit: number = 10) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/user/documents?page=${page}&limit=${limit}`);
      if (!response.ok) {
        throw new Error('Failed to fetch documents');
      }
      const data = await response.json();
      setDocuments(data.documents || data);
      
      // If API returns pagination data, use it. Otherwise fallback to default
      if (data.pagination) {
        setPagination(data.pagination);
      } else if (Array.isArray(data)) {
        // Legacy API returns just an array
        setPagination({
          page: 1,
          limit: data.length,
          totalItems: data.length,
          totalPages: 1
        });
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      setError('Failed to load documents. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchUserDocuments(newPage, pagination.limit);
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const getFileIcon = (fileType?: string): string => {
    if (!fileType) return '📦';
    
    if (fileType.includes('pdf')) return '📄';
    if (fileType.includes('doc')) return '📝';
    if (fileType.includes('image')) return '🖼️';
    if (fileType.includes('video')) return '🎬';
    if (fileType.includes('audio')) return '🎵';
    return '📦';
  };

  const getDocumentUrl = (doc: Document): string => {
    if (doc.group) {
      // If document belongs to a group, navigate to the group's document page
      return `/user/documents/${doc.id}`;
    } else {
      // If document doesn't belong to a group, navigate to the user's document detail page
      return `/user/documents/${doc.id}`;
    }
  };

  return (
    <div>
      <Navigation />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">My Documents</h1>
          </div>

          {isLoading && pagination.page === 1 ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              {error}
            </div>
          ) : documents.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-md p-6 text-center">
              <p className="text-gray-500 mb-4">You haven't uploaded any documents yet.</p>
              <p className="text-gray-500">You can upload documents from within your groups.</p>
            </div>
          ) : (
            <>
              <div className="bg-white shadow overflow-hidden rounded-md">
                <ul className="divide-y divide-gray-200">
                  {documents.map((doc) => (
                    <li key={doc.id}>
                      <Link href={getDocumentUrl(doc)}>
                        <div className="block hover:bg-gray-50">
                          <div className="px-4 py-4 sm:px-6">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center">
                                <span className="text-2xl mr-3">{getFileIcon(doc.fileType)}</span>
                                <p className="text-lg font-medium text-blue-600 truncate">
                                  {doc.title}
                                </p>
                              </div>
                              <div className="ml-2 flex-shrink-0 flex">
                                <p className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                  {doc.fileType ? doc.fileType.split('/')[1]?.toUpperCase() || doc.fileType : 'DOCUMENT'}
                                </p>
                              </div>
                            </div>
                            <div className="mt-2 sm:flex sm:justify-between">
                              <div className="sm:flex">
                                {doc.description && (
                                  <p className="flex items-center text-sm text-gray-500 truncate">
                                    {doc.description.length > 100 
                                      ? `${doc.description.substring(0, 100)}...` 
                                      : doc.description}
                                  </p>
                                )}
                              </div>
                              <div className="mt-2 flex items-center text-sm text-gray-500 sm:mt-0">
                                <p>
                                  Uploaded on {formatDate(doc.createdAt)}
                                </p>
                                {doc.group && (
                                  <p className="ml-2 px-2 py-1 bg-blue-50 rounded-md text-xs text-blue-700">
                                    {doc.group.name}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
              {renderPagination()}
              {isLoading && pagination.page > 1 && (
                <div className="flex justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
} 