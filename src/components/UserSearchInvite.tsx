import { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string | null;
  email: string;
}

interface UserSearchInviteProps {
  groupId: string;
}

export default function UserSearchInvite({ groupId }: UserSearchInviteProps) {
  const [searchEmail, setSearchEmail] = useState('');
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Clear messages when email changes
  useEffect(() => {
    setError(null);
    setSuccess(null);
  }, [searchEmail]);

  const handleSearch = async () => {
    if (!searchEmail || !searchEmail.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setSearching(true);
    setError(null);
    
    try {
      const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchEmail)}`);
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to search for user');
      }
      
      const data = await response.json();
      setSearchResults(data);
      
      if (data.length === 0) {
        setError('No user found with this email address');
      }
    } catch (error: any) {
      setError(error.message || 'Failed to search for user');
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async (userId: string) => {
    setInviting(true);
    setError(null);
    setSuccess(null);
    
    try {
      const response = await fetch('/api/groups/add-member', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId,
          groupId,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to add user to group');
      }
      
      setSuccess(`User successfully added to the group`);
      setSearchEmail('');
      setSearchResults([]);
    } catch (error: any) {
      setError(error.message || 'Failed to add user to group');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="mt-4 border-t pt-4">
      <h4 className="text-lg font-medium mb-2">Add Members</h4>
      <div className="space-y-4">
        <div className="flex items-end gap-2">
          <div className="flex-grow">
            <label htmlFor={`search-email-${groupId}`} className="block text-sm font-medium text-gray-700">
              Search user by email
            </label>
            <input
              type="email"
              id={`search-email-${groupId}`}
              value={searchEmail}
              onChange={(e) => setSearchEmail(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="user@example.com"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchEmail}
            className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}
        
        {searchResults.length > 0 && (
          <div className="mt-2">
            <h5 className="text-sm font-medium text-gray-700 mb-2">Search Results:</h5>
            <ul className="divide-y divide-gray-200 border rounded-md">
              {searchResults.map(user => (
                <li key={user.id} className="flex justify-between items-center p-3">
                  <div>
                    <p className="font-medium">{user.name || 'Unnamed User'}</p>
                    <p className="text-sm text-gray-500">{user.email}</p>
                  </div>
                  <button
                    onClick={() => handleInvite(user.id)}
                    disabled={inviting}
                    className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 text-sm rounded-md disabled:opacity-50"
                  >
                    {inviting ? 'Adding...' : 'Add to Group'}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
} 