// scheduler.js
// Runs background jobs for due-date reminders.
// Call startScheduler(models) once after MongoDB connects in server.js.

const cron = require("node-cron");
const { sendBorrowDueDateEmail } = require("./emailService");

/**
 * startScheduler({ Borrowed, Student })
 * Runs every day at 8:00 AM (Philippine Time = UTC+8, so 00:00 UTC).
 * Sends email reminders for:
 *   - Items due in 3 days
 *   - Items due tomorrow (1 day)
 *   - Items due today
 *   - Items already overdue (up to 7 days past due, to avoid spam)
 */
function startScheduler({ Borrowed, Student }) {
  // "0 0 * * *" = every day at midnight UTC (= 8 AM PHT)
  // Change to "0 8 * * *" if your server clock is already in PHT
  cron.schedule("0 0 * * *", async () => {
    console.log("⏰ Running daily borrow due-date check...");

    try {
      const now = new Date();
      now.setHours(0, 0, 0, 0);

      // Find all active borrows that have a due date
      const activeBorrows = await Borrowed.find({
        status: "borrowed",
        dueDate: { $exists: true, $ne: null }
      }).populate("studentId", "fullName email labID");

      console.log(`🔍 Found ${activeBorrows.length} active borrow(s) with due dates`);
      activeBorrows.forEach(b => {
        const due = new Date(b.dueDate);
        due.setHours(0, 0, 0, 0);
        const now = new Date(); now.setHours(0, 0, 0, 0);
        const daysLeft = Math.round((due - now) / (1000 * 60 * 60 * 24));
        console.log(`  → "${b.experimentName}" | dueDate: ${b.dueDate} | daysLeft: ${daysLeft} | email: ${b.studentId?.email || "NO EMAIL"}`);
      });

      let reminded = 0;

      for (const borrow of activeBorrows) {
        const student = borrow.studentId;
        if (!student || !student.email) continue;

        const due = new Date(borrow.dueDate);
        due.setHours(0, 0, 0, 0);

        const diffMs = due - now;
        const daysLeft = Math.round(diffMs / (1000 * 60 * 60 * 24));

        // Send reminders for: overdue (up to -7), due today (0), 1 day left, 3 days left
        const shouldRemind = daysLeft === 3 || daysLeft === 1 || daysLeft === 0 || (daysLeft < 0 && daysLeft >= -7);

        if (shouldRemind) {
          await sendBorrowDueDateEmail({
            to: student.email,
            fullName: student.fullName,
            experimentName: borrow.experimentName || "Unknown Experiment",
            dueDate: borrow.dueDate,
            daysLeft,
            labID: student.labID
          });
          reminded++;
        }
      }

      console.log(` Due-date check complete. ${reminded} reminder(s) sent.`);
    } catch (err) {
      console.error(" Scheduler error:", err.message);
    }
  });

  console.log("📅 Due-date reminder scheduler started (runs daily at 00:00 UTC / 08:00 PHT).");
}

module.exports = { startScheduler };