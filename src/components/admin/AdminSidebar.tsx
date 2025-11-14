import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Store, Users, MessageSquare, BarChart3, Settings, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const AdminSidebar = () => {
  const location = useLocation();
  const [pendingShops, setPendingShops] = useState(0);
  const [pendingComplaints, setPendingComplaints] = useState(0);

  useEffect(() => {
    loadPendingCounts();

    // Real-time subscriptions
    const shopsChannel = supabase
      .channel('admin-shops-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shops' }, loadPendingCounts)
      .subscribe();

    const complaintsChannel = supabase
      .channel('admin-complaints-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'complaints' }, loadPendingCounts)
      .subscribe();

    return () => {
      supabase.removeChannel(shopsChannel);
      supabase.removeChannel(complaintsChannel);
    };
  }, []);

  const loadPendingCounts = async () => {
    const { count: shopsCount } = await supabase
      .from('shops')
      .select('*', { count: 'exact', head: true })
      .eq('verification_status', 'pending');

    const { count: complaintsCount } = await supabase
      .from('complaints')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    setPendingShops(shopsCount || 0);
    setPendingComplaints(complaintsCount || 0);
  };

  const navItems = [
    { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
    { icon: Store, label: "Shops", path: "/admin/shops", badge: pendingShops },
    { icon: Users, label: "Users", path: "/admin/users" },
    { icon: MessageSquare, label: "Complaints", path: "/admin/complaints", badge: pendingComplaints },
    { icon: MapPin, label: "Map View", path: "/admin/map" },
    { icon: BarChart3, label: "Reports", path: "/admin/reports" },
    { icon: Settings, label: "Settings", path: "/admin/settings" },
  ];

  return (
    <aside className="w-64 border-r bg-card min-h-screen p-6">
      <div className="flex items-center gap-2 mb-8">
        <div className="p-2 bg-primary rounded-lg">
          <img src="/clearshelf-logo.png" alt="ClearShelf" className="w-5 h-5 object-contain" />
        </div>
        <div>
          <h2 className="font-bold text-lg">Clear Shelf</h2>
          <p className="text-xs text-muted-foreground">Admin Panel</p>
        </div>
      </div>

      <nav className="space-y-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center justify-between gap-3 px-3 py-2 rounded-lg transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
              {item.badge && item.badge > 0 ? (
                <Badge variant="destructive" className="rounded-full px-2">
                  {item.badge}
                </Badge>
              ) : null}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
};

export default AdminSidebar;
