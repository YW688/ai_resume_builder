// Instagram-style profile page — display only, no interactive logic.
import type { ReactNode } from "react";

type Post = {
  id: number;
  emoji: string;
  gradient: string;
  likes: string;
  comments: string;
};

type Highlight = {
  id: number;
  emoji: string;
  gradient: string;
  label: string;
};

// Brand gradient reused for story rings, logo, etc.
const BRAND_GRADIENT =
  "bg-gradient-to-tr from-amber-400 via-pink-500 to-purple-600";

// Sample posts (gradients stand in for photos so the page works offline).
const POSTS: Post[] = [
  { id: 1, emoji: "🌅", gradient: "from-amber-200 via-orange-300 to-rose-400", likes: "1,204", comments: "38" },
  { id: 2, emoji: "🌊", gradient: "from-sky-200 via-cyan-300 to-blue-500", likes: "982", comments: "21" },
  { id: 3, emoji: "🌿", gradient: "from-lime-200 via-emerald-300 to-teal-500", likes: "1,540", comments: "64" },
  { id: 4, emoji: "🌸", gradient: "from-pink-200 via-rose-300 to-fuchsia-400", likes: "2,331", comments: "102" },
  { id: 5, emoji: "🌌", gradient: "from-indigo-300 via-purple-400 to-violet-600", likes: "876", comments: "17" },
  { id: 6, emoji: "🏔️", gradient: "from-slate-200 via-blue-300 to-slate-500", likes: "1,118", comments: "45" },
  { id: 7, emoji: "☀️", gradient: "from-yellow-200 via-amber-300 to-orange-400", likes: "3,006", comments: "150" },
  { id: 8, emoji: "🍂", gradient: "from-orange-200 via-amber-400 to-red-500", likes: "690", comments: "12" },
  { id: 9, emoji: "🎨", gradient: "from-fuchsia-200 via-purple-300 to-indigo-500", likes: "1,442", comments: "58" },
];

const HIGHLIGHTS: Highlight[] = [
  { id: 1, emoji: "✈️", gradient: "from-sky-300 to-blue-500", label: "Travel" },
  { id: 2, emoji: "🍜", gradient: "from-amber-300 to-orange-500", label: "Food" },
  { id: 3, emoji: "🌿", gradient: "from-emerald-300 to-teal-500", label: "Nature" },
  { id: 4, emoji: "🎨", gradient: "from-fuchsia-300 to-purple-500", label: "Art" },
  { id: 5, emoji: "📷", gradient: "from-pink-300 to-rose-500", label: "Daily" },
];

// --- Inline icons (outline style, stroke = currentColor) ---
function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-6 w-6"
    >
      {children}
    </svg>
  );
}

const icons = {
  home: (
    <Icon>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
    </Icon>
  ),
  search: (
    <Icon>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </Icon>
  ),
  compass: (
    <Icon>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </Icon>
  ),
  reel: (
    <Icon>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="m9 4 1.5 5L12 4l1.5 5L15 4" />
      <path d="M8.5 15.5 13 12l-4.5-3.5z" />
    </Icon>
  ),
  heart: (
    <Icon>
      <path d="M12 21s-7.5-4.6-9.5-9C1 8.6 2.8 5 6.5 5c2 0 3.4 1 4.5 2.6L12 9l1-1.4C14.1 6 15.5 5 17.5 5 21.2 5 23 8.6 21.5 12c-2 4.4-9.5 9-9.5 9z" />
    </Icon>
  ),
  plus: (
    <Icon>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <path d="M12 8v8M8 12h8" />
    </Icon>
  ),
  messenger: (
    <Icon>
      <path d="m12 3 9 4.5-2.2 10.5H5.2L3 7.5z" />
      <path d="M3 7.5 12 13l9-5.5" />
    </Icon>
  ),
};

function ProfileHeader() {
  return (
    <div className="flex gap-8 px-4 py-6 sm:gap-16 sm:py-8">
      {/* Avatar with story ring */}
      <div className={`shrink-0 rounded-full p-[3px] ${BRAND_GRADIENT}`}>
        <div className="rounded-full bg-white p-[3px]">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-indigo-400 text-2xl font-bold text-white sm:h-28 sm:w-28 sm:text-4xl">
            JD
          </div>
        </div>
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <h1 className="text-xl font-light sm:text-2xl">jane.doe</h1>
          <button className="rounded-lg bg-zinc-100 px-4 py-1.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200">
            Edit profile
          </button>
          <button className="rounded-lg bg-zinc-100 px-4 py-1.5 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-200">
            Share profile
          </button>
        </div>

        {/* Stats */}
        <div className="mt-4 flex gap-6 text-sm sm:gap-10">
          <span>
            <strong className="font-semibold">12</strong> posts
          </span>
          <span>
            <strong className="font-semibold">1,284</strong> followers
          </span>
          <span>
            <strong className="font-semibold">341</strong> following
          </span>
        </div>

        {/* Bio */}
        <div className="mt-4 text-sm leading-relaxed">
          <p className="font-semibold">Jane Doe</p>
          <p>✨ Just living life one gradient at a time</p>
          <p>🌿 Plant lover · 📍 San Francisco</p>
          <a href="#" className="font-semibold text-blue-500">
            linktr.ee/jane.doe
          </a>
        </div>
      </div>
    </div>
  );
}

function StoryHighlights() {
  return (
    <div className="flex gap-5 overflow-x-auto px-4 pb-2">
      {HIGHLIGHTS.map((h) => (
        <div key={h.id} className="flex w-16 shrink-0 flex-col items-center gap-2">
          <div className={`rounded-full p-[2.5px] ${BRAND_GRADIENT}`}>
            <div className="rounded-full bg-white p-[2.5px]">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br text-2xl ${h.gradient}`}
              >
                {h.emoji}
              </div>
            </div>
          </div>
          <span className="truncate text-xs text-zinc-700">{h.label}</span>
        </div>
      ))}
    </div>
  );
}

function Tabs() {
  const tabBase = "flex flex-1 items-center justify-center py-3 text-zinc-500";
  return (
    <div className="mt-2 flex border-t border-zinc-200">
      <button className={`${tabBase} border-t border-zinc-900 text-zinc-900`}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6">
          <rect x="3" y="3" width="7.5" height="7.5" rx="1" />
          <rect x="13.5" y="3" width="7.5" height="7.5" rx="1" />
          <rect x="3" y="13.5" width="7.5" height="7.5" rx="1" />
          <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1" />
        </svg>
      </button>
      <button className={tabBase}>{icons.reel}</button>
      <button className={tabBase}>{icons.heart}</button>
    </div>
  );
}

function PostGrid() {
  return (
    <div className="grid grid-cols-3 gap-1">
      {POSTS.map((post) => (
        <div
          key={post.id}
          className={`group relative aspect-square overflow-hidden bg-gradient-to-br ${post.gradient}`}
        >
          <span className="absolute inset-0 flex items-center justify-center text-5xl drop-shadow-sm transition-transform duration-300 group-hover:scale-110 sm:text-6xl">
            {post.emoji}
          </span>
          {/* Hover overlay with likes / comments */}
          <div className="absolute inset-0 flex items-center justify-center gap-5 bg-black/30 text-sm font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex items-center gap-1.5">
              ❤️ {post.likes}
            </span>
            <span className="flex items-center gap-1.5">
              💬 {post.comments}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function TopNav() {
  return (
    <header className="sticky top-0 z-10 hidden border-b border-zinc-200 bg-white/90 backdrop-blur md:block">
      <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${BRAND_GRADIENT} text-white`}>
            {icons.home}
          </div>
          <span className="text-xl font-semibold tracking-tight">Instagram</span>
        </div>

        {/* Search */}
        <div className="flex w-64 items-center gap-2 rounded-lg bg-zinc-100 px-3 py-2 text-zinc-500">
          {icons.search}
          <span className="text-sm">Search</span>
        </div>

        {/* Actions */}
        <nav className="flex items-center gap-5 text-zinc-800">
          {icons.home}
          {icons.messenger}
          {icons.plus}
          {icons.compass}
          {icons.heart}
        </nav>
      </div>
    </header>
  );
}

function BottomNav() {
  const item = "flex flex-1 items-center justify-center py-3 text-zinc-800";
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 flex border-t border-zinc-200 bg-white md:hidden">
      <button className={item}>{icons.home}</button>
      <button className={item}>{icons.search}</button>
      <button className={item}>{icons.plus}</button>
      <button className={item}>{icons.reel}</button>
      <button className={item}>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-sky-300 to-indigo-400 text-[9px] font-bold text-white">
          JD
        </div>
      </button>
    </nav>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-white pb-16 text-zinc-900 md:pb-0">
      <TopNav />
      <main className="mx-auto max-w-4xl">
        <ProfileHeader />
        <StoryHighlights />
        <Tabs />
        <PostGrid />
      </main>
      <BottomNav />
    </div>
  );
}
