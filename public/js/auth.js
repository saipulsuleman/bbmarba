// ==============================================================================
// AUTH GUARD & SESSION MANAGER
// ==============================================================================

const token = localStorage.getItem('bbm_token');
const userStr = localStorage.getItem('bbm_user');

if (!token || !userStr) {
  window.location.href = '/login.html';
}

let currentUser = null;
try {
  currentUser = JSON.parse(userStr);
} catch (e) {
  localStorage.clear();
  window.location.href = '/login.html';
}

// Inisialisasi UI berdasarkan Role Pengguna
document.addEventListener('DOMContentLoaded', () => {
  const roleBadge = document.getElementById('userRoleBadge');
  const displayName = document.getElementById('userDisplayName');
  const avatarInitial = document.getElementById('userAvatarInitial');

  if (currentUser) {
    if (displayName) {
      displayName.textContent = currentUser.username === 'godmode' ? 'Owner SPBU' : 'Petugas Kasir';
    }
    if (avatarInitial) {
      avatarInitial.textContent = currentUser.username ? currentUser.username.charAt(0).toUpperCase() : 'U';
    }
    if (roleBadge) {
      if (currentUser.role === 'godmode') {
        roleBadge.className = 'role-tag godmode';
        roleBadge.textContent = 'GODMODE (OWNER)';
      } else {
        roleBadge.className = 'role-tag admin';
        roleBadge.textContent = 'KASIR / ADMIN';
      }
    }
  }

  // Jika role bukan godmode, sembunyikan fitur khusus godmode
  if (currentUser && currentUser.role !== 'godmode') {
    document.querySelectorAll('.godmode-only').forEach(el => {
      el.style.display = 'none';
    });
  }
});

function handleLogout() {
  if (confirm('Apakah Anda yakin ingin keluar dari sistem?')) {
    localStorage.removeItem('bbm_token');
    localStorage.removeItem('bbm_user');
    window.location.href = '/login.html';
  }
}

let isRedirectingToLogin = false;

// Wrapper fetch dengan header JWT
async function fetchWithAuth(url, options = {}) {
  const currentToken = localStorage.getItem('bbm_token');
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${currentToken}`
  };

  // Jangan tambahkan Content-Type jika body adalah FormData (upload file)
  if (!(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const res = await fetch(url, { ...options, headers });
  if (res.status === 401) {
    if (!isRedirectingToLogin) {
      isRedirectingToLogin = true;
      alert('Sesi Anda telah berakhir. Silakan login kembali.');
      localStorage.clear();
      window.location.href = '/login.html';
    }
  }
  return res;
}
