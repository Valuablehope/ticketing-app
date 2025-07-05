// === TICKET APPLICATION MODULE ===
document.addEventListener("DOMContentLoaded", () => {
  // Initialize
  const { url, anonKey } = window.SUPABASE_CONFIG || {};
  const supabaseClient = supabase.createClient(url, anonKey);

  // Get user email from session
  let userEmail = "";
  try {
    const session = sessionStorage.getItem("ticketing_session");
    if (session) {
      const sessionData = JSON.parse(session);
      userEmail = sessionData.email || "";
    }
  } catch (error) {
    console.warn("Could not retrieve user email from session:", error);
  }

  // DOM elements
  const elements = {
    trackTab: document.getElementById("track-tab"),
    submitTab: document.getElementById("submit-tab"),
    trackSection: document.getElementById("track-section"),
    submitSection: document.getElementById("submit-section"),
    trackForm: document.getElementById("track-form"),
    submitForm: document.getElementById("submit-form"),
    loader: document.getElementById("loader"),
    result: document.getElementById("result"),
    baseSelect: document.getElementById("ticket-base"),
    categorySelect: document.getElementById("ticket-category"),
    toastContainer: document.getElementById("toast-container"),
    fileInput: document.getElementById("screenshot-upload"),
    uploadArea: document.getElementById("upload-area"),
    previewContainer: document.getElementById("screenshot-preview"),
    previewImage: document.getElementById("preview-image"),
    fileName: document.getElementById("file-name"),
    fileSize: document.getElementById("file-size"),
    removeBtn: document.getElementById("remove-screenshot")
  };

  // Data storage
  let basesMap = {}, categoriesMap = {}, selectedFile = null;

  // Utility functions
  const generateTicketNumber = () => {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const randomPart = Math.floor(Math.random() * 9999).toString().padStart(4, "0");
    return `TKT-${datePart}-${randomPart}`;
  };

  const showToast = (message, type = "info", title = null) => {
    if (!elements.toastContainer) return;

    const toast = document.createElement("div");
    toast.className = `toast ${type}`;

    const icons = {
      success: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path>',
      error: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>',
      warning: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.502 0L4.732 15.5c-.77.833.192 2.5 1.732 2.5z"></path>',
      info: '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>'
    };

    toast.innerHTML = `
      <svg class="toast-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">${icons[type] || icons.info}</svg>
      <div class="toast-content">
        ${title ? `<h4>${title}</h4>` : ""}
        <p>${message}</p>
      </div>
    `;

    elements.toastContainer.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.animation = "toastSlideOut 0.3s ease-in forwards";
        setTimeout(() => toast.remove(), 300);
      }
    }, 5000);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      Open: { class: "info", icon: "📋" },
      "In Progress": { class: "warning", icon: "⚡" },
      Resolved: { class: "success", icon: "✅" },
      Closed: { class: "muted", icon: "🔒" }
    };
    const config = statusMap[status] || { class: "info", icon: "📋" };
    return `<span class="status-badge status-${config.class}">${config.icon} ${status}</span>`;
  };

  const getPriorityBadge = (priority) => {
    const priorityMap = {
      Low: { class: "low", icon: "🟢" },
      Medium: { class: "medium", icon: "🟡" },
      High: { class: "high", icon: "🔴" }
    };
    const config = priorityMap[priority] || { class: "medium", icon: "🟡" };
    return `<span class="priority-badge priority-${config.class}">${config.icon} ${priority}</span>`;
  };

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const setButtonLoading = (button, isLoading) => {
    if (!button) return;
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
  };

  // File handling
  const validateFile = (file) => {
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/gif"];
    
    if (!allowedTypes.includes(file.type)) return "Please select a valid image file (PNG, JPG, GIF)";
    if (file.size > maxSize) return "File size must be less than 5MB";
    return null;
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const handleFileSelect = (file) => {
    const error = validateFile(file);
    if (error) {
      showToast(error, "error");
      return;
    }

    selectedFile = file;
    const reader = new FileReader();
    reader.onload = (e) => {
      if (elements.previewImage) elements.previewImage.src = e.target.result;
      if (elements.fileName) elements.fileName.textContent = file.name;
      if (elements.fileSize) elements.fileSize.textContent = formatFileSize(file.size);
      if (elements.previewContainer) elements.previewContainer.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
    showToast("Screenshot uploaded successfully!", "success");
  };

  const uploadScreenshot = async (file, ticketId) => {
    const fileExt = file.name.split(".").pop().toLowerCase();
    const fileName = `${ticketId}_screenshot_${Date.now()}.${fileExt}`;
    const filePath = `screenshots/${fileName}`;

    const { data, error } = await supabaseClient.storage
      .from("ticket-attachments")
      .upload(filePath, file, { cacheControl: "3600", upsert: false });

    if (error) throw new Error(`Upload failed: ${error.message}`);

    const { data: urlData } = supabaseClient.storage
      .from("ticket-attachments")
      .getPublicUrl(filePath);

    if (!urlData.publicUrl) throw new Error("Failed to generate public URL");

    return {
      path: filePath,
      url: urlData.publicUrl,
      filename: file.name,
      size: file.size
    };
  };

  // Tab management
  const activateTab = (tabName) => {
    elements.trackTab?.classList.toggle("active", tabName === "track");
    elements.submitTab?.classList.toggle("active", tabName === "submit");
    elements.trackSection?.classList.toggle("active", tabName === "track");
    elements.submitSection?.classList.toggle("active", tabName === "submit");
    
    if (elements.result) elements.result.innerHTML = "";
    if (elements.loader) elements.loader.classList.add("hidden");
    window.location.hash = tabName;
  };

  // Load data
  const loadLookupData = async () => {
    try {
      showToast("Loading system data...", "info");
      
      const [basesResult, categoriesResult] = await Promise.all([
        supabaseClient.from("bases").select("id, name").order("name"),
        supabaseClient.from("ticket_cats").select("id, name").order("name")
      ]);

      if (basesResult.error) throw new Error(`Failed to load bases: ${basesResult.error.message}`);
      if (categoriesResult.error) throw new Error(`Failed to load categories: ${categoriesResult.error.message}`);

      // Populate dropdowns
      if (basesResult.data && elements.baseSelect) {
        basesResult.data.forEach(base => {
          basesMap[base.id] = base.name;
          const option = document.createElement("option");
          option.value = base.id;
          option.textContent = base.name;
          elements.baseSelect.appendChild(option);
        });
      }

      if (categoriesResult.data && elements.categorySelect) {
        categoriesResult.data.forEach(category => {
          categoriesMap[category.id] = category.name;
          const option = document.createElement("option");
          option.value = category.id;
          option.textContent = category.name;
          elements.categorySelect.appendChild(option);
        });
      }

      showToast("System data loaded successfully!", "success");
    } catch (error) {
      console.error("Error loading lookup data:", error);
      showToast(`Error loading system data: ${error.message}`, "error");
    }
  };

  // Ticket tracking
  const handleTicketTracking = async (e) => {
    e.preventDefault();
    
    const ticketIdInput = document.getElementById("ticket-id");
    const ticketInput = ticketIdInput?.value.trim();
    
    if (!ticketInput) {
      showToast("Please enter a ticket ID", "warning");
      ticketIdInput?.focus();
      return;
    }

    const searchBtn = elements.trackForm?.querySelector(".search-btn");
    setButtonLoading(searchBtn, true);
    if (elements.loader) elements.loader.classList.remove("hidden");
    if (elements.result) elements.result.innerHTML = "";

    try {
      let query = supabaseClient.from("tickets").select(`
        id, ticket_number, title, description, status, priority, created_at, updated_at,
        submitter_name, submitter_email, base_id, category_id, assigned_to, 
        screenshot_url, screenshot_filename, screenshot_size
      `);

      // Check if UUID or ticket number
      if (ticketInput.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
        query = query.eq("id", ticketInput);
      } else {
        query = query.eq("ticket_number", ticketInput.toUpperCase());
      }

      const { data: ticket, error } = await query.single();

      if (error || !ticket) {
        throw new Error("Ticket not found or access denied");
      }

      displayTicketDetails(ticket);
      showToast("Ticket found successfully!", "success");
    } catch (error) {
      console.error("Error tracking ticket:", error);
      
      if (elements.result) {
        elements.result.innerHTML = `
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
      if (elements.loader) elements.loader.classList.add("hidden");
    }
  };

  const displayTicketDetails = (ticket) => {
    const baseName = basesMap[ticket.base_id] || "Unknown Base";
    const categoryName = categoriesMap[ticket.category_id] || "Unknown Category";
    const assignedTo = ticket.assigned_to ? "Assigned to support team" : "Unassigned";
    const createdDate = new Date(ticket.created_at);
    const updatedDate = new Date(ticket.updated_at);

    if (elements.result) {
      elements.result.innerHTML = `
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
              <div class="detail-item"><label>Title</label><p>${ticket.title}</p></div>
              <div class="detail-item"><label>Description</label><p class="description">${ticket.description}</p></div>
              <div class="detail-item"><label>Base/Location</label><p>${baseName}</p></div>
              <div class="detail-item"><label>Category</label><p>${categoryName}</p></div>
              <div class="detail-item"><label>Submitted By</label><p>${ticket.submitter_name}<br><small>${ticket.submitter_email}</small></p></div>
              <div class="detail-item"><label>Assigned To</label><p>${assignedTo}</p></div>
              <div class="detail-item"><label>Created</label><p>${createdDate.toLocaleDateString()} at ${createdDate.toLocaleTimeString()}</p></div>
              <div class="detail-item"><label>Last Updated</label><p>${updatedDate.toLocaleDateString()} at ${updatedDate.toLocaleTimeString()}</p></div>
              
              ${ticket.screenshot_url ? `
              <div class="detail-item full-width">
                <label>Screenshot</label>
                <div class="screenshot-display">
                  <img src="${ticket.screenshot_url}" alt="Ticket screenshot" class="ticket-screenshot" onclick="window.open('${ticket.screenshot_url}', '_blank')" />
                  <p class="screenshot-hint">Click to view full size</p>
                  ${ticket.screenshot_filename ? `<p class="screenshot-filename">${ticket.screenshot_filename}</p>` : ""}
                </div>
              </div>
              ` : ""}
            </div>
          </div>
        </div>
      `;
    }
  };

  // Ticket submission
  const handleTicketSubmission = async (e) => {
    e.preventDefault();

    const formData = {
      name: document.getElementById("submitter-name")?.value.trim() || "",
      email: document.getElementById("submitter-email")?.value.trim() || "",
      base_id: elements.baseSelect?.value || "",
      category_id: elements.categorySelect?.value || "",
      title: document.getElementById("ticket-title")?.value.trim() || "",
      description: document.getElementById("ticket-desc")?.value.trim() || "",
      priority: document.querySelector('input[name="priority"]:checked')?.value || ""
    };

    // Validation
    const validationErrors = [];
    if (!formData.name) validationErrors.push("Please enter your full name");
    if (!formData.email) validationErrors.push("Please enter your email address");
    else if (!isValidEmail(formData.email)) validationErrors.push("Please enter a valid email address");
    if (!formData.base_id) validationErrors.push("Please select your base/location");
    if (!formData.category_id) validationErrors.push("Please select an issue category");
    if (!formData.title) validationErrors.push("Please enter an issue title");
    if (!formData.description) validationErrors.push("Please provide a detailed description");
    if (!formData.priority) validationErrors.push("Please select a priority level");

    if (validationErrors.length > 0) {
      showToast(validationErrors[0], "warning");
      return;
    }

    const submitBtn = elements.submitForm?.querySelector(".submit-btn");
    setButtonLoading(submitBtn, true);
    if (elements.loader) elements.loader.classList.remove("hidden");
    if (elements.result) elements.result.innerHTML = "";

    try {
      const ticketNumber = generateTicketNumber();

      // Create ticket
      const { data: ticket, error: ticketError } = await supabaseClient
        .from("tickets")
        .insert([{
          ticket_number: ticketNumber,
          submitter_name: formData.name,
          submitter_email: formData.email,
          base_id: formData.base_id,
          category_id: formData.category_id,
          title: formData.title,
          description: formData.description,
          priority: formData.priority,
          status: "Open",
          assigned_to: null
        }])
        .select("id, ticket_number")
        .single();

      if (ticketError) throw new Error(`Ticket creation failed: ${ticketError.message}`);

      console.log("✅ Ticket created:", ticket);

      // Send notifications
      const notificationResults = await window.sendTelegramNotifications(formData, ticket);

      // Handle screenshot upload
      let screenshotData = null;
      if (selectedFile) {
        try {
          showToast("Uploading screenshot...", "info");
          screenshotData = await uploadScreenshot(selectedFile, ticket.id);

          const { error: updateError } = await supabaseClient
            .from("tickets")
            .update({
              screenshot_url: screenshotData.url,
              screenshot_filename: screenshotData.filename,
              screenshot_size: screenshotData.size
            })
            .eq("id", ticket.id);

          if (updateError) {
            console.error("❌ Failed to link screenshot:", updateError);
            showToast("Screenshot uploaded but failed to link to ticket", "warning");
          } else {
            showToast("Screenshot uploaded successfully!", "success");
          }
        } catch (screenshotError) {
          console.error("❌ Screenshot upload failed:", screenshotError);
          showToast(`Screenshot upload failed: ${screenshotError.message}`, "error");
        }
      }

      // Display success
      displaySubmissionSuccess(ticket.ticket_number, ticket.id, formData, screenshotData, notificationResults);

      // Reset form
      elements.submitForm?.reset();
      selectedFile = null;
      if (elements.previewContainer) elements.previewContainer.classList.add("hidden");
      document.querySelectorAll('input[name="priority"]').forEach(radio => radio.checked = false);
      document.querySelectorAll('.priority-option').forEach(option => option.classList.remove('selected'));

      showToast("Ticket submitted successfully!", "success");
    } catch (error) {
      console.error("❌ Ticket submission failed:", error);
      
      if (elements.result) {
        elements.result.innerHTML = `
          <div class="result-card">
            <div class="error-state">
              <svg class="error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="15" y1="9" x2="9" y2="15"></line>
                <line x1="9" y1="9" x2="15" y2="15"></line>
              </svg>
              <h3>Submission Failed</h3>
              <p class="error-message">We couldn't submit your ticket at this time.</p>
              <p class="error-help">Error: ${error.message}</p>
            </div>
          </div>
        `;
      }

      showToast(`Failed to submit ticket: ${error.message}`, "error");
    } finally {
      setButtonLoading(submitBtn, false);
      if (elements.loader) elements.loader.classList.add("hidden");
    }
  };

  const displaySubmissionSuccess = (ticketNumber, ticketId, formData, screenshotData, notificationResults) => {
    const baseName = basesMap[formData.base_id] || "Unknown";
    const categoryName = categoriesMap[formData.category_id] || "Unknown";
    
    const submitterNotification = notificationResults.submitter.success 
      ? '<span class="notification-status success">✅ Telegram notification sent</span>'
      : '<span class="notification-status warning">⚠️ Telegram notification failed</span>';
      
    const adminNotification = notificationResults.admin.success
      ? '<span class="notification-status success">✅ Admin notified</span>'
      : '<span class="notification-status warning">⚠️ Admin notification failed</span>';

    if (elements.result) {
      elements.result.innerHTML = `
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
            
            <div class="notification-status-section">
              <h4>Notification Status</h4>
              <div class="notification-grid">
                <div>${submitterNotification}</div>
                <div>${adminNotification}</div>
              </div>
            </div>
            
            <div class="submission-summary">
              <h4>Ticket Summary</h4>
              <div class="summary-grid">
                <div><strong>Title:</strong> ${formData.title}</div>
                <div><strong>Priority:</strong> ${getPriorityBadge(formData.priority)}</div>
                <div><strong>Base:</strong> ${baseName}</div>
                <div><strong>Category:</strong> ${categoryName}</div>
                ${screenshotData ? "<div><strong>Screenshot:</strong> ✅ Uploaded</div>" : ""}
              </div>
            </div>
            
            <div class="next-steps">
              <h4>What's Next?</h4>
              <ul>
                <li>Save your ticket ID: <strong>${ticketNumber}</strong></li>
                ${notificationResults.submitter.success 
                  ? `<li>Check your Telegram for confirmation message</li>` 
                  : `<li>Email updates will be sent to ${formData.email}</li>`}
                <li>Our support team will review your request within 24 hours</li>
                <li>Use the "Track Ticket" tab to check status updates</li>
              </ul>
            </div>
          </div>
        </div>
      `;
    }
  };

  // Event listeners
  elements.trackTab?.addEventListener("click", () => activateTab("track"));
  elements.submitTab?.addEventListener("click", () => activateTab("submit"));

  // File upload events
  if (elements.fileInput) {
    elements.fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (file) handleFileSelect(file);
    });
  }

  if (elements.uploadArea) {
    ["dragenter", "dragover", "dragleave", "drop"].forEach(eventName => {
      elements.uploadArea.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
      });
    });

    ["dragenter", "dragover"].forEach(eventName => {
      elements.uploadArea.addEventListener(eventName, () => {
        elements.uploadArea.classList.add("dragover");
      });
    });

    ["dragleave", "drop"].forEach(eventName => {
      elements.uploadArea.addEventListener(eventName, () => {
        elements.uploadArea.classList.remove("dragover");
      });
    });

    elements.uploadArea.addEventListener("drop", (e) => {
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        const file = files[0];
        elements.fileInput.files = files;
        handleFileSelect(file);
      }
    });

    elements.uploadArea.addEventListener("click", () => {
      elements.fileInput.click();
    });
  }

  if (elements.removeBtn) {
    elements.removeBtn.addEventListener("click", () => {
      selectedFile = null;
      if (elements.fileInput) elements.fileInput.value = "";
      if (elements.previewContainer) elements.previewContainer.classList.add("hidden");
      showToast("Screenshot removed", "info");
    });
  }

  // Form event listeners
  if (elements.trackForm) elements.trackForm.addEventListener("submit", handleTicketTracking);
  if (elements.submitForm) elements.submitForm.addEventListener("submit", handleTicketSubmission);

  // Form enhancements
  const ticketIdInput = document.getElementById("ticket-id");
  if (ticketIdInput) {
    ticketIdInput.addEventListener("input", (e) => {
      e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, "");
    });
  }

  // Real-time validation
  const requiredFields = ["submitter-name", "submitter-email", "ticket-title", "ticket-desc"];
  requiredFields.forEach(fieldId => {
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

  // Priority selection
  document.querySelectorAll('input[name="priority"]').forEach(radio => {
    radio.addEventListener("change", () => {
      document.querySelectorAll(".priority-option").forEach(option => {
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

  // Initialize
  const initializeApp = async () => {
    try {
      await loadLookupData();
      
      // Handle initial tab from URL hash
      const hash = window.location.hash.slice(1);
      if (hash === "submit") {
        activateTab("submit");
      } else {
        activateTab("track");
      }

      // Pre-fill email if available
      if (userEmail) {
        const emailField = document.getElementById("submitter-email");
        if (emailField) emailField.value = userEmail;
      }

      // Accessibility enhancements
      document.body.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          document.querySelectorAll(".toast").forEach(toast => toast.remove());
        }
      });
    } catch (error) {
      console.error("Failed to initialize application:", error);
      showToast("Failed to initialize application. Please refresh the page.", "error");
    }
  };

  initializeApp();
});

// Inject notification status CSS
const notificationStatusCSS = `
  .notification-status-section {
    margin: 20px 0; padding: 15px; background: rgba(255, 255, 255, 0.1); border-radius: 8px;
  }
  .notification-grid {
    display: grid; grid-template-columns: 1fr; gap: 8px; margin-top: 10px;
  }
  .notification-status {
    padding: 6px 12px; border-radius: 6px; font-size: 14px; font-weight: 500;
  }
  .notification-status.success {
    background: rgba(34, 197, 94, 0.1); color: #16a34a; border: 1px solid rgba(34, 197, 94, 0.2);
  }
  .notification-status.warning {
    background: rgba(245, 158, 11, 0.1); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.2);
  }
  @media (min-width: 640px) {
    .notification-grid { grid-template-columns: 1fr 1fr; }
  }
`;

if (!document.getElementById('notification-status-styles')) {
  const style = document.createElement('style');
  style.id = 'notification-status-styles';
  style.textContent = notificationStatusCSS;
  document.head.appendChild(style);
}