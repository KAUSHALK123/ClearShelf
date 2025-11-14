import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Clock, XCircle, AlertCircle } from "lucide-react";

interface ShopVerificationStatusProps {
  status: string;
  rejectionReason?: string | null;
  createdAt: string;
}

const ShopVerificationStatus = ({ status, rejectionReason, createdAt }: ShopVerificationStatusProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'verified':
        return {
          icon: CheckCircle,
          color: "text-green-500",
          bgColor: "bg-green-50 border-green-200",
          title: "Shop Verified ✓",
          message: "Your shop is approved and visible to customers!",
          badge: <Badge className="bg-green-500">Verified</Badge>
        };
      case 'pending':
        return {
          icon: Clock,
          color: "text-yellow-500",
          bgColor: "bg-yellow-50 border-yellow-200",
          title: "Verification Pending",
          message: "Your shop registration is under review. We'll notify you once it's verified.",
          badge: <Badge variant="secondary">Pending</Badge>
        };
      case 'rejected':
        return {
          icon: XCircle,
          color: "text-red-500",
          bgColor: "bg-red-50 border-red-200",
          title: "Registration Needs Attention",
          message: rejectionReason || "Your shop registration was not approved. Please contact support.",
          badge: <Badge variant="destructive">Rejected</Badge>
        };
      default:
        return {
          icon: AlertCircle,
          color: "text-gray-500",
          bgColor: "bg-gray-50 border-gray-200",
          title: "Unknown Status",
          message: "Please contact support for assistance.",
          badge: <Badge variant="outline">{status}</Badge>
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;
  const daysSinceRegistration = Math.floor(
    (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
  );

  return (
    <Card className={`border-2 ${config.bgColor}`}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className={`${config.color}`}>
            <Icon className="w-8 h-8" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">{config.title}</h3>
              {config.badge}
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              {config.message}
            </p>
            {status === 'pending' && (
              <p className="text-xs text-muted-foreground">
                Registered {daysSinceRegistration} {daysSinceRegistration === 1 ? 'day' : 'days'} ago. 
                Average approval time: 1-2 business days.
              </p>
            )}
            {status === 'rejected' && rejectionReason && (
              <div className="mt-3 p-3 bg-white rounded-md border">
                <p className="text-xs font-medium text-muted-foreground mb-1">Reason:</p>
                <p className="text-sm">{rejectionReason}</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default ShopVerificationStatus;
