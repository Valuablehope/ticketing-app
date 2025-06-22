// === GLOBAL VARIABLES ===
// Move dashboardData to global scope
let dashboardData = {
  tickets: [],
  bases: {},
  categories: {},
  users: {},
  teams: {},
  departments: {},
  currentPage: 1,
  itemsPerPage: 10,
  filteredTickets: [],
  sortField: 'created_at',
  sortDirection: 'desc'
};

// Supabase client - will be initialized in DOMContentLoaded
let supabaseClient;

// === TICKETS TABLE ===

/**
 * Render tickets table with enhanced design
 */
function renderTicketsTable() {
  const currentView = document.querySelector('.view-btn.active')?.dataset?.view || 'table';
  
  if (currentView === 'table') {
    renderTableView();
  } else {
    renderCardsView();
  }
  
  updatePagination();
  updateEmptyState();
}

/**
 * Render table view
 */
function renderTableView() {
  const tbody = document.querySelector('#tickets-table tbody');
  if (!tbody) return;
  
  tbody.innerHTML = '';

  const startIndex = (dashboardData.currentPage - 1) * dashboardData.itemsPerPage;
  const endIndex = startIndex + dashboardData.itemsPerPage;
  const pageTickets = dashboardData.filteredTickets.slice(startIndex, endIndex);

  pageTickets.forEach(ticket => {
    const row = document.createElement('tr');
    row.dataset.ticketId = ticket.id;
    
    const baseName = dashboardData.bases[ticket.base_id] || 'Unknown';
    const categoryName = dashboardData.categories[ticket.category_id] || 'Unknown';
    const assigneeData = ticket.assigned_to ? dashboardData.users[ticket.assigned_to] : null;
    const assigneeName = assigneeData?.name || 'Unassigned';
    const assigneeRole = assigneeData?.role || '';
    const assigneeInitials = assigneeData?.name ? assigneeData.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U';

    row.innerHTML = `
      <td class="checkbox-col">
        <input type="checkbox" class="row-checkbox" data-ticket-id="${ticket.id}">
      </td>
      <td class="ticket-id-cell">${ticket.ticket_number || ticket.id}</td>
      <td class="ticket-title-cell">
        <div class="ticket-title-main">${ticket.title}</div>
        <div class="ticket-description">${ticket.description}</div>
      </td>
      <td class="status-col">${getStatusBadge(ticket.status)}</td>
      <td class="priority-col">${getPriorityBadge(ticket.priority)}</td>
      <td class="assignee-col">
        <div class="assignee-cell">
          <div class="assignee-avatar">${assigneeInitials}</div>
          <div class="assignee-info">
            <div class="assignee-name">${assigneeName}</div>
            ${assigneeRole ? `<div class="assignee-role">${assigneeRole}</div>` : ''}
          </div>
        </div>
      </td>
      <td class="location-col">
        <div class="location-cell">
          <div class="location-name">${baseName}</div>
          <div class="category-name">${categoryName}</div>
        </div>
      </td>
      <td class="created-col">${formatDate(ticket.created_at)}</td>
      <td class="actions-col">
        <div class="actions-cell">
          <button class="action-btn view" onclick="showTicketModal('${ticket.id}')">View</button>
          <button class="action-btn edit" onclick="editTicket('${ticket.id}')">Edit</button>
        </div>
      </td>
    `;
    
    // Add click handler for row selection
    row.addEventListener('click', (e) => {
      if (e.target.type !== 'checkbox' && !e.target.closest('.action-btn')) {
        showTicketModal(ticket.id);
      }
    });
    
    tbody.appendChild(row);
  });
}

/**
 * Render cards view
 */
function renderCardsView() {
  const container = document.getElementById('tickets-cards');
  if (!container) return;
  
  container.innerHTML = '';

  const startIndex = (dashboardData.currentPage - 1) * dashboardData.itemsPerPage;
  const endIndex = startIndex + dashboardData.itemsPerPage;
  const pageTickets = dashboardData.filteredTickets.slice(startIndex, endIndex);

  pageTickets.forEach(ticket => {
    const card = document.createElement('div');
    card.className = 'ticket-card';
    card.dataset.ticketId = ticket.id;
    
    const baseName = dashboardData.bases[ticket.base_id] || 'Unknown';
    const categoryName = dashboardData.categories[ticket.category_id] || 'Unknown';
    const assigneeData = ticket.assigned_to ? dashboardData.users[ticket.assigned_to] : null;
    const assigneeName = assigneeData?.name || 'Unassigned';
    const assigneeInitials = assigneeData?.name ? assigneeData.name.split(' ').map(n => n[0]).join('').toUpperCase() : 'U';

    card.innerHTML = `
      <div class="ticket-card-header">
        <div class="ticket-card-id">${ticket.ticket_number || ticket.id}</div>
        <input type="checkbox" class="ticket-card-checkbox row-checkbox" data-ticket-id="${ticket.id}">
      </div>
      
      <div class="ticket-card-title">${ticket.title}</div>
      <div class="ticket-card-description">${ticket.description}</div>
      
      <div class="ticket-card-meta">
        ${getStatusBadge(ticket.status)}
        ${getPriorityBadge(ticket.priority)}
        <span class="meta-item">${baseName}</span>
        <span class="meta-item">${categoryName}</span>
      </div>
      
      <div class="ticket-card-footer">
        <div class="ticket-card-assignee">
          <div class="assignee-avatar">${assigneeInitials}</div>
          <span>${assigneeName}</span>
        </div>
        <div class="ticket-card-date">${formatDate(ticket.created_at)}</div>
      </div>
    `;
    
    // Add click handler
    card.addEventListener('click', (e) => {
      if (e.target.type !== 'checkbox') {
        showTicketModal(ticket.id);
      }
    });
    
    container.appendChild(card);
  });
}

// === UTILITY FUNCTIONS ===

/**
 * Show toast notification
 */
function showToast(message, type = 'info', duration = 5000) {
  const toastContainer = document.getElementById('toast-container');
  if (!toastContainer) return;
  
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const iconMap = {
    success: `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>
              </svg>`,
    error: `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
            </svg>`,
    warning: `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z"></path>
              </svg>`,
    info: `<svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
             <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
           </svg>`
  };

  toast.innerHTML = `
    ${iconMap[type] || iconMap.info}
    <div class="toast-content">
      <p>${message}</p>
    </div>
  `;

  toastContainer.appendChild(toast);

  // Auto remove
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.animation = 'fadeOut 0.3s ease-in forwards';
      setTimeout(() => toast.remove(), 300);
    }
  }, duration);
}

/**
 * Format date for display
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

/**
 * Format status badge
 */
function getStatusBadge(status) {
  const statusClass = status.toLowerCase().replace(/\s+/g, '-');
  return `<span class="ticket-status ${statusClass}">${status}</span>`;
}

/**
 * Format priority badge
 */
function getPriorityBadge(priority) {
  const priorityClass = priority.toLowerCase();
  return `<span class="ticket-priority ${priorityClass}">${priority}</span>`;
}

/**
 * Get priority dot
 */
function getPriorityDot(priority) {
  const priorityClass = priority.toLowerCase();
  return `<div class="ticket-priority-dot ${priorityClass}"></div>`;
}

/**
 * Get status indicator
 */
function getStatusIndicator(status) {
  const statusClass = status.toLowerCase().replace(/\s+/g, '-');
  return `<div class="status-indicator ${statusClass}"></div>`;
}

/**
 * Update empty state visibility
 */
function updateEmptyState() {
  const emptyState = document.getElementById('empty-state');
  const tableView = document.getElementById('table-view');
  const cardsView = document.getElementById('cards-view');
  
  if (!emptyState || !tableView || !cardsView) return;
  
  if (dashboardData.filteredTickets.length === 0) {
    emptyState.style.display = 'block';
    tableView.style.display = 'none';
    cardsView.style.display = 'none';
  } else {
    emptyState.style.display = 'none';
    const currentView = document.querySelector('.view-btn.active')?.dataset?.view || 'table';
    if (currentView === 'table') {
      tableView.style.display = 'block';
      cardsView.style.display = 'none';
    } else {
      tableView.style.display = 'none';
      cardsView.style.display = 'block';
    }
  }
}

/**
 * Toggle view between table and cards
 */
function toggleView(viewType) {
  // Update view buttons
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const targetBtn = document.querySelector(`[data-view="${viewType}"]`);
  if (targetBtn) {
    targetBtn.classList.add('active');
  }

  // Update views
  const tableView = document.getElementById('table-view');
  const cardsView = document.getElementById('cards-view');
  
  if (tableView && cardsView) {
    if (viewType === 'table') {
      tableView.classList.add('active');
      cardsView.classList.remove('active');
    } else {
      tableView.classList.remove('active');
      cardsView.classList.add('active');
    }
  }

  // Re-render with new view
  renderTicketsTable();
}

/**
 * Handle bulk selection
 */
function handleBulkSelection() {
  const selectAllCheckbox = document.getElementById('select-all');
  const headerCheckbox = document.querySelector('.header-checkbox');
  const rowCheckboxes = document.querySelectorAll('.row-checkbox');
  const bulkActionBtn = document.querySelector('.bulk-action-btn');
  
  if (!selectAllCheckbox || !bulkActionBtn) return;
  
  const checkedCount = Array.from(rowCheckboxes).filter(cb => cb.checked).length;
  const totalCount = rowCheckboxes.length;
  
  // Update select all checkbox state
  if (checkedCount === 0) {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    if (headerCheckbox) {
      headerCheckbox.checked = false;
      headerCheckbox.indeterminate = false;
    }
  } else if (checkedCount === totalCount) {
    selectAllCheckbox.checked = true;
    selectAllCheckbox.indeterminate = false;
    if (headerCheckbox) {
      headerCheckbox.checked = true;
      headerCheckbox.indeterminate = false;
    }
  } else {
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = true;
    if (headerCheckbox) {
      headerCheckbox.checked = false;
      headerCheckbox.indeterminate = true;
    }
  }
  
  // Update bulk action button
  bulkActionBtn.disabled = checkedCount === 0;
  bulkActionBtn.textContent = checkedCount > 0 ? `Actions (${checkedCount})` : 'Actions';
  
  // Update selected rows styling
  document.querySelectorAll('.tickets-table tbody tr, .ticket-card').forEach(row => {
    const checkbox = row.querySelector('.row-checkbox');
    if (checkbox?.checked) {
      row.classList.add('selected');
    } else {
      row.classList.remove('selected');
    }
  });
}

/**
 * Select all tickets
 */
function selectAllTickets() {
  const selectAllCheckbox = document.getElementById('select-all');
  const headerCheckbox = document.querySelector('.header-checkbox');
  const rowCheckboxes = document.querySelectorAll('.row-checkbox');
  
  if (!selectAllCheckbox) return;
  
  const shouldCheck = selectAllCheckbox.checked || (headerCheckbox && headerCheckbox.checked);
  
  rowCheckboxes.forEach(checkbox => {
    checkbox.checked = shouldCheck;
  });
  
  handleBulkSelection();
}

/**
 * Clear all filters
 */
function clearFilters() {
  const searchInput = document.getElementById('ticket-search');
  const statusFilter = document.getElementById('status-filter');
  const priorityFilter = document.getElementById('priority-filter');
  
  if (searchInput) searchInput.value = '';
  if (statusFilter) statusFilter.value = '';
  if (priorityFilter) priorityFilter.value = '';
  
  filterTickets();
}

/**
 * Filter tickets
 */
function filterTickets() {
  const searchInput = document.getElementById('ticket-search');
  const statusFilter = document.getElementById('status-filter');
  const priorityFilter = document.getElementById('priority-filter');
  
  const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
  const statusFilterValue = statusFilter ? statusFilter.value : '';
  const priorityFilterValue = priorityFilter ? priorityFilter.value : '';

  dashboardData.filteredTickets = dashboardData.tickets.filter(ticket => {
    const matchesSearch = !searchTerm || 
      ticket.title.toLowerCase().includes(searchTerm) ||
      ticket.description.toLowerCase().includes(searchTerm) ||
      ticket.submitter_name.toLowerCase().includes(searchTerm) ||
      (ticket.ticket_number && ticket.ticket_number.toLowerCase().includes(searchTerm));

    const matchesStatus = !statusFilterValue || ticket.status === statusFilterValue;
    const matchesPriority = !priorityFilterValue || ticket.priority === priorityFilterValue;

    return matchesSearch && matchesStatus && matchesPriority;
  });

  dashboardData.currentPage = 1;
  renderTicketsTable();
}

/**
 * Enhanced sort tickets with visual feedback
 */
function sortTickets(field) {
  if (dashboardData.sortField === field) {
    dashboardData.sortDirection = dashboardData.sortDirection === 'asc' ? 'desc' : 'asc';
  } else {
    dashboardData.sortField = field;
    dashboardData.sortDirection = 'desc'; // Default to descending for most fields
  }

  dashboardData.filteredTickets.sort((a, b) => {
    let aVal = a[field];
    let bVal = b[field];

    // Handle different data types
    if (field === 'created_at' || field === 'updated_at') {
      aVal = new Date(aVal);
      bVal = new Date(bVal);
    } else if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
    }

    if (aVal < bVal) return dashboardData.sortDirection === 'asc' ? -1 : 1;
    if (aVal > bVal) return dashboardData.sortDirection === 'asc' ? 1 : -1;
    return 0;
  });

  // Update sort indicators
  document.querySelectorAll('.tickets-table th.sortable').forEach(th => {
    th.classList.remove('sorted', 'desc');
  });
  
  const sortedHeader = document.querySelector(`[data-sort="${field}"]`);
  if (sortedHeader) {
    sortedHeader.classList.add('sorted');
    if (dashboardData.sortDirection === 'desc') {
      sortedHeader.classList.add('desc');
    }
  }

  renderTicketsTable();
}

/**
 * Update pagination controls
 */
function updatePagination() {
  const totalItems = dashboardData.filteredTickets.length;
  const totalPages = Math.ceil(totalItems / dashboardData.itemsPerPage);
  const currentPage = dashboardData.currentPage;

  // Update pagination info
  const startItem = totalItems > 0 ? (currentPage - 1) * dashboardData.itemsPerPage + 1 : 0;
  const endItem = Math.min(currentPage * dashboardData.itemsPerPage, totalItems);
  
  const showingElement = document.getElementById('pagination-showing');
  const totalElement = document.getElementById('pagination-total');
  
  if (showingElement) showingElement.textContent = `${startItem}-${endItem}`;
  if (totalElement) totalElement.textContent = totalItems;

  // Update pagination buttons
  const prevBtn = document.getElementById('prev-page');
  const nextBtn = document.getElementById('next-page');
  
  if (prevBtn) prevBtn.disabled = currentPage <= 1;
  if (nextBtn) nextBtn.disabled = currentPage >= totalPages;

  // Update page numbers
  const numbersContainer = document.getElementById('pagination-numbers');
  if (numbersContainer) {
    numbersContainer.innerHTML = '';

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `page-number ${i === currentPage ? 'active' : ''}`;
      pageBtn.textContent = i;
      pageBtn.onclick = () => goToPage(i);
      numbersContainer.appendChild(pageBtn);
    }
  }
}

/**
 * Go to specific page
 */
function goToPage(page) {
  dashboardData.currentPage = page;
  renderTicketsTable();
}

// === NAVIGATION ===

/**
 * Handle navigation between sections
 */
function navigateToSection(sectionName) {
  const navLinks = document.querySelectorAll('.nav-link');
  const contentSections = document.querySelectorAll('.content-section');
  const pageTitle = document.getElementById('page-title');
  const pageSubtitle = document.getElementById('page-subtitle');
  const sidebar = document.querySelector('.dashboard-sidebar');
  
  // Update nav links
  navLinks.forEach(link => {
    link.classList.remove('active');
    if (link.dataset.section === sectionName) {
      link.classList.add('active');
    }
  });

  // Update content sections
  contentSections.forEach(section => {
    section.classList.remove('active');
  });

  const targetSection = document.getElementById(`${sectionName}-section`);
  if (targetSection) {
    targetSection.classList.add('active');
  }

  // Update page title
  const titleMap = {
    dashboard: { title: 'Dashboard', subtitle: 'Overview of all tickets and system metrics' },
    tickets: { title: 'All Tickets', subtitle: 'Manage and track all support tickets' },
    analytics: { title: 'Analytics & Reports', subtitle: 'Detailed insights and performance metrics' }
  };

  const pageInfo = titleMap[sectionName] || titleMap.dashboard;
  if (pageTitle) pageTitle.textContent = pageInfo.title;
  if (pageSubtitle) pageSubtitle.textContent = pageInfo.subtitle;

  // Close mobile menu
  if (sidebar) sidebar.classList.remove('open');
}

// === MODAL FUNCTIONS ===

/**
 * Show ticket details modal
 */
async function showTicketModal(ticketId) {
  try {
    const ticket = dashboardData.tickets.find(t => t.id === ticketId);
    if (!ticket) {
      showToast('Ticket not found', 'error');
      return;
    }

    const modal = document.getElementById('ticket-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    if (!modal || !modalTitle || !modalBody) return;

    modalTitle.textContent = `Ticket ${ticket.ticket_number || ticket.id}`;

    const baseName = dashboardData.bases[ticket.base_id] || 'Unknown';
    const categoryName = dashboardData.categories[ticket.category_id] || 'Unknown';
    const assigneeName = ticket.assigned_to ? 
      (dashboardData.users[ticket.assigned_to]?.name || 'Unknown') : 
      'Unassigned';
    
    const assigneeRole = ticket.assigned_to ? 
      (dashboardData.users[ticket.assigned_to]?.role || '') : 
      '';

    modalBody.innerHTML = `
      <div class="ticket-detail-grid">
        <div class="detail-section">
          <h4>Basic Information</h4>
          <div class="detail-item">
            <label>Title</label>
            <p>${ticket.title}</p>
          </div>
          <div class="detail-item">
            <label>Description</label>
            <p>${ticket.description}</p>
          </div>
          <div class="detail-item">
            <label>Status</label>
            <p>${getStatusBadge(ticket.status)}</p>
          </div>
          <div class="detail-item">
            <label>Priority</label>
            <p>${getPriorityBadge(ticket.priority)}</p>
          </div>
        </div>
        
        <div class="detail-section">
          <h4>Assignment & Location</h4>
          <div class="detail-item">
            <label>Base/Location</label>
            <p>${baseName}</p>
          </div>
          <div class="detail-item">
            <label>Category</label>
            <p>${categoryName}</p>
          </div>
          <div class="detail-item">
            <label>Assigned To</label>
            <p>${assigneeName}${assigneeRole ? ` <small>(${assigneeRole})</small>` : ''}</p>
          </div>
        </div>
        
        <div class="detail-section">
          <h4>Submitter Information</h4>
          <div class="detail-item">
            <label>Name</label>
            <p>${ticket.submitter_name}</p>
          </div>
          <div class="detail-item">
            <label>Email</label>
            <p>${ticket.submitter_email}</p>
          </div>
        </div>
        
        <div class="detail-section">
          <h4>Timeline</h4>
          <div class="detail-item">
            <label>Created</label>
            <p>${formatDate(ticket.created_at)}</p>
          </div>
          <div class="detail-item">
            <label>Last Updated</label>
            <p>${formatDate(ticket.updated_at)}</p>
          </div>
        </div>
      </div>
    `;

    modal.classList.add('active');

  } catch (error) {
    console.error('Error showing ticket modal:', error);
    showToast('Failed to load ticket details', 'error');
  }
}

/**
 * Close ticket modal
 */
function closeTicketModal() {
  const modal = document.getElementById('ticket-modal');
  if (modal) {
    modal.classList.remove('active');
  }
}

/**
 * Edit ticket (placeholder)
 */
function editTicket(ticketId) {
  showToast('Edit functionality coming soon', 'info');
}

/**
 * Refresh dashboard data
 */
async function refreshDashboard() {
  try {
    showToast('Refreshing dashboard...', 'info', 2000);
    await loadTickets();
    await loadDashboardData();
    showToast('Dashboard refreshed successfully', 'success');
  } catch (error) {
    console.error('Error refreshing dashboard:', error);
    showToast('Failed to refresh dashboard', 'error');
  }
}

/**
 * Handle logout with proper session cleanup
 */
async function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    try {
      // Show loading state
      showToast('Logging out...', 'info', 2000);
      
      // Sign out from Supabase
      if (supabaseClient) {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
          console.error('Supabase logout error:', error);
          // Continue with logout even if Supabase signout fails
        }
      }
      
      // Clear any stored session data
      localStorage.removeItem('supabase.auth.token');
      sessionStorage.clear();
      
      // Clear any other authentication-related data
      // Add any other cleanup you need here
      
      // Use replace instead of href to prevent back navigation
      window.location.replace('login.html');
      
    } catch (error) {
      console.error('Logout error:', error);
      showToast('Logout failed, redirecting anyway...', 'warning');
      
      // Force redirect even if logout process fails
      setTimeout(() => {
        window.location.replace('login.html');
      }, 1000);
    }
  }
}

// === INITIALIZATION ===
document.addEventListener("DOMContentLoaded", async () => {
  // Initialize Supabase
  const SUPABASE_URL = "https://rkdblbnmtzyrapfemswq.supabase.co";
  const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZGJsYm5tdHp5cmFwZmVtc3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1ODQyNTgsImV4cCI6MjA2NjE2MDI1OH0.TY7Ml-S-knKMNQ-HKylGLbpXIu9wHqGAZDHHAq4rRJc";
  const { createClient } = supabase;
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // DOM elements
  const elements = {
    loadingScreen: document.getElementById('loading-screen'),
    navLinks: document.querySelectorAll('.nav-link'),
    contentSections: document.querySelectorAll('.content-section'),
    pageTitle: document.getElementById('page-title'),
    pageSubtitle: document.getElementById('page-subtitle'),
    mobileMenuBtn: document.getElementById('mobile-menu-btn'),
    sidebar: document.querySelector('.dashboard-sidebar'),
    toastContainer: document.getElementById('toast-container')
  };

  // === DATA LOADING ===

  /**
   * Load all lookup data
   */
  async function loadLookupData() {
    try {
      const [
        { data: bases, error: basesError },
        { data: categories, error: categoriesError },
        { data: departments, error: departmentsError },
        { data: teams, error: teamsError }
      ] = await Promise.all([
        supabaseClient.from('bases').select('id, name').order('name'),
        supabaseClient.from('ticket_cats').select('id, name').order('name'),
        supabaseClient.from('departments').select('id, name').order('name'),
        supabaseClient.from('teams').select('id, name, department_id').order('name')
      ]);

      if (basesError) throw basesError;
      if (categoriesError) throw categoriesError;
      if (departmentsError) throw departmentsError;
      if (teamsError) throw teamsError;

      // Store in global state
      dashboardData.bases = Object.fromEntries(bases.map(b => [b.id, b.name]));
      dashboardData.categories = Object.fromEntries(categories.map(c => [c.id, c.name]));
      dashboardData.departments = Object.fromEntries(departments.map(d => [d.id, d.name]));
      dashboardData.teams = Object.fromEntries(teams.map(t => [t.id, { name: t.name, department_id: t.department_id }]));

      // Load users with correct column names
      try {
        const { data: users, error: usersError } = await supabaseClient
          .from('his_users')
          .select('id, full_name, role, base, department, team, department_id, team_id')
          .order('full_name');
        
        if (!usersError && users) {
          dashboardData.users = Object.fromEntries(users.map(u => [u.id, { 
            name: u.full_name, 
            role: u.role,
            base: u.base,
            department: u.department,
            team: u.team,
            department_id: u.department_id,
            team_id: u.team_id
          }]));
        }
      } catch (userError) {
        console.warn('Could not load users:', userError);
        dashboardData.users = {};
      }

    } catch (error) {
      console.error('Error loading lookup data:', error);
      showToast('Failed to load system data', 'error');
    }
  }

  /**
   * Load all tickets
   */
  async function loadTickets() {
    try {
      const { data: tickets, error } = await supabaseClient
        .from('tickets')
        .select(`
          id, ticket_number, title, description, status, priority, 
          created_at, updated_at, submitter_name, submitter_email, 
          base_id, category_id, assigned_to
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      dashboardData.tickets = tickets || [];
      dashboardData.filteredTickets = [...dashboardData.tickets];

    } catch (error) {
      console.error('Error loading tickets:', error);
      showToast('Failed to load tickets', 'error');
    }
  }

  /**
   * Load dashboard statistics
   */
  async function loadDashboardStats() {
    try {
      // Calculate stats from tickets data
      const tickets = dashboardData.tickets;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const stats = {
        total: tickets.length,
        open: tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length,
        resolvedToday: tickets.filter(t => {
          if (t.status !== 'Resolved') return false;
          const updatedDate = new Date(t.updated_at);
          updatedDate.setHours(0, 0, 0, 0);
          return updatedDate.getTime() === today.getTime();
        }).length,
        avgResolution: '24h' // Placeholder - would need more complex calculation
      };

      // Update stat cards
      const totalElement = document.getElementById('total-tickets');
      const openElement = document.getElementById('open-tickets');
      const resolvedElement = document.getElementById('resolved-today');
      const avgElement = document.getElementById('avg-resolution');

      if (totalElement) totalElement.textContent = stats.total;
      if (openElement) openElement.textContent = stats.open;
      if (resolvedElement) resolvedElement.textContent = stats.resolvedToday;
      if (avgElement) avgElement.textContent = stats.avgResolution;

    } catch (error) {
      console.error('Error calculating stats:', error);
    }
  }

  /**
   * Load status distribution
   */
  async function loadStatusStats() {
    try {
      const tickets = dashboardData.tickets;
      const statusCounts = {};
      
      tickets.forEach(ticket => {
        const status = ticket.status || 'Unknown';
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });

      const statusContainer = document.getElementById('status-stats');
      if (statusContainer) {
        statusContainer.innerHTML = '';

        Object.entries(statusCounts).forEach(([status, count]) => {
          const statusItem = document.createElement('div');
          statusItem.className = 'status-item';
          statusItem.innerHTML = `
            <div class="status-info">
              ${getStatusIndicator(status)}
              <span class="status-name">${status}</span>
            </div>
            <span class="status-count">${count}</span>
          `;
          statusContainer.appendChild(statusItem);
        });
      }

    } catch (error) {
      console.error('Error loading status stats:', error);
    }
  }

  /**
   * Load assignee workload
   */
  async function loadAssigneeStats() {
    try {
      const tickets = dashboardData.tickets;
      const assigneeStats = {};

      tickets.forEach(ticket => {
        const assigneeId = ticket.assigned_to;
        const assigneeName = assigneeId ? 
          (dashboardData.users[assigneeId]?.name || 'Unknown User') : 
          'Unassigned';
        
        if (!assigneeStats[assigneeName]) {
          assigneeStats[assigneeName] = { open: 0, closed: 0, total: 0 };
        }

        assigneeStats[assigneeName].total++;
        if (ticket.status === 'Open' || ticket.status === 'In Progress') {
          assigneeStats[assigneeName].open++;
        } else {
          assigneeStats[assigneeName].closed++;
        }
      });

      const tbody = document.querySelector('#assignee-stats tbody');
      if (tbody) {
        tbody.innerHTML = '';

        Object.entries(assigneeStats).forEach(([name, stats]) => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${name}</td>
            <td>${stats.open}</td>
            <td>${stats.closed}</td>
            <td>${stats.total}</td>
          `;
          tbody.appendChild(row);
        });
      }

    } catch (error) {
      console.error('Error loading assignee stats:', error);
    }
  }

  /**
   * Load team performance
   */
  async function loadTeamStats() {
    try {
      const tickets = dashboardData.tickets;
      const teamStats = {};

      tickets.forEach(ticket => {
        const assigneeId = ticket.assigned_to;
        let teamName = 'Unassigned';
        
        if (assigneeId && dashboardData.users[assigneeId]) {
          // For now, use department as team (you can adjust based on your schema)
          teamName = 'Support Team'; // Placeholder
        }

        if (!teamStats[teamName]) {
          teamStats[teamName] = { total: 0, open: 0 };
        }

        teamStats[teamName].total++;
        if (ticket.status === 'Open' || ticket.status === 'In Progress') {
          teamStats[teamName].open++;
        }
      });

      const tbody = document.querySelector('#team-stats tbody');
      if (tbody) {
        tbody.innerHTML = '';

        Object.entries(teamStats).forEach(([team, stats]) => {
          const completionRate = stats.total > 0 ? 
            Math.round(((stats.total - stats.open) / stats.total) * 100) : 0;
          
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${team}</td>
            <td>${stats.total}</td>
            <td>${stats.open}</td>
            <td>${completionRate}%</td>
          `;
          tbody.appendChild(row);
        });
      }

    } catch (error) {
      console.error('Error loading team stats:', error);
    }
  }

  /**
   * Load recent tickets
   */
  async function loadRecentTickets() {
    try {
      const recentTickets = dashboardData.tickets.slice(0, 5);
      const container = document.getElementById('recent-tickets');
      if (container) {
        container.innerHTML = '';

        recentTickets.forEach(ticket => {
          const ticketItem = document.createElement('div');
          ticketItem.className = 'recent-ticket-item';
          ticketItem.onclick = () => showTicketModal(ticket.id);
          
          const baseName = dashboardData.bases[ticket.base_id] || 'Unknown';
          const assigneeName = ticket.assigned_to ? 
            (dashboardData.users[ticket.assigned_to]?.name || 'Unknown') : 
            'Unassigned';

          ticketItem.innerHTML = `
            ${getPriorityDot(ticket.priority)}
            <div class="recent-ticket-info">
              <div class="recent-ticket-title">${ticket.title}</div>
              <div class="recent-ticket-meta">
                ${ticket.ticket_number || ticket.id} • ${baseName} • ${assigneeName}
              </div>
            </div>
            <span class="recent-ticket-status ${ticket.status.toLowerCase().replace(/\s+/g, '-')}">${ticket.status}</span>
          `;
          container.appendChild(ticketItem);
        });
      }

    } catch (error) {
      console.error('Error loading recent tickets:', error);
    }
  }

  /**
   * Load all dashboard data
   */
  async function loadDashboardData() {
    await loadDashboardStats();
    await loadStatusStats();
    await loadAssigneeStats();
    await loadTeamStats();
    await loadRecentTickets();
  }

  // === EVENT LISTENERS ===

  // Navigation
  elements.navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const section = link.dataset.section;
      if (section) {
        navigateToSection(section);
      }
    });
  });

  // Mobile menu
  if (elements.mobileMenuBtn) {
    elements.mobileMenuBtn.addEventListener('click', () => {
      if (elements.sidebar) {
        elements.sidebar.classList.toggle('open');
      }
    });
  }

  // Search and filters
  const searchInput = document.getElementById('ticket-search');
  const statusFilter = document.getElementById('status-filter');
  const priorityFilter = document.getElementById('priority-filter');

  if (searchInput) searchInput.addEventListener('input', filterTickets);
  if (statusFilter) statusFilter.addEventListener('change', filterTickets);
  if (priorityFilter) priorityFilter.addEventListener('change', filterTickets);

  // View toggle
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const viewType = btn.dataset.view;
      toggleView(viewType);
    });
  });

  // Bulk selection
  const selectAllCheckbox = document.getElementById('select-all');
  if (selectAllCheckbox) {
    selectAllCheckbox.addEventListener('change', selectAllTickets);
  }
  
  // Delegate event for header checkbox (since it's in the table)
  document.addEventListener('change', (e) => {
    if (e.target.classList.contains('header-checkbox')) {
      selectAllTickets();
    } else if (e.target.classList.contains('row-checkbox')) {
      handleBulkSelection();
    }
  });

  // Pagination
  const prevPageBtn = document.getElementById('prev-page');
  const nextPageBtn = document.getElementById('next-page');

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (dashboardData.currentPage > 1) {
        goToPage(dashboardData.currentPage - 1);
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(dashboardData.filteredTickets.length / dashboardData.itemsPerPage);
      if (dashboardData.currentPage < totalPages) {
        goToPage(dashboardData.currentPage + 1);
      }
    });
  }

  // Sortable table headers - use event delegation
  document.addEventListener('click', (e) => {
    if (e.target.closest('.tickets-table th.sortable')) {
      const th = e.target.closest('.tickets-table th.sortable');
      const field = th.dataset.sort;
      if (field) {
        sortTickets(field);
      }
    }
  });

  // Modal close on outside click
  const ticketModal = document.getElementById('ticket-modal');
  if (ticketModal) {
    ticketModal.addEventListener('click', (e) => {
      if (e.target.id === 'ticket-modal') {
        closeTicketModal();
      }
    });
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Escape to close modal
    if (e.key === 'Escape') {
      closeTicketModal();
    }
    
    // Ctrl/Cmd + A to select all tickets (when in tickets section)
    if ((e.ctrlKey || e.metaKey) && e.key === 'a' && 
        document.querySelector('#tickets-section.active')) {
      e.preventDefault();
      const selectAllCheckbox = document.getElementById('select-all');
      if (selectAllCheckbox) {
        selectAllCheckbox.checked = true;
        selectAllTickets();
      }
    }
  });

  // Make functions globally available
  window.showTicketModal = showTicketModal;
  window.closeTicketModal = closeTicketModal;
  window.editTicket = editTicket;
  window.refreshDashboard = refreshDashboard;
  window.handleLogout = handleLogout;
  window.clearFilters = clearFilters;

  // === INITIALIZATION ===

  try {
    // Load all data
    await loadLookupData();
    await loadTickets();
    await loadDashboardData();
    
    // Initialize tickets table
    renderTicketsTable();

    // Hide loading screen
    if (elements.loadingScreen) {
      elements.loadingScreen.classList.add('hidden');
    }
    
    showToast('Dashboard loaded successfully', 'success', 3000);

  } catch (error) {
    console.error('Error initializing dashboard:', error);
    showToast('Failed to initialize dashboard', 'error');
    if (elements.loadingScreen) {
      elements.loadingScreen.classList.add('hidden');
    }
  }
});