import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Heart, ShoppingCart } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import CheckoutDialog from "./CheckoutDialog";

interface ProductCardProps {
  batch: any;
}

const ProductCard = ({ batch }: ProductCardProps) => {
  const { toast } = useToast();
  const [isInWishlist, setIsInWishlist] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    checkWishlist();
  }, [batch.product_id]);

  const checkWishlist = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("wishlists")
      .select("id")
      .eq("customer_id", user.id)
      .eq("product_id", batch.product_id)
      .single();

    setIsInWishlist(!!data);
  };

  const toggleWishlist = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast({
        title: "Login required",
        description: "Please log in to add products to wishlist",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      if (isInWishlist) {
        const { error } = await supabase
          .from("wishlists")
          .delete()
          .eq("customer_id", user.id)
          .eq("product_id", batch.product_id);

        if (error) throw error;

        toast({
          title: "Removed from wishlist",
        });
        setIsInWishlist(false);
      } else {
        const { error } = await supabase
          .from("wishlists")
          .insert({
            customer_id: user.id,
            product_id: batch.product_id,
          });

        if (error) throw error;

        toast({
          title: "Added to wishlist",
          description: "You'll be notified when this product gets discounted!",
        });
        setIsInWishlist(true);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const finalPrice = batch.mrp * (1 - batch.discount_percent / 100);
  const daysToExpiry = Math.ceil(
    (new Date(batch.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-base">{batch.products.name}</CardTitle>
            <div className="flex items-center justify-between text-sm text-muted-foreground mt-1">
              <span>{batch.products.brand}</span>
              <Badge variant="secondary">{batch.products.category}</Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleWishlist}
            disabled={loading}
            className="ml-2"
          >
            <Heart
              className={`w-5 h-5 ${isInWishlist ? "fill-red-500 text-red-500" : ""}`}
            />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Price</p>
            <div className="flex items-center gap-2">
              <span className="text-sm line-through text-muted-foreground">
                ₹{batch.mrp.toFixed(2)}
              </span>
              <span className="text-lg font-bold text-primary">
                ₹{finalPrice.toFixed(2)}
              </span>
            </div>
          </div>
          <Badge className="bg-accent text-accent-foreground">
            {batch.discount_percent}% OFF
          </Badge>
        </div>

        <div className="pt-2 border-t space-y-1">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Store:</span> {batch.shops.name}
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Stock:</span> {batch.quantity} units
          </p>
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Expires:</span>{" "}
            {format(new Date(batch.expiry_date), "MMM dd, yyyy")} ({daysToExpiry}d)
          </p>
        </div>

        <Button
          className="w-full"
          onClick={() => setCheckoutOpen(true)}
          disabled={batch.quantity === 0}
        >
          <ShoppingCart className="w-4 h-4 mr-2" />
          Buy Now
        </Button>
      </CardContent>

      <CheckoutDialog
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        batch={batch}
      />
    </Card>
  );
};

export default ProductCard;