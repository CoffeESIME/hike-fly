"use client";
import React from "react";

type Props = {
  avatarUrl: string;
};

/**
 * Circular avatar badge shown in the top-right corner of the map.
 * Rendered with a pop-in entrance animation.
 */
export function AvatarBadge({ avatarUrl }: Props) {
  return (
    <div
      style={{
        position: "absolute",
        top: "20px",
        right: "20px",
        width: "140px",
        height: "140px",
        borderRadius: "50%",
        overflow: "hidden",
        zIndex: 20,
        border: "4px solid rgba(255,255,255,0.9)",
        boxShadow: "0 6px 28px rgba(0,0,0,0.55), 0 0 0 2px rgba(0,198,255,0.35)",
        pointerEvents: "none",
        animation: "avatarPop 0.4s cubic-bezier(0.175,0.885,0.32,1.275) both",
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={avatarUrl}
        alt="Avatar"
        style={{ width: "100%", height: "100%", objectFit: "cover" }}
      />
    </div>
  );
}
