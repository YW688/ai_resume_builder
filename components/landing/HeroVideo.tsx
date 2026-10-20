"use client";

import { useEffect, useRef, useState } from "react";

/**
 * 首屏视频：poster 层由 Hero.tsx 负责立即绘制；
 * 本组件只负责「多源选择 + canplay 淡入 + 滚出暂停 + reduced-motion 兜底」。
 * 素材现状：9:16 与 webm（VP9/AV1）源尚未导出，故只挂两个 mp4，
 * 不引用不存在的文件；`data-orientation` 机制保留，hero-9x16.mp4 到位后加一行 source 即可。
 */
export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [orientation, setOrientation] = useState<"9x16" | "16x9">("16x9");

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    let halt: (() => void) | undefined;
    let observer: IntersectionObserver | undefined;

    const clearFade = () => {
      if (fadeTimer !== undefined) clearTimeout(fadeTimer);
      fadeTimer = undefined;
    };

    const start = () => {
      clearFade();
      observer?.disconnect();
      observer = undefined;
      if (motionQuery.matches) {
        // autoPlay 属性可能晚于本效应启动：关掉 autoplay 并对 play 事件兜底暂停
        video.autoplay = false;
        video.pause();
        setReady(false);
        halt = () => video.pause();
        video.addEventListener("play", halt);
        return;
      }
      // 若从 reduced-motion 切回：移除拦截再播放
      if (halt) {
        video.removeEventListener("play", halt);
        halt = undefined;
      }
      void video.play().catch(() => setReady(false));
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) void video.play().catch(() => undefined);
          else video.pause();
        },
        { threshold: 0.15 },
      );
      observer.observe(video);
    };

    const onLoadedMetadata = () => {
      setOrientation(video.currentSrc.includes("hero-9x16") ? "9x16" : "16x9");
    };
    const onCanPlay = () => {
      clearFade();
      fadeTimer = setTimeout(() => setReady(true), 400);
    };
    // play() 被拒/error/stalled 时不崩：保持 poster 层可见，视频保持透明（不允许黑屏）
    const onError = () => setReady(false);
    const onMotionChange = () => start();

    video.addEventListener("loadedmetadata", onLoadedMetadata);
    video.addEventListener("canplay", onCanPlay);
    video.addEventListener("error", onError);
    motionQuery.addEventListener("change", onMotionChange);

    start();

    return () => {
      clearFade();
      if (halt) video.removeEventListener("play", halt);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
      video.removeEventListener("canplay", onCanPlay);
      video.removeEventListener("error", onError);
      motionQuery.removeEventListener("change", onMotionChange);
      observer?.disconnect();
    };
  }, []);

  return (
    <video
      ref={videoRef}
      data-orientation={orientation}
      aria-hidden
      tabIndex={-1}
      autoPlay
      controls={false}
      loop
      muted
      playsInline
      preload="metadata"
      poster="/hero/poster.jpg"
      className={`hero-media transition-opacity duration-700 ${
        ready ? "opacity-100" : "opacity-0"
      }`}
    >
      <source src="/hero/hero-720p.mp4" media="(max-width: 1023px)" type="video/mp4" />
      <source src="/hero/hero.mp4" type="video/mp4" />
    </video>
  );
}
