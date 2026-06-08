"use client";
import { useState, useEffect, useRef } from "react";
import { PhotoMarker } from "../types";

export type UseSlideshowReturn = {
  activePhoto: PhotoMarker | null;
  setActivePhoto: React.Dispatch<React.SetStateAction<PhotoMarker | null>>;
  slideshowQueue: PhotoMarker[];
  setSlideshowQueue: React.Dispatch<React.SetStateAction<PhotoMarker[]>>;
  currentSlideIndex: number;
  setCurrentSlideIndex: React.Dispatch<React.SetStateAction<number>>;
  /** Ref shared with useAnimation — set to true when a photo slideshow is active. */
  isPausedForPhotoRef: React.MutableRefObject<boolean>;
  /** Close the active photo overlay and fully reset all slideshow state. */
  closePhotoOverlay: () => void;
  /** Manually advance to the next slide (useful for when a video ends) */
  advanceSlideshow: () => void;
};

/**
 * Manages the photo slideshow that pauses the animation while photos are shown.
 *
 * Exposes `isPausedForPhotoRef` so that `useAnimation` can read it synchronously
 * inside the rAF loop without stale-closure issues.
 */
export function useSlideshow(): UseSlideshowReturn {
  const [activePhoto,       setActivePhoto]       = useState<PhotoMarker | null>(null);
  const [slideshowQueue,    setSlideshowQueue]    = useState<PhotoMarker[]>([]);
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(-1);

  const isPausedForPhotoRef = useRef<boolean>(false);

  const advanceSlideshow = () => {
    const nextIndex = currentSlideIndex + 1;
    if (nextIndex < slideshowQueue.length) {
      setCurrentSlideIndex(nextIndex);
      setActivePhoto(slideshowQueue[nextIndex]);
    } else {
      // End of slideshow — resume animation
      setActivePhoto(null);
      setSlideshowQueue([]);
      setCurrentSlideIndex(-1);
      isPausedForPhotoRef.current = false;
    }
  };

  // Auto-advance or end the slideshow after 3 seconds per photo
  useEffect(() => {
    if (!activePhoto || slideshowQueue.length === 0) return;
    if (activePhoto.mediaType === "video") return;

    const timer = setTimeout(advanceSlideshow, 3000);

    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePhoto, slideshowQueue, currentSlideIndex]);

  const closePhotoOverlay = () => {
    setActivePhoto(null);
    setSlideshowQueue([]);
    setCurrentSlideIndex(-1);
    isPausedForPhotoRef.current = false;
  };

  return {
    activePhoto,
    setActivePhoto,
    slideshowQueue,
    setSlideshowQueue,
    currentSlideIndex,
    setCurrentSlideIndex,
    isPausedForPhotoRef,
    closePhotoOverlay,
    advanceSlideshow,
  };
}
