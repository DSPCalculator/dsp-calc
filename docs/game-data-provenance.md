# Vanilla crafting increments and steady-state photon receiving

These are narrow vanilla-only additions to the existing **0.10.31.24710** dataset: Holo Beacon from **0.10.34**, Dark Fog Lens **crafting** from **0.10.35**, and a sourced **steady-state photon-receiving model** for the latter. They do **not** establish complete 0.10.34 or 0.10.35 support. Mod combination files remain unchanged. Sources were checked on 2026-10-04.

## Holo Beacon sources

The original export-tool author's maintained calculator fork contains a vanilla game export with Holo Beacon:

- [Pinned vanilla export](https://github.com/MengLeiFudge/dsp-calc/blob/87793666d0ed8210793a6380d95f767e73f8c624/src/engine/data/raw/Vanilla.json)
- [Data update commit, 2026-06-08](https://github.com/MengLeiFudge/dsp-calc/commit/d1b27ca0c16eeaa7b9da705e6d7c69e4f894f18e)
- [Original lighthouse icon](https://raw.githubusercontent.com/MengLeiFudge/dsp-calc/87793666d0ed8210793a6380d95f767e73f8c624/src/ui/components/icons/assets/Vanilla/lighthouse.png)
- [Independent recipe agreement in FactorioLab](https://github.com/factoriolab/factoriolab/blob/08ff58b11de5b619b9bf088cf81171ca418721da/public/data/dsp/data.json)

The original 80×80 game icon is copied without modification (SHA-256 `8f2c10f778922fcedac541f2310f2677d6aa82bfdaf2d996234bd3ebdf389f68`). Existing game-asset ownership and project license notices continue to apply.

## Holo Beacon data

- Item **2401**, 全息信标, Type **7**, GridIndex **2410**, icon **lighthouse**
- Recipe **161**, Type **4**, factories **2303 / 2304 / 2305 / 2318**
- **3 iron ingots + 4 prisms + 2 plasma exciters + 2 circuit boards → 1 Holo Beacon**
- **240 ticks / 4 seconds**, no coproducts, Proliferator **3** (extra output and acceleration)
- EM-Rail Ejector **2311** moves from grid **2410** to **2411**
- Vertical Launching Silo **2312** moves from grid **2411** to **2412**

The exporter fork has a different engine contract, including zero-time fractionation and synthetic recipes without IDs, so copying its entire file would be unsafe.

## Dark Fog Lens sources and limits

- The [official Steam announcements](https://steamcommunity.com/app/1366540/announcements/) identify Dark Fog Lens, its technology and crafting recipe as additions in **0.10.35.29057**. The following **0.10.35.29088** patch changes the ray-receiver lens buffer and fixes saved lens proliferation. Patch notes do not specify crafting quantities or certify this calculator's full dataset.
- The PlanetaryAnomalies author's [first-hand 0.10.35 update account](https://github.com/pwelty/planetary-anomalies/blob/05d588597ce3512db79a3f7d0cb8b3c57412b635/ROADMAP.md#051-the-first-game-update) identifies **recipe 162** as an ordinary assembler recipe with one output after inspecting the updated game.
- ProjectGenesis's [pinned prototype IDs](https://github.com/Awbugl/ProjectGenesis/blob/8d6b8abb786323ca0e362f9132da230b968227a9/src/Utils/ProtoID.cs) independently identifies **item 1211 / recipe 162**.
- OrbitalRing's [pinned recipe data](https://github.com/ProfessorCat305/OrbitalRing-MOD/blob/d493632fec370e08a27456b4a39533afcd38a206/data/recipes.json) supplies **1209 × 1 + 5201 × 12 → 1211 × 1**, **360 ticks**, and **NonProductive: false**. Its [item data](https://github.com/ProfessorCat305/OrbitalRing-MOD/blob/d493632fec370e08a27456b4a39533afcd38a206/data/items_vanilla.json) identifies the name, component Type **3** and icon path **Icons/ItemRecipe/darkfog-lens**.
- This is a mod data source, not a clean vanilla export. Its [changelog](https://github.com/ProfessorCat305/OrbitalRing-MOD/blob/d493632fec370e08a27456b4a39533afcd38a206/CHANGELOG.md) explicitly changes the lens to a defense-page slot and a Dark Fog assembler exclusive. Therefore its **Type 12**, **GridIndex 5809**, and handcraft restriction are **not imported**. The ordinary assembler family comes from the first-hand vanilla account above and this calculator's existing Type 4 mapping.
- As separate corroboration, [BWIKI's recipe table](https://wiki.biligame.com/dsp/index.php?title=%E5%85%AC%E5%BC%8F%E5%90%88%E9%9B%86:%E6%95%B0%E6%8D%AE&action=raw) agrees on **1 Graviton Lens + 12 Dark Fog Matrix → 1 Dark Fog Lens**, **6 seconds**, ordinary assemblers, handcrafting and extra products. The [item page](https://wiki.biligame.com/dsp/%E9%BB%91%E9%9B%BE%E5%BC%95%E5%8A%9B%E9%80%8F%E9%95%9C) identifies it as a component. These wiki sources corroborate the imported crafting fields. The separately scoped receiver model and its evidence are described below.

The [original 80×80 game icon mirrored by BWIKI](https://patchwiki.biligame.com/images/dsp/8/81/iyptgry201evpgaan5trzkt3ni620us.png) is copied without modification into `icon/Vanilla/darkfog-lens.png`, SHA-256 `a66a3c16d68088a62859912481bd813a9a5e7a35870f4727304f7a1817864cd8`. The icon was visually checked. It is a wiki-hosted game asset, not an official distribution endpoint; existing game-asset ownership and license notices continue to apply.

## Dark Fog Lens data

- Item **1211**, 黑雾引力透镜, Type **3**, icon **darkfog-lens**
- Recipe **162**, Type **4**, factories **2303 / 2304 / 2305 / 2318**
- **1 Graviton Lens (1209) + 12 Dark Fog Matrix (5201) → 1 Dark Fog Lens (1211)**
- **360 ticks / 6 seconds**, no coproducts, Proliferator **3** (extra output and acceleration)
- Dark Fog Matrix retains the existing drop/raw-source recipe **15201**, with no new mining or crafting source
- **ItemProto GridIndex remains null**, deliberately recording an unverified item/filter-selector position. [ProjectGenesis only says the vanilla slot is next to Graviton Lens](https://github.com/Awbugl/ProjectGenesis/blob/8d6b8abb786323ca0e362f9132da230b968227a9/src/Utils/JsonDataUtils.cs); this does not establish its item-selector coordinate. The Vanilla / standalone Dark Fog Synthesis picker now follows the separate **F-key crafting panel** visual reference, which places recipe **162** at **1606** (items page, row 6, column 6). This presentation-only fixture does not alter the null item GridIndex. See [crafting layout provenance](picker-layout.md)

Manufacturing proliferation is separate from spraying lenses used in ray receivers. Crafting retains its extra-product/acceleration modes; receiving uses the existing receiver-specific spray mode.

## Dark Fog Lens steady-state receiving

The [BWIKI ray-receiver revision 13649](https://wiki.biligame.com/dsp/index.php?title=%E5%B0%84%E7%BA%BF%E6%8E%A5%E6%94%B6%E7%AB%99&oldid=13649) and [Dark Fog Lens revision 13643](https://wiki.biligame.com/dsp/index.php?title=%E9%BB%91%E9%9B%BE%E5%BC%95%E5%8A%9B%E9%80%8F%E9%95%9C&oldid=13643) support **24 photons/min** without spray, **48 photons/min** with Mk.III spray, and **0.1 Dark Fog Lens/min per receiver**. The pinned lens page also states the **4× / 8×** reception multipliers and unchanged lens consumption when sprayed; photon rates use the receiver page’s documented conversion. The exact **0.1/min** consumption is wiki-sourced; it has not been independently verified against current game code.

This is a steady-state planning model: **full continuous reception (at least 20 minutes)**, sufficient Dyson power and adequate reception conditions are assumed. It does not simulate start-up, interrupted reception, or downtime lens consumption. It does not establish an exact Dark Fog Lens power-loss formula, and the calculator's electricity totals do not represent the required Dyson generation or reception losses.

- Calculator-only synthetic recipe **31208**, appended at index **240**; this is **not** a game crafting recipe ID
- Type **−1**, factory **2208** (the existing ray-receiver group), icon **photon-capacitor-full**
- **1/240 Dark Fog Lens (1211) → 1 critical photon (1208)** per **150 ticks / 2.5 seconds**
- Proliferator **4** (receiver-only mode **3**); it reuses the existing engine behavior without changing calculation formulas
- At default multipliers: no spray **24/min**, Mk.I **30/min**, Mk.II **36/min**, Mk.III **48/min**. The intermediate rates follow the existing **1.25× / 1.5×** spray effects; the **48/min** endpoint is also directly listed in the pinned receiver table
- All selectable spray levels retain **0.1 lens/min per full receiver**. Spray affects photon output per lens, not lens draw per building; proliferator supply is calculated separately using existing self-spray settings
- The existing custom acceleration multiplier remains available; the sourced rates above assume its default **1×** value
- Existing lens-free and ordinary Graviton Lens options retain their order, values and selected settings. The new option is appended as **critical-photon choice 3**, never made the default

`tests/dark-fog-receiving.test.js` verifies every selectable spray level (0/1/2/4 points), photon and lens rates, upstream lens crafting, antimatter demand, mixed receiver sources and fixed building counts. Unsupported manual-source spray settings remain rejected. No mod profile, receiver factory metadata or power-loss formula is changed.

## Save compatibility

Recipe **161** remains at index **238**, crafting recipe **162** remains at index **239**, and synthetic receiver recipe **31208** is appended at index **240**. All previous recipes retain their values, ordinals, per-item choices and factory-group ordering. `tests/game-data-version.test.jsx` pins the **238-, 239- and 240-recipe** prefix SHA-256 hashes and the prior 175-item prefix, and verifies existing per-item indices.

The migration recognizes only the **238-recipe** original Vanilla scheme, **239-recipe** Holo Beacon successor and **240-recipe** Dark Fog crafting successor with their matching added-item fields, targeting the exact **241-recipe** receiving revision. It adds only missing recipe configurations and genuinely new item defaults. The receiver alternative does not replace any critical-photon choice or item cost. Existing automatic strategies, named strategies, complete plans and source recipe references retain their settings, including customized Beacon/lens settings, ordinary receiver choices, source identities and fixed building quantities. Unknown sizes/profiles and conflicting increment fields are not guessed into compatibility.

Before an old automatic save is replaced, or an explicit save overwrites an old named strategy/complete plan, the exact original localStorage string is archived under `game_data_migration_backups`. Named entries are not rewritten or archived on load, so backup storage limits do not block a safe load. Archival failure leaves the original persisted data intact and blocks only the pending overwrite. Repeated identical archives are deduplicated. Explicit reset clears these archives together with the other calculator saves.

## Remaining 0.10.35 work

The vanilla **item/filter-selector** grid position remains unverified. The distinct F-key crafting position is now represented by a pinned community visual reference, not a current game-data export. Full current-build verification is still needed for receiver power output, Dyson demand, exact losses, start-up and interrupted reception, and independent game-code corroboration of the steady-state lens draw. The UI reports the base version and the supported crafting/steady-state scope explicitly; these additions are not a complete current-build export.

## Optional Dark Fog Synthesis profile

The standalone `DarkFogSynthesis` profile appends six author-verified synthesis recipes to this vanilla baseline without changing it. See [the frozen source contract, recipe table and persistence/compatibility boundaries](dark-fog-synthesis.md). Existing other mod profiles remain unchanged.
