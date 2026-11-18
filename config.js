// Settings for the Luvanderas Expenses website.
// SCRIPT_URL is the Web app URL from the Google Sheet's Apps Script deployment.
// PEOPLE and CATEGORIES must match the lists in Code.gs.
window.LUV_CONFIG = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbwe0fivD4_KRTtugmYmmbD0vmIit5zVguZqN_e9J6noLr4L9XNc10yWcZz_513-ZJaK_w/exec",
  PEOPLE: ["Evan", "Mary Jean", "Edna", "Kristel", "Lorie"],
  CATEGORIES: ["Supplies", "Plastic & packaging", "Utilities", "Rent", "Salary",
    "Staff loan", "Repairs", "Transport", "Bahay (household)", "Other"],
  // Stock items: [name, pieces per full case (0 = count pieces only)]. Must match ITEMS in Code.gs.
  ITEMS: [["Surf Liquid Detergent sachet", 288], ["Surf Fabric Conditioner sachet", 126],
    ["Ariel Liquid sachet", 126], ["Zonrox Color Safe sachet", 360], ["Downy sachet", 0],
    ["Plastic Big", 0], ["Plastic for Dry Clean", 0], ["Aroma Sheets", 0]]
};
