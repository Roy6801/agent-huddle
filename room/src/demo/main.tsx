import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/App";
import { DemoControls } from "@/demo/controls";
import { demoSource, player } from "@/demo/room";
import "@/index.css";
import "@/demo/demo.css";

/** The site passes its theme as ?theme= and posts changes; without one the system theme applies. */
function setTheme(theme: unknown) {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
}

setTheme(new URLSearchParams(location.search).get("theme"));
addEventListener("message", (e) => {
  if (e.origin === location.origin && e.data?.type === "theme") setTheme(e.data.theme);
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <DemoControls />
    <App source={demoSource} />
  </StrictMode>,
);

player.start();
