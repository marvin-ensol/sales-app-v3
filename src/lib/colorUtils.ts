/**
 * Convert hex color to RGB values
 */
export const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

/**
 * Generate light background color with specified opacity
 */
export const generateLightBg = (hexColor: string, opacity: number = 0.1): string => {
  const rgb = hexToRgb(hexColor);
  if (!rgb) return 'rgba(128, 128, 128, 0.1)'; // fallback gray
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${opacity})`;
};

/**
 * Generate color variations for category styling
 */
export const generateCategoryColors = (hexColor: string) => {
  return {
    border: hexColor,
    lightBg: generateLightBg(hexColor, 0.12),
    expandedBg: generateLightBg(hexColor, 0.06)
  };
};