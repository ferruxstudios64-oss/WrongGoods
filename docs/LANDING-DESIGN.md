# Live-domain landing replacement

## Brief and references

Design a prelaunch landing page for game developers, filmmakers and world builders arriving at wronggoods.com. Its first job is to explain original fictional brands and graphic props; its conversion is explicit-consent release updates. Current traffic is user-reported at 1.57K unique visitors, not a customer/testimonial claim.

Primary direction: the owner's black/bone/high-vis brief and recovered WrongGoods storefront. Preserve industrial display type, restrained editorial serif, readable utility labels and tactile imagery. The recovered DAYSHIFT art-direction image supplies the media role, explicitly labelled AI concept. The old live Launch Manifest was inspected in-browser: its generic mockup positioning, excessive headline length, scroll-hidden sections and localStorage-only signup are problems to replace, not patterns to copy.

Refero MCP is unavailable; its bundled craft guidance supplies labelled forms, keyboard focus, actual persistence/error feedback, readable touch targets and progressive enhancement. BLKMARKET was requested as an aspirational reference in the original brief but could not be reached; no unseen design or assets are attributed to it.

## Reference lock and decision ledger

| Decision | Basis | Implementation |
| --- | --- | --- |
| Four-word proposition, explicit audience directly underneath | New business brief; current overlong headline obscures positioning | Fictional brands. Real character. |
| Near-black hero, large bone display type, yellow actions | Owner brand tokens | Sharp square surfaces; no gradients or ornamental dashboard cards |
| Dominant tactile image with visible concept disclaimer | Recovered DAYSHIFT image and honesty constraint | No finished-product or supplied-file implication |
| Bone editorial section and two product tones | Brief: straight-faced and satirical | Explain believable businesses and dry humour in concrete language |
| Text-led development index rather than a fake shop | Actual archives and pricing unverified | Three clearly labelled concepts; no buy buttons, free-file promises or compatibility badges |
| Prominent release bulletin and persistent consent | Original functional requirement and live form audit | Server validation, D1 persistence, useful errors, no mail-app dependency |
| Immediate content visibility | Current scroll-reveal screenshot leaves large blank areas | Essential content is visible without JS or scroll observers |
| Dedicated preview Worker | Original approval constraint | Keep live wrongergoods Worker and its domain bindings untouched until review |

The earlier logo is not represented as the final offset-O master. The landing uses a plain typeset wordmark without an invented construction rule or trademark symbol. Exact approved master remains an asset dependency.

## Deployment scope

The live apex and www domains are custom domains of Worker `wrongergoods`. The candidate is deployed separately as `wronggoods-landing-preview`. Signup uses the existing approved D1 database, so the urgent landing is independent of the pending Supabase secret. Later cutover must reconcile newly collected D1 signups with Supabase; retain D1 until that is verified.

Final live replacement needs the owner's review of the concrete preview, as explicitly required by the original brief. No DNS or paid-plan changes are proposed.
