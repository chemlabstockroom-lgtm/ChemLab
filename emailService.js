// emailService.js
// Handles all email notifications for ChemLab Inventory System
// Supports Microsoft (Outlook/Office365) and standard SMTP
// emailService.js
require('dotenv').config(); // ← ADD THIS AS LINE 1
const nodemailer = require("nodemailer");

// ====== TRANSPORTER SETUP ======
// For @dlsud.edu.ph (Microsoft / Office 365), use these settings.
// If your school uses a different mail server, update host/port accordingly.
const transporter = nodemailer.createTransport({
  host: process.env.MAIL_HOST || "in-v3.mailjet.com", // mailjet is for production.
  port: parseInt(process.env.MAIL_PORT) || 587,
  secure: false, // true for port 465, false for 587 (STARTTLS)
  auth: {
    user: process.env.MAIL_USER,   // Your sender email, e.g. chemlab@dlsud.edu.ph
    pass: process.env.MAIL_PASS    // App password or email password
  },
  tls: {
    
    rejectUnauthorized: false      // helping with university network filters
  }
});

// ====== VERIFY CONNECTION (on startup) ======
async function verifyMailer() {
  try {
    await transporter.verify();
    console.log("✅ Mail server connected and ready.");
  } catch (err) {
    console.warn("⚠️  Mail server connection failed:", err.message);
    console.warn("   Emails will be skipped. Check MAIL_HOST/USER/PASS in .env");
  }
}

// ====== BASE SEND FUNCTION ======
async function sendMail({ to, subject, html }) {
  if (!process.env.MAIL_USER || !process.env.MAIL_PASS) {
    console.warn(`[Email skipped - no credentials] To: ${to} | Subject: ${subject}`);
    return;
  }
  try {
    const info = await transporter.sendMail({
      from: `"DLSU-D Chemlab Stockroom" <${process.env.MAIL_USER}>`,
      replyTo: process.env.MAIL_USER,
      to,
      subject,
      html,
      headers: {
      'X-Priority': '3',
      'Importance': 'Normal'
      }
    });
    console.log(` Email sent to ${to}: ${info.messageId}`);
  } catch (err) {
    console.error(` Failed to send email to ${to}:`, err.message);
  }
}

// ====== SHARED HTML WRAPPER ======
function wrapEmail(bodyContent) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; background: #f4f4f4; margin: 0; padding: 0; }
        .container { max-width: 600px; margin: 30px auto; background: #ffffff; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #1a4d2e, #2d7a4f); padding: 30px 40px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 1.6rem; letter-spacing: 1px; }
        .header p { color: #a8e063; margin: 6px 0 0; font-size: 0.9rem; }
        .body { padding: 30px 40px; color: #333; line-height: 1.7; }
        .body h2 { color: #1a4d2e; }
        .highlight-box { background: #f0f9f0; border-left: 4px solid #2d7a4f; padding: 14px 18px; border-radius: 6px; margin: 18px 0; }
        .highlight-box strong { color: #1a4d2e; font-size: 1.1rem; }
        .badge { display: inline-block; padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 0.9rem; }
        .badge-green { background: #d4edda; color: #155724; }
        .badge-orange { background: #fff3cd; color: #856404; }
        .badge-red { background: #f8d7da; color: #721c24; }
        .badge-blue { background: #d1ecf1; color: #0c5460; }
        .footer { background: #f8f9fa; padding: 18px 40px; text-align: center; font-size: 0.78rem; color: #888; border-top: 1px solid #eee; }
        .divider { border: none; border-top: 1px solid #eee; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>ChemLab Inventory System</h1>
          <p>De La Salle University Dasmariñas</p>
        </div>
        <div class="body">${bodyContent}</div>
        <div class="footer">
          This is an automated message from the ChemLab Inventory System.<br>
          Please do not reply to this email. For concerns, contact the Laboratory Technician directly.
        </div>
      </div>
    </body>
    </html>
  `;
}

// ============================================================
//  1. STUDENT REGISTRATION
//     Sent immediately after a student creates their account.
// ============================================================
async function sendStudentRegistrationEmail({ to, fullName }) {
  const html = wrapEmail(`
    <h2>Registration Received! </h2>
    <p>Hi <strong>${fullName}</strong>,</p>
    <p>Your account registration for the <strong>ChemLab Inventory System</strong> has been successfully submitted and is now pending approval.</p>

    <div class="highlight-box">
      <strong>📍 Next Step: Visit the Stockroom</strong><br><br>
      Please go to the <strong>Chemistry Laboratory Stockroom</strong> in person to have your 
      <strong>Laboratory ID Number assigned</strong> by the Laboratory Technician.<br><br>
      Bring a valid school ID when you visit.
    </div>

    <p>Once your Lab ID has been assigned, you will receive another email confirmation and your account will be activated.</p>
    <hr class="divider">
    <p style="font-size:0.85rem; color:#666;">
      If you did not register for this account, please ignore this email or contact the lab technician immediately.
    </p>
  `);

  await sendMail({
    to,
    subject: "ChemLab: Registration Received – Visit the Stockroom",
    html
  });
}

// ============================================================
//  2. LAB ID ASSIGNED (Student Account Activated)
//     Sent when admin assigns a Lab ID to a student.
// ============================================================
async function sendLabIDAssignedEmail({ to, fullName, labID }) {
  const html = wrapEmail(`
    <h2>Your Lab ID Has Been Assigned! ✅</h2>
    <p>Hi <strong>${fullName}</strong>,</p>
    <p>Great news! The Laboratory Technician has reviewed your registration and assigned your official Laboratory ID.</p>

    <div class="highlight-box">
      <strong>Your Laboratory ID:</strong><br><br>
      <span style="font-size: 2rem; font-weight: bold; color: #1a4d2e; letter-spacing: 3px;">${labID}</span>
    </div>

    <p>Your account is now <span class="badge badge-green">ACTIVE</span>. You can now log in to the ChemLab Inventory System using your Lab ID and password.</p>

    <p><strong>What you can do now:</strong></p>
    <ul>
      <li>Browse available laboratory experiments</li>
      <li>Submit borrow requests for materials and equipment</li>
      <li>Track your borrowed items and due dates</li>
      <li>View your accountability and breakage reports</li>
    </ul>
    <hr class="divider">
    <p style="font-size:0.85rem; color:#666;">
      Keep your Lab ID confidential. Do not share it with others.
    </p>
  `);

  await sendMail({
    to,
    subject: `ChemLab: Your Lab ID is ${labID} – Account Activated`,
    html
  });
}

// ============================================================
//  2b. STUDENT REGISTRATION REJECTED
//      Sent when admin rejects a student's registration.
// ============================================================
async function sendStudentRejectionEmail({ to, fullName }) {
  const html = wrapEmail(`
    <h2>Registration Update</h2>
    <p>Hi <strong>${fullName}</strong>,</p>
    <p>We regret to inform you that your registration for the <strong>ChemLab Inventory System</strong> has not been approved at this time.</p>

    <div class="highlight-box">
      <strong>Account Status:</strong> <span class="badge badge-red">NOT APPROVED</span><br><br>
      Your registration did not meet the current requirements or could not be verified 
      at this time.
    </div>

    <p>If you believe this is a mistake or would like to clarify your registration details, please visit the <strong>Chemistry Laboratory Stockroom</strong> in person and speak with the Laboratory Technician.</p>
    <hr class="divider">
    <p style="font-size:0.85rem; color:#666;">
      If you did not register for this account, please ignore this email.
    </p>
  `);

  await sendMail({
    to,
    subject: "ChemLab: Registration Status Update",
    html
  });
}

// ============================================================
//  3. GUEST REGISTRATION
//     Sent when a guest creates their account.
// ============================================================
async function sendGuestRegistrationEmail({ to, fullName }) {
  const html = wrapEmail(`
    <h2>Welcome to ChemLab! 👋</h2>
    <p>Hi <strong>${fullName}</strong>,</p>
    <p>Your guest account for the <strong>ChemLab Inventory System</strong> has been successfully created.</p>

    <div class="highlight-box">
      <strong>Account Type:</strong> <span class="badge badge-blue">GUEST</span><br><br>
      As a guest, you can book laboratory appointments and view available inventory items.
    </div>

    <p><strong>What you can do as a Guest:</strong></p>
    <ul>
      <li>Book laboratory appointments with the lab technician</li>
      <li>Browse available laboratory items and chemicals</li>
      <li>Track your appointment status</li>
    </ul>

    <p>Log in at any time using the email address and password you registered with.</p>
    <hr class="divider">
    <p style="font-size:0.85rem; color:#666;">
      If you did not create this account, please ignore this email.
    </p>
  `);

  await sendMail({
    to,
    subject: "ChemLab: Guest Account Created Successfully",
    html
  });
}

// ============================================================
//  4. BORROW STATUS UPDATE
//     Sent when admin changes a borrow request status.
// ============================================================
async function sendBorrowStatusEmail({ to, fullName, experimentName, status, labID }) {
  const statusMessages = {
    borrowed: {
      badge: `<span class="badge badge-green">APPROVED & BORROWED</span>`,
      title: "Borrow Request Approved ✅",
      message: `Your borrow request for <strong>${experimentName}</strong> has been <strong>approved</strong>. 
                You may now collect the materials from the stockroom. Please remember to return all items on or before the due date.`,
      reminder: "Returning items late may result in penalties or suspension of borrowing privileges."
    },
    rejected: {
      badge: `<span class="badge badge-red">REJECTED</span>`,
      title: "Borrow Request Rejected ❌",
      message: `Your borrow request for <strong>${experimentName}</strong> has been <strong>rejected</strong>. 
                This may be due to insufficient stock or scheduling conflicts. Please contact the Laboratory Technician for more information.`,
      reminder: "You may submit a new request after clarifying with the lab technician."
    },
    returned: {
      badge: `<span class="badge badge-blue">RETURNED</span>`,
      title: "Items Marked as Returned 🔄",
      message: `Your borrowed items for <strong>${experimentName}</strong> have been marked as <strong>returned</strong>. 
                Thank you for returning the materials on time and in good condition.`,
      reminder: "Your borrow record has been updated. Check the accountability page for your history."
    }
  };

  const info = statusMessages[status];
  if (!info) return; // Don't send for 'pending'

  const html = wrapEmail(`
    <h2>${info.title}</h2>
    <p>Hi <strong>${fullName}</strong> (Lab ID: <strong>${labID || "N/A"}</strong>),</p>
    <p>${info.message}</p>

    <div class="highlight-box">
      <strong>Experiment / Materials:</strong> ${experimentName}<br>
      <strong>Status:</strong> ${info.badge}
    </div>

    <p style="font-size:0.85rem; color:#666;"><em>${info.reminder}</em></p>
  `);

  await sendMail({
    to,
    subject: `ChemLab: Borrow Request ${status.charAt(0).toUpperCase() + status.slice(1)} – ${experimentName}`,
    html
  });
}

// ============================================================
//  5. BORROW DUE DATE REMINDER
//     Sent by the cron job scheduler.
// ============================================================
async function sendBorrowDueDateEmail({ to, fullName, experimentName, dueDate, daysLeft, labID }) {
  const isOverdue = daysLeft < 0;
  const urgencyBadge = isOverdue
    ? `<span class="badge badge-red">OVERDUE by ${Math.abs(daysLeft)} day(s)</span>`
    : daysLeft === 0
    ? `<span class="badge badge-red">DUE TODAY</span>`
    : `<span class="badge badge-orange">Due in ${daysLeft} day(s)</span>`;

  const html = wrapEmail(`
    <h2>${isOverdue ? "⚠️ Overdue Return" : daysLeft === 0 ? "⚠️ Due Today!" : "📅 Return Reminder"}</h2>
    <p>Hi <strong>${fullName}</strong> (Lab ID: <strong>${labID || "N/A"}</strong>),</p>
    <p>This is a reminder about your borrowed laboratory materials.</p>

    <div class="highlight-box">
      <strong>Experiment:</strong> ${experimentName}<br>
      <strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString("en-PH", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}<br>
      <strong>Status:</strong> ${urgencyBadge}
    </div>

    ${isOverdue
      ? `<p style="color:#721c24; font-weight:bold;">⚠️ Your borrowed materials are overdue! Please return them to the stockroom immediately to avoid penalties.</p>`
      : `<p>Please make sure to return all borrowed items to the <strong>Chemistry Laboratory Stockroom</strong> on or before the due date.</p>`
    }

    <p><strong>Reminder:</strong> All items must be returned clean, dry, and in good condition at least 30 minutes before the end of the laboratory period.</p>
  `);

  await sendMail({
    to,
    subject: isOverdue
      ? `ChemLab: OVERDUE Return – ${experimentName}`
      : `ChemLab: Return Reminder – ${experimentName} (${daysLeft === 0 ? "Due Today" : `${daysLeft} day(s) left`})`,
    html
  });
}

// ============================================================
//  6. APPOINTMENT STATUS UPDATE (Student & Guest)
//     Sent when admin changes an appointment status.
// ============================================================
async function sendAppointmentStatusEmail({ to, fullName, date, timeSlot, purpose, status, rejectionReason }) {
  const formattedDate = new Date(date).toLocaleDateString("en-PH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  const statusInfo = {
    approved: {
      badge: `<span class="badge badge-green">APPROVED</span>`,
      title: "Appointment Approved ✅",
      message: "Your appointment request has been <strong>approved</strong>. Please arrive on time.",
      extra: `<p>📍 Proceed to the <strong>Chemistry Laboratory Stockroom</strong> at your scheduled time.</p>`
    },
    accepted: {
      badge: `<span class="badge badge-green">ACCEPTED – IN PROGRESS</span>`,
      title: "Appointment In Progress 🔬",
      message: "Your appointment has been <strong>accepted</strong> and is currently in progress.",
      extra: ""
    },
    rejected: {
      badge: `<span class="badge badge-red">REJECTED</span>`,
      title: "Appointment Rejected ❌",
      message: "Unfortunately, your appointment request has been <strong>rejected</strong>.",
      extra: rejectionReason
        ? `<div class="highlight-box"><strong>Reason:</strong> ${rejectionReason}</div>`
        : `<p>Please contact the Laboratory Technician for more details.</p>`
    },
    returned: {
      badge: `<span class="badge badge-blue">COMPLETED</span>`,
      title: "Appointment Completed ✅",
      message: "Your appointment has been marked as <strong>completed</strong>. All borrowed items have been returned.",
      extra: "<p>Thank you for following the laboratory procedures and policies.</p>"
    }
  };

  const info = statusInfo[status];
  if (!info) return;

  const html = wrapEmail(`
    <h2>${info.title}</h2>
    <p>Hi <strong>${fullName}</strong>,</p>
    <p>${info.message}</p>

    <div class="highlight-box">
      <strong>Appointment Details:</strong><br><br>
       <strong>Date:</strong> ${formattedDate}<br>
       <strong>Time Slot:</strong> ${timeSlot || "N/A"}<br>
       <strong>Purpose:</strong> ${purpose || "N/A"}<br>
       <strong>Status:</strong> ${info.badge}
    </div>

    ${info.extra}
  `);

  await sendMail({
    to,
    subject: `ChemLab: Appointment ${status.charAt(0).toUpperCase() + status.slice(1)} – ${formattedDate}`,
    html
  });
}

// ============================================================
//  7. GUEST APPOINTMENT BOOKED CONFIRMATION
//     Sent right when a guest successfully books an appointment.
// ============================================================
async function sendGuestAppointmentConfirmEmail({ to, fullName, date, timeSlot, purpose, itemsRequested }) {
  const formattedDate = new Date(date).toLocaleDateString("en-PH", {
    weekday: "long", year: "numeric", month: "long", day: "numeric"
  });

  let itemsHtml = "";
  try {
    const items = JSON.parse(itemsRequested || "[]");
    if (items.length > 0) {
      itemsHtml = `
        <p><strong>Requested Items:</strong></p>
        <ul>${items.map(i => `<li>${i.item}${i.specs ? ` (${i.specs})` : ""} — Qty: ${i.qty}</li>`).join("")}</ul>
      `;
    }
  } catch {
    if (itemsRequested) {
      itemsHtml = `<p><strong>Requested Items:</strong> ${itemsRequested}</p>`;
    }
  }

  const html = wrapEmail(`
    <h2>Appointment Request Received 📋</h2>
    <p>Hi <strong>${fullName}</strong>,</p>
    <p>Your appointment request has been submitted and is now <span class="badge badge-orange">PENDING</span> review by the Laboratory Technician.</p>

    <div class="highlight-box">
      <strong>Your Appointment Details:</strong><br><br>
       <strong>Date:</strong> ${formattedDate}<br>
       <strong>Time Slot:</strong> ${timeSlot || "N/A"}<br>
       <strong>Purpose:</strong> ${purpose || "N/A"}
    </div>

    ${itemsHtml}

    <p>You will receive another email once the Laboratory Technician reviews your request.</p>
    <p>If you need to cancel or modify your appointment, please contact the lab directly.</p>
  `);

  await sendMail({
    to,
    subject: "ChemLab: Appointment Request Received – Pending Review",
    html
  });
}

// ============================================================
//  8. FORGOT PASSWORD - TEMPORARY PASSWORD
//     Sent when a user requests a password reset.
//     Contains a temporary password and instructions.
//     Valid for 1 hour only.
// ============================================================
 
async function sendPasswordResetEmail({ to, fullName, tempPassword, role }) {
  const roleLabel = role === "admin" ? "Admin" : role === "student" ? "Student" : "Guest";
 
  const loginHint = role === "student"
    ? `<p>Log in using your <strong>Lab ID</strong> and the temporary password above.</p>`
    : `<p>Log in using your <strong>registered email</strong> and the temporary password above.</p>`;
 
  const html = wrapEmail(`
    <h2>Password Reset Request 🔑</h2>
    <p>Hi <strong>${fullName}</strong>,</p>
    <p>We received a request to reset the password for your <strong>${roleLabel} account</strong> on the ChemLab Inventory System.</p>
 
    <div class="highlight-box">
      <strong>Your Temporary Password:</strong><br><br>
      <span style="font-size: 1.6rem; font-weight: bold; color: #1a4d2e; letter-spacing: 4px; font-family: monospace;">${tempPassword}</span>
    </div>
 
    ${loginHint}
 
    <div style="background:#fff8e1; border-left:4px solid #f59e0b; border-radius:0 6px 6px 0; padding:13px 18px; margin:18px 0;">
      <strong style="color:#92400e;">⚠️ Important Security Notice</strong><br>
      <ul style="margin:8px 0 0; padding-left:20px; color:#78350f; font-size:0.9rem; line-height:1.7;">
        <li>This temporary password is valid for <strong>1 hour</strong> only.</li>
        <li>Please <strong>change your password immediately</strong> after logging in.</li>
        <li>If you did not request this reset, contact the lab technician right away.</li>
      </ul>
    </div>
  `);
 
  await sendMail({
    to,
    subject: "ChemLab: Your Temporary Password",
    html
  });
}
  
module.exports = {
  verifyMailer,
  sendStudentRegistrationEmail,
  sendLabIDAssignedEmail,
  sendStudentRejectionEmail,
  sendPasswordResetEmail,
  sendGuestRegistrationEmail,
  sendBorrowStatusEmail,
  sendBorrowDueDateEmail,
  sendAppointmentStatusEmail,
  sendGuestAppointmentConfirmEmail
};