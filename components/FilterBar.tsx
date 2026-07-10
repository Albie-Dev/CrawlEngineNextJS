"use client";

import { useEffect, useState } from "react";
import { DateRangePicker } from "rsuite";
import { contentPillars, formatLabels, platformContentPillars, platformFormats, platformOptions, promotionTypes, sortLabels } from "@/lib/constants";
import type { AnalyticsFilters } from "@/lib/types";

type FilterBarProps = {
  filters: AnalyticsFilters;
  lockPlatform?: string;
};

export function FilterBar({ filters, lockPlatform }: FilterBarProps) {
  const [isClient, setIsClient] = useState(false);
  const initialRange: [Date, Date] | null =
    filters.startDate && filters.endDate
      ? [new Date(filters.startDate), new Date(filters.endDate)]
      : null;
  const [dateRange, setDateRange] = useState<[Date, Date] | null>(initialRange);
  const [selectedPlatform, setSelectedPlatform] = useState<string>(lockPlatform ?? filters.platform ?? "all");

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Get format options for the selected platform
  const formatOptions = selectedPlatform && selectedPlatform !== "all" && platformFormats[selectedPlatform]
    ? platformFormats[selectedPlatform].map((key) => ({ value: key, label: formatLabels[key] }))
    : Object.entries(formatLabels).map(([value, label]) => ({ value, label }));

  // Get content pillar options for the selected platform
  const pillarOptions = selectedPlatform && selectedPlatform !== "all" && platformContentPillars[selectedPlatform]
    ? platformContentPillars[selectedPlatform]
    : contentPillars;

  // Platform-aware default sortBy
  const defaultSortBy = selectedPlatform && selectedPlatform !== "all" && selectedPlatform !== "facebook" ? "views" : "engagement";

  const isTiktok = lockPlatform === "tiktok";

  const selectClass =
    "h-10 rounded border border-kolia-line bg-white px-3 text-sm font-medium text-slate-700 outline-none transition focus:border-kolia-green focus:ring-2 focus:ring-kolia-mint";

  return (
    <form className="rounded border border-kolia-line bg-white p-4 shadow-sm">
      <div className={`grid gap-3 ${isTiktok ? "grid-cols-1 sm:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4"}`}>
        <select name="platform" defaultValue={lockPlatform ?? filters.platform ?? "all"} className={selectClass} disabled={Boolean(lockPlatform)} onChange={(e) => setSelectedPlatform(e.target.value)}>
          {platformOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {lockPlatform ? <input type="hidden" name="platform" value={lockPlatform} /> : null}

        {/* Date Range Picker */}
        <div className="flex flex-col gap-1">
          {isClient ? (
            <DateRangePicker
              value={dateRange}
              onChange={(value) => {
                if (!value) {
                  setDateRange(null);
                  return;
                }
                const [start, end] = value;
                // Clamp to max 365 days
                const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
                if (diffDays > 365) {
                  const clampedEnd = new Date(start.getTime() + 365 * 24 * 60 * 60 * 1000);
                  setDateRange([start, clampedEnd]);
                } else {
                  setDateRange(value);
                }
              }}
              format="dd/MM/yyyy"
              character=" → "
              placeholder="Chọn khoảng thời gian"
              cleanable
              showOneCalendar={false}
              shouldDisableDate={(date) => date > new Date()}
            />
          ) : (
            <div className="h-10 rounded border border-kolia-line bg-white px-3 text-sm font-medium text-slate-700 flex items-center">
              {filters.startDate && filters.endDate
                ? `${filters.startDate.split("-").reverse().join("/")} → ${filters.endDate.split("-").reverse().join("/")}`
                : "Chọn khoảng thời gian"}
            </div>
          )}
          {dateRange && (
            <>
              <input type="hidden" name="startDate" value={dateRange[0].toISOString().split("T")[0]} />
              <input type="hidden" name="endDate" value={dateRange[1].toISOString().split("T")[0]} />
            </>
          )}
        </div>

        {!isTiktok && (
          <select name="source" defaultValue={filters.source ?? "all"} className={selectClass}>
            <option value="all">Tất cả nguồn</option>
            <option value="trong_nuoc">Trong nước</option>
            <option value="nuoc_ngoai">Nước ngoài</option>
          </select>
        )}
        {!isTiktok && (
          <select name="contentPillar" defaultValue={filters.contentPillar ?? ""} className={selectClass}>
            <option value="">Tất cả trụ cột nội dung</option>
            {pillarOptions.map((pillar) => (
              <option key={pillar} value={pillar}>
                {pillar}
              </option>
            ))}
          </select>
        )}
        {!isTiktok && (
          <select name="format" defaultValue={filters.format ?? ""} className={selectClass}>
            <option value="">Tất cả định dạng triển khai</option>
            {formatOptions.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
        {!isTiktok && (
          <select name="promotionType" defaultValue={filters.promotionType ?? ""} className={selectClass}>
            <option value="">Tất cả nhóm CTA/ưu đãi</option>
            {promotionTypes.map((promotionType) => (
              <option key={promotionType} value={promotionType}>
                {promotionType}
              </option>
            ))}
          </select>
        )}
        {!isTiktok && (
          <select name="sortBy" defaultValue={filters.sortBy ?? defaultSortBy} className={selectClass}>
            {Object.entries(sortLabels).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <a href="?" className="rounded border border-kolia-line px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50">
          Xóa lọc
        </a>
        <button type="submit" className="rounded bg-kolia-ink px-4 py-2 text-sm font-bold text-white hover:bg-kolia-midnight">
          Áp dụng
        </button>
      </div>
    </form>
  );
}
