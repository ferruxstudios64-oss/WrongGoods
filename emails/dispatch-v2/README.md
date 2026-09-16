# Dispatch / welcome template option

Separate draft option; do not change the live `signup-confirmation` alias or Worker.

Assets: `landing/public/email-assets/dispatch-hero-v2.jpg`, `dispatch-stamp-v2.gif`, `dispatch-scanner-v2.gif`.
Host assets before creating the Resend template; never send with missing asset URLs.
Motion plays once in under five seconds, with a complete first frame. Status, CTA and core copy remain real text.
Hero is AI-assisted brand concept imagery, not a representation of an included physical product.

Build decorative motion: `node emails/dispatch-v2/build-motion.mjs` (ImageMagick required).
Use the existing sender and reply-to from the published signup template. Create the new option under alias `signup-confirmation-dispatch-v2` as a draft.
Check rendered desktop/mobile layout and GIF retention in Resend before publishing or sending. No customer data or test sends are required to create this option.
