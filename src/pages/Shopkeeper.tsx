import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Package, TrendingUp, AlertCircle } from "lucide-react";
import AddProductDialog from "@/components/shopkeeper/AddProductDialog";
import ScanProductDialog from "@/components/shopkeeper/ScanProductDialog";
import BillingDialog from "@/components/shopkeeper/BillingDialog";
import InventoryTable from "@/components/shopkeeper/InventoryTable";
import ShopSetup from "@/components/shopkeeper/ShopSetup";
import ShopVerificationStatus from "@/components/shopkeeper/ShopVerificationStatus";
import ShopStatusToggle from "@/components/shopkeeper/ShopStatusToggle";
import ChatBot from "@/components/ChatBot";

const Shopkeeper = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [user, setUser] = useState<any>(null);
  const [shop, setShop] = useState<any>(null);
  const [stats, setStats] = useState({ total: 0, expiring: 0, revenue: 0 });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "shopkeeper") {
      navigate("/customer");
      return;
    }

    setUser(user);

    const { data: shopData } = await supabase
      .from("shops")
      .select("*")
      .eq("owner_id", user.id)
      .single();

    setShop(shopData);

    if (shopData) {
      loadStats(shopData.id);
    }
  };

  const loadStats = async (shopId: string) => {
    const { data: batches } = await supabase
      .from("inventory_batches")
      .select("*")
      .eq("shop_id", shopId)
      .eq("status", "active");

    if (batches) {
      const total = batches.reduce((sum, b) => sum + b.quantity, 0);
      const expiring = batches.filter(b => {
        const daysToExpiry = Math.ceil((new Date(b.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        return daysToExpiry <= 30 && daysToExpiry > 0;
      }).reduce((sum, b) => sum + b.quantity, 0);

      setStats({ total, expiring, revenue: 0 });
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (!shop) {
    return <ShopSetup onShopCreated={checkAuth} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-muted">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg">
              <img src="/clearshelf-logo.png" alt="ClearShelf" className="w-5 h-5 object-contain" />
            </div>
            <div>
              <h1 className="text-xl font-bold">Clear Shelf</h1>
              <p className="text-sm text-muted-foreground">{shop.name}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleLogout}>
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {shop.verification_status !== "verified" && (
          <div className="mb-6">
            <ShopVerificationStatus 
              status={shop.verification_status}
              rejectionReason={shop.rejection_reason}
              createdAt={shop.created_at}
            />
          </div>
        )}

        <div className="mb-6">
          <ShopStatusToggle shopId={shop.id} />
        </div>

        <div className="mb-6">
          <BillingDialog shopId={shop.id} shopName={shop.name} onInventoryUpdated={() => loadStats(shop.id)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total Items</CardTitle>
              <Package className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">{stats.total}</div>
              <p className="text-xs text-muted-foreground mt-1">In active inventory</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Expiring Soon</CardTitle>
              <AlertCircle className="w-4 h-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{stats.expiring}</div>
              <p className="text-xs text-muted-foreground mt-1">Within 30 days</p>
            </CardContent>
          </Card>

          <Card className="shadow-sm hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Monthly Revenue</CardTitle>
              <TrendingUp className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-primary">₹{stats.revenue}</div>
              <p className="text-xs text-muted-foreground mt-1">This month</p>
            </CardContent>
          </Card>
        </div>

        <Card className="shadow-lg">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Inventory Management</CardTitle>
                <CardDescription>Manage your product batches and pricing</CardDescription>
              </div>
              <div className="flex gap-2">
                <ScanProductDialog shopId={shop.id} onProductAdded={() => loadStats(shop.id)} />
                <AddProductDialog shopId={shop.id} onProductAdded={() => loadStats(shop.id)} />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <InventoryTable shopId={shop.id} />
          </CardContent>
        </Card>
      </main>
      
      <ChatBot userRole="shopkeeper" />
    </div>
  );
};

export default Shopkeeper;