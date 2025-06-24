// public/js/create-user.js - UPDATED WITH DEPARTMENT AND TEAM DROPDOWNS

document.addEventListener('DOMContentLoaded', async () => {
  // --- Initialize Supabase Client with Public Anon Key ---
  const SUPABASE_URL = 'https://rkdblbnmtzyrapfemswq.supabase.co';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZGJsYm5tdHp5cmFwZmVtc3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1ODQyNTgsImV4cCI6MjA2NjE2MDI1OH0.TY7Ml-S-knKMNQ-HKylGLbpXIu9wHqGAZDHHAq4rRJc';
  const supabaseClient = supabase.createClient(SUPABASE_URL, ANON_KEY);

  // Store departments and teams data
  let departments = [];
  let teams = [];

  // Store bases data for later use
  let bases = [];

  // --- Populate "Base" Dropdown ---
  const baseSelect = document.getElementById('user-base');
  try {
    const { data: basesData, error: basesError } = await supabaseClient
      .from('bases')
      .select('id,name')
      .order('name');
    if (basesError) throw basesError;
    
    bases = basesData || []; // Store bases data
    
    // Clear existing options except the first one
    baseSelect.innerHTML = '<option value="" disabled selected>Select Base</option>';
    
    bases.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.name;
      baseSelect.appendChild(opt);
    });
  } catch (err) {
    
  }

  // --- Populate "Department" Dropdown ---
  const departmentSelect = document.getElementById('user-department');
  try {
    const { data: departmentsData, error: deptError } = await supabaseClient
      .from('departments')
      .select('id, name')
      .order('name');
    
    if (deptError) {
      
    } else {
      departments = departmentsData || [];
      
      // Clear existing options
      departmentSelect.innerHTML = '<option value="" disabled selected>Select Department</option>';
      
      departments.forEach(dept => {
        const opt = document.createElement('option');
        opt.value = dept.id;
        opt.textContent = dept.name;
        departmentSelect.appendChild(opt);
      });
      
      
    }
  } catch (err) {
    
  }

  // --- Populate "Team" Dropdown ---
  const teamSelect = document.getElementById('user-team');
  try {
    const { data: teamsData, error: teamsError } = await supabaseClient
      .from('teams')
      .select('id, name, department_id')
      .order('name');
    
    if (teamsError) {
      
    } else {
      teams = teamsData || [];
      
      // Initially show all teams (will be filtered when department is selected)
      teamSelect.innerHTML = '<option value="" disabled selected>Select Team</option>';
      
      teams.forEach(team => {
        const opt = document.createElement('option');
        opt.value = team.id;
        opt.textContent = team.name;
        opt.setAttribute('data-department-id', team.department_id);
        teamSelect.appendChild(opt);
      });
      
      
    }
  } catch (err) {
    
  }

  // --- Handle Department Change to Filter Teams ---
  departmentSelect.addEventListener('change', function() {
    const selectedDepartmentId = this.value;
    
    // Clear and repopulate team dropdown
    teamSelect.innerHTML = '<option value="" disabled selected>Select Team</option>';
    
    if (selectedDepartmentId) {
      // Filter teams by selected department
      const filteredTeams = teams.filter(team => team.department_id === selectedDepartmentId);
      
      filteredTeams.forEach(team => {
        const opt = document.createElement('option');
        opt.value = team.id;
        opt.textContent = team.name;
        teamSelect.appendChild(opt);
      });
      
      // Enable team selection
      teamSelect.disabled = false;
      
      
    } else {
      // If no department selected, disable team dropdown
      teamSelect.disabled = true;
    }
  });

  // --- Password Strength Indicator ---
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

  passwordInput.addEventListener('input', (e) => {
    updatePasswordStrength(e.target.value);
  });

  // --- Handle Form Submission ---
  const form = document.getElementById('create-user-form');
  const errDiv = document.getElementById('create-error');
  const okDiv = document.getElementById('create-success');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errDiv.textContent = '';
    errDiv.classList.remove('show');
    okDiv.textContent = '';
    okDiv.classList.remove('show');

    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.querySelector('.btn-text').textContent;
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
      // Gather and validate input values
      const full_name = document.getElementById('full-name').value.trim();
      const email = document.getElementById('user-email').value.trim();
      const password = document.getElementById('user-password').value;
      
      // Get selected role from radio buttons
      const roleRadio = document.querySelector('input[name="role"]:checked');
      const role = roleRadio ? roleRadio.value : '';
      
      const base = baseSelect.value;
      const departmentId = departmentSelect.value || null;
      const teamId = teamSelect.value || null;

      if (!full_name || !email || !password || !role || !base) {
        throw new Error('Please fill in all required fields.');
      }

      // Validate password strength
      if (password.length < 6) {
        throw new Error('Password must be at least 6 characters long.');
      }

      // Get department and team names for metadata
      const departmentName = departmentId ? 
        departments.find(d => d.id === departmentId)?.name : null;
      const teamName = teamId ? 
        teams.find(t => t.id === teamId)?.name : null;

      // Use regular Supabase signup (not admin API)
      const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name,
            role,
            base,
            department_id: departmentId,
            team_id: teamId,
            department_name: departmentName,
            team_name: teamName
          }
        }
      });

      if (signUpError) throw signUpError;

      // Also insert into his_users table for better data management
      if (signUpData.user) {
        try {
          // First check if user already exists in his_users table
          const { data: existingUser, error: checkError } = await supabaseClient
            .from('his_users')
            .select('id')
            .eq('id', signUpData.user.id)
            .single();

          if (checkError && checkError.code !== 'PGRST116') {
            // PGRST116 means no rows found, which is what we want
            
          }

          if (existingUser) {
            // User already exists, update instead of insert
            
            
            // Get names for the text fields
            const selectedDepartment = departments.find(d => d.id === departmentId);
            const selectedTeam = teams.find(t => t.id === teamId);
            const selectedBase = bases.find(b => b.id === base);
            
            const { error: updateError } = await supabaseClient
              .from('his_users')
              .update({
                full_name: full_name,
                role: role,
                base: selectedBase?.name || null,
                department: selectedDepartment?.name || null,
                team: selectedTeam?.name || null,
                department_id: departmentId,
                team_id: teamId
              })
              .eq('id', signUpData.user.id);

            if (updateError) {
              
            } else {
              
            }
          } else {
            // User doesn't exist, insert new record
            
            
            // Get names for the text fields
            const selectedDepartment = departments.find(d => d.id === departmentId);
            const selectedTeam = teams.find(t => t.id === teamId);
            const selectedBase = bases.find(b => b.id === base);
            
            const { error: insertError } = await supabaseClient
              .from('his_users')
              .insert([{
                id: signUpData.user.id,
                full_name: full_name,
                role: role,
                base: selectedBase?.name || null,
                department: selectedDepartment?.name || null,
                team: selectedTeam?.name || null,
                department_id: departmentId,
                team_id: teamId,
                created_at: new Date().toISOString()
              }]);

            if (insertError) {
              
            } else {
              
            }
          }
        } catch (insertErr) {
          
        }
      }

      // Check if user needs email confirmation
      if (signUpData.user && !signUpData.session) {
        okDiv.textContent = `Account created for "${full_name}"! Please check email for verification link.`;
      } else {
        okDiv.textContent = `User "${full_name}" created successfully!`;
      }

      okDiv.classList.add('show');
      form.reset();
      baseSelect.selectedIndex = 0;
      departmentSelect.selectedIndex = 0;
      teamSelect.innerHTML = '<option value="" disabled selected>Select Team</option>';
      teamSelect.disabled = true;
      updatePasswordStrength(''); // Reset password strength indicator
      
    } catch (err) {
      
      
      // Handle common errors
      let errorMessage = '';
      if (err.message.includes('already registered') || err.message.includes('User already registered')) {
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
      
      errDiv.textContent = errorMessage;
      errDiv.classList.add('show');
    } finally {
      // Reset button state
      submitBtn.classList.remove('loading');
      submitBtn.disabled = false;
    }
  });

  // --- Enhanced Form Interactions ---
  
  // Add floating label animation support
  const inputs = document.querySelectorAll('input[type="text"], input[type="email"], input[type="password"]');
  inputs.forEach(input => {
    // Check if input has value on page load
    if (input.value.trim() !== '') {
      input.classList.add('has-value');
    }
    
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
    const card = option.querySelector('.role-card');
    
    option.addEventListener('click', () => {
      // Remove active class from all options
      roleOptions.forEach(opt => opt.classList.remove('active'));
      // Add active class to clicked option
      option.classList.add('active');
      // Check the radio button
      radio.checked = true;
    });
  });

  // Form validation enhancements
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

  // Smooth scroll to error messages
  function scrollToError() {
    if (errDiv.classList.contains('show')) {
      errDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }

  // Auto-hide success message after 5 seconds
  function autoHideSuccess() {
    if (okDiv.classList.contains('show')) {
      setTimeout(() => {
        okDiv.classList.remove('show');
      }, 5000);
    }
  }

  // Observe for success message changes
  const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
        if (okDiv.classList.contains('show')) {
          autoHideSuccess();
        }
        if (errDiv.classList.contains('show')) {
          scrollToError();
        }
      }
    });
  });

  observer.observe(okDiv, { attributes: true });
  observer.observe(errDiv, { attributes: true });
});