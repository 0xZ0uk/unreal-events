import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app";
import "./index.css";

const container = document.getElementById("app");

if (!container) throw new Error("Falta o elemento #app no index.html");

createRoot(container).render(
	<StrictMode>
		<App />
	</StrictMode>,
);
