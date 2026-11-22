// Settings for the Luvanderas Expenses website.
// SCRIPT_URL is the Web app URL from the Google Sheet's Apps Script deployment.
// PEOPLE and CATEGORIES must match the lists in Code.gs.
window.LUV_CONFIG = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwe0fivD4_KRTtugmYmmbD0vmIit5zVguZqN_e9J6noLr4L9XNc10yWcZz_513-ZJaK_w/exec",
  PEOPLE: ["Evan", "Mary Jean", "Edna", "Kristel", "Lorie"],
  CATEGORIES: ["Supplies", "Plastic & packaging", "Utilities", "Rent", "Salary",
    "Staff loan", "Repairs", "Transport", "Bahay (household)", "Other"],
  // Stock items: [name, big unit, pieces per big unit, small unit, pieces per small unit].
  // Big unit "" = no big unit. Must match ITEMS in Code.gs.
  ITEMS: [
    ["Surf Liquid Detergent sachet", "cases", 288, "loose", 1],
    ["Surf Fabric Conditioner sachet", "cases", 126, "loose", 1],
    ["Ariel Liquid sachet", "cases", 126, "loose", 1],
    ["Zonrox Color Safe sachet", "cases", 360, "loose", 1],
    ["Downy sachet", "", 0, "pcs", 1],
    ["Plastic Big", "packs", 100, "rolls", 20],
    ["Plastic for Dry Clean", "packs", 100, "rolls", 20],
    ["Aroma Sheets", "", 0, "pcs", 1]
  ]
};
