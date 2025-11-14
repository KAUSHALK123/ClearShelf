import { useState, useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Store } from 'lucide-react';

interface ShopStatusToggleProps {
  shopId: string;
}

const ShopStatusToggle = ({ shopId }: ShopStatusToggleProps) => {
  const [isOpen, setIsOpen] = useState(true);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadStatus();
  }, [shopId]);

  const loadStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('shops')
        .select('is_open')
        .eq('id', shopId)
        .single();

      if (error) throw error;
      if (data) setIsOpen(data.is_open ?? true);
    } catch (error) {
      console.error('Error loading shop status:', error);
    }
  };

  const toggleStatus = async (checked: boolean) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('shops')
        .update({ is_open: checked })
        .eq('id', shopId);

      if (error) throw error;

      setIsOpen(checked);
      toast({
        title: checked ? "Shop Opened" : "Shop Closed",
        description: `Your shop is now ${checked ? 'open' : 'closed'} for business.`
      });
    } catch (error) {
      console.error('Error updating shop status:', error);
      toast({
        title: "Error",
        description: "Failed to update shop status",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Store className="h-5 w-5 text-muted-foreground" />
          <div>
            <Label htmlFor="shop-status" className="text-base font-semibold">
              Shop Status
            </Label>
            <p className="text-sm text-muted-foreground">
              {isOpen ? 'Currently Open' : 'Currently Closed'}
            </p>
          </div>
        </div>
        <Switch
          id="shop-status"
          checked={isOpen}
          onCheckedChange={toggleStatus}
          disabled={loading}
        />
      </div>
    </Card>
  );
};

export default ShopStatusToggle;