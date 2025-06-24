// === DASHBOARD MODULE ===
class DashboardModule {
  constructor(dataService = null, ui = null) {
    this.dataService = dataService;
    this.ui = ui;
  }

  /**
   * Initialize dashboard
   */
  initialize() {
    this.loadDashboardData();
  }

  /**
   * Load dashboard data
   */
  async loadDashboardData() {
    try {
      this.updateDashboardStats();
      this.renderRecentTickets();
      this.renderStatusDistribution();
      this.loadAssigneeStats();
    } catch (error) {
      
    }
  }

  /**
   * Update dashboard statistics
   */
  updateDashboardStats() {
    if (!this.dataService) return;

    // Use the correct method name from the new data service
    const stats = this.dataService.getStats();
    
    if (stats) {
      document.getElementById('total-tickets').textContent = stats.total || 0;
      document.getElementById('open-tickets').textContent = (stats.open + stats.inProgress) || 0;
      document.getElementById('resolved-today').textContent = stats.resolvedToday || 0;
      document.getElementById('avg-resolution').textContent = stats.avgResolutionTime || '0h';
    } else {
      // Fallback to manual calculation if stats not available
      const tickets = this.dataService.getTickets();
      const total = tickets.length;
      const open = tickets.filter(t => t.status === 'Open' || t.status === 'In Progress').length;
      const resolvedToday = tickets.filter(t => {
        if (t.status !== 'Resolved') return false;
        const today = new Date().toDateString();
        const updatedDate = new Date(t.updated_at).toDateString();
        return today === updatedDate;
      }).length;

      document.getElementById('total-tickets').textContent = total;
      document.getElementById('open-tickets').textContent = open;
      document.getElementById('resolved-today').textContent = resolvedToday;
      document.getElementById('avg-resolution').textContent = '24h';
    }
  }

  /**
   * Render recent tickets
   */
  renderRecentTickets() {
    const container = document.getElementById('recent-tickets');
    if (!container || !this.dataService) return;

    const tickets = this.dataService.getTickets();
    const bases = this.dataService.getBases();
    const recentTickets = tickets.slice(0, 5);
    
    if (recentTickets.length === 0) {
      container.innerHTML = `
        <p style="text-align: center; color: #6b7280; padding: 2rem;">
          No tickets found. 
          <a href="public/ticket-submission.html" style="color: #3b82f6;">Create your first ticket</a>
        </p>
      `;
      return;
    }

    container.innerHTML = recentTickets.map(ticket => {
      // Try multiple ways to get the base name
      let baseName = 'Unknown';
      
      if (ticket.base_name) {
        // If the ticket already has base_name (enriched data)
        baseName = ticket.base_name;
      } else if (bases && ticket.base_id) {
        // Check if bases is an object with base_id as key
        if (bases[ticket.base_id]) {
          baseName = bases[ticket.base_id].name || bases[ticket.base_id].base_name || bases[ticket.base_id];
        } else {
          // Maybe bases is an array, find by id
          const baseArray = Array.isArray(bases) ? bases : Object.values(bases);
          const baseRecord = baseArray.find(base => base && (base.id === ticket.base_id || base.base_id === ticket.base_id));
          if (baseRecord) {
            baseName = baseRecord.name || baseRecord.base_name || 'Unknown';
          }
        }
      }
      
      console.log('Ticket base lookup:', {
        ticketId: ticket.id,
        baseId: ticket.base_id,
        baseName: baseName,
        basesType: typeof bases,
        basesKeys: bases ? Object.keys(bases) : 'No bases'
      });
      
      // Use the assigned_to_name from the enriched ticket data
      const assigneeName = ticket.assigned_to_name || 'Unassigned';
      const timeAgo = this.ui ? this.ui.formatTimeAgo(ticket.created_at) : 'Recently';
      
      return `
        <div class="recent-ticket-item" onclick="showTicketDetails('${ticket.id}')" style="
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          margin-bottom: 0.75rem;
          cursor: pointer;
          transition: all 0.2s ease;
          background: white;
        " onmouseover="this.style.borderColor='#3b82f6'; this.style.transform='translateX(4px)'" 
           onmouseout="this.style.borderColor='#e5e7eb'; this.style.transform='translateX(0)'">
          <div style="
            width: 4px;
            height: 40px;
            background: ${this.getPriorityColor(ticket.priority)};
            border-radius: 2px;
          "></div>
          <div style="flex: 1; min-width: 0;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.5rem;">
              <h4 style="margin: 0; font-size: 0.875rem; font-weight: 600; color: #1f2937;">${ticket.title}</h4>
              <span style="font-size: 0.75rem; color: #3b82f6; font-weight: 600; font-family: monospace;">
                #${ticket.ticket_number || ticket.id.slice(0, 8)}
              </span>
            </div>
            <div style="display: flex; gap: 1rem; font-size: 0.75rem; color: #6b7280;">
              <span><strong>Base:</strong> ${baseName}</span>
              <span><strong>Assigned:</strong> ${assigneeName}</span>
              <span><strong>Created:</strong> ${timeAgo}</span>
            </div>
          </div>
          <span style="
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 500;
            background: ${this.ui ? this.ui.getStatusColor(ticket.status) : '#f3f4f6'};
            color: ${this.ui ? this.ui.getStatusTextColor(ticket.status) : '#6b7280'};
          ">${ticket.status}</span>
        </div>
      `;
    }).join('');
  }

  /**
   * Render status distribution
   */
  renderStatusDistribution() {
    const container = document.getElementById('status-stats');
    if (!container || !this.dataService) return;

    const distribution = this.dataService.getStatusDistribution();
    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);

    if (total === 0) {
      container.innerHTML = '<p style="text-align: center; color: #6b7280;">No data available</p>';
      return;
    }

    container.innerHTML = Object.entries(distribution).map(([status, count]) => {
      const percentage = Math.round((count / total) * 100);
      const color = this.getStatusBarColor(status);
      
      return `
        <div style="margin-bottom: 1rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span style="font-size: 0.875rem; font-weight: 500; color: #374151;">${status}</span>
            <span style="font-size: 0.875rem; color: #6b7280;">${count} (${percentage}%)</span>
          </div>
          <div style="background: #f3f4f6; border-radius: 4px; height: 8px; overflow: hidden;">
            <div style="
              background: ${color};
              height: 100%;
              width: ${percentage}%;
              border-radius: 4px;
              transition: width 0.3s ease;
            "></div>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Load assignee statistics - Updated to use full names
   */
  loadAssigneeStats() {
    const table = document.getElementById('assignee-stats');
    if (!table || !this.dataService) return;

    const tbody = table.querySelector('tbody');
    const workload = this.dataService.getAssigneeWorkload();

    if (Object.keys(workload).length === 0) {
      tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #6b7280;">No data available</td></tr>';
      return;
    }

    tbody.innerHTML = Object.entries(workload).map(([assigneeName, stats]) => {
      const completionRate = stats.completionRate || 0;
      
      return `
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 0.75rem; font-weight: 500;">${assigneeName}</td>
          <td style="padding: 0.75rem; text-align: center;">${stats.open}</td>
          <td style="padding: 0.75rem; text-align: center;">${stats.closed}</td>
          <td style="padding: 0.75rem; text-align: center;">
            <span style="
              background: ${completionRate >= 80 ? '#dcfce7' : completionRate >= 60 ? '#fef3c7' : '#fef2f2'};
              color: ${completionRate >= 80 ? '#166534' : completionRate >= 60 ? '#92400e' : '#b91c1c'};
              padding: 0.25rem 0.5rem;
              border-radius: 4px;
              font-size: 0.75rem;
              font-weight: 600;
            ">${completionRate}%</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * Get priority color
   */
  getPriorityColor(priority) {
    const colors = {
      'High': '#ef4444',
      'Medium': '#f59e0b',
      'Low': '#10b981'
    };
    return colors[priority] || '#6b7280';
  }

  /**
   * Get status bar color
   */
  getStatusBarColor(status) {
    const colors = {
      'Open': '#3b82f6',
      'In Progress': '#f59e0b',
      'Resolved': '#10b981',
      'Closed': '#6b7280'
    };
    return colors[status] || '#6b7280';
  }
}