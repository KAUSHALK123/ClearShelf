import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Heart, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const WishlistPanel = () => {
  const { toast } = useToast();
  const [wishlist, setWishlist] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWishlist();

    const channel = supabase
      .channel("wishlist-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "wishlists",
        },
        () => {
          loadWishlist();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadWishlist = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from("wishlists")
      .select(`
        *,
        products (
          *,
          inventory_batches (
            *,
            shops (name, address)
          )
        )
      `)
      .eq("customer_id", user.id);

    if (!error && data) {
      setWishlist(data);
    }
    setLoading(false);
  };

  const removeFromWishlist = async (wishlistId: string) => {
    const { error } = await supabase
      .from("wishlists")
      .delete()
      .eq("id", wishlistId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Removed",
      description: "Product removed from wishlist",
    });
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading wishlist...</div>;
  }

  if (wishlist.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Heart className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-50" />
          <p className="text-muted-foreground">Your wishlist is empty</p>
          <p className="text-sm text-muted-foreground mt-1">
            Add products to get notified when they go on discount!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {wishlist.map((item) => {
        const discountedBatches = item.products.inventory_batches.filter(
          (b: any) => b.discount_percent > 0 && b.status === "active"
        );
        const bestDiscount = Math.max(...discountedBatches.map((b: any) => b.discount_percent), 0);

        return (
          <Card key={item.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-base">{item.products.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{item.products.brand}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeFromWishlist(item.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {discountedBatches.length > 0 ? (
                <div className="space-y-2">
                  <Badge className="bg-accent">
                    {discountedBatches.length} deal{discountedBatches.length > 1 ? 's' : ''} available
                  </Badge>
                  <p className="text-sm font-medium">Best discount: {bestDiscount}% OFF</p>
                  {discountedBatches.slice(0, 2).map((batch: any) => (
                    <div key={batch.id} className="text-sm text-muted-foreground">
                      • {batch.shops.name} - {batch.discount_percent}% off
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No discounts available yet. You'll be notified when this product goes on sale!
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default WishlistPanel;