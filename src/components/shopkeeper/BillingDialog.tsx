import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Camera, Loader2, Trash, ShoppingCart, Printer, FileUp } from "lucide-react";
import CameraScan from "./CameraScan";

interface CartItem {
  productId: string;
  gtin: string;
  name: string;
  qty: number;
  unitPrice: number;
  availableQty: number;
}

interface BillingDialogProps {
  shopId: string;
  shopName?: string;
  onInventoryUpdated: () => void;
}

const BillingDialog = ({ shopId, shopName, onInventoryUpdated }: BillingDialogProps) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [productImages, setProductImages] = useState<string[]>([]); // data URLs

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // The result includes the data URL prefix, which we need for the OCR function.
        resolve(reader.result as string);
      };
      reader.onerror = (error) => reject(error);
    });

  const resetState = () => {
    setCart([]);
    setIsScanning(false);
    setIsCheckingOut(false);
    setIsCameraOpen(false);
  };

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    for (const file of files) {
      try {
        const imageDataUrl = await toBase64(file); // data URL
        // store for preview
        setProductImages(prev => [...prev, imageDataUrl]);
        await processImage(imageDataUrl);
      } catch (err) {
        console.error('Failed to process uploaded file', err);
      }
    }
  };
  
  const handleCapture = async (imageBase64: string) => {
    // Keep camera open to allow multiple captures. The CameraScan component has a close button.
    try {
      // store captured data URL for preview
      setProductImages(prev => [...prev, imageBase64]);
      await processImage(imageBase64);
    } catch (err) {
      console.error('Failed to process captured image', err);
    }
  };

  const processImage = async (imageBase64: string) => {
    if (!imageBase64) return;
    
    // The base64 string from react-webcam and file reader includes the data URI prefix.
    // The edge function expects the raw base64 string.
    const pureBase64 = imageBase64.split(',')[1];

    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("ocr-scan", {
        body: { imageBase64: pureBase64 },
      });

      if (error) {
        console.error('Supabase function invocation failed:', error);
        throw new Error(error.message || 'Edge function returned a non-2xx code.');
      }
      
      // Try to resolve product using GTIN if available, otherwise use productName + expiryDate
      await resolveScannedProductToCart(data);

    } catch (error: any) {
      console.error("OCR Scan failed:", error);
      toast({
        variant: "destructive",
        title: "Scan Failed",
        description: error.message || "Could not process image. Please try again.",
      });
    } finally {
      setIsScanning(false);
      if(fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const resolveScannedProductToCart = async (ocrData: any) => {
      // ocrData may contain { gtin, productName, expiryDate }
      let productData: any = null;

      // 1) Prefer GTIN match when available
      if (ocrData?.gtin) {
        const { data, error } = await supabase
          .from("products")
          .select("id, name")
          .eq("gtin", ocrData.gtin)
          .maybeSingle();

        if (data) productData = data;
      }

      // 2) If no GTIN match, try matching by product name (and optionally expiry date)
      if (!productData && ocrData?.productName) {
        // search products by name (case-insensitive, partial match)
        const nameQuery = ocrData.productName.trim();
        const { data: products } = await supabase
          .from("products")
          .select("id, name")
          .ilike("name", `%${nameQuery}%`)
          .limit(5);

        if (products && products.length > 0) {
          // If expiry date provided, prefer product that has a batch with that expiry
          if (ocrData?.expiryDate) {
            for (const p of products) {
              const { data: batches } = await supabase
                .from("inventory_batches")
                .select("id, quantity, mrp, discount_percent")
                .eq("product_id", p.id)
                .eq("shop_id", shopId)
                .eq("status", "active")
                .eq("expiry_date", ocrData.expiryDate)
                .gt("quantity", 0)
                .limit(1);

              if (batches && batches.length > 0) {
                productData = p;
                break;
              }
            }
          }

          // Fallback to first matched product if none matched by expiry
          if (!productData) productData = products[0];
        }
      }

      if (!productData) {
        toast({ variant: "destructive", title: "Product not found", description: "Could not match product by GTIN or name." });
        return;
      }

      // 3) Find inventory batches for this shop & product. Prefer matching expiry date if provided.
      let inventoryQuery = supabase
        .from("inventory_batches")
        .select("id, quantity, mrp, discount_percent, expiry_date")
        .eq("product_id", productData.id)
        .eq("shop_id", shopId)
        .eq("status", "active")
        .gt("quantity", 0);

      if (ocrData?.expiryDate) {
        inventoryQuery = inventoryQuery.eq("expiry_date", ocrData.expiryDate);
      }

      const { data: inventoryBatches, error: inventoryError } = await inventoryQuery;

      // If no batches found when filtering by expiry, try without expiry filter
      let batches = inventoryBatches;
      if ((!batches || batches.length === 0) && ocrData?.expiryDate) {
        const { data: fallbackBatches, error: fallbackError } = await supabase
          .from("inventory_batches")
          .select("id, quantity, mrp, discount_percent, expiry_date")
          .eq("product_id", productData.id)
          .eq("shop_id", shopId)
          .eq("status", "active")
          .gt("quantity", 0);

        if (fallbackError) {
          console.error("Inventory fallback fetch error:", fallbackError);
        }
        batches = fallbackBatches;
      }

      if (!batches || batches.length === 0) {
        toast({ variant: "destructive", title: "Out of Stock", description: "This product is not available in your inventory." });
        return;
      }

      const availableQty = batches.reduce((sum: number, batch: any) => sum + batch.quantity, 0);
      const firstBatch = batches[0];
      const unitPrice = firstBatch.mrp * (1 - (firstBatch.discount_percent || 0) / 100);

      // 4) Add or update cart
      setCart(currentCart => {
        const existingItem = currentCart.find(item => item.productId === productData.id);
        if (existingItem) {
          if (existingItem.qty < availableQty) {
            return currentCart.map(item =>
              item.productId === productData.id ? { ...item, qty: item.qty + 1 } : item
            );
          } else {
            toast({ title: "Max quantity reached", description: "No more stock available for this item." });
            return currentCart;
          }
        } else {
          return [...currentCart, {
            productId: productData.id,
            gtin: ocrData?.gtin || null,
            name: productData.name,
            qty: 1,
            unitPrice: unitPrice,
            availableQty: availableQty,
          }];
        }
      });
    };

  const changeQty = (productId: string, newQty: number) => {
    setCart(cart.map(item => {
      if (item.productId === productId) {
        if (newQty > 0 && newQty <= item.availableQty) {
          return { ...item, qty: newQty };
        }
        if (newQty > item.availableQty) {
            toast({ title: "Not enough stock", description: `Only ${item.availableQty} items available.`})
            return { ...item, qty: item.availableQty };
        }
      }
      return item;
    }));
  };

  const removeItem = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const finalizeCheckout = async () => {
    if (cart.length === 0) {
      toast({ title: "Cart is empty", description: "Add items to the cart before checking out." });
      return;
    }
    
    // 1. Generate the receipt immediately for the customer.
    generateReceiptHtml();
    
    setIsCheckingOut(true);

    try {
      // 2. Attempt to update inventory in the background.
      for (const item of cart) {
        let quantityToDeduct = item.qty;

        const { data: batches, error: fetchError } = await supabase
          .from("inventory_batches")
          .select("id, quantity")
          .eq("product_id", item.productId)
          .eq("shop_id", shopId)
          .eq("status", "active")
          .gt("quantity", 0)
          .order("expiry_date", { ascending: true });

        if (fetchError) throw new Error(`Failed to fetch batches for ${item.name}: ${fetchError.message}`);

        for (const batch of batches) {
          if (quantityToDeduct === 0) break;

          const deduction = Math.min(quantityToDeduct, batch.quantity);
          const newQuantity = batch.quantity - deduction;
          
          const { error: updateError } = await supabase
            .from("inventory_batches")
            .update({ 
              quantity: newQuantity,
              status: newQuantity === 0 ? 'sold_out' : 'active'
            })
            .eq("id", batch.id);

          if (updateError) {
            // Log the error but don't block the user. The receipt is already printed.
            console.error(`Failed to update batch ${batch.id}:`, updateError);
            // We can choose to throw here to show a partial failure message,
            // or continue to try updating other items. For now, we'll throw.
            throw new Error(`Failed to update inventory for ${item.name}. Please check manually.`);
          }
          
          quantityToDeduct -= deduction;
        }
      }

      toast({ title: "Checkout Successful", description: "Inventory has been updated." });
      onInventoryUpdated(); // Refresh the dashboard stats
      setIsOpen(false); // Close the dialog on full success

    } catch (error: any) {
      console.error("Checkout failed:", error);
      toast({
        variant: "destructive",
        title: "Inventory Update Failed",
        description: error.message || "The receipt was printed, but inventory could not be updated.",
      });
      // Don't close the dialog on failure, so the user is aware.
    } finally {
      setIsCheckingOut(false);
    }
  };

  const generateReceiptHtml = () => {
    const subtotal = cart.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
    const receiptWindow = window.open("", "_blank");
    if (receiptWindow) {
      receiptWindow.document.write(`
        <html>
          <head><title>Receipt</title>
          <style>
            body { font-family: monospace; margin: 2rem; }
            h1, h2 { text-align: center; }
            table { width: 100%; border-collapse: collapse; margin-top: 1rem; }
            th, td { border: 1px solid #ccc; padding: 8px; text-align: left; }
            .total { font-weight: bold; }
          </style>
          </head>
          <body>
            <h1>${shopName || 'Your Shop'}</h1>
            <h2>Date: ${new Date().toLocaleString()}</h2>
            <table>
              <thead>
                <tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr>
              </thead>
              <tbody>
                ${cart.map(item => `
                  <tr>
                    <td>${item.name}</td>
                    <td>${item.qty}</td>
                    <td>₹${item.unitPrice.toFixed(2)}</td>
                    <td>₹${(item.qty * item.unitPrice).toFixed(2)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            <h2 class="total">Subtotal: ₹${subtotal.toFixed(2)}</h2>
            <p style="text-align: center; margin-top: 2rem;">Thank you for your purchase!</p>
          </body>
        </html>
      `);
      receiptWindow.document.close();
    }
  };

  const subtotal = cart.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) resetState(); }}>
      <DialogTrigger asChild>
        <Button className="w-full py-6 text-lg">
          <ShoppingCart className="w-6 h-6 mr-3" />
          Start Billing
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>New Bill</DialogTitle>
          <DialogDescription>
            Scan products to add them to the cart. Finalize to generate a receipt and update inventory.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 overflow-hidden">
          {/* Left: Scan & Cart */}
          <div className="flex flex-col gap-4 overflow-y-auto pr-2">
            <Input
              type="file"
              accept="image/*"
              capture="environment"
              multiple
              onChange={handleImageUpload}
              ref={fileInputRef}
              className="hidden"
            />
            <div className="flex gap-2">
              <Button onClick={() => fileInputRef.current?.click()} disabled={isScanning}>
                <FileUp className="w-4 h-4 mr-2" />
                Upload Images
              </Button>
              <Button onClick={() => setIsCameraOpen(true)} disabled={isScanning} variant="outline">
                <Camera className="w-4 h-4 mr-2" />
                Capture (Camera)
              </Button>
            </div>

            {productImages.length > 0 && (
              <div className="mt-3 flex gap-2 overflow-x-auto">
                {productImages.map((dataUrl, idx) => (
                  <div key={idx} className="relative">
                    <img src={dataUrl} alt={`capture-${idx}`} className="h-20 w-20 object-cover rounded" />
                    <Button size="icon" variant="destructive" className="absolute -top-2 -right-2 h-6 w-6" onClick={() => setProductImages(prev => prev.filter((_, i) => i !== idx))}>
                      <Trash className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex-1 rounded-lg border bg-background p-4 space-y-2">
              <h3 className="font-semibold">Cart ({cart.length})</h3>
              {cart.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Scan a product to get started</p>
              ) : (
                <div className="space-y-2">
                  {cart.map(item => (
                    <div key={item.productId} className="flex items-center justify-between gap-2 p-2 border rounded">
                      <div className="flex-1">
                        <div className="font-medium">{item.name}</div>
                        <div className="text-xs text-muted-foreground">Available: {item.availableQty}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input type="number" value={item.qty} onChange={(e) => changeQty(item.productId, parseInt(e.target.value || "1"))} className="w-16" />
                        <Button size="icon" variant="outline" onClick={() => removeItem(item.productId)}>
                          <Trash className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: Receipt Preview */}
          <div className="flex flex-col rounded-lg border bg-muted/30 p-4">
            <h3 className="font-semibold mb-4 text-center">Receipt Preview</h3>
            <div className="flex-1 overflow-y-auto text-sm font-mono">
              <div className="p-2">
                <h4 className="text-lg font-bold text-center">{shopName || 'Your Shop'}</h4>
                <p className="text-xs text-center mb-4">{new Date().toLocaleString()}</p>
                <div className="space-y-1">
                  {cart.map(item => (
                    <div key={item.productId} className="flex justify-between">
                      <span>{item.name} x{item.qty}</span>
                      <span>₹{(item.qty * item.unitPrice).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                {cart.length > 0 && <hr className="my-2 border-dashed" />}
                <div className="flex justify-between font-bold text-base">
                  <span>Subtotal</span>
                  <span>₹{subtotal.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        {/* Camera Modal for live captures */}
        <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Scan with Camera</DialogTitle>
              <DialogDescription>Position the product's barcode or label clearly in the frame and capture.</DialogDescription>
            </DialogHeader>
            <CameraScan onCapture={handleCapture} onClose={() => setIsCameraOpen(false)} />
          </DialogContent>
        </Dialog>

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button onClick={finalizeCheckout} disabled={isCheckingOut || cart.length === 0}>
            {isCheckingOut ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Printer className="w-4 h-4 mr-2" />
            )}
            Finalize & Print Receipt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BillingDialog;
