import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ShoppingCart, CreditCard, Loader2 } from "lucide-react";

interface CheckoutDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch: any;
}

const CheckoutDialog = ({ open, onOpenChange, batch }: CheckoutDialogProps) => {
  const { toast } = useToast();
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);

  const finalPrice = batch.mrp * (1 - batch.discount_percent / 100);
  const totalPrice = finalPrice * quantity;

  const handleCheckout = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        toast({
          title: "Authentication Required",
          description: "Please log in to make a purchase",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Create transaction record
      const { error: transactionError } = await supabase
        .from("transactions")
        .insert({
          customer_id: user.id,
          shop_id: batch.shop_id,
          product_id: batch.product_id,
          batch_id: batch.id,
          quantity: quantity,
          price: finalPrice,
        });

      if (transactionError) {
        throw transactionError;
      }

      // Update inventory quantity
      const newQuantity = batch.quantity - quantity;
      const { error: updateError } = await supabase
        .from("inventory_batches")
        .update({ 
          quantity: newQuantity,
          status: newQuantity === 0 ? "sold_out" : "active"
        })
        .eq("id", batch.id);

      if (updateError) {
        throw updateError;
      }

      toast({
        title: "Purchase Successful! 🎉",
        description: `You bought ${quantity} ${batch.products.name}(s) for ₹${totalPrice.toFixed(2)}`,
      });

      onOpenChange(false);
      setQuantity(1);
      
      // Reload the page to reflect updated inventory
      setTimeout(() => window.location.reload(), 1500);
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast({
        title: "Purchase Failed",
        description: error.message || "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="w-5 h-5" />
            Checkout
          </DialogTitle>
          <DialogDescription>
            Complete your purchase for this discounted product
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Product Details */}
          <div className="bg-secondary/50 p-4 rounded-lg">
            <h3 className="font-semibold">{batch.products.name}</h3>
            <p className="text-sm text-muted-foreground">{batch.products.brand}</p>
            <div className="flex items-center gap-2 mt-2">
              <span className="text-sm text-muted-foreground line-through">
                ₹{batch.mrp.toFixed(2)}
              </span>
              <span className="font-bold text-primary">
                ₹{finalPrice.toFixed(2)}
              </span>
              <span className="text-xs bg-accent text-accent-foreground px-2 py-1 rounded">
                {batch.discount_percent}% OFF
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Available: {batch.quantity} units
            </p>
          </div>

          {/* Quantity Selector */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Quantity</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              max={batch.quantity}
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, Math.min(batch.quantity, parseInt(e.target.value) || 1)))}
            />
          </div>

          {/* Total Price */}
          <div className="bg-primary/10 p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-semibold">Total Amount:</span>
              <span className="text-2xl font-bold text-primary">
                ₹{totalPrice.toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Button */}
          <Button
            className="w-full"
            size="lg"
            onClick={handleCheckout}
            disabled={loading || quantity < 1 || quantity > batch.quantity}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CreditCard className="w-4 h-4 mr-2" />
                Complete Purchase
              </>
            )}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            By completing this purchase, you agree to pick up the product from the store location.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutDialog;
