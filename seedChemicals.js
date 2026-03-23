const mongoose = require("mongoose");
const Chemical = require("./models/Chemical");

mongoose.connect("mongodb://127.0.0.1:27017/chemlab");

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

(async () => {
  for (const c of chemicals) {
    c.remainingQuantity = c.quantity;
    await Chemical.create(c);
  }
  console.log("Seed complete");
  process.exit();
})();
