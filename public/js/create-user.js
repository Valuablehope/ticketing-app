// public/js/create-user.js

document.addEventListener('DOMContentLoaded', async () => {
  // --- Initialize Supabase Client with Public Anon Key ---
  const SUPABASE_URL = 'https://rkdblbnmtzyrapfemswq.supabase.co';
  const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJrZGJsYm5tdHp5cmFwZmVtc3dxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA1ODQyNTgsImV4cCI6MjA2NjE2MDI1OH0.TY7Ml-S-knKMNQ-HKylGLbpXIu9wHqGAZDHHAq4rRJc'; // Replace with your actual anon key
  const supabaseClient = supabase.createClient(SUPABASE_URL, ANON_KEY);

  // --- Populate "Base" Dropdown ---
  const baseSelect = document.getElementById('user-base');
  try {
    const { data: bases, error: basesError } = await supabaseClient
      .from('bases')
      .select('id,name');
    if (basesError) throw basesError;
    bases.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.id;
      opt.textContent = b.name;
      baseSelect.appendChild(opt);
    });
  } catch (err) {
    console.error('Error loading bases:', err.message);
  }

  // --- Handle Form Submission ---
  const form = document.getElementById('create-user-form');
  const errDiv = document.getElementById('create-error');
  const okDiv = document.getElementById('create-success');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errDiv.textContent = '';
    okDiv.textContent = '';

    // Show loading state
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'Creating...';
    submitBtn.disabled = true;

    // Gather and validate input values
    const full_name = document.getElementById('full-name').value.trim();
    const email = document.getElementById('user-email').value.trim();
    const password = document.getElementById('user-password').value;
    const role = document.getElementById('user-role').value;
    const base = baseSelect.value;
    const department = document.getElementById('user-department').value.trim();
    const team = document.getElementById('user-team').value.trim();

    if (!full_name || !email || !password || !role || !base) {
      errDiv.textContent = 'Please fill in all required fields.';
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      return;
    }

    // Validate password strength
    if (password.length < 6) {
      errDiv.textContent = 'Password must be at least 6 characters long.';
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
      return;
    }

    try {
      // Use regular Supabase signup (not admin API)
      const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name,
            role,
            base,
            department: department || null,
            team: team || null
          }
        }
      });

      if (signUpError) throw signUpError;

      // Check if user needs email confirmation
      if (signUpData.user && !signUpData.session) {
        okDiv.textContent = `Account created for "${full_name}"! Please check email for verification link.`;
      } else {
        okDiv.textContent = `User "${full_name}" created successfully!`;
      }

      form.reset();
      baseSelect.selectedIndex = 0;
      
    } catch (err) {
      console.error('Create user error:', err.message);
      
      // Handle common errors
      if (err.message.includes('already registered')) {
        errDiv.textContent = 'This email is already registered.';
      } else if (err.message.includes('invalid email')) {
        errDiv.textContent = 'Please enter a valid email address.';
      } else if (err.message.includes('password')) {
        errDiv.textContent = 'Password does not meet requirements.';
      } else {
        errDiv.textContent = err.message || 'An error occurred while creating the user.';
      }
    } finally {
      // Reset button state
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
});