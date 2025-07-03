// === DASHBOARD MODULE ===
class DashboardModule {
  constructor(dataService = null, ui = null) {
    this.dataService = dataService;
    this.ui = ui;
  }

  initialize() {
    this.loadDashboardData();
  }

  async loadDashboardData() {
    try {
      this.updateDashboardStats();
      this.renderRecentTickets();
      this.renderStatusDistribution();
      this.loadAssigneeStats();
    } catch (error) {
      console.error('Dashboard load error:', error);
    }
  }

  updateDashboardStats() {
    if (!this.dataService) return;

    const stats = this.dataService.getStats();
    const tickets = this.dataService.getTickets();
    
    const calculations = stats || {
      total: tickets.length,
      open: tickets.filter(t => ['Open', 'In Progress'].includes(t.status)).length,
      resolvedToday: tickets.filter(t => {
        if (t.status !== 'Resolved') return false;
        return new Date().toDateString() === new Date(t.updated_at).toDateString();
      }).length,
      avgResolutionTime: '24h'
    };

    const elements = {
      'total-tickets': calculations.total || 0,
      'open-tickets': (calculations.open + calculations.inProgress) || calculations.open || 0,
      'resolved-today': calculations.resolvedToday || 0,
      'avg-resolution': calculations.avgResolutionTime || '0h'
    };

    Object.entries(elements).forEach(([id, value]) => {
      const element = document.getElementById(id);
      if (element) element.textContent = value;
    });
  }

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
      const baseName = this.getBaseName(ticket, bases);
      const assigneeName = ticket.assigned_to_name || 'Unassigned';
      const timeAgo = this.ui?.formatTimeAgo(ticket.created_at) || 'Recently';
      
      return `
        <div class="recent-ticket-item" onclick="showTicketDetails('${ticket.id}')" style="
          display: flex; align-items: center; gap: 1rem; padding: 1rem; border: 1px solid #e5e7eb;
          border-radius: 8px; margin-bottom: 0.75rem; cursor: pointer; transition: all 0.2s ease; background: white;
        " onmouseover="this.style.borderColor='#3b82f6'; this.style.transform='translateX(4px)'" 
           onmouseout="this.style.borderColor='#e5e7eb'; this.style.transform='translateX(0)'">
          <div style="width: 4px; height: 40px; background: ${this.getPriorityColor(ticket.priority)}; border-radius: 2px;"></div>
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
            padding: 0.25rem 0.75rem; border-radius: 4px; font-size: 0.75rem; font-weight: 500;
            background: ${this.ui?.getStatusColor(ticket.status) || '#f3f4f6'};
            color: ${this.ui?.getStatusTextColor(ticket.status) || '#6b7280'};
          ">${ticket.status}</span>
        </div>
      `;
    }).join('');
  }

  getBaseName(ticket, bases) {
    if (ticket.base_name) return ticket.base_name;
    if (bases && ticket.base_id) {
      if (bases[ticket.base_id]) return bases[ticket.base_id].name || bases[ticket.base_id];
      const baseArray = Array.isArray(bases) ? bases : Object.values(bases);
      const baseRecord = baseArray.find(base => base && (base.id === ticket.base_id || base.base_id === ticket.base_id));
      return baseRecord ? (baseRecord.name || baseRecord.base_name || 'Unknown') : 'Unknown';
    }
    return 'Unknown';
  }

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
            <div style="background: ${color}; height: 100%; width: ${percentage}%; border-radius: 4px; transition: width 0.3s ease;"></div>
          </div>
        </div>
      `;
    }).join('');
  }

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
      const bgColor = completionRate >= 80 ? '#dcfce7' : completionRate >= 60 ? '#fef3c7' : '#fef2f2';
      const textColor = completionRate >= 80 ? '#166534' : completionRate >= 60 ? '#92400e' : '#b91c1c';
      
      return `
        <tr style="border-bottom: 1px solid #f3f4f6;">
          <td style="padding: 0.75rem; font-weight: 500;">${assigneeName}</td>
          <td style="padding: 0.75rem; text-align: center;">${stats.open}</td>
          <td style="padding: 0.75rem; text-align: center;">${stats.closed}</td>
          <td style="padding: 0.75rem; text-align: center;">
            <span style="
              background: ${bgColor}; color: ${textColor}; padding: 0.25rem 0.5rem; border-radius: 4px;
              font-size: 0.75rem; font-weight: 600;
            ">${completionRate}%</span>
          </td>
        </tr>
      `;
    }).join('');
  }

  getPriorityColor(priority) {
    const colors = { 'High': '#ef4444', 'Medium': '#f59e0b', 'Low': '#10b981' };
    return colors[priority] || '#6b7280';
  }

  getStatusBarColor(status) {
    const colors = { 'Open': '#3b82f6', 'In Progress': '#f59e0b', 'Resolved': '#10b981', 'Closed': '#6b7280' };
    return colors[status] || '#6b7280';
  }
}