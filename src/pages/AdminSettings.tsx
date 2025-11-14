import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminHeader from "@/components/admin/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings, Bell, Shield, Database } from "lucide-react";

const AdminSettings = () => {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const [settings, setSettings] = useState({
    defaultDiscountDays: 30,
    enableNotifications: true,
    maintenanceMode: false,
    bannerMessage: "",
    bannerActive: false,
  });

  const handleSave = async () => {
    setLoading(true);
    
    // Save settings to system_settings table
    const settingsToSave = [
      { setting_key: "default_discount_days", setting_value: { value: settings.defaultDiscountDays } },
      { setting_key: "enable_notifications", setting_value: { value: settings.enableNotifications } },
      { setting_key: "maintenance_mode", setting_value: { value: settings.maintenanceMode } },
    ];

    for (const setting of settingsToSave) {
      const { error } = await supabase
        .from("system_settings")
        .upsert({
          setting_key: setting.setting_key,
          setting_value: setting.setting_value,
          updated_by: (await supabase.auth.getUser()).data.user?.id,
        }, { onConflict: "setting_key" });

      if (error) {
        toast({
          title: "Error",
          description: "Failed to save settings",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
    }

    toast({
      title: "Success",
      description: "Settings saved successfully",
    });
    setLoading(false);
  };

  const handleBannerSave = async () => {
    const { error } = await supabase
      .from("announcement_banners")
      .insert({
        title: "System Announcement",
        message: settings.bannerMessage,
        type: "info",
        active: settings.bannerActive,
        target_roles: ["all"],
        created_by: (await supabase.auth.getUser()).data.user?.id || "",
      });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to create banner",
        variant: "destructive",
      });
    } else {
      toast({
        title: "Success",
        description: "Banner created successfully",
      });
      setSettings({ ...settings, bannerMessage: "", bannerActive: false });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <AdminHeader title="System Settings" />

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">
            <Settings className="w-4 h-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="notifications">
            <Bell className="w-4 h-4 mr-2" />
            Notifications
          </TabsTrigger>
          <TabsTrigger value="security">
            <Shield className="w-4 h-4 mr-2" />
            Security
          </TabsTrigger>
          <TabsTrigger value="data">
            <Database className="w-4 h-4 mr-2" />
            Data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle>General Settings</CardTitle>
              <CardDescription>Configure global system parameters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label>Default Discount Period (days before expiry)</Label>
                <Input
                  type="number"
                  value={settings.defaultDiscountDays}
                  onChange={(e) =>
                    setSettings({ ...settings, defaultDiscountDays: parseInt(e.target.value) })
                  }
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Maintenance Mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Enable to restrict access for maintenance
                  </p>
                </div>
                <Switch
                  checked={settings.maintenanceMode}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, maintenanceMode: checked })
                  }
                />
              </div>

              <Button onClick={handleSave} disabled={loading}>
                {loading ? "Saving..." : "Save Settings"}
              </Button>
            </CardContent>
          </Card>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Announcement Banner</CardTitle>
              <CardDescription>Create system-wide announcements</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Banner Message</Label>
                <Textarea
                  placeholder="Enter announcement message..."
                  value={settings.bannerMessage}
                  onChange={(e) => setSettings({ ...settings, bannerMessage: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label>Active</Label>
                <Switch
                  checked={settings.bannerActive}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, bannerActive: checked })
                  }
                />
              </div>
              <Button onClick={handleBannerSave}>Create Banner</Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>Manage notification preferences</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Label>Enable Push Notifications</Label>
                  <p className="text-sm text-muted-foreground">
                    Send notifications for discounts and updates
                  </p>
                </div>
                <Switch
                  checked={settings.enableNotifications}
                  onCheckedChange={(checked) =>
                    setSettings({ ...settings, enableNotifications: checked })
                  }
                />
              </div>

              <Button onClick={handleSave} disabled={loading}>
                {loading ? "Saving..." : "Save Settings"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Security Settings</CardTitle>
              <CardDescription>Configure security and access controls</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Security settings are managed through the backend configuration.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="data">
          <Card>
            <CardHeader>
              <CardTitle>Data Management</CardTitle>
              <CardDescription>Backup and data retention settings</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">
                Data management features are handled by the backend system.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminSettings;
