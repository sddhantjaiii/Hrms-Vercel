import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPatch, apiDelete } from '../services/api';

const API_ENDPOINTS = {
  userProfile: '/api/user/profile/',
  users: '/api/users/',
  userPermissions: (userId: string) => `/api/users/${userId}/permissions/`,
  deleteAccount: '/api/user/delete-account/'
};

const HRSettings: React.FC = () => {
  const navigate = useNavigate();

  // Get user info from localStorage
  let user = null;
  let email = '';
  try {
    user = JSON.parse(localStorage.getItem('user') || '{}');
    email = user?.email || '';
  } catch {
    // Ignore parsing errors and use defaults
  }

  const [currentUser, setCurrentUser] = useState<{
    id?: number;
    first_name?: string;
    last_name?: string;
    email?: string;
    is_superuser?: boolean;
  } | null>(user);
  const [users, setUsers] = useState<Array<{
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    is_superuser: boolean;
    is_active: boolean;
    is_staff: boolean;
  }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch current user info (in case localStorage is stale)
  useEffect(() => {
    setLoading(true);
    console.log('Fetching current user...');
    apiGet(API_ENDPOINTS.userProfile)
      .then(res => {
        console.log('Current user fetch response:', res);
        if (!res.ok) throw new Error('Failed to fetch current user');
        return res.json();
      })
      .then(data => {
        console.log('Current user data:', data);
        setCurrentUser(data);
      })
      .catch((err) => {
        console.error('Error fetching current user:', err);
        setCurrentUser(user);
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch all users if current user is superuser
  useEffect(() => {
    if (currentUser?.is_superuser) {
      setLoading(true);
      console.log('Fetching all users...');
      apiGet(API_ENDPOINTS.users)
        .then(res => {
          console.log('All users fetch response:', res);
          if (!res.ok) throw new Error('Failed to fetch users');
          return res.json();
        })
        .then(data => {
          console.log('All users data:', data);
          setUsers(data);
        })
        .catch((err) => {
          console.error('Error fetching all users:', err);
          setError('Failed to load users');
        })
        .finally(() => setLoading(false));
    }
  }, [currentUser]);

  const handleLogout = () => {
    localStorage.removeItem('access');
    localStorage.removeItem('refresh');
    localStorage.removeItem('user');
    localStorage.removeItem('tenant');
    localStorage.removeItem('is_superuser');
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to delete your account? This action cannot be undone and will permanently remove all your data.'
    );
    
    if (!confirmed) return;

    const doubleConfirmed = window.confirm(
      'This is your final warning! Deleting your account will permanently remove all your data and cannot be reversed. Type "DELETE" to confirm.'
    );
    
    if (!doubleConfirmed) return;

    try {
      setLoading(true);
      const response = await apiDelete(API_ENDPOINTS.deleteAccount);
      
      if (response.ok) {
        alert('Your account has been successfully deleted.');
        // Clear all local storage and redirect to login
        localStorage.clear();
        navigate('/login');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to delete account');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Generalized handler for toggling user permissions
  const handleTogglePermission = (userId: number, field: string, value: boolean) => {
    if (field === 'is_superuser' && !value && userId === currentUser?.id) {
      alert('You cannot remove your own superuser status.');
      return;
    }
    if (field === 'is_superuser' && !value) {
      if (!window.confirm('Are you sure you want to remove superuser status?')) return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    apiPatch(API_ENDPOINTS.userPermissions(userId.toString()), { [field]: value })
      .then(res => {
        if (!res.ok) throw new Error('Failed to update user');
        return res.json();
      })
      .then(updatedUser => {
        setUsers(users.map(u => u.id === updatedUser.user.id ? updatedUser.user : u));
        setSuccess('User permissions updated successfully!');
        setTimeout(() => setSuccess(null), 2000);
      })
      .catch(() => {
        setError('Failed to update user');
      })
      .finally(() => setLoading(false));
  };

  let username = email ? email.split('@')[0] : '';
  username = username.charAt(0).toUpperCase() + username.slice(1);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div></div>
      </div>
      <div className="bg-white rounded-lg p-8 shadow-sm max-w-lg mx-auto">
        <form className="space-y-6">
          <div>
            <label className="block text-gray-700 mb-1">Email</label>
            <input type="text" value={email} readOnly className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-100" />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Username</label>
            <input type="text" value={username} readOnly className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-100" />
          </div>
        </form>
        <div className="flex flex-col gap-4 mt-8">
          <button
            onClick={() => navigate('/change-password')}
                className="bg-teal-600 text-white px-6 py-2 rounded hover:bg-teal-700 transition-colors"
          >
            Change Password
          </button>
          <button
            onClick={handleDeleteAccount}
            className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 transition-colors"
          >
            Delete Account
          </button>
          <button
            onClick={handleLogout}
            className="bg-gray-600 text-white px-6 py-2 rounded hover:bg-gray-700 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
      {/* Superuser User Management Section */}
      {currentUser?.is_superuser && (
        <div className="bg-white rounded-lg p-8 shadow-sm max-w-3xl mx-auto mt-8">
          <h2 className="text-xl font-bold mb-4">User Management</h2>
          {success && <div className="text-teal-600 mb-2">{success}</div>}
          {loading ? (
            <div>Loading users...</div>
          ) : (
            <>
              <table className="min-w-full border">
                <thead>
                  <tr>
                    <th className="px-4 py-2 border">Email</th>
                    <th className="px-4 py-2 border">Active</th>
                    <th className="px-4 py-2 border">Staff</th>
                    <th className="px-4 py-2 border">Superuser</th>
                    <th className="px-4 py-2 border">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td className="px-4 py-2 border">{user.email}</td>
                      <td className="px-4 py-2 border">
                        <input
                          type="checkbox"
                          checked={user.is_active}
                          disabled={user.id === currentUser?.id}
                          onChange={e => handleTogglePermission(user.id, 'is_active', e.target.checked)}
                        />
                      </td>
                      <td className="px-4 py-2 border">
                        <input
                          type="checkbox"
                          checked={user.is_staff}
                          disabled={user.id === currentUser?.id}
                          onChange={e => handleTogglePermission(user.id, 'is_staff', e.target.checked)}
                        />
                      </td>
                      <td className="px-4 py-2 border">
                        <input
                          type="checkbox"
                          checked={user.is_superuser}
                          disabled={user.id === currentUser?.id}
                          onChange={e => handleTogglePermission(user.id, 'is_superuser', e.target.checked)}
                        />
                      </td>
                      <td className="px-4 py-2 border">
                        {user.id === currentUser?.id && (
                          <span className="text-xs text-gray-500 ml-2">(You)</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {error && <div className="text-red-500 mt-2">{error}</div>}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default HRSettings; 