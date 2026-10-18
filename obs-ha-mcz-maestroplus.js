/*!
 * Obs HA MCZ Maestro+ – carte Home Assistant pour poêle à pellets MCZ (Maestro+)
 * Inspirée de « Thermostat Card – Bosch BTH-RA » (même thème, mêmes chevrons),
 * mais deux fois plus haute et dédiée à l'intégration https://github.com/Robbe-B/maestro_mcz
 *
 *  - en-tête : badge + nom + état | interrupteur Off ⇄ Chauffe
 *  - 3 cases : préréglage · ventilateur 1 · ventilateur 2
 *  - grande illustration de poêle (style icônes Home Assistant) animée selon l'état
 *  - température actuelle + consigne avec chevrons ▲ / ▼
 */

const CARD_VERSION = "1.1.0";
const CARD_TAG = "obs-ha-mcz-maestroplus";
const EDITOR_TAG = `${CARD_TAG}-editor`;

// --- Phases du poêle (déduites de hvac_mode + hvac_action) ----------------
const PHASES = {
  heating:     { color: "#e8958a", bg: "#48322f", icon: "mdi:fire" },
  preheating:  { color: "#e6b450", bg: "#463d29", icon: "mdi:fire-circle" },
  standby:     { color: "#7fcfc4", bg: "#27403d", icon: "mdi:sleep" },
  cooling:     { color: "#6fb1f0", bg: "#2b3b4c", icon: "mdi:fan" },
  off:         { color: "#9e9e9e", bg: "#333333", icon: "mdi:fire-off" },
  unavailable: { color: "#9e9e9e", bg: "#333333", icon: "mdi:fire-off" },
  alarm:       { color: "#ef6c6c", bg: "#4a2a2a", icon: "mdi:alert-circle" },
};

const PRESET_ICONS = {
  manual: "mdi:hand-back-right",
  auto: "mdi:autorenew",
  dynamic: "mdi:autorenew",
  overnight: "mdi:weather-night",
  comfort: "mdi:sofa",
  turbo: "mdi:rocket-launch",
  power: "mdi:rocket-launch",
  silent: "mdi:volume-off",
};

const I18N = {
  en: {
    preset: "Preset",
    fan1: "Fan 1",
    fan2: "Fan 2",
    power: "Stove on / off",
    settings: "Settings",
    notfound: "Entity not found",
    speed: "Speed",
    modes: "Mode",
    off: "Off",
    alarm: "Alarm",
    reset: "Reset",
    unavailable: "n/a",
    chips: {
      exhaust: "Exhaust temperature",
      water: "Water temperature",
      maintenance: "Next maintenance",
      power: "Manual power",
      eco: "Start & Stop (Eco)",
      timer: "Timer (schedule)",
    },
    short: { eco: "Eco", timer: "Timer", power: "Power" },
    phases: {
      heating: "Heating",
      preheating: "Igniting",
      standby: "Standby",
      cooling: "Shutting down",
      off: "Off",
      unavailable: "Unavailable",
      alarm: "Alarm",
    },
    presets: { manual: "Manual", auto: "Auto", dynamic: "Dynamic", overnight: "Night", comfort: "Comfort", turbo: "Turbo", power: "Power", silent: "Silent" },
  },
  fr: {
    preset: "Préréglage",
    fan1: "Ventilo 1",
    fan2: "Ventilo 2",
    power: "Poêle marche / arrêt",
    settings: "Réglages",
    notfound: "Entité introuvable",
    speed: "Vitesse",
    modes: "Mode",
    off: "Arrêt",
    alarm: "Alarme",
    reset: "Réinitialiser",
    unavailable: "indispo.",
    chips: {
      exhaust: "Température des fumées",
      water: "Température de l'eau",
      maintenance: "Prochain entretien",
      power: "Puissance manuelle",
      eco: "Start & Stop (Éco)",
      timer: "Chrono (programmation)",
    },
    short: { eco: "Éco", timer: "Chrono", power: "Puiss." },
    phases: {
      heating: "Chauffe en cours",
      preheating: "Allumage en cours",
      standby: "En veille",
      cooling: "Extinction en cours",
      off: "Éteint",
      unavailable: "Indisponible",
      alarm: "Alarme",
    },
    presets: { manual: "Manuel", auto: "Auto", dynamic: "Dynamique", overnight: "Nuit", comfort: "Confort", turbo: "Turbo", power: "Puissance", silent: "Silencieux" },
  },
};

// --- Entités annexes de l'intégration (détectées automatiquement) ---------
// Convention de nommage : <domaine>.<nom_du_poele>_<suffixe>. Sinon, recherche
// parmi les entités du même appareil d'après leur nom affiché.
const AUX = {
  fan1:         { domain: "fan",           suffix: ["fan_1"],                names: [/\bfan 1$/i, /ventilat\w* 1$/i] },
  fan2:         { domain: "fan",           suffix: ["fan_2"],                names: [/\bfan 2$/i, /ventilat\w* 2$/i] },
  power:        { domain: "select",        suffix: ["manual_power"],         names: [/manual power$/i, /puissance manuelle$/i] },
  eco:          { domain: "switch",        suffix: ["start_stop"],           names: [/start ?\/ ?stop$/i] },
  timer:        { domain: "switch",        suffix: ["timer"],                names: [/timer$/i, /chrono/i] },
  exhaust_temp: { domain: "sensor",        suffix: ["exhaust_temperature"],  names: [/exhaust temperature$/i, /fum[ée]es$/i] },
  water_temp:   { domain: "sensor",        suffix: ["water_temperature"],    names: [/water temperature$/i, /temp[ée]rature de l'eau$/i] },
  maintenance:  { domain: "sensor",        suffix: ["next_maintenance"],     names: [/next maintenance$/i, /prochain entretien$/i] },
  alarm:        { domain: "binary_sensor", suffix: ["alarm"],                names: [/\balarm$/i, /alarme$/i] },
  alarm_code:   { domain: "sensor",        suffix: ["last_alarm_code"],      names: [/last alarm code$/i] },
  alarm_reset:  { domain: "button",        suffix: ["alarm_reset"],          names: [/alarm reset$/i, /reset allarme$/i] },
};

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// Toujours une décimale (20.0), comme la carte Bosch
const fmtTemp = (v) => {
  if (v === null || v === undefined || isNaN(v)) return "--";
  return (Math.round(Number(v) * 10) / 10).toFixed(1);
};
const fmtInt = (v) => {
  if (v === null || v === undefined || v === "" || isNaN(v)) return "--";
  return String(Math.round(Number(v)));
};
const isBad = (s) => !s || s.state === "unavailable" || s.state === "unknown";

// --- Illustration : poêle à pellets type MCZ Mood (style icônes MDI) ------
const STOVE_SVG = `
<svg class="stove" viewBox="0 0 200 340" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <radialGradient id="obsGlow" cx="50%" cy="50%" r="50%">
      <stop offset="0" style="stop-color:var(--htc-accent)" stop-opacity=".85"/>
      <stop offset="1" style="stop-color:var(--htc-accent)" stop-opacity="0"/>
    </radialGradient>
    <clipPath id="obsGlassClip"><rect x="68" y="120" width="64" height="118" rx="6"/></clipPath>
  </defs>

  <!-- air chaud (animé quand le poêle souffle) -->
  <path class="wave w1" d="M78 30c-6-5 6-10 0-16"/>
  <path class="wave w2" d="M100 30c-6-5 6-10 0-16"/>
  <path class="wave w3" d="M122 30c-6-5 6-10 0-16"/>

  <!-- plateau (même diamètre que le corps) et corps cylindrique -->
  <rect class="ln" x="42" y="34" width="116" height="12" rx="6"/>
  <path class="ln body" d="M42 46h116v258a12 12 0 0 1-12 12H54a12 12 0 0 1-12-12Z"/>
  <path class="ln thin" d="M54 64v232"/>

  <!-- porte et poignée -->
  <rect class="ln" x="52" y="104" width="96" height="162" rx="9"/>
  <path class="ln" d="M141 163v44"/>

  <!-- vitre -->
  <rect class="ln glass" x="68" y="120" width="64" height="118" rx="6"/>
  <g clip-path="url(#obsGlassClip)">
    <ellipse class="glow" fill="url(#obsGlow)" cx="100" cy="212" rx="34" ry="40"/>
    <g class="flame-wrap">
      <g class="flame">
        <g transform="translate(100 232) scale(.55 1) translate(-150 -218)">
          <path class="f-out" d="M150 218C130 218 122 202 128 186C131 178 138 174 138 164C146 170 148 176 148 182C154 174 156 162 154 152C170 164 178 182 176 198C175 210 166 218 150 218Z"/>
          <path class="f-in" d="M150 218C140 218 136 210 140 202C143 196 148 194 150 188C156 194 160 202 158 209C157 215 154 218 150 218Z"/>
        </g>
      </g>
    </g>
    <rect class="ln-fill" x="84" y="232" width="32" height="6" rx="2"/>
  </g>

  <!-- pieds -->
  <rect class="ln-fill" x="58" y="318" width="16" height="8" rx="3"/>
  <rect class="ln-fill" x="126" y="318" width="16" height="8" rx="3"/>
</svg>`;

const STYLE = `
  :host { display: block; }
  ha-card {
    container-type: inline-size;
    padding: 24px 22px;
    background: var(--htc-card-bg, var(--ha-card-background, var(--card-background-color, #1c1c1c)));
    color: var(--primary-text-color, #fff);
    border-radius: var(--ha-card-border-radius, 24px);
    box-sizing: border-box;
    font-family: var(--paper-font-body1_-_font-family, Roboto, sans-serif);
    --htc-tile: var(--htc-tile-bg, var(--secondary-background-color, #2a2a2a));
    --htc-muted: var(--secondary-text-color, #8a8a8a);
    --htc-accent: #e8958a;
    --htc-accent-bg: #48322f;
  }
  .content { position: relative; }

  /* --- En-tête : badge + nom | interrupteur --------------------------- */
  .header { display: flex; justify-content: space-between; align-items: center; gap: 3cqw; }
  .id { display: flex; align-items: center; gap: 4cqw; min-width: 0; }
  .badge {
    flex: 0 0 auto; box-sizing: border-box;
    width: 15cqw; height: 15cqw; min-width: 40px; min-height: 40px; max-width: 56px; max-height: 56px;
    border-radius: 50%; background: var(--htc-accent); color: var(--htc-accent-bg);
    display: flex; align-items: center; justify-content: center;
    --mdc-icon-size: clamp(22px, 7.5cqw, 30px);
    transition: background .3s, color .3s;
  }
  .txt { min-width: 0; }
  .title {
    font-size: clamp(22px, 9cqw, 33px); font-weight: 500; line-height: 1.2;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .status { font-size: clamp(12px, 4cqw, 16px); font-weight: 500; color: var(--htc-muted); margin-top: 2px; }

  .right { display: flex; align-items: center; gap: 2cqw; flex: 0 0 auto; }
  .gear {
    background: none; border: none; color: var(--htc-muted); cursor: pointer;
    padding: 4px; border-radius: 50%; --mdc-icon-size: 24px; display: flex;
  }
  .gear:hover { color: var(--primary-text-color); }

  /* Interrupteur Off / Chauffe : sa couleur suit l'état (--htc-accent) */
  .switch {
    --sw-h: clamp(24px, 9cqw, 34px);
    --sw-w: calc(var(--sw-h) * 2);
    --knob: calc(var(--sw-h) - 10px);
    position: relative; flex: 0 0 auto; box-sizing: border-box; padding: 0; cursor: pointer;
    width: var(--sw-w); height: var(--sw-h); border-radius: 999px;
    border: 2px solid var(--htc-accent); background: var(--htc-accent-bg);
    transition: background .3s, border-color .3s;
  }
  .switch .knob {
    position: absolute; top: 3px; left: 3px; width: var(--knob); height: var(--knob);
    border-radius: 50%; background: var(--htc-accent);
    transition: transform .25s ease, background .3s;
  }
  .switch.on .knob { transform: translateX(calc(var(--sw-w) - 10px - var(--knob))); }
  .switch:disabled { opacity: .4; cursor: default; }
  .switch:focus-visible { outline: 2px solid var(--htc-accent); outline-offset: 3px; }

  /* --- 3 cases : préréglage · ventilo 1 · ventilo 2 -------------------- */
  .tiles { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2.6cqw; margin-top: 5cqw; }
  .tile {
    box-sizing: border-box; min-height: clamp(66px, 19cqw, 86px); padding: 6px 4px;
    border: none; border-radius: 18px; background: var(--htc-tile); color: var(--primary-text-color);
    font: inherit; cursor: pointer;
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
    --mdc-icon-size: clamp(22px, 7cqw, 30px);
    transition: filter .15s, background .2s, color .2s;
  }
  .tile:hover { filter: brightness(1.2); }
  .tile .tv { font-size: clamp(13px, 4.6cqw, 18px); font-weight: 500; line-height: 1.15; white-space: nowrap; }
  .tile .tv small { font-size: .72em; font-weight: 400; opacity: .7; }
  .tile .tl { font-size: clamp(10px, 3cqw, 12px); letter-spacing: .03em; color: var(--htc-muted); }
  .tile.active { background: var(--htc-accent-bg); color: var(--htc-accent); }
  .tile.active .tl { color: var(--htc-accent); opacity: .8; }
  .tile:disabled { opacity: .4; cursor: default; filter: none; }
  .tile ha-icon.spin { animation: obs-spin var(--spin, 2s) linear infinite; }
  @keyframes obs-spin { to { transform: rotate(360deg); } }

  /* --- Scène : grande illustration + pastilles ------------------------- */
  .stage { position: relative; margin-top: 3cqw; height: 66cqw; }
  .art { position: absolute; inset: 0; display: flex; justify-content: center; }
  .art svg, .art img { height: 100%; width: auto; max-width: none; object-fit: contain; }
  .art svg { aspect-ratio: 200 / 340; }

  .stove { color: var(--htc-stove, var(--primary-text-color)); overflow: visible; }
  .stove .ln { fill: none; stroke: currentColor; stroke-width: 5; stroke-linecap: round; stroke-linejoin: round; }
  .stove .ln-fill { fill: currentColor; opacity: .55; }
  .stove .thin { stroke-width: 3; opacity: .4; }
  .stove .body { fill: var(--htc-tile); }
  .stove .glass { fill: currentColor; fill-opacity: .05; }
  .stove .glow { opacity: 0; transition: opacity .6s; }
  .stove .flame-wrap { transform-box: fill-box; transform-origin: 50% 100%; opacity: 0; transform: scale(.5, .3); transition: transform .6s, opacity .6s; }
  .stove .flame { transform-box: fill-box; transform-origin: 50% 100%; }
  .stove .f-out { fill: var(--htc-accent); }
  .stove .f-in { fill: #ffe2b8; }
  .stove .wave { fill: none; stroke: var(--htc-accent); stroke-width: 4; stroke-linecap: round; opacity: 0; }

  .stage.p-heating .flame-wrap { opacity: 1; transform: scale(1); }
  .stage.p-heating .flame { animation: obs-flick 1.3s ease-in-out infinite; }
  .stage.p-heating .glow { opacity: .55; }
  .stage.p-preheating .flame-wrap { opacity: .9; transform: scale(.87, .48); }
  .stage.p-preheating .flame { animation: obs-pulse 2s ease-in-out infinite; }
  .stage.p-preheating .glow { opacity: .3; }
  .stage.p-standby .flame-wrap { opacity: .55; transform: scale(.7, .3); }
  .stage.p-standby .glow { opacity: .12; }
  .stage.air .wave { animation: obs-rise 2.4s ease-in-out infinite; }
  .stage.air .w2 { animation-delay: .6s; }
  .stage.air .w3 { animation-delay: 1.2s; }
  @keyframes obs-flick {
    0%, 100% { transform: scale(1, 1) skewX(0); }
    25% { transform: scale(.96, 1.05) skewX(-2deg); }
    50% { transform: scale(1.03, .97) skewX(1.5deg); }
    75% { transform: scale(.98, 1.04) skewX(-1deg); }
  }
  @keyframes obs-pulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
  @keyframes obs-rise {
    0% { opacity: 0; transform: translateY(8px); }
    40% { opacity: .85; }
    100% { opacity: 0; transform: translateY(-10px); }
  }
  @media (prefers-reduced-motion: reduce) {
    .stage .flame, .stage .wave, .tile ha-icon.spin { animation: none !important; }
  }

  .chips { position: absolute; top: 50%; transform: translateY(-50%); display: flex; flex-direction: column; gap: 2cqw; z-index: 2; }
  .chips.l { left: 0; align-items: flex-start; }
  .chips.r { right: 0; align-items: flex-end; }
  .chip {
    box-sizing: border-box; max-width: 28cqw; padding: 5px 10px 5px 8px; border: none; border-radius: 14px;
    background: var(--htc-tile); color: var(--primary-text-color); font: inherit;
    font-size: clamp(11px, 3.6cqw, 14px); font-weight: 500; line-height: 1.2; white-space: nowrap;
    display: flex; align-items: center; gap: 4px; --mdc-icon-size: clamp(16px, 4.8cqw, 20px);
    overflow: hidden; text-overflow: ellipsis; transition: background .2s, color .2s;
  }
  .chip ha-icon { color: var(--htc-muted); flex: 0 0 auto; }
  button.chip { cursor: pointer; }
  button.chip:hover { filter: brightness(1.2); }
  .chip.on { background: var(--htc-accent-bg); color: var(--htc-accent); }
  .chip.on ha-icon { color: var(--htc-accent); }
  .chip.warn { color: #e6b450; }
  .chip.warn ha-icon { color: #e6b450; }
  .chip:disabled { opacity: .4; cursor: default; }

  .alarm {
    position: absolute; top: 0; left: 0; right: 0; z-index: 3; box-sizing: border-box;
    display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 14px;
    background: #4a2a2a; color: #ef6c6c; font-size: clamp(12px, 3.8cqw, 15px); font-weight: 500;
    --mdc-icon-size: 22px;
  }
  .alarm .atxt { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .alarm button {
    border: 1px solid currentColor; background: none; color: inherit; font: inherit; font-size: .9em;
    padding: 3px 10px; border-radius: 999px; cursor: pointer;
  }

  /* --- Corps : température actuelle | consigne (identique à la carte Bosch) */
  .main { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 3cqw; margin-top: 3cqw; }
  .current {
    display: flex; align-items: center; gap: 3cqw; min-width: 0; white-space: nowrap;
    color: var(--htc-accent); transition: color .3s;
  }
  .current .thermo { color: var(--htc-muted); --mdc-icon-size: clamp(35px, 12.2cqw, 53px); flex: 0 0 auto; }
  .current .num { font-size: 17.5cqw; font-weight: 400; line-height: 1; letter-spacing: -0.02em; }
  .current .unit { align-self: flex-start; margin-top: 1.2cqw; font-size: 7.7cqw; font-weight: 400; line-height: 1; }

  .targets { display: flex; align-items: stretch; gap: 2cqw; }
  .target { display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 24cqw; }
  .arrow {
    box-sizing: border-box; width: 20cqw; height: 18cqw; max-width: 84px; max-height: 72px; min-width: 52px; min-height: 48px;
    padding: 0; border: none; border-radius: 14px; background: none;
    color: var(--primary-text-color); cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    --mdc-icon-size: clamp(40px, 15cqw, 60px);
    transition: background .15s, transform .1s;
  }
  .arrow:hover { background: var(--htc-tile); }
  .arrow:active { transform: scale(0.92); }
  .arrow:disabled { opacity: .35; cursor: default; background: none; transform: none; }
  .target .val {
    display: flex; align-items: flex-start; gap: 2px; padding: 1.5cqw 0;
    font-size: clamp(22px, 9.5cqw, 34px); font-weight: 500; line-height: 1.2; white-space: nowrap;
  }
  .target .val small { font-size: 0.62em; font-weight: 400; color: var(--htc-muted); margin-top: 0.05em; }

  /* --- Menu déroulant (préréglage, ventilos, puissance) ---------------- */
  .menu {
    position: absolute; z-index: 10; box-sizing: border-box; min-width: 46cqw; max-width: 94cqw; padding: 8px;
    background: var(--htc-menu-bg, var(--ha-card-background, var(--card-background-color, #222)));
    border: 1px solid var(--divider-color, rgba(255,255,255,.12));
    border-radius: 18px; box-shadow: 0 10px 28px rgba(0, 0, 0, .5);
  }
  .menu .mt { font-size: 12px; letter-spacing: .04em; color: var(--htc-muted); padding: 2px 8px 8px; }
  .menu .mi {
    display: flex; align-items: center; gap: 10px; width: 100%; box-sizing: border-box; padding: 10px 12px;
    border: none; border-radius: 12px; background: none; color: var(--primary-text-color);
    font: inherit; font-size: 15px; text-align: left; cursor: pointer; --mdc-icon-size: 22px;
  }
  .menu .mi:hover { background: var(--htc-tile); }
  .menu .mi.active { background: var(--htc-accent-bg); color: var(--htc-accent); }
  .menu .speeds { display: grid; grid-template-columns: repeat(var(--n, 5), 1fr); gap: 6px; margin: 0 0 6px; }
  .menu .sp {
    height: 44px; border: none; border-radius: 12px; background: var(--htc-tile); color: var(--primary-text-color);
    font: inherit; font-size: 16px; font-weight: 500; cursor: pointer;
  }
  .menu .sp:hover { filter: brightness(1.25); }
  .menu .sp.active { background: var(--htc-accent); color: var(--htc-accent-bg); }

  .error { padding: 16px; color: var(--error-color, #db4437); }
  [hidden] { display: none !important; }
`;

class ObsHaMczMaestroPlusCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._pending = {};
    this._built = false;
    this._cache = {};
    this._res = {};
    this._menu = null;
  }

  connectedCallback() {
    this._docClick = (e) => {
      if (this._menu && !e.composedPath().includes(this)) this._closeMenu();
    };
    document.addEventListener("click", this._docClick);
  }

  disconnectedCallback() {
    document.removeEventListener("click", this._docClick);
    clearTimeout(this._sendTimer);
    clearTimeout(this._clearTimer);
  }

  static getConfigElement() {
    return document.createElement(EDITOR_TAG);
  }

  static getStubConfig(hass) {
    const ids = hass ? Object.keys(hass.states).filter((id) => id.startsWith("climate.")) : [];
    const entity = ids.find((id) => hass.states[id].attributes.preset_modes) || ids[0];
    return { entity: entity || "climate.poele" };
  }

  setConfig(config) {
    if (!config || !config.entity) throw new Error("Veuillez définir une entité `entity` (climate.xxx).");
    this._config = {
      show_status: true,
      show_settings: false,
      show_chips: true,
      ...config,
    };
    this._res = {};
    this._menu = null;
    this._build();
    this._update();
  }

  set hass(hass) {
    this._hass = hass;
    this._update();
  }

  // Deux fois la hauteur de la carte Bosch BTH-RA (4 lignes → 8 lignes)
  getCardSize() {
    return 8;
  }

  getGridOptions() {
    return { columns: 6, rows: 8, min_columns: 4, min_rows: 6 };
  }

  get _t() {
    const lang = ((this._hass && this._hass.language) || "en").slice(0, 2);
    return I18N[lang] || I18N.en;
  }

  _build() {
    this.shadowRoot.innerHTML = `
      <style>${STYLE}</style>
      <ha-card>
        <div class="error" hidden></div>
        <div class="content">
          <div class="header">
            <div class="id">
              <div class="badge"><ha-icon icon="mdi:fire"></ha-icon></div>
              <div class="txt">
                <div class="title"></div>
                <div class="status"></div>
              </div>
            </div>
            <div class="right">
              <button class="gear" data-act="more-info" aria-label="Settings"><ha-icon icon="mdi:cog"></ha-icon></button>
              <button class="switch" role="switch" aria-checked="false" data-act="toggle"><span class="knob"></span></button>
            </div>
          </div>
          <div class="tiles"></div>
          <div class="stage">
            <div class="art"></div>
            <div class="alarm" hidden></div>
            <div class="chips l"></div>
            <div class="chips r"></div>
          </div>
          <div class="main">
            <div class="current">
              <ha-icon class="thermo" icon="mdi:thermometer"></ha-icon>
              <span class="num"></span><span class="unit"></span>
            </div>
            <div class="targets"></div>
          </div>
          <div class="menu" hidden></div>
        </div>
      </ha-card>`;
    const r = this.shadowRoot;
    this._els = {
      error: r.querySelector(".error"),
      content: r.querySelector(".content"),
      card: r.querySelector("ha-card"),
      badgeIcon: r.querySelector(".badge ha-icon"),
      title: r.querySelector(".title"),
      status: r.querySelector(".status"),
      gear: r.querySelector(".gear"),
      sw: r.querySelector(".switch"),
      tiles: r.querySelector(".tiles"),
      stage: r.querySelector(".stage"),
      art: r.querySelector(".art"),
      alarm: r.querySelector(".alarm"),
      chipsL: r.querySelector(".chips.l"),
      chipsR: r.querySelector(".chips.r"),
      main: r.querySelector(".main"),
      num: r.querySelector(".num"),
      unit: r.querySelector(".unit"),
      targets: r.querySelector(".targets"),
      menu: r.querySelector(".menu"),
    };
    r.addEventListener("click", (e) => this._onClick(e));
    this._cache = {};
    this._built = true;
  }

  // --- interactions ----------------------------------------------------

  _onClick(e) {
    const el = e.target.closest("[data-act]");
    const keepOpen = el && (el.dataset.act === "open" || el.closest(".menu"));
    if (!keepOpen) this._closeMenu();
    if (!el || el.disabled) return;
    const act = el.dataset.act;
    if (act === "more-info") {
      this.dispatchEvent(
        new CustomEvent("hass-more-info", { bubbles: true, composed: true, detail: { entityId: this._config.entity } })
      );
    } else if (act === "toggle") {
      this._toggle();
    } else if (act === "inc" || act === "dec") {
      this._step(act === "inc" ? 1 : -1);
    } else if (act === "open") {
      this._menu = this._menu === el.dataset.menu ? null : el.dataset.menu;
      this._renderMenu();
    } else if (act === "pick") {
      this._pick(el.dataset.menu, el.dataset.kind, el.dataset.v);
    } else if (act === "aux") {
      const id = this._ent(el.dataset.key);
      if (id) this._hass.callService("switch", "toggle", { entity_id: id });
    } else if (act === "reset") {
      const id = this._ent("alarm_reset");
      if (id) this._hass.callService("button", "press", { entity_id: id });
    }
  }

  _closeMenu() {
    if (!this._menu) return;
    this._menu = null;
    this._renderMenu();
  }

  _pick(menu, kind, v) {
    const h = this._hass;
    if (menu === "preset") {
      h.callService("climate", "set_preset_mode", { entity_id: this._config.entity, preset_mode: v });
    } else if (menu === "power") {
      const id = this._ent("power");
      if (id) h.callService("select", "select_option", { entity_id: id, option: v });
    } else {
      const id = this._ent(menu);
      const info = this._fanInfo(id);
      if (!id || !info) return;
      if (kind === "level") {
        // même formule que Home Assistant : ranged_value_to_percentage((1, n), niveau)
        h.callService("fan", "set_percentage", { entity_id: id, percentage: Math.floor((Number(v) * 100) / info.n) });
      } else if (kind === "preset") {
        h.callService("fan", "set_preset_mode", { entity_id: id, preset_mode: v });
      } else if (kind === "off") {
        h.callService("fan", "turn_off", { entity_id: id });
      }
    }
    this._closeMenu();
  }

  // Interrupteur : Off ⇄ mode de chauffe (`heat` par défaut, option `heat_mode`)
  _toggle() {
    const s = this._stateObj;
    if (!s) return;
    const supported = s.attributes.hvac_modes || [];
    let target;
    if (s.state === "off") {
      const wanted = this._config.heat_mode || "heat";
      target = supported.includes(wanted) ? wanted : supported.find((m) => m !== "off");
    } else {
      target = "off";
    }
    if (!target) return;
    this._hass.callService("climate", "set_hvac_mode", { entity_id: this._config.entity, hvac_mode: target });
  }

  _step(dir) {
    const s = this._stateObj;
    if (!s) return;
    const a = s.attributes;
    const unit = this._hass.config.unit_system.temperature;
    const step = this._stepSize(a, unit);
    let v = this._val("temperature");
    if (v == null) return;
    v = Number((Math.round(v / step) * step + dir * step).toFixed(2));
    const min = a.min_temp != null ? a.min_temp : -Infinity;
    const max = a.max_temp != null ? a.max_temp : Infinity;
    v = Math.min(max, Math.max(min, v));
    this._pending.temperature = v;
    this._renderTargets(s);
    clearTimeout(this._sendTimer);
    this._sendTimer = setTimeout(() => this._send(), 900);
  }

  _send() {
    const s = this._stateObj;
    if (!s) return;
    this._hass.callService("climate", "set_temperature", {
      entity_id: this._config.entity,
      temperature: this._val("temperature"),
    });
    clearTimeout(this._clearTimer);
    this._clearTimer = setTimeout(() => {
      this._pending = {};
      this._update();
    }, 5000);
  }

  // --- données ---------------------------------------------------------

  get _stateObj() {
    return this._hass && this._hass.states[this._config.entity];
  }

  _st(id) {
    return id && this._hass ? this._hass.states[id] : undefined;
  }

  _stepSize(a, unit) {
    if (this._config.step) return Number(this._config.step);
    if (a.target_temp_step) return Number(a.target_temp_step);
    return unit === "°F" ? 1 : 0.5;
  }

  _val(key) {
    const s = this._stateObj;
    if (this._pending[key] !== undefined) return this._pending[key];
    return s ? s.attributes[key] : undefined;
  }

  // Retrouve une entité annexe : option YAML > convention de nom > même appareil
  _ent(key) {
    const c = this._config;
    const h = this._hass;
    if (!h || c[key] === false) return null;
    if (typeof c[key] === "string" && c[key]) return h.states[c[key]] ? c[key] : null;
    const hit = this._res[key];
    if (hit) {
      if (hit.id && h.states[hit.id]) return hit.id;
      if (!hit.id && Date.now() - hit.t < 60000) return null;
    }
    const id = this._discover(key);
    this._res[key] = { id, t: Date.now() };
    return id;
  }

  _discover(key) {
    const spec = AUX[key];
    const h = this._hass;
    if (!spec) return null;
    const base = this._config.entity.split(".")[1];
    for (const sfx of spec.suffix) {
      const id = `${spec.domain}.${base}_${sfx}`;
      if (h.states[id]) return id;
    }
    const reg = h.entities && h.entities[this._config.entity];
    const dev = reg && reg.device_id;
    if (dev) {
      for (const [id, e] of Object.entries(h.entities)) {
        if (e.device_id !== dev || !id.startsWith(spec.domain + ".")) continue;
        const st = h.states[id];
        const name = (st && st.attributes.friendly_name) || "";
        if (spec.names.some((r) => r.test(name))) return id;
      }
    }
    return null;
  }

  // Phase du poêle d'après hvac_mode (état) et hvac_action
  _phase(s) {
    if (s.state === "unavailable" || s.state === "unknown") return "unavailable";
    const alarmId = this._ent("alarm");
    const alarm = alarmId && this._st(alarmId);
    if (alarm && alarm.state === "on") return "alarm";
    const act = s.attributes.hvac_action;
    if (s.state === "off") return act === "idle" ? "cooling" : "off";
    if (act === "preheating") return "preheating";
    if (act === "idle") return "standby";
    return "heating";
  }

  _fanInfo(id) {
    const s = this._st(id);
    if (!s) return null;
    const a = s.attributes;
    const step = Number(a.percentage_step) || 0;
    const n = step ? Math.max(1, Math.round(100 / step)) : 0;
    const pct = a.percentage;
    const level = pct != null && n ? Math.ceil((pct * n) / 100) : null;
    return {
      id,
      n,
      level,
      preset: a.preset_mode || null,
      presets: Array.isArray(a.preset_modes) ? a.preset_modes : [],
      unavailable: s.state === "unavailable",
      on: s.state === "on",
    };
  }

  _presetLabel(p) {
    if (p == null) return "--";
    const t = this._t.presets[p];
    if (t) return t;
    const s = String(p).replace(/_/g, " ");
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // --- rendu -----------------------------------------------------------

  _setText(el, key, value) {
    if (this._cache[key] !== value) {
      el.textContent = value;
      this._cache[key] = value;
    }
  }

  _setHtml(el, key, html) {
    if (this._cache[key] !== html) {
      el.innerHTML = html;
      this._cache[key] = html;
    }
  }

  _update() {
    if (!this._built || !this._hass) return;
    const E = this._els;
    const t = this._t;
    const s = this._stateObj;
    if (!s) {
      E.error.hidden = false;
      E.content.hidden = true;
      E.error.textContent = `${t.notfound}: ${this._config.entity}`;
      return;
    }
    E.error.hidden = true;
    E.content.hidden = false;

    const a = s.attributes;
    const unit = this._hass.config.unit_system.temperature;
    const phase = this._phase(s);
    const P = PHASES[phase];
    const unavailable = phase === "unavailable";
    const on = !unavailable && s.state !== "off";

    for (const k of Object.keys(this._pending)) {
      if (a[k] === this._pending[k]) delete this._pending[k];
    }

    // En-tête
    this._setText(E.title, "title", this._config.name || a.friendly_name || this._config.entity);
    const status = this._config.show_status ? t.phases[phase] : "";
    E.status.hidden = !status;
    this._setText(E.status, "status", status);
    E.gear.hidden = !this._config.show_settings;
    E.gear.setAttribute("aria-label", t.settings);

    // Couleurs selon la phase
    E.card.style.setProperty("--htc-accent", P.color);
    E.card.style.setProperty("--htc-accent-bg", P.bg);

    // Badge + interrupteur
    const icon = this._config.icon || P.icon;
    if (this._cache.badge !== icon) {
      E.badgeIcon.setAttribute("icon", icon);
      this._cache.badge = icon;
    }
    E.sw.classList.toggle("on", on);
    E.sw.setAttribute("aria-checked", String(on));
    E.sw.setAttribute("aria-label", t.power);
    E.sw.disabled = unavailable;

    // Température actuelle
    this._setText(E.num, "cur", fmtTemp(a.current_temperature));
    this._setText(E.unit, "unit", unit);

    const f1 = this._fanInfo(this._ent("fan1"));
    const f2 = this._fanInfo(this._ent("fan2"));

    this._renderTiles(s, f1, f2, unavailable);
    this._renderStage(phase, f1, f2);
    this._renderTargets(s);
    this._renderAlarm(phase);
    this._renderMenu();
  }

  _renderTiles(s, f1, f2, unavailable) {
    const t = this._t;
    const a = s.attributes;
    const tiles = [];

    // 1) préréglage
    const pm = a.preset_mode;
    const hasPresets = Array.isArray(a.preset_modes) && a.preset_modes.length > 0;
    tiles.push(`
      <button class="tile ${pm && !unavailable ? "active" : ""}" data-act="open" data-menu="preset" data-anchor="preset" ${!hasPresets || unavailable ? "disabled" : ""}>
        <ha-icon icon="${PRESET_ICONS[pm] || "mdi:thermostat-cog"}"></ha-icon>
        <div class="tv">${esc(this._presetLabel(pm))}</div>
        <div class="tl">${esc(t.preset)}</div>
      </button>`);

    // 2) et 3) ventilateurs
    [
      ["fan1", f1, t.fan1],
      ["fan2", f2, t.fan2],
    ].forEach(([key, f, label]) => {
      let value = "--";
      let active = false;
      let spin = "";
      if (f) {
        if (f.unavailable) {
          value = esc(t.unavailable);
        } else if (f.level != null) {
          value = `${f.level}<small>/${f.n}</small>`;
        } else if (f.preset) {
          value = esc(this._presetLabel(f.preset));
        } else {
          value = esc(f.on ? "On" : t.off);
        }
        active = f.on && !f.unavailable;
        if (active) {
          const ratio = f.level != null && f.n ? f.level / f.n : 0.6;
          spin = `style="--spin:${(2.6 - ratio * 2.1).toFixed(2)}s"`;
        }
      }
      tiles.push(`
        <button class="tile ${active ? "active" : ""}" data-act="open" data-menu="${key}" data-anchor="${key}" ${!f || f.unavailable ? "disabled" : ""}>
          <ha-icon class="${active ? "spin" : ""}" ${spin} icon="${f && f.unavailable ? "mdi:fan-off" : "mdi:fan"}"></ha-icon>
          <div class="tv">${value}</div>
          <div class="tl">${esc(label)}</div>
        </button>`);
    });

    this._setHtml(this._els.tiles, "tiles", tiles.join(""));
  }

  _renderStage(phase, f1, f2) {
    const E = this._els;
    const air = phase === "heating" && ((f1 && f1.on) || (f2 && f2.on));
    E.stage.className = `stage p-${phase}${air ? " air" : ""}`;

    const art = this._config.image
      ? `<img src="${esc(this._config.image)}" alt="">`
      : STOVE_SVG;
    this._setHtml(E.art, "art", art);

    if (!this._config.show_chips) {
      E.chipsL.hidden = true;
      E.chipsR.hidden = true;
      return;
    }
    E.chipsL.hidden = false;
    E.chipsR.hidden = false;
    const t = this._t;
    const left = [];
    const right = [];

    const exh = this._st(this._ent("exhaust_temp"));
    if (exh) {
      const u = exh.attributes.unit_of_measurement || "°C";
      left.push(`<div class="chip" title="${esc(t.chips.exhaust)}"><ha-icon icon="mdi:thermometer-lines"></ha-icon>${isBad(exh) ? "--" : esc(fmtInt(exh.state))} ${esc(u)}</div>`);
    }
    const wat = this._st(this._ent("water_temp"));
    if (wat && !isBad(wat)) {
      const u = wat.attributes.unit_of_measurement || "°C";
      left.push(`<div class="chip" title="${esc(t.chips.water)}"><ha-icon icon="mdi:water-thermometer"></ha-icon>${esc(fmtInt(wat.state))} ${esc(u)}</div>`);
    }
    const mnt = this._st(this._ent("maintenance"));
    if (mnt) {
      const v = Number(mnt.state);
      const warn = !isBad(mnt) && v <= 20;
      left.push(`<div class="chip ${warn ? "warn" : ""}" title="${esc(t.chips.maintenance)}"><ha-icon icon="mdi:wrench-clock"></ha-icon>${isBad(mnt) ? "--" : esc(fmtInt(v))} h</div>`);
    }

    const pot = this._st(this._ent("power"));
    if (pot) {
      right.push(`<button class="chip" data-act="open" data-menu="power" data-anchor="power" title="${esc(t.chips.power)}" ${isBad(pot) ? "disabled" : ""}><ha-icon icon="mdi:fire"></ha-icon>${esc(t.short.power)} ${isBad(pot) ? "--" : esc(pot.state)}</button>`);
    }
    [
      ["eco", "mdi:leaf"],
      ["timer", "mdi:timer-outline"],
    ].forEach(([key, ic]) => {
      const sw = this._st(this._ent(key));
      if (!sw) return;
      right.push(`<button class="chip ${sw.state === "on" ? "on" : ""}" data-act="aux" data-key="${key}" title="${esc(t.chips[key])}" ${isBad(sw) ? "disabled" : ""}><ha-icon icon="${ic}"></ha-icon>${esc(t.short[key])}</button>`);
    });

    this._setHtml(E.chipsL, "chipsL", left.join(""));
    this._setHtml(E.chipsR, "chipsR", right.join(""));
  }

  _renderAlarm(phase) {
    const E = this._els;
    if (phase !== "alarm") {
      E.alarm.hidden = true;
      this._cache.alarm = null;
      return;
    }
    const t = this._t;
    const codeSt = this._st(this._ent("alarm_code"));
    const code = codeSt && !isBad(codeSt) && codeSt.state !== "0" ? ` · ${codeSt.state}` : "";
    const canReset = !!this._ent("alarm_reset");
    E.alarm.hidden = false;
    this._setHtml(
      E.alarm,
      "alarm",
      `<ha-icon icon="mdi:alert"></ha-icon><span class="atxt">${esc(t.alarm)}${esc(code)}</span>${
        canReset ? `<button data-act="reset">${esc(t.reset)}</button>` : ""
      }`
    );
  }

  _renderTargets(s) {
    const unit = this._hass.config.unit_system.temperature;
    const off = s.state === "off" || s.state === "unavailable" || s.state === "unknown";
    const v = off ? null : this._val("temperature");
    const dis = off || v == null ? "disabled" : "";
    const value = v == null ? "--" : `${fmtTemp(v)}<small>${esc(unit)}</small>`;
    const html = `<div class="target">
      <button class="arrow" data-act="inc" ${dis} aria-label="+"><ha-icon icon="mdi:chevron-up"></ha-icon></button>
      <div class="val">${value}</div>
      <button class="arrow" data-act="dec" ${dis} aria-label="-"><ha-icon icon="mdi:chevron-down"></ha-icon></button>
    </div>`;
    this._setHtml(this._els.targets, "targets", html);
  }

  // --- menu déroulant --------------------------------------------------

  _menuHtml() {
    const t = this._t;
    const m = this._menu;
    if (m === "preset") {
      const s = this._stateObj;
      if (!s) return "";
      const cur = s.attributes.preset_mode;
      const items = (s.attributes.preset_modes || [])
        .map(
          (p) => `<button class="mi ${p === cur ? "active" : ""}" data-act="pick" data-menu="preset" data-kind="preset" data-v="${esc(p)}">
            <ha-icon icon="${PRESET_ICONS[p] || "mdi:thermostat-cog"}"></ha-icon>${esc(this._presetLabel(p))}</button>`
        )
        .join("");
      return `<div class="mt">${esc(t.preset.toUpperCase())}</div>${items}`;
    }
    if (m === "power") {
      const s = this._st(this._ent("power"));
      if (!s) return "";
      const items = (s.attributes.options || [])
        .map(
          (o) => `<button class="mi ${o === s.state ? "active" : ""}" data-act="pick" data-menu="power" data-kind="option" data-v="${esc(o)}">
            <ha-icon icon="mdi:fire"></ha-icon>${esc(t.chips.power)} ${esc(o)}</button>`
        )
        .join("");
      return `<div class="mt">${esc(t.chips.power.toUpperCase())}</div>${items}`;
    }
    if (m === "fan1" || m === "fan2") {
      const f = this._fanInfo(this._ent(m));
      if (!f) return "";
      let html = `<div class="mt">${esc((m === "fan1" ? t.fan1 : t.fan2).toUpperCase())}</div>`;
      if (f.n > 1) {
        const speeds = [];
        for (let i = 1; i <= f.n; i++) {
          speeds.push(`<button class="sp ${f.level === i ? "active" : ""}" data-act="pick" data-menu="${m}" data-kind="level" data-v="${i}">${i}</button>`);
        }
        html += `<div class="speeds" style="--n:${Math.min(f.n, 6)}">${speeds.join("")}</div>`;
      }
      html += f.presets
        .map(
          (p) => `<button class="mi ${f.preset === p && f.level == null ? "active" : ""}" data-act="pick" data-menu="${m}" data-kind="preset" data-v="${esc(p)}">
            <ha-icon icon="${PRESET_ICONS[p] || "mdi:fan-auto"}"></ha-icon>${esc(this._presetLabel(p))}</button>`
        )
        .join("");
      html += `<button class="mi ${!f.on ? "active" : ""}" data-act="pick" data-menu="${m}" data-kind="off" data-v="0"><ha-icon icon="mdi:fan-off"></ha-icon>${esc(t.off)}</button>`;
      return html;
    }
    return "";
  }

  _renderMenu() {
    if (!this._built) return;
    const E = this._els;
    const anchor = this._menu ? this.shadowRoot.querySelector(`[data-anchor="${this._menu}"]`) : null;
    const html = anchor ? this._menuHtml() : "";
    if (!anchor || !html) {
      this._menu = null;
      E.menu.hidden = true;
      this._cache.menu = null;
      return;
    }
    E.menu.hidden = false;
    this._setHtml(E.menu, "menu", html);
    E.menu.style.left = "0px";
    E.menu.style.top = "0px";
    const cr = E.content.getBoundingClientRect();
    const ar = anchor.getBoundingClientRect();
    const mw = E.menu.offsetWidth;
    const mh = E.menu.offsetHeight;
    let left = ar.left - cr.left + ar.width / 2 - mw / 2;
    left = Math.max(0, Math.min(left, cr.width - mw));
    let top = ar.bottom - cr.top + 6;
    if (top + mh > cr.height) top = Math.max(0, ar.top - cr.top - mh - 6);
    E.menu.style.left = `${left}px`;
    E.menu.style.top = `${top}px`;
  }
}

// --- Éditeur visuel ------------------------------------------------------

const ENTITY_FIELDS = [
  { name: "fan1", selector: { entity: { domain: "fan" } } },
  { name: "fan2", selector: { entity: { domain: "fan" } } },
  { name: "power", selector: { entity: { domain: "select" } } },
  { name: "eco", selector: { entity: { domain: "switch" } } },
  { name: "timer", selector: { entity: { domain: "switch" } } },
  { name: "exhaust_temp", selector: { entity: { domain: "sensor" } } },
  { name: "water_temp", selector: { entity: { domain: "sensor" } } },
  { name: "maintenance", selector: { entity: { domain: "sensor" } } },
  { name: "alarm", selector: { entity: { domain: "binary_sensor" } } },
  { name: "alarm_code", selector: { entity: { domain: "sensor" } } },
  { name: "alarm_reset", selector: { entity: { domain: "button" } } },
];

const EDITOR_SCHEMA = [
  { name: "entity", required: true, selector: { entity: { domain: "climate" } } },
  { name: "name", selector: { text: {} } },
  { name: "icon", selector: { icon: {} } },
  { name: "image", selector: { text: {} } },
  { name: "step", selector: { number: { min: 0.1, max: 5, step: 0.1, mode: "box" } } },
  { name: "show_status", selector: { boolean: {} } },
  { name: "show_chips", selector: { boolean: {} } },
  { name: "show_settings", selector: { boolean: {} } },
  {
    type: "expandable",
    name: "",
    title: "Entités annexes (détectées automatiquement si vide)",
    schema: ENTITY_FIELDS,
  },
];

const EDITOR_LABELS = {
  entity: "Entité du poêle (climate)",
  name: "Nom (optionnel)",
  icon: "Icône du badge (optionnel)",
  image: "Image personnalisée à la place du dessin (URL, optionnel)",
  step: "Pas de température (optionnel)",
  show_status: "Afficher l'état sous le nom",
  show_chips: "Afficher les pastilles autour du poêle",
  show_settings: "Afficher l'icône réglages",
  fan1: "Ventilateur 1 (fan)",
  fan2: "Ventilateur 2 (fan)",
  power: "Puissance manuelle (select)",
  eco: "Start & Stop / Éco (switch)",
  timer: "Chrono (switch)",
  exhaust_temp: "Température des fumées (sensor)",
  water_temp: "Température de l'eau (sensor)",
  maintenance: "Prochain entretien (sensor, heures)",
  alarm: "Alarme (binary_sensor)",
  alarm_code: "Dernier code d'alarme (sensor)",
  alarm_reset: "Réinitialisation d'alarme (button)",
};

class ObsHaMczMaestroPlusCardEditor extends HTMLElement {
  setConfig(config) {
    this._config = config;
    this._render();
  }

  set hass(hass) {
    const first = !this._hass;
    this._hass = hass;
    if (this._form) this._form.hass = hass;
    if (first && this._config) this._render();
  }

  _render() {
    if (!this._form) {
      this._form = document.createElement("ha-form");
      this._form.computeLabel = (s) => EDITOR_LABELS[s.name] || s.name;
      this._form.schema = EDITOR_SCHEMA;
      this._form.addEventListener("value-changed", (ev) => {
        ev.stopPropagation();
        const value = { ...ev.detail.value };
        for (const k of Object.keys(value)) {
          if (value[k] === "" || value[k] == null) delete value[k];
        }
        this._config = value;
        this.dispatchEvent(
          new CustomEvent("config-changed", { detail: { config: this._config }, bubbles: true, composed: true })
        );
      });
      this.appendChild(this._form);
    }
    this._form.hass = this._hass;
    this._form.data = {
      show_status: true,
      show_chips: true,
      show_settings: false,
      ...this._config,
    };
  }
}

customElements.define(CARD_TAG, ObsHaMczMaestroPlusCard);
customElements.define(EDITOR_TAG, ObsHaMczMaestroPlusCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: CARD_TAG,
  name: "Obs HA MCZ Maestro+",
  description: "Carte thermostat pour poêle à pellets MCZ Maestro+ : marche/arrêt, préréglage, ventilateurs, illustration animée et consigne à chevrons.",
  preview: true,
});

console.info(
  `%c OBS-HA-MCZ-MAESTROPLUS %c v${CARD_VERSION} `,
  "color:#fff;background:#e8958a;font-weight:700",
  "color:#e8958a;background:#333"
);
