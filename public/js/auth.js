// === AUTHENTICATION MODULE ===

class AuthService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.currentUser = null;
  }

  /**
   * Initialize authentication and check session
   */
  async initialize() {
    try {
      // Get current session
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error) {
        console.error('Session error:', error);
        this.redirectToLogin();
        return false;
      }

      if (!session) {
        this.redirectToLogin();
        return false;
      }

      this.currentUser = session.user;
      this.setupAuthListeners();
      return true;

    } catch (error) {
      console.error('Auth initialization error:', error);
      this.redirectToLogin();
      return false;
    }
  }

  /**
   * Set up authentication state listeners
   */
  setupAuthListeners() {
    this.supabase.auth.onAuthStateChange((event, session) => {
      console.log('Auth state changed:', event, session);
      
      switch (event) {
        case 'SIGNED_OUT':
          this.handleSignOut();
          break;
        case 'TOKEN_REFRESHED':
          console.log('Token refreshed');
          break;
        case 'SIGNED_IN':
          this.currentUser = session?.user || null;
          break;
      }
    });
  }

  /**
   * Handle sign out
   */
  handleSignOut() {
    this.currentUser = null;
    this.clearStoredData();
    this.redirectToLogin();
  }

  /**
   * Sign out user
   */
  async signOut() {
    if (confirm('Are you sure you want to logout?')) {
      try {
        // Show loading state
        if (window.showToast) {
          window.showToast('Logging out...', 'info', 2000);
        }
        
        const { error } = await this.supabase.auth.signOut();
        if (error) {
          console.error('Supabase logout error:', error);
        }
        
        this.handleSignOut();
        
      } catch (error) {
        console.error('Logout error:', error);
        if (window.showToast) {
          window.showToast('Logout failed, redirecting anyway...', 'warning');
        }
        
        // Force redirect even if logout process fails
        setTimeout(() => {
          this.redirectToLogin();
        }, 1000);
      }
    }
  }

  /**
   * Clear stored authentication data
   */
  clearStoredData() {
    localStorage.removeItem('supabase.auth.token');
    sessionStorage.clear();
    // Clear any other authentication-related data
  }

  /**
   * Redirect to login page
   */
  redirectToLogin() {
    // Use replace to prevent back navigation
    window.location.replace('login.html');
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated() {
    return this.currentUser !== null;
  }

  /**
   * Get current user
   */
  getCurrentUser() {
    return this.currentUser;
  }

  /**
   * Check user permissions (placeholder for future role-based access)
   */
  hasPermission(permission) {
    if (!this.currentUser) return false;
    
    // Implement role-based permissions here
    // For now, return true for authenticated users
    return true;
  }
}

// Export for use in other modules
window.AuthService = AuthService;