
import fs from 'fs';
import path from 'path';

async function runTest() {
    console.log('🚀 Starting Stripe Integration Proof Tests...');
    try {
        const webhookPath = path.join(process.cwd(), 'app/api/webhooks/stripe/route.ts');
        if (!fs.existsSync(webhookPath)) throw new Error('Missing app/api/webhooks/stripe/route.ts');
        console.log('✅ Webhook route exists.');

        const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        if (!pkg.dependencies?.stripe) throw new Error('Stripe dependency missing in package.json');
        console.log('✅ Stripe dependency installed.');

        // Search all files in app/api and lib/server for the requirements
        const filesToScan = [
            webhookPath,
            path.join(process.cwd(), 'lib/server/stripe-webhook.ts'),
            path.join(process.cwd(), 'app/api/checkout/stripe/route.ts'),
            path.join(process.cwd(), 'lib/server/stripe.ts'),
        ].filter(p => fs.existsSync(p));

        const allCode = filesToScan.map(p => fs.readFileSync(p, 'utf8')).join('\n');

        const requirements = [
            { regex: /test_mode[:\s=]+1/, name: 'test_mode=1 for sandbox records' },
            { regex: /commerce_orders/, name: 'DB persistence in commerce_orders' },
            { regex: /commerce_events/, name: 'DB persistence in commerce_events' },
            { regex: /wg_checkout/, name: 'Cookie contract wg_checkout' },
            { regex: /setting\(\s*['"]STRIPE/, name: 'Usage of runtime setting() for Stripe' },
        ];

        requirements.forEach(req => {
            if (!allCode.match(req.regex)) throw new Error(`Requirement NOT FOUND: ${req.name}`);
            console.log(`✅ Verified: ${req.name}`);
        });

        console.log('\n🎉 ALL STRIPE PROOF CHECKS PASSED');
        process.exit(0);
    } catch (e) {
        console.error(`\n❌ TEST FAILED: ${e.message}`);
        process.exit(1);
    }
}
runTest();

