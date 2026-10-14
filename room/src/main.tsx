import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/App";
import { useRoomState, type RoomSource } from "@/hooks/use-room";
import { fileUrl, postJson, uploadFile } from "@/lib/api";
import "@/index.css";

const server: RoomSource = { useRoomState, post: postJson, upload: uploadFile, fileUrl, canCopyJoin: true, quiet: false };

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App source={server} />
  </StrictMode>,
);
