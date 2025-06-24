// === HIS PORTAL MAIN DASHBOARD SCRIPT ===

document.addEventListener('DOMContentLoaded', async () => {
  // ---- CONFIG ----
  const SUPABASE_URL = 'https://rkdblbnmtzyrapfemswq.supabase.co';
  const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZGJsYm5tdHp5cmFwZmVtc3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1ODQyNTgsImV4cCI6MjA2NjE2MDI1OH0.TY7Ml-S-knKMNQ-HKylGLbpXIu9wHqGAZDHHAq4rRJc';

  // ---- STATE ----
  let supabaseClient;
  let currentUser = null;
  let tickets = [];
  let bases = {};
  let categories = {};
  let users = {}; // Add users lookup

  // ---- DOM REFS ----
  const loadingScreen = document.getElementById('loading-screen');
  const dashboardContainer = document.getElementById('dashboard-container');
  const authError = document.getElementById('auth-error');
  const initError = document.getElementById('init-error');

  // ---- INIT SUPABASE ----
  try {
    if (typeof supabase === 'undefined') throw new Error('Supabase library not loaded');
    supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch (err) {
    showInitError('Failed to initialize authentication service');
    return;
  }

  // ---- AUTH CHECK ----
  try {
    const { data: { session }, error } = await supabaseClient.auth.getSession();
    if (error) throw new Error('Session verification failed');
    if (!session || !session.user) {
      showAuthError('Please log in to access the portal');
      return;
    }
    currentUser = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.user_metadata?.full_name || session.user.email,
      role: session.user.user_metadata?.role || 'User'
    };
  } catch (err) {
    showAuthError('Authentication failed: ' + err.message);
    return;
  }

  // ---- LOAD DATA ----
  try {
    await Promise.all([loadLookupData(), loadTickets()]);
  } catch (err) {
    showInitError('Failed to load portal data');
    return;
  }

  // ---- RENDER UI ----
  showDashboard();
  updateUserInfo();
  renderDashboardStats();
  renderRecentTickets();
  renderTicketsList();
  initializeEventListeners();

  showToast('Portal loaded successfully', 'success');

  // ---- LOADERS ----

  async function loadLookupData() {
    try {
      const [
        { data: basesData },
        { data: categoriesData },
        { data: usersData }
      ] = await Promise.all([
        supabaseClient.from('bases').select('id, name').order('name'),
        supabaseClient.from('ticket_cats').select('id, name').order('name'),
        supabaseClient.from('his_users').select('id, email, full_name, role').order('full_name') // Changed from profiles to his_users
      ]);
      
      bases = basesData ? Object.fromEntries(basesData.map(b => [b.id, b.name])) : {};
      categories = categoriesData ? Object.fromEntries(categoriesData.map(c => [c.id, c.name])) : {};
      users = usersData ? Object.fromEntries(usersData.map(u => [u.id, u])) : {}; // Create users lookup
      
      
    } catch (err) {
      bases = {};
      categories = {};
      users = {};
      
    }
  }

  async function loadTickets() {
    try {
      const { data: ticketsData, error } = await supabaseClient
        .from('tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (error && error.code !== '42P01') throw error;
      
      // Enrich tickets with user full names
      tickets = (ticketsData || []).map(ticket => ({
        ...ticket,
        assigned_to_name: ticket.assigned_to ? (users[ticket.assigned_to]?.full_name || `User ${ticket.assigned_to}`) : null
      }));
    } catch (err) {
      tickets = [];
    }
  }

  // ---- UTILITY FUNCTION TO GET USER NAME ----
  function getUserName(userId) {
    if (!userId) return 'Unassigned';
    return users[userId]?.full_name || `User ${userId}`;
  }

  // ---- DASHBOARD ----

  function renderDashboardStats() {
    const stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length,
      resolvedToday: tickets.filter(t => {
        if (t.status !== 'Resolved') return false;
        const today = new Date().toDateString();
        const updatedDate = new Date(t.updated_at).toDateString();
        return today === updatedDate;
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
      const created = new Date(t.created_at), resolvedAt = new Date(t.resolved_at);
      return sum + (resolvedAt - created);
    }, 0);
    const avgMs = totalTime / resolved.length;
    return Math.round(avgMs / (1000 * 60 * 60)) + 'h';
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
            <th>ID</th>
            <th>Title</th>
            <th>Status</th>
            <th>Priority</th>
            <th>Assigned To</th>
            <th>Created</th>
            <th>Actions</th>
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
              <td>
                <button class="btn btn-sm" onclick="showTicketDetails('${ticket.id}')">View</button>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  // ---- SEARCH & FILTERS ----

  function filterTickets() {
    const searchTerm = (getVal('ticket-search') || '').toLowerCase();
    const statusFilter = getVal('status-filter') || '';
    const priorityFilter = getVal('priority-filter') || '';
    const filtered = tickets.filter(ticket => {
      const matchesSearch =
        !searchTerm ||
        ticket.title.toLowerCase().includes(searchTerm) ||
        ticket.description.toLowerCase().includes(searchTerm) ||
        ticket.submitter_name?.toLowerCase().includes(searchTerm) ||
        ticket.assigned_to_name?.toLowerCase().includes(searchTerm) || // Include assigned user name in search
        (ticket.ticket_number && ticket.ticket_number.toLowerCase().includes(searchTerm));
      const matchesStatus = !statusFilter || ticket.status === statusFilter;
      const matchesPriority = !priorityFilter || ticket.priority === priorityFilter;
      return matchesSearch && matchesStatus && matchesPriority;
    });
    renderTicketsList(filtered);
  }

  // ---- EVENTS ----

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
    // Auth state
    supabaseClient.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session) handleSignOut();
    });
    // Esc key to close modal
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') closeTicketModal();
    });
  }

  function navigateToSection(sectionName) {
    document.querySelectorAll('.nav-link').forEach(link => link.classList.remove('active'));
    document.querySelector(`[data-section="${sectionName}"]`)?.classList.add('active');
    document.querySelectorAll('.content-section').forEach(sec => sec.classList.remove('active'));
    document.getElementById(`${sectionName}-section`)?.classList.add('active');
    // Page title (optional)
    const titleMap = {
      dashboard: { title: 'Dashboard', subtitle: 'Overview of all tickets and system metrics' },
      tickets: { title: 'All Tickets', subtitle: 'Manage and track all support tickets' },
      analytics: { title: 'Analytics & Reports', subtitle: 'Detailed insights and performance metrics' }
    };
    const info = titleMap[sectionName] || titleMap.dashboard;
    setText('page-title', info.title);
    setText('page-subtitle', info.subtitle);
  }

  // ---- GLOBAL FUNCTIONS (window.*) ----

  window.showTicketDetails = function (ticketId) {
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

  window.closeTicketModal = function () {
    const modal = document.getElementById('ticket-modal');
    if (modal) modal.style.display = 'none';
  };

  window.handleLogout = async function () {
    try {
      await supabaseClient.auth.signOut();
      handleSignOut();
    } catch (err) {
      handleSignOut();
    }
  };

  window.refreshDashboard = async function () {
    showToast('Refreshing dashboard...', 'info', 2000);
    await Promise.all([loadLookupData(), loadTickets()]);
    renderDashboardStats();
    renderRecentTickets();
    renderTicketsList();
    showToast('Dashboard refreshed successfully', 'success');
  };

  window.clearFilters = function () {
    setVal('ticket-search', '');
    setVal('status-filter', '');
    setVal('priority-filter', '');
    renderTicketsList();
  };

  window.redirectToLogin = function () {
    handleSignOut();
  };

  window.retryAuthentication = function () {
    window.location.reload();
  };

  // ---- UTILITY ----

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
    loadingScreen.style.display = 'none';
    authError.style.display = 'flex';
    dashboardContainer.style.display = 'none';
  }

  function showInitError(message) {
    setText('init-error-message', message);
    loadingScreen.style.display = 'none';
    initError.style.display = 'flex';
    dashboardContainer.style.display = 'none';
  }

  function showDashboard() {
    loadingScreen.style.display = 'none';
    authError.style.display = 'none';
    initError.style.display = 'none';
    dashboardContainer.style.display = 'flex';
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