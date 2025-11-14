import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Package, Navigation, ShoppingCart } from "lucide-react";
import CheckoutDialog from "./CheckoutDialog";
import L from "leaflet";

// Fix for default marker icons
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";

let DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Custom user location icon
const userIcon = new L.Icon({
  iconUrl: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24' fill='%233b82f6'%3E%3Ccircle cx='12' cy='12' r='10' stroke='white' stroke-width='2'/%3E%3C/svg%3E",
  iconSize: [32, 32],
  iconAnchor: [16, 16],
});

const StoreMap = () => {
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([28.6139, 77.2090]); // Default: Delhi
  const [selectedBatch, setSelectedBatch] = useState<any>(null);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  useEffect(() => {
    loadStores();
    getUserLocation();
  }, []);

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: [number, number] = [
            position.coords.latitude,
            position.coords.longitude,
          ];
          setUserLocation(location);
          setMapCenter(location);
        },
        (error) => {
          console.log("Location access denied:", error);
        }
      );
    }
  };

  const loadStores = async () => {
    const { data, error } = await supabase
      .from("shops")
      .select(`
        *,
        inventory_batches (
          *,
          products (name, brand, category)
        )
      `)
      .eq("verification_status", "verified");

    if (!error && data) {
      const storesWithProducts = data.map(shop => ({
        ...shop,
        discountedProducts: shop.inventory_batches.filter(
          (batch: any) => batch.products && batch.discount_percent > 0 && batch.status === "active"
        ),
      }));
      setStores(storesWithProducts);
    }
    setLoading(false);
  };


  // Subscribe to live shop location updates
  useEffect(() => {
    const channel = supabase
      .channel('shops-live')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'shops' }, () => {
        loadStores();
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">Loading stores...</p>
      </div>
    );
  }


  return (
    <div className="h-full flex flex-col overflow-y-auto">
      <div className="container mx-auto px-4 py-4">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-1">Nearby Stores</h2>
            <p className="text-muted-foreground">Discover discounted products near you</p>
          </div>
          {userLocation && (
            <Button variant="outline" size="sm" onClick={getUserLocation}>
              <Navigation className="w-4 h-4 mr-2" />
              My Location
            </Button>
          )}
        </div>

        {stores.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              No stores available yet. Check back soon!
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            <div className="h-[400px] rounded-lg overflow-hidden shadow-lg border bg-card">
              <MapContainer
                center={mapCenter}
                zoom={13}
                style={{ height: "100%", width: "100%" }}
                scrollWheelZoom={true}
                key={`${mapCenter[0]}-${mapCenter[1]}`}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {userLocation && (
                  <Marker position={userLocation} icon={userIcon}>
                    <Popup>
                      <div className="font-semibold">Your Location</div>
                    </Popup>
                  </Marker>
                )}
                {stores.map((store) => (
                  <Marker
                    key={store.id}
                    position={[store.latitude, store.longitude]}
                  >
                    <Popup>
                      <div className="min-w-[220px]">
                        <div className="font-bold text-sm mb-1">{store.name}</div>
                        <div className="text-xs text-muted-foreground mb-2">{store.address}</div>
                        {store.discountedProducts.length > 0 && (
                          <div className="inline-flex text-xs px-2 py-1 rounded bg-destructive text-destructive-foreground mb-2">
                            {store.discountedProducts.length} deals available
                          </div>
                        )}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            </div>

            {/* Store List */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stores.map((store) => (
                <Card key={store.id} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{store.name}</CardTitle>
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                          <MapPin className="w-3 h-3" />
                          {store.address}
                        </p>
                      </div>
                      {store.discountedProducts.length > 0 && (
                        <Badge className="bg-accent">
                          {store.discountedProducts.length} deals
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    {store.discountedProducts.length > 0 ? (
                      <div className="space-y-3">
                        {store.discountedProducts.slice(0, 3).map((batch: any) => {
                          const finalPrice = batch.mrp * (1 - batch.discount_percent / 100);
                           return (
                            <div
                              key={batch.id}
                              className="p-3 bg-secondary/50 rounded-lg space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{batch.products.name}</p>
                                  <p className="text-xs text-muted-foreground">{batch.products.brand}</p>
                                </div>
                                <div className="text-right">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-muted-foreground line-through">
                                      ₹{batch.mrp.toFixed(2)}
                                    </span>
                                    <span className="font-bold text-primary">
                                      ₹{finalPrice.toFixed(2)}
                                    </span>
                                  </div>
                                  <Badge variant="outline" className="text-xs mt-1">
                                    {batch.discount_percent}% OFF
                                  </Badge>
                                </div>
                              </div>
                              <Button 
                                size="sm" 
                                className="w-full"
                                onClick={() => {
                                  setSelectedBatch(batch);
                                  setCheckoutOpen(true);
                                }}
                              >
                                <ShoppingCart className="w-3 h-3 mr-1" />
                                Buy Now
                              </Button>
                            </div>
                          );
                        })}
                        {store.discountedProducts.length > 3 && (
                          <p className="text-sm text-muted-foreground text-center">
                            +{store.discountedProducts.length - 3} more products
                          </p>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        No discounted products currently
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>

      {selectedBatch && (
        <CheckoutDialog
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          batch={selectedBatch}
        />
      )}
    </div>
  );
};

export default StoreMap;
