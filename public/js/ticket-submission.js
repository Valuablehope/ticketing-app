// Security check - runs immediately when script loads
(function () {
  "use strict";

  // Function to check session validity
  function isValidSession() {
    try {
      const session = sessionStorage.getItem("ticketing_session");
      const signature = sessionStorage.getItem("session_signature");

      if (!session || !signature) {
        return false;
      }

      const sessionData = JSON.parse(session);

      // Check if session is expired
      if (!sessionData.expiration || sessionData.expiration <= Date.now()) {
        return false;
      }

      // Check if session is properly verified
      if (!sessionData.verified || !sessionData.token) {
        return false;
      }

      // Verify signature hasn't been tampered with
      try {
        const signatureData = JSON.parse(atob(signature));
        if (
          !signatureData.token ||
          !signatureData.timestamp ||
          !signatureData.email
        ) {
          return false;
        }

        // Check if signature matches session
        if (signatureData.token !== sessionData.token) {
          return false;
        }

        // Check if signature is not too old (max 1 hour)
        if (Date.now() - signatureData.timestamp > 60 * 60 * 1000) {
          return false;
        }
      } catch (e) {
        return false;
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  // Function to clear session and redirect
  function redirectToAuth() {
    sessionStorage.removeItem("ticketing_session");
    sessionStorage.removeItem("session_signature");

    // Show a brief message before redirect
    document.body.innerHTML = `
      <div style="
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        font-family: Inter, sans-serif;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        margin: 0;
        padding: 20px;
      ">
        <div style="
          background: rgba(255,255,255,0.95);
          backdrop-filter: blur(8px);
          border-radius: 16px;
          padding: 40px;
          text-align: center;
          box-shadow: 0 10px 30px rgba(0,0,0,0.1);
          max-width: 400px;
        ">
          <h2 style="color: #333; margin-bottom: 20px;">Access Denied</h2>
          <p style="color: #666; margin-bottom: 20px;">Please verify your email address to access the ticketing system.</p>
          <div style="color: #667eea;">Redirecting...</div>
        </div>
      </div>
    `;

    setTimeout(() => {
      window.location.href = "../index.html";
    }, 2000);
  }

  // Check session immediately
  if (!isValidSession()) {
    redirectToAuth();
    return; // Stop script execution
  }

  // Set up periodic session checks
  setInterval(() => {
    if (!isValidSession()) {
      redirectToAuth();
    }
  }, 60000); // Check every minute

  // Check when page becomes visible (user switches back to tab)
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && !isValidSession()) {
      redirectToAuth();
    }
  });
})();

document.addEventListener("DOMContentLoaded", () => {
  // Initialize Supabase
  const SUPABASE_URL = "https://rkdblbnmtzyrapfemswq.supabase.co";
  const SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZGJsYm5tdHp5cmFwZmVtc3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1ODQyNTgsImV4cCI6MjA2NjE2MDI1OH0.TY7Ml-S-knKMNQ-HKylGLbpXIu9wHqGAZDHHAq4rRJc";
  const { createClient } = supabase;
  const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Get user email from session for pre-filling
  let userEmail = "";
  try {
    const session = sessionStorage.getItem("ticketing_session");
    if (session) {
      const sessionData = JSON.parse(session);
      userEmail = sessionData.email || "";
    }
  } catch (error) {
    
  }

  // --- Element references ---
  const trackTab = document.getElementById("track-tab");
  const submitTab = document.getElementById("submit-tab");
  const trackSection = document.getElementById("track-section");
  const submitSection = document.getElementById("submit-section");
  const trackForm = document.getElementById("track-form");
  const submitForm = document.getElementById("submit-form");
  const loader = document.getElementById("loader");
  const resultContainer = document.getElementById("result");
  const baseSelect = document.getElementById("ticket-base");
  const categorySelect = document.getElementById("ticket-category");
  const toastContainer = document.getElementById("toast-container");

  // Screenshot upload elements
  const fileInput = document.getElementById('screenshot-upload');
  const uploadArea = document.getElementById('upload-area');
  const previewContainer = document.getElementById('screenshot-preview');
  const previewImage = document.getElementById('preview-image');
  const fileName = document.getElementById('file-name');
  const fileSize = document.getElementById('file-size');
  const removeBtn = document.getElementById('remove-screenshot');

  // --- Data maps for lookups ---
  let basesMap = {};
  let categoriesMap = {};
  let departmentsMap = {};
  let teamsMap = {};
  let selectedFile = null;

  // --- Utility Functions ---

  /**
   * Generate a unique ticket ID with format TKT-YYYYMMDD-XXXX
   */
  function generateTicketNumber() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const random = Math.floor(Math.random() * 9999)
      .toString()
      .padStart(4, "0");
    return `TKT-${year}${month}${day}-${random}`;
  }

  /**
   * Show toast notification
   */
  function showToast(message, type = "info", title = null) {
    const toast = document.createElement("div");
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
             </svg>`,
    };

    toast.innerHTML = `
      ${iconMap[type] || iconMap.info}
      <div class="toast-content">
        ${title ? `<h4>${title}</h4>` : ""}
        <p>${message}</p>
      </div>
    `;

    toastContainer.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = "toastSlideOut 0.3s ease-in forwards";
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
      Open: { class: "info", icon: "📋" },
      "In Progress": { class: "warning", icon: "⚡" },
      Resolved: { class: "success", icon: "✅" },
      Closed: { class: "muted", icon: "🔒" },
      "On Hold": { class: "warning", icon: "⏸️" },
    };

    const config = statusMap[status] || { class: "info", icon: "📋" };
    return `<span class="status-badge status-${config.class}">${config.icon} ${status}</span>`;
  }

  /**
   * Format priority badge for display
   */
  function getPriorityBadge(priority) {
    const priorityMap = {
      Low: { class: "low", icon: "🟢" },
      Medium: { class: "medium", icon: "🟡" },
      High: { class: "high", icon: "🔴" },
    };

    const config = priorityMap[priority] || { class: "medium", icon: "🟡" };
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

  // --- Screenshot Upload Functions ---

  /**
   * Validate uploaded file
   */
  function validateFile(file) {
    const maxSize = 5 * 1024 * 1024; // 5MB for storage
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif'];
    
    if (!allowedTypes.includes(file.type)) {
      return 'Please select a valid image file (PNG, JPG, GIF)';
    }
    
    if (file.size > maxSize) {
      return 'File size must be less than 5MB';
    }
    
    return null;
  }

  /**
   * Format file size for display
   */
  function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Handle file selection and preview
   */
  function handleFileSelect(file) {
    const error = validateFile(file);
    
    if (error) {
      if (uploadArea) {
        uploadArea.classList.add('error');
        uploadArea.querySelector('.file-upload-text').textContent = error;
        uploadArea.querySelector('.file-upload-hint').textContent = 'Please try again with a different file';
      }
      showToast(error, 'error');
      return;
    }

    if (uploadArea) {
      uploadArea.classList.remove('error');
    }
    selectedFile = file;
    
    // Show preview
    const reader = new FileReader();
    reader.onload = function(e) {
      if (previewImage) previewImage.src = e.target.result;
      if (fileName) fileName.textContent = file.name;
      if (fileSize) fileSize.textContent = formatFileSize(file.size);
      if (previewContainer) previewContainer.classList.remove('hidden');
      
      // Update upload area
      if (uploadArea) {
        uploadArea.querySelector('.file-upload-text').textContent = 'Screenshot selected';
        uploadArea.querySelector('.file-upload-hint').textContent = 'Click to change or drag a different file';
      }
    };
    reader.readAsDataURL(file);
    
    showToast('Screenshot uploaded successfully!', 'success');
  }

  /**
   * Upload file to Supabase Storage
   */
  async function uploadScreenshot(file, ticketId) {
    try {
      console.log('Starting screenshot upload for ticket:', ticketId);
      console.log('File details:', { name: file.name, size: file.size, type: file.type });

      const fileExt = file.name.split('.').pop().toLowerCase();
      const fileName = `${ticketId}_screenshot_${Date.now()}.${fileExt}`;
      const filePath = `screenshots/${fileName}`;

      console.log('Uploading to storage path:', filePath);

      // Upload the file to the existing bucket
      const { data, error } = await supabaseClient.storage
        .from('ticket-attachments')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        console.error('Storage upload error:', error);
        throw new Error(`Upload failed: ${error.message}`);
      }

      console.log('Storage upload successful:', data);

      // Get the public URL
      const { data: urlData } = supabaseClient.storage
        .from('ticket-attachments')
        .getPublicUrl(filePath);

      console.log('Public URL generated:', urlData);

      if (!urlData.publicUrl) {
        throw new Error('Failed to generate public URL');
      }

      return {
        path: filePath,
        url: urlData.publicUrl,
        filename: file.name,
        size: file.size
      };

    } catch (error) {
      console.error('Error uploading screenshot:', error);
      throw new Error(`Failed to upload screenshot: ${error.message}`);
    }
  }

  // --- Tab Management ---
  function activateTab(tabName) {
    // Update tab states
    trackTab.classList.toggle("active", tabName === "track");
    submitTab.classList.toggle("active", tabName === "submit");
    trackTab.setAttribute("aria-selected", tabName === "track");
    submitTab.setAttribute("aria-selected", tabName === "submit");

    // Update section visibility
    trackSection.classList.toggle("active", tabName === "track");
    submitSection.classList.toggle("active", tabName === "submit");

    // Clear results and hide loader
    clearResults();
    hideLoader();

    // Update URL hash for deep linking
    window.location.hash = tabName;

    // Focus management for accessibility
    const activeSection = tabName === "track" ? trackSection : submitSection;
    const firstInput = activeSection.querySelector("input, select, textarea");
    if (firstInput) {
      setTimeout(() => firstInput.focus(), 100);
    }
  }

  // Tab event listeners
  if (trackTab) trackTab.addEventListener("click", () => activateTab("track"));
  if (submitTab) submitTab.addEventListener("click", () => activateTab("submit"));

  // Handle deep linking
  function handleInitialTab() {
    const hash = window.location.hash.slice(1);
    if (hash === "submit") {
      activateTab("submit");
    } else {
      activateTab("track");
    }
  }

  // --- Loader Management ---
  function showLoader() {
    if (loader) {
      loader.classList.remove("hidden");
      loader.setAttribute("aria-hidden", "false");
    }
  }

  function hideLoader() {
    if (loader) {
      loader.classList.add("hidden");
      loader.setAttribute("aria-hidden", "true");
    }
  }

  function clearResults() {
    if (resultContainer) {
      resultContainer.innerHTML = "";
    }
  }

  // --- Data Loading ---
  async function loadLookupData() {
    try {
      showToast("Loading system data...", "info");

      const [
        { data: bases, error: basesError },
        { data: categories, error: categoriesError },
        { data: departments, error: departmentsError },
        { data: teams, error: teamsError },
      ] = await Promise.all([
        supabaseClient.from("bases").select("id, name").order("name"),
        supabaseClient.from("ticket_cats").select("id, name").order("name"),
        supabaseClient.from("departments").select("id, name").order("name"),
        supabaseClient
          .from("teams")
          .select("id, name, department_id")
          .order("name"),
      ]);

      if (basesError)
        throw new Error(`Failed to load bases: ${basesError.message}`);
      if (categoriesError)
        throw new Error(
          `Failed to load categories: ${categoriesError.message}`
        );
      if (departmentsError)
        throw new Error(
          `Failed to load departments: ${departmentsError.message}`
        );
      if (teamsError)
        throw new Error(`Failed to load teams: ${teamsError.message}`);

      // Populate bases
      if (bases && baseSelect) {
        bases.forEach((base) => {
          basesMap[base.id] = base.name;
          const option = document.createElement("option");
          option.value = base.id;
          option.textContent = base.name;
          baseSelect.appendChild(option);
        });
      }

      // Populate categories
      if (categories && categorySelect) {
        categories.forEach((category) => {
          categoriesMap[category.id] = category.name;
          const option = document.createElement("option");
          option.value = category.id;
          option.textContent = category.name;
          categorySelect.appendChild(option);
        });
      }

      // Store departments and teams for future use
      if (departments) {
        departments.forEach((dept) => {
          departmentsMap[dept.id] = dept.name;
        });
      }

      if (teams) {
        teams.forEach((team) => {
          teamsMap[team.id] = {
            name: team.name,
            department_id: team.department_id,
          };
        });
      }

      showToast("System data loaded successfully!", "success");
    } catch (error) {
      
      showToast(`Error loading system data: ${error.message}`, "error");
    }
  }

  // --- Ticket Tracking ---
  async function handleTicketTracking(e) {
    e.preventDefault();

    const ticketIdInput = document.getElementById("ticket-id");
    const ticketInput = ticketIdInput.value.trim();

    if (!ticketInput) {
      showToast("Please enter a ticket ID", "warning");
      ticketIdInput.focus();
      return;
    }

    const searchBtn = trackForm.querySelector(".search-btn");
    setButtonLoading(searchBtn, true);
    showLoader();
    clearResults();

    try {
      // Search by ticket_number (human-readable) or id (UUID)
      let query = supabaseClient.from("tickets").select(`
          id, ticket_number, title, description, status, priority, created_at, updated_at,
          submitter_name, submitter_email, base_id, category_id, assigned_to, 
          screenshot_url, screenshot_filename, screenshot_size
        `);

      // Check if input looks like a UUID or ticket number
      if (
        ticketInput.match(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
        )
      ) {
        query = query.eq("id", ticketInput);
      } else {
        query = query.eq("ticket_number", ticketInput.toUpperCase());
      }

      const { data: ticket, error } = await query.single();

      if (error || !ticket) {
        throw new Error("Ticket not found or access denied");
      }

      // Get additional ticket logs
      const { data: logs } = await supabaseClient
        .from("simple_ticket_log")
        .select("*")
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: false })
        .limit(5);

      displayTicketDetails(ticket, logs);
      showToast("Ticket found successfully!", "success");
    } catch (error) {
      

      if (resultContainer) {
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
      }

      showToast("Ticket not found", "error");
    } finally {
      setButtonLoading(searchBtn, false);
      hideLoader();
    }
  }

  function displayTicketDetails(ticket, logs = []) {
    const baseName = basesMap[ticket.base_id] || "Unknown Base";
    const categoryName =
      categoriesMap[ticket.category_id] || "Unknown Category";

    const assignedTo = ticket.assigned_to
      ? "Assigned to support team"
      : "Unassigned";

    const createdDate = new Date(ticket.created_at);
    const updatedDate = new Date(ticket.updated_at);

    if (resultContainer) {
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
              
              ${ticket.screenshot_url ? `
              <div class="detail-item full-width">
                <label>Screenshot</label>
                <div class="screenshot-display">
                  <img src="${ticket.screenshot_url}" alt="Ticket screenshot" class="ticket-screenshot" onclick="window.open('${ticket.screenshot_url}', '_blank')" />
                  <p class="screenshot-hint">Click to view full size</p>
                  ${ticket.screenshot_filename ? `<p class="screenshot-filename">${ticket.screenshot_filename}</p>` : ''}
                </div>
              </div>
              ` : ''}
            </div>
            
            ${
              logs && logs.length > 0
                ? `
              <div class="ticket-logs">
                <h4>Recent Activity</h4>
                <div class="logs-list">
                  ${logs
                    .map(
                      (log) => `
                    <div class="log-item">
                      <div class="log-content">
                        <p>${log.action || "Status updated"}</p>
                        <small>${new Date(
                          log.created_at
                        ).toLocaleString()}</small>
                      </div>
                    </div>
                  `
                    )
                    .join("")}
                </div>
              </div>
            `
                : ""
            }
          </div>
        </div>
      `;
    }
  }

  // --- Ticket Submission ---
  async function handleTicketSubmission(e) {
    e.preventDefault();

    // Get form values
    const formData = {
      name: document.getElementById("submitter-name")?.value.trim() || "",
      email: document.getElementById("submitter-email")?.value.trim() || "",
      base_id: baseSelect?.value || "",
      category_id: categorySelect?.value || "",
      title: document.getElementById("ticket-title")?.value.trim() || "",
      description: document.getElementById("ticket-desc")?.value.trim() || "",
      priority: document.querySelector('input[name="priority"]:checked')?.value || "",
    };

    // Validation
    const validationErrors = validateTicketForm(formData);
    if (validationErrors.length > 0) {
      showToast(validationErrors[0], "warning");
      return;
    }

    const submitBtn = submitForm?.querySelector(".submit-btn");
    if (submitBtn) setButtonLoading(submitBtn, true);
    showLoader();
    clearResults();

    try {
      // Generate unique ticket number for display
      const ticketNumber = generateTicketNumber();

      // Create ticket (let Supabase generate UUID for id)
      const { data: ticket, error: ticketError } = await supabaseClient
        .from("tickets")
        .insert([
          {
            ticket_number: ticketNumber, // Human-readable ticket number
            submitter_name: formData.name,
            submitter_email: formData.email,
            base_id: formData.base_id,
            category_id: formData.category_id,
            title: formData.title,
            description: formData.description,
            priority: formData.priority,
            status: "Open",
            assigned_to: null,
            // Remove created_by - let it use the default value
          },
        ])
        .select("id, ticket_number")
        .single();

      if (ticketError) throw ticketError;

      let screenshotData = null;

      // Upload screenshot if one was selected
      if (selectedFile) {
        try {
          if (uploadArea) uploadArea.classList.add('uploading');
          showToast('Uploading screenshot...', 'info');
          
          screenshotData = await uploadScreenshot(selectedFile, ticket.id);
          
          // Update ticket with screenshot URL
          const { error: updateError } = await supabaseClient
            .from('tickets')
            .update({ 
              screenshot_url: screenshotData.url,
              screenshot_filename: screenshotData.filename,
              screenshot_size: screenshotData.size
            })
            .eq('id', ticket.id);

          if (updateError) {
            console.error('Error updating ticket with screenshot:', updateError);
            showToast('Screenshot uploaded but failed to link to ticket', 'warning');
          } else {
            console.log('Screenshot successfully linked to ticket');
            showToast('Screenshot uploaded successfully!', 'success');
          }
          
          if (uploadArea) uploadArea.classList.remove('uploading');
        } catch (screenshotError) {
          console.error('Screenshot upload failed:', screenshotError);
          if (uploadArea) uploadArea.classList.remove('uploading');
          showToast(`Screenshot upload failed: ${screenshotError.message}`, 'error');
        }
      }

      // Display success result (remove manual logging since triggers handle it)
      displaySubmissionSuccess(ticket.ticket_number, ticket.id, formData, screenshotData);

      // Reset form
      if (submitForm) submitForm.reset();
      selectedFile = null;
      if (previewContainer) previewContainer.classList.add('hidden');
      if (uploadArea) {
        uploadArea.classList.remove('error');
        const uploadText = uploadArea.querySelector('.file-upload-text');
        const uploadHint = uploadArea.querySelector('.file-upload-hint');
        if (uploadText) uploadText.textContent = 'Click to upload screenshot';
        if (uploadHint) uploadHint.textContent = 'or drag and drop image file here';
      }

      // Clear priority selection
      document.querySelectorAll('input[name="priority"]').forEach((radio) => {
        radio.checked = false;
      });

      showToast("Ticket submitted successfully!", "success", "Success");
    } catch (error) {
      

      if (resultContainer) {
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
      }

      showToast("Failed to submit ticket. Please try again.", "error");
    } finally {
      if (submitBtn) setButtonLoading(submitBtn, false);
      hideLoader();
    }
  }

  function validateTicketForm(formData) {
    const errors = [];

    if (!formData.name) errors.push("Please enter your full name");
    if (!formData.email) errors.push("Please enter your email address");
    else if (!isValidEmail(formData.email))
      errors.push("Please enter a valid email address");
    if (!formData.base_id) errors.push("Please select your base/location");
    if (!formData.category_id) errors.push("Please select an issue category");
    if (!formData.title) errors.push("Please enter an issue title");
    if (!formData.description)
      errors.push("Please provide a detailed description");
    if (!formData.priority) errors.push("Please select a priority level");

    return errors;
  }

  function displaySubmissionSuccess(ticketNumber, ticketId, formData, screenshotData) {
    const baseName = basesMap[formData.base_id] || "Unknown";
    const categoryName = categoriesMap[formData.category_id] || "Unknown";

    if (resultContainer) {
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
              <button class="copy-btn" onclick="navigator.clipboard.writeText('${ticketNumber}').then(() => this.innerHTML = '✓ Copied!')">
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
                ${screenshotData ? '<div><strong>Screenshot:</strong> ✅ Uploaded</div>' : ''}
              </div>
            </div>
            
            <div class="next-steps">
              <h4>What's Next?</h4>
              <ul>
                <li>Save your ticket ID for future reference</li>
                <li>You'll receive email updates at ${formData.email}</li>
                <li>Our support team will review your request within 24 hours</li>
                <li>Use the "Track Ticket" tab to check status updates</li>
                ${screenshotData ? '<li>Your screenshot has been attached to help our team understand the issue</li>' : ''}
              </ul>
            </div>
          </div>
        </div>
      `;
    }
  }

  // --- Screenshot Upload Event Listeners ---
  
  // File input change event
  if (fileInput) {
    fileInput.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file) {
        handleFileSelect(file);
      }
    });
  }

  // Drag and drop functionality
  if (uploadArea) {
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
      uploadArea.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      uploadArea.addEventListener(eventName, unhighlight, false);
    });

    function highlight(e) {
      uploadArea.classList.add('dragover');
    }

    function unhighlight(e) {
      uploadArea.classList.remove('dragover');
    }

    uploadArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
      const dt = e.dataTransfer;
      const files = dt.files;
      
      if (files.length > 0) {
        const file = files[0];
        fileInput.files = files; // Update the input
        handleFileSelect(file);
      }
    }

    // Click to upload
    uploadArea.addEventListener('click', function() {
      fileInput.click();
    });
  }

  // Remove screenshot
  if (removeBtn) {
    removeBtn.addEventListener('click', function() {
      selectedFile = null;
      if (fileInput) fileInput.value = '';
      if (previewContainer) previewContainer.classList.add('hidden');
      if (uploadArea) {
        uploadArea.classList.remove('error');
        const uploadText = uploadArea.querySelector('.file-upload-text');
        const uploadHint = uploadArea.querySelector('.file-upload-hint');
        if (uploadText) uploadText.textContent = 'Click to upload screenshot';
        if (uploadHint) uploadHint.textContent = 'or drag and drop image file here';
      }
      showToast('Screenshot removed', 'info');
    });
  }

  // --- Event Listeners ---
  if (trackForm) trackForm.addEventListener("submit", handleTicketTracking);
  if (submitForm) submitForm.addEventListener("submit", handleTicketSubmission);

  // Form enhancements
  const ticketIdInput = document.getElementById("ticket-id");
  if (ticketIdInput) {
    ticketIdInput.addEventListener("input", (e) => {
      // Auto-format ticket ID input
      let value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
      e.target.value = value;
    });
  }

  // Real-time form validation
  const requiredFields = [
    "submitter-name",
    "submitter-email",
    "ticket-title",
    "ticket-desc",
  ];
  requiredFields.forEach((fieldId) => {
    const field = document.getElementById(fieldId);
    if (field) {
      field.addEventListener("blur", (e) => {
        const isValid = e.target.value.trim() !== "";
        e.target.classList.toggle("invalid", !isValid);
        e.target.classList.toggle("valid", isValid);
      });
    }
  });

  // Email validation
  const emailField = document.getElementById("submitter-email");
  if (emailField) {
    emailField.addEventListener("blur", (e) => {
      const email = e.target.value.trim();
      const isValid = email === "" || isValidEmail(email);
      e.target.classList.toggle("invalid", !isValid);
      e.target.classList.toggle("valid", isValid && email !== "");
    });
  }

  // Priority selection visual feedback
  document.querySelectorAll('input[name="priority"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      document.querySelectorAll(".priority-option").forEach((option) => {
        option.classList.remove("selected");
      });
      radio.closest(".priority-option").classList.add("selected");
    });
  });

  // Keyboard shortcuts
  document.addEventListener("keydown", (e) => {
    if (e.altKey) {
      switch (e.key) {
        case "1":
          e.preventDefault();
          activateTab("track");
          break;
        case "2":
          e.preventDefault();
          activateTab("submit");
          break;
      }
    }
  });

  // --- Initialize Application ---
  async function initializeApp() {
    try {
      await loadLookupData();
      handleInitialTab();

      // Pre-fill email field if available from session
      if (userEmail) {
        const emailField = document.getElementById("submitter-email");
        if (emailField) {
          emailField.value = userEmail;
        }
      }

      // Add some accessibility enhancements
      document.body.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          // Close any open toasts
          document
            .querySelectorAll(".toast")
            .forEach((toast) => toast.remove());
        }
      });
    } catch (error) {
      
      showToast(
        "Failed to initialize application. Please refresh the page.",
        "error"
      );
    }
  }

  // Start the application
  initializeApp();
});