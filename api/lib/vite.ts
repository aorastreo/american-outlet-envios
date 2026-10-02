import type { Hono } from "hono";
import type { HttpBindings } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import fs from "fs";
import path from "path";

type App = Hono<{ Bindings: HttpBindings }>;

export function serveStaticFiles(app: App) {
  const distPath = path.resolve(import.meta.dirname, "../dist/public");

  app.use("*", async (c, next) => {
    c.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    c.header("Pragma", "no-cache");
    c.header("Expires", "0");
    await next();
  });

  app.use("*", serveStatic({ root: "./dist/public" }));

  app.notFound((c) => {
    const accept = c.req.header("accept") ?? "";
    if (!accept.includes("text/html")) {
      return c.json({ error: "Not Found" }, 404);
    }
    const indexPath = path.resolve(distPath, "index.html");
    let content = fs.readFileSync(indexPath, "utf-8");

    // INJECT: Emergency timeline fix for old frontend that doesn't use backend timelineSteps
    const injectScript = `<script>
(function() {
  console.log("[AO] Emergency timeline fix injected");
  
  // Intercept fetch to patch timeline data
  const originalFetch = window.fetch;
  window.fetch = async function(...args) {
    const response = await originalFetch.apply(this, args);
    const url = args[0];
    
    // Only intercept tRPC track calls
    if (typeof url === 'string' && url.includes('track')) {
      try {
        const clone = response.clone();
        const data = await clone.json();
        
        if (data?.result?.data?.json?.timelineSteps) {
          const shipment = data.result.data.json;
          const steps = shipment.timelineSteps;
          const status = shipment.status;
          
          // Calculate correct currentStepIndex using tracking history
          const trackingHistory = shipment.tracking || [];
          const statusCounts = {};
          for (const t of trackingHistory) {
            if (t.status) statusCounts[t.status] = (statusCounts[t.status] || 0) + 1;
          }
          if (status) statusCounts[status] = (statusCounts[status] || 0) + 1;
          
          let currentStepIndex = -1;
          const remaining = {...statusCounts};
          for (let i = 0; i < steps.length; i++) {
            const stepStatus = steps[i].status;
            if (remaining[stepStatus] && remaining[stepStatus] > 0) {
              remaining[stepStatus]--;
              if (stepStatus === status && remaining[stepStatus] === 0) {
                currentStepIndex = i;
                break;
              }
            }
          }
          
          // Patch the response
          data.result.data.json.__ao_fixed_step = currentStepIndex;
          data.result.data.json.__ao_fixed_version = "v3.5";
          
          // Store for the renderer to use
          window.__AO_TIMELINE_STEPS__ = steps;
          window.__AO_CURRENT_STEP__ = currentStepIndex;
          
          console.log("[AO] Timeline fixed:", { status, currentStepIndex, steps: steps.map((s,i) => i + ":" + s.label) });
        }
        
        return response;
      } catch(e) {
        console.error("[AO] Patch failed:", e);
        return response;
      }
    }
    
    return response;
  };
  
  // Override React rendering to use fixed timeline
  const fixTimeline = function() {
    const progressBars = document.querySelectorAll('[class*="bg-[#C8102E]"]');
    if (progressBars.length > 0 && window.__AO_TIMELINE_STEPS__) {
      const steps = window.__AO_TIMELINE_STEPS__;
      const currentStep = window.__AO_CURRENT_STEP__;
      
      // Find the progress bar and update it
      progressBars.forEach(bar => {
        if (bar.style.width) {
          const pct = steps.length > 1 ? Math.max(0, (currentStep / (steps.length - 1)) * 100) : 0;
          bar.style.width = pct + '%';
        }
      });
      
      // Update step indicators
      const stepIcons = document.querySelectorAll('[class*="rounded-full"]');
      stepIcons.forEach((icon, idx) => {
        if (idx < steps.length) {
          const isCompleted = idx <= currentStep;
          const isCurrent = idx === currentStep;
          
          if (isCompleted) {
            icon.style.backgroundColor = '#C8102E';
            icon.style.borderColor = '#C8102E';
          }
          if (isCurrent) {
            icon.style.boxShadow = '0 0 0 4px rgba(200,16,46,0.3)';
          }
        }
      });
      
      console.log("[AO] DOM patched for step", currentStep);
    }
  };
  
  // Run fix after React renders
  setTimeout(fixTimeline, 500);
  setTimeout(fixTimeline, 1500);
  setTimeout(fixTimeline, 3000);
  
  // Also observe DOM changes
  if (window.MutationObserver) {
    const observer = new MutationObserver(function(mutations) {
      fixTimeline();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
</script>`;

    content = content.replace("<head>", `<head>\n${injectScript}`);

    return c.html(content);
  });
}
