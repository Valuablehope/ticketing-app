// === DATA SERVICE ===
class DataService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.data = { tickets: [], bases: {}, categories: {}, users: [], usersLookup: {}, stats: null };
    this.isLoading = false;
    this.lastRefresh = null;
    this.refreshCallbacks = [];
  }

  async initialize() {
    await this.refreshData();
    this.setupRealtimeSubscriptions();
    return true;
  }

  async refreshData() {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      const results = await Promise.allSettled([
        this.loadTickets(),
        this.loadBases(),
        this.loadCategories(),
        this.loadUsers()
      ]);

      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Data load failed for index ${index}:`, result.reason);
        }
      });

      this.calculateStats();
      this.lastRefresh = new Date();
      this.notifyRefreshCallbacks();
    } catch (error) {
      console.error('Data refresh error:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  async loadTickets() {
    try {
      const { data: ticketsData, error } = await this.supabase
        .from("tickets")
        .select("*, base:bases(id, name), category:ticket_cats(id, name)")
        .order("created_at", { ascending: false });

      if (error && error.code !== "42P01") throw error;

      this.data.tickets = (ticketsData || []).map(ticket => ({
        ...ticket,
        isOverdue: this.isTicketOverdue(ticket),
        timeOpen: this.calculateTimeOpen(ticket),
        priorityScore: this.calculatePriorityScore(ticket),
        created_at_formatted: this.formatDate(ticket.created_at),
        updated_at_formatted: this.formatDate(ticket.updated_at),
        status_normalized: ticket.status?.toLowerCase().replace(/\s+/g, "_"),
        priority_normalized: ticket.priority?.toLowerCase(),
        assigned_to_name: this.getUserFullName(ticket.assigned_to)
      }));
    } catch (error) {
      console.error('Ticket load error:', error);
      this.data.tickets = [];
    }
  }

  async loadBases() {
    try {
      const { data: basesData, error } = await this.supabase
        .from("bases")
        .select("id, name")
        .order("name");

      if (error && error.code !== "42P01") throw error;

      this.data.bases = {};
      if (basesData) {
        basesData.forEach(base => {
          this.data.bases[base.id] = base.name;
        });
      }
    } catch (error) {
      console.error('Bases load error:', error);
      this.data.bases = {};
    }
  }

  async loadCategories() {
    try {
      const { data: categoriesData, error } = await this.supabase
        .from("ticket_cats")
        .select("id, name")
        .order("name");

      if (error && error.code !== "42P01") throw error;

      this.data.categories = {};
      if (categoriesData) {
        categoriesData.forEach(category => {
          this.data.categories[category.id] = category.name;
        });
      }
    } catch (error) {
      console.error('Categories load error:', error);
      this.data.categories = {};
    }
  }

  async loadUsers() {
    try {
      const { data: usersData, error } = await this.supabase
        .from("his_users")
        .select("id, full_name, role")
        .order("full_name");

      if (error && error.code !== "42P01") throw error;

      this.data.users = usersData || [];
      this.data.usersLookup = {};
      if (usersData) {
        usersData.forEach(user => {
          this.data.usersLookup[user.id] = {
            id: user.id,
            full_name: user.full_name,
            role: user.role
          };
        });
      }
    } catch (error) {
      console.error('Users load error:', error);
      this.data.users = [];
      this.data.usersLookup = {};
    }
  }

  getUserFullName(userId) {
    if (!userId) return null;
    const user = this.data.usersLookup[userId];
    return user ? user.full_name : userId;
  }

  async createTicket(ticketData) {
    try {
      const newTicket = {
        ...ticketData,
        ticket_number: await this.generateTicketNumber(),
        status: ticketData.status || "Open",
        priority: ticketData.priority || "Medium",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const { data, error } = await this.supabase
        .from("tickets")
        .insert([newTicket])
        .select()
        .single();

      if (error) throw error;

      const enrichedTicket = {
        ...data,
        assigned_to_name: this.getUserFullName(data.assigned_to),
        isOverdue: this.isTicketOverdue(data),
        timeOpen: this.calculateTimeOpen(data),
        priorityScore: this.calculatePriorityScore(data)
      };

      this.data.tickets.unshift(enrichedTicket);
      this.calculateStats();
      this.notifyRefreshCallbacks();
      return enrichedTicket;
    } catch (error) {
      console.error('Create ticket error:', error);
      throw error;
    }
  }

  async updateTicket(ticketId, updates) {
    try {
      const { data, error } = await this.supabase
        .from("tickets")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", ticketId)
        .select()
        .single();

      if (error) throw error;

      const ticketIndex = this.data.tickets.findIndex(t => t.id === ticketId);
      if (ticketIndex !== -1) {
        this.data.tickets[ticketIndex] = {
          ...this.data.tickets[ticketIndex],
          ...data,
          assigned_to_name: this.getUserFullName(data.assigned_to),
          isOverdue: this.isTicketOverdue(data),
          timeOpen: this.calculateTimeOpen(data),
          priorityScore: this.calculatePriorityScore(data)
        };
      }

      this.calculateStats();
      this.notifyRefreshCallbacks();
      return this.data.tickets[ticketIndex];
    } catch (error) {
      console.error('Update ticket error:', error);
      throw error;
    }
  }

  async deleteTicket(ticketId) {
    try {
      const { error } = await this.supabase.from("tickets").delete().eq("id", ticketId);
      if (error) throw error;

      const ticketIndex = this.data.tickets.findIndex(t => t.id === ticketId);
      if (ticketIndex !== -1) {
        this.data.tickets.splice(ticketIndex, 1);
      }

      this.calculateStats();
      this.notifyRefreshCallbacks();
      return true;
    } catch (error) {
      console.error('Delete ticket error:', error);
      throw error;
    }
  }

  searchTickets(filters = {}) {
    let filtered = [...this.data.tickets];

    // Apply filters
    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;
      
      switch (key) {
        case 'search':
          const searchTerm = value.toLowerCase();
          filtered = filtered.filter(ticket =>
            ['title', 'description', 'ticket_number', 'submitter_name', 'submitter_email', 'assigned_to_name']
              .some(field => ticket[field]?.toLowerCase().includes(searchTerm))
          );
          break;
        case 'status':
        case 'priority':
        case 'base_id':
        case 'category_id':
        case 'assigned_to':
          filtered = filtered.filter(ticket => ticket[key] === value);
          break;
        case 'dateFrom':
          filtered = filtered.filter(ticket => new Date(ticket.created_at) >= new Date(value));
          break;
        case 'dateTo':
          filtered = filtered.filter(ticket => new Date(ticket.created_at) <= new Date(value));
          break;
        case 'overdue':
          if (value === true) filtered = filtered.filter(ticket => ticket.isOverdue);
          break;
      }
    });

    // Sort results
    if (filters.sortBy) {
      filtered.sort((a, b) => {
        let aValue = a[filters.sortBy];
        let bValue = b[filters.sortBy];

        if (filters.sortBy.includes("_at")) {
          aValue = new Date(aValue);
          bValue = new Date(bValue);
        }

        if (filters.sortBy === "priority") {
          const priorityOrder = { High: 3, Medium: 2, Low: 1 };
          aValue = priorityOrder[aValue] || 0;
          bValue = priorityOrder[bValue] || 0;
        }

        return filters.sortDirection === "desc" ? (aValue < bValue ? 1 : -1) : (aValue > bValue ? 1 : -1);
      });
    }

    return filtered;
  }

  // Getter methods
  getTickets() { return this.data.tickets; }
  getTicket(id) { return this.data.tickets.find(t => t.id === id); }
  getTicketsByStatus(status) { return this.data.tickets.filter(t => t.status === status); }
  getBases() { return this.data.bases; }
  getCategories() { return this.data.categories; }
  getUsers() { return this.data.users; }
  getAssignableUsers() { 
    return this.data.users.filter(user => 
      user.role && ["admin", "technician", "support", "staff"].includes(user.role.toLowerCase())
    );
  }

  calculateStats() {
    const tickets = this.data.tickets;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    this.data.stats = {
      total: tickets.length,
      open: tickets.filter(t => t.status === "Open").length,
      inProgress: tickets.filter(t => t.status === "In Progress").length,
      resolved: tickets.filter(t => t.status === "Resolved").length,
      closed: tickets.filter(t => t.status === "Closed").length,
      resolvedToday: tickets.filter(t => t.status === "Resolved" && new Date(t.updated_at) >= today).length,
      overdue: tickets.filter(t => t.isOverdue).length,
      avgResolutionTime: this.calculateAverageResolutionTime(tickets),
      statusDistribution: this.getStatusDistribution(),
      assigneeWorkload: this.getAssigneeWorkload()
    };
  }

  getStats() { return this.data.stats; }

  getStatusDistribution() {
    const distribution = {};
    this.data.tickets.forEach(ticket => {
      const status = ticket.status || "Unknown";
      distribution[status] = (distribution[status] || 0) + 1;
    });
    return distribution;
  }

  getAssigneeWorkload() {
    const workload = {};
    this.data.tickets.forEach(ticket => {
      const assigneeName = ticket.assigned_to_name || "Unassigned";
      
      if (!workload[assigneeName]) {
        workload[assigneeName] = { open: 0, closed: 0, total: 0 };
      }

      workload[assigneeName].total++;
      
      if (["Resolved", "Closed"].includes(ticket.status)) {
        workload[assigneeName].closed++;
      } else {
        workload[assigneeName].open++;
      }
    });

    Object.keys(workload).forEach(assigneeName => {
      const stats = workload[assigneeName];
      stats.completionRate = stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0;
    });

    return workload;
  }

  async generateTicketNumber() {
    const date = new Date();
    const prefix = `TKT${date.getFullYear().toString().slice(-2)}${(date.getMonth() + 1).toString().padStart(2, "0")}`;
    
    const existingNumbers = this.data.tickets
      .map(t => t.ticket_number)
      .filter(num => num && num.startsWith(prefix))
      .map(num => parseInt(num.slice(-4)) || 0)
      .sort((a, b) => b - a);

    const nextNumber = (existingNumbers[0] || 0) + 1;
    return `${prefix}${nextNumber.toString().padStart(4, "0")}`;
  }

  isTicketOverdue(ticket) {
    if (["Resolved", "Closed"].includes(ticket.status)) return false;
    
    const hoursOpen = (new Date() - new Date(ticket.created_at)) / (1000 * 60 * 60);
    const slaHours = { High: 4, Medium: 24, Low: 72 };
    return hoursOpen > (slaHours[ticket.priority] || 24);
  }

  calculateTimeOpen(ticket) {
    const created = new Date(ticket.created_at);
    const end = ["Resolved", "Closed"].includes(ticket.status) ? new Date(ticket.updated_at) : new Date();
    const hours = Math.floor((end - created) / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);
    return days > 0 ? `${days}d ${hours % 24}h` : `${hours}h`;
  }

  calculatePriorityScore(ticket) {
    const scores = { High: 3, Medium: 2, Low: 1 };
    return scores[ticket.priority] || 0;
  }

  calculateAverageResolutionTime(tickets) {
    const resolvedTickets = tickets.filter(t => ["Resolved", "Closed"].includes(t.status));
    if (resolvedTickets.length === 0) return "0h";

    const totalHours = resolvedTickets.reduce((sum, ticket) => {
      const hours = (new Date(ticket.updated_at) - new Date(ticket.created_at)) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);

    const avgHours = Math.round(totalHours / resolvedTickets.length);
    const days = Math.floor(avgHours / 24);
    return days > 0 ? `${days}d ${avgHours % 24}h` : `${avgHours}h`;
  }

  formatDate(dateString) {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

    return date.toLocaleDateString("en-US", {
      year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
  }

  setupRealtimeSubscriptions() {
    try {
      this.supabase
        .channel("tickets_changes")
        .on("postgres_changes", { event: "*", schema: "public", table: "tickets" }, 
          (payload) => this.handleTicketChange(payload))
        .subscribe();
    } catch (error) {
      console.error('Realtime subscription error:', error);
    }
  }

  handleTicketChange(payload) {
    const { eventType, new: newData, old: oldData } = payload;
    
    switch (eventType) {
      case "INSERT":
        this.data.tickets.unshift({ ...newData, assigned_to_name: this.getUserFullName(newData.assigned_to) });
        break;
      case "UPDATE":
        const updateIndex = this.data.tickets.findIndex(t => t.id === newData.id);
        if (updateIndex !== -1) {
          this.data.tickets[updateIndex] = { ...newData, assigned_to_name: this.getUserFullName(newData.assigned_to) };
        }
        break;
      case "DELETE":
        this.data.tickets = this.data.tickets.filter(t => t.id !== oldData.id);
        break;
    }

    this.calculateStats();
    this.notifyRefreshCallbacks();
  }

  onRefresh(callback) { this.refreshCallbacks.push(callback); }
  offRefresh(callback) { this.refreshCallbacks = this.refreshCallbacks.filter(cb => cb !== callback); }
  notifyRefreshCallbacks() { 
    this.refreshCallbacks.forEach(callback => {
      try { callback(this.data); } catch (error) { console.error('Callback error:', error); }
    });
  }

  exportToCSV(tickets = null) {
    const data = tickets || this.data.tickets;
    const headers = ["Ticket Number", "Title", "Description", "Status", "Priority", "Submitter Name", 
                    "Submitter Email", "Assigned To", "Base", "Category", "Created At", "Updated At"];

    const rows = data.map(ticket => [
      ticket.ticket_number || "", ticket.title || "", ticket.description || "",
      ticket.status || "", ticket.priority || "", ticket.submitter_name || "",
      ticket.submitter_email || "", ticket.assigned_to_name || "",
      this.data.bases[ticket.base_id] || "", this.data.categories[ticket.category_id] || "",
      ticket.created_at || "", ticket.updated_at || ""
    ]);

    return [headers, ...rows].map(row => row.map(field => `"${field}"`).join(",")).join("\n");
  }

  getStatus() {
    return {
      isLoading: this.isLoading,
      lastRefresh: this.lastRefresh,
      ticketCount: this.data.tickets.length,
      baseCount: Object.keys(this.data.bases).length,
      categoryCount: Object.keys(this.data.categories).length,
      userCount: this.data.users.length,
      hasStats: !!this.data.stats
    };
  }
}