import { useState } from "react";
import LandingPage from "./LandingPage";
import App from "./App";

export default function Root() {
  const [launched, setLaunched] = useState(false);

  if (!launched) {
    return <LandingPage onLaunch={() => setLaunched(true)} />;
  }

  // Pass onGoHome so the FocusMind logo inside App goes back to landing page
  return <App onGoHome={() => setLaunched(false)} />;
}
