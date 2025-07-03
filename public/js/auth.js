// === AUTHENTICATION MODULE ===
class AuthService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.currentUser = null;
  }

  async initialize() {
    try {
      const { data: { session }, error } = await this.supabase.auth.getSession();
      
      if (error || !session) {
        this.redirectToLogin();
        return false;
      }

      this.currentUser = session.user;
      this.setupAuthListeners();
      return true;
    } catch (error) {
      this.redirectToLogin();
      return false;
    }
  }

  setupAuthListeners() {
    this.supabase.auth.onAuthStateChange((event, session) => {
      switch (event) {
        case 'SIGNED_OUT':
          this.handleSignOut();
          break;
        case 'SIGNED_IN':
          this.currentUser = session?.user || null;
          break;
      }
    });
  }

  async signOut() {
    if (!confirm('Are you sure you want to logout?')) return;
    
    try {
      window.showToast?.('Logging out...', 'info', 2000);
      const { error } = await this.supabase.auth.signOut();
      if (error) console.error('Sign out error:', error);
      this.handleSignOut();
    } catch (error) {
      window.showToast?.('Logout failed, redirecting anyway...', 'warning');
      setTimeout(() => this.redirectToLogin(), 1000);
    }
  }

  handleSignOut() {
    this.currentUser = null;
    this.clearStoredData();
    this.redirectToLogin();
  }

  clearStoredData() {
    localStorage.removeItem('supabase.auth.token');
    sessionStorage.clear();
  }

  redirectToLogin() {
    window.location.replace('login.html');
  }

  isAuthenticated() {
    return this.currentUser !== null;
  }

  getCurrentUser() {
    return this.currentUser;
  }

  hasPermission(permission) {
    return this.currentUser !== null; // Placeholder for role-based permissions
  }
}

window.AuthService = AuthService;