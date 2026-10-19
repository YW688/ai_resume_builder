"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 首屏视频：poster 立即显示，canplay 后 400ms 淡入避免闪黑；
 * 滚出视口暂停、滚回再播（IntersectionObserver）省电；
 * prefers-reduced-motion 下暂停并停留在 poster。
 * <1024px 走 720p 移动版（底部横幅裁切保证人猫同框），≥1024px 走 1080p 全幅。
 */
export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (motionQuery.matches) {
      // autoPlay 属性可能晚于本效应启动：关掉 autoplay 并对 play 事件兜底暂停
      video.autoplay = false;
      video.pause();
      const halt = () => video.pause();
      video.addEventListener("play", halt);
      return () => video.removeEventListener("play", halt);
    }

    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    const onCanPlay = () => {
      fadeTimer = setTimeout(() => setReady(true), 400);
    };
    video.addEventListener("canplay", onCanPlay);

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) void video.play().catch(() => undefined);
        else video.pause();
      },
      { threshold: 0.15 },
    );
    observer.observe(video);

    return () => {
      if (fadeTimer !== undefined) clearTimeout(fadeTimer);
      video.removeEventListener("canplay", onCanPlay);
      observer.disconnect();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      aria-hidden
      autoPlay
      controls={false}
      loop
      muted
      playsInline
      preload="metadata"
      className={`absolute inset-x-0 bottom-0 aspect-[4/3] w-full object-cover transition-opacity duration-700 lg:inset-0 lg:aspect-auto lg:h-full ${
        ready ? "opacity-100" : "opacity-0"
      }`}
    >
      <source src="/hero/hero-720p.mp4" media="(max-width: 1023px)" type="video/mp4" />
      <source src="/hero/hero.mp4" type="video/mp4" />
    </video>
  );
}
