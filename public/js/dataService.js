// === DATA SERVICE - COMPLETE REWRITE ===
class DataService {
  constructor(supabaseClient) {
    this.supabase = supabaseClient;
    this.data = {
      tickets: [],
      bases: {},
      categories: {},
      users: [],
      usersLookup: {}, // Add lookup for user ID to full name
      stats: null,
    };
    this.isLoading = false;
    this.lastRefresh = null;
    this.refreshCallbacks = [];
  }

  /**
   * Initialize data service
   */
  async initialize() {
    try {
      
      await this.refreshData();
      this.setupRealtimeSubscriptions();
      
      return true;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Refresh all data from database
   */
  async refreshData() {
    if (this.isLoading) {
      
      return;
    }

    this.isLoading = true;

    try {
      

      // Load all data in parallel for better performance
      const [ticketsResult, basesResult, categoriesResult, usersResult] =
        await Promise.allSettled([
          this.loadTickets(),
          this.loadBases(),
          this.loadCategories(),
          this.loadUsers(),
        ]);

      // Log any errors but don't throw to allow partial data loading
      if (ticketsResult.status === "rejected") {
        
      }
      if (basesResult.status === "rejected") {
        
      }
      if (categoriesResult.status === "rejected") {
        
      }
      if (usersResult.status === "rejected") {
        
      }

      // Calculate statistics
      this.calculateStats();

      this.lastRefresh = new Date();
      this.isLoading = false;

      // Notify all registered callbacks
      this.notifyRefreshCallbacks();

      
    } catch (error) {
      this.isLoading = false;
      
      throw error;
    }
  }

  /**
   * Load tickets from database
   */
  async loadTickets() {
    try {
      const { data: ticketsData, error } = await this.supabase
        .from("tickets")
        .select(
          `
          *,
          base:bases(id, name),
          category:ticket_cats(id, name)
        `
        )
        .order("created_at", { ascending: false });

      if (error) {
        // Handle case where tables don't exist yet
        if (error.code === "42P01") {
          
          this.data.tickets = [];
          return;
        }
        throw error;
      }

      // Process and enrich ticket data
      this.data.tickets = (ticketsData || []).map((ticket) => ({
        ...ticket,
        // Add computed fields
        isOverdue: this.isTicketOverdue(ticket),
        timeOpen: this.calculateTimeOpen(ticket),
        priorityScore: this.calculatePriorityScore(ticket),
        // Format dates
        created_at_formatted: this.formatDate(ticket.created_at),
        updated_at_formatted: this.formatDate(ticket.updated_at),
        // Normalize status for filtering
        status_normalized: ticket.status?.toLowerCase().replace(/\s+/g, "_"),
        priority_normalized: ticket.priority?.toLowerCase(),
        // Add user full name for assigned_to
        assigned_to_name: this.getUserFullName(ticket.assigned_to),
      }));

      
    } catch (error) {
      
      this.data.tickets = [];
      throw error;
    }
  }

  /**
   * Load bases/locations from database
   */
  async loadBases() {
    try {
      // Try with minimal columns first
      const { data: basesData, error } = await this.supabase
        .from("bases")
        .select("id, name")
        .order("name");

      if (error) {
        if (error.code === "42P01") {
          
          this.data.bases = {};
          return;
        }
        throw error;
      }

      // Convert array to lookup object
      this.data.bases = {};
      if (basesData) {
        basesData.forEach((base) => {
          this.data.bases[base.id] = base.name; // <-- just the string
        });
      }

      
    } catch (error) {
      
      this.data.bases = {};
      // Don't throw - let app continue with empty bases
    }
  }

  /**
   * Load ticket categories from database
   */
  async loadCategories() {
    try {
      // Try with minimal columns first
      const { data: categoriesData, error } = await this.supabase
        .from("ticket_cats")
        .select("id, name")
        .order("name");

      if (error) {
        if (error.code === "42P01") {
          
          this.data.categories = {};
          return;
        }
        throw error;
      }

      // Convert array to lookup object
      this.data.categories = {};
      if (categoriesData) {
        categoriesData.forEach((category) => {
          this.data.categories[category.id] = category.name; // <-- just the string
        });
      }

      
    } catch (error) {
      
      this.data.categories = {};
      // Don't throw - let app continue with empty categories
    }
  }

  /**
   * Load users from his_users table instead of profiles
   */
  async loadUsers() {
    try {
      // Try with his_users table
      const { data: usersData, error } = await this.supabase
        .from("his_users")
        .select("id, full_name, role")
        .order("full_name");

      if (error) {
        if (error.code === "42P01") {
          
          this.data.users = [];
          this.data.usersLookup = {};
          return;
        }
        throw error;
      }

      this.data.users = usersData || [];

      // Create lookup object for user ID to full name mapping
      this.data.usersLookup = {};
      if (usersData) {
        usersData.forEach((user) => {
          this.data.usersLookup[user.id] = {
            id: user.id,
            //email: user.email,
            full_name: user.full_name,
            role: user.role,
          };
        });
      }

      
    } catch (error) {
      
      this.data.users = [];
      this.data.usersLookup = {};
      // Don't throw - let app continue with empty users
    }
  }

  /**
   * Get user full name by user ID
   */
  getUserFullName(userId) {
    if (!userId) return null;
    const user = this.data.usersLookup[userId];
    return user ? user.full_name : userId; // Fallback to ID if name not found
  }

  /**
   * Get user info by user ID
   */
  getUserInfo(userId) {
    if (!userId) return null;
    return this.data.usersLookup[userId] || null;
  }

  /**
   * Create new ticket
   */
  async createTicket(ticketData) {
    try {
      const newTicket = {
        ...ticketData,
        ticket_number: await this.generateTicketNumber(),
        status: ticketData.status || "Open",
        priority: ticketData.priority || "Medium",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from("tickets")
        .insert([newTicket])
        .select()
        .single();

      if (error) throw error;

      // Add to local data with enriched fields
      const enrichedTicket = {
        ...data,
        assigned_to_name: this.getUserFullName(data.assigned_to),
        isOverdue: this.isTicketOverdue(data),
        timeOpen: this.calculateTimeOpen(data),
        priorityScore: this.calculatePriorityScore(data),
      };

      this.data.tickets.unshift(enrichedTicket);
      this.calculateStats();
      this.notifyRefreshCallbacks();

      
      return enrichedTicket;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Update existing ticket
   */
  async updateTicket(ticketId, updates) {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from("tickets")
        .update(updateData)
        .eq("id", ticketId)
        .select()
        .single();

      if (error) throw error;

      // Update local data
      const ticketIndex = this.data.tickets.findIndex((t) => t.id === ticketId);
      if (ticketIndex !== -1) {
        this.data.tickets[ticketIndex] = {
          ...this.data.tickets[ticketIndex],
          ...data,
          // Recalculate computed fields
          assigned_to_name: this.getUserFullName(data.assigned_to),
          isOverdue: this.isTicketOverdue(data),
          timeOpen: this.calculateTimeOpen(data),
          priorityScore: this.calculatePriorityScore(data),
        };
      }

      this.calculateStats();
      this.notifyRefreshCallbacks();

      
      return this.data.tickets[ticketIndex];
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Delete ticket
   */
  async deleteTicket(ticketId) {
    try {
      const { error } = await this.supabase
        .from("tickets")
        .delete()
        .eq("id", ticketId);

      if (error) throw error;

      // Remove from local data
      const ticketIndex = this.data.tickets.findIndex((t) => t.id === ticketId);
      if (ticketIndex !== -1) {
        const deletedTicket = this.data.tickets.splice(ticketIndex, 1)[0];
        
      }

      this.calculateStats();
      this.notifyRefreshCallbacks();

      return true;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Bulk update tickets
   */
  async bulkUpdateTickets(ticketIds, updates) {
    try {
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from("tickets")
        .update(updateData)
        .in("id", ticketIds)
        .select();

      if (error) throw error;

      // Update local data
      data.forEach((updatedTicket) => {
        const ticketIndex = this.data.tickets.findIndex(
          (t) => t.id === updatedTicket.id
        );
        if (ticketIndex !== -1) {
          this.data.tickets[ticketIndex] = {
            ...this.data.tickets[ticketIndex],
            ...updatedTicket,
            assigned_to_name: this.getUserFullName(updatedTicket.assigned_to),
          };
        }
      });

      this.calculateStats();
      this.notifyRefreshCallbacks();

      
      return data;
    } catch (error) {
      
      throw error;
    }
  }

  /**
   * Search tickets with advanced filters
   */
  searchTickets(filters = {}) {
    let filtered = [...this.data.tickets];

    // Text search
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(
        (ticket) =>
          ticket.title?.toLowerCase().includes(searchTerm) ||
          ticket.description?.toLowerCase().includes(searchTerm) ||
          ticket.ticket_number?.toLowerCase().includes(searchTerm) ||
          ticket.submitter_name?.toLowerCase().includes(searchTerm) ||
          ticket.submitter_email?.toLowerCase().includes(searchTerm) ||
          ticket.assigned_to_name?.toLowerCase().includes(searchTerm)
      );
    }

    // Status filter
    if (filters.status && filters.status !== "") {
      filtered = filtered.filter((ticket) => ticket.status === filters.status);
    }

    // Priority filter
    if (filters.priority && filters.priority !== "") {
      filtered = filtered.filter(
        (ticket) => ticket.priority === filters.priority
      );
    }

    // Base filter
    if (filters.base_id && filters.base_id !== "") {
      filtered = filtered.filter(
        (ticket) => ticket.base_id === filters.base_id
      );
    }

    // Category filter
    if (filters.category_id && filters.category_id !== "") {
      filtered = filtered.filter(
        (ticket) => ticket.category_id === filters.category_id
      );
    }

    // Assignee filter
    if (filters.assigned_to && filters.assigned_to !== "") {
      filtered = filtered.filter(
        (ticket) => ticket.assigned_to === filters.assigned_to
      );
    }

    // Date range filter
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(
        (ticket) => new Date(ticket.created_at) >= fromDate
      );
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      filtered = filtered.filter(
        (ticket) => new Date(ticket.created_at) <= toDate
      );
    }

    // Overdue filter
    if (filters.overdue === true) {
      filtered = filtered.filter((ticket) => ticket.isOverdue);
    }

    // Sort results
    if (filters.sortBy) {
      filtered.sort((a, b) => {
        let aValue = a[filters.sortBy];
        let bValue = b[filters.sortBy];

        // Handle date sorting
        if (filters.sortBy.includes("_at")) {
          aValue = new Date(aValue);
          bValue = new Date(bValue);
        }

        // Handle priority sorting
        if (filters.sortBy === "priority") {
          const priorityOrder = { High: 3, Medium: 2, Low: 1 };
          aValue = priorityOrder[aValue] || 0;
          bValue = priorityOrder[bValue] || 0;
        }

        if (filters.sortDirection === "desc") {
          return aValue < bValue ? 1 : -1;
        } else {
          return aValue > bValue ? 1 : -1;
        }
      });
    }

    return filtered;
  }

  // === GETTER METHODS ===

  /**
   * Get all tickets
   */
  getTickets() {
    return this.data.tickets;
  }

  /**
   * Get single ticket by ID
   */
  getTicket(id) {
    return this.data.tickets.find((t) => t.id === id);
  }

  /**
   * Get tickets by status
   */
  getTicketsByStatus(status) {
    return this.data.tickets.filter((t) => t.status === status);
  }

  /**
   * Get tickets by priority
   */
  getTicketsByPriority(priority) {
    return this.data.tickets.filter((t) => t.priority === priority);
  }

  /**
   * Get recent tickets
   */
  getRecentTickets(limit = 5) {
    return this.data.tickets
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);
  }

  /**
   * Get overdue tickets
   */
  getOverdueTickets() {
    return this.data.tickets.filter((t) => t.isOverdue);
  }

  /**
   * Get bases
   */
  getBases() {
    return this.data.bases;
  }

  /**
   * Get base by ID
   */
  getBase(id) {
    return this.data.bases[id];
  }

  /**
   * Get categories
   */
  getCategories() {
    return this.data.categories;
  }

  /**
   * Get category by ID
   */
  getCategory(id) {
    return this.data.categories[id];
  }

  /**
   * Get users
   */
  getUsers() {
    return this.data.users;
  }

  /**
   * Get assignable users (users with appropriate roles)
   */
  getAssignableUsers() {
    return this.data.users.filter(
      (user) =>
        user.role &&
        ["admin", "technician", "support", "staff"].includes(
          user.role.toLowerCase()
        )
    );
  }

  // === STATISTICS METHODS ===

  /**
   * Calculate and cache statistics
   */
  calculateStats() {
    const tickets = this.data.tickets;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    this.data.stats = {
      // Basic counts
      total: tickets.length,
      open: tickets.filter((t) => t.status === "Open").length,
      inProgress: tickets.filter((t) => t.status === "In Progress").length,
      resolved: tickets.filter((t) => t.status === "Resolved").length,
      closed: tickets.filter((t) => t.status === "Closed").length,

      // Time-based counts
      createdToday: tickets.filter((t) => new Date(t.created_at) >= today)
        .length,
      createdThisWeek: tickets.filter((t) => new Date(t.created_at) >= thisWeek)
        .length,
      createdThisMonth: tickets.filter(
        (t) => new Date(t.created_at) >= thisMonth
      ).length,

      resolvedToday: tickets.filter(
        (t) => t.status === "Resolved" && new Date(t.updated_at) >= today
      ).length,

      // Priority distribution
      highPriority: tickets.filter((t) => t.priority === "High").length,
      mediumPriority: tickets.filter((t) => t.priority === "Medium").length,
      lowPriority: tickets.filter((t) => t.priority === "Low").length,

      // Other metrics
      overdue: tickets.filter((t) => t.isOverdue).length,
      unassigned: tickets.filter((t) => !t.assigned_to).length,
      avgResolutionTime: this.calculateAverageResolutionTime(tickets),

      // Status distribution
      statusDistribution: this.getStatusDistribution(),
      priorityDistribution: this.getPriorityDistribution(),
      assigneeWorkload: this.getAssigneeWorkload(),
    };
  }

  /**
   * Get cached statistics
   */
  getStats() {
    return this.data.stats || this.calculateStats();
  }

  /**
   * Get status distribution
   */
  getStatusDistribution() {
    const distribution = {};
    this.data.tickets.forEach((ticket) => {
      const status = ticket.status || "Unknown";
      distribution[status] = (distribution[status] || 0) + 1;
    });
    return distribution;
  }

  /**
   * Get priority distribution
   */
  getPriorityDistribution() {
    const distribution = {};
    this.data.tickets.forEach((ticket) => {
      const priority = ticket.priority || "Unknown";
      distribution[priority] = (distribution[priority] || 0) + 1;
    });
    return distribution;
  }

  /**
   * Get assignee workload with full names
   */
  getAssigneeWorkload() {
    const workload = {};
    this.data.tickets.forEach((ticket) => {
      // Use full name if available, otherwise use 'Unassigned' or the user ID
      const assigneeName =
        ticket.assigned_to_name ||
        (ticket.assigned_to ? `User ${ticket.assigned_to}` : "Unassigned");

      if (!workload[assigneeName]) {
        workload[assigneeName] = {
          open: 0,
          closed: 0,
          total: 0,
          inProgress: 0,
        };
      }

      workload[assigneeName].total++;

      switch (ticket.status) {
        case "Open":
          workload[assigneeName].open++;
          break;
        case "In Progress":
          workload[assigneeName].inProgress++;
          break;
        case "Resolved":
        case "Closed":
          workload[assigneeName].closed++;
          break;
      }
    });

    // Calculate completion rates
    Object.keys(workload).forEach((assigneeName) => {
      const stats = workload[assigneeName];
      stats.completionRate =
        stats.total > 0 ? Math.round((stats.closed / stats.total) * 100) : 0;
    });

    return workload;
  }

  // === UTILITY METHODS ===

  /**
   * Generate unique ticket number
   */
  async generateTicketNumber() {
    const prefix = "TKT";
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, "0");

    // Get the last ticket number for today
    const existingNumbers = this.data.tickets
      .map((t) => t.ticket_number)
      .filter((num) => num && num.startsWith(`${prefix}${year}${month}`))
      .map((num) => parseInt(num.slice(-4)) || 0)
      .sort((a, b) => b - a);

    const nextNumber = (existingNumbers[0] || 0) + 1;
    return `${prefix}${year}${month}${nextNumber.toString().padStart(4, "0")}`;
  }

  /**
   * Check if ticket is overdue
   */
  isTicketOverdue(ticket) {
    if (ticket.status === "Resolved" || ticket.status === "Closed") {
      return false;
    }

    const created = new Date(ticket.created_at);
    const now = new Date();
    const hoursOpen = (now - created) / (1000 * 60 * 60);

    // Define SLA hours based on priority
    const slaHours = {
      High: 4,
      Medium: 24,
      Low: 72,
    };

    const sla = slaHours[ticket.priority] || 24;
    return hoursOpen > sla;
  }

  /**
   * Calculate time ticket has been open
   */
  calculateTimeOpen(ticket) {
    const created = new Date(ticket.created_at);
    const end =
      ticket.status === "Resolved" || ticket.status === "Closed"
        ? new Date(ticket.updated_at)
        : new Date();

    const diff = end - created;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `${days}d ${hours % 24}h`;
    } else {
      return `${hours}h`;
    }
  }

  /**
   * Calculate priority score for sorting
   */
  calculatePriorityScore(ticket) {
    const priorityScores = { High: 3, Medium: 2, Low: 1 };
    return priorityScores[ticket.priority] || 0;
  }

  /**
   * Calculate average resolution time
   */
  calculateAverageResolutionTime(tickets) {
    const resolvedTickets = tickets.filter(
      (t) => t.status === "Resolved" || t.status === "Closed"
    );

    if (resolvedTickets.length === 0) return "0h";

    const totalHours = resolvedTickets.reduce((sum, ticket) => {
      const created = new Date(ticket.created_at);
      const resolved = new Date(ticket.updated_at);
      const hours = (resolved - created) / (1000 * 60 * 60);
      return sum + hours;
    }, 0);

    const avgHours = Math.round(totalHours / resolvedTickets.length);
    const days = Math.floor(avgHours / 24);

    if (days > 0) {
      return `${days}d ${avgHours % 24}h`;
    } else {
      return `${avgHours}h`;
    }
  }

  /**
   * Format date for display
   */
  formatDate(dateString) {
    if (!dateString) return "";

    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);

    // Return relative time for recent dates
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400)
      return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800)
      return `${Math.floor(diffInSeconds / 86400)}d ago`;

    // Return formatted date for older dates
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // === REAL-TIME SUBSCRIPTIONS ===

  /**
   * Setup real-time subscriptions for data changes
   */
  setupRealtimeSubscriptions() {
    try {
      // Subscribe to ticket changes
      this.supabase
        .channel("tickets_changes")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "tickets" },
          (payload) => this.handleTicketChange(payload)
        )
        .subscribe();

      
    } catch (error) {
      
    }
  }

  /**
   * Handle real-time ticket changes
   */
  handleTicketChange(payload) {
    

    switch (payload.eventType) {
      case "INSERT":
        const newTicket = {
          ...payload.new,
          assigned_to_name: this.getUserFullName(payload.new.assigned_to),
        };
        this.data.tickets.unshift(newTicket);
        break;

      case "UPDATE":
        const updateIndex = this.data.tickets.findIndex(
          (t) => t.id === payload.new.id
        );
        if (updateIndex !== -1) {
          this.data.tickets[updateIndex] = {
            ...payload.new,
            assigned_to_name: this.getUserFullName(payload.new.assigned_to),
          };
        }
        break;

      case "DELETE":
        this.data.tickets = this.data.tickets.filter(
          (t) => t.id !== payload.old.id
        );
        break;
    }

    this.calculateStats();
    this.notifyRefreshCallbacks();
  }

  // === CALLBACK MANAGEMENT ===

  /**
   * Register callback for data refresh events
   */
  onRefresh(callback) {
    this.refreshCallbacks.push(callback);
  }

  /**
   * Unregister refresh callback
   */
  offRefresh(callback) {
    this.refreshCallbacks = this.refreshCallbacks.filter(
      (cb) => cb !== callback
    );
  }

  /**
   * Notify all refresh callbacks
   */
  notifyRefreshCallbacks() {
    this.refreshCallbacks.forEach((callback) => {
      try {
        callback(this.data);
      } catch (error) {
        
      }
    });
  }

  // === DATA EXPORT/IMPORT ===

  /**
   * Export tickets to CSV
   */
  exportToCSV(tickets = null) {
    const data = tickets || this.data.tickets;
    const headers = [
      "Ticket Number",
      "Title",
      "Description",
      "Status",
      "Priority",
      "Submitter Name",
      "Submitter Email",
      "Assigned To",
      "Base",
      "Category",
      "Created At",
      "Updated At",
    ];

    const rows = data.map((ticket) => [
      ticket.ticket_number || "",
      ticket.title || "",
      ticket.description || "",
      ticket.status || "",
      ticket.priority || "",
      ticket.submitter_name || "",
      ticket.submitter_email || "",
      ticket.assigned_to_name || "", // Use full name instead of ID
      this.data.bases[ticket.base_id]?.name || "",
      this.data.categories[ticket.category_id]?.name || "",
      ticket.created_at || "",
      ticket.updated_at || "",
    ]);

    const csvContent = [headers, ...rows]
      .map((row) => row.map((field) => `"${field}"`).join(","))
      .join("\n");

    return csvContent;
  }

  /**
   * Get data service status
   */
  getStatus() {
    return {
      isLoading: this.isLoading,
      lastRefresh: this.lastRefresh,
      ticketCount: this.data.tickets.length,
      baseCount: Object.keys(this.data.bases).length,
      categoryCount: Object.keys(this.data.categories).length,
      userCount: this.data.users.length,
      hasStats: !!this.data.stats,
    };
  }
}
