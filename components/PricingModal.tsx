"use client";

import { ReactNode } from "react";

type PricingModalProps = {
  open: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  loading?: boolean;
};

export default function PricingModal({ open, onClose, onUpgrade, loading = false }: PricingModalProps) {
  if (!open) return null;

  const features = [
    ["3 extractions/day", "Free", "Pro"],
    ["Standard scraping speed", "Included", "Included"],
    ["CSV export", "Included", "Included"],
    ["JSON + Excel export", "—", "Included"],
    ["Smart Data Cleaning", "—", "Included"],
    ["Daily / weekly schedules", "—", "Included"],
    ["Priority timeout limits", "—", "Included"],
  ];

  return (
    <div className="profile-modal-backdrop" onMouseDown={onClose}>
      <section className="pricing-modal" onMouseDown={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="pricing-title">
        <button className="modal-close" type="button" onClick={onClose} aria-label="Close">×</button>
        <div className="auth-label">Simple pricing</div>
        <h2 id="pricing-title">Choose the plan that fits your workflow</h2>
        <p className="meta">Start free. Upgrade when you need unlimited extraction and automation.</p>

        <div className="pricing-grid">
          <div className="pricing-tier">
            <span className="pricing-kicker">FREE</span>
            <strong>₹0</strong>
            <span>3 extractions / day</span>
          </div>
          <div className="pricing-tier featured">
            <span className="pricing-kicker">PRO</span>
            <strong>₹199<span>/month</span></strong>
            <span>Unlimited extraction</span>
          </div>
        </div>

        <div className="pricing-comparison">
          <div className="pricing-comparison-head"><span>Capability</span><span>Free</span><span>Pro</span></div>
          {features.map(([name, free, pro]) => (
            <div className="pricing-row" key={name}><span>{name}</span><span>{free}</span><span>{pro}</span></div>
          ))}
        </div>

        <div className="pricing-actions">
          <button className="secondary" type="button" onClick={onClose}>Keep Free</button>
          <button className="primary" type="button" onClick={onUpgrade} disabled={loading}>
            {loading ? "Opening payment..." : "Upgrade to Pro — ₹199/month"}
          </button>
        </div>
      </section>
    </div>
  );
}
