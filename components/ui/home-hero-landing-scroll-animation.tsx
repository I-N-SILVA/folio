"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, EffectFade } from "swiper/modules";
import "swiper/css";
import "swiper/css/effect-fade";
import { ImagesBadge } from "./images-badge";

gsap.registerPlugin(ScrollTrigger);

interface AnimationOrderItem {
  segment: HTMLElement;
  originalIndex: number;
}

const HomeHeroLandingScrollAnimation: React.FC = () => {
  const animatedIconsRef = useRef<HTMLDivElement | null>(null);
  const heroHeaderRef = useRef<HTMLDivElement | null>(null);
  const heroSectionRef = useRef<HTMLElement | null>(null);
  const iconElementsRef = useRef<(HTMLDivElement | null)[]>([]);
  const textSegmentsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const placeholdersRef = useRef<(HTMLDivElement | null)[]>([]);
  const duplicateIconsRef = useRef<HTMLElement[] | null>(null);
  const textAnimationOrderRef = useRef<AnimationOrderItem[]>([]);

  // High-impact, click-worthy hero images for QLICO - workspaces, collaboration, modern design
  const serviceImages: string[] = [
    "https://images.unsplash.com/photo-1522071820081-009f0129c71c?auto=format&fit=crop&w=1260&q=80",  // collaborative team
    "https://images.unsplash.com/photo-1551434678-e076c223a692?auto=format&fit=crop&w=1260&q=80",  // analyzing data on screen
    "https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1260&q=80",  // typing fast / coding
    "https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1260&q=80",    // startup meeting
    "https://images.unsplash.com/photo-1497215728101-856f4ea42174?auto=format&fit=crop&w=1260&q=80",  // clean modern office
  ];

  const badgeImages = [
    { src: "https://api.dicebear.com/9.x/shapes/svg?seed=alpha&backgroundColor=1e293b", alt: "Alpha" },
    { src: "https://api.dicebear.com/9.x/shapes/svg?seed=beta&backgroundColor=0f172a", alt: "Beta" },
    { src: "https://api.dicebear.com/9.x/shapes/svg?seed=gamma&backgroundColor=172554", alt: "Gamma" },
    { src: "https://api.dicebear.com/9.x/shapes/svg?seed=delta&backgroundColor=1c1917", alt: "Delta" },
    { src: "https://api.dicebear.com/9.x/shapes/svg?seed=epsilon&backgroundColor=14532d", alt: "Epsilon" },
    { src: "https://api.dicebear.com/9.x/shapes/svg?seed=zeta&backgroundColor=450a0a", alt: "Zeta" },
  ];

  useEffect(() => {
    const textSegments = textSegmentsRef.current;
    const animationOrder: AnimationOrderItem[] = [];

    textSegments.forEach((segment, index) => {
      if (segment) animationOrder.push({ segment, originalIndex: index });
    });

    for (let i = animationOrder.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [animationOrder[i], animationOrder[j]] = [animationOrder[j], animationOrder[i]];
    }

    textAnimationOrderRef.current = animationOrder;

    const isMobile = window.innerWidth < 1000;
    const headerIconSize = isMobile ? 35 : 60;
    const currentIconSize = iconElementsRef.current[0]?.getBoundingClientRect().width || 1;
    const exactScale = headerIconSize / currentIconSize;

    ScrollTrigger.create({
      trigger: heroSectionRef.current,
      start: "top top",
      end: `+=${window.innerHeight * 8}px`,
      pin: true,
      pinSpacing: true,
      scrub: 1,
      onUpdate: (self) => {
        const progress = self.progress;

        textSegments.forEach((segment) => {
          if (segment) gsap.set(segment, { opacity: 0 });
        });

        if (progress < 0.3) {
          const moveProgress = progress / 0.3;
          const containerMoveY = -window.innerHeight * 0.3 * moveProgress;

          if (progress < 0.15) {
            const headerProgress = progress / 0.15;
            gsap.set(heroHeaderRef.current, {
              transform: `translateY(${-50 * headerProgress}px)`,
              opacity: 1 - headerProgress,
            });
          } else {
            gsap.set(heroHeaderRef.current, { transform: "translateY(-50px)", opacity: 0 });
          }

          if (duplicateIconsRef.current) {
            duplicateIconsRef.current.forEach((d) => d.parentNode?.removeChild(d));
            duplicateIconsRef.current = null;
          }

          gsap.set(animatedIconsRef.current, { x: 0, y: containerMoveY, scale: 1, opacity: 1 });

          iconElementsRef.current.forEach((icon, index) => {
            if (icon) {
              const staggerDelay = index * 0.1;
              const iconProgress = gsap.utils.mapRange(staggerDelay, staggerDelay + 0.5, 0, 1, moveProgress);
              const clamped = Math.max(0, Math.min(1, iconProgress));
              gsap.set(icon, { x: 0, y: (-containerMoveY) * (1 - clamped) });
            }
          });

        } else if (progress < 0.6) {
          const scaleProgress = (progress - 0.3) / 0.3;

          gsap.set(heroHeaderRef.current, { transform: "translateY(-50px)", opacity: 0 });
          if (heroSectionRef.current) heroSectionRef.current.style.backgroundColor = "#fafafa";

          if (duplicateIconsRef.current) {
            duplicateIconsRef.current.forEach((d) => d.parentNode?.removeChild(d));
            duplicateIconsRef.current = null;
          }

          const containerRect = animatedIconsRef.current!.getBoundingClientRect();
          const deltaX = (window.innerWidth / 2 - (containerRect.left + containerRect.width / 2)) * scaleProgress;
          const deltaY = (window.innerHeight / 2 - (containerRect.top + containerRect.height / 2)) * scaleProgress;

          gsap.set(animatedIconsRef.current, {
            x: deltaX,
            y: -window.innerHeight * 0.3 + deltaY,
            scale: 1 + (exactScale - 1) * scaleProgress,
            opacity: 1,
          });

          iconElementsRef.current.forEach((icon) => { if (icon) gsap.set(icon, { x: 0, y: 0 }); });

        } else if (progress < 0.75) {
          const moveProgress = (progress - 0.6) / 0.15;

          gsap.set(heroHeaderRef.current, { transform: "translateY(-50px)", opacity: 0 });
          if (heroSectionRef.current) heroSectionRef.current.style.backgroundColor = "#fafafa";

          const containerRect = animatedIconsRef.current!.getBoundingClientRect();
          const deltaX = window.innerWidth / 2 - (containerRect.left + containerRect.width / 2);
          const deltaY = window.innerHeight / 2 - (containerRect.top + containerRect.height / 2);

          gsap.set(animatedIconsRef.current, {
            x: deltaX,
            y: -window.innerHeight * 0.3 + deltaY,
            scale: exactScale,
            opacity: 0,
          });

          iconElementsRef.current.forEach((icon) => { if (icon) gsap.set(icon, { x: 0, y: 0 }); });

          if (!duplicateIconsRef.current) {
            duplicateIconsRef.current = [];
            iconElementsRef.current.forEach((icon) => {
              if (icon) {
                const duplicate = icon.cloneNode(true) as HTMLElement;
                duplicate.className = "duplicate-icon rounded-sm overflow-hidden";
                Object.assign(duplicate.style, {
                  position: "absolute",
                  width: headerIconSize + "px",
                  height: headerIconSize + "px",
                  zIndex: "50",
                });
                document.body.appendChild(duplicate);
                duplicateIconsRef.current!.push(duplicate);
              }
            });
          }

          duplicateIconsRef.current?.forEach((duplicate, index) => {
            if (index < placeholdersRef.current.length) {
              const iconRect = iconElementsRef.current[index]!.getBoundingClientRect();
              const startPageX = iconRect.left + iconRect.width / 2 + window.pageXOffset;
              const startPageY = iconRect.top + iconRect.height / 2 + window.pageYOffset;

              const targetRect = placeholdersRef.current[index]!.getBoundingClientRect();
              const targetPageX = targetRect.left + targetRect.width / 2 + window.pageXOffset;
              const targetPageY = targetRect.top + targetRect.height / 2 + window.pageYOffset;

              const moveX = targetPageX - startPageX;
              const moveY = targetPageY - startPageY;

              let currentX = 0;
              let currentY = moveProgress < 0.5 ? moveY * (moveProgress / 0.5) : moveY;
              if (moveProgress >= 0.5) currentX = moveX * ((moveProgress - 0.5) / 0.5);

              duplicate.style.left = startPageX + currentX - headerIconSize / 2 + "px";
              duplicate.style.top = startPageY + currentY - headerIconSize / 2 + "px";
              duplicate.style.opacity = "1";
              duplicate.style.display = "flex";
            }
          });

        } else {
          gsap.set(heroHeaderRef.current, { transform: "translateY(-100px)", opacity: 0 });
          if (heroSectionRef.current) heroSectionRef.current.style.backgroundColor = "#fafafa";
          gsap.set(animatedIconsRef.current, { opacity: 0 });

          duplicateIconsRef.current?.forEach((duplicate, index) => {
            if (index < placeholdersRef.current.length) {
              const targetRect = placeholdersRef.current[index]!.getBoundingClientRect();
              const targetPageX = targetRect.left + targetRect.width / 2 + window.pageXOffset;
              const targetPageY = targetRect.top + targetRect.height / 2 + window.pageYOffset;
              duplicate.style.left = targetPageX - headerIconSize / 2 + "px";
              duplicate.style.top = targetPageY - headerIconSize / 2 + "px";
              duplicate.style.opacity = "1";
              duplicate.style.display = "flex";
            }
          });

          textAnimationOrderRef.current.forEach((item, randomIndex) => {
            const segStart = 0.75 + randomIndex * 0.03;
            const segProgress = gsap.utils.mapRange(segStart, segStart + 0.015, 0, 1, progress);
            gsap.set(item.segment, { opacity: Math.max(0, Math.min(1, segProgress)) });
          });
        }
      },
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
      duplicateIconsRef.current?.forEach((d) => d.parentNode?.removeChild(d));
    };
  }, []);

  return (
    <div className="w-full overflow-x-hidden bg-[#fafafa]">
      <style>{`
        .premium-font { font-family: 'Inter', sans-serif; letter-spacing: -0.03em; }
        .hero-bg-swiper { position: absolute; inset: 0; width: 100% !important; height: 100% !important; }
        .hero-bg-swiper .swiper-wrapper, .hero-bg-swiper .swiper-slide { width: 100% !important; height: 100% !important; }
        .hero-bg-swiper .swiper-slide { opacity: 0 !important; transition: opacity 1.2s ease !important; }
        .hero-bg-swiper .swiper-slide-active { opacity: 1 !important; }
      `}</style>

      <section
        ref={heroSectionRef}
        className="hero premium-font relative w-screen h-[100dvh] px-4 md:px-6 flex flex-col items-center justify-center bg-[#fafafa] text-[#141414] overflow-hidden"
      >
        <div
          ref={heroHeaderRef}
          className="absolute inset-0 w-full h-full will-change-transform"
          style={{ zIndex: 0 }}
        >
          <Swiper
            modules={[Autoplay, EffectFade]}
            effect="fade"
            autoplay={{ delay: 3200, disableOnInteraction: false }}
            loop
            speed={1200}
            className="hero-bg-swiper"
          >
            {serviceImages.map((src, i) => (
              <SwiperSlide key={i} style={{ position: "relative", overflow: "hidden" }}>
                <img
                  src={src}
                  alt={`Hero Slide ${i + 1}`}
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
                />
                <div style={{
                  position: "absolute", inset: 0, zIndex: 1,
                  background: "linear-gradient(to bottom, rgba(250,250,250,0.52) 0%, rgba(250,250,250,0.28) 45%, rgba(250,250,250,0.78) 100%)",
                }} />
              </SwiperSlide>
            ))}
          </Swiper>
          
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center pointer-events-none pb-40">
             {/* Integrated Images Badge */}
             <div className="pointer-events-auto">
               <ImagesBadge images={badgeImages} label="Trusted by thousands of teams" />
             </div>
          </div>
        </div>

        <div
          ref={animatedIconsRef}
          className="animated-icons fixed bottom-10 left-1/2 -translate-x-1/2 md:left-auto md:translate-x-0 flex items-center gap-1 w-[90%] md:w-[80%] will-change-transform z-2"
        >
          {serviceImages.map((src, index) => (
            <div
              key={index}
              ref={(el) => { iconElementsRef.current[index] = el; }}
              className="animated-icon flex-1 aspect-square will-change-transform rounded-sm overflow-hidden bg-gray-100"
            >
              <img src={src} alt={`Service Icon ${index + 1}`} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>

        <h1 className="animated-text relative z-10 max-w-[90vw] md:max-w-[85vw] text-center text-[#141414] text-[clamp(1.4rem,5vw,4.5rem)] font-bold tracking-tight leading-[1.2] md:leading-[1.1]">
          <span ref={(el) => { textSegmentsRef.current[0] = el; }} className="text-segment opacity-0">
            Intelligent document formats
          </span>
          <div ref={(el) => { placeholdersRef.current[0] = el; }} className="placeholder-icon mx-1 md:-mt-1.5 w-8 h-8 md:w-16 md:h-16 inline-block align-middle will-change-transform invisible" />

          <span ref={(el) => { textSegmentsRef.current[1] = el; }} className="text-segment opacity-0">
            build the foundation
          </span>
          <div ref={(el) => { placeholdersRef.current[1] = el; }} className="placeholder-icon mx-1 md:-mt-1.5 w-8 h-8 md:w-16 md:h-16 inline-block align-middle will-change-transform invisible" />

          <span ref={(el) => { textSegmentsRef.current[2] = el; }} className="text-segment opacity-0">
            where seamless collaboration
          </span>
          <div ref={(el) => { placeholdersRef.current[2] = el; }} className="placeholder-icon mx-1 md:-mt-1.5 w-8 h-8 md:w-16 md:h-16 inline-block align-middle will-change-transform invisible" />

          <span ref={(el) => { textSegmentsRef.current[3] = el; }} className="text-segment opacity-0">
            and dynamic data
          </span>
          <div ref={(el) => { placeholdersRef.current[3] = el; }} className="placeholder-icon mx-1 md:-mt-1.5 w-8 h-8 md:w-16 md:h-16 inline-block align-middle will-change-transform invisible" />

          <span ref={(el) => { textSegmentsRef.current[4] = el; }} className="text-segment opacity-0">
            engineer perfect
            <div ref={(el) => { placeholdersRef.current[4] = el; }} className="placeholder-icon mx-1 md:-mt-1.5 w-8 h-8 md:w-16 md:h-16 inline-block align-middle will-change-transform invisible" />
            workflows.
          </span>
        </h1>
      </section>
    </div>
  );
};

export default HomeHeroLandingScrollAnimation;
