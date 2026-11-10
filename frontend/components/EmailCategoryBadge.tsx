"use client";

import { CATEGORIES, EmailCategory } from "@/lib/email-classifier";
import {
  Briefcase,
  AlertTriangle,
  Users,
  GraduationCap,
  Mail,
} from "lucide-react";

interface EmailCategoryBadgeProps {
  category: EmailCategory;
  size?: "sm" | "md";
  showIcon?: boolean;
}

export function EmailCategoryBadge({
  category,
  size = "sm",
  showIcon = true,
}: EmailCategoryBadgeProps) {
  const info = CATEGORIES[category] || CATEGORIES.autre;

  const iconMap = {
    stage: Briefcase,
    urgence: AlertTriangle,
    association: Users,
    cours: GraduationCap,
    autre: Mail,
  };

  const Icon = iconMap[category] || Mail;

  const sizeClasses =
    size === "sm"
      ? "px-2 py-0.5 text-[10px] gap-1"
      : "px-2.5 py-1 text-xs gap-1.5";

  const iconSizes = size === "sm" ? 11 : 13;

  return (
    <span
      className={`inline-flex items-center font-medium rounded-md border ${info.badgeBg} ${info.badgeText} ${info.badgeBorder} ${sizeClasses}`}
    >
      {showIcon && <Icon size={iconSizes} className="shrink-0" />}
      <span>{info.shortLabel}</span>
    </span>
  );
}
