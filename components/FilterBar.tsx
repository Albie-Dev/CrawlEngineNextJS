"use client";

import { useEffect, useState, useRef } from "react";
import { ChevronDown } from "lucide-react";
import { DateRangePicker } from "rsuite";
import { formatLabels, platformFormats, platformOptions, sortLabels } from "@/lib/constants";
import type { AnalyticsFilters } from "@/lib/types";

function FilterSelect({
  name,
  value,
  onChange,
  options,
  disabled
}: {
  name: string;
  value: string;
  onChange: (val: string) => void;
  options: { label: string; value: string }[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find((o) => o.value === value) || options[0];

  return (
    <div ref={ref} className={`relative h-10 w-full rounded border border-kolia-line bg-white shadow-sm flex flex-col justify-center cursor-pointer select-none transition ${disabled ? "opacity-50 pointer-events-none bg-slate-50" : "hover:border-kolia-green"}`} onClick={() => !disabled && setOpen(!open)}>
      <input type="hidden" name={name} value={selectedOption?.value ?? ""} />
      <div className="flex items-center justify-between gap-2 px-3">
        <span className="text-sm font-medium text-slate-700 line-clamp-1">{selectedOption?.label ?? ""}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </div>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 max-h-60 w-full min-w-[150px] overflow-auto rounded border border-kolia-line bg-white py-1 shadow-lg">
          {options.map((opt) => (
            <div
              key={opt.value}
              className={`px-3 py-2 text-sm cursor-pointer transition-colors hover:bg-slate-50 ${value === opt.value ? "bg-slate-50 font-semibold text-kolia-green" : "text-slate-700"}`}
              onClick={() => { onChange(opt.value); setOpen(false); }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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
  const [pillarOptions, setPillarOptions] = useState<string[]>([]);
  const [promotionOptions, setPromotionOptions] = useState<string[]>([]);

  // States for dropdowns
  const [selectedSource, setSelectedSource] = useState(filters.source ?? "all");
  const [selectedPillar, setSelectedPillar] = useState(filters.contentPillar ?? "");
  const [selectedFormat, setSelectedFormat] = useState(filters.format ?? "");
  const [selectedPromotion, setSelectedPromotion] = useState(filters.promotionType ?? "");

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedPlatform && selectedPlatform !== "all") params.set("platform", selectedPlatform);
    fetch(`/api/pillars?${params.toString()}`)
      .then((r) => r.json())
      .then(setPillarOptions)
      .catch(() => setPillarOptions([]));
    fetch(`/api/promotion-types?${params.toString()}`)
      .then((r) => r.json())
      .then(setPromotionOptions)
      .catch(() => setPromotionOptions([]));
  }, [selectedPlatform]);

  // Get format options for the selected platform
  const formatOptions = selectedPlatform && selectedPlatform !== "all" && platformFormats[selectedPlatform]
    ? platformFormats[selectedPlatform].map((key) => ({ value: key, label: formatLabels[key] }))
    : Object.entries(formatLabels).map(([value, label]) => ({ value, label }));

  const isYoutube = lockPlatform === "youtube" || selectedPlatform === "youtube";
  const isTiktok = lockPlatform === "tiktok";

  // Platform-aware default sortBy
  const defaultSortBy =
    selectedPlatform && selectedPlatform !== "all" && selectedPlatform !== "facebook" && selectedPlatform !== "youtube"
      ? "views"
      : "engagement";

  const [selectedSortBy, setSelectedSortBy] = useState(filters.sortBy ?? defaultSortBy);

  // Sync selectedSortBy if platform changes to youtube
  useEffect(() => {
    if (isYoutube && selectedSortBy === "views") {
      setSelectedSortBy("engagement");
    }
  }, [isYoutube, selectedSortBy]);

  return (
    <form className="rounded border border-kolia-line bg-white p-4 shadow-sm">
      <div className={`grid gap-3 ${isTiktok ? "grid-cols-1 sm:grid-cols-3" : "md:grid-cols-2 xl:grid-cols-4"}`}>
        <FilterSelect
          name="platform"
          value={selectedPlatform}
          onChange={setSelectedPlatform}
          options={platformOptions.map((o) => ({ label: o.label, value: o.value }))}
          disabled={Boolean(lockPlatform)}
        />
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
          <FilterSelect
            name="source"
            value={selectedSource}
            onChange={(val) => setSelectedSource(val as "all" | "trong_nuoc" | "nuoc_ngoai")}
            options={[
              { value: "all", label: "Tất cả nguồn" },
              { value: "trong_nuoc", label: "Trong nước" },
              { value: "nuoc_ngoai", label: "Nước ngoài" }
            ]}
          />
        )}
        {!isTiktok && (
          <FilterSelect
            name="contentPillar"
            value={selectedPillar}
            onChange={setSelectedPillar}
            options={[
              { value: "", label: "Tất cả trụ cột nội dung" },
              ...pillarOptions.map(p => ({ value: p, label: p }))
            ]}
          />
        )}
        {!isTiktok && (
          <FilterSelect
            name="format"
            value={selectedFormat}
            onChange={setSelectedFormat}
            options={[
              { value: "", label: "Tất cả định dạng triển khai" },
              ...formatOptions
            ]}
          />
        )}
        {!isTiktok && !isYoutube && (
          <FilterSelect
            name="promotionType"
            value={selectedPromotion}
            onChange={setSelectedPromotion}
            options={[
              { value: "", label: "Tất cả nhóm CTA/ưu đãi" },
              ...promotionOptions.map(p => ({ value: p, label: p }))
            ]}
          />
        )}
        {!isTiktok && (
          <FilterSelect
            name="sortBy"
            value={selectedSortBy}
            onChange={(val) => setSelectedSortBy(val as "views" | "comments" | "engagement" | "newest")}
            options={Object.entries(sortLabels)
              .filter(([value]) => !(isYoutube && value === "views"))
              .map(([value, label]) => ({ value, label }))}
          />
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
