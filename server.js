// server.js
require('dotenv').config();
//newline
console.log("🔥 process.env.MONGODB_URI =", process.env.MONGODB_URI);

const express = require('express');
const mongoose = require('mongoose');
const QRCode = require("qrcode");
const bwipjs = require('bwip-js');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');

// ====== EMAIL & SCHEDULER ======  ← ADD THIS BLOCK
const {
  verifyMailer,
  sendStudentRegistrationEmail,
  sendLabIDAssignedEmail,
  sendStudentRejectionEmail,
  sendGuestRegistrationEmail,
  sendBorrowStatusEmail,
  sendAppointmentStatusEmail,
  sendGuestAppointmentConfirmEmail,
  sendPasswordResetEmail
} = require("./emailService");
const { startScheduler } = require("./scheduler");

// ====== CONFIG ======
const PORT = process.env.PORT || 4000;
// removed const MONGO = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/chemlab";
//replaced by
const MONGO = process.env.MONGODB_URI;
if (!MONGO) {
  throw new Error(" MONGODB_URI is missing. Check your .env file.");
}

const JWT_SECRET = process.env.JWT_SECRET || "supersecret";
const SUPER_EMAIL = process.env.SUPER_ADMIN_EMAIL || "super@chemlab.edu";
const SUPER_PASS = process.env.SUPER_ADMIN_PASSWORD || "123456";

// ====== APP ======
const app = express();
app.use(express.json());
app.use(cors());
app.use(express.static("public")); // serve static HTML files

//new line
// ====== DATABASE CONNECTION ======
console.log("🛠️ Connecting to MongoDB with URI:", MONGO);
mongoose.connect(MONGO, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(async () => {
  console.log("✅ MongoDB Atlas connected");

  startScheduler({ Borrowed, Student });  
  await verifyMailer();    

  app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
}).catch(err => {
  console.error("❌ MongoDB connection error:", err.message);
});

// ====== MONGOOSE MODELS ======
const { Schema } = mongoose;

// Student
const StudentSchema = new Schema({
  fullName: String,
  email: { type: String, unique: true, required: true },
  cys: String,
  professor: String,
  classSchedule: String,
  passwordHash: String,
  labID: { type: String, unique: true, sparse: true },
  status: { type: String, enum: ["pending", "active", "blocked"], default: "pending" }
}, { timestamps: true });
const Student = mongoose.model("Student", StudentSchema);

// Policy Agreement Schema 
const PolicyAgreementSchema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: "Student", unique: true },
  agreed: { type: Boolean, default: false },
  agreedAt: { type: Date }
});

const PolicyAgreement = mongoose.model("PolicyAgreement", PolicyAgreementSchema);

// Guest Schema
const GuestSchema = new Schema({
  fullName: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  passwordHash: { type: String, required: true },
  status: { type: String, enum: ["active", "blocked"], default: "active" },
  role: { type: String, default: "guest" }
}, { timestamps: true });

const Guest = mongoose.model("Guest", GuestSchema);

// Admin
const AdminSchema = new Schema({
  name: String,
  email: { type: String, unique: true },
  passwordHash: String,
  role: { type: String, enum: ["superadmin", "admin"], default: "admin" }
}, { timestamps: true });
const Admin = mongoose.model("Admin", AdminSchema);

// ====== ARCHIVE MODEL (Users Only) ======
const UserArchiveSchema = new Schema({
  userType: { type: String, enum: ["student", "admin"], required: true },
  originalId: { type: Schema.Types.ObjectId },
  data: { type: Schema.Types.Mixed, required: true },
  deletedBy: { type: Schema.Types.ObjectId, ref: "Admin" },
  deletedByEmail: String,
  deletedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const UserArchive = mongoose.model("UserArchive", UserArchiveSchema);

// Audit log
const AuditLogSchema = new Schema({
  actorAdminId: { type: Schema.Types.ObjectId, ref: "Admin" },
  action: String,
  targetStudentId: { type: Schema.Types.ObjectId, ref: "Student" },
  metadata: Schema.Types.Mixed,
  timestamp: { type: Date, default: Date.now }
});
const AuditLog = mongoose.model("AuditLog", AuditLogSchema);

// Borrow
const BorrowSchema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
  experimentId: { type: Schema.Types.ObjectId, ref: "Experiment", required: true },
  experimentName: String,
  materialsUsed: [
    {
      itemId: { type: Schema.Types.ObjectId }, // optional but recommended
      item: String,
      specs: String,
      qty: { type: Number, required: true }
    }
  ],
  status: { type: String, enum: ["pending", "borrowed", "returned", "rejected"], default: "pending" },
  borrowedAt: { type: Date, default: Date.now },
  dueDate: Date
});
const Borrow = mongoose.model("Borrow", BorrowSchema);

// Inventory
// ===== Equipment =====
const equipmentSchema = new mongoose.Schema({
  dateReceived: String,
  propertyCode: String,
  itemName: String,
  specification: String,
  serialNumber: String,
  location: String,
  nFEA: String,
  quantity: Number,
  remainingQuantity: {
    type: Number,
    default: function () {
      return this.quantity;
    },
  },
  cost: Number,
  status: String
});
const Equipment = mongoose.model("Equipment", equipmentSchema);

// ===== Chemicals & Reagents =====
const chemicalSchema = new mongoose.Schema({
  barcode: {type: String, unique: true, sparse: true},
  location: String,
  owner: String,
  dateIn: String,
  expirationDate: String,
  chemicalName: String,
  casNumber: String,
  quantity: Number,
  containerSize: String,
  remainingQuantity: {
    type: Number,
    default: function () {
      return this.quantity;
    },
  },
  status: {
    type: String,
    default: "Available" // Set default status
  },
  units: String,
  state: String
});
const Chemical = mongoose.model("Chemical", chemicalSchema);

// ===== CHEMICAL SEEDER =====
async function seedChemicals() {
  const chemicals = [
    {
      barcode: "117264",
      location: "CC-34",
      owner: "",
      dateIn: "10/23/2019",
      expirationDate: "",
      chemicalName: "1,4-Cyclohexanediol",
      casNumber: "55907-61-4",
      quantity: 500,
      containerSize: "500",
      units: "g",
      state: "solid",
    },
    {
      barcode: "117235",
      location: "CC-34",
      owner: "",
      dateIn: "10/23/2019",
      expirationDate: "",
      chemicalName: "1-Butanol",
      casNumber: "71-36-3",
      quantity: 500,
      containerSize: "1.8",
      units: "L",
      state: "liquid",
    },
    {
      barcode: "117234",
      location: "CC-34",
      owner: "",
      dateIn: "10/23/2019",
      expirationDate: "",
      chemicalName: "1-Naphthol",
      casNumber: "90-15-3",
      quantity: 500,
      containerSize: "500",
      units: "g",
      state: "solid",
    },
    {
      barcode: "117233",
      location: "CC-34",
      owner: "",
      dateIn: "10/23/2019",
      expirationDate: "",
      chemicalName: "2-Pentanol 95%",
      casNumber: "6032-29-7",
      quantity: 500,
      containerSize: "25.0",
      units: "mL",
      state: "liquid",
    },
    {
      barcode: "117027",
      location: "CC-34",
      owner: "",
      dateIn: "10/23/2019",
      expirationDate: "",
      chemicalName: "2-Butanol",
      casNumber: "78-92-2",
      quantity: 500,
      containerSize: "2.5",
      units: "L",
      state: "liquid",
    },
    {
      barcode: "117243",
      location: "CC-34",
      owner: "",
      dateIn: "10/23/2019",
      expirationDate: "",
      chemicalName: "2 Methyl-Propan",
      casNumber: "820209-54-0",
      quantity: 500,
      containerSize: "2.5",
      units: "L",
      state: "liquid",
    }
  ];

  for (const c of chemicals) {
    const exists = await Chemical.findOne({ barcode: c.barcode });
    if (!exists) {
      c.remainingQuantity = c.quantity;
      await Chemical.create(c);
    }
  }

  console.log("✅ Chemical seed complete");
}


// ===== Glassware & Materials =====
const glasswareSchema = new mongoose.Schema({
  itemName: String,
  description: String,
  quantity: Number,
  remainingQuantity: {
    type: Number,
    default: function () {
      return this.quantity;
    },
  },
  remarks: String
});
const Glassware = mongoose.model("Glassware", glasswareSchema);

// ===== Fixed Assets =====
const fixedAssetSchema = new mongoose.Schema({
  dateReceived: String,
  propertyCode: String,
  itemName: String,
  description: String,
  serialNumber: String,
  location: String,
  nFEA: String,
  quantity: Number,
  cost: Number,
  status: String
});
const FixedAsset = mongoose.model("FixedAsset", fixedAssetSchema);


// Appointment
const AppointmentSchema = new Schema({
  // For registered users
  studentId: { type: Schema.Types.ObjectId, ref: "Student" },
  guestId: { type: Schema.Types.ObjectId, ref: "Guest" },
  
  // For manual admin entries (Face-to-Face)
  studentName: String, 
  cys: String,
  materials: String,

  // Common fields
  date: { type: Date, required: true },
  timeSlot: String,
  purpose: String,
  itemsRequested: String, 
  duration: String,      
  
  status: { type: String, enum: ["pending", "approved", "accepted", "rejected", "returned"], default: "pending" },
  rejectionReason: { type: String, default: "" } // NEW FIELD
}, { timestamps: true });
const Appointment = mongoose.model("Appointment", AppointmentSchema);


// Breakage (damage reports / accountability)
const BreakageSchema = new Schema({
  labID: { type: String, required: true },
  item: { type: String, required: true },
  violation: { type: String, required: true },
  remarks: { type: String },
  status: { type: String, default: "unresolved" },
  reportedAt: { type: Date, default: Date.now },
  quantityBroken: { type: Number, default: 1 },
  category: { type: String },
  itemId: { type: Schema.Types.ObjectId }
}, { timestamps: true });

const Breakage = mongoose.model("Breakage", BreakageSchema, "breakages");



// Borrowed (for compatibility if you want a separate collection)
const BorrowedSchema = new Schema({
  studentId: { type: Schema.Types.ObjectId, ref: "Student" },
  experimentId: { type: Schema.Types.ObjectId, ref: "Experiment" },
  experimentName: String,
  materialsUsed: [
    {
      itemId: { type: Schema.Types.ObjectId }, // optional but recommended
      item: String,
      specs: String,
      qty: { type: Number, required: true }
    }
  ],
  status: { 
    type: String, 
    enum: ["pending", "borrowed", "returned", "rejected"], 
    default: "pending" 
  },
  borrowedAt: { type: Date, default: Date.now },
  returnedAt: Date,
  dueDate: Date,

  // ✅ BARCODE FIELDS
  barcodeValue: String,     // text encoded in barcode
  barcodeImage: String      // base64 image (QR code)
}, { timestamps: true });

const Borrowed = mongoose.model("Borrowed", BorrowedSchema, "borrows");


// ====== EXPERIMENTS ======
const ExperimentSchema = new Schema({
  name: String,
  course: String,
  description: String,
  materials: [
    {
      category: String, // "equipment", "glassware", or "chemical"
      itemId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "materials.category"
      },
      item: String, // e.g. "Beaker"
      specs: String, // e.g. "250mL"
      qty: Number
    }
  ]
}, { timestamps: true });

const Experiment = mongoose.model("Experiment", ExperimentSchema);



// ====== MIDDLEWARE ======
async function findAndDecrementItem(itemName, itemSpecs, quantityNeeded) {
  const need = Number(quantityNeeded);

  if (!Number.isFinite(need) || need <= 0) {
    throw new Error(`Invalid quantity requested for "${itemName}".`);
  }

  let item = null;

  const nameRegex = new RegExp(`^${itemName.trim()}$`, "i");
  const specFilter = itemSpecs && itemSpecs.trim() 
  ? new RegExp(`^${itemSpecs.trim()}$`, "i") 
  : null;
  //const specRegex = new RegExp(`^${itemSpecs.trim()}$`, "i");

  // Equipment
  item = await Equipment.findOne(
    specFilter
    ? { itemName: nameRegex, specification: specFilter }
    : { itemName: nameRegex }
  );

  // Glassware
  if (!item) {
    item = await Glassware.findOne(
      specFilter
      ? { itemName: nameRegex, description: specFilter }
      : { itemName: nameRegex }
    );
  }

  // Chemical
  if (!item) {
    item = await Chemical.findOne(
      specFilter
      ? { chemicalName: nameRegex, $or: [{ casNumber: specFilter }, { containerSize: specFilter }] }
      : { chemicalName: nameRegex }
    );
  }

  if (!item) {
    throw new Error(`Inventory item "${itemName}" (${itemSpecs}) not found.`);
  }

  const current = Number(item.remainingQuantity);

  if (!Number.isFinite(current)) {
    throw new Error(
      `Inventory data error for "${itemName}": remainingQuantity is invalid.`
    );
  }

  if (current < need) {
    throw new Error(
      `Not enough stock for "${item.itemName || item.chemicalName}". ` +
      `Required: ${need}, Available: ${current}`
    );
  }

  item.remainingQuantity = current - need;
  await item.save();

  return item;
}


async function findAndIncrementItem(itemName, itemSpecs, quantityToReturn) {
  const ret = Number(quantityToReturn);

  if (!Number.isFinite(ret) || ret <= 0) {
    console.error(`Invalid return quantity for "${itemName}".`);
    return null;
  }

  let item = null;

  const nameRegex = new RegExp(`^${itemName.trim()}$`, "i");
  const specFilter = itemSpecs && itemSpecs.trim()
  ? new RegExp(`^${itemSpecs.trim()}$`, "i")
  : null;


  // Equipment
  item = await Equipment.findOne(
    specFilter
    ? { itemName: nameRegex, specification: specFilter }
    : { itemName: nameRegex }
  );

  // Glassware
  if (!item) {
    item = await Glassware.findOne(
      specFilter
      ? { itemName: nameRegex, description: specFilter }
      : { itemName: nameRegex }
    );
  }

  // Chemical
  if (!item) {
    item = await Chemical.findOne(
      specFilter
        ? { chemicalName: nameRegex, $or: [{ casNumber: specFilter }, { containerSize: specFilter }] }
        : { chemicalName: nameRegex }
    );
  }

  if (!item) {
    console.error(`RETURN FAILED: Item "${itemName}" (${itemSpecs}) not found.`);
    return null;
  }

  const current = Number(item.remainingQuantity);
  const maxQty = Number(item.quantity);

  if (!Number.isFinite(current) || !Number.isFinite(maxQty)) {
    console.error(`RETURN FAILED: "${itemName}" has invalid inventory values.`);
    return null;
  }

  item.remainingQuantity = current + ret;

  // Cap at original quantity
  if (item.remainingQuantity > maxQty) {
    item.remainingQuantity = maxQty;
  }

  await item.save();
  return item;
}


function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ message: "No token" });
  const token = header.split(" ")[1];
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
}
function requireAdmin(req, res, next) {
  if (req.user.role === "admin" || req.user.role === "superadmin") return next();
  return res.status(403).json({ message: "Admin required" });
}
function requireSuper(req, res, next) {
  if (req.user.role === "superadmin") return next();
  return res.status(403).json({ message: "Super admin required" });
}
function authStudent(req, res, next) {
  // 1. Run generic authentication first
  authMiddleware(req, res, () => {
    // 2. Check the role only after token verification succeeds
    if (req.user && req.user.role === "student") {
      return next();
    }
    return res.status(403).json({ message: "Student authentication required." });
  });
}

// ===== BARCODE GENERATION =====
app.get("/api/barcode/:value", async (req, res) => {
  try {
    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text: req.params.value,
      scale: 3,
      height: 10,
      includetext: true,
      textxalign: 'center',
    });

    res.type('png');
    res.send(png);
  } catch (err) {
    console.error("Barcode error:", err);
    res.status(500).send("Barcode generation failed");
  }
});


// Get all experiments
app.get("/api/admin/experiments", authMiddleware, requireAdmin, async (req, res) => {
  const experiments = await Experiment.find().sort({ createdAt: -1 });
  res.json({ experiments });
});

// Create experiment
app.post("/api/admin/experiments", authMiddleware, requireAdmin, async (req, res) => {
  const { name, course, description } = req.body;
  if (!name) return res.status(400).json({ message: "Name required" });
  const exp = await Experiment.create({ name, course, description, materials: [] });
  res.json({ message: "Experiment created", experiment: exp });
});

// Delete experiment
app.delete("/api/admin/experiments/:id", authMiddleware, requireAdmin, async (req, res) => {
  await Experiment.findByIdAndDelete(req.params.id);
  res.json({ message: "Deleted" });
});

// Add material to experiment
app.post("/api/admin/experiments/:id/materials", authMiddleware, requireAdmin, async (req, res) => {
  const { item, specs, qty } = req.body;
  const exp = await Experiment.findById(req.params.id);
  if (!exp) return res.status(404).json({ message: "Experiment not found" });
  exp.materials.push({ item, specs, qty });
  await exp.save();
  res.json({ message: "Material added", experiment: exp });
});


// ===== INVENTORY ROUTES =====
// ====== EQUIPMENT =====
app.get("/api/admin/equipment", async (req, res) => {
  try {
    const items = await Equipment.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: "Error fetching equipment" });
  }
});

app.post("/api/admin/equipment", async (req, res) => {
  try {
    req.body.remainingQuantity = req.body.quantity;
    const newItem = new Equipment(req.body);
    await newItem.save();
    res.json({ message: "Equipment added", newItem });
  } catch (err) {
    res.status(500).json({ message: "Error adding equipment" });
  }
});

app.put("/api/admin/equipment/:id", async (req, res) => {
  try {
    if (req.body.quantity) {
      req.body.remainingQuantity = req.body.quantity; 
    }
    const updated = await Equipment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: "Equipment updated", updated });
  } catch (err) {
    res.status(500).json({ message: "Error updating equipment" });
  }
});

app.delete("/api/admin/equipment/:id", async (req, res) => {
  try {
    await Equipment.findByIdAndDelete(req.params.id);
    res.json({ message: "Equipment deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting equipment" });
  }
});

// ====== CHEMICALS =====
// 🔍 GET CHEMICAL BY BARCODE
app.get("/api/admin/chemicals/barcode/:barcode", async (req, res) => {
  try {
    const barcode = String(req.params.barcode).trim();

    console.log("🔎 SCANNED BARCODE:", barcode);

    const chemical = await Chemical.findOne({ barcode });

    if (!chemical) {
      return res.status(404).json({ message: "Chemical not found" });
    }

    res.json(chemical);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});


app.get("/api/admin/chemicals", async (req, res) => {
  try {
    const items = await Chemical.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: "Error fetching chemicals" });
  }
});


app.post("/api/admin/chemicals", async (req, res) => {
  try {
    if (!req.body.barcode || req.body.barcode.trim() === "") {
      req.body.barcode = `CHEM-${Date.now()}`;
    }else {
      // CHECK FOR DUPLICATE BARCODE before attempting to save
      const existingBarcode = await Chemical.findOne({ barcode: req.body.barcode.trim() });
      if (existingBarcode) {
        return res.status(409).json({ 
          message: `Barcode "${req.body.barcode}" is already in use by: ${existingBarcode.chemicalName || "another chemical"}.`
        });
      }
    }
    req.body.remainingQuantity = req.body.quantity;
    const newItem = new Chemical(req.body);
    await newItem.save();

    res.json({
      message: "Chemical added",
      newItem,
      barcode: newItem.barcode
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "A chemical with this barcode already exists." });
    }
    res.status(500).json({ message: "Error adding chemical" });
  }
});


app.put("/api/admin/chemicals/:id", async (req, res) => {
  try {
    // CHECK FOR DUPLICATE BARCODE on edit (exclude the current item being edited)
    if (req.body.barcode && req.body.barcode.trim() !== "") {
      const existingBarcode = await Chemical.findOne({ 
        barcode: req.body.barcode.trim(),
        _id: { $ne: req.params.id }
      });
      if (existingBarcode) {
        return res.status(409).json({ 
          message: `Barcode "${req.body.barcode}" is already in use by: ${existingBarcode.chemicalName || "another chemical"}.`
        });
      }
    }
    if (req.body.quantity) {
      req.body.remainingQuantity = req.body.quantity;
    }
    const updated = await Chemical.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: "Chemical updated", updated });
  } catch (err) {
    res.status(500).json({ message: "Error updating chemical" });
  }
});

app.delete("/api/admin/chemicals/:id", async (req, res) => {
  try {
    await Chemical.findByIdAndDelete(req.params.id);
    res.json({ message: "Chemical deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting chemical" });
  }
});

// ====== GLASSWARE =====
app.get("/api/admin/glassware", async (req, res) => {
  try {
    const items = await Glassware.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: "Error fetching glassware" });
  }
});

app.post("/api/admin/glassware", async (req, res) => {
  try {
    req.body.remainingQuantity = req.body.quantity;
    const newItem = new Glassware(req.body);
    await newItem.save();
    res.json({ message: "Glassware added", newItem });
  } catch (err) {
    res.status(500).json({ message: "Error adding glassware" });
  }
});

app.put("/api/admin/glassware/:id", async (req, res) => {
  try {
    if (req.body.quantity) {
      req.body.remainingQuantity = req.body.quantity;
    }
    const updated = await Glassware.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: "Glassware updated", updated });
  } catch (err) {
    res.status(500).json({ message: "Error updating glassware" });
  }
});

app.delete("/api/admin/glassware/:id", async (req, res) => {
  try {
    await Glassware.findByIdAndDelete(req.params.id);
    res.json({ message: "Glassware deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting glassware" });
  }
});

// ====== FIXED ASSETS =====
app.get("/api/admin/fixed-assets", async (req, res) => {
  try {
    const items = await FixedAsset.find();
    res.json(items);
  } catch (err) {
    res.status(500).json({ message: "Error fetching fixed assets" });
  }
});

app.post("/api/admin/fixed-assets", async (req, res) => {
  try {
    const newItem = new FixedAsset(req.body);
    await newItem.save();
    res.json({ message: "Fixed asset added", newItem });
  } catch (err) {
    res.status(500).json({ message: "Error adding fixed asset" });
  }
});

app.put("/api/admin/fixed-assets/:id", async (req, res) => {
  try {
    const updated = await FixedAsset.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ message: "Fixed asset updated", updated });
  } catch (err) {
    res.status(500).json({ message: "Error updating fixed asset" });
  }
});

app.delete("/api/admin/fixed-assets/:id", async (req, res) => {
  try {
    await FixedAsset.findByIdAndDelete(req.params.id);
    res.json({ message: "Fixed asset deleted" });
  } catch (err) {
    res.status(500).json({ message: "Error deleting fixed asset" });
  }
});

// ====== ADD QUANTITY (New Delivery) ======
app.patch("/api/admin/:category/:id/add-quantity", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { category, id } = req.params;
    const { quantityToAdd } = req.body;

    const qty = Number(quantityToAdd);
    if (!Number.isFinite(qty) || qty <= 0) {
      return res.status(400).json({ message: "Please provide a valid quantity greater than 0." });
    }

    let Model;
    if (category === "equipment") Model = Equipment;
    else if (category === "chemicals") Model = Chemical;
    else if (category === "glassware") Model = Glassware;
    else if (category === "fixed-assets") Model = FixedAsset;
    else return res.status(400).json({ message: "Invalid category." });

    const item = await Model.findById(id);
    if (!item) return res.status(404).json({ message: "Item not found." });

    item.quantity = (Number(item.quantity) || 0) + qty;
    item.remainingQuantity = (Number(item.remainingQuantity) || 0) + qty;
    await item.save();

    res.json({ message: `Added ${qty} unit(s) to stock.`, item });
  } catch (err) {
    console.error("Add quantity error:", err);
    res.status(500).json({ message: "Error updating quantity." });
  }
});


// ===== DASHBOARD API =====
// Added authMiddleware and requireAdmin to secure the route!
app.get("/api/admin/dashboard", authMiddleware, requireAdmin, async (req, res) => {
  try {
    // Calculate Total Materials 
    const totalEquipmentResult = await Equipment.aggregate([{ $group: { _id: null, total: { $sum: "$quantity" } } }]);
    const totalChemicalsResult = await Chemical.aggregate([{ $group: { _id: null, total: { $sum: "$quantity" } } }]);
    const totalGlasswareResult = await Glassware.aggregate([{ $group: { _id: null, total: { $sum: "$quantity" } } }]);
    const totalFixedResult = await FixedAsset.aggregate([{ $group: { _id: null, total: { $sum: "$quantity" } } }]);

    const totalMaterials =
      (totalEquipmentResult[0]?.total || 0) +
      (totalChemicalsResult[0]?.total || 0) +
      (totalGlasswareResult[0]?.total || 0) +
      (totalFixedResult[0]?.total || 0);

    // Calculate Available Materials 
    const availableEquipment = await Equipment.aggregate([{ $group: { _id: null, total: { $sum: "$remainingQuantity" } } }]);
    const availableChemicals = await Chemical.aggregate([{ $group: { _id: null, total: { $sum: "$remainingQuantity" } } }]);
    const availableGlassware = await Glassware.aggregate([{ $group: { _id: null, total: { $sum: "$remainingQuantity" } } }]);
    const availableFixed = await FixedAsset.aggregate([{ $group: { _id: null, total: { $sum: "$quantity" } } }]);

    const availableMaterials =
      (availableEquipment[0]?.total || 0) +
      (availableChemicals[0]?.total || 0) +
      (availableGlassware[0]?.total || 0) +
      (availableFixed[0]?.total || 0);

    const lowStockEquipment = await Equipment.countDocuments({ remainingQuantity: { $lte: 3 } });
    const lowStockChemicals = await Chemical.countDocuments({ remainingQuantity: { $lte: 3 } });
    const lowStockGlassware = await Glassware.countDocuments({ remainingQuantity: { $lte: 3 } });
    const lowStockFixed = await FixedAsset.countDocuments({ quantity: { $lte: 3 } });

    const lowStock = lowStockEquipment + lowStockChemicals + lowStockGlassware + lowStockFixed;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const borrowedToday = await Borrowed.countDocuments({ borrowedAt: { $gte: today } });
    const recentBorrowedRaw = await Borrowed.find()
      .populate("studentId", "fullName")
      .populate("experimentId", "name")
      .sort({ createdAt: -1 })
      .limit(5);
    
    const recentBorrowed = recentBorrowedRaw.map(b => ({
      studentName: b.studentId?.fullName || "Unknown Student",
      materialName: b.experimentId?.name || b.experimentName || "Unknown Material",
      borrowedAt: b.borrowedAt,
    }));

    const brokenReports = await Breakage.countDocuments({ 
        reportedAt: { $gte: today }, 
        violation: /broken|damaged|lost/i 
    });
    const pendingStudents = await Student.countDocuments({ status: "pending" });
    
    const recentBreakagesRaw = await Breakage.find().sort({ reportedAt: -1 }).limit(5).lean();
    
    const recentAccountability = await Promise.all(recentBreakagesRaw.map(async b => {
      const student = await Student.findOne({ labID: b.labID }).select('fullName');
      return {
        ...b,
        studentName: student ? student.fullName : 'Unknown Student',
      };
    }));

    const appointments = await Appointment.find().sort({ createdAt: -1 }).limit(10);

    // ===== Notifications & Approvals =====
    const urgentNotificationsRaw = await Breakage.find({ violation: /critical|urgent|broken/i })
      .select("item violation labID")
      .limit(5).lean();

    const urgentNotifications = await Promise.all(urgentNotificationsRaw.map(async n => {
      const student = await Student.findOne({ labID: n.labID }).select('fullName');
      const sName = student ? student.fullName : 'Unknown Student';
      return {
        ...n,
        studentName: sName,
        displayText: `${n.item} (${n.violation.toUpperCase()}) - ${sName}` 
      };
    }));

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfWeek = new Date();
    endOfWeek.setDate(startOfToday.getDate() + 7);
    endOfWeek.setHours(23, 59, 59, 999);

    const weeklyRemindersRaw = await Appointment.find({ 
        date: { $gte: startOfToday, $lte: endOfWeek } 
    }).sort({ date: 1, timeSlot: 1 }).lean(); 

    // FIX: Properly handle studentId, guestId, and manual studentName entries
    const todayReminders = await Promise.all(weeklyRemindersRaw.map(async a => {
      let sName = 'Unknown User';
      
      if (a.studentId) {
        const student = await Student.findById(a.studentId).select('fullName');
        if (student) sName = student.fullName;
      } else if (a.guestId) {
        const guest = await Guest.findById(a.guestId).select('fullName');
        if (guest) sName = guest.fullName;
      } else if (a.studentName) {
        sName = a.studentName; // Fallback for manual face-to-face entries
      }
      
      const dateObj = new Date(a.date);
      const isToday = new Date().toDateString() === dateObj.toDateString();
      const dateLabel = isToday ? "Today" : dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      let displayTime = a.timeSlot || null ;
      
      if (!displayTime && a.date) {
        displayTime = dateObj.toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: true 
        });
      }

      displayTime = displayTime || 'TBD';
      return {
        ...a,
        studentName: sName,
        displayText: `[${dateLabel}] ${displayTime} | ${a.purpose} - ${sName}`
      };
    }));

    const pendingApprovals = await Student.find({ status: "pending" })
      .select("fullName")
      .limit(5);

    res.json({
      totalMaterials,
      availableMaterials,
      borrowedToday,
      brokenReports,
      pendingStudents,
      lowStock,
      recentBorrowed,
      recentAccountability,
      appointments,
      urgentNotifications,
      todayReminders,
      pendingApprovals
    });
  } catch (err) {
    console.error("Dashboard Error:", err);
    res.status(500).json({ message: "Error loading dashboard" });
  }
});

// ====== REPORTS API ======
app.get("/api/admin/reports", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { type, from, to } = req.query;

    const fromDate = from ? new Date(from) : new Date("2000-01-01");
    const toDate   = to   ? new Date(to)   : new Date();
    toDate.setHours(23, 59, 59, 999);

    // ── INVENTORY SUMMARY ──────────────────────────────────────────────────
    if (type === "inventory" || !type) {
      const [eq, ch, gl, fa] = await Promise.all([
        Equipment.find().lean(),
        Chemical.find().lean(),
        Glassware.find().lean(),
        FixedAsset.find().lean()
      ]);

      const summarize = (arr, nameFn) => ({
        items: arr.map(i => ({
          name:      nameFn(i),
          specs:     i.specification || i.description || i.containerSize || "",
          total:     i.quantity      || 0,
          remaining: i.remainingQuantity ?? i.quantity ?? 0,
          location:  i.location || "",
          status:    (i.remainingQuantity ?? i.quantity ?? 0) <= 3 ? "Low Stock" : "OK"
        })),
        totalQty:     arr.reduce((s, i) => s + (Number(i.quantity) || 0), 0),
        remainingQty: arr.reduce((s, i) => s + (Number(i.remainingQuantity ?? i.quantity) || 0), 0),
        lowStockCount: arr.filter(i => (Number(i.remainingQuantity ?? i.quantity) || 0) <= 3).length
      });

      return res.json({
        type: "inventory",
        equipment:   summarize(eq,  i => i.itemName      || ""),
        chemicals:   summarize(ch,  i => i.chemicalName  || ""),
        glassware:   summarize(gl,  i => i.itemName      || ""),
        fixedAssets: summarize(fa,  i => i.itemName      || ""),
        generatedAt: new Date()
      });
    }

    // ── BORROW ACTIVITY ────────────────────────────────────────────────────
    if (type === "borrow") {
      const borrows = await Borrowed.find({
        borrowedAt: { $gte: fromDate, $lte: toDate }
      })
        .populate("studentId", "fullName labID email")
        .populate("experimentId", "name")
        .lean();

      const rows = borrows.map(b => ({
        studentName:    b.studentId?.fullName  || "Unknown",
        labID:          b.studentId?.labID     || "—",
        email:          b.studentId?.email     || "—",
        experiment:     b.experimentId?.name   || b.experimentName || "—",
        materialsCount: b.materialsUsed?.length || 0,
        status:         b.status,
        borrowedAt:     b.borrowedAt,
        returnedAt:     b.returnedAt || null,
        dueDate:        b.dueDate    || null
      }));

      const summary = {
        total:    rows.length,
        pending:  rows.filter(r => r.status === "pending").length,
        borrowed: rows.filter(r => r.status === "borrowed").length,
        returned: rows.filter(r => r.status === "returned").length,
        rejected: rows.filter(r => r.status === "rejected").length
      };

      return res.json({ type: "borrow", summary, rows, generatedAt: new Date() });
    }

    // ── APPOINTMENTS ───────────────────────────────────────────────────────
    if (type === "appointments") {
      const appts = await Appointment.find({
        date: { $gte: fromDate, $lte: toDate }
      })
        .populate("studentId", "fullName email")
        .populate("guestId",   "fullName email")
        .lean();

      const rows = appts.map(a => ({
        name:     a.studentId?.fullName || a.guestId?.fullName || a.studentName || "Manual Entry",
        type:     a.guestId ? "Guest" : (a.studentId ? "Student" : "Manual"),
        purpose:  a.purpose || "—",
        date:     a.date,
        timeSlot: a.timeSlot || "—",
        status:   a.status,
        cys:      a.cys || "—"
      }));

      const summary = {
        total:    rows.length,
        pending:  rows.filter(r => r.status === "pending").length,
        approved: rows.filter(r => r.status === "approved").length,
        accepted: rows.filter(r => r.status === "accepted").length,
        returned: rows.filter(r => r.status === "returned").length,
        rejected: rows.filter(r => r.status === "rejected").length
      };

      return res.json({ type: "appointments", summary, rows, generatedAt: new Date() });
    }

    // ── BREAKAGE / ACCOUNTABILITY ──────────────────────────────────────────
    if (type === "breakage") {
      const reports = await Breakage.find({
        reportedAt: { $gte: fromDate, $lte: toDate }
      }).lean();

      const enriched = await Promise.all(reports.map(async b => {
        const student = await Student.findOne({ labID: b.labID }).select("fullName email").lean();
        return {
          labID:      b.labID,
          studentName: student?.fullName || "Unknown",
          email:      student?.email || "—",
          item:       b.item,
          category:   b.category || "—",
          qty:        b.quantityBroken || 1,
          violation:  b.violation,
          remarks:    b.remarks || "—",
          status:     b.status,
          reportedAt: b.reportedAt
        };
      }));

      const summary = {
        total:      enriched.length,
        unresolved: enriched.filter(r => r.status !== "resolved").length,
        resolved:   enriched.filter(r => r.status === "resolved").length,
        totalQtyBroken: enriched.reduce((s, r) => s + r.qty, 0)
      };

      return res.json({ type: "breakage", summary, rows: enriched, generatedAt: new Date() });
    }

    // ── STUDENT ACTIVITY ───────────────────────────────────────────────────
    if (type === "students") {
      const students = await Student.find({ status: "active" }).lean();

      const rows = await Promise.all(students.map(async s => {
        const borrowCount  = await Borrowed.countDocuments({ studentId: s._id });
        const breakageCount = await Breakage.countDocuments({ labID: s.labID });
        const apptCount    = await Appointment.countDocuments({ studentId: s._id });
        return {
          fullName:      s.fullName,
          labID:         s.labID,
          email:         s.email,
          cys:           s.cys,
          professor:     s.professor,
          classSchedule: s.classSchedule,
          borrows:       borrowCount,
          breakages:     breakageCount,
          appointments:  apptCount,
          registeredAt:  s.createdAt
        };
      }));

      return res.json({
        type: "students",
        totalActive: rows.length,
        rows,
        generatedAt: new Date()
      });
    }

    return res.status(400).json({ message: "Invalid report type. Use: inventory, borrow, appointments, breakage, students" });

  } catch (err) {
    console.error("Reports error:", err);
    res.status(500).json({ message: "Error generating report" });
  }
});




// ====== ROUTES ======
//Guest Route
// Dedicated route for anyone to view inventory items
app.get("/api/inventory/search", authMiddleware, async (req, res) => {
    try {
        const { category } = req.query;
        let items = [];
        if (category === "equipment") items = await Equipment.find({});
        else if (category === "chemical") items = await Chemical.find({});
        else if (category === "glassware") items = await Glassware.find({});
        res.json(items);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Guest Registration
app.post("/api/guest/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
       // --- Password validation ---
    const passwordRegex = /^(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\-\\/]).{8,}$/;
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        message: "Password must be at least 8 characters, include an uppercase letter, a number, and a symbol." 
      });
    }
    
    const existing = await Guest.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already registered." });

    const passwordHash = await bcrypt.hash(password, 10);
    const guest = await Guest.create({ fullName, email, passwordHash });
    sendGuestRegistrationEmail({ to: email, fullName }).catch(err => console.error("Guest reg email error:", err))
    res.json({ message: "Guest account created successfully!" });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "This email is already registered." });
    }
    res.status(500).json({ message: "Error registering guest" });
  }
});

// Guest Login
app.post("/api/auth/guest/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const guest = await Guest.findOne({ email });
    
    if (!guest) return res.status(401).json({ message: "Invalid credentials" });
    
    const isMatch = await bcrypt.compare(password, guest.passwordHash);
    if (!isMatch) return res.status(401).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: guest._id, role: "guest", email: guest.email },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      token,
      fullName: guest.fullName,
      email: guest.email
    });
  } catch (err) {
    res.status(500).json({ message: "Server error during login" });
  }
});

// Guest books an appointment
app.post("/api/guest/appointments", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "guest") return res.status(403).json({ message: "Guest only" });

    const { date, timeSlot, purpose, itemsRequested, duration } = req.body;

    // --- VALIDATION START ---
    const selectedDate = new Date(date);
    const today = new Date();

    
    
    // Set today to midnight to allow bookings for the current day
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      return res.status(400).json({ message: "You cannot book an appointment for a past date." });
    }
    // --- VALIDATION END ---

    const appointment = await Appointment.create({
      guestId: req.user.id,
      date: selectedDate,
      timeSlot,
      purpose,
      itemsRequested,
      duration,
      status: "pending"
    });

    const guest = await Guest.findById(req.user.id).select("fullName email");
    if (guest) {
      sendGuestAppointmentConfirmEmail({ to: guest.email, fullName: guest.fullName, date: selectedDate, timeSlot, purpose, itemsRequested })
        .catch(err => console.error("Guest appt email error:", err));
    }

    res.json({ message: "Appointment request sent to Admin!", appointment });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error booking appointment" });
  }
});
// Guest views their own appointments
app.get("/api/guest/appointments", authMiddleware, async (req, res) => {
  const appointments = await Appointment.find({ guestId: req.user.id }).sort({ date: 1 });
  res.json(appointments);
});

// Get Guest Profile
app.get("/api/guest/me", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "guest") return res.status(403).json({ message: "Guest access only" });
    
    const guest = await Guest.findById(req.user.id).select("-passwordHash");
    if (!guest) return res.status(404).json({ message: "Guest not found" });
    
    res.json(guest);
  } catch (err) {
    res.status(500).json({ message: "Error fetching profile" });
  }
});

// Update Guest Profile
app.put("/api/guest/me", authMiddleware, async (req, res) => {
  try {
    const { fullName, currentPassword, newPassword } = req.body;
    const guest = await Guest.findById(req.user.id);

    if (fullName) guest.fullName = fullName;

    if (newPassword) {
      const isMatch = await bcrypt.compare(currentPassword, guest.passwordHash);
      if (!isMatch) return res.status(401).json({ message: "Current password incorrect" });
      guest.passwordHash = await bcrypt.hash(newPassword, 10);
    }

    await guest.save();
    res.json({ message: "Profile updated successfully" });
  } catch (err) {
    res.status(500).json({ message: "Update failed" });
  }
});

// Student Routes
// Student registration
app.post("/api/students/register", async (req, res) => {
  try {
    const { fullName, email, cys, professor, classSchedule, password } = req.body;
    if (!fullName || !email || !cys || !professor || !classSchedule || !password) {
      return res.status(400).json({ message: "Missing fields" });
    }

    //  Email Validation (Ensures it's a school email)
    // Replace 'dlsud.edu.ph' with your actual school domain
    if (!email.endsWith("@dlsud.edu.ph")) {
      return res.status(400).json({ message: "Please use your official school email (@dlsud.edu.ph)" });
    }

    const existing = await Student.findOne({ email });
    if (existing) {
      return res.status(409).json({ message: "This email is already registered. Please log in instead." });
    }

    //  Password Strength Regex: 
    // At least 8 chars, 1 uppercase, 1 lowercase, 1 number, and 1 special char
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&.\-_])[A-Za-z\d@$!%*?&.\-_]{8,}$/;
    
    if (!passwordRegex.test(password)) {
      return res.status(400).json({ 
        message: "Password must be at least 8 characters long, include uppercase, lowercase, a number, and a special character." 
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const student = await Student.create({ fullName, email, cys, professor, classSchedule, passwordHash });
    sendStudentRegistrationEmail({ to: email, fullName }).catch(err => console.error("Student reg email error:", err));
    res.json({ message: "Registered. Wait for Lab ID assignment.", id: student._id });
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return res.status(409).json({ message: "This email is already registered." });
    }
    res.status(500).json({ message: "Something went wrong. Please try again." });
  }
});

// Student login 
app.post("/api/auth/student/login", async (req, res) => {
  try {
    const { labID, password } = req.body;
    const student = await Student.findOne({ labID });
    if (!student) return res.status(401).json({ message: "Invalid Lab ID or password" });
    if (student.status !== "active") return res.status(403).json({ message: "Account not active yet" });

    const ok = await bcrypt.compare(password, student.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid Lab ID or password" });

    // Ensure a PolicyAgreement doc exists for this student 
    let agreement = await PolicyAgreement.findOne({ studentId: student._id });
    if (!agreement) {
      agreement = await PolicyAgreement.create({ studentId: student._id });
    }

    const token = jwt.sign(
      { id: student._id, role: "student", labID: student.labID },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    // Return token + policy status
    res.json({
      token,
      name: student.fullName,
      labID: student.labID,
      policyAgreed: agreement.agreed
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Student agrees to policy
app.post("/api/student/agree-policy", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ message: "Student only" });

    let agreement = await PolicyAgreement.findOne({ studentId: req.user.id });
    if (!agreement) agreement = await PolicyAgreement.create({ studentId: req.user.id });

    agreement.agreed = true;
    agreement.agreedAt = new Date();
    await agreement.save();

    res.json({ message: "Policy agreed successfully" });
  } catch (err) {
    console.error("Agree policy error:", err);
    res.status(500).json({ message: "Error saving agreement" });
  }
});

// get policy status 
app.get("/api/student/policy", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ message: "Student only" });

    let agreement = await PolicyAgreement.findOne({ studentId: req.user.id });
    if (!agreement) agreement = await PolicyAgreement.create({ studentId: req.user.id });

    res.json({ policyAgreed: agreement.agreed, agreedAt: agreement.agreedAt });
  } catch (err) {
    console.error("Get policy error:", err);
    res.status(500).json({ message: "Error fetching policy" });
  }
});

// Student update profile
app.put("/api/student/me", authStudent, async (req, res) => {
  try {
    const studentId = req.user.id;
    // ⚠️ IMPORTANT: Only allow updating safe fields.
    const { 
      fullName, 
      cys, 
      professor, 
      classSchedule,
      newPassword, // Include password update logic
      currentPassword // For password confirmation
    } = req.body;

    const student = await Student.findById(studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    const updateFields = {};

    // Update basic fields
    if (fullName) updateFields.fullName = fullName;
    if (cys) updateFields.cys = cys;
    if (professor) updateFields.professor = professor;
    if (classSchedule) updateFields.classSchedule = classSchedule;

    // Password Update Logic
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required to change password." });
      }
      
      // 1. Verify current password
      const isMatch = await bcrypt.compare(currentPassword, student.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ message: "Incorrect current password." });
      }

      // 2. Hash and set new password
      updateFields.passwordHash = await bcrypt.hash(newPassword, 10);
      
      // Clear currentPassword and newPassword from the object being saved
      delete req.body.newPassword;
      delete req.body.currentPassword;
    }

    //  Save the updates
    const updatedStudent = await Student.findByIdAndUpdate(
      studentId, 
      updateFields, 
      { new: true, runValidators: true }
    );

    res.json({ 
      message: "Profile updated successfully!",
      student: {
        fullName: updatedStudent.fullName,
        labID: updatedStudent.labID,
        cys: updatedStudent.cys,
        professor: updatedStudent.professor,
        classSchedule: updatedStudent.classSchedule,
        status: updatedStudent.status
      }
    });
  } catch (err) {
    console.error("Student profile update error:", err);
    res.status(500).json({ message: "Error updating profile" });
  }
});

// Get current student profile (Essential for loadProfile)
app.get("/api/student/me", authStudent, async (req, res) => {
    try {
        const student = await Student.findById(req.user.id).select('-passwordHash'); // Exclude the hash
        
        if (!student) {
            return res.status(404).json({ message: "Student not found." });
        }

        // Return the student data
        res.json({
            fullName: student.fullName,
            labID: student.labID,
            cys: student.cys,
            professor: student.professor,
            classSchedule: student.classSchedule,
            status: student.status
            // Note: If you added profilePictureUrl, you would include it here too.
        });
    } catch (err) {
        console.error("Student profile fetch error:", err);
        res.status(500).json({ message: "Error fetching student profile" });
    }
});

app.get("/api/student/me/breakages", authStudent, async (req, res) => {
  try {
    // The JWT sign process ensures req.user has { id, role, labID }
    const studentLabID = req.user.labID; // ⭐ Use req.user (set by authMiddleware)

    if (!studentLabID) {
      return res.status(400).json({ message: "Lab ID not found in token." });
    }

    // Breakage model is defined globally, so it's accessible here.
    const studentBreakages = await Breakage.find({ labID: studentLabID }).sort({ reportedAt: -1 });

    res.json(studentBreakages);

  } catch (err) {
    console.error("Error fetching student breakages:", err);
    res.status(500).json({ message: "Server error while fetching breakages." });
  }
});

// Get current student profile
app.get("/api/student/me", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") return res.status(403).json({ message: "Student only" });

    const student = await Student.findById(req.user.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    res.json({
      fullName: student.fullName,
      labID: student.labID,
      cys: student.cys,
      professor: student.professor,
      classSchedule: student.classSchedule,
      status: student.status
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching profile" });
  }
});

// Get all experiments for students
app.get("/api/student/experiments", authMiddleware, async (req, res) => {
  try {//
    if (req.user.role !== "student") return res.status(403).json({ message: "Student only" });

    const experiments = await Experiment.find().sort({ createdAt: -1 });
    res.json({ experiments });
  }catch(err){//
    console.error("Error fetching experiments:", err);
    res.status(500).json({message: "Error fetching experiments"});
  }
});

// Student borrow experiment
app.post("/api/student/borrow/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student")
      return res.status(403).json({ message: "Student only" });

    const student = await Student.findById(req.user.id);
    const experiment = await Experiment.findById(req.params.id);

    if (!experiment)
      return res.status(404).json({ message: "Experiment not found" });

    // Check if student already has a pending or active borrow for this experiment
    const existingBorrow = await Borrowed.findOne({
      studentId: student._id,
      experimentId: experiment._id,
      status: { $in: ["pending", "borrowed"] }
    });

    if (existingBorrow)
      return res.status(409).json({ message: "You already have a borrow request for this experiment." });

    const { materialsUsed } = req.body;

    if (!materialsUsed || !Array.isArray(materialsUsed) || materialsUsed.length === 0) {
      return res.status(400).json({ message: "No Materials selected for borrow" });
    }

    // ✅ Create new borrow record
    const borrow = await Borrowed.create({
      studentId: student._id,
      experimentId: experiment._id,
      experimentName: experiment.name,
      materialsUsed,
      status: "pending",  // default
      borrowedAt: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days later
    });

    res.json({ message: "Borrow request submitted successfully!", borrow });
  } catch (err) {
    console.error("Borrow error:", err);
    res.status(500).json({ message: "Error processing borrow request" });
  }
});


// ===== Admin approves a borrow request =====
app.put("/api/admin/borrow/:id/approve", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "superadmin"].includes(req.user.role)) {
      return res.status(403).json({ message: "Admin only" });
    }

    const borrow = await Borrowed.findById(req.params.id)
      .populate("studentId")
      .populate("experimentId");

    if (!borrow) {
      return res.status(404).json({ message: "Borrow request not found" });
    }

    if (borrow.status !== "pending") {
      return res.status(400).json({ message: "Borrow already processed" });
    }

    const experiment = borrow.experimentId;
    if (!experiment || !experiment.materials) {
      return res.status(400).json({ message: "Experiment materials missing" });
    }
    
    // ✅ 1. DECREMENT INVENTORY
    for (const mat of borrow.materialsUsed) {
      await findAndDecrementItem(mat.item, mat.specs || "", mat.qty);
    }

    // ✅ 2. GENERATE BARCODE VALUE
    const barcodePayload = JSON.stringify({
      borrowId: borrow._id,
      studentLabID: borrow.studentId.labID,
      studentName: borrow.studentId.fullName,
      experiment: experiment.name,
      approvedAt: new Date().toISOString()
    });

    // ✅ 3. GENERATE QR CODE IMAGE (BASE64)
    const qrImage = await QRCode.toDataURL(barcodePayload);

    // ✅ 4. UPDATE BORROW RECORD
    borrow.status = "borrowed";
    borrow.borrowedAt = new Date();
    borrow.dueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    borrow.barcodeValue = barcodePayload;
    borrow.barcodeImage = qrImage;

    await borrow.save();

    if (borrow.studentId?.email) {
      sendBorrowStatusEmail({
        to: borrow.studentId.email,
        fullName: borrow.studentId.fullName,
        experimentName: experiment.name,
        status: "borrowed",
        labID: borrow.studentId.labID
      }).catch(err => console.error("Approve email error:", err));
    }

    res.json({
      message: "Borrow approved. Barcode generated.",
      borrowId: borrow._id,
      barcodeImage: qrImage,
      barcodeValue: barcodePayload
    });

  } catch (err) {
    console.error("Approve borrow error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.get("/api/admin/borrow/:id/barcode", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const borrow = await Borrowed.findById(req.params.id);

    if (!borrow || !borrow.barcodeImage) {
      return res.status(404).json({ message: "Barcode not found" });
    }

    res.json({
      borrowId: borrow._id,
      barcodeImage: borrow.barcodeImage,
      barcodeValue: borrow.barcodeValue
    });

  } catch (err) {
    res.status(500).json({ message: "Error retrieving barcode" });
  }
});


// Reject borrow
app.put("/api/admin/borrow/:id/reject", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "superadmin")
      return res.status(403).json({ message: "Admin only/Superadmin only" });

    const borrow = await Borrowed.findById(req.params.id);
    if (!borrow) return res.status(404).json({ message: "Borrow request not found" });

    borrow.status = "rejected";
    await borrow.save();

    if (borrow.studentId?.email) {
      sendBorrowStatusEmail({
        to: borrow.studentId.email,
        fullName: borrow.studentId.fullName,
        experimentName: borrow.experimentName,
        status: "rejected",
        labID: borrow.studentId.labID
      }).catch(err => console.error("Reject email error:", err));
    }

    res.json({ message: "Borrow request rejected successfully", borrow });
  } catch (err) {
    console.error("Reject borrow error:", err);
    res.status(500).json({ message: "Error rejecting borrow" });
  }
});

app.post("/api/student/return", authMiddleware, async (req, res) => {
  try {
    const { category, itemId, item, specs, quantity } = req.body;

    if (!category || !quantity) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    let Model;
    if (category === "equipment") Model = Equipment;
    else if (category === "glassware") Model = Glassware;
    else if (category === "chemical") Model = Chemical;
    else return res.status(400).json({ message: "Invalid category." });

    // ✅ Try finding by ID first
    let itemDoc = null;
    if (itemId) {
      itemDoc = await Model.findById(itemId);
    }

    // ✅ Fallback: match by itemName + description
    if (!itemDoc && item && specs) {
      itemDoc = await Model.findOne({
        itemName: { $regex: new RegExp(`^${item}$`, "i") },
        description: { $regex: new RegExp(`^${specs}$`, "i") }
      });
    }

    if (!itemDoc) {
      console.error(`RETURN FAILED: Item "${item}" (Specs: ${specs}) not found.`);
      return res.status(404).json({
        message: `Item "${item}" (${specs}) not found in ${category} inventory.`,
      });
    }

    // ✅ Add back the returned quantity
    itemDoc.remainingQuantity += Number(quantity);
    if (itemDoc.remainingQuantity > itemDoc.quantity) {
      itemDoc.remainingQuantity = itemDoc.quantity; // Never exceed total
    }

    await itemDoc.save();

    res.json({
      message: `Returned successfully! ${quantity} ${item} (${specs}) added back.`,
      item: itemDoc,
    });
  } catch (err) {
    console.error("Return error:", err);
    res.status(500).json({ message: "Error processing return request." });
  }
});





// Student can see borrow
app.get("/api/student/me/borrowed", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "student") {
      return res.status(403).json({ message: "Student only" });
    }

    const borrows = await Borrowed.find({ studentId: req.user.id }).populate("experimentId");
    
    res.json({ borrowed: borrows });

  } catch (err) { 
    console.error("Error fetching student borrow list:", err);
    res.status(500).json({ message: "Error fetching borrow history" });
  }
});




// Admin login
app.post("/api/auth/admin/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    
    const ok = await bcrypt.compare(password, admin.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const token = jwt.sign(
      { id: admin._id, role: admin.role, email: admin.email },
      JWT_SECRET,
      { expiresIn: "8h" }
    );
    
    res.json({ token, role: admin.role, name: admin.name });

  } catch (err) { 
    console.error("Admin login error:", err);
    res.status(500).json({ message: "Server error during login" });
  }
});

// Get current Admin profile
app.get("/api/admin/me", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select("-passwordHash");
    if (!admin) return res.status(404).json({ message: "Admin not found" });
    res.json(admin);
  } catch (err) {
    console.error("Admin profile fetch error:", err);
    res.status(500).json({ message: "Error fetching admin profile" });
  }
});

// Admin update profile
app.put("/api/admin/me", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const adminId = req.user.id;
    // ⚠️ IMPORTANT: Only allow updating safe fields. Role must be protected.
    const { 
      name, 
      email, 
      newPassword, // Include password update logic
      currentPassword // For password confirmation
    } = req.body;

    const admin = await Admin.findById(adminId);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    const updateFields = {};

    // Update basic fields
    if (name) updateFields.name = name;
    if (email) updateFields.email = email;

    // Password Update Logic (Similar to student)
    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({ message: "Current password is required to change password." });
      }
      
      // 1. Verify current password
      const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
      if (!isMatch) {
        return res.status(401).json({ message: "Incorrect current password." });
      }

      // 2. Hash and set new password
      updateFields.passwordHash = await bcrypt.hash(newPassword, 10);
      
      // Clear currentPassword and newPassword from the object being saved
      delete req.body.newPassword;
      delete req.body.currentPassword;
    }

    // ⭐ Save the updates
    const updatedAdmin = await Admin.findByIdAndUpdate(
      adminId, 
      updateFields, 
      { new: true, runValidators: true, select: "-passwordHash" } // Exclude hash from response
    );

    res.json({ 
      message: "Admin profile updated successfully!",
      admin: updatedAdmin
    });
  } catch (err) {
    // Handle potential duplicate key error (if email is changed to one that already exists)
    if (err.code === 11000) {
      return res.status(409).json({ message: "This email is already in use by another account." });
    }
    console.error("Admin profile update error:", err);
    res.status(500).json({ message: "Error updating admin profile" });
  }
});



// Get all borrowed experiments (admin view)
app.get("/api/admin/borrowed", authMiddleware, requireAdmin, async (req, res) => {
  try { 
    const borrows = await Borrowed.find() 
      .populate("studentId", "fullName labID")
      .populate("experimentId", "name");

    const formatted = borrows.map(b => ({
      _id: b._id,
      student: b.studentId ? b.studentId.fullName : "Unknown",
      material: b.experimentId ? b.experimentId.name : b.experimentName,
      date: b.borrowedAt,
      status: b.status
    }));

    res.json({ borrowed: formatted });

  } catch (err) { 
    console.error("Error fetching all borrowed items:", err);
    res.status(500).json({ message: "Error fetching borrow history" });
  }
});



// ===== Update borrow status (unified) =====
app.put("/api/admin/borrowed/:id/status", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { status } = req.body;
    
    // FIX 1: Use correct model name
    const borrow = await Borrowed.findById(req.params.id).populate("experimentId");
    
    if (!borrow) {
      return res.status(404).json({ message: "Borrow record not found" });
    }

    if (!["borrowed", "returned", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    // If the status is already set, do nothing.
    if (borrow.status === status) {
      return res.status(200).json({ message: `Status is already ${status}`, borrow });
    }

    if (status === "borrowed" && borrow.status === "pending") {
      if (!borrow.experimentId || !borrow.experimentId.materials) {
        return res.status(400).json({ message: "Experiment details or materials list not found" });
      }
      
      const materialsToBorrow = borrow.materialsUsed;
      
      for (const mat of materialsToBorrow) {
        await findAndDecrementItem(mat.item, mat.specs || "", mat.qty);
      }
      
      borrow.borrowedAt = new Date(); // Set the "borrowed" time

    } else if (status === "returned" && borrow.status === "borrowed") {
      if (!borrow.experimentId || !borrow.experimentId.materials) {
        return res.status(400).json({ message: "Experiment details or materials list not found" });
      }
      
      const materialsToReturn = borrow.materialsUsed;
      
      for (const mat of materialsToReturn) {
        await findAndIncrementItem(mat.item, mat.specs || "", mat.qty);
      }
      
      borrow.returnedAt = new Date(); // Set the "returned" time

    } else if (status === "rejected" && borrow.status !== "pending") {
        return res.status(400).json({ message: "Can only reject 'pending' requests" });
    }

    borrow.status = status;
    await borrow.save();

    const populatedBorrow = await Borrowed.findById(borrow._id).populate("studentId", "fullName email labID");
    if (populatedBorrow?.studentId?.email) {
      sendBorrowStatusEmail({
        to: populatedBorrow.studentId.email,
        fullName: populatedBorrow.studentId.fullName,
        experimentName: borrow.experimentId?.name || borrow.experimentName,
        status,
        labID: populatedBorrow.studentId.labID
      }).catch(err => console.error("Borrow status email error:", err));
    }

    res.json({ message: `Borrow status updated to ${status}`, borrow });

  } catch (err) {
    console.error("Update borrow status error:", err);
    if (err.message.startsWith("Not enough stock") || err.message.startsWith("Inventory item")) {
      return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Error updating borrow status" });
  }
});


// ===== STUDENT UTILITY ROUTES (For Dropdown Population) =====

// READ ALL Students (LabID and Name for dropdown)
app.get("/api/admin/students/list", authMiddleware, requireAdmin, async (req, res) => {
  try {
    // Only fetch the necessary fields: labID and name for the dropdown
    const students = await Student.find().select("labID fullName");
    
    // Transform the data if needed, or send as-is
    res.json(students);
  } catch (err) {
    console.error("Fetch students list error:", err);
    res.status(500).json({ message: err.message });
  }
});

// ===== BREAKAGE / ACCOUNTABILITY ROUTES =====

// CREATE
app.post("/api/admin/breakages", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { 
      labID, 
      category,     // 'equipment', 'glassware', or 'chemical'
      itemId,       // The _id of the item that broke
      quantityBroken, // How many broke (e.g., 1)
      violation, 
      remarks 
    } = req.body;

    // --- 1. Validate the Student ---
    const student = await Student.findOne({ labID });
    if (!student) {
      return res.status(404).json({ message: "Lab ID not found in system" });
    }
    
    // --- 2. Find and Decrement the Item from Inventory ---
    let Model;
    if (category === "equipment") Model = Equipment;
    else if (category === "glassware") Model = Glassware;
    else if (category === "chemical") Model = Chemical;
    else {
      return res.status(400).json({ message: "Invalid item category" });
    }

    const item = await Model.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found in inventory" });
    }

    // Decrement the stock
    item.remainingQuantity -= quantityBroken;
    
    // Safety check: don't let stock go below zero
    if (item.remainingQuantity < 0) {
      item.remainingQuantity = 0;
    }
    await item.save();

    // --- 3. Create the Breakage Log ---
    // We save the item name in the report for easy reading
    const newReport = new Breakage({ 
      labID, 
      item: item.itemName || item.chemicalName, // Save the name for the log
      violation, 
      remarks,
      status: "unresolved", // Use the status field from your schema
      quantityBroken: Number(quantityBroken), // Ensure it's stored as a number
      category,
      itemId
    });
    
    await newReport.save();
    
    res.json({ 
      message: "Breakage report added and inventory updated", 
      newReport 
    });

  } catch (err) {
    console.error("Create breakage error:", err);
    res.status(500).json({ message: err.message });
  }
});


// READ ALL (no populate needed now)
app.get("/api/admin/breakages", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const reports = await Breakage.find().sort({ reportedAt: -1 });
    res.json(reports);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


// UPDATE
// UPDATE
app.put("/api/admin/breakages/:id", async (req, res) => {
  try {
    const { item, violation, remarks, category, itemId, quantityBroken } = req.body;

    const existing = await Breakage.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: "Breakage not found" });

    // If a new quantity and item info is provided, adjust the inventory difference
    if (quantityBroken !== undefined && category && itemId) {
      let Model;
      if (category === "equipment") Model = Equipment;
      else if (category === "glassware") Model = Glassware;
      else if (category === "chemical") Model = Chemical;

      if (Model) {
        const inventoryItem = await Model.findById(itemId);
        if (inventoryItem) {
          const oldQty = existing.quantityBroken || 0;
          const newQty = Number(quantityBroken);
          const diff = newQty - oldQty; // positive = more broken, negative = restored

          inventoryItem.remainingQuantity = Math.max(0, inventoryItem.remainingQuantity - diff);
          await inventoryItem.save();
        }
      }
    }

    const updated = await Breakage.findByIdAndUpdate(
      req.params.id,
      { 
        item, 
        violation, 
        remarks,
        ...(quantityBroken !== undefined && { quantityBroken: Number(quantityBroken) })
      },
      { new: true }
    );

    res.json({ message: "Breakage updated", updated });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// DELETE
app.delete("/api/admin/breakages/:id", async (req, res) => {
  try {
    await Breakage.findByIdAndDelete(req.params.id);
    res.json({ message: "Breakage deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// MARK AS RESOLVED
app.patch("/api/admin/breakages/:id/resolve", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const updated = await Breakage.findByIdAndUpdate(
      req.params.id,
      { status: "resolved" }, // <-- FIX: Use lowercase for consistency
      { new: true, runValidators: true } // Added validation
    );

    if (!updated) {
      return res.status(44).json({ message: "Breakage report not found" });
    }

    res.json({ message: "Marked as resolved", updated });

  } catch (err) {
    console.error("Resolve breakage error:", err);
    res.status(500).json({ message: err.message });
  }
});

app.patch("/api/admin/breakages/:id/unresolve", authMiddleware, async (req, res) => {
    try {
        const breakage = await Breakage.findByIdAndUpdate(
            req.params.id,
            { status: "pending" },
            { new: true }
        );
        if (!breakage) return res.status(404).json({ message: "Report not found" });
        res.json({ message: "Marked as unresolved", breakage });
    } catch (err) {
        res.status(500).json({ message: "Error updating report" });
    }
});

// Get all appointments (admin)
app.get("/api/admin/appointments", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const appointments = await Appointment.find()
      .populate("studentId", "fullName email")
      .populate("guestId", "fullName email") // ADD THIS LINE
      .sort({ date: -1 }); // Changed to -1 to show newest first
    res.json({ appointments });
  } catch (err) {
    res.status(500).json({ message: "Error fetching appointments" });
  }
});


// Create new appointment
// Admin Manual Appointment Entry
app.post("/api/admin/appointments", authMiddleware, async (req, res) => {
    try {
        // Guard: Only admins should be able to create manual appointments
        if (!req.user || !req.user.role) {
    return res.status(401).json({ message: "Unauthorized. Please log in again." });
}

const allowedRoles = ["admin", "superadmin"];
if (!allowedRoles.includes(req.user.role)) {
    return res.status(403).json({ message: "Access denied. Admin or Superadmin only." });
}

        const { studentName, cys, purpose, itemsRequested, date, status } = req.body;

        // 1. Create and save the appointment record
        const appointment = new Appointment({
            studentName,
            cys,
            purpose,
            itemsRequested, // This is the JSON string from our frontend
            date: new Date(date),
            status: status || "pending"
        });

        // 2. INVENTORY LOGIC: Deduct items if the appointment is already "Approved" or "Accepted"
        // We only deduct if the admin sets the status to one that implies the items are being handed out.
        if (status === "approved" || status === "accepted") {
            try {
                const items = JSON.parse(itemsRequested || "[]");
                
                // Loop through each selected item and update the database
                for (const item of items) {
                    // This calls the helper function we built previously
                    await findAndDecrementItem(item.item, item.specs, item.qty);
                }
            } catch (parseErr) {
                console.error("Error parsing items for inventory deduction:", parseErr);
                // We don't stop the save, but we log the error
            }
        }

        await appointment.save();
        res.status(201).json({ message: "Appointment added and inventory updated.", appointment });

    } catch (err) {
        console.error("Error in Admin Appointment Post:", err);
        res.status(400).json({ message: err.message });
    }
});


// Update appointment status
app.put("/api/admin/appointments/:id/status", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { status, rejectionReason } = req.body;
    
    // Validate including 'accepted'
    if (!["pending", "approved", "accepted", "rejected", "returned"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const appointment = await Appointment.findById(req.params.id)
      .populate("studentId", "fullName email") 
      .populate("guestId", "fullName email"); // For inventory and notifications;
    if (!appointment) return res.status(404).json({ message: "Appointment not found" });

    if (appointment.status === status) {
        return res.status(400).json({ message: `Status is already ${status}` });
    }

    // --- INVENTORY LOGIC ---
    if (appointment.itemsRequested && appointment.itemsRequested.startsWith('[')) {
        const materials = JSON.parse(appointment.itemsRequested);

            // ✅ APPROVE: Check stock availability WITHOUT decrementing
        if (status === "approved" && appointment.status === "pending") {
            for (const mat of materials) {
                const need = Number(mat.qty);
                const nameRegex = new RegExp(`^${mat.item.trim()}$`, "i");
                const specVal = mat.specs && mat.specs.trim().toLowerCase() !== "n/a" 
                    ? mat.specs.trim() 
                    : null;
                const specFilter = specVal ? new RegExp(`^${specVal}$`, "i") : null;

                // Search across all inventory models
                let inventoryItem = await Equipment.findOne(
                    specFilter ? { itemName: nameRegex, specification: specFilter } : { itemName: nameRegex }
                );
                if (!inventoryItem) {
                    inventoryItem = await Glassware.findOne(
                        specFilter ? { itemName: nameRegex, description: specFilter } : { itemName: nameRegex }
                    );
                }
                if (!inventoryItem) {
                    inventoryItem = await Chemical.findOne(
                        specFilter
                            ? { chemicalName: nameRegex, $or: [{ casNumber: specFilter }, { containerSize: specFilter }] }
                            : { chemicalName: nameRegex }
                    );
                }

                if (!inventoryItem) {
                    return res.status(400).json({
                        message: `Item "${mat.item}" not found in inventory. Cannot approve.`
                    });
                }

                const available = Number(inventoryItem.remainingQuantity);
                if (available < need) {
                    return res.status(400).json({
                        message: `Not enough stock for "${mat.item}". Required: ${need}, Available: ${available}. Cannot approve.`
                    });
                }
            }
            // ✅ All checks passed — no decrement yet, that happens at 'accepted'
        }

        // 1. DECREASE ONLY when physically ACCEPTED into the lab
if (status === "accepted" && appointment.status === "approved") {
    for (const mat of materials) {
        const specs = (!mat.specs || mat.specs.trim().toLowerCase() === "n/a") ? "" : mat.specs;
        await findAndDecrementItem(mat.item, specs, mat.qty);
    }
} 
// 2. INCREASE ONLY when gear is officially RETURNED
else if (status === "returned" && appointment.status === "accepted") {
    for (const mat of materials) {
        const specs = (!mat.specs || mat.specs.trim().toLowerCase() === "n/a") ? "" : mat.specs;
        await findAndIncrementItem(mat.item, specs, mat.qty);
    }
}
        // NOTE: 'rejected' and 'approved' (administrative) do NOT touch inventory
    }

    appointment.status = status;
    if (status === 'rejected') {
        appointment.rejectionReason = rejectionReason || "";
    }
    
    await appointment.save();
    if (status !== "pending") {
      const recipientEmail = appointment.studentId?.email || appointment.guestId?.email;
      const recipientName  = appointment.studentId?.fullName || appointment.guestId?.fullName;
      if (recipientEmail) {
        sendAppointmentStatusEmail({
          to: recipientEmail,
          fullName: recipientName,
          date: appointment.date,
          timeSlot: appointment.timeSlot,
          purpose: appointment.purpose,
          status,
          rejectionReason: rejectionReason || ""
        }).catch(err => console.error("Appointment status email error:", err));
      }
    }
    res.json({ message: `Appointment status updated to ${status}`, appointment });

  } catch (err) {
    console.error("Appointment Update Error:", err);
    if (err.message.includes("stock") || err.message.includes("not found")) {
        return res.status(400).json({ message: err.message });
    }
    res.status(500).json({ message: "Error updating appointment" });
  }
});

// Delete appointment
app.delete("/api/admin/appointments/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    await Appointment.findByIdAndDelete(req.params.id);
    res.json({ message: "Appointment deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting appointment" });
  }
});


// Get pending students
app.get("/api/admin/students", authMiddleware, requireAdmin, async (req, res) => {
  try { // <-- ADDED
    const students = await Student.find().sort({ createdAt: -1 });
    res.json({ students });
  } catch (err) { // <-- ADDED
    console.error("Error fetching students:", err);
    res.status(500).json({ message: "Error fetching students" });
  }
});


// Assign Lab ID (manual only)
app.post("/api/admin/students/:id/assign-labid", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { labID } = req.body;
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    if (!labID) return res.status(400).json({ message: "Provide Lab ID" });

    const exists = await Student.findOne({ labID });
    if (exists) return res.status(409).json({ message: "Lab ID already used" });

    student.labID = labID;
    student.status = "active";
    await student.save();

    await AuditLog.create({
      actorAdminId: req.user.id,
      action: "ASSIGN_LAB_ID",
      targetStudentId: student._id,
      metadata: { labID }
    });

    if (student.email) {
      sendLabIDAssignedEmail({ to: student.email, fullName: student.fullName, labID })
        .catch(err => console.error("Lab ID email error:", err));
    }

    res.json({ message: "Lab ID assigned", labID });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error assigning Lab ID" });
  }
});

// Reject Student
app.post("/api/admin/students/:id/reject", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });
    student.status = "blocked";
    await student.save();
    await AuditLog.create({ actorAdminId: req.user.id, action: "REJECT_STUDENT", targetStudentId: student._id });
    if (student.email) {
      sendStudentRejectionEmail({ to: student.email, fullName: student.fullName })
        .catch(err => console.error("Rejection email error:", err));
    }
    res.json({ message: "Student rejected" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error rejecting student" });
  }
});

// Admin edit student details
app.put("/api/admin/students/:id", authMiddleware, requireAdmin, async (req, res) => {
    try {
        const { fullName, email, cys, professor, classSchedule, status } = req.body;

        if (email) {
            const emailInUse = await Student.findOne({
                email: email.trim().toLowerCase(),
                _id: { $ne: req.params.id }
            });
            if (emailInUse) {
                return res.status(409).json({ message: "Email already in use by another account." });
            }
        }

        const updateData = {};

        if (fullName)      updateData.fullName      = fullName;
        if (email)         updateData.email         = email;
        if (cys)           updateData.cys           = cys;
        if (professor)     updateData.professor     = professor;
        if (classSchedule) updateData.classSchedule = classSchedule;
        if (status)        updateData.status        = status; // allows "blocked" → "pending"

        const student = await Student.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!student) return res.status(404).json({ message: "Student not found" });

        res.json({ message: "Student updated successfully", student });
    } catch (err) {
        if (err.code === 11000) {
            return res.status(409).json({ message: "Email already in use by another account." });
        }
        res.status(500).json({ message: "Error updating student" });
    }
});

// Delete student permanently (with archive)
app.delete("/api/admin/students/:id", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const student = await Student.findById(req.params.id);
    if (!student) return res.status(404).json({ message: "Student not found" });

    await UserArchive.create({
      userType: "student",
      originalId: student._id,
      data: student.toObject(),
      deletedBy: req.user.id,
      deletedByEmail: req.user.email
    });

    await Student.findByIdAndDelete(req.params.id);
    res.json({ message: "Student archived and deleted successfully" });
  } catch (err) {
    console.error("Delete student error:", err);
    res.status(500).json({ message: "Error deleting student" });
  }
});

// ====== USER ARCHIVE ROUTES ======

// GET all archived users (filter by type optionally)
app.get("/api/admin/user-archive", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { userType } = req.query;
    const filter = {};
    if (userType && userType !== "all") filter.userType = userType;

    const records = await UserArchive.find(filter).sort({ deletedAt: -1 });
    res.json({ records });
  } catch (err) {
    console.error("User archive fetch error:", err);
    res.status(500).json({ message: "Error fetching user archive" });
  }
});

// RESTORE an archived user
app.post("/api/admin/user-archive/:id/restore", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const record = await UserArchive.findById(req.params.id);
    if (!record) return res.status(404).json({ message: "Archive record not found" });

    const cleanData = { ...record.data };
    delete cleanData._id;
    delete cleanData.__v;

    let restored;
    if (record.userType === "student") {
      // Check for email conflict before restoring
      const emailExists = await Student.findOne({ email: cleanData.email });
      if (emailExists) {
        return res.status(409).json({ 
          message: "A student with this email already exists. Cannot restore." 
        });
      }
      restored = await Student.create(cleanData);
    } else if (record.userType === "admin") {
      const emailExists = await Admin.findOne({ email: cleanData.email });
      if (emailExists) {
        return res.status(409).json({ 
          message: "An admin with this email already exists. Cannot restore." 
        });
      }
      restored = await Admin.create(cleanData);
    } else {
      return res.status(400).json({ message: "Unknown user type" });
    }

    await UserArchive.findByIdAndDelete(req.params.id);
    res.json({ message: `${record.userType} restored successfully`, restored });
  } catch (err) {
    console.error("Restore error:", err);
    res.status(500).json({ message: "Error restoring user: " + err.message });
  }
});

// PERMANENTLY delete from archive
app.delete("/api/admin/user-archive/:id", authMiddleware, requireSuper, async (req, res) => {
  try {
    const record = await UserArchive.findByIdAndDelete(req.params.id);
    if (!record) return res.status(404).json({ message: "Archive record not found" });
    res.json({ message: "Permanently deleted from archive" });
  } catch (err) {
    res.status(500).json({ message: "Error permanently deleting record" });
  }
});

// Super admin: create admin
app.post("/api/admin/admins", authMiddleware, requireSuper, async (req, res) => {
  const { name, email, password, role } = req.body;
  const existing = await Admin.findOne({ email });
  if (existing) return res.status(409).json({ message: "Email already used" });
  const passwordHash = await bcrypt.hash(password, 10);
  const admin = await Admin.create({ name, email, passwordHash, role: role || "admin" });
  res.json({ message: "Admin created", id: admin._id });
});

// Superadmin & admin: list all admins
app.get("/api/admin/admins", authMiddleware, requireAdmin, async (req, res) => {
  try {
    const admins = await Admin.find().sort({ createdAt: -1 });
    res.json({ admins });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error fetching admins" });
  }
});

// Superadmin: update admin
app.put("/api/admin/admins/:id", authMiddleware, requireSuper, async (req, res) => {
  try {
    const { name, email, role, password } = req.body;
    const updateData = { name, email, role };

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const admin = await Admin.findByIdAndUpdate(req.params.id, updateData, { new: true });
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    res.json({ message: "Admin updated", admin });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating admin" });
  }
});

// Superadmin: delete admin (with archive)
app.delete("/api/admin/admins/:id", authMiddleware, requireSuper, async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ message: "You cannot delete your own account." });
    }

    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: "Admin not found" });

    await UserArchive.create({
      userType: "admin",
      originalId: admin._id,
      data: admin.toObject(),
      deletedBy: req.user.id,
      deletedByEmail: req.user.email
    });

    await Admin.findByIdAndDelete(req.params.id);
    res.json({ message: "Admin archived and deleted successfully" });
  } catch (err) {
    console.error("Delete admin error:", err);
    res.status(500).json({ message: "Error deleting admin" });
  }
});

// ===== FORGOT PASSWORD (Admin / Student / Guest) =====
app.post("/api/auth/forgot-password", async (req, res) => {
  try {
    const { identifier, role } = req.body;
    // identifier = email for admin/guest, OR labID or email for student
 
    if (!identifier || !role) {
      return res.status(400).json({ message: "Please provide your identifier and account type." });
    }
 
    // --- Generate a secure temporary password ---
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$";
    let tempPassword = "";
    for (let i = 0; i < 10; i++) {
      tempPassword += chars[Math.floor(Math.random() * chars.length)];
    }
 
    const passwordHash = await bcrypt.hash(tempPassword, 10);
 
    // --- ADMIN ---
    if (role === "admin") {
      const admin = await Admin.findOne({ email: identifier.trim().toLowerCase() });
      if (!admin) {
        // Return success anyway to prevent email enumeration
        return res.json({ message: "If that email is registered, a temporary password has been sent." });
      }
 
      admin.passwordHash = passwordHash;
      await admin.save();
 
      sendPasswordResetEmail({
        to: admin.email,
        fullName: admin.name,
        tempPassword,
        role: "admin"
      }).catch(err => console.error("Forgot password (admin) email error:", err));
 
      return res.json({ message: "If that email is registered, a temporary password has been sent." });
    }
 
    // --- STUDENT ---
    if (role === "student") {
      // Allow lookup by labID OR email
      const student = await Student.findOne({
        $or: [
          { email: identifier.trim().toLowerCase() },
          { labID: identifier.trim() }
        ]
      });
 
      if (!student) {
        return res.json({ message: "If that account exists, a temporary password has been sent." });
      }
 
      if (student.status !== "active") {
        return res.status(403).json({
          message: "Your account is not active. Please contact the lab technician."
        });
      }
 
      student.passwordHash = passwordHash;
      await student.save();
 
      sendPasswordResetEmail({
        to: student.email,
        fullName: student.fullName,
        tempPassword,
        role: "student"
      }).catch(err => console.error("Forgot password (student) email error:", err));
 
      return res.json({ message: "If that account exists, a temporary password has been sent." });
    }
 
    // --- GUEST ---
    if (role === "guest") {
      const guest = await Guest.findOne({ email: identifier.trim().toLowerCase() });
 
      if (!guest) {
        return res.json({ message: "If that email is registered, a temporary password has been sent." });
      }
 
      guest.passwordHash = passwordHash;
      await guest.save();
 
      sendPasswordResetEmail({
        to: guest.email,
        fullName: guest.fullName,
        tempPassword,
        role: "guest"
      }).catch(err => console.error("Forgot password (guest) email error:", err));
 
      return res.json({ message: "If that email is registered, a temporary password has been sent." });
    }
 
    return res.status(400).json({ message: "Invalid account type." });
 
  } catch (err) {
    console.error("Forgot password error:", err);
    res.status(500).json({ message: "Server error. Please try again." });
  }
});

// ====== SPA CATCH-ALL ROUTE ======
// This must remain at the very bottom of the file!
const path = require('path');

app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});