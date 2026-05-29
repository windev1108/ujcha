"use client";

import { RevealSection } from "./RevealSection";
import { useActiveCampaignQuery } from "@/services/campaign/hooks";
import { CampaignBannerCard } from "@/components/campaign/CampaignBannerCard";

export function PromoBanner() {
  const { data: campaign, isLoading } = useActiveCampaignQuery();
  if (isLoading || !campaign) return null;

  return (
    <RevealSection className="px-4 py-12 sm:px-6 sm:py-16">
      <div className="container mx-auto">
        <CampaignBannerCard campaign={campaign} />
      </div>
    </RevealSection>
  );
}
