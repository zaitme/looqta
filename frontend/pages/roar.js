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
import { getCookie } from '../utils/cookies';

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
      const sessionToken = getCookie('roar_session');
      const response = await fetch(`${API_BASE}/auth/me`, {
        credentials: 'include',
        headers: {
          'x-session-token': sessionToken || ''
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


  // Loading state with modern spinner matching main UI
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-purple-50/30 flex items-center justify-center relative overflow-hidden">
        {/* Animated Background Elements - matching main UI */}
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float" style={{ animationDelay: '1s' }}></div>
        </div>
        
        <div className="text-center relative z-10">
          {/* Dual-ring spinner matching main UI */}
          <div className="relative mb-6 mx-auto w-20 h-20">
            <div className="w-20 h-20 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
            </div>
          </div>
          <p className="text-gray-700 font-bold text-lg animate-fadeInUp">Loading ROAR Admin...</p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return <LoginForm onLogin={checkAuth} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-purple-50/30 relative overflow-hidden">
      {/* Animated Background Elements - matching main UI */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-indigo-300 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-float" style={{ animationDelay: '2s' }}></div>
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
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-300 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-float" style={{ animationDelay: '1s' }}></div>
      </div>
      
      <div className="w-full max-w-md glass-effect rounded-3xl border border-white/30 shadow-2xl p-8 relative z-10 animate-fadeInUp glow-effect">
        <div className="text-center mb-8">
          <h1 className="text-5xl font-black gradient-text-purple mb-2 animate-fadeInUp">ROAR</h1>
          <p className="text-gray-600 font-semibold text-lg animate-fadeInUp" style={{ animationDelay: '0.1s' }}>Admin Console</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6 animate-fadeInUp" style={{ animationDelay: '0.2s' }}>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all hover:border-indigo-300"
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
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all hover:border-indigo-300"
              required
              placeholder="Enter password"
            />
          </div>

          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl animate-fadeInUp glow-effect-red">
              <p className="text-sm text-red-700 font-semibold flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                {error}
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-700 hover:via-purple-700 hover:to-pink-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 hover:scale-105 transform duration-300 glow-effect"
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

        <div className="mt-6 text-center animate-fadeInUp" style={{ animationDelay: '0.3s' }}>
          <p className="text-xs text-gray-500 font-medium">Default credentials: zaitme / highrise</p>
        </div>
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
      const sessionToken = getCookie('roar_session');
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'x-session-token': sessionToken || ''
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
      {/* Sidebar Navigation - Modern glass effect matching main UI */}
      <div className="w-64 glass-effect border-r border-white/30 shadow-2xl relative">
        {/* Header */}
        <div className="p-6 border-b border-white/30 bg-gradient-to-r from-indigo-50/50 to-purple-50/50">
          <h1 className="text-3xl font-black gradient-text-purple mb-1">ROAR</h1>
          <p className="text-xs text-gray-600 font-semibold uppercase tracking-wider">Admin Console</p>
        </div>

        {/* Navigation Tabs */}
        <nav className="p-4 space-y-2">
          {tabs.map((tab, index) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 transform hover:scale-105 ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg glow-effect'
                  : 'text-gray-700 hover:bg-gradient-to-r hover:from-indigo-50 hover:to-purple-50 hover:shadow-md'
              }`}
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="font-bold">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* User Info & Logout - Fixed at bottom */}
        <div className="absolute bottom-0 w-64 p-4 border-t border-white/30 bg-gradient-to-r from-slate-50/90 to-blue-50/90">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="font-bold text-gray-800">{user?.username}</p>
              <p className="text-xs text-gray-600 capitalize font-semibold">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-3 bg-gradient-to-r from-red-500 to-pink-500 hover:from-red-600 hover:to-pink-600 text-white font-bold rounded-xl transition-all shadow-lg hover:shadow-xl hover:scale-105 transform duration-300"
          >
            Logout
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8">
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
        const sessionToken = getCookie('roar_session');
        const response = await fetch(`${API_BASE}/stats`, {
          credentials: 'include',
          headers: {
            'x-session-token': sessionToken || ''
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

  // Loading state with modern spinner
  if (loading) {
    return (
      <div className="text-center py-16">
        <div className="relative mb-6 mx-auto w-16 h-16">
          <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
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
        <div className="glass-effect rounded-2xl border-2 border-red-200 p-8 max-w-md mx-auto">
          <p className="text-red-600 font-bold">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeInUp">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-5xl font-black gradient-text-purple mb-2">Dashboard</h2>
        <p className="text-gray-600 font-semibold">System overview and statistics</p>
      </div>

      {/* Statistics Grid - Matching main UI card style */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats && Object.entries(stats).map(([key, value], index) => {
          const formattedKey = key.replace(/([A-Z])/g, ' $1').trim().replace(/^\w/, c => c.toUpperCase());
          return (
            <div 
              key={key} 
              className="card hover:scale-105 transition-all duration-300 animate-fadeInUp glow-effect"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <p className="text-sm text-gray-600 mb-3 font-semibold uppercase tracking-wide">{formattedKey}</p>
              <p className="text-4xl font-black gradient-text-purple">{typeof value === 'number' ? value.toLocaleString() : value}</p>
            </div>
          );
        })}
      </div>

      {/* Empty state */}
      {(!stats || Object.keys(stats).length === 0) && (
        <div className="text-center py-16">
          <div className="glass-effect rounded-2xl border border-white/30 p-8 max-w-md mx-auto">
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
      const sessionToken = getCookie('roar_session');
      const res = await fetch(`${API_BASE}/users`, {
        credentials: 'include',
        headers: { 'x-session-token': sessionToken || '' }
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
    <div className="animate-fadeInUp">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-5xl font-black gradient-text-purple mb-2">User Management</h2>
          <p className="text-gray-600 font-semibold">Manage admin users and permissions</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105 transform duration-300 glow-effect"
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
              <div className="w-10 h-10 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin" style={{ animationDirection: 'reverse', animationDuration: '0.8s' }}></div>
            </div>
          </div>
          <p className="text-gray-600 font-semibold">Loading users...</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="mb-6 glass-effect rounded-2xl border-2 border-red-200 p-6 glow-effect-red">
          <p className="text-red-700 font-bold">{error}</p>
        </div>
      )}

      {/* Users Table */}
      {!loading && (
        <div className="glass-effect rounded-2xl border border-white/30 shadow-xl overflow-hidden animate-fadeInUp">
          {users.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-600 font-semibold text-lg">No users found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gradient-to-r from-indigo-50 to-purple-50">
                <tr>
                  <th className="px-6 py-4 text-left font-bold text-gray-700">Username</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-700">Email</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-700">Role</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-700">Status</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-700">Last Login</th>
                  <th className="px-6 py-4 text-left font-bold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, index) => (
                  <tr 
                    key={user.id} 
                    className="border-t border-gray-200 hover:bg-gradient-to-r hover:from-indigo-50/50 hover:to-purple-50/50 transition-colors"
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <td className="px-6 py-4 font-bold text-gray-800">{user.username}</td>
                    <td className="px-6 py-4 text-gray-600">{user.email || '-'}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        user.role === 'super_admin' ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg' :
                        user.role === 'admin' ? 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white shadow-lg' :
                        'bg-gray-200 text-gray-700'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-bold ${
                        user.is_active 
                          ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg' 
                          : 'bg-gradient-to-r from-red-500 to-pink-500 text-white shadow-lg'
                      }`}>
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 font-medium">
                      {user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}
                    </td>
                    <td className="px-6 py-4">
                      <button className="text-indigo-600 hover:text-indigo-800 font-bold text-sm hover:underline transition-all">
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
      const sessionToken = getCookie('roar_session');
      const res = await fetch(`${API_BASE}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': sessionToken || ''
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm animate-fadeInUp">
      <div className="glass-effect rounded-3xl border border-white/30 shadow-2xl p-8 max-w-md w-full relative z-10 glow-effect animate-scaleIn">
        <h3 className="text-3xl font-black gradient-text-purple mb-2">Create User</h3>
        <p className="text-gray-600 font-semibold mb-6 text-sm">Add a new admin user to the system</p>
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Username</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({...formData, username: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all hover:border-indigo-300"
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
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all hover:border-indigo-300"
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
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all hover:border-indigo-300"
              placeholder="user@example.com (optional)"
            />
          </div>
          
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">Role</label>
            <select
              value={formData.role}
              onChange={(e) => setFormData({...formData, role: e.target.value})}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none transition-all hover:border-indigo-300 bg-white"
            >
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>
          
          {error && (
            <div className="p-4 bg-red-50 border-2 border-red-200 rounded-xl animate-fadeInUp glow-effect-red">
              <p className="text-sm text-red-700 font-semibold flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
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
              className="flex-1 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl hover:scale-105 transform duration-300 glow-effect flex items-center justify-center gap-2"
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
              className="flex-1 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 font-bold rounded-xl transition-all shadow-md hover:shadow-lg hover:scale-105 transform duration-300"
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
  return (
    <div className="animate-fadeInUp">
      <div className="mb-8">
        <h2 className="text-5xl font-black gradient-text-purple mb-2">API Token Management</h2>
        <p className="text-gray-600 font-semibold">Manage API tokens for external integrations</p>
      </div>
      <div className="glass-effect rounded-2xl border border-white/30 shadow-xl p-12 text-center">
        <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-3xl flex items-center justify-center shadow-2xl">
          <span className="text-5xl">🔑</span>
        </div>
        <p className="text-gray-600 font-semibold text-lg">Token management interface coming soon...</p>
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
    <div className="animate-fadeInUp">
      <div className="mb-8">
        <h2 className="text-5xl font-black gradient-text-purple mb-2">Ad Placement Management</h2>
        <p className="text-gray-600 font-semibold">Manage ad placements and campaigns</p>
      </div>
      <div className="glass-effect rounded-2xl border border-white/30 shadow-xl p-12 text-center">
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
 * Monitors and manages web scrapers
 * 
 * @component
 */
function ScraperManagement() {
  return (
    <div className="animate-fadeInUp">
      <div className="mb-8">
        <h2 className="text-5xl font-black gradient-text-purple mb-2">Scraper Management</h2>
        <p className="text-gray-600 font-semibold">Monitor and manage web scrapers</p>
      </div>
      <div className="glass-effect rounded-2xl border border-white/30 shadow-xl p-12 text-center">
        <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-green-500 to-emerald-500 rounded-3xl flex items-center justify-center shadow-2xl">
          <span className="text-5xl">🕷️</span>
        </div>
        <p className="text-gray-600 font-semibold text-lg">Scraper management interface coming soon...</p>
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
  return (
    <div className="animate-fadeInUp">
      <div className="mb-8">
        <h2 className="text-5xl font-black gradient-text-purple mb-2">Cache Management</h2>
        <p className="text-gray-600 font-semibold">Manage Redis cache and view statistics</p>
      </div>
      <div className="glass-effect rounded-2xl border border-white/30 shadow-xl p-12 text-center">
        <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-3xl flex items-center justify-center shadow-2xl">
          <span className="text-5xl">💾</span>
        </div>
        <p className="text-gray-600 font-semibold text-lg">Cache management interface coming soon...</p>
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
  return (
    <div className="animate-fadeInUp">
      <div className="mb-8">
        <h2 className="text-5xl font-black gradient-text-purple mb-2">Audit Log</h2>
        <p className="text-gray-600 font-semibold">View system activity and audit logs</p>
      </div>
      <div className="glass-effect rounded-2xl border border-white/30 shadow-xl p-12 text-center">
        <div className="w-24 h-24 mx-auto mb-6 bg-gradient-to-br from-purple-500 to-indigo-500 rounded-3xl flex items-center justify-center shadow-2xl">
          <span className="text-5xl">📝</span>
        </div>
        <p className="text-gray-600 font-semibold text-lg">Audit log interface coming soon...</p>
      </div>
    </div>
  );
}
