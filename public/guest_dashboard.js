/* guest_dashboard.js */
const API_BASE = "http://localhost:4000/api";
const token = localStorage.getItem("guestToken");
if (!token) {
    window.location.href = "guest_login.html";
}

// Navigation
function showPage(id) {
    document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
    const target = document.getElementById(id);
    if (target) target.classList.add("active");
}

function logout() {
    localStorage.removeItem("guestToken");
    window.location.href = "index.html";
}

// Load Guest Profile
async function loadGuestProfile() {
    try {
        // Ensure you are using your global API_BASE variable
        const res = await fetch(`${API_BASE}/guest/me`, {
            headers: { "Authorization": "Bearer " + token }
        });
        
        if (res.ok) {
            const guest = await res.json();
            
            // 1. Update Sidebar (First name only)
            const sidebarName = document.getElementById("sidebarUserName");
            if (sidebarName) sidebarName.textContent = guest.fullName.split(' ')[0];

            // 2. Update Home Welcome Message
            const homeName = document.getElementById("guestNameDisplay");
            if (homeName) homeName.textContent = guest.fullName;

            // 3. Update the Email Card on Home
            const homeEmail = document.getElementById("guestEmailDisplay");
            if (homeEmail) homeEmail.textContent = guest.email;
            
            // 4. Update Profile Page Fields
            if (document.getElementById("viewFullName")) {
                document.getElementById("viewFullName").textContent = guest.fullName;
                document.getElementById("viewEmail").textContent = guest.email;
                document.getElementById("profileFullName").value = guest.fullName;
            }

            // 5. Store in localStorage as a backup for other functions
            localStorage.setItem("guestEmail", guest.email);
            localStorage.setItem("guestName", guest.fullName);
        }
    } catch (err) {
        console.error("Profile load failed. Using fallbacks.");
        const sidebarName = document.getElementById("sidebarUserName");
        if (sidebarName) sidebarName.textContent = "Guest";
    }
}

function toggleEditMode(isEdit) {
    const viewSection = document.getElementById('profileViewSection');
    const editForm = document.getElementById('profileUpdateForm');
    viewSection.style.display = isEdit ? 'none' : 'block';
    editForm.style.display = isEdit ? 'block' : 'none';
}

async function handleProfileUpdate(e) {
    e.preventDefault();
    const msg = document.getElementById('profileMessage');
    const token = localStorage.getItem("guestToken");

    const fullName = document.getElementById('profileFullName').value.trim();
    const currentPassword = document.getElementById('currentPassword').value.trim();
    const newPassword = document.getElementById('newPassword').value.trim();

    if ((currentPassword && !newPassword) || (!currentPassword && newPassword)) {
        msg.style.color = "red";
        msg.textContent = "To change password, provide both current and new password.";
        return;
    }

    msg.style.color = "orange";
    msg.textContent = "Updating...";

    const payload = { fullName };
    if (currentPassword && newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
    }

    try {
        const res = await fetch(`${API_BASE}/guest/me`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const result = await res.json();

        if (res.ok) {
            msg.style.color = "#a8e063";
            msg.textContent = "Profile updated successfully!";
            loadGuestProfile();
            toggleEditMode(false);
            document.getElementById('currentPassword').value = '';
            document.getElementById('newPassword').value = '';
        } else {
            msg.style.color = "red";
            msg.textContent = result.message || "Update failed.";
        }
    } catch (err) {
        msg.style.color = "red";
        msg.textContent = "Server error. Please try again.";
    }
}

// --- APPOINTMENT LOGIC (Put it here!) ---
async function handleBookAppointment(e) {
    e.preventDefault();
    const msg = document.getElementById("appointmentMsg");
    const f = e.target;
    const token = localStorage.getItem("guestToken"); 

    if (!token) {
        msg.innerText = "Error: You are not logged in.";
        return;
    }

    // --- 1. VALIDATE BASIC FIELDS ---
    const dateValue = f.date.value;
    const purposeValue = f.purpose.value.trim();

    if (!dateValue || !purposeValue) {
        msg.style.color = "#ff6b6b";
        msg.innerText = "Error: Please provide both a Date/Time and a Purpose.";
        return;
    }

    const selectedDate = new Date(dateValue);
    const now = new Date();
    if (selectedDate < now) {
        msg.style.color = "#ff6b6b";
        msg.innerText = "Error: Cannot select a past date/time.";
        return;
    }

    //CONVERT TO MANILA TIME (UTC+8) --- 
    function toManilaDate(date) { 
        const utc = date.getTime() + date.getTimezoneOffset() * 60000; // convert to UTC 
        return new Date(utc + 8 * 60 * 60 * 1000); // UTC -> Manila (UTC+8) 
        }
        
        const manilaDate = toManilaDate(selectedDate); 
        const manilaHour = manilaDate.getHours(); // 0-23 
        const manilaDay = manilaDate.getDay();
        
        if (manilaDay === 0) {
            msg.style.color = "#ff6b6b";
            msg.innerText = "Error: Appointments cannot be booked on Sundays.";
            return;
        }

        if (manilaHour < 7 || manilaHour >= 18) {
             msg.style.color = "#ff6b6b"; msg.innerText = "Error: Appointments can only be booked between 7:00 AM and 6:00 PM Philippine Time."; 
             return; // <-- important, stops execution here 
            }

    // --- 2. VALIDATE MATERIAL ROWS ---
    const materialRows = document.querySelectorAll('.material-row');
    const materialsList = [];
    let hasMaterialError = false;

    materialRows.forEach(row => {
        const cat = row.querySelector('.mat-category').value;
        const itemSelect = row.querySelector('.mat-item');
        const qty = row.querySelector('.mat-qty').value;

        const rowTouched = cat || itemSelect.value || qty;
        const rowComplete = cat && itemSelect.value && qty > 0;

        if (rowTouched && !rowComplete) {
            hasMaterialError = true;
            row.style.border = "1px solid #ff6b6b"; 
        } else if (rowComplete) {
            row.style.border = "none";
            materialsList.push({
                item: itemSelect.value,
                specs: itemSelect.selectedOptions[0].dataset.specs || "N/A",
                qty: Number(qty)
            });
        }
    });

    // --- NEW STRICT VALIDATION ---
    // Error if any row is partially filled
    if (hasMaterialError) {
        msg.style.color = "#ff6b6b";
        msg.innerText = "Error: Please complete all fields in your material rows.";
        return;
    }

       // Error if NO materials were added at all (REMOVED)
    // if (materialsList.length === 0) {
    //    msg.style.color = "#ff6b6b";
    //    msg.innerText = "Error: You must request at least one material to book an appointment.";
        // Highlight the first row to show where to input
    //    materialRows[0].style.border = "1px solid #ff6b6b";
    //    return;
    //}

    // --- 3. SEND REQUEST ---
    const payload = {
        date: dateValue,
        purpose: purposeValue,
        itemsRequested: JSON.stringify(materialsList) // Since validation passed, this will always have data
    };

    try {
        const res = await fetch("/api/guest/appointments", { 
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (res.ok) {
            msg.style.color = "#ffd700"; 
            msg.innerText = "Success! Request submitted for Admin approval.";
            f.reset();
            
            // Remove red borders from rows
            materialRows.forEach(row => row.style.border = "none");

            const container = document.getElementById("guestMaterialsContainer");
            if (container) {
                while (container.children.length > 1) {
                    container.removeChild(container.lastChild);
                }
            }
            loadMyAppointments();
            updateHomeStats();
        } else {
            msg.style.color = "#ff6b6b";
            msg.innerText = data.message || "Failed to book.";
        }
    } catch (err) {
        msg.style.color = "#ff6b6b";
        msg.innerText = "Server Error. Check connection.";
        console.error("Booking Error:", err);
    }
}

async function loadMyAppointments() {
    const listDiv = document.getElementById("myAppointmentsList");
    try {
        const res = await fetch("/api/guest/appointments", {
            headers: { "Authorization": "Bearer " + localStorage.getItem("guestToken") }
        });
        const data = await res.json();

        if (data.length === 0) {
            listDiv.innerHTML = `<p style="text-align:center; color:gray;">No appointments found.</p>`;
            return;
        }

        // 1. Sort by Date (Latest First)
        const sortedData = data.sort((a, b) => new Date(b.date) - new Date(a.date));

        // 2. Split data: Unprocessed/Active vs. Finished
        const activeApps = sortedData.filter(app => ["pending", "approved", "accepted"].includes(app.status));
        const pastApps = sortedData.filter(app => ["returned", "rejected"].includes(app.status));

        // 3. Helper function to generate Card HTML
        const renderCard = (app) => {
            const dateStr = new Date(app.date).toLocaleString([], { 
                dateStyle: 'medium', 
                timeStyle: 'short' 
            });

            // Parse items if they are JSON
            let displayItems = app.itemsRequested || "None requested";
            if (displayItems.startsWith('[')) {
                try {
                    const parsed = JSON.parse(displayItems);
                    displayItems = parsed.map(i => `${i.qty}x ${i.item}`).join(", ");
                } catch (e) { console.error(e); }
            }

            return `
                <div class="card" style="margin-bottom: 15px; border: 1px solid #3c562a; background: rgba(255,255,255,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div>
                            <h4 style="margin: 0; color: #ffd700;">${dateStr}</h4>
                            <p style="margin: 5px 0; font-size: 0.9rem;"><b>Purpose:</b> ${app.purpose}</p>
                        </div>
                        <span class="status-badge status-${app.status}">${app.status}</span>
                    </div>
                    <p style="margin: 5px 0; font-size: 0.9rem;"><b>Materials:</b> ${displayItems}</p>
                    ${app.status === 'rejected' ? `
                        <div style="margin-top: 10px; padding: 10px; background: rgba(255, 107, 107, 0.1); border-left: 3px solid #ff6b6b; font-size: 0.85rem;">
                            <b>Admin Note:</b> ${app.rejectionReason || "Please contact the lab."}
                        </div>
                    ` : ''}
                </div>
            `;
        };

        // 4. Combine sections with headers
        listDiv.innerHTML = `
            <div class="appointment-section">
                <h4 style="color: #a8e063; border-bottom: 1px solid #3c562a; padding-bottom: 5px;">Active Requests</h4>
                ${activeApps.length > 0 ? activeApps.map(renderCard).join('') : '<p style="color:gray; font-size:0.8rem;">No active requests.</p>'}
            </div>
            
            <div class="appointment-section" style="margin-top: 30px;">
                <h4 style="color: #888; border-bottom: 1px solid #333; padding-bottom: 5px;">Past Appointments</h4>
                ${pastApps.length > 0 ? pastApps.map(renderCard).join('') : '<p style="color:gray; font-size:0.8rem;">No history found.</p>'}
            </div>
        `;

    } catch (err) {
        console.error("Error loading appointments", err);
        listDiv.innerHTML = `<p style="color:red;">Failed to load appointments.</p>`;
    }
}

async function loadGuestItems(categorySelect) {
    const category = categorySelect.value;
    const itemSelect = categorySelect.closest('.material-row').querySelector('.mat-item');
    
    if (!category) {
        itemSelect.innerHTML = '<option value="">Select Item</option>';
        return;
    }

    itemSelect.innerHTML = '<option value="">Loading...</option>';

    try {
        const token = localStorage.getItem("guestToken"); 
        
        // Check if API_BASE is missing
        if (typeof API_BASE === 'undefined') {
            throw new Error("API_BASE is not defined at the top of your script!");
        }

        // We use the new guest-friendly route we discussed
        const res = await fetch(`${API_BASE}/inventory/search?category=${category}`, {
            method: 'GET',
            headers: { 
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!res.ok) {
            const errorData = await res.json();
            throw new Error(`Server responded with ${res.status}: ${errorData.message}`);
        }

        const items = await res.json();
        console.log("Items received:", items); // Check your F12 Console for this!

        itemSelect.innerHTML = '<option value="">Select Item</option>';
        items.forEach(i => {
            const name = i.itemName || i.chemicalName;
            const specs = i.specification || i.description || i.casNumber || "N/A";
            
            const option = document.createElement('option');
            option.value = name;
            option.dataset.specs = specs;
            option.textContent = `${name} (${specs})`;
            itemSelect.appendChild(option);
        });

    } catch (err) {
        console.error("FULL ERROR LOG:", err);
        itemSelect.innerHTML = `<option value="">Error: ${err.message}</option>`;
    }
}

async function updateHomeStats() {
    // 1. Target all the IDs in your Home Page HTML
    const homeCount = document.getElementById("homeActiveCount");
    const homeEmail = document.getElementById("guestEmailDisplay");
    const homeRecent = document.getElementById("homeRecentUpdate");
    const guestName = document.getElementById("guestNameDisplay");

    try {
        const res = await fetch(`${API_BASE}/guest/appointments`, {
            headers: { "Authorization": "Bearer " + token }
        });
        const data = await res.json();

        // Ensure data is an array before processing
        if (data && Array.isArray(data)) {
            
            // --- 2. UPDATE ACTIVE COUNT ---
            const activeApps = data.filter(app => 
                ["pending", "approved", "accepted"].includes(app.status)
            );
            if (homeCount) homeCount.textContent = activeApps.length;

            // --- 3. UPDATE LATEST APPOINTMENT DISPLAY ---
            if (homeRecent) {
                if (data.length > 0) {
                    // Sort by date (Latest visit date first)
                    const latest = data.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                    
                    const formattedDate = new Date(latest.date).toLocaleDateString(undefined, {
                        month: 'short', day: 'numeric', year: 'numeric'
                    });

                    homeRecent.innerHTML = `
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div>
                                <span style="color: #ffd700; font-weight: bold; font-size: 1rem;">${latest.purpose}</span><br>
                                <small style="color: #888;">Visit Date: ${formattedDate}</small>
                            </div>
                            <span class="status-badge status-${latest.status}" 
                                  style="padding: 4px 12px; border-radius: 6px; font-size: 0.75rem; font-weight: bold; text-transform: uppercase; color: white;">
                                ${latest.status}
                            </span>
                        </div>
                    `;
                } else {
                    homeRecent.innerHTML = `<p style="color: gray; margin: 0;">No appointments found.</p>`;
                }
            }
        }

        // --- 4. UPDATE EMAIL ---
        if (homeEmail) {
    const savedEmail = localStorage.getItem("guestEmail");
    if (savedEmail) {
        homeEmail.textContent = savedEmail;
    } else {
        // Fallback: If localStorage is empty, the email will be filled 
        // by the loadGuestProfile function instead.
        homeEmail.textContent = "Loading email..."; 
    }
}

    } catch (err) {
        console.error("Error updating home stats:", err);
        if (homeRecent) homeRecent.textContent = "Error loading latest update.";
    }
}


function getStatusColor(status) {
    if (status === 'approved') return 'rgba(76, 175, 80, 0.4)';
    if (status === 'rejected') return 'rgba(255, 107, 107, 0.4)';
    return 'rgba(255, 215, 0, 0.4)'; 
}

// Initialize
document.addEventListener("DOMContentLoaded", () => {
    loadGuestProfile();
    loadMyAppointments();
    updateHomeStats();

    // --- NEW VALIDATION CODE ---
    // This finds the date input and prevents selecting past dates in the UI
    const dateInput = document.getElementById("appDate");
    if (dateInput) {
        // Get today's date in YYYY-MM-DD format
        const today = new Date().toISOString().split('T')[0];
        dateInput.setAttribute('min', today);
    }
});

//new line Adding materials 
document.getElementById("addMaterialBtn").addEventListener("click", () => {
    const container = document.getElementById("guestMaterialsContainer");
    const originalRow = container.querySelector(".material-row");
    
    // Clone the original row
    const newRow = originalRow.cloneNode(true);

    // Reset the values
    newRow.querySelector(".mat-category").value = "";
    newRow.querySelector(".mat-item").innerHTML = '<option value="">Select Item</option>';
    newRow.querySelector(".mat-qty").value = "";

    // Append the new row before the + button
    container.insertBefore(newRow, document.getElementById("addMaterialBtn"));
});

// Handle remove button clicks (Event Delegation)
document.addEventListener("click", function (e) {
    if (e.target.classList.contains("remove-material")) {
        const container = document.getElementById("guestMaterialsContainer");
        const rows = container.querySelectorAll(".material-row");

        if (rows.length > 1) {
            e.target.closest(".material-row").remove();
        } else {
            // Just clear instead of removing if it's the only row
            const row = rows[0];
            row.querySelector(".mat-category").value = "";
            row.querySelector(".mat-item").innerHTML = '<option value="">Select Item</option>';
            row.querySelector(".mat-qty").value = "";
        }
    }
});
