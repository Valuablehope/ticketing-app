// === HIS PORTAL MAIN DASHBOARD ===
document.addEventListener('DOMContentLoaded', async () => {
  // Config
  const { url, anonKey } = window.SUPABASE_CONFIG || {};

  // State
  let supabaseClient, currentUser, tickets = [], bases = {}, categories = {}, users = {};

  // DOM elements
  const screens = {
    loading: document.getElementById('loading-screen'),
    dashboard: document.getElementById('dashboard-container'),
    authError: document.getElementById('auth-error'),
    initError: document.getElementById('init-error')
  };

  // Initialize Supabase
  try {
    if (typeof supabase === 'undefined') throw new Error('Supabase library not loaded');
    supabaseClient = supabase.createClient(url, anonKey);
  } catch (err) {
    return showInitError('Failed to initialize authentication service');
  }

  // Authentication check
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) throw new Error('Session verification failed');
    if (!session?.user) return showAuthError('Please log in to access the portal');
    
    currentUser = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.full_name || session.user.email,
      role: session.user.user_metadata?.role || 'User'
    };
  } catch (err) {
    return showAuthError('Authentication failed: ' + err.message);
  }

  // Load data
  try {
    await Promise.all([loadLookupData(), loadTickets()]);
  } catch (err) {
    return showInitError('Failed to load portal data');
  }

  // Initialize UI
  showDashboard();
  updateUserInfo();
  renderDashboardStats();
  renderRecentTickets();
  renderTicketsList();
  initializeEventListeners();
  showToast('Portal loaded successfully', 'success');

  // Data loaders
  async function loadLookupData() {
    try {
      const [basesData, categoriesData, usersData] = await Promise.all([
        supabaseClient.from('bases').select('id, name').order('name'),
        supabaseClient.from('ticket_cats').select('id, name').order('name'),
        supabaseClient.from('his_users').select('id, email, full_name, role').order('full_name')
      ]);
      
      bases = basesData.data ? Object.fromEntries(basesData.data.map(b => [b.id, b.name])) : {};
      categories = categoriesData.data ? Object.fromEntries(categoriesData.data.map(c => [c.id, c.name])) : {};
      users = usersData.data ? Object.fromEntries(usersData.data.map(u => [u.id, u])) : {};
    } catch (err) {
      console.error('Lookup data error:', err);
      bases = {}; categories = {}; users = {};
    }
  }

  async function loadTickets() {
    try {
      const { data: ticketsData, error } = await supabaseClient
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error && error.code !== '42P01') throw error;
      
      tickets = (ticketsData || []).map(ticket => ({
        ...ticket,
        assigned_to_name: ticket.assigned_to ? (users[ticket.assigned_to]?.full_name || `User ${ticket.assigned_to}`) : null
      }));
    } catch (err) {
      console.error('Tickets load error:', err);
      tickets = [];
    }
  }

  // Dashboard functions
  function renderDashboardStats() {
    const stats = {
      total: tickets.length,
      open: tickets.filter(t => ['Open', 'In Progress'].includes(t.status)).length,
      resolvedToday: tickets.filter(t => {
        if (t.status !== 'Resolved') return false;
        return new Date().toDateString() === new Date(t.updated_at).toDateString();
      }).length,
      avgResolution: calculateAvgResolution()
    };

    setText('total-tickets', stats.total);
    setText('open-tickets', stats.open);
    setText('resolved-today', stats.resolvedToday);
    setText('avg-resolution', stats.avgResolution);
  }

  function calculateAvgResolution() {
    const resolved = tickets.filter(t => t.status === 'Resolved' && t.resolved_at);
    if (resolved.length === 0) return '0h';
    
    const totalTime = resolved.reduce((sum, t) => {
      return sum + (new Date(t.resolved_at) - new Date(t.created_at));
    }, 0);
    
    return Math.round(totalTime / resolved.length / (1000 * 60 * 60)) + 'h';
  }

  function renderRecentTickets() {
    const container = document.getElementById('recent-tickets');
    if (!container) return;
    
    const recentTickets = tickets.slice(0, 5);
    if (recentTickets.length === 0) {
      container.innerHTML = '<p>No tickets found. <a href="public/ticket-submission.html">Create your first ticket</a></p>';
      return;
    }

    container.innerHTML = recentTickets.map(ticket => `
      <div class="recent-ticket-item" onclick="showTicketDetails('${ticket.id}')">
        <div class="ticket-info">
          <h4>${ticket.title}</h4>
          <p>Ticket #${ticket.ticket_number || ticket.id.slice(0, 8)}</p>
          <p>Assigned to: ${ticket.assigned_to_name || 'Unassigned'}</p>
        </div>
        <div class="ticket-status">${ticket.status}</div>
      </div>
    `).join('');
  }

  function renderTicketsList(filteredList = null) {
    const container = document.getElementById('tickets-list');
    if (!container) return;
    
    const list = filteredList || tickets;
    if (list.length === 0) {
      container.innerHTML = `
        <div class="no-tickets">
          <h3>No tickets found</h3>
          <p>Get started by creating your first support ticket.</p>
          <a href="public/ticket-submission.html" class="btn btn-primary">Create New Ticket</a>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <table class="tickets-table">
        <thead>
          <tr>
            <th>ID</th><th>Title</th><th>Status</th><th>Priority</th><th>Assigned To</th><th>Created</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(ticket => `
            <tr>
              <td>${ticket.ticket_number || ticket.id.slice(0, 8)}</td>
              <td>${ticket.title}</td>
              <td><span class="status-badge status-${sanitize(ticket.status)}">${ticket.status}</span></td>
              <td><span class="priority-badge priority-${sanitize(ticket.priority)}">${ticket.priority}</span></td>
              <td>${ticket.assigned_to_name || 'Unassigned'}</td>
              <td>${new Date(ticket.created_at).toLocaleDateString()}</td>
              <td><button class="btn btn-sm" onclick="showTicketDetails('${ticket.id}')">View</button></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function filterTickets() {
    const searchTerm = (getVal('ticket-search') || '').toLowerCase();
    const statusFilter = getVal('status-filter') || '';
    const priorityFilter = getVal('priority-filter') || '';
    
    const filtered = tickets.filter(ticket => {
      const matchesSearch = !searchTerm || [
        ticket.title, ticket.description, ticket.submitter_name,
        ticket.assigned_to_name, ticket.ticket_number
      ].some(field => field?.toLowerCase().includes(searchTerm));
      
      const matchesStatus = !statusFilter || ticket.status === statusFilter;
      const matchesPriority = !priorityFilter || ticket.priority === priorityFilter;
      
      return matchesSearch && matchesStatus && matchesPriority;
    });
    
    renderTicketsList(filtered);
  }

  function initializeEventListeners() {
    // Navigation
    document.querySelectorAll('.nav-link[data-section]').forEach(link => {
      link.addEventListener('click', e => {
        e.preventDefault();
        navigateToSection(link.dataset.section);
      });
    });

    // Search & filters
    ['ticket-search', 'status-filter', 'priority-filter'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(id === 'ticket-search' ? 'input' : 'change', filterTickets);
    });

    // Modal close
    const ticketModal = document.getElementById('ticket-modal');
    if (ticketModal) {
      ticketModal.addEventListener('click', e => {
        if (e.target.id === 'ticket-modal') closeTicketModal();
      });
    }

    // Auth state change
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) handleSignOut();
    });

    // Escape key
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeTicketModal();
    });
  }

  function navigateToSection(sectionName) {
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelector(`[data-section="${sectionName}"]`)?.classList.add('active');
    
    // Update sections
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`${sectionName}-section`)?.classList.add('active');
    
    // Update page title
    const titleMap = {
      dashboard: { title: 'Dashboard', subtitle: 'Overview of all tickets and system metrics' },
      tickets: { title: 'All Tickets', subtitle: 'Manage and track all support tickets' },
      analytics: { title: 'Analytics & Reports', subtitle: 'Detailed insights and performance metrics' }
    };
    
    const info = titleMap[sectionName] || titleMap.dashboard;
    setText('page-title', info.title);
    setText('page-subtitle', info.subtitle);
  }

  // Global functions
  window.showTicketDetails = function(ticketId) {
    const ticket = tickets.find(t => t.id === ticketId);
    if (!ticket) return showToast('Ticket not found', 'error');
    
    const modal = document.getElementById('ticket-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    
    if (!modal || !modalTitle || !modalBody) return;
    
    modalTitle.textContent = `Ticket ${ticket.ticket_number || ticket.id.slice(0, 8)}`;
    
    const baseName = bases[ticket.base_id] || 'Unknown';
    const categoryName = categories[ticket.category_id] || 'Unknown';
    const assignedToName = ticket.assigned_to_name || 'Unassigned';
    
    modalBody.innerHTML = `
      <div class="ticket-detail-grid">
        <div class="detail-section">
          <h4>Basic Information</h4>
          <div class="detail-item"><label>Title</label><p>${ticket.title}</p></div>
          <div class="detail-item"><label>Description</label><p>${ticket.description}</p></div>
          <div class="detail-item"><label>Status</label><p><span class="status-badge status-${sanitize(ticket.status)}">${ticket.status}</span></p></div>
          <div class="detail-item"><label>Priority</label><p><span class="priority-badge priority-${sanitize(ticket.priority)}">${ticket.priority}</span></p></div>
        </div>
        <div class="detail-section">
          <h4>Assignment & Location</h4>
          <div class="detail-item"><label>Base/Location</label><p>${baseName}</p></div>
          <div class="detail-item"><label>Category</label><p>${categoryName}</p></div>
          <div class="detail-item"><label>Assigned To</label><p>${assignedToName}</p></div>
        </div>
        <div class="detail-section">
          <h4>Submitter Information</h4>
          <div class="detail-item"><label>Name</label><p>${ticket.submitter_name}</p></div>
          <div class="detail-item"><label>Email</label><p>${ticket.submitter_email}</p></div>
        </div>
        <div class="detail-section">
          <h4>Timeline</h4>
          <div class="detail-item"><label>Created</label><p>${formatDate(ticket.created_at)}</p></div>
          <div class="detail-item"><label>Last Updated</label><p>${formatDate(ticket.updated_at)}</p></div>
        </div>
      </div>
    `;
    
    modal.style.display = 'flex';
  };

  window.closeTicketModal = () => {
    const modal = document.getElementById('ticket-modal');
    if (modal) modal.style.display = 'none';
  };

  window.handleLogout = async () => {
    try {
      await supabaseClient.auth.signOut();
      handleSignOut();
    } catch (err) {
      handleSignOut();
    }
  };

  window.refreshDashboard = async () => {
    showToast('Refreshing dashboard...', 'info', 2000);
    await Promise.all([loadLookupData(), loadTickets()]);
    renderDashboardStats();
    renderRecentTickets();
    renderTicketsList();
    showToast('Dashboard refreshed successfully', 'success');
  };

  window.clearFilters = () => {
    setVal('ticket-search', '');
    setVal('status-filter', '');
    setVal('priority-filter', '');
    renderTicketsList();
  };

  window.redirectToLogin = handleSignOut;
  window.retryAuthentication = () => window.location.reload();

  // Utility functions
  function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function setVal(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
  }

  function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value : '';
  }

  function sanitize(txt) {
    return txt ? txt.toLowerCase().replace(/\s+/g, '-') : '';
  }

  function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function showToast(message, type = 'info', duration = 5000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
      if (toast.parentNode) toast.remove();
    }, duration);
  }

  function showAuthError(message) {
    setText('auth-error-message', message);
    showScreen('authError');
  }

  function showInitError(message) {
    setText('init-error-message', message);
    showScreen('initError');
  }

  function showDashboard() {
    showScreen('dashboard');
  }

  function showScreen(screenName) {
    Object.values(screens).forEach(screen => {
      if (screen) screen.style.display = 'none';
    });
    
    if (screens[screenName]) {
      screens[screenName].style.display = screenName === 'dashboard' ? 'flex' : 'flex';
    }
  }

  function handleSignOut() {
    localStorage.clear();
    sessionStorage.clear();
    window.location.href = 'login.html';
  }

  function updateUserInfo() {
    if (currentUser) {
      setText('user-name', currentUser.name);
      setText('user-role', currentUser.role);
    }
  }
});