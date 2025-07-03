// === MODERN HIS PORTAL APPLICATION ===
class HISPortalApp {
  constructor() {
    this.supabaseClient = null;
    this.services = {};
    this.isInitialized = false;
    this.currentUser = null;
  }

  async initialize() {
    try {
      this.showLoading();
      await this.initializeSupabase();
      this.initializeServices();
      
      if (!(await this.checkAuthentication())) return;
      
      await this.loadApplicationData();
      this.initializeUI();
      this.setupEventListeners();
      this.showDashboard();
      
      this.isInitialized = true;
      window.markModalSystemReady?.();
      this.services.ui.showToast('Portal loaded successfully', 'success');
    } catch (error) {
      this.showInitError(`Failed to initialize portal: ${error.message}`);
    }
  }

  async initializeSupabase() {
    if (typeof supabase === 'undefined') throw new Error('Supabase library not loaded');
    const config = window.SUPABASE_CONFIG;
    if (!config?.url || !config?.anonKey) throw new Error('Supabase configuration missing');
    this.supabaseClient = supabase.createClient(config.url, config.anonKey);
  }

  initializeServices() {
    this.services = {
      auth: new AuthService(this.supabaseClient),
      data: new DataService(this.supabaseClient),
      ui: new UIComponents(),
      dashboard: new DashboardModule(null, null),
      tickets: new TicketRenderer(null, null)
    };

    // Link services
    this.services.dashboard.dataService = this.services.data;
    this.services.dashboard.ui = this.services.ui;
    this.services.tickets.dataService = this.services.data;
    this.services.tickets.ui = this.services.ui;

    // Global compatibility
    Object.entries(this.services).forEach(([key, service]) => {
      window[key === 'auth' ? 'authService' : 
             key === 'data' ? 'dataService' : 
             key === 'ui' ? 'uiComponents' : 
             key === 'dashboard' ? 'dashboardModule' : 'ticketRenderer'] = service;
    });
  }

  async checkAuthentication() {
    try {
      const isAuthenticated = await this.services.auth.initialize();
      if (!isAuthenticated) {
        this.showAuthError('Please log in to access the portal');
        return false;
      }
      this.currentUser = this.services.auth.getCurrentUser();
      window.currentUser = this.currentUser;
      return true;
    } catch (error) {
      this.showAuthError('Authentication failed: ' + error.message);
      return false;
    }
  }

  async loadApplicationData() {
    try {
      await this.services.data.refreshData();
    } catch (error) {
      this.services.ui.showToast('Failed to load some data. Please try refreshing.', 'warning');
    }
  }

  initializeUI() {
    this.services.ui.initialize();
    this.services.dashboard.initialize();
    this.services.tickets.initializeEventListeners();
    this.updateUserInterface();
  }

  setupEventListeners() {
    this.setupNavigationListeners();
    this.setupMobileMenu();
    this.setupSearchListeners();
    this.setupWindowListeners();
    this.setupKeyboardShortcuts();
  }

  setupNavigationListeners() {
    document.querySelectorAll('.nav-link[data-section], .card-action-link[data-section]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        this.navigateToSection(link.dataset.section);
      });
    });
  }

  setupMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const sidebar = document.querySelector('.dashboard-sidebar');
    
    if (mobileMenuBtn && sidebar) {
      mobileMenuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
      
      document.addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && !sidebar.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
          sidebar.classList.remove('open');
        }
      });
    }
  }

  setupSearchListeners() {
    const elements = {
      search: document.getElementById('ticket-search'),
      statusFilter: document.getElementById('status-filter'),
      priorityFilter: document.getElementById('priority-filter'),
      selectAll: document.getElementById('select-all')
    };

    ['search', 'statusFilter', 'priorityFilter'].forEach(key => {
      if (elements[key]) {
        elements[key].addEventListener(key === 'search' ? 'input' : 'change', 
          () => this.services.tickets.filterTickets());
      }
    });

    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', () => this.toggleView(btn.dataset.view));
    });

    if (elements.selectAll) {
      elements.selectAll.addEventListener('change', () => this.services.tickets.selectAllTickets());
    }

    // Delegate events
    document.addEventListener('change', (e) => {
      if (e.target.classList.contains('header-checkbox')) {
        this.services.tickets.selectAllTickets();
      } else if (e.target.classList.contains('row-checkbox')) {
        this.services.tickets.handleBulkSelection();
      }
    });

    document.addEventListener('click', (e) => {
      const sortableHeader = e.target.closest('.sortable[data-sort]');
      if (sortableHeader) {
        this.services.tickets.sortTickets(sortableHeader.dataset.sort);
      }
    });
  }

  setupWindowListeners() {
    window.addEventListener('resize', () => this.handleResize());
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && this.isInitialized) this.handleVisibilityChange();
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const ticketModal = document.getElementById('ticket-modal');
        const editModal = document.getElementById('edit-ticket-modal');
        if ((ticketModal?.style.display === 'flex') || (editModal?.style.display === 'flex')) return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'r' && !e.shiftKey) {
        e.preventDefault();
        this.refreshDashboard();
      }

      if (e.altKey) {
        const sections = { '1': 'dashboard', '2': 'tickets', '3': 'analytics' };
        if (sections[e.key]) {
          e.preventDefault();
          this.navigateToSection(sections[e.key]);
        }
      }
    });
  }

  navigateToSection(sectionName) {
    this.services.ui.navigateToSection(sectionName);
    if (sectionName === 'tickets') this.services.tickets.renderTicketsTable();
    else if (sectionName === 'analytics') this.services.dashboard.loadAssigneeStats();
  }

  toggleView(viewType) {
    this.services.ui.toggleView(viewType);
    this.services.tickets.renderTicketsTable();
  }

  handleResize() {
    if (window.innerWidth > 768) {
      document.querySelector('.dashboard-sidebar')?.classList.remove('open');
    }
  }

  async handleVisibilityChange() {
    try {
      await this.services.auth.initialize();
    } catch (error) {
      this.showAuthError('Session expired. Please log in again.');
    }
  }

  updateUserInterface() {
    if (!this.currentUser) return;
    
    const userName = this.currentUser.user_metadata?.full_name || this.currentUser.email;
    const userRole = this.currentUser.user_metadata?.role || 'User';

    document.querySelectorAll('#user-name').forEach(el => el.textContent = userName);
    document.querySelectorAll('#user-role').forEach(el => el.textContent = userRole);
  }

  async refreshDashboard() {
    try {
      this.services.ui.showToast('Refreshing dashboard...', 'info', 2000);
      await this.services.data.refreshData();
      await this.services.dashboard.loadDashboardData();
      this.services.tickets.renderTicketsTable();
      this.services.ui.showToast('Dashboard refreshed successfully', 'success');
    } catch (error) {
      this.services.ui.showToast('Failed to refresh dashboard', 'error');
    }
  }

  showLoading() {
    const loadingScreen = document.getElementById('loading-screen');
    if (loadingScreen) {
      loadingScreen.style.display = 'flex';
      loadingScreen.classList.remove('hidden');
    }
  }

  showDashboard() {
    const screens = ['loading-screen', 'auth-error', 'init-error'];
    screens.forEach(id => {
      const screen = document.getElementById(id);
      if (screen) screen.style.display = 'none';
    });
    
    const dashboardContainer = document.getElementById('dashboard-container');
    if (dashboardContainer) dashboardContainer.style.display = 'flex';
  }

  showAuthError(message) {
    this.showError('auth-error', 'auth-error-message', message);
  }

  showInitError(message) {
    this.showError('init-error', 'init-error-message', message);
  }

  showError(errorId, messageId, message) {
    const errorScreen = document.getElementById(errorId);
    const messageElement = document.getElementById(messageId);
    
    if (messageElement) messageElement.textContent = message;
    if (errorScreen) errorScreen.style.display = 'flex';
    
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('dashboard-container').style.display = 'none';
  }
}

// === GLOBAL FUNCTIONS ===
window.handleLogout = async () => window.authService?.signOut();
window.refreshDashboard = async () => window.app?.refreshDashboard();
window.clearFilters = () => window.ticketRenderer?.clearFilters();
window.redirectToLogin = () => {
  localStorage.clear();
  sessionStorage.clear();
  window.location.href = 'login.html';
};
window.retryAuthentication = () => window.location.reload();

// === APPLICATION STARTUP ===
document.addEventListener('DOMContentLoaded', async () => {
  const app = new HISPortalApp();
  window.app = app;
  
  try {
    await app.initialize();
  } catch (error) {
    app.showInitError('Critical error during initialization. Please refresh the page.');
  }
});

// ES6 module export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = HISPortalApp;
}