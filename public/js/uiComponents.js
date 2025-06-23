// === UI COMPONENTS SERVICE ===
class UIComponents {
  constructor() {
    this.toasts = [];
  }

  /**
   * Initialize UI components
   */
  initialize() {
    // Setup modal event listeners
    this.setupModalEventListeners();
    
    // Setup responsive handlers
    this.setupResponsiveHandlers();
  }

  /**
   * Show toast notification
   */
  showToast(message, type = 'info', duration = 5000) {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) return;
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const iconMap = {
      success: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/></svg>',
      error: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>'
    };

    toast.innerHTML = `
      <div class="toast-icon">${iconMap[type] || iconMap.info}</div>
      <div class="toast-content">
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      ${duration > 0 ? `<div class="toast-progress" style="animation-duration: ${duration}ms"></div>` : ''}
    `;
    
    toastContainer.appendChild(toast);
    this.toasts.push(toast);

    if (duration > 0) {
      setTimeout(() => {
        if (toast.parentNode) {
          toast.style.animation = 'toastSlideOut 0.3s ease forwards';
          setTimeout(() => toast.remove(), 300);
        }
      }, duration);
    }

    // Remove from array when removed from DOM
    toast.addEventListener('animationend', (e) => {
      if (e.animationName === 'toastSlideOut') {
        this.toasts = this.toasts.filter(t => t !== toast);
      }
    });
  }

  /**
   * Show ticket modal
   */
  showTicketModal(ticket, lookupData) {
    const modal = document.getElementById('ticket-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    if (!modal || !modalTitle || !modalBody) return;

    modalTitle.textContent = `Ticket ${ticket.ticket_number || ticket.id.slice(0, 8)}`;

    const baseName = lookupData.bases[ticket.base_id] || 'Unknown';
    const categoryName = lookupData.categories[ticket.category_id] || 'Unknown';

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
            <p><span class="status-badge status-${ticket.status?.toLowerCase().replace(' ', '-')}">${ticket.status}</span></p>
          </div>
          <div class="detail-item">
            <label>Priority</label>
            <p><span class="priority-badge priority-${ticket.priority?.toLowerCase()}">${ticket.priority}</span></p>
          </div>
        </div>
        
        <div class="detail-section">
          <h4>Location & Assignment</h4>
          <div class="detail-item">
            <label>Base/Location</label>
            <p>${baseName}</p>
          </div>
          <div class="detail-item">
            <label>Category</label>
            <p>${categoryName}</p>
          </div>
          <div class="detail-item">
            <label>Submitter</label>
            <p>${ticket.submitter_name}<br><small>${ticket.submitter_email}</small></p>
          </div>
          <div class="detail-item">
            <label>Created</label>
            <p>${new Date(ticket.created_at).toLocaleString()}</p>
          </div>
        </div>
      </div>
    `;

    modal.style.display = 'flex';
  }

  /**
   * Close ticket modal
   */
  closeTicketModal() {
    const modal = document.getElementById('ticket-modal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * Navigate to section
   */
  navigateToSection(sectionName) {
    // Update navigation
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.remove('active');
    });
    document.querySelector(`[data-section="${sectionName}"]`)?.classList.add('active');

    // Update content sections
    document.querySelectorAll('.content-section').forEach(section => {
      section.classList.remove('active');
    });
    document.getElementById(`${sectionName}-section`)?.classList.add('active');

    // Update page title
    const titleMap = {
      dashboard: { title: 'Dashboard', subtitle: 'Overview of all tickets and system metrics' },
      tickets: { title: 'All Tickets', subtitle: 'Manage and track all support tickets' },
      analytics: { title: 'Analytics & Reports', subtitle: 'Detailed insights and performance metrics' }
    };

    const pageInfo = titleMap[sectionName] || titleMap.dashboard;
    document.getElementById('page-title').textContent = pageInfo.title;
    document.getElementById('page-subtitle').textContent = pageInfo.subtitle;
  }

  /**
   * Toggle view (table/cards)
   */
  toggleView(viewType) {
    // Update view buttons
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.classList.remove('active');
    });
    document.querySelector(`[data-view="${viewType}"]`)?.classList.add('active');

    // Toggle views
    const tableView = document.getElementById('table-view');
    const cardsView = document.getElementById('cards-view');

    if (viewType === 'cards') {
      tableView?.classList.remove('active');
      cardsView?.classList.add('active');
    } else {
      tableView?.classList.add('active');
      cardsView?.classList.remove('active');
    }
  }

  /**
   * Format time ago
   */
  formatTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  }

  /**
   * Get status colors
   */
  getStatusColor(status) {
    const colors = {
      'Open': '#dbeafe',
      'In Progress': '#fef3c7',
      'Resolved': '#dcfce7',
      'Closed': '#f3f4f6'
    };
    return colors[status] || '#f3f4f6';
  }

  /**
   * Get status text colors
   */
  getStatusTextColor(status) {
    const colors = {
      'Open': '#1e40af',
      'In Progress': '#92400e',
      'Resolved': '#166534',
      'Closed': '#6b7280'
    };
    return colors[status] || '#6b7280';
  }

  /**
   * Setup modal event listeners
   */
  setupModalEventListeners() {
    const ticketModal = document.getElementById('ticket-modal');
    if (ticketModal) {
      ticketModal.addEventListener('click', (e) => {
        if (e.target.id === 'ticket-modal') {
          this.closeTicketModal();
        }
      });
    }
  }

  /**
   * Setup responsive handlers
   */
  setupResponsiveHandlers() {
    // Close mobile menu on desktop
    window.addEventListener('resize', () => {
      if (window.innerWidth > 768) {
        const sidebar = document.querySelector('.dashboard-sidebar');
        if (sidebar) sidebar.classList.remove('open');
      }
    });
  }

  /**
   * Create loading spinner
   */
  createLoadingSpinner() {
    return '<div class="spinner"></div>';
  }

  /**
   * Create empty state
   */
  createEmptyState(title, message, actionText, actionUrl) {
    return `
      <div class="table-empty">
        <div class="table-empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <circle cx="11" cy="11" r="8"/>
            <path d="M21 21l-4.35-4.35"/>
          </svg>
        </div>
        <h3>${title}</h3>
        <p>${message}</p>
        ${actionText && actionUrl ? `
          <div class="empty-actions">
            <a href="${actionUrl}" class="btn btn-primary">${actionText}</a>
          </div>
        ` : ''}
      </div>
    `;
  }
}