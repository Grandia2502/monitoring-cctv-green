import { 
  Monitor, 
  Video, 
  FileText, 
  Settings, 
  LogOut
} from "lucide-react";
import { NavLink, useLocation } from "react-router-dom";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useAppSettings } from "@/contexts/AppSettingsContext";

const mainNavItems = [
  { title: "Dashboard", url: "/", icon: Monitor },
  { title: "Camera Management", url: "/cameras", icon: Video },
  { title: "Monitoring Records", url: "/records", icon: FileText },
  { title: "Settings", url: "/settings", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;
  const collapsed = state === 'collapsed';
  
  const { user, signOut } = useAuth();
  const { appSettings } = useAppSettings();

  // Generate initials from email
  const getInitials = (email: string | undefined) => {
    if (!email) return 'U';
    const parts = email.split('@')[0];
    return parts.substring(0, 2).toUpperCase();
  };

  // Extract display name from email
  const getDisplayName = (email: string | undefined) => {
    if (!email) return 'User';
    return email.split('@')[0];
  };

  const isActive = (path: string) => currentPath === path;
  const getNavClass = (path: string) =>
    isActive(path) 
      ? "bg-sidebar-accent text-sidebar-primary font-medium" 
      : "hover:bg-sidebar-accent/50";

  const handleLogout = async () => {
    await signOut();
  };

  return (
    <Sidebar
      className={collapsed ? "w-14" : "w-64"}
      collapsible="icon"
    >
      <SidebarHeader className="border-b border-sidebar-border p-4">
        {!collapsed && (
          <div className="flex items-center gap-3">
            {appSettings.appLogo ? (
              <img 
                src={appSettings.appLogo} 
                alt="App Logo" 
                className="w-8 h-8 object-contain rounded-lg"
              />
            ) : (
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Monitor className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-sidebar-foreground truncate">
                {appSettings.appName.split(' ').slice(0, 2).join(' ')}
              </h2>
              <p className="text-xs text-sidebar-foreground/60">CCTV Monitoring</p>
            </div>
          </div>
        )}
        {collapsed && (
          <>
            {appSettings.appLogo ? (
              <img 
                src={appSettings.appLogo} 
                alt="App Logo" 
                className="w-8 h-8 object-contain rounded-lg mx-auto"
              />
            ) : (
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mx-auto">
                <Monitor className="h-5 w-5 text-primary-foreground" />
              </div>
            )}
          </>
        )}
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Main Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNavItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} className={getNavClass(item.url)}>
                      <item.icon className="h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-4">
        {!collapsed ? (
          <div className="flex items-center gap-3">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials(user?.email)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-sidebar-foreground truncate">
                {getDisplayName(user?.email)}
              </p>
              <p className="text-xs text-sidebar-foreground/60 truncate">
                {user?.email || 'Tidak ada email'}
              </p>
            </div>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-8 w-8 p-0"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                {getInitials(user?.email)}
              </AvatarFallback>
            </Avatar>
            <Button 
              size="sm" 
              variant="ghost" 
              className="h-8 w-8 p-0"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
