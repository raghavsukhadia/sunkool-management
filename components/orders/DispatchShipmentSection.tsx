import React, { useState } from 'react';

// Types
type DispatchType = "FULL" | "PARTIAL";
type ProductionStatus = "PENDING" | "IN_PRODUCTION" | "COMPLETED";
type ShipmentStatus = "PENDING" | "READY_FOR_PICKUP" | "PICKED_UP" | "IN_TRANSIT" | "DELIVERED" | "FAILED" | "CANCELLED";

interface ProductionRecord {
  code: string;
  type: DispatchType;
  status: ProductionStatus;
  pdfUrl?: string;
  isDispatched: boolean;
}

interface DispatchItem {
  name: string;
  sku?: string;
  qty: number;
  unitLabel?: string;
}

interface DispatchShipmentSectionProps {
  orderId: string;
  dispatchType: DispatchType;
  dispatchDate: string;
  productionRecord: ProductionRecord;
  shipmentStatus: ShipmentStatus;
  courierName: string;
  trackingId?: string;
  trackingUrl?: string;
  items: DispatchItem[];
  onShipmentStatusChange?: (status: ShipmentStatus) => void;
}

// Inline SVG Icons
const TruckIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M1 3h15v13H1zM16 8h4l3 3v5h-7z" />
    <circle cx="5.5" cy="18.5" r="2.5" />
    <circle cx="18.5" cy="18.5" r="2.5" />
  </svg>
);

const FileIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const CheckCircleIcon: React.FC<{ className?: string }> = ({ className = "h-4 w-4" }) => (
  <svg
    className={className}
    fill="none"
    viewBox="0 0 24 24"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

// Badge Component
const Badge: React.FC<{
  children: React.ReactNode;
  variant: "full" | "partial" | "pending" | "in_production" | "completed" | "dispatched";
}> = ({ children, variant }) => {
  const variants = {
    full: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    partial: "bg-indigo-50 text-indigo-700 border border-indigo-100",
    pending: "bg-slate-100 text-slate-700",
    in_production: "bg-indigo-50 text-indigo-700",
    completed: "bg-emerald-50 text-emerald-700",
    dispatched: "bg-emerald-50 text-emerald-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${variants[variant]}`}
    >
      {children}
    </span>
  );
};

// Main Component
export const DispatchShipmentSection: React.FC<DispatchShipmentSectionProps> = ({
  orderId,
  dispatchType,
  dispatchDate,
  productionRecord,
  shipmentStatus,
  courierName,
  trackingId,
  trackingUrl,
  items,
  onShipmentStatusChange,
}) => {
  const [localStatus, setLocalStatus] = useState<ShipmentStatus>(shipmentStatus);

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as ShipmentStatus;
    setLocalStatus(newStatus);
    onShipmentStatusChange?.(newStatus);
  };

  const getStatusDisplay = (status: ShipmentStatus): string => {
    const statusMap: Record<ShipmentStatus, string> = {
      PENDING: "Pending",
      READY_FOR_PICKUP: "Ready for Pickup",
      PICKED_UP: "Picked Up",
      IN_TRANSIT: "In Transit",
      DELIVERED: "Delivered",
      FAILED: "Failed",
      CANCELLED: "Cancelled",
    };
    return statusMap[status];
  };

  const getProductionStatusDisplay = (status: ProductionStatus): string => {
    const statusMap: Record<ProductionStatus, string> = {
      PENDING: "Pending",
      IN_PRODUCTION: "In Production",
      COMPLETED: "Completed",
    };
    return statusMap[status];
  };

  const isActiveShipment = 
    localStatus === "PICKED_UP" || 
    localStatus === "IN_TRANSIT" || 
    localStatus === "DELIVERED";

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900">Dispatch & Shipment Details</h2>
        <p className="mt-1 text-sm text-slate-500">
          Manage order dispatches, courier information, and tracking.
        </p>
      </div>

      {/* Main Card */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="md:px-6 md:py-5 p-4 space-y-6">
          {/* Top Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                {dispatchType === "FULL" ? "Full" : "Partial"} Dispatch
              </h3>
              <p className="mt-1 text-sm text-slate-600">{dispatchDate}</p>
            </div>
            <Badge variant={dispatchType === "FULL" ? "full" : "partial"}>
              {dispatchType === "FULL" ? "Full" : "Partial"}
            </Badge>
          </div>

          {/* Production Record Panel */}
          <div className="rounded-xl border border-slate-100 bg-slate-50/40 px-4 py-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex flex-col gap-2">
                <span className="text-lg font-semibold text-slate-900">
                  {productionRecord.code}
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant={productionRecord.type === "FULL" ? "full" : "partial"}>
                    {productionRecord.type === "FULL" ? "Full" : "Partial"}
                  </Badge>
                  <Badge
                    variant={
                      productionRecord.status === "COMPLETED"
                        ? "completed"
                        : productionRecord.status === "IN_PRODUCTION"
                        ? "in_production"
                        : "pending"
                    }
                  >
                    {getProductionStatusDisplay(productionRecord.status)}
                  </Badge>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {productionRecord.pdfUrl && (
                  <button
                    onClick={() => window.open(productionRecord.pdfUrl, '_blank')}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 transition-colors"
                  >
                    <FileIcon />
                    View PDF
                  </button>
                )}
                {productionRecord.isDispatched && (
                  <div className="flex items-center gap-1.5 text-sm font-medium text-emerald-700">
                    <CheckCircleIcon className="h-4 w-4" />
                    <span>Dispatched</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Shipment Status */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-800">
              Shipment Status
            </label>
            <div
              className={`flex items-center gap-2 rounded-lg border px-3.5 py-2.5 ${
                isActiveShipment
                  ? "border-blue-200 bg-blue-50"
                  : "border-slate-200 bg-slate-50"
              }`}
            >
              <TruckIcon className="h-4 w-4 text-slate-600" />
              <select
                value={localStatus}
                onChange={handleStatusChange}
                className="flex-1 bg-transparent text-sm font-medium text-slate-900 focus:outline-none focus-visible:ring-0 border-0 cursor-pointer"
              >
                <option value="PENDING">Pending</option>
                <option value="READY_FOR_PICKUP">Ready for Pickup</option>
                <option value="PICKED_UP">Picked Up</option>
                <option value="IN_TRANSIT">In Transit</option>
                <option value="DELIVERED">Delivered</option>
                <option value="FAILED">Failed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Courier + Tracking Info Panel */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5">
                Courier
              </label>
              <div className="flex items-center gap-2">
                <TruckIcon className="h-4 w-4 text-slate-600" />
                <span className="text-sm font-semibold text-slate-900">{courierName}</span>
              </div>
            </div>
            {trackingId && (
              <div>
                <label className="block text-xs font-medium uppercase tracking-wide text-slate-500 mb-1.5">
                  Tracking ID
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900 font-mono">
                    {trackingId}
                  </span>
                  {trackingUrl && (
                    <a
                      href={trackingUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-indigo-600 hover:text-indigo-700 underline-offset-2 hover:underline transition-colors"
                    >
                      Track →
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Items List */}
          {items.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-900">Items</h4>
              <div className="rounded-xl border border-slate-100 bg-slate-50 overflow-hidden">
                <div className="bg-white divide-y divide-slate-100">
                  {items.map((item, index) => (
                    <div
                      key={index}
                      className={`flex justify-between items-center px-4 py-3 text-sm ${
                        index === items.length - 1 ? "" : "border-b border-slate-100"
                      }`}
                    >
                      <div className="flex-1">
                        <div className="text-slate-900 font-medium">{item.name}</div>
                        {item.sku && (
                          <div className="text-xs text-slate-500 mt-0.5">{item.sku}</div>
                        )}
                      </div>
                      <div className="text-slate-900 font-semibold">
                        {item.qty} {item.unitLabel || "units"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Example Usage:
/*
<DispatchShipmentSection
  orderId="ORD-12345"
  dispatchType="FULL"
  dispatchDate="Nov 29, 2025"
  productionRecord={{
    code: "SK01",
    type: "FULL",
    status: "COMPLETED",
    pdfUrl: "https://example.com/production-checklist.pdf",
    isDispatched: true,
  }}
  shipmentStatus="PICKED_UP"
  courierName="Delhivery"
  trackingId="123456789985"
  trackingUrl="https://delhivery.com/track/123456789985"
  items={[
    { name: "Item 1", sku: "SKU-001", qty: 100, unitLabel: "units" },
    { name: "Item 2", sku: "SKU-002", qty: 50, unitLabel: "units" },
  ]}
  onShipmentStatusChange={(status) => {
    console.log("Status changed to:", status);
  }}
/>
*/

