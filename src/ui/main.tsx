import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { App } from "./App.js"
import "./styles/globals.css"

const container = document.querySelector("#root")

if (!container) {
  throw new Error("root container not found")
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
