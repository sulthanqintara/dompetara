// Shared scales and roles drive the app and its style guide.
export const colorScales = {
  neutral: { 100: "#F5F5F5", 200: "#EDEDED", 300: "#D4D4D4", 400: "#A3A3A3", 500: "#737373", 600: "#525252", 700: "#2A2A2A", 800: "#1A1A1A", 900: "#111111" },
  brand: { 100: "#EDF5F1", 200: "#D1E8DF", 300: "#8EBFAA", 400: "#3DA98A", 500: "#287D69", 600: "#216957", 700: "#194F42", 800: "#143B32", 900: "#0D2923" },
  income: { 100: "#EAF7EF", 200: "#C5EBD6", 300: "#87D8AF", 400: "#3DBD83", 500: "#269B63", 600: "#18704A", 700: "#145C3E", 800: "#10462F", 900: "#0A3021" },
  red: { 100: "#FFF0EE", 200: "#FFD6D1", 300: "#FBA79F", 400: "#F5756B", 500: "#DE5147", 600: "#B43C35", 700: "#92312C", 800: "#6F2824", 900: "#4C1C1A" },
  blue: { 100: "#EDF3FC", 200: "#D3E1FC", 300: "#A6C2FA", 400: "#6D9DF2", 500: "#437AD5", 600: "#2459B0", 700: "#20478C", 800: "#19366B", 900: "#122548" },
  amber: { 100: "#FFF8E6", 200: "#FBE9B8", 300: "#E9C975", 400: "#CAA044", 500: "#AD8122", 600: "#87610E", 700: "#6C470E", 800: "#51310E", 900: "#38200C" },
} as const;

export const scaleLabels = {
  neutral: "styleGuideNeutralScale", brand: "styleGuideBrandScale", income: "styleGuideIncomeScale",
  red: "styleGuideRedScale", blue: "styleGuideBlueScale", amber: "styleGuideAmberScale",
} as const;

export const white = "#FFFFFF";
export const black = "#000000";
type Family = keyof typeof colorScales;
type Shade = keyof typeof colorScales.neutral;
type ShadeReference = `${Family}.${Shade}` | "white" | "black";

export const colorRoles = [
  { token: "background", label: "styleGuideCanvas", light: "neutral.100", dark: "black" },
  { token: "foreground", label: "styleGuideText", light: "neutral.900", dark: "neutral.100" },
  { token: "card", label: "styleGuideSurface", light: "white", dark: "neutral.900" },
  { token: "card-foreground", label: "styleGuideSurfaceText", light: "neutral.900", dark: "neutral.100" },
  { token: "primary", label: "styleGuideBrand", light: "brand.500", dark: "brand.500" },
  { token: "primary-hover", label: "styleGuideBrandHover", light: "brand.600", dark: "brand.600" },
  { token: "primary-foreground", label: "styleGuideOnBrand", light: "white", dark: "white" },
  { token: "secondary", label: "styleGuideSoftSurface", light: "neutral.200", dark: "neutral.800" },
  { token: "secondary-foreground", label: "styleGuideSoftText", light: "neutral.900", dark: "neutral.100" },
  { token: "elevated", label: "styleGuideElevated", light: "white", dark: "neutral.800" },
  { token: "selected", label: "styleGuideSelected", light: "neutral.200", dark: "neutral.800" },
  { token: "selected-foreground", label: "styleGuideSelectedText", light: "neutral.900", dark: "neutral.100" },
  { token: "brand-accent", label: "styleGuideBrandAccent", light: "brand.500", dark: "brand.400" },
  { token: "muted", label: "styleGuideMutedSurface", light: "neutral.200", dark: "neutral.800" },
  { token: "muted-foreground", label: "styleGuideSecondaryText", light: "neutral.600", dark: "neutral.400" },
  { token: "border", label: "styleGuideDivider", light: "neutral.300", dark: "neutral.700" },
  { token: "input", label: "styleGuideControlBorder", light: "neutral.500", dark: "neutral.500" },
  { token: "ring", label: "styleGuideFocus", light: "brand.500", dark: "brand.400" },
  { token: "income", label: "styleGuideIncome", light: "income.600", dark: "income.400" },
  { token: "destructive", label: "styleGuideExpenseColor", light: "red.600", dark: "red.400" },
  { token: "transfer", label: "styleGuideTransfer", light: "blue.600", dark: "blue.400" },
  { token: "warning", label: "styleGuideWarning", light: "amber.600", dark: "amber.400" },
  { token: "chart-1", label: "styleGuideChartOne", light: "brand.500", dark: "brand.400" },
  { token: "chart-2", label: "styleGuideChartTwo", light: "blue.600", dark: "blue.400" },
  { token: "chart-3", label: "styleGuideChartThree", light: "amber.600", dark: "amber.400" },
  { token: "chart-4", label: "styleGuideChartFour", light: "red.600", dark: "red.400" },
  { token: "chart-5", label: "styleGuideChartFive", light: "income.600", dark: "income.400" },
] as const satisfies readonly { token: string; label: string; light: ShadeReference; dark: ShadeReference }[];

export function shadeColor(reference: ShadeReference) {
  if (reference === "white") return white;
  if (reference === "black") return black;
  const [family, shade] = reference.split(".");
  return colorScales[family as Family][Number(shade) as Shade];
}

export const designColors = colorRoles.map((role) => ({
  ...role, light: shadeColor(role.light), dark: shadeColor(role.dark),
}));

export const themeCss = `:root{${Object.entries(colorScales).flatMap(([family, shades]) =>
  Object.entries(shades).map(([shade, hex]) => `--${family}-${shade}:${hex};`)).join("")}}
:root,.theme-light{${designColors.map((color) => `--${color.token}:${color.light};`).join("")}}
.dark{${designColors.map((color) => `--${color.token}:${color.dark};`).join("")}}`;

export function colorHsl(hex: string) {
  const [r, g, b] = hex.slice(1).match(/../g)!.map((value) => parseInt(value, 16) / 255);
  const high = Math.max(r, g, b), low = Math.min(r, g, b), delta = high - low;
  const lightness = (high + low) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (delta !== 0) {
    if (high === r) hue = ((g - b) / delta + 6) % 6;
    else if (high === g) hue = (b - r) / delta + 2;
    else hue = (r - g) / delta + 4;
  }
  return `hsl(${Math.round(hue * 60)} ${Math.round(saturation * 100)}% ${Math.round(lightness * 100)}%)`;
}
