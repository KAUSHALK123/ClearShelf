import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdminHeader from "@/components/admin/AdminHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MapPin, Store } from "lucide-react";

interface Shop {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  verification_status: string;
  gst_number: string | null;
  profiles: { name: string; phone: string };
}

const AdminMap = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadShops();
  }, []);

  const loadShops = async () => {
    const { data, error } = await supabase
      .from("shops")
      .select("*, profiles!owner_id(name, phone)")
      .order("created_at", { ascending: false });

    if (error) {
      toast({
        title: "Error",
        description: "Failed to load shops",
        variant: "destructive",
      });
    } else {
      // Transform the data to flatten the profiles array
      const transformedShops = data?.map((shop: any) => ({
        ...shop,
        profiles: Array.isArray(shop.profiles) ? shop.profiles[0] : shop.profiles
      }));
      setShops(transformedShops as Shop[]);
    }
    setLoading(false);
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive"> = {
      verified: "default",
      pending: "secondary",
      rejected: "destructive",
    };
    return <Badge variant={variants[status] || "secondary"}>{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      <AdminHeader title="Shop Map View" />

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="w-5 h-5" />
              All Registered Shops
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="text-center py-8">Loading map data...</div>
            ) : (
              <div className="space-y-4">
                {shops.map((shop) => (
                  <Card key={shop.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-start justify-between">
                        <div className="flex gap-4">
                          <div className="p-3 bg-primary/10 rounded-lg">
                            <Store className="w-6 h-6 text-primary" />
                          </div>
                          <div className="space-y-2">
                            <div>
                              <h3 className="font-semibold text-lg">{shop.name}</h3>
                              <p className="text-sm text-muted-foreground">{shop.address}</p>
                            </div>
                            <div className="flex gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Owner:</span>{" "}
                                {shop.profiles.name}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Contact:</span>{" "}
                                {shop.profiles.phone}
                              </div>
                            </div>
                            <div className="flex gap-2 text-sm">
                              <div>
                                <span className="text-muted-foreground">Location:</span>{" "}
                                {shop.latitude.toFixed(6)}, {shop.longitude.toFixed(6)}
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          {getStatusBadge(shop.verification_status)}
                          {shop.gst_number && (
                            <p className="text-xs text-muted-foreground">
                              GST: {shop.gst_number}
                            </p>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminMap;
