import React, { useState, useEffect } from 'react';

// 👉 Change this URL to match your Node API endpoint
const API_URL = 'http://localhost:3008/api/students';

// Backend Base URL (e.g., http://localhost:5000)
const BACKEND_BASE = 'http://localhost:3008';

export default function App() {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [alert, setAlert] = useState(null);
  const [modalError, setModalError] = useState(null); // Error inside the modal

  const initialFormState = {
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    gender: 'Male',
  };

  const [formData, setFormData] = useState(initialFormState);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);

  const notify = (msg, type = 'success') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 3500);
  };

  // Convert raw MongoDB/Server errors to clean user messages
  const parseErrorMessage = (errorData) => {
    const raw = errorData?.message || errorData?.error || (typeof errorData === 'string' ? errorData : '');

    // Check for MongoDB code 11000 duplicate key error
    if (raw.includes('E11000') || raw.toLowerCase().includes('duplicate key')) {
      if (raw.includes('email')) {
        return 'This email address is already registered. Please enter a different email.';
      }
      return 'A student with this information already exists.';
    }

    if (raw.toLowerCase().includes('phone')) {
      return 'Phone number must be numeric and 10 digits.';
    }

    return raw || 'Failed to save student record. Please try again.';
  };

  // Smart image URL resolver
  const getImageUrl = (student) => {
    const rawPic = student.profile_pic || student.profilePic || student.image || student.photo;
    if (!rawPic) return null;

    if (typeof rawPic === 'string' && (rawPic.startsWith('http://') || rawPic.startsWith('https://') || rawPic.startsWith('blob:'))) {
      return rawPic;
    }

    let clean = rawPic.replace(/\\/g, '/');
    const filename = clean.split('/').pop();

    if (clean.includes('uploads/')) {
      clean = 'uploads/' + clean.split('uploads/')[1];
    } else {
      clean = `uploads/${filename}`;
    }

    return `${BACKEND_BASE}/${clean.replace(/^\/+/, '')}`;
  };

  const loadStudents = async () => {
    try {
      setLoading(true);
      const res = await fetch(API_URL);
      if (!res.ok) throw new Error('Failed to fetch data');
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.data || data.students || []);
      console.log('Fetched students:', list);
      setStudents(list);
    } catch (err) {
      notify('Could not connect to API. Is your Node server running?', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const openModal = (student = null) => {
    setSelectedFile(null);
    setModalError(null); // Clear previous errors
    if (student) {
      setEditingId(student._id || student.id);
      setFormData({
        first_name: student.first_name || '',
        last_name: student.last_name || '',
        email: student.email || '',
        phone: student.phone || '',
        gender: student.gender || 'Male',
      });
      setPreviewUrl(getImageUrl(student));
    } else {
      setEditingId(null);
      setFormData(initialFormState);
      setPreviewUrl(null);
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setModalError(null);

    const phoneTrimmed = (formData.phone || '').trim();
    if (!/^\d{10}$/.test(phoneTrimmed)) {
      setModalError('Phone number must be numeric and 10 digits.');
      return;
    }

    try {
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;
      const method = editingId ? 'PUT' : 'POST';

      const data = new FormData();
      data.append('first_name', formData.first_name);
      data.append('last_name', formData.last_name);
      data.append('email', formData.email);
      data.append('phone', phoneTrimmed);
      data.append('gender', formData.gender);

      if (selectedFile) {
        data.append('profile_pic', selectedFile);
      }

      const res = await fetch(url, {
        method,
        body: data,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const friendlyMessage = parseErrorMessage(errorData);
        // Show error inside modal without closing it!
        setModalError(friendlyMessage);
        return;
      }

      notify(editingId ? 'Student updated successfully!' : 'Student added successfully!');
      setIsModalOpen(false);
      loadStudents();
    } catch (err) {
      setModalError(err.message || 'Network error occurred.');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this student record?')) return;
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete student');
      notify('Student deleted successfully!');
      loadStudents();
    } catch (err) {
      notify(err.message, 'error');
    }
  };

  const filtered = students.filter((s) => {
    const q = search.toLowerCase();
    const fullName = `${s.first_name || ''} ${s.last_name || ''}`.toLowerCase();
    const matchesSearch =
      fullName.includes(q) ||
      s.email?.toLowerCase().includes(q) ||
      s.phone?.includes(q);

    const matchesGender =
      genderFilter === 'ALL' ||
      s.gender?.toLowerCase() === genderFilter.toLowerCase();

    return matchesSearch && matchesGender;
  });

  const isDuplicateEmail = modalError && modalError.toLowerCase().includes('email');
  const isPhoneError = modalError && modalError.toLowerCase().includes('phone');

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.title}>🎓 Student Directory</h1>
          <p style={styles.subtitle}>Manage student profiles, photos & contacts</p>
        </div>
        <button style={styles.primaryBtn} onClick={() => openModal()}>
          + Add New Student
        </button>
      </header>

      {/* Main Page Success/Error Alert */}
      {alert && (
        <div style={{
          ...styles.alert,
          backgroundColor: alert.type === 'error' ? '#fee2e2' : '#dcfce7',
          color: alert.type === 'error' ? '#991b1b' : '#166534'
        }}>
          {alert.msg}
        </div>
      )}

      {/* Search & Gender Filter */}
      <div style={styles.filterRow}>
        <input
          type="text"
          placeholder="🔍 Search by name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
        <select
          value={genderFilter}
          onChange={(e) => setGenderFilter(e.target.value)}
          style={styles.filterSelect}
        >
          <option value="ALL">All Genders</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
          <option value="Other">Other</option>
        </select>
      </div>

      {/* Table Card */}
      <div style={styles.card}>
        {loading ? (
          <div style={styles.empty}>Loading students...</div>
        ) : filtered.length === 0 ? (
          <div style={styles.empty}>No student records found.</div>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr style={styles.tableHeadRow}>
                <th style={{ ...styles.th, width: '64px' }}>Photo</th>
                <th style={styles.th}>Name</th>
                <th style={styles.th}>Email</th>
                <th style={styles.th}>Phone</th>
                <th style={styles.th}>Gender</th>
                <th style={{ ...styles.th, textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => {
                const id = s._id || s.id;
                const photoSrc = getImageUrl(s);
                const initials = `${s.first_name?.[0] || ''}${s.last_name?.[0] || ''}`.toUpperCase() || 'S';

                return (
                  <tr key={id} style={styles.tr}>
                    <td style={styles.td}>
                      <div style={styles.avatarWrapper}>
                        {photoSrc ? (
                          <img
                            src={photoSrc}
                            alt={s.first_name}
                            style={styles.avatarImg}
                            onError={(e) => {
                              e.target.style.display = 'none';
                              if (e.target.nextSibling) {
                                e.target.nextSibling.style.display = 'flex';
                              }
                            }}
                          />
                        ) : null}
                        <div
                          style={{
                            ...styles.avatarFallback,
                            display: photoSrc ? 'none' : 'flex'
                          }}
                        >
                          {initials}
                        </div>
                      </div>
                    </td>
                    <td style={styles.td}>
                      <span style={{ fontWeight: 600 }}>{s.first_name} {s.last_name}</span>
                    </td>
                    <td style={styles.td}>{s.email}</td>
                    <td style={styles.td}>{s.phone || '-'}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.genderBadge,
                        ...(s.gender === 'Female' ? styles.badgeFemale : s.gender === 'Male' ? styles.badgeMale : styles.badgeOther)
                      }}>
                        {s.gender || 'Not specified'}
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <button style={styles.actionBtn} onClick={() => openModal(s)}>Edit</button>
                      <button style={{ ...styles.actionBtn, ...styles.deleteBtn }} onClick={() => handleDelete(id)}>Delete</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div style={styles.backdrop}>
          <div style={styles.modal}>
            <div style={styles.modalHeader}>
              <h2 style={styles.modalTitle}>{editingId ? 'Edit Student' : 'Add New Student'}</h2>
              <button onClick={() => setIsModalOpen(false)} style={styles.closeBtn}>✕</button>
            </div>

            {/* Error Message Inside Modal */}
            {modalError && (
              <div style={styles.modalErrorBox}>
                <span style={{ marginRight: '6px' }}>⚠️</span>
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '16px' }}>
              <div style={styles.picUploadBox}>
                <div style={styles.previewAvatar}>
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" style={styles.avatarImg} />
                  ) : (
                    <span style={{ color: '#64748b', fontSize: 11, textAlign: 'center' }}>No Photo</span>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Profile Picture (Upload Image)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    style={styles.fileInput}
                  />
                  <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '4px' }}>
                    Supported: JPG, PNG, WEBP (Max 5MB)
                  </small>
                </div>
              </div>

              <div style={styles.row2}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>First Name *</label>
                  <input
                    required
                    style={styles.input}
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Last Name *</label>
                  <input
                    required
                    style={styles.input}
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
              </div>

              <div style={styles.row2}>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Email Address *</label>
                  <input
                    required
                    type="email"
                    style={{
                      ...styles.input,
                      ...(isDuplicateEmail ? styles.inputError : {})
                    }}
                    value={formData.email}
                    onChange={(e) => {
                      setFormData({ ...formData, email: e.target.value });
                      if (modalError) setModalError(null); // Clear error on change
                    }}
                  />
                  {isDuplicateEmail && (
                    <small style={{ color: '#dc2626', fontSize: 12, fontWeight: 500, marginTop: 4, display: 'block' }}>
                      Please provide an alternative email
                    </small>
                  )}
                </div>
                <div style={{ flex: 1 }}>
                  <label style={styles.label}>Phone Number *</label>
                  <input
                    required
                    type="tel"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    placeholder="10-digit number (e.g. 9876543210)"
                    style={{
                      ...styles.input,
                      ...(isPhoneError ? styles.inputError : {})
                    }}
                    value={formData.phone}
                    onChange={(e) => {
                      const numericVal = e.target.value.replace(/\D/g, '').slice(0, 10);
                      setFormData({ ...formData, phone: numericVal });
                      if (modalError) setModalError(null);
                    }}
                  />
                  {isPhoneError ? (
                    <small style={{ color: '#dc2626', fontSize: 12, fontWeight: 500, marginTop: 4, display: 'block' }}>
                      Phone number must be numeric and 10 digits
                    </small>
                  ) : (
                    <small style={{ color: '#64748b', fontSize: 11, display: 'block', marginTop: 4 }}>
                      Must be exactly 10 digits {formData.phone ? `(${formData.phone.length}/10)` : ''}
                    </small>
                  )}
                </div>
              </div>

              <div>
                <label style={styles.label}>Gender</label>
                <select
                  style={styles.input}
                  value={formData.gender}
                  onChange={(e) => setFormData({ ...formData, gender: e.target.value })}
                >
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '12px' }}>
                <button type="button" style={styles.cancelBtn} onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" style={styles.primaryBtn}>
                  {editingId ? 'Update Student' : 'Save Student'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: 1040, margin: '40px auto', padding: '0 20px', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  title: { margin: 0, fontSize: 26, color: '#0f172a' },
  subtitle: { margin: '4px 0 0', color: '#64748b', fontSize: 14 },
  primaryBtn: { background: '#2563eb', color: '#fff', border: 'none', padding: '10px 18px', borderRadius: 6, fontWeight: 600, cursor: 'pointer' },
  cancelBtn: { background: '#e2e8f0', color: '#1e293b', border: 'none', padding: '10px 18px', borderRadius: 6, fontWeight: 600, cursor: 'pointer' },
  alert: { padding: '12px 16px', borderRadius: 6, marginBottom: 16, fontWeight: 500, fontSize: 14 },
  filterRow: { display: 'flex', gap: '12px', marginBottom: 16 },
  searchInput: { flex: 1, padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, background: '#ffffff', color: '#0f172a', outline: 'none' },
  filterSelect: { padding: '10px 14px', border: '1px solid #cbd5e1', borderRadius: 6, fontSize: 14, background: '#ffffff', color: '#0f172a', outline: 'none' },
  card: { background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: 8, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  tableHeadRow: { background: '#f8fafc', borderBottom: '1px solid #e2e8f0' },
  th: { padding: '12px 16px', textAlign: 'left', fontSize: 13, color: '#475569', fontWeight: 600 },
  tr: { borderBottom: '1px solid #f1f5f9' },
  td: { padding: '12px 16px', fontSize: 14, color: '#1e293b', verticalAlign: 'middle' },
  avatarWrapper: { width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarFallback: { width: '100%', height: '100%', background: '#2563eb', color: '#ffffff', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700 },
  genderBadge: { padding: '4px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600 },
  badgeMale: { background: '#e0f2fe', color: '#0369a1' },
  badgeFemale: { background: '#fce7f3', color: '#be185d' },
  badgeOther: { background: '#f3e8ff', color: '#7e22ce' },
  actionBtn: { padding: '6px 12px', border: '1px solid #cbd5e1', background: '#ffffff', color: '#1e293b', borderRadius: 4, cursor: 'pointer', marginRight: 8, fontSize: 12 },
  deleteBtn: { background: '#ef4444', color: '#ffffff', border: 'none' },
  empty: { padding: 40, textAlign: 'center', color: '#94a3b8', fontSize: 14 },

  // Modal styles
  backdrop: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { background: '#ffffff', padding: 26, borderRadius: 10, width: '100%', maxWidth: 480, boxShadow: '0 10px 25px rgba(0,0,0,0.2)', color: '#0f172a' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  modalTitle: { margin: 0, color: '#0f172a', fontSize: '20px' },
  closeBtn: { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: '#64748b' },

  // Error inside modal
  modalErrorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#991b1b',
    padding: '10px 14px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: '500',
    marginTop: '12px',
    display: 'flex',
    alignItems: 'center'
  },
  inputError: {
    borderColor: '#dc2626',
    backgroundColor: '#fff5f5'
  },

  picUploadBox: { display: 'flex', alignItems: 'center', gap: 14, background: '#f8fafc', padding: 12, borderRadius: 8, border: '1px dashed #cbd5e1' },
  previewAvatar: { width: 52, height: 52, borderRadius: '50%', overflow: 'hidden', background: '#e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  fileInput: { width: '100%', fontSize: 13, color: '#334155' },
  row2: { display: 'flex', gap: 12 },
  label: { display: 'block', marginBottom: 4, fontSize: 13, fontWeight: 600, color: '#1e293b' },
  input: { width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: 5, fontSize: 14, background: '#ffffff', color: '#0f172a', outline: 'none' }
};
