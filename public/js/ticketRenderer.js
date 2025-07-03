// === TICKET RENDERER SERVICE ===
class TicketRenderer {
  constructor(dataService = null, ui = null) {
    this.dataService = dataService;
    this.ui = ui;
    this.currentPage = 1;
    this.itemsPerPage = 10;
    this.filteredTickets = [];
    this.sortField = "created_at";
    this.sortDirection = "desc";
  }

  initializeEventListeners() {
    this.renderTicketsTable();
  }

  renderTicketsTable() {
    if (!this.dataService) return;

    const tickets = this.dataService.getTickets();
    this.filteredTickets = this.applyFilters(tickets);

    const tableView = document.getElementById("table-view");
    const cardsView = document.getElementById("cards-view");

    if (tableView?.classList.contains("active")) {
      this.renderTableView();
    } else if (cardsView?.classList.contains("active")) {
      this.renderCardsView();
    }

    this.renderPagination();
  }

  applyFilters(tickets) {
    let filtered = [...tickets];

    // Get filter values
    const searchTerm = document.getElementById("ticket-search")?.value.toLowerCase() || "";
    const statusValue = document.getElementById("status-filter")?.value || "";
    const priorityValue = document.getElementById("priority-filter")?.value || "";

    // Apply filters
    if (searchTerm) {
      filtered = filtered.filter(ticket =>
        ['title', 'description', 'ticket_number'].some(field => 
          ticket[field]?.toLowerCase().includes(searchTerm)
        )
      );
    }

    if (statusValue) filtered = filtered.filter(ticket => ticket.status === statusValue);
    if (priorityValue) filtered = filtered.filter(ticket => ticket.priority === priorityValue);

    // Sort
    filtered.sort((a, b) => {
      let aValue = a[this.sortField];
      let bValue = b[this.sortField];

      if (this.sortField === "created_at") {
        aValue = new Date(aValue);
        bValue = new Date(bValue);
      }

      return this.sortDirection === "asc" ? (aValue > bValue ? 1 : -1) : (aValue < bValue ? 1 : -1);
    });

    return filtered;
  }

  renderTableView() {
    const tbody = document.querySelector("#tickets-table tbody");
    if (!tbody) return;

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const pageTickets = this.filteredTickets.slice(startIndex, startIndex + this.itemsPerPage);

    if (pageTickets.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: #6b7280;">No tickets found</td></tr>';
      return;
    }

    const bases = this.dataService.getBases();

    tbody.innerHTML = pageTickets.map(ticket => {
      const timeAgo = this.ui?.formatTimeAgo(ticket.created_at) || "Recently";
      
      return `
        <tr class="priority-${ticket.priority?.toLowerCase()}" onclick="showTicketDetails('${ticket.id}')">
          <td class="cell-checkbox">
            <input type="checkbox" class="row-checkbox" data-ticket-id="${ticket.id}">
          </td>
          <td class="cell-id">#${ticket.ticket_number || ticket.id.slice(0, 8)}</td>
          <td class="cell-title">
            <div class="title-main">${ticket.title}</div>
            <div class="title-subtitle">${ticket.description?.slice(0, 100)}...</div>
          </td>
          <td>
            <span class="status-badge status-${ticket.status?.toLowerCase().replace(" ", "-")}">
              <span class="status-dot"></span>
              ${ticket.status}
            </span>
          </td>
          <td>
            <span class="priority-badge priority-${ticket.priority?.toLowerCase()}">
              <span class="priority-dot"></span>
              ${ticket.priority}
            </span>
          </td>
          <td>${ticket.assigned_to_name || "Unassigned"}</td>
          <td class="cell-date">${timeAgo}</td>
          <td class="cell-actions">
            <button class="action-btn view" onclick="event.stopPropagation(); showTicketDetails('${ticket.id}')" title="View Details">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 14px; height: 14px;">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <button class="action-btn edit" onclick="event.stopPropagation(); editTicket('${ticket.id}')" title="Edit Ticket">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 14px; height: 14px;">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }

  renderCardsView() {
    const container = document.getElementById("tickets-cards");
    if (!container) return;

    const startIndex = (this.currentPage - 1) * this.itemsPerPage;
    const pageTickets = this.filteredTickets.slice(startIndex, startIndex + this.itemsPerPage);

    if (pageTickets.length === 0) {
      container.innerHTML = '<p style="text-align: center; padding: 2rem; color: #6b7280;">No tickets found</p>';
      return;
    }

    container.innerHTML = pageTickets.map(ticket => {
      const timeAgo = this.ui?.formatTimeAgo(ticket.created_at) || "Recently";
      
      return `
        <div class="ticket-card priority-${ticket.priority?.toLowerCase()}" onclick="showTicketDetails('${ticket.id}')">
          <div class="ticket-card-header">
            <div class="ticket-card-id">#${ticket.ticket_number || ticket.id.slice(0, 8)}</div>
            <input type="checkbox" class="ticket-card-checkbox" data-ticket-id="${ticket.id}" onclick="event.stopPropagation()">
          </div>
          
          <div class="ticket-card-title">${ticket.title}</div>
          <div class="ticket-card-description">${ticket.description?.slice(0, 150)}...</div>
          
          <div class="ticket-card-meta">
            <span class="ticket-card-status ${ticket.status?.toLowerCase().replace(" ", "-")}">${ticket.status}</span>
            <span class="ticket-card-priority ${ticket.priority?.toLowerCase()}">${ticket.priority}</span>
            <span class="ticket-card-date" style="font-size: 0.75rem; color: #6b7280;">${timeAgo}</span>
          </div>
          
          <div class="ticket-card-footer">
            <div class="ticket-card-assignee">
              <div class="ticket-card-avatar">${(ticket.assigned_to_name || "U").charAt(0).toUpperCase()}</div>
              <span class="ticket-card-assignee-name">${ticket.assigned_to_name || "Unassigned"}</span>
            </div>
            <div class="ticket-card-actions">
              <button class="action-btn view" onclick="event.stopPropagation(); showTicketDetails('${ticket.id}')" title="View">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 14px; height: 14px;">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
              </button>
              <button class="action-btn edit" onclick="event.stopPropagation(); editTicket('${ticket.id}')" title="Edit">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style="width: 14px; height: 14px;">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  renderPagination() {
    const totalItems = this.filteredTickets.length;
    const totalPages = Math.ceil(totalItems / this.itemsPerPage);

    // Update pagination info
    const paginationShowing = document.getElementById("pagination-showing");
    const paginationTotal = document.getElementById("pagination-total");

    if (paginationShowing && paginationTotal) {
      const startItem = totalItems === 0 ? 0 : (this.currentPage - 1) * this.itemsPerPage + 1;
      const endItem = Math.min(this.currentPage * this.itemsPerPage, totalItems);

      paginationShowing.textContent = `${startItem}-${endItem}`;
      paginationTotal.textContent = totalItems;
    }

    // Update pagination controls
    const prevBtn = document.getElementById("prev-page");
    const nextBtn = document.getElementById("next-page");
    const numbersContainer = document.getElementById("pagination-numbers");

    if (prevBtn) {
      prevBtn.disabled = this.currentPage <= 1;
      prevBtn.onclick = () => this.goToPage(this.currentPage - 1);
    }

    if (nextBtn) {
      nextBtn.disabled = this.currentPage >= totalPages;
      nextBtn.onclick = () => this.goToPage(this.currentPage + 1);
    }

    if (numbersContainer) {
      numbersContainer.innerHTML = this.generatePageNumbers(totalPages);
    }
  }

  generatePageNumbers(totalPages) {
    if (totalPages <= 1) return "";

    let pages = [];
    const current = this.currentPage;

    // Show first page
    if (current > 3) {
      pages.push(1);
      if (current > 4) pages.push("...");
    }

    // Show pages around current
    for (let i = Math.max(1, current - 2); i <= Math.min(totalPages, current + 2); i++) {
      pages.push(i);
    }

    // Show last page
    if (current < totalPages - 2) {
      if (current < totalPages - 3) pages.push("...");
      pages.push(totalPages);
    }

    return pages.map(page => {
      if (page === "...") return '<span class="page-ellipsis">...</span>';
      
      const isActive = page === current ? "active" : "";
      return `<button class="page-number ${isActive}" onclick="ticketRenderer.goToPage(${page})">${page}</button>`;
    }).join("");
  }

  goToPage(page) {
    const totalPages = Math.ceil(this.filteredTickets.length / this.itemsPerPage);
    if (page < 1 || page > totalPages) return;

    this.currentPage = page;
    this.renderTicketsTable();
  }

  filterTickets() {
    this.currentPage = 1;
    this.renderTicketsTable();
  }

  sortTickets(field) {
    if (this.sortField === field) {
      this.sortDirection = this.sortDirection === "asc" ? "desc" : "asc";
    } else {
      this.sortField = field;
      this.sortDirection = "asc";
    }

    // Update sort indicators
    document.querySelectorAll(".sortable").forEach(th => {
      th.classList.remove("sorted", "desc");
    });

    const currentHeader = document.querySelector(`[data-sort="${field}"]`);
    if (currentHeader) {
      currentHeader.classList.add("sorted");
      if (this.sortDirection === "desc") {
        currentHeader.classList.add("desc");
      }
    }

    this.renderTicketsTable();
  }

  selectAllTickets() {
    const selectAllCheckbox = document.getElementById("select-all");
    const rowCheckboxes = document.querySelectorAll(".row-checkbox, .ticket-card-checkbox");

    if (selectAllCheckbox) {
      rowCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
      });
      this.handleBulkSelection();
    }
  }

  handleBulkSelection() {
    const selectedCheckboxes = document.querySelectorAll(".row-checkbox:checked, .ticket-card-checkbox:checked");
    const bulkActions = document.querySelector(".bulk-actions");
    const bulkActionBtn = document.querySelector(".bulk-action-btn");

    if (selectedCheckboxes.length > 0) {
      bulkActions?.classList.add("active");
      if (bulkActionBtn) bulkActionBtn.disabled = false;
    } else {
      bulkActions?.classList.remove("active");
      if (bulkActionBtn) bulkActionBtn.disabled = true;
    }
  }

  clearFilters() {
    const elements = ['ticket-search', 'status-filter', 'priority-filter'];
    elements.forEach(id => {
      const element = document.getElementById(id);
      if (element) element.value = "";
    });
    this.filterTickets();
  }
}