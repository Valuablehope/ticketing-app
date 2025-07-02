// public/js/create-user.js - CLEANED WITH TOAST NOTIFICATIONS

document.addEventListener('DOMContentLoaded', async () => {
  const SUPABASE_URL = 'https://rkdblbnmtzyrapfemswq.supabase.co';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZGJsYm5tdHp5cmFwZmVtc3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1ODQyNTgsImV4cCI6MjA2NjE2MDI1OH0.TY7Ml-S-knKMNQ-HKylGLbpXIu9wHqGAZDHHAq4rRJc';
  const supabaseClient = supabase.createClient(SUPABASE_URL, ANON_KEY);

  let departments = [], teams = [], bases = [];

  // Toast notification system
  function showToast(message, type = 'info', title = '') {
    const container = document.querySelector('.toast-container') || createToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icons = {
      success: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22,4 12,14.01 9,11.01"/>',
      error: '<circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>',
      warning: '<path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
      info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'
    };

    toast.innerHTML = `
      <svg class="toast-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">${icons[type]}</svg>
      <div class="toast-content">
        ${title ? `<div class="toast-title">${title}</div>` : ''}
        <div class="toast-message">${message}</div>
      </div>
      <button class="toast-close" onclick="this.parentElement.remove()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <line x1="18" y1="6" x2="6" y2="18"/>
          <line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
      <div class="toast-progress" style="animation-duration: 5s"></div>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
    return toast;
  }

  function createToastContainer() {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
  }

  // Populate dropdowns
  async function populateDropdowns() {
    try {
      // Load bases
      const { data: basesData } = await supabaseClient.from('bases').select('id,name').order('name');
      bases = basesData || [];
      const baseSelect = document.getElementById('user-base');
      baseSelect.innerHTML = '<option value="" disabled selected>Select Base</option>';
      bases.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.id;
        opt.textContent = b.name;
        baseSelect.appendChild(opt);
      });

      // Load departments
      const { data: departmentsData } = await supabaseClient.from('departments').select('id, name').order('name');
      departments = departmentsData || [];
      const departmentSelect = document.getElementById('user-department');
      departmentSelect.innerHTML = '<option value="" disabled selected>Select Department</option>';
      departments.forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept.id;
        opt.textContent = dept.name;
        departmentSelect.appendChild(opt);
      });

      // Load teams
      const { data: teamsData } = await supabaseClient.from('teams').select('id, name, department_id').order('name');
      teams = teamsData || [];
      const teamSelect = document.getElementById('user-team');
      teamSelect.innerHTML = '<option value="" disabled selected>Select Team</option>';
      teams.forEach(team => {
        const opt = document.createElement('option');
        opt.value = team.id;
        opt.textContent = team.name;
        opt.setAttribute('data-department-id', team.department_id);
        teamSelect.appendChild(opt);
      });
    } catch (err) {
      showToast('Failed to load dropdown data', 'error');
    }
  }

  // Handle department change to filter teams
  document.getElementById('user-department').addEventListener('change', function() {
    const selectedDepartmentId = this.value;
    const teamSelect = document.getElementById('user-team');
    
    teamSelect.innerHTML = '<option value="" disabled selected>Select Team</option>';
    
    if (selectedDepartmentId) {
      const filteredTeams = teams.filter(team => team.department_id === selectedDepartmentId);
      filteredTeams.forEach(team => {
        const opt = document.createElement('option');
        opt.value = team.id;
        opt.textContent = team.name;
        teamSelect.appendChild(opt);
      });
      teamSelect.disabled = false;
    } else {
      teamSelect.disabled = true;
    }
  });

  // Password strength indicator
  const passwordInput = document.getElementById('user-password');
  const strengthFill = document.querySelector('.strength-fill');
  const strengthText = document.querySelector('.strength-text');

  function updatePasswordStrength(password) {
    let strength = 0;
    let message = 'Enter password';
    
    if (password.length >= 6) strength += 25;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    
    if (strength === 0) message = 'Enter password';
    else if (strength <= 25) message = 'Weak';
    else if (strength <= 50) message = 'Fair';
    else if (strength <= 75) message = 'Good';
    else message = 'Strong';
    
    strengthFill.style.width = `${strength}%`;
    strengthText.textContent = message;
  }

  passwordInput.addEventListener('input', (e) => updatePasswordStrength(e.target.value));

  // Form submission handler
  const form = document.getElementById('create-user-form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      // Gather form data
      const full_name = document.getElementById('full-name').value.trim();
      const email = document.getElementById('user-email').value.trim();
      const password = document.getElementById('user-password').value;
      const roleRadio = document.querySelector('input[name="role"]:checked');
      const role = roleRadio ? roleRadio.value : '';
      const base = document.getElementById('user-base').value;
      const departmentId = document.getElementById('user-department').value || null;
      const teamId = document.getElementById('user-team').value || null;

      // Validation
      if (!full_name || !email || !password || !role || !base) {
        throw new Error('Please fill in all required fields.');
      }
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }

      // Get department and team names
      const departmentName = departmentId ? departments.find(d => d.id === departmentId)?.name : null;
      const teamName = teamId ? teams.find(t => t.id === teamId)?.name : null;

      // Create user account
      const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: { full_name, role, base, department_id: departmentId, team_id: teamId, department_name: departmentName, team_name: teamName }
        }
      });

      if (signUpError) throw signUpError;

      // Insert/update user in his_users table
      if (signUpData.user) {
        const selectedDepartment = departments.find(d => d.id === departmentId);
        const selectedTeam = teams.find(t => t.id === teamId);
        const selectedBase = bases.find(b => b.id === base);

        const userData = {
          id: signUpData.user.id,
          full_name,
          role,
          base: selectedBase?.name || null,
          department: selectedDepartment?.name || null,
          team: selectedTeam?.name || null,
          department_id: departmentId,
          team_id: teamId,
          created_at: new Date().toISOString()
        };

        const { error: upsertError } = await supabaseClient
          .from('his_users')
          .upsert(userData, { onConflict: 'id' });

        if (upsertError) console.error('User data save error:', upsertError);
      }

      // Show success message
      const message = signUpData.user && !signUpData.session ? 
        `Account created for "${full_name}"! Please check email for verification link.` :
        `User "${full_name}" created successfully!`;
      
      showToast(message, 'success', 'User Created');

      // Reset form
      form.reset();
      document.getElementById('user-base').selectedIndex = 0;
      document.getElementById('user-department').selectedIndex = 0;
      document.getElementById('user-team').innerHTML = '<option value="" disabled selected>Select Team</option>';
      document.getElementById('user-team').disabled = true;
      updatePasswordStrength('');

    } catch (err) {
      // Handle errors
      let errorMessage = '';
      if (err.message.includes('already registered')) {
        errorMessage = 'This email is already registered. Try using a different email address.';
      } else if (err.message.includes('invalid email')) {
        errorMessage = 'Please enter a valid email address.';
      } else if (err.message.includes('password')) {
        errorMessage = 'Password does not meet requirements.';
      } else if (err.message.includes('duplicate key')) {
        errorMessage = 'This user account already exists. Try logging in instead.';
      } else {
        errorMessage = err.message || 'An error occurred while creating the user.';
      }
      
      showToast(errorMessage, 'error', 'Creation Failed');
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });

  // Enhanced form interactions
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]');
  inputs.forEach(input => {
    if (input.value.trim() !== '') input.classList.add('has-value');
    
    input.addEventListener('blur', () => {
      if (input.value.trim() !== '') {
        input.classList.add('has-value');
      } else {
        input.classList.remove('has-value');
      }
    });
  });

  // Role selection enhancements
  const roleOptions = document.querySelectorAll('.role-option');
  roleOptions.forEach(option => {
    const radio = option.querySelector('input[type="radio"]');
    
    option.addEventListener('click', () => {
      roleOptions.forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      radio.checked = true;
    });
  });

  // Form validation
  const requiredInputs = form.querySelectorAll('input[required], select[required]');
  requiredInputs.forEach(input => {
    input.addEventListener('blur', validateField);
    input.addEventListener('input', validateField);
  });

  function validateField(e) {
    const field = e.target;
    const isValid = field.checkValidity();
    
    if (field.value.trim() !== '') {
      if (isValid) {
        field.classList.remove('invalid');
        field.classList.add('valid');
      } else {
        field.classList.remove('valid');
        field.classList.add('invalid');
      }
    } else {
      field.classList.remove('valid', 'invalid');
    }
  }

  // Initialize
  await populateDropdowns();
});