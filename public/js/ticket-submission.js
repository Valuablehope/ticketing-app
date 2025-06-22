document.addEventListener("DOMContentLoaded", () => {
  // Initialize Supabase
  const SUPABASE_URL = "https://rkdblbnmtzyrapfemswq.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZGJsYm5tdHp5cmFwZmVtc3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1ODQyNTgsImV4cCI6MjA2NjE2MDI1OH0.TY7Ml-S-knKMNQ-HKylGLbpXIu9wHqGAZDHHAq4rRJc";
  const { createClient } = supabase;
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // --- Element references ---
  const trackTab = document.getElementById('track-tab');
  const submitTab = document.getElementById('submit-tab');
  const trackSection = document.getElementById('track-section');
  const submitSection = document.getElementById('submit-section');
  const trackForm = document.getElementById('track-form');
  const submitForm = document.getElementById('submit-form');
  const loader = document.getElementById('loader');
  const resultContainer = document.getElementById('result');
  const baseSelect = document.getElementById('ticket-base');
  const categorySelect = document.getElementById('ticket-category');
  const toastContainer = document.getElementById('toast-container');

  // --- Data maps for lookups ---
  let basesMap = {};
  let categoriesMap = {};
  let departmentsMap = {};
  let teamsMap = {};

  // --- Utility Functions ---
  
  /**
   * Generate a unique ticket ID with format TKT-YYYYMMDD-XXXX
   */
  function generateTicketNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `TKT-${year}${month}${day}-${random}`;
  }

  /**
   * Show toast notification
   */
  function showToast(message, type = 'info', title = null) {
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
        ${title ? `<h4>${title}</h4>` : ''}
        <p>${message}</p>
      </div>
    `;

    toastContainer.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = 'toastSlideOut 0.3s ease-in forwards';
        setTimeout(() => toast.remove(), 300);
      }
    }, 5000);

    return toast;
  }

  /**
   * Format status badge for display
   */
  function getStatusBadge(status) {
    const statusMap = {
      'Open': { class: 'info', icon: '📋' },
      'In Progress': { class: 'warning', icon: '⚡' },
      'Resolved': { class: 'success', icon: '✅' },
      'Closed': { class: 'muted', icon: '🔒' },
      'On Hold': { class: 'warning', icon: '⏸️' }
    };
    
    const config = statusMap[status] || { class: 'info', icon: '📋' };
    return `<span class="status-badge status-${config.class}">${config.icon} ${status}</span>`;
  }

  /**
   * Format priority badge for display
   */
  function getPriorityBadge(priority) {
    const priorityMap = {
      'Low': { class: 'low', icon: '🟢' },
      'Medium': { class: 'medium', icon: '🟡' },
      'High': { class: 'high', icon: '🔴' }
    };
    
    const config = priorityMap[priority] || { class: 'medium', icon: '🟡' };
    return `<span class="priority-badge priority-${config.class}">${config.icon} ${priority}</span>`;
  }

  /**
   * Validate email format
   */
  function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Add loading state to button
   */
  function setButtonLoading(button, isLoading) {
    if (isLoading) {
      button.disabled = true;
      button.dataset.originalText = button.innerHTML;
      button.innerHTML = `
        <svg class="btn-icon animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/>
        </svg>
        Processing...
      `;
    } else {
      button.disabled = false;
      button.innerHTML = button.dataset.originalText || button.innerHTML;
    }
  }

  // --- Tab Management ---
  function activateTab(tabName) {
    // Update tab states
    trackTab.classList.toggle('active', tabName === 'track');
    submitTab.classList.toggle('active', tabName === 'submit');
    trackTab.setAttribute('aria-selected', tabName === 'track');
    submitTab.setAttribute('aria-selected', tabName === 'submit');

    // Update section visibility
    trackSection.classList.toggle('active', tabName === 'track');
    submitSection.classList.toggle('active', tabName === 'submit');

    // Clear results and hide loader
    clearResults();
    hideLoader();

    // Update URL hash for deep linking
    window.location.hash = tabName;

    // Focus management for accessibility
    const activeSection = tabName === 'track' ? trackSection : submitSection;
    const firstInput = activeSection.querySelector('input, select, textarea');
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
  }

  // Tab event listeners
  trackTab.addEventListener('click', () => activateTab('track'));
  submitTab.addEventListener('click', () => activateTab('submit'));

  // Handle deep linking
  function handleInitialTab() {
    const hash = window.location.hash.slice(1);
    if (hash === 'submit') {
      activateTab('submit');
    } else {
      activateTab('track');
    }
  }

  // --- Loader Management ---
  function showLoader() {
    loader.classList.remove('hidden');
    loader.setAttribute('aria-hidden', 'false');
  }

  function hideLoader() {
    loader.classList.add('hidden');
    loader.setAttribute('aria-hidden', 'true');
  }

  function clearResults() {
    resultContainer.innerHTML = '';
  }

  // --- Data Loading ---
  async function loadLookupData() {
    try {
      showToast('Loading system data...', 'info');

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

      if (basesError) throw new Error(`Failed to load bases: ${basesError.message}`);
      if (categoriesError) throw new Error(`Failed to load categories: ${categoriesError.message}`);
      if (departmentsError) throw new Error(`Failed to load departments: ${departmentsError.message}`);
      if (teamsError) throw new Error(`Failed to load teams: ${teamsError.message}`);

      // Populate bases
      if (bases) {
        bases.forEach(base => {
          basesMap[base.id] = base.name;
          const option = document.createElement('option');
          option.value = base.id;
          option.textContent = base.name;
          baseSelect.appendChild(option);
        });
      }

      // Populate categories
      if (categories) {
        categories.forEach(category => {
          categoriesMap[category.id] = category.name;
          const option = document.createElement('option');
          option.value = category.id;
          option.textContent = category.name;
          categorySelect.appendChild(option);
        });
      }

      // Store departments and teams for future use
      if (departments) {
        departments.forEach(dept => {
          departmentsMap[dept.id] = dept.name;
        });
      }

      if (teams) {
        teams.forEach(team => {
          teamsMap[team.id] = { name: team.name, department_id: team.department_id };
        });
      }

      showToast('System data loaded successfully!', 'success');

    } catch (error) {
      console.error('Error loading lookup data:', error);
      showToast(`Error loading system data: ${error.message}`, 'error');
    }
  }

  // --- Ticket Tracking ---
  async function handleTicketTracking(e) {
    e.preventDefault();
    
    const ticketIdInput = document.getElementById('ticket-id');
    const ticketInput = ticketIdInput.value.trim();
    
    if (!ticketInput) {
      showToast('Please enter a ticket ID', 'warning');
      ticketIdInput.focus();
      return;
    }

    const searchBtn = trackForm.querySelector('.search-btn');
    setButtonLoading(searchBtn, true);
    showLoader();
    clearResults();

    try {
      // Search by ticket_number (human-readable) or id (UUID)
      let query = supabaseClient
        .from('tickets')
        .select(`
          id, ticket_number, title, description, status, priority, created_at, updated_at,
          submitter_name, submitter_email, base_id, category_id, assigned_to
        `);
      
      // Check if input looks like a UUID or ticket number
      if (ticketInput.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        query = query.eq('id', ticketInput);
      } else {
        query = query.eq('ticket_number', ticketInput.toUpperCase());
      }
      
      const { data: ticket, error } = await query.single();

      if (error || !ticket) {
        throw new Error('Ticket not found or access denied');
      }

      // Get additional ticket logs
      const { data: logs } = await supabaseClient
        .from('simple_ticket_log')
        .select('*')
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: false })
        .limit(5);

      displayTicketDetails(ticket, logs);
      showToast('Ticket found successfully!', 'success');

    } catch (error) {
      console.error('Error tracking ticket:', error);
      
      resultContainer.innerHTML = `
        <div class="result-card">
          <div class="error-state">
            <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <h3>Ticket Not Found</h3>
            <p class="error-message">The ticket ID "${ticketInput}" could not be found or you don't have access to it.</p>
            <p class="error-help">Please check your ticket ID and try again.</p>
          </div>
        </div>
      `;
      
      showToast('Ticket not found', 'error');
    } finally {
      setButtonLoading(searchBtn, false);
      hideLoader();
    }
  }

  function displayTicketDetails(ticket, logs = []) {
    const baseName = basesMap[ticket.base_id] || 'Unknown Base';
    const categoryName = categoriesMap[ticket.category_id] || 'Unknown Category';
    
    const assignedTo = ticket.assigned_to 
      ? 'Assigned to support team'
      : 'Unassigned';

    const createdDate = new Date(ticket.created_at);
    const updatedDate = new Date(ticket.updated_at);
    
    resultContainer.innerHTML = `
      <div class="result-card">
        <div class="ticket-header">
          <div class="ticket-id-display">
            <h3>Ticket ${ticket.ticket_number || ticket.id}</h3>
            <div class="ticket-badges">
              ${getStatusBadge(ticket.status)}
              ${getPriorityBadge(ticket.priority)}
            </div>
          </div>
        </div>
        
        <div class="ticket-details">
          <div class="detail-grid">
            <div class="detail-item">
              <label>Title</label>
              <p>${ticket.title}</p>
            </div>
            
            <div class="detail-item">
              <label>Description</label>
              <p class="description">${ticket.description}</p>
            </div>
            
            <div class="detail-item">
              <label>Base/Location</label>
              <p>${baseName}</p>
            </div>
            
            <div class="detail-item">
              <label>Category</label>
              <p>${categoryName}</p>
            </div>
            
            <div class="detail-item">
              <label>Submitted By</label>
              <p>${ticket.submitter_name}<br><small>${ticket.submitter_email}</small></p>
            </div>
            
            <div class="detail-item">
              <label>Assigned To</label>
              <p>${assignedTo}</p>
            </div>
            
            <div class="detail-item">
              <label>Created</label>
              <p>${createdDate.toLocaleDateString()} at ${createdDate.toLocaleTimeString()}</p>
            </div>
            
            <div class="detail-item">
              <label>Last Updated</label>
              <p>${updatedDate.toLocaleDateString()} at ${updatedDate.toLocaleTimeString()}</p>
            </div>
          </div>
          
          ${logs && logs.length > 0 ? `
            <div class="ticket-logs">
              <h4>Recent Activity</h4>
              <div class="logs-list">
                ${logs.map(log => `
                  <div class="log-item">
                    <div class="log-content">
                      <p>${log.action || 'Status updated'}</p>
                      <small>${new Date(log.created_at).toLocaleString()}</small>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // --- Ticket Submission ---
  async function handleTicketSubmission(e) {
    e.preventDefault();
    
    // Get form values
    const formData = {
      name: document.getElementById('submitter-name').value.trim(),
      email: document.getElementById('submitter-email').value.trim(),
      base_id: baseSelect.value,
      category_id: categorySelect.value,
      title: document.getElementById('ticket-title').value.trim(),
      description: document.getElementById('ticket-desc').value.trim(),
      priority: document.querySelector('input[name="priority"]:checked')?.value
    };

    // Validation
    const validationErrors = validateTicketForm(formData);
    if (validationErrors.length > 0) {
      showToast(validationErrors[0], 'warning');
      return;
    }

    const submitBtn = submitForm.querySelector('.submit-btn');
    setButtonLoading(submitBtn, true);
    showLoader();
    clearResults();

    try {
      // Generate unique ticket number for display
      const ticketNumber = generateTicketNumber();
      
      // Create ticket (let Supabase generate UUID for id)
      const { data: ticket, error: ticketError } = await supabaseClient
        .from('tickets')
        .insert([{
          ticket_number: ticketNumber,  // Human-readable ticket number
          submitter_name: formData.name,
          submitter_email: formData.email,
          base_id: formData.base_id,
          category_id: formData.category_id,
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          status: 'Open',
          assigned_to: null
          // Remove created_by - let it use the default value
        }])
        .select('id, ticket_number')
        .single();

      if (ticketError) throw ticketError;

      // Display success result (remove manual logging since triggers handle it)
      displaySubmissionSuccess(ticket.ticket_number, ticket.id, formData);
      
      // Reset form
      submitForm.reset();
      
      // Clear priority selection
      document.querySelectorAll('input[name="priority"]').forEach(radio => {
        radio.checked = false;
      });

      showToast('Ticket submitted successfully!', 'success', 'Success');

    } catch (error) {
      console.error('Error submitting ticket:', error);
      
      resultContainer.innerHTML = `
        <div class="result-card">
          <div class="error-state">
            <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="15" y1="9" x2="9" y2="15"></line>
              <line x1="9" y1="9" x2="15" y2="15"></line>
            </svg>
            <h3>Submission Failed</h3>
            <p class="error-message">We couldn't submit your ticket at this time.</p>
            <p class="error-help">Please try again or contact support if the problem persists.</p>
          </div>
        </div>
      `;
      
      showToast('Failed to submit ticket. Please try again.', 'error');
    } finally {
      setButtonLoading(submitBtn, false);
      hideLoader();
    }
  }

  function validateTicketForm(formData) {
    const errors = [];
    
    if (!formData.name) errors.push('Please enter your full name');
    if (!formData.email) errors.push('Please enter your email address');
    else if (!isValidEmail(formData.email)) errors.push('Please enter a valid email address');
    if (!formData.base_id) errors.push('Please select your base/location');
    if (!formData.category_id) errors.push('Please select an issue category');
    if (!formData.title) errors.push('Please enter an issue title');
    if (!formData.description) errors.push('Please provide a detailed description');
    if (!formData.priority) errors.push('Please select a priority level');
    
    return errors;
  }

  function displaySubmissionSuccess(ticketNumber, ticketId, formData) {
    const baseName = basesMap[formData.base_id] || 'Unknown';
    const categoryName = categoriesMap[formData.category_id] || 'Unknown';
    
    resultContainer.innerHTML = `
      <div class="result-card">
        <div class="success-state">
          <svg class="success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22,4 12,14.01 9,11.01"></polyline>
          </svg>
          <h3>Ticket Submitted Successfully!</h3>
          <div class="ticket-id-success">
            <label>Your Ticket ID:</label>
            <code class="ticket-id-code">${ticketNumber}</code>
            <button class="copy-btn" onclick="navigator.clipboard.writeText('${ticketNumber}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
          
          <div class="submission-summary">
            <h4>Ticket Summary</h4>
            <div class="summary-grid">
              <div><strong>Title:</strong> ${formData.title}</div>
              <div><strong>Priority:</strong> ${getPriorityBadge(formData.priority)}</div>
              <div><strong>Base:</strong> ${baseName}</div>
              <div><strong>Category:</strong> ${categoryName}</div>
            </div>
          </div>
          
          <div class="next-steps">
            <h4>What's Next?</h4>
            <ul>
              <li>Save your ticket ID for future reference</li>
              <li>You'll receive email updates at ${formData.email}</li>
              <li>Our support team will review your request within 24 hours</li>
              <li>Use the "Track Ticket" tab to check status updates</li>
            </ul>
          </div>
        </div>
      </div>
    `;
  }

  // --- Event Listeners ---
  trackForm.addEventListener('submit', handleTicketTracking);
  submitForm.addEventListener('submit', handleTicketSubmission);

  // Form enhancements
  document.getElementById('ticket-id').addEventListener('input', (e) => {
    // Auto-format ticket ID input
    let value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    e.target.value = value;
  });

  // Real-time form validation
  const requiredFields = ['submitter-name', 'submitter-email', 'ticket-title', 'ticket-desc'];
  requiredFields.forEach(fieldId => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener('blur', (e) => {
        const isValid = e.target.value.trim() !== '';
        e.target.classList.toggle('error', !isValid);
      });
    }
  });

  // Email validation
  document.getElementById('submitter-email').addEventListener('blur', (e) => {
    const email = e.target.value.trim();
    const isValid = email === '' || isValidEmail(email);
    e.target.classList.toggle('error', !isValid);
  });

  // Priority selection visual feedback
  document.querySelectorAll('input[name="priority"]').forEach(radio => {
    radio.addEventListener('change', () => {
      document.querySelectorAll('.priority-option').forEach(option => {
        option.classList.remove('selected');
      });
      radio.closest('.priority-option').classList.add('selected');
    });
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.altKey) {
      switch(e.key) {
        case '1':
          e.preventDefault();
          activateTab('track');
          break;
        case '2':
          e.preventDefault();
          activateTab('submit');
          break;
      }
    }
  });

  // --- Initialize Application ---
  async function initializeApp() {
    try {
      await loadLookupData();
      handleInitialTab();
      
      // Add some accessibility enhancements
      document.body.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          // Close any open toasts
          document.querySelectorAll('.toast').forEach(toast => toast.remove());
        }
      });
      
    } catch (error) {
      console.error('Failed to initialize app:', error);
      showToast('Failed to initialize application. Please refresh the page.', 'error');
    }
  }

  // Start the application
  initializeApp();
});