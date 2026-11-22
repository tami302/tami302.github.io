

window.PORTFOLIO_DATA = {

  profile: {
    handle: "TIM",
    ticker: "SHANGHAI · TONGJI UNIVERSITY · ENGINEERING · BUILDING SYSTEMS IN THE QUIET",
    headlineLead: "Building systems that run in the quiet,",
    headlineRest: "from autonomous agents to procedural visuals.",
    bio: "First-year engineering undergraduate at Tongji University. Interested in agent workflows, reliable automation, and interfaces shaped like instruments.",
    location: "Shanghai, CN",
    coords: "31.28°N 121.50°E",
    school: "Tongji Univ. / B.Eng '30",
  
    email: "timforgithub.outlook.com",
    github: {
      label: "github.com/tami302",
      url: "https://github.com/tami302",
    },
  },


  projects: [
    {
      id: "cloud-ai-tutor",
      motif: "orbit",
      code: "001",
      year: "2026",
      status: "DEPLOYED",
      eyebrow: "Autonomous Learning Runtime",
      lead: "A private WeChat study agent that remembers,",
      rest: "tracking weak spots across weeks and shipping printable reviews.",
      stack: ["Node.js", "Linux ECS", "Long-term Memory", "Cron", "A4 PDF"],
      specs: [
        { k: "SURFACE", v: "WeChat Native · Always-On Cloud Service" },
        { k: "CORE LOOP", v: "Context Recall → Error Queue → Weekly Digest" },
        { k: "STATUS", v: "Accepted by Real End User" },
      ],
      problem:
        "Standard chat bots reset on every session. They forget recurring mistakes across weeks and leave learners without a structured review cadence.",
      architecture: [
        "Deployed an always-on agent runtime on a cloud Linux instance wired directly into a messaging channel with zero extra app install.",
        "Separated long-term memory and error-book records so historical weak points are retrieved before answering new questions.",
        "Scheduled automated weekly digests compiled into clean, print-ready A4 study sheets.",
        "Documented edge-case failures around session rotation and recall drift, hardening each path iteratively.",
      ],
      outcome:
        "Passed initial user acceptance in live daily study sessions, closing the full loop from spec alignment and server operations to real delivery.",
    },
    {
      id: "remote-agent-infra",
      motif: "pulsar",
      code: "002",
      year: "2026",
      status: "ACTIVE",
      eyebrow: "Encrypted Remote Operations",
      lead: "Control local dev machines from an iPad,",
      rest: "with end-to-end tunnels, graph memory, and silent diff alerts.",
      stack: ["Remote Web", "E2E Crypto", "Cron Diff", "Memory Graph", "Desktop Auto"],
      specs: [
        { k: "LINK", v: "Browser-Native · End-to-End Encrypted Relay" },
        { k: "BRIDGE", v: "Mobile Tablet ↔ Local Workstation" },
        { k: "SIGNAL", v: "Change-Only Notification Policy" },
      ],
      problem:
        "Heavy scripts and local agents live on a desktop workstation, leaving no clean way to inspect runs, steer tasks, or catch failures while away from the desk.",
      architecture: [
        "Configured an encrypted remote web bridge allowing full workstation session control directly inside a tablet browser.",
        "Built scheduled watchers that stay silent when idle and dispatch alerts only on meaningful state transitions.",
        "Maintained a local cross-project memory graph capturing environment quirks, commands, and past architecture decisions.",
        "Replaced brittle GUI clicking with direct filesystem and programmatic control paths wherever possible.",
      ],
      outcome:
        "Turned scattered local scripts into a cohesive remote-steerable workflow that holds up during daily engineering work.",
    },
    {
      id: "webcodecs-renderer",
      motif: "rings",
      code: "003",
      year: "2026",
      status: "PROTOTYPE",
      eyebrow: "Procedural Video Pipeline",
      lead: "Render motion pieces purely in code,",
      rest: "encoding frame-accurate Canvas scenes offline with WebCodecs.",
      stack: ["Canvas 2D", "WebCodecs API", "JavaScript", "Frame Timeline"],
      specs: [
        { k: "ENGINE", v: "100% In-Browser · Zero Server Cost" },
        { k: "PIPELINE", v: "Deterministic Frame Draw → Hardware Encode" },
        { k: "EDGE", v: "Edit One Parameter, Re-Export in Seconds" },
      ],
      problem:
        "Manual timeline editors make repetitive typography tweaks and kinetic pacing tedious—changing a single line forces dozens of keyframes to be rebuilt.",
      architecture: [
        "Expressed easing curves, typography reveals, and geometric choreography as pure deterministic functions of frame index.",
        "Rendered each frame directly onto an offscreen Canvas 2D surface, eliminating screen-capture blur and dropped frames.",
        "Fed raw video frames straight into the browser WebCodecs encoder to export crisp local video files.",
      ],
      outcome:
        "Proved a lightweight code-first alternative to timeline editors for technical promos and generative visuals.",
    },
  ],

  // ---------- 3. 当前动态（终端点线表）与工具栈 ----------
  now: [
    { code: "N.01", area: "FRONTEND", text: "Vanilla DOM/CSS rendering, ASCII graphics & React architecture", state: "IN PROGRESS" },
    { code: "N.02", area: "AGENTS", text: "Moving memory recall from prompt discipline to hard code hooks", state: "ACTIVE" },
    { code: "N.03", area: "SYSTEMS", text: "First-year engineering math, C++ separate compilation & tooling", state: "ONGOING" },
  ],

  stack: [
    { group: "LANGUAGES", items: ["HTML / CSS", "JavaScript", "Python", "C++"] },
    { group: "GRAPHICS & WEB", items: ["Canvas 2D", "WebCodecs", "ASCII Shaders", "Responsive Layout"] },
    { group: "AGENTS & OPS", items: ["Node.js", "Linux ECS", "MCP Servers", "Cron Pipelines", "Git"] },
  ],

  // ---------- 4. 联系与关于短文 ----------
  about: [
    "Engineering freshman at Tongji University. I learn by shipping things that break in real environments and fixing them until they stay up.",
    "Most of my time goes into autonomous agent tooling, small deterministic graphics experiments, and stripping unnecessary noise out of software.",
    "If you are building sharp tools, generative visuals, or agent systems—send a short note.",
  ],
};
