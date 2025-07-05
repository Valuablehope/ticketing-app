// === CREATE USER MODULE ===
document.addEventListener('DOMContentLoaded', async () => {
  const { url, anonKey } = window.SUPABASE_CONFIG || {};
  const supabaseClient = supabase.createClient(url, anonKey);

  let departments = [], teams = [], bases = [];

  // Toast system
  const showToast = (message, type = 'info', title = '') => {
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
      <button class="toast-close" onclick="this.parentElement.remove()">×</button>
      <div class="toast-progress" style="animation-duration: 5s"></div>
    `;

    container.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  };

  const createToastContainer = () => {
    const container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
    return container;
  };

  // Populate dropdowns
  const populateDropdowns = async () => {
    try {
      const [basesData, departmentsData, teamsData] = await Promise.all([
        supabaseClient.from('bases').select('id,name').order('name'),
        supabaseClient.from('departments').select('id,name').order('name'),
        supabaseClient.from('teams').select('id,name,department_id').order('name')
      ]);

      bases = basesData.data || [];
      departments = departmentsData.data || [];
      teams = teamsData.data || [];

      const populateSelect = (id, data, placeholder) => {
        const select = document.getElementById(id);
        select.innerHTML = `<option value="" disabled selected>${placeholder}</option>`;
        data.forEach(item => {
          const option = document.createElement('option');
          option.value = item.id;
          option.textContent = item.name;
          if (item.department_id) option.setAttribute('data-department-id', item.department_id);
          select.appendChild(option);
        });
      };

      populateSelect('user-base', bases, 'Select Base');
      populateSelect('user-department', departments, 'Select Department');
      populateSelect('user-team', teams, 'Select Team');
    } catch (err) {
      showToast('Failed to load dropdown data', 'error');
    }
  };

  // Department change handler
  document.getElementById('user-department').addEventListener('change', function() {
    const departmentId = this.value;
    const teamSelect = document.getElementById('user-team');
    
    teamSelect.innerHTML = '<option value="" disabled selected>Select Team</option>';
    
    if (departmentId) {
      const filteredTeams = teams.filter(team => team.department_id === departmentId);
      filteredTeams.forEach(team => {
        const option = document.createElement('option');
        option.value = team.id;
        option.textContent = team.name;
        teamSelect.appendChild(option);
      });
      teamSelect.disabled = false;
    } else {
      teamSelect.disabled = true;
    }
  });

  // Password strength
  const passwordInput = document.getElementById('user-password');
  const strengthFill = document.querySelector('.strength-fill');
  const strengthText = document.querySelector('.strength-text');

  const updatePasswordStrength = (password) => {
    let strength = 0;
    if (password.length >= 6) strength += 25;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[0-9]/.test(password)) strength += 25;
    
    const messages = ['Enter password', 'Weak', 'Fair', 'Good', 'Strong'];
    const message = messages[Math.floor(strength / 25)];
    
    strengthFill.style.width = `${strength}%`;
    strengthText.textContent = message;
  };

  passwordInput.addEventListener('input', (e) => updatePasswordStrength(e.target.value));

  // Form submission
  document.getElementById('create-user-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      const formData = {
        full_name: document.getElementById('full-name').value.trim(),
        email: document.getElementById('user-email').value.trim(),
        password: document.getElementById('user-password').value,
        role: document.querySelector('input[name="role"]:checked')?.value || '',
        base: document.getElementById('user-base').value,
        departmentId: document.getElementById('user-department').value || null,
        teamId: document.getElementById('user-team').value || null
      };

      // Validation
      if (!formData.full_name || !formData.email || !formData.password || !formData.role || !formData.base) {
        throw new Error('Please fill in all required fields.');
      }
      if (formData.password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }

      const departmentName = formData.departmentId ? departments.find(d => d.id === formData.departmentId)?.name : null;
      const teamName = formData.teamId ? teams.find(t => t.id === formData.teamId)?.name : null;

      // Create user
      const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: { 
            full_name: formData.full_name, 
            role: formData.role, 
            base: formData.base, 
            department_id: formData.departmentId, 
            team_id: formData.teamId, 
            department_name: departmentName, 
            team_name: teamName 
          }
        }
      });

      if (signUpError) throw signUpError;

      // Save to his_users table
      if (signUpData.user) {
        const selectedBase = bases.find(b => b.id === formData.base);
        const selectedDepartment = departments.find(d => d.id === formData.departmentId);
        const selectedTeam = teams.find(t => t.id === formData.teamId);

        const { error: upsertError } = await supabaseClient.from('his_users').upsert({
          id: signUpData.user.id,
          full_name: formData.full_name,
          role: formData.role,
          base: selectedBase?.name || null,
          department: selectedDepartment?.name || null,
          team: selectedTeam?.name || null,
          department_id: formData.departmentId,
          team_id: formData.teamId,
          created_at: new Date().toISOString()
        }, { onConflict: 'id' });

        if (upsertError) console.error('User data save error:', upsertError);
      }

      const message = signUpData.user && !signUpData.session ? 
        `Account created for "${formData.full_name}"! Please check email for verification link.` :
        `User "${formData.full_name}" created successfully!`;
      
      showToast(message, 'success', 'User Created');
      
      // Reset form
      e.target.reset();
      document.getElementById('user-team').disabled = true;
      updatePasswordStrength('');
      
    } catch (err) {
      const errorMessages = {
        'already registered': 'This email is already registered. Try using a different email address.',
        'invalid email': 'Please enter a valid email address.',
        'password': 'Password does not meet requirements.',
        'duplicate key': 'This user account already exists. Try logging in instead.'
      };
      
      const errorMessage = Object.keys(errorMessages).find(key => err.message.includes(key)) 
        ? errorMessages[Object.keys(errorMessages).find(key => err.message.includes(key))]
        : err.message || 'An error occurred while creating the user.';
      
      showToast(errorMessage, 'error', 'Creation Failed');
    } finally {
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });

  // Form enhancements
  document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]').forEach(input => {
    if (input.value.trim()) input.classList.add('has-value');
    
    input.addEventListener('blur', () => {
      input.classList.toggle('has-value', input.value.trim() !== '');
      const isValid = input.checkValidity();
      input.classList.toggle('valid', isValid && input.value.trim());
      input.classList.toggle('invalid', !isValid && input.value.trim());
    });
  });

  // Role selection
  document.querySelectorAll('.role-option').forEach(option => {
    option.addEventListener('click', () => {
      document.querySelectorAll('.role-option').forEach(opt => opt.classList.remove('active'));
      option.classList.add('active');
      option.querySelector('input[type="radio"]').checked = true;
    });
  });

  await populateDropdowns();
});