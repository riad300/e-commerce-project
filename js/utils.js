export function formatBDT(amount) {
  return "৳" + Number(amount || 0).toLocaleString("en-BD");
}
