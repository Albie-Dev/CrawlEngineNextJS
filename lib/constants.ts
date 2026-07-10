import type { Platform, SortBy, SourceType } from "@/lib/types";

export const platformLabels: Record<Platform, string> = {
  youtube: "YouTube",
  tiktok: "TikTok",
  facebook: "Facebook"
};

export const sourceLabels: Record<SourceType, string> = {
  trong_nuoc: "Trong nước",
  nuoc_ngoai: "Nước ngoài"
};

export const formatLabels: Record<string, string> = {
  short_video: "Short video",
  long_video: "Long video",
  video: "Video",
  carousel: "Carousel",
  image_post: "Image post",
  single_image_post: "Single image post",
  text_post: "Text post",
  reel: "Reel",
  other: "Khác"
};

export const platformFormats: Record<string, string[]> = {
  youtube: ["short_video", "long_video"],
  facebook: ["image_post", "text_post", "video", "reel", "other"],
  tiktok: ["carousel", "video", "single_image_post"]
};

export const sortLabels: Record<SortBy, string> = {
  engagement: "Tỷ lệ tương tác cao nhất",
  views: "Lượt xem cao nhất",
  comments: "Bình luận cao nhất",
  newest: "Mới nhất"
};

export const platformOptions = [
  { value: "all", label: "Tất cả nền tảng" },
  { value: "youtube", label: "YouTube" },
  { value: "tiktok", label: "TikTok" },
  { value: "facebook", label: "Facebook" }
];

export const timeRangeOptions = [
  { value: "7", label: "7 ngày" },
  { value: "30", label: "30 ngày" },
  { value: "90", label: "90 ngày" },
  { value: "3650", label: "Khoảng tùy chỉnh" }
];
