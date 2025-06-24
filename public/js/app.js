// === MODERN HIS PORTAL APPLICATION ===
// Clean, efficient application orchestrator

class HISPortalApp {
  constructor() {
    this.supabaseClient = null;
    this.services = {};
    this.isInitialized = false;
    this.currentUser = null;
  }

  /**
   * Initialize the entire application
   */
  async initialize() {
    try {
      console.log('🚀 Initializing HIS Portal...');
      
      // Show loading screen
      this.showLoading();

      // Initialize Supabase
      await this.initializeSupabase();

      // Initialize services
      this.initializeServices();

      // Check authentication
      const isAuthenticated = await this.checkAuthentication();
      if (!isAuthenticated) return;

      // Load application data
      await this.loadApplicationData();

      // Initialize UI components
      this.initializeUI();

      // Setup event listeners
      this.setupEventListeners();

      // Show dashboard
      this.showDashboard();

      // Mark as initialized
      this.isInitialized = true;

      // CRITICAL: Notify modal system that app is ready
      if (typeof window.markModalSystemReady === 'function') {
        window.markModalSystemReady();
      }

      console.log('✅ Portal initialization complete');
      this.services.ui.showToast('Portal loaded successfully', 'success');

    } catch (error) {
      console.error('❌ Portal initialization failed:', error);
      this.showInitError(`Failed to initialize portal: ${error.message}`);
    }
  }

  /**
   * Initialize Supabase client
   */
  async initializeSupabase() {
    if (typeof supabase === 'undefined') {
      throw new Error('Supabase library not loaded');
    }

    const config = window.SUPABASE_CONFIG;
    if (!config?.url || !config?.anonKey) {
      throw new Error('Supabase configuration missing');
    }

    this.supabaseClient = supabase.createClient(config.url, config.anonKey);
    console.log('✓ Supabase client initialized');
  }

  /**
   * Initialize all services
   */
  initializeServices() {
    this.services = {
      auth: new AuthService(this.supabaseClient),
      data: new DataService(this.supabaseClient),
      ui: new UIComponents(),
      dashboard: new DashboardModule(null, null), // Will be set after data service is ready
      tickets: new TicketRenderer(null, null)     // Will be set after data service is ready
    };

    // Link services that depend on each other
    this.services.dashboard.dataService = this.services.data;
    this.services.dashboard.ui = this.services.ui;
    this.services.tickets.dataService = this.services.data;
    this.services.tickets.ui = this.services.ui;

    // Make services globally available for compatibility
    window.authService = this.services.auth;
    window.dataService = this.services.data;
    window.uiComponents = this.services.ui;
    window.dashboardModule = this.services.dashboard;
    window.ticketRenderer = this.services.tickets;

    console.log('✓ Services initialized');
  }

  /**
   * Check user authentication
   */
  async checkAuthentication() {
    try {
      const isAuthenticated = await this.services.auth.initialize();
      
      if (!isAuthenticated) {
        this.showAuthError('Please log in to access the portal');
        return false;
      }

      this.currentUser = this.services.auth.getCurrentUser();
      window.currentUser = this.currentUser;
      
      console.log('✓ Authentication verified for:', this.currentUser.email);
      return true;

    } catch (error) {
      console.error('Authentication check failed:', error);
      this.showAuthError('Authentication failed: ' + error.message);
      return false;
    }
  }

  /**
   * Load application data
   */
  async loadApplicationData() {
    try {
      await this.services.data.refreshData();
      console.log('✓ Application data loaded');
    } catch (error) {
      console.error('Failed to load application data:', error);
      this.services.ui.showToast('Failed to load some data. Please try refreshing.', 'warning');
    }
  }

  /**
   * Initialize UI components
   */
  initializeUI() {
    try {
      // Initialize UI components
      this.services.ui.initialize();

      // Initialize dashboard
      this.services.dashboard.initialize();

      // Initialize ticket renderer
      this.services.tickets.initializeEventListeners();

      // Update user info in UI
      this.updateUserInterface();

      console.log('✓ UI components initialized');
    } catch (error) {
      console.error('UI initialization failed:', error);
      throw new Error('Failed to initialize user interface');
    }
  }

  /**
   * Setup application event listeners
   */
  setupEventListeners() {
    // Navigation event listeners
    this.setupNavigationListeners();

    // Mobile menu toggle
    this.setupMobileMenu();

    // Search and filter listeners
    this.setupSearchListeners();

    // Window event listeners
    this.setupWindowListeners();

    // Keyboard shortcuts
    this.setupKeyboardShortcuts();

    console.log('✓ Event listeners setup complete');
  }

  /**
   * Setup navigation event listeners
   */
  setupNavigationListeners() {
    document.querySelectorAll('.nav-link[data-section]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        this.navigateToSection(link.dataset.section);
      });
    });

    document.querySelectorAll('.card-action-link[data-section]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        this.navigateToSection(link.dataset.section);
      });
    });
  }

  /**
   * Setup mobile menu functionality
   */
  setupMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.querySelector('.dashboard-sidebar');
    
    if (mobileMenuBtn && sidebar) {
      mobileMenuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });

      // Close sidebar when clicking outside on mobile
      document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && 
            !sidebar.contains(e.target) && 
            !mobileMenuBtn.contains(e.target)) {
          sidebar.classList.remove('open');
        }
      });
    }
  }

  /**
   * Setup search and filter listeners
   */
  setupSearchListeners() {
    const searchInput = document.getElementById('ticket-search');
    const statusFilter = document.getElementById('status-filter');
    const priorityFilter = document.getElementById('priority-filter');

    if (searchInput) {
      searchInput.addEventListener('input', () => this.services.tickets.filterTickets());
    }
    if (statusFilter) {
      statusFilter.addEventListener('change', () => this.services.tickets.filterTickets());
    }
    if (priorityFilter) {
      priorityFilter.addEventListener('change', () => this.services.tickets.filterTickets());
    }

    // View toggle buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const viewType = btn.dataset.view;
        this.toggleView(viewType);
      });
    });

    // Bulk selection
    const selectAllCheckbox = document.getElementById('select-all');
    if (selectAllCheckbox) {
      selectAllCheckbox.addEventListener('change', () => {
        this.services.tickets.selectAllTickets();
      });
    }
    
    // Delegate event for row checkboxes
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('header-checkbox')) {
        this.services.tickets.selectAllTickets();
      } else if (e.target.classList.contains('row-checkbox')) {
        this.services.tickets.handleBulkSelection();
      }
    });

    // Sortable table headers
    document.addEventListener('click', (e) => {
      const sortableHeader = e.target.closest('.sortable[data-sort]');
      if (sortableHeader) {
        const field = sortableHeader.dataset.sort;
        this.services.tickets.sortTickets(field);
      }
    });
  }

  /**
   * Setup window event listeners
   */
  setupWindowListeners() {
    // Handle window resize
    window.addEventListener('resize', () => {
      this.handleResize();
    });

    // Handle visibility change
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isInitialized) {
        this.handleVisibilityChange();
      }
    });

    // Handle beforeunload
    window.addEventListener('beforeunload', () => {
      // Could save any pending changes here
    });
  }

  /**
   * Setup keyboard shortcuts
   */
  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Skip if modal system will handle ESC
      if (e.key === 'Escape') {
        const ticketModal = document.getElementById('ticket-modal');
        const editModal = document.getElementById('edit-ticket-modal');
        if ((ticketModal && ticketModal.style.display === 'flex') || 
            (editModal && editModal.style.display === 'flex')) {
          // Let modal system handle this
          return;
        }
      }

      // Ctrl/Cmd + R - refresh dashboard
      if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !e.shiftKey) {
        e.preventDefault();
        this.refreshDashboard();
      }

      // Navigation shortcuts
      if (e.altKey) {
        switch(e.key) {
          case '1':
            e.preventDefault();
            this.navigateToSection('dashboard');
            break;
          case '2':
            e.preventDefault();
            this.navigateToSection('tickets');
            break;
          case '3':
            e.preventDefault();
            this.navigateToSection('analytics');
            break;
        }
      }
    });
  }

  /**
   * Navigate to a specific section
   */
  navigateToSection(sectionName) {
    this.services.ui.navigateToSection(sectionName);
    
    // Load section-specific data
    if (sectionName === 'tickets') {
      this.services.tickets.renderTicketsTable();
    } else if (sectionName === 'analytics') {
      this.services.dashboard.loadAssigneeStats();
    }
  }

  /**
   * Toggle between table and cards view
   */
  toggleView(viewType) {
    this.services.ui.toggleView(viewType);
    this.services.tickets.renderTicketsTable();
  }

  /**
   * Handle window resize
   */
  handleResize() {
    // Close mobile menu on desktop
    if (window.innerWidth > 768) {
      const sidebar = document.querySelector('.dashboard-sidebar');
      if (sidebar) sidebar.classList.remove('open');
    }
  }

  /**
   * Handle page visibility change
   */
  async handleVisibilityChange() {
    try {
      // Verify auth when user returns to the page
      await this.services.auth.initialize();
    } catch (error) {
      console.error('Auth verification failed:', error);
      this.showAuthError('Session expired. Please log in again.');
    }
  }

  /**
   * Update user interface with current user info
   */
  updateUserInterface() {
    if (this.currentUser) {
      const userNameElements = document.querySelectorAll('#user-name');
      const userRoleElements = document.querySelectorAll('#user-role');
      
      const userName = this.currentUser.user_metadata?.full_name || this.currentUser.email;
      const userRole = this.currentUser.user_metadata?.role || 'User';

      userNameElements.forEach(el => {
        if (el) el.textContent = userName;
      });

      userRoleElements.forEach(el => {
        if (el) el.textContent = userRole;
      });
    }
  }

  /**
   * Refresh dashboard data
   */
  async refreshDashboard() {
    try {
      this.services.ui.showToast('Refreshing dashboard...', 'info', 2000);
      await this.services.data.refreshData();
      await this.services.dashboard.loadDashboardData();
      this.services.tickets.renderTicketsTable();
      this.services.ui.showToast('Dashboard refreshed successfully', 'success');
    } catch (error) {
      console.error('Error refreshing dashboard:', error);
      this.services.ui.showToast('Failed to refresh dashboard', 'error');
    }
  }

  /**
   * Show loading screen
   */
  showLoading() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'flex';
      loadingScreen.classList.remove('hidden');
    }
  }

  /**
   * Show dashboard
   */
  showDashboard() {
    const loadingScreen = document.getElementById('loading-screen');
    const authError = document.getElementById('auth-error');
    const initError = document.getElementById('init-error');
    const dashboardContainer = document.getElementById('dashboard-container');

    if (loadingScreen) {
      loadingScreen.classList.add('hidden');
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 500);
    }
    if (authError) authError.style.display = 'none';
    if (initError) initError.style.display = 'none';
    if (dashboardContainer) dashboardContainer.style.display = 'flex';
  }

  /**
   * Show authentication error
   */
  showAuthError(message) {
    const authErrorMessage = document.getElementById('auth-error-message');
    const loadingScreen = document.getElementById('loading-screen');
    const authError = document.getElementById('auth-error');
    const dashboardContainer = document.getElementById('dashboard-container');

    if (authErrorMessage) authErrorMessage.textContent = message;
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (authError) authError.style.display = 'flex';
    if (dashboardContainer) dashboardContainer.style.display = 'none';
  }

  /**
   * Show initialization error
   */
  showInitError(message) {
    const initErrorMessage = document.getElementById('init-error-message');
    const loadingScreen = document.getElementById('loading-screen');
    const initError = document.getElementById('init-error');
    const dashboardContainer = document.getElementById('dashboard-container');

    if (initErrorMessage) initErrorMessage.textContent = message;
    if (loadingScreen) loadingScreen.style.display = 'none';
    if (initError) initError.style.display = 'flex';
    if (dashboardContainer) dashboardContainer.style.display = 'none';
  }
}

// === GLOBAL FUNCTIONS FOR COMPATIBILITY ===
// Note: Modal-related functions are now handled by the modal system

/**
 * Global function to handle logout
 */
window.handleLogout = async function() {
  if (window.authService) {
    await window.authService.signOut();
  }
};

/**
 * Global function to refresh dashboard
 */
window.refreshDashboard = async function() {
  if (window.app) {
    await window.app.refreshDashboard();
  }
};

/**
 * Global function to clear filters
 */
window.clearFilters = function() {
  if (window.ticketRenderer) {
    window.ticketRenderer.clearFilters();
  }
};

/**
 * Global function to redirect to login
 */
window.redirectToLogin = function() {
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = 'login.html';
};

/**
 * Global function to retry authentication
 */
window.retryAuthentication = function() {
  window.location.reload();
};

// === APPLICATION STARTUP ===

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
  const app = new HISPortalApp();
  window.app = app;
  
  try {
    await app.initialize();
  } catch (error) {
    console.error('Critical application error:', error);
    app.showInitError('Critical error during initialization. Please refresh the page.');
  }
});

// Handle page unload
window.addEventListener('beforeunload', () => {
  // Cleanup if needed
  if (window.app) {
    console.log('Application shutting down...');
  }
});

// Export for ES6 modules if needed
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HISPortalApp;
}