import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { 
  Settings as SettingsIcon, 
  Camera, 
  Server, 
  User, 
  Database,
  Save,
  LogOut,
  Upload,
  Download,
  TestTube
} from 'lucide-react';

interface AppSettings {
  appName: string;
  appLogo: string;
  themeColor: string;
  streamRefreshInterval: number;
  videoQuality: 'low' | 'medium' | 'high';
  defaultGridLayout: '2x2' | '3x3' | 'auto-fit';
  laravelApiUrl: string;
  supabaseUrl: string;
  supabaseKey: string;
}

export default function Settings() {
  const [settings, setSettings] = useState<AppSettings>({
    appName: 'CoE Greentech CCTV Monitor',
    appLogo: '',
    themeColor: '#2E7D32',
    streamRefreshInterval: 30,
    videoQuality: 'medium',
    defaultGridLayout: '2x2',
    laravelApiUrl: '',
    supabaseUrl: '',
    supabaseKey: '',
  });

  const [adminEmail, setAdminEmail] = useState('admin@greentech.com');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Load settings from localStorage on mount
  useEffect(() => {
    const savedSettings = localStorage.getItem('app_settings');
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings));
    }
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem('app_settings', JSON.stringify(settings));
    toast.success('Settings updated successfully', {
      description: 'Your changes have been saved.',
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSettings({ ...settings, appLogo: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleTestConnection = async () => {
    toast.loading('Testing connection...');
    
    // Simulate connection test
    setTimeout(() => {
      toast.dismiss();
      if (settings.laravelApiUrl || settings.supabaseUrl) {
        toast.success('Connection successful', {
          description: 'Backend server is responding.',
        });
      } else {
        toast.error('Connection failed', {
          description: 'Please enter API endpoint or Supabase URL.',
        });
      }
    }, 2000);
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    // In real implementation, this would call an API
    toast.success('Password changed successfully');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleChangeEmail = () => {
    // In real implementation, this would call an API
    toast.success('Email updated successfully', {
      description: `New email: ${adminEmail}`,
    });
  };

  const handleExportData = (format: 'json' | 'csv') => {
    // Mock export functionality
    toast.success(`Data exported as ${format.toUpperCase()}`, {
      description: 'Download will start shortly.',
    });
  };

  const handleBackupToGoogleDrive = () => {
    // Mock backup functionality
    toast.info('Google Drive backup (Coming Soon)', {
      description: 'This feature will be available in the next update.',
    });
  };

  const handleLogout = () => {
    toast.success('Logged out successfully');
    // In real implementation, clear session and redirect to login
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          Pengaturan Aplikasi
        </h1>
        <p className="text-muted-foreground mt-1">
          Kelola pengaturan sistem monitoring CCTV CoE Greentech
        </p>
      </div>

      <Tabs defaultValue="app" className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 lg:w-auto lg:inline-grid">
          <TabsTrigger value="app" className="gap-2">
            <SettingsIcon className="h-4 w-4" />
            Aplikasi
          </TabsTrigger>
          <TabsTrigger value="camera" className="gap-2">
            <Camera className="h-4 w-4" />
            Kamera
          </TabsTrigger>
          <TabsTrigger value="server" className="gap-2">
            <Server className="h-4 w-4" />
            Server
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <User className="h-4 w-4" />
            Akun Admin
          </TabsTrigger>
          <TabsTrigger value="backup" className="gap-2">
            <Database className="h-4 w-4" />
            Backup
          </TabsTrigger>
        </TabsList>

        {/* Tab Aplikasi */}
        <TabsContent value="app" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pengaturan Aplikasi</CardTitle>
              <CardDescription>Kustomisasi tampilan dan identitas aplikasi</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="appName">Nama Aplikasi</Label>
                <Input
                  id="appName"
                  value={settings.appName}
                  onChange={(e) => setSettings({ ...settings, appName: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appLogo">Logo Aplikasi</Label>
                <div className="flex items-center gap-4">
                  {settings.appLogo && (
                    <img src={settings.appLogo} alt="App Logo" className="h-16 w-16 object-contain rounded-lg border" />
                  )}
                  <div className="flex-1">
                    <Input
                      id="appLogo"
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="themeColor">Warna Tema Utama</Label>
                <div className="flex items-center gap-4">
                  <Input
                    id="themeColor"
                    type="color"
                    value={settings.themeColor}
                    onChange={(e) => setSettings({ ...settings, themeColor: e.target.value })}
                    className="w-20 h-10"
                  />
                  <Input
                    value={settings.themeColor}
                    onChange={(e) => setSettings({ ...settings, themeColor: e.target.value })}
                    placeholder="#2E7D32"
                  />
                </div>
              </div>

              <Button onClick={handleSaveSettings} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                Simpan Pengaturan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Kamera */}
        <TabsContent value="camera" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pengaturan Kamera</CardTitle>
              <CardDescription>Atur kualitas dan tampilan stream CCTV</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="refreshInterval">Refresh Interval Stream (detik)</Label>
                <Input
                  id="refreshInterval"
                  type="number"
                  min="5"
                  max="300"
                  value={settings.streamRefreshInterval}
                  onChange={(e) => setSettings({ ...settings, streamRefreshInterval: parseInt(e.target.value) })}
                />
                <p className="text-sm text-muted-foreground">
                  Interval waktu update stream (5-300 detik)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="videoQuality">Kualitas Video</Label>
                <Select
                  value={settings.videoQuality}
                  onValueChange={(value: 'low' | 'medium' | 'high') => 
                    setSettings({ ...settings, videoQuality: value })
                  }
                >
                  <SelectTrigger id="videoQuality">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low (360p)</SelectItem>
                    <SelectItem value="medium">Medium (720p)</SelectItem>
                    <SelectItem value="high">High (1080p)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="gridLayout">Layout Grid Default</Label>
                <Select
                  value={settings.defaultGridLayout}
                  onValueChange={(value: '2x2' | '3x3' | 'auto-fit') => 
                    setSettings({ ...settings, defaultGridLayout: value })
                  }
                >
                  <SelectTrigger id="gridLayout">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2x2">2x2 Grid</SelectItem>
                    <SelectItem value="3x3">3x3 Grid</SelectItem>
                    <SelectItem value="auto-fit">Auto-fit</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button onClick={handleSaveSettings} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                Simpan Pengaturan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Server */}
        <TabsContent value="server" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Konfigurasi Server</CardTitle>
              <CardDescription>Atur koneksi ke backend dan database</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="laravelApi">Laravel API Endpoint</Label>
                <Input
                  id="laravelApi"
                  placeholder="https://api.greentech.com"
                  value={settings.laravelApiUrl}
                  onChange={(e) => setSettings({ ...settings, laravelApiUrl: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supabaseUrl">Supabase URL</Label>
                <Input
                  id="supabaseUrl"
                  placeholder="https://xxxxx.supabase.co"
                  value={settings.supabaseUrl}
                  onChange={(e) => setSettings({ ...settings, supabaseUrl: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="supabaseKey">Supabase Anon Key</Label>
                <Input
                  id="supabaseKey"
                  type="password"
                  placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  value={settings.supabaseKey}
                  onChange={(e) => setSettings({ ...settings, supabaseKey: e.target.value })}
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveSettings} className="flex-1">
                  <Save className="h-4 w-4 mr-2" />
                  Simpan
                </Button>
                <Button onClick={handleTestConnection} variant="outline" className="flex-1">
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Connection
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Akun Admin */}
        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ganti Email Admin</CardTitle>
              <CardDescription>Update alamat email administrator</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adminEmail">Email Admin</Label>
                <Input
                  id="adminEmail"
                  type="email"
                  value={adminEmail}
                  onChange={(e) => setAdminEmail(e.target.value)}
                />
              </div>
              <Button onClick={handleChangeEmail} className="w-full">
                Update Email
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ganti Password</CardTitle>
              <CardDescription>Update password administrator</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Password Saat Ini</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">Password Baru</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Konfirmasi Password Baru</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
              <Button onClick={handleChangePassword} className="w-full">
                Ganti Password
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Button onClick={handleLogout} variant="destructive" className="w-full">
                <LogOut className="h-4 w-4 mr-2" />
                Logout
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Backup */}
        <TabsContent value="backup" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ekspor Data</CardTitle>
              <CardDescription>Download data kamera dan catatan pengawasan</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button onClick={() => handleExportData('json')} variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Ekspor sebagai JSON
              </Button>
              <Button onClick={() => handleExportData('csv')} variant="outline" className="w-full">
                <Download className="h-4 w-4 mr-2" />
                Ekspor sebagai CSV
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Backup Cloud</CardTitle>
              <CardDescription>Simpan backup ke cloud storage</CardDescription>
            </CardHeader>
            <CardContent>
              <Button onClick={handleBackupToGoogleDrive} variant="outline" className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Backup ke Google Drive
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
