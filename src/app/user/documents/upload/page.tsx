'use client';

import { useState, FormEvent, useRef, ChangeEvent, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navigation from '@/components/common/Navigation';
import { authClient } from '@/lib/auth-client';

interface Group {
  id: string;
  name: string;
}

export default function UploadDocumentPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroup, setSelectedGroup] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    checkAuth();
    fetchUserGroups();
  }, []);

  const checkAuth = async () => {
    try {
      const session = await (authClient as any).getSession();
      if (!session.data) {
        router.push('/auth/signin');
      }
    } catch (error) {
      console.error('Auth error:', error);
      router.push('/auth/signin');
    }
  };

  const fetchUserGroups = async () => {
    try {
      const response = await fetch('/api/user/groups');
      if (!response.ok) {
        throw new Error('Failed to fetch groups');
      }
      const data = await response.json();
      setGroups(data);
    } catch (error) {
      console.error('Error fetching groups:', error);
    }
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      
      // Auto-fill title with filename (without extension)
      if (!title) {
        const filename = file.name.split('.').slice(0, -1).join('.');
        setTitle(filename);
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    if (!selectedFile) {
      setErrorMessage('Please select a file');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Please provide a title');
      return;
    }

    try {
      setIsUploading(true);
      setErrorMessage('');

      // Create form data
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('title', title);
      formData.append('description', description);
      if (selectedGroup) {
        formData.append('groupId', selectedGroup);
      }

      // Upload document
      const response = await fetch('/api/documents/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload document');
      }

      // Redirect to documents page after successful upload
      router.push('/user/documents');
    } catch (error) {
      console.error('Upload error:', error);
      setErrorMessage(error instanceof Error ? error.message : 'An unknown error occurred');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div>
      <Navigation />
      <div className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">Upload Document</h1>
            <button
              type="button"
              onClick={() => router.push('/user/documents')}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>

          <div className="bg-white shadow rounded-lg p-6">
            <form onSubmit={handleSubmit}>
              {errorMessage && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded">
                  {errorMessage}
                </div>
              )}

              <div className="mb-6">
                <label className="block text-gray-700 text-sm font-medium mb-2">
                  Upload File
                </label>
                <div 
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:bg-gray-50"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {selectedFile ? (
                    <div>
                      <p className="text-sm text-gray-600 mb-1">Selected file:</p>
                      <p className="text-lg font-medium text-gray-800">{selectedFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <svg
                        className="mx-auto h-12 w-12 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        ></path>
                      </svg>
                      <p className="mt-1 text-sm text-gray-600">
                        Click to select a file or drag and drop
                      </p>
                      <p className="text-xs text-gray-500">
                        PDF, DOC, DOCX, JPG, PNG, etc.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="mb-6">
                <label htmlFor="title" className="block text-gray-700 text-sm font-medium mb-2">
                  Title
                </label>
                <input
                  type="text"
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
                  placeholder="Document title"
                  required
                />
              </div>

              <div className="mb-6">
                <label htmlFor="description" className="block text-gray-700 text-sm font-medium mb-2">
                  Description (optional)
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
                  placeholder="Enter a brief description of the document"
                  rows={3}
                />
              </div>

              <div className="mb-6">
                <label htmlFor="group" className="block text-gray-700 text-sm font-medium mb-2">
                  Assign to Group (optional)
                </label>
                <select
                  id="group"
                  value={selectedGroup}
                  onChange={(e) => setSelectedGroup(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring focus:ring-blue-200"
                >
                  <option value="">-- Select a group --</option>
                  {groups.map((group) => (
                    <option key={group.id} value={group.id}>
                      {group.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring focus:ring-blue-200 disabled:opacity-50"
                >
                  {isUploading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Uploading...
                    </span>
                  ) : (
                    'Upload Document'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
} 