export function money(value: unknown, positive = false): number {
  if (typeof value !== "string" || !/^-?\d{1,12}(\.\d{1,2})?$/.test(value))
    throw new Error("Enter a valid amount with at most two decimal places.");
  const [whole, fraction = ""] = value.replace("-", "").split(".");
  const result =
    (Number(whole) * 100 + Number(fraction.padEnd(2, "0"))) *
    (value.startsWith("-") ? -1 : 1);
  if (positive && result <= 0)
    throw new Error("Amount must be greater than zero.");
  return result;
}
