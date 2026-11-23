/**
 * Visual UI mockups encoded as SVG Data URLs for one-click testing
 * of the Nemotron 3.5 Super VL vision model.
 */

export interface SampleMockup {
  id: string;
  title: string;
  description: string;
  recommendedPrompt: string;
  dataUrl: string;
}

export const SAMPLE_MOCKUPS: SampleMockup[] = [
  {
    id: 'fintech-wallet',
    title: 'Fintech Neon Wallet',
    description: 'Dark cyber-fintech card with crypto balance, send/receive actions, and recent transaction list',
    recommendedPrompt: 'Build a high-end dark fintech crypto wallet app matching this exact visual design: neon gradient balance card ($42,850.20), quick send/receive/swap pills, and interactive transaction history with filter tabs.',
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520" fill="none">
  <rect width="400" height="520" rx="20" fill="#090d16"/>
  <!-- Header -->
  <text x="24" y="44" fill="#94a3b8" font-family="sans-serif" font-size="12" font-weight="600">TOTAL BALANCE</text>
  <text x="24" y="80" fill="#f8fafc" font-family="sans-serif" font-size="32" font-weight="bold">$42,850.20</text>
  <rect x="220" y="60" width="80" height="24" rx="12" fill="#065f46"/>
  <text x="232" y="76" fill="#34d399" font-family="sans-serif" font-size="12" font-weight="bold">+14.2% ↑</text>
  <!-- Credit Card -->
  <rect x="24" y="104" width="352" height="180" rx="16" fill="url(#grad1)"/>
  <text x="44" y="140" fill="#ffffff" font-family="sans-serif" font-size="16" font-weight="bold">StudioX Obsidian Card</text>
  <text x="44" y="200" fill="#cbd5e1" font-family="monospace" font-size="18" letter-spacing="3">•••• 8824</text>
  <text x="44" y="244" fill="#94a3b8" font-family="sans-serif" font-size="10">CARDHOLDER</text>
  <text x="44" y="260" fill="#ffffff" font-family="sans-serif" font-size="13" font-weight="bold">ALEX RIVERS</text>
  <text x="300" y="260" fill="#38bdf8" font-family="sans-serif" font-size="16" font-weight="black">VISA</text>
  <!-- Action Pills -->
  <rect x="24" y="304" width="105" height="42" rx="10" fill="#1e293b"/>
  <text x="48" y="330" fill="#38bdf8" font-family="sans-serif" font-size="13" font-weight="bold">↑ Send</text>
  <rect x="147" y="304" width="105" height="42" rx="10" fill="#1e293b"/>
  <text x="165" y="330" fill="#34d399" font-family="sans-serif" font-size="13" font-weight="bold">↓ Receive</text>
  <rect x="271" y="304" width="105" height="42" rx="10" fill="#1e293b"/>
  <text x="295" y="330" fill="#a855f7" font-family="sans-serif" font-size="13" font-weight="bold">⇄ Swap</text>
  <!-- Transactions -->
  <text x="24" y="380" fill="#e2e8f0" font-family="sans-serif" font-size="14" font-weight="bold">Recent Transactions</text>
  <rect x="24" y="400" width="352" height="48" rx="12" fill="#111827"/>
  <text x="40" y="428" fill="#f8fafc" font-family="sans-serif" font-size="13" font-weight="600">Apple Store Purchase</text>
  <text x="310" y="428" fill="#f87171" font-family="sans-serif" font-size="13" font-weight="bold">-$199.00</text>
  <rect x="24" y="456" width="352" height="48" rx="12" fill="#111827"/>
  <text x="40" y="484" fill="#f8fafc" font-family="sans-serif" font-size="13" font-weight="600">Ethereum Staking Reward</text>
  <text x="305" y="484" fill="#34d399" font-family="sans-serif" font-size="13" font-weight="bold">+$450.00</text>
  <defs>
    <linearGradient id="grad1" x1="0" y1="0" x2="352" y2="180" gradientUnits="userSpaceOnUse">
      <stop stop-color="#2563eb"/>
      <stop offset="0.5" stop-color="#4f46e5"/>
      <stop offset="1" stop-color="#9333ea"/>
    </linearGradient>
  </defs>
</svg>`)}`
  },
  {
    id: 'retro-synth-music',
    title: 'Cyberpunk Synth Audio Player',
    description: 'Neon synthwave audio station with rotating cassette, frequency visualizer, and track scrubber',
    recommendedPrompt: 'Build an interactive Cyberpunk Synthwave Music Player based on this visual mockup: glowing neon waveform, rotating audio disk, track scrubber with timer, volume slider, and sound mode selectors (Lofi, Synth, Cyber).',
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520" fill="none">
  <rect width="400" height="520" rx="20" fill="#0d0914"/>
  <!-- Track Visual Disk -->
  <circle cx="200" cy="150" r="85" fill="#1a1028" stroke="#ec4899" stroke-width="4"/>
  <circle cx="200" cy="150" r="55" fill="#2d1645" stroke="#8b5cf6" stroke-width="2"/>
  <circle cx="200" cy="150" r="16" fill="#0d0914"/>
  <!-- Track Info -->
  <text x="200" y="270" text-anchor="middle" fill="#f43f5e" font-family="sans-serif" font-size="18" font-weight="black">CYBER HORIZON 2099</text>
  <text x="200" y="294" text-anchor="middle" fill="#a855f7" font-family="sans-serif" font-size="13" font-weight="500">Kavinsky &amp; StudioX Soundlab</text>
  <!-- Scrubber -->
  <rect x="40" y="325" width="320" height="6" rx="3" fill="#271b3d"/>
  <rect x="40" y="325" width="180" height="6" rx="3" fill="url(#neonG)"/>
  <circle cx="220" cy="328" r="7" fill="#f43f5e"/>
  <text x="40" y="350" fill="#94a3b8" font-family="monospace" font-size="11">02:18</text>
  <text x="330" y="350" fill="#94a3b8" font-family="monospace" font-size="11">04:35</text>
  <!-- Equalizer Bars -->
  <rect x="60" y="375" width="8" height="30" rx="4" fill="#ec4899"/>
  <rect x="75" y="365" width="8" height="40" rx="4" fill="#a855f7"/>
  <rect x="90" y="380" width="8" height="25" rx="4" fill="#38bdf8"/>
  <rect x="105" y="360" width="8" height="45" rx="4" fill="#ec4899"/>
  <rect x="120" y="370" width="8" height="35" rx="4" fill="#34d399"/>
  <!-- Controls -->
  <circle cx="140" cy="450" r="22" fill="#1e162f"/>
  <text x="135" y="455" fill="#f8fafc" font-family="sans-serif" font-size="16">⏮</text>
  <circle cx="200" cy="450" r="32" fill="#ec4899"/>
  <text x="195" y="457" fill="#ffffff" font-family="sans-serif" font-size="20">▶</text>
  <circle cx="260" cy="450" r="22" fill="#1e162f"/>
  <text x="255" y="455" fill="#f8fafc" font-family="sans-serif" font-size="16">⏭</text>
  <defs>
    <linearGradient id="neonG" x1="40" y1="325" x2="220" y2="325" gradientUnits="userSpaceOnUse">
      <stop stop-color="#8b5cf6"/>
      <stop offset="1" stop-color="#ec4899"/>
    </linearGradient>
  </defs>
</svg>`)}`
  },
  {
    id: 'kanban-scrum',
    title: 'Agile Dev Sprint Board',
    description: 'Three-column project management board with priority tags, assignee avatars, and add task dialog',
    recommendedPrompt: 'Build an interactive Agile Sprint Kanban board following this layout: To Do, In Progress, and Review columns with drag-and-drop or column-moving cards, priority tags (Urgent, Medium), and quick card creator.',
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="520" viewBox="0 0 400 520" fill="none">
  <rect width="400" height="520" rx="20" fill="#0f172a"/>
  <!-- Top Bar -->
  <text x="24" y="38" fill="#f8fafc" font-family="sans-serif" font-size="16" font-weight="bold">Sprint 42: Core Engine</text>
  <rect x="290" y="20" width="86" height="28" rx="6" fill="#0284c7"/>
  <text x="305" y="38" fill="#ffffff" font-family="sans-serif" font-size="12" font-weight="bold">+ New Task</text>
  <!-- Column 1: To Do -->
  <rect x="20" y="66" width="112" height="430" rx="10" fill="#1e293b"/>
  <text x="30" y="88" fill="#94a3b8" font-family="sans-serif" font-size="11" font-weight="bold">TO DO (3)</text>
  <rect x="26" y="100" width="100" height="74" rx="8" fill="#0f172a" stroke="#334155"/>
  <rect x="34" y="108" width="42" height="14" rx="3" fill="#b91c1c"/>
  <text x="38" y="119" fill="#fecaca" font-family="sans-serif" font-size="9" font-weight="bold">URGENT</text>
  <text x="34" y="138" fill="#f1f5f9" font-family="sans-serif" font-size="10" font-weight="bold">OAuth Refresh</text>
  <!-- Column 2: In Progress -->
  <rect x="144" y="66" width="112" height="430" rx="10" fill="#1e293b"/>
  <text x="154" y="88" fill="#38bdf8" font-family="sans-serif" font-size="11" font-weight="bold">IN PROGRESS (2)</text>
  <rect x="150" y="100" width="100" height="84" rx="8" fill="#0f172a" stroke="#0284c7"/>
  <rect x="158" y="108" width="48" height="14" rx="3" fill="#0369a1"/>
  <text x="162" y="119" fill="#bae6fd" font-family="sans-serif" font-size="9" font-weight="bold">FEATURE</text>
  <text x="158" y="138" fill="#f1f5f9" font-family="sans-serif" font-size="10" font-weight="bold">Nemotron VL</text>
  <text x="158" y="152" fill="#94a3b8" font-family="sans-serif" font-size="9">Vision compiler</text>
  <!-- Column 3: Done -->
  <rect x="268" y="66" width="112" height="430" rx="10" fill="#1e293b"/>
  <text x="278" y="88" fill="#34d399" font-family="sans-serif" font-size="11" font-weight="bold">DONE (5)</text>
  <rect x="274" y="100" width="100" height="74" rx="8" fill="#0f172a" stroke="#065f46"/>
  <rect x="282" y="108" width="48" height="14" rx="3" fill="#047857"/>
  <text x="286" y="119" fill="#a7f3d0" font-family="sans-serif" font-size="9" font-weight="bold">VERIFIED</text>
  <text x="282" y="138" fill="#f1f5f9" font-family="sans-serif" font-size="10" font-weight="bold">ZIP Extractor</text>
</svg>`)}`
  }
];
