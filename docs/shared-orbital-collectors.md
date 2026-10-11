# Shared hydrogen/deuterium orbital collection

The native game and standalone Dark Fog Synthesis profiles model hydrogen and deuterium orbital collection as two outputs of one gas-giant collector group. The resource settings contain one global hydrogen panel and one global deuterium panel; they describe that same group. There are no per-source planet parameters in the current saved-plan format. Ice-giant fire-ice collection and other mod profiles retain their existing independent calculations.

The existing per-building rates and mining multiplier remain the inputs to this model. This change does not revise the collector power/fuel-rate approximation.

## Fixed allocations and physical capacity

Manual source IDs, recipe selections, allocated rates, and building-bound quantities remain editable and are saved as before. Rows allocating the same product add together. Across hydrogen and deuterium, the physical fixed fleet is the larger of the two total equivalent collector requirements:

`max(total fixed H / H per collector, total fixed D / D per collector)`

The fleet emits both products. Explicit allocations are credited once, then only the remaining physical output appears as linked coproduct supply. A hydrogen allocation that is already covered by the deuterium fleet does not add another fleet. The building summary rounds the total physical requirement once, instead of adding rounded hydrogen and deuterium rows.

Individual source rows show allocation-equivalent collector requirements. The shared summary identifies the physical total so those row values are not added together.

## Automatic remainder policy

Automatic collector growth is available only for a product whose chosen automatic route is orbital collection. It must be justified by that product's remaining demand. The calculation considers a bounded set of cases: no additional collectors, or exact material balance for one of the selected collector products. Other material balances allow surplus from fixed allocations and coproducts.

This matters when hydrogen uses orbital collection but deuterium uses particle colliders: adding a fixed deuterium collector allocation supplies hydrogen and reduces the remaining coupled requirements. It does not authorize an arbitrarily large free hydrogen fleet to replace the user's chosen collider route by dumping hydrogen.

The source-aware solve is used for this coupled case even without manual rows. Unrelated plans and unverified mod collection layouts retain their established solver path.

## Presentation and persistence

Shared-group metadata, physical count ownership, linked coproduct rates, and surplus are derived from the current solve. They are not saved as duplicate source records. Flat and tree views use the same calculation and shared summary. Editing rates, deleting sources, changing mining settings, or loading a plan rebuilds the group.

Demand-bound source pausing is unchanged: removing the need for its primary item pauses that allocation. Shared coproduct demand does not revive it. Explicit standalone sources remain active. Automatic routes are restricted to demand-reachable products and inputs. Single-output routes with no fixed, external, or possible coproduct supply use exact balances, so surplus hydrogen cannot be hidden in deliberately overproduced fuel rods. Routes with legitimate coproduct or fixed supply retain surplus handling.
