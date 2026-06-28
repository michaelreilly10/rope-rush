import { createFileRoute } from "@tanstack/react-router";
import { RopeRush } from "../game/RopeRush";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Rope Rush — Endless Ninja Descent" },
      { name: "description", content: "A one-tap arcade descent. Slide down the rope, dodge traps, master the combo system, and unlock ninja cosmetics." },
      { property: "og:title", content: "Rope Rush" },
      { property: "og:description", content: "One-tap ninja arcade. Tap to switch sides of the rope and survive the endless fortress." },
      { name: "theme-color", content: "#0d0b1a" },
    ],
  }),
  component: () => <RopeRush />,
});
