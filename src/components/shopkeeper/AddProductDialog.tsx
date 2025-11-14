import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { z } from "zod";

interface AddProductDialogProps {
  shopId: string;
  onProductAdded: () => void;
}

// Validation schema
const productSchema = z.object({
  productName: z.string().trim().min(1, "Product name is required").max(200, "Product name too long"),
  brand: z.string().trim().min(1, "Brand is required").max(100, "Brand name too long"),
  category: z.string().trim().min(1, "Category is required").max(50, "Category too long"),
  mrp: z.number().positive("MRP must be positive").max(1000000, "MRP too high"),
  batchCode: z.string().trim().min(1, "Batch code is required").max(50, "Batch code too long"),
  quantity: z.number().int("Quantity must be a whole number").positive("Quantity must be positive").max(100000, "Quantity too high"),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  gtin: z.string().max(20, "GTIN too long").optional().nullable()
});

const AddProductDialog = ({ shopId, onProductAdded }: AddProductDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    productName: "",
    brand: "",
    category: "",
    mrp: "",
    batchCode: "",
    quantity: "",
    expiryDate: "",
    gtin: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input data
      const validatedData = productSchema.parse({
        productName: formData.productName,
        brand: formData.brand,
        category: formData.category,
        mrp: parseFloat(formData.mrp),
        batchCode: formData.batchCode,
        quantity: parseInt(formData.quantity),
        expiryDate: formData.expiryDate,
        gtin: formData.gtin || null
      });

      let productId: string;

      const { data: existingProduct } = await supabase
        .from("products")
        .select("id")
        .eq("name", validatedData.productName)
        .eq("brand", validatedData.brand)
        .maybeSingle();

      if (existingProduct) {
        productId = existingProduct.id;
      } else {
        const { data: newProduct, error: productError } = await supabase
          .from("products")
          .insert({
            name: validatedData.productName,
            brand: validatedData.brand,
            category: validatedData.category,
            default_mrp: validatedData.mrp,
            gtin: validatedData.gtin,
          })
          .select()
          .single();

        if (productError) throw productError;
        productId = newProduct.id;
      }

      const daysToExpiry = Math.ceil(
        (new Date(validatedData.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
      );
      
      let discountPercent = 0;
      if (daysToExpiry <= 30 && daysToExpiry > 15) {
        discountPercent = 10;
      } else if (daysToExpiry <= 15 && daysToExpiry > 7) {
        discountPercent = 20;
      } else if (daysToExpiry <= 7 && daysToExpiry > 0) {
        discountPercent = 30;
      }

      const { error: batchError } = await supabase.from("inventory_batches").insert({
        shop_id: shopId,
        product_id: productId,
        batch_code: validatedData.batchCode,
        quantity: validatedData.quantity,
        expiry_date: validatedData.expiryDate,
        mrp: validatedData.mrp,
        discount_percent: discountPercent,
      });

      if (batchError) throw batchError;

      toast({
        title: "Product added!",
        description: discountPercent > 0 
          ? `Auto-discount of ${discountPercent}% applied based on expiry date.`
          : "Product successfully added to inventory.",
      });

      setFormData({
        productName: "",
        brand: "",
        category: "",
        mrp: "",
        batchCode: "",
        quantity: "",
        expiryDate: "",
        gtin: "",
      });
      setOpen(false);
      onProductAdded();
    } catch (error: any) {
      const errorMessage = error instanceof z.ZodError 
        ? error.errors[0].message 
        : error.message;
      
      toast({
        title: "Validation Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Add Product
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Product Batch</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="productName">Product Name *</Label>
              <Input
                id="productName"
                value={formData.productName}
                onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="brand">Brand *</Label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="e.g., Dairy, Snacks"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gtin">Barcode/GTIN (optional)</Label>
              <Input
                id="gtin"
                value={formData.gtin}
                onChange={(e) => setFormData({ ...formData, gtin: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="mrp">MRP (₹) *</Label>
              <Input
                id="mrp"
                type="number"
                step="0.01"
                value={formData.mrp}
                onChange={(e) => setFormData({ ...formData, mrp: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="batchCode">Batch Code *</Label>
              <Input
                id="batchCode"
                value={formData.batchCode}
                onChange={(e) => setFormData({ ...formData, batchCode: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                value={formData.quantity}
                onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="expiryDate">Expiry Date *</Label>
              <Input
                id="expiryDate"
                type="date"
                value={formData.expiryDate}
                onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Adding..." : "Add Product"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddProductDialog;
