import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, MapPin, Heart } from "lucide-react";
import ProductFeed from "@/components/customer/ProductFeed";
import StoreMap from "@/components/customer/StoreMap";
import WishlistPanel from "@/components/customer/WishlistPanel";
import NotificationBell from "@/components/customer/NotificationBell";
import ChatBot from "@/components/ChatBot";

const Customer = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [view, setView] = useState<"map" | "feed" | "wishlist">("map");

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

    if (profile?.role === "shopkeeper") {
      navigate("/shopkeeper");
      return;
    }

    setUser(user);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-muted">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary rounded-lg">
              <img src="/clearshelf-logo.png" alt="ClearShelf" className="w-5 h-5 object-contain" />
            </div>
            <h1 className="text-xl font-bold">Clear Shelf</h1>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Button
              variant={view === "map" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("map")}
            >
              <MapPin className="w-4 h-4 mr-2" />
              Map
            </Button>
            <Button
              variant={view === "feed" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("feed")}
            >
              Products
            </Button>
            <Button
              variant={view === "wishlist" ? "default" : "outline"}
              size="sm"
              onClick={() => setView("wishlist")}
            >
              <Heart className="w-4 h-4 mr-2" />
              Wishlist
            </Button>
            <Button variant="outline" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="h-[calc(100vh-73px)]">
        {view === "map" ? (
          <StoreMap />
        ) : view === "feed" ? (
          <ProductFeed />
        ) : (
          <div className="h-full overflow-y-auto">
            <div className="container mx-auto px-4 py-6">
              <WishlistPanel />
            </div>
          </div>
        )}
      </main>
      
      <ChatBot userRole="customer" />
    </div>
  );
};

export default Customer;