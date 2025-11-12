/**
 * ROAR Admin Console
 * Modern admin interface for managing users, API tokens, ad placements, scrapers, cache, and audit logs
 * 
 * Features:
 * - Secure authentication with session management
 * - Role-based access control (super_admin, admin, moderator)
 * - Real-time dashboard statistics
 * - User management with CRUD operations
 * - API token generation and management
 * - Ad placement management
 * - Scraper status monitoring
 * - Cache management and statistics
 * - Comprehensive audit logging
 * 
 * @component
 * @author Looqta Development Team
 * @version 1.0.0
 */
'use client';
import { useState, useEffect } from 'react';

// Use proxy route - works behind reverse proxy and avoids CORS issues
// The proxy route runs server-side in Next.js and forwards requests to backend
const API_BASE = '/api/proxy/roar';

export default function RoarAdmin() {
  // Authentication state
  const [authenticated, setAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [error, setError] = useState(null);

  /**
   * Check authentication status on component mount
   * Validates existing session token and retrieves user information
   */
  useEffect(() => {
    checkAuth();
  }, []);

  /**
   * Authenticate user by checking session token
   * @async
   * @function checkAuth
   * @returns {Promise<void>}
   */
  const checkAuth = async () => {
    try {
      // Cookies are sent automatically with credentials: 'include'
      // HTTP-only cookies can't be read by JavaScript, so we don't try
      const response = await fetch(`${API_BASE}/auth/me`, {
        credentials: 'include',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.user) {
          setUser(data.user);
          setAuthenticated(true);
        } else {
          setAuthenticated(false);
        }
      } else {
        setAuthenticated(false);
      }
    } catch (error) {
      console.error('Authentication check failed:', error);
      setAuthenticated(false);
    } finally {
      setLoading(false);
    }
  };


  // Loading state with modern spinner
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-purple-50/30 flex items-center justify-center relative overflow-hidden">
        {/* Animated Background Elements */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300/30 rounded-full mix-blend-multiply blur-3xl animate-pulse"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300/30 rounded-full mix-blend-multiply blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>
        
        <div className="text-center relative z-10">
          {/* Modern spinner */}
          <div className="relative mb-6 mx-auto w-20 h-20">
            <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin [animation-direction:reverse] [animation-duration:0.8s]"></div>
            </div>
          </div>
          <p className="text-gray-700 font-bold text-lg">Loading ROAR Admin...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginForm onLogin={checkAuth} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-purple-50/30 relative overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300/30 rounded-full mix-blend-multiply blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300/30 rounded-full mix-blend-multiply blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-300/20 rounded-full mix-blend-multiply blur-3xl animate-pulse" style={{ animationDelay: '2s' }}></div>
      </div>
      
      <AdminLayout user={user} activeTab={activeTab} setActiveTab={setActiveTab} onLogout={checkAuth}>
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'users' && <UserManagement />}
        {activeTab === 'tokens' && <TokenManagement />}
        {activeTab === 'ads' && <AdManagement />}
        {activeTab === 'scrapers' && <ScraperManagement />}
        {activeTab === 'cache' && <CacheManagement />}
        {activeTab === 'audit' && <AuditLog />}
      </AdminLayout>
    </div>
  );
}

/**
 * Login Form Component
 * Handles user authentication with modern UI matching main application
 * 
 * @param {Function} onLogin - Callback function called after successful login
 */
function LoginForm({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  /**
   * Handle login form submission
   * @param {Event} e - Form submit event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (data.success) {
        onLogin();
      } else {
        setError(data.error || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300/30 rounded-full mix-blend-multiply blur-3xl animate-pulse"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300/30 rounded-full mix-blend-multiply blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <div className="w-full max-w-md bg-white/70 backdrop-blur-xl rounded-3xl border border-white/30 shadow-2xl p-8 relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">ROAR</h1>
          <p className="text-gray-600 font-semibold text-lg">Admin Console</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
              required
              autoFocus
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
              required
              placeholder="Enter password"
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl shadow-lg">
              <p className="text-sm text-red-700 font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] duration-200"
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Logging in...</span>
              </>
            ) : (
              <span>Login</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

/**
 * Admin Layout Component
 * Main layout wrapper with sidebar navigation and user info
 * 
 * @param {Object} user - Current authenticated user object
 * @param {string} activeTab - Currently active tab ID
 * @param {Function} setActiveTab - Function to change active tab
 * @param {Function} onLogout - Callback function called after logout
 * @param {ReactNode} children - Child components to render in main content area
 */
function AdminLayout({ user, activeTab, setActiveTab, onLogout, children }) {
  /**
   * Handle user logout
   * Clears session on server and triggers logout callback
   */
  const handleLogout = async () => {
    try {
      // Cookies are sent automatically with credentials: 'include'
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      onLogout();
    } catch (error) {
      console.error('Logout error:', error);
      // Still call onLogout to clear local state even if server call fails
      onLogout();
    }
  };


  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: '📊' },
    { id: 'users', label: 'Users', icon: '👥' },
    { id: 'tokens', label: 'API Tokens', icon: '🔑' },
    { id: 'ads', label: 'Ad Placements', icon: '📢' },
    { id: 'scrapers', label: 'Scrapers', icon: '🕷️' },
    { id: 'cache', label: 'Cache', icon: '💾' },
    { id: 'audit', label: 'Audit Log', icon: '📝' }
  ];

  return (
    <div className="flex h-screen relative z-10">
      {/* Sidebar Navigation */}
      <div className="w-64 bg-white/70 backdrop-blur-xl border-r border-white/30 shadow-2xl relative flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200/50 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
          <h1 className="text-3xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-1">ROAR</h1>
          <p className="text-xs text-gray-600 font-semibold uppercase tracking-wider">Admin Console</p>
        </div>

        {/* Navigation Tabs */}
        <nav className="p-4 space-y-2 flex-1 overflow-y-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg'
                  : 'text-gray-700 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 hover:shadow-md'
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="font-bold">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* User Info & Logout - Fixed at bottom */}
        <div className="p-4 border-t border-gray-200/50 bg-gradient-to-r from-slate-50/90 to-blue-50/90">
          <div className="mb-3">
            <p className="font-bold text-gray-800">{user?.username}</p>
            <p className="text-xs text-gray-600 capitalize font-semibold">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] duration-200"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 bg-gray-50/30">
        <div className="max-w-7xl mx-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

/**
 * Dashboard Component
 * Displays system statistics and overview metrics
 * 
 * @component
 */
function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  /**
   * Fetch dashboard statistics on component mount
   */
  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Cookies are sent automatically with credentials: 'include'
        const response = await fetch(`${API_BASE}/stats`, {
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json'
          }
        });
        
        const data = await response.json();
        if (data.success) {
          setStats(data.stats);
        } else {
          setError(data.error || 'Failed to load statistics');
        }
      } catch (err) {
        console.error('Failed to fetch dashboard stats:', err);
        setError('Failed to load statistics');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, []);

  // Loading state
  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="relative mb-6 mx-auto w-16 h-16">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin [animation-direction:reverse] [animation-duration:0.8s]"></div>
          </div>
        </div>
        <p className="text-gray-600 font-semibold">Loading dashboard statistics...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="text-center py-16">
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border-2 border-red-200 p-8 max-w-md mx-auto shadow-lg">
          <p className="text-red-600 font-bold">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">Dashboard</h2>
        <p className="text-gray-600 font-semibold">System overview and statistics</p>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
        {stats && Object.entries(stats).map(([key, value]) => {
          const formattedKey = key.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase());
          return (
            <div 
              key={key} 
              className="bg-white/70 backdrop-blur-xl rounded-2xl shadow-lg p-6 border border-gray-200/50 hover:shadow-xl hover:scale-[1.02] transition-all duration-200"
            >
              <p className="text-sm text-gray-600 mb-3 font-semibold uppercase tracking-wide">{formattedKey}</p>
              <p className="text-3xl lg:text-4xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">{typeof value === 'number' ? value.toLocaleString() : value}</p>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {(!stats || Object.keys(stats).length === 0) && (
        <div className="text-center py-16">
          <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 p-8 max-w-md mx-auto shadow-lg">
            <p className="text-gray-600 font-semibold">No statistics available</p>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * User Management Component
 * Manages admin users with CRUD operations
 * 
 * @component
 */
function UserManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState(null);

  /**
   * Load users list on component mount
   */
  useEffect(() => {
    loadUsers();
  }, []);

  /**
   * Fetch users from API
   * @async
   */
  const loadUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      // Cookies are sent automatically with credentials: 'include'
      const res = await fetch(`${API_BASE}/users`, {
        credentials: 'include',
        headers: { 
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (data.success) {
        setUsers(data.users || []);
      } else {
        setError(data.error || 'Failed to load users');
      }
    } catch (error) {
      console.error('Failed to load users:', error);
      setError('Failed to load users. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">User Management</h2>
          <p className="text-gray-600 font-semibold">Manage admin users and permissions</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] duration-200"
        >
          + Create User
        </button>
      </div>

      {showCreate && (
        <CreateUserForm
          onClose={() => setShowCreate(false)}
          onSuccess={() => {
            setShowCreate(false);
            loadUsers();
          }}
        />
      )}

      {/* Loading State */}
      {loading && (
        <div className="text-center py-16">
          <div className="relative mb-6 mx-auto w-16 h-16">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin [animation-direction:reverse] [animation-duration:0.8s]"></div>
            </div>
          </div>
          <p className="text-gray-600 font-semibold">Loading users...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="mb-6 bg-white/70 backdrop-blur-xl rounded-2xl border-2 border-red-200 p-6 shadow-lg">
          <p className="text-red-700 font-bold">{error}</p>
        </div>
      )}

      {/* Users Table */}
      {!loading && (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl overflow-hidden">
          {users.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-600 font-semibold text-lg">No users found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
                  <tr>
                    <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Username</th>
                    <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Email</th>
                    <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Role</th>
                    <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Status</th>
                    <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Last Login</th>
                    <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr 
                      key={user.id} 
                      className="border-t border-gray-200 hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 transition-colors"
                    >
                      <td className="px-4 lg:px-6 py-4 font-bold text-gray-800">{user.username}</td>
                      <td className="px-4 lg:px-6 py-4 text-gray-600">{user.email || '-'}</td>
                      <td className="px-4 lg:px-6 py-4">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                          user.role === 'super_admin' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' :
                          user.role === 'admin' ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg' :
                          'bg-gray-200 text-gray-700'
                        }`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                          user.is_active 
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg' 
                            : 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg'
                        }`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-gray-600 font-medium">
                        {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <button className="text-indigo-600 hover:text-indigo-800 font-bold text-sm hover:underline transition-all">
                          Edit
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Create User Form Component
 * Modal form for creating new admin users
 * 
 * @param {Function} onClose - Callback to close the form
 * @param {Function} onSuccess - Callback called after successful user creation
 */
function CreateUserForm({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    username: '',
    password: '',
    email: '',
    full_name: '',
    role: 'admin'
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  /**
   * Handle form submission
   * Creates new user via API
   * @param {Event} e - Form submit event
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Cookies are sent automatically with credentials: 'include'
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || 'Failed to create user');
      }
    } catch (err) {
      console.error('Error creating user:', err);
      setError('Failed to create user. Please try again.');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-gray-200/50 shadow-2xl p-6 lg:p-8 max-w-md w-full relative z-10">
        <h3 className="text-2xl lg:text-3xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">Create User</h3>
        <p className="text-gray-600 font-semibold mb-6 text-sm">Add a new admin user to the system</p>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
              required
              placeholder="Enter username"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({...formData, password: e.target.value})}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
              required
              minLength={8}
              placeholder="Minimum 8 characters"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({...formData, email: e.target.value})}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
              placeholder="user@example.com (optional)"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
            >
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          
          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl shadow-lg">
              <p className="text-sm text-red-700 font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            </div>
          )}
          
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create User</span>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-all shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Token Management Component
 * Manages API tokens for external integrations
 * 
 * @component
 */
function TokenManagement() {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState(null);
  const [newToken, setNewToken] = useState(null);

  useEffect(() => {
    loadTokens();
  }, []);

  const loadTokens = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE}/tokens`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        setTokens(data.tokens || []);
      } else {
        setError(data.error || 'Failed to load tokens');
      }
    } catch (error) {
      console.error('Failed to load tokens:', error);
      setError('Failed to load tokens. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (tokenId) => {
    if (!confirm('Are you sure you want to delete this token? This action cannot be undone.')) {
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/tokens/${tokenId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (data.success) {
        await loadTokens();
      } else {
        setError(data.error || 'Failed to delete token');
      }
    } catch (error) {
      console.error('Failed to delete token:', error);
      setError('Failed to delete token. Please try again.');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const isExpired = (expiresAt) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">API Token Management</h2>
          <p className="text-gray-600 font-semibold">Manage API tokens for external integrations</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] duration-200"
        >
          + Create Token
        </button>
      </div>

      {showCreate && (
        <CreateTokenForm
          onClose={() => {
            setShowCreate(false);
            setNewToken(null);
          }}
          onSuccess={(token) => {
            setShowCreate(false);
            setNewToken(token);
            loadTokens();
          }}
        />
      )}

      {newToken && (
        <div className="mb-6 bg-white/70 backdrop-blur-xl rounded-2xl border-2 border-green-200 p-6 shadow-xl">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h3 className="text-xl font-black text-green-700 mb-2">Token Created Successfully!</h3>
              <p className="text-sm text-gray-600 mb-4 font-semibold">Copy this token now. You won't be able to see it again.</p>
              <div className="bg-gray-100 p-4 rounded-xl font-mono text-sm break-all border-2 border-gray-300">
                {newToken.token}
              </div>
            </div>
            <button
              onClick={() => {
                navigator.clipboard.writeText(newToken.token);
                alert('Token copied to clipboard!');
              }}
              className="ml-4 px-4 py-2 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg transition-all"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 bg-white/70 backdrop-blur-xl rounded-2xl border-2 border-red-200 p-6 shadow-lg">
          <p className="text-red-700 font-bold">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16">
          <div className="relative mb-6 mx-auto w-16 h-16">
            <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin [animation-direction:reverse] [animation-duration:0.8s]"></div>
            </div>
          </div>
          <p className="text-gray-600 font-semibold">Loading tokens...</p>
        </div>
      ) : (
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl overflow-hidden">
          {tokens.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-3xl flex items-center justify-center shadow-2xl">
                <span className="text-5xl">🔑</span>
              </div>
              <p className="text-gray-600 font-semibold text-lg">No API tokens found</p>
              <p className="text-gray-500 text-sm mt-2">Create your first token to get started</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
                  <tr>
                    <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Name</th>
                    <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Description</th>
                    <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Token</th>
                    <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Status</th>
                    <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Expires</th>
                    <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Last Used</th>
                    <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tokens.map((token) => (
                    <tr 
                      key={token.id} 
                      className="border-t border-gray-200 hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 transition-colors"
                    >
                      <td className="px-4 lg:px-6 py-4 font-bold text-gray-800">{token.name}</td>
                      <td className="px-4 lg:px-6 py-4 text-gray-600">{token.description || '-'}</td>
                      <td className="px-4 lg:px-6 py-4">
                        <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono">{token.token || 'N/A'}</code>
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                          isExpired(token.expires_at)
                            ? 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg'
                            : token.is_active
                            ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                            : 'bg-gradient-to-r from-gray-400 to-gray-500 text-white shadow-lg'
                        }`}>
                          {isExpired(token.expires_at) ? 'Expired' : token.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-gray-600 font-medium">
                        {token.expires_at ? formatDate(token.expires_at) : 'Never'}
                      </td>
                      <td className="px-4 lg:px-6 py-4 text-sm text-gray-600 font-medium">
                        {formatDate(token.last_used_at)}
                      </td>
                      <td className="px-4 lg:px-6 py-4">
                        <button
                          onClick={() => handleDelete(token.id)}
                          className="text-red-600 hover:text-red-800 font-bold text-sm hover:underline transition-all"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Create Token Form Component
 * Modal form for creating new API tokens
 */
function CreateTokenForm({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    expiresInDays: '',
    permissions: {}
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!formData.name.trim()) {
      setError('Token name is required');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/tokens`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          description: formData.description || null,
          expiresInDays: formData.expiresInDays ? parseInt(formData.expiresInDays) : null,
          permissions: formData.permissions
        })
      });

      const data = await res.json();
      if (data.success) {
        onSuccess(data.token);
      } else {
        setError(data.error || 'Failed to create token');
      }
    } catch (err) {
      console.error('Error creating token:', err);
      setError('Failed to create token. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-gray-200/50 shadow-2xl p-6 lg:p-8 max-w-md w-full relative z-10">
        <h3 className="text-2xl lg:text-3xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">Create API Token</h3>
        <p className="text-gray-600 font-semibold mb-6 text-sm">Generate a new API token for external integrations</p>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Token Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
              required
              placeholder="e.g., Production API"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({...formData, description: e.target.value})}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
              rows="3"
              placeholder="Optional description for this token"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Expires In (Days)</label>
            <input
              type="number"
              value={formData.expiresInDays}
              onChange={(e) => setFormData({...formData, expiresInDays: e.target.value})}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
              min="1"
              placeholder="Leave empty for no expiration"
            />
            <p className="text-xs text-gray-500 mt-2">Token will never expire if left empty</p>
          </div>
          
          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl shadow-lg">
              <p className="text-sm text-red-700 font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            </div>
          )}
          
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Token</span>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-all shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Ad Management Component
 * Manages ad placements and campaigns
 * 
 * @component
 */
function AdManagement() {
  return (
    <div>
      <div className="mb-8">
        <h2 className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">Ad Placement Management</h2>
        <p className="text-gray-600 font-semibold">Manage ad placements and campaigns</p>
      </div>
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl p-12 text-center">
        <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-pink-500 to-rose-500 rounded-3xl flex items-center justify-center shadow-2xl">
          <span className="text-5xl">📢</span>
        </div>
        <p className="text-gray-600 font-semibold text-lg">Ad management interface coming soon...</p>
      </div>
    </div>
  );
}

/**
 * Scraper Management Component
 * Comprehensive scraper configuration and monitoring
 * 
 * @component
 */
function ScraperManagement() {
  const [scrapers, setScrapers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [editingScraper, setEditingScraper] = useState(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadScrapers();
  }, []);

  const loadScrapers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/scrapers`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      if (data.success) {
        setScrapers(data.scrapers || []);
      } else {
        setError(data.error || 'Failed to load scrapers');
      }
    } catch (err) {
      console.error('Failed to load scrapers:', err);
      setError('Failed to load scrapers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEnabled = async (scraperName, currentEnabled) => {
    try {
      setSaving(true);
      const response = await fetch(`${API_BASE}/scrapers/${scraperName}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled })
      });
      
      const data = await response.json();
      if (data.success) {
        await loadScrapers();
      } else {
        setError(data.error || 'Failed to update scraper');
      }
    } catch (err) {
      console.error('Failed to toggle scraper:', err);
      setError('Failed to update scraper. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async (scraperData) => {
    try {
      setSaving(true);
      setError(null);
      const response = await fetch(`${API_BASE}/scrapers/${scraperData.name}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scraperData)
      });
      
      const data = await response.json();
      if (data.success) {
        setEditingScraper(null);
        await loadScrapers();
      } else {
        setError(data.error || 'Failed to save scraper configuration');
      }
    } catch (err) {
      console.error('Failed to save scraper:', err);
      setError('Failed to save scraper configuration. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="relative mb-6 mx-auto w-16 h-16">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin [animation-direction:reverse] [animation-duration:0.8s]"></div>
          </div>
        </div>
        <p className="text-gray-600 font-semibold">Loading scrapers...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">Scraper Management</h2>
        <p className="text-gray-600 font-semibold">Configure and manage all web scrapers</p>
      </div>

      {error && (
        <div className="mb-6 bg-white/70 backdrop-blur-xl rounded-2xl border-2 border-red-200 p-6 shadow-lg">
          <p className="text-red-700 font-bold">{error}</p>
        </div>
      )}

      {editingScraper && (
        <ScraperEditForm
          scraper={editingScraper}
          onSave={handleSave}
          onCancel={() => setEditingScraper(null)}
          saving={saving}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {scrapers.map((scraper) => (
          <div
            key={scraper.name}
            className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl p-6 hover:shadow-2xl transition-all duration-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                  scraper.enabled 
                    ? 'bg-gradient-to-br from-green-500 to-emerald-500' 
                    : 'bg-gradient-to-br from-gray-400 to-gray-500'
                }`}>
                  {scraper.name === 'amazon' && '📦'}
                  {scraper.name === 'noon' && '🌙'}
                  {scraper.name === 'jarir' && '📚'}
                  {scraper.name === 'panda' && '🐼'}
                  {scraper.name === 'extra' && '🛒'}
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-800">{scraper.displayName}</h3>
                  <p className="text-sm text-gray-500 font-medium">{scraper.name}</p>
                </div>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={scraper.enabled}
                  onChange={() => handleToggleEnabled(scraper.name, scraper.enabled)}
                  disabled={saving}
                  className="sr-only peer"
                />
                <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-green-500 peer-checked:to-emerald-500"></div>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4 text-sm">
              <div>
                <span className="text-gray-500 font-medium">Timeout:</span>
                <span className="ml-2 font-bold text-gray-800">{(scraper.timeoutMs / 1000).toFixed(1)}s</span>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Max Retries:</span>
                <span className="ml-2 font-bold text-gray-800">{scraper.maxRetries}</span>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Max Results:</span>
                <span className="ml-2 font-bold text-gray-800">{scraper.maxResults}</span>
              </div>
              <div>
                <span className="text-gray-500 font-medium">Rate Limit:</span>
                <span className="ml-2 font-bold text-gray-800">{scraper.rateLimitPerSec}/sec</span>
              </div>
            </div>

            {scraper.customDomain && (
              <div className="mb-4 p-3 bg-indigo-50 rounded-lg">
                <span className="text-xs text-gray-500 font-medium">Custom Domain:</span>
                <p className="text-sm font-bold text-indigo-700">{scraper.customDomain}</p>
              </div>
            )}

            <button
              onClick={() => setEditingScraper(scraper)}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] duration-200"
            >
              Configure
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Scraper Edit Form Component
 * Modal form for editing scraper configuration
 */
function ScraperEditForm({ scraper, onSave, onCancel, saving }) {
  const [formData, setFormData] = useState({
    enabled: scraper.enabled,
    timeoutMs: scraper.timeoutMs,
    maxRetries: scraper.maxRetries,
    retryDelayMs: scraper.retryDelayMs,
    maxResults: scraper.maxResults,
    rateLimitPerSec: scraper.rateLimitPerSec,
    concurrency: scraper.concurrency,
    customDomain: scraper.customDomain || '',
    userAgent: scraper.userAgent || ''
  });
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (formData.timeoutMs < 1000) {
      setError('Timeout must be at least 1000ms');
      return;
    }
    if (formData.maxRetries < 0 || formData.maxRetries > 10) {
      setError('Max retries must be between 0 and 10');
      return;
    }
    if (formData.maxResults < 1 || formData.maxResults > 10000) {
      setError('Max results must be between 1 and 10000');
      return;
    }
    if (formData.rateLimitPerSec < 0.1 || formData.rateLimitPerSec > 100) {
      setError('Rate limit must be between 0.1 and 100 per second');
      return;
    }
    if (formData.concurrency < 1 || formData.concurrency > 10) {
      setError('Concurrency must be between 1 and 10');
      return;
    }

    await onSave({
      name: scraper.name,
      ...formData,
      customDomain: formData.customDomain || null,
      userAgent: formData.userAgent || null
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-gray-200/50 shadow-2xl p-6 lg:p-8 max-w-2xl w-full relative z-10 my-8">
        <h3 className="text-2xl lg:text-3xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
          Configure {scraper.displayName}
        </h3>
        <p className="text-gray-600 font-semibold mb-6 text-sm">Update scraper settings and configuration</p>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={formData.enabled}
                  onChange={(e) => setFormData({...formData, enabled: e.target.checked})}
                  className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="text-sm font-bold text-gray-700">Enabled</span>
              </label>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Timeout (ms)</label>
              <input
                type="number"
                value={formData.timeoutMs}
                onChange={(e) => setFormData({...formData, timeoutMs: parseInt(e.target.value) || 30000})}
                className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
                min="1000"
                step="1000"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Max Retries</label>
              <input
                type="number"
                value={formData.maxRetries}
                onChange={(e) => setFormData({...formData, maxRetries: parseInt(e.target.value) || 3})}
                className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
                min="0"
                max="10"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Retry Delay (ms)</label>
              <input
                type="number"
                value={formData.retryDelayMs}
                onChange={(e) => setFormData({...formData, retryDelayMs: parseInt(e.target.value) || 1000})}
                className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
                min="100"
                step="100"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Max Results</label>
              <input
                type="number"
                value={formData.maxResults}
                onChange={(e) => setFormData({...formData, maxResults: parseInt(e.target.value) || 8})}
                className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
                min="1"
                max="10000"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Rate Limit (per sec)</label>
              <input
                type="number"
                value={formData.rateLimitPerSec}
                onChange={(e) => setFormData({...formData, rateLimitPerSec: parseFloat(e.target.value) || 2.0})}
                className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
                min="0.1"
                max="100"
                step="0.1"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Concurrency</label>
              <input
                type="number"
                value={formData.concurrency}
                onChange={(e) => setFormData({...formData, concurrency: parseInt(e.target.value) || 1})}
                className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
                min="1"
                max="10"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Custom Domain (optional)</label>
            <input
              type="text"
              value={formData.customDomain}
              onChange={(e) => setFormData({...formData, customDomain: e.target.value})}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
              placeholder="e.g., amazon.sa"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">User Agent (optional)</label>
            <textarea
              value={formData.userAgent}
              onChange={(e) => setFormData({...formData, userAgent: e.target.value})}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
              rows="2"
              placeholder="Custom user agent string"
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl shadow-lg">
              <p className="text-sm text-red-700 font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] duration-200 flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Configuration</span>
              )}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-all shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Cache Management Component
 * Manages Redis cache and statistics
 * 
 * @component
 */
function CacheManagement() {
  const [cacheStats, setCacheStats] = useState(null);
  const [cacheKeys, setCacheKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [keysLoading, setKeysLoading] = useState(false);
  const [error, setError] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [clearPattern, setClearPattern] = useState('*');
  const [filterPattern, setFilterPattern] = useState('*');
  const [showAddKey, setShowAddKey] = useState(false);
  const [viewingKey, setViewingKey] = useState(null);

  useEffect(() => {
    loadCacheStats();
    loadCacheKeys();
  }, []);

  const loadCacheStats = async () => {
    try {
      setError(null);
      const response = await fetch(`${API_BASE}/cache/stats`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        setCacheStats(data.cache);
      } else {
        setError(data.error || 'Failed to load cache statistics');
      }
    } catch (err) {
      console.error('Failed to load cache stats:', err);
      setError('Failed to load cache statistics. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const loadCacheKeys = async (pattern = filterPattern) => {
    try {
      setKeysLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/cache/keys?pattern=${encodeURIComponent(pattern)}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        setCacheKeys(data.keys || []);
        if (data.connected === false) {
          setError('Cache not connected');
        }
      } else {
        setError(data.error || 'Failed to load cache keys');
      }
    } catch (err) {
      console.error('Failed to load cache keys:', err);
      setError('Failed to load cache keys. Please try again.');
    } finally {
      setKeysLoading(false);
    }
  };

  const handleViewKey = async (key) => {
    try {
      const response = await fetch(`${API_BASE}/cache/key/${encodeURIComponent(key)}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        setViewingKey(data);
      } else {
        setError(data.error || 'Failed to load key value');
      }
    } catch (err) {
      console.error('Failed to view key:', err);
      setError('Failed to view key. Please try again.');
    }
  };

  const handleDeleteKey = async (key) => {
    if (!confirm(`Are you sure you want to delete key "${key}"?`)) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/cache/key/${encodeURIComponent(key)}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        await loadCacheKeys();
        await loadCacheStats();
      } else {
        setError(data.error || 'Failed to delete key');
      }
    } catch (err) {
      console.error('Failed to delete key:', err);
      setError('Failed to delete key. Please try again.');
    }
  };

  const handleClearCache = async () => {
    if (!confirm(`Are you sure you want to clear cache entries matching "${clearPattern}"?`)) {
      return;
    }

    try {
      setClearing(true);
      setError(null);
      const response = await fetch(`${API_BASE}/cache/clear`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pattern: clearPattern })
      });
      const data = await response.json();
      if (data.success) {
        await loadCacheKeys();
        await loadCacheStats();
        alert(data.message || 'Cache cleared successfully');
      } else {
        setError(data.error || 'Failed to clear cache');
      }
    } catch (err) {
      console.error('Failed to clear cache:', err);
      setError('Failed to clear cache. Please try again.');
    } finally {
      setClearing(false);
    }
  };

  const formatTTL = (ttl) => {
    if (ttl === null || ttl < 0) return 'Never';
    if (ttl < 60) return `${ttl}s`;
    if (ttl < 3600) return `${Math.floor(ttl / 60)}m`;
    if (ttl < 86400) return `${Math.floor(ttl / 3600)}h`;
    return `${Math.floor(ttl / 86400)}d`;
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="relative mb-6 mx-auto w-16 h-16">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin [animation-direction:reverse] [animation-duration:0.8s]"></div>
          </div>
        </div>
        <p className="text-gray-600 font-semibold">Loading cache statistics...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <div>
          <h2 className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">Cache Management</h2>
          <p className="text-gray-600 font-semibold">Manage Redis cache keys and view statistics</p>
        </div>
        <button
          onClick={() => setShowAddKey(true)}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98] duration-200"
        >
          + Add Key
        </button>
      </div>

      {showAddKey && (
        <AddCacheKeyForm
          onClose={() => setShowAddKey(false)}
          onSuccess={() => {
            setShowAddKey(false);
            loadCacheKeys();
            loadCacheStats();
          }}
        />
      )}

      {viewingKey && (
        <ViewCacheKeyModal
          keyData={viewingKey}
          onClose={() => setViewingKey(null)}
          onDelete={async () => {
            await handleDeleteKey(viewingKey.key);
            setViewingKey(null);
          }}
        />
      )}

      {error && (
        <div className="mb-6 bg-white/70 backdrop-blur-xl rounded-2xl border-2 border-red-200 p-6 shadow-lg">
          <p className="text-red-700 font-bold">{error}</p>
        </div>
      )}

      {/* Cache Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-black text-gray-800">Connection Status</h3>
            <div className={`w-4 h-4 rounded-full ${cacheStats?.connected ? 'bg-green-500' : 'bg-red-500'} shadow-lg`}></div>
          </div>
          <p className={`text-2xl font-black ${cacheStats?.connected ? 'text-green-600' : 'text-red-600'}`}>
            {cacheStats?.connected ? 'Connected' : 'Disconnected'}
          </p>
        </div>

        <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl p-6">
          <h3 className="text-xl font-black text-gray-800 mb-4">Cache Keys</h3>
          <p className="text-4xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            {cacheKeys.length}
          </p>
          <p className="text-sm text-gray-600 mt-2">Keys displayed</p>
        </div>
      </div>

      {/* Filter and Refresh */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl p-6 mb-8">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <label className="block text-sm font-bold text-gray-700 mb-2">Filter Pattern</label>
            <input
              type="text"
              value={filterPattern}
              onChange={(e) => setFilterPattern(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  loadCacheKeys(filterPattern);
                }
              }}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
              placeholder="* or search:* or product:*"
            />
            <p className="text-xs text-gray-500 mt-2">Use wildcards like * to filter keys (e.g., search:*, product:*)</p>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => loadCacheKeys(filterPattern)}
              disabled={keysLoading || !cacheStats?.connected}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] duration-200 flex items-center gap-2"
            >
              {keysLoading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <span>🔄</span>
                  <span>Refresh</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Cache Keys List */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl overflow-hidden mb-8">
        {keysLoading ? (
          <div className="p-12 text-center">
            <div className="relative mb-6 mx-auto w-16 h-16">
              <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin [animation-direction:reverse] [animation-duration:0.8s]"></div>
              </div>
            </div>
            <p className="text-gray-600 font-semibold">Loading cache keys...</p>
          </div>
        ) : cacheKeys.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-gray-400 to-gray-500 rounded-3xl flex items-center justify-center shadow-2xl">
              <span className="text-5xl">💾</span>
            </div>
            <p className="text-gray-600 font-semibold text-lg">No cache keys found</p>
            <p className="text-gray-500 text-sm mt-2">Try a different pattern or create a new key</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
                <tr>
                  <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Key</th>
                  <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Type</th>
                  <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Size</th>
                  <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">TTL</th>
                  <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Preview</th>
                  <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {cacheKeys.map((keyInfo) => (
                  <tr 
                    key={keyInfo.key} 
                    className="border-t border-gray-200 hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 transition-colors"
                  >
                    <td className="px-4 lg:px-6 py-4">
                      <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono break-all">{keyInfo.key}</code>
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <span className="px-2 py-1 rounded text-xs font-bold bg-gray-200 text-gray-700 capitalize">
                        {keyInfo.valueType}
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-sm text-gray-600 font-medium">
                      {formatSize(keyInfo.size)}
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-sm text-gray-600 font-medium">
                      {formatTTL(keyInfo.ttl)}
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-xs text-gray-500 font-mono max-w-xs truncate">
                      {keyInfo.valuePreview || '-'}
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleViewKey(keyInfo.key)}
                          className="text-indigo-600 hover:text-indigo-800 font-bold text-sm hover:underline transition-all"
                        >
                          View
                        </button>
                        <button
                          onClick={() => handleDeleteKey(keyInfo.key)}
                          className="text-red-600 hover:text-red-800 font-bold text-sm hover:underline transition-all"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Clear Cache by Pattern */}
      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl p-6">
        <h3 className="text-2xl font-black text-gray-800 mb-4">Clear Cache by Pattern</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Pattern</label>
            <input
              type="text"
              value={clearPattern}
              onChange={(e) => setClearPattern(e.target.value)}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
              placeholder="search:*"
            />
            <p className="text-xs text-gray-500 mt-2">Use wildcards like * to match multiple keys (e.g., search:*)</p>
          </div>
          <button
            onClick={handleClearCache}
            disabled={clearing || !cacheStats?.connected}
            className="px-6 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] duration-200 flex items-center gap-2"
          >
            {clearing ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>Clearing...</span>
              </>
            ) : (
              <>
                <span>🗑️</span>
                <span>Clear Cache</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Add Cache Key Form Component
 * Modal form for adding new cache keys
 */
function AddCacheKeyForm({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    key: '',
    value: '',
    ttl: ''
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!formData.key.trim()) {
      setError('Key is required');
      setLoading(false);
      return;
    }

    if (!formData.value.trim()) {
      setError('Value is required');
      setLoading(false);
      return;
    }

    try {
      // Try to parse as JSON, if it fails, use as string
      let parsedValue = formData.value;
      try {
        parsedValue = JSON.parse(formData.value);
      } catch (e) {
        // Not JSON, use as string
      }

      const res = await fetch(`${API_BASE}/cache/key`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: formData.key,
          value: parsedValue,
          ttl: formData.ttl ? parseInt(formData.ttl) : null
        })
      });

      const data = await res.json();
      if (data.success) {
        onSuccess();
      } else {
        setError(data.error || 'Failed to create cache key');
      }
    } catch (err) {
      console.error('Error creating cache key:', err);
      setError('Failed to create cache key. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-gray-200/50 shadow-2xl p-6 lg:p-8 max-w-md w-full relative z-10">
        <h3 className="text-2xl lg:text-3xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">Add Cache Key</h3>
        <p className="text-gray-600 font-semibold mb-6 text-sm">Create a new cache key-value pair</p>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Key *</label>
            <input
              type="text"
              value={formData.key}
              onChange={(e) => setFormData({...formData, key: e.target.value})}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
              required
              placeholder="e.g., my:cache:key"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Value *</label>
            <textarea
              value={formData.value}
              onChange={(e) => setFormData({...formData, value: e.target.value})}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
              rows="4"
              required
              placeholder='String value or JSON (e.g., "hello" or {"key": "value"})'
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">TTL (seconds)</label>
            <input
              type="number"
              value={formData.ttl}
              onChange={(e) => setFormData({...formData, ttl: e.target.value})}
              className="w-full px-4 py-3 bg-white border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200/50 outline-none transition-all hover:border-indigo-300 shadow-sm"
              min="1"
              placeholder="Leave empty for no expiration"
            />
            <p className="text-xs text-gray-500 mt-2">Time to live in seconds (optional)</p>
          </div>
          
          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl shadow-lg">
              <p className="text-sm text-red-700 font-semibold flex items-center gap-2">
                <svg className="w-5 h-5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            </div>
          )}
          
          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] duration-200 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Creating...</span>
                </>
              ) : (
                <span>Create Key</span>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-all shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] duration-200"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * View Cache Key Modal Component
 * Displays full cache key value
 */
function ViewCacheKeyModal({ keyData, onClose, onDelete }) {
  const [copied, setCopied] = useState(false);

  const copyValue = () => {
    const valueStr = typeof keyData.value === 'string' 
      ? keyData.value 
      : JSON.stringify(keyData.value, null, 2);
    navigator.clipboard.writeText(valueStr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatTTL = (ttl) => {
    if (ttl === null || ttl < 0) return 'Never';
    if (ttl < 60) return `${ttl}s`;
    if (ttl < 3600) return `${Math.floor(ttl / 60)}m`;
    if (ttl < 86400) return `${Math.floor(ttl / 3600)}h`;
    return `${Math.floor(ttl / 86400)}d`;
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-gray-200/50 shadow-2xl p-6 lg:p-8 max-w-4xl w-full relative z-10 my-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="text-2xl lg:text-3xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">Cache Key Details</h3>
            <code className="text-sm bg-gray-100 px-3 py-1 rounded font-mono break-all">{keyData.key}</code>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-indigo-50 rounded-xl p-4">
            <p className="text-xs text-gray-600 font-semibold mb-1">Type</p>
            <p className="text-lg font-black text-indigo-700 capitalize">{keyData.valueType}</p>
          </div>
          <div className="bg-purple-50 rounded-xl p-4">
            <p className="text-xs text-gray-600 font-semibold mb-1">Size</p>
            <p className="text-lg font-black text-purple-700">{formatSize(keyData.size)}</p>
          </div>
          <div className="bg-pink-50 rounded-xl p-4">
            <p className="text-xs text-gray-600 font-semibold mb-1">TTL</p>
            <p className="text-lg font-black text-pink-700">{formatTTL(keyData.ttl)}</p>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-bold text-gray-700">Value</label>
            <button
              onClick={copyValue}
              className="text-xs text-indigo-600 hover:text-indigo-800 font-bold hover:underline"
            >
              {copied ? '✓ Copied!' : 'Copy'}
            </button>
          </div>
          <div className="bg-gray-900 text-green-400 p-4 rounded-xl font-mono text-sm overflow-x-auto max-h-96 overflow-y-auto">
            <pre className="whitespace-pre-wrap break-words">
              {typeof keyData.value === 'string' 
                ? keyData.value 
                : JSON.stringify(keyData.value, null, 2)}
            </pre>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onDelete}
            className="flex-1 py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] duration-200"
          >
            Delete Key
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-all shadow-md hover:shadow-lg hover:scale-[1.02] active:scale-[0.98] duration-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Audit Log Component
 * Displays system audit logs and activity history
 * 
 * @component
 */
function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [limit] = useState(100);

  useEffect(() => {
    loadAuditLogs();
  }, []);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch(`${API_BASE}/audit-log?limit=${limit}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      if (data.success) {
        setLogs(data.logs || []);
      } else {
        setError(data.error || 'Failed to load audit logs');
      }
    } catch (err) {
      console.error('Failed to load audit logs:', err);
      setError('Failed to load audit logs. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  const getActionColor = (action) => {
    if (action.includes('CREATE') || action.includes('LOGIN')) return 'from-green-500 to-emerald-500';
    if (action.includes('UPDATE') || action.includes('MODIFY')) return 'from-blue-500 to-indigo-500';
    if (action.includes('DELETE') || action.includes('LOGOUT')) return 'from-red-500 to-pink-500';
    return 'from-gray-500 to-gray-600';
  };

  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="relative mb-6 mx-auto w-16 h-16">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin [animation-direction:reverse] [animation-duration:0.8s]"></div>
          </div>
        </div>
        <p className="text-gray-600 font-semibold">Loading audit logs...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h2 className="text-4xl lg:text-5xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">Audit Log</h2>
        <p className="text-gray-600 font-semibold">View system activity and audit logs</p>
      </div>

      {error && (
        <div className="mb-6 bg-white/70 backdrop-blur-xl rounded-2xl border-2 border-red-200 p-6 shadow-lg">
          <p className="text-red-700 font-bold">{error}</p>
        </div>
      )}

      <div className="bg-white/70 backdrop-blur-xl rounded-2xl border border-gray-200/50 shadow-xl overflow-hidden">
        {logs.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-600 font-semibold text-lg">No audit logs found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
                <tr>
                  <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Timestamp</th>
                  <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">User</th>
                  <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Action</th>
                  <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">Resource</th>
                  <th className="px-4 lg:px-6 py-4 text-left font-bold text-gray-700">IP Address</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log, index) => (
                  <tr
                    key={log.id}
                    className="border-t border-gray-200 hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 transition-colors"
                  >
                    <td className="px-4 lg:px-6 py-4 text-sm text-gray-600 font-medium">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 lg:px-6 py-4 font-bold text-gray-800">
                      {log.username || 'System'}
                    </td>
                    <td className="px-4 lg:px-6 py-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold bg-gradient-to-r ${getActionColor(log.action)} text-white shadow-lg`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-sm text-gray-600">
                      {log.resource_type || '-'}
                      {log.resource_id && ` #${log.resource_id}`}
                    </td>
                    <td className="px-4 lg:px-6 py-4 text-sm text-gray-600 font-mono">
                      {log.ip_address || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
