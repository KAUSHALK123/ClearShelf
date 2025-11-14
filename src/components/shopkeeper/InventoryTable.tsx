import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface InventoryTableProps {
  shopId: string;
}

const InventoryTable = ({ shopId }: InventoryTableProps) => {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventory();

    const channel = supabase
      .channel("inventory-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inventory_batches",
          filter: `shop_id=eq.${shopId}`,
        },
        () => {
          loadInventory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shopId]);

  const loadInventory = async () => {
    const { data, error } = await supabase
      .from("inventory_batches")
      .select(`
        *,
        products (name, brand, category)
      `)
      .eq("shop_id", shopId)
      .eq("status", "active")
      .order("expiry_date", { ascending: true });

    if (!error && data) {
      setInventory(data);
    }
    setLoading(false);
  };

  const getDaysToExpiry = (expiryDate: string) => {
    return Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const getExpiryBadge = (daysToExpiry: number) => {
    if (daysToExpiry <= 7) {
      return <Badge variant="destructive">Urgent: {daysToExpiry}d</Badge>;
    } else if (daysToExpiry <= 15) {
      return <Badge className="bg-orange-500">Warning: {daysToExpiry}d</Badge>;
    } else if (daysToExpiry <= 30) {
      return <Badge className="bg-yellow-500">Soon: {daysToExpiry}d</Badge>;
    }
    return <Badge variant="secondary">{daysToExpiry}d</Badge>;
  };

  if (loading) {
    return <div className="text-center py-8 text-muted-foreground">Loading inventory...</div>;
  }

  if (inventory.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No inventory items yet. Add your first product!
      </div>
    );
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product</TableHead>
            <TableHead>Brand</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Batch</TableHead>
            <TableHead className="text-right">Qty</TableHead>
            <TableHead className="text-right">MRP</TableHead>
            <TableHead className="text-right">Discount</TableHead>
            <TableHead className="text-right">Final Price</TableHead>
            <TableHead>Expiry</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {inventory.map((item) => {
            const daysToExpiry = getDaysToExpiry(item.expiry_date);
            const finalPrice = item.mrp * (1 - item.discount_percent / 100);
            
            return (
              <TableRow key={item.id}>
                <TableCell className="font-medium">{item.products.name}</TableCell>
                <TableCell>{item.products.brand}</TableCell>
                <TableCell>{item.products.category}</TableCell>
                <TableCell className="text-sm text-muted-foreground">{item.batch_code}</TableCell>
                <TableCell className="text-right">{item.quantity}</TableCell>
                <TableCell className="text-right">₹{item.mrp.toFixed(2)}</TableCell>
                <TableCell className="text-right">
                  {item.discount_percent > 0 ? (
                    <span className="text-accent font-semibold">{item.discount_percent}%</span>
                  ) : (
                    "-"
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold">₹{finalPrice.toFixed(2)}</TableCell>
                <TableCell>{format(new Date(item.expiry_date), "MMM dd, yyyy")}</TableCell>
                <TableCell>{getExpiryBadge(daysToExpiry)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default InventoryTable;