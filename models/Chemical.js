const mongoose = require("mongoose");

const chemicalSchema = new mongoose.Schema({
  barcode: String,
  location: String,
  owner: String,
  dateIn: String,
  expirationDate: String,
  chemicalName: String,
  casNumber: String,
  quantity: Number,
  remainingQuantity: Number,
  containerSize: String,
  units: String,
  state: String
});

module.exports = mongoose.model("Chemical", chemicalSchema);
