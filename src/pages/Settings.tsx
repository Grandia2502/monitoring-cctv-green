import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  Settings as SettingsIcon, 
  User, 
  Save,
  LogOut
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { supabase } from '@/integrations/supabase/client';

export default function Settings() {
  const { user, signOut } = useAuth();
  const { appSettings, updateSettings } = useAppSettings();

  // Local state for form inputs
  const [appName, setAppName] = useState(appSettings.appName);
  const [appLogo, setAppLogo] = useState(appSettings.appLogo);
  const [themeColor, setThemeColor] = useState(appSettings.themeColor);

  // Password change state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Email change state
  const [newEmail, setNewEmail] = useState('');
  const [isChangingEmail, setIsChangingEmail] = useState(false);

  const handleSaveAppSettings = () => {
    updateSettings({
      appName,
      appLogo,
      themeColor,
    });
    toast.success('Pengaturan aplikasi berhasil disimpan', {
      description: 'Perubahan telah diterapkan.',
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAppLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('Password tidak cocok');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('Password minimal 6 karakter');
      return;
    }
    
    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      toast.success('Password berhasil diubah');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error: any) {
      toast.error('Gagal mengubah password', {
        description: error.message,
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!newEmail) {
      toast.error('Email tidak boleh kosong');
      return;
    }
    
    setIsChangingEmail(true);
    try {
      const { error } = await supabase.auth.updateUser({ email: newEmail });
      if (error) throw error;
      
      toast.success('Email konfirmasi telah dikirim', {
        description: 'Silakan cek email baru Anda untuk konfirmasi.',
      });
      setNewEmail('');
    } catch (error: any) {
      toast.error('Gagal mengubah email', {
        description: error.message,
      });
    } finally {
      setIsChangingEmail(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    toast.success('Berhasil logout');
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <SettingsIcon className="h-8 w-8" />
          Pengaturan Aplikasi
        </h1>
        <p className="text-muted-foreground mt-1">
          Kelola pengaturan sistem monitoring CCTV
        </p>
      </div>

      <Tabs defaultValue="app" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-grid">
          <TabsTrigger value="app" className="gap-2">
            <SettingsIcon className="h-4 w-4" />
            Aplikasi
          </TabsTrigger>
          <TabsTrigger value="account" className="gap-2">
            <User className="h-4 w-4" />
            Akun Admin
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
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="appLogo">Logo Aplikasi</Label>
                <div className="flex items-center gap-4">
                  {appLogo && (
                    <img src={appLogo} alt="App Logo" className="h-16 w-16 object-contain rounded-lg border" />
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
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="w-20 h-10 cursor-pointer"
                  />
                  <Input
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    placeholder="#2E7D32"
                    className="flex-1"
                  />
                  <div 
                    className="w-10 h-10 rounded-lg border" 
                    style={{ backgroundColor: themeColor }}
                  />
                </div>
                <p className="text-sm text-muted-foreground">
                  Pilih warna tema utama untuk seluruh aplikasi
                </p>
              </div>

              <Button onClick={handleSaveAppSettings} className="w-full">
                <Save className="h-4 w-4 mr-2" />
                Simpan Pengaturan
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab Akun Admin */}
        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Informasi Akun</CardTitle>
              <CardDescription>Email yang sedang login</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">Email saat ini:</p>
                <p className="font-medium">{user?.email || 'Tidak ada email'}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ganti Email</CardTitle>
              <CardDescription>Update alamat email akun Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newEmail">Email Baru</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>
              <Button 
                onClick={handleChangeEmail} 
                className="w-full"
                disabled={isChangingEmail}
              >
                {isChangingEmail ? 'Memproses...' : 'Update Email'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ganti Password</CardTitle>
              <CardDescription>Update password akun Anda</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
              <Button 
                onClick={handleChangePassword} 
                className="w-full"
                disabled={isChangingPassword}
              >
                {isChangingPassword ? 'Memproses...' : 'Ganti Password'}
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
      </Tabs>
    </div>
  );
}
