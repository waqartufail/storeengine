import React from "react";

// Use the labeled contents only. Older products can have a shipping weight and no net size.
export default function NetSize({ product }) {
  const { netQuantity, netUnit } = product || {};
  if (!(netQuantity > 0) || !["g", "ml"].includes(netUnit)) return null;
  const quantity = new Intl.NumberFormat(
    document.documentElement.lang || "en",
    {
      maximumFractionDigits: 3,
    },
  ).format(netQuantity);
  return (
    <bdi className="netSize">
      {quantity} {netUnit}
    </bdi>
  );
}
