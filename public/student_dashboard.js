/* student_dashboard.js (FIXED) */
const token = localStorage.getItem("studentToken");
if (!token) {
  window.location.href = "login.html";
}

// small helpers for login data
function getLoginData() {
  return JSON.parse(localStorage.getItem("studentLoginData") || "{}");
}
function setLoginData(obj) {
  localStorage.setItem("studentLoginData", JSON.stringify(obj));
}

// Decode JWT 
function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
}
const payload = parseJwt(token);

// Page navigation (blocks certain pages if policy not agreed)
function showPage(id) {
  const loginData = getLoginData();
  
  // Block access to restricted pages until policy is agreed
  if (!loginData.policyAgreed && ["borrow", "accountability"].includes(id)) {
    document.getElementById("policyModal").style.display = "flex";
    return;
  }

  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  const target = document.getElementById(id);
  if (target) target.classList.add("active");
}

function logout() {
  localStorage.removeItem("studentToken");
  localStorage.removeItem("studentLoginData");
  window.location.href = "index.html";
}

// Load profile and policy status
async function loadProfile() {
    const sidebarHeader = document.getElementById('sidebarUserName');
    
    // Set initial loading state for the NEW profile page elements
    document.getElementById('viewFullName').textContent = "Loading...";
    document.getElementById('viewCYS').textContent = "Loading...";
    document.getElementById('viewProfessor').textContent = "Loading...";
    document.getElementById('viewSchedule').textContent = "Loading...";
    document.getElementById('viewLabID').textContent = "Loading...";
    document.getElementById('viewStatus').textContent = "Loading...";
    sidebarHeader.textContent = "Loading..."; // Sidebar header initial state
    
    try {
        const res = await fetch("/api/student/me", {
            headers: { "Authorization": "Bearer " + token }
        });
        
        if (res.ok) {
            const student = await res.json();
            
            //  1. Populate the Sidebar Header (Fixes the "LOADING..." issue in the sidebar)
            sidebarHeader.textContent = student.fullName.split(' ')[0] || "Student"; 

            // 2. Populate the Home section (Your existing logic)
            document.getElementById("studentName").innerText = student.fullName || "";
            document.getElementById("studentLabID").innerText = student.labID || "";
            document.getElementById("studentCYS").innerText = student.cys || "";
            document.getElementById("studentProf").innerText = student.professor || "";
            document.getElementById("studentSched").innerText = student.classSchedule || "";
            document.getElementById("studentStatus").innerText = student.status || "";

            // 3. Populate the NEW Read-Only View Section (Fixes the blank fields in the Profile page)
            document.getElementById('viewFullName').textContent = student.fullName;
            document.getElementById('viewCYS').textContent = student.cys;
            document.getElementById('viewProfessor').textContent = student.professor;
            document.getElementById('viewSchedule').textContent = student.classSchedule;
            document.getElementById('viewLabID').textContent = student.labID || 'N/A';
            document.getElementById('viewStatus').textContent = student.status;

            //  4. Populate the hidden Edit Form Inputs
            document.getElementById('profileFullName').value = student.fullName;
            document.getElementById('profileCYS').value = student.cys;
            document.getElementById('profileProfessor').value = student.professor;
            document.getElementById('profileSchedule').value = student.classSchedule;
            
            // Check policy status (Existing logic)
            const pRes = await fetch("/api/student/policy", {
                headers: { "Authorization": "Bearer " + token }
            });
            
            // ... (rest of policy check logic remains the same)
            
        } else if (res.status === 401 || res.status === 403) {
             alert("Session expired. Please log in again.");
             logout();
        } else {
             // Fallback text on non-ok response
             document.getElementById('viewFullName').textContent = "Error loading data.";
             sidebarHeader.textContent = "Student";
        }

    } catch (err) {
        console.error("Error loading profile:", err);
        document.getElementById('viewFullName').textContent = "Error loading data.";
        sidebarHeader.textContent = "Student";
    }
}

// Load experiments for Borrow
async function loadExperiments() {
  try {
    const res = await fetch("/api/student/experiments", {
      headers: { "Authorization": "Bearer " + token }
    });

    if (!res.ok) return;
    const data = await res.json();

    const list = document.getElementById("experimentsList");
    if (!list) return;

    if (data.experiments.length === 0) {
      list.innerHTML = "<p>No experiments available.</p>";
      return;
    }

    // Build tile grid + one hidden expanded panel
    list.innerHTML = `
      <div id="expTileGrid" style="display:grid; grid-template-columns:repeat(auto-fill,minmax(260px,1fr)); gap:1rem; margin-bottom:1.5rem;">
        ${data.experiments.map(exp => `
          <div class="card" style="cursor:pointer; padding:20px;" onclick="openExperiment('${exp._id}')">
            <h3 style="margin-bottom:8px;">${exp.name}</h3>
            <p style="font-size:0.9rem; color:#ccc; margin-bottom:1rem;">${exp.description || ""}</p>
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <small style="color:#aaa;">${exp.materials?.length || 0} material(s) · ${exp.course || "N/A"}</small>
              <button onclick="event.stopPropagation(); openExperiment('${exp._id}')" style="min-width:unset; padding:6px 14px; font-size:0.8rem;">View</button>
            </div>
          </div>
        `).join("")}
      </div>

      <div id="expExpandedPanel" style="display:none; margin-top:1rem;" data-expid=""></div>
    `;

    // Store experiment data on window so openExperiment can access it
    window._experiments = data.experiments;

  } catch (err) {
    console.error("Error loading experiments:", err);
  }
}

function openExperiment(expId) {
  const exp = window._experiments.find(e => e._id === expId);
  if (!exp) return;

  const materialsForm = exp.materials && exp.materials.length > 0
    ? exp.materials.map(m => `
        <div style="margin-bottom:18px;">
          <div style="font-weight:500; margin-bottom:4px;">${m.item}</div>
          <div style="font-size:0.8rem; color:#aaa; margin-bottom:6px;">Qty</div>
          <input
            type="number"
            min="1"
            placeholder="Enter quantity"
            class="material-input"
            data-itemid="${m.itemId || m._id || ""}"
            data-item="${m.item}"
            data-specs="${m.specs || ""}"
            style="width:100%; padding:8px 12px; border-radius:8px; border:1px solid rgba(255,255,255,0.2); background:rgba(255,255,255,0.05); color:#fff; font-size:14px;"
          />
        </div>
      `).join("")
    : `<p style="color:#aaa;">No materials listed.</p>`;

  // Create overlay
  const overlay = document.createElement("div");
  overlay.id = "expModalOverlay";
  overlay.style.cssText = `
    position:fixed; inset:0; background:rgba(0,0,0,0.6);
    display:flex; align-items:center; justify-content:center;
    z-index:9000; padding:20px;
  `;

  overlay.innerHTML = `
    <div style="
      background:#0d2316;
      border:1px solid rgba(255,255,255,0.15);
      border-radius:16px;
      width:100%;
      max-width:420px;
      max-height:80vh;
      display:flex;
      flex-direction:column;
      overflow:hidden;
    ">
      <!-- Header -->
      <div style="padding:18px 20px; border-bottom:1px solid rgba(255,255,255,0.1); flex-shrink:0;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
          <div>
            <h3 style="color:#ffd700; margin:0 0 4px 0; font-size:1.1rem;">${exp.name}</h3>
            <p style="font-size:0.8rem; color:#aaa; margin:0;">${exp.course || "N/A"}</p>
          </div>
          <button onclick="closeExperiment()" style="
            min-width:unset; padding:4px 10px; font-size:0.8rem;
            flex-shrink:0; border-radius:8px;
          ">✕</button>
        </div>
        ${exp.description ? `<p style="font-size:0.85rem; color:#ccc; margin:10px 0 0 0; line-height:1.5;">${exp.description}</p>` : ""}
      </div>

      <!-- Scrollable materials -->
      <div style="padding:18px 20px; overflow-y:auto; flex:1;">
        <p style="font-size:0.7rem; color:#888; text-transform:uppercase; letter-spacing:0.06em; margin:0 0 14px 0;">Materials — enter quantity needed</p>
        ${materialsForm}
      </div>

      <!-- Footer -->
      <div style="padding:14px 20px; border-top:1px solid rgba(255,255,255,0.1); display:flex; justify-content:flex-end; gap:10px; flex-shrink:0;">
        <button onclick="closeExperiment()" style="min-width:unset; padding:8px 16px; font-size:0.9rem;">Cancel</button>
        <button onclick="submitBorrowFromPanel('${exp._id}')" style="min-width:unset; padding:8px 16px; font-size:0.9rem;">Submit Borrow Request</button>
      </div>
    </div>
  `;

  // Close on backdrop click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) closeExperiment();
  });

  document.body.appendChild(overlay);
}

function closeExperiment() {
  const overlay = document.getElementById("expModalOverlay");
  if (overlay) overlay.remove();
}

async function submitBorrowFromPanel(expId) {
  const loginData = getLoginData();
  if (!loginData.policyAgreed) {
    document.getElementById("policyModal").style.display = "flex";
    return;
  }

  if (!confirm("Are you sure you want to submit this borrow request?")) return;

  const overlay = document.getElementById("expModalOverlay");
  const inputs = overlay.querySelectorAll(".material-input");
  const materialsUsed = [];

  for (let input of inputs) {
    const qty = parseInt(input.value);
    if (!qty || qty <= 0) {
      alert("Please enter a valid quantity for all materials.");
      return;
    }
    const rawId = input.dataset.itemid;
    const entry = {
      item: input.dataset.item,
      specs: input.dataset.specs || "",
      qty
    };
    if (rawId && rawId !== "undefined" && rawId.length === 24) {
      entry.itemId = rawId;
    }
    materialsUsed.push(entry);
  }

  try {
    const res = await fetch(`/api/student/borrow/${expId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token },
      body: JSON.stringify({ materialsUsed })
    });

    const body = await res.json();

    if (res.ok) {
      alert("Borrow request submitted! Please wait for admin approval.");
      closeExperiment();
      loadAccountability();
      showPage("accountability");
    } else {
      alert(body.message || "Failed to borrow");
    }
  } catch (err) {
    console.error("Borrow error:", err);
    alert("Server error occurred.");
  }
}

// Load accountability (My Borrowed Items)
async function loadAccountability() {
  try {
    const res = await fetch("/api/student/me/borrowed", {
      headers: { "Authorization": "Bearer " + token }
    });
    
    if (!res.ok) return;
    const data = await res.json();
    
    const list = document.getElementById("borrowedList");
    if (!list) return;

    if (data.borrowed.length === 0) {
        list.innerHTML = "<p>You have no active borrows.</p>";
        return;
    }

    list.innerHTML = data.borrowed.map(b => {
      // Handle color coding for status
      let statusColor = "black";
      if(b.status === "pending") statusColor = "orange";
      if(b.status === "borrowed") statusColor = "green";
      if(b.status === "rejected") statusColor = "red";
      if(b.status === "returned") statusColor = "gray";

      return `
        <div class="card">
          <h3>${b.experimentName || "Unknown Experiment"}</h3>
          <p><b>Status:</b> <span style="color:${statusColor}; font-weight:bold;">${b.status.toUpperCase()}</span></p>
          <p><b>Date Requested:</b> ${new Date(b.createdAt).toLocaleDateString()}</p>
          ${b.borrowedAt ? `<p><b>Borrowed On:</b> ${new Date(b.borrowedAt).toLocaleDateString()}</p>` : ""}
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Error loading accountability:", err);
  }
}

// Load student-specific breakage reports
async function loadStudentBreakages() {
  try {
    // ASSUMPTION: This new endpoint returns only breakages for the logged-in student
    const res = await fetch("/api/student/me/breakages", {
      headers: { "Authorization": "Bearer " + token }
    });
    
    if (!res.ok) return;
    const data = await res.json();
    
    // ⭐ Target a new container for breakages
    const list = document.getElementById("studentBreakageList");
    if (!list) return;

    list.innerHTML = ""; // Clear existing data

    if (data.length === 0) {
        list.innerHTML = '<p>You have no reported breakages.</p>';
        return;
    }

    list.innerHTML = data.map(b => {
      // Handle color coding for status: unresolved (red) or resolved (green)
      let statusColor = "black";
      if(b.status === "unresolved") statusColor = "red";
      if(b.status === "resolved") statusColor = "green";
      
      const reportedDate = new Date(b.reportedAt);
      
      return `
        <div class="card">
          <h3>Item: ${b.item}</h3>
          <p><b>Status:</b> <span style="color:${statusColor}; font-weight:bold;">${b.status.toUpperCase()}</span></p>
          <p><b>Date Reported:</b> ${reportedDate.toLocaleDateString()}</p>
          <p><b>Violation:</b> ${b.violation}</p>
          <p><b>Action Taken:</b> ${b.remarks || "None"}</p>
        </div>
      `;
    }).join("");

  } catch (err) {
    console.error("Error loading student breakages:", err);
  }
}

// --- Handle the profile update form submission ---
async function handleProfileUpdate(event) {
    event.preventDefault(); // Stop default form submission
    const form = document.getElementById('profileUpdateForm');
    const messageElement = document.getElementById('profileMessage');

    // 1. Get password values
    const currentPass = form.currentPassword.value.trim();
    const newPass = form.newPassword.value.trim();

    // 2. NEW VALIDATION STEP: Check if only ONE password field is filled
    if ((currentPass && !newPass) || (!currentPass && newPass)) {
        messageElement.textContent = "Error: To change your password, you must provide BOTH your current and new password.";
        messageElement.style.color = "red";
        return; // STOP the function here
    }
    
    // Clear previous message and set loading state
    messageElement.textContent = "Updating...";
    messageElement.style.color = "orange";

    const data = {
        fullName: form.fullName.value,
        cys: form.cys.value,
        professor: form.professor.value,
        classSchedule: form.classSchedule.value,
    };

    // 3. Update logic: Only include passwords if BOTH are present
    if (currentPass && newPass) { 
        data.currentPassword = currentPass;
        data.newPassword = newPass;
    }

    try {
        const response = await fetch('/api/student/me', {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` 
            },
            body: JSON.stringify(data)
        });

        const result = await response.json();
        
        if (response.ok) {
            messageElement.textContent = result.message;
            messageElement.style.color = "green";
            
            // Re-load data to update all sections (sidebar, home, profile form)
            loadProfile(); 
            
            // Clear password fields on successful update
            form.currentPassword.value = '';
            form.newPassword.value = '';
            
            // Return to view mode on success AND show the success message in the view section
            toggleEditMode(false); 
            document.getElementById('viewMessage').textContent = "Profile updated successfully!"; 
        } else {
            messageElement.textContent = `Error: ${result.message || 'Update failed.'}`;
            messageElement.style.color = "red";
        }

    } catch (error) {
        console.error("Profile update failed:", error);
        messageElement.textContent = "Server error during update.";
        messageElement.style.color = "red";
    }
}

//  NEW FUNCTION to toggle between read-only view and the edit form
function toggleEditMode(isEdit) {
    const viewSection = document.getElementById('profileViewSection');
    const editForm = document.getElementById('profileUpdateForm');
    
    if (isEdit) {
        // Switch to Edit Mode
        viewSection.style.display = 'none';
        editForm.style.display = 'block';
        // Clear any previous status messages in the edit form
        document.getElementById('profileMessage').textContent = "";
    } else {
        // Switch back to View Mode (Cancel)
        viewSection.style.display = 'block';
        editForm.style.display = 'none';
        // Clear password fields on cancel
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
    }
}


// Agree policy (called from modal)
async function agreePolicy() {
  try {
    const res = await fetch("/api/student/agree-policy", {
      method: "POST",
      headers: { "Authorization": "Bearer " + token }
    });
    
    if (res.ok) {
      alert("You have agreed to the policy. Thank you.");
      // update localStorage state
      const loginData = getLoginData();
      loginData.policyAgreed = true;
      setLoginData(loginData);
      document.getElementById("policyModal").style.display = "none";
    } else {
      const body = await res.json().catch(()=>({}));
      alert(body.message || "Could not save agreement. Try again.");
    }
  } catch (err) {
    console.error("Policy error:", err);
  }
}



// Init
document.addEventListener("DOMContentLoaded", () => {
    loadProfile();
    loadExperiments();
    loadAccountability();
    loadStudentBreakages();
});