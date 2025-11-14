import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Store, ArrowLeft, LogOut } from "lucide-react";
import { z } from "zod";
import { LocationPickerMap } from "./LocationPickerMap";

interface ShopSetupProps {
  onShopCreated: () => void;
}

// Validation schema
const shopSchema = z.object({
  name: z.string().trim().min(3, "Shop name must be at least 3 characters").max(100, "Shop name too long"),
  address: z.string().trim().min(10, "Address must be at least 10 characters").max(500, "Address too long"),
  latitude: z.number().min(-90, "Invalid latitude").max(90, "Invalid latitude"),
  longitude: z.number().min(-180, "Invalid longitude").max(180, "Invalid longitude"),
  gstNumber: z.string().trim().max(15, "GST number too long").optional().nullable()
});

const ShopSetup = ({ onShopCreated }: ShopSetupProps) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    address: "",
    latitude: "",
    longitude: "",
    gstNumber: "",
  });

  const handleLocationSelect = (lat: number, lng: number) => {
    setFormData({
      ...formData,
      latitude: lat.toFixed(6),
      longitude: lng.toFixed(6),
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logged out",
      description: "You have been successfully logged out",
    });
    navigate("/auth");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate input data
      const validatedData = shopSchema.parse({
        name: formData.name,
        address: formData.address,
        latitude: parseFloat(formData.latitude),
        longitude: parseFloat(formData.longitude),
        gstNumber: formData.gstNumber || null
      });

      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase.from("shops").insert({
        name: validatedData.name,
        address: validatedData.address,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
        owner_id: user.id,
        gst_number: validatedData.gstNumber,
      });

      if (error) throw error;

      toast({
        title: "Shop Registered Successfully! 🎉",
        description: "Your shop is under review. Admins typically approve within 1-2 business days. You'll receive a notification once verified.",
      });

      onShopCreated();
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 via-background to-muted p-4">
      <Card className="w-full max-w-2xl shadow-lg">
        <CardHeader className="text-center relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="absolute top-4 left-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Go Back
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="absolute top-4 right-4"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Logout
          </Button>
          <div className="flex justify-center mb-4">
            <div className="p-3 bg-primary rounded-full">
              <Store className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <CardTitle className="text-2xl">Set Up Your Shop</CardTitle>
          <CardDescription>
            Complete your shop profile to start managing inventory
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Shop Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address">Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label>Select Shop Location (Click on the map) *</Label>
              <LocationPickerMap 
                onLocationSelect={handleLocationSelect}
                initialLat={formData.latitude ? parseFloat(formData.latitude) : undefined}
                initialLng={formData.longitude ? parseFloat(formData.longitude) : undefined}
              />
              {formData.latitude && formData.longitude && (
                <p className="text-sm text-muted-foreground mt-2">
                  Location selected: {formData.latitude}, {formData.longitude}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="gstNumber">GST Number (optional)</Label>
              <Input
                id="gstNumber"
                value={formData.gstNumber}
                onChange={(e) => setFormData({ ...formData, gstNumber: e.target.value })}
                placeholder="e.g., 29ABCDE1234F1Z5"
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Submitting..." : "Register Shop"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ShopSetup;
