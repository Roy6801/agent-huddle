import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "@/App";
import { Home } from "@/home";
import { useRoomState, type RoomSource } from "@/hooks/use-room";
import { fileUrl, postJson, uploadFile } from "@/lib/api";
import "@/index.css";

const server: RoomSource = { useRoomState, post: postJson, upload: uploadFile, fileUrl, canCopyJoin: true, quiet: false };

// The same page serves your home at /home/<key>, and rooms everywhere else (/s/<id>/h/<key>, /home/<key>/rooms/<file>).
const home = /^\/home\/[^/]+\/?$/.test(location.pathname);

createRoot(document.getElementById("root")!).render(<StrictMode>{home ? <Home /> : <App source={server} />}</StrictMode>);
