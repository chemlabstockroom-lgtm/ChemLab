// admin_dashboard.js

const API_BASE = "http://localhost:4000/api";
const token = localStorage.getItem("adminToken");
if (!token) {
  alert("Please login first.");
  window.location.href = "admin_login.html";
}

// ===== Decode JWT & show Manage Admins if superadmin =====
function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
}

const payload = parseJwt(token);

if (payload && payload.role === "superadmin") {
  document.getElementById("adminManageBtn").style.display = "block";
}

async function lookupChemicalByBarcode(barcode) {
  if (!barcode || barcode.length < 3) return;

  try {
    const res = await fetch(
      `${API_BASE}/admin/chemicals/barcode/${barcode}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!res.ok) return; // no record found

    const chem = await res.json();

    // 🔹 Auto-fill form fields
    document.getElementById("itemLocation").value = chem.location || "";
    document.getElementById("itemDateIn").value = chem.dateIn || "";
    document.getElementById("itemChemicalName").value = chem.chemicalName || "";
    document.getElementById("itemCAS").value = chem.casNumber || "";
    document.getElementById("itemContainerSize").value = chem.containerSize || "";
    document.getElementById("itemUnits").value = chem.units || "";
    document.getElementById("itemState").value = chem.state || "";

    document.getElementById("itemTotalQty").value = chem.totalQuantity || 0;
    document.getElementById("itemRemainingQty").value = chem.remainingQuantity || 0;

    // 🔔 Stock status
    if (chem.remainingQuantity <= 0) {
      alert("⚠️ Chemical FOUND but already CONSUMED / OUT OF STOCK");
    } else {
      alert(`✅ Chemical FOUND — Remaining: ${chem.remainingQuantity}`);
    }

  } catch (err) {
    console.error("Barcode lookup failed:", err);
  }
}

// ===== PAGE SWITCHING =====
function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");

  switch (id) {
    case "students":
      loadPendingStudents();
      loadActiveStudents();
      break;
    case "inventory":
      loadInventory();
      toggleInventoryTab('equipment');
      break;
    case "borrowed":
      loadBorrowed();
      break;
    case "accountability":
      loadBreakages();
      break;
    case "appointments":
      loadAppointments();
      break;
    case "experiments":
      loadExperiments();
      break;
    case "profile":
      loadAdminProfile(); 
      break;
    case "admins":
      loadAdmins();
      break;
  }
}

function logout() {
    // 1. Clear the authentication token from local storage
    localStorage.removeItem('token');
    
    // 2. Clear the current admin's role/data if stored
    localStorage.removeItem('adminRole');
    
    window.location.href = 'index.html'; 
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    sidebar.classList.toggle('mobile-open');
}

// Optional: Close sidebar if user clicks outside of it on mobile
document.addEventListener('click', function(event) {
    const sidebar = document.querySelector('.sidebar');
    const toggleBtn = document.querySelector('.mobile-toggle');
    
    if (window.innerWidth <= 767 && 
        !sidebar.contains(event.target) && 
        !toggleBtn.contains(event.target) && 
        sidebar.classList.contains('mobile-open')) {
        sidebar.classList.remove('mobile-open');
    }
});

// ====== GLOBAL SEARCH ======
function filterTable() {
  const query = document.getElementById("searchInput").value.toLowerCase();
  document.querySelectorAll("table tbody tr").forEach(row => {
    row.style.display = row.innerText.toLowerCase().includes(query) ? "" : "none";
  });
}

// ====== ADMIN PROFILE ======
// --- 1. Load Admin Profile Data ---
async function loadAdminProfile() {
    const sidebarName = document.getElementById('adminName');
    
    // Set initial loading states
    document.getElementById('viewAdminName').textContent = "Loading...";
    document.getElementById('viewAdminEmail').textContent = "Loading...";
    document.getElementById('viewAdminRole').textContent = "Loading...";
    sidebarName.textContent = "Loading...";

    try {
        const res = await fetch(`${API_BASE}/admin/me`, {
            headers: { "Authorization": "Bearer " + token }
        });
        
        if (res.ok) {
            adminData = await res.json();
            
            // 1. Populate Sidebar
            sidebarName.textContent = adminData.name || "Admin";

            // 2. Populate Read-Only View Section
            document.getElementById('viewAdminName').textContent = adminData.name;
            document.getElementById('viewAdminEmail').textContent = adminData.email;
            document.getElementById('viewAdminRole').textContent = adminData.role.toUpperCase();

            // 3. Populate hidden Edit Form Inputs
            document.getElementById('profileAdminName').value = adminData.name;
            document.getElementById('profileAdminEmail').value = adminData.email;
            
        } else if (res.status === 401 || res.status === 403) {
            alert("Session expired or unauthorized. Please log in again.");
            logout();
        } else {
            document.getElementById('viewAdminName').textContent = "Error loading data.";
            sidebarName.textContent = "Admin";
        }

    } catch (err) {
        console.error("Error loading admin profile:", err);
        document.getElementById('viewAdminName').textContent = "Error loading data.";
        sidebarName.textContent = "Admin";
    }
}

// --- 2. Toggle Edit Mode ---
function toggleAdminEditMode(isEdit) {
    const viewSection = document.getElementById('profileViewSection');
    const editForm = document.getElementById('adminProfileUpdateForm');
    
    if (isEdit) {
        // Switch to Edit Mode
        viewSection.style.display = 'none';
        editForm.style.display = 'block';
        document.getElementById('profileMessage').textContent = "";
        document.getElementById('viewMessage').textContent = ""; // Clear view message
    } else {
        // Switch back to View Mode (Cancel)
        viewSection.style.display = 'block';
        editForm.style.display = 'none';
        
        // Clear password fields on cancel/save
        document.getElementById('currentAdminPassword').value = '';
        document.getElementById('newAdminPassword').value = '';
    }
}

// --- 3. Handle Profile Update Submission ---
async function handleAdminProfileUpdate(event) {
    event.preventDefault(); 
    const form = document.getElementById('adminProfileUpdateForm');
    const messageElement = document.getElementById('profileMessage');
    
    // Get password values
    const currentPass = form.currentPassword.value.trim();
    const newPass = form.newPassword.value.trim();

    // Password validation: Must provide BOTH fields if changing password
    if ((currentPass && !newPass) || (!currentPass && newPass)) {
        messageElement.textContent = "Error: To change your password, you must provide BOTH your current and new password.";
        messageElement.style.color = "red";
        return; 
    }
    
    messageElement.textContent = "Updating...";
    messageElement.style.color = "orange";

    const data = {
        name: form.name.value,
        email: form.email.value,
    };

    if (currentPass && newPass) { 
        data.currentPassword = currentPass;
        data.newPassword = newPass;
    }

    try {
        const response = await fetch(`${API_BASE}/admin/me`, {
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
            
            // Re-load data to update all sections (sidebar, view form)
            loadAdminProfile(); 
            
            // Clear password fields on successful update
            form.currentPassword.value = '';
            form.newPassword.value = '';
            
            // Return to view mode on success AND show the success message in the view section
            toggleAdminEditMode(false); 
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

// ====== STUDENTS ======
async function loadPendingStudents() {
    const res = await fetch(`${API_BASE}/admin/students`, {
        headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    const pendingTbody  = document.querySelector("#studentsTable tbody");
    const rejectedTbody = document.querySelector("#rejectedStudentsTable tbody");
    pendingTbody.innerHTML  = "";
    rejectedTbody.innerHTML = "";

    data.students.forEach(stu => {
        const tr = document.createElement("tr");

        if (stu.status === "pending") {
            tr.innerHTML = `
                <td>${stu.fullName}</td>
                <td>${stu.email}</td>
                <td>${stu.cys}</td>
                <td>${stu.professor}</td>
                <td>${stu.classSchedule}</td>
                <td>${stu.status}</td>
                <td>
                    <button onclick="openLabIdModal('${stu._id}', '${stu.fullName}')">Assign Lab ID</button>
                    <button onclick="rejectStudent('${stu._id}')">Reject</button>
                </td>
            `;
            pendingTbody.appendChild(tr);

        } else if (stu.status === "blocked") {
            tr.innerHTML = `
                <td>${stu.fullName}</td>
                <td>${stu.email}</td>
                <td>${stu.cys}</td>
                <td>${stu.professor}</td>
                <td>${stu.classSchedule}</td>
                <td style="color:#f87171; font-weight:bold;">rejected</td>
                <td>
                    <button onclick="openEditStudentModal('${stu._id}', '${stu.fullName}', '${stu.email}', '${stu.cys}', '${stu.professor}', '${stu.classSchedule}', '${stu.status}')">Edit</button>
                </td>
            `;
            rejectedTbody.appendChild(tr);
        }
    });

    if (pendingTbody.innerHTML  === "") pendingTbody.innerHTML  = "<tr><td colspan='7' style='text-align:center;color:rgba(255,255,255,0.5)'>No pending students.</td></tr>";
    if (rejectedTbody.innerHTML === "") rejectedTbody.innerHTML = "<tr><td colspan='7' style='text-align:center;color:rgba(255,255,255,0.5)'>No rejected students.</td></tr>";
}

async function loadActiveStudents() {
  const res = await fetch(`${API_BASE}/admin/students`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const tbody = document.querySelector("#activeStudentsTable tbody");
  tbody.innerHTML = "";
  data.students.forEach(stu => {
    if (stu.status !== "active") return; // Only show active students
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${stu.fullName}</td>
      <td>${stu.labID}</td>
      <td>${stu.cys}</td>
      <td>${stu.professor}</td>
      <td>${stu.classSchedule}</td>
      <td>${stu.status}</td>
      <td>
        <button onclick="openEditLabIdModal('${stu._id}', '${stu.fullName}')">Edit Lab ID</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// 1. Opens the Modal and sets the data
function openLabIdModal(studentId, fullName) {
    document.getElementById("assignStudentId").value = studentId;
    document.getElementById("displayStudentName").value = fullName;
    document.getElementById("labIDInput").value = ""; 
    document.getElementById("labIdModalTitle").textContent = "Assign Lab ID";
    document.getElementById("labIdModal").style.display = "flex";
}


// 1. Opens the Edit Modal and sets the data
function openEditLabIdModal(studentId, fullName) {
    document.getElementById("editStudentId").value = studentId;
    document.getElementById("editDisplayStudentName").value = fullName;
    document.getElementById("editIDInput").value = "";
    document.getElementById("editLabIdModalTitle").innerText = "Edit Lab ID";
    document.getElementById("editLabIdModal").style.display = "flex";
}

// 2. Closes the Modal
function closeLabIdModal() {
    document.getElementById("labIdModal").style.display = "none";
    const errDiv = document.getElementById("labIdError");
    if (errDiv) { errDiv.style.display = "none"; errDiv.innerText = ""; }
}

// Closes Edit Lab ID Modal
function closeEditLabIdModal() {
    document.getElementById("editLabIdModal").style.display = "none";
    const errDiv = document.getElementById("editLabIdError");
    if (errDiv) { errDiv.style.display = "none"; errDiv.innerText = ""; }
}

// 3. Handles the actual database update
document.getElementById("labIdForm").onsubmit = async (e) => {
    e.preventDefault();

    const studentId = document.getElementById("assignStudentId").value;
    const labID = document.getElementById("labIDInput").value.trim();

    const res = await fetch(`${API_BASE}/admin/students/${studentId}/assign-labid`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ labID })
    });

    const result = await res.json();
    if (res.ok) {
        alert("Lab ID assigned successfully!");
        closeLabIdModal();
        loadPendingStudents();
        loadActiveStudents(); // Refresh the table
    } else {
         let errDiv = document.getElementById("labIdError");
          if (!errDiv) {
              errDiv = document.createElement("div");
              errDiv.id = "labIdError";
              errDiv.style.cssText = "margin: 10px 0 0; padding: 10px 14px; border-radius: 8px; font-size: 0.9rem; background: rgba(255,107,107,0.12); border: 1px solid rgba(255,107,107,0.4); color: #ff6b6b;";
              document.querySelector("#labIdForm .modal-actions").before(errDiv);
          }
          errDiv.style.display = "block";
          errDiv.innerText = result.message || "Failed to assign Lab ID.";
      }
};

// Edit Lab ID form submission
document.getElementById("editLabIdForm").onsubmit = async (e) => {
    e.preventDefault();

    const studentId = document.getElementById("editStudentId").value;
    const labID = document.getElementById("editIDInput").value.trim();

    const res = await fetch(`${API_BASE}/admin/students/${studentId}/assign-labid`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ labID })
    });

    const result = await res.json();

    if (res.ok) {
        alert("Lab ID updated successfully!");
        closeEditLabIdModal();
        loadActiveStudents();
    } else {
        let errDiv = document.getElementById("editLabIdError");
        if (!errDiv) {
            errDiv = document.createElement("div");
            errDiv.id = "editLabIdError";
            errDiv.style.cssText = "margin: 10px 0 0; padding: 10px 14px; border-radius: 8px; font-size: 0.9rem; background: rgba(255,107,107,0.12); border: 1px solid rgba(255,107,107,0.4); color: #ff6b6b;";
            document.querySelector("#editLabIdForm .modal-actions").before(errDiv);
        }
        errDiv.style.display = "block";
        errDiv.innerText = result.message || "Failed to update Lab ID.";
    }
};

async function rejectStudent(studentId) {
  if (!confirm("Reject this student?")) return;

  const res = await fetch(`${API_BASE}/admin/students/${studentId}/reject`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });

  const result = await res.json();
  if (!res.ok) {
    alert("Error: " + result.message);
  } else {
    alert("Student rejected.");
    loadPendingStudents();
    loadActiveStudents(); // Refresh the active students table in case the rejected student was previously active
  }
}

// ===== NEW INVENTORY FILTER AND SEARCH LOGIC =====
function filterInventory() {
    const searchInput = document.getElementById('inventorySearchInput');
    const categoryFilter = document.getElementById('categoryFilter');
    
    // Get current filter values
    const searchFilter = searchInput.value.toUpperCase();
    const selectedCategory = categoryFilter.value;

    // Get all inventory blocks
    const inventoryBlocks = document.querySelectorAll('.inventory-category-block');

    inventoryBlocks.forEach(block => {
        const blockCategory = block.getAttribute('data-category');
        let blockShouldBeVisible = false;

        // 1. Check Category Filter: Hide if the category doesn't match the selection (unless 'all' is selected)
        const categoryMatch = (selectedCategory === 'all' || selectedCategory === blockCategory);
        
        if (categoryMatch) {
            // 2. Apply Search Filter to the rows within this block's table
            const table = block.querySelector('table');
            const tbody = table ? table.querySelector('tbody') : null;
            
            if (tbody) {
                const rows = tbody.getElementsByTagName('tr');
                
                let anyRowMatchesSearch = false;

                // Iterate through all rows in the current table
                for (let i = 0; i < rows.length; i++) {
                    let rowMatchesSearch = false;
                    const cells = rows[i].getElementsByTagName('td');
                    
                    // Iterate through all cells (columns) in the row
                    for (let j = 0; j < cells.length - 1; j++) { // Exclude the last 'Actions' column
                        const cellText = cells[j].textContent || cells[j].innerText;
                        if (cellText.toUpperCase().indexOf(searchFilter) > -1) {
                            rowMatchesSearch = true;
                            anyRowMatchesSearch = true;
                            break; 
                        }
                    }

                    // Show or hide the row based on search
                    rows[i].style.display = rowMatchesSearch ? "" : "none";
                }

                // A block should be visible if its category matches AND
                // either the search is empty OR at least one row matched the search.
                if (searchFilter === "" || anyRowMatchesSearch) {
                    blockShouldBeVisible = true;
                }
            } else {
                // If there's no table, just show the block if category matches (e.g., if it's empty)
                 blockShouldBeVisible = true;
            }
        }
        
        // Final action: show or hide the entire inventory block
        block.style.display = blockShouldBeVisible ? 'block' : 'none';
    });
}

// ====== INVENTORY ======
async function loadInventory() {
  const tokenHeader = { Authorization: `Bearer ${token}` };

  const [equipmentRes, chemicalsRes, glasswareRes, fixedAssetsRes] = await Promise.all([
    fetch(`${API_BASE}/admin/equipment`, { headers: tokenHeader }),
    fetch(`${API_BASE}/admin/chemicals`, { headers: tokenHeader }),
    fetch(`${API_BASE}/admin/glassware`, { headers: tokenHeader }),
    fetch(`${API_BASE}/admin/fixed-assets`, { headers: tokenHeader }),
  ]);

  const [equipment, chemicals, glassware, fixedAssets] = await Promise.all([
    equipmentRes.json(),
    chemicalsRes.json(),
    glasswareRes.json(),
    fixedAssetsRes.json(),
  ]);

  //EXPORT BUTTONS
  setupExportButton("exportEquipment", equipment, "equipment_inventory");
  setupExportButton("exportChemicals", chemicals, "chemicals_inventory");
  setupExportButton("exportGlassware", glassware, "glassware_inventory");
  setupExportButton("exportFixedAssets", fixedAssets, "fixed_assets_inventory");
  
  setupFullExportButton(equipment, chemicals, glassware, fixedAssets);

  // clear existing
  document.querySelector("#equipmentTable tbody").innerHTML = "";
  document.querySelector("#chemicalsTable tbody").innerHTML = "";
  document.querySelector("#glasswareTable tbody").innerHTML = "";
  document.querySelector("#fixedAssetTable tbody").innerHTML = "";

  // ==== Equipment ====
  equipment.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.dateReceived || ""}</td>
      <td>${item.itemName || ""}</td>
      <td>${item.specification || ""}</td>
      <td>${item.location || ""}</td>
      <td>${item.quantity || "0"}</td>
      <td>${item.remainingQuantity ?? 0}</td>
      <td>
        <button onclick="editMaterial('${item._id}', 'equipment')">Edit</button>
        <button onclick="deleteMaterial('${item._id}', 'equipment')">Delete</button>
      </td>`;
    document.querySelector("#equipmentTable tbody").appendChild(tr);
  });

  // ==== Chemicals ====
  chemicals.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.barcode || ""}</td>
      <td>${item.location || ""}</td>
      <td>${item.dateIn || ""}</td>
      <td>${item.chemicalName || ""}</td>
      <td>${item.casNumber || ""}</td>
      <td>${item.containerSize || ""}</td>
      <td>${item.status}</td>
      <td>${item.units || ""}</td>
      <td>${item.state || ""}</td>
      <td>
        <button onclick="editMaterial('${item._id}', 'chemicals')">Edit</button>
        <button onclick="deleteMaterial('${item._id}', 'chemicals')">Delete</button>
      </td>`;
    document.querySelector("#chemicalsTable tbody").appendChild(tr);
  });

  // ==== Glassware ====
  glassware.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.itemName || ""}</td>
      <td>${item.description || ""}</td>
      <td>${item.quantity || ""}</td>
      <td>${item.remainingQuantity ?? 0}</td>
      <td>${item.remarks || ""}</td>
      <td>
        <button onclick="editMaterial('${item._id}', 'glassware')">Edit</button>
        <button onclick="deleteMaterial('${item._id}', 'glassware')">Delete</button>
      </td>`;
    document.querySelector("#glasswareTable tbody").appendChild(tr);
  });

  // ==== Fixed Assets ====
  fixedAssets.forEach(item => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${item.dateReceived || ""}</td>
      <td>${item.propertyCode || ""}</td>
      <td>${item.itemName || ""}</td>
      <td>${item.description || ""}</td>
      <td>${item.serialNumber || ""}</td>
      <td>${item.location || ""}</td>
      <td>${item.nFEA || ""}</td>
      <td>${item.quantity || ""}</td>
      <td>${item.cost || ""}</td>
      <td>${item.status || ""}</td>
      <td>
        <button onclick="editMaterial('${item._id}', 'fixed-assets')">Edit</button>
        <button onclick="deleteMaterial('${item._id}', 'fixed-assets')">Delete</button>
      </td>`;
    document.querySelector("#fixedAssetTable tbody").appendChild(tr);
  });

  // ✅ Added: Save items to localStorage for student view
  saveItems(equipment, glassware, chemicals, fixedAssets);
}


// ✅ Added function at the bottom of the file (after all admin code)
function saveItems(equipments, materials, chemicals, furniture) {
  const itemsData = {
    equipments,
    materials,
    chemicals,
    furniture
  };
  localStorage.setItem('labItems', JSON.stringify(itemsData));
}

// ====== EDIT MATERIAL ======
function closeInventoryModal() {
    document.getElementById("inventoryModal").style.display = "none";
    const errDiv = document.getElementById("inventoryEditError");
    if (errDiv) { errDiv.style.display = "none"; errDiv.innerText = ""; }
}

async function editMaterial(id, category) {
    const tokenHeader = { Authorization: `Bearer ${token}` };
    
    try {
        const res = await fetch(`${API_BASE}/admin/${category}`, { headers: tokenHeader });
        const items = await res.json();

        const item = items.find(i => String(i._id) === String(id));

        if (!item) return alert("Item not found");

        const fieldsContainer = document.getElementById("inventoryModalFields");
        fieldsContainer.innerHTML = ""; 
        
        document.getElementById("editItemId").value = id;
        document.getElementById("editItemCategory").value = category;

        // Fields to skip (not editable by user)
        const skipFields = ['_id', '__v', 'remainingQuantity', 'createdAt', 'updatedAt'];
        
        Object.keys(item).forEach(key => {
            if (!skipFields.includes(key)) {
                const fieldGroup = document.createElement("div");
                fieldGroup.className = "form-group";

                let labelText = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

                if (key === "dateReceived") labelText = "Date Received";

                if (category === "chemical" && key === "status") {
                    fieldGroup.innerHTML = `
                        <label>Status</label>
                        <select name="status" required>
                            <option value="Available" ${item.status === "Available" ? "selected" : ""}>Available</option>
                            <option value="Consumed" ${item.status === "Consumed" ? "selected" : ""}>Consumed</option>
                        </select>
                    `;
                } else {
                    fieldGroup.innerHTML = `
                        <label>${labelText}</label>
                        <input type="text" name="${key}" value="${item[key] || ''}">
                    `;
                }

                fieldsContainer.appendChild(fieldGroup);
            }
        });

        document.getElementById("inventoryModal").style.display = "flex";

    } catch (err) {
        console.error("Error:", err);
        alert("Could not load item details.");
    }
}

// Form Submission Logic

document.getElementById("inventoryEditForm").onsubmit = async (e) => {
    e.preventDefault();
    
    const id = document.getElementById("editItemId").value;
    const category = document.getElementById("editItemCategory").value;
    
    const formData = new FormData(e.target);
    const updatedData = Object.fromEntries(formData.entries());

    const res = await fetch(`${API_BASE}/admin/${category}/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(updatedData)
    });

    const result = await res.json();

    if (res.ok) {
        const errDiv = document.getElementById("inventoryEditError");
        if (errDiv) errDiv.style.display = "none";
        alert("Updated successfully!");
        closeInventoryModal();
        loadInventory();
    } else {
        let errDiv = document.getElementById("inventoryEditError");
        if (!errDiv) {
            errDiv = document.createElement("div");
            errDiv.id = "inventoryEditError";
            errDiv.style.cssText = "margin: 10px 0 0; padding: 10px 14px; border-radius: 8px; font-size: 0.9rem; background: rgba(255,107,107,0.12); border: 1px solid rgba(255,107,107,0.4); color: #ff6b6b;";
            const modalActions = document.querySelector("#inventoryEditForm .modal-actions");
            if (modalActions) modalActions.before(errDiv);
        }
        errDiv.style.display = "block";
        errDiv.innerText = result.message || "Failed to update item.";
    }
};

// Close modal if user clicks outside of the white box
window.onclick = function(event) {
    const modal = document.getElementById("inventoryModal");
    if (event.target == modal) {
        closeInventoryModal();
    }
}


// ====== DELETE MATERIAL ======
async function deleteMaterial(id, category) {
  if (!confirm("Delete this material?")) return;

  const res = await fetch(`${API_BASE}/admin/${category}/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.ok) {
    alert("Material deleted.");
    loadInventory();
  } else {
    alert("Error deleting item.");
  }
}

// ====== BORROWED ======
async function loadBorrowed() {
  const res = await fetch(`${API_BASE}/admin/borrowed`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const tbody = document.querySelector("#borrowedTable tbody");
  tbody.innerHTML = "";

  data.borrowed.forEach(b => {
    const tr = document.createElement("tr");

    let actions = "";
    if (b.status === "pending") {
      actions = `
      <button class="accept" onclick="approveBorrow('${b._id}')">Approve</button>
      <button class="reject" onclick="rejectBorrow('${b._id}')">Reject</button>
      `;
    } else if (b.status === "borrowed") {
      actions = `
        <button class="returned" onclick="updateBorrowStatus('${b._id}', 'returned')">Returned</button>
      `;
    } else {
      actions = b.status; // show text if already returned/rejected
    }

    tr.innerHTML = `
      <td>${b.student}</td>
      <td>${b.material}</td>
      <td>${new Date(b.date).toLocaleDateString()}</td>
      <td>${b.status}</td>
      <td>${actions}</td>
    `;
    tbody.appendChild(tr);
  });
}

async function approveBorrow(id) {
  try {
    const res = await fetch(`${API_BASE}/admin/borrow/${id}/approve`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await res.json();

    if (!res.ok) {
      alert("Error: " + result.message);
      return;
    }

    alert("Borrow approved and inventory updated!");
    loadBorrowed();   // refresh borrow list
    loadInventory();  // refresh inventory quantities

  } catch (err) {
    console.error("Error approving borrow:", err);
    alert("Failed to approve borrow.");
  }
}

async function rejectBorrow(id) {
  try {
    const res = await fetch(`${API_BASE}/admin/borrow/${id}/reject`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    const result = await res.json();
    if (!res.ok) {
      alert("Error: " + result.message);
      return;
    }

    alert("Borrow request rejected.");
    loadBorrowed();

  } catch (err) {
    console.error("Error rejecting borrow:", err);
    alert("Failed to reject borrow.");
  }
}

async function updateBorrowStatus(id, newStatus) {
  try {
    const res = await fetch(`${API_BASE}/admin/borrowed/${id}/status`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ status: newStatus }),
    });

    const result = await res.json();

    if (!res.ok) {
      alert("Error: " + result.message);
      return;
    }

    alert(`Borrow marked as ${newStatus}!`);
    loadBorrowed();   // refresh borrow list
    loadInventory();  // refresh inventory to show updated quantities

  } catch (err) {
    console.error("Error updating borrow status:", err);
    alert("Failed to update borrow status.");
  }
}



// ===== APPOINTMENT =====

async function approveAppointment(id) {
  await updateAppointmentStatus(id, "approved");
}

async function rejectAppointment(id) {
  await updateAppointmentStatus(id, "rejected");
}

async function updateAppointmentStatus(id, status) {
    // 1. Intercept the 'rejected' status to show the modal instead of a prompt
    if (status === 'rejected') {
        document.getElementById('rejectId').value = id; // Store ID in hidden input
        document.getElementById('rejectionModal').classList.remove('hidden'); // Show modal
        return; // STOP execution here; don't fetch yet!
    }

    // 2. Original logic for 'approved' or other statuses
    try {
        const res = await fetch(`${API_BASE}/admin/appointments/${id}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ status, rejectionReason: "" })
        });

        const result = await res.json();

        if (res.ok) {
            alert(`Appointment ${status}`);
            loadAppointments();
        }else{
          alert(`Error: ${result.message || "Failed to update appointment status."}`);
        }
    } catch (err) {
        console.error("Update Error:", err);
    }
}

// 3. Handle the Modal Form Submission
document.getElementById('rejectionForm').onsubmit = async function(e) {
    e.preventDefault();
    
    const id = document.getElementById('rejectId').value;
    const reason = document.getElementById('rejectionReasonInput').value;

    try {
        const res = await fetch(`${API_BASE}/admin/appointments/${id}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'rejected', rejectionReason: reason })
        });

        if (res.ok) {
            alert("Appointment Rejected");
            document.getElementById('rejectionModal').classList.add('hidden'); // Close modal
            document.getElementById('rejectionReasonInput').value = ""; // Clear input
            loadAppointments();
        }
    } catch (err) {
        console.error("Rejection Error:", err);
    }
};

document.getElementById('rejectionForm').onsubmit = async function(e) {
    e.preventDefault();
    
    const id = document.getElementById('rejectId').value;
    const reason = document.getElementById('rejectionReasonInput').value;

    try {
        const res = await fetch(`${API_BASE}/admin/appointments/${id}/status`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({ status: 'rejected', rejectionReason: reason })
        });

        if (res.ok) {
            alert("Appointment Rejected");
            document.getElementById('rejectionModal').classList.add('hidden'); // Close modal
            document.getElementById('rejectionReasonInput').value = ""; // Clear input
            loadAppointments();
        }
    } catch (err) {
        console.error("Rejection Error:", err);
    }
};



function populateList(elementId, items, field) {
  const ul = document.getElementById(elementId);
  ul.innerHTML = "";

  if (!items || items.length === 0) {
    ul.innerHTML = "<li>No records found</li>";
    return;
  }

  items.forEach(item => {
    const li = document.createElement("li");
    li.textContent = item[field] || "No details";
    ul.appendChild(li);
  });
}


// ===== HOME DASHBOARD =====
async function loadDashboard() {
  try {
    const res = await fetch(`${API_BASE}/admin/dashboard`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();

    // ====== STAT CARDS ======
    document.getElementById("totalMaterials").textContent = data.totalMaterials || 0;
    document.getElementById("availableMaterials").textContent = data.availableMaterials || 0;
    document.getElementById("borrowedToday").textContent = data.borrowedToday || 0;
    document.getElementById("brokenReports").textContent = data.brokenReports || 0;
    document.getElementById("pendingStudents").textContent = data.pendingStudents || 0;
    document.getElementById("lowStock").textContent = data.lowStock || 0;

    // ====== NOTIFICATIONS ======
    // Helper function to render these lists specifically
const renderNotifList = (elementId, data, fallbackField) => {
    const list = document.getElementById(elementId);
    if (!data || data.length === 0) {
        list.innerHTML = "<li>No recent updates</li>";
        return;
    }
    list.innerHTML = data.map(item => {
        // Use displayText if we built it in backend, otherwise use the specific field
        const text = item.displayText || item[fallbackField] || "Unknown Info";
        return `<li>${text}</li>`;
    }).join("");
};

renderNotifList("urgentNotifications", data.urgentNotifications, "violation");
renderNotifList("todayReminders", data.todayReminders, "purpose");
renderNotifList("pendingApprovals", data.pendingApprovals, "fullName");

    // ====== RECENT ACTIVITY ======
    const borrowedList = document.getElementById("recentBorrowedMaterials");
    borrowedList.innerHTML = data.recentBorrowed?.length
    ? data.recentBorrowed.map(b =>
      // ⭐ FIX: Use the 'studentName' field which contains the student's fullName
      `<li>${b.studentName || "Unknown Student"} borrowed **${b.materialName || "Unknown Material"}**</li>`
    ).join("")
    : "<li>No recent borrowed materials</li>";


    // 2. Recent Broken/Damage Reports (Using labID and item)
    const brokenReportsList = document.getElementById("recentBrokenReports");
    brokenReportsList.innerHTML = data.recentAccountability?.length
    ? data.recentAccountability.map(r =>
      // ⭐ CORRECTED: Use r.studentName instead of r.labID for user-friendly display
      `<li>**${r.studentName || r.labID}** reported **${r.item}** due to: ${r.violation}</li>`
    ).join("")
    : "<li>No recent damage reports</li>";


    // ====== MONTHLY OVERVIEW CHART ======
    const ctx = document.getElementById("overviewChart").getContext("2d");
    if (window.overviewChartInstance) window.overviewChartInstance.destroy(); // destroy old chart if exists

    const chartData = {
      labels: ["Borrowed", "Broken", "Pending Students", "Low Stock"],
      datasets: [{
        label: "Monthly Overview",
        data: [
          data.borrowedToday || 0,
          data.brokenReports || 0,
          data.pendingStudents || 0,
          data.lowStock || 0
        ],
        backgroundColor: ["#3F567F", "#E0563F", "#D17402", "#412653"]
      }]
    };

    window.overviewChartInstance = new Chart(ctx, {
      type: "bar",
      data: chartData,
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true } }
      }
    });

  } catch (err) {
    console.error("Dashboard load error:", err);
  }
}

// ====== STUDENT UTILITY FOR BREAKAGE REPORT ======

// Function to fetch all students and populate the labID dropdown
async function loadStudentDropdown() {
  const selectElement = document.getElementById("breakageLabID");
  
  // Clear the dropdown before populating (keeps the default option)
  selectElement.innerHTML = '<option value="">-- Select Student Lab ID --</option>';

  try {
    const response = await fetch(`${API_BASE}/admin/students/list`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch student list.");
    }

    const students = await response.json();

    students.forEach(student => {
      const option = document.createElement("option");
      option.value = student.labID;
      // Display both name and Lab ID for ease of search/selection
      option.textContent = `${student.fullName} (${student.labID})`;
      selectElement.appendChild(option);
    });

  } catch (error) {
    console.error("Error loading student dropdown:", error);
    alert("Failed to load student list for dropdown.");
  }
}

// ====== BREAKAGE ITEM LOADER (New Function) ======
async function loadBreakageItems(category) {
    const itemSelect = document.getElementById("breakageItemId");
    itemSelect.innerHTML = '<option value="">-- Select Item --</option>'; // Reset items

    if (!category) return;

    // Map category name to the correct API endpoint (as established in loadExperiments)
    let endpoint = category.toLowerCase();
    if (endpoint === "chemical") endpoint = "chemicals"; 
    
    try {
        const res = await fetch(`${API_BASE}/admin/${endpoint}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);

        const data = await res.json();
        const items = Array.isArray(data) ? data : data[endpoint] || [];
        
        items.forEach(item => {
            const option = document.createElement("option");
            option.value = item._id; 
            // Handle different inventory fields for displaying the name
            const realName = item.itemName || item.chemicalName || "Unknown Item";
            const specs = item.specification || item.description || item.containerSize || "";
            option.textContent = `${realName} (${specs || 'N/A'})`;           
            itemSelect.appendChild(option);
        });

        return itemSelect;
    } catch (err) {
        console.error("Failed to load breakage items:", err);
        alert("Failed to load items for the selected category.");
    }
}

// ===== BREAKAGE / ACCOUNTABILITY =====
// ====== ACCOUNTABILITY TAB SWITCHER ======
function switchAccountabilityTab(tab) {
    // Update tab button styles
    document.querySelectorAll(".tab-btn").forEach(btn => btn.classList.remove("active"));
    event.currentTarget.classList.add("active");

    // Show/hide panels
    document.getElementById("tab-broken").classList.toggle("hidden", tab !== "broken");
    document.getElementById("tab-resolved").classList.toggle("hidden", tab !== "resolved");
}

async function loadBreakages() {
    try {
        const res = await fetch(`${API_BASE}/admin/breakages`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        const brokenTbody  = document.querySelector("#breakageTable tbody");
        const resolvedTbody = document.querySelector("#resolvedTable tbody");
        brokenTbody.innerHTML  = "";
        resolvedTbody.innerHTML = "";

        data.forEach(b => {
            const tr = document.createElement("tr");
            const reportedDate = new Date(b.reportedAt);
            const dateString   = reportedDate.toISOString().split('T')[0];

            const isResolved = b.status === "resolved";

            // Actions differ per tab
            const actions = isResolved
                ? `
                    <button onclick="openEditBreakageModal('${b._id}','${b.labID}','${b.item}','${b.violation}','${b.remarks||""}','${b.quantityBroken||1}','${b.category||""}','${b.itemId||""}')">Edit</button>
                    <button onclick="unresolveBreakage('${b._id}')">Mark Unresolved</button>
                    <button onclick="deleteBreakage('${b._id}')">Delete</button>
                `
                : `
                    <button onclick="openEditBreakageModal('${b._id}','${b.labID}','${b.item}','${b.violation}','${b.remarks||""}','${b.quantityBroken||1}','${b.category||""}','${b.itemId||""}')">Edit</button>
                    <button onclick="resolveBreakage('${b._id}')">Resolve</button>
                    <button onclick="deleteBreakage('${b._id}')">Delete</button>
                `;

            tr.setAttribute('data-date', dateString);
            tr.innerHTML = `
                <td>${b.labID}</td>
                <td>${b.item}</td>
                <td>${b.quantityBroken || 1}</td>
                <td>${b.violation}</td>
                <td>${reportedDate.toLocaleDateString()}</td>
                <td>${b.remarks || ""}</td>
                <td>${b.status}</td>
                <td>${actions}</td>
            `;

            if (isResolved) {
                resolvedTbody.appendChild(tr);
            } else {
                brokenTbody.appendChild(tr);
            }
        });

        if (brokenTbody.innerHTML   === "") brokenTbody.innerHTML   = "<tr><td colspan='7' style='text-align:center; color:rgba(255,255,255,0.5);'>No broken reports.</td></tr>";
        if (resolvedTbody.innerHTML === "") resolvedTbody.innerHTML = "<tr><td colspan='7' style='text-align:center; color:rgba(255,255,255,0.5);'>No resolved reports.</td></tr>";

    } catch (err) {
        console.error(err);
    }
}

// ===== ADD / EDIT MODAL HANDLERS =====
function openEditBreakageModal(id, labID, item, violation, remarks, quantityBroken, category, itemId) {
  // 1. Set title and hidden fields
  document.getElementById("breakageModalTitle").textContent = "Edit Breakage Report";
  document.getElementById("breakageId").value = id;
  document.getElementById("breakageItemNameHidden").value = item;
  document.getElementById("breakageCategoryHidden").value = category || "";
  document.getElementById("breakageItemIdHidden").value = itemId || "";

  // 2. Set text/number fields immediately
  document.getElementById("breakageViolation").value = violation || "";
  document.getElementById("breakageRemarks").value = (remarks === "undefined" || remarks === undefined) ? "" : remarks;
  document.getElementById("breakageQuantity").value = quantityBroken || 1;

  // 3. Show modal immediately
  document.getElementById("breakageModal").classList.remove("hidden");

  // 4. Load student dropdown, then reliably select the saved Lab ID
  loadStudentDropdown().then(() => {
    const labIDSelect = document.getElementById("breakageLabID");

    // Check if the option already exists
    const existingOption = Array.from(labIDSelect.options).find(o => o.value === labID);

    if (existingOption) {
      labIDSelect.value = labID;
    } else {
      // labID not in the list (e.g. student was deleted) — insert a placeholder
      const placeholder = document.createElement("option");
      placeholder.value = labID;
      placeholder.textContent = labID + " (current)";
      placeholder.selected = true;
      labIDSelect.insertBefore(placeholder, labIDSelect.options[1]);
    }
  }).catch(console.error);

  // 5. Set category dropdown, load its items, then select the saved item
  if (category) {
    document.getElementById("breakageCategory").value = category;

    loadBreakageItems(category).then(() => {
      const itemSelect = document.getElementById("breakageItemId");
      const match = Array.from(itemSelect.options).find(o => o.value === itemId);
      if (match) {
        itemSelect.value = itemId;
      } else {
        const placeholder = document.createElement("option");
        placeholder.value = itemId;
        placeholder.textContent = item;
        placeholder.selected = true;
        itemSelect.insertBefore(placeholder, itemSelect.options[1]);
      }
    }).catch(console.error);
  } else {
    document.getElementById("breakageCategory").value = "";
    document.getElementById("breakageItemId").innerHTML = '<option value="">-- Select Item --</option>';
  }
    document.getElementById("breakageModal").classList.remove("hidden");
}


// ===== SAVE BREAKAGE =====
// ===== SAVE BREAKAGE (FINAL UNIFIED LOGIC) =====
// Helper to show error inside breakage modal
function showBreakageError(msg) {
    let errDiv = document.getElementById("breakageError");
    if (!errDiv) {
        errDiv = document.createElement("div");
        errDiv.id = "breakageError";
        errDiv.style.cssText = "margin: 10px 0 0; padding: 10px 14px; border-radius: 8px; font-size: 0.9rem; background: rgba(255,107,107,0.12); border: 1px solid rgba(255,107,107,0.4); color: #ff6b6b;";
        document.querySelector("#breakageForm .modal-actions").before(errDiv);
    }
    errDiv.style.display = "block";
    errDiv.innerText = msg;
}

function closeBreakageModal() {
    document.getElementById("breakageModal").classList.add("hidden");
    const errDiv = document.getElementById("breakageError");
    if (errDiv) { errDiv.style.display = "none"; errDiv.innerText = ""; }
}

document.getElementById("breakageForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("breakageId").value;
    const violation = document.getElementById("breakageViolation").value;
    const remarks = document.getElementById("breakageRemarks").value;

    const method = id ? "PUT" : "POST";
    const url = id ? `${API_BASE}/admin/breakages/${id}` : `${API_BASE}/admin/breakages`;

    let bodyData = {};

    if (id) {
        const item = document.getElementById("breakageItemNameHidden").value;
        if (!item || !violation) {
            showBreakageError("Violation field is required.");
            return;
        }
        bodyData = {
            item,
            violation,
            remarks,
            quantityBroken: parseInt(document.getElementById("breakageQuantity").value),
            category: document.getElementById("breakageCategoryHidden").value,
            itemId: document.getElementById("breakageItemIdHidden").value
        };
    } else {
        const labID = document.getElementById("breakageLabID").value;
        const category = document.getElementById("breakageCategory").value;
        const itemId = document.getElementById("breakageItemId").value;
        const quantityBroken = parseInt(document.getElementById("breakageQuantity").value);

        if (!labID || !category || !itemId || isNaN(quantityBroken) || quantityBroken <= 0 || !violation) {
            showBreakageError("Please fill all required fields.");
            return;
        }
        bodyData = { labID, category, itemId, quantityBroken, violation, remarks };
    }

    const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(bodyData)
    });

    if (res.ok) {
        alert(id ? "Report updated!" : "Report added!");
        closeBreakageModal();
        loadBreakages();
        if (!id) loadInventory();
    } else {
        const result = await res.json();
        showBreakageError(result.message || "Error saving report.");
    }
});

// ===== DELETE =====
async function deleteBreakage(id) {
  if (!confirm("Are you sure you want to delete this report?")) return;

  const res = await fetch(`${API_BASE}/admin/breakages/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.ok) {
    alert("Report deleted!");
    loadBreakages();
  } else {
    alert("Error deleting report");
  }
}

// ===== RESOLVE =====
async function resolveBreakage(id) {
  const res = await fetch(`${API_BASE}/admin/breakages/${id}/resolve`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.ok) {
    alert("Report marked as resolved!");
    loadBreakages();
  } else {
    alert("Error resolving report");
  }
}

async function unresolveBreakage(id) {
    if (!confirm("Mark this report as unresolved?")) return;

    const res = await fetch(`${API_BASE}/admin/breakages/${id}/unresolve`, {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
        alert("Report marked as unresolved!");
        loadBreakages();
    } else {
        alert("Error updating report.");
    }
}


// ====== APPOINTMENTS ======
async function loadAppointments() {
    const studentTbody = document.querySelector("#appointmentsTable2 tbody");
    const guestTbody = document.querySelector("#guestRequestsTable tbody");
    
    if (!studentTbody || !guestTbody) {
        console.error("Table bodies not found! Check your HTML IDs.");
        return;
    }
    
    studentTbody.innerHTML = "<tr><td colspan='7'>Loading...</td></tr>";
    guestTbody.innerHTML = "<tr><td colspan='7'>Loading...</td></tr>";

    try {
        const res = await fetch(`${API_BASE}/admin/appointments`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();

        studentTbody.innerHTML = "";
        guestTbody.innerHTML = "";

        const appointments = data.appointments || [];

        appointments.forEach(app => {
            const tr = document.createElement("tr");

            // --- 1. PARSE ITEMS REQUESTED ---
            // This handles the JSON string sent by the new Guest Dashboard form
            let displayItems = app.itemsRequested || app.materials || "N/A";

            if (displayItems.startsWith('[')) {
                try {
                    const parsedItems = JSON.parse(displayItems);
                    displayItems = parsedItems.map(info => 
                        `${info.qty}x ${info.item} ${info.specs ? `(${info.specs})` : ""}`
                    ).join(", ");
                } catch (e) {
                    console.error("Error parsing itemsRequested JSON", e);
                }
            }

            // --- 2. DYNAMIC BUTTON LOGIC (Multi-Stage Workflow) ---
            let actionButtons = "";
            if (app.status === "pending") {
                actionButtons = `
                    <button class="btn-approve" onclick="updateAppointmentStatus('${app._id}', 'approved')">Approve</button>
                    <button class="btn-reject" onclick="updateAppointmentStatus('${app._id}', 'rejected')">Reject</button>
                `;
            } else if (app.status === "approved") {
                actionButtons = `
                    <button class="btn-accept" onclick="updateAppointmentStatus('${app._id}', 'accepted')">Accept Entry</button>
                `;
            } else if (app.status === "accepted") {
                actionButtons = `
                    <button class="btn-return" onclick="updateAppointmentStatus('${app._id}', 'returned')">Mark Returned</button>
                `;
            } else {
                actionButtons = `<span class="text-muted">Completed</span>`;
            }

            // --- 3. RENDER TABLE ROWS ---
            if (app.guestId) {
                // GUEST TABLE
                const guestName = app.guestId.fullName || "Guest User";
                const dateObj = new Date(app.date);
                const formattedDateTime = isNaN(dateObj) 
                    ? "N/A" 
                    : dateObj.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
                
                tr.innerHTML = `
                    <td><b>${guestName}</b></td>
                    <td>${app.purpose || "N/A"}</td>
                    <td>${displayItems}</td> 
                    <td>${formattedDateTime}</td> 
                    <td class="status-${app.status}">${app.status}</td>
                    <td>${actionButtons}</td>
                `;
                guestTbody.appendChild(tr);
            } else {
                // STUDENT / MANUAL TABLE
                const manualDate = new Date(app.date).toLocaleString([], { 
                    dateStyle: 'medium', 
                    timeStyle: 'short' 
                });

                tr.innerHTML = `
                    <td>${app.studentName || "N/A"}</td>
                    <td>${app.cys || "N/A"}</td>
                    <td>${app.purpose || "N/A"}</td>
                    <td>${displayItems}</td> 
                    <td>${manualDate}</td> 
                    <td class="status-${app.status}">${app.status}</td>
                    <td>${actionButtons}</td>
                `;
                studentTbody.appendChild(tr);
            }
        });

        if (studentTbody.innerHTML === "") studentTbody.innerHTML = "<tr><td colspan='7'>No student appointments.</td></tr>";
        if (guestTbody.innerHTML === "") guestTbody.innerHTML = "<tr><td colspan='7'>No guest requests.</td></tr>";

    } catch (err) {
        console.error("Fetch Error:", err);
        studentTbody.innerHTML = "<tr><td colspan='7' style='color:red;'>Error connecting to server.</td></tr>";
    }
}

function openAddBreakageModal() {
    // Reset the form title and all fields
    document.getElementById("breakageModalTitle").textContent = "Add Breakage Report";
    document.getElementById("breakageId").value = "";
    document.getElementById("breakageItemNameHidden").value = "";
    document.getElementById("breakageCategoryHidden").value = "";
    document.getElementById("breakageItemIdHidden").value = "";
    document.getElementById("breakageViolation").value = "";
    document.getElementById("breakageRemarks").value = "";
    document.getElementById("breakageQuantity").value = 1;
    document.getElementById("breakageCategory").value = "";
    document.getElementById("breakageItemId").innerHTML = '<option value="">-- Select Item --</option>';

    // Show the student dropdown and category fields (hidden during edit mode)
    document.getElementById("breakageLabID").closest("label")?.parentElement;

    // Load the student dropdown fresh
    loadStudentDropdown();

    // Show modal
    document.getElementById("breakageModal").classList.remove("hidden");
}


// ===== MODAL FOR APPOINTMENTS =====
function openAppointmentModal() {
  document.getElementById("appointmentModal").classList.remove("hidden");
}

// Add this near the top of admin_dashboard.js
let adminItemsArray = []; 

function removeAdminItem(index) {
    adminItemsArray.splice(index, 1);
    updateAdminItemListUI();
}

function updateAdminItemListUI() {
    const list = document.getElementById("adminSelectedItemsList");
    const hiddenInput = document.getElementById("appItemsRequestedJSON");
    
    if (adminItemsArray.length === 0) {
        list.innerHTML = '<li style="padding: 5px; color: #888;">No items added yet.</li>';
        hiddenInput.value = "";
        return;
    }

    list.innerHTML = adminItemsArray.map((i, index) => `
        <li style="padding: 5px; border-bottom: 1px solid #eee; display: flex; justify-content: space-between; align-items: center;">
            <span>${i.qty}x ${i.item} (${i.specs})</span>
            <button type="button" onclick="removeAdminItem(${index})" style="color:red; background:none; border:none; cursor:pointer; font-weight:bold;">✕</button>
        </li>
    `).join("");

    hiddenInput.value = JSON.stringify(adminItemsArray);
}

function showAppointmentError(msg) {
    let errDiv = document.getElementById("appointmentError");
    if (!errDiv) {
        errDiv = document.createElement("div");
        errDiv.id = "appointmentError";
        errDiv.style.cssText = "margin: 10px 0 0; padding: 10px 14px; border-radius: 8px; font-size: 0.9rem; background: rgba(255,107,107,0.12); border: 1px solid rgba(255,107,107,0.4); color: #ff6b6b;";
        document.querySelector("#addAppointmentForm .modal-actions").before(errDiv);
    }
    errDiv.style.display = "block";
    errDiv.innerText = msg;
}

function closeAppointmentModal() {
    document.getElementById("appointmentModal").classList.add("hidden");
    const errDiv = document.getElementById("appointmentError");
    if (errDiv) { errDiv.style.display = "none"; errDiv.innerText = ""; }
}

document.addEventListener("DOMContentLoaded", () => {
    // --- 1. PREVENT PAST DATES IN UI ---
    const dateInput = document.getElementById("appDate");
    if (dateInput) {
        // Sets the minimum selectable date to today
        const todayStr = new Date().toISOString().split("T")[0];
        dateInput.setAttribute("min", todayStr);
    }

    // --- 2. CATEGORY DROPDOWN LISTENER ---
    // Fetches items from inventory when Equipment, Glassware, or Chemical is selected
    document.getElementById("adminCategorySelect")?.addEventListener("change", async (e) => {
        const category = e.target.value;
        const itemSelect = document.getElementById("adminItemSelect");
        itemSelect.innerHTML = '<option value="">Loading...</option>';
        if (!category) return;

        try {
            const res = await fetch(`${API_BASE}/inventory/search?category=${category}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const items = await res.json();
            
            itemSelect.innerHTML = '<option value="">-- Select Item --</option>';
            items.forEach(item => {
                const name = item.itemName || item.chemicalName;
                const specs = item.specification || item.description || item.casNumber || item.containerSize || "";
                const option = document.createElement("option");
                
                // Store item details as a JSON string in the option value
                option.value = JSON.stringify({ item: name, specs: specs });
                option.textContent = `${name} (${specs}) - Stock: ${item.remainingQuantity}`;
                itemSelect.appendChild(option);
            });
        } catch (err) { 
            console.error("Search error:", err); 
            itemSelect.innerHTML = '<option value="">Error loading items</option>';
        }
    });

    // --- 3. ADD ITEM BUTTON LISTENER ---
    // Adds the selected item to the local array and updates the visible list
    document.getElementById("adminAddItemBtn")?.addEventListener("click", () => {
        const itemSelect = document.getElementById("adminItemSelect");
        const qtyInput = document.getElementById("adminItemQty");
        
        if (!itemSelect.value || !qtyInput.value || qtyInput.value <= 0) {
            showAppointmentError("Please select a valid item and quantity.");
            return;
        }

        const details = JSON.parse(itemSelect.value);
        
        // Push to global adminItemsArray
        adminItemsArray.push({
            item: details.item,
            specs: details.specs,
            qty: parseInt(qtyInput.value)
        });

        updateAdminItemListUI();

        const errDiv = document.getElementById("appointmentError");
        if (errDiv) { errDiv.style.display = "none"; errDiv.innerText = ""; }

        
        // Reset qty for next item
        qtyInput.value = 1;
    });

    // --- 4. FORM SUBMISSION WITH VALIDATIONS ---
    const appForm = document.getElementById("addAppointmentForm");
    if (appForm) {
        appForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const dateValue = document.getElementById("appDate").value;
            if (!dateValue) return alert("Please select a date and time.");

            const selectedDate = new Date(dateValue);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            // --- VALIDATION: NO SUNDAYS ---
            // getDay() returns 0 for Sunday
            if (selectedDate.getDay() === 0) {
                showAppointmentError("Appointments are not allowed on Sundays. Please select Monday - Saturday.");
                return;
            }

            // --- VALIDATION: 7:00 AM TO 6:00 PM PHILIPPINE TIME ---
            const hours = selectedDate.getHours();
            const minutes = selectedDate.getMinutes();

            // Check if before 7:00 AM or after 6:00 PM (18:00)
            if (hours < 7 || (hours === 18 && minutes > 0) || hours > 18) {
                showAppointmentError("Please schedule appointments between 7:00 AM and 6:00 PM.");
                return;
            }

            // --- VALIDATION: NO PAST DATES ---
            if (selectedDate < today) {
                showAppointmentError("You cannot select a date in the past.");
                return;
            }

            // --- VALIDATION: MUST HAVE ITEMS ---
            if (adminItemsArray.length === 0) {
                showAppointmentError("Please add at least one material to the list.");
                return;
            }

            // Prepare Data
            const payload = {
                studentName: document.getElementById("appStudentName").value,
                cys: document.getElementById("appCYS").value,
                purpose: document.getElementById("appPurpose").value,
                itemsRequested: document.getElementById("appItemsRequestedJSON").value, 
                date: dateValue, 
                status: document.getElementById("appStatus").value
            };

            // Send to Server
            try {
                const res = await fetch(`${API_BASE}/admin/appointments`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${token}`
                    },
                    body: JSON.stringify(payload)
                });

                if (res.ok) {
                    alert("Appointment added successfully. Inventory updated.");
                    
                    // Reset everything
                    adminItemsArray = [];
                    updateAdminItemListUI();
                    appForm.reset();
                    closeAppointmentModal();
                    
                    // Refresh the tables
                    if (typeof loadAppointments === "function") {
                        loadAppointments();
                    }
                } else {
                    const result = await res.json();
                    showAppointmentError(result.message || "Failed to save appointment");
                }
            } catch (err) {
                console.error("Submission error:", err);
                showAppointmentError("Connection error. Please try again.");
            }
        });
    }
});



// ===== MATERIALS RENDER HELPER =====
function renderMaterialsTwoColumn(materials) {
  if (!materials || materials.length === 0) return "<i>No materials yet</i>";

  const half = Math.ceil(materials.length / 2);
  const left = materials.slice(0, half);
  const right = materials.slice(half);

  const buildTable = arr => {
    return `
      <table class="mat-table">
        <thead>
          <tr>
            <th>Qty</th>
            <th>Specs</th>
            <th>Item</th>
          </tr>
        </thead>
        <tbody>
          ${arr.map(m => `
            <tr>
              <td class="mat-qty">${m.qty ?? 1}</td>
              <td class="mat-specs">${m.specs || "N/A"}</td>
              <td class="mat-item">${m.item}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    `;
  };

  return `
    <div class="mat-grid">
      <div class="mat-col">${buildTable(left)}</div>
      <div class="mat-col">${buildTable(right)}</div>
    </div>
  `;
}


// ====== EXPERIMENTS ======
async function loadExperiments() {
  const res = await fetch(`${API_BASE}/admin/experiments`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const tbody = document.querySelector("#experimentsTable tbody");
  tbody.innerHTML = "";

  data.experiments.forEach(exp => {
    const materialsHtml = renderMaterialsTwoColumn(exp.materials);

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${exp.name}</td>
      <td>${exp.course}</td>
      <td>${exp.description}</td>
      <td>${materialsHtml}</td>
      <td>
        <button onclick="showMaterialForm('${exp._id}')">+ Material</button>
        <button onclick="deleteExperiment('${exp._id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// ===== MODAL FOR ADDING EXPERIMENT =====
function openExperimentModal() {
  document.getElementById("experimentModal").classList.remove("hidden");
}

function closeExperimentModal() {
  document.getElementById("experimentModal").classList.add("hidden");
  const errDiv = document.getElementById("experimentError");
  if (errDiv) { errDiv.style.display = "none"; errDiv.innerText = ""; }
}

document.addEventListener("DOMContentLoaded", () => {
  const expForm = document.getElementById("addExperimentForm");
  if (expForm) {
    expForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = document.getElementById("expName").value;
      const course = document.getElementById("expCourse").value;
      const description = document.getElementById("expDesc").value;

      const res = await fetch(`${API_BASE}/admin/experiments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ name, course, description })
      });

      if (res.ok) {
        closeExperimentModal();
        expForm.reset();
        loadExperiments();
      } else {
        const result = await res.json();
        let errDiv = document.getElementById("experimentError");
        if (!errDiv) {
            errDiv = document.createElement("div");
            errDiv.id = "experimentError";
            errDiv.style.cssText = "margin: 10px 0 0; padding: 10px 14px; border-radius: 8px; font-size: 0.9rem; background: rgba(255,107,107,0.12); border: 1px solid rgba(255,107,107,0.4); color: #ff6b6b;";
            document.querySelector("#addExperimentForm .modal-actions").before(errDiv);
        }
        errDiv.style.display = "block";
        errDiv.innerText = result.message || "Failed to save experiment.";
    }
    });
  }
});


async function deleteExperiment(id) {
  if (!confirm("Delete this experiment?")) return;

  const res = await fetch(`${API_BASE}/admin/experiments/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  if (res.ok) {
    alert("Experiment deleted.");
    loadExperiments();
  } else {
    const result = await res.json();
    alert("Error: " + result.message);
  }
}

function showMaterialForm(expId) {
  document.getElementById("materialForm").classList.remove("hidden");
  document.getElementById("expIdHidden").value = expId;
}

// handle material form submit
async function loadItemsByCategory(category) {
  const matItem = document.getElementById("matItem");
  matItem.innerHTML = "<option value=''>Select Item</option>";
  if (!category) return;

  // 🔧 FIX: Map singular category names to the correct server endpoints
  let endpoint = category.toLowerCase();
  if (endpoint === "chemical") endpoint = "chemicals"; // Force plural for this route
  
  try {
    // Use the 'endpoint' variable instead of category directly
    const res = await fetch(`${API_BASE}/admin/${endpoint}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error(`Failed to fetch ${endpoint}`);

    const data = await res.json();

    // Handle data whether it comes as an array or object property
    const items = Array.isArray(data) ? data : data[category] || data[endpoint] || [];
    
    items.forEach(item => {
      const option = document.createElement("option");
      option.value = item._id; 
      
      const realName = item.itemName || item.chemicalName || "Unknown";
      
      option.textContent = `${realName} (${item.specification || item.description || item.containerSize || "N/A"})`;
      
      option.dataset.specs = item.specification || item.description || item.containerSize || "";
      option.dataset.name = realName; 
      
      matItem.appendChild(option);
    });

    matItem.addEventListener("change", () => {
      const selectedOption = matItem.options[matItem.selectedIndex];
      document.getElementById("matSpecs").value = selectedOption.dataset.specs || "";
    });
  } catch (err) {
    console.error("Failed to load items:", err);
  }
}

// ✅ Handle form submission
document.getElementById("addMaterialForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const expId = document.getElementById("expIdHidden").value;
  const category = document.getElementById("matCategory").value;
  const itemSelect = document.getElementById("matItem");
  // Get the selected option element
  const selectedOption = itemSelect.options[itemSelect.selectedIndex];
  const itemId = itemSelect.value;
  // FIX: Use the data-name attribute we just added, NOT the visible text
  const itemName = selectedOption.dataset.name; 
  const specs = document.getElementById("matSpecs").value;

  const showMaterialError = (msg) => {
        let errDiv = document.getElementById("materialError");
        if (!errDiv) {
            errDiv = document.createElement("div");
            errDiv.id = "materialError";
            errDiv.style.cssText = "margin: 10px 0 0; padding: 10px 14px; border-radius: 8px; font-size: 0.9rem; background: rgba(255,107,107,0.12); border: 1px solid rgba(255,107,107,0.4); color: #ff6b6b;";
            document.querySelector("#addMaterialForm .modal-actions").before(errDiv);
        }
        errDiv.style.display = "block";
        errDiv.innerText = msg;
    };

  if (!expId || !category || !itemId) {
    showMaterialError("Please fill all fields!");
    return;
  }

  const newMaterial = { category, itemId, item: itemName, specs };

  try {
    const res = await fetch(`${API_BASE}/admin/experiments/${expId}/materials`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify(newMaterial)
    });

    const result = await res.json();
    if (!res.ok) {
      showMaterialError(result.message || "Error adding material");
      return;
    }

    alert("✅ Material added successfully!");
    const errDiv = document.getElementById("materialError");
        if (errDiv) { errDiv.style.display = "none"; errDiv.innerText = ""; }
        document.getElementById("materialForm").classList.add("hidden");
        loadExperiments();
    } catch (err) {
    console.error("Error adding material:", err);
    showMaterialError("Failed to add material");
  }
});



// ====== ADMINS ======
async function loadAdmins() {
  const res = await fetch(`${API_BASE}/admin/admins`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  const tbody = document.querySelector("#adminsTable tbody");
  tbody.innerHTML = "";
  data.admins.forEach(admin => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${admin.name}</td>
      <td>${admin.email}</td>
      <td>${admin.role}</td>
      <td>
        <button onclick="editAdmin('${admin._id}', '${admin.name}', '${admin.email}', '${admin.role}')">Edit</button>
        <button onclick="deleteAdmin('${admin._id}')">Delete</button>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

async function addAdmin() {
  // 1. Grab values from the modal inputs
  const name = document.getElementById("newAdminName").value;
  const email = document.getElementById("newAdminEmail").value;
  const role = document.getElementById("newAdminRole").value;
  const password = document.getElementById("newAdminPassword").value;

  const showAddAdminError = (msg) => {
        let errDiv = document.getElementById("addAdminError");
        if (!errDiv) {
            errDiv = document.createElement("div");
            errDiv.id = "addAdminError";
            errDiv.style.cssText = "margin: 10px 0 0; padding: 10px 14px; border-radius: 8px; font-size: 0.9rem; background: rgba(255,107,107,0.12); border: 1px solid rgba(255,107,107,0.4); color: #ff6b6b;";
            document.querySelector("#adminModal .modal-actions").before(errDiv);
        }
        errDiv.style.display = "block";
        errDiv.innerText = msg;
    };

  // 2. Simple validation
  if (!name || !email || !role || !password) {
    showAddAdminError("Please fill in all fields.");
    return;
  }

  // 3. Send to API
  const res = await fetch(`${API_BASE}/admin/admins`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ name, email, role, password })
  });

  const result = await res.json();

  if (res.ok) {
    alert("Admin added successfully!");
    
    // 4. Reset form and hide modal
    document.getElementById("newAdminName").value = "";
    document.getElementById("newAdminEmail").value = "";
    document.getElementById("newAdminPassword").value = "";
    const errDiv = document.getElementById("addAdminError");
        if (errDiv) { errDiv.style.display = "none"; errDiv.innerText = ""; }
    document.getElementById('adminModal').classList.add('hidden');
    loadAdmins(); // refresh table
  } else {
    showAddAdminError(result.message || "Failed to add admin.");
  }
}

// Function to open the modal and fill it with current data
async function editAdmin(id, currentName, currentEmail, currentRole) {
    document.getElementById("editAdminId").value = id;
    document.getElementById("editAdminName").value = currentName;
    document.getElementById("editAdminEmail").value = currentEmail;
    document.getElementById("editAdminRole").value = currentRole;
    document.getElementById("editAdminPassword").value = ""; // Clear password field
    
    document.getElementById("adminEditModal").style.display = "flex";
}

function closeAdminModal() {
    document.getElementById("adminEditModal").style.display = "none";
    const errDiv = document.getElementById("editAdminError");
    if (errDiv) { errDiv.style.display = "none"; errDiv.innerText = ""; }
}

// Handle Form Submission
document.getElementById("adminEditForm").onsubmit = async (e) => {
    e.preventDefault();

    const id = document.getElementById("editAdminId").value;
    const name = document.getElementById("editAdminName").value;
    const email = document.getElementById("editAdminEmail").value;
    const role = document.getElementById("editAdminRole").value;
    const password = document.getElementById("editAdminPassword").value;

    const body = { name, email, role };
    if (password) body.password = password;

    const res = await fetch(`${API_BASE}/admin/admins/${id}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(body)
    });

    const result = await res.json();
    if (res.ok) {
        alert("Admin updated successfully!");
        closeAdminModal();
        loadAdmins(); // Refresh the table
    } else {
        let errDiv = document.getElementById("editAdminError");
        if (!errDiv) {
            errDiv = document.createElement("div");
            errDiv.id = "editAdminError";
            errDiv.style.cssText = "margin: 10px 0 0; padding: 10px 14px; border-radius: 8px; font-size: 0.9rem; background: rgba(255,107,107,0.12); border: 1px solid rgba(255,107,107,0.4); color: #ff6b6b;";
            document.querySelector("#adminEditForm .modal-actions").before(errDiv);
        }
        errDiv.style.display = "block";
        errDiv.innerText = result.message || "Failed to update admin.";
    }
};

// Helper for the password eye in the modal
function toggleEditAdminPassword() {
    const passInput = document.getElementById("editAdminPassword");
    const type = passInput.getAttribute("type") === "password" ? "text" : "password";
    passInput.setAttribute("type", type);
}


async function deleteAdmin(id) {
  if (!confirm("Delete this admin?")) return;
  const res = await fetch(`${API_BASE}/admin/admins/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` }
  });

  const result = await res.json();
  if (res.ok) {
    alert("Admin deleted.");
    loadAdmins();
  } else {
    alert(`Error: ${result.message || "Failed to delete admin."}`);
  }
}

// ===== DEFAULT LOCALSTORAGE FALLBACK (no hardcoded data, initializes only if empty) =====
if (!localStorage.getItem('labItems')) {
  const emptyLabItems = {
    equipments: [],
    materials: [],
    chemicals: [],
    furniture: []
  };
  localStorage.setItem('labItems', JSON.stringify(emptyLabItems));
}


// ===== INIT PAGE =====
document.addEventListener("DOMContentLoaded", () => {
  loadDashboard(); // Load stats + recent activity on first load
  loadInventory();
  showPage("home"); // Default page
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("addItemForm").addEventListener("keydown", function(e) {
    if (e.key === "Enter") {
      const active = document.activeElement;
      if (active && active.type !== "submit" && active.tagName !== "BUTTON") {
        e.preventDefault();
      }
    }
  });
});
// DITO LAGAY EXPORT CODE

// Function to bind data to the specific export button
function setupExportButton(buttonId, data, filename) {
  const btn = document.getElementById(buttonId);
  if (btn) {
    // Overwrite previous click events to ensure we use the latest fetched data
    btn.onclick = () => downloadCSV(data, filename);
  }
}

// Function to convert JSON to CSV and trigger download
function downloadCSV(data, filename) {
  if (!data || data.length === 0) {
    alert("No data available to export.");
    return;
  }

  // Define headers (removes MongoDB internal fields like _id and __v)
  const keys = Object.keys(data[0]).filter(key => key !== '_id' && key !== '__v');
  const headers = keys.join(",");

  const rows = data.map(item => {
    return keys.map(key => {
      let value = item[key] ?? "";
      // Clean value: remove newlines and escape quotes
      let str = String(value).replace(/\n/g, ' ').replace(/"/g, '""');
      return `"${str}"`; // Wrap in quotes to handle internal commas
    }).join(",");
  });

  const csvContent = [headers, ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function setupFullExportButton(equipment, chemicals, glassware, fixedAssets) {
  const btn = document.getElementById("exportFullInventory");
  if (!btn) return;

  btn.onclick = () => {
    // Add a 'category' field to every item so the full list is organized
    if ([equipment, chemicals, glassware, fixedAssets].every(arr => arr.length === 0)) {
      alert("No data available to export");
      return;
    }

    exportFullInventoryToExcel(equipment, chemicals, glassware, fixedAssets);
  };
}

// Updated downloadCSV to handle mixed-key objects (important for full export)
function downloadCSV(data, filename) {
  if (!data || data.length === 0) {
    alert("No data to export");
    return;
  }

  // Identify all unique keys across all items (since different categories have different fields)
  const allKeys = [...new Set(data.flatMap(obj => Object.keys(obj)))]
    .filter(key => key !== '_id' && key !== '__v');

  const headers = allKeys.join(",");

  const rows = data.map(item => {
    return allKeys.map(key => {
      let value = item[key] ?? "";
      let str = String(value).replace(/\n/g, ' ').replace(/"/g, '""');
      return `"${str}"`;
    }).join(",");
  });

  const csvContent = [headers, ...rows].join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  
  link.setAttribute("href", url);
  link.setAttribute("download", `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function exportFullInventoryToExcel(equipment, chemicals, glassware, fixedAssets) {
  // 1. Create a new workbook
  const wb = XLSX.utils.book_new();

  // 2. Helper function to clean data (removes MongoDB fields like _id and __v)
  const cleanData = (data) => {
    return data.map(item => {
      const { _id, __v, ...rest } = item;
      return rest;
    });
  };

  // 3. Convert each array to a worksheet
  const wsEquipment = XLSX.utils.json_to_sheet(cleanData(equipment));
  const wsChemicals = XLSX.utils.json_to_sheet(cleanData(chemicals));
  const wsGlassware = XLSX.utils.json_to_sheet(cleanData(glassware));
  const wsFixedAssets = XLSX.utils.json_to_sheet(cleanData(fixedAssets));

  // 4. Append worksheets to the workbook with specific tab names
  XLSX.utils.book_append_sheet(wb, wsEquipment, "Equipment");
  XLSX.utils.book_append_sheet(wb, wsChemicals, "Chemicals");
  XLSX.utils.book_append_sheet(wb, wsGlassware, "Glassware");
  XLSX.utils.book_append_sheet(wb, wsFixedAssets, "Fixed Assets");

  // 5. Generate Excel file and trigger download
  const date = new Date().toISOString().split('T')[0];
  XLSX.writeFile(wb, `Full_Inventory_Report_${date}.xlsx`);
}

/**
 * Sorts the Borrowed Materials table based on the 'Date Borrowed' column.
 */
function sortBorrowedTable() {
  const table = document.getElementById("borrowedTable");
  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const sortValue = document.getElementById("borrowedSort").value;

  // If there are no rows to sort, exit early
  if (rows.length === 0) return;

  rows.sort((a, b) => {
    // Assuming 'Date Borrowed' is the 3rd column (index 2)
    const dateA = new Date(a.cells[2].textContent.trim());
    const dateB = new Date(b.cells[2].textContent.trim());

    if (sortValue === "newest") {
      return dateB - dateA; // Descending: Most recent first
    } else {
      return dateA - dateB; // Ascending: Oldest first
    }
  });

  // Clear current table content and append sorted rows
  tbody.innerHTML = "";
  rows.forEach(row => tbody.appendChild(row));
}

/**
 * Universal sort function for Accountability, Appointments, and Student Accounts.
 * @param {string} category - The section being sorted ('accountability', 'appointments', or 'students')
 */
function sortData(category) {
  let tableId, selectId, dateColumnIndex;

  // Map categories to their specific HTML IDs and table structures
  if (category === 'accountability') {
    tableId = "breakageTable";
    selectId = "accountabilitySort";
    dateColumnIndex = 4; // 'Date Reported' is the 4th column
  } else if (category === 'appointments') {
    tableId = "appointmentsTable2"; // The student appointments table
    selectId = "appointmentsSort";
    dateColumnIndex = 4; // 'Date & Time' is the 5th column
  } else if (category === 'students') {
    tableId = "studentsTable";
    selectId = "studentAccountsSort";
    // Student table doesn't have a date by default in your snippet, 
    // but this ensures the function doesn't crash if you add one.
    dateColumnIndex = 0; 
  }

  const table = document.getElementById(tableId);
  if (!table) return;

  const tbody = table.querySelector("tbody");
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const sortValue = document.getElementById(selectId).value;

  if (rows.length === 0) return;

  rows.sort((a, b) => {
    const dateA = new Date(a.cells[dateColumnIndex].textContent.trim());
    const dateB = new Date(b.cells[dateColumnIndex].textContent.trim());

    // Check for invalid dates to prevent errors
    if (isNaN(dateA)) return 1;
    if (isNaN(dateB)) return -1;

    return sortValue === "newest" ? dateB - dateA : dateA - dateB;
  });

  // Re-append the sorted rows
  tbody.innerHTML = "";
  rows.forEach(row => tbody.appendChild(row));
}

/**
 * Toggles visibility for the "Add New Admin" password field
 */
function toggleAddAdminPassword() {
    const passwordInput = document.getElementById('newAdminPassword');
    const eyeIcon = document.getElementById('toggleAddAdminPass');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        eyeIcon.classList.remove('fa-eye');
        eyeIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        eyeIcon.classList.remove('fa-eye-slash');
        eyeIcon.classList.add('fa-eye');
    }
}



// ====== STUDENT TAB SWITCHER ======
function switchStudentTab(tab, event) {
    document.querySelectorAll("#students .tab-btn").forEach(btn => btn.classList.remove("active"));
    if (event) event.currentTarget.classList.add("active");

    document.getElementById("tab-pending-students").classList.toggle("hidden", tab !== "pending");
    document.getElementById("tab-rejected-students").classList.toggle("hidden", tab !== "rejected");
}

// ====== EDIT REJECTED STUDENT MODAL ======
function openEditStudentModal(id, fullName, email, cys, professor, classSchedule, status) {
    document.getElementById("editStudentModalId").value   = id;
    document.getElementById("editStudentFullName").value  = fullName;
    document.getElementById("editStudentEmail").value     = email;
    document.getElementById("editStudentCYS").value       = cys;
    document.getElementById("editStudentProfessor").value = professor;
    document.getElementById("editStudentSchedule").value  = classSchedule;
    document.getElementById("editStudentStatus").value    = status; // "blocked"
    document.getElementById("editStudentModal").classList.remove("hidden");
}

function closeEditStudentModal() {
    document.getElementById("editStudentModal").classList.add("hidden");
    const errDiv = document.getElementById("editStudentError");
    if (errDiv) { errDiv.style.display = "none"; errDiv.innerText = ""; }
    const emailErr = document.getElementById("editStudentEmailError");
    if (emailErr) { emailErr.style.display = "none"; emailErr.innerText = ""; }
}

document.addEventListener("DOMContentLoaded", () => {
    const editStudentForm = document.getElementById("editStudentForm");
    if (editStudentForm) {
        editStudentForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const id            = document.getElementById("editStudentModalId").value;
            const fullName      = document.getElementById("editStudentFullName").value;
            const email         = document.getElementById("editStudentEmail").value;
            const cys           = document.getElementById("editStudentCYS").value;
            const professor     = document.getElementById("editStudentProfessor").value;
            const classSchedule = document.getElementById("editStudentSchedule").value;
            const status        = document.getElementById("editStudentStatus").value;

            // Clear previous errors before every submission attempt
            const emailErr = document.getElementById("editStudentEmailError");
            if (emailErr) { emailErr.style.display = "none"; emailErr.innerText = ""; }
            const errDiv = document.getElementById("editStudentError");
            if (errDiv) { errDiv.style.display = "none"; errDiv.innerText = ""; }

            try {
                const res = await fetch(`${API_BASE}/admin/students/${id}`, {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({ fullName, email, cys, professor, classSchedule, status })
                });

                const result = await res.json();

                if (res.ok) {
                    alert("Student updated successfully!");
                    closeEditStudentModal();
                    loadPendingStudents();
                } else if (res.status === 409 || (result.message && result.message.toLowerCase().includes("email"))) {
                    // Duplicate email — show inline error under the email field
                    if (emailErr) {
                        emailErr.innerText = result.message || "This email is already in use.";
                        emailErr.style.display = "block";
                        document.getElementById("editStudentEmail").focus();
                    }
                } else {
                    // Generic error — show at bottom of form
                    let genErr = document.getElementById("editStudentError");
                    if (!genErr) {
                        genErr = document.createElement("div");
                        genErr.id = "editStudentError";
                        genErr.style.cssText = "margin: 10px 0 0; padding: 10px 14px; border-radius: 8px; font-size: 0.9rem; background: rgba(255,107,107,0.12); border: 1px solid rgba(255,107,107,0.4); color: #ff6b6b;";
                        document.querySelector("#editStudentForm .modal-actions").before(genErr);
                    }
                    genErr.style.display = "block";
                    genErr.innerText = result.message || "Failed to update student.";
                }

            } catch (err) {
                console.error("Edit student error:", err);
                alert("Connection error. Please try again.");
            }
        });
    }
});