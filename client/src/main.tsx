import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { PhantomWalletProvider } from "./components/PhantomWallet";

createRoot(document.getElementById("root")!).render(
  <PhantomWalletProvider>
    <App />
  </PhantomWalletProvider>
);
