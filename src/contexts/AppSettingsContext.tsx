import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface AppSettings {
  appName: string;
  appLogo: string;
  themeColor: string;
}

interface AppSettingsContextType {
  appSettings: AppSettings;
  updateSettings: (settings: Partial<AppSettings>) => void;
}

const defaultSettings: AppSettings = {
  appName: 'CoE Greentech CCTV Monitor',
  appLogo: '',
  themeColor: '#2E7D32',
};

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

// Convert hex color to HSL format
function hexToHSL(hex: string): { h: number; s: number; l: number } {
  // Remove # if present
  hex = hex.replace(/^#/, '');

  // Parse hex values
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    l: Math.round(l * 100),
  };
}

// Apply theme color to CSS variables
function applyThemeColor(hexColor: string) {
  const { h, s, l } = hexToHSL(hexColor);
  const root = document.documentElement;
  
  // Primary color
  const primaryHSL = `${h} ${s}% ${l}%`;
  const primaryLightHSL = `${h} ${s}% ${Math.min(l + 12, 100)}%`;
  const primaryDarkHSL = `${h} ${s}% ${Math.max(l - 8, 0)}%`;
  
  // Accent (lighter version)
  const accentHSL = `${h} ${Math.max(s - 30, 20)}% 92%`;
  const accentForegroundHSL = primaryHSL;
  
  // Sidebar colors
  const sidebarBgHSL = `${h} ${Math.max(s - 30, 20)}% 92%`;
  const sidebarAccentHSL = `${h} ${Math.max(s - 30, 20)}% 87%`;
  
  // Apply to root
  root.style.setProperty('--primary', primaryHSL);
  root.style.setProperty('--primary-light', primaryLightHSL);
  root.style.setProperty('--primary-dark', primaryDarkHSL);
  root.style.setProperty('--ring', primaryHSL);
  root.style.setProperty('--accent', accentHSL);
  root.style.setProperty('--accent-foreground', accentForegroundHSL);
  root.style.setProperty('--sidebar-primary', primaryHSL);
  root.style.setProperty('--sidebar-ring', primaryHSL);
  root.style.setProperty('--sidebar-background', sidebarBgHSL);
  root.style.setProperty('--sidebar-accent', sidebarAccentHSL);
  root.style.setProperty('--status-online', primaryHSL);
  root.style.setProperty('--success', primaryHSL);
  
  // Update dark mode colors too
  const darkPrimaryHSL = `${h} ${s}% ${Math.min(l + 12, 100)}%`;
  const darkSidebarBg = `140 15% 10%`;
  const darkSidebarAccent = `140 12% 15%`;
  
  // Dark mode will use CSS cascade, but we can prepare dark variables
  root.style.setProperty('--gradient-primary', `linear-gradient(135deg, hsl(${primaryDarkHSL}), hsl(${primaryLightHSL}))`);
}

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const [appSettings, setAppSettings] = useState<AppSettings>(() => {
    // Load from localStorage on initial mount
    const saved = localStorage.getItem('app_settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          appName: parsed.appName || defaultSettings.appName,
          appLogo: parsed.appLogo || defaultSettings.appLogo,
          themeColor: parsed.themeColor || defaultSettings.themeColor,
        };
      } catch {
        return defaultSettings;
      }
    }
    return defaultSettings;
  });

  // Apply theme color on mount and when it changes
  useEffect(() => {
    applyThemeColor(appSettings.themeColor);
  }, [appSettings.themeColor]);

  const updateSettings = (newSettings: Partial<AppSettings>) => {
    setAppSettings((prev) => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('app_settings', JSON.stringify(updated));
      return updated;
    });
  };

  return (
    <AppSettingsContext.Provider value={{ appSettings, updateSettings }}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings() {
  const context = useContext(AppSettingsContext);
  if (context === undefined) {
    throw new Error('useAppSettings must be used within an AppSettingsProvider');
  }
  return context;
}
