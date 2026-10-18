# Obs HA MCZ Maestro+

Elle reprend le thème et les chevrons de [Thermostat Card – Bosch BTH-RA](https://github.com/Obseb/Thermostat-Card-Bosch-BTH-RA), en **deux fois plus haute** (8 lignes de grille au lieu de 4) et à la **même largeur** (6 colonnes).

## Ce que montre la carte

De haut en bas :

1. **En-tête** : badge rond + nom du poêle + état en cours (*Chauffe en cours*, *Allumage en cours*, *En veille*, *Extinction en cours*, *Éteint*, *Alarme*). À droite, l'**interrupteur Off ⇄ Chauffe** (`off` ⇄ `heat`).
2. **3 cases alignées** :
   - **Préréglage** : `manual`, `auto`, `overnight`, `comfort`, `turbo` (selon le modèle). Un appui ouvre la liste.
   - **Ventilo 1** et **Ventilo 2** : niveau actuel (ex. `3/5`) ou mode (Auto…). Un appui ouvre les niveaux, les modes et « Arrêt ». L'icône tourne d'autant plus vite que le niveau est élevé.
3. **Grande illustration de poêle** (style icônes Home Assistant, type MCZ Mood) animée selon l'état :
   flamme vive en chauffe, flamme réduite pendant l'allumage, braises en veille, air chaud qui monte quand un ventilateur tourne.
4. **Température actuelle** (grande, colorée selon l'état) et **consigne** avec les chevrons ▲ / ▼ (envoi différé de 0,9 s, comme la carte Bosch).

### Fonctions ajoutées (autour du poêle)

Ces pastilles sont **détectées automatiquement** et n'apparaissent que si l'entité existe :

| Pastille | Entité de l'intégration | Action |
| --- | --- | --- |
| 🌡 Température des fumées | `sensor.<poele>_exhaust_temperature` | lecture |
| 💧 Température de l'eau (modèles hydro) | `sensor.<poele>_water_temperature` | lecture |
| 🔧 Heures avant entretien (jaune ≤ 20 h) | `sensor.<poele>_next_maintenance` | lecture |
| 🔥 Puissance manuelle | `select.<poele>_manual_power` | ouvre la liste des niveaux |
| 🍃 Éco (Start & Stop) | `switch.<poele>_start_stop` | bascule |
| ⏱ Chrono | `switch.<poele>_timer` | bascule |
| ⚠ Bandeau d'alarme + code + bouton **Réinitialiser** | `binary_sensor.<poele>_alarm`, `sensor.<poele>_last_alarm_code`, `button.<poele>_alarm_reset` | réinitialise l'alarme |

`<poele>` est le nom de votre entité `climate` (par exemple `climate.stufa` → `sensor.stufa_exhaust_temperature`). Si vos entités ont un autre nom, la carte cherche aussi parmi les entités du **même appareil** d'après leur nom affiché, et vous pouvez toujours les indiquer à la main (voir ci-dessous).

## Installation via HACS

1. HACS → ⋮ → **Dépôts personnalisés**.
2. Ajoutez `https://github.com/Obseb/Obs-HA-MCZ-MaestroPlus`, catégorie **Dashboard** (ou « Lovelace » selon la version).
3. Installez **Obs HA MCZ Maestro+**, puis rechargez le navigateur (Ctrl+F5).

Si la ressource n'est pas ajoutée automatiquement : *Paramètres → Tableaux de bord → ⋮ → Ressources* → ajoutez `/hacsfiles/Obs-HA-MCZ-MaestroPlus/obs-ha-mcz-maestroplus.js` (type **Module JavaScript**).

## Installation manuelle

Copiez `obs-ha-mcz-maestroplus.js` dans `/config/www/` et ajoutez la ressource `/local/obs-ha-mcz-maestroplus.js` (Module JavaScript).

## Configuration

Le plus simple :

```yaml
type: custom:obs-ha-mcz-maestroplus
entity: climate.stufa
name: Poêle salon
```

Tout le reste est détecté automatiquement. Un éditeur visuel est aussi disponible.

| Option | Type | Défaut | Description |
| --- | --- | --- | --- |
| `entity` | string | **requis** | Entité `climate.xxx` de l'intégration Maestro MCZ |
| `name` | string | nom de l'entité | Titre de la carte |
| `icon` | string | selon l'état | Icône du badge (ex. `mdi:fire`) |
| `image` | string | dessin intégré | URL d'une image à afficher à la place du dessin du poêle (ex. `/local/mood.png`) |
| `heat_mode` | string | `heat` | Mode activé par l'interrupteur |
| `step` | number | `0.5` | Pas de la consigne |
| `show_status` | boolean | `true` | Affiche l'état sous le nom |
| `show_chips` | boolean | `true` | Affiche les pastilles autour du poêle |
| `show_settings` | boolean | `false` | Affiche l'icône ⚙ (fenêtre « plus d'infos ») |
| `fan1`, `fan2` | entity | auto | Entités `fan` des ventilateurs 1 et 2 |
| `power` | entity | auto | Entité `select` de la puissance manuelle |
| `eco`, `timer` | entity | auto | Entités `switch` Start & Stop et Chrono |
| `exhaust_temp`, `water_temp`, `maintenance` | entity | auto | Entités `sensor` |
| `alarm`, `alarm_code`, `alarm_reset` | entity | auto | Alarme (`binary_sensor`, `sensor`, `button`) |

Pour masquer une pastille ou une case, mettez son option à `false` (ex. `fan2: false`, `timer: false`).

### Exemple complet

```yaml
type: custom:obs-ha-mcz-maestroplus
entity: climate.stufa
name: Poêle salon
fan1: fan.stufa_fan_1
fan2: fan.stufa_fan_2
power: select.stufa_manual_power
eco: switch.stufa_start_stop
timer: switch.stufa_timer
exhaust_temp: sensor.stufa_exhaust_temperature
maintenance: sensor.stufa_next_maintenance
water_temp: false
```

### Personnalisation du thème

Variables CSS utilisables (ex. avec card-mod) : `--htc-card-bg`, `--htc-tile-bg`, `--htc-stove` (couleur du trait du poêle), `--htc-menu-bg`.

## Notes sur l'intégration Maestro MCZ

- Le mode du `climate` n'a que deux valeurs : `off` et `heat`. Le détail (allumage, veille, extinction) vient de `hvac_action`, que la carte traduit en texte et en animation.
- Les ventilateurs ne sont disponibles que si le **préréglage du poêle** les autorise : la case est grisée sinon.
- Les ventilateurs sont des entités `fan` : le niveau est envoyé en pourcentage avec la même formule que Home Assistant, et les modes (`auto`…) via `fan.set_preset_mode`.
- Le nombre de préréglages et de niveaux dépend du modèle (M1, M2, M3) : la carte lit simplement ce que l'entité expose.

## Publier sur GitHub pour HACS

Créez d'abord le dépôt vide `Obs-HA-MCZ-MaestroPlus` sur GitHub, puis, depuis ce dossier :

```
git remote add origin https://github.com/Obseb/Obs-HA-MCZ-MaestroPlus.git
git push -u origin main
```

Ajoutez une **description** et des **topics** (`home-assistant`, `hacs`, `lovelace`, `mcz`), puis créez une **release** (ex. `v1.0.0`) : HACS s'en sert pour les versions. Le workflow `.github/workflows/validate.yml` vérifie la structure du dépôt.
