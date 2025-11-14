import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ShoppingBag, Store, TrendingDown } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role === "shopkeeper") {
        navigate("/shopkeeper");
      } else {
        navigate("/customer");
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-accent/5">
      <div className="container mx-auto px-4 py-16">
        <header className="text-center mb-16">
          <div className="flex justify-center mb-6">
            <div className="p-4 bg-primary rounded-2xl shadow-lg">
              <img src="/clearshelf-logo.png" alt="ClearShelf" className="w-12 h-12 object-contain" />
            </div>
          </div>
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Clear Shelf
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Great Deals, Zero Food Waste. Connect local shops with smart customers.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <div className="text-center p-6 bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="inline-flex p-3 bg-primary/10 rounded-full mb-4">
              <Store className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">For Shopkeepers</h3>
            <p className="text-muted-foreground">
              Manage inventory, auto-apply discounts on expiring products, and reduce waste
            </p>
          </div>

          <div className="text-center p-6 bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="inline-flex p-3 bg-accent/10 rounded-full mb-4">
              <ShoppingBag className="w-8 h-8 text-accent" />
            </div>
            <h3 className="text-xl font-semibold mb-2">For Customers</h3>
            <p className="text-muted-foreground">
              Discover nearby discounted products, save money while saving food
            </p>
          </div>

          <div className="text-center p-6 bg-card rounded-lg shadow-sm hover:shadow-md transition-shadow">
            <div className="inline-flex p-3 bg-primary/10 rounded-full mb-4">
              <TrendingDown className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Smart Discounts</h3>
            <p className="text-muted-foreground">
              Automatic discount suggestions based on expiry dates with real-time updates
            </p>
          </div>
        </div>

        <div className="flex justify-center gap-4">
          <Button size="lg" onClick={() => navigate("/auth")} className="shadow-lg">
            Get Started
          </Button>
          <Button size="lg" variant="outline" onClick={() => navigate("/auth")}>
            Learn More
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Index;
