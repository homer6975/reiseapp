import Image from "next/image";

import type { TripCover } from "@/lib/trip-cover";
import { cn } from "@/lib/utils";

/** Reisebild als Fläche; Inhalt (Titel) liegt auf einem dunklen Verlauf darüber. */
export function CoverImage({
  cover,
  className,
  children,
  priority = false,
}: {
  cover: TripCover & { src: string };
  className?: string;
  children?: React.ReactNode;
  priority?: boolean;
}) {
  return (
    <div
      className={cn(
        "relative isolate overflow-hidden rounded-2xl bg-(image:--hero) text-(--hero-foreground) shadow-card",
        className,
      )}
    >
      <Image
        src={cover.src}
        alt=""
        fill
        unoptimized
        priority={priority}
        sizes="(min-width: 768px) 768px, 100vw"
        className="-z-10 object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 bg-linear-to-t from-[#0b1c22]/85 via-[#0b1c22]/35 to-transparent"
      />
      {children}
      {cover.credit && <CoverCredit cover={cover} />}
    </div>
  );
}

export function CoverCredit({ cover }: { cover: TripCover }) {
  if (!cover.credit) return null;
  return (
    <a
      href={cover.creditUrl ?? undefined}
      target="_blank"
      rel="noopener noreferrer"
      className="absolute top-2 right-2 max-w-[70%] truncate rounded-full bg-black/40 px-2 py-0.5 text-[10px] leading-4 text-white/90 hover:bg-black/60"
      title={cover.credit}
    >
      {cover.credit}
    </a>
  );
}

/** Kleines Vorschaubild für Listen. */
export function CoverThumb({ src }: { src: string }) {
  return (
    <span className="relative block size-14 shrink-0 overflow-hidden rounded-[10px] bg-muted">
      <Image
        src={src}
        alt=""
        fill
        unoptimized
        sizes="56px"
        className="object-cover"
      />
    </span>
  );
}
