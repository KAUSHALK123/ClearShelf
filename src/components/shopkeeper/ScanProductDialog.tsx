import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Camera, Upload, Loader2, Image as ImageIcon, X } from "lucide-react";
import CameraScan from "./CameraScan";

interface ScanProductDialogProps {
  shopId: string;
  onProductAdded: () => void;
}

const ScanProductDialog = ({ shopId, onProductAdded }: ScanProductDialogProps) => {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [productImages, setProductImages] = useState<File[]>([]);
  const [editMode, setEditMode] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageUpload = async (file: File) => {
    setScanning(true);

    try {
      // Convert image to base64
      const reader = new FileReader();
      reader.readAsDataURL(file);
      
      reader.onload = async () => {
        const base64 = reader.result?.toString().split(',')[1];
        
        if (!base64) {
          throw new Error('Failed to read image');
        }

        // Call OCR edge function
        const { data, error } = await supabase.functions.invoke('ocr-scan', {
          body: { imageBase64: base64 }
        });

        if (error) throw error;

        console.log('OCR Result:', data);

        setExtractedData(data);
        
        toast({
          title: "Image Processed!",
          description: `Extracted: ${data.productName || 'Product'} - Confidence: ${Math.round((data.confidence?.overall || 0) * 100)}%`,
        });
      };

      reader.onerror = () => {
        throw new Error('Failed to read image');
      };

    } catch (error: any) {
      console.error('OCR Error:', error);
      toast({
        title: "Scan Failed",
        description: error.message || "Could not extract product information from image",
        variant: "destructive",
      });
    } finally {
      setScanning(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleCameraCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleCapture = async (imageDataUrl: string) => {
    // imageDataUrl is like data:image/jpeg;base64,/9j/4AAQ...
    try {
      setIsCameraOpen(false);
      setScanning(true);
      const base64 = imageDataUrl.split(',')[1];
      if (!base64) throw new Error('Captured image is invalid');

      const { data, error } = await supabase.functions.invoke('ocr-scan', {
        body: { imageBase64: base64 }
      });

      if (error) throw error;

      console.log('OCR Result (camera):', data);
      setExtractedData(data);
      toast({
        title: 'Image Processed!',
        description: `Extracted: ${data.productName || 'Product'} - Confidence: ${Math.round((data.confidence?.overall || 0) * 100)}%`,
      });
    } catch (err: any) {
      console.error('Camera OCR Error:', err);
      toast({ title: 'Scan Failed', description: err.message || 'Could not process captured image', variant: 'destructive' });
    } finally {
      setScanning(false);
    }
  };

  const handleAddImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setProductImages(prev => [...prev, ...files]);
  };

  const removeImage = (index: number) => {
    setProductImages(prev => prev.filter((_, i) => i !== index));
  };

  const uploadProductImages = async (productId: string, batchId: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    for (const file of productImages) {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}-${Math.random()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(fileName);

      await supabase.from('product_images').insert({
        product_id: productId,
        batch_id: batchId,
        image_url: publicUrl,
        uploaded_by: user.id
      });
    }
  };

  const handleAddProduct = async () => {
    if (!extractedData) return;

    setLoading(true);

    try {
      let productId: string;

      const { data: existingProduct } = await supabase
        .from("products")
        .select("id")
        .eq("name", extractedData.productName)
        .eq("brand", extractedData.brand || "")
        .maybeSingle();

      if (existingProduct) {
        productId = existingProduct.id;
      } else {
        const { data: newProduct, error: productError } = await supabase
          .from("products")
          .insert({
            name: extractedData.productName,
            brand: extractedData.brand || "Unknown",
            category: extractedData.category || "General",
            default_mrp: extractedData.mrp || 0,
            gtin: extractedData.gtin || null,
          })
          .select()
          .single();

        if (productError) throw productError;
        productId = newProduct.id;
      }

      let discountPercent = 0;
      if (extractedData.expiryDate) {
        const daysToExpiry = Math.ceil(
          (new Date(extractedData.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );
        
        if (daysToExpiry <= 30 && daysToExpiry > 15) {
          discountPercent = 10;
        } else if (daysToExpiry <= 15 && daysToExpiry > 7) {
          discountPercent = 20;
        } else if (daysToExpiry <= 7 && daysToExpiry > 0) {
          discountPercent = 30;
        }
      }

      const { data: batch, error: batchError } = await supabase
        .from("inventory_batches")
        .insert({
          shop_id: shopId,
          product_id: productId,
          batch_code: extractedData.batchCode || `BATCH-${Date.now()}`,
          quantity: extractedData.quantity || 1,
          expiry_date: extractedData.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          mrp: extractedData.mrp || 0,
          discount_percent: discountPercent,
        })
        .select()
        .single();

      if (batchError) throw batchError;

      if (productImages.length > 0) {
        await uploadProductImages(productId, batch.id);
      }

      toast({
        title: "Product Added!",
        description: discountPercent > 0 
          ? `Auto-discount of ${discountPercent}% applied with ${productImages.length} image(s)`
          : `Successfully added to inventory with ${productImages.length} image(s)`,
      });

      setExtractedData(null);
      setProductImages([]);
      setEditMode(false);
      setOpen(false);
      onProductAdded();
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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Camera className="w-4 h-4 mr-2" />
          Scan Product
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Scan Product Packaging</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {!extractedData ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center justify-center py-8 border-2 border-dashed rounded-lg">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraCapture}
                  className="hidden"
                />
                
                {scanning ? (
                  <div className="text-center">
                    <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
                    <p className="text-sm text-muted-foreground">Processing image with AI...</p>
                  </div>
                ) : (
                  <>
                    <ImageIcon className="w-12 h-12 text-muted-foreground mb-4" />
                    <div className="flex gap-3">
                      <Button onClick={() => setIsCameraOpen(true)} variant="default">
                        <Camera className="w-4 h-4 mr-2" />
                        Take Photo
                      </Button>
                      <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Image
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground mt-3 text-center">
                      Capture or upload a photo of the product barcode/label
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="font-medium">Extracted Information</h3>
                <Button
                  variant={editMode ? "default" : "outline"}
                  size="sm"
                  onClick={() => setEditMode(!editMode)}
                >
                  {editMode ? "Lock Fields" : "Edit Fields"}
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Product Name *</Label>
                  <Input
                    value={extractedData.productName || ""}
                    onChange={(e) => setExtractedData({...extractedData, productName: e.target.value})}
                    disabled={!editMode}
                    className={editMode ? "border-primary" : ""}
                  />
                </div>
                <div>
                  <Label>Brand</Label>
                  <Input
                    value={extractedData.brand || ""}
                    onChange={(e) => setExtractedData({...extractedData, brand: e.target.value})}
                    disabled={!editMode}
                    className={editMode ? "border-primary" : ""}
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Input
                    value={extractedData.category || "General"}
                    onChange={(e) => setExtractedData({...extractedData, category: e.target.value})}
                    disabled={!editMode}
                    className={editMode ? "border-primary" : ""}
                  />
                </div>
                <div>
                  <Label>Barcode/GTIN</Label>
                  <Input
                    value={extractedData.gtin || ""}
                    onChange={(e) => setExtractedData({...extractedData, gtin: e.target.value})}
                    disabled={!editMode}
                    placeholder="Not detected"
                    className={editMode ? "border-primary" : ""}
                  />
                </div>
                <div>
                  <Label>Batch Code</Label>
                  <Input
                    value={extractedData.batchCode || ""}
                    onChange={(e) => setExtractedData({...extractedData, batchCode: e.target.value})}
                    disabled={!editMode}
                    placeholder="Auto-generated"
                    className={editMode ? "border-primary" : ""}
                  />
                </div>
                <div>
                  <Label>Expiry Date *</Label>
                  <Input
                    type="date"
                    value={extractedData.expiryDate || ""}
                    onChange={(e) => setExtractedData({...extractedData, expiryDate: e.target.value})}
                    disabled={!editMode}
                    className={editMode ? "border-primary" : ""}
                  />
                </div>
                <div>
                  <Label>MRP (₹) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={extractedData.mrp || ""}
                    onChange={(e) => setExtractedData({...extractedData, mrp: parseFloat(e.target.value)})}
                    disabled={!editMode}
                    className={editMode ? "border-primary" : ""}
                  />
                </div>
                <div>
                  <Label>Quantity *</Label>
                  <Input
                    type="number"
                    value={extractedData.quantity || 1}
                    onChange={(e) => setExtractedData({...extractedData, quantity: parseInt(e.target.value)})}
                    disabled={!editMode}
                    className={editMode ? "border-primary" : ""}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Product Images (Optional)</Label>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleAddImages}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => imageInputRef.current?.click()}
                  type="button"
                  className="w-full"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Add More Images ({productImages.length})
                </Button>
                {productImages.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {productImages.map((file, idx) => (
                      <div key={idx} className="relative">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Product ${idx + 1}`}
                          className="h-20 w-20 object-cover rounded"
                        />
                        <Button
                          size="icon"
                          variant="destructive"
                          className="absolute -top-2 -right-2 h-6 w-6"
                          onClick={() => removeImage(idx)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {extractedData.confidence && (
                <div className="p-4 bg-secondary/50 rounded-lg">
                  <p className="text-sm font-medium mb-2">Extraction Confidence</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span>Overall:</span>
                      <span className="font-semibold">{Math.round(extractedData.confidence.overall * 100)}%</span>
                    </div>
                    {extractedData.confidence.productName && (
                      <div className="flex justify-between">
                        <span>Product Name:</span>
                        <span>{Math.round(extractedData.confidence.productName * 100)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setExtractedData(null)}>
                  Scan Again
                </Button>
                <Button onClick={handleAddProduct} disabled={loading}>
                  {loading ? "Adding..." : "Add to Inventory"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
      {/* Camera Modal */}
      <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Scan with Camera</DialogTitle>
            <DialogDescription>Position the product's barcode or label clearly in the frame and capture.</DialogDescription>
          </DialogHeader>
          <CameraScan onCapture={handleCapture} onClose={() => setIsCameraOpen(false)} />
        </DialogContent>
      </Dialog>
    </Dialog>
  );
};

export default ScanProductDialog;